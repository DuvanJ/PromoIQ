from app.utils.security import encriptar_password
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_connection, registrar_auditoria
from app.auth import verificar_token

router = APIRouter(prefix="/admin", tags=["Administración"])

def validar_superadmin(usuario=Depends(verificar_token)):
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Acceso no autorizado")
    return usuario

@router.get("/dashboard")
def get_dashboard(usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM dinamicas WHERE activa = 1")
    dinamicas_activas = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM dinamica_detalle WHERE activo = 1")
    articulos_campana = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*) FROM consultas_log
        WHERE CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)
    """)
    consultas_hoy = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM usuarios WHERE activo = 1")
    usuarios_activos = cursor.fetchone()[0]

    cursor.execute("""
        SELECT CAST(fecha AS DATE) as dia, COUNT(*) as total
        FROM consultas_log
        WHERE fecha >= DATEADD(DAY, -7, GETDATE())
        GROUP BY CAST(fecha AS DATE)
        ORDER BY dia ASC
    """)
    consultas_semana = [
        {"dia": str(r[0]), "total": r[1]}
        for r in cursor.fetchall()
    ]

    cursor.execute("""
        SELECT ubicacion_dinamica, COUNT(*) as total
        FROM dinamica_detalle
        WHERE activo = 1 AND ubicacion_dinamica IS NOT NULL
        GROUP BY ubicacion_dinamica
        ORDER BY total DESC
    """)
    por_ubicacion = [
        {"ubicacion": r[0], "total": r[1]}
        for r in cursor.fetchall()
    ]

    cursor.execute("""
        SELECT TOP 5 u.nombre, c.pregunta, c.fecha, c.tokens_usados
        FROM consultas_log c
        LEFT JOIN usuarios u ON c.usuario_id = u.id
        ORDER BY c.fecha DESC
    """)
    ultimas_consultas = [
        {
            "usuario": r[0] or "Desconocido",
            "pregunta": r[1],
            "fecha": str(r[2]),
            "tokens": r[3] or 0
        }
        for r in cursor.fetchall()
    ]

    cursor.execute("""
        SELECT r.nombre, COUNT(*) as total
        FROM usuarios u
        INNER JOIN cat_roles r ON u.rol_id = r.id
        WHERE u.activo = 1
        GROUP BY r.nombre
    """)
    usuarios_por_rol = [
        {"rol": r[0], "total": r[1]}
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
        "consultas_semana": consultas_semana,
        "por_ubicacion": por_ubicacion,
        "ultimas_consultas": ultimas_consultas,
        "usuarios_por_rol": usuarios_por_rol,
    }


@router.get("/comparativa-paises")
def get_comparativa_paises(usuario=Depends(validar_superadmin)):
    """
    Vista comparativa de métricas clave entre CR, GT y SV.
    Exclusivo de superadmin — un admin de país no tiene acceso
    a esta comparación por diseño.
    """
    if usuario["rol"] != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede ver la comparativa entre países")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT codigo FROM cat_paises WHERE activo = 1 ORDER BY orden ASC")
    paises = [r[0] for r in cursor.fetchall()]
    resultado = {}

    mes_actual = None
    anio_actual = None

    for p in paises:
        cursor.execute("""
            SELECT COUNT(DISTINCT d.id)
            FROM dinamicas d
            INNER JOIN dinamica_detalle dd ON d.id = dd.dinamica_id
            WHERE d.activa = 1 AND dd.pais = ?
        """, (p,))
        dinamicas_activas = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM articulos_maestro WHERE pais = ?", (p,))
        total_catalogo = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*) FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1 AND dd.pais = ?
        """, (p,))
        articulos_campana = cursor.fetchone()[0]

        cursor.execute("""
            SELECT TOP 1 mes, anio, SUM(venta_total)
            FROM ventas_mes
            WHERE pais = ?
            GROUP BY mes, anio
            ORDER BY anio DESC, mes DESC
        """, (p,))
        fila_ventas = cursor.fetchone()
        if fila_ventas:
            mes_actual, anio_actual, total_ventas = fila_ventas
            total_ventas = float(total_ventas) if total_ventas else 0
        else:
            total_ventas = 0

        cursor.execute("SELECT COUNT(*) FROM usuarios WHERE pais = ? AND activo = 1", (p,))
        usuarios_activos = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*), ISNULL(SUM(c.tokens_usados), 0)
            FROM consultas_log c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            WHERE u.pais = ? AND CAST(c.fecha AS DATE) = CAST(GETDATE() AS DATE)
        """, (p,))
        consultas_hoy, tokens_hoy = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(DISTINCT d.id)
            FROM dinamicas d
            INNER JOIN dinamica_detalle dd ON d.id = dd.dinamica_id
            WHERE d.activa = 1 AND dd.pais = ?
            AND DATEDIFF(DAY, GETDATE(), d.fecha_fin) BETWEEN 0 AND 7
        """, (p,))
        por_vencer = cursor.fetchone()[0]

        resultado[p] = {
            "dinamicas_activas": dinamicas_activas,
            "dinamicas_por_vencer": por_vencer,
            "total_catalogo": total_catalogo,
            "articulos_campana": articulos_campana,
            "total_ventas_mes": round(total_ventas, 2),
            "usuarios_activos": usuarios_activos,
            "consultas_hoy": consultas_hoy,
            "tokens_hoy": tokens_hoy,
            "costo_estimado_hoy": round(tokens_hoy * 0.000003, 4),
        }

    conn.close()

    return {
        "paises": resultado,
        "periodo_ventas": {"mes": mes_actual, "anio": anio_actual}
    }


@router.get("/dinamicas")
def get_dinamicas(pais: str = None, usuario=Depends(validar_superadmin)):
    """
    Lista dinámicas — cada admin ve solo las de su propio país.
    Superadmin ve las del país que seleccione en el frontend (parámetro `pais`);
    si no se indica, ve todas sin filtrar.
    """
    conn = get_connection()
    cursor = conn.cursor()

    pais_filtro = usuario["pais"] if usuario["rol"] != "superadmin" else pais

    filtro_pais = "WHERE d.pais = ?" if pais_filtro else ""
    params = (pais_filtro,) if pais_filtro else ()

    cursor.execute(f"""
        SELECT d.id, d.nombre, d.fecha_inicio, d.fecha_fin, 
               d.descripcion, d.activa, d.creado_en, d.pais,
               COUNT(dd.id) as total_articulos
        FROM dinamicas d
        LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id
        {filtro_pais}
        GROUP BY d.id, d.nombre, d.fecha_inicio, d.fecha_fin,
                 d.descripcion, d.activa, d.creado_en, d.pais
        ORDER BY d.creado_en DESC
    """, params)
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
            "creado_en": str(f[6]),
            "pais": f[7],
            "total_articulos": f[8]
        }
        for f in filas
    ]

@router.post("/dinamicas/crear")
def crear_dinamica(
    nombre: str,
    fecha_inicio: str,
    fecha_fin: str,
    descripcion: str = "",
    pais: str = None,
    usuario=Depends(validar_superadmin)
):
    """
    Crea una dinámica nueva, siempre vacía (sin artículos todavía) y
    asociada a un único país — nunca compartida entre países.
    Un admin siempre crea para su propio país, sin importar qué mande el frontend.
    Superadmin debe indicar explícitamente el país.
    """
    pais_final = usuario["pais"] if usuario["rol"] != "superadmin" else pais

    if not pais_final:
        raise HTTPException(status_code=400, detail="Debés indicar el país para la nueva dinámica")

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO dinamicas (nombre, fecha_inicio, fecha_fin, descripcion, creado_por, pais)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (nombre, fecha_inicio, fecha_fin, descripcion, usuario["id"], pais_final))
        conn.commit()

        cursor.execute("SELECT @@IDENTITY")
        nuevo_id = cursor.fetchone()[0]
        return {"mensaje": "Dinámica creada exitosamente", "id": int(nuevo_id), "pais": pais_final}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.get("/historial")
def get_historial(usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT TOP 100 c.id, u.nombre, c.pregunta, c.respuesta, 
               c.tokens_usados, c.fecha
        FROM consultas_log c
        LEFT JOIN usuarios u ON c.usuario_id = u.id
        ORDER BY c.fecha DESC
    """)
    filas = cursor.fetchall()
    conn.close()
    return [
        {
            "id": f[0],
            "usuario": f[1] or "Desconocido",
            "pregunta": f[2],
            "respuesta": f[3],
            "tokens": f[4] or 0,
            "fecha": str(f[5])
        }
        for f in filas
    ]

@router.get("/usuarios")
def get_usuarios(usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.nombre, u.email, r.codigo, r.nombre,
               u.tiendas, u.pais, u.activo, u.creado_en, u.ultimo_acceso,
               u.numero_colaborador
        FROM usuarios u
        INNER JOIN cat_roles r ON u.rol_id = r.id
        ORDER BY u.creado_en DESC
    """)
    filas = cursor.fetchall()
    conn.close()
    return [
        {
            "id": f[0],
            "nombre": f[1],
            "email": f[2],
            "rol_codigo": f[3],
            "rol_nombre": f[4],
            "tiendas": f[5],
            "pais": f[6],
            "activo": f[7],
            "creado_en": str(f[8]),
            "ultimo_acceso": str(f[9]) if f[9] else None,
            "numero_colaborador": f[10],
        }
        for f in filas
    ]

@router.post("/usuarios/crear")
def crear_usuario(
    nombre: str,
    email: str,
    password: str,
    rol_codigo: str,
    numero_colaborador: str = None,
    pais: str = None,
    tiendas: str = None,
    usuario=Depends(validar_superadmin)
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM cat_roles WHERE codigo = ?", (rol_codigo,))
        rol = cursor.fetchone()
        if not rol:
            raise HTTPException(status_code=400, detail="Rol no válido")

        password_hash = encriptar_password(password)

        cursor.execute("""
            INSERT INTO usuarios (nombre, email, password, rol_id, pais, tiendas, numero_colaborador, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """, (nombre, email, password_hash, rol[0], pais, tiendas, numero_colaborador))
        conn.commit()
        return {"mensaje": f"Usuario {nombre} creado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        mensaje = str(e)
        if "UQ_colaborador" in mensaje or "duplicate key" in mensaje.lower():
            raise HTTPException(
                status_code=400,
                detail=f"El número de colaborador {numero_colaborador} ya está en uso en ese país"
            )
        if "UQ__usuarios" in mensaje:
            raise HTTPException(status_code=400, detail=f"Ya existe un usuario con ese email")
        raise HTTPException(status_code=400, detail=f"Error: {mensaje}")
    finally:
        conn.close()


@router.put("/usuarios/{usuario_id}")
def editar_usuario(
    usuario_id: int,
    nombre: str,
    email: str,
    rol_codigo: str,
    numero_colaborador: str = None,
    pais: str = None,
    tiendas: str = None,
    activo: bool = True,
    usuario=Depends(validar_superadmin)
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM cat_roles WHERE codigo = ?", (rol_codigo,))
        rol = cursor.fetchone()
        if not rol:
            raise HTTPException(status_code=400, detail="Rol no válido")

        cursor.execute("""
            UPDATE usuarios
            SET nombre = ?, email = ?, rol_id = ?, pais = ?, tiendas = ?, activo = ?, numero_colaborador = ?
            WHERE id = ?
        """, (nombre, email, rol[0], pais, tiendas, 1 if activo else 0, numero_colaborador, usuario_id))
        conn.commit()
        return {"mensaje": "Usuario actualizado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        mensaje = str(e)
        if "UQ_colaborador" in mensaje or "duplicate key" in mensaje.lower():
            raise HTTPException(
                status_code=400,
                detail=f"El número de colaborador {numero_colaborador} ya está en uso en ese país"
            )
        raise HTTPException(status_code=400, detail=f"Error: {mensaje}")
    finally:
        conn.close()


@router.put("/usuarios/{usuario_id}/password")
def cambiar_password(
    usuario_id: int,
    nueva_password: str,
    usuario=Depends(validar_superadmin)
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        password_hash = encriptar_password(nueva_password)
        cursor.execute("""
            UPDATE usuarios SET password = ? WHERE id = ?
        """, (password_hash, usuario_id))
        conn.commit()
        return {"mensaje": "Contraseña actualizada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.delete("/usuarios/{usuario_id}")
def eliminar_usuario(
    usuario_id: int,
    usuario=Depends(validar_superadmin)
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if str(usuario_id) == str(usuario["id"]):
            raise HTTPException(status_code=400, detail="No podés eliminarte a vos mismo")

        cursor.execute("UPDATE usuarios SET activo = 0 WHERE id = ?", (usuario_id,))
        conn.commit()
        registrar_auditoria(usuario, "desactivar", "usuario", str(usuario_id), None, "Usuario desactivado")
        return {"mensaje": "Usuario desactivado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


@router.get("/dinamicas/{dinamica_id}/detalle")
def get_dinamica_detalle(dinamica_id: int, usuario=Depends(validar_superadmin)):
    """
    categoria y precio_regular ya no viven en dinamica_detalle —
    salen de articulos_maestro vía LEFT JOIN por SKU (LEFT porque
    un SKU en dinámica podría no estar en el catálogo vigente).
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, nombre, fecha_inicio, fecha_fin, descripcion, activa, creado_en, pais
        FROM dinamicas WHERE id = ?
    """, (dinamica_id,))
    dinamica = cursor.fetchone()

    if not dinamica:
        conn.close()
        raise HTTPException(status_code=404, detail="Dinámica no encontrada")

    if usuario["rol"] != "superadmin" and dinamica[7] != usuario["pais"]:
        conn.close()
        raise HTTPException(status_code=403, detail="No tenés acceso a esta dinámica")

    cursor.execute("""
        SELECT dd.sku, dd.descripcion, am.categoria,
               am.precio_unitario, dd.precio_dinamica,
               dd.ubicacion_dinamica, dd.ubicacion_tienda, dd.tienda, dd.tipo_campana, dd.pais
        FROM dinamica_detalle dd
        LEFT JOIN (
            SELECT sku, pais, MIN(categoria) as categoria, AVG(precio_unitario) as precio_unitario
            FROM articulos_maestro
            GROUP BY sku, pais
        ) am ON am.sku = dd.sku AND am.pais = dd.pais
        WHERE dd.dinamica_id = ? AND dd.activo = 1
        ORDER BY dd.pais, dd.tienda, dd.sku
    """, (dinamica_id,))
    articulos = cursor.fetchall()
    conn.close()

    return {
        "dinamica": {
            "id": dinamica[0],
            "nombre": dinamica[1],
            "fecha_inicio": str(dinamica[2]),
            "fecha_fin": str(dinamica[3]),
            "descripcion": dinamica[4],
            "activa": dinamica[5],
            "creado_en": str(dinamica[6]),
            "pais": dinamica[7],
        },
        "articulos": [
            {
                "codigo": a[0],
                "descripcion": a[1],
                "categoria": a[2],
                "precio_regular": round(float(a[3]), 2) if a[3] else 0,
                "precio_dinamica": float(a[4]) if a[4] else 0,
                "ahorro": round((float(a[3]) if a[3] else 0) - (float(a[4]) if a[4] else 0), 2),
                "ubicacion_dinamica": a[5],
                "ubicacion_tienda": a[6],
                "tienda": a[7],
                "tipo_campana": a[8],
                "pais": a[9]
            }
            for a in articulos
        ]
    }

@router.put("/dinamicas/{dinamica_id}/toggle")
def toggle_dinamica(dinamica_id: int, usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT activa, pais FROM dinamicas WHERE id = ?", (dinamica_id,))
        dinamica = cursor.fetchone()
        if not dinamica:
            raise HTTPException(status_code=404, detail="Dinámica no encontrada")

        if usuario["rol"] != "superadmin" and dinamica[1] != usuario["pais"]:
            raise HTTPException(status_code=403, detail="No tenés acceso a esta dinámica")

        nuevo_estado = 0 if dinamica[0] else 1
        cursor.execute("UPDATE dinamicas SET activa = ? WHERE id = ?", (nuevo_estado, dinamica_id))
        conn.commit()
        return {
            "mensaje": f"Dinámica {'activada' if nuevo_estado else 'desactivada'} correctamente",
            "activa": bool(nuevo_estado)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.delete("/dinamicas/{dinamica_id}")
def eliminar_dinamica(dinamica_id: int, usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT pais FROM dinamicas WHERE id = ?", (dinamica_id,))
        fila = cursor.fetchone()
        if not fila:
            raise HTTPException(status_code=404, detail="Dinámica no encontrada")

        if usuario["rol"] != "superadmin" and fila[0] != usuario["pais"]:
            raise HTTPException(status_code=403, detail="No tenés acceso a esta dinámica")

        cursor.execute("DELETE FROM dinamica_detalle WHERE dinamica_id = ?", (dinamica_id,))
        cursor.execute("DELETE FROM dinamicas WHERE id = ?", (dinamica_id,))
        conn.commit()
        registrar_auditoria(usuario, "eliminar", "dinamica", str(dinamica_id), fila[0], "Dinámica eliminada")
        return {"mensaje": "Dinámica eliminada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()



@router.get("/reportes")
def get_reportes(usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT CAST(fecha AS DATE) as dia, COUNT(*) as total
        FROM consultas_log
        WHERE fecha >= DATEADD(DAY, -14, GETDATE())
        GROUP BY CAST(fecha AS DATE)
        ORDER BY dia ASC
    """)
    consultas_por_dia = [
        {"dia": str(r[0]), "total": r[1]}
        for r in cursor.fetchall()
    ]

    cursor.execute("""
        SELECT ubicacion_dinamica, COUNT(*) as total
        FROM dinamica_detalle
        WHERE activo = 1 AND ubicacion_dinamica IS NOT NULL AND ubicacion_dinamica != ''
        GROUP BY ubicacion_dinamica
        ORDER BY total DESC
    """)
    por_ubicacion = [
        {"ubicacion": r[0], "total": r[1]}
        for r in cursor.fetchall()
    ]

    cursor.execute("""
        SELECT TOP 5 u.nombre, r.nombre as rol, COUNT(c.id) as consultas,
               SUM(ISNULL(c.tokens_usados, 0)) as tokens_totales
        FROM consultas_log c
        INNER JOIN usuarios u ON c.usuario_id = u.id
        INNER JOIN cat_roles r ON u.rol_id = r.id
        GROUP BY u.nombre, r.nombre
        ORDER BY consultas DESC
    """)
    top_usuarios = [
        {
            "nombre": r[0],
            "rol": r[1],
            "consultas": r[2],
            "tokens": r[3]
        }
        for r in cursor.fetchall()
    ]

    cursor.execute("SELECT COUNT(*) FROM consultas_log")
    total_consultas = cursor.fetchone()[0]

    cursor.execute("SELECT ISNULL(SUM(tokens_usados), 0) FROM consultas_log")
    total_tokens = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM dinamica_detalle WHERE activo = 1")
    total_articulos = cursor.fetchone()[0]

    conn.close()

    return {
        "consultas_por_dia": consultas_por_dia,
        "por_ubicacion": por_ubicacion,
        "top_usuarios": top_usuarios,
        "totales": {
            "total_consultas": total_consultas,
            "total_tokens": total_tokens,
            "costo_estimado": round(total_tokens * 0.000003, 4),
            "total_articulos": total_articulos,
        }
    }


@router.post("/dinamicas/limpiar-vencidas")
def limpiar_dinamicas_vencidas(usuario=Depends(validar_superadmin)):
    """Desactiva automáticamente dinámicas con fecha de fin anterior a hoy"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE dinamicas 
            SET activa = 0
            WHERE fecha_fin < CAST(GETDATE() AS DATE)
            AND activa = 1
        """)
        afectadas = cursor.rowcount
        conn.commit()
        return {
            "mensaje": f"{afectadas} dinámica(s) desactivadas",
            "afectadas": afectadas
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


@router.get("/auditoria")
def get_auditoria(
    pagina: int = 1,
    por_pagina: int = 30,
    pais: str = None,
    accion: str = None,
    usuario=Depends(validar_superadmin)
):
    """Consulta el registro de auditoría de acciones administrativas. Solo superadmin."""
    if usuario["rol"] != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede ver el registro de auditoría")

    conn = get_connection()
    cursor = conn.cursor()

    filtros = []
    params = []
    if pais:
        filtros.append("pais = ?")
        params.append(pais)
    if accion:
        filtros.append("accion = ?")
        params.append(accion)

    where_clause = f"WHERE {' AND '.join(filtros)}" if filtros else ""

    cursor.execute(f"SELECT COUNT(*) FROM auditoria_log {where_clause}", params)
    total = cursor.fetchone()[0]

    offset = (pagina - 1) * por_pagina
    params_paginados = params + [offset, por_pagina]

    cursor.execute(f"""
        SELECT id, usuario_nombre, accion, entidad, entidad_id, pais, detalle, fecha
        FROM auditoria_log
        {where_clause}
        ORDER BY fecha DESC
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
                "id": f[0],
                "usuario": f[1],
                "accion": f[2],
                "entidad": f[3],
                "entidad_id": f[4],
                "pais": f[5],
                "detalle": f[6],
                "fecha": str(f[7])
            }
            for f in filas
        ]
    }



@router.get("/costos-ia")
def get_costos_ia(
    periodo: str = "30dias",  # 'hoy', '7dias', '30dias', 'todo'
    usuario=Depends(validar_superadmin)
):
    """
    Desglose de consumo y costo estimado de la API de IA por país,
    con detalle por rol. Exclusivo de superadmin.
    """
    if usuario["rol"] != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede ver el consolidado de costos")

    conn = get_connection()
    cursor = conn.cursor()

    filtros_fecha = {
        "hoy": "AND CAST(c.fecha AS DATE) = CAST(GETDATE() AS DATE)",
        "7dias": "AND c.fecha >= DATEADD(DAY, -7, GETDATE())",
        "30dias": "AND c.fecha >= DATEADD(DAY, -30, GETDATE())",
        "todo": "",
    }
    filtro_fecha = filtros_fecha.get(periodo, filtros_fecha["30dias"])

    cursor.execute("SELECT codigo FROM cat_paises WHERE activo = 1 ORDER BY orden ASC")
    paises = [r[0] for r in cursor.fetchall()]
    resultado = {}
    total_general_tokens = 0
    total_general_consultas = 0

    for p in paises:
        cursor.execute(f"""
            SELECT COUNT(*), ISNULL(SUM(c.tokens_usados), 0)
            FROM consultas_log c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            WHERE u.pais = ? {filtro_fecha}
        """, (p,))
        total_consultas, total_tokens = cursor.fetchone()

        cursor.execute(f"""
            SELECT r.nombre, COUNT(*) as consultas, ISNULL(SUM(c.tokens_usados), 0) as tokens
            FROM consultas_log c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            INNER JOIN cat_roles r ON u.rol_id = r.id
            WHERE u.pais = ? {filtro_fecha}
            GROUP BY r.nombre
            ORDER BY tokens DESC
        """, (p,))
        por_rol = [
            {"rol": r[0], "consultas": r[1], "tokens": r[2], "costo_estimado": round(r[2] * 0.000003, 4)}
            for r in cursor.fetchall()
        ]

        resultado[p] = {
            "total_consultas": total_consultas,
            "total_tokens": total_tokens,
            "costo_estimado": round(total_tokens * 0.000003, 4),
            "por_rol": por_rol,
        }
        total_general_tokens += total_tokens
        total_general_consultas += total_consultas

    # Serie temporal — últimos 14 días, para el gráfico de tendencia
    cursor.execute("""
        SELECT u.pais, CAST(c.fecha AS DATE) as dia, ISNULL(SUM(c.tokens_usados), 0) as tokens
        FROM consultas_log c
        INNER JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.fecha >= DATEADD(DAY, -14, GETDATE())
        GROUP BY u.pais, CAST(c.fecha AS DATE)
        ORDER BY dia ASC
    """)
    serie_raw = cursor.fetchall()
    conn.close()

    serie_temporal = [
        {"pais": r[0], "dia": str(r[1]), "tokens": r[2]}
        for r in serie_raw
    ]

    return {
        "periodo": periodo,
        "paises": resultado,
        "totales_generales": {
            "total_consultas": total_general_consultas,
            "total_tokens": total_general_tokens,
            "costo_estimado": round(total_general_tokens * 0.000003, 4),
        },
        "serie_temporal": serie_temporal,
    }