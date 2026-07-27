from pydantic import BaseModel
from typing import Optional

class LoginRequest(BaseModel):
    usuario: str
    password: str

class ArticuloQuery(BaseModel):
    pregunta: str

class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    usuario: str
    rol: str