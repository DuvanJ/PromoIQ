# ============================================================
# Router: admin_pais.py
# Descripción: Endpoints para administradores por país
# Acceso: roles admin, comercial, planning, tiendas
# ============================================================

from fastapi import APIRouter, HTTPException, Depends
from app.database import get_connection
from app.auth import verificar_token

import datetime
import io
import pandas as pd
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/pais", tags=["Admin por País"])

def validar_admin_pais(usuario=Depends(verificar_token)):
    """Valida que el usuario tenga rol de admin o superior"""
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Acceso no autorizado")
    return usuario

def validar_acceso(usuario=Depends(verificar_token)):
    """Valida cualquier usuario autenticado"""
    return usuario

@router.get("/dashboard")
def get_dashboard_pais(usuario=Depends(validar_acceso)):
    """
    Dashboard filtrado por país del usuario.
    Superadmin ve todo, el resto solo su país.
    """
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]

    # Filtro de país
    filtro_pais = "" if rol == "superadmin" or not pais else f"AND dd.pais = '{pais}'"
    filtro_pais_simple = "" if rol == "superadmin" or not pais else f"AND pais = '{pais}'"

    # Dinámicas activas — solo las vigentes
    cursor.execute(f"""
        SELECT COUNT(DISTINCT d.id)
        FROM dinamicas d
        INNER JOIN dinamica_detalle dd ON d.id = dd.dinamica_id
        WHERE d.activa = 1
        {'AND dd.pais = ?' if pais and rol != 'superadmin' else ''}
    """, (pais,) if pais and rol != "superadmin" else ())
    dinamicas_activas = cursor.fetchone()[0]

    # Artículos en campaña
    cursor.execute(f"""
        SELECT COUNT(*)
        FROM dinamica_detalle
        WHERE activo = 1 {filtro_pais_simple}
    """)
    articulos_campana = cursor.fetchone()[0]

    # Consultas hoy del país
    cursor.execute(f"""
        SELECT COUNT(*)
        FROM consultas_log c
        INNER JOIN usuarios u ON c.usuario_id = u.id
        WHERE CAST(c.fecha AS DATE) = CAST(GETDATE() AS DATE)
        {'AND u.pais = ?' if pais and rol != 'superadmin' else ''}
    """, (pais,) if pais and rol != "superadmin" else ())
    consultas_hoy = cursor.fetchone()[0]

    # Usuarios activos del país
    cursor.execute(f"""
        SELECT COUNT(*)
        FROM usuarios
        WHERE activo = 1
        {'AND pais = ?' if pais and rol != 'superadmin' else ''}
    """, (pais,) if pais and rol != "superadmin" else ())
    usuarios_activos = cursor.fetchone()[0]

    # Artículos por ubicación
    cursor.execute(f"""
        SELECT ubicacion_dinamica, COUNT(*) as total
        FROM dinamica_detalle
        WHERE activo = 1 
        AND ubicacion_dinamica IS NOT NULL 
        AND ubicacion_dinamica != ''
        {filtro_pais_simple}
        GROUP BY ubicacion_dinamica
        ORDER BY total DESC
    """)
    por_ubicacion = [
        {"ubicacion": r[0], "total": r[1]}
        for r in cursor.fetchall()
    ]

    # Artículos por tipo de campaña
    cursor.execute(f"""
        SELECT tipo_campana, COUNT(*) as total
        FROM dinamica_detalle
        WHERE activo = 1
        AND tipo_campana IS NOT NULL
        AND tipo_campana != ''
        {filtro_pais_simple}
        GROUP BY tipo_campana
        ORDER BY total DESC
    """)
    por_tipo_campana = [
        {"tipo": r[0], "total": r[1]}
        for r in cursor.fetchall()
    ]

    # Dinámicas activas con detalle
    cursor.execute(f"""
        SELECT d.id, d.nombre, d.fecha_inicio, d.fecha_fin,
               COUNT(dd.id) as total_articulos, d.activa
        FROM dinamicas d
        LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id
        {'AND dd.pais = ?' if pais and rol != 'superadmin' else ''}
        GROUP BY d.id, d.nombre, d.fecha_inicio, d.fecha_fin, d.activa
        {'HAVING COUNT(dd.id) > 0' if pais and rol != 'superadmin' else ''}
        ORDER BY d.activa DESC, d.fecha_fin DESC
    """, (pais,) if pais and rol != "superadmin" else ())
    dinamicas = [
        {
            "id": r[0],
            "nombre": r[1],
            "fecha_inicio": str(r[2]),
            "fecha_fin": str(r[3]),
            "total_articulos": r[4],
            "activa": bool(r[5])
        }
        for r in cursor.fetchall()
    ]

    # Últimas consultas del país
    cursor.execute(f"""
        SELECT TOP 5 u.nombre, c.pregunta, c.fecha, c.tokens_usados
        FROM consultas_log c
        INNER JOIN usuarios u ON c.usuario_id = u.id
        WHERE 1=1
        {'AND u.pais = ?' if pais and rol != 'superadmin' else ''}
        ORDER BY c.fecha DESC
    """, (pais,) if pais and rol != "superadmin" else ())
    ultimas_consultas = [
        {
            "usuario": r[0],
            "pregunta": r[1],
            "fecha": str(r[2]),
            "tokens": r[3] or 0
        }
        for r in cursor.fetchall()
    ]

    conn.close()

    return {
        "metricas": {
            "dinamicas_activas": dinamicas_activas,
            "articulos_campana": articulos_campana,
            "consultas_hoy": consultas_hoy,
            "usuarios_activos": usuarios_activos,
        },
        "por_ubicacion": por_ubicacion,
        "por_tipo_campana": por_tipo_campana,
        "dinamicas": dinamicas,
        "ultimas_consultas": ultimas_consultas,
        "pais": pais,
        "rol": rol
    }

@router.get("/dinamicas")
def get_dinamicas_pais(usuario=Depends(validar_acceso)):
    """Retorna dinámicas filtradas por país del usuario"""
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]

    cursor.execute(f"""
        SELECT d.id, d.nombre, d.fecha_inicio, d.fecha_fin,
               COUNT(dd.id) as total_articulos, d.activa
        FROM dinamicas d
        LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id
        {'AND dd.pais = ?' if pais and rol != 'superadmin' else ''}
        GROUP BY d.id, d.nombre, d.fecha_inicio, d.fecha_fin, d.activa
        {'HAVING COUNT(dd.id) > 0' if pais and rol != 'superadmin' else ''}
        ORDER BY d.activa DESC, d.fecha_fin DESC
    """, (pais,) if pais and rol != "superadmin" else ())

    filas = cursor.fetchall()
    conn.close()

    return [
        {
            "id": f[0],
            "nombre": f[1],
            "fecha_inicio": str(f[2]),
            "fecha_fin": str(f[3]),
            "descripcion": f[4],
            "activa": f[5],
            "total_articulos": f[6]
        }
        for f in filas
    ]


@router.get("/articulos")
def get_articulos_pais(tienda_codigo: str = None, usuario=Depends(validar_acceso)):
    """
    Retorna artículos en dinámica filtrados por país y rol.
    categoria y precio_regular ya no viven en dinamica_detalle —
    salen de articulos_maestro vía LEFT JOIN por SKU.

    Para el rol tiendas, la tienda ya NO es fija en la cuenta — se
    elige en el frontend y se envía como tienda_codigo. Se valida
    que exista en el catálogo antes de filtrar.
    """
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]

    join_catalogo = """
        LEFT JOIN (
            SELECT sku, pais, MIN(categoria) as categoria, AVG(precio_unitario) as precio_unitario
            FROM articulos_maestro
            GROUP BY sku, pais
        ) am ON am.sku = dd.sku AND am.pais = dd.pais
    """

    # Tiendas ven solo la tienda seleccionada en el frontend
    if rol == "tiendas":
        if not tienda_codigo:
            raise HTTPException(status_code=400, detail="Falta indicar tienda_codigo")

        cursor.execute("SELECT 1 FROM cat_tiendas WHERE codigo = ? AND pais = ? AND activo = 1", (tienda_codigo, pais))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Tienda no válida para tu país")

        cursor.execute(f"""
            SELECT dd.sku, dd.descripcion, am.categoria,
                   am.precio_unitario, dd.precio_dinamica, dd.ubicacion_dinamica,
                   dd.tienda, dd.tipo_campana, d.nombre, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            {join_catalogo}
            WHERE dd.activo = 1 AND d.activa = 1
            AND dd.pais = ? AND dd.tienda = ?
        """, (pais, tienda_codigo))
    elif pais and rol != "superadmin":
        cursor.execute(f"""
            SELECT dd.sku, dd.descripcion, am.categoria,
                   am.precio_unitario, dd.precio_dinamica, dd.ubicacion_dinamica,
                   dd.tienda, dd.tipo_campana, d.nombre, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            {join_catalogo}
            WHERE dd.activo = 1 AND d.activa = 1
            AND dd.pais = ?
        """, (pais,))
    else:
        cursor.execute(f"""
            SELECT dd.sku, dd.descripcion, am.categoria,
                   am.precio_unitario, dd.precio_dinamica, dd.ubicacion_dinamica,
                   dd.tienda, dd.tipo_campana, d.nombre, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            {join_catalogo}
            WHERE dd.activo = 1 AND d.activa = 1
        """)

    filas = cursor.fetchall()
    conn.close()

    return [
        {
            "codigo": f[0],
            "descripcion": f[1],
            "categoria": f[2] or "-",
            "precio_regular": round(float(f[3]), 2) if f[3] else 0,
            "precio_dinamica": float(f[4]) if f[4] else 0,
            "ahorro": round((float(f[3]) if f[3] else 0) - (float(f[4]) if f[4] else 0), 2),
            "ubicacion": f[5] or "-",
            "tienda": f[6] or "-",
            "tipo_campana": f[7] or "-",
            "dinamica": f[8],
            "fecha_fin": str(f[9])
        }
        for f in filas
    ]



@router.get("/historial-chat")
def get_historial_chat(usuario=Depends(validar_acceso)):
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]
    usuario_id = usuario["id"]

    # ── Consultas según rol ───────────────────────────────
    if rol == "superadmin":
        cursor.execute("""
            SELECT TOP 100 c.id, u.nombre, r.nombre as rol,
                   c.pregunta, c.respuesta, c.tokens_usados,
                   c.fecha, u.pais
            FROM consultas_log c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            INNER JOIN cat_roles r ON u.rol_id = r.id
            ORDER BY c.fecha DESC
        """)
    elif rol == "admin":
        cursor.execute("""
            SELECT TOP 100 c.id, u.nombre, r.nombre as rol,
                   c.pregunta, c.respuesta, c.tokens_usados,
                   c.fecha, u.pais
            FROM consultas_log c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            INNER JOIN cat_roles r ON u.rol_id = r.id
            WHERE u.pais = ?
            ORDER BY c.fecha DESC
        """, (pais,))
    else:
        cursor.execute("""
            SELECT TOP 100 c.id, u.nombre, r.nombre as rol,
                   c.pregunta, c.respuesta, c.tokens_usados,
                   c.fecha, u.pais
            FROM consultas_log c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            INNER JOIN cat_roles r ON u.rol_id = r.id
            WHERE c.usuario_id = ?
            ORDER BY c.fecha DESC
        """, (usuario_id,))

    filas = cursor.fetchall()

    # ── Estadísticas filtradas según rol ─────────────────
    if rol == "superadmin":
        cursor.execute("""
            SELECT COUNT(*), ISNULL(SUM(tokens_usados), 0)
            FROM consultas_log
        """)
    elif rol == "admin":
        cursor.execute("""
            SELECT COUNT(*), ISNULL(SUM(c.tokens_usados), 0)
            FROM consultas_log c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            WHERE u.pais = ?
        """, (pais,))
    else:
        cursor.execute("""
            SELECT COUNT(*), ISNULL(SUM(tokens_usados), 0)
            FROM consultas_log
            WHERE usuario_id = ?
        """, (usuario_id,))

    stats = cursor.fetchone()
    conn.close()

    return {
        "consultas": [
            {
                "id": f[0],
                "usuario": f[1],
                "rol": f[2],
                "pregunta": f[3],
                "respuesta": f[4],
                "tokens": f[5] or 0,
                "fecha": str(f[6]),
                "pais": f[7] or ""
            }
            for f in filas
        ],
        "stats": {
            "total_consultas": stats[0],
            "total_tokens": stats[1],
            "costo_estimado": round(stats[1] * 0.000003, 4)
        }
    }



@router.get("/alertas")
def get_alertas(usuario=Depends(validar_acceso)):
    """
    Genera alertas automáticas según el rol y país del usuario.
    - Comercial: artículos sin ubicación, dinámicas por vencer
    - Planning: artículos duplicados, dinámicas vencidas, tiendas sin artículos
    """
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]
    alertas = []

    filtro = f"AND pais = '{pais}'" if pais and rol != "superadmin" else ""

    # ── Alerta 1: Dinámicas por vencer en 7 días ──
    cursor.execute(f"""
        SELECT nombre, fecha_fin,
               DATEDIFF(DAY, GETDATE(), fecha_fin) as dias
        FROM dinamicas
        WHERE activa = 1
        AND DATEDIFF(DAY, GETDATE(), fecha_fin) BETWEEN 0 AND 7
    """)
    for r in cursor.fetchall():
        alertas.append({
            "tipo": "warning",
            "icono": "⏰",
            "titulo": "Dinámica por vencer",
            "mensaje": f'"{r[0]}" vence en {r[2]} días ({r[1]})',
            "rol": ["comercial", "planning", "admin"]
        })

    # ── Alerta 2: Dinámicas vencidas aún activas ──
    cursor.execute(f"""
        SELECT nombre, fecha_fin
        FROM dinamicas
        WHERE activa = 1
        AND fecha_fin < CAST(GETDATE() AS DATE)
    """)
    for r in cursor.fetchall():
        alertas.append({
            "tipo": "error",
            "icono": "❌",
            "titulo": "Dinámica vencida activa",
            "mensaje": f'"{r[0]}" venció el {r[1]} y sigue activa',
            "rol": ["planning", "admin", "superadmin"]
        })

    # ── Alerta 3: Artículos sin ubicación ──
    cursor.execute(f"""
        SELECT COUNT(*) FROM dinamica_detalle
        WHERE activo = 1
        AND (ubicacion_dinamica IS NULL OR ubicacion_dinamica = '')
        {filtro}
    """)
    sin_ubicacion = cursor.fetchone()[0]
    if sin_ubicacion > 0:
        alertas.append({
            "tipo": "warning",
            "icono": "📍",
            "titulo": "Artículos sin ubicación",
            "mensaje": f"{sin_ubicacion} artículos en dinámica no tienen ubicación asignada",
            "rol": ["comercial", "planning", "admin"]
        })

    # ── Alerta 4: Artículos sin precio de dinámica ──
    cursor.execute(f"""
        SELECT COUNT(*) FROM dinamica_detalle
        WHERE activo = 1
        AND (precio_dinamica IS NULL OR precio_dinamica = 0)
        {filtro}
    """)
    sin_precio = cursor.fetchone()[0]
    if sin_precio > 0:
        alertas.append({
            "tipo": "warning",
            "icono": "💲",
            "titulo": "Artículos sin precio de dinámica",
            "mensaje": f"{sin_precio} artículos no tienen precio de dinámica asignado",
            "rol": ["comercial", "planning", "admin"]
        })

    # ── Alerta 5: Artículos duplicados en dinámicas activas ──
    cursor.execute(f"""
        SELECT sku, COUNT(DISTINCT dinamica_id) as total
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE dd.activo = 1 AND d.activa = 1
        {filtro.replace('pais', 'dd.pais')}
        GROUP BY sku
        HAVING COUNT(DISTINCT dinamica_id) > 1
    """)
    duplicados = cursor.fetchall()
    if duplicados:
        alertas.append({
            "tipo": "error",
            "icono": "⚠️",
            "titulo": "Artículos duplicados en dinámicas",
            "mensaje": f"{len(duplicados)} artículos aparecen en más de una dinámica activa",
            "rol": ["planning", "admin"]
        })

    # ── Alerta 6: Sin consultas en los últimos 3 días ──
    cursor.execute(f"""
        SELECT COUNT(*) FROM consultas_log
        WHERE fecha >= DATEADD(DAY, -3, GETDATE())
        {'AND usuario_id IN (SELECT id FROM usuarios WHERE pais = ?)' if pais and rol != 'superadmin' else ''}
    """, (pais,) if pais and rol != "superadmin" else ())
    consultas_recientes = cursor.fetchone()[0]
    if consultas_recientes == 0:
        alertas.append({
            "tipo": "info",
            "icono": "💬",
            "titulo": "Sin actividad reciente",
            "mensaje": "No se han realizado consultas a la IA en los últimos 3 días",
            "rol": ["admin", "superadmin"]
        })

    conn.close()

    # Filtrar alertas según rol
    alertas_filtradas = [
        a for a in alertas if rol in a["rol"]
    ]

    return {
        "alertas": alertas_filtradas,
        "total": len(alertas_filtradas),
        "errores": len([a for a in alertas_filtradas if a["tipo"] == "error"]),
        "warnings": len([a for a in alertas_filtradas if a["tipo"] == "warning"]),
        "info": len([a for a in alertas_filtradas if a["tipo"] == "info"])
    }


@router.get("/buscar")
def buscar_global(
    q: str,
    usuario=Depends(validar_acceso)
):
    """
    Búsqueda global en artículos, dinámicas y usuarios.
    Filtra según rol y país del usuario.
    """
    if not q or len(q) < 2:
        raise HTTPException(status_code=400, detail="Ingresá al menos 2 caracteres")

    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]
    termino = f"%{q}%"

    resultados = {
        "articulos": [],
        "dinamicas": [],
        "usuarios": []
    }

    # ── Buscar artículos ──────────────────────────────────
    # dd.categoria ya no existe — la búsqueda por categoría ahora
    # cruza contra articulos_maestro por SKU.
    filtro_pais = "AND dd.pais = ?" if pais and rol != "superadmin" else ""
    params_articulos = [termino, termino, termino]
    if pais and rol != "superadmin":
        params_articulos.append(pais)

    cursor.execute(f"""
        SELECT TOP 8 dd.sku, dd.descripcion,
               dd.precio_dinamica, dd.ubicacion_dinamica, dd.tienda,
               dd.tipo_campana, d.nombre as dinamica, dd.pais
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        LEFT JOIN (
            SELECT sku, pais, MIN(categoria) as categoria
            FROM articulos_maestro
            GROUP BY sku, pais
        ) am ON am.sku = dd.sku AND am.pais = dd.pais
        WHERE dd.activo = 1 AND d.activa = 1
        AND (dd.sku LIKE ?
             OR dd.descripcion LIKE ?
             OR am.categoria LIKE ?)
        {filtro_pais}
        ORDER BY dd.sku
    """, params_articulos)

    resultados["articulos"] = [
        {
            "tipo": "articulo",
            "codigo": r[0],
            "descripcion": r[1],
            "precio": float(r[2]) if r[2] else 0,
            "ubicacion": r[3] or "-",
            "tienda": r[4] or "-",
            "tipo_campana": r[5] or "-",
            "dinamica": r[6],
            "pais": r[7] or ""
        }
        for r in cursor.fetchall()
    ]

    # ── Buscar dinámicas ──────────────────────────────────
    cursor.execute("""
        SELECT TOP 5 id, nombre, fecha_inicio, fecha_fin,
               DATEDIFF(DAY, GETDATE(), fecha_fin) as dias
        FROM dinamicas
        WHERE activa = 1
        AND nombre LIKE ?
        ORDER BY fecha_fin ASC
    """, (termino,))

    resultados["dinamicas"] = [
        {
            "tipo": "dinamica",
            "id": r[0],
            "nombre": r[1],
            "fecha_inicio": str(r[2]),
            "fecha_fin": str(r[3]),
            "dias_restantes": r[4]
        }
        for r in cursor.fetchall()
    ]

    # ── Buscar usuarios — solo admin y superadmin ─────────
    if rol in ["superadmin", "admin"]:
        filtro_pais_u = "AND u.pais = ?" if pais and rol != "superadmin" else ""
        params_u = [termino, termino]
        if pais and rol != "superadmin":
            params_u.append(pais)

        cursor.execute(f"""
            SELECT TOP 5 u.id, u.nombre, u.email, r.nombre as rol, u.pais
            FROM usuarios u
            INNER JOIN cat_roles r ON u.rol_id = r.id
            WHERE u.activo = 1
            AND (u.nombre LIKE ? OR u.email LIKE ?)
            {filtro_pais_u}
            ORDER BY u.nombre
        """, params_u)

        resultados["usuarios"] = [
            {
                "tipo": "usuario",
                "id": r[0],
                "nombre": r[1],
                "email": r[2],
                "rol": r[3],
                "pais": r[4] or ""
            }
            for r in cursor.fetchall()
        ]

    conn.close()

    total = (
        len(resultados["articulos"]) +
        len(resultados["dinamicas"]) +
        len(resultados["usuarios"])
    )

    return {
        "termino": q,
        "total": total,
        "resultados": resultados
    }





def _periodo_objetivo(cursor, pais: str):
    """
    Mes calendario anterior al actual — si ese mes todavía no tiene
    datos cargados (falta el cierre), cae al último mes disponible.
    """
    hoy = datetime.date.today()
    mes_anterior_fecha = hoy.replace(day=1) - datetime.timedelta(days=1)
    mes_objetivo, anio_objetivo = mes_anterior_fecha.month, mes_anterior_fecha.year

    cursor.execute(
        "SELECT 1 FROM ventas_mes WHERE pais = ? AND mes = ? AND anio = ?",
        (pais, mes_objetivo, anio_objetivo)
    )
    if not cursor.fetchone():
        cursor.execute("""
            SELECT TOP 1 mes, anio FROM ventas_mes
            WHERE pais = ?
            GROUP BY mes, anio
            ORDER BY anio DESC, mes DESC
        """, (pais,))
        fila = cursor.fetchone()
        if not fila:
            return None, None
        mes_objetivo, anio_objetivo = fila

    return mes_objetivo, anio_objetivo


def _calcular_ventas_comercial(pais: str):
    """
    Lógica compartida entre el endpoint de datos y el de exportación.
    Todo el bloque enfocado en artículos que estén o hayan estado en
    dinámica — nunca en el catálogo completo del país.

    ventas_mes.venta_total son UNIDADES vendidas, no dinero — el monto
    se calcula como unidades × precio_dinamica de la campaña vigente
    ese mes. El margen usa la fórmula de margen en promoción:
    ((precio_dinamica - costo) / precio_dinamica) × 100.
    """
    conn = get_connection()
    cursor = conn.cursor()

    if not pais:
        conn.close()
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    mes, anio = _periodo_objetivo(cursor, pais)

    if mes is None:
        conn.close()
        return {
            "periodo": None,
            "resumen": {"monto_vendido": 0, "cantidad_productos": 0, "margen_promedio": 0},
            "top_ventas": [],
            "top_margen": [],
            "top_departamentos": [],
            "departamentos_bajas": []
        }

    periodo_num = anio * 12 + mes

    # ── Unidades vendidas × precio de campaña × costo ────────────────
    cursor.execute("""
        WITH ventas_unidades AS (
            SELECT v.sku, v.descripcion, SUM(v.venta_total) AS unidades
            FROM ventas_mes v
            WHERE v.pais = ? AND v.mes = ? AND v.anio = ?
            GROUP BY v.sku, v.descripcion
        ),
        precio_campana AS (
            SELECT dd.sku, AVG(dd.precio_dinamica) AS precio_dinamica
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.pais = ?
            AND (YEAR(d.fecha_inicio) * 12 + MONTH(d.fecha_inicio)) <= ?
            AND (YEAR(d.fecha_fin) * 12 + MONTH(d.fecha_fin)) >= ?
            GROUP BY dd.sku
        ),
        costo_catalogo AS (
            SELECT sku, pais, AVG(costo_unitario) AS costo
            FROM articulos_maestro
            WHERE costo_unitario IS NOT NULL AND costo_unitario > 0
            GROUP BY sku, pais
        )
        SELECT vu.sku, vu.descripcion, vu.unidades, pc.precio_dinamica, cc.costo
        FROM ventas_unidades vu
        INNER JOIN precio_campana pc ON pc.sku = vu.sku
        INNER JOIN costo_catalogo cc ON cc.sku = vu.sku AND cc.pais = ?
        WHERE pc.precio_dinamica > 0
    """, (pais, mes, anio, pais, periodo_num, periodo_num, pais))

    filas = cursor.fetchall()
    productos = []
    for f in filas:
        unidades = float(f[2]) if f[2] else 0
        precio_dinamica = round(float(f[3]), 2) if f[3] else 0
        costo = round(float(f[4]), 2) if f[4] else 0

        monto = round(unidades * precio_dinamica, 2)
        margen_pct = round(((precio_dinamica - costo) / precio_dinamica) * 100, 2) if precio_dinamica > 0 else 0

        productos.append({
            "sku": f[0],
            "descripcion": f[1],
            "unidades": unidades,
            "precio_dinamica": precio_dinamica,
            "costo_unitario": costo,
            "venta_total": monto,
            "margen_pct": margen_pct,
        })

    monto_vendido = round(sum(p["venta_total"] for p in productos), 2)
    cantidad_productos = len(productos)
    margen_promedio = (
        round(sum(p["margen_pct"] * p["venta_total"] for p in productos) / monto_vendido, 2)
        if monto_vendido > 0 else 0
    )

    top_ventas = sorted(productos, key=lambda p: p["venta_total"], reverse=True)[:10]
    top_margen = sorted(productos, key=lambda p: p["margen_pct"], reverse=True)[:10]

        # ── Top / bottom departamentos — mismo cálculo de monto, agregado por departamento ──
    cursor.execute("""
        WITH ventas_unidades AS (
            SELECT v.sku, SUM(v.venta_total) AS unidades
            FROM ventas_mes v
            WHERE v.pais = ? AND v.mes = ? AND v.anio = ?
            GROUP BY v.sku
        ),
        precio_campana AS (
            SELECT dd.sku, AVG(dd.precio_dinamica) AS precio_dinamica
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.pais = ?
            AND (YEAR(d.fecha_inicio) * 12 + MONTH(d.fecha_inicio)) <= ?
            AND (YEAR(d.fecha_fin) * 12 + MONTH(d.fecha_fin)) >= ?
            GROUP BY dd.sku
        ),
        depto_catalogo AS (
            SELECT sku, pais, MIN(departamento) as departamento
            FROM articulos_maestro
            GROUP BY sku, pais
        )
        SELECT dep.departamento, SUM(vu.unidades * pc.precio_dinamica) as monto
        FROM ventas_unidades vu
        INNER JOIN precio_campana pc ON pc.sku = vu.sku
        INNER JOIN depto_catalogo dep ON dep.sku = vu.sku AND dep.pais = ?
        WHERE dep.departamento IS NOT NULL AND dep.departamento != ''
        GROUP BY dep.departamento
    """, (pais, mes, anio, pais, periodo_num, periodo_num, pais))

    departamentos_todos = [
        {"departamento": r[0], "venta_total": round(float(r[1]), 2) if r[1] else 0}
        for r in cursor.fetchall()
    ]
    departamentos_todos = [d for d in departamentos_todos if d["venta_total"] > 0]

    top_departamentos = sorted(departamentos_todos, key=lambda d: d["venta_total"], reverse=True)[:10]
    departamentos_bajos = sorted(departamentos_todos, key=lambda d: d["venta_total"])[:10]

    conn.close()

    return {
        "periodo": {"mes": mes, "anio": anio},
        "resumen": {
            "monto_vendido": monto_vendido,
            "cantidad_productos": cantidad_productos,
            "margen_promedio": margen_promedio,
        },
        "top_ventas": top_ventas,
        "top_margen": top_margen,
        "top_departamentos": top_departamentos,
        "departamentos_bajos": departamentos_bajos,
    }


@router.get("/ventas-comercial")
def get_ventas_comercial(usuario=Depends(validar_acceso)):
    """
    Métricas de ventas para el dashboard de Comercial, del mes anterior
    (o el último mes con datos si el anterior aún no cerró). Todo
    enfocado en artículos que estén o hayan estado en alguna dinámica.
    """
    return _calcular_ventas_comercial(usuario["pais"])


@router.get("/ventas-comercial/exportar")
def exportar_ventas_comercial(metrica: str, usuario=Depends(validar_acceso)):
    """
    Descarga en Excel de una métrica del dashboard de Comercial.
    metrica: top_ventas | top_margen | top_categorias | categorias_bajas
    """
    datos = _calcular_ventas_comercial(usuario["pais"])

    mapa = {
        "top_ventas": ("Top 10 por venta", datos["top_ventas"]),
        "top_margen": ("Top 10 por margen", datos["top_margen"]),
        "top_categorias": ("Top departamentos", datos["top_departamentos"]),
        "categorias_bajas": ("Departamentos menor venta", datos["departamentos_bajos"]),
    }

    if metrica not in mapa:
        raise HTTPException(status_code=400, detail="Métrica no válida")

    nombre_hoja, filas = mapa[metrica]
    df = pd.DataFrame(filas)

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name=nombre_hoja[:31])
    buffer.seek(0)

    periodo = datos.get("periodo") or {}
    nombre_archivo = f"{metrica}_{periodo.get('mes', '')}-{periodo.get('anio', '')}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'}
    )



@router.get("/dashboard-tienda")
def get_dashboard_tienda(tienda_codigo: str, usuario=Depends(validar_acceso)):
    """
    Dashboard exclusivo del rol Tiendas. La tienda no es fija en la
    cuenta — se elige en el frontend (localStorage) y se envía en
    cada request. Se valida que exista y pertenezca al país del usuario.
    """
    if usuario["rol"] != "tiendas":
        raise HTTPException(status_code=403, detail="Este dashboard es exclusivo para el rol Tiendas")

    pais = usuario["pais"]
    tienda = tienda_codigo

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM cat_tiendas WHERE codigo = ? AND pais = ? AND activo = 1", (tienda, pais))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Tienda no válida para tu país")

    hoy = datetime.date.today()
    primer_dia_actual = hoy.replace(day=1)
    ultimo_dia_mes_anterior = primer_dia_actual - datetime.timedelta(days=1)
    primer_dia_mes_anterior = ultimo_dia_mes_anterior.replace(day=1)

    # ── Campañas activas de esta tienda, con fechas ───────────
    cursor.execute("""
        SELECT d.id, d.nombre, d.fecha_inicio, d.fecha_fin, COUNT(dd.id) as total_articulos
        FROM dinamicas d
        INNER JOIN dinamica_detalle dd ON dd.dinamica_id = d.id
        WHERE d.pais = ? AND d.activa = 1 AND dd.activo = 1 AND dd.tienda = ?
        GROUP BY d.id, d.nombre, d.fecha_inicio, d.fecha_fin
        ORDER BY d.fecha_fin ASC
    """, (pais, tienda))
    campanas_activas = [
        {
            "id": f[0], "nombre": f[1],
            "fecha_inicio": str(f[2]), "fecha_fin": str(f[3]),
            "total_articulos": f[4],
        }
        for f in cursor.fetchall()
    ]

    # ── Campañas que vencieron dentro del mes anterior, para esta tienda ──
    cursor.execute("""
        SELECT DISTINCT d.id, d.nombre, d.fecha_inicio, d.fecha_fin,
               (SELECT COUNT(*) FROM dinamica_detalle dd2 WHERE dd2.dinamica_id = d.id AND dd2.tienda = ?) as total_articulos
        FROM dinamicas d
        INNER JOIN dinamica_detalle dd ON dd.dinamica_id = d.id
        WHERE d.pais = ? AND dd.tienda = ?
        AND d.fecha_fin BETWEEN ? AND ?
        ORDER BY d.fecha_fin DESC
    """, (tienda, pais, tienda, primer_dia_mes_anterior, ultimo_dia_mes_anterior))
    campanas_inactivas_mes_anterior = [
        {
            "id": f[0], "nombre": f[1],
            "fecha_inicio": str(f[2]), "fecha_fin": str(f[3]),
            "total_articulos": f[4],
        }
        for f in cursor.fetchall()
    ]

    # ── Distribución de ubicaciones — artículos activos de esta tienda ──
    cursor.execute("""
        SELECT dd.ubicacion_dinamica, COUNT(*) as total
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE dd.pais = ? AND dd.tienda = ? AND dd.activo = 1 AND d.activa = 1
        GROUP BY dd.ubicacion_dinamica
        ORDER BY total DESC
    """, (pais, tienda))
    ubicaciones = [
        {"ubicacion": f[0] or "Sin ubicación", "total": f[1]}
        for f in cursor.fetchall()
    ]

    conn.close()

    total_articulos_activos = sum(c["total_articulos"] for c in campanas_activas)
    dias_restantes_lista = [
        (datetime.datetime.strptime(c["fecha_fin"], "%Y-%m-%d").date() - hoy).days
        for c in campanas_activas
    ]
    proxima_a_vencer = min(dias_restantes_lista) if dias_restantes_lista else None

    return {
        "resumen": {
            "campanas_activas": len(campanas_activas),
            "articulos_activos": total_articulos_activos,
            "ubicaciones_en_uso": len(ubicaciones),
            "proxima_a_vencer_dias": proxima_a_vencer,
        },
        "campanas_activas": campanas_activas,
        "campanas_inactivas_mes_anterior": campanas_inactivas_mes_anterior,
        "ubicaciones": ubicaciones,
    }



@router.get("/campanas-resumen")
def get_campanas_resumen(usuario=Depends(validar_acceso)):
    """
    Solo dinámicas ACTIVAS, con su descripción completa — pensado para
    una vista tipo afiche/flyer, no para análisis de datos.
    """
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]

    cursor.execute(f"""
        SELECT d.id, d.nombre, d.fecha_inicio, d.fecha_fin, d.descripcion,
               COUNT(DISTINCT dd.id) as total_articulos,
               COUNT(DISTINCT dd.tienda) as total_tiendas
        FROM dinamicas d
        LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id AND dd.activo = 1
        WHERE d.activa = 1
        {'AND d.pais = ?' if pais and rol != 'superadmin' else ''}
        GROUP BY d.id, d.nombre, d.fecha_inicio, d.fecha_fin, d.descripcion
        ORDER BY d.fecha_fin ASC
    """, (pais,) if pais and rol != "superadmin" else ())

    import json as _json
    hoy = datetime.date.today()
    campanas = []
    for f in cursor.fetchall():
        fecha_fin = f[3]
        dias = (fecha_fin - hoy).days if fecha_fin else None

        # descripcion se guarda como JSON (lista de tarjetas) desde el
        # nuevo flujo de carga por Word. Si es texto plano viejo (o el
        # JSON no parsea), se envuelve como una sola tarjeta para no
        # romper campañas cargadas antes de este cambio.
        raw = f[4] or ""
        try:
            tarjetas = _json.loads(raw)
            if not isinstance(tarjetas, list):
                tarjetas = [raw] if raw else []
        except (ValueError, TypeError):
            tarjetas = [raw] if raw else []

        campanas.append({
            "id": f[0],
            "nombre": f[1],
            "fecha_inicio": str(f[2]),
            "fecha_fin": str(fecha_fin),
            "tarjetas": tarjetas,
            "total_articulos": f[5],
            "total_tiendas": f[6],
            "dias_restantes": dias,
        })

    conn.close()
    return campanas


@router.get("/{pais}/tiene-datos")
def tiene_datos_pais(pais: str, usuario=Depends(validar_acceso)):
    """Verifica si un país tiene dinámicas o ventas cargadas"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            (SELECT COUNT(*) FROM dinamica_detalle WHERE pais = ?) +
            (SELECT COUNT(*) FROM ventas_mes WHERE pais = ?) AS total
    """, (pais, pais))
    total = cursor.fetchone()[0]
    conn.close()
    return {"tiene_datos": total > 0}



@router.get("/{pais}/tiene-datos")
def tiene_datos_pais(pais: str, usuario=Depends(validar_acceso)):
    """Verifica si un país tiene dinámicas o ventas cargadas"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            (SELECT COUNT(*) FROM dinamica_detalle WHERE pais = ?) +
            (SELECT COUNT(*) FROM ventas_mes WHERE pais = ?) AS total
    """, (pais, pais))
    total = cursor.fetchone()[0]
    conn.close()
    return {"tiene_datos": total > 0}