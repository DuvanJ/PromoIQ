from app.database import get_connection

conn = get_connection()
cursor = conn.cursor()
cursor.execute("""
    SELECT u.id, u.nombre, u.email, r.codigo, u.tiendas, u.pais, u.password,
           u.intentos_fallidos, u.bloqueado_hasta
    FROM usuarios u
    INNER JOIN cat_roles r ON u.rol_id = r.id
    WHERE u.numero_colaborador = ? AND u.pais IS NULL AND u.activo = 1
""", ("1",))

fila = cursor.fetchone()
conn.close()

if fila:
    print("Encontrado:", fila)
else:
    print("NO se encontró ninguna fila con esa consulta")