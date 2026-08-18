# ============================================================
# Router: admin_pais.py
# Descripción: Endpoints para administradores por país
# Acceso: roles admin, comercial, planning, tiendas
# ============================================================

from fastapi import APIRouter, HTTPException, Depends
from app.database import get_connection
from app.auth import verificar_token

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
        SELECT ubicacion, COUNT(*) as total
        FROM dinamica_detalle
        WHERE activo = 1 
        AND ubicacion IS NOT NULL 
        AND ubicacion != ''
        {filtro_pais_simple}
        GROUP BY ubicacion
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
def get_articulos_pais(usuario=Depends(validar_acceso)):
    """Retorna artículos en dinámica filtrados por país y rol"""
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]
    tienda = usuario["tienda"]

    # Tiendas solo ven su tienda
    if rol == "tiendas" and tienda:
        cursor.execute("""
            SELECT dd.articulo_codigo, dd.articulo_descripcion, dd.categoria,
                   dd.precio_regular, dd.precio_dinamica, dd.ubicacion,
                   dd.tienda, dd.tipo_campana, d.nombre, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
            AND dd.tienda LIKE ?
        """, (f'{tienda}%',))
    elif pais and rol != "superadmin":
        cursor.execute("""
            SELECT dd.articulo_codigo, dd.articulo_descripcion, dd.categoria,
                   dd.precio_regular, dd.precio_dinamica, dd.ubicacion,
                   dd.tienda, dd.tipo_campana, d.nombre, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
            AND dd.pais = ?
        """, (pais,))
    else:
        cursor.execute("""
            SELECT dd.articulo_codigo, dd.articulo_descripcion, dd.categoria,
                   dd.precio_regular, dd.precio_dinamica, dd.ubicacion,
                   dd.tienda, dd.tipo_campana, d.nombre, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
        """)

    filas = cursor.fetchall()
    conn.close()

    return [
        {
            "codigo": f[0],
            "descripcion": f[1],
            "categoria": f[2] or "-",
            "precio_regular": float(f[3]) if f[3] else 0,
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
        AND (ubicacion IS NULL OR ubicacion = '')
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
        SELECT articulo_codigo, COUNT(DISTINCT dinamica_id) as total
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE dd.activo = 1 AND d.activa = 1
        {filtro.replace('pais', 'dd.pais')}
        GROUP BY articulo_codigo
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
    filtro_pais = "AND dd.pais = ?" if pais and rol != "superadmin" else ""
    params_articulos = [termino, termino, termino]
    if pais and rol != "superadmin":
        params_articulos.append(pais)

    cursor.execute(f"""
        SELECT TOP 8 dd.articulo_codigo, dd.articulo_descripcion,
               dd.precio_dinamica, dd.ubicacion, dd.tienda,
               dd.tipo_campana, d.nombre as dinamica, dd.pais
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE dd.activo = 1 AND d.activa = 1
        AND (dd.articulo_codigo LIKE ?
             OR dd.articulo_descripcion LIKE ?
             OR dd.categoria LIKE ?)
        {filtro_pais}
        ORDER BY dd.articulo_codigo
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