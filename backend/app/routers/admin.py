from app.utils.security import encriptar_password
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_connection
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

    # Total dinámicas activas
    cursor.execute("SELECT COUNT(*) FROM dinamicas WHERE activa = 1")
    dinamicas_activas = cursor.fetchone()[0]

    # Total artículos en campaña
    cursor.execute("SELECT COUNT(*) FROM dinamica_detalle WHERE activo = 1")
    articulos_campana = cursor.fetchone()[0]

    # Total consultas hoy
    cursor.execute("""
        SELECT COUNT(*) FROM consultas_log
        WHERE CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)
    """)
    consultas_hoy = cursor.fetchone()[0]

    # Total usuarios activos
    cursor.execute("SELECT COUNT(*) FROM usuarios WHERE activo = 1")
    usuarios_activos = cursor.fetchone()[0]

    # Consultas por día últimos 7 días
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

    # Artículos por ubicación
    cursor.execute("""
        SELECT ubicacion, COUNT(*) as total
        FROM dinamica_detalle
        WHERE activo = 1 AND ubicacion IS NOT NULL
        GROUP BY ubicacion
        ORDER BY total DESC
    """)
    por_ubicacion = [
        {"ubicacion": r[0], "total": r[1]}
        for r in cursor.fetchall()
    ]

    # Últimas consultas
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

    # Usuarios por rol
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


@router.get("/dinamicas")
def get_dinamicas(usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.id, d.nombre, d.fecha_inicio, d.fecha_fin, 
               d.descripcion, d.activa, d.creado_en,
               COUNT(dd.id) as total_articulos
        FROM dinamicas d
        LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id
        GROUP BY d.id, d.nombre, d.fecha_inicio, d.fecha_fin,
                 d.descripcion, d.activa, d.creado_en
        ORDER BY d.creado_en DESC
    """)
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
            "total_articulos": f[7]
        }
        for f in filas
    ]

@router.post("/dinamicas/crear")
def crear_dinamica(
    nombre: str,
    fecha_inicio: str,
    fecha_fin: str,
    descripcion: str = "",
    usuario=Depends(validar_superadmin)
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO dinamicas (nombre, fecha_inicio, fecha_fin, descripcion, creado_por)
            VALUES (?, ?, ?, ?, ?)
        """, (nombre, fecha_inicio, fecha_fin, descripcion, usuario["id"]))
        conn.commit()

        cursor.execute("SELECT @@IDENTITY")
        nuevo_id = cursor.fetchone()[0]
        return {"mensaje": "Dinámica creada exitosamente", "id": int(nuevo_id)}
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
               u.tiendas, u.pais, u.activo, u.creado_en, u.ultimo_acceso
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
            "ultimo_acceso": str(f[9]) if f[9] else None
        }
        for f in filas
    ]

@router.post("/usuarios/crear")
def crear_usuario(
    nombre: str,
    email: str,
    password: str,
    rol_codigo: str,
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

        # Encriptar contraseña antes de guardar
        password_hash = encriptar_password(password)

        cursor.execute("""
            INSERT INTO usuarios (nombre, email, password, rol_id, pais, tiendas)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (nombre, email, password_hash, rol[0], pais, tiendas))
        conn.commit()
        return {"mensaje": f"Usuario {nombre} creado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error: {str(e)}")
    finally:
        conn.close()

@router.put("/usuarios/{usuario_id}")
def editar_usuario(
    usuario_id: int,
    nombre: str,
    email: str,
    rol_codigo: str,
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
            SET nombre = ?, email = ?, rol_id = ?, pais = ?, tiendas = ?, activo = ?
            WHERE id = ?
        """, (nombre, email, rol[0], pais, tiendas, 1 if activo else 0, usuario_id))
        conn.commit()
        return {"mensaje": "Usuario actualizado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error: {str(e)}")
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
        # Encriptar nueva contraseña
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
        # Verificar que no se elimine a sí mismo
        if str(usuario_id) == str(usuario["id"]):
            raise HTTPException(status_code=400, detail="No podés eliminarte a vos mismo")

        cursor.execute("UPDATE usuarios SET activo = 0 WHERE id = ?", (usuario_id,))
        conn.commit()
        return {"mensaje": "Usuario desactivado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


@router.get("/dinamicas/{dinamica_id}/detalle")
def get_dinamica_detalle(dinamica_id: int, usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, nombre, fecha_inicio, fecha_fin, descripcion, activa, creado_en
        FROM dinamicas WHERE id = ?
    """, (dinamica_id,))
    dinamica = cursor.fetchone()

    if not dinamica:
        raise HTTPException(status_code=404, detail="Dinámica no encontrada")

    cursor.execute("""
        SELECT articulo_codigo, articulo_descripcion, categoria,
               precio_regular, precio_dinamica, ubicacion, tienda, tipo_campana, pais
        FROM dinamica_detalle
        WHERE dinamica_id = ? AND activo = 1
        ORDER BY pais, tienda, articulo_codigo
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
        },
        "articulos": [
            {
                "codigo": a[0],
                "descripcion": a[1],
                "categoria": a[2],
                "precio_regular": float(a[3]) if a[3] else 0,
                "precio_dinamica": float(a[4]) if a[4] else 0,
                "ahorro": round((float(a[3]) if a[3] else 0) - (float(a[4]) if a[4] else 0), 2),
                "ubicacion": a[5],
                "tienda": a[6],
                "tipo_campana": a[7],
                "pais": a[8]
            }
            for a in articulos
        ]
    }

@router.put("/dinamicas/{dinamica_id}/toggle")
def toggle_dinamica(dinamica_id: int, usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT activa FROM dinamicas WHERE id = ?", (dinamica_id,))
        dinamica = cursor.fetchone()
        if not dinamica:
            raise HTTPException(status_code=404, detail="Dinámica no encontrada")

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
        cursor.execute("DELETE FROM dinamica_detalle WHERE dinamica_id = ?", (dinamica_id,))
        cursor.execute("DELETE FROM dinamicas WHERE id = ?", (dinamica_id,))
        conn.commit()
        return {"mensaje": "Dinámica eliminada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.get("/reportes")
def get_reportes(usuario=Depends(validar_superadmin)):
    conn = get_connection()
    cursor = conn.cursor()

    # Consultas por día últimos 14 días
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

    # Artículos por ubicación
    cursor.execute("""
        SELECT ubicacion, COUNT(*) as total
        FROM dinamica_detalle
        WHERE activo = 1 AND ubicacion IS NOT NULL AND ubicacion != ''
        GROUP BY ubicacion
        ORDER BY total DESC
    """)
    por_ubicacion = [
        {"ubicacion": r[0], "total": r[1]}
        for r in cursor.fetchall()
    ]

    # Ahorro por categoría
    cursor.execute("""
        SELECT 
            ISNULL(categoria, 'Sin categoría') as categoria,
            COUNT(*) as articulos,
            AVG(precio_regular - precio_dinamica) as ahorro_promedio,
            SUM(precio_regular - precio_dinamica) as ahorro_total
        FROM dinamica_detalle
        WHERE activo = 1 
        AND precio_regular > 0 
        AND precio_dinamica > 0
        GROUP BY categoria
        ORDER BY ahorro_total DESC
    """)
    ahorro_por_categoria = [
        {
            "categoria": r[0],
            "articulos": r[1],
            "ahorro_promedio": round(float(r[2]) if r[2] else 0, 2),
            "ahorro_total": round(float(r[3]) if r[3] else 0, 2)
        }
        for r in cursor.fetchall()
    ]

    # Top usuarios activos
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

    # Totales generales
    cursor.execute("SELECT COUNT(*) FROM consultas_log")
    total_consultas = cursor.fetchone()[0]

    cursor.execute("SELECT ISNULL(SUM(tokens_usados), 0) FROM consultas_log")
    total_tokens = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*), 
               ISNULL(SUM(precio_regular - precio_dinamica), 0)
        FROM dinamica_detalle 
        WHERE activo = 1 AND precio_regular > 0
    """)
    row = cursor.fetchone()
    total_articulos = row[0]
    ahorro_total = round(float(row[1]) if row[1] else 0, 2)

    conn.close()

    return {
        "consultas_por_dia": consultas_por_dia,
        "por_ubicacion": por_ubicacion,
        "ahorro_por_categoria": ahorro_por_categoria,
        "top_usuarios": top_usuarios,
        "totales": {
            "total_consultas": total_consultas,
            "total_tokens": total_tokens,
            "costo_estimado": round(total_tokens * 0.000003, 4),
            "total_articulos": total_articulos,
            "ahorro_total": ahorro_total
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