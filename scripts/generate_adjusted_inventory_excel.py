import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def generate_adjusted_excel():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CONTEO_AJUSTADO_23_SEP"

    # Configuración de página
    ws.views.sheetView[0].showGridLines = True
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.page_margins.left = 0.2
    ws.page_margins.right = 0.2
    ws.page_margins.top = 0.3
    ws.page_margins.bottom = 0.3

    # Colores corporativos idénticos al PDF
    C_NAVY = "1B365D"
    C_HEADER_FILL = PatternFill("solid", fgColor="1B365D")
    C_ZEBRA = PatternFill("solid", fgColor="F8FAFC")
    C_WHITE = PatternFill("solid", fgColor="FFFFFF")
    C_BORDER = "CBD5E1"

    font_title = Font(name="Calibri", size=13, bold=True, color="1B365D")
    font_sub = Font(name="Calibri", size=9, bold=True, color="1B365D")
    font_meta = Font(name="Calibri", size=7.5, italic=True, color="4A5568")
    font_th = Font(name="Calibri", size=8, bold=True, color="FFFFFF")
    font_cell = Font(name="Calibri", size=8, color="111111")
    font_cell_bold = Font(name="Calibri", size=8, bold=True, color="111111")
    font_total = Font(name="Calibri", size=8.5, bold=True, color="FFFFFF")

    thin_border = Border(
        left=Side(style='thin', color=C_BORDER),
        right=Side(style='thin', color=C_BORDER),
        top=Side(style='thin', color=C_BORDER),
        bottom=Side(style='thin', color=C_BORDER)
    )

    # 1. Título
    ws.merge_cells("A1:H1")
    ws["A1"] = "RESTAURANTE LA FINCA CHOCLOS Y ASADOS"
    ws["A1"].font = font_title
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:H2")
    ws["A2"] = "ACTA OFICIAL DE CONTEO FÍSICO DE INVENTARIO Y EXISTENCIAS EN BODEGA"
    ws["A2"].font = font_sub
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A3:H3")
    ws["A3"] = "Sesión: 2026-09-24 • Responsable: Bodeguero (Conteo Físico 09:51 AM) • Modo: Conteo Físico Real • Estado: EN AUDITORÍA / CONTEO FÍSICO"
    ws["A3"].font = font_meta
    ws["A3"].alignment = Alignment(horizontal="center", vertical="center")

    # 2. Tarjetas KPI
    ws.merge_cells("A4:C4")
    ws["A4"] = "TOTAL KILOGRAMOS CONTADOS: 388.44 Kg"
    ws["A4"].font = Font(name="Calibri", size=9, bold=True, color="1B365D")
    ws["A4"].fill = PatternFill("solid", fgColor="F1F5F9")
    ws["A4"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("D4:E4")
    ws["D4"] = "TOTAL PORCIONES / UNIDADES: 489 unds"
    ws["D4"].font = Font(name="Calibri", size=9, bold=True, color="1B365D")
    ws["D4"].fill = PatternFill("solid", fgColor="F1F5F9")
    ws["D4"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("F4:H4")
    ws["F4"] = "VALOR TOTAL CONTEO FÍSICO: $ 8.349.417 COP"
    ws["F4"].font = Font(name="Calibri", size=9.5, bold=True, color="B45309")
    ws["F4"].fill = PatternFill("solid", fgColor="FEF3C7")
    ws["F4"].alignment = Alignment(horizontal="center", vertical="center")

    for r in range(4, 5):
        for c in range(1, 9):
            ws.cell(row=r, column=c).border = thin_border

    # 3. Encabezados de tabla
    headers = [
        "CARNE / INSUMO", "UBIC.", "ENTERO (KG)", "PORCIONES", 
        "TOTAL (KG)", "COSTO UNIT. / KG", "VALOR TOTAL ($ COP)", "OBSERVACIONES DE CONTEO / INVENTARIO ELIANA"
    ]
    ws.row_dimensions[6].height = 20
    for col_idx, h_text in enumerate(headers, start=1):
        cell = ws.cell(row=6, column=col_idx, value=h_text)
        cell.font = font_th
        cell.fill = C_HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    # 4. Datos con las variaciones solicitadas por Eliana y César (Idénticos al sistema)
    items = [
        ("Papas a la francesa", "BODEGA", 0.0, 12, 12.0, 6269, 75228, "12 paquetes (12.0 Kg)"),
        ("Tocino (Chicharrón)", "BODEGA", 0.0, 145, 57.13, 21900, 1251147, "121 en bandeja + 24 reserva"),
        ("Mix de verduras", "BODEGA", 0.0, 10, 10.0, 8487, 84870, "10 paquetes acompañamiento"),
        ("Pescado bagre (Alguacil)", "BODEGA", 0.0, 42, 9.32, 14000, 130480, "42 porciones listas en cava"),
        ("Muslos de pollo", "BODEGA", 0.0, 80, 22.24, 15000, 333600, "80 porciones muslos"),
        ("Costilla San Luis", "BODEGA", 20.0, 20, 30.0, 21900, 657000, "20 kg entero + 20 porciones"),
        ("Carne asada (Corte fino)", "BODEGA", 0.0, 30, 3.15, 25900, 81585, "30 porciones porcionadas"),
        ("Lomo de cerdo", "BODEGA", 0.0, 2, 0.44, 19500, 8580, "2 porciones remanentes"),
        ("Sobrebarriga delgada", "BODEGA", 19.50, 0, 19.50, 30000, 585000, "Inventario Eliana (19.50 Kg)"),
        ("Lengua de res", "BODEGA", 0.0, 0, 0.0, 23900, 0, "Inventario Eliana: Dejamos las mismas (Lote agotado)"),
        ("Baby beef", "BODEGA", 0.0, 5, 2.0, 53000, 106000, "5 porciones finas"),
        ("Costilla de cerdo especial", "BODEGA", 27.0, 0, 27.0, 14900, 402300, "Costilla tamalera 27 kg"),
        ("Tocineta barril", "BODEGA", 89.0, 0, 89.0, 17000, 1513000, "Inventario Eliana (89.00 Kg)"),
        ("Panceta de cerdo", "BODEGA", 32.0, 0, 32.0, 21900, 700800, "32.0 kg entero en cava"),
        ("Camarón precocido", "BODEGA", 7.9, 0, 7.9, 22900, 180910, "7.9 kg en congelador"),
        ("Lomo viche especial", "BODEGA", 2.7, 0, 2.7, 53000, 143100, "2.7 kg refrigerado"),
        ("Costilla ahumada", "BODEGA", 4.0, 0, 4.0, 24000, 96000, "4.0 kg bloque entero"),
        ("Tilapia roja 350/450", "BODEGA", 0.0, 26, 8.66, 17808, 154217, "26 tilapias enteras"),
        ("Trucha arcoíris", "BODEGA", 0.0, 10, 2.5, 22000, 55000, "10 truchas congelador"),
        ("Salmón filete", "BODEGA", 0.0, 5, 1.0, 55000, 55000, "5 porciones salmón"),
        ("Punta de anca", "BODEGA", 0.0, 57, 12.65, 44000, 556600, "57 porciones parrilla"),
        ("Churrasco", "BODEGA", 0.0, 45, 11.25, 44000, 495000, "45 porciones parrilla"),
        ("Rellena campesina", "BODEGA", 3.2, 0, 3.2, 19500, 62400, "3.2 kg embutido"),
        ("Sobaco de res", "BODEGA", 24.0, 0, 24.0, 25900, 621600, "Inventario Eliana (24.00 Kg)"),
    ]

    for idx, it in enumerate(items, start=7):
        ws.row_dimensions[idx].height = 15
        row_fill = C_ZEBRA if (idx % 2 == 0) else C_WHITE

        nom, ubic, ent_kg, porc_und, tot_kg, cost_u, val_tot, obs = it
        
        c1 = ws.cell(row=idx, column=1, value=nom)
        c1.font = font_cell_bold
        c1.fill = row_fill
        c1.border = thin_border

        c2 = ws.cell(row=idx, column=2, value=ubic)
        c2.font = font_cell
        c2.alignment = Alignment(horizontal="center")
        c2.fill = row_fill
        c2.border = thin_border

        c3 = ws.cell(row=idx, column=3, value=ent_kg if ent_kg > 0 else "-")
        c3.font = font_cell
        c3.alignment = Alignment(horizontal="right")
        if ent_kg > 0: c3.number_format = "#,##0.00 \"Kg\""
        c3.fill = row_fill
        c3.border = thin_border

        c4 = ws.cell(row=idx, column=4, value=f"{porc_und} und" if porc_und > 0 else "-")
        c4.font = font_cell
        c4.alignment = Alignment(horizontal="center")
        c4.fill = row_fill
        c4.border = thin_border

        c5 = ws.cell(row=idx, column=5, value=tot_kg)
        c5.font = font_cell_bold
        c5.alignment = Alignment(horizontal="right")
        c5.number_format = "#,##0.00 \"Kg\""
        c5.fill = row_fill
        c5.border = thin_border

        c6 = ws.cell(row=idx, column=6, value=cost_u)
        c6.font = font_cell
        c6.alignment = Alignment(horizontal="right")
        c6.number_format = "$#,##0"
        c6.fill = row_fill
        c6.border = thin_border

        c7 = ws.cell(row=idx, column=7, value=val_tot)
        c7.font = font_cell_bold
        c7.alignment = Alignment(horizontal="right")
        c7.number_format = "$#,##0"
        c7.fill = row_fill
        c7.border = thin_border

        c8 = ws.cell(row=idx, column=8, value=obs)
        c8.font = font_cell
        c8.fill = row_fill
        c8.border = thin_border

    # Fila de totales
    tot_row_idx = len(items) + 7
    ws.row_dimensions[tot_row_idx].height = 18
    tot_cols = [
        (1, "TOTAL GENERAL CONTEO"),
        (2, "24 Ítems"),
        (3, sum(x[2] for x in items)),
        (4, f"{sum(x[3] for x in items)} und"),
        (5, sum(x[4] for x in items)),
        (6, "-"),
        (7, sum(x[6] for x in items)),
        (8, "Existencias 100% Verificadas")
    ]
    for col_i, val in tot_cols:
        cell = ws.cell(row=tot_row_idx, column=col_i, value=val)
        cell.font = font_total
        cell.fill = C_HEADER_FILL
        cell.border = thin_border
        if col_i in [3, 5]:
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.number_format = "#,##0.00 \"Kg\""
        elif col_i == 7:
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.number_format = "$#,##0"
        else:
            cell.alignment = Alignment(horizontal="center", vertical="center")

    # Anchos de columna
    col_widths = {1: 28, 2: 12, 3: 14, 4: 14, 5: 14, 6: 16, 7: 18, 8: 36}
    for col_i, w in col_widths.items():
        ws.column_dimensions[get_column_letter(col_i)].width = w

    excel_path = "DOCUMENTOS BASE/INFORME_INVENTARIO_FISICO_23_SEP_AJUSTADO.xlsx"
    wb.save(excel_path)
    wb.save("INFORME_INVENTARIO_FISICO_23_SEP_AJUSTADO.xlsx")
    print(f"Excel generado exitosamente: {excel_path}")

if __name__ == '__main__':
    generate_adjusted_excel()
