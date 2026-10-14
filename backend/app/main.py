import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import pyodbc
from app.database import test_connection
from app.logging_config import app_logger, access_logger
from app.routers import auth, dinamicas, consultas, admin, admin_pais, exportar, asistente, notificaciones, paises, tiendas

app = FastAPI(
    title="PromoIQ API",
    description="Centro de Inteligencia de Dinámicas Comerciales",
    version="1.0.0"
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Manejo centralizado de errores de base de datos ──────────────
# Traduce errores crudos de pyodbc/SQL Server a mensajes seguros y
# genéricos. El detalle técnico completo (código SQL, nombre de
# restricción, etc.) queda solo en app.log — nunca llega al cliente.
# Esto cubre CUALQUIER endpoint que deje subir una excepción de
# pyodbc sin capturarla localmente, sin necesidad de tocar cada uno.
@app.exception_handler(pyodbc.Error)
async def manejar_error_pyodbc(request: Request, exc: pyodbc.Error):
    mensaje = str(exc)
    app_logger.warning(f"Error de base de datos en {request.method} {request.url.path}: {mensaje}")

    mensaje_lower = mensaje.lower()

    # Violación de restricción UNIQUE (código SQLSTATE 23000)
    if "23000" in mensaje or "unique" in mensaje_lower or "duplicate" in mensaje_lower:
        if "numero_colaborador" in mensaje_lower or "uq_colaborador" in mensaje_lower:
            detalle = "Ese número de colaborador ya está en uso para ese país."
        elif "email" in mensaje_lower or "uq__usuarios" in mensaje_lower:
            detalle = "Ya existe un usuario registrado con ese email."
        else:
            detalle = "El registro ya existe o entra en conflicto con datos existentes."
        return JSONResponse(status_code=400, content={"detail": detalle})

    # Violación de llave foránea — referencia a algo que no existe
    if "foreign key" in mensaje_lower or "reference" in mensaje_lower:
        return JSONResponse(
            status_code=400,
            content={"detail": "La operación hace referencia a un registro que no existe o está en uso."}
        )

    # Cualquier otro error de base de datos no anticipado
    return JSONResponse(
        status_code=500,
        content={"detail": "Ocurrió un error accediendo a la base de datos. Si el problema persiste, contactá al equipo técnico."}
    )


# ── Red de seguridad final — cualquier excepción no controlada ──
# que no sea de pyodbc ni HTTPException (FastAPI maneja esas por su
# cuenta) cae acá. Nunca expone el mensaje real de Python al cliente.
@app.exception_handler(Exception)
async def manejar_error_no_controlado(request: Request, exc: Exception):
    app_logger.exception(f"Error no controlado en {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Ocurrió un error procesando la solicitud. Si el problema persiste, contactá al equipo técnico."}
    )


# ── Middleware de logging: tiempo de respuesta + errores no controlados ──
# Nota: con los exception_handler de arriba ya registrados, las
# excepciones se resuelven ANTES de llegar al try/except de este
# middleware — el bloque except de acá queda como red de respaldo
# por si algo se escapa incluso de los handlers (no debería pasar,
# pero no cuesta nada dejarlo).
@app.middleware("http")
async def middleware_logging(request: Request, call_next):
    inicio = time.time()
    try:
        response = await call_next(request)
    except Exception:
        duracion_ms = round((time.time() - inicio) * 1000, 1)
        app_logger.exception(
            f"EXCEPCIÓN NO CONTROLADA (fuera de handlers) | {request.method} {request.url.path} | {duracion_ms}ms"
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno del servidor. El equipo técnico fue notificado."}
        )

    duracion_ms = round((time.time() - inicio) * 1000, 1)
    access_logger.info(
        f"{request.method} {request.url.path} | status={response.status_code} | {duracion_ms}ms"
    )

    if duracion_ms > 5000:
        app_logger.warning(
            f"REQUEST LENTO | {request.method} {request.url.path} | {duracion_ms}ms"
        )

    return response


app.include_router(auth.router)
app.include_router(dinamicas.router)
app.include_router(consultas.router)
app.include_router(admin.router)
app.include_router(admin_pais.router)
app.include_router(exportar.router)
app.include_router(asistente.router)
app.include_router(notificaciones.router)
app.include_router(paises.router)
app.include_router(tiendas.router)


@app.on_event("startup")
def startup():
    if test_connection():
        app_logger.info("Conexión a SQL Server exitosa")
        print("✅ Conexión a SQL Server exitosa")
    else:
        app_logger.error("Error conectando a SQL Server")
        print("❌ Error conectando a SQL Server")

    app_logger.info("Recordatorio: el scheduler de notificaciones corre como proceso aparte (scheduler_standalone.py)")


@app.get("/")
def root():
    return {"mensaje": "PromoIQ API funcionando correctamente"}

@app.get("/health")
def health():
    if test_connection():
        return {"status": "ok", "database": "conectada", "sistema": "PromoIQ"}
    app_logger.error("Health check falló — sin conexión a la base de datos")
    return {"status": "error", "database": "sin conexión"}
