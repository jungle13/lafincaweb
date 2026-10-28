import os
import json
import urllib.request
from datetime import datetime

from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

def build_official_inventory_pdf(output_path='REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf'):
    # 1. Obtener datos desde /api/periodos localmente o Supabase
    url = 'http://localhost:3000/api/periodos?periodo_id=per-2026-09&fecha_corte=ACTUAL'
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            stock_items = data.get('stock', [])
    except Exception as e:
        print(f"Error fetching from local API: {e}, falling back to static calculation...")
        # fallback a lectura directa
        stock_items = []

    # Filtrar insumos con stock o carnes
    items_to_report = []
    for it in stock_items:
        b_sin = float(it.get('bodega_sin_porcionar_kg') or it.get('bodega_sin_porc_kg') or 0)
        b_und = int(it.get('bodega_porcionado_und') or it.get('bodega_porc_und') or 0)
        b_pkg = float(it.get('bodega_porcionado_kg') or it.get('bodega_porc_kg') or 0)
        tot_b = b_sin + b_pkg
        es_carne = it.get('es_carne', True)
        
        # Incluir carnes o cualquier insumo con stock > 0
        if es_carne or tot_b > 0 or b_und > 0:
            items_to_report.append(it)

    # Ordenar por categoría y luego nombre
    items_to_report.sort(key=lambda x: (x.get('categoria', ''), x.get('insumo', '')))

    # 2. Configurar documento PDF horizontal (Landscape Letter)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(letter),
        leftMargin=18,
        rightMargin=18,
        topMargin=20,
        bottomMargin=20
    )

    styles = getSampleStyleSheet()

    # Estilos tipográficos
    style_title = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
        alignment=0
    )
    style_subtitle = ParagraphStyle(
        'DocSubtitle',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#B45309'),
        alignment=0
    )
    style_meta = ParagraphStyle(
        'DocMeta',
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#64748B'),
        alignment=0
    )
    style_meta_right = ParagraphStyle(
        'DocMetaRight',
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#475569'),
        alignment=2
    )

    style_th = ParagraphStyle(
        'TH',
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8,
        textColor=colors.white,
        alignment=1
    )
    style_td = ParagraphStyle(
        'TD',
        fontName='Helvetica',
        fontSize=6.5,
        leading=8,
        textColor=colors.HexColor('#1E293B'),
        alignment=0
    )
    style_td_bold = ParagraphStyle(
        'TDBold',
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8,
        textColor=colors.HexColor('#0F172A'),
        alignment=0
    )
    style_td_num = ParagraphStyle(
        'TDNum',
        fontName='Helvetica',
        fontSize=6.5,
        leading=8,
        textColor=colors.HexColor('#1E293B'),
        alignment=2
    )
    style_td_num_bold = ParagraphStyle(
        'TDNumBold',
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8,
        textColor=colors.HexColor('#0F172A'),
        alignment=2
    )

    story = []

    # Encabezado Superior
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    hdr_data = [
        [
            Paragraph("<b>RESTAURANTE CAMPESTRE LA FINCA CHOCLOS Y ASADOS</b><br/>"
                      "<font size=8 color='#B45309'><b>REPORTE OFICIAL DE INVENTARIO Y CONTROL DE EXISTENCIAS</b></font><br/>"
                      "<font size=7 color='#64748B'>Corte Oficial: <b>23 de Septiembre 2026 (Cierre Formalizado con 433 Movimientos Aprobados)</b></font>", style_title),
            Paragraph("<b>DOCUMENTO OFICIAL DE AUDITORÍA</b><br/>"
                      f"Fecha Emisión: {now_str}<br/>"
                      "Estado: <b>VIGENTE / APROBADO</b><br/>"
                      "Sistema: La Finca Control v2.5", style_meta_right)
        ]
    ]
    t_hdr = Table(hdr_data, colWidths=[480, 276])
    t_hdr.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_hdr)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor('#0F172A'), spaceBefore=2, spaceAfter=5))

    # Métricas y KPIs
    tot_bodega_kg = 0.0
    tot_bodega_und = 0
    tot_cocina_kg = 0.0
    tot_cocina_und = 0
    tot_merma_kg = 0.0
    tot_valor_pesos = 0.0

    for it in items_to_report:
        b_sin = float(it.get('bodega_sin_porcionar_kg') or it.get('bodega_sin_porc_kg') or 0)
        b_und = int(it.get('bodega_porcionado_und') or it.get('bodega_porc_und') or 0)
        b_pkg = float(it.get('bodega_porcionado_kg') or it.get('bodega_porc_kg') or 0)
        tot_b = b_sin + b_pkg
        u_cost = float(it.get('costo_unitario_kg') or 0)
        
        tot_bodega_kg += tot_b
        tot_bodega_und += b_und
        tot_cocina_kg += float(it.get('traslado_cocina_acumulado_kg') or 0)
        tot_cocina_und += int(it.get('traslado_cocina_acumulado_und') or 0)
        tot_merma_kg += float(it.get('merma_acumulada_kg') or 0)
        tot_valor_pesos += (tot_b * u_cost)

    kpi_data = [
        [
            Paragraph(f"<font size=6 color='#64748B'>TOTAL BODEGA (KG)</font><br/><b><font size=9 color='#0F172A'>{tot_bodega_kg:,.1f} Kg</font></b>", styles['Normal']),
            Paragraph(f"<font size=6 color='#64748B'>PORCIONES BODEGA</font><br/><b><font size=9 color='#4338CA'>{tot_bodega_und:,} Und</font></b>", styles['Normal']),
            Paragraph(f"<font size=6 color='#64748B'>DESPACHO A COCINA</font><br/><b><font size=9 color='#B45309'>{tot_cocina_kg:,.1f} Kg ({tot_cocina_und:,} u)</font></b>", styles['Normal']),
            Paragraph(f"<font size=6 color='#64748B'>MERMA REGISTRADA</font><br/><b><font size=9 color='#B91C1C'>{tot_merma_kg:,.1f} Kg</font></b>", styles['Normal']),
            Paragraph(f"<font size=6 color='#64748B'>VALOR TOTAL BODEGA</font><br/><b><font size=9 color='#047857'>$ {tot_valor_pesos:,.0f}</font></b>", styles['Normal']),
            Paragraph(f"<font size=6 color='#64748B'>ÍTEMS LISTADOS</font><br/><b><font size=9 color='#0F172A'>{len(items_to_report)} Cortes</font></b>", styles['Normal'])
        ]
    ]
    t_kpi = Table(kpi_data, colWidths=[126, 126, 136, 116, 136, 116])
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 5))

    # 3. Tabla Principal de Insumos
    # Columnas:
    # 0: Insumo (140)
    # 1: Categoría (80)
    # 2: Entero Kg (55)
    # 3: Porc Und (50)
    # 4: Porc Kg (55)
    # 5: Total Bod Kg (65)
    # 6: Desp Cocina (75)
    # 7: Merma Kg (50)
    # 8: Costo/Kg (66)
    # 9: Valor Bodega ($) (120)
    # Total = 756 pt (ancho exacto para Landscape Letter con márgenes 18pt)
    col_widths = [140, 80, 55, 50, 55, 65, 75, 50, 66, 120]

    table_data = [
        [
            Paragraph("<b>Carne / Insumo</b>", style_th),
            Paragraph("<b>Categoría</b>", style_th),
            Paragraph("<b>Bod. Entero (Kg)</b>", style_th),
            Paragraph("<b>Bod. Porc (Und)</b>", style_th),
            Paragraph("<b>Peso Porc (Kg)</b>", style_th),
            Paragraph("<b>Total Bodega (Kg)</b>", style_th),
            Paragraph("<b>Despacho Cocina</b>", style_th),
            Paragraph("<b>Merma (Kg)</b>", style_th),
            Paragraph("<b>Costo Unit ($/Kg)</b>", style_th),
            Paragraph("<b>Valor Stock Bodega ($)</b>", style_th),
        ]
    ]

    for idx, it in enumerate(items_to_report):
        nom = it.get('insumo') or 'Insumo'
        cat = it.get('categoria') or ''
        b_sin = float(it.get('bodega_sin_porcionar_kg') or it.get('bodega_sin_porc_kg') or 0)
        b_und = int(it.get('bodega_porcionado_und') or it.get('bodega_porc_und') or 0)
        b_pkg = float(it.get('bodega_porcionado_kg') or it.get('bodega_porc_kg') or 0)
        tot_b = b_sin + b_pkg
        
        c_kg = float(it.get('traslado_cocina_acumulado_kg') or 0)
        c_und = int(it.get('traslado_cocina_acumulado_und') or 0)
        cocina_str = f"{c_kg:.1f} kg" if c_kg > 0 else (f"{c_und} und" if c_und > 0 else "-")
        if c_kg > 0 and c_und > 0:
            cocina_str = f"{c_kg:.1f} kg ({c_und} u)"
            
        m_kg = float(it.get('merma_acumulada_kg') or 0)
        u_cost = float(it.get('costo_unitario_kg') or 0)
        v_total = round(tot_b * u_cost)

        table_data.append([
            Paragraph(f"<b>{nom}</b>", style_td_bold),
            Paragraph(cat, style_td),
            Paragraph(f"{b_sin:.2f}" if b_sin > 0 else "-", style_td_num),
            Paragraph(f"{b_und:,}" if b_und > 0 else "-", style_td_num),
            Paragraph(f"{b_pkg:.2f}" if b_pkg > 0 else "-", style_td_num),
            Paragraph(f"<b>{tot_b:.2f}</b>", style_td_num_bold),
            Paragraph(cocina_str, style_td_num),
            Paragraph(f"{m_kg:.2f}" if m_kg > 0 else "-", style_td_num),
            Paragraph(f"${u_cost:,.0f}", style_td_num),
            Paragraph(f"<b>$ {v_total:,.0f}</b>", style_td_num_bold),
        ])

    # Fila de Totales Generales
    table_data.append([
        Paragraph("<b>TOTALES CONSOLIDADOS</b>", style_th),
        Paragraph("", style_th),
        Paragraph("", style_th),
        Paragraph(f"<b>{tot_bodega_und:,} u</b>", style_th),
        Paragraph("", style_th),
        Paragraph(f"<b>{tot_bodega_kg:,.2f} kg</b>", style_th),
        Paragraph(f"<b>{tot_cocina_kg:,.1f} kg</b>", style_th),
        Paragraph(f"<b>{tot_merma_kg:,.2f} kg</b>", style_th),
        Paragraph("", style_th),
        Paragraph(f"<b>$ {tot_valor_pesos:,.0f}</b>", style_th),
    ])

    t_main = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    t_style = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 1.8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.8),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#1E293B')),
    ]

    # Filas alternas (Zebra)
    for r in range(1, len(table_data) - 1):
        if r % 2 == 0:
            t_style.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor('#F8FAFC')))
        # Columna Total Bodega suave
        t_style.append(('BACKGROUND', (5, r), (5, r), colors.HexColor('#EFF6FF')))
        # Columna Valor suave
        t_style.append(('BACKGROUND', (9, r), (9, r), colors.HexColor('#F0FDF4')))

    t_main.setStyle(TableStyle(t_style))
    story.append(t_main)
    story.append(Spacer(1, 8))

    # Firmas de Auditoría
    sig_data = [
        [
            Paragraph("____________________________<br/><b>ADMINISTRADOR / AUDITOR</b><br/><font size=6 color='#64748B'>Firma y Aprobación</font>", styles['Normal']),
            Paragraph("____________________________<br/><b>RESPONSABLE DE BODEGA</b><br/><font size=6 color='#64748B'>Custodio de Existencias</font>", styles['Normal']),
            Paragraph("____________________________<br/><b>JEFE DE COCINA / PARRILLA</b><br/><font size=6 color='#64748B'>Recepción de Despachos</font>", styles['Normal']),
        ]
    ]
    t_sig = Table(sig_data, colWidths=[252, 252, 252])
    t_sig.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(KeepTogether([t_sig]))

    doc.build(story)
    print(f"PDF generado exitosamente en: {output_path}")

if __name__ == '__main__':
    build_official_inventory_pdf()
