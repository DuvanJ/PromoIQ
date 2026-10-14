from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from jose import jwt, JWTError
from app.auth import SECRET_KEY, ALGORITHM

def key_por_usuario(request: Request) -> str:
    """
    Identifica al límite por el ID del usuario autenticado (extraído
    directamente del JWT en el header Authorization), en vez de por
    IP — así el límite es por persona, no por red compartida.
    Si no hay token válido (no debería pasar en un endpoint ya
    protegido por verificar_token, pero por robustez), cae a la IP.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "", 1)
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            usuario_id = payload.get("sub")
            if usuario_id:
                return f"usuario:{usuario_id}"
        except JWTError:
            pass
    return get_remote_address(request)


limiter_usuario = Limiter(key_func=key_por_usuario)