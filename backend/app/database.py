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