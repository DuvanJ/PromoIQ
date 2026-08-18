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
from app.routers.notificaciones import enviar_email, template_base

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

FORMATO DE RESPUESTA:
- Usá texto plano con emojis para separar secciones
- NUNCA uses tablas markdown (|---|---|) — son difíciles de leer
- Presentá la información como listas con viñetas (•) o numeradas
- Ejemplo de formato para un artículo:
  📦 SKU 465278 — Alfombra Bonjour Negro
  • Marca: LUANCE | Departamento: Outdoors
  • Precio: ₡4,250 | Estado: Vigente
  
  🏪 Inventario por sucursal:
  • Curridabat → Bodega: 0 | Tienda: 4 uds | Consumo: 1.4/mes
  • Escazú → Bodega: 0 | Tienda: 4 uds | Consumo: 1.2/mes
  
  📊 Ventas Abril 2026:
  • Mostrador: 1 ud | E-Commerce: 1 ud | Total: 2 uds

INTERPRETACIÓN DE DATOS DEL CATÁLOGO:
- "Existencia Bodega" = Stock en el Centro de Distribución (bodega central)
- "Disponible" = Unidades físicas actuales en la tienda/sucursal
- "Exclusivo" = 1 significa que el artículo SÍ se vende en esa tienda
             = 0 significa que NO está habilitado para venta en esa tienda
               y por lo tanto no debería tener existencias
- "Consumo Mensual" = Promedio de unidades vendidas por mes en esa sucursal
- Si Exclusivo=0 y hay existencias → es una inconsistencia a reportar
- Si Bodega=0 y Disponible>0 → el stock está en tienda, no en bodega central
- Si Bodega>0 y Disponible=0 → hay stock para reponer en tiendas

ANÁLISIS ESTRATÉGICO:
- Cuando hay Exclusivo=0 con existencias, alertá sobre la inconsistencia
- Cuando el Consumo Mensual es alto pero Disponible es bajo, alertá sobre riesgo de quiebre
- Cuando un artículo estuvo en dinámica y vendió bien, sugerí reactivarlo
- Compará las ventas del mes con el consumo promedio para detectar impacto de dinámicas
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

FORMATO DE RESPUESTA:
- Usá texto plano con emojis para separar secciones
- NUNCA uses tablas markdown (|---|---|) — son difíciles de leer
- Presentá la información como listas con viñetas (•) o numeradas
- Sé preciso y detallado en trazabilidad

INTERPRETACIÓN DE DATOS DEL CATÁLOGO:
- "Existencia Bodega" = Stock en el Centro de Distribución (bodega central)
- "Disponible" = Unidades físicas actuales en la tienda/sucursal
- "Exclusivo" = 1 significa que el artículo SÍ se vende en esa tienda
             = 0 significa que NO está habilitado para venta en esa tienda
               y por lo tanto no debería tener existencias
- "Consumo Mensual" = Promedio de unidades vendidas por mes en esa sucursal
- Si Exclusivo=0 y hay existencias → es una inconsistencia crítica a reportar
- Si Bodega=0 y Disponible=0 → posible quiebre de stock
- Alertá siempre sobre inconsistencias entre Exclusivo y existencias
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

import re

def buscar_skus_mencionados(pregunta: str, pais: str, conn) -> str:
    """
    Detecta SKUs mencionados en la pregunta y busca su info completa.
    También busca por palabras clave en descripción.
    """
    cursor = conn.cursor()
    contexto_extra = ""

    # Extraer posibles SKUs (números de 4-8 dígitos)
    posibles_skus = re.findall(r'\b\d{4,8}\b', pregunta)

    # Palabras clave para búsqueda por descripción
    palabras = [p for p in pregunta.split() if len(p) > 4 and not p.isdigit()]

    if posibles_skus:
        skus_str = "','".join(posibles_skus)

        # Buscar en catálogo maestro
        query_cat = f"""
            SELECT TOP 10 sku, descripcion, categoria, linea, familia,
                   departamento, marca, estado, precio_unitario,
                   unidad_medida, existencia_bodega, disponible
            FROM articulos_maestro
            WHERE sku IN ('{skus_str}')
            {'AND pais = ?' if pais else ''}
        """
        cursor.execute(query_cat, (pais,) if pais else ())
        articulos = cursor.fetchall()

        if articulos:
            contexto_extra += "\n=== ARTÍCULOS ENCONTRADOS POR SKU ===\n"
            for a in articulos:
                contexto_extra += (
                    f"SKU: {a[0]} | {a[1]} | "
                    f"Categoría: {a[2]} | Línea: {a[3]} | "
                    f"Familia: {a[4]} | Departamento: {a[5]} | "
                    f"Marca: {a[6]} | Estado: {a[7]} | "
                    f"Precio: ${a[8]} | Unidad: {a[9]} | "
                    f"Existencia: {a[10]} | Disponible: {a[11]}\n"
                )

        # Buscar sucursales para cada SKU mencionado
        for sku in posibles_skus:
            query_suc = f"""
                SELECT codigo_sucursal, sucursal, existencia, disponible, consumo_mensual
                FROM articulos_sucursales
                WHERE sku = ?
                {'AND pais = ?' if pais else ''}
                ORDER BY sucursal
            """
            cursor.execute(query_suc, (sku, pais) if pais else (sku,))
            sucursales = cursor.fetchall()
            if sucursales:
                contexto_extra += f"\nSucursales para SKU {sku}:\n"
                for s in sucursales:
                    contexto_extra += (
                        f"  {s[0]} - {s[1]} | "
                        f"Existencia: {s[2]} | Disponible: {s[3]} | "
                        f"Consumo mensual: {s[4]}\n"
                    )

        # Buscar ventas históricas del SKU
        for sku in posibles_skus:
            cursor.execute("""
                SELECT mes, anio, venta_vidri_express, venta_mostrador,
                       venta_externo, venta_ecommerce, venta_total
                FROM ventas_mes
                WHERE sku = ?
                ORDER BY anio DESC, mes DESC
            """, (sku,))
            ventas_sku = cursor.fetchall()
            if ventas_sku:
                meses_nombres = {
                    1:'Enero', 2:'Febrero', 3:'Marzo', 4:'Abril',
                    5:'Mayo', 6:'Junio', 7:'Julio', 8:'Agosto',
                    9:'Septiembre', 10:'Octubre', 11:'Noviembre', 12:'Diciembre'
                }
                contexto_extra += f"\nHistorial de ventas para SKU {sku}:\n"
                for v in ventas_sku:
                    contexto_extra += (
                        f"  {meses_nombres.get(v[0], v[0])} {v[1]} | "
                        f"Vidri Express: {v[2]} | Mostrador: {v[3]} | "
                        f"Externo: {v[4]} | E-Commerce: {v[5]} | "
                        f"Total: {v[6]} uds\n"
                    )

        # Verificar si estuvo en dinámica
        for sku in posibles_skus:
            cursor.execute("""
                SELECT d.nombre, dd.ubicacion, dd.tipo_campana,
                       d.fecha_inicio, d.fecha_fin, d.activa
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                WHERE dd.articulo_codigo = ?
                ORDER BY d.fecha_fin DESC
            """, (sku,))
            dinamicas_sku = cursor.fetchall()
            if dinamicas_sku:
                contexto_extra += f"\nDinámicas para SKU {sku}:\n"
                for d in dinamicas_sku:
                    estado = "ACTIVA" if d[5] else "FINALIZADA"
                    contexto_extra += (
                        f"  {d[0]} | Ubicación: {d[1]} | "
                        f"Campaña: {d[2]} | {d[3]} al {d[4]} | {estado}\n"
                    )

    # Búsqueda por palabras clave si no hay SKUs
    elif palabras:
        termino = '%' + '%'.join(palabras[:2]) + '%'
        query_desc = f"""
            SELECT TOP 10 sku, descripcion, categoria, departamento,
                   marca, precio_unitario, existencia_bodega, disponible
            FROM articulos_maestro
            WHERE descripcion LIKE ?
            {'AND pais = ?' if pais else ''}
            ORDER BY sku
        """
        cursor.execute(query_desc, (termino, pais) if pais else (termino,))
        articulos = cursor.fetchall()
        if articulos:
            contexto_extra += "\n=== ARTÍCULOS ENCONTRADOS POR DESCRIPCIÓN ===\n"
            for a in articulos:
                contexto_extra += (
                    f"SKU: {a[0]} | {a[1]} | "
                    f"Categoría: {a[2]} | Departamento: {a[3]} | "
                    f"Marca: {a[4]} | Precio: ${a[5]} | "
                    f"Existencia: {a[6]} | Disponible: {a[7]}\n"
                )

    return contexto_extra


@router.post("/conversaciones/{conv_id}/mensaje")
def enviar_mensaje(conv_id: int, query: ArticuloQuery, usuario=Depends(verificar_token)):
    """
    Envía un mensaje y obtiene respuesta personalizada de la IA.
    Incluye búsqueda dinámica por SKU en el catálogo completo.
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

    # Obtener contexto de dinámicas + búsqueda dinámica por SKU
    contexto_dinamicas = obtener_contexto_dinamicas(usuario["pais"], conn)
    contexto_skus = buscar_skus_mencionados(query.pregunta, usuario["pais"], conn)
    contexto_completo = contexto_dinamicas + contexto_skus

    # Obtener historial de la conversación actual (últimos 10 mensajes)
    cursor.execute("""
        SELECT TOP 10 rol, contenido FROM conversacion_mensajes
        WHERE conversacion_id = ?
        ORDER BY fecha DESC
    """, (conv_id,))
    historial_raw = cursor.fetchall()
    historial = list(reversed(historial_raw))

    # Construir system prompt personalizado
    system_prompt = construir_system_prompt(usuario, perfil, usuario["rol"])

    messages = []

    if not historial:
        messages.append({
            "role": "user",
            "content": f"Contexto actual del sistema:\n{contexto_completo}\n\nPregunta: {query.pregunta}"
        })
    else:
        for msg in historial:
            messages.append({
                "role": "user" if msg[0] == "usuario" else "assistant",
                "content": msg[1]
            })
        messages.append({
            "role": "user",
            "content": f"Contexto actualizado:\n{contexto_completo}\n\nPregunta: {query.pregunta}"
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

    # Actualizar perfil — registrar SKUs consultados
    try:
        import re as re2
        skus_mencionados = re2.findall(r'\b\d{4,8}\b', query.pregunta)

        if skus_mencionados:
            favs_actuales = perfil["articulos_favoritos"]
            for sku in skus_mencionados:
                if sku not in favs_actuales:
                    favs_actuales.append(sku)
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



def template_bienvenida_email(nombre: str, rol: str) -> str:
    rol_label = {"comercial": "Comercial", "planning": "Planning"}.get(rol, rol.capitalize())

    contenido = f"""
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hola <strong>{nombre}</strong>, tu email corporativo quedó configurado
        correctamente en PromoIQ.
    </p>

    <div style="padding:16px;background:#F0FDF4;border-radius:10px;border-left:4px solid #06847A;margin-bottom:20px;">
        <p style="color:#06847A;font-size:13px;margin:0;font-weight:600;">
            ✅ A partir de ahora vas a recibir notificaciones sobre dinámicas
            comerciales próximas a vencer y otras alertas relevantes para tu rol de {rol_label}.
        </p>
    </div>

    <p style="color:#555;font-size:14px;line-height:1.6;margin:0;">
        Podés cambiar tu email o tus preferencias de notificación en cualquier
        momento desde la configuración de tu asistente en PromoIQ.
    </p>
    """

    return template_base("✉️ Email confirmado en PromoIQ", contenido, "#1E2761")

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

        # Enviar correo de confirmación — no debe romper la respuesta si falla
        nombre_para_email = nombre_completo or usuario["nombre"]
        try:
            html = template_bienvenida_email(nombre_para_email, usuario["rol"])
            enviar_email(email, "✉️ PromoIQ — Email confirmado correctamente", html)
        except Exception as e:
            print(f"⚠️ Error enviando email de confirmación: {e}")

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


# ── Modelo para personalización ───────────────────────────
class PersonalizacionRequest(BaseModel):
    nombre_asistente: str = "PromoIQ IA"
    nivel_detalle: str = "detallado"

# ── Guardar personalización ───────────────────────────────
@router.post("/perfil/personalizacion")
def guardar_personalizacion(request: PersonalizacionRequest, usuario=Depends(verificar_token)):
    """Guarda el nombre del asistente y nivel de detalle"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE usuario_perfil_ia
            SET nombre_asistente = ?, nivel_detalle = ?
            WHERE usuario_id = ?
        """, (request.nombre_asistente, request.nivel_detalle, usuario["id"]))
        conn.commit()
        return {"mensaje": "Personalización guardada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


# ── Templates de respaldo si la IA falla ──────────────────
TEMPLATES_BIENVENIDA_TOAST = {
    "comercial": "¡Bienvenido de nuevo, {nombre}! Ya tengo tus dinámicas y ventas listas.",
    "planning": "¡Bienvenido de nuevo, {nombre}! Todo al día en trazabilidad.",
}

TEMPLATES_BIENVENIDA_PANEL = {
    "comercial": "Soy {asistente}. Puedo ayudarte a revisar tus ventas, artículos en dinámica y el rendimiento de tus campañas activas. ¿En qué te ayudo hoy?",
    "planning": "Soy {asistente}. Puedo ayudarte con trazabilidad, artículos duplicados y dinámicas por vencer. ¿Por dónde empezamos?",
}

TEMPLATES_DESPEDIDA = {
    "comercial": "¡Hasta luego, {nombre}! Que tengas un excelente resto del día.",
    "planning": "¡Nos vemos, {nombre}! Cualquier cosa, acá estoy.",
}

# ── Generar mensaje de bienvenida ─────────────────────────
@router.post("/bienvenida")
def generar_bienvenida(contexto: str = "panel", usuario=Depends(verificar_token)):
    """
    Genera un mensaje de bienvenida personalizado con IA.
    contexto='toast' → mensaje corto tipo notificación (al hacer login)
    contexto='panel' → mensaje completo con historial (al abrir el chat)
    Si la IA falla, usa un template de respaldo por rol y contexto.
    """
    conn = get_connection()
    cursor = conn.cursor()

    perfil = obtener_perfil_usuario(int(usuario["id"]), conn)

    # Obtener última conversación
    cursor.execute("""
        SELECT TOP 1 titulo, ultimo_mensaje
        FROM conversaciones
        WHERE usuario_id = ? AND activa = 1
        ORDER BY ultimo_mensaje DESC
    """, (usuario["id"],))
    ultima_conv = cursor.fetchone()

    # Obtener stats del usuario
    cursor.execute("""
        SELECT COUNT(*) FROM conversaciones
        WHERE usuario_id = ? AND activa = 1
    """, (usuario["id"],))
    total_convs = cursor.fetchone()[0]

    # Perfil completo
    cursor.execute("""
        SELECT nombre_asistente, nivel_detalle, ultima_sesion
        FROM usuario_perfil_ia WHERE usuario_id = ?
    """, (usuario["id"],))
    config = cursor.fetchone()
    nombre_asistente = config[0] if config and config[0] else "PromoIQ IA"
    ultima_sesion = config[2] if config else None

    conn.close()

    nombre_usuario = perfil.get("nombre_completo") or usuario["nombre"]
    primer_nombre = nombre_usuario.split()[0] if nombre_usuario else usuario["nombre"]
    pais_label = {"CR": "Costa Rica", "GT": "Guatemala", "SV": "El Salvador"}.get(usuario["pais"], "")
    rol = usuario["rol"]

    hora = __import__('datetime').datetime.now().hour
    if hora < 12:
        saludo = "Buenos días"
    elif hora < 18:
        saludo = "Buenas tardes"
    else:
        saludo = "Buenas noches"

    context = f"""
Usuario: {nombre_usuario}
Rol: {rol.capitalize()}
País: {pais_label}
Total conversaciones previas: {total_convs}
Última conversación: {ultima_conv[0] if ultima_conv else 'Primera vez'}
Última sesión: {str(ultima_sesion) if ultima_sesion else 'Primera vez'}
Artículos favoritos: {', '.join(perfil.get('articulos_favoritos', [])[:3]) if perfil.get('articulos_favoritos') else 'Ninguno aún'}
"""

    if contexto == "toast":
        system_prompt = f"""Eres {nombre_asistente}, el asistente IA de PromoIQ para VIDRI/NOVEX.
Generá un saludo de bienvenida MUY breve, tipo notificación (máximo 1 línea, 12 palabras).
Solo el saludo con el nombre — sin ofrecer ayuda ni mencionar historial.
Respondé en español, tono cálido y directo.
NO uses asteriscos ni markdown. Solo texto plano.""",
        user_prompt = f"{saludo} — generá el saludo corto para {primer_nombre}."
        max_tokens_msg = 40
        templates = TEMPLATES_BIENVENIDA_TOAST
    else:
        system_prompt = f"""Eres {nombre_asistente}, el asistente IA personalizado de PromoIQ para VIDRI/NOVEX.
Generá un mensaje de bienvenida cálido, breve y personalizado (máximo 3 líneas).
Usá el nombre del usuario, mencioná algo de su historial si existe y ofrecé ayuda específica para su rol.
Para comercial: enfocate en análisis de ventas y dinámicas.
Para planning: enfocate en trazabilidad y control.
Respondé siempre en español, con tono profesional pero cercano.
NO uses asteriscos ni markdown. Solo texto plano."""
        user_prompt = f"{saludo} — generá el mensaje de bienvenida para:\n{context}"
        max_tokens_msg = 200
        templates = TEMPLATES_BIENVENIDA_PANEL

    try:
        respuesta = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=max_tokens_msg,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )
        mensaje_final = respuesta.content[0].text
    except Exception as e:
        print(f"Error generando bienvenida con IA ({contexto}): {e}")
        template = templates.get(rol, templates["comercial"])
        if contexto == "toast":
            mensaje_final = f"{saludo}, " + template.format(nombre=primer_nombre)
        else:
            mensaje_final = f"{saludo}, {primer_nombre}! " + template.format(asistente=nombre_asistente)

    # Actualizar última sesión — solo en el contexto de panel, para no duplicar el registro
    if contexto == "panel":
        conn2 = get_connection()
        cursor2 = conn2.cursor()
        try:
            cursor2.execute("""
                UPDATE usuario_perfil_ia
                SET ultima_sesion = GETDATE()
                WHERE usuario_id = ?
            """, (usuario["id"],))
            conn2.commit()
        except:
            pass
        finally:
            conn2.close()

    return {
        "mensaje": mensaje_final,
        "nombre_asistente": nombre_asistente,
        "nombre_usuario": nombre_usuario
    }

# ── Generar mensaje de despedida ──────────────────────────
@router.post("/despedida")
def generar_despedida(usuario=Depends(verificar_token)):
    """
    Genera un mensaje de despedida personalizado con IA.
    Se llama al cerrar sesión.
    Si la IA falla, usa un template de respaldo por rol.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Consultas de hoy
    cursor.execute("""
        SELECT COUNT(*) FROM conversacion_mensajes cm
        INNER JOIN conversaciones c ON cm.conversacion_id = c.id
        WHERE c.usuario_id = ?
        AND CAST(cm.fecha AS DATE) = CAST(GETDATE() AS DATE)
        AND cm.rol = 'usuario'
    """, (usuario["id"],))
    consultas_hoy = cursor.fetchone()[0]

    perfil = obtener_perfil_usuario(int(usuario["id"]), conn)

    cursor.execute("""
        SELECT nombre_asistente FROM usuario_perfil_ia
        WHERE usuario_id = ?
    """, (usuario["id"],))
    config = cursor.fetchone()
    nombre_asistente = config[0] if config and config[0] else "PromoIQ IA"
    conn.close()

    nombre_usuario = perfil.get("nombre_completo") or usuario["nombre"]
    nombre_corto = nombre_usuario.split()[0] if nombre_usuario else usuario["nombre"]

    try:
        respuesta = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=100,
            system=f"""Eres {nombre_asistente}, el asistente IA de PromoIQ.
Generá un mensaje de despedida breve, cálido y personalizado (máximo 2 líneas).
Mencioná cuántas consultas hizo hoy si es más de 0.
Respondé en español, tono profesional y cercano.
NO uses asteriscos ni markdown. Solo texto plano.""",
            messages=[{
                "role": "user",
                "content": f"Despedí a {nombre_corto} que hizo {consultas_hoy} consulta(s) hoy."
            }]
        )
        mensaje_final = respuesta.content[0].text
    except Exception as e:
        print(f"Error generando despedida con IA: {e}")
        template = TEMPLATES_DESPEDIDA.get(usuario["rol"], TEMPLATES_DESPEDIDA["comercial"])
        mensaje_final = template.format(nombre=nombre_corto)

    return {
        "mensaje": mensaje_final,
        "nombre_usuario": nombre_corto
    }

