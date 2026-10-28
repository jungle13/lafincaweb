import os
import json
import urllib.request
from datetime import datetime

from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak
)
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

def format_money(val):
    return f"${val:,.0f}".replace(",", ".")

def generate_reports():
    print("=== GENERANDO INFORMES Y REPORTES OFICIALES (30-SEP-2026) ===")

    # 1. Definición exacta de los 28 ítems del Conteo Físico Oficial
    conteo_items = [
        # (Codigo, Insumo, Categoria, Entero_Kg, Porc_Und, Peso_Porc_Kg, Costo_Kg_Und, Val_Exacto, Detalle_Obs)
        ("CAR-041", "Filete de Pollo", "CARNE POLLO", 0.0, 84, 28.56, 18500, 528360, "84 und (28.56 kg)"),
        ("EMB-050", "Chorizo Paisa Tradicional", "EMBUTIDO", 0.0, 120, 12.00, 3200, 384000, "120 und (12.00 kg)"),
        ("EMB-054", "Chorizo Grande de Cerdo", "EMBUTIDO", 0.0, 0, 0.0, 4500, 0, "0 und (0.00 kg)"),
        ("CAR-003", "Costilla Ahumada", "CARNE DE CERDO", 36.0, 0, 0.0, 24500, 882000, "36.00 kg entero"),
        ("RES-072", "Carne Asada de Res", "CARNE DE RES", 0.0, 10, 1.0, 26900, 26900, "10 und (1.00 kg)"),
        ("CER-075", "Tocino Junior", "CARNE DE CERDO", 6.0, 0, 0.0, 21900, 131400, "6.00 kg entero"),
        ("CER-075", "Tocino Barril", "CARNE DE CERDO", 0.0, 46, 17.17, 21900, 376023, "46 und (17.17 kg)"),
        ("VER-074", "Papa Francesa Precocida", "VERDURAS", 0.0, 1, 2.5, 17500, 17500, "1 paq (2.50 kg)"),
        ("CAR-033", "Punta de Anca", "CARNE DE RES", 0.0, 18, 7.43, 44000, 326700, "18 und (7.43 kg)"),
        ("RES-071", "Baby Beef", "CARNE DE RES", 0.0, 3, 1.2, 53000, 63600, "3 und (1.20 kg)"),
        ("CAR-010", "Lomo de Cerdo", "CARNE DE CERDO", 0.0, 63, 21.68, 19000, 411920, "63 und (21.68 kg)"),
        ("CAR-006", "Costilla San Luis", "CARNE DE CERDO", 4.0, 0, 0.0, 22900, 91600, "4.00 kg entero"),
        ("PES-061", "Bagre de Mar", "PESCADOS Y MARISCOS", 20.0, 0, 0.0, 16500, 330000, "20.00 kg entero"),
        ("CAR-042", "Gallina Criolla", "CARNE POLLO", 65.4, 32, 7.5, 11360, 828150, "65.40 kg can + 32 presas (7.50 kg)"),
        ("CAR-028", "Hígado de Res", "CARNE DE RES", 0.0, 51, 5.1, 21500, 109650, "51 und (5.10 kg)"),
        ("PES-065", "Alguacil de Res", "PESCADOS Y MARISCOS", 0.0, 40, 20.0, 28500, 570000, "40 und (20.00 kg)"),
        ("CAR-026", "Churrasco de Res", "CARNE DE RES", 0.0, 20, 8.1, 38000, 307800, "20 und (8.10 kg)"),
        ("CAR-030", "Lomo Viche Entero de Res", "CARNE DE RES", 2.5, 0, 0.0, 53000, 132500, "2.50 kg entero"),
        ("CAR-034", "Sobaco de Res", "CARNE DE RES", 21.0, 0, 0.0, 25900, 543900, "21.00 kg entero"),
        ("CAR-021", "Callo de Res (Mondongo)", "CARNE DE RES", 4.4, 0, 0.0, 19000, 83600, "4.40 kg entero"),
        ("CAR-011", "Panceta de Cerdo", "CARNE DE CERDO", 4.5, 0, 0.0, 24000, 108000, "4.50 kg entero"),
        ("CAR-013", "Pezuña de Cerdo", "CARNE DE CERDO", 0.0, 0, 0.0, 9699, 0, "0.00 kg"),
        ("CAR-035", "Sobrebarriga (Cocida y Esp.)", "CARNE DE RES", 7.3, 7, 2.1, 34500, 324300, "7.30 kg cocida + 7 und (2.10 kg)"),
        ("PES-067", "Tilapia Roja", "PESCADOS Y MARISCOS", 0.0, 23, 11.18, 18000, 201240, "23 und (11.18 kg)"),
        ("PES-066", "Salmón Premium", "PESCADOS Y MARISCOS", 0.0, 10, 3.6, 55000, 198000, "10 und (3.60 kg)"),
        ("PES-069", "Trucha Arcoíris", "PESCADOS Y MARISCOS", 0.0, 14, 5.35, 23000, 123050, "14 und (5.35 kg)"),
        ("VER-084", "Mix de Verduras Precocido", "VERDURAS", 0.0, 5, 2.5, 5200, 26000, "5 paq (2.50 kg)"),
        ("INS-085", "Leche de Coco Natural", "ELABORADOS", 0.0, 4, 4.0, 21000, 84000, "4 Litros")
    ]

    styles = getSampleStyleSheet()

    # =========================================================================
    # DOCUMENTO 1: ACTA OFICIAL DE CONTEO FÍSICO (PDF)
    # =========================================================================
    pdf_conteo_path = 'ACTA_OFICIAL_CONTEO_FISICO_30_SEP_2026.pdf'
    doc_conteo = SimpleDocTemplate(
        pdf_conteo_path,
        pagesize=landscape(letter),
        leftMargin=18,
        rightMargin=18,
        topMargin=20,
        bottomMargin=20
    )

    story_conteo = []

    # Título y encabezado institucional
    title_p = Paragraph(
        "<b>RESTAURANTE CAMPESTRE LA FINCA CHOCLOS Y ASADOS</b><br/>"
        "<font size=9 color='#B45309'><b>ACTA OFICIAL DE CONTEO FÍSICO DE INVENTARIO — CIERRE 30 DE SEPTIEMBRE DE 2026</b></font><br/>"
        "<font size=7.5 color='#475569'>Auditoría de Existencias Físicas en Bodega de Carnes | Corte: 30 de Septiembre de 2026 | Responsable: Auditor / Bodega</font>",
        ParagraphStyle('H1', parent=styles['Normal'], fontSize=11, leading=14, textColor=colors.HexColor('#0F172A'))
    )
    story_conteo.append(title_p)
    story_conteo.append(Spacer(1, 8))

    # Tabla de datos
    headers = [
        "Cód.", "Insumo / Corte", "Categoría", "Entero\n(Kg)", "Porciones\n(Und)",
        "Peso Porc.\n(Kg)", "Total Fís.\n(Kg)", "Costo Unit.\n($ COP)", "Valor Total Conteo\n($ COP)", "Detalle de Conteo / Observaciones"
    ]
    table_data = [headers]

    tot_entero = 0.0
    tot_und = 0
    tot_porc_kg = 0.0
    tot_general_kg = 0.0
    tot_valor = 0.0

    for item in conteo_items:
        cod, nom, cat, ent_kg, und, p_kg, costo, val_exact, obs = item
        is_und = (cat in ["EMBUTIDO", "ELABORADOS"] and ent_kg == 0 and p_kg == 0)
        tot_kg = 0.0 if is_und else (ent_kg + p_kg)
        val = val_exact

        tot_entero += ent_kg
        tot_und += und
        tot_porc_kg += p_kg
        tot_general_kg += tot_kg
        tot_valor += val

        table_data.append([
            cod,
            nom,
            cat,
            f"{ent_kg:.2f}" if ent_kg > 0 else "-",
            f"{und}" if und > 0 else "-",
            f"{p_kg:.2f}" if p_kg > 0 else "-",
            f"{tot_kg:.2f}" if tot_kg > 0 else "-",
            format_money(costo),
            format_money(val),
            obs
        ])

    # Fila de totales
    table_data.append([
        "TOTAL",
        f"{len(conteo_items)} CORTES AUDITADOS",
        "-",
        f"{tot_entero:.2f} Kg",
        f"{tot_und} und",
        f"{tot_porc_kg:.2f} Kg",
        f"{tot_general_kg:.2f} Kg",
        "-",
        format_money(tot_valor),
        "Valoración Oficial Conteo Físico Cierre 30-Sep"
    ])

    col_widths = [50, 140, 100, 50, 55, 60, 55, 65, 80, 115]
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
        ('TOPPADDING', (0, 0), (-1, 0), 4),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (3, 1), (8, -1), 'RIGHT'),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#F8FAFC')]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FEF3C7')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#92400E')),
    ]))
    story_conteo.append(t)
    story_conteo.append(Spacer(1, 10))

    # Firmas de conformidad
    sig_data = [
        ["CONFORME BODEGA / AUDITORÍA", "CONFORME ADMINISTRACIÓN", "REVISIÓN CONTABILIDAD / COSTOS"],
        ["\n\n__________________________________", "\n\n__________________________________", "\n\n__________________________________"],
        ["Firma Responsable Bodega", "Firma Administración General", "Firma Auditoría de Costos"]
    ]
    sig_table = Table(sig_data, colWidths=[250, 250, 250])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 2), (-1, 2), 7.5),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#475569')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story_conteo.append(KeepTogether(sig_table))

    doc_conteo.build(story_conteo)
    print(f"[OK] Documento 1 generado con exito: {pdf_conteo_path}")

    # =========================================================================
    # DOCUMENTO 2: EXCEL OFICIAL CONTEO FÍSICO (.xlsx)
    # =========================================================================
    excel_path = 'CONTEO_FISICO_LA_FINCA_2026-09-30.xlsx'
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CONTEO_FISICO_30_SEP"

    # Header de título
    ws.merge_cells("A1:J1")
    ws["A1"] = "RESTAURANTE CAMPESTRE LA FINCA CHOCLOS Y ASADOS — ACTA OFICIAL DE CONTEO FISICO"
    ws["A1"].font = Font(name="Calibri", size=13, bold=True, color="1E293B")
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:J2")
    ws["A2"] = "AUDITORIA FISICA DE BODEGA DE CARNES — CIERRE 30 DE SEPTIEMBRE DE 2026 (VALOR: $7.210.193)"
    ws["A2"].font = Font(name="Calibri", size=10, bold=True, color="B45309")
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    # Cabeceras
    cols = ["Codigo", "Insumo / Corte", "Categoria", "Entero (Kg)", "Porciones (Und)", "Peso Porc. (Kg)", "Total Fisico (Kg)", "Costo Unitario ($)", "Valor Total ($)", "Detalle de Conteo"]
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
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    row_idx = 5
    for item in conteo_items:
        cod, nom, cat, ent_kg, und, p_kg, costo, val_exact, obs = item
        is_und = (cat in ["EMBUTIDO", "ELABORADOS"] and ent_kg == 0 and p_kg == 0)
        tot_kg = 0.0 if is_und else (ent_kg + p_kg)
        val = val_exact

        ws.cell(row=row_idx, column=1, value=cod).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=2, value=nom)
        ws.cell(row=row_idx, column=3, value=cat)
        ws.cell(row=row_idx, column=4, value=ent_kg if ent_kg > 0 else 0)
        ws.cell(row=row_idx, column=5, value=und if und > 0 else 0)
        ws.cell(row=row_idx, column=6, value=p_kg if p_kg > 0 else 0)
        ws.cell(row=row_idx, column=7, value=tot_kg if tot_kg > 0 else 0)
        ws.cell(row=row_idx, column=8, value=costo)
        ws.cell(row=row_idx, column=9, value=val)
        ws.cell(row=row_idx, column=10, value=obs)

        for c_i in range(1, 11):
            c = ws.cell(row=row_idx, column=c_i)
            c.border = thin_border
            c.font = Font(name="Calibri", size=9.5)
            if c_i in [4, 6, 7]:
                c.number_format = '#,##0.00'
            elif c_i == 5:
                c.number_format = '#,##0'
            elif c_i in [8, 9]:
                c.number_format = '$#,##0'

        row_idx += 1

    # Fila de totales
    ws.cell(row=row_idx, column=1, value="TOTAL").alignment = Alignment(horizontal="center")
    ws.cell(row=row_idx, column=2, value=f"{len(conteo_items)} ITEMS")
    ws.cell(row=row_idx, column=3, value="-")
    ws.cell(row=row_idx, column=4, value=f"=SUM(D5:D{row_idx-1})")
    ws.cell(row=row_idx, column=5, value=f"=SUM(E5:E{row_idx-1})")
    ws.cell(row=row_idx, column=6, value=f"=SUM(F5:F{row_idx-1})")
    ws.cell(row=row_idx, column=7, value=f"=SUM(G5:G{row_idx-1})")
    ws.cell(row=row_idx, column=8, value="-")
    ws.cell(row=row_idx, column=9, value=f"=SUM(I5:I{row_idx-1})")
    ws.cell(row=row_idx, column=10, value="Total Oficial Conteo Fisico")

    tot_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    tot_font = Font(name="Calibri", size=10, bold=True, color="92400E")
    for c_i in range(1, 11):
        c = ws.cell(row=row_idx, column=c_i)
        c.fill = tot_fill
        c.font = tot_font
        c.border = thin_border
        if c_i in [4, 6, 7]:
            c.number_format = '#,##0.00'
        elif c_i == 5:
            c.number_format = '#,##0'
        elif c_i == 9:
            c.number_format = '$#,##0'

    # Autoajustar columnas
    col_widths_excel = {
        'A': 12, 'B': 28, 'C': 22, 'D': 14, 'E': 15, 'F': 16, 'G': 16, 'H': 18, 'I': 20, 'J': 40
    }
    for col, width in col_widths_excel.items():
        ws.column_dimensions[col].width = width

    wb.save(excel_path)
    print(f"[OK] Documento 2 generado con exito: {excel_path}")

if __name__ == '__main__':
    generate_reports()
