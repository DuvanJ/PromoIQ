# ============================================================
# Router: dinamicas.py
# Descripción: Carga, análisis y gestión de dinámicas comerciales,
# catálogo de artículos y ventas mensuales
# ============================================================

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from app.database import get_connection, registrar_auditoria
from app.auth import verificar_token
from anthropic import Anthropic
from dotenv import load_dotenv
from pydantic import BaseModel
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

    df.columns = df.columns.str.strip()
    df = df.fillna("")

    print(f"Columnas detectadas: {df.columns.tolist()}")

    total_filas = len(df)
    columnas = df.columns.tolist()

    columnas_esperadas = ['SKU', 'Descripcion', 'Promo']
    columnas_faltantes = []
    for esperada in columnas_esperadas:
        encontrada = get_col(df, esperada)
        if not encontrada:
            columnas_faltantes.append(esperada)

    col_sku = get_col(df, 'SKU', 'sku', 'Codigo', 'codigo')
    col_promo = get_col(df, 'Promo', 'promo', 'PROMO', 'Ubicacion', 'ubicacion')

    sin_codigo = 0
    if col_sku:
        sin_codigo = len(df[df[col_sku].astype(str).isin(['', 'nan', 'NaN'])])

    valores_promo = []
    if col_promo:
        valores_promo = df[col_promo].astype(str).str.strip().unique().tolist()
        valores_promo = [v for v in valores_promo if v not in ['', 'nan', 'NaN']]

    duplicados = []
    if col_sku and col_promo:
        df_temp = df[[col_sku, col_promo]].astype(str)
        duplicados_mask = df_temp.duplicated(keep=False)
        duplicados_reales = df_temp[duplicados_mask][col_sku].unique().tolist()
        duplicados = [d for d in duplicados_reales if d not in ['nan', 'NaN', '']]
    elif col_sku:
        codigos = df[col_sku].astype(str)
        duplicados = codigos[codigos.duplicated()].unique().tolist()

    inconsistencias_promo = []
    if col_promo:
        for val in valores_promo:
            if '--' in val or '---' in val:
                inconsistencias_promo.append(f"'{val}' — guiones dobles/triples = pd.read_excel")

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
            len(duplicados) == 0
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
    Solo admin/superadmin, y solo para su propio país (salvo superadmin).
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para cargar dinámicas")

    if usuario["rol"] != "superadmin" and pais != usuario["pais"]:
        raise HTTPException(status_code=403, detail="Solo podés cargar información de tu propio país")

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

        if registros_cargados % 500 == 0:
            conn.commit()

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

# ── Endpoint: Cargar Excel catálogo ─────────────────────
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

    if usuario["rol"] != "superadmin" and pais != usuario["pais"]:
        raise HTTPException(status_code=403, detail="Solo podés cargar información de tu propio país")

    contenido = await file.read()

    df_original = pd.read_excel(io.BytesIO(contenido))
    df_original.columns = df_original.columns.str.strip()
    print(f"Columnas catálogo detectadas: {df_original.columns.tolist()}")

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

    LOTE = 2000

    if col_sku_orig and col_suc_cod:
        filas_sucursales = []
        for _, fila in df_original.iterrows():
            sku_s = safe_str(fila.get(col_sku_orig, ''))
            cod_suc = safe_str(fila.get(col_suc_cod, ''))
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
                print(f"✅ {sucursales_cargadas} registros de inventario por sucursal cargados...")
            except Exception as e:
                print(f"Error en lote de sucursales: {e}")

        print(f"✅ Total sucursales: {sucursales_cargadas}")
    else:
        print(f"⚠️ No se encontraron columnas de sucursal: sku={col_sku_orig}, cod={col_suc_cod}")

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
        except Exception as e:
            errores += 1
            print(f"Error preparando fila: {e}")
            continue

    for i in range(0, len(filas_articulos), LOTE):
        lote = filas_articulos[i:i + LOTE]
        try:
            cursor.executemany(sql_articulos, lote)
            conn.commit()
            registros_cargados += len(lote)
            print(f"✅ {registros_cargados} artículos cargados...")
        except Exception as e:
            errores += len(lote)
            print(f"Error en lote de artículos: {e}")

    try:
        cursor.execute("""
            INSERT INTO carga_log (usuario_id, nombre_archivo, registros_cargados, dinamica_id)
            VALUES (?, ?, ?, NULL)
        """, (usuario["id"], file.filename, registros_cargados))
        conn.commit()
    except:
        pass

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
    Formato: SKU | Descripcion | Vidri Express | Mostrador | Externo | E-Commerce | Total general
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
    except:
        df = pd.read_excel(io.BytesIO(contenido))

    df.columns = df.columns.str.strip()
    print(f"Columnas ventas detectadas: {df.columns.tolist()}")
    df = df.fillna(0)

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
            print(f"Error preparando fila ventas: {e}")
            continue

    sql_ventas = """
        INSERT INTO ventas_mes
        (sku, descripcion, venta_vidri_express, venta_mostrador,
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
            print(f"✅ {registros_cargados} ventas cargadas...")
        except Exception as e:
            errores += len(lote)
            print(f"Error en lote de ventas: {e}")

    try:
        cursor.execute("""
            INSERT INTO carga_log (usuario_id, nombre_archivo, registros_cargados, dinamica_id)
            VALUES (?, ?, ?, NULL)
        """, (usuario["id"], file.filename, registros_cargados))
        conn.commit()
    except:
        pass

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


# ============================================================
# CRUD de registros individuales — Dinámicas, Catálogo, Ventas
# Acceso: solo admin y superadmin (misma validación de país que la carga)
# ============================================================

class EditarArticuloDinamica(BaseModel):
    articulo_descripcion: str = None
    precio_regular: float = None
    precio_dinamica: float = None
    ubicacion: str = None
    tienda: str = None
    tipo_campana: str = None
    activo: bool = None


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
    """Lista los artículos de una dinámica específica, paginado, para edición."""
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Sin permisos para esta acción")

    conn = get_connection()
    cursor = conn.cursor()

    filtro_pais = "AND pais = ?" if usuario["rol"] != "superadmin" else ""
    filtro_busqueda = "AND (articulo_codigo LIKE ? OR articulo_descripcion LIKE ?)" if busqueda else ""

    params = [dinamica_id]
    if usuario["rol"] != "superadmin":
        params.append(usuario["pais"])
    if busqueda:
        params += [f"%{busqueda}%", f"%{busqueda}%"]

    cursor.execute(f"""
        SELECT COUNT(*) FROM dinamica_detalle
        WHERE dinamica_id = ? {filtro_pais} {filtro_busqueda}
    """, params)
    total = cursor.fetchone()[0]

    offset = (pagina - 1) * por_pagina
    params_paginados = params + [offset, por_pagina]

    cursor.execute(f"""
        SELECT id, articulo_codigo, articulo_descripcion, precio_regular,
               precio_dinamica, ubicacion, tienda, tipo_campana, pais, activo
        FROM dinamica_detalle
        WHERE dinamica_id = ? {filtro_pais} {filtro_busqueda}
        ORDER BY articulo_codigo
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
                "precio_regular": float(f[3]) if f[3] else 0,
                "precio_dinamica": float(f[4]) if f[4] else 0,
                "ubicacion": f[5],
                "tienda": f[6],
                "tipo_campana": f[7],
                "pais": f[8],
                "activo": bool(f[9])
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
    """Edita un registro individual de dinamica_detalle."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT pais FROM dinamica_detalle WHERE id = ?", (registro_id,))
    fila = cursor.fetchone()
    if not fila:
        conn.close()
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    validar_admin_pais_crud(usuario, fila[0])

    campos = []
    valores = []
    for campo, valor in datos.dict(exclude_unset=True).items():
        campos.append(f"{campo} = ?")
        valores.append(valor)

    if not campos:
        conn.close()
        raise HTTPException(status_code=400, detail="No se enviaron cambios")

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
               precio_unitario, disponible, existencia_bodega
        FROM articulos_maestro
        WHERE pais = ? AND (sku LIKE ? OR descripcion LIKE ?)
        ORDER BY sku
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
            }
            for f in filas
        ]
    }


@router.delete("/catalogo/articulos/{sku}")
def eliminar_articulo_catalogo(sku: str, pais: str, usuario=Depends(verificar_token)):
    """Elimina un artículo del catálogo maestro (borrado físico — no hay campo 'activo' en esta tabla)."""
    validar_admin_pais_crud(usuario, pais)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM articulos_maestro WHERE sku = ? AND pais = ?", (sku, pais))
    afectados = cursor.rowcount
    conn.commit()
    conn.close()

    if afectados == 0:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")

    registrar_auditoria(usuario, "eliminar", "articulo_catalogo", sku, pais, "Artículo eliminado del catálogo")

    return {"mensaje": f"Artículo {sku} eliminado del catálogo"}


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
        SELECT id, sku, descripcion, venta_vidri_express, venta_mostrador,
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
                "venta_vidri_express": float(f[3]) if f[3] else 0,
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