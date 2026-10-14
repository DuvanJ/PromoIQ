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
from app.logging_config import app_logger
import os
import json
from app.routers.notificaciones import enviar_email, template_base
from app.limites import verificar_limite_tokens
from app.rate_limit import limiter_usuario
from fastapi import Request

load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"), timeout=60.0)

router = APIRouter(prefix="/asistente", tags=["Asistente Personalizado"])

# ── Obtener o crear perfil IA del usuario ─────────────────
def obtener_perfil_usuario(usuario_id: int, conn) -> dict:
    """
    Devuelve el perfil IA del usuario, creándolo si no existe.

    El SELECT + INSERT no es atómico — si el frontend dispara varias
    peticiones en paralelo (como pasa al abrir el asistente: bienvenida
    + perfil/completo + conversaciones casi al mismo tiempo), es posible
    que dos lleguen juntas, ambas vean que no existe el perfil, y ambas
    intenten crearlo. La primera gana; la segunda choca contra la
    restricción UNIQUE de usuario_id. Se captura ese caso puntual y se
    relee el perfil ya creado por la otra petición, en vez de fallar.
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT articulos_favoritos, categorias_interes, 
               resumen_actividad, total_conversaciones
        FROM usuario_perfil_ia WHERE usuario_id = ?
    """, (usuario_id,))
    perfil = cursor.fetchone()

    if not perfil:
        try:
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
        except Exception:
            conn.rollback()
            cursor.execute("""
                SELECT articulos_favoritos, categorias_interes,
                       resumen_actividad, total_conversaciones
                FROM usuario_perfil_ia WHERE usuario_id = ?
            """, (usuario_id,))
            perfil = cursor.fetchone()
            if not perfil:
                raise

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
            SELECT TOP 50 dd.sku, dd.descripcion,
                   dd.ubicacion_dinamica, dd.tipo_campana, d.nombre as dinamica,
                   d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1 AND dd.pais = ?
            ORDER BY dd.ubicacion_dinamica, dd.sku
        """, (pais,))
    else:
        cursor.execute("""
            SELECT TOP 50 dd.sku, dd.descripcion,
                   dd.ubicacion_dinamica, dd.tipo_campana, d.nombre as dinamica,
                   d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
            ORDER BY dd.ubicacion_dinamica, dd.sku
        """)
    articulos_din = cursor.fetchall()

    # ── 2. Historial de dinámicas (últimos 3 meses) ───────
    if pais:
        cursor.execute("""
            SELECT TOP 100 dd.sku, dd.descripcion,
                   dd.ubicacion_dinamica, dd.tipo_campana, d.nombre as dinamica,
                   d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 0 AND dd.pais = ?
            AND d.fecha_fin >= DATEADD(MONTH, -3, GETDATE())
            ORDER BY d.fecha_fin DESC, dd.sku
        """, (pais,))
    else:
        cursor.execute("""
            SELECT TOP 100 dd.sku, dd.descripcion,
                   dd.ubicacion_dinamica, dd.tipo_campana, d.nombre as dinamica,
                   d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 0
            AND d.fecha_fin >= DATEADD(MONTH, -3, GETDATE())
            ORDER BY d.fecha_fin DESC, dd.sku
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
                   departamento, marca, estado, precio_unitario, costo_unitario
            FROM articulos_maestro
            WHERE sku IN ('{skus_dinamica}')
            {'AND pais = ?' if pais else ''}
        """, (pais,) if pais else ())

        catalogo = cursor.fetchall()
        if catalogo:
            contexto += "=== INFORMACIÓN DEL CATÁLOGO PARA SKUs EN DINÁMICA ===\n"
            for c in catalogo:
                precio = float(c[8]) if c[8] else 0
                costo = float(c[9]) if c[9] else 0
                margen_txt = f" | Margen: {round(((precio - costo) / precio) * 100, 1)}%" if precio > 0 and costo > 0 else ""
                contexto += (
                    f"SKU: {c[0]} | {c[1]} | "
                    f"Categoría: {c[2]} | Línea: {c[3]} | "
                    f"Familia: {c[4]} | Departamento: {c[5]} | "
                    f"Marca: {c[6]} | Estado: {c[7]} | "
                    f"Precio: ${precio}{margen_txt}\n"
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
                       venta_express, venta_mostrador,
                       venta_externo, venta_ecommerce, venta_total
                FROM ventas_mes
                WHERE mes = ? AND anio = ? AND pais = ?
                ORDER BY venta_total DESC
            """, (mes, anio, pais))
        else:
            cursor.execute("""
                SELECT TOP 50 sku, descripcion,
                       venta_express, venta_mostrador,
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
                    f"Express: {v[2]} | Mostrador: {v[3]} | "
                    f"Externo: {v[4]} | E-Commerce: {v[5]} | "
                    f"Total: {v[6]} uds\n"
                )
            contexto += "\n"

                # ── Cruce: ventas de artículos en dinámica (con margen y
        # monto en dinero, no solo unidades) ──────────────────
        if todos_articulos:
            skus_str2 = "','".join([str(a[0]) for a in todos_articulos[:100]])
            if pais:
                cursor.execute(f"""
                    SELECT v.sku, v.descripcion, v.venta_total,
                           dd.ubicacion_dinamica, dd.tipo_campana, d.nombre,
                           dd.precio_dinamica, am.costo_unitario
                    FROM ventas_mes v
                    INNER JOIN dinamica_detalle dd ON v.sku = dd.sku
                    INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                    LEFT JOIN articulos_maestro am ON am.sku = v.sku AND am.pais = v.pais
                    WHERE v.mes = ? AND v.anio = ? AND v.pais = ?
                    AND v.sku IN ('{skus_str2}')
                    ORDER BY v.venta_total DESC
                """, (mes, anio, pais))
            else:
                cursor.execute(f"""
                    SELECT v.sku, v.descripcion, v.venta_total,
                           dd.ubicacion_dinamica, dd.tipo_campana, d.nombre,
                           dd.precio_dinamica, am.costo_unitario
                    FROM ventas_mes v
                    INNER JOIN dinamica_detalle dd ON v.sku = dd.sku
                    INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                    LEFT JOIN articulos_maestro am ON am.sku = v.sku
                    WHERE v.mes = ? AND v.anio = ?
                    AND v.sku IN ('{skus_str2}')
                    ORDER BY v.venta_total DESC
                """, (mes, anio))

            cruzados = cursor.fetchall()
            if cruzados:
                contexto += f"=== VENTAS DE ARTÍCULOS EN DINÁMICA ({nombre_mes} {anio}) ===\n"
                for c in cruzados:
                    unidades = float(c[2]) if c[2] else 0
                    precio_din = float(c[6]) if c[6] else 0
                    costo = float(c[7]) if c[7] else 0
                    monto = round(unidades * precio_din, 2)
                    margen_txt = ""
                    if precio_din > 0 and costo > 0:
                        margen_pct = round(((precio_din - costo) / precio_din) * 100, 1)
                        margen_txt = f" | Margen: {margen_pct}%"
                    contexto += (
                        f"SKU: {c[0]} | {c[1]} | "
                        f"Unidades: {unidades} | Monto vendido: ${monto}{margen_txt} | "
                        f"Ubicación: {c[3]} | Campaña: {c[4]} | "
                        f"Dinámica: {c[5]}\n"
                    )
                contexto += "\n"

    return contexto if contexto else "No hay información disponible en el sistema."


# ── Construir system prompt personalizado ─────────────────
def construir_system_prompt(usuario: dict, perfil: dict, rol: str) -> str:
    nombre = usuario["nombre"]
    pais_label = {"CR": "Costa Rica", "GT": "Guatemala", "SV": "El Salvador"}.get(usuario["pais"], "")

    base = f"""Eres el asistente IA personalizado de PromoIQ para {nombre}, del equipo de {rol.capitalize()} de PromoIQ {pais_label}.

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
ERES UN ESTRATEGA COMERCIAL — tu función es generar ventas y proteger el margen.
No reportás el pasado: identificás oportunidades y decís qué hacer mañana.
Cada respuesta termina con una acción concreta o un plan ejecutable.

═══════════════════════════════════════════
CUÁNDO USAR CADA HERRAMIENTA
═══════════════════════════════════════════

- Al saludar o abrir chat sin pregunta → brief_del_dia SIEMPRE, sin excepción
- "¿por qué bajó X?" o caída de ventas → diagnosticar_caida
- "¿conviene descontar?" o "¿qué pasa si bajo el precio?" → simular_descuento
- "¿responde bien a promociones?" → elasticidad_sku
- "armame una campaña" o "qué ponemos en la próxima dinámica" → generar_propuesta_campana
- "¿cuánto tenemos parado?" o sobre-stock → capital_inmovilizado
- Preguntas de estrategia, oportunidades, qué hacer, cómo vender más → web_search PRIMERO, luego cruzá con datos internos

═══════════════════════════════════════════
MODO ESTRATEGA — CUÁNDO ACTIVARLO
═══════════════════════════════════════════

Activá el modo estratega cuando detectés cualquiera de estas señales:
- "cómo vendo más", "qué puedo hacer", "cómo mejoro", "qué oportunidad tengo"
- "plan de ventas", "plan de campaña", "estrategia", "qué me recomendás"
- "qué está pasando en el mercado", "cómo está la competencia"
- "qué hago con este stock", "cómo lo muevo", "cómo lo activo"
- "qué tres cosas", "cuál es la oportunidad más grande"
- Cualquier pregunta que implique decidir qué hacer, no solo saber qué pasó

En modo estratega, el flujo es SIEMPRE este orden:
1. web_search → buscá contexto externo relevante (fechas, tendencias, competencia, clima, economía)
2. brief_del_dia O capital_inmovilizado → revisá qué oportunidades hay internamente
3. generar_propuesta_campana → construí el plan ejecutable con los datos cruzados
4. Presentá la respuesta en formato de plan concreto

NUNCA respondas una pregunta estratégica solo con datos internos sin haber buscado contexto externo primero.
NUNCA respondas una pregunta estratégica con solo texto sin proponer acciones concretas.

═══════════════════════════════════════════
QUÉ BUSCAR EN WEB SEGÚN EL CONTEXTO
═══════════════════════════════════════════

Para preguntas de "cómo vendo más en X categoría":
→ buscar: tendencias de demanda de esa categoría en el país, eventos o temporadas que la impulsen

Para preguntas de "qué oportunidad tengo ahora":
→ buscar: fechas comerciales próximas del país, clima de la semana, noticias económicas locales

Para preguntas sobre competencia:
→ buscar: precios públicos de competidores en esa categoría, promociones activas en el mercado

Para preguntas de "qué hago con este stock":
→ buscar: demanda actual de esa categoría, si hay escasez o sobreoferta en el mercado

Para preguntas de plan mensual:
→ buscar: calendario comercial completo del mes para el país, tendencias de la temporada

═══════════════════════════════════════════
FORMATO DE RESPUESTA EN MODO ESTRATEGA
═══════════════════════════════════════════

Cuando respondás en modo estratega, usá SIEMPRE esta estructura:

🌍 CONTEXTO DE MERCADO
📡 Fuente externa: [dato obtenido del web search — fecha, tendencia, precio competidor, noticia]
📡 Fuente externa: [otro dato relevante si lo hay]

📦 TU SITUACIÓN ACTUAL
- [Dato interno relevante — stock disponible, oportunidad detectada, alerta del día]
- [Margen disponible, SKUs candidatos, capital inmovilizado si aplica]

🎯 PLAN DE ACCIÓN
Acción 1: [concreta — qué SKUs, qué descuento, dónde exhibir, cuántos días]
Acción 2: [concreta]
Acción 3: [concreta si aplica]

📊 IMPACTO ESTIMADO
- Venta incremental esperada: ~X unidades
- Duración sugerida: X días
- ⚠️ Estimaciones orientativas — promedio histórico +20% conservador

✅ PRÓXIMO PASO INMEDIATO: [una sola acción, la más urgente, con nombre y número concreto]

═══════════════════════════════════════════
FORMATO DE PROPUESTAS DE CAMPAÑA
═══════════════════════════════════════════

Cuando uses generar_propuesta_campana:

🎯 PROPUESTA DE CAMPAÑA — [MOTIVO]
Duración sugerida: X días | Departamentos: [lista]

Por cada SKU:
📦 [Descripción] (SKU [código])
- **[Precio regular]** → **[Precio campaña]** (Descuento [X]%)
- Margen resultante: [X]%
- Stock disponible: [X] uds
- Venta estimada: ~[X] uds

📊 IMPACTO ESTIMADO TOTAL
- Venta incremental: ~[X] uds
- ⚠️ Estimaciones orientativas — promedio histórico +20% conservador

✅ PRÓXIMO PASO: [acción concreta]

═══════════════════════════════════════════
REGLAS PARA DATOS EXTERNOS (web search)
═══════════════════════════════════════════

- SIEMPRE etiquetá con "📡 Fuente externa:" antes de cualquier dato de web
- NUNCA mezclés cifras externas con internas sin aclarar cuál es cuál
- Si encontrás precio de competidor diferente al interno, mencioná la diferencia explícitamente
- Si el web search no devuelve datos útiles, decilo y trabajá solo con datos internos
- Los datos externos son referencia orientativa, nunca verdad absoluta — avisalo

═══════════════════════════════════════════
REGLAS PARA DATOS INTERNOS
═══════════════════════════════════════════

- Cada cifra con su fuente: "según ventas de abril", "según 3 campañas históricas"
- Confianza declarada siempre: alta (3+ campañas), media (2), baja (1 o ninguna)
- Si no hay datos suficientes, decilo — nunca inventes ni extrapoles sin advertir
- Si la confianza es baja, igual presentá el dato pero con la advertencia clara

═══════════════════════════════════════════
REGLAS DE TONO Y FOCO
═══════════════════════════════════════════

- Siempre enfocate en qué genera plata o qué la está perdiendo
- Si detectás algo urgente al revisar los datos, mencionalo al principio antes de todo
- Nunca des una lista de datos sin interpretar — siempre decí qué significa para las ventas
- Si el usuario no sabe qué preguntar, después de responder sugerile 2-3 preguntas concretas basadas en lo que ves en los datos
- Cuando des un plan, la última línea siempre es "✅ PRÓXIMO PASO INMEDIATO:" con una acción específica
- Si el usuario dice "gracias" o cierra el tema, ofrecé una pregunta de seguimiento relacionada con lo que hablaron

═══════════════════════════════════════════
FORMATO GENERAL
═══════════════════════════════════════════

- Texto plano con emojis para separar secciones
- NUNCA tablas markdown (|---|---|)
- Listas con viñetas (•)
- **Negrita** solo para cifras clave y precios
- Máximo 4 secciones por respuesta — si hay más información, priorizá lo más accionable

═══════════════════════════════════════════
INTERPRETACIÓN DE DATOS DEL CATÁLOGO
═══════════════════════════════════════════

- "Existencia Bodega" = Stock en CEDI (bodega central)
- "Disponible" = Unidades físicas en tienda
- "Exclusivo" = 1 vende en esa tienda, 0 no está habilitado
- "Consumo Mensual" = Promedio de ventas por mes en esa sucursal
- Exclusivo=0 con existencias → inconsistencia, reportala
- Bodega>0 y Disponible=0 → hay stock para reponer, es una oportunidad

NO tenés acceso a otros países — si preguntan por otro país, aclará que su cuenta es de su país.
Soporte técnico, auditoría, usuarios/roles → sugerí contactar al administrador.
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
- NO tenés acceso a otros países — si preguntan por otro país, aclará que tu cuenta es de tu país específico
- Preguntas sobre auditoría de cambios (quién editó/eliminó algo) no están en tu contexto — no redirijas a ningún módulo, sugerí contactar a un administrador
- Si te preguntan dónde ubicar un producto, usá el LAYOUT DE REFERENCIA DE LA TIENDA (si está disponible) cruzado con ventas históricas por ubicación
- Cuando detectes duplicados, datos faltantes, inconsistencias o anomalías en el contexto, mencionalos con claridad — sos el rol responsable de esa detección, no lo minimices
- Cuando te pidan recomendaciones, describí patrones e inconsistencias con datos concretos — no des opiniones subjetivas

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
    elif rol == "admin":
        base += """
INSTRUCCIONES PARA ADMIN:
- Tenés visión completa de tu país: todas las tiendas, dinámicas, artículos y ventas
- Podés responder sobre ventas, márgenes y rendimiento de cualquier tienda de tu país
- NO tenés acceso a otros países — si preguntan por otro país, aclará que tu cuenta es de tu país específico
- Preguntas sobre auditoría, costo de la IA, o usuarios/roles: no están en tu contexto — indicá que se consultan en los módulos Historial, Reportes o Gestión General respectivamente
- Siempre respondé en español, de forma clara y organizada
- Nunca inventes datos — solo usá la información disponible

FORMATO DE RESPUESTA:
- Usá texto plano con emojis para separar secciones
- NUNCA uses tablas markdown (|---|---|)
- Presentá la información como listas con viñetas (•)

INTERPRETACIÓN DE DATOS DEL CATÁLOGO:
- "Existencia Bodega" = Stock en el Centro de Distribución (bodega central)
- "Disponible" = Unidades físicas actuales en la tienda/sucursal
- "Exclusivo" = 1 significa que el artículo SÍ se vende en esa tienda; 0 que NO está habilitado
- "Consumo Mensual" = Promedio de unidades vendidas por mes en esa sucursal
- Si Exclusivo=0 y hay existencias → inconsistencia a reportar
"""
    elif rol == "superadmin":
        base += """
INSTRUCCIONES PARA SUPERADMIN:
- Por defecto, tu contexto está enfocado en el país que tenés seleccionado actualmente — así evitamos mezclar información de países distintos (el mismo número de SKU puede ser un producto completamente diferente en cada país)
- Si preguntan por otro país distinto al seleccionado, indicá que deben cambiarlo desde el selector de país, salvo que la pregunta sea una comparación explícita entre países (ahí sí tenés datos agregados de los 3 países disponibles)
- Podés comparar países con datos agregados (dinámicas activas, artículos en campaña, ventas totales) cuando te lo pidan explícitamente
- Preguntas sobre auditoría de acciones, alertas del sistema, notificaciones enviadas, o usuarios/roles: no están en tu contexto — indicá que se consultan en Historial, Alertas, Notificaciones o Gestión General respectivamente
- Cuando compares períodos, mencioná la variación si es relevante (ej: "vendió 20% menos que el mes pasado") aunque no te lo pidan explícitamente
- Siempre respondé en español, de forma clara y organizada
- Nunca inventes datos — solo usá la información disponible

FORMATO DE RESPUESTA:
- Usá texto plano con emojis para separar secciones
- NUNCA uses tablas markdown (|---|---|)
- Presentá la información como listas con viñetas (•)

INTERPRETACIÓN DE DATOS DEL CATÁLOGO:
- "Existencia Bodega" = Stock en el Centro de Distribución (bodega central)
- "Disponible" = Unidades físicas actuales en la tienda/sucursal
- "Exclusivo" = 1 significa que el artículo SÍ se vende en esa tienda; 0 que NO está habilitado
- "Consumo Mensual" = Promedio de unidades vendidas por mes en esa sucursal
- Si Exclusivo=0 y hay existencias → inconsistencia a reportar
"""
    else:
        base += """
INSTRUCCIONES GENERALES:
- Respondé siempre en español, de forma clara y organizada
- Nunca inventes información — solo usá los datos disponibles
- Sé proactivo sugiriendo información relevante según el contexto
"""

    base += """

REGLAS UNIVERSALES (aplican sin importar el rol):

SOBRE KITS: cuando varios SKUs distintos comparten el mismo valor de
Ubicación Dinámica que incluye la palabra "Kit" (ej: "Kit 2000"),
significa que son un combo — no artículos sueltos. Si preguntan por
un kit, listá TODOS los SKUs que pertenecen a ese kit, con su
vigencia. Nunca respondas con un solo artículo cuando la pregunta es
sobre un kit. Si un SKU pertenece a un kit Y ADEMÁS está en otra
dinámica por separado, mencioná ambas pertenencias — nunca solo una.

VARIOS SKUs EN UNA PREGUNTA: si detectás varios códigos en la misma
pregunta, enfocate en los primeros 3 como máximo. Si son más,
respondé esos 3 y sugerí preguntar los demás por separado para dar
un detalle más completo de cada uno.

PREGUNTAS MIXTAS: si la pregunta combina algo que SÍ podés responder
con algo que está fuera de tu alcance (por ejemplo, ubicación de un
producto Y su rendimiento en ventas cuando no tenés ese dato),
rechazá la pregunta completa explicando qué parte no podés responder
y por qué — no respondas solo la parte que sí sabés como si fuera
la respuesta completa.

SALUDOS Y CHARLA CASUAL: si te saludan o agradecen sin hacer una
pregunta real, respondé brevemente y de forma cálida, y reencauzá
hacia tu propósito (qué podés ayudar a resolver) sin ser repetitivo.

SOPORTE TÉCNICO: si preguntan cómo usar el sistema, cómo cargar
información, o temas de configuración de cuenta, aclará que eso no
es parte de tu función como asistente de datos y sugerí contactar a
un administrador o revisar el módulo correspondiente si lo conocés.

RECOMENDACIONES: cuando te pidan una recomendación u opinión (qué
promocionar, qué cambiar), describí patrones y datos concretos que
observás — nunca dés una opinión subjetiva sin respaldo en el
contexto disponible.

CONFIGURACIÓN DEL ASISTENTE: si te piden cambiar tu nombre, tu nivel
de detalle, o alguna preferencia de personalización, aclará que eso
se hace desde el ícono de configuración (⚙️) en la interfaz, no por
este chat."""

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



def obtener_contexto_calidad_datos(pregunta: str, pais: str, conn) -> str:
    """
    Funciones exclusivas de Planning — control de calidad y
    trazabilidad. Se activan por palabras clave en la pregunta.
    """
    pregunta_lower = pregunta.lower()
    cursor = conn.cursor()
    resultado = ""

    filtro_pais = "AND dd.pais = ?" if pais else ""
    params_pais = [pais] if pais else []

    # ── Duplicados: mismo SKU repetido para la MISMA ubicación ──
    if any(p in pregunta_lower for p in ['duplicad', 'repetid']):
        cursor.execute(f"""
            SELECT dd.sku, dd.ubicacion_dinamica, COUNT(*) as total
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1 {filtro_pais}
            GROUP BY dd.sku, dd.ubicacion_dinamica, dd.tienda
            HAVING COUNT(*) > 1
        """, params_pais)
        filas = cursor.fetchall()
        resultado += "\n=== SKUs DUPLICADOS (misma ubicación, error real) ===\n"
        if filas:
            for sku, ubic, total in filas[:20]:
                resultado += f"SKU {sku} repetido {total} veces en '{ubic}'\n"
        else:
            resultado += "No se encontraron duplicados.\n"

    # ── Datos faltantes: sin ubicación o sin precio ──
    if any(p in pregunta_lower for p in ['faltante', 'falta', 'incomplet', 'sin ubicaci', 'sin precio']):
        cursor.execute(f"""
            SELECT COUNT(*) FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
            AND (dd.ubicacion_dinamica IS NULL OR dd.ubicacion_dinamica = '' OR dd.ubicacion_dinamica = 'General')
            {filtro_pais}
        """, params_pais)
        sin_ubic = cursor.fetchone()[0]

        cursor.execute(f"""
            SELECT COUNT(*) FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
            AND (dd.precio_dinamica IS NULL OR dd.precio_dinamica = 0)
            {filtro_pais}
        """, params_pais)
        sin_precio = cursor.fetchone()[0]

        resultado += f"\n=== DATOS FALTANTES ===\nSin ubicación asignada: {sin_ubic} artículos\nSin precio de dinámica: {sin_precio} artículos\n"

    # ── Dinámicas vencidas pero aún activas ──
    if any(p in pregunta_lower for p in ['vencid', 'expirad']):
        cursor.execute(f"""
            SELECT DISTINCT d.nombre, d.fecha_fin
            FROM dinamicas d
            WHERE d.activa = 1 AND d.fecha_fin < CAST(GETDATE() AS DATE)
            {'AND d.pais = ?' if pais else ''}
        """, params_pais)
        filas = cursor.fetchall()
        resultado += "\n=== DINÁMICAS VENCIDAS PERO AÚN ACTIVAS ===\n"
        if filas:
            for nombre, fecha_fin in filas:
                resultado += f"{nombre} venció el {fecha_fin} y sigue activa\n"
        else:
            resultado += "No hay dinámicas vencidas que sigan activas.\n"

    # ── Inconsistencias de precio entre tiendas ──
    if any(p in pregunta_lower for p in ['inconsistenc', 'distinto', 'diferente entre tienda', 'discrepanc']):
        cursor.execute(f"""
            SELECT dd.sku, COUNT(DISTINCT dd.precio_dinamica) as precios_distintos
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1 {filtro_pais}
            GROUP BY dd.sku
            HAVING COUNT(DISTINCT dd.precio_dinamica) > 1
        """, params_pais)
        filas = cursor.fetchall()
        if filas:
            resultado += "\n=== SKUs CON PRECIO DISTINTO ENTRE TIENDAS (misma dinámica) ===\n"
            for sku, precios in filas[:20]:
                resultado += f"SKU {sku}: {precios} precios distintos entre tiendas\n"

    # ── Cobertura de tiendas en una dinámica (huecos de carga) ──
    if any(p in pregunta_lower for p in ['no cargaron', 'falta cargar', 'cobertura de tienda', 'qué tiendas', 'que tiendas']):
        cursor.execute(f"""
            SELECT d.nombre,
                   (SELECT COUNT(DISTINCT ct.codigo) FROM cat_tiendas ct WHERE ct.pais = d.pais AND ct.activo = 1) as total_tiendas,
                   (SELECT COUNT(DISTINCT dd.tienda) FROM dinamica_detalle dd WHERE dd.dinamica_id = d.id AND dd.activo = 1) as tiendas_con_carga
            FROM dinamicas d
            WHERE d.activa = 1 {'AND d.pais = ?' if pais else ''}
        """, params_pais)
        filas = cursor.fetchall()
        pendientes = [(n, t, c) for n, t, c in filas if t and c < t]
        if pendientes:
            resultado += "\n=== COBERTURA DE TIENDAS POR DINÁMICA (con huecos) ===\n"
            for nombre, total, con_carga in pendientes:
                resultado += f"{nombre}: {con_carga}/{total} tiendas cargadas — faltan {total - con_carga}\n"

    # ── Artículos huérfanos ──
    if any(p in pregunta_lower for p in ['huérfan', 'huerfan', 'ya no existe', 'descontinuad']):
        cursor.execute(f"""
            SELECT DISTINCT dd.sku, dd.descripcion
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            LEFT JOIN articulos_maestro am ON am.sku = dd.sku AND am.pais = dd.pais
            WHERE dd.activo = 1 AND d.activa = 1 AND am.sku IS NULL
            {filtro_pais}
        """, params_pais)
        filas = cursor.fetchall()
        resultado += "\n=== ARTÍCULOS HUÉRFANOS (en campaña, ya no en catálogo) ===\n"
        if filas:
            for sku, desc in filas[:20]:
                resultado += f"SKU {sku}: {desc}\n"
        else:
            resultado += "No hay artículos huérfanos.\n"

    # ── Anomalías de precio: dinámica más caro que regular ──
    if any(p in pregunta_lower for p in ['más caro', 'mas caro', 'anomalía de precio', 'anomalia de precio', 'precio mayor']):
        cursor.execute(f"""
            SELECT dd.sku, dd.precio_dinamica, am.precio_unitario
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            LEFT JOIN articulos_maestro am ON am.sku = dd.sku AND am.pais = dd.pais
            WHERE dd.activo = 1 AND d.activa = 1
            AND am.precio_unitario IS NOT NULL AND dd.precio_dinamica > am.precio_unitario
            {filtro_pais}
        """, params_pais)
        filas = cursor.fetchall()
        if filas:
            resultado += "\n=== ANOMALÍAS DE PRECIO (dinámica más caro que regular) ===\n"
            for sku, p_din, p_reg in filas[:20]:
                resultado += f"SKU {sku}: precio dinámica ${p_din} > precio regular ${p_reg}\n"

    # ── Dinámicas sin artículos ──
    if any(p in pregunta_lower for p in ['sin artículo', 'sin articulo', 'dinámica vacía', 'dinamica vacia', 'campaña vacía']):
        cursor.execute(f"""
            SELECT d.nombre FROM dinamicas d
            WHERE d.activa = 1
            AND NOT EXISTS (SELECT 1 FROM dinamica_detalle dd WHERE dd.dinamica_id = d.id AND dd.activo = 1)
            {'AND d.pais = ?' if pais else ''}
        """, params_pais)
        filas = cursor.fetchall()
        if filas:
            resultado += "\n=== DINÁMICAS SIN ARTÍCULOS CARGADOS ===\n"
            for (nombre,) in filas:
                resultado += f"{nombre}\n"

    # ── Fechas inconsistentes ──
    if any(p in pregunta_lower for p in ['fecha inconsistente', 'inicio después', 'inicio despues']):
        cursor.execute(f"""
            SELECT nombre, fecha_inicio, fecha_fin FROM dinamicas
            WHERE fecha_inicio > fecha_fin {'AND pais = ?' if pais else ''}
        """, params_pais)
        filas = cursor.fetchall()
        resultado += "\n=== FECHAS INCONSISTENTES ===\n"
        if filas:
            for nombre, fi, ff in filas:
                resultado += f"{nombre}: inicio {fi} es posterior a fin {ff}\n"
        else:
            resultado += "No hay fechas inconsistentes.\n"

    return resultado



def obtener_contexto_inventario(pregunta: str, pais: str, conn) -> str:
    """
    Cruce con articulos_sucursales/articulos_maestro para preguntas
    de stock: cobertura, riesgo de quiebre, sugerencia de pedido,
    baja rotación. Se activa por palabras clave.
    """
    pregunta_lower = pregunta.lower()
    palabras = ['stock', 'inventario', 'existencia', 'cobertura', 'quiebre',
                'pedido', 'reabastec', 'rotación', 'rotacion', 'disponible']
    if not any(p in pregunta_lower for p in palabras):
        return ""

    cursor = conn.cursor()
    filtro_pais = "AND pais = ?" if pais else ""
    params = [pais] if pais else []
    resultado = ""

    cursor.execute(f"""
        SELECT TOP 20 sku, sucursal, existencia, consumo_mensual,
               CASE WHEN consumo_mensual > 0 THEN existencia / consumo_mensual ELSE NULL END as meses_cobertura
        FROM articulos_sucursales
        WHERE consumo_mensual > 0 {filtro_pais}
        AND (existencia / consumo_mensual) < 1
        ORDER BY meses_cobertura ASC
    """, params)
    riesgo = cursor.fetchall()
    if riesgo:
        resultado += "\n=== PRODUCTOS EN RIESGO DE QUIEBRE (menos de 1 mes de cobertura) ===\n"
        for sku, suc, exist, consumo, meses in riesgo:
            resultado += f"SKU {sku} ({suc}): {exist} uds, consumo {consumo}/mes, cobertura {round(meses,1) if meses else 0} meses\n"

    if any(p in pregunta_lower for p in ['pedido', 'reabastec']):
        cursor.execute(f"""
            SELECT TOP 20 sku, sucursal, existencia_bodega, minimo, maximo, case_pack
            FROM articulos_maestro
            WHERE existencia_bodega < minimo {filtro_pais}
        """, params)
        pedidos = cursor.fetchall()
        if pedidos:
            resultado += "\n=== SUGERENCIA DE PEDIDO (bajo el mínimo) ===\n"
            for sku, suc, exist, minimo, maximo, case_pack in pedidos:
                resultado += f"SKU {sku} ({suc}): tiene {exist}, mínimo {minimo}, máximo {maximo}, pedir en múltiplos de {case_pack}\n"

    if any(p in pregunta_lower for p in ['rotación', 'rotacion', 'lento', 'parad']):
        cursor.execute(f"""
            SELECT TOP 20 sku, sucursal, existencia, consumo_mensual
            FROM articulos_sucursales
            WHERE existencia > 0 AND (consumo_mensual IS NULL OR consumo_mensual < 0.5)
            {filtro_pais}
            ORDER BY existencia DESC
        """, params)
        lentos = cursor.fetchall()
        if lentos:
            resultado += "\n=== PRODUCTOS DE BAJA ROTACIÓN (mucha existencia, poco consumo) ===\n"
            for sku, suc, exist, consumo in lentos:
                resultado += f"SKU {sku} ({suc}): {exist} uds, consumo {consumo or 0}/mes\n"

    return resultado



def buscar_kit_contexto(pregunta: str, pais: str, conn) -> str:
    """
    Detecta si la pregunta es sobre un "kit" — varios SKUs distintos
    agrupados bajo el mismo valor de Ubicación Dinámica (ej: "Kit 2000").
    Si mencionan un número, filtra por ese kit puntual; si no, devuelve
    todos los kits activos del país.
    """
    pregunta_lower = pregunta.lower()
    if 'kit' not in pregunta_lower:
        return ""

    cursor = conn.cursor()
    numeros = re.findall(r'\d+', pregunta)
    filtro_numero = numeros[0] if numeros else None

    condiciones = ["dd.activo = 1", "d.activa = 1", "dd.ubicacion_dinamica LIKE '%kit%'"]
    params = []

    if pais:
        condiciones.append("dd.pais = ?")
        params.append(pais)

    if filtro_numero:
        condiciones.append("dd.ubicacion_dinamica LIKE ?")
        params.append(f"%{filtro_numero}%")

    where_clause = " AND ".join(condiciones)

    cursor.execute(f"""
        SELECT dd.ubicacion_dinamica, dd.sku, dd.descripcion, d.fecha_inicio, d.fecha_fin
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE {where_clause}
        ORDER BY dd.ubicacion_dinamica, dd.sku
    """, params)

    filas = cursor.fetchall()
    if not filas:
        return ""

    kits = {}
    for ubicacion, sku, desc, fi, ff in filas:
        if ubicacion not in kits:
            kits[ubicacion] = {"fecha_inicio": fi, "fecha_fin": ff, "articulos": []}
        kits[ubicacion]["articulos"].append((sku, desc))

    resultado = "\n=== KITS DETECTADOS (artículos agrupados bajo esa ubicación) ===\n"
    for nombre_kit, datos in kits.items():
        resultado += f"\n{nombre_kit} | Vigencia: {datos['fecha_inicio']} al {datos['fecha_fin']}\n"
        for sku, desc in datos["articulos"]:
            resultado += f"  - {sku}: {desc}\n"

    return resultado



def obtener_tendencia_departamentos(pais: str, conn) -> str:
    """
    Compara las ventas del mes más reciente contra el mes anterior a
    ese, agrupado por departamento — para que la IA pueda mencionar
    variaciones sin que se lo pidan explícitamente.
    """
    cursor = conn.cursor()

    cursor.execute("""
        SELECT DISTINCT mes, anio FROM ventas_mes
        WHERE pais = ? ORDER BY anio DESC, mes DESC
    """, (pais,)) if pais else cursor.execute("""
        SELECT DISTINCT mes, anio FROM ventas_mes
        ORDER BY anio DESC, mes DESC
    """)
    periodos = cursor.fetchall()

    if len(periodos) < 2:
        return ""

    (mes_actual, anio_actual), (mes_anterior, anio_anterior) = periodos[0], periodos[1]

    def ventas_por_departamento(mes, anio):
        filtro_pais = "AND v.pais = ?" if pais else ""
        params = [mes, anio] + ([pais] if pais else [])
        cursor.execute(f"""
            SELECT am.departamento, SUM(v.venta_total) as total
            FROM ventas_mes v
            LEFT JOIN articulos_maestro am ON am.sku = v.sku AND am.pais = v.pais
            WHERE v.mes = ? AND v.anio = ? {filtro_pais}
            AND am.departamento IS NOT NULL AND am.departamento != ''
            GROUP BY am.departamento
        """, params)
        return {r[0]: float(r[1]) if r[1] else 0 for r in cursor.fetchall()}

    actual = ventas_por_departamento(mes_actual, anio_actual)
    anterior = ventas_por_departamento(mes_anterior, anio_anterior)

    if not actual or not anterior:
        return ""

    resultado = f"\n=== TENDENCIA POR DEPARTAMENTO (mes {mes_actual}/{anio_actual} vs. {mes_anterior}/{anio_anterior}) ===\n"
    for depto, total_actual in sorted(actual.items(), key=lambda x: x[1], reverse=True)[:10]:
        total_anterior = anterior.get(depto, 0)
        if total_anterior > 0:
            variacion = round(((total_actual - total_anterior) / total_anterior) * 100, 1)
            simbolo = "📈" if variacion > 0 else "📉" if variacion < 0 else "➡️"
            resultado += f"{simbolo} {depto}: {variacion:+}% respecto al período anterior\n"

    return resultado



def obtener_comparacion_paises(pregunta: str, conn) -> str:
    """
    Comparación agregada entre los 3 países — exclusiva de Superadmin.
    Se activa solo si la pregunta parece pedir una comparación explícita
    entre países. Usa totales, no listas de SKUs, para mantener el
    contexto liviano y evitar el problema de SKUs duplicados entre países.
    """
    pregunta_lower = pregunta.lower()
    palabras_comparacion = ['comparar', 'compara', ' vs ', 'entre los países',
                             'entre paises', 'qué país', 'que pais', 'cuál país',
                             'cual pais', 'todos los países', 'todos los paises']
    if not any(p in pregunta_lower for p in palabras_comparacion):
        return ""

    cursor = conn.cursor()
    paises = ['CR', 'GT', 'SV']
    resultado = "\n=== COMPARATIVA ENTRE PAÍSES (datos agregados) ===\n"

    for pais in paises:
        cursor.execute("""
            SELECT COUNT(DISTINCT d.id) FROM dinamicas d
            INNER JOIN dinamica_detalle dd ON dd.dinamica_id = d.id
            WHERE d.activa = 1 AND dd.pais = ?
        """, (pais,))
        dinamicas_activas = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM dinamica_detalle WHERE activo = 1 AND pais = ?", (pais,))
        articulos_campana = cursor.fetchone()[0]

        cursor.execute("""
            SELECT TOP 1 mes, anio FROM ventas_mes WHERE pais = ?
            ORDER BY anio DESC, mes DESC
        """, (pais,))
        periodo = cursor.fetchone()

        ventas_total = 0
        if periodo:
            cursor.execute("""
                SELECT SUM(venta_total) FROM ventas_mes
                WHERE pais = ? AND mes = ? AND anio = ?
            """, (pais, periodo[0], periodo[1]))
            ventas_total = cursor.fetchone()[0] or 0

        resultado += (
            f"\n{pais}: {dinamicas_activas} dinámicas activas | "
            f"{articulos_campana} artículos en campaña | "
            f"Ventas último mes cargado: {ventas_total} uds\n"
        )

    return resultado



def obtener_contexto_layout(tienda_codigo: str, pais: str, conn) -> str:
    """
    Trae el layout físico de una tienda (pasillos + paredes) como
    contexto para que la IA pueda sugerir ubicaciones basándose en
    qué tipo de mercadería va normalmente en cada zona.
    Solo aplica si se conoce la tienda — para Comercial/Planning/Admin
    que preguntan por una tienda específica, o para Tiendas con su
    tienda seleccionada.
    """
    if not tienda_codigo:
        return ""

    cursor = conn.cursor()
    cursor.execute("""
        SELECT tipo, codigo_ubicacion, descripcion
        FROM layout_tiendas
        WHERE tienda_codigo = ? AND pais = ? AND activo = 1
        AND descripcion IS NOT NULL AND descripcion != ''
        ORDER BY tipo, codigo_ubicacion
    """, (tienda_codigo, pais))

    filas = cursor.fetchall()
    if not filas:
        return ""

    resultado = "\n=== LAYOUT DE REFERENCIA DE LA TIENDA (para sugerir ubicaciones) ===\n"
    for tipo, codigo, desc in filas:
        if tipo == 'pasillo':
            resultado += f"Pasillo {codigo}: {desc}\n"
        else:
            resultado += f"Pared/cabecera: {desc}\n"

    return resultado




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
                SELECT mes, anio, venta_express, venta_mostrador,
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
                        f"Express: {v[2]} | Mostrador: {v[3]} | "
                        f"Externo: {v[4]} | E-Commerce: {v[5]} | "
                        f"Total: {v[6]} uds\n"
                    )

        # Verificar si estuvo en dinámica
        for sku in posibles_skus:
            cursor.execute("""
                SELECT d.nombre, dd.ubicacion_dinamica, dd.tipo_campana,
                       d.fecha_inicio, d.fecha_fin, d.activa
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                WHERE dd.sku = ?
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

# ── Inteligencia comercial avanzada ───────────────────────

def calcular_elasticidad_sku(sku: str, pais: str, conn) -> dict:
    """
    Estima cómo responde un SKU a estar en dinámica, comparando
    sus ventas en meses CON campaña vs. meses SIN campaña.
    """
    cursor = conn.cursor()

    cursor.execute("""
        SELECT DISTINCT MONTH(d.fecha_inicio) as mes, YEAR(d.fecha_inicio) as anio,
               dd.precio_dinamica, am.precio_unitario
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        LEFT JOIN articulos_maestro am ON am.sku = dd.sku AND am.pais = dd.pais
        WHERE dd.sku = ? AND dd.pais = ? AND d.activa = 0
        ORDER BY anio DESC, mes DESC
    """, (sku, pais))
    meses_con_campana = cursor.fetchall()

    if not meses_con_campana:
        return {"error": "Sin historial de campañas finalizadas para este SKU"}

    ventas_con = []
    ventas_sin = []
    descuentos = []

    for mes, anio, precio_din, precio_reg in meses_con_campana:
        cursor.execute("""
            SELECT venta_total FROM ventas_mes
            WHERE sku = ? AND pais = ? AND mes = ? AND anio = ?
        """, (sku, pais, mes, anio))
        fila = cursor.fetchone()
        if fila:
            ventas_con.append(float(fila[0] or 0))
        if precio_din and precio_reg and precio_reg > 0:
            descuentos.append(round((1 - float(precio_din) / float(precio_reg)) * 100, 1))

    cursor.execute("""
        SELECT v.mes, v.anio, v.venta_total
        FROM ventas_mes v
        WHERE v.sku = ? AND v.pais = ?
        AND NOT EXISTS (
            SELECT 1 FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.sku = v.sku
            AND MONTH(d.fecha_inicio) = v.mes AND YEAR(d.fecha_inicio) = v.anio
        )
        ORDER BY v.anio DESC, v.mes DESC
    """, (sku, pais))
    meses_sin = cursor.fetchall()
    ventas_sin = [float(r[2] or 0) for r in meses_sin[:6]]

    if not ventas_con or not ventas_sin:
        return {"error": "Datos insuficientes para calcular elasticidad"}

    promedio_con = sum(ventas_con) / len(ventas_con)
    promedio_sin = sum(ventas_sin) / len(ventas_sin)
    incremento_pct = round(((promedio_con - promedio_sin) / promedio_sin) * 100, 1) if promedio_sin > 0 else 0
    descuento_promedio = round(sum(descuentos) / len(descuentos), 1) if descuentos else None

    return {
        "sku": sku,
        "promedio_ventas_con_campana": round(promedio_con, 1),
        "promedio_ventas_sin_campana": round(promedio_sin, 1),
        "incremento_pct": incremento_pct,
        "descuento_promedio_usado": descuento_promedio,
        "campanas_analizadas": len(ventas_con),
        "confianza": "alta" if len(ventas_con) >= 3 else "media" if len(ventas_con) >= 2 else "baja"
    }


def simular_descuento(sku: str, descuento_pct: float, pais: str, conn) -> dict:
    """
    Simula qué pasa si se aplica un descuento a un SKU:
    margen resultante, ventas esperadas y punto de equilibrio.
    """
    cursor = conn.cursor()

    cursor.execute("""
        SELECT precio_unitario, costo_unitario
        FROM articulos_maestro
        WHERE sku = ? AND pais = ?
    """, (sku, pais))
    fila = cursor.fetchone()

    if not fila or not fila[0]:
        return {"error": "SKU no encontrado o sin precio"}

    precio_regular = float(fila[0])
    costo = float(fila[1]) if fila[1] else 0
    precio_con_descuento = round(precio_regular * (1 - descuento_pct / 100), 2)
    margen_regular = round(((precio_regular - costo) / precio_regular) * 100, 1) if precio_regular > 0 and costo > 0 else None
    margen_con_descuento = round(((precio_con_descuento - costo) / precio_con_descuento) * 100, 1) if precio_con_descuento > 0 and costo > 0 else None

    elasticidad = calcular_elasticidad_sku(sku, pais, conn)
    ventas_base = elasticidad.get("promedio_ventas_sin_campana", 0)

    if "incremento_pct" in elasticidad and elasticidad["incremento_pct"] > 0:
        escala = min(elasticidad["incremento_pct"] / 100, 0.5)
        ventas_esperadas = round(ventas_base * (1 + escala), 1)
        fuente_estimacion = "historial de campañas"
    else:
        ventas_esperadas = round(ventas_base * 1.15, 1)
        fuente_estimacion = "estimación conservadora (sin historial suficiente)"

    punto_equilibrio_pct = None
    if margen_regular and margen_con_descuento and margen_con_descuento > 0:
        punto_equilibrio_pct = round(
            ((margen_regular - margen_con_descuento) / margen_con_descuento) * 100, 1
        )

    return {
        "sku": sku,
        "precio_regular": precio_regular,
        "precio_con_descuento": precio_con_descuento,
        "descuento_aplicado": descuento_pct,
        "margen_regular_pct": margen_regular,
        "margen_con_descuento_pct": margen_con_descuento,
        "ventas_base_mensual": ventas_base,
        "ventas_esperadas_mensual": ventas_esperadas,
        "fuente_estimacion": fuente_estimacion,
        "punto_equilibrio_ventas_adicionales_pct": punto_equilibrio_pct,
        "confianza": elasticidad.get("confianza", "baja")
    }


def diagnosticar_caida_ventas(departamento: str, pais: str, conn) -> dict:
    """
    Descompone una caída de ventas en causas medibles:
    quiebres, fin de campaña, productos desaparecidos.
    """
    cursor = conn.cursor()

    cursor.execute("""
        SELECT DISTINCT mes, anio FROM ventas_mes
        WHERE pais = ? ORDER BY anio DESC, mes DESC
    """, (pais,))
    periodos = cursor.fetchall()
    if len(periodos) < 2:
        return {"error": "Se necesitan al menos 2 meses de ventas cargadas"}

    (mes_actual, anio_actual), (mes_anterior, anio_anterior) = periodos[0], periodos[1]

    def ventas_depto(mes, anio):
        cursor.execute("""
            SELECT v.sku, v.descripcion, v.venta_total, am.precio_unitario
            FROM ventas_mes v
            LEFT JOIN articulos_maestro am ON am.sku = v.sku AND am.pais = v.pais
            WHERE v.mes = ? AND v.anio = ? AND v.pais = ?
            AND am.departamento = ?
        """, (mes, anio, pais, departamento))
        return {r[0]: {"desc": r[1], "unidades": float(r[2] or 0), "precio": float(r[3] or 0)}
                for r in cursor.fetchall()}

    actual = ventas_depto(mes_actual, anio_actual)
    anterior = ventas_depto(mes_anterior, anio_anterior)

    total_actual = sum(v["unidades"] for v in actual.values())
    total_anterior = sum(v["unidades"] for v in anterior.values())
    variacion_total = round(((total_actual - total_anterior) / total_anterior) * 100, 1) if total_anterior > 0 else 0

    caidas = []
    for sku, datos in anterior.items():
        if sku in actual:
            cambio = actual[sku]["unidades"] - datos["unidades"]
            if cambio < 0:
                caidas.append({
                    "sku": sku,
                    "descripcion": datos["desc"],
                    "caida_unidades": abs(cambio),
                    "pct": round((abs(cambio) / datos["unidades"]) * 100, 1) if datos["unidades"] > 0 else 0
                })

    caidas.sort(key=lambda x: x["caida_unidades"], reverse=True)

    cursor.execute("""
        SELECT DISTINCT dd.sku FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE d.activa = 0 AND dd.pais = ?
        AND MONTH(d.fecha_fin) = ? AND YEAR(d.fecha_fin) = ?
    """, (pais, mes_anterior, anio_anterior))
    fin_campana = {r[0] for r in cursor.fetchall()}
    skus_con_caida = {c["sku"] for c in caidas}
    caida_por_fin_campana = [c for c in caidas if c["sku"] in fin_campana]

    cursor.execute("""
        SELECT sku FROM articulos_sucursales
        WHERE pais = ? AND disponible = 0 AND consumo_mensual > 0
        AND sku IN ({})
    """.format(",".join(f"'{s}'" for s in skus_con_caida) if skus_con_caida else "'0'"),
    (pais,))
    en_quiebre = {r[0] for r in cursor.fetchall()}
    caida_por_quiebre = [c for c in caidas if c["sku"] in en_quiebre]

    return {
        "departamento": departamento,
        "periodo_actual": f"{mes_actual}/{anio_actual}",
        "periodo_anterior": f"{mes_anterior}/{anio_anterior}",
        "variacion_total_pct": variacion_total,
        "unidades_actual": total_actual,
        "unidades_anterior": total_anterior,
        "top_caidas": caidas[:5],
        "caida_por_fin_de_campana": caida_por_fin_campana[:3],
        "caida_por_quiebre_stock": caida_por_quiebre[:3],
        "skus_desaparecidos": [sku for sku in anterior if sku not in actual][:5]
    }


def brief_comercial_del_dia(pais: str, conn) -> dict:
    """
    Alertas priorizadas del día para el comercial.
    Se llama automáticamente al abrir el asistente.
    """
    cursor = conn.cursor()
    alertas = []

    # 1. Quiebres en productos en campaña activa
    cursor.execute("""
        SELECT COUNT(DISTINCT dd.sku) FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        INNER JOIN articulos_sucursales asuc ON asuc.sku = dd.sku AND asuc.pais = dd.pais
        WHERE d.activa = 1 AND dd.pais = ? AND asuc.disponible = 0
    """, (pais,))
    quiebres = cursor.fetchone()[0]
    if quiebres > 0:
        alertas.append({
            "prioridad": 1,
            "tipo": "quiebre_en_campana",
            "mensaje": f"{quiebres} SKU(s) en campaña activa sin stock en tienda",
            "accion": "Verificar reposición urgente"
        })

    # 2. Capital inmovilizado con margen para descontar
    cursor.execute("""
        SELECT COUNT(*), SUM((asuc.existencia - am.maximo) * am.precio_unitario)
        FROM articulos_sucursales asuc
        INNER JOIN articulos_maestro am ON am.sku = asuc.sku AND am.pais = asuc.pais
        WHERE asuc.pais = ? AND am.maximo > 0 AND asuc.existencia > am.maximo
        AND am.precio_unitario > 0
        AND ((am.precio_unitario - ISNULL(am.costo_unitario, 0)) / am.precio_unitario) > 0.15
    """, (pais,))
    fila = cursor.fetchone()
    skus_sobre = fila[0] or 0
    monto_sobre = float(fila[1] or 0)
    if skus_sobre > 0 and monto_sobre > 0:
        alertas.append({
            "prioridad": 2,
            "tipo": "capital_inmovilizado",
            "mensaje": f"{skus_sobre} SKUs con sobre-stock liquidable (capital estimado: {round(monto_sobre):,})",
            "accion": "Evaluar descuentos para liberar capital"
        })

    # 3. Top oportunidad sin explotar
    cursor.execute("""
        SELECT TOP 1 am.departamento, COUNT(DISTINCT v.sku) as codigos,
               SUM(v.venta_total) as unidades
        FROM ventas_mes v
        INNER JOIN articulos_maestro am ON am.sku = v.sku AND am.pais = v.pais
        WHERE v.pais = ?
        AND NOT EXISTS (
            SELECT 1 FROM dinamica_detalle dd WHERE dd.sku = v.sku AND dd.activo = 1
        )
        AND am.departamento IS NOT NULL
        GROUP BY am.departamento
        ORDER BY unidades DESC
    """, (pais,))
    oport = cursor.fetchone()
    if oport:
        alertas.append({
            "prioridad": 3,
            "tipo": "oportunidad_sin_explotar",
            "mensaje": f"{oport[0]}: {oport[1]} códigos vendiendo sin campaña ({int(oport[2]):,} uds último mes)",
            "accion": "Candidatos para próxima dinámica"
        })

    # 4. Descuentos activos sin ventas registradas
    cursor.execute("""
        SELECT COUNT(DISTINCT dd.sku) FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        LEFT JOIN ventas_mes v ON v.sku = dd.sku AND v.pais = dd.pais
        WHERE d.activa = 1 AND dd.pais = ?
        AND (v.venta_total IS NULL OR v.venta_total < 1)
    """, (pais,))
    sin_venta = cursor.fetchone()[0]
    if sin_venta > 0:
        alertas.append({
            "prioridad": 4,
            "tipo": "descuento_sin_venta",
            "mensaje": f"{sin_venta} SKU(s) en campaña activa sin ventas registradas",
            "accion": "Revisar ubicación, precio o pertinencia"
        })

    # 5. Campaña por vencer pronto
    cursor.execute("""
        SELECT TOP 1 d.nombre, DATEDIFF(DAY, GETDATE(), d.fecha_fin) as dias
        FROM dinamicas d
        WHERE d.activa = 1 AND d.pais = ?
        AND DATEDIFF(DAY, GETDATE(), d.fecha_fin) BETWEEN 0 AND 5
        ORDER BY dias ASC
    """, (pais,))
    vence = cursor.fetchone()
    if vence:
        alertas.append({
            "prioridad": 5,
            "tipo": "campana_por_vencer",
            "mensaje": f"'{vence[0]}' vence en {vence[1]} día(s)",
            "accion": "Decidir si renovar o cerrar"
        })

    return {
        "alertas": sorted(alertas, key=lambda x: x["prioridad"]),
        "pais": pais,
        "total_alertas": len(alertas)
    }


def obtener_fechas_comerciales_pais(pais: str) -> str:
    """
    Fechas comerciales de las próximas 4 semanas para el país.
    """
    from datetime import datetime

    FECHAS_FIJAS = {
        "CR": [
            (1, 1, "Año Nuevo"), (4, 11, "Juan Santamaría"),
            (5, 1, "Día del Trabajador"), (7, 25, "Anexión de Guanacaste"),
            (8, 2, "Virgen de los Ángeles"), (8, 15, "Día de la Madre"),
            (9, 15, "Independencia"), (10, 12, "Día de las Culturas"),
            (12, 25, "Navidad"),
        ],
        "GT": [
            (1, 1, "Año Nuevo"), (5, 1, "Día del Trabajador"),
            (5, 10, "Día de la Madre"), (6, 30, "Día del Ejército"),
            (9, 15, "Independencia"), (10, 20, "Día de la Revolución"),
            (11, 1, "Todos los Santos"), (12, 25, "Navidad"),
        ],
        "SV": [
            (1, 1, "Año Nuevo"), (5, 1, "Día del Trabajador"),
            (5, 10, "Día de la Madre"), (8, 6, "Fiestas Agostinas"),
            (9, 15, "Independencia"), (11, 2, "Día de los Difuntos"),
            (12, 25, "Navidad"),
        ],
    }

    hoy = datetime.now()
    fechas_pais = FECHAS_FIJAS.get(pais, [])
    proximas = []

    for mes, dia, nombre in fechas_pais:
        for anio in [hoy.year, hoy.year + 1]:
            try:
                fecha = datetime(anio, mes, dia)
                dias_restantes = (fecha.date() - hoy.date()).days
                if 0 <= dias_restantes <= 28:
                    proximas.append((dias_restantes, nombre, fecha.strftime("%d/%m/%Y")))
            except ValueError:
                pass

    if not proximas:
        return ""

    proximas.sort()
    pais_label = {"CR": "Costa Rica", "GT": "Guatemala", "SV": "El Salvador"}.get(pais, pais)
    resultado = f"\n=== FECHAS COMERCIALES PRÓXIMAS — {pais_label} ===\n"
    for dias, nombre, fecha_str in proximas:
        urgencia = "🔴 URGENTE" if dias <= 5 else "🟡 PRÓXIMO" if dias <= 14 else "🟢 EN VISTA"
        resultado += f"{urgencia} {nombre}: {fecha_str} (en {dias} días)\n"
    return resultado


def obtener_categorias_por_fecha_comercial(nombre_fecha: str, pais: str, conn) -> str:
    """
    Para una fecha comercial dada, devuelve SKUs con stock disponible
    de las categorías que históricamente responden a esa fecha.
    """
    cursor = conn.cursor()

    MAPA_FECHAS = {
        "madre": ["Hogar", "Textiles", "Decoración", "Jardín", "Cocina", "Electrohogar"],
        "padre": ["Herramientas", "Ferretería", "Electrónica", "Jardín", "Deportes"],
        "navidad": ["Decoración", "Hogar", "Iluminación", "Electrohogar"],
        "año nuevo": ["Decoración", "Hogar", "Iluminación", "Outdoor"],
        "trabajador": ["Herramientas", "Ferretería", "Seguridad Industrial"],
        "independencia": ["Decoración", "Hogar", "Iluminación"],
        "difuntos": ["Decoración", "Jardinería", "Iluminación"],
        "santos": ["Decoración", "Jardinería", "Iluminación"],
        "agostinas": ["Hogar", "Electrohogar", "Decoración"],
    }

    nombre_lower = nombre_fecha.lower()
    categorias = []
    for clave, cats in MAPA_FECHAS.items():
        if clave in nombre_lower:
            categorias = cats
            break

    if not categorias:
        return ""

    cats_str = "','".join(categorias)
    cursor.execute(f"""
        SELECT TOP 8 am.sku, am.descripcion, am.departamento,
               am.precio_unitario, am.costo_unitario,
               ISNULL(SUM(asuc.existencia), 0) as stock_total
        FROM articulos_maestro am
        LEFT JOIN articulos_sucursales asuc ON asuc.sku = am.sku AND asuc.pais = am.pais
        WHERE am.departamento IN ('{cats_str}')
        AND am.pais = ? AND am.estado = 'Vigente'
        AND NOT EXISTS (
            SELECT 1 FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.sku = am.sku AND d.activa = 1 AND dd.activo = 1
        )
        GROUP BY am.sku, am.descripcion, am.departamento,
                 am.precio_unitario, am.costo_unitario
        HAVING ISNULL(SUM(asuc.existencia), 0) > 10
        ORDER BY stock_total DESC
    """, (pais,))

    skus = cursor.fetchall()
    if not skus:
        return ""

    resultado = f"\n=== SKUs DISPONIBLES PARA {nombre_fecha.upper()} (sin campaña activa) ===\n"
    for sku, desc, depto, precio, costo, stock in skus:
        precio_f = float(precio) if precio else 0
        costo_f = float(costo) if costo else 0
        margen = round(((precio_f - costo_f) / precio_f) * 100, 1) if precio_f > 0 and costo_f > 0 else None
        margen_txt = f" | Margen: {margen}%" if margen else ""
        resultado += f"SKU {sku} | {desc} | {depto} | Stock: {int(stock)} uds | Precio: {precio_f}{margen_txt}\n"
    return resultado


def construir_propuesta_campana(motivo: str, skus_candidatos: list, pais: str, conn) -> dict:
    """
    Construye una propuesta de campaña ejecutable con descuentos
    simulados, duración recomendada y estimación de impacto.
    """
    cursor = conn.cursor()
    articulos_propuesta = []

    for sku in skus_candidatos[:8]:
        cursor.execute("""
            SELECT am.sku, am.descripcion, am.departamento,
                   am.precio_unitario, am.costo_unitario,
                   ISNULL(SUM(asuc.existencia), 0) as stock
            FROM articulos_maestro am
            LEFT JOIN articulos_sucursales asuc ON asuc.sku = am.sku AND asuc.pais = am.pais
            WHERE am.sku = ? AND am.pais = ?
            GROUP BY am.sku, am.descripcion, am.departamento,
                     am.precio_unitario, am.costo_unitario
        """, (sku, pais))
        fila = cursor.fetchone()
        if not fila:
            continue

        sku_c, desc, depto, precio, costo, stock = fila
        precio_f = float(precio) if precio else 0
        costo_f = float(costo) if costo else 0

        if precio_f <= 0:
            continue

        margen_actual = ((precio_f - costo_f) / precio_f) * 100 if costo_f > 0 else None

        # Descuento máximo que mantiene margen >= 15%
        if margen_actual and margen_actual > 15:
            descuento_sugerido = min(round(margen_actual - 15, 0), 20)
        else:
            descuento_sugerido = 5

        precio_dinamica = round(precio_f * (1 - descuento_sugerido / 100), 2)
        margen_con_descuento = round(
            ((precio_dinamica - costo_f) / precio_dinamica) * 100, 1
        ) if costo_f > 0 and precio_dinamica > 0 else None

        cursor.execute("""
            SELECT AVG(venta_total) FROM ventas_mes
            WHERE sku = ? AND pais = ?
        """, (sku, pais))
        venta_base = float(cursor.fetchone()[0] or 0)
        ventas_estimadas = round(venta_base * 1.2, 0)

        articulos_propuesta.append({
            "sku": str(sku_c),
            "descripcion": desc,
            "departamento": depto,
            "precio_regular": precio_f,
            "precio_dinamica": precio_dinamica,
            "descuento_pct": descuento_sugerido,
            "margen_regular_pct": round(margen_actual, 1) if margen_actual else None,
            "margen_con_descuento_pct": margen_con_descuento,
            "stock_disponible": int(stock),
            "venta_base_mensual": venta_base,
            "venta_estimada_en_campana": ventas_estimadas,
        })

    if not articulos_propuesta:
        return {"error": "No se encontraron SKUs válidos para la propuesta"}

    DURACION_POR_MOTIVO = {
        "fecha_comercial": 7,
        "sobre_stock": 21,
        "caida_ventas": 14,
        "oportunidad": 10,
    }
    duracion = DURACION_POR_MOTIVO.get(motivo, 14)
    total_venta_estimada = sum(a["venta_estimada_en_campana"] for a in articulos_propuesta)
    departamentos = list(set(a["departamento"] for a in articulos_propuesta if a["departamento"]))

    return {
        "motivo": motivo,
        "pais": pais,
        "duracion_recomendada_dias": duracion,
        "total_skus": len(articulos_propuesta),
        "departamentos": departamentos,
        "venta_incremental_estimada": total_venta_estimada,
        "articulos": articulos_propuesta,
        "advertencia": "Estimaciones orientativas — promedio histórico +20% conservador"
    }

# ── Definición de tools para Comercial ────────────────────

TOOLS_COMERCIAL = [
    {
        "type": "web_search_20250305",
        "name": "web_search"
    },
    {
        "name": "brief_del_dia",
        "description": "Alertas priorizadas del día: quiebres en campaña, capital inmovilizado, oportunidades sin explotar, descuentos sin impacto, campañas por vencer. Llamá SIEMPRE cuando el usuario salude, diga 'hola', o abra el chat sin pregunta específica.",
        "input_schema": {"type": "object", "properties": {}, "required": []}
    },
    {
        "name": "diagnosticar_caida",
        "description": "Descompone una caída de ventas en causas medibles: quiebres, fin de campaña, SKUs desaparecidos. Úsala cuando pregunten por qué bajó un departamento o categoría.",
        "input_schema": {
            "type": "object",
            "properties": {
                "departamento": {"type": "string", "description": "Nombre del departamento a analizar"}
            },
            "required": ["departamento"]
        }
    },
    {
        "name": "simular_descuento",
        "description": "Simula aplicar un descuento a un SKU: margen resultante, ventas esperadas y punto de equilibrio. Úsala cuando pregunten si conviene descontar o qué pasa si bajan el precio.",
        "input_schema": {
            "type": "object",
            "properties": {
                "sku": {"type": "string"},
                "descuento_pct": {"type": "number", "description": "Porcentaje (ej: 15 para 15%)"}
            },
            "required": ["sku", "descuento_pct"]
        }
    },
    {
        "name": "elasticidad_sku",
        "description": "Calcula cómo responde históricamente un SKU a estar en campaña: incremento de ventas promedio y confianza. Úsala cuando pregunten si un producto responde bien a las promociones.",
        "input_schema": {
            "type": "object",
            "properties": {
                "sku": {"type": "string"}
            },
            "required": ["sku"]
        }
    },
    {
        "name": "generar_propuesta_campana",
        "description": "Construye una propuesta de campaña lista para ejecutar con SKUs, descuentos simulados, duración y estimación de impacto. Úsala cuando pidan armar una campaña para una fecha especial, liquidar sobre-stock, o atacar una caída de ventas.",
        "input_schema": {
            "type": "object",
            "properties": {
                "motivo": {
                    "type": "string",
                    "enum": ["fecha_comercial", "sobre_stock", "caida_ventas", "oportunidad"],
                    "description": "Razón de la campaña"
                },
                "skus": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "SKUs candidatos. Si no se especifican, se toman los mejores del sistema."
                },
                "departamento": {"type": "string", "description": "Departamento a enfocar (opcional)"}
            },
            "required": ["motivo"]
        }
    },
    {
        "name": "capital_inmovilizado",
        "description": "Calcula el monto de capital en sobre-stock y cuáles tienen margen para descontar sin perder plata. Úsala cuando pregunten por sobre-stock o capital parado.",
        "input_schema": {
            "type": "object",
            "properties": {
                "departamento": {"type": "string"}
            },
            "required": []
        }
    }
]


def ejecutar_tool(tool_name: str, tool_input: dict, pais: str, conn) -> str:
    """Ejecuta la herramienta pedida por la IA y devuelve JSON."""
    try:
        if tool_name == "brief_del_dia":
            resultado = brief_comercial_del_dia(pais, conn)

        elif tool_name == "diagnosticar_caida":
            resultado = diagnosticar_caida_ventas(tool_input["departamento"], pais, conn)

        elif tool_name == "simular_descuento":
            resultado = simular_descuento(
                tool_input["sku"], tool_input["descuento_pct"], pais, conn
            )

        elif tool_name == "elasticidad_sku":
            resultado = calcular_elasticidad_sku(tool_input["sku"], pais, conn)

        elif tool_name == "generar_propuesta_campana":
            skus = tool_input.get("skus", [])
            if not skus:
                # Sin SKUs especificados: tomar los mejores candidatos
                from app.routers.admin_pais import _calcular_candidatos_proxima_campana
                candidatos = _calcular_candidatos_proxima_campana(
                    pais, 20, 1, tool_input.get("departamento")
                )
                skus = [str(c["sku"]) for c in candidatos.get("candidatos", [])[:8]]

            resultado = construir_propuesta_campana(
                tool_input.get("motivo", "oportunidad"), skus, pais, conn
            )

        elif tool_name == "capital_inmovilizado":
            from app.routers.admin_pais import _calcular_sobre_stock_departamento
            resultado = _calcular_sobre_stock_departamento(
                pais, "", tool_input.get("departamento"), None
            )

        else:
            resultado = {"error": f"Herramienta '{tool_name}' no reconocida"}

        return json.dumps(resultado, ensure_ascii=False, default=str)

    except Exception as e:
        error_str = str(e)
        app_logger.warning(f"[preguntar] Error: {e}")
        if "credit balance is too low" in error_str:
            raise HTTPException(
                status_code=402,
                detail="Sin créditos disponibles en la API de IA. Contactá al administrador del sistema."
            )
        raise HTTPException(
            status_code=504,
            detail="El asistente tardó demasiado en responder o no está disponible. Intentá de nuevo."
        )



@router.post("/conversaciones/{conv_id}/mensaje")
@limiter_usuario.limit("20/minute")
def enviar_mensaje(request: Request, conv_id: int, query: ArticuloQuery, usuario=Depends(verificar_token)):
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
    # Superadmin ahora elige un país específico para evitar mezclar
    # SKUs entre países (el mismo número de SKU puede ser un producto
    # distinto en cada país — sin este filtro, el contexto anterior
    # mezclaba datos de países diferentes bajo el mismo código).
    if usuario["rol"] == "superadmin":
        if not query.pais_seleccionado:
            raise HTTPException(status_code=400, detail="Falta indicar el país a consultar")
        pais_ctx = query.pais_seleccionado
    else:
        pais_ctx = usuario["pais"]

    verificar_limite_tokens(pais_ctx, usuario["rol"])

    contexto_dinamicas = obtener_contexto_dinamicas(pais_ctx, conn)
    contexto_completo = contexto_dinamicas

    # Para Comercial: agregar fechas comerciales siempre
    if usuario["rol"] == "comercial":
        fechas_ctx = obtener_fechas_comerciales_pais(pais_ctx)
        contexto_completo += fechas_ctx
        # Si hay fecha urgente (≤5 días), agregar SKUs disponibles para esa fecha
        if "🔴 URGENTE" in fechas_ctx:
            for linea in fechas_ctx.split("\n"):
                if "🔴 URGENTE" in linea and ":" in linea:
                    nombre_fecha = linea.replace("🔴 URGENTE", "").split(":")[0].strip()
                    contexto_completo += obtener_categorias_por_fecha_comercial(
                        nombre_fecha, pais_ctx, conn
                    )
                    break

        # Tendencias — solo si la pregunta parece pedirlo, para no
    # inflar el contexto (y el costo) en cada mensaje
    pregunta_lower = query.pregunta.lower()
    palabras_tendencia = ['tendencia', 'cómo va', 'como va', 'creciendo', 'cayendo', 'bajando', 'subiendo', 'variación', 'variacion']
    if any(p in pregunta_lower for p in palabras_tendencia):
        contexto_completo += obtener_tendencia_departamentos(pais_ctx, conn)

    # Layout de tienda — solo si preguntan por ubicación Y mencionan
    # un código de tienda de 2 dígitos en la pregunta
    palabras_ubicacion = ['dónde', 'donde', 'ubicación', 'ubicacion', 'poner', 'colocar', 'acomodo', 'exhibir', 'exhibición', 'exhibicion']
    if any(p in pregunta_lower for p in palabras_ubicacion):
        tienda_mencion = re.findall(r'\b\d{2}\b', query.pregunta)
        if tienda_mencion:
            contexto_completo += obtener_contexto_layout(tienda_mencion[0], pais_ctx or usuario["pais"], conn)

    # Inventario — la función ya filtra internamente por palabras
    # clave (stock, existencia, cobertura, etc.), se llama siempre
    contexto_completo += obtener_contexto_inventario(query.pregunta, pais_ctx, conn)

    # Calidad de datos — exclusivo de Planning
    if usuario["rol"] == "planning":
        contexto_completo += obtener_contexto_calidad_datos(query.pregunta, pais_ctx, conn)

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

    # ── Llamar a Claude con tool use ─────────────────────
    try:
        tools_activas = TOOLS_COMERCIAL if usuario["rol"] == "comercial" else []

        respuesta = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=system_prompt,
            messages=messages,
            tools=tools_activas if tools_activas else []
        )

        # Ciclo de tool use — máximo 4 iteraciones
        messages_con_tools = list(messages)
        iteraciones = 0
        while respuesta.stop_reason == "tool_use" and iteraciones < 4:
            iteraciones += 1

            messages_con_tools.append({
                "role": "assistant",
                "content": respuesta.content
            })

            tool_results = []
            for bloque in respuesta.content:
                if bloque.type == "tool_use":
                    if bloque.name == "web_search":
                        # web_search lo maneja Anthropic internamente
                        # solo necesitamos un tool_result placeholder
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": bloque.id,
                            "content": "Búsqueda web ejecutada"
                        })
                    else:
                        resultado_tool = ejecutar_tool(
                            bloque.name, bloque.input, pais_ctx, conn
                        )
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": bloque.id,
                            "content": resultado_tool
                        })

            if tool_results:
                messages_con_tools.append({
                    "role": "user",
                    "content": tool_results
                })

            respuesta = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                system=system_prompt,
                messages=messages_con_tools,
                tools=tools_activas
            )

        texto_respuesta = next(
            (b.text for b in respuesta.content if hasattr(b, "text")),
            "No pude generar una respuesta en este momento."
        )
        tokens_usados = respuesta.usage.input_tokens + respuesta.usage.output_tokens

    except Exception as e:
        app_logger.warning(f"[preguntar] Error: {e}")
        raise HTTPException(
            status_code=504,
            detail="El asistente tardó demasiado en responder o no está disponible. Intentá de nuevo."
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
            INSERT INTO consultas_log (usuario_id, pregunta, respuesta, tokens_usados, pais_consultado)
            VALUES (?, ?, ?, ?, ?)
        """, (usuario["id"], query.pregunta, texto_respuesta, tokens_usados, pais_ctx))
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
        app_logger.warning(f"[enviar_mensaje] Error actualizando perfil: {e}")

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
        app_logger.warning(f"[eliminar_conversacion] Error: {e}")
        raise HTTPException(status_code=400, detail="No se pudo eliminar la conversación")
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
            app_logger.warning(f"[guardar_email] Error enviando email de confirmación: {e}")

        return {
            "mensaje": "Email guardado correctamente",
            "nombre_extraido": nombre_completo,
            "pais_detectado": pais_email,
            "email": email
        }
    
    except Exception as e:
        app_logger.warning(f"[guardar_email] Error: {e}")
        raise HTTPException(status_code=400, detail="No se pudo guardar el email")
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
        app_logger.warning(f"[omitir_email] Error: {e}")
        raise HTTPException(status_code=400, detail="No se pudo guardar la preferencia")
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
        app_logger.warning(f"[guardar_personalizacion] Error: {e}")
        raise HTTPException(status_code=400, detail="No se pudo guardar la personalización")
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
        system_prompt = f"""Eres {nombre_asistente}, el asistente IA de PromoIQ para PromoIQ.
Generá un saludo de bienvenida MUY breve, tipo notificación (máximo 1 línea, 12 palabras).
Solo el saludo con el nombre — sin ofrecer ayuda ni mencionar historial.
Respondé en español, tono cálido y directo.
NO uses asteriscos ni markdown. Solo texto plano."""
        user_prompt = f"{saludo} — generá el saludo corto para {primer_nombre}."
        max_tokens_msg = 40
        templates = TEMPLATES_BIENVENIDA_TOAST
    else:
        system_prompt = f"""Eres {nombre_asistente}, el asistente IA personalizado de PromoIQ para PromoIQ.
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
        app_logger.warning(f"[generar_bienvenida] Error generando con IA ({contexto}): {e}")
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
        app_logger.warning(f"[generar_despedida] Error generando con IA: {e}")
        template = TEMPLATES_DESPEDIDA.get(usuario["rol"], TEMPLATES_DESPEDIDA["comercial"])
        mensaje_final = template.format(nombre=nombre_corto)

    return {
        "mensaje": mensaje_final,
        "nombre_usuario": nombre_corto
    }
