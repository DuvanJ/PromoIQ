from pydantic import BaseModel
from typing import Optional

class ArticuloQuery(BaseModel):
    pregunta: str
    tienda_codigo: str = None
    pais_seleccionado: str = None

class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    usuario: str
    rol: str