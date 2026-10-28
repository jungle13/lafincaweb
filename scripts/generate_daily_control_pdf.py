import sys
import os
import argparse
import json
import subprocess
from datetime import datetime

from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak
)

def format_money(val):
    try:
        v = float(val)
        return f"${v:,.0f}".replace(",", ".")
    except:
        return "$0"

def generate_pdf_for_day(fecha, output_path):
    cmd = [
        "node", "-e",
        f"""
        import('@supabase/supabase-js').then(async ({{ createClient }}) => {{
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
          const supabase = createClient(supabaseUrl, supabaseAnonKey);

          const {{ data: movs }} = await supabase
            .from('movimientos_inventario')
            .select('*, catalogo_insumos(codigo, nombre, categoria, costo_unitario_kg)')
            .eq('tipo_movimiento', 'TRASLADO_COCINA')
            .eq('fecha', '{fecha}')
            .order('fecha_hora', {{ ascending: true }});

          const {{ data: ventas }} = await supabase
            .from('ventas_detalle')
            .select('*')
            .eq('fecha', '{fecha}')
            .order('gran_total', {{ ascending: false }});

          console.log(JSON.stringify({{ movs, ventas }}));
        }});
        """
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    raw_data = json.loads(res.stdout)
    movs = raw_data.get('movs') or []
    all_ventas = raw_data.get('ventas') or []

    # Filtro estricto de exclusión para asegurar que solo se incluyan ventas de platos con carnes
    def is_no_carne(p):
        s = (p or '').lower().strip()
        if any(x in s for x in ['agua', 'gaseosa', 'cerv', 'poker', 'aguila', 'corona', 'stella', 'club', 'costeñita', 'costeita']):
            return True
        if any(x in s for x in ['jugo', 'limonada', 'jarra', 'gatorade', 'mr tea', 'pony', 'h2o', 'vive 100', 'guarapo', 'frape', 'soda postobon', 'tangelo']):
            return True
        if any(x in s for x in ['cafe', 'chocolate', 'milo', 'avena', 'mazamorra', 'michelado', 'tinto']):
            return True
        if any(x in s for x in ['desechable', 'baño', 'bao', 'actigest', 'bolsa leche', 'mix cereal']):
            return True
        if any(x in s for x in ['aguacate', 'banano', 'hojuelas', 'sopa sola', 'perico', 'entrada tost ahogado']) or s in ['francesa', 'huevo']:
            return True
        if s.startswith(('porc arepa', 'porc arroz', 'porc ensalada', 'porc maduro', 'porc principio', 'por ensalada')):
            return True
        return False

    ventas_carnes = [v for v in all_ventas if not is_no_carne(v.get('nombre_producto', ''))]

    costo_carnes_total = sum(float(m.get('valor_total_movimiento') or 0) for m in movs)
    venta_carnes_total = sum(float(v.get('gran_total') or 0) for v in ventas_carnes)
    ganancia_neta = venta_carnes_total - costo_carnes_total
    margen_pct = (ganancia_neta / venta_carnes_total * 100) if venta_carnes_total > 0 else 0
    food_cost_pct = (costo_carnes_total / venta_carnes_total * 100) if venta_carnes_total > 0 else 0

    dias_py = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    try:
        dt = datetime.strptime(fecha, '%Y-%m-%d')
        dia_nombre = dias_py[dt.weekday()]
    except:
        dia_nombre = 'Jornada'

    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(letter),
        leftMargin=18,
        rightMargin=18,
        topMargin=18,
        bottomMargin=18
    )

    styles = getSampleStyleSheet()
    story = []

    # Encabezado Oficial
    header_html = (
        f"<b>RESTAURANTE CAMPESTRE LA FINCA CHOCLOS Y ASADOS</b><br/>"
        f"<font size=10 color='#1E40AF'><b>INFORME DIARIO DE CONTROL: COSTO DE CARNES A COCINA VS. VENTAS Y RENTABILIDAD</b></font><br/>"
        f"<font size=7.5 color='#475569'>Fecha de Auditoría: <b>{fecha} ({dia_nombre})</b> | Reporte Oficial de Carnes Pasadas a Cocina vs. Ventas</font>"
    )
    story.append(Paragraph(header_html, ParagraphStyle('H1', parent=styles['Normal'], fontSize=11, leading=14, textColor=colors.HexColor('#0F172A'))))
    story.append(Spacer(1, 6))

    # Tarjetas KPI del Día
    kpi_data = [
        [
            Paragraph(f"<b>VENTA PLATOS CARNE</b><br/><font size=11 color='#16A34A'><b>{format_money(venta_carnes_total)}</b></font><br/><font size=6.5 color='#475569'>{len(ventas_carnes)} platos de menú vendidos</font>", styles['Normal']),
            Paragraph(f"<b>COSTO CARNES A COCINA</b><br/><font size=11 color='#DC2626'><b>{format_money(costo_carnes_total)}</b></font><br/><font size=6.5 color='#475569'>{len(movs)} despachos a cocina</font>", styles['Normal']),
            Paragraph(f"<b>GANANCIA BRUTA CARNES</b><br/><font size=11 color='#2563EB'><b>{format_money(ganancia_neta)}</b></font><br/><font size=6.5 color='#475569'>Utilidad bruta del día</font>", styles['Normal']),
            Paragraph(f"<b>MARGEN BRUTO (%)</b><br/><font size=11 color='#D97706'><b>{margen_pct:.1f}%</b></font><br/><font size=6.5 color='#475569'>Food Cost: {food_cost_pct:.1f}%</font>", styles['Normal']),
        ]
    ]
    t_kpi = Table(kpi_data, colWidths=[185, 185, 185, 185])
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 8))

    # TABLA 1: CARNES PASADAS A COCINA (COSTO)
    story.append(Paragraph(f"<b>1. CARNES PASADAS A COCINA DESDE BODEGA ({len(movs)} MOVIMIENTOS)</b>", ParagraphStyle('SubT', fontSize=8.5, leading=10, textColor=colors.HexColor('#B45309'), fontName='Helvetica-Bold')))
    story.append(Spacer(1, 3))

    h_movs = ["Hora", "Cód.", "Insumo / Corte Despachado", "Cant. Kg", "Porc. (Und)", "Peso Porc. (Kg)", "Total Kg", "Costo Unit.", "Subtotal Costo ($)"]
    movs_data = [h_movs]

    tot_ent_kg = 0.0
    tot_und = 0
    tot_pkg = 0.0
    tot_kg_all = 0.0

    for m in movs:
        cat_c = m.get('catalogo_insumos') or {}
        c_kg = float(m.get('cant_sin_porcionar_kg') or 0)
        p_und = int(m.get('porciones_und') or 0)
        p_kg = float(m.get('peso_porciones_kg') or 0)
        tot_d = c_kg + p_kg
        costo_u = float(m.get('costo_unitario_kg') or 0)
        costo_tot = float(m.get('valor_total_movimiento') or 0)

        tot_ent_kg += c_kg
        tot_und += p_und
        tot_pkg += p_kg
        tot_kg_all += tot_d

        movs_data.append([
            m.get('fecha_hora', '')[11:16] if m.get('fecha_hora') else '12:00',
            cat_c.get('codigo', '-'),
            cat_c.get('nombre', 'Insumo'),
            f"{c_kg:.2f}" if c_kg > 0 else "-",
            f"{p_und}" if p_und > 0 else "-",
            f"{p_kg:.2f}" if p_kg > 0 else "-",
            f"{tot_d:.2f}" if tot_d > 0 else "-",
            format_money(costo_u),
            format_money(costo_tot)
        ])

    if len(movs) == 0:
        movs_data.append(["-", "-", "No se registraron traslados a cocina en esta jornada", "-", "-", "-", "-", "-", "$0"])

    movs_data.append([
        "TOTAL", "-", f"{len(movs)} CORTES PASADOS A COCINA", f"{tot_ent_kg:.2f} Kg", f"{tot_und} und", f"{tot_pkg:.2f} Kg", f"{tot_kg_all:.2f} Kg", "-", format_money(costo_carnes_total)
    ])

    t_movs = Table(movs_data, colWidths=[45, 55, 185, 60, 60, 65, 65, 75, 80], repeatRows=1)
    t_movs.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 1), (1, -1), 'CENTER'),
        ('FONTSIZE', (0, 1), (-1, -1), 6.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#F8FAFC')]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FEF3C7')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#92400E')),
    ]))
    story.append(t_movs)
    story.append(Spacer(1, 8))

    # TABLA 2: PLATOS VENDIDOS DE CARNES
    story.append(Paragraph(f"<b>2. VENTAS DE PLATOS RELACIONADOS CON CARNES ({len(ventas_carnes)} PLATOS / MENÚ VENDIDOS)</b>", ParagraphStyle('SubT2', fontSize=8.5, leading=10, textColor=colors.HexColor('#16A34A'), fontName='Helvetica-Bold')))
    story.append(Spacer(1, 3))

    h_ventas = ["Cód.", "Plato / Menú Vendido", "Cant. Vendida (Und)", "Precio Unitario ($)", "Venta Neta ($)", "Impuesto ($)", "Gran Total Venta ($)", "% del Día"]
    ventas_data = [h_ventas]

    tot_platos_und = 0
    tot_v_neta = 0.0
    tot_imp = 0.0

    for v in ventas_carnes:
        cant_v = float(v.get('cantidad') or 0)
        p_unit = float(v.get('valor_unitario') or 0)
        v_net = float(v.get('venta_neta') or 0)
        v_imp = float(v.get('impuesto') or 0)
        v_tot = float(v.get('gran_total') or 0)
        pct_dia = float(v.get('porcentaje_dia') or 0)

        tot_platos_und += cant_v
        tot_v_neta += v_net
        tot_imp += v_imp

        ventas_data.append([
            str(v.get('codigo_producto') or '-'),
            str(v.get('nombre_producto') or 'Plato'),
            f"{cant_v:.0f}",
            format_money(p_unit),
            format_money(v_net),
            format_money(v_imp),
            format_money(v_tot),
            f"{pct_dia:.1f}%"
        ])

    if len(ventas_carnes) == 0:
        ventas_data.append(["-", "No se registraron ventas cárnicas en esta jornada", "-", "-", "-", "-", "$0", "0%"])

    ventas_data.append([
        "TOTAL", f"{len(ventas_carnes)} PLATOS VENDIDOS", f"{tot_platos_und:.0f} und", "-", format_money(tot_v_neta), format_money(tot_imp), format_money(venta_carnes_total), "100.0%"
    ])

    t_ventas = Table(ventas_data, colWidths=[45, 235, 75, 75, 80, 75, 85, 70], repeatRows=1)
    t_ventas.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#065F46')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('FONTSIZE', (0, 1), (-1, -1), 6.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#F8FAFC')]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#DCFCE7')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#166534')),
    ]))
    story.append(t_ventas)
    story.append(Spacer(1, 10))

    # Firmas de conformidad
    sig_data = [
        ["RESPONSABLE BODEGA / DESPACHO", "CHEF / JEFE DE COCINA", "ADMINISTRACIÓN / COSTOS"],
        ["\n\n__________________________________", "\n\n__________________________________", "\n\n__________________________________"],
        ["Entrega de Cortes y Kilos", "Recepción y Transformación", "Auditoría de Ventas y Márgenes"]
    ]
    t_sig = Table(sig_data, colWidths=[240, 240, 240])
    t_sig.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('TEXTCOLOR', (0, 2), (-1, 2), colors.HexColor('#64748B')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(KeepTogether(t_sig))

    doc.build(story)
    print(f"[OK] Reporte diario generado en: {output_path}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Generar PDF Control Diario Carnes vs Ventas")
    parser.add_argument('--fecha', required=True, help="Fecha en formato YYYY-MM-DD")
    parser.add_argument('--output', required=True, help="Ruta del archivo PDF de salida")
    args = parser.parse_args()

    generate_pdf_for_day(args.fecha, args.output)
