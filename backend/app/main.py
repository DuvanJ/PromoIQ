from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import test_connection
from app.routers import auth, dinamicas, consultas, admin, admin_pais, exportar, asistente, notificaciones, paises, tiendas
from app.routers.notificaciones import job_notificar_vencimientos_automatico

app = FastAPI(
    title="PromoIQ API",
    description="Centro de Inteligencia de Dinámicas Comerciales",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

scheduler = BackgroundScheduler()

@app.on_event("startup")
def startup():
    if test_connection():
        print("✅ Conexión a SQL Server exitosa")
    else:
        print("❌ Error conectando a SQL Server")

    scheduler.add_job(
        job_notificar_vencimientos_automatico,
        'cron',
        hour=8,
        minute=0,
        id='notificar_vencimientos',
        replace_existing=True
    )
    scheduler.start()
    print("🕐 Scheduler de notificaciones iniciado — corre todos los días a las 8:00 AM")

@app.on_event("shutdown")
def shutdown():
    scheduler.shutdown()
    print("🛑 Scheduler detenido")

@app.get("/")
def root():
    return {"mensaje": "PromoIQ API funcionando correctamente"}

@app.get("/health")
def health():
    if test_connection():
        return {"status": "ok", "database": "conectada", "sistema": "PromoIQ"}
    return {"status": "error", "database": "sin conexión"}