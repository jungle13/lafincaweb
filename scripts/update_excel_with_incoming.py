import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def update_excels():
    # -------------------------------------------------------------
    # 1. ACTUALIZAR INFORME_INVENTARIO_FISICO_23_SEP_AJUSTADO.xlsx
    # -------------------------------------------------------------
    excel_path1 = "DOCUMENTOS BASE/INFORME_INVENTARIO_FISICO_23_SEP_AJUSTADO.xlsx"
    wb1 = openpyxl.load_workbook(excel_path1)
    
    # Colores corporativos
    C_HEADER_FILL = PatternFill("solid", fgColor="1B365D")
    C_SUB_FILL = PatternFill("solid", fgColor="0F766E")
    C_ZEBRA = PatternFill("solid", fgColor="F8FAFC")
    C_WHITE = PatternFill("solid", fgColor="FFFFFF")
    C_HIGHLIGHT = PatternFill("solid", fgColor="ECFDF5")
    C_BORDER = "CBD5E1"

    font_th = Font(name="Calibri", size=8.5, bold=True, color="FFFFFF")
    font_cell = Font(name="Calibri", size=8, color="111111")
    font_cell_bold = Font(name="Calibri", size=8, bold=True, color="111111")
    font_highlight = Font(name="Calibri", size=8, bold=True, color="065F46")

    thin_border = Border(
        left=Side(style='thin', color=C_BORDER),
        right=Side(style='thin', color=C_BORDER),
        top=Side(style='thin', color=C_BORDER),
        bottom=Side(style='thin', color=C_BORDER)
    )

    # Revisar hoja principal
    ws1 = wb1.active
    
    # Crear o actualizar hoja con las Novedades y Entradas Reportadas por Eliana
    if "ENTRADAS_NUEVAS_24_SEP" in wb1.sheetnames:
        del wb1["ENTRADAS_NUEVAS_24_SEP"]
    
    ws_ent = wb1.create_sheet(title="ENTRADAS_NUEVAS_24_SEP")
    ws_ent.views.sheetView[0].showGridLines = True
    
    # Encabezado Novedades
    ws_ent.merge_cells("A1:G1")
    ws_ent["A1"] = "RESTAURANTE LA FINCA CHOCLOS Y ASADOS"
    ws_ent["A1"].font = Font(name="Calibri", size=13, bold=True, color="1B365D")
    ws_ent["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws_ent.merge_cells("A2:G2")
    ws_ent["A2"] = "NOVEDADES DE INVENTARIO - ENTRADAS RECIBIDAS EN BODEGA (24 DE SEPTIEMBRE)"
    ws_ent["A2"].font = Font(name="Calibri", size=10, bold=True, color="065F46")
    ws_ent["A2"].alignment = Alignment(horizontal="center", vertical="center")

    ws_ent.merge_cells("A3:G3")
    ws_ent["A3"] = "Información suministrada por Administración (Eliana - 05:42 PM) • Mercancía / Entradas de Hoy"
    ws_ent["A3"].font = Font(name="Calibri", size=8, italic=True, color="4A5568")
    ws_ent["A3"].alignment = Alignment(horizontal="center", vertical="center")

    th_ent = ["#", "ÍTEM / PRODUCTO", "CANTIDAD REPORTADA", "UNIDAD", "COSTO UNITARIO EST.", "VALOR TOTAL EST.", "OBSERVACIONES"]
    ws_ent.row_dimensions[5].height = 22
    for c_idx, th in enumerate(th_ent, 1):
        cell = ws_ent.cell(row=5, column=c_idx, value=th)
        cell.font = font_th
        cell.fill = C_SUB_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    novedades_eliana = [
        (1, "Gallinas", 42, "Und", 50556, 42 * 50556, "Llegó hoy 24-Sep según reporte Eliana (42 unds)"),
        (2, "Lengua de res", 15, "Kg", 23900, 15 * 23900, "Llegó hoy 24-Sep según reporte Eliana (15 Kg)"),
        (3, "Chorizos coctel", 80, "Und", 1200, 80 * 1200, "Llegó hoy 24-Sep según reporte Eliana (80 unds cocteleros)")
    ]

    for idx, row in enumerate(novedades_eliana, start=6):
        ws_ent.row_dimensions[idx].height = 18
        for col_idx, val in enumerate(row, start=1):
            c = ws_ent.cell(row=idx, column=col_idx, value=val)
            c.font = font_cell_bold if col_idx in [2, 3, 6] else font_cell
            c.fill = C_HIGHLIGHT
            c.border = thin_border
            if col_idx in [3, 5, 6]:
                c.alignment = Alignment(horizontal="right", vertical="center")
                if col_idx in [5, 6]: c.number_format = "$#,##0"
            elif col_idx in [1, 4]:
                c.alignment = Alignment(horizontal="center", vertical="center")

    # Fila total novedades
    tot_row = 6 + len(novedades_eliana)
    ws_ent.merge_cells(f"A{tot_row}:B{tot_row}")
    ws_ent[f"A{tot_row}"] = "TOTAL ENTRADAS HOY (24-SEP)"
    ws_ent[f"A{tot_row}"].font = font_th
    ws_ent[f"A{tot_row}"].fill = C_HEADER_FILL
    ws_ent[f"A{tot_row}"].alignment = Alignment(horizontal="center", vertical="center")
    
    tot_val = sum(x[5] for x in novedades_eliana)
    c_tot = ws_ent.cell(row=tot_row, column=6, value=tot_val)
    c_tot.font = font_th
    c_tot.fill = C_HEADER_FILL
    c_tot.alignment = Alignment(horizontal="right", vertical="center")
    c_tot.number_format = "$#,##0"
    for c_i in range(1, 8):
        ws_ent.cell(row=tot_row, column=c_i).border = thin_border

    # Autoajustar columnas
    for c_idx in range(1, 8):
        ws_ent.column_dimensions[get_column_letter(c_idx)].width = 22

    # En la hoja 1, registrar también en las filas de Lengua, Gallina y Chorizos si aplican
    for r in range(7, ws1.max_row + 1):
        nom = str(ws1.cell(row=r, column=1).value or "").lower()
        if "lengua" in nom:
            ws1.cell(row=r, column=8, value="Inventario base 0 Kg. Entrada nueva reportada hoy: 15 Kg")
        elif "gallina" in nom:
            ws1.cell(row=r, column=8, value="Entrada nueva reportada hoy: 42 unidades")
        elif "chorizo" in nom:
            ws1.cell(row=r, column=8, value="Entrada nueva reportada hoy: 80 chorizos cóctel")

    wb1.save(excel_path1)
    print(f"Actualizado con éxito: {excel_path1}")

    # -------------------------------------------------------------
    # 2. ACTUALIZAR INFORME_CONCILIACION_MAESTRA_SEPTIEMBRE_2026.xlsx
    # -------------------------------------------------------------
    excel_path2 = "DOCUMENTOS BASE/INFORME_CONCILIACION_MAESTRA_SEPTIEMBRE_2026.xlsx"
    wb2 = openpyxl.load_workbook(excel_path2)

    # Actualizar CRONOLOGIA_DIA_A_DIA con el día 24-Sep
    ws_crono = wb2["CRONOLOGIA_DIA_A_DIA"]
    
    # Buscar si ya existe fila para 24-Sep
    row_24 = None
    for r in range(5, ws_crono.max_row + 1):
        val = str(ws_crono.cell(row=r, column=1).value or "")
        if "24-Sep" in val:
            row_24 = r
            break
    
    if not row_24:
        row_24 = ws_crono.max_row + 1
        ws_crono.cell(row=row_24, column=1, value="24-Sep (Jue)")

    ws_crono.cell(row=row_24, column=2, value="Entrada Nueva (Hoy)")
    ws_crono.cell(row=row_24, column=8, value="Llegada 24-Sep reportada por Eliana (5:42 PM): Gallinas 42 und, Lengua 15 kg, 80 chorizos cóctel.")

    # Agregar hoja específica ENTRADAS_24_SEP en Conciliación Maestra
    if "ENTRADAS_24_SEP" in wb2.sheetnames:
        del wb2["ENTRADAS_24_SEP"]
    ws_m_ent = wb2.create_sheet(title="ENTRADAS_24_SEP")
    ws_m_ent.views.sheetView[0].showGridLines = True

    ws_m_ent.merge_cells("A1:F1")
    ws_m_ent["A1"] = "NOVEDADES DE COMPRAS / ENTRADAS BODEGA - 24 DE SEPTIEMBRE DE 2026"
    ws_m_ent["A1"].font = Font(name="Calibri", size=12, bold=True, color="1B365D")
    ws_m_ent["A1"].alignment = Alignment(horizontal="center", vertical="center")

    headers_m = ["N°", "Insumo / Producto", "Cantidad", "Unidad", "Hora Reporte", "Detalle / Observación"]
    ws_m_ent.row_dimensions[3].height = 20
    for idx, h in enumerate(headers_m, 1):
        c = ws_m_ent.cell(row=3, column=idx, value=h)
        c.font = font_th
        c.fill = C_HEADER_FILL
        c.alignment = Alignment(horizontal="center", vertical="center")
        c.border = thin_border

    entries_24 = [
        (1, "Gallinas", 42, "Und", "05:42 PM", "Llegó hoy 24-Sep (Reporte Eliana: 42 unds)"),
        (2, "Lengua", 15, "Kg", "05:42 PM", "Llegó hoy 24-Sep (Reporte Eliana: 15 kg)"),
        (3, "Chorizos coctel", 80, "Und", "05:42 PM", "Llegó hoy 24-Sep (Reporte Eliana: 80 unds)")
    ]

    for r_i, entry in enumerate(entries_24, start=4):
        ws_m_ent.row_dimensions[r_i].height = 18
        for c_i, val in enumerate(entry, start=1):
            c = ws_m_ent.cell(row=r_i, column=c_i, value=val)
            c.font = font_cell_bold if c_i in [2, 3] else font_cell
            c.border = thin_border
            if c_i in [1, 4, 5]:
                c.alignment = Alignment(horizontal="center", vertical="center")
            elif c_i == 3:
                c.alignment = Alignment(horizontal="right", vertical="center")

    for col in range(1, 7):
        ws_m_ent.column_dimensions[get_column_letter(col)].width = 24

    wb2.save(excel_path2)
    print(f"Actualizado con éxito: {excel_path2}")

if __name__ == "__main__":
    update_excels()
