# ============================================================
# Router: exportar.py
# Descripción: Endpoints para exportar datos a Excel
# Acceso: según rol del usuario
# ============================================================

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.database import get_connection
from app.auth import verificar_token
import openpyxl
from openpyxl.styles import (
    PatternFill, Font, Alignment, Border, Side
)
from openpyxl.utils import get_column_letter
import io
from datetime import datetime

router = APIRouter(prefix="/exportar", tags=["Exportar"])

# ── Estilos de Excel ──────────────────────────────────────
def estilo_header(ws, fila, columnas, color_fondo="1E2761"):
    """Aplica estilo profesional a la fila de encabezados"""
    fill = PatternFill(start_color=color_fondo, end_color=color_fondo, fill_type="solid")
    font = Font(color="FFFFFF", bold=True, size=11, name="Calibri")
    alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    border = Border(
        bottom=Side(style="medium", color="FFFFFF")
    )
    for col, valor in enumerate(columnas, 1):
        cell = ws.cell(row=fila, column=col, value=valor)
        cell.fill = fill
        cell.font = font
        cell.alignment = alignment
        cell.border = border

def estilo_fila(ws, fila, valores, par=True):
    """Aplica estilo a filas de datos con colores alternados"""
    color = "F4F7FB" if par else "FFFFFF"
    fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
    font = Font(name="Calibri", size=10)
    alignment = Alignment(vertical="center", wrap_text=False)
    for col, valor in enumerate(valores, 1):
        cell = ws.cell(row=fila, column=col, value=valor)
        cell.fill = fill
        cell.font = font
        cell.alignment = alignment

def ajustar_columnas(ws):
    """Ajusta el ancho de columnas automáticamente"""
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max_len + 4, 40)

def agregar_titulo(ws, titulo, subtitulo, color="1E2761"):
    """Agrega título y subtítulo al inicio del reporte"""
    ws.merge_cells('A1:J1')
    cell_titulo = ws['A1']
    cell_titulo.value = titulo
    cell_titulo.font = Font(name="Calibri", bold=True, size=14, color=color)
    cell_titulo.alignment = Alignment(horizontal="center", vertical="center")
    cell_titulo.fill = PatternFill(start_color="F4F7FB", end_color="F4F7FB", fill_type="solid")
    ws.row_dimensions[1].height = 30

    ws.merge_cells('A2:J2')
    cell_sub = ws['A2']
    cell_sub.value = subtitulo
    cell_sub.font = Font(name="Calibri", size=10, color="8892A4", italic=True)
    cell_sub.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 20

# ── Endpoint: Exportar artículos en dinámica ─────────────
@router.get("/articulos")
def exportar_articulos(usuario=Depends(verificar_token)):
    """
    Exporta todos los artículos en dinámica a Excel.
    Filtra por país según el rol del usuario.
    categoria y precio_regular salen de articulos_maestro vía LEFT JOIN
    por SKU — ya no viven en dinamica_detalle.
    """
    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]

    join_catalogo = """
        LEFT JOIN (
            SELECT sku, pais, MIN(categoria) as categoria, AVG(precio_unitario) as precio_unitario
            FROM articulos_maestro
            GROUP BY sku, pais
        ) am ON am.sku = dd.sku AND am.pais = dd.pais
    """

    if pais and rol != "superadmin":
        cursor.execute(f"""
            SELECT dd.sku, dd.descripcion, am.categoria,
                   am.precio_unitario, dd.precio_dinamica,
                   dd.ubicacion_dinamica, dd.ubicacion_tienda, dd.tienda, dd.tipo_campana, dd.pais,
                   d.nombre as dinamica, d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            {join_catalogo}
            WHERE dd.activo = 1 AND d.activa = 1 AND dd.pais = ?
            ORDER BY dd.tienda, dd.ubicacion_dinamica, dd.sku
        """, (pais,))
    else:
        cursor.execute(f"""
            SELECT dd.sku, dd.descripcion, am.categoria,
                   am.precio_unitario, dd.precio_dinamica,
                   dd.ubicacion_dinamica, dd.ubicacion_tienda, dd.tienda, dd.tipo_campana, dd.pais,
                   d.nombre as dinamica, d.fecha_inicio, d.fecha_fin
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            {join_catalogo}
            WHERE dd.activo = 1 AND d.activa = 1
            ORDER BY dd.pais, dd.tienda, dd.ubicacion_dinamica, dd.sku
        """)

    filas = cursor.fetchall()
    conn.close()

    # ── Crear Excel ───────────────────────────────────────
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Artículos en Dinámica"

    fecha_reporte = datetime.now().strftime("%d/%m/%Y %H:%M")
    pais_label = {"CR": "Costa Rica", "GT": "Guatemala", "SV": "El Salvador"}.get(pais, "Todos los países")

    agregar_titulo(
        ws,
        f"PromoIQ — Artículos en Dinámica",
        f"Generado el {fecha_reporte} | País: {pais_label} | Usuario: {usuario['nombre']}"
    )

    columnas = [
        "Código", "Descripción", "Categoría",
        "Precio Regular", "Precio Dinámica", "Ahorro",
        "Ubicación Dinámica", "Ubicación Tienda", "Tienda", "Tipo Campaña", "País",
        "Dinámica", "Fecha Inicio", "Fecha Fin"
    ]
    estilo_header(ws, 3, columnas)
    ws.row_dimensions[3].height = 22

    for i, fila in enumerate(filas, 4):
        precio_regular = float(fila[3]) if fila[3] else 0
        precio_dinamica = float(fila[4]) if fila[4] else 0
        valores = [
            str(fila[0]),
            str(fila[1]),
            str(fila[2]) if fila[2] else "-",
            precio_regular,
            precio_dinamica,
            round(precio_regular - precio_dinamica, 2),
            str(fila[5]) if fila[5] else "-",
            str(fila[6]) if fila[6] else "-",
            str(fila[7]) if fila[7] else "-",
            str(fila[8]) if fila[8] else "-",
            str(fila[9]) if fila[9] else "-",
            str(fila[10]),
            str(fila[11]),
            str(fila[12]),
        ]
        estilo_fila(ws, i, valores, par=(i % 2 == 0))

    # Formato de moneda en columnas de precio
    for row in ws.iter_rows(min_row=4, max_row=len(filas) + 3, min_col=4, max_col=6):
        for cell in row:
            cell.number_format = '"$"#,##0.00'

    ajustar_columnas(ws)
    ws.freeze_panes = "A4"

    # ── Guardar y retornar ────────────────────────────────
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    nombre_archivo = f"PromoIQ_Articulos_{pais_label}_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={nombre_archivo}"}
    )

# ── Endpoint: Exportar historial de consultas ─────────────
@router.get("/historial")
def exportar_historial(usuario=Depends(verificar_token)):
    """
    Exporta el historial de consultas a la IA en Excel.
    Solo disponible para admin y superadmin.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Acceso no autorizado")

    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]

    if pais and rol != "superadmin":
        cursor.execute("""
            SELECT u.nombre, r.nombre as rol, c.pregunta,
                   c.tokens_usados, c.fecha
            FROM consultas_log c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            INNER JOIN cat_roles r ON u.rol_id = r.id
            WHERE u.pais = ?
            ORDER BY c.fecha DESC
        """, (pais,))
    else:
        cursor.execute("""
            SELECT u.nombre, r.nombre as rol, c.pregunta,
                   c.tokens_usados, c.fecha
            FROM consultas_log c
            INNER JOIN usuarios u ON c.usuario_id = u.id
            INNER JOIN cat_roles r ON u.rol_id = r.id
            ORDER BY c.fecha DESC
        """)

    filas = cursor.fetchall()
    conn.close()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Historial de Consultas"

    fecha_reporte = datetime.now().strftime("%d/%m/%Y %H:%M")
    pais_label = {"CR": "Costa Rica", "GT": "Guatemala", "SV": "El Salvador"}.get(pais, "Todos los países")

    agregar_titulo(
        ws,
        "PromoIQ — Historial de Consultas IA",
        f"Generado el {fecha_reporte} | País: {pais_label} | Total: {len(filas)} consultas"
    )

    columnas = ["Usuario", "Rol", "Pregunta", "Tokens Usados", "Fecha"]
    estilo_header(ws, 3, columnas, color_fondo="0077B6")
    ws.row_dimensions[3].height = 22

    for i, fila in enumerate(filas, 4):
        valores = [
            str(fila[0]),
            str(fila[1]),
            str(fila[2]),
            int(fila[3]) if fila[3] else 0,
            str(fila[4]),
        ]
        estilo_fila(ws, i, valores, par=(i % 2 == 0))

    ajustar_columnas(ws)
    ws.freeze_panes = "A4"

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    nombre_archivo = f"PromoIQ_Historial_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={nombre_archivo}"}
    )

# ── Endpoint: Exportar reporte completo ───────────────────
@router.get("/reporte-completo")
def exportar_reporte_completo(usuario=Depends(verificar_token)):
    """
    Exporta un reporte completo con múltiples hojas:
    - Artículos por dinámica
    - Resumen por ubicación
    - Resumen por tipo de campaña
    Solo disponible para admin y superadmin.
    categoria y precio_regular salen de articulos_maestro vía LEFT JOIN por SKU.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Acceso no autorizado")

    conn = get_connection()
    cursor = conn.cursor()
    pais = usuario["pais"]
    rol = usuario["rol"]
    filtro = f"AND dd.pais = '{pais}'" if pais and rol != "superadmin" else ""
    pais_label = {"CR": "Costa Rica", "GT": "Guatemala", "SV": "El Salvador"}.get(pais, "Todos los países")
    fecha_reporte = datetime.now().strftime("%d/%m/%Y %H:%M")

    join_catalogo = """
        LEFT JOIN (
            SELECT sku, pais, MIN(categoria) as categoria, AVG(precio_unitario) as precio_unitario
            FROM articulos_maestro
            GROUP BY sku, pais
        ) am ON am.sku = dd.sku AND am.pais = dd.pais
    """

    wb = openpyxl.Workbook()

    # ── Hoja 1: Artículos ─────────────────────────────────
    ws1 = wb.active
    ws1.title = "Artículos"
    agregar_titulo(ws1, "Artículos en Dinámica", f"Generado el {fecha_reporte} | {pais_label}")

    cursor.execute(f"""
        SELECT dd.sku, dd.descripcion, am.categoria,
               am.precio_unitario, dd.precio_dinamica,
               dd.ubicacion_dinamica, dd.tienda, dd.tipo_campana, d.nombre
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        {join_catalogo}
        WHERE dd.activo = 1 AND d.activa = 1 {filtro}
        ORDER BY dd.tienda, dd.ubicacion_dinamica
    """)
    articulos = cursor.fetchall()

    estilo_header(ws1, 3, ["Código", "Descripción", "Categoría", "P. Regular", "P. Dinámica", "Ahorro", "Ubicación", "Tienda", "Tipo Campaña", "Dinámica"])
    for i, f in enumerate(articulos, 4):
        precio_regular = float(f[3] or 0)
        precio_dinamica = float(f[4] or 0)
        estilo_fila(ws1, i, [
            str(f[0]), str(f[1]), str(f[2] or "-"),
            precio_regular, precio_dinamica, round(precio_regular - precio_dinamica, 2),
            str(f[5] or "-"), str(f[6] or "-"), str(f[7] or "-"), str(f[8])
        ], par=(i % 2 == 0))
    for row in ws1.iter_rows(min_row=4, max_row=len(articulos)+3, min_col=4, max_col=6):
        for cell in row:
            cell.number_format = '"$"#,##0.00'
    ajustar_columnas(ws1)
    ws1.freeze_panes = "A4"

    # ── Hoja 2: Por Ubicación ─────────────────────────────
    # El ahorro total ya no se puede sumar directo en SQL (precio_regular
    # vive en articulos_maestro, no en dinamica_detalle) — se agrega por
    # fila en Python después de traer el detalle con el JOIN.
    ws2 = wb.create_sheet("Por Ubicación")
    agregar_titulo(ws2, "Artículos por Ubicación", f"Generado el {fecha_reporte} | {pais_label}")

    cursor.execute(f"""
        SELECT dd.ubicacion_dinamica, dd.precio_dinamica, am.precio_unitario
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        {join_catalogo}
        WHERE dd.activo = 1 AND d.activa = 1 {filtro}
    """)
    filas_ubicacion = cursor.fetchall()

    resumen_ubicacion = {}
    for ubicacion, precio_dinamica, precio_regular in filas_ubicacion:
        clave = ubicacion or "-"
        if clave not in resumen_ubicacion:
            resumen_ubicacion[clave] = {"total": 0, "suma_precio": 0, "suma_ahorro": 0}
        precio_dinamica = float(precio_dinamica or 0)
        precio_regular = float(precio_regular or 0)
        resumen_ubicacion[clave]["total"] += 1
        resumen_ubicacion[clave]["suma_precio"] += precio_dinamica
        resumen_ubicacion[clave]["suma_ahorro"] += (precio_regular - precio_dinamica)

    ubicaciones = sorted(resumen_ubicacion.items(), key=lambda x: x[1]["total"], reverse=True)

    estilo_header(ws2, 3, ["Ubicación", "Total Artículos", "Precio Promedio", "Ahorro Total"], color_fondo="06847A")
    for i, (nombre_ubic, datos) in enumerate(ubicaciones, 4):
        precio_prom = datos["suma_precio"] / datos["total"] if datos["total"] > 0 else 0
        estilo_fila(ws2, i, [
            nombre_ubic, datos["total"], round(precio_prom, 2), round(datos["suma_ahorro"], 2)
        ], par=(i % 2 == 0))
    for row in ws2.iter_rows(min_row=4, max_row=len(ubicaciones)+3, min_col=3, max_col=4):
        for cell in row:
            cell.number_format = '"$"#,##0.00'
    ajustar_columnas(ws2)
    ws2.freeze_panes = "A4"

    # ── Hoja 3: Por Tipo de Campaña ───────────────────────
    ws3 = wb.create_sheet("Por Tipo Campaña")
    agregar_titulo(ws3, "Artículos por Tipo de Campaña", f"Generado el {fecha_reporte} | {pais_label}")

    cursor.execute(f"""
        SELECT dd.tipo_campana, dd.precio_dinamica, am.precio_unitario
        FROM dinamica_detalle dd
        INNER JOIN dinamicas d ON dd.dinamica_id = d.id
        {join_catalogo}
        WHERE dd.activo = 1 AND d.activa = 1 {filtro}
    """)
    filas_tipo = cursor.fetchall()

    resumen_tipo = {}
    for tipo_campana, precio_dinamica, precio_regular in filas_tipo:
        clave = tipo_campana or "-"
        if clave not in resumen_tipo:
            resumen_tipo[clave] = {"total": 0, "suma_precio": 0, "suma_ahorro": 0}
        precio_dinamica = float(precio_dinamica or 0)
        precio_regular = float(precio_regular or 0)
        resumen_tipo[clave]["total"] += 1
        resumen_tipo[clave]["suma_precio"] += precio_dinamica
        resumen_tipo[clave]["suma_ahorro"] += (precio_regular - precio_dinamica)

    tipos = sorted(resumen_tipo.items(), key=lambda x: x[1]["total"], reverse=True)

    estilo_header(ws3, 3, ["Tipo Campaña", "Total Artículos", "Precio Promedio", "Ahorro Total"], color_fondo="B45309")
    for i, (nombre_tipo, datos) in enumerate(tipos, 4):
        precio_prom = datos["suma_precio"] / datos["total"] if datos["total"] > 0 else 0
        estilo_fila(ws3, i, [
            nombre_tipo, datos["total"], round(precio_prom, 2), round(datos["suma_ahorro"], 2)
        ], par=(i % 2 == 0))
    for row in ws3.iter_rows(min_row=4, max_row=len(tipos)+3, min_col=3, max_col=4):
        for cell in row:
            cell.number_format = '"$"#,##0.00'
    ajustar_columnas(ws3)
    ws3.freeze_panes = "A4"

    conn.close()

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    nombre_archivo = f"PromoIQ_ReporteCompleto_{pais_label}_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={nombre_archivo}"}
    )