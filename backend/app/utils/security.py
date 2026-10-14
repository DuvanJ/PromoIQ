# ============================================================
# Utilidad: security.py
# Descripción: Funciones para encriptar y verificar contraseñas
# Librería: passlib con bcrypt
# ============================================================

from passlib.context import CryptContext

# Contexto de encriptación con bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def encriptar_password(password: str) -> str:
    """Convierte una contraseña en texto plano a hash bcrypt"""
    return pwd_context.hash(password)

def verificar_password(password_plano: str, password_hash: str) -> bool:
    """Verifica si una contraseña en texto plano coincide con el hash"""
    return pwd_context.verify(password_plano, password_hash)