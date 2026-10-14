# ============================================================
# Router: paises.py
# Descripción: Catálogo dinámico de países operativos.
# Agregar un país nuevo = crearlo desde la UI, sin tocar código
# ni SQL directo.
# ============================================================

from fastapi import APIRouter, HTTPException, Depends
from app.database import get_connection, registrar_auditoria
from app.auth import verificar_token
from pydantic import BaseModel

router = APIRouter(prefix="/paises", tags=["Países"])

BANDERAS_FALLBACK = {"CR": "🇨🇷", "GT": "🇬🇹", "SV": "🇸🇻"}


class PaisRequest(BaseModel):
    codigo: str
    nombre: str
    bandera_emoji: str = ""
    color_primario: str = "#1E2761"
    color_secundario: str = "#0077B6"
    moneda_simbolo: str = "$"
    moneda_codigo: str = "USD"


def validar_superadmin(usuario: dict):
    if usuario["rol"] != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede gestionar países")


@router.get("")
def listar_paises():
    """
    Retorna el catálogo de países activos, ordenados para mostrar en UI.
    Sin autenticación a propósito: la pantalla de login lo necesita
    para armar el selector de país ANTES de que la persona inicie
    sesión. No expone nada sensible — solo nombre, bandera, colores
    y moneda.

    La moneda es solo de PRESENTACIÓN — cada país ya carga sus datos
    (ventas, precios) en su propia moneda local, el sistema nunca
    convierte entre monedas. Este campo solo le dice al frontend qué
    símbolo mostrar junto a los montos de ese país.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT codigo, nombre, bandera_emoji, color_primario, color_secundario,
               moneda_simbolo, moneda_codigo
        FROM cat_paises
        WHERE activo = 1
        ORDER BY orden ASC
    """)
    filas = cursor.fetchall()
    conn.close()

    resultado = []
    for f in filas:
        bandera = f[2] if f[2] else BANDERAS_FALLBACK.get(f[0], "🏳️")
        resultado.append({
            "codigo": f[0],
            "nombre": f[1],
            "bandera": bandera,
            "color_primario": f[3],
            "color_secundario": f[4],
            "moneda_simbolo": f[5] or "$",
            "moneda_codigo": f[6] or "USD",
            "label": f"{bandera} {f[1]}"
        })
    return resultado


@router.post("")
def crear_pais(datos: PaisRequest, usuario=Depends(verificar_token)):
    """Crea un país nuevo en el catálogo. Solo superadmin."""
    validar_superadmin(usuario)

    codigo = datos.codigo.strip().upper()
    if not codigo or len(codigo) > 5:
        raise HTTPException(status_code=400, detail="El código debe tener entre 1 y 5 caracteres")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT codigo FROM cat_paises WHERE codigo = ?", (codigo,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Ya existe un país con el código {codigo}")

    cursor.execute("SELECT ISNULL(MAX(orden), 0) + 1 FROM cat_paises")
    siguiente_orden = cursor.fetchone()[0]

    cursor.execute("""
        INSERT INTO cat_paises
        (codigo, nombre, bandera_emoji, color_primario, color_secundario,
         moneda_simbolo, moneda_codigo, activo, orden)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    """, (
        codigo, datos.nombre.strip(), datos.bandera_emoji.strip(),
        datos.color_primario, datos.color_secundario,
        datos.moneda_simbolo.strip() or "$", datos.moneda_codigo.strip().upper() or "USD",
        siguiente_orden
    ))
    conn.commit()
    conn.close()

    registrar_auditoria(usuario, "crear", "pais", codigo, codigo, f"País creado: {datos.nombre}")

    return {"mensaje": f"País {datos.nombre} creado correctamente", "codigo": codigo}


@router.put("/{codigo}")
def editar_pais(codigo: str, datos: PaisRequest, usuario=Depends(verificar_token)):
    """Edita nombre, bandera, colores o moneda de un país existente. Solo superadmin."""
    validar_superadmin(usuario)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT codigo FROM cat_paises WHERE codigo = ?", (codigo,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="País no encontrado")

    cursor.execute("""
        UPDATE cat_paises
        SET nombre = ?, bandera_emoji = ?, color_primario = ?, color_secundario = ?,
            moneda_simbolo = ?, moneda_codigo = ?
        WHERE codigo = ?
    """, (
        datos.nombre.strip(), datos.bandera_emoji.strip(),
        datos.color_primario, datos.color_secundario,
        datos.moneda_simbolo.strip() or "$", datos.moneda_codigo.strip().upper() or "USD",
        codigo
    ))
    conn.commit()
    conn.close()

    registrar_auditoria(usuario, "editar", "pais", codigo, codigo, f"País editado: {datos.nombre}")

    return {"mensaje": "País actualizado correctamente"}


@router.delete("/{codigo}")
def desactivar_pais(codigo: str, usuario=Depends(verificar_token)):
    """
    Desactiva un país (soft delete) — deja de aparecer en selectores,
    pero no borra sus datos históricos (dinámicas, catálogo, ventas).
    """
    validar_superadmin(usuario)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT nombre FROM cat_paises WHERE codigo = ?", (codigo,))
    fila = cursor.fetchone()
    if not fila:
        conn.close()
        raise HTTPException(status_code=404, detail="País no encontrado")

    cursor.execute("UPDATE cat_paises SET activo = 0 WHERE codigo = ?", (codigo,))
    conn.commit()
    conn.close()

    registrar_auditoria(usuario, "desactivar", "pais", codigo, codigo, f"País desactivado: {fila[0]}")

    return {"mensaje": "País desactivado correctamente"}
