import pyodbc

SERVER = "DESKTOP-DU6R536\\SQLEXPRESS"
DATABASE = "PromoIQ"

def get_connection():
    conn = pyodbc.connect(
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={SERVER};"
        f"DATABASE={DATABASE};"
        f"Trusted_Connection=yes;"
    )
    return conn

def test_connection():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        conn.close()
        return True
    except Exception as e:
        print(f"Error de conexión: {e}")
        return False

def registrar_auditoria(usuario: dict, accion: str, entidad: str, entidad_id: str = None, pais: str = None, detalle: str = None):
    """
    Registra una acción administrativa en el log de auditoría.
    Nunca debe romper el flujo principal — si falla, solo se imprime el error.
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
        print(f"⚠️ Error registrando auditoría: {e}")