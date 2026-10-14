from app.database import get_connection

conn = get_connection()
cursor = conn.cursor()

print("=== Prueba 1: solo por numero_colaborador ===")
cursor.execute("SELECT id, nombre, pais, activo, numero_colaborador FROM usuarios WHERE numero_colaborador = ?", ("1",))
print(cursor.fetchall())

print("\n=== Prueba 2: numero_colaborador con CAST explícito ===")
cursor.execute("SELECT id, nombre, pais, activo FROM usuarios WHERE CAST(numero_colaborador AS VARCHAR(20)) = ?", ("1",))
print(cursor.fetchall())

print("\n=== Prueba 3: el JOIN con cat_roles ===")
cursor.execute("""
    SELECT u.id, u.nombre, r.codigo
    FROM usuarios u
    INNER JOIN cat_roles r ON u.rol_id = r.id
    WHERE u.numero_colaborador = ?
""", ("1",))
print(cursor.fetchall())

print("\n=== Prueba 4: el tipo de dato real de la columna ===")
cursor.execute("""
    SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'numero_colaborador'
""")
print(cursor.fetchall())

conn.close()