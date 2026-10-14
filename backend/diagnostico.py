from app.database import get_connection
from app.utils.security import verificar_password

conn = get_connection()
cursor = conn.cursor()
cursor.execute("SELECT password FROM usuarios WHERE email = 'admin@promoiq.com'")
hash_bd = cursor.fetchone()[0]
conn.close()

print("Hash guardado:", repr(hash_bd))
print("Largo del hash:", len(hash_bd))
print("Resultado con 'admin123':", verificar_password('admin123', hash_bd))