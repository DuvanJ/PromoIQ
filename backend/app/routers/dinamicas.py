# ============================================================
# Router: dinamicas.py
# Descripción: Carga, análisis y gestión de dinámicas comerciales,
# catálogo de artículos y ventas mensuales
# ============================================================

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from app.database import get_connection, registrar_auditoria
from app.auth import verificar_token
from app.logging_config import app_logger
from anthropic import Anthropic
from dotenv import load_dotenv
from pydantic import BaseModel
import pandas as pd
import io
import os
import json
from docx import Document
from app.rate_limit import limiter_usuario
from fastapi import Request
from app.cache import cache_invalidar
import re as _re_layout
from openpyxl import load_workbook



load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"), timeout=45.0)

router = APIRouter(prefix="/dinamicas", tags=["Dinámicas Comerciales"])

# ── Ubicaciones fijas del negocio ─────────────────────────
UBICACIONES_FIJAS = {
    'isla':             'Isla',
    'cabecera':         'Cabecera',
    'principales':      'Cabecera',   # sinónimo de negocio
    'principal':        'Cabecera',   # forma singular
    'punta de gondola': 'Punta de Góndola',
    'punta de góndola': 'Punta de Góndola',
    'gondola':          'Góndola',
    'botadero':         'Botadero',
    'descuento':        'General',
}

def procesar_promo(valor_promo):
    """
    Determina ubicación y tipo de campaña según el valor de Promo.
    """
    if not valor_promo or str(valor_promo).strip() in ['', 'nan']:
        return 'General', 'Promoción'

    promo_lower = str(valor_promo).strip().lower()

    for key, ubicacion in UBICACIONES_FIJAS.items():
        if key in promo_lower:
            return ubicacion, 'Promoción'

    return 'General', str(valor_promo).strip()

def get_col(df, *nombres):
    """Busca columna por varios posibles nombres — case insensitive"""
    for nombre in nombres:
        for col in df.columns:
            if col.strip().lower() == nombre.lower():
                return col
    return None


def extraer_layout_tienda(archivo_bytes: bytes) -> list:
    """
    Extrae el layout físico de una tienda desde un Excel espacial.
    No intenta emparejar códigos de pasillo con su descripción — cada
    celda combinada (o celda suelta) se guarda tal cual: su texto, su
    posición de inicio y cuántas filas/columnas ocupa. El frontend
    dibuja cada una como un bloque de ese mismo tamaño en una grilla.

    Clasifica cada bloque en:
    - 'codigo': texto que matchea el patrón de pasillo (ej. HO1C02)
    - 'texto': cualquier otro texto (descripciones de producto,
      rótulos de pared, nombres de departamento, etc.)

    Se excluyen cajas registradoras ("Caja 1", "Caja 2" — exacto, no
    cualquier texto que empiece con "Caja"), códigos de caja tipo
    CJ01A, y números de pasillo sueltos (1H, 16H).
    """
    wb = load_workbook(io.BytesIO(archivo_bytes), data_only=True)
    ws = wb.active

    rango_de_celda = {}
    for mc in ws.merged_cells.ranges:
        min_col, min_row, max_col, max_row = mc.bounds
        for r in range(min_row, max_row + 1):
            for c in range(min_col, max_col + 1):
                rango_de_celda[(r, c)] = (min_row, min_col, max_row, max_col)

    patron_codigo = _re_layout.compile(r'[A-Za-z]{2}\d+C\d+')
    patron_pasillo_num = _re_layout.compile(r'\d+H')
    patron_caja = _re_layout.compile(r'CJ\d+[AB]')
    # Solo excluye "Caja" + número exacto (ej. "Caja 1", "Caja 2" —
    # las cajas registradoras). NO debe excluir textos que solo
    # empiecen con la palabra "Cajas" en otro sentido, como "Cajas
    # eléctricas + canaletas" — ese fue el bug: el filtro viejo
    # (val.lower().startswith('caja')) atrapaba cualquier producto
    # cuyo nombre empezara con esa palabra.
    patron_caja_registradora = _re_layout.compile(r'^caja\s*\d+$', _re_layout.IGNORECASE)

    bloques = {}
    for row in ws.iter_rows():
        for cell in row:
            if cell.value in (None, ''):
                continue
            r, c = cell.row, cell.column
            if (r, c) in rango_de_celda:
                min_row, min_col, max_row, max_col = rango_de_celda[(r, c)]
                clave = (min_row, min_col, max_row, max_col)
            else:
                clave = (r, c, r, c)
            bloques[clave] = str(cell.value).strip()

    resultado = []
    for (fila_ini, col_ini, fila_fin, col_fin), val in bloques.items():
        if patron_pasillo_num.fullmatch(val):
            continue
        if patron_caja.fullmatch(val):
            continue
        if patron_caja_registradora.match(val):
            continue
        if val.replace(' ', '').isdigit():
            continue

        es_codigo = bool(patron_codigo.fullmatch(val))
        resultado.append({
            'tipo': 'codigo' if es_codigo else 'texto',
            'codigo': val if es_codigo else None,
            'descripcion': val,
            'fila': fila_ini,
            'columna': col_ini,
            'fila_fin': fila_fin,
            'columna_fin': col_fin,
        })

    return resultado



def extraer_bloques_docx(archivo_bytes: bytes) -> list:
    """
    Extrae los bloques de texto de un Word como una lista de tarjetas
    distintas — cada celda de tabla o párrafo se trata como un bloque
    separado. Solo deduplica bloques EXACTAMENTE idénticos (típico de
    un flyer armado como tabla repetida para imprimir varias copias);
    bloques distintos se conservan todos porque representan tarjetas
    de información reales.
    """
    doc = Document(io.BytesIO(archivo_bytes))
    bloques = []
    vistos = set()

    def agregar(texto):
        texto = texto.strip()
        if texto and texto not in vistos:
            vistos.add(texto)
            bloques.append(texto)

    for tabla in doc.tables:
        for fila in tabla.rows:
            for celda in fila.cells:
                texto_celda = "\n".join(p.text for p in celda.paragraphs if p.text.strip())
                agregar(texto_celda)

    for parrafo in doc.paragraphs:
        agregar(parrafo.text)

    return bloques


# ── Endpoint: Analizar Excel antes de cargar ──────────────
@router.post("/analizar")
async def analizar_excel(
    file: UploadFile = File(...),
    dinamica_id: int = Form(None),
    pais: str = Form(None),
    tienda_codigo: str = Form(None),
    usuario=Depends(verificar_token)
):
    """
    Analiza un archivo Excel de dinámicas con IA antes de cargarlo.
    Formato esperado: Sku | Descripcion | Ubicacion Dinamica |
    Ubicacion Tienda | Tipo de Campana | Porcentaje | Precio Dinamica

    dinamica_id, pais y tienda_codigo son opcionales acá (el análisis
    igual funciona sin ellos), pero si se envían permiten distinguir
    un duplicado real (mismo SKU repetido dentro del archivo, bloqueante)
    de una coincidencia esperada (mismo SKU en otra tienda de la misma
    dinámica, que no es error).
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    contenido = await file.read()
    df = pd.read_excel(io.BytesIO(contenido))

    df.columns = df.columns.str.strip()
    df = df.fillna("")

    app_logger.info(f"[analizar_excel] Columnas detectadas: {df.columns.tolist()}")

    total_filas = len(df)
    columnas = df.columns.tolist()

    col_sku        = get_col(df, 'SKU', 'sku', 'Codigo', 'codigo')
    col_desc       = get_col(df, 'Descripcion', 'descripcion', 'Descripción')
    col_ubic_din   = get_col(df, 'Ubicacion Dinamica', 'Ubicación Dinámica', 'Ubicacion dinamica', 'ubicacion_dinamica')
    col_ubic_tda   = get_col(df, 'Ubicacion Tienda', 'Ubicación Tienda', 'ubicacion_tienda')
    col_tipo       = get_col(df, 'Tipo de Campana', 'Tipo de Campaña', 'tipo_campana', 'Tipo Campana')
    col_porcentaje = get_col(df, 'Porcentaje', 'Porcentaje Descuento', 'porcentaje_descuento', '% Descuento')
    col_precio     = get_col(df, 'Precio Dinamica', 'Precio Dinámica', 'precio_dinamica')

    columnas_esperadas = {
        'SKU': col_sku,
        'Descripcion': col_desc,
        'Ubicacion Dinamica': col_ubic_din,
        'Ubicacion Tienda': col_ubic_tda,
        'Tipo de Campana': col_tipo,
        'Porcentaje': col_porcentaje,
        'Precio Dinamica': col_precio,
    }
    # Solo SKU es estrictamente obligatoria para poder cargar —
    # el resto genera advertencia si falta, pero no bloquea.
    columnas_faltantes = [nombre for nombre, col in columnas_esperadas.items() if not col and nombre != 'SKU']
    if not col_sku:
        columnas_faltantes.insert(0, 'SKU')

    sin_codigo = 0
    if col_sku:
        sin_codigo = len(df[df[col_sku].astype(str).isin(['', 'nan', 'NaN'])])

    sin_precio = 0
    if col_precio:
        sin_precio = len(df[df[col_precio].astype(str).isin(['', 'nan', 'NaN'])])
    elif col_sku:
        sin_precio = total_filas  # ninguna fila tiene precio si la columna no existe

    sin_porcentaje = 0
    if col_porcentaje:
        sin_porcentaje = len(df[df[col_porcentaje].astype(str).isin(['', 'nan', 'NaN'])])

        # ── Duplicados REALES: mismo SKU + misma Ubicación Dinámica ──────
    # Un SKU puede aparecer varias veces en el archivo si está en
    # distintas exhibiciones (ej: una fila en Cabecera y otra en Isla)
    # — eso es válido. Lo que SÍ es un error real es que el mismo SKU
    # se repita para la MISMA ubicación (dos filas para "Cabecera").
    duplicados = []
    if col_sku:
        df_dup = pd.DataFrame({'sku': df[col_sku].astype(str).str.strip()})

        # Duplicado real = mismo SKU + mismo tipo de campaña exacto.
        # Mismo SKU con distinta campaña es válido (ej: Especial + ALWAYS ON)
        if col_tipo:
            df_dup['campana'] = df[col_tipo].astype(str).str.strip().str.lower().fillna('')
        else:
            df_dup['campana'] = ''

        df_dup = df_dup[~df_dup['sku'].isin(['', 'nan', 'NaN'])]

        dup_mask = df_dup.duplicated(subset=['sku', 'campana'], keep=False)
        duplicados = sorted(df_dup.loc[dup_mask, 'sku'].unique().tolist())
    

    # ── Informativo: SKU también presente en OTRA dinámica activa ────
    # (no bloquea — puede ser intencional que un artículo esté en
    # varias campañas a la vez)
    conn = get_connection()
    cursor = conn.cursor()
    codigos_en_otras_dinamicas = []
    if col_sku:
        for codigo in df[col_sku].astype(str).unique():
            if codigo and codigo not in ['nan', 'NaN', '']:
                if dinamica_id:
                    cursor.execute("""
                        SELECT COUNT(*) FROM dinamica_detalle dd
                        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                        WHERE dd.sku = ? AND d.activa = 1 AND dd.activo = 1
                        AND dd.dinamica_id != ?
                    """, (codigo, dinamica_id))
                else:
                    cursor.execute("""
                        SELECT COUNT(*) FROM dinamica_detalle dd
                        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                        WHERE dd.sku = ? AND d.activa = 1 AND dd.activo = 1
                    """, (codigo,))
                if cursor.fetchone()[0] > 0:
                    codigos_en_otras_dinamicas.append(codigo)
    conn.close()

    resumen = f"""
Archivo: {file.filename}
Total de filas: {total_filas}
Columnas detectadas: {', '.join(columnas)}
Tienda destino: {tienda_codigo or 'No especificada'}
Columnas faltantes (no bloquean, salvo SKU): {', '.join(columnas_faltantes) if columnas_faltantes else 'Ninguna'}

Problemas detectados:
- Filas sin SKU: {sin_codigo}
- Filas sin Precio Dinámica: {sin_precio}
- Filas sin Porcentaje de descuento: {sin_porcentaje}
- SKUs duplicados DENTRO de este mismo archivo (error real): {len(duplicados)} ({', '.join(duplicados[:5])}{'...' if len(duplicados) > 5 else ''})
- SKUs que también están en OTRA dinámica activa (solo informativo, no bloquea): {len(codigos_en_otras_dinamicas)} ({', '.join(codigos_en_otras_dinamicas[:5])}{'...' if len(codigos_en_otras_dinamicas) > 5 else ''})

Muestra de datos (primeras 5 filas):
{df.head(5).to_string()}
"""

    try:
        respuesta = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system="""Eres el asistente de análisis de PromoIQ para dinámicas comerciales de PromoIQ.
Tu trabajo es analizar archivos Excel de dinámicas antes de cargarlos al sistema.

FORMATO ESPERADO: Sku | Descripcion | Ubicacion Dinamica | Ubicacion Tienda | Tipo de Campana | Porcentaje | Precio Dinamica

REGLAS IMPORTANTES:
- Cada archivo corresponde a UNA sola tienda, elegida fuera del Excel — no busques una columna de tienda.
- "Ubicacion Dinamica" es el tipo de exhibición (Isla, Cabecera, Botadero, Punta de Góndola, General, etc.).
- "Ubicacion Tienda" es la ubicación física dentro de esa sucursal — texto libre.
- Solo SKU es estrictamente obligatorio. Las demás columnas faltantes son advertencia, no error bloqueante.
- Un SKU puede aparecer varias veces en el archivo si está en distintas ubicaciones/exhibiciones (ej: una fila en "Cabecera" y otra en "Isla") — eso es VÁLIDO, no es error.
- Lo que SÍ es un error real es que el mismo SKU se repita para la MISMA ubicación (ej: dos filas de "Cabecera" para el mismo SKU) — ahí no se sabe cuál registro es el correcto.
- Un SKU que también aparece en otra dinámica activa NO es un error — es solo información, puede ser intencional.
- Sé específico y constructivo en las recomendaciones.

Respondé siempre en español, de forma clara y concisa.""",
            messages=[{
                "role": "user",
                "content": f"""Analizá este archivo Excel de dinámicas para PromoIQ:

{resumen}

Proporcioná:
1. Veredicto claro: ¿Está listo para cargar?
2. Errores reales que impiden la carga (si hay) — principalmente SKUs duplicados dentro del archivo o filas sin SKU
3. Advertencias de columnas faltantes o datos incompletos (precio, porcentaje) — no bloquean pero conviene completarlas
4. Lo que está bien en el archivo"""
            }]
        )
        analisis_texto = respuesta.content[0].text
    except Exception as e:
        app_logger.warning(f"[analizar_excel] Error llamando a la IA: {e}")
        analisis_texto = "⚠️ No se pudo generar el análisis con IA en este momento (tiempo de espera agotado o servicio no disponible). Podés revisar los datos manualmente con las métricas de arriba, o intentar analizar el archivo nuevamente en unos minutos."

    return {
        "archivo": file.filename,
        "total_filas": total_filas,
        "columnas_detectadas": columnas,
        "columnas_faltantes": columnas_faltantes,
        "problemas": {
            "sin_codigo": sin_codigo,
            "sin_precio": sin_precio,
            "sin_porcentaje": sin_porcentaje,
            "duplicados_archivo": len(duplicados),
            "duplicados_bd": len(codigos_en_otras_dinamicas),
            "codigos_duplicados": duplicados[:10],
            "codigos_en_bd": codigos_en_otras_dinamicas[:10]
        },
        "listo_para_cargar": (
            sin_codigo == 0 and
            'SKU' not in columnas_faltantes and
            len(duplicados) == 0
        ),
        "analisis_ia": analisis_texto
    }


# ── Endpoint: Cargar Excel de dinámicas ───────────────────
@router.post("/cargar")
async def cargar_excel(
    file: UploadFile = File(...),
    dinamica_id: int = Form(...),
    pais: str = Form(...),
    tienda_codigo: str = Form(...),
    usuario=Depends(verificar_token)
):
    """
    Carga archivo Excel de dinámicas a la BD — un archivo por tienda.
    Formato: Sku | Descripcion | Ubicacion Dinamica | Ubicacion Tienda |
    Tipo de Campana | Porcentaje | Precio Dinamica

    La tienda se elige en el formulario (catálogo cat_tiendas), no
    viene como columna del Excel — así el borrado antes de insertar se
    limita a dinamica_id + tienda exactos, sin afectar el detalle ya
    cargado de otras tiendas en la misma dinámica.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para cargar dinámicas")

    if usuario["rol"] != "superadmin" and pais != usuario["pais"]:
        raise HTTPException(status_code=403, detail="Solo podés cargar información de tu propio país")

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    conn = get_connection()
    cursor = conn.cursor()

    # La tienda tiene que existir en el catálogo de ESE país específico
    cursor.execute("""
        SELECT nombre FROM cat_tiendas WHERE codigo = ? AND pais = ? AND activo = 1
    """, (tienda_codigo, pais))
    tienda_row = cursor.fetchone()
    if not tienda_row:
        conn.close()
        raise HTTPException(status_code=400, detail=f"La tienda {tienda_codigo} no existe o no está activa en {pais}")
    tienda_nombre = tienda_row[0]

    contenido = await file.read()
    df = pd.read_excel(io.BytesIO(contenido))
    df.columns = df.columns.str.strip()
    df = df.fillna("")

    col_sku        = get_col(df, 'SKU', 'sku', 'Codigo', 'codigo')
    col_desc       = get_col(df, 'Descripcion', 'descripcion', 'Descripción')
    col_ubic_din   = get_col(df, 'Ubicacion Dinamica', 'Ubicación Dinámica', 'Ubicacion dinamica', 'ubicacion_dinamica')
    col_ubic_tda   = get_col(df, 'Ubicacion Tienda', 'Ubicación Tienda', 'ubicacion_tienda')
    col_tipo       = get_col(df, 'Tipo de Campana', 'Tipo de Campaña', 'tipo_campana', 'Tipo Campana')
    col_porcentaje = get_col(df, 'Porcentaje', 'Porcentaje Descuento', 'porcentaje_descuento', '% Descuento')
    col_precio     = get_col(df, 'Precio Dinamica', 'Precio Dinámica', 'precio_dinamica')

    if not col_sku:
        conn.close()
        raise HTTPException(status_code=400, detail="No se encontró columna SKU")

    def safe_float(val):
        try:
            if val in ('', None):
                return None
            return round(float(str(val).replace(',', '.').replace('%', '').strip()), 2)
        except:
            return None

    # Borra SOLO el detalle previo de esta dinámica + esta tienda —
    # así recargar o corregir una tienda no toca lo ya cargado de otras
    cursor.execute("""
        DELETE FROM dinamica_detalle
        WHERE dinamica_id = ? AND pais = ? AND tienda = ?
    """, (dinamica_id, pais, tienda_codigo))

    registros_cargados = 0
    skus_vistos = {}  # clave: (sku, tipo_campana_normalizado) → permite mismo SKU con diferente campaña
    codigo = None

    for _, fila in df.iterrows():
        try:
            codigo = str(fila.get(col_sku, '')).strip()
            if not codigo or codigo in ['nan', 'NaN', '']:
                continue

            descripcion   = str(fila.get(col_desc, '')).strip() if col_desc else ''
            ubicacion_raw = str(fila.get(col_ubic_din, '')).strip() if col_ubic_din else ''
            ubicacion_tienda = str(fila.get(col_ubic_tda, '')).strip() if col_ubic_tda else ''
            tipo_campana_raw = str(fila.get(col_tipo, '')).strip() if col_tipo else ''

            # Precio y porcentaje son opcionales — se guardan como NULL si no vienen
            porcentaje    = safe_float(fila.get(col_porcentaje, '')) if col_porcentaje else None
            precio_dinamica = safe_float(fila.get(col_precio, '')) if col_precio else None

            # Normalizar ubicación dinámica usando el mapa de ubicaciones
            ubicacion_dinamica = procesar_promo(ubicacion_raw)[0] if ubicacion_raw else 'General'

            # Normalizar tipo de campaña — si viene vacío, usar la ubicación como referencia
            # (ej: "ALWAYS ON---DESCUENTO" viene como tipo, no como ubicación)
            tipo_campana = tipo_campana_raw or 'Promoción'

            # Deduplicación flexible: mismo SKU permitido si tiene diferente
            # tipo de campaña (ej: "Especial" vs "ALWAYS ON---DESCUENTO").
            # Lo que SÍ se descarta es una combinación SKU+campaña exactamente
            # igual (eso sí sería un duplicado real sin sentido).
            clave_dup = (codigo, tipo_campana.lower().strip())
            if clave_dup in skus_vistos:
                app_logger.info(
                    f"[cargar_excel] SKU {codigo} con campaña '{tipo_campana}' duplicado exacto — se omite"
                )
                continue
            skus_vistos[clave_dup] = True

            cursor.execute("""
                INSERT INTO dinamica_detalle
                (dinamica_id, sku, descripcion, porcentaje_descuento,
                 precio_dinamica, ubicacion_dinamica, tienda, ubicacion_tienda, tipo_campana, pais)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                dinamica_id,
                codigo,
                descripcion,
                porcentaje,        # NULL si no viene — no se fuerza 0
                precio_dinamica,   # NULL si no viene — no se fuerza 0
                ubicacion_dinamica,
                tienda_codigo,
                ubicacion_tienda or None,
                tipo_campana,
                pais
            ))
            registros_cargados += 1

        except Exception as e:
            app_logger.warning(
                f"[cargar_excel] Error en fila SKU {codigo} "
                f"(dinámica {dinamica_id}, tienda {tienda_codigo}): {e}"
            )
            continue

        if registros_cargados % 500 == 0:
            conn.commit()

    try:
        cursor.execute("""
            INSERT INTO carga_log (usuario_id, nombre_archivo, registros_cargados, dinamica_id)
            VALUES (?, ?, ?, ?)
        """, (usuario["id"], file.filename, registros_cargados, dinamica_id))
    except Exception as e:
        app_logger.warning(f"[cargar_excel] No se pudo registrar en carga_log: {e}")

    conn.commit()
    conn.close()

    return {
        "mensaje": "Archivo cargado exitosamente",
        "archivo": file.filename,
        "dinamica_id": dinamica_id,
        "pais": pais,
        "tienda": tienda_nombre,
        "tienda_codigo": tienda_codigo,
        "registros_cargados": registros_cargados,
        "notificacion_pendiente": True
    }


# ── Endpoint: Cargar Excel catálogo ─────────────────────
@router.post("/catalogo/cargar")
@limiter_usuario.limit("3/minute")
async def cargar_catalogo(
    request: Request,
    file: UploadFile = File(...),
    pais: str = Form(...),
    usuario=Depends(verificar_token)
):
    """
    Carga el catálogo maestro de artículos desde Excel.
    Se actualiza diariamente. Reemplaza los datos del país.

    El Excel trae una fila por SKU + sucursal (un mismo SKU aparece
    varias veces, una por cada sucursal del país, con su propio
    Disponible/Existencia/Consumo). Por eso la deduplicación y la
    clave real de articulos_maestro son SKU + Codigo Sucursal, nunca
    SKU solo. Si falta la columna de sucursal, el archivo se rechaza
    en vez de intentar salvarlo con un dedup parcial que repetiría el
    bug histórico de perder las sucursales.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para cargar catálogo")

    if usuario["rol"] != "superadmin" and pais != usuario["pais"]:
        raise HTTPException(status_code=403, detail="Solo podés cargar información de tu propio país")

    contenido = await file.read()

    df_original = pd.read_excel(io.BytesIO(contenido))
    df_original.columns = df_original.columns.str.strip()
    app_logger.info(f"[cargar_catalogo] Columnas detectadas ({pais}): {df_original.columns.tolist()}")

    df = df_original.copy()

    col_sku_cat = None
    col_suc_cod_cat = None
    for col in df.columns:
        col_l = col.strip().lower()
        if col_l == 'sku':
            col_sku_cat = col
        elif col_l == 'codigo sucursal':
            col_suc_cod_cat = col

    if not col_sku_cat:
        raise HTTPException(status_code=400, detail="El archivo no contiene columna SKU")

    if not col_suc_cod_cat:
        raise HTTPException(
            status_code=400,
            detail="El archivo está incompleto: falta la columna 'Codigo Sucursal', necesaria para diferenciar los registros por tienda"
        )

    antes = len(df)
    df = df.drop_duplicates(subset=[col_sku_cat, col_suc_cod_cat], keep='first')
    despues = len(df)
    app_logger.info(f"[cargar_catalogo] Deduplicados ({pais}): {antes} → {despues} registros únicos por SKU+Sucursal")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.fast_executemany = True

    cursor.execute("DELETE FROM articulos_maestro WHERE pais = ?", (pais,))
    cursor.execute("DELETE FROM articulos_sucursales WHERE pais = ?", (pais,))
    conn.commit()

    registros_cargados = 0
    errores = 0
    sucursales_cargadas = 0

    def safe_decimal(val):
        try:
            if pd.isna(val):
                return None
            s = str(val).strip().replace(',', '.')
            if s in ['', 'nan', 'NaN']:
                return None
            f = float(s)
            if f > 99999999.99 or f < -99999999.99:
                return None
            return round(f, 2)
        except:
            return None

    def safe_str(val, max_len=200):
        try:
            if pd.isna(val):
                return None
            s = str(val).strip()
            return s[:max_len] if s else None
        except:
            return None

    def safe_codigo_sucursal(val):
        """Normaliza código de sucursal a texto de 2 dígitos con cero a la
        izquierda (pandas puede leer la columna como número si el Excel la
        formatea así, perdiendo el '0' de sucursales 1-9)."""
        try:
            if pd.isna(val):
                return None
            s = str(val).strip()
            if s in ['', 'nan', 'NaN']:
                return None
            if s.endswith('.0'):
                s = s[:-2]
            return s.zfill(2)
        except:
            return None

    col_sku_orig = None
    col_suc_cod = None
    col_suc_nom = None
    col_exist = None
    col_disp = None
    col_consumo = None

    for col in df_original.columns:
        col_l = col.strip().lower()
        if col_l == 'sku': col_sku_orig = col
        elif col_l == 'codigo sucursal': col_suc_cod = col
        elif col_l == 'sucursal': col_suc_nom = col
        elif col_l == 'existencia bodega': col_exist = col
        elif col_l == 'disponible': col_disp = col
        elif col_l == 'consumo mensual tienda': col_consumo = col

    app_logger.info(f"[cargar_catalogo] Columnas sucursales detectadas ({pais}): sku={col_sku_orig}, cod={col_suc_cod}, nom={col_suc_nom}")

    LOTE = 2000

    if col_sku_orig and col_suc_cod:
        filas_sucursales = []
        for _, fila in df_original.iterrows():
            sku_s = safe_str(fila.get(col_sku_orig, ''))
            cod_suc = safe_codigo_sucursal(fila.get(col_suc_cod, ''))
            if not sku_s or not cod_suc:
                continue

            filas_sucursales.append((
                sku_s,
                cod_suc,
                safe_str(fila.get(col_suc_nom, '')),
                safe_decimal(fila.get(col_exist, 0)),
                safe_decimal(fila.get(col_disp, 0)),
                safe_decimal(fila.get(col_consumo, 0)),
                pais
            ))

        sql_sucursales = """
            INSERT INTO articulos_sucursales
            (sku, codigo_sucursal, sucursal, existencia,
             disponible, consumo_mensual, pais)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        for i in range(0, len(filas_sucursales), LOTE):
            lote = filas_sucursales[i:i + LOTE]
            try:
                cursor.executemany(sql_sucursales, lote)
                conn.commit()
                sucursales_cargadas += len(lote)
                app_logger.info(f"[cargar_catalogo] {sucursales_cargadas} registros de inventario por sucursal cargados ({pais})...")
            except Exception as e:
                app_logger.error(f"[cargar_catalogo] Error en lote de sucursales ({pais}): {e}")

        app_logger.info(f"[cargar_catalogo] Total sucursales cargadas ({pais}): {sucursales_cargadas}")
    else:
        app_logger.warning(f"[cargar_catalogo] No se encontraron columnas de sucursal ({pais}): sku={col_sku_orig}, cod={col_suc_cod}")

    sql_articulos = """
        INSERT INTO articulos_maestro (
            sku, descripcion, codigo_sucursal, sucursal,
            costo_unitario, precio_unitario, buyer_max_asr,
            vop, outl, sys_class, buyer_class, categoria_tienda,
            unidad_medida, catalogo, categoria, linea, familia,
            departamento, estado, marca, codigo_proveedor, proveedor,
            administrador, comprador, bodega_awr, dc_id, source_code,
            fecha_primer_ingreso, consumo_mensual, existencia_bodega,
            transito, fecha_ultimo_ingreso, disponible,
            minimo_presentacion, minimo, maximo, case_pack,
            hard_max, weekly_asr, exclusivo, pais, fecha_actualizacion
        ) VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,GETDATE()
        )
    """

    filas_articulos = []
    for _, fila in df.iterrows():
        try:
            sku = safe_str(fila.get('SKU', fila.get('sku', '')))
            if not sku:
                continue

            filas_articulos.append((
                sku,
                safe_str(fila.get('Descripcion', fila.get('descripcion')), 300),
                safe_codigo_sucursal(fila.get('Codigo Sucursal', fila.get('Codigo_Sucursal', fila.get('codigo_sucursal')))),
                safe_str(fila.get('Sucursal', fila.get('sucursal'))),
                safe_decimal(fila.get('Costo Unitario Iva', fila.get('Costo_Unitario_Iva'))),
                safe_decimal(fila.get('Precio Unitario Iva', fila.get('Precio_Unitario_Iva'))),
                safe_str(fila.get('Buyer Max Asr', fila.get('Buyer_Max_Asr'))),
                safe_str(fila.get('VOP', fila.get('vop'))),
                safe_str(fila.get('OUTL', fila.get('outl'))),
                safe_str(fila.get('Sys Class', fila.get('Sys_Class'))),
                safe_str(fila.get('Buyer Class', fila.get('Buyer_Class'))),
                safe_str(fila.get('Categoria Tienda', fila.get('Categoria_Tienda'))),
                safe_str(fila.get('Unidad De Medida', fila.get('Unidad_De_Medida'))),
                safe_str(fila.get('Catalogo', fila.get('catalogo'))),
                safe_str(fila.get('Categoria', fila.get('categoria'))),
                safe_str(fila.get('Linea', fila.get('linea'))),
                safe_str(fila.get('Familia', fila.get('familia'))),
                safe_str(fila.get('Departamento', fila.get('departamento'))),
                safe_str(fila.get('Estado', fila.get('estado'))),
                safe_str(fila.get('Marca', fila.get('marca'))),
                safe_str(fila.get('Codigo Proveedor', fila.get('Codigo_Proveedor'))),
                safe_str(fila.get('Proveedor', fila.get('proveedor'))),
                safe_str(fila.get('Administrador', fila.get('administrador'))),
                safe_str(fila.get('Comprador', fila.get('comprador'))),
                safe_str(fila.get('Bodega AWR', fila.get('Bodega_AWR'))),
                safe_str(fila.get('DC ID', fila.get('DC_ID'))),
                safe_str(fila.get('Source Code', fila.get('Source_Code'))),
                safe_str(fila.get('Fecha Primer Ingreso Bodega', fila.get('Fecha_Primer_Ingreso_Bodega'))),
                safe_decimal(fila.get('Consumo Mensual Tienda', fila.get('Consumo_Mensual_Tienda'))),
                safe_decimal(fila.get('Existencia Bodega', fila.get('Existencia_Bodega'))),
                safe_decimal(fila.get('Transito', fila.get('transito'))),
                safe_str(fila.get('Fecha Ultimo Ingreso', fila.get('Fecha_Ultimo_Ingreso'))),
                safe_decimal(fila.get('Disponible', fila.get('disponible'))),
                safe_decimal(fila.get('Minimo Presentacion', fila.get('Minimo_Presentacion'))),
                safe_decimal(fila.get('Minimo', fila.get('minimo'))),
                safe_decimal(fila.get('Maximo', fila.get('maximo'))),
                safe_decimal(fila.get('Case Pack', fila.get('Case_Pack'))),
                safe_decimal(fila.get('Hard Max', fila.get('Hard_Max'))),
                safe_decimal(fila.get('Weekly ASR', fila.get('Weekly_ASR'))),
                safe_str(fila.get('Exclusivo', fila.get('exclusivo'))),
                pais
            ))
        except Exception as e:
            errores += 1
            app_logger.warning(f"[cargar_catalogo] Error preparando fila ({pais}): {e}")
            continue

    for i in range(0, len(filas_articulos), LOTE):
        lote = filas_articulos[i:i + LOTE]
        try:
            cursor.executemany(sql_articulos, lote)
            conn.commit()
            registros_cargados += len(lote)
            app_logger.info(f"[cargar_catalogo] {registros_cargados} artículos cargados ({pais})...")
        except Exception as e:
            errores += len(lote)
            app_logger.error(f"[cargar_catalogo] Error en lote de artículos ({pais}): {e}")

    try:
        cursor.execute("""
            INSERT INTO carga_log (usuario_id, nombre_archivo, registros_cargados, dinamica_id)
            VALUES (?, ?, ?, NULL)
        """, (usuario["id"], file.filename, registros_cargados))
        conn.commit()
    except Exception as e:
        app_logger.warning(f"[cargar_catalogo] No se pudo registrar en carga_log: {e}")

    conn.close()

    return {
        "mensaje": "Catálogo cargado exitosamente",
        "archivo": file.filename,
        "pais": pais,
        "registros_cargados": registros_cargados,
        "sucursales_cargadas": sucursales_cargadas,
        "errores": errores
    }

# ── Endpoint: Stats del catálogo ──────────────────────────
@router.get("/catalogo/stats")
def stats_catalogo(pais: str = None, usuario=Depends(verificar_token)):
    """
    Estadísticas del catálogo. Admin siempre ve su propio país.
    Superadmin ve el país que seleccione (query param `pais`);
    si no se indica, ve el total combinado de todos los países.
    """
    conn = get_connection()
    cursor = conn.cursor()
    rol = usuario["rol"]
    pais_filtro = usuario["pais"] if rol != "superadmin" else pais

    filtro = "WHERE pais = ?" if pais_filtro else ""
    params = (pais_filtro,) if pais_filtro else ()

    cursor.execute(f"""
        SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT departamento) as departamentos,
            COUNT(DISTINCT marca) as marcas,
            MAX(fecha_actualizacion) as ultima_actualizacion
        FROM articulos_maestro {filtro}
    """, params)
    stats = cursor.fetchone()

    cursor.execute(f"""
        SELECT COUNT(DISTINCT codigo_sucursal)
        FROM articulos_sucursales {filtro}
    """, params)
    total_sucursales = cursor.fetchone()[0]

    conn.close()

    return {
        "total_articulos": stats[0] or 0,
        "departamentos": stats[1] or 0,
        "sucursales": total_sucursales or 0,
        "marcas": stats[2] or 0,
        "ultima_actualizacion": str(stats[3]) if stats[3] else None
    }


# ── Endpoint: Lista de dinámicas activas ──────────────────
@router.get("/lista")
def obtener_dinamicas(usuario=Depends(verificar_token)):
    """Retorna todas las dinámicas activas"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, nombre, fecha_inicio, fecha_fin, activa
        FROM dinamicas WHERE activa = 1
        ORDER BY fecha_inicio DESC
    """)
    filas = cursor.fetchall()
    conn.close()
    return [
        {
            "id": f[0],
            "nombre": f[1],
            "fecha_inicio": str(f[2]),
            "fecha_fin": str(f[3]),
            "activa": f[4]
        }
        for f in filas
    ]


@router.post("/ventas/cargar")
async def cargar_ventas(
    file: UploadFile = File(...),
    pais: str = Form(...),
    mes: int = Form(...),
    anio: int = Form(...),
    usuario=Depends(verificar_token)
):
    """
    Carga archivo Excel de ventas en promoción.
    Formato: SKU | Descripcion | Express | Mostrador | Externo | E-Commerce | Total general
    Cuando SKU = 00000, el SKU real está al inicio de la Descripcion.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para cargar ventas")

    if usuario["rol"] != "superadmin" and pais != usuario["pais"]:
        raise HTTPException(status_code=403, detail="Solo podés cargar información de tu propio país")

    contenido = await file.read()

    try:
        df = pd.read_excel(io.BytesIO(contenido), header=1)
    except Exception:
        df = pd.read_excel(io.BytesIO(contenido))

    df.columns = df.columns.str.strip()
    app_logger.info(f"[cargar_ventas] Columnas detectadas ({pais}, {mes}/{anio}): {df.columns.tolist()}")
    df = df.fillna(0)

    def get_col_ventas(df, *nombres):
        for nombre in nombres:
            for col in df.columns:
                if col.strip().lower() == nombre.lower():
                    return col
        return None

    col_sku   = get_col_ventas(df, 'sku', 'SKU')
    col_desc  = get_col_ventas(df, 'descripcion', 'Descripcion', 'DESCRIPCION')
    col_vidri = get_col_ventas(df, 'Express', 'Express', 'Express')
    col_most  = get_col_ventas(df, 'mostrador', 'Mostrador', 'MOSTRADOR')
    col_ext   = get_col_ventas(df, 'externo', 'Externo', 'EXTERNO')
    col_ecom  = get_col_ventas(df, 'e-commerce', 'E-Commerce', 'E-COMMERCE')
    col_total = get_col_ventas(df, 'total general', 'Total general', 'TOTAL GENERAL')

    if not col_sku:
        raise HTTPException(status_code=400, detail="No se encontró columna SKU")

    def safe_decimal_v(val):
        try:
            if pd.isna(val) or str(val).strip() in ['', 'nan', 'NaN']:
                return 0.0
            return round(float(str(val).replace(',', '.')), 2)
        except:
            return 0.0

    def extraer_sku(sku_val, desc_val):
        sku_str = str(sku_val).strip()

        if sku_str in ['00000', '0', '', 'nan', 'NaN']:
            desc_str = str(desc_val).strip()
            if desc_str and desc_str not in ['nan', 'NaN', '']:
                partes = desc_str.split()
                if partes and partes[0].isdigit():
                    return partes[0], ' '.join(partes[1:])
                return None, desc_str
            return None, None

        return sku_str, str(desc_val).strip()

    conn = get_connection()
    cursor = conn.cursor()
    cursor.fast_executemany = True

    cursor.execute("""
        DELETE FROM ventas_mes
        WHERE mes = ? AND anio = ? AND pais = ?
    """, (mes, anio, pais))
    conn.commit()

    registros_cargados = 0
    errores = 0

    filas_ventas = []
    for _, fila in df.iterrows():
        try:
            sku_raw  = fila.get(col_sku, '')
            desc_raw = fila.get(col_desc, '') if col_desc else ''

            sku, descripcion = extraer_sku(sku_raw, desc_raw)

            if not sku:
                continue

            if str(descripcion).lower().startswith('total'):
                continue

            venta_vidri = safe_decimal_v(fila.get(col_vidri, 0)) if col_vidri else 0.0
            venta_most  = safe_decimal_v(fila.get(col_most, 0))  if col_most  else 0.0
            venta_ext   = safe_decimal_v(fila.get(col_ext, 0))   if col_ext   else 0.0
            venta_ecom  = safe_decimal_v(fila.get(col_ecom, 0))  if col_ecom  else 0.0
            venta_total = safe_decimal_v(fila.get(col_total, 0)) if col_total else 0.0

            if venta_vidri + venta_most + venta_ext + venta_ecom + venta_total == 0:
                continue

            filas_ventas.append((
                sku, descripcion, venta_vidri, venta_most,
                venta_ext, venta_ecom, venta_total,
                mes, anio, pais
            ))

        except Exception as e:
            errores += 1
            app_logger.warning(f"[cargar_ventas] Error preparando fila ({pais}, {mes}/{anio}): {e}")
            continue

    sql_ventas = """
        INSERT INTO ventas_mes
        (sku, descripcion, venta_express, venta_mostrador,
         venta_externo, venta_ecommerce, venta_total,
         mes, anio, pais)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    LOTE = 2000
    for i in range(0, len(filas_ventas), LOTE):
        lote = filas_ventas[i:i + LOTE]
        try:
            cursor.executemany(sql_ventas, lote)
            conn.commit()
            registros_cargados += len(lote)
            app_logger.info(f"[cargar_ventas] {registros_cargados} ventas cargadas ({pais}, {mes}/{anio})...")
        except Exception as e:
            errores += len(lote)
            app_logger.error(f"[cargar_ventas] Error en lote de ventas ({pais}, {mes}/{anio}): {e}")

    try:
        cursor.execute("""
            INSERT INTO carga_log (usuario_id, nombre_archivo, registros_cargados, dinamica_id)
            VALUES (?, ?, ?, NULL)
        """, (usuario["id"], file.filename, registros_cargados))
        conn.commit()
    except Exception as e:
        app_logger.warning(f"[cargar_ventas] No se pudo registrar en carga_log: {e}")

        conn.close()

    
    cache_invalidar(f"ventas_comercial:{pais}")

    return {
        "mensaje": "Ventas cargadas exitosamente",
        "archivo": file.filename,
        "pais": pais,
        "mes": mes,
        "anio": anio,
        "registros_cargados": registros_cargados,
        "errores": errores
    }


@router.get("/ventas/stats")
def stats_ventas(pais: str = None, usuario=Depends(verificar_token)):
    """
    Estadísticas de ventas. Admin siempre ve su propio país.
    Superadmin ve el país que seleccione (query param `pais`);
    si no se indica, ve el total combinado de todos los países.
    """
    conn = get_connection()
    cursor = conn.cursor()
    rol = usuario["rol"]
    pais_filtro = usuario["pais"] if rol != "superadmin" else pais

    filtro = "WHERE pais = ?" if pais_filtro else ""
    params = (pais_filtro,) if pais_filtro else ()

    cursor.execute(f"""
        SELECT
            COUNT(*) as total_registros,
            SUM(venta_total) as total_ventas,
            COUNT(DISTINCT mes) as meses_cargados,
            MAX(fecha_carga) as ultima_carga
        FROM ventas_mes {filtro}
    """, params)
    stats = cursor.fetchone()

    cursor.execute(f"""
        SELECT DISTINCT mes, anio
        FROM ventas_mes {filtro}
        ORDER BY anio DESC, mes DESC
    """, params)
    meses = [{"mes": r[0], "anio": r[1]} for r in cursor.fetchall()]
    conn.close()

    return {
        "total_registros": stats[0] or 0,
        "total_ventas": float(stats[1]) if stats[1] else 0,
        "meses_cargados": stats[2] or 0,
        "ultima_carga": str(stats[3]) if stats[3] else None,
        "meses_disponibles": meses
    }



# ── Endpoint: Cargar layout físico de una tienda ──────────
@router.post("/layout/cargar")
async def cargar_layout_tienda(
    file: UploadFile = File(...),
    tienda_codigo: str = Form(...),
    pais: str = Form(...),
    usuario=Depends(verificar_token)
):
    """
    Carga el layout físico de una tienda desde un Excel espacial
    (mapa de la tienda hecho con celdas de Excel). Solo sirve como
    contexto adicional para la IA — no valida ni reemplaza el texto
    libre de ubicacion_tienda en dinamica_detalle.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para cargar layout de tienda")

    if usuario["rol"] != "superadmin" and pais != usuario["pais"]:
        raise HTTPException(status_code=403, detail="Solo podés cargar información de tu propio país")

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT nombre FROM cat_tiendas WHERE codigo = ? AND pais = ? AND activo = 1", (tienda_codigo, pais))
    fila_tienda = cursor.fetchone()
    if not fila_tienda:
        conn.close()
        raise HTTPException(status_code=400, detail=f"La tienda {tienda_codigo} no existe o no está activa en {pais}")
    tienda_nombre = fila_tienda[0]

    contenido = await file.read()
    try:
        ubicaciones = extraer_layout_tienda(contenido)
    except Exception as e:
        conn.close()
        app_logger.warning(f"[cargar_layout_tienda] Error leyendo Excel ({tienda_codigo}, {pais}): {e}")
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo Excel. Verificá que el formato sea correcto")

    if not ubicaciones:
        conn.close()
        raise HTTPException(status_code=400, detail="No se detectaron ubicaciones en el archivo")

    # Reemplaza el layout previo de esta tienda — recargar es la
    # forma normal de actualizar si cambia el acomodo
    cursor.execute("DELETE FROM layout_tiendas WHERE tienda_codigo = ? AND pais = ?", (tienda_codigo, pais))

    cargados = 0
    for u in ubicaciones:
        cursor.execute("""
            INSERT INTO layout_tiendas
            (tienda_codigo, pais, tipo, codigo_ubicacion, descripcion, fila, columna, fila_fin, columna_fin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            tienda_codigo, pais, u['tipo'], u['codigo'], u['descripcion'] or None,
            u['fila'], u['columna'], u['fila_fin'], u['columna_fin']
        ))
        cargados += 1

    conn.commit()
    conn.close()

    con_descripcion = sum(1 for u in ubicaciones if u['tipo'] == 'texto')

    return {
        "mensaje": "Layout de tienda cargado correctamente",
        "tienda": tienda_nombre,
        "tienda_codigo": tienda_codigo,
        "total_ubicaciones": cargados,
        "con_descripcion": con_descripcion,
        "sin_descripcion": cargados - con_descripcion
    }




# ── Endpoint: Cargar resumen de campaña desde Word ────────
@router.post("/resumen/cargar")
async def cargar_resumen_campana(
    file: UploadFile = File(...),
    dinamica_id: int = Form(...),
    pais: str = Form(...),
    usuario=Depends(verificar_token)
):
    """
    Carga un Word con el resumen/flyer de una campaña y lo guarda en
    dinamicas.descripcion como JSON (lista de tarjetas). Alcance por
    país únicamente — el resumen aplica a toda la campaña, no a una
    tienda en particular.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para cargar resúmenes de campaña")

    if usuario["rol"] != "superadmin" and pais != usuario["pais"]:
        raise HTTPException(status_code=403, detail="Solo podés cargar resúmenes de tu propio país")

    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Word (.docx)")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT nombre FROM dinamicas WHERE id = ? AND pais = ?", (dinamica_id, pais))
    fila = cursor.fetchone()
    if not fila:
        conn.close()
        raise HTTPException(status_code=404, detail="Dinámica no encontrada para ese país")

    contenido = await file.read()
    try:
        bloques = extraer_bloques_docx(contenido)
    except Exception as e:
        conn.close()
        app_logger.warning(f"[cargar_resumen_campana] Error leyendo Word (dinámica {dinamica_id}, {pais}): {e}")
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo Word. Verificá que el formato sea correcto (.docx)")

    if not bloques:
        conn.close()
        raise HTTPException(status_code=400, detail="El archivo no contiene texto legible")

    cursor.execute("UPDATE dinamicas SET descripcion = ? WHERE id = ?", (json.dumps(bloques), dinamica_id))
    conn.commit()
    conn.close()

    return {
        "mensaje": "Resumen de campaña cargado correctamente",
        "dinamica_id": dinamica_id,
        "dinamica_nombre": fila[0],
        "total_tarjetas": len(bloques),
        "vista_previa": bloques[0][:150] + ("..." if len(bloques[0]) > 150 else "")
    }


# ============================================================
# CRUD de registros individuales — Dinámicas, Catálogo, Ventas
# Acceso: solo admin y superadmin (misma validación de país que la carga)
# ============================================================

class EditarArticuloDinamica(BaseModel):
    descripcion: str = None
    porcentaje_descuento: float = None
    precio_dinamica: float = None
    ubicacion_dinamica: str = None
    ubicacion_tienda: str = None
    tienda: str = None
    tipo_campana: str = None
    activo: bool = None
    fecha_actualizacion_vista: str = None  # marca de versión que el frontend vio al cargar el registro


def validar_admin_pais_crud(usuario: dict, pais_registro: str = None):
    """Valida rol admin/superadmin y que el país coincida (salvo superadmin)."""
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para esta acción")
    if pais_registro and usuario["rol"] != "superadmin" and pais_registro != usuario["pais"]:
        raise HTTPException(status_code=403, detail="No podés modificar información de otro país")


@router.get("/{dinamica_id}/detalle")
def listar_detalle_dinamica(
    dinamica_id: int,
    pagina: int = 1,
    por_pagina: int = 50,
    busqueda: str = None,
    usuario=Depends(verificar_token)
):
    """
    Lista los artículos de una dinámica específica, paginado, para edición.
    El precio regular ya no vive en dinamica_detalle — sale de
    articulos_maestro.precio_unitario vía LEFT JOIN por SKU + país
    (LEFT porque un SKU en dinámica podría no estar en el catálogo
    vigente, y no queremos que eso lo saque del listado). El AVG +
    GROUP BY es intencional: el precio es igual en todas las
    sucursales de un mismo país, así que promediar las filas por
    sucursal no altera el resultado.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para esta acción")

    conn = get_connection()
    cursor = conn.cursor()

    filtro_pais = "AND dd.pais = ?" if usuario["rol"] != "superadmin" else ""
    filtro_busqueda = "AND (dd.sku LIKE ? OR dd.descripcion LIKE ?)" if busqueda else ""

    params = [dinamica_id]
    if usuario["rol"] != "superadmin":
        params.append(usuario["pais"])
    if busqueda:
        params += [f"%{busqueda}%", f"%{busqueda}%"]

    cursor.execute(f"""
        SELECT COUNT(*) FROM dinamica_detalle dd
        WHERE dd.dinamica_id = ? {filtro_pais} {filtro_busqueda}
    """, params)
    total = cursor.fetchone()[0]

    offset = (pagina - 1) * por_pagina
    params_paginados = params + [offset, por_pagina]

    cursor.execute(f"""
        SELECT dd.id, dd.sku, dd.descripcion, dd.porcentaje_descuento,
               dd.precio_dinamica, dd.ubicacion_dinamica, dd.ubicacion_tienda,
               dd.tienda, dd.tipo_campana, dd.pais, dd.activo,
               am.precio_unitario, dd.fecha_actualizacion,
               CASE WHEN am.sku IS NULL THEN 1 ELSE 0 END as dado_de_baja
        FROM dinamica_detalle dd
        LEFT JOIN (
            SELECT sku, pais, AVG(precio_unitario) as precio_unitario
            FROM articulos_maestro
            GROUP BY sku, pais
        ) am ON am.sku = dd.sku AND am.pais = dd.pais
        WHERE dd.dinamica_id = ? {filtro_pais} {filtro_busqueda}
        ORDER BY dd.sku
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
                "codigo": f[1],
                "descripcion": f[2],
                "porcentaje_descuento": float(f[3]) if f[3] is not None else None,
                "precio_dinamica": float(f[4]) if f[4] else 0,
                "ubicacion_dinamica": f[5],
                "ubicacion_tienda": f[6],
                "tienda": f[7],
                "tipo_campana": f[8],
                "pais": f[9],
                "activo": bool(f[10]),
                "precio_regular": round(float(f[11]), 2) if f[11] else 0,
                "fecha_actualizacion": f[12].isoformat() if f[12] else None,
                "dado_de_baja": bool(f[13]),  # True si ya no está en el catálogo activo
            }
            for f in filas
        ]
    }


@router.put("/detalle/{registro_id}")
def editar_articulo_dinamica(
    registro_id: int,
    datos: EditarArticuloDinamica,
    usuario=Depends(verificar_token)
):
    """
    Edita un registro individual de dinamica_detalle.

    Usa bloqueo optimista ATÓMICO vía fecha_actualizacion: la
    condición de versión va DENTRO del WHERE del propio UPDATE, no en
    un SELECT previo separado — así el chequeo y la escritura ocurren
    como una sola operación indivisible en la base de datos. Un
    SELECT-then-UPDATE separado deja una ventana de tiempo donde dos
    peticiones casi simultáneas pueden leer la misma versión "vieja"
    antes de que ninguna haya escrito, y ambas pasarían el chequeo
    igual — confirmado con test_concurrencia.py, donde ese patrón
    dejaba pasar dos escrituras en conflicto sin detectarlo.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT pais, fecha_actualizacion FROM dinamica_detalle WHERE id = ?", (registro_id,))
    fila = cursor.fetchone()
    if not fila:
        conn.close()
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    validar_admin_pais_crud(usuario, fila[0])

    campos = []
    valores = []
    for campo, valor in datos.dict(exclude_unset=True, exclude={"fecha_actualizacion_vista"}).items():
        campos.append(f"{campo} = ?")
        valores.append(valor)

    if not campos:
        conn.close()
        raise HTTPException(status_code=400, detail="No se enviaron cambios")

    campos.append("fecha_actualizacion = SYSUTCDATETIME()")

    if datos.fecha_actualizacion_vista:
        # UPDATE condicionado a que la versión no haya cambiado desde
        # que el cliente la vio — la condición vive en el WHERE, así
        # que el chequeo y la escritura son atómicos a nivel de BD.
        valores.append(registro_id)
        valores.append(datos.fecha_actualizacion_vista)
        cursor.execute(f"""
            UPDATE dinamica_detalle SET {', '.join(campos)}
            WHERE id = ? AND fecha_actualizacion = ?
        """, valores)

        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(
                status_code=409,
                detail="Este artículo fue modificado por otra persona mientras lo editabas. "
                       "Recargá la página para ver los cambios más recientes antes de guardar de nuevo."
            )
    else:
        # Cliente viejo sin marca de versión — comportamiento anterior
        valores.append(registro_id)
        cursor.execute(f"""
            UPDATE dinamica_detalle SET {', '.join(campos)}
            WHERE id = ?
        """, valores)

    conn.commit()
    conn.close()

    registrar_auditoria(usuario, "editar", "articulo_dinamica", str(registro_id), fila[0], "Artículo de dinámica editado")

    return {"mensaje": "Registro actualizado correctamente"}


@router.delete("/detalle/{registro_id}")
def eliminar_articulo_dinamica(registro_id: int, usuario=Depends(verificar_token)):
    """Elimina (soft delete) un registro individual de dinamica_detalle."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT pais FROM dinamica_detalle WHERE id = ?", (registro_id,))
    fila = cursor.fetchone()
    if not fila:
        conn.close()
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    validar_admin_pais_crud(usuario, fila[0])

    cursor.execute("UPDATE dinamica_detalle SET activo = 0 WHERE id = ?", (registro_id,))
    conn.commit()
    conn.close()

    registrar_auditoria(usuario, "eliminar", "articulo_dinamica", str(registro_id), fila[0], "Artículo eliminado de dinámica")

    return {"mensaje": "Artículo eliminado de la dinámica"}


@router.get("/catalogo/articulos")
def listar_articulos_catalogo(
    busqueda: str,
    pagina: int = 1,
    por_pagina: int = 50,
    pais: str = None,
    usuario=Depends(verificar_token)
):
    """
    Lista artículos del catálogo maestro, paginado, para gestión.
    La búsqueda es obligatoria — evita traer los 38K+ SKUs sin filtro.
    Incluye codigo_sucursal y sucursal porque cada SKU tiene una fila
    por sucursal — sin esto no se podría distinguir ni eliminar una
    fila específica desde la vista de gestión.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para esta acción")

    if not busqueda or len(busqueda.strip()) < 2:
        raise HTTPException(status_code=400, detail="Ingresá al menos 2 caracteres para buscar")

    pais_filtro = pais if usuario["rol"] == "superadmin" else usuario["pais"]

    conn = get_connection()
    cursor = conn.cursor()

    termino = f"%{busqueda.strip()}%"
    params = [pais_filtro, termino, termino]

    cursor.execute("""
        SELECT COUNT(*) FROM articulos_maestro
        WHERE pais = ? AND (sku LIKE ? OR descripcion LIKE ?)
    """, params)
    total = cursor.fetchone()[0]

    offset = (pagina - 1) * por_pagina
    params_paginados = params + [offset, por_pagina]

    cursor.execute("""
        SELECT sku, descripcion, estado, departamento, categoria, marca,
               precio_unitario, disponible, existencia_bodega,
               codigo_sucursal, sucursal
        FROM articulos_maestro
        WHERE pais = ? AND (sku LIKE ? OR descripcion LIKE ?)
        ORDER BY sku, codigo_sucursal
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
                "sku": f[0], "descripcion": f[1], "estado": f[2],
                "departamento": f[3], "categoria": f[4], "marca": f[5],
                "precio_unitario": float(f[6]) if f[6] else 0,
                "disponible": float(f[7]) if f[7] else 0,
                "existencia_bodega": float(f[8]) if f[8] else 0,
                "codigo_sucursal": f[9],
                "sucursal": f[10],
            }
            for f in filas
        ]
    }


@router.delete("/catalogo/articulos/{sku}")
def eliminar_articulo_catalogo(
    sku: str,
    pais: str,
    codigo_sucursal: str,
    usuario=Depends(verificar_token)
):
    """
    Elimina un artículo del catálogo maestro para una sucursal
    específica (borrado físico — no hay campo 'activo' en esta tabla).
    El catálogo tiene una fila por SKU + sucursal, así que hay que
    filtrar por las tres para no borrar el SKU en las demás
    sucursales por error.
    """
    validar_admin_pais_crud(usuario, pais)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM articulos_maestro WHERE sku = ? AND pais = ? AND codigo_sucursal = ?",
        (sku, pais, codigo_sucursal)
    )
    afectados = cursor.rowcount
    conn.commit()
    conn.close()

    if afectados == 0:
        raise HTTPException(status_code=404, detail="Artículo no encontrado para esa sucursal")

    registrar_auditoria(
        usuario, "eliminar", "articulo_catalogo", sku, pais,
        f"Artículo eliminado del catálogo (sucursal {codigo_sucursal})"
    )

    return {"mensaje": f"Artículo {sku} eliminado del catálogo (sucursal {codigo_sucursal})"}


@router.delete("/catalogo/pais/{pais}")
def eliminar_catalogo_completo(pais: str, usuario=Depends(verificar_token)):
    """Elimina el catálogo completo de un país (articulos_maestro + articulos_sucursales)."""
    validar_admin_pais_crud(usuario, pais)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM articulos_maestro WHERE pais = ?", (pais,))
    articulos_eliminados = cursor.rowcount

    cursor.execute("DELETE FROM articulos_sucursales WHERE pais = ?", (pais,))
    sucursales_eliminadas = cursor.rowcount

    conn.commit()
    conn.close()

    registrar_auditoria(
        usuario, "eliminar_masivo", "catalogo_completo", pais, pais,
        f"{articulos_eliminados} artículos y {sucursales_eliminadas} registros de sucursal eliminados"
    )

    return {
        "mensaje": f"Catálogo completo de {pais} eliminado",
        "articulos_eliminados": articulos_eliminados,
        "sucursales_eliminadas": sucursales_eliminadas
    }


@router.get("/ventas/registros")
def listar_registros_ventas(
    mes: int,
    anio: int,
    pagina: int = 1,
    por_pagina: int = 50,
    busqueda: str = None,
    pais: str = None,
    usuario=Depends(verificar_token)
):
    """
    Lista registros de ventas, paginado, para gestión.
    Mes y año son obligatorios — evita traer todo el histórico de ventas sin filtro.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para esta acción")

    pais_filtro = pais if usuario["rol"] == "superadmin" else usuario["pais"]

    conn = get_connection()
    cursor = conn.cursor()

    filtros = ["pais = ?", "mes = ?", "anio = ?"]
    params = [pais_filtro, mes, anio]

    if busqueda and len(busqueda.strip()) >= 2:
        filtros.append("(sku LIKE ? OR descripcion LIKE ?)")
        termino = f"%{busqueda.strip()}%"
        params += [termino, termino]

    where_clause = " AND ".join(filtros)

    cursor.execute(f"SELECT COUNT(*) FROM ventas_mes WHERE {where_clause}", params)
    total = cursor.fetchone()[0]

    offset = (pagina - 1) * por_pagina
    params_paginados = params + [offset, por_pagina]

    cursor.execute(f"""
        SELECT id, sku, descripcion, venta_express, venta_mostrador,
               venta_externo, venta_ecommerce, venta_total, mes, anio
        FROM ventas_mes
        WHERE {where_clause}
        ORDER BY venta_total DESC
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
                "id": f[0], "sku": f[1], "descripcion": f[2],
                "venta_express": float(f[3]) if f[3] else 0,
                "venta_mostrador": float(f[4]) if f[4] else 0,
                "venta_externo": float(f[5]) if f[5] else 0,
                "venta_ecommerce": float(f[6]) if f[6] else 0,
                "venta_total": float(f[7]) if f[7] else 0,
                "mes": f[8], "anio": f[9],
            }
            for f in filas
        ]
    }


@router.delete("/ventas/registros/{registro_id}")
def eliminar_registro_venta(registro_id: int, usuario=Depends(verificar_token)):
    """Elimina un registro individual de ventas_mes (borrado físico)."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT pais FROM ventas_mes WHERE id = ?", (registro_id,))
    fila = cursor.fetchone()
    if not fila:
        conn.close()
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    validar_admin_pais_crud(usuario, fila[0])

    cursor.execute("DELETE FROM ventas_mes WHERE id = ?", (registro_id,))
    conn.commit()
    conn.close()

    registrar_auditoria(usuario, "eliminar", "venta", str(registro_id), fila[0], "Registro de venta eliminado")

    return {"mensaje": "Registro de venta eliminado"}


@router.delete("/ventas/periodo")
def eliminar_ventas_periodo(
    mes: int,
    anio: int,
    pais: str,
    usuario=Depends(verificar_token)
):
    """Elimina todos los registros de ventas de un mes/año/país específico."""
    validar_admin_pais_crud(usuario, pais)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM ventas_mes
        WHERE mes = ? AND anio = ? AND pais = ?
    """, (mes, anio, pais))
    eliminados = cursor.rowcount

    conn.commit()
    conn.close()

    if eliminados == 0:
        raise HTTPException(status_code=404, detail="No hay registros para ese período")

    registrar_auditoria(
        usuario, "eliminar_masivo", "ventas_periodo", f"{mes}/{anio}", pais,
        f"{eliminados} registros de ventas eliminados"
    )

    return {
        "mensaje": f"Ventas del período eliminadas correctamente",
        "registros_eliminados": eliminados
    }
