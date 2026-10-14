from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel
from app.database import get_connection
from app.auth import crear_token
from app.utils.security import verificar_password
from app.logging_config import app_logger
import os
import secrets
from app.utils.security import encriptar_password
from app.routers.notificaciones import enviar_email, template_base

router = APIRouter(prefix="/auth", tags=["Autenticación"])
limiter = Limiter(key_func=get_remote_address)

MAX_INTENTOS_FALLIDOS = 5
MINUTOS_BLOQUEO = 10


class LoginRequest(BaseModel):
    tipo_acceso: str  # "colaborador" | "tienda"
    numero_colaborador: str = None  # modo colaborador
    pais: str = None                # modo colaborador ("GLOBAL" para superadmin)
    usuario: str = None             # modo tienda — login tradicional por nombre
    password: str


@router.post("/login")
@limiter.limit("30/minute")
def login(request: Request, datos: LoginRequest):
    """
    Dos modos de acceso:
    - "colaborador": admin/comercial/planning/superadmin, cuenta
      individual por persona — login por número de colaborador +
      país (único dentro de cada país; "GLOBAL" para Superadmin).
    - "tienda": rol tiendas, cuenta compartida por tienda/país tal
      como ya existía — login por nombre de usuario tradicional
      (ej. "Tiendas CR"), sin cambios respecto al flujo original.
    """
    conn = get_connection()
    cursor = conn.cursor()

    if datos.tipo_acceso == "tienda":
        if not datos.usuario:
            conn.close()
            raise HTTPException(status_code=400, detail="Falta el usuario")

        cursor.execute("""
            SELECT u.id, u.nombre, u.email, r.codigo, u.tiendas, u.pais, u.password,
                   u.intentos_fallidos, u.bloqueado_hasta
            FROM usuarios u
            INNER JOIN cat_roles r ON u.rol_id = r.id
            WHERE u.nombre = ? AND u.activo = 1
        """, (datos.usuario,))

    else:  # "colaborador"
        if not datos.numero_colaborador:
            conn.close()
            raise HTTPException(status_code=400, detail="Falta el número de colaborador")

        pais_busqueda = None if (not datos.pais or datos.pais.upper() == "GLOBAL") else datos.pais

        if pais_busqueda:
            cursor.execute("""
                SELECT u.id, u.nombre, u.email, r.codigo, u.tiendas, u.pais, u.password,
                       u.intentos_fallidos, u.bloqueado_hasta
                FROM usuarios u
                INNER JOIN cat_roles r ON u.rol_id = r.id
                WHERE u.numero_colaborador = ? AND u.pais = ? AND u.activo = 1
            """, (datos.numero_colaborador, pais_busqueda))
        else:
            # NULLIF convierte '' a NULL antes de comparar — así una
            # cuenta "Global" queda cubierta sin importar si el campo
            # pais quedó guardado como NULL o como cadena vacía
            cursor.execute("""
                SELECT u.id, u.nombre, u.email, r.codigo, u.tiendas, u.pais, u.password,
                       u.intentos_fallidos, u.bloqueado_hasta
                FROM usuarios u
                INNER JOIN cat_roles r ON u.rol_id = r.id
                WHERE u.numero_colaborador = ? AND NULLIF(u.pais, '') IS NULL AND u.activo = 1
            """, (datos.numero_colaborador,))

    usuario = cursor.fetchone()

    if not usuario:
        conn.close()
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    intentos_fallidos = usuario[7] or 0
    bloqueado_hasta = usuario[8]

    if bloqueado_hasta and bloqueado_hasta > datetime.utcnow():
        minutos_restantes = int((bloqueado_hasta - datetime.utcnow()).total_seconds() / 60) + 1
        conn.close()
        raise HTTPException(
            status_code=429,
            detail=f"Cuenta bloqueada temporalmente por múltiples intentos fallidos. Probá de nuevo en {minutos_restantes} minuto(s)."
        )

    password_bd = usuario[6]

    try:
        password_valida = verificar_password(datos.password, password_bd)
    except Exception as e:
        app_logger.error(f"[login] Error verificando password para usuario id={usuario[0]}: {e}")
        password_valida = False

    if not password_valida:
        nuevos_intentos = intentos_fallidos + 1

        if nuevos_intentos >= MAX_INTENTOS_FALLIDOS:
            bloqueo = datetime.utcnow() + timedelta(minutes=MINUTOS_BLOQUEO)
            cursor.execute("""
                UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = ? WHERE id = ?
            """, (bloqueo, usuario[0]))
            conn.commit()
            conn.close()
            raise HTTPException(
                status_code=429,
                detail=f"Cuenta bloqueada temporalmente por {MINUTOS_BLOQUEO} minutos por múltiples intentos fallidos."
            )
        else:
            cursor.execute("""
                UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?
            """, (nuevos_intentos, usuario[0]))
            conn.commit()
            conn.close()
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    cursor.execute("""
        UPDATE usuarios
        SET ultimo_acceso = GETDATE(), intentos_fallidos = 0, bloqueado_hasta = NULL
        WHERE id = ?
    """, (usuario[0],))
    conn.commit()
    conn.close()

    token = crear_token({
        "sub": str(usuario[0]),
        "nombre": usuario[1],
        "email": usuario[2],
        "rol": usuario[3],
        "tienda": usuario[4] or "",
        "pais": usuario[5] or ""
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            "id": usuario[0],
            "nombre": usuario[1],
            "email": usuario[2],
            "rol": usuario[3],
            "tienda": usuario[4] or "",
            "pais": usuario[5] or ""
        }
    }



FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class OlvidePasswordRequest(BaseModel):
    numero_colaborador: str
    pais: str
    email: str


class RestablecerPasswordRequest(BaseModel):
    token: str
    password_nueva: str


@router.post("/olvide-password")
@limiter.limit("5/hour")
def olvide_password(request: Request, datos: OlvidePasswordRequest):
    """
    Solicita el restablecimiento de contraseña — exclusivo de cuentas
    de colaborador (individuales, con email propio). Las cuentas de
    tienda son compartidas, así que su contraseña se restablece
    contactando a un administrador, no por autoservicio.

    Siempre devuelve el mismo mensaje genérico, coincida o no la
    cuenta — así nadie puede usar este endpoint para confirmar si un
    número de colaborador o un email existen en el sistema.
    """
    mensaje_generico = {
        "mensaje": "Si los datos coinciden con una cuenta, vas a recibir un correo con instrucciones en los próximos minutos."
    }

    pais_busqueda = None if datos.pais.upper() == "GLOBAL" else datos.pais

    conn = get_connection()
    cursor = conn.cursor()
    try:
        if pais_busqueda:
            cursor.execute("""
                SELECT id, nombre FROM usuarios
                WHERE numero_colaborador = ? AND pais = ? AND email = ? AND activo = 1
            """, (datos.numero_colaborador, pais_busqueda, datos.email.strip().lower()))
        else:
            cursor.execute("""
                SELECT id, nombre FROM usuarios
                WHERE numero_colaborador = ? AND NULLIF(pais, '') IS NULL AND email = ? AND activo = 1
            """, (datos.numero_colaborador, datos.email.strip().lower()))

        usuario = cursor.fetchone()
        if not usuario:
            return mensaje_generico

        token = secrets.token_urlsafe(32)
        expira = datetime.utcnow() + timedelta(minutes=30)
        cursor.execute("""
            UPDATE usuarios SET reset_token = ?, reset_token_expira = ? WHERE id = ?
        """, (token, expira, usuario[0]))
        conn.commit()

        link = f"{FRONTEND_URL}?reset_token={token}"
        html = template_base(
            "🔑 Restablecer tu contraseña",
            f"""
            <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Hola <strong>{usuario[1]}</strong>, pediste restablecer tu contraseña en PromoIQ.
            </p>
            <p style="text-align:center;margin:24px 0;">
                <a href="{link}" style="background:#1E2761;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">
                    Elegir nueva contraseña
                </a>
            </p>
            <p style="color:#8892A4;font-size:13px;margin:0;">
                Este enlace vence en 30 minutos. Si no fuiste vos, ignorá este correo — tu contraseña actual sigue funcionando.
            </p>
            """
        )
        try:
            enviar_email(datos.email.strip().lower(), "🔑 PromoIQ — Restablecer tu contraseña", html)
        except Exception as e:
            app_logger.warning(f"[olvide_password] Error enviando email a usuario id={usuario[0]}: {e}")

        return mensaje_generico
    finally:
        conn.close()


@router.post("/restablecer-password")
@limiter.limit("10/hour")
def restablecer_password(request: Request, datos: RestablecerPasswordRequest):
    """Confirma el restablecimiento con el token recibido por correo."""
    if len(datos.password_nueva) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, reset_token_expira FROM usuarios WHERE reset_token = ?
        """, (datos.token,))
        fila = cursor.fetchone()

        if not fila or not fila[1] or fila[1] < datetime.utcnow():
            raise HTTPException(status_code=400, detail="El enlace ya no es válido. Solicitá uno nuevo.")

        nuevo_hash = encriptar_password(datos.password_nueva)
        cursor.execute("""
            UPDATE usuarios
            SET password = ?, reset_token = NULL, reset_token_expira = NULL,
                intentos_fallidos = 0, bloqueado_hasta = NULL
            WHERE id = ?
        """, (nuevo_hash, fila[0]))
        conn.commit()
        return {"mensaje": "Contraseña actualizada correctamente. Ya podés iniciar sesión."}
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"[restablecer_password] Error: {e}")
        raise HTTPException(status_code=400, detail="No se pudo restablecer la contraseña")
    finally:
        conn.close()
