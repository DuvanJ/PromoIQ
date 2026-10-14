import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HORAS = 8

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY no está configurada — definila en el archivo .env")

security = HTTPBearer()

def crear_token(data: dict):
    datos = data.copy()
    expira = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HORAS)
    datos.update({"exp": expira})
    return jwt.encode(datos, SECRET_KEY, algorithm=ALGORITHM)

def verificar_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        usuario_id = payload.get("sub")
        rol = payload.get("rol")
        nombre = payload.get("nombre")
        tienda = payload.get("tienda")
        pais = payload.get("pais")
        if usuario_id is None or rol is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return {
            "id": usuario_id,
            "nombre": nombre,
            "rol": rol,
            "tienda": tienda,
            "pais": pais
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")