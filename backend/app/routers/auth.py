from fastapi import APIRouter, HTTPException
from app.database import get_connection
from app.models import LoginRequest
from app.auth import crear_token
from app.utils.security import verificar_password

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login")
def login(request: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()

    # Buscar usuario por nombre
    cursor.execute("""
        SELECT u.id, u.nombre, u.email, r.codigo, u.tiendas, u.pais, u.password
        FROM usuarios u
        INNER JOIN cat_roles r ON u.rol_id = r.id
        WHERE u.nombre = ? AND u.activo = 1
    """, (request.usuario,))

    usuario = cursor.fetchone()

    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    # Verificar contraseña — soporta bcrypt y texto plano (migración gradual)
    password_bd = usuario[6]
    password_valida = False

    try:
        # Intentar verificar como bcrypt
        password_valida = verificar_password(request.password, password_bd)
    except Exception:
        # Si falla, verificar como texto plano (usuarios sin migrar)
        password_valida = (request.password == password_bd)

    if not password_valida:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    # Actualizar último acceso
    cursor.execute("""
        UPDATE usuarios SET ultimo_acceso = GETDATE() WHERE id = ?
    """, (usuario[0],))
    conn.commit()
    conn.close()

    token = crear_token({
        "sub": str(usuario[0]),
        "nombre": usuario[1],
        "email": usuario[2],
        "rol": usuario[3],
        "tienda": usuario[4] or "",
        "pais": usuario[5] or ""
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            "id": usuario[0],
            "nombre": usuario[1],
            "email": usuario[2],
            "rol": usuario[3],
            "tienda": usuario[4] or "",
            "pais": usuario[5] or ""
        }
    }