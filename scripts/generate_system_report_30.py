import os
import json
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import urllib.request

def format_money(val):
    return f"${val:,.0f}".replace(",", ".")

def generate_system_report():
    print("=== GENERANDO REPORTE DE INVENTARIO DEL SISTEMA (30-SEP-2026) ===")

    # Consultar stock actual de Supabase mediante script node o directamente
    # Escribimos un runner pequeño para traer el stock
    import subprocess
    cmd = [
        "node", "-e",
        """
        import('@supabase/supabase-js').then(async ({ createClient }) => {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
          const supabase = createClient(supabaseUrl, supabaseAnonKey);

          const { data } = await supabase
            .from('stock_actual')
            .select('*, catalogo_insumos(codigo, nombre, categoria, costo_unitario_kg, tipo_medida, peso_estandar_porcion_kg, es_carne)');
          
          console.log(JSON.stringify(data));
        });
        """
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    stock_rows = json.loads(res.stdout)

    # Filtrar insumos con stock o carnes
    items_to_report = []
    for s in stock_rows:
        cat_info = s.get('catalogo_insumos') or {}
        b_sin = float(s.get('bodega_sin_porcionar_kg') or 0)
        b_und = int(s.get('bodega_porcionado_und') or 0)
        b_pkg = float(s.get('bodega_porcionado_kg') or 0)
        c_und = int(s.get('cocina_porcionado_und') or 0)
        c_sin = float(s.get('cocina_sin_porcionar_kg') or 0)
        c_pkg = float(s.get('cocina_porcionado_kg') or 0)

        tot_b_kg = b_sin + b_pkg
        tot_c_kg = c_sin + c_pkg
        tot_g_kg = tot_b_kg + tot_c_kg

        es_carne = cat_info.get('es_carne', True)
        if es_carne or tot_b_kg > 0 or b_und > 0 or c_und > 0:
            items_to_report.append({
                'codigo': cat_info.get('codigo', 'S/C'),
                'nombre': cat_info.get('nombre', 'Insumo'),
                'categoria': cat_info.get('categoria', 'GENERAL'),
                'tipo_medida': cat_info.get('tipo_medida', 'KGS_Y_UNIDADES'),
                'costo_unit': float(cat_info.get('costo_unitario_kg') or 0),
                'b_sin_kg': b_sin,
                'b_und': b_und,
                'b_pkg': b_pkg,
                'tot_b_kg': tot_b_kg,
                'c_und': c_und,
                'tot_c_kg': tot_c_kg,
                'tot_g_kg': tot_g_kg,
                'val_b': round(b_und * float(cat_info.get('costo_unitario_kg') or 0)) if cat_info.get('tipo_medida') in ['UNIDADES', 'PAQUETES'] else round(tot_b_kg * float(cat_info.get('costo_unitario_kg') or 0))
            })

    items_to_report.sort(key=lambda x: (x['categoria'], x['nombre']))

    # PDF del Sistema
    pdf_path = 'REPORTE_OFICIAL_INVENTARIO_SISTEMA_30_SEP_2026.pdf'
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=landscape(letter),
        leftMargin=18,
        rightMargin=18,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()
    story = []

    title_p = Paragraph(
        "<b>RESTAURANTE CAMPESTRE LA FINCA CHOCLOS Y ASADOS</b><br/>"
        "<font size=9 color='#1E40AF'><b>ESTADO OFICIAL DE INVENTARIO EN SISTEMA — TRAS MOVIMIENTOS AL 30 DE SEPTIEMBRE DE 2026</b></font><br/>"
        "<font size=7.5 color='#475569'>Saldos Contables y Operativos Consolidados en Bodega y Cocina | Período: Septiembre 2026</font>",
        ParagraphStyle('H1', parent=styles['Normal'], fontSize=11, leading=14, textColor=colors.HexColor('#0F172A'))
    )
    story.append(title_p)
    story.append(Spacer(1, 8))

    headers = [
        "Cód.", "Insumo / Corte", "Categoría", "Bodega\nEntero (Kg)", "Bodega\nPorc. (Und)",
        "Bodega\nPorc. (Kg)", "Total Bodega\n(Kg)", "Cocina\nPorc. (Und)", "Costo Unit.\n($ COP)", "Valor Bodega\n($ COP)"
    ]
    table_data = [headers]

    tot_b_sin = 0.0
    tot_b_und = 0
    tot_b_pkg = 0.0
    tot_b_totkg = 0.0
    tot_c_und = 0
    tot_valor = 0.0

    for item in items_to_report:
        tot_b_sin += item['b_sin_kg']
        tot_b_und += item['b_und']
        tot_b_pkg += item['b_pkg']
        tot_b_totkg += item['tot_b_kg']
        tot_c_und += item['c_und']
        tot_valor += item['val_b']

        table_data.append([
            item['codigo'],
            item['nombre'],
            item['categoria'],
            f"{item['b_sin_kg']:.2f}" if item['b_sin_kg'] > 0 else "-",
            f"{item['b_und']}" if item['b_und'] > 0 else "-",
            f"{item['b_pkg']:.2f}" if item['b_pkg'] > 0 else "-",
            f"{item['tot_b_kg']:.2f}" if item['tot_b_kg'] > 0 else "-",
            f"{item['c_und']}" if item['c_und'] > 0 else "-",
            format_money(item['costo_unit']),
            format_money(item['val_b'])
        ])

    table_data.append([
        "TOTAL",
        f"{len(items_to_report)} ÍTEMS CON EXISTENCIAS",
        "-",
        f"{tot_b_sin:.2f} Kg",
        f"{tot_b_und} und",
        f"{tot_b_pkg:.2f} Kg",
        f"{tot_b_totkg:.2f} Kg",
        f"{tot_c_und} und",
        "-",
        format_money(tot_valor)
    ])

    col_widths = [50, 150, 110, 60, 60, 65, 65, 60, 70, 85]
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
        ('TOPPADDING', (0, 0), (-1, 0), 4),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#F8FAFC')]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#EFF6FF')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#1E40AF')),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    doc.build(story)
    print(f"[OK] Reporte Sistema PDF generado con exito: {pdf_path}")

    # Excel del Sistema
    excel_path = 'INVENTARIO_SISTEMA_LA_FINCA_2026-09-30.xlsx'
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "STOCK_SISTEMA_30_SEP"

    ws.merge_cells("A1:J1")
    ws["A1"] = "RESTAURANTE CAMPESTRE LA FINCA CHOCLOS Y ASADOS — STOCK SISTEMA TRAS MOVIMIENTOS"
    ws["A1"].font = Font(name="Calibri", size=13, bold=True, color="1E293B")
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:J2")
    ws["A2"] = "INVENTARIO AL 30 DE SEPTIEMBRE DE 2026 (POST-MOVIMIENTOS DE CARNES)"
    ws["A2"].font = Font(name="Calibri", size=10, bold=True, color="1E40AF")
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    cols = ["Codigo", "Insumo / Corte", "Categoria", "Bodega Entero (Kg)", "Bodega Porc. (Und)", "Bodega Porc. (Kg)", "Total Bodega (Kg)", "Cocina Porc. (Und)", "Costo Unitario ($)", "Valor Bodega ($)"]
    ws.append([])
    ws.append(cols)

    header_row = 4
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    for col_idx in range(1, len(cols) + 1):
        cell = ws.cell(row=header_row, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'), right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'), bottom=Side(style='thin', color='CBD5E1')
    )

    row_idx = 5
    for item in items_to_report:
        ws.cell(row=row_idx, column=1, value=item['codigo']).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=2, value=item['nombre'])
        ws.cell(row=row_idx, column=3, value=item['categoria'])
        ws.cell(row=row_idx, column=4, value=item['b_sin_kg'])
        ws.cell(row=row_idx, column=5, value=item['b_und'])
        ws.cell(row=row_idx, column=6, value=item['b_pkg'])
        ws.cell(row=row_idx, column=7, value=item['tot_b_kg'])
        ws.cell(row=row_idx, column=8, value=item['c_und'])
        ws.cell(row=row_idx, column=9, value=item['costo_unit'])
        ws.cell(row=row_idx, column=10, value=item['val_b'])

        for c_i in range(1, 11):
            c = ws.cell(row=row_idx, column=c_i)
            c.border = thin_border
            c.font = Font(name="Calibri", size=9.5)
            if c_i in [4, 6, 7]:
                c.number_format = '#,##0.00'
            elif c_i in [5, 8]:
                c.number_format = '#,##0'
            elif c_i in [9, 10]:
                c.number_format = '$#,##0'

        row_idx += 1

    ws.cell(row=row_idx, column=1, value="TOTAL").alignment = Alignment(horizontal="center")
    ws.cell(row=row_idx, column=2, value=f"{len(items_to_report)} ITEMS")
    ws.cell(row=row_idx, column=3, value="-")
    ws.cell(row=row_idx, column=4, value=f"=SUM(D5:D{row_idx-1})")
    ws.cell(row=row_idx, column=5, value=f"=SUM(E5:E{row_idx-1})")
    ws.cell(row=row_idx, column=6, value=f"=SUM(F5:F{row_idx-1})")
    ws.cell(row=row_idx, column=7, value=f"=SUM(G5:G{row_idx-1})")
    ws.cell(row=row_idx, column=8, value=f"=SUM(H5:H{row_idx-1})")
    ws.cell(row=row_idx, column=9, value="-")
    ws.cell(row=row_idx, column=10, value=f"=SUM(J5:J{row_idx-1})")

    tot_fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
    tot_font = Font(name="Calibri", size=10, bold=True, color="1E40AF")
    for c_i in range(1, 11):
        c = ws.cell(row=row_idx, column=c_i)
        c.fill = tot_fill
        c.font = tot_font
        c.border = thin_border
        if c_i in [4, 6, 7]:
            c.number_format = '#,##0.00'
        elif c_i in [5, 8]:
            c.number_format = '#,##0'
        elif c_i == 10:
            c.number_format = '$#,##0'

    col_widths_excel = {
        'A': 12, 'B': 28, 'C': 22, 'D': 16, 'E': 16, 'F': 16, 'G': 16, 'H': 16, 'I': 18, 'J': 20
    }
    for col, width in col_widths_excel.items():
        ws.column_dimensions[col].width = width

    wb.save(excel_path)
    print(f"[OK] Excel Sistema generado con exito: {excel_path}")

generate_system_report()
