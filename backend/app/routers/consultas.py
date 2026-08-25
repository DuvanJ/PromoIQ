# ============================================================
# Router: consultas.py
# Descripción: Chat IA general — enfocado en dinámicas comerciales
# Uso principal: consultas de tiendas sobre artículos y campañas activas
# ============================================================

from fastapi import APIRouter, HTTPException, Depends
from app.database import get_connection
from app.auth import verificar_token
from app.models import ArticuloQuery
from anthropic import Anthropic
import os
import re
from dotenv import load_dotenv
from datetime import datetime, timedelta
import calendar



load_dotenv()

router = APIRouter(prefix="/consultas", tags=["Consultas IA"])
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


# ── Ficha técnica de artículo por SKU ─────────────────────
CAMPOS_TIENDA = ['sku', 'descripcion', 'estado', 'departamento', 'familia', 'linea', 'minimo', 'maximo', 'case_pack']

def buscar_articulo_contexto(pregunta: str, usuario: dict) -> str:
    """
    Detecta si la pregunta menciona un SKU (4-8 dígitos), busca su ficha técnica
    en el catálogo maestro con los campos definidos para consultas de tienda,
    indica si está actualmente en campaña activa, y si no hay SKU numérico,
    intenta una búsqueda por texto en la descripción.
    """
    pais = usuario["pais"]
    rol = usuario["rol"]
    tienda = usuario["tienda"]

    conn = get_connection()
    cursor = conn.cursor()
    resultado = ""

    skus_detectados = re.findall(r'\b\d{4,8}\b', pregunta)

    for sku in skus_detectados[:3]:
        filtro_pais = "AND pais = ?" if pais and rol != "superadmin" else ""
        params = (sku, pais) if pais and rol != "superadmin" else (sku,)

        cursor.execute(f"""
            SELECT TOP 1 sku, descripcion, estado, departamento, familia, linea,
                   minimo, maximo, case_pack, pais
            FROM articulos_maestro
            WHERE sku = ? {filtro_pais}
        """, params)
        art = cursor.fetchone()

        if not art:
            resultado += f"\n[SKU {sku} no encontrado en el catálogo maestro de {pais or 'ningún país'}]\n"
            continue

        resultado += f"\n[Ficha técnica — SKU {sku}]\n"
        resultado += (
            f"SKU: {art[0]}\n"
            f"Descripción: {art[1]}\n"
            f"Estado: {art[2] or 'No especificado'}\n"
            f"Departamento: {art[3] or 'No especificado'}\n"
            f"Familia: {art[4] or 'No especificado'}\n"
            f"Línea: {art[5] or 'No especificado'}\n"
            f"Mínimo: {art[6] if art[6] is not None else 'No especificado'}\n"
            f"Máximo: {art[7] if art[7] is not None else 'No especificado'}\n"
            f"Case Pack: {art[8] if art[8] is not None else 'No especificado'}\n"
        )

        # ── Estado de campaña activa para este SKU ──
        if rol == "tiendas" and tienda:
            cursor.execute("""
                SELECT d.nombre, dd.precio_dinamica, dd.ubicacion_dinamica, dd.tipo_campana,
                       d.fecha_inicio, d.fecha_fin
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                WHERE dd.sku = ? AND dd.activo = 1 AND d.activa = 1
                AND dd.tienda LIKE ?
            """, (sku, f'{tienda}%'))
        else:
            filtro_pais_d = "AND dd.pais = ?" if pais and rol != "superadmin" else ""
            params_d = (sku, pais) if pais and rol != "superadmin" else (sku,)
            cursor.execute(f"""
                SELECT d.nombre, dd.precio_dinamica, dd.ubicacion_dinamica, dd.tipo_campana,
                       d.fecha_inicio, d.fecha_fin
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                WHERE dd.sku = ? AND dd.activo = 1 AND d.activa = 1
                {filtro_pais_d}
            """, params_d)

        campanas_activas = cursor.fetchall()
        if campanas_activas:
            resultado += "\nEstado: ACTUALMENTE EN CAMPAÑA ACTIVA\n"
            for c in campanas_activas:
                resultado += (
                    f"  - Dinámica: {c[0]} | Precio dinámica: ${c[1]} "
                    f"| Ubicación: {c[2]} | Tipo: {c[3]} | Vigencia: {c[4]} a {c[5]}\n"
                )
        else:
            resultado += "\nEstado: NO está en ninguna campaña activa actualmente.\n"

    # ── Búsqueda por texto si no se detectó SKU numérico ──
    if not skus_detectados and len(pregunta.split()) <= 8:
        palabras_clave = [p for p in pregunta.split() if len(p) > 3][:2]
        if palabras_clave:
            termino = f"%{palabras_clave[0]}%"
            filtro_pais_t = "AND pais = ?" if pais and rol != "superadmin" else ""
            params_t = (termino, pais) if pais and rol != "superadmin" else (termino,)
            cursor.execute(f"""
                SELECT TOP 5 sku, descripcion, estado, departamento
                FROM articulos_maestro
                WHERE descripcion LIKE ? {filtro_pais_t}
            """, params_t)
            coincidencias = cursor.fetchall()
            if coincidencias:
                resultado += "\n[Posibles coincidencias en catálogo por descripción]\n"
                for c in coincidencias:
                    resultado += f"  - SKU {c[0]}: {c[1]} | Estado: {c[2]} | Departamento: {c[3]}\n"

    conn.close()
    return resultado


# ── Reportes agregados de dinámicas activas ───────────────
PALABRAS_REPORTE = {
    "ubicacion": ["ubicación", "ubicacion", "isla", "cabecera", "góndola", "gondola", "botadero", "punta de góndola"],
    "departamento": ["departamento", "departamentos"],
    "tipo_campana": ["tipo de campaña", "tipo de campana", "tipo de dinámica", "tipo de dinamica", "campañas"],
}

def detectar_tipo_reporte(pregunta: str) -> str:
    """Detecta si la pregunta pide un reporte agregado, y de qué tipo."""
    pregunta_lower = pregunta.lower()
    palabras_reporte_generico = ["reporte", "resumen", "cuántos", "cuantos", "cuántas", "cuantas", "por"]

    if not any(p in pregunta_lower for p in palabras_reporte_generico):
        return None

    for tipo, palabras in PALABRAS_REPORTE.items():
        if any(p in pregunta_lower for p in palabras):
            return tipo

    return None

def obtener_reporte_dinamicas(tipo: str, usuario: dict) -> str:
    """
    Genera un reporte agregado de artículos en dinámica activa,
    agrupado por ubicación, departamento o tipo de campaña.
    """
    pais = usuario["pais"]
    rol = usuario["rol"]
    tienda = usuario["tienda"]

    conn = get_connection()
    cursor = conn.cursor()
    resultado = ""

    if tipo == "ubicacion":
        if rol == "tiendas" and tienda:
            cursor.execute("""
                SELECT dd.ubicacion_dinamica, COUNT(*) as total
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                WHERE dd.activo = 1 AND d.activa = 1 AND dd.tienda LIKE ?
                GROUP BY dd.ubicacion_dinamica
                ORDER BY total DESC
            """, (f'{tienda}%',))
        else:
            filtro_pais = "AND dd.pais = ?" if pais and rol != "superadmin" else ""
            params = (pais,) if pais and rol != "superadmin" else ()
            cursor.execute(f"""
                SELECT dd.ubicacion_dinamica, COUNT(*) as total
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                WHERE dd.activo = 1 AND d.activa = 1 {filtro_pais}
                GROUP BY dd.ubicacion_dinamica
                ORDER BY total DESC
            """, params)
        filas = cursor.fetchall()
        resultado = "\n[Reporte: artículos en dinámica activa por UBICACIÓN]\n"
        for f in filas:
            resultado += f"  - {f[0] or 'Sin ubicación'}: {f[1]} artículos\n"

    elif tipo == "tipo_campana":
        if rol == "tiendas" and tienda:
            cursor.execute("""
                SELECT dd.tipo_campana, COUNT(*) as total
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                WHERE dd.activo = 1 AND d.activa = 1 AND dd.tienda LIKE ?
                GROUP BY dd.tipo_campana
                ORDER BY total DESC
            """, (f'{tienda}%',))
        else:
            filtro_pais = "AND dd.pais = ?" if pais and rol != "superadmin" else ""
            params = (pais,) if pais and rol != "superadmin" else ()
            cursor.execute(f"""
                SELECT dd.tipo_campana, COUNT(*) as total
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                WHERE dd.activo = 1 AND d.activa = 1 {filtro_pais}
                GROUP BY dd.tipo_campana
                ORDER BY total DESC
            """, params)
        filas = cursor.fetchall()
        resultado = "\n[Reporte: artículos en dinámica activa por TIPO DE CAMPAÑA]\n"
        for f in filas:
            resultado += f"  - {f[0] or 'Sin tipo'}: {f[1]} artículos\n"

    elif tipo == "departamento":
        # dinamica_detalle no tiene departamento propio — se obtiene cruzando con articulos_maestro por SKU
        if rol == "tiendas" and tienda:
            cursor.execute("""
                SELECT am.departamento, COUNT(*) as total
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                LEFT JOIN articulos_maestro am ON dd.sku = am.sku AND am.pais = dd.pais
                WHERE dd.activo = 1 AND d.activa = 1 AND dd.tienda LIKE ?
                GROUP BY am.departamento
                ORDER BY total DESC
            """, (f'{tienda}%',))
        else:
            filtro_pais = "AND dd.pais = ?" if pais and rol != "superadmin" else ""
            params = (pais,) if pais and rol != "superadmin" else ()
            cursor.execute(f"""
                SELECT am.departamento, COUNT(*) as total
                FROM dinamica_detalle dd
                INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                LEFT JOIN articulos_maestro am ON dd.sku = am.sku AND am.pais = dd.pais
                WHERE dd.activo = 1 AND d.activa = 1 {filtro_pais}
                GROUP BY am.departamento
                ORDER BY total DESC
            """, params)
        filas = cursor.fetchall()
        resultado = "\n[Reporte: artículos en dinámica activa por DEPARTAMENTO]\n"
        for f in filas:
            resultado += f"  - {f[0] or 'Sin departamento (SKU no cruzó con catálogo maestro)'}: {f[1]} artículos\n"

    conn.close()
    return resultado



def obtener_rangos_meses():
    """Calcula los rangos de fecha del mes anterior, actual y siguiente."""
    hoy = datetime.now()
    primer_dia_actual = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    ultimo_dia_actual_num = calendar.monthrange(hoy.year, hoy.month)[1]
    ultimo_dia_actual = primer_dia_actual.replace(day=ultimo_dia_actual_num)

    ultimo_dia_mes_anterior = primer_dia_actual - timedelta(days=1)
    primer_dia_mes_anterior = ultimo_dia_mes_anterior.replace(day=1)

    primer_dia_mes_siguiente = ultimo_dia_actual + timedelta(days=1)
    ultimo_dia_mes_siguiente_num = calendar.monthrange(
        primer_dia_mes_siguiente.year, primer_dia_mes_siguiente.month
    )[1]
    ultimo_dia_mes_siguiente = primer_dia_mes_siguiente.replace(day=ultimo_dia_mes_siguiente_num)

    return {
        "mes_anterior": (primer_dia_mes_anterior.date(), ultimo_dia_mes_anterior.date()),
        "mes_actual": (primer_dia_actual.date(), ultimo_dia_actual.date()),
        "mes_siguiente": (primer_dia_mes_siguiente.date(), ultimo_dia_mes_siguiente.date()),
        "dias_restantes_mes": (ultimo_dia_actual.date() - hoy.date()).days,
    }


def query_dinamicas_rango(cursor, usuario, fecha_desde, fecha_hasta, campo_fecha="fecha_fin"):
    """
    Consulta dinámicas cuyo fecha_inicio o fecha_fin (según campo_fecha)
    cae dentro del rango dado, respetando el mismo filtro de rol/país/tienda
    que el resto del sistema.
    """
    rol = usuario["rol"]
    pais = usuario["pais"]
    tienda = usuario["tienda"]

    filtro_extra = ""
    params = [fecha_desde, fecha_hasta]

    if rol == "tiendas":
        filtro_extra = "AND dd.pais = ? AND dd.tienda LIKE ?"
        params += [pais, f"{tienda}%"]
    elif rol in ["admin", "comercial", "planning"]:
        filtro_extra = "AND dd.pais = ?"
        params += [pais]
    # superadmin: sin filtro adicional

    cursor.execute(f"""
        SELECT DISTINCT d.nombre, d.fecha_inicio, d.fecha_fin,
               COUNT(dd.id) OVER (PARTITION BY d.id) as total_articulos
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        WHERE dd.activo = 1
        AND d.{campo_fecha} BETWEEN ? AND ?
        {filtro_extra}
    """, params)

    return cursor.fetchall()


def obtener_contexto_temporal(usuario: dict) -> str:
    """
    Genera contexto informativo (resumen, no detalle completo) sobre
    dinámicas del mes anterior y del mes siguiente, para dar continuidad
    temporal a las consultas del asistente.
    """
    rangos = obtener_rangos_meses()
    conn = get_connection()
    cursor = conn.cursor()
    resultado = ""

    # ── Mes anterior — siempre informativo ──
    desde, hasta = rangos["mes_anterior"]
    dinamicas_anterior = query_dinamicas_rango(cursor, usuario, desde, hasta, campo_fecha="fecha_fin")
    if dinamicas_anterior:
        resultado += "\n[Dinámicas del mes anterior — información de referencia, ya finalizadas]\n"
        for d in dinamicas_anterior:
            resultado += f"  - {d[0]}: vigente del {d[1]} al {d[2]} | {d[3]} artículos\n"

    # ── Mes siguiente — solo en los últimos 5 días del mes actual ──
    if rangos["dias_restantes_mes"] <= 5:
        desde, hasta = rangos["mes_siguiente"]
        dinamicas_siguiente = query_dinamicas_rango(cursor, usuario, desde, hasta, campo_fecha="fecha_inicio")
        if dinamicas_siguiente:
            resultado += "\n[Dinámicas del próximo mes — vista previa, aún no inician]\n"
            for d in dinamicas_siguiente:
                resultado += f"  - {d[0]}: inicia el {d[1]}, vigente hasta {d[2]} | {d[3]} artículos\n"

    conn.close()
    return resultado




# ── Contexto base de dinámicas activas por rol ────────────
def obtener_contexto_por_rol(usuario: dict) -> str:
    """
    categoria y precio_regular ya no viven en dinamica_detalle —
    salen de articulos_maestro vía LEFT JOIN por SKU (LEFT porque
    un SKU en dinámica podría no estar en el catálogo vigente).
    """
    conn = get_connection()
    cursor = conn.cursor()
    rol = usuario["rol"]
    tienda = usuario["tienda"]
    pais = usuario["pais"]

    join_catalogo = """
        LEFT JOIN (
            SELECT sku, pais, MIN(categoria) as categoria, AVG(precio_unitario) as precio_unitario
            FROM articulos_maestro
            GROUP BY sku, pais
        ) am ON am.sku = dd.sku AND am.pais = dd.pais
    """

    # Superadmin ve todo sin filtro
    if rol == "superadmin":
        cursor.execute(f"""
            SELECT d.nombre, dd.sku, dd.descripcion,
                   am.precio_unitario, dd.precio_dinamica, dd.ubicacion_dinamica,
                   dd.tienda, dd.tipo_campana, am.categoria,
                   d.fecha_inicio, d.fecha_fin, dd.pais
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            {join_catalogo}
            WHERE dd.activo = 1 AND d.activa = 1
        """)

    # Admin, Comercial y Planning ven solo su país
    elif rol in ["admin", "comercial", "planning"]:
        cursor.execute(f"""
            SELECT d.nombre, dd.sku, dd.descripcion,
                   am.precio_unitario, dd.precio_dinamica, dd.ubicacion_dinamica,
                   dd.tienda, dd.tipo_campana, am.categoria,
                   d.fecha_inicio, d.fecha_fin, dd.pais
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            {join_catalogo}
            WHERE dd.activo = 1 AND d.activa = 1
            AND dd.pais = ?
        """, (pais,))

    # Tienda ve solo su país y su tienda específica
    elif rol == "tiendas":
        cursor.execute(f"""
            SELECT d.nombre, dd.sku, dd.descripcion,
                   am.precio_unitario, dd.precio_dinamica, dd.ubicacion_dinamica,
                   dd.tienda, dd.tipo_campana, am.categoria,
                   d.fecha_inicio, d.fecha_fin, dd.pais
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            {join_catalogo}
            WHERE dd.activo = 1 AND d.activa = 1
            AND dd.pais = ?
            AND dd.tienda LIKE ?
        """, (pais, f'{tienda}%',))

    articulos = cursor.fetchall()
    conn.close()

    if not articulos:
        return "No hay artículos en dinámica disponibles para tu perfil."

    if rol == "planning":
        contexto = "Información completa de trazabilidad:\n\n"
        for a in articulos:
            contexto += (
                f"- Dinámica: {a[0]} | Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio regular: ${a[3]} | Precio dinámica: ${a[4]} "
                f"| Ubicación: {a[5]} | Tienda: {a[6]} | Tipo campaña: {a[7]} "
                f"| Categoría: {a[8]} | Vigencia: {a[9]} al {a[10]} | País: {a[11]}\n"
            )

    elif rol == "comercial":
        contexto = "Información comercial y de análisis:\n\n"
        for a in articulos:
            contexto += (
                f"- Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio regular: ${a[3]} | Precio dinámica: ${a[4]} "
                f"| Ahorro: ${round((a[3] or 0) - (a[4] or 0), 2)} "
                f"| Ubicación: {a[5]} | Tienda: {a[6]} "
                f"| Tipo campaña: {a[7]} | Categoría: {a[8]}\n"
            )

    elif rol == "tiendas":
        contexto = f"Información de dinámicas para tu tienda ({tienda}):\n\n"
        for a in articulos:
            contexto += (
                f"- Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio dinámica: ${a[4]} "
                f"| Ubicación en tienda: {a[5]} "
                f"| Tipo campaña: {a[7]}\n"
            )

    elif rol == "superadmin":
        contexto = "Información completa de todos los países:\n\n"
        for a in articulos:
            contexto += (
                f"- País: {a[11]} | Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio regular: ${a[3]} | Precio dinámica: ${a[4]} "
                f"| Ubicación: {a[5]} | Tienda: {a[6]} "
                f"| Tipo campaña: {a[7]} | Categoría: {a[8]}\n"
            )

    else:
        contexto = "Información general de dinámicas:\n\n"
        for a in articulos:
            contexto += (
                f"- Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio regular: ${a[3]} | Precio dinámica: ${a[4]} "
                f"| Ubicación: {a[5]} | Tienda: {a[6]} "
                f"| Tipo campaña: {a[7]}\n"
            )

    return contexto


# ── System prompts por rol ─────────────────────────────────
def get_system_prompt(rol: str, nombre: str, pais: str) -> str:
    paises = {"CR": "Costa Rica", "GT": "Guatemala", "SV": "El Salvador", "": "todos los países"}
    nombre_pais = paises.get(pais, pais)

    prompts = {
        "superadmin": f"""Eres el asistente de PromoIQ para {nombre}, Super Administrador.
Tenés acceso completo a la información de todos los países (Costa Rica, Guatemala y El Salvador).
Respondé siempre en español, de forma clara y organizada.
Nunca inventes información — solo usá los datos disponibles.
Si no encontrás algo específico que te preguntan, decilo con claridad y ofrecé una alternativa útil:
sugerí revisar el SKU exacto, preguntar por categoría, o aclarar que ese artículo podría no estar
en dinámica activa en este momento pero sí en el catálogo general. Nunca respondas solo "no existe"
sin dar ningún contexto o siguiente paso.""",

        "admin": f"""Eres el asistente de PromoIQ para {nombre}, Administrador de {nombre_pais}.
Tenés acceso completo a la información de dinámicas comerciales de {nombre_pais}.
Respondé siempre en español, de forma clara y organizada.
Nunca inventes información — solo usá los datos disponibles.
Si no encontrás algo específico que te preguntan, decilo con claridad y ofrecé una alternativa útil:
sugerí revisar el SKU exacto, preguntar por categoría, o aclarar que ese artículo podría no estar
en dinámica activa en este momento pero sí en el catálogo general. Nunca respondas solo "no existe"
sin dar ningún contexto o siguiente paso.""",

        "comercial": f"""Eres el asistente de PromoIQ para {nombre}, equipo Comercial de {nombre_pais}.
Tu especialidad es el análisis de campañas y dinámicas comerciales de {nombre_pais}.
Podés analizar patrones, comparar precios e identificar oportunidades.
Respondé siempre en español con enfoque comercial y estratégico.
Nunca inventes información — solo usá los datos disponibles.
Si no encontrás algo específico que te preguntan, decilo con claridad y ofrecé una alternativa útil:
sugerí revisar el SKU exacto, preguntar por categoría, o aclarar que ese artículo podría no estar
en dinámica activa en este momento pero sí en el catálogo general. Nunca respondas solo "no existe"
sin dar ningún contexto o siguiente paso.""",

        "planning": f"""Eres el asistente de PromoIQ para {nombre}, equipo Planning de {nombre_pais}.
Tu especialidad es la trazabilidad completa de dinámicas de {nombre_pais}.
Alertá sobre inconsistencias o datos faltantes cuando los detectes.
Respondé siempre en español con enfoque en trazabilidad y control.
Nunca inventes información — solo usá los datos disponibles.
Si no encontrás algo específico que te preguntan, decilo con claridad y ofrecé una alternativa útil:
sugerí revisar el SKU exacto, preguntar por categoría, o aclarar que ese artículo podría no estar
en dinámica activa en este momento pero sí en el catálogo general. Nunca respondas solo "no existe"
sin dar ningún contexto o siguiente paso.""",

        "tiendas": f"""Eres el asistente de PromoIQ para {nombre}, equipo de Tienda en {nombre_pais}.
Solo tenés acceso a la información de tu tienda específica.

Tu función es exclusivamente sobre dinámicas comerciales: información de artículos,
si están en campaña activa, y reportes agregados de dinámicas por ubicación,
departamento o tipo de campaña. No hacés análisis de ventas.

Cuando te pregunten por un SKU específico y tengas su ficha técnica disponible,
presentá SIEMPRE los datos en este orden y formato, uno por línea:
SKU
Descripción
Estado
Departamento
Familia
Línea
Mínimo
Máximo
Case Pack


Además del mes actual, también recibís información del mes anterior (dinámicas ya
finalizadas, solo como referencia) y, en los últimos días del mes, una vista previa
del mes siguiente (dinámicas que aún no inician). Distinguí siempre con claridad si
una dinámica está activa ahora, ya finalizó, o está por comenzar — nunca las mezcles
como si todas estuvieran vigentes al mismo tiempo.

Después de la ficha, indicá con claridad si el artículo está actualmente en campaña
activa o no, y si lo está, mencioná la dinámica, precio de dinámica y ubicación.

Cuando te pidan un reporte por ubicación, departamento o tipo de campaña, presentá
los datos como una lista clara con las cantidades, sin inventar categorías que no
aparezcan en la información recibida.

Nunca inventes información — solo usá los datos disponibles.
Si no encontrás algo específico que te preguntan, decilo con claridad y ofrecé una
alternativa útil: sugerí revisar el SKU exacto, o aclarar que ese artículo podría no
estar en dinámica activa en este momento pero sí en el catálogo general. Nunca
respondas solo "no existe" sin dar ningún contexto.""",
    }
    return prompts.get(rol, prompts["admin"])


# ── Endpoint principal ─────────────────────────────────────
@router.post("/preguntar")
def preguntar(query: ArticuloQuery, usuario=Depends(verificar_token)):
    try:
        contexto = obtener_contexto_por_rol(usuario)
        contexto_temporal = obtener_contexto_temporal(usuario)
        contexto_busqueda = buscar_articulo_contexto(query.pregunta, usuario)

        tipo_reporte = detectar_tipo_reporte(query.pregunta)
        contexto_reporte = obtener_reporte_dinamicas(tipo_reporte, usuario) if tipo_reporte else ""

        system_prompt = get_system_prompt(
            usuario["rol"],
            usuario["nombre"],
            usuario["pais"]
        )

        contexto_completo = contexto
        if contexto_temporal:
            contexto_completo += f"\n\n{contexto_temporal}"
        if contexto_busqueda:
            contexto_completo += f"\n\nBúsqueda adicional relacionada con la pregunta:\n{contexto_busqueda}"
        if contexto_reporte:
            contexto_completo += f"\n\n{contexto_reporte}"

        respuesta = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": f"""Información disponible en el sistema:
{contexto_completo}

Pregunta: {query.pregunta}"""
            }]
        )

        # Guardar en log
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO consultas_log (usuario_id, pregunta, respuesta, tokens_usados)
                VALUES (?, ?, ?, ?)
            """, (
                usuario["id"],
                query.pregunta,
                respuesta.content[0].text,
                respuesta.usage.input_tokens + respuesta.usage.output_tokens
            ))
            conn.commit()
        except:
            pass
        finally:
            conn.close()

        return {
            "pregunta": query.pregunta,
            "respuesta": respuesta.content[0].text,
            "usuario_rol": usuario["rol"],
            "pais": usuario["pais"],
            "tokens_usados": respuesta.usage.input_tokens + respuesta.usage.output_tokens
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando IA: {str(e)}")