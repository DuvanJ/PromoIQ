# ============================================================
# Router: asistente.py
# Descripción: Asistente IA personalizado por usuario
# Roles: comercial y planning principalmente
# ============================================================

from fastapi import APIRouter, HTTPException, Depends
from app.database import get_connection
from app.auth import verificar_token
from app.models import ArticuloQuery
from anthropic import Anthropic
from dotenv import load_dotenv
import os
import json

load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

router = APIRouter(prefix="/asistente", tags=["Asistente Personalizado"])

# ── Obtener o crear perfil IA del usuario ─────────────────
def obtener_perfil_usuario(usuario_id: int, conn) -> dict:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT articulos_favoritos, categorias_interes, 
               resumen_actividad, total_conversaciones
        FROM usuario_perfil_ia WHERE usuario_id = ?
    """, (usuario_id,))
    perfil = cursor.fetchone()

    if not perfil:
        cursor.execute("""
            INSERT INTO usuario_perfil_ia (usuario_id) VALUES (?)
        """, (usuario_id,))
        conn.commit()
        return {
            "articulos_favoritos": [],
            "categorias_interes": [],
            "resumen_actividad": None,
            "total_conversaciones": 0
        }

    return {
        "articulos_favoritos": json.loads(perfil[0]) if perfil[0] else [],
        "categorias_interes": json.loads(perfil[1]) if perfil[1] else [],
        "resumen_actividad": perfil[2],
        "total_conversaciones": perfil[3] or 0
    }

# ── Obtener contexto de dinámicas por país ────────────────
def obtener_contexto_dinamicas(pais: str, conn) -> str:
    """
    Obtiene contexto completo para la IA:
    - Artículos en dinámica activa
    - Historial de dinámicas últimos 3 meses
    - Información del catálogo
    - Ventas del mes más reciente
    """
    cursor = conn.cursor()
    contexto = ""

    # ── 1. Dinámicas activas ──────────────────────────────
    if pais:
        cursor.execute("""
            SELECT TOP 50 dd.articulo_codigo, dd.articulo_descripcion,
                   dd.ubicacion, dd.tipo_campana, d.nombre as dinamica,
                   d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1 AND dd.pais = ?
            ORDER BY dd.ubicacion, dd.articulo_codigo
        """, (pais,))
    else:
        cursor.execute("""
            SELECT TOP 50 dd.articulo_codigo, dd.articulo_descripcion,
                   dd.ubicacion, dd.tipo_campana, d.nombre as dinamica,
                   d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
            ORDER BY dd.ubicacion, dd.articulo_codigo
        """)
    articulos_din = cursor.fetchall()

    # ── 2. Historial de dinámicas (últimos 3 meses) ───────
    if pais:
        cursor.execute("""
            SELECT TOP 100 dd.articulo_codigo, dd.articulo_descripcion,
                   dd.ubicacion, dd.tipo_campana, d.nombre as dinamica,
                   d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 0 AND dd.pais = ?
            AND d.fecha_fin >= DATEADD(MONTH, -3, GETDATE())
            ORDER BY d.fecha_fin DESC, dd.articulo_codigo
        """, (pais,))
    else:
        cursor.execute("""
            SELECT TOP 100 dd.articulo_codigo, dd.articulo_descripcion,
                   dd.ubicacion, dd.tipo_campana, d.nombre as dinamica,
                   d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 0
            AND d.fecha_fin >= DATEADD(MONTH, -3, GETDATE())
            ORDER BY d.fecha_fin DESC, dd.articulo_codigo
        """)
    articulos_historicos = cursor.fetchall()

    # ── Combinar ambas listas ─────────────────────────────
    todos_articulos = list(articulos_din) + list(articulos_historicos)

    # ── Construir contexto de dinámicas ───────────────────
    if articulos_din:
        contexto += "=== ARTÍCULOS EN DINÁMICA ACTIVA ===\n"
        for a in articulos_din:
            contexto += (
                f"SKU: {a[0]} | {a[1]} | "
                f"Ubicación: {a[2]} | Campaña: {a[3]} | "
                f"Dinámica: {a[4]} ({a[5]} al {a[6]})\n"
            )
        contexto += "\n"
    else:
        contexto += "No hay artículos en dinámica activa actualmente.\n\n"

    if articulos_historicos:
        contexto += "=== HISTORIAL DE DINÁMICAS (últimos 3 meses) ===\n"
        for a in articulos_historicos:
            contexto += (
                f"SKU: {a[0]} | {a[1]} | "
                f"Ubicación: {a[2]} | Campaña: {a[3]} | "
                f"Dinámica: {a[4]} ({a[5]} al {a[6]}) — FINALIZADA\n"
            )
        contexto += "\n"

    # ── 3. Catálogo — info extra de SKUs en dinámica ──────
    if todos_articulos:
        skus_dinamica = "','".join([str(a[0]) for a in todos_articulos[:100]])
        cursor.execute(f"""
            SELECT sku, descripcion, categoria, linea, familia,
                   departamento, marca, estado, precio_unitario
            FROM articulos_maestro
            WHERE sku IN ('{skus_dinamica}')
            {'AND pais = ?' if pais else ''}
        """, (pais,) if pais else ())

        catalogo = cursor.fetchall()
        if catalogo:
            contexto += "=== INFORMACIÓN DEL CATÁLOGO PARA SKUs EN DINÁMICA ===\n"
            for c in catalogo:
                contexto += (
                    f"SKU: {c[0]} | {c[1]} | "
                    f"Categoría: {c[2]} | Línea: {c[3]} | "
                    f"Familia: {c[4]} | Departamento: {c[5]} | "
                    f"Marca: {c[6]} | Estado: {c[7]} | "
                    f"Precio: ${c[8]}\n"
                )
            contexto += "\n"

    # ── 4. Ventas del mes más reciente ────────────────────
    if pais:
        cursor.execute("""
            SELECT TOP 1 mes, anio FROM ventas_mes
            WHERE pais = ?
            ORDER BY anio DESC, mes DESC
        """, (pais,))
    else:
        cursor.execute("""
            SELECT TOP 1 mes, anio FROM ventas_mes
            ORDER BY anio DESC, mes DESC
        """)

    ultimo_mes = cursor.fetchone()

    if ultimo_mes:
        mes, anio = ultimo_mes[0], ultimo_mes[1]
        meses_nombres = {
            1:'Enero', 2:'Febrero', 3:'Marzo', 4:'Abril',
            5:'Mayo', 6:'Junio', 7:'Julio', 8:'Agosto',
            9:'Septiembre', 10:'Octubre', 11:'Noviembre', 12:'Diciembre'
        }
        nombre_mes = meses_nombres.get(mes, str(mes))

        if pais:
            cursor.execute("""
                SELECT TOP 50 sku, descripcion,
                       venta_vidri_express, venta_mostrador,
                       venta_externo, venta_ecommerce, venta_total
                FROM ventas_mes
                WHERE mes = ? AND anio = ? AND pais = ?
                ORDER BY venta_total DESC
            """, (mes, anio, pais))
        else:
            cursor.execute("""
                SELECT TOP 50 sku, descripcion,
                       venta_vidri_express, venta_mostrador,
                       venta_externo, venta_ecommerce, venta_total
                FROM ventas_mes
                WHERE mes = ? AND anio = ?
                ORDER BY venta_total DESC
            """, (mes, anio))

        ventas = cursor.fetchall()

        if ventas:
            contexto += f"=== VENTAS DE {nombre_mes.upper()} {anio} (TOP 50) ===\n"
            for v in ventas:
                contexto += (
                    f"SKU: {v[0]} | {v[1]} | "
                    f"Vidri Express: {v[2]} | Mostrador: {v[3]} | "
                    f"Externo: {v[4]} | E-Commerce: {v[5]} | "
                    f"Total: {v[6]} uds\n"
                )
            contexto += "\n"

        # ── Cruce: ventas de artículos en dinámica ────────
        if todos_articulos:
            skus_str2 = "','".join([str(a[0]) for a in todos_articulos[:100]])
            if pais:
                cursor.execute(f"""
                    SELECT v.sku, v.descripcion, v.venta_total,
                           dd.ubicacion, dd.tipo_campana, d.nombre
                    FROM ventas_mes v
                    INNER JOIN dinamica_detalle dd ON v.sku = dd.articulo_codigo
                    INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                    WHERE v.mes = ? AND v.anio = ? AND v.pais = ?
                    AND v.sku IN ('{skus_str2}')
                    ORDER BY v.venta_total DESC
                """, (mes, anio, pais))
            else:
                cursor.execute(f"""
                    SELECT v.sku, v.descripcion, v.venta_total,
                           dd.ubicacion, dd.tipo_campana, d.nombre
                    FROM ventas_mes v
                    INNER JOIN dinamica_detalle dd ON v.sku = dd.articulo_codigo
                    INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                    WHERE v.mes = ? AND v.anio = ?
                    AND v.sku IN ('{skus_str2}')
                    ORDER BY v.venta_total DESC
                """, (mes, anio))

            cruzados = cursor.fetchall()
            if cruzados:
                contexto += f"=== VENTAS DE ARTÍCULOS EN DINÁMICA ({nombre_mes} {anio}) ===\n"
                for c in cruzados:
                    contexto += (
                        f"SKU: {c[0]} | {c[1]} | "
                        f"Total vendido: {c[2]} uds | "
                        f"Ubicación: {c[3]} | Campaña: {c[4]} | "
                        f"Dinámica: {c[5]}\n"
                    )
                contexto += "\n"

    return contexto if contexto else "No hay información disponible en el sistema."


# ── Construir system prompt personalizado ─────────────────
def construir_system_prompt(usuario: dict, perfil: dict, rol: str) -> str:
    nombre = usuario["nombre"]
    pais_label = {"CR": "Costa Rica", "GT": "Guatemala", "SV": "El Salvador"}.get(usuario["pais"], "")

    base = f"""Eres el asistente IA personalizado de PromoIQ para {nombre}, del equipo de {rol.capitalize()} de VIDRI/NOVEX {pais_label}.

CONTEXTO DEL USUARIO:
- Nombre: {nombre}
- Rol: {rol.capitalize()}
- País: {pais_label}
- Total de conversaciones previas: {perfil['total_conversaciones']}
"""

    if perfil["resumen_actividad"]:
        base += f"\nRESUMEN DE ACTIVIDAD PREVIA:\n{perfil['resumen_actividad']}\n"

    if perfil["articulos_favoritos"]:
        base += f"\nARTÍCULOS MÁS CONSULTADOS: {', '.join(perfil['articulos_favoritos'][:5])}\n"

    if perfil["categorias_interes"]:
        base += f"\nCATEGORÍAS DE INTERÉS: {', '.join(perfil['categorias_interes'][:5])}\n"

    if rol == "comercial":
        base += """
INSTRUCCIONES PARA COMERCIAL:
- Ayudá a analizar el rendimiento de dinámicas, artículos y ventas del mes
- Cruzá la información de ventas con las dinámicas para identificar el impacto de las campañas
- Sugerí estrategias para mejorar campañas basándote en datos reales
- Identificá oportunidades comerciales según historial de ventas
- Si el usuario pregunta algo que ya consultó antes, recordáselo
- Siempre respondé en español, de forma clara y estratégica
- Nunca inventes datos — solo usá la información disponible
"""
    elif rol == "planning":
        base += """
INSTRUCCIONES PARA PLANNING:
- Ayudá con la trazabilidad completa de dinámicas, códigos y ventas
- Cruzá ventas con ubicaciones de dinámica para análisis de efectividad
- Alertá sobre inconsistencias, duplicados o datos faltantes
- Hacé seguimiento de artículos específicos entre sesiones
- Proporcioná análisis detallados de cobertura por tienda y departamento
- Siempre respondé en español, con enfoque en control y trazabilidad
- Nunca inventes datos — solo usá la información disponible
"""
    else:
        base += """
INSTRUCCIONES GENERALES:
- Respondé siempre en español, de forma clara y organizada
- Nunca inventes información — solo usá los datos disponibles
- Sé proactivo sugiriendo información relevante según el contexto
"""

    return base

# ── ENDPOINTS ─────────────────────────────────────────────

@router.get("/conversaciones")
def listar_conversaciones(usuario=Depends(verificar_token)):
    """Retorna todas las conversaciones del usuario"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.titulo, c.creado_en, c.ultimo_mensaje,
               COUNT(cm.id) as total_mensajes
        FROM conversaciones c
        LEFT JOIN conversacion_mensajes cm ON c.id = cm.conversacion_id
        WHERE c.usuario_id = ? AND c.activa = 1
        GROUP BY c.id, c.titulo, c.creado_en, c.ultimo_mensaje
        ORDER BY c.ultimo_mensaje DESC
    """, (usuario["id"],))

    conversaciones = cursor.fetchall()
    perfil = obtener_perfil_usuario(int(usuario["id"]), conn)
    conn.close()

    return {
        "conversaciones": [
            {
                "id": c[0],
                "titulo": c[1] or "Nueva conversación",
                "creado_en": str(c[2]),
                "ultimo_mensaje": str(c[3]),
                "total_mensajes": c[4]
            }
            for c in conversaciones
        ],
        "perfil": perfil
    }

@router.get("/conversaciones/{conv_id}/mensajes")
def obtener_mensajes(conv_id: int, usuario=Depends(verificar_token)):
    """Retorna todos los mensajes de una conversación"""
    conn = get_connection()
    cursor = conn.cursor()

    # Verificar que la conversación pertenece al usuario
    cursor.execute("""
        SELECT id FROM conversaciones
        WHERE id = ? AND usuario_id = ?
    """, (conv_id, usuario["id"]))

    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    cursor.execute("""
        SELECT id, rol, contenido, tokens_usados, fecha
        FROM conversacion_mensajes
        WHERE conversacion_id = ?
        ORDER BY fecha ASC
    """, (conv_id,))

    mensajes = cursor.fetchall()
    conn.close()

    return [
        {
            "id": m[0],
            "rol": m[1],
            "contenido": m[2],
            "tokens": m[3] or 0,
            "fecha": str(m[4])
        }
        for m in mensajes
    ]

@router.post("/conversaciones/nueva")
def nueva_conversacion(usuario=Depends(verificar_token)):
    """Crea una nueva conversación"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO conversaciones (usuario_id, titulo)
        VALUES (?, 'Nueva conversación')
    """, (usuario["id"],))
    conn.commit()

    cursor.execute("SELECT @@IDENTITY")
    nuevo_id = int(cursor.fetchone()[0])
    conn.close()

    return {"id": nuevo_id, "titulo": "Nueva conversación"}

@router.post("/conversaciones/{conv_id}/mensaje")
def enviar_mensaje(conv_id: int, query: ArticuloQuery, usuario=Depends(verificar_token)):
    """
    Envía un mensaje y obtiene respuesta personalizada de la IA.
    Guarda el historial y actualiza el perfil del usuario.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Verificar conversación
    cursor.execute("""
        SELECT id, titulo FROM conversaciones
        WHERE id = ? AND usuario_id = ?
    """, (conv_id, usuario["id"]))
    conv = cursor.fetchone()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    # Obtener perfil personalizado
    perfil = obtener_perfil_usuario(int(usuario["id"]), conn)

    # Obtener contexto de dinámicas
    contexto_dinamicas = obtener_contexto_dinamicas(usuario["pais"], conn)

    # Obtener historial de la conversación actual (últimos 10 mensajes)
    cursor.execute("""
        SELECT TOP 10 rol, contenido FROM conversacion_mensajes
        WHERE conversacion_id = ?
        ORDER BY fecha DESC
    """, (conv_id,))
    historial_raw = cursor.fetchall()
    historial = list(reversed(historial_raw))

    # Construir mensajes para Claude
    system_prompt = construir_system_prompt(usuario, perfil, usuario["rol"])

    messages = []

    # Agregar contexto de dinámicas al primer mensaje
    if not historial:
        messages.append({
            "role": "user",
            "content": f"Contexto actual del sistema:\n{contexto_dinamicas}\n\nPregunta: {query.pregunta}"
        })
    else:
        # Agregar historial de conversación
        for msg in historial:
            messages.append({
                "role": "user" if msg[0] == "usuario" else "assistant",
                "content": msg[1]
            })
        messages.append({
            "role": "user",
            "content": f"Contexto actualizado:\n{contexto_dinamicas}\n\nPregunta: {query.pregunta}"
        })

    # Llamar a Claude
    respuesta = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=system_prompt,
        messages=messages
    )

    texto_respuesta = respuesta.content[0].text
    tokens_usados = respuesta.usage.input_tokens + respuesta.usage.output_tokens

    # Guardar mensaje del usuario
    cursor.execute("""
        INSERT INTO conversacion_mensajes (conversacion_id, rol, contenido)
        VALUES (?, 'usuario', ?)
    """, (conv_id, query.pregunta))

    # Guardar respuesta de la IA
    cursor.execute("""
        INSERT INTO conversacion_mensajes (conversacion_id, rol, contenido, tokens_usados)
        VALUES (?, 'ia', ?, ?)
    """, (conv_id, texto_respuesta, tokens_usados))

    # Actualizar título si es el primer mensaje
    if conv[1] == "Nueva conversación":
        titulo = query.pregunta[:60] + "..." if len(query.pregunta) > 60 else query.pregunta
        cursor.execute("""
            UPDATE conversaciones SET titulo = ?, ultimo_mensaje = GETDATE()
            WHERE id = ?
        """, (titulo, conv_id))
    else:
        cursor.execute("""
            UPDATE conversaciones SET ultimo_mensaje = GETDATE() WHERE id = ?
        """, (conv_id,))

    # Guardar en consultas_log
    try:
        cursor.execute("""
            INSERT INTO consultas_log (usuario_id, pregunta, respuesta, tokens_usados)
            VALUES (?, ?, ?, ?)
        """, (usuario["id"], query.pregunta, texto_respuesta, tokens_usados))
    except:
        pass

    # Actualizar perfil del usuario
    try:
        # Extraer códigos mencionados en la pregunta
        cursor.execute("""
            SELECT articulo_codigo FROM dinamica_detalle
            WHERE activo = 1
        """)
        todos_codigos = [r[0] for r in cursor.fetchall()]

        codigos_mencionados = [c for c in todos_codigos if c in query.pregunta]

        if codigos_mencionados:
            favs_actuales = perfil["articulos_favoritos"]
            for codigo in codigos_mencionados:
                if codigo not in favs_actuales:
                    favs_actuales.append(codigo)
            favs_actuales = favs_actuales[:10]

            cursor.execute("""
                UPDATE usuario_perfil_ia
                SET articulos_favoritos = ?,
                    total_conversaciones = total_conversaciones + 1,
                    ultima_actualizacion = GETDATE()
                WHERE usuario_id = ?
            """, (json.dumps(favs_actuales), usuario["id"]))
        else:
            cursor.execute("""
                UPDATE usuario_perfil_ia
                SET total_conversaciones = total_conversaciones + 1,
                    ultima_actualizacion = GETDATE()
                WHERE usuario_id = ?
            """, (usuario["id"],))
    except Exception as e:
        print(f"Error actualizando perfil: {e}")

    conn.commit()
    conn.close()

    return {
        "respuesta": texto_respuesta,
        "tokens_usados": tokens_usados,
        "conversacion_id": conv_id
    }

@router.delete("/conversaciones/{conv_id}")
def eliminar_conversacion(conv_id: int, usuario=Depends(verificar_token)):
    """Elimina (desactiva) una conversación"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE conversaciones SET activa = 0
            WHERE id = ? AND usuario_id = ?
        """, (conv_id, usuario["id"]))
        conn.commit()
        return {"mensaje": "Conversación eliminada"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.get("/perfil")
def obtener_perfil(usuario=Depends(verificar_token)):
    """Retorna el perfil IA del usuario"""
    conn = get_connection()
    perfil = obtener_perfil_usuario(int(usuario["id"]), conn)
    conn.close()
    return perfil


# ── Modelo para guardar email ─────────────────────────────
from pydantic import BaseModel

class EmailRequest(BaseModel):
    email: str

# ── Guardar email corporativo ─────────────────────────────
@router.post("/perfil/email")
def guardar_email(request: EmailRequest, usuario=Depends(verificar_token)):
    """
    Guarda el email corporativo del usuario.
    Extrae nombre completo y país del dominio.
    """
    conn = get_connection()
    cursor = conn.cursor()

    email = request.email.strip().lower()

    # Extraer nombre y apellido del email
    # Formato: nombre.apellido@empresa.com.cr
    try:
        parte_local = email.split('@')[0]
        dominio = email.split('@')[1]
        partes_nombre = parte_local.split('.')
        nombre_extraido = partes_nombre[0].capitalize() if len(partes_nombre) > 0 else ""
        apellido_extraido = partes_nombre[1].capitalize() if len(partes_nombre) > 1 else ""
        nombre_completo = f"{nombre_extraido} {apellido_extraido}".strip()

        # Detectar país por dominio
        pais_email = ""
        if dominio.endswith('.cr'):
            pais_email = "CR"
        elif dominio.endswith('.gt'):
            pais_email = "GT"
        elif dominio.endswith('.sv'):
            pais_email = "SV"

    except:
        nombre_completo = ""
        pais_email = ""

    try:
        # Verificar si ya tiene perfil
        cursor.execute("""
            SELECT id FROM usuario_perfil_ia WHERE usuario_id = ?
        """, (usuario["id"],))

        if cursor.fetchone():
            cursor.execute("""
                UPDATE usuario_perfil_ia
                SET email_notificaciones = ?,
                    email_confirmado = 1,
                    solicitar_email = 0,
                    ultima_actualizacion = GETDATE()
                WHERE usuario_id = ?
            """, (email, usuario["id"]))
        else:
            cursor.execute("""
                INSERT INTO usuario_perfil_ia
                (usuario_id, email_notificaciones, email_confirmado, solicitar_email)
                VALUES (?, ?, 1, 0)
            """, (usuario["id"], email))

        conn.commit()
        return {
            "mensaje": "Email guardado correctamente",
            "nombre_extraido": nombre_completo,
            "pais_detectado": pais_email,
            "email": email
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.post("/perfil/omitir-email")
def omitir_email(usuario=Depends(verificar_token)):
    """El usuario decide no agregar email por ahora"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id FROM usuario_perfil_ia WHERE usuario_id = ?
        """, (usuario["id"],))

        if cursor.fetchone():
            cursor.execute("""
                UPDATE usuario_perfil_ia
                SET solicitar_email = 0
                WHERE usuario_id = ?
            """, (usuario["id"],))
        else:
            cursor.execute("""
                INSERT INTO usuario_perfil_ia (usuario_id, solicitar_email)
                VALUES (?, 0)
            """, (usuario["id"],))

        conn.commit()
        return {"mensaje": "Preferencia guardada"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()

@router.get("/perfil/completo")
def obtener_perfil_completo(usuario=Depends(verificar_token)):
    """Retorna el perfil completo incluyendo email y preferencias"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT articulos_favoritos, categorias_interes,
               resumen_actividad, total_conversaciones,
               email_notificaciones, email_confirmado, solicitar_email
        FROM usuario_perfil_ia WHERE usuario_id = ?
    """, (usuario["id"],))

    perfil = cursor.fetchone()
    conn.close()

    if not perfil:
        return {
            "articulos_favoritos": [],
            "categorias_interes": [],
            "resumen_actividad": None,
            "total_conversaciones": 0,
            "email_notificaciones": None,
            "email_confirmado": False,
            "solicitar_email": True,
            "nombre_completo": None
        }

    # Extraer nombre del email si existe
    nombre_completo = None
    if perfil[4]:
        try:
            parte_local = perfil[4].split('@')[0]
            partes = parte_local.split('.')
            nombre_completo = ' '.join(p.capitalize() for p in partes)
        except:
            pass

    return {
        "articulos_favoritos": json.loads(perfil[0]) if perfil[0] else [],
        "categorias_interes": json.loads(perfil[1]) if perfil[1] else [],
        "resumen_actividad": perfil[2],
        "total_conversaciones": perfil[3] or 0,
        "email_notificaciones": perfil[4],
        "email_confirmado": bool(perfil[5]),
        "solicitar_email": bool(perfil[6]) if perfil[6] is not None else True,
        "nombre_completo": nombre_completo
    }