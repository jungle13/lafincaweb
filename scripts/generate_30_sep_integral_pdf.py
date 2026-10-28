import sys
import os
import subprocess
import json
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

def generate_integral_pdf():
    output_path = os.path.join(process_cwd := os.getcwd(), "INFORME_CONTROL_DIARIO_30_SEP_CARNES_VERDURAS_GRANOS.pdf")
    temp_path = os.path.join(process_cwd, "temp", "INFORME_CONTROL_CARNES_COCINA_2026-09-30.pdf")

    # 1. Consultar carnes y ventas del 30 de septiembre
    cmd = [
        "node", "-e",
        """
        import('@supabase/supabase-js').then(async ({ createClient }) => {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
          const supabase = createClient(supabaseUrl, supabaseAnonKey);

          const { data: movs } = await supabase
            .from('movimientos_inventario')
            .select('*, catalogo_insumos(codigo, nombre, categoria, costo_unitario_kg)')
            .eq('tipo_movimiento', 'TRASLADO_COCINA')
            .eq('fecha', '2026-09-30')
            .order('fecha_hora', { ascending: true });

          const { data: ventas } = await supabase
            .from('ventas_detalle')
            .select('*')
            .eq('fecha', '2026-09-30')
            .order('gran_total', { ascending: false });

          console.log(JSON.stringify({ movs, ventas }));
        });
        """
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    raw = json.loads(res.stdout)
    movs = raw.get('movs') or []
    all_ventas = raw.get('ventas') or []

    # Filtro de platos cárnicos excluyendo bebidas y no comida
    def is_no_carne(p):
        s = (p or '').lower().strip()
        if any(x in s for x in ['agua', 'gaseosa', 'cerv', 'poker', 'aguila', 'corona', 'stella', 'club', 'costeñita', 'costeita', 'coste']):
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

    # Cálculos Carnes
    costo_carnes = sum(float(m.get('valor_total_movimiento') or 0) for m in movs)
    venta_total = sum(float(v.get('gran_total') or 0) for v in ventas_carnes)

    # 2. Insumos Adicionales de Cocina (Verduras, Granos y Abarrotes del cuaderno del 30 de septiembre)
    # Valores extraídos de las compras de transacciones_gastos_insumos
    verduras_granos = [
        # VERDURAS
        {"nombre": "Plátano (Verde/Maduro)", "categoria": "Verduras", "cant": 32.9, "med": "Kg", "costo_unit": 1400, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Choclo / Mazorca", "categoria": "Verduras", "cant": 17.0, "med": "Und", "costo_unit": 1600, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Cebolla Cabezona", "categoria": "Verduras", "cant": 2.1, "med": "Kg", "costo_unit": 3700, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Pimentón", "categoria": "Verduras", "cant": 1.0, "med": "Kg", "costo_unit": 4000, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Zanahoria", "categoria": "Verduras", "cant": 1.6, "med": "Kg", "costo_unit": 2000, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Cilantro", "categoria": "Verduras", "cant": 1.0, "med": "Atado", "costo_unit": 8500, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Papa lavada (Capira)", "categoria": "Verduras", "cant": 1.2, "med": "Kg", "costo_unit": 2500, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Limón / Lima Tahiti", "categoria": "Verduras", "cant": 7.9, "med": "Kg", "costo_unit": 3400, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Lechuga Batavia", "categoria": "Verduras", "cant": 7.7, "med": "Kg", "costo_unit": 2800, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Cebolla Larga", "categoria": "Verduras", "cant": 3.9, "med": "Kg", "costo_unit": 2400, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Papa Común (Capira)", "categoria": "Verduras", "cant": 13.1, "med": "Kg", "costo_unit": 2500, "proveedor": "Jesús Alfonso Tobón"},
        # GRANOS Y ABARROTES
        {"nombre": "Arroz Proarroz", "categoria": "Granos", "cant": 3.0, "med": "Kg", "costo_unit": 5080, "proveedor": "Distribución Central (Bulto 50k)"},
        {"nombre": "Color Azafrán", "categoria": "Abarrotes", "cant": 0.5, "med": "Lb", "costo_unit": 23800, "proveedor": "Insumos Cocina"},
        {"nombre": "Aceite de Soya", "categoria": "Abarrotes", "cant": 1.0, "med": "Galón", "costo_unit": 22990, "proveedor": "Insumos Cocina"},
        {"nombre": "Lentejas", "categoria": "Granos", "cant": 3.0, "med": "Lb", "costo_unit": 2000, "proveedor": "Insumos Cocina"},
        {"nombre": "Sal Marina/Refisal", "categoria": "Granos", "cant": 10.0, "med": "Lb", "costo_unit": 700, "proveedor": "Insumos Cocina"},
        {"nombre": "Mazamorra / Maíz", "categoria": "Abarrotes", "cant": 1.0, "med": "Bolsa", "costo_unit": 8500, "proveedor": "Insumos Cocina"},
        # COMPLEMENTARIOS DE SERVICIO Y COCINA
        {"nombre": "Bananos", "categoria": "Frutas", "cant": 1.0, "med": "Kg", "costo_unit": 2000, "proveedor": "Jesús Alfonso Tobón"},
        {"nombre": "Servilletas", "categoria": "Desechables", "cant": 7.0, "med": "Paq", "costo_unit": 2000, "proveedor": "Desechables Cocina"},
        {"nombre": "Azúcar en sobre", "categoria": "Desechables", "cant": 1.0, "med": "Caja", "costo_unit": 8400, "proveedor": "Desechables Cocina"}
    ]

    for item in verduras_granos:
        item["subtotal"] = round(item["cant"] * item["costo_unit"])

    costo_verduras_granos = sum(i["subtotal"] for i in verduras_granos)
    costo_total_insumos = costo_carnes + costo_verduras_granos

    ganancia_neta = venta_total - costo_total_insumos
    margen_pct = (ganancia_neta / venta_total * 100) if venta_total > 0 else 0
    food_cost_total_pct = (costo_total_insumos / venta_total * 100) if venta_total > 0 else 0
    food_cost_carnes_pct = (costo_carnes / venta_total * 100) if venta_total > 0 else 0
    food_cost_verduras_pct = (costo_verduras_granos / venta_total * 100) if venta_total > 0 else 0

    # Armar PDF
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(letter),
        leftMargin=18,
        rightMargin=18,
        topMargin=16,
        bottomMargin=16
    )

    styles = getSampleStyleSheet()
    story = []

    # Encabezado Oficial
    header_html = (
        f"<b>RESTAURANTE CAMPESTRE LA FINCA CHOCLOS Y ASADOS</b><br/>"
        f"<font size=10 color='#1E40AF'><b>INFORME INTEGRAL DE CONTROL DIARIO: COSTOS DE COCINA (CARNES + VERDURAS + GRANOS) VS. VENTAS</b></font><br/>"
        f"<font size=7.5 color='#475569'>Fecha de Auditoría: <b>2026-09-30 (Miércoles)</b> | Auditoría Oficial de Despachos y Costeo Consolidado</font>"
    )
    story.append(Paragraph(header_html, ParagraphStyle('H1', parent=styles['Normal'], fontSize=11, leading=14, textColor=colors.HexColor('#0F172A'))))
    story.append(Spacer(1, 6))

    # Tarjetas KPI del Día (5 Métricas Clave)
    kpi_data = [
        [
            Paragraph(f"<b>VENTA PLATOS CARNE</b><br/><font size=11 color='#16A34A'><b>{format_money(venta_total)}</b></font><br/><font size=6.5 color='#475569'>{len(ventas_carnes)} platos menú vendidos</font>", styles['Normal']),
            Paragraph(f"<b>COSTO CARNES A COCINA</b><br/><font size=11 color='#DC2626'><b>{format_money(costo_carnes)}</b></font><br/><font size=6.5 color='#475569'>{len(movs)} despachos (Food Cost {food_cost_carnes_pct:.1f}%)</font>", styles['Normal']),
            Paragraph(f"<b>COSTO VERDURAS Y GRANOS</b><br/><font size=11 color='#D97706'><b>{format_money(costo_verduras_granos)}</b></font><br/><font size=6.5 color='#475569'>{len(verduras_granos)} insumos (Food Cost {food_cost_verduras_pct:.1f}%)</font>", styles['Normal']),
            Paragraph(f"<b>COSTO TOTAL ALIMENTOS</b><br/><font size=11 color='#991B1B'><b>{format_money(costo_total_insumos)}</b></font><br/><font size=6.5 color='#475569'>Food Cost Global: <b>{food_cost_total_pct:.1f}%</b></font>", styles['Normal']),
            Paragraph(f"<b>UTILIDAD BRUTA TOTAL</b><br/><font size=11 color='#2563EB'><b>{format_money(ganancia_neta)}</b></font><br/><font size=6.5 color='#475569'>Margen Real: <b>{margen_pct:.1f}%</b></font>", styles['Normal']),
        ]
    ]
    t_kpi = Table(kpi_data, colWidths=[148, 148, 148, 148, 148])
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

    h_movs = ["Hora", "Cód.", "Insumo / Corte Despachado", "Cant. Kg", "Porc. (Und)", "Peso Porc.", "Total Kg", "Costo Unit.", "Subtotal Costo ($)"]
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

    movs_data.append([
        "TOTAL", "-", f"{len(movs)} CORTES DE CARNE PASADOS A COCINA", f"{tot_ent_kg:.2f} Kg", f"{tot_und} und", f"{tot_pkg:.2f} Kg", f"{tot_kg_all:.2f} Kg", "-", format_money(costo_carnes)
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

    # TABLA 2: INSUMOS ADICIONALES DE COCINA (VERDURAS, GRANOS Y ABARROTES)
    story.append(Paragraph(f"<b>2. INSUMOS ADICIONALES DE COCINA: VERDURAS, GRANOS Y ABARROTES ({len(verduras_granos)} INSUMOS REGISTRADOS EN CUADERNO)</b>", ParagraphStyle('SubT_VG', fontSize=8.5, leading=10, textColor=colors.HexColor('#B45309'), fontName='Helvetica-Bold')))
    story.append(Spacer(1, 3))

    h_vg = ["#", "Insumo / Alimento", "Categoría", "Cantidad Salida", "Unidad Medida", "Costo Unit. Compra ($)", "Subtotal Insumo ($)", "Referencia Proveedor / Compra"]
    vg_data = [h_vg]

    for idx, v in enumerate(verduras_granos, 1):
        vg_data.append([
            str(idx),
            v["nombre"],
            v["categoria"],
            f"{v['cant']:.1f}" if isinstance(v['cant'], float) and v['cant'] % 1 != 0 else f"{int(v['cant'])}",
            v["med"],
            format_money(v["costo_unit"]),
            format_money(v["subtotal"]),
            v["proveedor"]
        ])

    vg_data.append([
        "TOTAL", f"{len(verduras_granos)} INSUMOS DE COCINA (VERDURAS / GRANOS)", "-", "-", "-", "-", format_money(costo_verduras_granos), "Costo Adicional Integrado"
    ])

    t_vg = Table(vg_data, colWidths=[25, 175, 75, 75, 65, 85, 95, 145], repeatRows=1)
    t_vg.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#451A03')), # Dark amber
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (3, 1), (6, -1), 'RIGHT'),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('FONTSIZE', (0, 1), (-1, -1), 6.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#FFFBEB')]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FEF3C7')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#92400E')),
    ]))
    story.append(t_vg)
    story.append(Spacer(1, 10))

    # Nueva página para las ventas de platos y resumen financiero final
    story.append(PageBreak())

    # TABLA 3: PLATOS VENDIDOS DE CARNES
    story.append(Paragraph(f"<b>3. VENTAS DE PLATOS RELACIONADOS CON CARNES ({len(ventas_carnes)} PLATOS / MENÚ VENDIDOS)</b>", ParagraphStyle('SubT2', fontSize=8.5, leading=10, textColor=colors.HexColor('#16A34A'), fontName='Helvetica-Bold')))
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

    ventas_data.append([
        "TOTAL", f"{len(ventas_carnes)} PLATOS VENDIDOS", f"{tot_platos_und:.0f} und", "-", format_money(tot_v_neta), format_money(tot_imp), format_money(venta_total), "100.0%"
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

    # CONCILIACIÓN FINANCIERA FINAL
    story.append(Paragraph(f"<b>4. CONCILIACIÓN FINANCIERA DEL DÍA (FOOD COST CONSOLIDADO)</b>", ParagraphStyle('SubT3', fontSize=8.5, leading=10, textColor=colors.HexColor('#1E40AF'), fontName='Helvetica-Bold')))
    story.append(Spacer(1, 3))

    bal_data = [
        ["CONCEPTO", "VALOR ($ COP)", "% SOBRE VENTA", "IMPACTO FINANCIERO"],
        ["Ventas Platos Cárnicos y Menú Facturado", format_money(venta_total), "100.0%", "Ingreso Operativo Bruto"],
        ["(-) Costo de Carnes Despachadas a Cocina", format_money(costo_carnes), f"{food_cost_carnes_pct:.1f}%", "Food Cost Proteína Animal"],
        ["(-) Costo de Granos, Verduras y Abarrotes", format_money(costo_verduras_granos), f"{food_cost_verduras_pct:.1f}%", "Food Cost Vegetales y Guarnición"],
        ["(=) COSTO TOTAL DE ALIMENTOS (FOOD COST)", format_money(costo_total_insumos), f"{food_cost_total_pct:.1f}%", "Costo Directo Consolidado de Cocina"],
        ["(=) GANANCIA BRUTA REAL CONSOLIDADA", format_money(ganancia_neta), f"{margen_pct:.1f}%", "UTILIDAD BRUTA OPERATIVA DEL DÍA"]
    ]
    t_bal = Table(bal_data, colWidths=[240, 130, 110, 260])
    t_bal.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (1, 0), (2, -1), 'RIGHT'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -3), [colors.white, colors.HexColor('#F8FAFC')]),
        ('BACKGROUND', (0, -2), (-1, -2), colors.HexColor('#FEE2E2')),
        ('TEXTCOLOR', (0, -2), (-1, -2), colors.HexColor('#991B1B')),
        ('FONTNAME', (0, -2), (-1, -2), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#DBEAFE')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#1E40AF')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]))
    story.append(t_bal)
    story.append(Spacer(1, 14))

    # Firmas de conformidad
    sig_data = [
        ["RESPONSABLE BODEGA / DESPACHO", "CHEF / JEFE DE COCINA", "ADMINISTRACIÓN / COSTOS"],
        ["\n\n__________________________________", "\n\n__________________________________", "\n\n__________________________________"],
        ["Entrega de Carnes y Verduras", "Recepción y Transformación", "Auditoría de Insumos y Rentabilidad"]
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
    print(f"[OK] Reporte integral generado exitosamente en:\n- {output_path}")

    # También actualizar temp_path para que las descargas de la API reflejen este archivo
    if os.path.exists(os.path.dirname(temp_path)):
        import shutil
        shutil.copyfile(output_path, temp_path)
        print(f"- {temp_path}")

if __name__ == '__main__':
    generate_integral_pdf()
