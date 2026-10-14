# ============================================================
# Router: tiendas.py
# Descripción: Catálogo de tiendas por país.
# Se usa al cargar dinámicas — cada archivo de carga corresponde
# a una tienda específica del país seleccionado.
# ============================================================

from fastapi import APIRouter, HTTPException, Depends
from app.database import get_connection, registrar_auditoria
from app.auth import verificar_token
from pydantic import BaseModel

router = APIRouter(prefix="/tiendas", tags=["Tiendas"])


class TiendaRequest(BaseModel):
    codigo: str
    nombre: str
    pais: str


def validar_admin_pais(usuario: dict, pais_tienda: str = None):
    """Valida rol admin/superadmin y que el país coincida (salvo superadmin)."""
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para gestionar tiendas")
    if pais_tienda and usuario["rol"] != "superadmin" and pais_tienda != usuario["pais"]:
        raise HTTPException(status_code=403, detail="No podés gestionar tiendas de otro país")


@router.get("")
def listar_tiendas(pais: str = None, usuario=Depends(verificar_token)):
    """
    Lista tiendas activas, filtradas por país.
    Admin siempre ve solo las de su país (sin importar qué mande `pais`).
    Superadmin ve las del país que pida, o todas si no especifica.
    """
    pais_filtro = usuario["pais"] if usuario["rol"] != "superadmin" else pais

    conn = get_connection()
    cursor = conn.cursor()

    if pais_filtro:
        cursor.execute("""
            SELECT id, codigo, nombre, pais
            FROM cat_tiendas
            WHERE activo = 1 AND pais = ?
            ORDER BY nombre ASC
        """, (pais_filtro,))
    else:
        cursor.execute("""
            SELECT id, codigo, nombre, pais
            FROM cat_tiendas
            WHERE activo = 1
            ORDER BY pais ASC, nombre ASC
        """)

    filas = cursor.fetchall()
    conn.close()

    return [
        {"id": f[0], "codigo": f[1], "nombre": f[2], "pais": f[3]}
        for f in filas
    ]


@router.post("")
def crear_tienda(datos: TiendaRequest, usuario=Depends(verificar_token)):
    """Crea una tienda nueva en el catálogo de un país."""
    validar_admin_pais(usuario, datos.pais)

    codigo = datos.codigo.strip()
    if not codigo:
        raise HTTPException(status_code=400, detail="El código es obligatorio")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id FROM cat_tiendas WHERE codigo = ? AND pais = ?
    """, (codigo, datos.pais))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Ya existe una tienda con el código {codigo} en este país")

    cursor.execute("""
        INSERT INTO cat_tiendas (codigo, nombre, pais, activo)
        VALUES (?, ?, ?, 1)
    """, (codigo, datos.nombre.strip(), datos.pais))
    conn.commit()

    cursor.execute("SELECT @@IDENTITY")
    nuevo_id = int(cursor.fetchone()[0])
    conn.close()

    registrar_auditoria(usuario, "crear", "tienda", codigo, datos.pais, f"Tienda creada: {datos.nombre}")

    return {"mensaje": f"Tienda {datos.nombre} creada correctamente", "id": nuevo_id, "codigo": codigo}


@router.put("/{tienda_id}")
def editar_tienda(tienda_id: int, datos: TiendaRequest, usuario=Depends(verificar_token)):
    """Edita nombre/código de una tienda existente."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT pais FROM cat_tiendas WHERE id = ?", (tienda_id,))
    fila = cursor.fetchone()
    if not fila:
        conn.close()
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    validar_admin_pais(usuario, fila[0])

    cursor.execute("""
        UPDATE cat_tiendas
        SET codigo = ?, nombre = ?
        WHERE id = ?
    """, (datos.codigo.strip(), datos.nombre.strip(), tienda_id))
    conn.commit()
    conn.close()

    registrar_auditoria(usuario, "editar", "tienda", str(tienda_id), fila[0], f"Tienda editada: {datos.nombre}")

    return {"mensaje": "Tienda actualizada correctamente"}


@router.delete("/{tienda_id}")
def desactivar_tienda(tienda_id: int, usuario=Depends(verificar_token)):
    """Desactiva (soft delete) una tienda — deja de aparecer en selectores."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT nombre, pais FROM cat_tiendas WHERE id = ?", (tienda_id,))
    fila = cursor.fetchone()
    if not fila:
        conn.close()
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    validar_admin_pais(usuario, fila[1])

    cursor.execute("UPDATE cat_tiendas SET activo = 0 WHERE id = ?", (tienda_id,))
    conn.commit()
    conn.close()

    registrar_auditoria(usuario, "desactivar", "tienda", str(tienda_id), fila[1], f"Tienda desactivada: {fila[0]}")

    return {"mensaje": "Tienda desactivada correctamente"}