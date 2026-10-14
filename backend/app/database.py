import os
import pyodbc
from dotenv import load_dotenv
from sqlalchemy import create_engine
from urllib.parse import quote_plus
from app.logging_config import app_logger

load_dotenv()

# ── Configuración por variables de entorno ────────────────
# Hoy (local, SQL Express, autenticación de Windows):
#   DB_SERVER=DESKTOP-DU6R536\SQLEXPRESS
#   DB_DATABASE=PromoIQ
#   (no hace falta DB_USER/DB_PASSWORD -> usa Trusted_Connection)
#
# El día de la migración a Azure SQL (autenticación SQL):
#   DB_SERVER=tu-servidor.database.windows.net
#   DB_DATABASE=PromoIQ
#   DB_USER=tu_usuario
#   DB_PASSWORD=tu_password
#   DB_DRIVER=ODBC Driver 18 for SQL Server   (opcional, Azure recomienda 18)
#
# Ningún código de los routers cambia — solo estas variables.

DB_SERVER = os.getenv("DB_SERVER", "DESKTOP-DU6R536\\SQLEXPRESS")
DB_DATABASE = os.getenv("DB_DATABASE", "PromoIQ")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

# Pool — ajustable por entorno sin tocar código
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
DB_POOL_MAX_OVERFLOW = int(os.getenv("DB_POOL_MAX_OVERFLOW", "10"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # 30 min


def _construir_connection_string() -> str:
    """
    Arma el string de conexión ODBC. Si hay usuario/password (caso
    Azure SQL), usa autenticación SQL; si no, usa Trusted_Connection
    (caso actual, Windows Auth en SQL Express local).
    """
    partes = [
        f"DRIVER={{{DB_DRIVER}}}",
        f"SERVER={DB_SERVER}",
        f"DATABASE={DB_DATABASE}",
    ]
    if DB_USER and DB_PASSWORD:
        partes.append(f"UID={DB_USER}")
        partes.append(f"PWD={DB_PASSWORD}")
        # Azure SQL exige conexión cifrada
        partes.append("Encrypt=yes")
        partes.append("TrustServerCertificate=no")
    else:
        partes.append("Trusted_Connection=yes")

    return ";".join(partes) + ";"


_connection_string = _construir_connection_string()
_odbc_connect_str = quote_plus(_connection_string)

# ── Engine con pool de conexiones ──────────────────────────
# pool_pre_ping evita entregar conexiones muertas (por ejemplo si
# SQL Server cerró una conexión inactiva) — las reemplaza sola.
engine = create_engine(
    f"mssql+pyodbc:///?odbc_connect={_odbc_connect_str}",
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_POOL_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    pool_recycle=DB_POOL_RECYCLE,
    pool_pre_ping=True,
    fast_executemany=True,
)


def get_connection():
    """
    Devuelve una conexión pyodbc tomada del pool — misma interfaz
    de siempre (.cursor(), .commit(), .close()). Los routers no
    necesitan cambiar nada: siguen usando get_connection() igual.

    .close() no cierra la conexión física, la devuelve al pool para
    que otro request la reutilice — así se evita abrir/cerrar una
    conexión nueva por cada llamada, que es el principal cuello de
    botella bajo muchos usuarios concurrentes.
    """
    return engine.raw_connection()


def test_connection():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        conn.close()
        return True
    except Exception as e:
        app_logger.error(f"[test_connection] Error de conexión: {e}")
        return False


def registrar_auditoria(usuario: dict, accion: str, entidad: str, entidad_id: str = None, pais: str = None, detalle: str = None):
    """
    Registra una acción administrativa en el log de auditoría.
    Nunca debe romper el flujo principal — si falla, se deja
    registrado en app.log para poder detectar el problema después,
    en vez de perderse silenciosamente.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO auditoria_log (usuario_id, usuario_nombre, accion, entidad, entidad_id, pais, detalle)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (usuario["id"], usuario["nombre"], accion, entidad, entidad_id, pais, detalle))
        conn.commit()
        conn.close()
    except Exception as e:
        app_logger.error(f"[registrar_auditoria] Error registrando auditoría (usuario {usuario.get('id')}, acción {accion} sobre {entidad} {entidad_id}): {e}")
