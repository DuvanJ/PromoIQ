# ============================================================
# Router: admin_pais.py
# Descripción: Endpoints para administradores por país
# Acceso: roles admin, comercial, planning, tiendas
# ============================================================

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.database import get_connection
from app.auth import verificar_token
from app.logging_config import app_logger
import re
from app.cache import cache_obtener_o_calcular, cache_invalidar
import datetime
import io
import pandas as pd
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/pais", tags=["Admin por País"])

def validar_admin_pais(usuario=Depends(verificar_token)):
    """Valida que el usuario tenga rol de admin o superior"""
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Acceso no autorizado")
    return usuario

def validar_acceso(usuario=Depends(verificar_token)):
    """Valida cualquier usuario autenticado"""
    return usuario

def _calcular_dashboard_pais(pais_efectivo: str):
    """
    Cálculo real del dashboard, cacheable — pais_efectivo es None
    cuando corresponde ver todo (superadmin, o usuario sin país), o
    el código de país cuando hay que filtrar. No incluye "pais"/"rol"
    del usuario en el resultado a propósito: eso se agrega afuera,
    por request, para no filtrar la identidad de quien disparó el
    cálculo hacia otros usuarios que reutilicen el mismo cache.
    """
    conn = get_connection()
    cursor = conn.cursor()

    filtro_pais = f"AND dd.pais = '{pais_efectivo}'" if pais_efectivo else ""
    filtro_pais_simple = f"AND pais = '{pais_efectivo}'" if pais_efectivo else ""

    cursor.execute(f"""
        SELECT COUNT(DISTINCT d.id)
        FROM dinamicas d
        INNER JOIN dinamica_detalle dd ON d.id = dd.dinamica_id
        WHERE d.activa = 1
        {'AND dd.pais = ?' if pais_efectivo else ''}
    """, (pais_efectivo,) if pais_efectivo else ())
    dinamicas_activas = cursor.fetchone()[0]

    cursor.execute(f"""
        SELECT COUNT(*)
        FROM dinamica_detalle
        WHERE activo = 1 {filtro_pais_simple}
    """)
    articulos_campana = cursor.fetchone()[0]

    cursor.execute(f"""
        SELECT COUNT(*)
        FROM consultas_log c
        INNER JOIN usuarios u ON c.usuario_id = u.id
        WHERE CAST(c.fecha AS DATE) = CAST(GETDATE() AS DATE)
        {'AND u.pais = ?' if pais_efectivo else ''}
    """, (pais_efectivo,) if pais_efectivo else ())
    consultas_hoy = cursor.fetchone()[0]

    cursor.execute(f"""
        SELECT COUNT(*)
        FROM usuarios
        WHERE activo = 1
        {'AND pais = ?' if pais_efectivo else ''}
    """, (pais_efectivo,) if pais_efectivo else ())
    usuarios_activos = cursor.fetchone()[0]

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

    cursor.execute(f"""
        SELECT d.id, d.nombre, d.fecha_inicio, d.fecha_fin,
               COUNT(dd.id) as total_articulos, d.activa
        FROM dinamicas d
        LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id
        {'AND dd.pais = ?' if pais_efectivo else ''}
        GROUP BY d.id, d.nombre, d.fecha_inicio, d.fecha_fin, d.activa
        {'HAVING COUNT(dd.id) > 0' if pais_efectivo else ''}
        ORDER BY d.activa DESC, d.fecha_fin DESC
    """, (pais_efectivo,) if pais_efectivo else ())
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

    cursor.execute(f"""
        SELECT TOP 5 u.nombre, c.pregunta, c.fecha, c.tokens_usados
        FROM consultas_log c
        INNER JOIN usuarios u ON c.usuario_id = u.id
        WHERE 1=1
        {'AND u.pais = ?' if pais_efectivo else ''}
        ORDER BY c.fecha DESC
    """, (pais_efectivo,) if pais_efectivo else ())
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
    }


@router.get("/dashboard")
def get_dashboard_pais(usuario=Depends(validar_acceso)):
    """
    Dashboard filtrado por país del usuario. Superadmin ve todo.
    Cacheado por alcance de país (TTL 3 min) — varios usuarios del
    mismo país comparten un solo cálculo.
    """
    pais = usuario["pais"]
    rol = usuario["rol"]
    pais_efectivo = pais if (pais and rol != "superadmin") else None

    clave_cache = f"dashboard_pais:{pais_efectivo or 'GLOBAL'}"
    resultado = cache_obtener_o_calcular(
        clave_cache,
        lambda: _calcular_dashboard_pais(pais_efectivo),
        ttl_segundos=180
    )

    return {**resultado, "pais": pais, "rol": rol}

@router.get("/dinamicas")
def get_dinamicas_pais(usuario=Depends(validar_acceso)):
    """
    Retorna todas las dinámicas del país del usuario — activas y
    finalizadas juntas, cada una con su estado y cantidad de artículos.
    """
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
            "total_articulos": f[4],
            "activa": bool(f[5]),
        }
        for f in filas
    ]


@router.get("/articulos")
def get_articulos_pais(tienda_codigo: str = None, usuario=Depends(validar_acceso)):
    """
    Retorna artículos en dinámica filtrados por país y rol.
    categoria y precio_regular ya no viven en dinamica_detalle —
    salen de articulos_maestro vía LEFT JOIN por SKU.

    descripcion usa ISNULL/NULLIF como respaldo: si dinamica_detalle.descripcion
    quedó vacía (por ejemplo, por un Excel con encabezado "Descripción" con
    tilde que no se reconoció al cargar), se completa automáticamente con
    la descripción del catálogo maestro por SKU.

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
            SELECT sku, pais, MIN(categoria) as categoria, MIN(descripcion) as descripcion_cat,
                   AVG(precio_unitario) as precio_unitario
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
            SELECT dd.sku, ISNULL(NULLIF(dd.descripcion, ''), am.descripcion_cat) as descripcion, am.categoria,
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
            SELECT dd.sku, ISNULL(NULLIF(dd.descripcion, ''), am.descripcion_cat) as descripcion, am.categoria,
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
            SELECT dd.sku, ISNULL(NULLIF(dd.descripcion, ''), am.descripcion_cat) as descripcion, am.categoria,
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



def _calcular_alertas_pais(pais_efectivo: str):
    """
    Calcula TODAS las alertas posibles para el alcance dado (un país
    específico, o global si es None) — sin filtrar todavía por el rol
    de quien las va a ver. El filtrado final por rol se hace afuera,
    después de leer el resultado cacheado (es solo una comprensión de
    lista en Python, no cuesta nada) — así una sola alerta calculada
    por país sirve a la vez a admin, comercial y planning.
    """
    conn = get_connection()
    cursor = conn.cursor()
    alertas = []

    filtro = f"AND pais = '{pais_efectivo}'" if pais_efectivo else ""

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
        {'AND usuario_id IN (SELECT id FROM usuarios WHERE pais = ?)' if pais_efectivo else ''}
    """, (pais_efectivo,) if pais_efectivo else ())
    consultas_recientes = cursor.fetchone()[0]
    if consultas_recientes == 0:
        alertas.append({
            "tipo": "info",
            "icono": "💬",
            "titulo": "Sin actividad reciente",
            "mensaje": "No se han realizado consultas a la IA en los últimos 3 días",
            "rol": ["admin", "superadmin"]
        })

    # ── Alerta 7: Consumo de tokens alto hoy (por país) ──
    paises_a_revisar = [pais_efectivo] if pais_efectivo else ['CR', 'GT', 'SV']
    for p in paises_a_revisar:
        cursor.execute("""
            SELECT limite_diario_alerta FROM limites_tokens_pais WHERE pais = ? AND activo = 1
        """, (p,))
        fila_limite = cursor.fetchone()
        if not fila_limite:
            continue
        limite_diario = fila_limite[0]

        cursor.execute("""
            SELECT ISNULL(SUM(tokens_usados), 0) FROM consultas_log
            WHERE pais_consultado = ? AND CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)
        """, (p,))
        consumido_hoy = cursor.fetchone()[0]

        if consumido_hoy >= limite_diario:
            alertas.append({
                "tipo": "warning",
                "icono": "⚡",
                "titulo": "Alto consumo de tokens de IA",
                "mensaje": f"{p} lleva {consumido_hoy:,} tokens consumidos hoy (límite de alerta: {limite_diario:,})",
                "rol": ["admin", "superadmin"]
            })

    # ── Alerta 8: Consumo de tokens alto hoy (por país + rol) ──
    for p in paises_a_revisar:
        cursor.execute("""
            SELECT rol, limite_diario_alerta FROM limites_tokens_rol
            WHERE pais = ? AND activo = 1
        """, (p,))
        limites_rol = cursor.fetchall()

        for rol_config, limite_diario_rol in limites_rol:
            cursor.execute("""
                SELECT ISNULL(SUM(cl.tokens_usados), 0)
                FROM consultas_log cl
                INNER JOIN usuarios u ON cl.usuario_id = u.id
                INNER JOIN cat_roles r ON u.rol_id = r.id
                WHERE cl.pais_consultado = ? AND r.codigo = ?
                AND CAST(cl.fecha AS DATE) = CAST(GETDATE() AS DATE)
            """, (p, rol_config))
            consumido_rol_hoy = cursor.fetchone()[0]

            if consumido_rol_hoy >= limite_diario_rol:
                alertas.append({
                    "tipo": "warning",
                    "icono": "⚡",
                    "titulo": "Alto consumo de tokens por rol",
                    "mensaje": f"{rol_config.capitalize()} en {p} lleva {consumido_rol_hoy:,} tokens hoy (límite: {limite_diario_rol:,})",
                    "rol": ["admin", "superadmin"]
                })

    conn.close()
    return alertas


@router.get("/alertas")
def get_alertas(usuario=Depends(validar_acceso)):
    """
    Genera alertas automáticas según el rol y país del usuario.
    Cacheado por alcance de país (TTL 3 min) — el filtrado final por
    rol de quien consulta se hace en cada request, no en el cache.
    """
    pais = usuario["pais"]
    rol = usuario["rol"]
    pais_efectivo = pais if rol != "superadmin" else None

    clave_cache = f"alertas:{pais_efectivo or 'GLOBAL'}"
    alertas = cache_obtener_o_calcular(
        clave_cache,
        lambda: _calcular_alertas_pais(pais_efectivo),
        ttl_segundos=180
    )

    alertas_filtradas = [a for a in alertas if rol in a["rol"]]

    return {
        "alertas": alertas_filtradas,
        "total": len(alertas_filtradas),
        "errores": len([a for a in alertas_filtradas if a["tipo"] == "error"]),
        "warnings": len([a for a in alertas_filtradas if a["tipo"] == "warning"]),
        "info": len([a for a in alertas_filtradas if a["tipo"] == "info"])
    }



@router.get("/limites-tokens-rol")
def obtener_limites_tokens_rol(usuario=Depends(validar_acceso)):
    """Lista los límites de tokens por país+rol — solo Superadmin."""
    if usuario["rol"] != "superadmin":
        raise HTTPException(status_code=403, detail="Solo el superadmin puede ver esta configuración")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pais, rol, limite_diario_alerta, limite_mensual_corte, activo
        FROM limites_tokens_rol ORDER BY pais, rol
    """)
    filas = cursor.fetchall()
    conn.close()

    return [
        {
            "pais": f[0],
            "rol": f[1],
            "limite_diario_alerta": f[2],
            "limite_mensual_corte": f[3],
            "activo": bool(f[4]),
        }
        for f in filas
    ]


@router.put("/limites-tokens-rol/{pais}/{rol}")
def actualizar_limite_tokens_rol(pais: str, rol: str, datos: LimiteTokensUpdate, usuario=Depends(validar_acceso)):
    """Actualiza el límite de tokens de un rol dentro de un país — solo Superadmin."""
    if usuario["rol"] != "superadmin":
        raise HTTPException(status_code=403, detail="Solo el superadmin puede modificar esta configuración")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE limites_tokens_rol
        SET limite_diario_alerta = ?, limite_mensual_corte = ?, activo = ?, actualizado_en = GETDATE()
        WHERE pais = ? AND rol = ?
    """, (datos.limite_diario_alerta, datos.limite_mensual_corte, datos.activo, pais, rol))
    conn.commit()
    conn.close()

    return {"mensaje": f"Límite de {rol} en {pais} actualizado correctamente"}


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


def _verificar_dinamica_finalizada(dinamica_id: int, pais: str):
    """
    El comparador solo tiene sentido entre campañas ya finalizadas —
    una activa todavía no tiene todo su período de ventas cargado,
    así que compararla daría un número incompleto.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT nombre, activa FROM dinamicas WHERE id = ? AND pais = ?", (dinamica_id, pais))
    fila = cursor.fetchone()
    conn.close()

    if not fila:
        raise HTTPException(status_code=404, detail=f"La dinámica {dinamica_id} no existe en {pais}")
    if fila[1]:
        raise HTTPException(status_code=400, detail=f'"{fila[0]}" todavía está activa — el comparador solo funciona con campañas finalizadas')


def _calcular_resumen_dinamica(dinamica_id: int, pais: str):
    """
    Resumen de ventas/margen de UNA dinámica específica, sumando
    todos los meses de ventas_mes que caen dentro de su rango de
    fechas — no solo el mes más reciente. Usado por el Comparador
    de Campañas.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT nombre, fecha_inicio, fecha_fin FROM dinamicas WHERE id = ? AND pais = ?
    """, (dinamica_id, pais))
    fila_dinamica = cursor.fetchone()
    if not fila_dinamica:
        conn.close()
        return None

    nombre, fecha_inicio, fecha_fin = fila_dinamica
    periodo_inicio = fecha_inicio.year * 12 + fecha_inicio.month
    periodo_fin = fecha_fin.year * 12 + fecha_fin.month

    cursor.execute("""
        SELECT dd.sku, AVG(dd.precio_dinamica) as precio_dinamica,
               COUNT(DISTINCT dd.tienda) as tiendas
        FROM dinamica_detalle dd
        WHERE dd.dinamica_id = ? AND dd.pais = ?
        GROUP BY dd.sku
    """, (dinamica_id, pais))
    filas_detalle = cursor.fetchall()

    if not filas_detalle:
        conn.close()
        return {
            "id": dinamica_id, "nombre": nombre,
            "fecha_inicio": str(fecha_inicio), "fecha_fin": str(fecha_fin),
            "resumen": {"monto_vendido": 0, "unidades_vendidas": 0, "margen_promedio": 0, "cantidad_articulos": 0, "cantidad_tiendas": 0},
            "top_ventas": []
        }

    skus = [f[0] for f in filas_detalle]
    precio_por_sku = {f[0]: float(f[1]) if f[1] else 0 for f in filas_detalle}
    cantidad_tiendas = max((f[2] for f in filas_detalle), default=0)

    skus_str = "','".join(skus)
    cursor.execute(f"""
        SELECT sku, SUM(venta_total) as unidades
        FROM ventas_mes
        WHERE pais = ? AND sku IN ('{skus_str}')
        AND (anio * 12 + mes) BETWEEN ? AND ?
        GROUP BY sku
    """, (pais, periodo_inicio, periodo_fin))
    ventas_por_sku = {f[0]: float(f[1]) if f[1] else 0 for f in cursor.fetchall()}

    cursor.execute(f"""
        SELECT sku, descripcion, AVG(costo_unitario) as costo
        FROM articulos_maestro
        WHERE pais = ? AND sku IN ('{skus_str}')
        GROUP BY sku, descripcion
    """, (pais,))
    catalogo_por_sku = {f[0]: {"descripcion": f[1], "costo": float(f[2]) if f[2] else 0} for f in cursor.fetchall()}

    conn.close()

    productos = []
    for sku in skus:
        unidades = ventas_por_sku.get(sku, 0)
        if unidades <= 0:
            continue
        precio = precio_por_sku.get(sku, 0)
        costo = catalogo_por_sku.get(sku, {}).get("costo", 0)
        monto = round(unidades * precio, 2)
        margen_pct = round(((precio - costo) / precio) * 100, 2) if precio > 0 and costo > 0 else 0
        productos.append({
            "sku": sku,
            "descripcion": catalogo_por_sku.get(sku, {}).get("descripcion", ""),
            "unidades": unidades,
            "venta_total": monto,
            "margen_pct": margen_pct,
        })

    monto_total = round(sum(p["venta_total"] for p in productos), 2)
    margen_promedio = (
        round(sum(p["margen_pct"] * p["venta_total"] for p in productos) / monto_total, 2)
        if monto_total > 0 else 0
    )

    top_ventas = sorted(productos, key=lambda p: p["venta_total"], reverse=True)[:5]

    return {
        "id": dinamica_id,
        "nombre": nombre,
        "fecha_inicio": str(fecha_inicio),
        "fecha_fin": str(fecha_fin),
        "resumen": {
            "monto_vendido": monto_total,
            "unidades_vendidas": round(sum(p["unidades"] for p in productos), 2),
            "margen_promedio": margen_promedio,
            "cantidad_articulos": len(skus),
            "cantidad_tiendas": cantidad_tiendas,
        },
        "top_ventas": top_ventas,
    }


@router.get("/comparador-campanas")
def comparar_campanas(
    dinamica_id_1: int,
    dinamica_id_2: int,
    pais: str = None,
    usuario=Depends(validar_acceso)
):
    """
    Compara dos dinámicas FINALIZADAS lado a lado — unidades vendidas,
    monto, margen y top 5 productos de cada una. No admite campañas
    activas porque su período de ventas todavía está incompleto.
    """
    if usuario["rol"] not in ["admin", "comercial", "planning", "superadmin"]:
        raise HTTPException(status_code=403, detail="Sin acceso al comparador de campañas")

    if usuario["rol"] == "superadmin":
        if not pais:
            raise HTTPException(status_code=400, detail="Falta indicar el país a consultar")
        pais_ctx = pais
    else:
        pais_ctx = usuario["pais"]

    _verificar_dinamica_finalizada(dinamica_id_1, pais_ctx)
    _verificar_dinamica_finalizada(dinamica_id_2, pais_ctx)

    campana_1 = _calcular_resumen_dinamica(dinamica_id_1, pais_ctx)
    campana_2 = _calcular_resumen_dinamica(dinamica_id_2, pais_ctx)

    return {"campana_1": campana_1, "campana_2": campana_2}

@router.get("/dinamicas-finalizadas")
def listar_dinamicas_finalizadas(pais: str = None, usuario=Depends(validar_acceso)):
    """Lista dinámicas finalizadas — para elegir en el Comparador de Campañas."""
    if usuario["rol"] == "superadmin":
        if not pais:
            raise HTTPException(status_code=400, detail="Falta indicar el país a consultar")
        pais_ctx = pais
    else:
        pais_ctx = usuario["pais"]

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, nombre, fecha_inicio, fecha_fin
        FROM dinamicas
        WHERE activa = 0 AND pais = ?
        ORDER BY fecha_fin DESC
    """, (pais_ctx,))
    filas = cursor.fetchall()
    conn.close()

    return [
        {"id": f[0], "nombre": f[1], "fecha_inicio": str(f[2]), "fecha_fin": str(f[3])}
        for f in filas
    ]


def _calcular_ventas_comercial(pais: str, mes: int = None, anio: int = None):
    """
    Wrapper con cache (TTL 10 min) sobre el cálculo real. Si no se
    especifica mes/año, usa el período automático de siempre (mes
    anterior, o el último con datos). La clave de cache incluye el
    período para que cada mes filtrado tenga su propia entrada.
    """
    clave_periodo = f"{mes}-{anio}" if mes and anio else "auto"
    clave_cache = f"ventas_comercial:{pais}:{clave_periodo}"
    return cache_obtener_o_calcular(
        clave_cache,
        lambda: _calcular_ventas_comercial_real(pais, mes, anio),
        ttl_segundos=600
    )


def _calcular_ventas_comercial_real(pais: str, mes: int = None, anio: int = None):
    """
    Lógica compartida entre el endpoint de datos y el de exportación.
    Si mes/anio vienen especificados, calcula ese período exacto en
    vez del período automático — usado por el filtro de mes del
    dashboard de Comercial.
    """
    conn = get_connection()
    cursor = conn.cursor()

    if not pais:
        conn.close()
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    if mes and anio:
        cursor.execute("""
            SELECT COUNT(*) FROM ventas_mes WHERE pais = ? AND mes = ? AND anio = ?
        """, (pais, mes, anio))
        if cursor.fetchone()[0] == 0:
            conn.close()
            return {
                "periodo": None,
                "resumen": {"monto_vendido": 0, "cantidad_productos": 0, "margen_promedio": 0},
                "top_ventas": [], "top_margen": [], "top_departamentos": [], "departamentos_bajos": []
            }
    else:
        mes, anio = _periodo_objetivo(cursor, pais)
        if mes is None:
            conn.close()
            return {
                "periodo": None,
                "resumen": {"monto_vendido": 0, "cantidad_productos": 0, "margen_promedio": 0},
                "top_ventas": [], "top_margen": [], "top_departamentos": [], "departamentos_bajos": []
            }

    periodo_num = anio * 12 + mes

    # ── el resto de la función queda exactamente igual desde acá ──
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
            "sku": f[0], "descripcion": f[1], "unidades": unidades,
            "precio_dinamica": precio_dinamica, "costo_unitario": costo,
            "venta_total": monto, "margen_pct": margen_pct,
        })

    monto_vendido = round(sum(p["venta_total"] for p in productos), 2)
    cantidad_productos = len(productos)
    margen_promedio = (
        round(sum(p["margen_pct"] * p["venta_total"] for p in productos) / monto_vendido, 2)
        if monto_vendido > 0 else 0
    )

    top_ventas = sorted(productos, key=lambda p: p["venta_total"], reverse=True)[:10]
    top_margen = sorted(productos, key=lambda p: p["margen_pct"], reverse=True)[:10]

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
def get_ventas_comercial(mes: int = None, anio: int = None, usuario=Depends(validar_acceso)):
    """
    Métricas de ventas para el dashboard de Comercial. Sin mes/anio,
    usa el período automático (mes anterior, o el último con datos).
    Con ambos, calcula ese período exacto — usado por el filtro de
    mes del dashboard.
    """
    return _calcular_ventas_comercial(usuario["pais"], mes, anio)

@router.get("/ventas-comercial/meses-disponibles")
def meses_disponibles_ventas_comercial(usuario=Depends(validar_acceso)):
    """Lista los (mes, año) que tienen ventas cargadas para el país del usuario."""
    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT mes, anio FROM ventas_mes
        WHERE pais = ?
        ORDER BY anio DESC, mes DESC
    """, (pais,))
    filas = cursor.fetchall()
    conn.close()

    return [{"mes": f[0], "anio": f[1]} for f in filas]


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



@router.get("/limites-tokens")
def obtener_limites_tokens(usuario=Depends(validar_acceso)):
    """Lista los límites de tokens configurados por país — solo Superadmin."""
    if usuario["rol"] != "superadmin":
        raise HTTPException(status_code=403, detail="Solo el superadmin puede ver esta configuración")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pais, limite_diario_alerta, limite_mensual_corte, activo
        FROM limites_tokens_pais ORDER BY pais
    """)
    filas = cursor.fetchall()
    conn.close()

    return [
        {
            "pais": f[0],
            "limite_diario_alerta": f[1],
            "limite_mensual_corte": f[2],
            "activo": bool(f[3]),
        }
        for f in filas
    ]


class LimiteTokensUpdate(BaseModel):
    limite_diario_alerta: int
    limite_mensual_corte: int
    activo: bool


@router.put("/limites-tokens/{pais}")
def actualizar_limite_tokens(pais: str, datos: LimiteTokensUpdate, usuario=Depends(validar_acceso)):
    """Actualiza el límite de tokens de un país — solo Superadmin."""
    if usuario["rol"] != "superadmin":
        raise HTTPException(status_code=403, detail="Solo el superadmin puede modificar esta configuración")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE limites_tokens_pais
        SET limite_diario_alerta = ?, limite_mensual_corte = ?, activo = ?, actualizado_en = GETDATE()
        WHERE pais = ?
    """, (datos.limite_diario_alerta, datos.limite_mensual_corte, datos.activo, pais))
    conn.commit()
    conn.close()

    return {"mensaje": f"Límites de {pais} actualizados correctamente"}


def _calcular_oportunidades_sin_explotar(pais: str, departamento_filtro: str = None):
    """
    Por cada departamento, calcula los SKUs que NUNCA estuvieron en
    ninguna dinámica y SÍ tuvieron venta real el último mes —
    candidatos concretos para probar en promoción.

    Resuelto en una sola consulta con NOT EXISTS — evita armar un
    IN (...) con miles de SKUs, que hace que SQL Server no pueda
    optimizar la consulta en catálogos grandes.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT TOP 1 mes, anio FROM ventas_mes WHERE pais = ?
        ORDER BY anio DESC, mes DESC
    """, (pais,))
    periodo = cursor.fetchone()

    if not periodo:
        conn.close()
        return {"periodo": None, "departamentos": []}

    mes, anio = periodo

    cursor.execute("""
        SELECT am.departamento, am.sku, MIN(am.descripcion) as descripcion, SUM(v.venta_total) as unidades
        FROM ventas_mes v
        INNER JOIN articulos_maestro am ON v.sku = am.sku AND v.pais = am.pais
        WHERE v.pais = ? AND v.mes = ? AND v.anio = ?
        AND am.departamento IS NOT NULL AND am.departamento != ''
        AND NOT EXISTS (
            SELECT 1 FROM dinamica_detalle dd
            WHERE dd.sku = am.sku AND dd.pais = am.pais
        )
        GROUP BY am.departamento, am.sku
        HAVING SUM(v.venta_total) > 0
    """, (pais, mes, anio))

    filas = cursor.fetchall()
    conn.close()

    departamentos = {}
    for depto, sku, descripcion, unidades in filas:
        unidades = float(unidades)
        if depto not in departamentos:
            departamentos[depto] = {"total_unidades": 0, "candidatos": []}
        departamentos[depto]["candidatos"].append({"sku": sku, "descripcion": descripcion, "unidades": unidades})
        departamentos[depto]["total_unidades"] += unidades

    resultado = []
    for depto, datos in sorted(departamentos.items(), key=lambda x: x[1]["total_unidades"], reverse=True):
        if departamento_filtro and depto != departamento_filtro:
            continue
        candidatos_ordenados = sorted(datos["candidatos"], key=lambda c: c["unidades"], reverse=True)
        resultado.append({
            "departamento": depto,
            "total_codigos_sin_explotar": len(candidatos_ordenados),
            "total_unidades": datos["total_unidades"],
            "candidatos": candidatos_ordenados[:8],
        })

    return {
        "periodo": {"mes": mes, "anio": anio},
        "departamentos": resultado
    }


@router.get("/oportunidades-sin-explotar")
def obtener_oportunidades_sin_explotar(usuario=Depends(validar_acceso)):
    """Exclusivo del rol Comercial — ver _calcular_oportunidades_sin_explotar."""
    if usuario["rol"] != "comercial":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Comercial")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    return _calcular_oportunidades_sin_explotar(pais)


@router.get("/rentabilidad-ubicacion")
def obtener_rentabilidad_ubicacion(mes: int = None, anio: int = None, usuario=Depends(validar_acceso)):
    """
    Rentabilidad agregada por tipo de ubicación FÍSICA (Isla, Cabecera,
    Botadero) — a nivel país, no por tienda, porque ventas_mes no tiene
    desglose por sucursal. Si no se especifica mes/año, usa el período
    más reciente con ventas cargadas.

    Kits y cualquier otro valor de ubicación_dinamica quedan FUERA de
    este reporte — son agrupaciones de producto, no un espacio físico
    diferenciado que se pueda comparar entre sí.

    Exclusivo del rol Comercial.
    """
    if usuario["rol"] != "comercial":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Comercial")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()

    # Si no especifican mes/año, usa el más reciente con ventas cargadas
    if not mes or not anio:
        cursor.execute("""
            SELECT TOP 1 mes, anio FROM ventas_mes WHERE pais = ?
            ORDER BY anio DESC, mes DESC
        """, (pais,))
        periodo = cursor.fetchone()

        if not periodo:
            conn.close()
            return {"periodo": None, "ubicaciones": []}

        mes, anio = periodo

    periodo_num = anio * 12 + mes

    cursor.execute("""
        SELECT dd.ubicacion_dinamica, dd.sku, AVG(dd.precio_dinamica) as precio_dinamica
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE dd.pais = ?
        AND (YEAR(d.fecha_inicio) * 12 + MONTH(d.fecha_inicio)) <= ?
        AND (YEAR(d.fecha_fin) * 12 + MONTH(d.fecha_fin)) >= ?
        GROUP BY dd.ubicacion_dinamica, dd.sku
    """, (pais, periodo_num, periodo_num))
    filas_ubicacion = cursor.fetchall()

    if not filas_ubicacion:
        conn.close()
        return {"periodo": {"mes": mes, "anio": anio}, "ubicaciones": []}

    UBICACIONES_FISICAS_VALIDAS = ['isla', 'cabecera', 'botadero']

    def es_ubicacion_fisica(ubicacion):
        """
        Solo Isla, Cabecera y Botadero son exhibiciones físicas
        reales — Kits y cualquier otro valor son agrupaciones de
        producto, no un espacio diferenciado en la tienda.
        """
        if not ubicacion:
            return False
        ubicacion_lower = ubicacion.lower()
        return any(u in ubicacion_lower for u in UBICACIONES_FISICAS_VALIDAS)

    skus = list({f[1] for f in filas_ubicacion})
    skus_str = "','".join(skus)

    cursor.execute(f"""
        SELECT sku, SUM(venta_total) as unidades
        FROM ventas_mes
        WHERE pais = ? AND mes = ? AND anio = ? AND sku IN ('{skus_str}')
        GROUP BY sku
    """, (pais, mes, anio))
    ventas_por_sku = {f[0]: float(f[1]) if f[1] else 0 for f in cursor.fetchall()}

    cursor.execute(f"""
        SELECT sku, AVG(costo_unitario) as costo
        FROM articulos_maestro
        WHERE pais = ? AND sku IN ('{skus_str}')
        GROUP BY sku
    """, (pais,))
    costo_por_sku = {f[0]: float(f[1]) if f[1] else 0 for f in cursor.fetchall()}

    conn.close()

    tipos = {}
    for ubicacion_raw, sku, precio in filas_ubicacion:
        if not es_ubicacion_fisica(ubicacion_raw):
            continue

        unidades = ventas_por_sku.get(sku, 0)
        if unidades <= 0:
            continue
        precio = float(precio) if precio else 0
        costo = costo_por_sku.get(sku, 0)
        monto = round(unidades * precio, 2)

        tipo = ubicacion_raw.strip()
        if tipo not in tipos:
            tipos[tipo] = {"monto_vendido": 0, "monto_margen_ponderado": 0, "cantidad_articulos": set()}
        tipos[tipo]["monto_vendido"] += monto
        tipos[tipo]["cantidad_articulos"].add(sku)
        if precio > 0 and costo > 0:
            margen_pct = ((precio - costo) / precio) * 100
            tipos[tipo]["monto_margen_ponderado"] += margen_pct * monto

    resultado = []
    for tipo, datos in sorted(tipos.items(), key=lambda x: x[1]["monto_vendido"], reverse=True):
        margen_promedio = (
            round(datos["monto_margen_ponderado"] / datos["monto_vendido"], 2)
            if datos["monto_vendido"] > 0 else 0
        )
        resultado.append({
            "tipo_ubicacion": tipo,
            "monto_vendido": round(datos["monto_vendido"], 2),
            "margen_promedio": margen_promedio,
            "cantidad_articulos": len(datos["cantidad_articulos"]),
        })

    return {
        "periodo": {"mes": mes, "anio": anio},
        "ubicaciones": resultado
    }



@router.get("/descuentos-sin-impacto")
def obtener_descuentos_sin_impacto(dinamica_id: int = None, usuario=Depends(validar_acceso)):
    """
    Detecta productos que estuvieron en descuento durante una campaña
    FINALIZADA pero no vendieron más que en el mes inmediatamente
    anterior a que empezara esa campaña (su línea base sin promo).
    Si no se especifica dinamica_id, revisa la última campaña
    finalizada del país. Exclusivo del rol Comercial.

    La descripción usa ISNULL/NULLIF como respaldo: si
    dinamica_detalle.descripcion quedó vacía, se completa con la del
    catálogo maestro por SKU. El departamento también sale del
    catálogo maestro (dinamica_detalle nunca lo tuvo) — se usa para
    poder filtrar la lista de resultados por departamento.
    """
    if usuario["rol"] != "comercial":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Comercial")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()

    if dinamica_id:
        cursor.execute("""
            SELECT id, nombre, fecha_inicio, fecha_fin, activa
            FROM dinamicas WHERE id = ? AND pais = ?
        """, (dinamica_id, pais))
    else:
        cursor.execute("""
            SELECT id, nombre, fecha_inicio, fecha_fin, activa
            FROM dinamicas WHERE pais = ? AND activa = 0
            ORDER BY fecha_fin DESC
        """, (pais,))
    fila_dinamica = cursor.fetchone()

    if not fila_dinamica:
        conn.close()
        if dinamica_id:
            raise HTTPException(status_code=404, detail="Dinámica no encontrada")
        return {"dinamica": None, "productos": []}

    dinamica_id, nombre, fecha_inicio, fecha_fin, activa = fila_dinamica

    if activa:
        conn.close()
        raise HTTPException(status_code=400, detail=f'"{nombre}" todavía está activa — este reporte solo funciona con campañas finalizadas')

    periodo_inicio = fecha_inicio.year * 12 + fecha_inicio.month
    periodo_fin = fecha_fin.year * 12 + fecha_fin.month

    # Línea base: el mes inmediatamente anterior al inicio de la campaña
    anio_base = fecha_inicio.year if fecha_inicio.month > 1 else fecha_inicio.year - 1
    mes_base_num = fecha_inicio.month - 1 if fecha_inicio.month > 1 else 12

    cursor.execute("""
        SELECT dd.sku,
               ISNULL(NULLIF(MIN(dd.descripcion), ''), MIN(am.descripcion)) as descripcion,
               AVG(dd.precio_dinamica) as precio_dinamica,
               AVG(dd.porcentaje_descuento) as descuento,
               MIN(am.departamento) as departamento
        FROM dinamica_detalle dd
        LEFT JOIN (
            SELECT sku, pais, MIN(descripcion) as descripcion, MIN(departamento) as departamento
            FROM articulos_maestro
            GROUP BY sku, pais
        ) am ON am.sku = dd.sku AND am.pais = dd.pais
        WHERE dd.dinamica_id = ? AND dd.pais = ?
        GROUP BY dd.sku
    """, (dinamica_id, pais))
    filas_detalle = cursor.fetchall()

    if not filas_detalle:
        conn.close()
        return {
            "dinamica": {"id": dinamica_id, "nombre": nombre, "fecha_inicio": str(fecha_inicio), "fecha_fin": str(fecha_fin)},
            "productos": []
        }

    skus = [f[0] for f in filas_detalle]
    skus_str = "','".join(skus)

    # Ventas DURANTE la campaña (puede abarcar varios meses)
    cursor.execute(f"""
        SELECT sku, SUM(venta_total) as unidades
        FROM ventas_mes
        WHERE pais = ? AND sku IN ('{skus_str}')
        AND (anio * 12 + mes) BETWEEN ? AND ?
        GROUP BY sku
    """, (pais, periodo_inicio, periodo_fin))
    ventas_durante = {f[0]: float(f[1]) if f[1] else 0 for f in cursor.fetchall()}

    # Ventas en el mes base, ANTES de que empezara la campaña
    cursor.execute(f"""
        SELECT sku, SUM(venta_total) as unidades
        FROM ventas_mes
        WHERE pais = ? AND mes = ? AND anio = ? AND sku IN ('{skus_str}')
        GROUP BY sku
    """, (pais, mes_base_num, anio_base))
    ventas_antes = {f[0]: float(f[1]) if f[1] else 0 for f in cursor.fetchall()}

    conn.close()

    meses_campana = periodo_fin - periodo_inicio + 1

    productos = []
    for sku, descripcion, precio_dinamica, descuento, departamento in filas_detalle:
        antes = ventas_antes.get(sku, 0)
        durante_total = ventas_durante.get(sku, 0)
        # Promedio mensual "durante", para comparar en igualdad de condiciones
        # contra el único mes "antes"
        durante_promedio_mensual = round(durante_total / meses_campana, 2) if meses_campana > 0 else durante_total

        if antes == 0 and durante_total == 0:
            continue

        variacion_pct = (
            round(((durante_promedio_mensual - antes) / antes) * 100, 1) if antes > 0
            else (100 if durante_promedio_mensual > 0 else 0)
        )

        if durante_promedio_mensual <= antes:
            productos.append({
                "sku": sku,
                "descripcion": descripcion or "-",
                "departamento": departamento or "Sin departamento",
                "descuento_pct": round(float(descuento), 1) if descuento else 0,
                "precio_dinamica": round(float(precio_dinamica), 2) if precio_dinamica else 0,
                "ventas_antes_mensual": antes,
                "ventas_durante_mensual": durante_promedio_mensual,
                "variacion_pct": variacion_pct,
            })

    productos.sort(key=lambda p: p["descuento_pct"], reverse=True)

    return {
        "dinamica": {
            "id": dinamica_id, "nombre": nombre,
            "fecha_inicio": str(fecha_inicio), "fecha_fin": str(fecha_fin),
            "mes_base": f"{mes_base_num}/{anio_base}",
        },
        "productos": productos
    }


@router.get("/departamentos-catalogo")
def obtener_departamentos_catalogo(usuario=Depends(validar_acceso)):
    """Lista los departamentos distintos del catálogo — para poblar selectores de filtro."""
    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT departamento FROM articulos_maestro
        WHERE pais = ? AND departamento IS NOT NULL AND departamento != ''
        ORDER BY departamento
    """, (pais,))
    filas = cursor.fetchall()
    conn.close()

    return [f[0] for f in filas]


@router.get("/candidatos-proxima-campana")
def obtener_candidatos_proxima_campana(
    margen_minimo: float = 20,
    cobertura_minima: float = 1,
    departamento: str = None,
    usuario=Depends(validar_acceso)
):
    """
    Candidatos para una futura campaña — productos con buen margen y
    buena cobertura de inventario, que NO están actualmente en
    ninguna dinámica activa. La cobertura se calcula sumando
    existencia y consumo de todas las sucursales del país (no hay
    desglose de campaña por tienda, así que es un dato a nivel país).

    El filtro por departamento se aplica DENTRO de la consulta SQL,
    antes del TOP 300 — así cada departamento compite solo contra sí
    mismo, en vez de perder candidatos frente a departamentos con
    márgenes generalmente más altos.

    Exclusivo del rol Comercial.
    """
    if usuario["rol"] != "comercial":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Comercial")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()

    filtro_depto = "AND am.departamento = ?" if departamento else ""
    params = [pais, departamento] if departamento else [pais]

    cursor.execute(f"""
        SELECT TOP 300
            am.sku,
            MIN(am.descripcion) as descripcion,
            MIN(am.departamento) as departamento,
            AVG(am.precio_unitario) as precio,
            AVG(am.costo_unitario) as costo,
            SUM(am.existencia_bodega) as existencia_total,
            SUM(am.consumo_mensual) as consumo_total
        FROM articulos_maestro am
        WHERE am.pais = ? {filtro_depto}
        AND am.precio_unitario > 0 AND am.costo_unitario > 0
        AND NOT EXISTS (
            SELECT 1 FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.sku = am.sku AND dd.pais = am.pais AND dd.activo = 1 AND d.activa = 1
        )
        GROUP BY am.sku
        HAVING SUM(am.consumo_mensual) > 0
        ORDER BY (AVG(am.precio_unitario) - AVG(am.costo_unitario)) / AVG(am.precio_unitario) DESC
    """, params)
    filas = cursor.fetchall()
    conn.close()

    candidatos = []
    for sku, descripcion, departamento_fila, precio, costo, existencia, consumo in filas:
        precio = float(precio) if precio else 0
        costo = float(costo) if costo else 0
        existencia = float(existencia) if existencia else 0
        consumo = float(consumo) if consumo else 0
        if precio <= 0 or consumo <= 0:
            continue

        margen_pct = round(((precio - costo) / precio) * 100, 2)
        cobertura_meses = round(existencia / consumo, 2)

        if margen_pct < margen_minimo or cobertura_meses < cobertura_minima:
            continue

        candidatos.append({
            "sku": sku,
            "descripcion": descripcion or "-",
            "departamento": departamento_fila or "Sin departamento",
            "precio": round(precio, 2),
            "margen_pct": margen_pct,
            "existencia_bodega": existencia,
            "consumo_mensual": round(consumo, 2),
            "cobertura_meses": cobertura_meses,
        })

    return {
        "filtros": {"margen_minimo": margen_minimo, "cobertura_minima": cobertura_minima, "departamento": departamento},
        "candidatos": candidatos
    }

@router.get("/consultar-margen-cobertura/{sku}")
def consultar_margen_cobertura(sku: str, usuario=Depends(validar_acceso)):
    """
    Consulta puntual de margen y cobertura de un SKU específico —
    sin pasar por los filtros ni el TOP 300 del listado general.
    Muestra también si ya está en alguna dinámica activa, para que
    quede claro por qué no aparecería como "candidato" en ese caso.
    Exclusivo del rol Comercial.
    """
    if usuario["rol"] != "comercial":
        raise HTTPException(status_code=403, detail="Esta consulta es exclusiva para el rol Comercial")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            MIN(descripcion) as descripcion,
            MIN(departamento) as departamento,
            AVG(precio_unitario) as precio,
            AVG(costo_unitario) as costo,
            SUM(existencia_bodega) as existencia_total,
            SUM(consumo_mensual) as consumo_total
        FROM articulos_maestro
        WHERE sku = ? AND pais = ?
        GROUP BY sku
    """, (sku, pais))
    fila = cursor.fetchone()

    if not fila:
        conn.close()
        raise HTTPException(status_code=404, detail=f"SKU {sku} no encontrado en el catálogo de {pais}")

    descripcion, departamento, precio, costo, existencia, consumo = fila
    precio = float(precio) if precio else 0
    costo = float(costo) if costo else 0
    existencia = float(existencia) if existencia else 0
    consumo = float(consumo) if consumo else 0

    margen_pct = round(((precio - costo) / precio) * 100, 2) if precio > 0 and costo > 0 else None
    cobertura_meses = round(existencia / consumo, 2) if consumo > 0 else None

    cursor.execute("""
        SELECT d.nombre, dd.ubicacion_dinamica, d.fecha_inicio, d.fecha_fin
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE dd.sku = ? AND dd.pais = ? AND dd.activo = 1 AND d.activa = 1
    """, (sku, pais))
    dinamicas_activas = cursor.fetchall()

    conn.close()

    return {
        "sku": sku,
        "descripcion": descripcion or "-",
        "departamento": departamento or "Sin departamento",
        "precio": round(precio, 2),
        "costo": round(costo, 2),
        "margen_pct": margen_pct,
        "existencia_bodega": existencia,
        "consumo_mensual": round(consumo, 2),
        "cobertura_meses": cobertura_meses,
        "en_dinamica_activa": [
            {"dinamica": d[0], "ubicacion": d[1], "fecha_inicio": str(d[2]), "fecha_fin": str(d[3])}
            for d in dinamicas_activas
        ]
    }


@router.get("/dinamicas-finalizadas-buscar")
def buscar_dinamicas_finalizadas(
    busqueda: str = None,
    anio: int = None,
    pagina: int = 1,
    por_pagina: int = 12,
    usuario=Depends(validar_acceso)
):
    """
    Lista dinámicas finalizadas con búsqueda por nombre, filtro por
    año y paginación — para navegar cómodamente un historial que
    crece indefinidamente (a diferencia de las activas, que siempre
    son pocas).
    """
    pais = usuario["pais"]
    rol = usuario["rol"]
    if rol == "superadmin" and not pais:
        raise HTTPException(status_code=400, detail="Superadmin debe indicar país")

    conn = get_connection()
    cursor = conn.cursor()

    filtros = ["d.activa = 0"]
    params = []
    if pais:
        filtros.append("d.pais = ?")
        params.append(pais)
    if busqueda:
        filtros.append("d.nombre LIKE ?")
        params.append(f"%{busqueda}%")
    if anio:
        filtros.append("YEAR(d.fecha_fin) = ?")
        params.append(anio)

    where_clause = " AND ".join(filtros)

    cursor.execute(f"SELECT COUNT(*) FROM dinamicas d WHERE {where_clause}", params)
    total = cursor.fetchone()[0]

    offset = (pagina - 1) * por_pagina
    params_paginados = params + [offset, por_pagina]

    cursor.execute(f"""
        SELECT d.id, d.nombre, d.fecha_inicio, d.fecha_fin,
               (SELECT COUNT(*) FROM dinamica_detalle dd WHERE dd.dinamica_id = d.id) as total_articulos
        FROM dinamicas d
        WHERE {where_clause}
        ORDER BY d.fecha_fin DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    """, params_paginados)
    filas = cursor.fetchall()
    conn.close()

    return {
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "total_paginas": (total + por_pagina - 1) // por_pagina,
        "registros": [
            {
                "id": f[0], "nombre": f[1],
                "fecha_inicio": str(f[2]), "fecha_fin": str(f[3]),
                "total_articulos": f[4],
            }
            for f in filas
        ]
    }


@router.get("/anios-dinamicas-finalizadas")
def obtener_anios_dinamicas_finalizadas(usuario=Depends(validar_acceso)):
    """Años distintos con dinámicas finalizadas — para el filtro por año."""
    pais = usuario["pais"]

    conn = get_connection()
    cursor = conn.cursor()
    filtro_pais = "AND pais = ?" if pais else ""
    params = (pais,) if pais else ()

    cursor.execute(f"""
        SELECT DISTINCT YEAR(fecha_fin) as anio FROM dinamicas
        WHERE activa = 0 {filtro_pais}
        ORDER BY anio DESC
    """, params)
    filas = cursor.fetchall()
    conn.close()

    return [f[0] for f in filas]


@router.get("/layout-tienda-visor")
def obtener_layout_tienda_visor(tienda_codigo: str, usuario=Depends(validar_acceso)):
    """
    Layout completo de una tienda para visualización — devuelve cada
    bloque tal cual está en el Excel original (posición + tamaño real
    en filas/columnas), normalizado para que el plano arranque en
    (0,0). El frontend dibuja cada bloque como una celda de grilla
    CSS con su propio rowspan/colspan, reproduciendo la forma real
    de cada mueble sin necesitar interpretar su contenido.

    Layouts cargados ANTES de este cambio no van a tener fila_fin/
    columna_fin — el frontend debe pedir recargar el Excel en ese caso.

    Disponible para Comercial y Planning (mismo alcance que
    /pais/candidatos-proxima-campana en cuanto a país).
    """
    if usuario["rol"] not in ["comercial", "planning", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Sin acceso a este visor")

    pais = usuario["pais"]
    if usuario["rol"] == "superadmin" and not pais:
        raise HTTPException(status_code=400, detail="Superadmin debe indicar país")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT nombre FROM cat_tiendas WHERE codigo = ? AND pais = ? AND activo = 1", (tienda_codigo, pais))
    fila_tienda = cursor.fetchone()
    if not fila_tienda:
        conn.close()
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    tienda_nombre = fila_tienda[0]

    cursor.execute("""
        SELECT tipo, codigo_ubicacion, descripcion, fila, columna, fila_fin, columna_fin
        FROM layout_tiendas
        WHERE tienda_codigo = ? AND pais = ? AND activo = 1
        ORDER BY fila, columna
    """, (tienda_codigo, pais))
    filas_bd = cursor.fetchall()
    conn.close()

    if not filas_bd:
        return {
            "tienda": tienda_nombre, "tienda_codigo": tienda_codigo,
            "bloques": [], "total_filas": 0, "total_columnas": 0, "requiere_recarga": False
        }

    con_span = [f for f in filas_bd if f[5] is not None and f[6] is not None]
    if not con_span:
        return {
            "tienda": tienda_nombre, "tienda_codigo": tienda_codigo,
            "bloques": [], "total_filas": 0, "total_columnas": 0, "requiere_recarga": True
        }

    fila_min = min(f[3] for f in con_span)
    col_min = min(f[4] for f in con_span)

    bloques = []
    for tipo, codigo, descripcion, fila, columna, fila_fin, columna_fin in con_span:
        bloques.append({
            "tipo": tipo,
            "codigo": codigo,
            "descripcion": descripcion,
            "fila": fila - fila_min,
            "columna": columna - col_min,
            "filas_span": (fila_fin - fila) + 1,
            "columnas_span": (columna_fin - columna) + 1,
        })

    total_filas = max(b["fila"] + b["filas_span"] for b in bloques)
    total_columnas = max(b["columna"] + b["columnas_span"] for b in bloques)

    return {
        "tienda": tienda_nombre,
        "tienda_codigo": tienda_codigo,
        "bloques": bloques,
        "total_filas": total_filas,
        "total_columnas": total_columnas,
        "requiere_recarga": False,
    }


@router.get("/historial-sku/{sku}")
def obtener_historial_sku(sku: str, usuario=Depends(validar_acceso)):
    """
    Historial COMPLETO de un SKU en dinámicas — sin límite temporal,
    a diferencia del contexto normal del chat que solo cubre mes
    anterior/próximo. Muestra todas las campañas (activas e
    históricas) donde participó, con fecha, tienda, ubicación y
    precio de cada una. Exclusivo del rol Planning.
    """
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()

    # Ficha del catálogo — si existe
    cursor.execute("""
        SELECT MIN(descripcion), MIN(departamento), MIN(categoria), MIN(marca), AVG(precio_unitario)
        FROM articulos_maestro
        WHERE sku = ? AND pais = ?
        GROUP BY sku
    """, (sku, pais))
    fila_catalogo = cursor.fetchone()

    # Todas las apariciones en dinámicas, sin filtro de fecha
    cursor.execute("""
        SELECT d.nombre, d.id, d.fecha_inicio, d.fecha_fin, d.activa,
               dd.tienda, dd.ubicacion_dinamica, dd.precio_dinamica,
               dd.porcentaje_descuento, dd.tipo_campana
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE dd.sku = ? AND dd.pais = ?
        ORDER BY d.fecha_inicio DESC
    """, (sku, pais))
    filas = cursor.fetchall()
    conn.close()

    if not fila_catalogo and not filas:
        raise HTTPException(status_code=404, detail=f"SKU {sku} no encontrado en catálogo ni en historial de dinámicas")

    historial = [
        {
            "dinamica": f[0],
            "dinamica_id": f[1],
            "fecha_inicio": str(f[2]),
            "fecha_fin": str(f[3]),
            "activa": bool(f[4]),
            "tienda": f[5],
            "ubicacion": f[6] or "Sin ubicación",
            "precio_dinamica": round(float(f[7]), 2) if f[7] else 0,
            "descuento_pct": round(float(f[8]), 1) if f[8] else 0,
            "tipo_campana": f[9] or "-",
        }
        for f in filas
    ]

    return {
        "sku": sku,
        "descripcion": fila_catalogo[0] if fila_catalogo else None,
        "departamento": fila_catalogo[1] if fila_catalogo else None,
        "categoria": fila_catalogo[2] if fila_catalogo else None,
        "marca": fila_catalogo[3] if fila_catalogo else None,
        "precio_regular": round(float(fila_catalogo[4]), 2) if fila_catalogo and fila_catalogo[4] else None,
        "total_apariciones": len(historial),
        "total_activas": sum(1 for h in historial if h["activa"]),
        "historial": historial,
    }



def _calcular_riesgo_quiebre_campana(pais: str, cobertura_maxima: float = 1):
    """
    Productos EN CAMPAÑA ACTIVA ahora mismo que están en riesgo de
    quedarse sin stock antes de que termine — a diferencia de un
    chequeo de inventario general, esto solo mira productos que
    están siendo promocionados en este momento, porque un quiebre
    ahí afecta directamente una campaña en curso.

    El stock de articulos_sucursales se trae en UNA sola consulta
    para todos los SKUs en campaña, en vez de una consulta por cada
    SKU+tienda — evita un N+1 que puede disparar cientos de queries
    en un catálogo con muchas campañas activas.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT DISTINCT dd.sku, MIN(dd.descripcion) as descripcion, d.nombre, d.fecha_fin,
               dd.tienda
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE dd.activo = 1 AND d.activa = 1 AND dd.pais = ?
        GROUP BY dd.sku, d.nombre, d.fecha_fin, dd.tienda
    """, (pais,))
    en_campana = cursor.fetchall()

    if not en_campana:
        conn.close()
        return {"cobertura_maxima": cobertura_maxima, "productos": []}

    skus = list({f[0] for f in en_campana})
    skus_str = "','".join(skus)

    cursor.execute(f"""
        SELECT sku, codigo_sucursal, existencia, consumo_mensual
        FROM articulos_sucursales
        WHERE pais = ? AND sku IN ('{skus_str}')
    """, (pais,))

    stock_por_sku_tienda = {
        (sku, cod_suc): (float(existencia) if existencia else 0, float(consumo) if consumo else 0)
        for sku, cod_suc, existencia, consumo in cursor.fetchall()
    }
    conn.close()

    resultado = []
    for sku, descripcion, dinamica, fecha_fin, tienda in en_campana:
        datos_stock = stock_por_sku_tienda.get((sku, tienda))

        if not datos_stock:
            continue

        existencia, consumo = datos_stock

        if consumo <= 0:
            continue

        cobertura_meses = round(existencia / consumo, 2)

        if cobertura_meses <= cobertura_maxima:
            resultado.append({
                "sku": sku,
                "descripcion": descripcion or "-",
                "dinamica": dinamica,
                "fecha_fin_campana": str(fecha_fin),
                "tienda": tienda,
                "existencia": existencia,
                "consumo_mensual": round(consumo, 2),
                "cobertura_meses": cobertura_meses,
            })

    resultado.sort(key=lambda p: p["cobertura_meses"])

    return {"cobertura_maxima": cobertura_maxima, "productos": resultado}

@router.get("/riesgo-quiebre-campana")
def obtener_riesgo_quiebre_campana(cobertura_maxima: float = 1, usuario=Depends(validar_acceso)):
    """Exclusivo del rol Planning — ver _calcular_riesgo_quiebre_campana."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    return _calcular_riesgo_quiebre_campana(pais, cobertura_maxima)



def _calcular_dashboard_planning(pais: str):
    """
    Panorama general de Planning a nivel país — combina cobertura
    crítica/baja agregada nacionalmente, sobre-stock inmovilizado,
    riesgo de quiebre en campaña activa, devoluciones pendientes y
    campañas activas. Pensado para cargar rápido al entrar al
    dashboard, sin el detalle producto por producto de cada módulo.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # ── 1. Cobertura crítica/baja — agregado nacional por SKU ────
    cursor.execute("""
        SELECT sku, MIN(departamento) as departamento,
               SUM(disponible) as disponible_total, SUM(consumo_mensual) as consumo_total
        FROM articulos_maestro
        WHERE pais = ? AND disponible IS NOT NULL
        AND departamento IS NOT NULL AND departamento != ''
        GROUP BY sku
    """, (pais,))
    filas_cobertura = cursor.fetchall()

    conteo_bandas = {}
    problemas_por_departamento = {}
    for sku, departamento, disponible, consumo in filas_cobertura:
        disponible = float(disponible) if disponible else 0
        consumo = float(consumo) if consumo else 0
        meses = round(disponible / consumo, 2) if consumo > 0 else None
        clave, _ = _clasificar_cobertura(meses)
        conteo_bandas[clave] = conteo_bandas.get(clave, 0) + 1

        if clave in ("critico", "bajo"):
            problemas_por_departamento[departamento] = problemas_por_departamento.get(departamento, 0) + 1

    skus_cobertura_critica = conteo_bandas.get("critico", 0) + conteo_bandas.get("bajo", 0)

    top_departamentos_problema = sorted(
        [{"departamento": d, "total_criticos": c} for d, c in problemas_por_departamento.items()],
        key=lambda x: x["total_criticos"], reverse=True
    )[:5]

    # ── 2. Sobre-stock — monto inmovilizado, agregado país (misma
    # condición que _calcular_sobre_stock_departamento, sin loop por tienda) ──
    cursor.execute("""
        SELECT SUM((disponible - maximo) * ISNULL(costo_unitario, 0))
        FROM articulos_maestro
        WHERE pais = ? AND maximo IS NOT NULL AND maximo > 0
        AND disponible IS NOT NULL AND disponible > maximo
    """, (pais,))
    monto_inmovilizado = cursor.fetchone()[0]
    monto_inmovilizado = round(float(monto_inmovilizado), 2) if monto_inmovilizado else 0

    # ── 3. Riesgo de quiebre en campaña activa ────────────────────
    riesgo = _calcular_riesgo_quiebre_campana(pais, cobertura_maxima=1)
    total_riesgo_quiebre = len(riesgo["productos"])

    # ── 4. Devoluciones pendientes ────────────────────────────────
    cursor.execute("""
        SELECT id, tienda_codigo, sku, descripcion, cantidad_indicada,
               disponible_inicial, existencia_bodega_inicial, fecha_registro
        FROM devoluciones
        WHERE pais = ? AND cerrada = 0
        ORDER BY fecha_registro DESC
    """, (pais,))
    filas_devoluciones = cursor.fetchall()
    conn.close()

    evaluadas = [_evaluar_devolucion(f, pais) for f in filas_devoluciones]
    total_devoluciones = len(evaluadas)
    excedentes = [d for d in evaluadas if d["estado"] == "excedente"]
    top_devoluciones_urgentes = sorted(excedentes, key=lambda d: d["dias_transcurridos"], reverse=True)[:5]

    # ── 5. Campañas activas ────────────────────────────────────────
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.id, d.nombre, d.fecha_fin,
               DATEDIFF(DAY, GETDATE(), d.fecha_fin) as dias
        FROM dinamicas d
        WHERE d.pais = ? AND d.activa = 1
        ORDER BY d.fecha_fin ASC
    """, (pais,))
    filas_campanas = cursor.fetchall()
    conn.close()

    campanas_activas = len(filas_campanas)
    proxima_a_vencer = filas_campanas[0][3] if filas_campanas else None

    return {
        "cobertura": {
            "skus_criticos_o_bajos": skus_cobertura_critica,
            "conteo_bandas": conteo_bandas,
            "top_departamentos_problema": top_departamentos_problema,
        },
        "sobre_stock": {
            "monto_inmovilizado": monto_inmovilizado,
        },
        "riesgo_quiebre": {
            "total": total_riesgo_quiebre,
        },
        "devoluciones": {
            "total_pendientes": total_devoluciones,
            "total_excedentes": len(excedentes),
            "top_urgentes": top_devoluciones_urgentes,
        },
        "campanas": {
            "activas": campanas_activas,
            "proxima_a_vencer_dias": proxima_a_vencer,
        },
    }


@router.get("/dashboard-planning")
def obtener_dashboard_planning(usuario=Depends(validar_acceso)):
    """Panorama general de Planning — ver _calcular_dashboard_planning. Exclusivo del rol Planning."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este dashboard es exclusivo para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    return _calcular_dashboard_planning(pais)


def _calcular_sobre_stock_departamento(pais: str, tienda_codigo: str, departamento: str = None, estado: str = None):
    """
    Sobre-stock evaluado para UNA tienda específica (Existencia
    Actual > Máximo en esa sucursal). Filtros opcionales de
    departamento y estado del artículo (Vigente, Descontinuado,
    etc.) — útil para separar sobre-stock de productos que sí
    importa resolver de los que ya están descontinuados y no se
    van a reponer.

    Usa TRY_CAST a entero para comparar codigo_sucursal contra el
    código de la tienda — al cargar el catálogo, "01" puede quedar
    guardado como "1" (pierde el cero a la izquierda), mientras que
    cat_tiendas.codigo sí lo conserva. Comparar como número evita
    ese desfase de formato entre ambas tablas.
    """
    conn = get_connection()
    cursor = conn.cursor()

    filtro_depto = "AND departamento = ?" if departamento else ""
    filtro_estado = "AND estado = ?" if estado else ""
    params = [pais, tienda_codigo]
    if departamento:
        params.append(departamento)
    if estado:
        params.append(estado)

    cursor.execute(f"""
        SELECT departamento, sku, descripcion, sucursal, disponible, minimo, maximo, costo_unitario, estado
        FROM articulos_maestro
        WHERE pais = ? AND TRY_CAST(codigo_sucursal AS INT) = TRY_CAST(? AS INT) {filtro_depto} {filtro_estado}
        AND departamento IS NOT NULL AND departamento != ''
        AND maximo IS NOT NULL AND maximo > 0
        AND disponible IS NOT NULL AND disponible > maximo
    """, params)
    filas = cursor.fetchall()
    conn.close()

    departamentos = {}
    for depto_fila, sku, descripcion, sucursal, disponible, minimo, maximo, costo, estado_fila in filas:
        disponible = float(disponible) if disponible else 0
        minimo = float(minimo) if minimo else 0
        maximo = float(maximo) if maximo else 0
        costo = float(costo) if costo else 0
        exceso_unidades = round(disponible - maximo, 2)
        monto_inmovilizado = round(exceso_unidades * costo, 2)

        if depto_fila not in departamentos:
            departamentos[depto_fila] = {"monto_total": 0, "productos": []}

        departamentos[depto_fila]["productos"].append({
            "sku": sku,
            "descripcion": descripcion or "-",
            "tienda": sucursal or "-",
            "estado": estado_fila or "-",
            "existencia_actual": disponible,
            "minimo": minimo,
            "maximo": maximo,
            "exceso_unidades": exceso_unidades,
            "monto_inmovilizado": monto_inmovilizado,
        })
        departamentos[depto_fila]["monto_total"] += monto_inmovilizado

    resultado = []
    for depto, datos in sorted(departamentos.items(), key=lambda x: x[1]["monto_total"], reverse=True):
        productos_ordenados = sorted(datos["productos"], key=lambda p: p["monto_inmovilizado"], reverse=True)
        resultado.append({
            "departamento": depto,
            "monto_total": round(datos["monto_total"], 2),
            "total_registros": len(productos_ordenados),
            "productos": productos_ordenados,
        })

    return {"departamentos": resultado}


@router.get("/sobre-stock-departamento")
def obtener_sobre_stock_departamento(
    tienda_codigo: str,
    departamento: str = None,
    estado: str = None,
    usuario=Depends(validar_acceso)
):
    """Exclusivo del rol Planning — ver _calcular_sobre_stock_departamento."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    return _calcular_sobre_stock_departamento(pais, tienda_codigo, departamento, estado)


@router.get("/estados-catalogo-tienda")
def obtener_estados_catalogo_tienda(tienda_codigo: str, usuario=Depends(validar_acceso)):
    """Estados distintos del catálogo (Vigente, Descontinuado, etc.) disponibles en una tienda."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT estado FROM articulos_maestro
        WHERE pais = ? AND TRY_CAST(codigo_sucursal AS INT) = TRY_CAST(? AS INT)
        AND estado IS NOT NULL AND estado != ''
        ORDER BY estado
    """, (pais, tienda_codigo))
    filas = cursor.fetchall()
    conn.close()

    return [f[0] for f in filas]


@router.get("/sobre-stock-departamentos-lista")
def listar_departamentos_sobre_stock(tienda_codigo: str, estado: str = None, usuario=Depends(validar_acceso)):
    """Departamentos con sobre-stock dentro de una tienda, opcionalmente filtrado por estado."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    filtro_estado = "AND estado = ?" if estado else ""
    params = [pais, tienda_codigo] + ([estado] if estado else [])

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT departamento, COUNT(*) as total_casos
        FROM articulos_maestro
        WHERE pais = ? AND TRY_CAST(codigo_sucursal AS INT) = TRY_CAST(? AS INT) {filtro_estado}
        AND departamento IS NOT NULL AND departamento != ''
        AND maximo IS NOT NULL AND maximo > 0
        AND disponible IS NOT NULL AND disponible > maximo
        GROUP BY departamento
        ORDER BY total_casos DESC
    """, params)
    filas = cursor.fetchall()
    conn.close()

    return [{"departamento": f[0], "total_skus": f[1]} for f in filas]


def _evaluar_devolucion(fila, pais):
    """
    Recalcula el estado de una devolución comparando el catálogo
    actual contra el registro inicial (Disponible reportado en el
    Excel de devolución al momento de la carga).

    La Existencia en Bodega es un dato NACIONAL — se muestra como
    contexto de apoyo (sumando otras devoluciones concurrentes del
    mismo SKU, por si varias tiendas devuelven a la vez), pero la
    clasificación principal se basa exclusivamente en el cambio de
    "Disponible" de la tienda puntual, que es una señal inequívoca.

    Cero tolerancia en excedente: cualquier cantidad por encima de
    lo indicado, aunque sea 1 unidad, se marca como excedente.
    """
    (id_, tienda_codigo, sku, descripcion, cantidad_indicada,
     disponible_inicial, existencia_bodega_inicial, fecha_registro) = fila

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT disponible FROM articulos_maestro
        WHERE pais = ? AND sku = ? AND TRY_CAST(codigo_sucursal AS INT) = TRY_CAST(? AS INT)
    """, (pais, sku, tienda_codigo))
    fila_tienda = cursor.fetchone()
    disponible_actual = float(fila_tienda[0]) if fila_tienda and fila_tienda[0] is not None else None

    cursor.execute("""
        SELECT SUM(existencia_bodega) FROM articulos_maestro
        WHERE pais = ? AND sku = ?
    """, (pais, sku))
    fila_bodega = cursor.fetchone()
    existencia_bodega_actual = float(fila_bodega[0]) if fila_bodega and fila_bodega[0] is not None else None

    # Otras devoluciones abiertas del mismo SKU — para dar contexto
    # de bodega sin engañar cuando varias tiendas devuelven a la vez
    cursor.execute("""
        SELECT tienda_codigo, cantidad_indicada FROM devoluciones
        WHERE pais = ? AND sku = ? AND cerrada = 0 AND id != ?
    """, (pais, sku, id_))
    otras = cursor.fetchall()
    conn.close()

    dias_transcurridos = (datetime.date.today() - fecha_registro.date()).days
    cantidad_indicada = float(cantidad_indicada)

    diferencia_tienda = None
    if disponible_actual is not None and disponible_inicial is not None:
        diferencia_tienda = round(float(disponible_inicial) - disponible_actual, 2)

    if diferencia_tienda is None:
        estado = "sin_datos"
        mensaje = "No se encontró el SKU en el catálogo actual de esa tienda."
    elif diferencia_tienda == cantidad_indicada:
        estado = "coincide"
        mensaje = "Posible devolución realizada correctamente — revisá los movimientos para confirmar."
    elif diferencia_tienda > cantidad_indicada:
        estado = "excedente"
        mensaje = f"Se detectó una devolución MAYOR a la indicada: se pidieron {cantidad_indicada} y el movimiento sugiere {diferencia_tienda}. Revisar con urgencia."
    elif 0 < diferencia_tienda < cantidad_indicada:
        estado = "incompleta"
        mensaje = f"Devolución incompleta: se pidieron {cantidad_indicada} y el movimiento sugiere solo {diferencia_tienda}."
    else:
        if dias_transcurridos >= 4:
            estado = "sin_movimiento"
            mensaje = f"Pasaron {dias_transcurridos} días y no se detectó ningún movimiento — la devolución podría no haberse realizado."
        else:
            estado = "pendiente"
            mensaje = f"Todavía dentro del período de revisión (día {dias_transcurridos} de 4) — sin movimiento detectado por ahora."

    nota_bodega = None
    if otras:
        tiendas_otras = ", ".join(f"{t} ({round(float(c), 2)})" for t, c in otras)
        nota_bodega = f"Hay {len(otras)} devolución{'es' if len(otras) != 1 else ''} más abierta{'s' if len(otras) != 1 else ''} de este SKU ({tiendas_otras}) — la bodega se mueve por el conjunto, no se puede aislar el efecto de esta sola."

    return {
        "id": id_,
        "tienda_codigo": tienda_codigo,
        "sku": sku,
        "descripcion": descripcion or "-",
        "cantidad_indicada": cantidad_indicada,
        "fecha_registro": str(fecha_registro),
        "dias_transcurridos": dias_transcurridos,
        "disponible_inicial": float(disponible_inicial) if disponible_inicial is not None else None,
        "disponible_actual": disponible_actual,
        "diferencia_tienda": diferencia_tienda,
        "existencia_bodega_inicial": float(existencia_bodega_inicial) if existencia_bodega_inicial is not None else None,
        "existencia_bodega_actual": existencia_bodega_actual,
        "nota_bodega": nota_bodega,
        "estado": estado,
        "mensaje": mensaje,
    }


@router.post("/devoluciones/cargar")
async def cargar_devoluciones(
    file: UploadFile = File(...),
    tienda_codigo: str = Form(...),
    usuario=Depends(validar_acceso)
):
    """
    Carga masiva de devoluciones desde Excel, para UNA tienda —
    columnas esperadas: SKU, Descripción, Existencia Actual,
    Cantidad a Devolver. "Existencia Actual" se guarda tal cual como
    línea base (disponible_inicial) — es el mismo concepto que
    "Disponible" del catálogo, reportado por la tienda al momento
    de la devolución. Exclusivo del rol Planning.
    """
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Esta función es exclusiva para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    contenido = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contenido))
    except Exception as e:
        app_logger.warning(f"Error leyendo Excel en cargar_devoluciones: {e}")
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo Excel. Verificá que el formato sea correcto (.xlsx o .xls)")

    columnas_map = {c.strip().lower(): c for c in df.columns}

    def buscar_col(*nombres):
        for n in nombres:
            if n.lower() in columnas_map:
                return columnas_map[n.lower()]
        return None

    col_sku = buscar_col("sku", "codigo")
    col_desc = buscar_col("descripcion", "descripción")
    col_existencia = buscar_col("existencia actual", "existencia", "disponible")
    col_cantidad = buscar_col("cantidad a devolver", "cantidad")

    if not col_sku or not col_cantidad:
        raise HTTPException(status_code=400, detail="El archivo debe tener al menos las columnas SKU y Cantidad a Devolver")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT 1 FROM cat_tiendas WHERE codigo = ? AND pais = ? AND activo = 1", (tienda_codigo, pais))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Tienda no válida para tu país")

    cargados = 0
    errores = 0
    for _, fila in df.iterrows():
        sku = str(fila.get(col_sku, "")).strip()
        if not sku or sku.lower() == "nan":
            continue

        cantidad = fila.get(col_cantidad)
        if pd.isna(cantidad):
            errores += 1
            continue

        descripcion = str(fila.get(col_desc, "")).strip() if col_desc else None
        existencia_actual = fila.get(col_existencia) if col_existencia else None

        cursor.execute("""
            SELECT SUM(existencia_bodega) FROM articulos_maestro
            WHERE pais = ? AND sku = ?
        """, (pais, sku))
        fila_bodega = cursor.fetchone()
        existencia_bodega_inicial = float(fila_bodega[0]) if fila_bodega and fila_bodega[0] is not None else None

        cursor.execute("""
            INSERT INTO devoluciones
            (pais, tienda_codigo, sku, descripcion, cantidad_indicada, disponible_inicial, existencia_bodega_inicial, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pais, tienda_codigo, sku, descripcion, float(cantidad),
            float(existencia_actual) if existencia_actual is not None and not pd.isna(existencia_actual) else None,
            existencia_bodega_inicial,
            usuario["id"]
        ))
        cargados += 1

    conn.commit()
    conn.close()

    return {
        "mensaje": "Devoluciones cargadas correctamente",
        "registros_cargados": cargados,
        "errores": errores,
    }


@router.get("/devoluciones")
def listar_devoluciones(usuario=Depends(validar_acceso)):
    """Lista devoluciones NO cerradas, recalculando su estado contra el catálogo actual."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Esta función es exclusiva para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, tienda_codigo, sku, descripcion, cantidad_indicada,
               disponible_inicial, existencia_bodega_inicial, fecha_registro
        FROM devoluciones
        WHERE pais = ? AND cerrada = 0
        ORDER BY fecha_registro DESC
    """, (pais,))
    filas = cursor.fetchall()
    conn.close()

    evaluadas = [_evaluar_devolucion(f, pais) for f in filas]
    orden_prioridad = {"excedente": 0, "incompleta": 1, "sin_movimiento": 2, "coincide": 3, "pendiente": 4, "sin_datos": 5}
    evaluadas.sort(key=lambda d: orden_prioridad.get(d["estado"], 9))

    return evaluadas


class CierreDevolucion(BaseModel):
    comentario: str


@router.put("/devoluciones/{devolucion_id}/cerrar")
def cerrar_devolucion(devolucion_id: int, datos: CierreDevolucion, usuario=Depends(validar_acceso)):
    """Marca una devolución como revisada/cerrada, con comentario obligatorio."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Esta función es exclusiva para el rol Planning")

    if not datos.comentario or not datos.comentario.strip():
        raise HTTPException(status_code=400, detail="El comentario de cierre es obligatorio")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE devoluciones
        SET cerrada = 1, comentario_cierre = ?, cerrada_en = GETDATE(), cerrada_por = ?
        WHERE id = ? AND pais = ?
    """, (datos.comentario.strip(), usuario["id"], devolucion_id, usuario["pais"]))

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Devolución no encontrada")

    conn.commit()
    conn.close()

    return {"mensaje": "Devolución marcada como revisada"}


@router.get("/devoluciones/historial")
def historial_devoluciones(usuario=Depends(validar_acceso)):
    """Devoluciones ya cerradas, con su comentario de resolución — para consulta posterior."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Esta función es exclusiva para el rol Planning")

    pais = usuario["pais"]
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT tienda_codigo, sku, descripcion, cantidad_indicada, fecha_registro,
               comentario_cierre, cerrada_en
        FROM devoluciones
        WHERE pais = ? AND cerrada = 1
        ORDER BY cerrada_en DESC
    """, (pais,))
    filas = cursor.fetchall()
    conn.close()

    return [
        {
            "tienda_codigo": f[0],
            "sku": f[1],
            "descripcion": f[2] or "-",
            "cantidad_indicada": float(f[3]),
            "fecha_registro": str(f[4]),
            "comentario_cierre": f[5],
            "cerrada_en": str(f[6]),
        }
        for f in filas
    ]


BANDAS_COBERTURA = [
    (1, "critico", "🔴 Crítico"),
    (2, "bajo", "🟠 Bajo"),
    (4, "normal", "🟢 Normal"),
    (6, "alto", "🔵 Alto"),
]

def _clasificar_cobertura(meses):
    if meses is None:
        return "sin_datos", "❓ Sin datos"
    for limite, clave, label in BANDAS_COBERTURA:
        if meses < limite:
            return clave, label
    return "excesivo", "⚫ Excesivo"


@router.get("/cobertura-tienda-departamentos-lista")
def listar_departamentos_cobertura(tienda_codigo: str, usuario=Depends(validar_acceso)):
    """Departamentos disponibles en una tienda, con conteo — para el selector."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    pais = usuario["pais"]
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT departamento, COUNT(*) as total
        FROM articulos_maestro
        WHERE pais = ? AND TRY_CAST(codigo_sucursal AS INT) = TRY_CAST(? AS INT)
        AND departamento IS NOT NULL AND departamento != ''
        GROUP BY departamento
        ORDER BY departamento
    """, (pais, tienda_codigo))
    filas = cursor.fetchall()
    conn.close()

    return [{"departamento": f[0], "total_skus": f[1]} for f in filas]




def _calcular_cobertura_tienda(pais: str, tienda_codigo: str, departamento: str, estados: list):
    """
    Cobertura de TODOS los artículos de un departamento en una
    tienda específica — no solo los que están en campaña. Clasifica
    cada SKU en una banda (crítico/bajo/normal/alto/excesivo).
    Filtra por uno o más estados del artículo (obligatorio).
    """
    conn = get_connection()
    cursor = conn.cursor()

    placeholders = ",".join("?" for _ in estados)
    params = [pais, tienda_codigo, departamento] + estados

    cursor.execute(f"""
        SELECT sku, descripcion, disponible, consumo_mensual, estado
        FROM articulos_maestro
        WHERE pais = ? AND TRY_CAST(codigo_sucursal AS INT) = TRY_CAST(? AS INT)
        AND departamento = ? AND estado IN ({placeholders})
    """, params)
    filas = cursor.fetchall()
    conn.close()

    resultado = []
    resumen_bandas = {}
    for sku, descripcion, disponible, consumo, estado_fila in filas:
        disponible = float(disponible) if disponible is not None else 0
        consumo = float(consumo) if consumo is not None else 0
        meses = round(disponible / consumo, 2) if consumo > 0 else None

        clave, label = _clasificar_cobertura(meses)
        resumen_bandas[clave] = resumen_bandas.get(clave, 0) + 1

        resultado.append({
            "sku": sku,
            "descripcion": descripcion or "-",
            "estado": estado_fila or "-",
            "existencia_actual": disponible,
            "consumo_mensual": consumo,
            "cobertura_meses": meses,
            "banda": clave,
            "banda_label": label,
        })

    orden_banda = {"critico": 0, "bajo": 1, "normal": 2, "alto": 3, "excesivo": 4, "sin_datos": 5}
    resultado.sort(key=lambda p: (orden_banda.get(p["banda"], 9), p["cobertura_meses"] if p["cobertura_meses"] is not None else 999))

    return {"resumen_bandas": resumen_bandas, "productos": resultado}


@router.get("/cobertura-tienda")
def obtener_cobertura_tienda(tienda_codigo: str, departamento: str, estados: str, usuario=Depends(validar_acceso)):
    """Exclusivo del rol Planning — ver _calcular_cobertura_tienda. estados: lista separada por comas, obligatoria."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    lista_estados = [e.strip() for e in estados.split(",") if e.strip()]
    if not lista_estados:
        raise HTTPException(status_code=400, detail="Debés seleccionar al menos un estado")

    pais = usuario["pais"]
    return _calcular_cobertura_tienda(pais, tienda_codigo, departamento, lista_estados)


@router.get("/cobertura-sku")
def comparar_cobertura_sku(sku: str, usuario=Depends(validar_acceso)):
    """
    Compara la cobertura de UN SKU entre TODAS las tiendas del país
    a la vez — útil para detectar que una tienda tiene exceso
    mientras otra está en riesgo del mismo producto.
    Exclusivo del rol Planning.
    """
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    pais = usuario["pais"]
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sucursal, MIN(descripcion), SUM(disponible), SUM(consumo_mensual), SUM(existencia_bodega)
        FROM articulos_maestro
        WHERE pais = ? AND sku = ?
        GROUP BY sucursal
    """, (pais, sku))
    filas = cursor.fetchall()
    conn.close()

    if not filas:
        raise HTTPException(status_code=404, detail=f"SKU {sku} no encontrado en el catálogo")

    resultado = []
    for sucursal, descripcion, disponible, consumo, bodega in filas:
        disponible = float(disponible) if disponible is not None else 0
        consumo = float(consumo) if consumo is not None else 0
        meses = round(disponible / consumo, 2) if consumo > 0 else None
        clave, label = _clasificar_cobertura(meses)

        resultado.append({
            "tienda": sucursal,
            "existencia_actual": disponible,
            "consumo_mensual": consumo,
            "cobertura_meses": meses,
            "banda": clave,
            "banda_label": label,
        })

    return {
        "sku": sku,
        "descripcion": filas[0][1] or "-",
        "existencia_bodega": float(filas[0][4]) if filas[0][4] is not None else 0,
        "tiendas": resultado,
    }


def _calcular_redistribucion_departamento(pais: str, departamento: str, estados: list):
    """
    Cruza sobre-stock (tiendas con exceso) contra déficit de
    cobertura (tiendas con menos de 1 mes) del mismo SKU dentro de
    un departamento — sugiere mover stock entre tiendas en vez de
    pedir más al CEDI. Filtra por uno o más estados del artículo
    (obligatorio) antes de calcular excedentes/déficits.
    """
    conn = get_connection()
    cursor = conn.cursor()

    placeholders = ",".join("?" for _ in estados)
    params = [pais, departamento] + estados

    cursor.execute(f"""
        SELECT sku, sucursal, disponible, minimo, maximo, consumo_mensual
        FROM articulos_maestro
        WHERE pais = ? AND departamento = ? AND estado IN ({placeholders})
        AND disponible IS NOT NULL
    """, params)
    filas = cursor.fetchall()
    conn.close()

    por_sku = {}
    for sku, sucursal, disponible, minimo, maximo, consumo in filas:
        disponible = float(disponible) if disponible is not None else 0
        minimo = float(minimo) if minimo is not None else 0
        maximo = float(maximo) if maximo is not None else 0
        consumo = float(consumo) if consumo is not None else 0

        por_sku.setdefault(sku, []).append({
            "tienda": sucursal, "disponible": disponible, "minimo": minimo,
            "maximo": maximo, "consumo": consumo,
        })

    sugerencias = []
    for sku, tiendas_sku in por_sku.items():
        excedentes = [t for t in tiendas_sku if t["maximo"] > 0 and t["disponible"] > t["maximo"]]
        deficitarias = [
            t for t in tiendas_sku
            if t["consumo"] > 0 and (t["disponible"] / t["consumo"]) < 1
        ]

        if not excedentes or not deficitarias:
            continue

        for exc in excedentes:
            for defi in deficitarias:
                if exc["tienda"] == defi["tienda"]:
                    continue
                exceso_disponible = round(exc["disponible"] - exc["maximo"], 2)
                deficit_unidades = round(defi["minimo"] - defi["disponible"], 2) if defi["minimo"] > 0 else round(defi["consumo"] - defi["disponible"], 2)
                unidades_sugeridas = round(min(exceso_disponible, max(deficit_unidades, 0)), 2)

                if unidades_sugeridas <= 0:
                    continue

                sugerencias.append({
                    "sku": sku,
                    "tienda_origen": exc["tienda"],
                    "tienda_destino": defi["tienda"],
                    "unidades_sugeridas": unidades_sugeridas,
                    "disponible_origen": exc["disponible"],
                    "disponible_destino": defi["disponible"],
                })

    sugerencias.sort(key=lambda s: s["unidades_sugeridas"], reverse=True)
    return {"departamento": departamento, "sugerencias": sugerencias}


@router.get("/redistribucion-departamento")
def sugerir_redistribucion(departamento: str, estados: str, usuario=Depends(validar_acceso)):
    """Exclusivo del rol Planning — ver _calcular_redistribucion_departamento. estados: lista separada por comas, obligatoria."""
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    lista_estados = [e.strip() for e in estados.split(",") if e.strip()]
    if not lista_estados:
        raise HTTPException(status_code=400, detail="Debés seleccionar al menos un estado")

    pais = usuario["pais"]
    return _calcular_redistribucion_departamento(pais, departamento, lista_estados)




def _ultimos_periodos_ventas(cursor, pais: str, n: int = 3):
    """Últimos N meses con ventas reales cargadas para el país, más reciente primero."""
    cursor.execute("""
        SELECT TOP (?) mes, anio
        FROM ventas_mes
        WHERE pais = ?
        GROUP BY mes, anio
        HAVING SUM(venta_total) > 0
        ORDER BY anio DESC, mes DESC
    """, (n, pais))
    return cursor.fetchall()


def _calcular_forecast_demanda(pais: str, departamento: str = None, estados: list = None, codigo_proveedor: str = None):
    """
    Pronóstico de demanda por SKU — promedio móvil ponderado de los
    últimos 3 meses de ventas (peso 3/2/1, el más reciente pesa más).
    Si el país tiene menos de 3 meses de ventas cargadas, se marca
    dato_parcial en todos los productos.

    existencia_total = existencia_bodega (nacional, una sola vez) +
    disponible sumado de todas las sucursales — es la base para la
    cobertura proyectada contra el pronóstico, no contra el consumo
    histórico como hace Cobertura de Inventario.
    """
    conn = get_connection()
    cursor = conn.cursor()

    periodos = _ultimos_periodos_ventas(cursor, pais, n=3)
    if not periodos:
        conn.close()
        return {"periodos_usados": [], "productos": []}

    pesos = [3, 2, 1][:len(periodos)]

    ventas_por_periodo = []
    for mes, anio in periodos:
        cursor.execute("""
            SELECT sku, SUM(venta_total) as unidades
            FROM ventas_mes
            WHERE pais = ? AND mes = ? AND anio = ?
            GROUP BY sku
        """, (pais, mes, anio))
        ventas_por_periodo.append({f[0]: float(f[1]) if f[1] else 0 for f in cursor.fetchall()})

    skus_con_venta = set()
    for v in ventas_por_periodo:
        skus_con_venta.update(v.keys())

    filtros = ["pais = ?"]
    params = [pais]
    if departamento:
        filtros.append("departamento = ?")
        params.append(departamento)
    if estados:
        placeholders = ",".join("?" for _ in estados)
        filtros.append(f"estado IN ({placeholders})")
        params.extend(estados)
    if codigo_proveedor:
        filtros.append("codigo_proveedor = ?")
        params.append(codigo_proveedor)

    where_clause = " AND ".join(filtros)
    cursor.execute(f"""
        SELECT sku, MIN(descripcion) as descripcion, MIN(departamento) as departamento,
               MIN(codigo_proveedor) as codigo_proveedor, MIN(proveedor) as proveedor,
               MIN(estado) as estado, AVG(existencia_bodega) as bodega, SUM(disponible) as disponible_total
        FROM articulos_maestro
        WHERE {where_clause}
        GROUP BY sku
    """, params)

    catalogo = {}
    for sku, descripcion, depto, cod_prov, prov, estado, bodega, disponible_total in cursor.fetchall():
        catalogo[sku] = {
            "descripcion": descripcion or "-",
            "departamento": depto or "Sin departamento",
            "codigo_proveedor": cod_prov or "-",
            "proveedor": prov or "-",
            "estado": estado or "-",
            "existencia_total": round((float(bodega) if bodega else 0) + (float(disponible_total) if disponible_total else 0), 2),
        }
    conn.close()

    productos = []
    for sku in skus_con_venta:
        if sku not in catalogo:
            continue  # no pasa los filtros de departamento/estado/proveedor

        info = catalogo[sku]
        valores_periodo = [v.get(sku, 0) for v in ventas_por_periodo]  # más reciente primero

        suma_ponderada = sum(v * p for v, p in zip(valores_periodo, pesos))
        suma_pesos = sum(pesos)
        pronostico = round(suma_ponderada / suma_pesos, 2) if suma_pesos > 0 else 0

        cobertura_proyectada = round(info["existencia_total"] / pronostico, 2) if pronostico > 0 else None

        productos.append({
            "sku": sku,
            "descripcion": info["descripcion"],
            "departamento": info["departamento"],
            "codigo_proveedor": info["codigo_proveedor"],
            "proveedor": info["proveedor"],
            "estado": info["estado"],
            "ventas_historicas": valores_periodo,
            "pronostico_proximo_mes": pronostico,
            "existencia_total": info["existencia_total"],
            "cobertura_proyectada_meses": cobertura_proyectada,
            "dato_parcial": len(periodos) < 3,
        })

    productos.sort(key=lambda p: p["pronostico_proximo_mes"], reverse=True)

    return {
        "periodos_usados": [{"mes": m, "anio": a} for m, a in periodos],
        "productos": productos,
    }


@router.get("/forecast-demanda")
def obtener_forecast_demanda(
    departamento: str = None,
    estados: str = None,
    codigo_proveedor: str = None,
    usuario=Depends(validar_acceso)
):
    """
    Forecast de demanda por SKU — promedio móvil ponderado de los
    últimos 3 meses de ventas. Filtros opcionales: departamento,
    estados (coma-separado), codigo_proveedor. Exclusivo del rol Planning.
    """
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    lista_estados = [e.strip() for e in estados.split(",") if e.strip()] if estados else None

    return _calcular_forecast_demanda(pais, departamento, lista_estados, codigo_proveedor)


@router.get("/proveedores-catalogo")
def obtener_proveedores_catalogo(usuario=Depends(validar_acceso)):
    """Lista proveedores distintos del catálogo (código + nombre) — para poblar selectores de filtro."""
    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT codigo_proveedor, proveedor FROM articulos_maestro
        WHERE pais = ? AND codigo_proveedor IS NOT NULL AND codigo_proveedor != ''
        ORDER BY proveedor
    """, (pais,))
    filas = cursor.fetchall()
    conn.close()

    return [{"codigo": f[0], "nombre": f[1] or f[0]} for f in filas]



def _calcular_impacto_campana_cobertura(
    pais: str, dinamica_id: int, banda_filtro: str = None,
    departamento: str = None, estados: list = None, tienda_codigo: str = None
):
    """
    Cobertura resultante, POST-campaña, de cada SKU+tienda que
    participó en una dinámica finalizada. Cruza dinamica_detalle
    (para saber qué SKU corrió en qué tienda, con qué precio y
    ubicación) contra articulos_maestro ACTUAL (estado real del
    inventario hoy, no al momento de la campaña).

    Filtros opcionales: banda de cobertura, departamento, estado(s)
    del artículo y una tienda específica — todos aplicados sobre el
    catálogo actual, no sobre lo que corrió en campaña.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT nombre, fecha_inicio, fecha_fin, activa FROM dinamicas
        WHERE id = ? AND pais = ?
    """, (dinamica_id, pais))
    fila_dinamica = cursor.fetchone()

    if not fila_dinamica:
        conn.close()
        raise HTTPException(status_code=404, detail=f"La dinámica {dinamica_id} no existe en {pais}")

    nombre, fecha_inicio, fecha_fin, activa = fila_dinamica
    if activa:
        conn.close()
        raise HTTPException(status_code=400, detail=f'"{nombre}" todavía está activa — este reporte solo funciona con campañas finalizadas')

    filtro_tienda_dd = "AND dd.tienda = ?" if tienda_codigo else ""
    params_dd = [dinamica_id, pais] + ([tienda_codigo] if tienda_codigo else [])

    cursor.execute(f"""
        SELECT dd.sku, dd.tienda, dd.ubicacion_dinamica, AVG(dd.precio_dinamica) as precio_dinamica,
               ISNULL(NULLIF(MIN(dd.descripcion), ''), MIN(am.descripcion)) as descripcion
        FROM dinamica_detalle dd
        LEFT JOIN (
            SELECT sku, pais, MIN(descripcion) as descripcion
            FROM articulos_maestro GROUP BY sku, pais
        ) am ON am.sku = dd.sku AND am.pais = dd.pais
        WHERE dd.dinamica_id = ? AND dd.pais = ? {filtro_tienda_dd}
        GROUP BY dd.sku, dd.tienda, dd.ubicacion_dinamica
    """, params_dd)
    filas_campana = cursor.fetchall()

    if not filas_campana:
        conn.close()
        return {
            "dinamica": {"id": dinamica_id, "nombre": nombre, "fecha_inicio": str(fecha_inicio), "fecha_fin": str(fecha_fin)},
            "resumen_bandas": {}, "productos": []
        }

    skus = list({f[0] for f in filas_campana})
    skus_str = "','".join(skus)

    filtro_depto = "AND departamento = ?" if departamento else ""
    filtro_estado = ""
    params_catalogo = [pais]
    if departamento:
        params_catalogo.append(departamento)
    if estados:
        placeholders = ",".join("?" for _ in estados)
        filtro_estado = f"AND estado IN ({placeholders})"
        params_catalogo.extend(estados)

    cursor.execute(f"""
        SELECT sku, codigo_sucursal, disponible, consumo_mensual, estado
        FROM articulos_maestro
        WHERE pais = ? AND sku IN ('{skus_str}') {filtro_depto} {filtro_estado}
    """, params_catalogo)

    catalogo_actual = {}
    for sku, cod_suc, disponible, consumo, estado in cursor.fetchall():
        try:
            clave_tienda = str(int(cod_suc))
        except (TypeError, ValueError):
            continue
        catalogo_actual[(sku, clave_tienda)] = {
            "disponible": float(disponible) if disponible is not None else 0,
            "consumo": float(consumo) if consumo is not None else 0,
            "estado": estado or "-",
        }

    conn.close()

    resultado = []
    resumen_bandas = {}
    for sku, tienda, ubicacion, precio_dinamica, descripcion in filas_campana:
        try:
            clave_tienda = str(int(tienda))
        except (TypeError, ValueError):
            continue

        info_actual = catalogo_actual.get((sku, clave_tienda))
        if not info_actual:
            continue  # no existe en el catálogo actual, o no pasó el filtro de departamento/estado

        disponible = info_actual["disponible"]
        consumo = info_actual["consumo"]
        meses = round(disponible / consumo, 2) if consumo > 0 else None

        clave, label = _clasificar_cobertura(meses)

        if banda_filtro and clave != banda_filtro:
            continue

        resumen_bandas[clave] = resumen_bandas.get(clave, 0) + 1

        resultado.append({
            "sku": sku,
            "descripcion": descripcion or "-",
            "tienda": tienda,
            "ubicacion_campana": ubicacion or "General",
            "precio_dinamica": round(float(precio_dinamica), 2) if precio_dinamica else 0,
            "estado": info_actual["estado"],
            "existencia_actual": disponible,
            "consumo_mensual": consumo,
            "cobertura_meses": meses,
            "banda": clave,
            "banda_label": label,
        })

    orden_banda = {"critico": 0, "bajo": 1, "normal": 2, "alto": 3, "excesivo": 4, "sin_datos": 5}
    resultado.sort(key=lambda p: (orden_banda.get(p["banda"], 9), p["cobertura_meses"] if p["cobertura_meses"] is not None else 999))

    return {
        "dinamica": {"id": dinamica_id, "nombre": nombre, "fecha_inicio": str(fecha_inicio), "fecha_fin": str(fecha_fin)},
        "resumen_bandas": resumen_bandas,
        "productos": resultado,
    }


@router.get("/impacto-campana-cobertura")
def obtener_impacto_campana_cobertura(
    dinamica_id: int,
    banda: str = None,
    departamento: str = None,
    estados: str = None,
    tienda_codigo: str = None,
    usuario=Depends(validar_acceso)
):
    """
    Cobertura resultante post-campaña, por SKU+tienda, de una dinámica
    finalizada. Filtros opcionales: banda, departamento, estados
    (coma-separado) y tienda. Exclusivo del rol Planning.
    """
    if usuario["rol"] != "planning":
        raise HTTPException(status_code=403, detail="Este reporte es exclusivo para el rol Planning")

    pais = usuario["pais"]
    if not pais:
        raise HTTPException(status_code=400, detail="Usuario sin país asignado")

    lista_estados = [e.strip() for e in estados.split(",") if e.strip()] if estados else None

    return _calcular_impacto_campana_cobertura(pais, dinamica_id, banda, departamento, lista_estados, tienda_codigo)