# ============================================================
# Router: dinamicas.py
# Descripción: Carga y análisis de dinámicas comerciales
# Formato Excel: SKU | Descripcion | Promo
# ============================================================

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from app.database import get_connection
from app.auth import verificar_token
from anthropic import Anthropic
from dotenv import load_dotenv
import pandas as pd
import io
import os

load_dotenv()
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

router = APIRouter(prefix="/dinamicas", tags=["Dinámicas Comerciales"])

# ── Ubicaciones fijas del negocio ─────────────────────────
UBICACIONES_FIJAS = {
    'isla':             'Isla',
    'cabecera':         'Cabecera',
    'punta de gondola': 'Punta de Góndola',
    'punta de góndola': 'Punta de Góndola',
    'gondola':          'Góndola',
    'botadero':         'Botadero',
    'descuento':        'General',
}

def procesar_promo(valor_promo):
    """
    Determina ubicación y tipo de campaña según el valor de Promo.
    Si es ubicación conocida → ubicacion = esa ubicación, tipo = 'Promoción'
    Si es otro valor → ubicacion = 'General', tipo = ese valor exacto
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

# ── Endpoint: Analizar Excel antes de cargar ──────────────
@router.post("/analizar")
async def analizar_excel(
    file: UploadFile = File(...),
    usuario=Depends(verificar_token)
):
    """
    Analiza un archivo Excel de dinámicas con IA antes de cargarlo.
    Formato esperado: SKU | Descripcion | Promo
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    contenido = await file.read()
    df = pd.read_excel(io.BytesIO(contenido))

    # Normalizar columnas
    df.columns = df.columns.str.strip()
    df = df.fillna("")

    print(f"Columnas detectadas: {df.columns.tolist()}")

    total_filas = len(df)
    columnas = df.columns.tolist()

    # Columnas esperadas
    columnas_esperadas = ['SKU', 'Descripcion', 'Promo']
    columnas_faltantes = []
    for esperada in columnas_esperadas:
        encontrada = get_col(df, esperada)
        if not encontrada:
            columnas_faltantes.append(esperada)

    # Columna SKU
    col_sku = get_col(df, 'SKU', 'sku', 'Codigo', 'codigo')
    col_promo = get_col(df, 'Promo', 'promo', 'PROMO', 'Ubicacion', 'ubicacion')

    # Filas sin SKU
    sin_codigo = 0
    if col_sku:
        sin_codigo = len(df[df[col_sku].astype(str).isin(['', 'nan', 'NaN'])])

    # Valores de Promo detectados
    valores_promo = []
    if col_promo:
        valores_promo = df[col_promo].astype(str).str.strip().unique().tolist()
        valores_promo = [v for v in valores_promo if v not in ['', 'nan', 'NaN']]

    # Códigos duplicados en el archivo
    # Códigos duplicados — solo si tienen el mismo Promo
    duplicados = []
    if col_sku and col_promo:
        # Duplicado real = mismo SKU + mismo Promo
        df_temp = df[[col_sku, col_promo]].astype(str)
        duplicados_mask = df_temp.duplicated(keep=False)
        duplicados_reales = df_temp[duplicados_mask][col_sku].unique().tolist()
        duplicados = [d for d in duplicados_reales if d not in ['nan', 'NaN', '']]
    elif col_sku:
        # Si no hay columna Promo, duplicado = mismo SKU
        codigos = df[col_sku].astype(str)
        duplicados = codigos[codigos.duplicated()].unique().tolist()

    # Detectar inconsistencias de formato en Promo
    inconsistencias_promo = []
    if col_promo:
        for val in valores_promo:
            if '--' in val or '---' in val:
                inconsistencias_promo.append(f"'{val}' — guiones dobles/triples = pd.read_excel")

    # Verificar duplicados en BD activa
    conn = get_connection()
    cursor = conn.cursor()
    codigos_en_bd = []
    if col_sku:
        for codigo in df[col_sku].astype(str).unique():
            if codigo and codigo not in ['nan', 'NaN', '']:
                cursor.execute("""
                    SELECT COUNT(*) FROM dinamica_detalle dd
                    INNER JOIN dinamicas d ON dd.dinamica_id = d.id
                    WHERE dd.articulo_codigo = ? AND d.activa = 1 AND dd.activo = 1
                """, (codigo,))
                if cursor.fetchone()[0] > 0:
                    codigos_en_bd.append(codigo)
    conn.close()

    # Resumen para la IA
    resumen = f"""
Archivo: {file.filename}
Total de filas: {total_filas}
Columnas detectadas: {', '.join(columnas)}
Columnas faltantes del formato esperado (SKU, Descripcion, Promo): {', '.join(columnas_faltantes) if columnas_faltantes else 'Ninguna'}

Problemas detectados:
- Filas sin SKU: {sin_codigo}
- SKUs duplicados en el archivo: {len(duplicados)} ({', '.join(duplicados[:5])}{'...' if len(duplicados) > 5 else ''})
- SKUs ya en una dinámica activa: {len(codigos_en_bd)} ({', '.join(codigos_en_bd[:5])}{'...' if len(codigos_en_bd) > 5 else ''})

Valores de Promo detectados: {', '.join(valores_promo[:10])}

Muestra de datos (primeras 5 filas):
{df.head(5).to_string()}
"""

    # Llamar a la IA
    respuesta = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system="""Eres el asistente de análisis de PromoIQ para dinámicas comerciales de VIDRI/NOVEX.
Tu trabajo es analizar archivos Excel de dinámicas antes de cargarlos al sistema.

FORMATO ESPERADO: SKU | Descripcion | Promo

REGLAS IMPORTANTES:
- La columna Promo acepta nombres libres de campaña: Isla, Isla1, Isla2, Isla 360, Cabecera, Botadero, Punta de Góndola, nombres de feria, etc.
- Un SKU puede aparecer varias veces si tiene diferentes valores de Promo — eso es válido.
- Solo es duplicado real si el mismo SKU tiene exactamente el mismo valor de Promo.
- Los precios NO son requeridos — vienen del catálogo maestro.
- Alertá sobre inconsistencias de formato como guiones dobles (--) o triples (---) pero NO lo marqués como error grave.
- Sé específico y constructivo en las recomendaciones.

Respondé siempre en español, de forma clara y concisa.""",
        messages=[{
            "role": "user",
            "content": f"""Analizá este archivo Excel de dinámicas para PromoIQ:

{resumen}

Inconsistencias de formato detectadas en Promo: {', '.join(inconsistencias_promo) if inconsistencias_promo else 'Ninguna'}

Proporcioná:
1. Veredicto claro: ¿Está listo para cargar?
2. Errores reales que impiden la carga (si hay)
3. Alertas de formato a considerar — no bloquean la carga pero es bueno estandarizar
4. Lo que está bien en el archivo"""
        }]
    )

    return {
        "archivo": file.filename,
        "total_filas": total_filas,
        "columnas_detectadas": columnas,
        "columnas_faltantes": columnas_faltantes,
        "problemas": {
            "sin_codigo": sin_codigo,
            "sin_precio": 0,
            "sin_ubicacion": 0,
            "duplicados_archivo": len(duplicados),
            "duplicados_bd": len(codigos_en_bd),
            "codigos_duplicados": duplicados[:10],
            "codigos_en_bd": codigos_en_bd[:10]
        },
        "listo_para_cargar": (
            sin_codigo == 0 and
            len(columnas_faltantes) == 0 and
            len(duplicados) == 0  # solo duplicados reales bloquean
        ),
        "analisis_ia": respuesta.content[0].text
    }

# ── Endpoint: Cargar Excel de dinámicas ───────────────────
@router.post("/cargar")
async def cargar_excel(
    file: UploadFile = File(...),
    dinamica_id: int = Form(...),
    pais: str = Form(...),
    usuario=Depends(verificar_token)
):
    """
    Carga archivo Excel de dinámicas a la BD.
    Formato: SKU | Descripcion | Promo
    Aplica para todas las tiendas del país.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    contenido = await file.read()
    df = pd.read_excel(io.BytesIO(contenido))

    df.columns = df.columns.str.strip()
    df = df.fillna("")

    col_sku   = get_col(df, 'SKU', 'sku', 'Codigo', 'codigo')
    col_desc  = get_col(df, 'Descripcion', 'descripcion', 'DESCRIPCION')
    col_promo = get_col(df, 'Promo', 'promo', 'PROMO', 'Ubicacion', 'ubicacion')

    if not col_sku:
        raise HTTPException(status_code=400, detail="No se encontró columna SKU")

    conn = get_connection()
    cursor = conn.cursor()

    # Limpiar registros anteriores
    cursor.execute("""
        DELETE FROM dinamica_detalle
        WHERE dinamica_id = ? AND pais = ?
    """, (dinamica_id, pais))

    registros_cargados = 0

    for _, fila in df.iterrows():
        try:
            codigo = str(fila.get(col_sku, '')).strip()
            if not codigo or codigo in ['nan', 'NaN', '']:
                continue

            descripcion = str(fila.get(col_desc, '')).strip() if col_desc else ''
            promo_valor = fila.get(col_promo, '') if col_promo else ''
            ubicacion, tipo_campana = procesar_promo(promo_valor)

            cursor.execute("""
                INSERT INTO dinamica_detalle
                (dinamica_id, articulo_codigo, articulo_descripcion, categoria,
                 precio_regular, precio_dinamica, ubicacion, tienda, tipo_campana, pais)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                dinamica_id,
                codigo,
                descripcion,
                '',
                0.0,
                0.0,
                ubicacion,
                'Todas las tiendas',
                tipo_campana,
                pais
            ))
            registros_cargados += 1

        except Exception as e:
            print(f"Error en fila SKU {codigo}: {e}")
            continue

        # Commit cada 500 registros
        if registros_cargados % 500 == 0:
            conn.commit()

    # Registrar en log
    try:
        cursor.execute("""
            INSERT INTO carga_log (usuario_id, nombre_archivo, registros_cargados, dinamica_id)
            VALUES (?, ?, ?, ?)
        """, (usuario["id"], file.filename, registros_cargados, dinamica_id))
    except:
        pass

    conn.commit()
    conn.close()

    return {
        "mensaje": "Archivo cargado exitosamente",
        "archivo": file.filename,
        "dinamica_id": dinamica_id,
        "pais": pais,
        "registros_cargados": registros_cargados,
        "notificacion_pendiente": True
    }

# ── Endpoint: Analizar Excel catálogo ─────────────────────
@router.post("/catalogo/cargar")
async def cargar_catalogo(
    file: UploadFile = File(...),
    pais: str = Form(...),
    usuario=Depends(verificar_token)
):
    """
    Carga el catálogo maestro de artículos desde Excel.
    Se actualiza diariamente. Reemplaza los datos del país.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para cargar catálogo")

    contenido = await file.read()

    # ── DataFrame original con TODOS los registros (para sucursales) ──
    df_original = pd.read_excel(io.BytesIO(contenido))
    df_original.columns = df_original.columns.str.strip()
    print(f"Columnas catálogo detectadas: {df_original.columns.tolist()}")

    # ── DataFrame deduplicado por SKU (para artículos maestro) ────────
    df = df_original.copy()
    col_sku_cat = None
    for col in df.columns:
        if col.strip().lower() == 'sku':
            col_sku_cat = col
            break

    if col_sku_cat:
        antes = len(df)
        df = df.drop_duplicates(subset=[col_sku_cat], keep='first')
        despues = len(df)
        print(f"✅ Deduplicados: {antes} → {despues} registros únicos por SKU")

    conn = get_connection()
    cursor = conn.cursor()

    # ── Limpiar registros anteriores ──────────────────────
    cursor.execute("DELETE FROM articulos_maestro WHERE pais = ?", (pais,))
    cursor.execute("DELETE FROM articulos_sucursales WHERE pais = ?", (pais,))

    registros_cargados = 0
    errores = 0
    sucursales_cargadas = 0

    # ── Funciones auxiliares ──────────────────────────────
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

    # ── Detectar columnas de sucursales ───────────────────
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

    print(f"Columnas sucursales detectadas: sku={col_sku_orig}, cod={col_suc_cod}, nom={col_suc_nom}")

    # ── Cargar sucursales ─────────────────────────────────
    if col_sku_orig and col_suc_cod:
        for _, fila in df_original.iterrows():
            try:
                sku_s = safe_str(fila.get(col_sku_orig, ''))
                cod_suc = safe_str(fila.get(col_suc_cod, ''))
                if not sku_s or not cod_suc:
                    continue

                cursor.execute("""
                    INSERT INTO articulos_sucursales
                    (sku, codigo_sucursal, sucursal, existencia,
                     disponible, consumo_mensual, pais)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    sku_s,
                    cod_suc,
                    safe_str(fila.get(col_suc_nom, '')),
                    safe_decimal(fila.get(col_exist, 0)),
                    safe_decimal(fila.get(col_disp, 0)),
                    safe_decimal(fila.get(col_consumo, 0)),
                    pais
                ))
                sucursales_cargadas += 1

            except Exception as e:
                print(f"Error en sucursal: {e}")
                continue

            if sucursales_cargadas % 500 == 0:
                conn.commit()
                print(f"✅ {sucursales_cargadas} sucursales cargadas...")

        conn.commit()
        print(f"✅ Total sucursales: {sucursales_cargadas}")
    else:
        print(f"⚠️ No se encontraron columnas de sucursal: sku={col_sku_orig}, cod={col_suc_cod}")



    def safe_decimal(val):
        try:
            if pd.isna(val):
                return None
            s = str(val).strip().replace(',', '.')
            if s in ['', 'nan', 'NaN']:
                return None
            f = float(s)
            # Limitar rango para DECIMAL(10,2)
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

    for _, fila in df.iterrows():
        try:
            sku = safe_str(fila.get('SKU', fila.get('sku', '')))
            if not sku:
                continue

            cursor.execute("""
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
            """, (
                sku,
                safe_str(fila.get('Descripcion', fila.get('descripcion')), 300),
                safe_str(fila.get('Codigo Sucursal', fila.get('Codigo_Sucursal', fila.get('codigo_sucursal')))),
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
            registros_cargados += 1

        except Exception as e:
            errores += 1
            print(f"Error en fila: {e}")
            continue

        # Cambiar el commit cada 500 por cada 100
    if registros_cargados % 100 == 0:
        conn.commit()
        print(f"✅ {registros_cargados} registros cargados...")

    try:
        cursor.execute("""
            INSERT INTO carga_log (usuario_id, nombre_archivo, registros_cargados, dinamica_id)
            VALUES (?, ?, ?, NULL)
        """, (usuario["id"], file.filename, registros_cargados))
    except:
        pass

    conn.commit()
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
def stats_catalogo(usuario=Depends(verificar_token)):
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]

    filtro = "WHERE pais = ?" if pais and rol != "superadmin" else ""
    params = (pais,) if pais and rol != "superadmin" else ()

    cursor.execute(f"""
        SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT departamento) as departamentos,
            COUNT(DISTINCT marca) as marcas,
            MAX(fecha_actualizacion) as ultima_actualizacion
        FROM articulos_maestro {filtro}
    """, params)
    stats = cursor.fetchone()

    # Contar sucursales reales de la tabla separada
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
    Formato: SKU | Descripcion | Vidri Express | Mostrador | Externo | E-Commerce | Total general
    Cuando SKU = 00000, el SKU real está al inicio de la Descripcion.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel")

    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para cargar ventas")

    contenido = await file.read()

    # Leer el Excel saltando las primeras filas de encabezado
    # El archivo tiene 2 filas de header: VentaU/TipoVenta y los nombres de columnas
    try:
        df = pd.read_excel(io.BytesIO(contenido), header=1)
    except:
        df = pd.read_excel(io.BytesIO(contenido))

    df.columns = df.columns.str.strip()
    print(f"Columnas ventas detectadas: {df.columns.tolist()}")
    df = df.fillna(0)

    # ── Detectar columnas ─────────────────────────────────
    def get_col_ventas(df, *nombres):
        for nombre in nombres:
            for col in df.columns:
                if col.strip().lower() == nombre.lower():
                    return col
        return None

    col_sku   = get_col_ventas(df, 'sku', 'SKU')
    col_desc  = get_col_ventas(df, 'descripcion', 'Descripcion', 'DESCRIPCION')
    col_vidri = get_col_ventas(df, 'vidri express', 'Vidri Express', 'VIDRI EXPRESS')
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
        """
        Si SKU es 00000 o similar, extrae el SKU real
        del inicio de la descripción.
        Formato: '100206 PORTARROLLO CROMADO...' → '100206'
        """
        sku_str = str(sku_val).strip()

        # Si el SKU es 00000 o está vacío usar la descripción
        if sku_str in ['00000', '0', '', 'nan', 'NaN']:
            desc_str = str(desc_val).strip()
            if desc_str and desc_str not in ['nan', 'NaN', '']:
                # El SKU real es la primera palabra de la descripción
                partes = desc_str.split()
                if partes and partes[0].isdigit():
                    return partes[0], ' '.join(partes[1:])
                return None, desc_str
            return None, None

        return sku_str, str(desc_val).strip()

    conn = get_connection()
    cursor = conn.cursor()

    # Limpiar registros del mismo mes/año/país
    cursor.execute("""
        DELETE FROM ventas_mes
        WHERE mes = ? AND anio = ? AND pais = ?
    """, (mes, anio, pais))

    registros_cargados = 0
    errores = 0

    for _, fila in df.iterrows():
        try:
            sku_raw  = fila.get(col_sku, '')
            desc_raw = fila.get(col_desc, '') if col_desc else ''

            sku, descripcion = extraer_sku(sku_raw, desc_raw)

            if not sku:
                continue

            # Saltar filas de totales o subtotales
            if str(descripcion).lower().startswith('total'):
                continue

            venta_vidri = safe_decimal_v(fila.get(col_vidri, 0)) if col_vidri else 0.0
            venta_most  = safe_decimal_v(fila.get(col_most, 0))  if col_most  else 0.0
            venta_ext   = safe_decimal_v(fila.get(col_ext, 0))   if col_ext   else 0.0
            venta_ecom  = safe_decimal_v(fila.get(col_ecom, 0))  if col_ecom  else 0.0
            venta_total = safe_decimal_v(fila.get(col_total, 0)) if col_total else 0.0

            # Si no hay ventas en ningún canal saltar la fila
            if venta_vidri + venta_most + venta_ext + venta_ecom + venta_total == 0:
                continue

            cursor.execute("""
                INSERT INTO ventas_mes
                (sku, descripcion, venta_vidri_express, venta_mostrador,
                 venta_externo, venta_ecommerce, venta_total,
                 mes, anio, pais)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sku,
                descripcion,
                venta_vidri,
                venta_most,
                venta_ext,
                venta_ecom,
                venta_total,
                mes,
                anio,
                pais
            ))
            registros_cargados += 1

        except Exception as e:
            errores += 1
            print(f"Error en fila ventas: {e}")
            continue

        if registros_cargados % 200 == 0:
            conn.commit()
            print(f"✅ {registros_cargados} ventas cargadas...")

    # Registrar en log
    try:
        cursor.execute("""
            INSERT INTO carga_log (usuario_id, nombre_archivo, registros_cargados, dinamica_id)
            VALUES (?, ?, ?, NULL)
        """, (usuario["id"], file.filename, registros_cargados))
    except:
        pass

    conn.commit()
    conn.close()

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
def stats_ventas(usuario=Depends(verificar_token)):
    """Retorna estadísticas de ventas en promo por país"""
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]

    filtro = "WHERE pais = ?" if pais and rol != "superadmin" else ""
    params = (pais,) if pais and rol != "superadmin" else ()

    cursor.execute(f"""
        SELECT
            COUNT(*) as total_registros,
            SUM(venta_total) as total_ventas,
            COUNT(DISTINCT mes) as meses_cargados,
            MAX(fecha_carga) as ultima_carga
        FROM ventas_mes {filtro}
    """, params)

    stats = cursor.fetchone()

    # Meses disponibles
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