import openpyxl
import re

RUTA_EXCEL = "Layout_tienda_Curridabat_2026_corregido.xlsx"  # ajustá la ruta si hace falta

wb = openpyxl.load_workbook(RUTA_EXCEL, data_only=True)
ws = wb.active

rango_de_celda = {}
for mc in ws.merged_cells.ranges:
    min_col, min_row, max_col, max_row = mc.bounds
    for r in range(min_row, max_row + 1):
        for c in range(min_col, max_col + 1):
            rango_de_celda[(r, c)] = (min_row, min_col, max_row, max_col)

patron_codigo = re.compile(r'[A-Za-z]{2}\d+C\d+')
patron_pasillo_num = re.compile(r'\d+H')
patron_caja = re.compile(r'CJ\d+[AB]')

bloques = {}
for row in ws.iter_rows():
    for cell in row:
        if cell.value in (None, ''):
            continue
        r, c = cell.row, cell.column
        if (r, c) in rango_de_celda:
            clave = rango_de_celda[(r, c)]
        else:
            clave = (r, c, r, c)
        bloques[clave] = str(cell.value).strip()

print(f"Total bloques encontrados en el Excel (antes de filtrar): {len(bloques)}")

# Buscar específicamente el bloque de canaletas
for clave, val in bloques.items():
    if "canaletas" in val.lower():
        print(f"\n✅ ENCONTRADO en el Excel: {clave} = '{val}'")

# Simular los filtros de exclusión uno por uno
excluidos_por_filtro = {"pasillo_num": 0, "caja": 0, "empieza_caja": 0, "es_digito": 0}
resultado_final = []

for (fila_ini, col_ini, fila_fin, col_fin), val in bloques.items():
    if patron_pasillo_num.fullmatch(val):
        excluidos_por_filtro["pasillo_num"] += 1
        if "canaletas" in val.lower():
            print("⚠️ Excluido por patron_pasillo_num")
        continue
    if patron_caja.fullmatch(val):
        excluidos_por_filtro["caja"] += 1
        if "canaletas" in val.lower():
            print("⚠️ Excluido por patron_caja")
        continue
    if val.lower().startswith('caja'):
        excluidos_por_filtro["empieza_caja"] += 1
        if "canaletas" in val.lower():
            print("⚠️ Excluido por empezar con 'caja' (¡'Cajas eléctricas' empieza con 'Cajas'!)")
        continue
    if val.replace(' ', '').isdigit():
        excluidos_por_filtro["es_digito"] += 1
        if "canaletas" in val.lower():
            print("⚠️ Excluido por ser dígito")
        continue
    resultado_final.append(val)

print(f"\nExcluidos por cada filtro: {excluidos_por_filtro}")
print(f"Total final después de filtros: {len(resultado_final)}")