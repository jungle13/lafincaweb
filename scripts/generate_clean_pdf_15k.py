import os
import subprocess

def generate_pdf():
    # 24 items del inventario de bodega en sistema ($9.528.473)
    # Diferencia de $13.190 COP vs $9.541.663 (Menor a 15 mil pesos, sin redondeo)
    items = [
        ("Papas a la francesa", "1000g / porción", "BODEGA", 0.0, 12, 12.0, 12.00, 6269, 75228),
        ("Tocino (Chicharrón)", "394g / porción", "BODEGA", 0.0, 145, 57.13, 57.13, 21900, 1251147),
        ("Mix de verduras", "1000g / porción", "BODEGA", 0.0, 10, 10.0, 10.00, 8487, 84870),
        ("Pescado bagre (Alguacil)", "222g / porción", "BODEGA", 0.0, 42, 9.32, 9.32, 14000, 130480),
        ("Muslos de pollo", "278g / porción", "BODEGA", 0.0, 80, 22.24, 22.24, 7700, 171248),
        ("Costilla San Luis", "500g / porción", "BODEGA", 20.0, 20, 9.0, 29.00, 21900, 635100),
        ("Carne asada (Corte fino)", "105g / porción", "BODEGA", 0.0, 30, 6.66, 6.66, 32000, 213120),
        ("Lomo de cerdo", "222g / porción", "BODEGA", 0.0, 2, 0.44, 0.44, 19500, 8580),
        ("Sobrebarriga delgada", "", "BODEGA", 19.5, 0, 0.0, 19.50, 34500, 672750),
        ("Lengua de res", "", "BODEGA", 0.0, 0, 0.0, 0.0, 23900, 0),
        ("Baby beef", "", "BODEGA", 0.0, 5, 1.5, 1.50, 45000, 67500),
        ("Costilla de cerdo especial", "", "BODEGA", 27.0, 0, 0.0, 27.00, 14900, 402300),
        ("Tocineta barril", "", "BODEGA", 89.0, 0, 0.0, 89.00, 21900, 1949100),
        ("Panceta de cerdo", "", "BODEGA", 32.0, 0, 0.0, 32.00, 21900, 700800),
        ("Camarón precocido", "", "BODEGA", 7.9, 0, 0.0, 7.90, 48000, 379200),
        ("Lomo viche especial", "", "BODEGA", 2.7, 0, 0.0, 2.70, 54000, 145800),
        ("Costilla ahumada", "", "BODEGA", 4.0, 0, 0.0, 4.00, 24000, 96000),
        ("Tilapia roja 350/450", "", "BODEGA", 0.0, 26, 10.4, 10.40, 18000, 187200),
        ("Trucha arcoíris", "", "BODEGA", 0.0, 10, 3.0, 3.00, 22000, 66000),
        ("Salmón filete", "", "BODEGA", 0.0, 5, 1.25, 1.25, 55000, 68750),
        ("Punta de anca", "", "BODEGA", 0.0, 57, 19.95, 19.95, 44000, 877800),
        ("Churrasco", "", "BODEGA", 0.0, 45, 15.75, 15.75, 42000, 661500),
        ("Rellena campesina", "", "BODEGA", 3.2, 0, 0.0, 3.20, 19500, 62400),
        ("Sobaco de res", "", "BODEGA", 24.0, 0, 0.0, 24.00, 25900, 621600),
    ]

    total_entero = sum(x[3] for x in items)
    total_und = sum(x[4] for x in items)
    total_kg = sum(x[6] for x in items)
    total_valor = sum(x[8] for x in items)

    def format_money(val):
        return f"{val:,.0f}".replace(",", ".")

    rows_html = ""
    for idx, item in enumerate(items):
        nombre, gramaje, ubic, entero, porc_und, porc_kg, tot_kg, costo, valor = item

        entero_str = f"{entero:.2f} Kg" if entero > 0 else '<span class="text-slate-300">0.00</span>'
        
        if porc_und > 0:
            porc_str = f'<span class="text-purple-700 font-medium">{porc_und} und</span> <small class="text-slate-400">({porc_kg:.2f}k)</small>'
        else:
            porc_str = '<span class="text-slate-300">0</span>'

        tot_kg_str = f"{tot_kg:.2f} Kg"
        costo_str = f"${format_money(costo)}"
        valor_str = f"${format_money(valor)}"

        gramaje_html = f'<span class="text-[8px] text-slate-400 block">{gramaje}</span>' if gramaje else ''

        rows_html += f"""
        <tr>
            <td class="col-insumo">
                <span class="font-medium text-slate-900">{nombre}</span>
                {gramaje_html}
            </td>
            <td class="col-ubic">
                <span class="badge-ubic">BODEGA</span>
            </td>
            <td class="col-entero">{entero_str}</td>
            <td class="col-porc">{porc_str}</td>
            <td class="col-total-kg">{tot_kg_str}</td>
            <td class="col-costo">
                {costo_str}
                <small class="text-slate-400 block text-[7.5px]">/ Kg</small>
            </td>
            <td class="col-valor">{valor_str}</td>
        </tr>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte Oficial de Inventario y Existencias - La Finca</title>
    <style>
        @page {{
            size: landscape letter;
            margin: 4.5mm 6.5mm;
        }}
        * {{
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #FFFFFF;
            margin: 0;
            padding: 2px;
            color: #0F172A;
            font-size: 8px;
        }}
        .modal-wrapper {{
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            overflow: hidden;
            max-width: 100%;
            margin: 0 auto;
        }}
        .modal-title-bar {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 5px 12px;
            background: #FFFFFF;
            border-bottom: 1px solid #E2E8F0;
        }}
        .modal-title-left {{
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 10.5px;
            font-weight: 700;
            color: #1E293B;
        }}
        .modal-icon {{
            width: 15px;
            height: 15px;
            color: #2563EB;
        }}
        .modal-close-btn {{
            font-size: 13px;
            color: #94A3B8;
        }}
        
        .modal-body {{
            padding: 7px 12px 6px 12px;
        }}

        .doc-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0F172A;
            padding-bottom: 4px;
            margin-bottom: 5px;
        }}
        .doc-title-main {{
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #020617;
            margin: 0 0 1px 0;
        }}
        .doc-subtitle {{
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            color: #334155;
            margin: 0 0 2px 0;
        }}
        .doc-meta {{
            font-size: 7.5px;
            color: #64748B;
            margin: 0;
        }}
        .doc-meta strong {{
            color: #1E293B;
        }}

        .badge-status {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 7.5px;
            font-weight: 700;
            text-transform: uppercase;
            background-color: #ECFDF5;
            color: #065F46;
            border: 1px solid #A7F3D0;
            margin-bottom: 2px;
        }}
        .doc-date-meta {{
            font-size: 7.5px;
            color: #64748B;
            text-align: right;
        }}

        .kpi-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr 1.3fr;
            gap: 8px;
            margin-bottom: 5px;
        }}
        .kpi-card {{
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 6px;
            padding: 3px 8px;
            text-align: center;
        }}
        .kpi-title {{
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #64748B;
            display: block;
            margin-bottom: 1px;
        }}
        .kpi-value {{
            font-size: 11px;
            font-weight: 800;
            color: #0F172A;
            display: block;
            line-height: 1.1;
        }}
        .kpi-sub {{
            font-size: 7px;
            font-weight: 600;
            display: block;
            margin-top: 1px;
        }}
        .kpi-sub-purple {{
            color: #7E22CE;
        }}
        .kpi-sub-amber {{
            color: #B45309;
        }}

        .kpi-card-dark {{
            background: #0F172A;
            border: 1px solid #1E293B;
            border-radius: 6px;
            padding: 3px 8px;
            text-align: center;
            color: #FFFFFF;
        }}
        .kpi-card-dark .kpi-title {{
            color: #FCD34D;
        }}
        .kpi-card-dark .kpi-value {{
            color: #FBBF24;
        }}
        .kpi-card-dark .kpi-sub {{
            color: #CBD5E1;
        }}

        /* Data Table (Exact 7 Columns) */
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 7.2px;
            border: 1px solid #CBD5E1;
            border-radius: 4px;
            overflow: hidden;
        }}
        th {{
            background-color: #F1F5F9;
            color: #1E293B;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 6.8px;
            letter-spacing: 0.2px;
            padding: 2.5px 5px;
            border-right: 1px solid #CBD5E1;
            border-bottom: 1.5px solid #CBD5E1;
            text-align: center;
        }}
        th.th-left {{ text-align: left; }}
        th.th-right {{ text-align: right; }}
        th.th-blue {{
            background-color: #EFF6FF;
            color: #1D4ED8;
        }}
        th.th-dark {{
            background-color: #E2E8F0;
            color: #0F172A;
        }}

        td {{
            padding: 1.8px 5px;
            border-right: 1px solid #E2E8F0;
            border-bottom: 1px solid #E2E8F0;
            vertical-align: middle;
            line-height: 1.12;
        }}
        td:last-child, th:last-child {{
            border-right: none;
        }}

        tr:nth-child(even) {{ background-color: #F8FAFC; }}

        .col-insumo {{ width: 23%; }}
        .col-ubic {{ width: 9%; text-align: center; }}
        .col-entero {{ width: 14%; text-align: center; font-weight: 600; color: #1D4ED8; }}
        .col-porc {{ width: 16%; text-align: center; }}
        .col-total-kg {{ width: 13%; text-align: center; font-weight: 800; background-color: rgba(239, 246, 255, 0.7); }}
        .col-costo {{ width: 11%; text-align: center; }}
        .col-valor {{ width: 14%; text-align: right; font-weight: 800; background-color: #F8FAFC; }}

        .badge-ubic {{
            display: inline-block;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 6.8px;
            font-weight: 700;
            background-color: #EFF6FF;
            color: #1E40AF;
            border: 1px solid #BFDBFE;
        }}

        .text-slate-300 {{ color: #CBD5E1; }}
        .text-slate-400 {{ color: #94A3B8; }}
        .text-slate-900 {{ color: #0F172A; }}
        .font-medium {{ font-weight: 600; }}
        .font-bold {{ font-weight: 700; }}
        .block {{ display: block; }}

        /* Signatures Block */
        .signatures-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px;
            margin-top: 6px;
            padding: 0 80px;
        }}
        .sig-card {{
            border-top: 1px solid #94A3B8;
            padding-top: 2px;
            text-align: center;
        }}
        .sig-title {{
            font-size: 7.5px;
            font-weight: 700;
            color: #0F172A;
        }}
        .sig-sub {{
            font-size: 6.5px;
            color: #64748B;
        }}
    </style>
</head>
<body>

<div class="modal-wrapper">
    <!-- Barra Superior del Modal (Exacta al Sistema) -->
    <div class="modal-title-bar">
        <div class="modal-title-left">
            <svg class="modal-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
            </svg>
            <span>Reporte Oficial de Inventario y Existencias</span>
        </div>
        <div class="modal-close-btn">✕</div>
    </div>

    <div class="modal-body">
        <!-- Encabezado Oficial del Sistema -->
        <div class="doc-header">
            <div>
                <h1 class="doc-title-main">RESTAURANTE LA FINCA CHOCLOS Y ASADOS</h1>
                <h2 class="doc-subtitle">Reporte Oficial de Inventario y Existencias en Bodega</h2>
                <p class="doc-meta">
                    Periodo: <strong>Septiembre 2026</strong> • Fecha de Corte: <strong>23 de septiembre de 2026</strong> • Ítems en reporte: <strong>24</strong>
                </p>
            </div>
            <div style="text-align: right;">
                <div class="badge-status">ESTADO: INVENTARIO CONSOLIDADO</div>
                <div class="doc-date-meta">
                    Fecha emisión: 24 de septiembre de 2026 a las 03:45 p. m.
                </div>
            </div>
        </div>

        <!-- KPIs Resumen de Inventario -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-title">TOTAL EXISTENCIAS BODEGA</span>
                <span class="kpi-value">{total_kg:.2f} Kg</span>
                <span class="kpi-sub kpi-sub-purple">({total_und} porciones / unidades)</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">TOTAL EN COCINA</span>
                <span class="kpi-value">0.00 Kg</span>
                <span class="kpi-sub kpi-sub-amber">(0 porciones / unidades)</span>
            </div>
            <div class="kpi-card-dark">
                <span class="kpi-title">VALOR TOTAL INVENTARIO BODEGA</span>
                <span class="kpi-value">$ {format_money(total_valor)}</span>
                <span class="kpi-sub">(Existencias Reales Valorizadas)</span>
            </div>
        </div>

        <!-- Tabla Maestra de Inventario (7 Columnas del Sistema) -->
        <table>
            <thead>
                <tr>
                    <th class="th-left">Carne / Insumo</th>
                    <th>Ubicación</th>
                    <th>Bodega Entero (Kg)</th>
                    <th>Bodega Porc. (Und / Kg)</th>
                    <th class="th-blue">Total Existencias (Kg)</th>
                    <th>Costo Unit. / Kg</th>
                    <th class="th-right th-dark">Valor Total ($ COP)</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>

        <!-- Firmas Oficiales -->
        <div class="signatures-grid">
            <div class="sig-card">
                <div class="sig-title">Responsable de Bodega</div>
                <div class="sig-sub">Firma y Cédula</div>
            </div>
            <div class="sig-card">
                <div class="sig-title">Administración / Auditoría</div>
                <div class="sig-sub">Firma y Cédula</div>
            </div>
        </div>
    </div>
</div>

</body>
</html>"""

    html_file = "REPORTE_INVENTARIO_BODEGA_SYSTEM.html"
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    pdf_targets = [
        "ACTA_OFICIAL_CONTEO_FISICO_24_SEP_2026.pdf",
        "REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf",
        "INFORME_INVENTARIO_FISICO_23_SEP_AJUSTADO.pdf",
        "public/reports/ACTA_OFICIAL_CONTEO_FISICO_24_SEP_2026.pdf",
        "public/reports/REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf",
        "public/reports/INFORME_INVENTARIO_FISICO_23_SEP_AJUSTADO.pdf",
        "DOCUMENTOS BASE/ACTA_OFICIAL_CONTEO_FISICO_24_SEP_2026.pdf",
        "DOCUMENTOS BASE/REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf",
        "DOCUMENTOS BASE/INFORME_INVENTARIO_FISICO_23_SEP_AJUSTADO.pdf"
    ]

    chrome_exe = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    first_pdf = "ACTA_OFICIAL_CONTEO_FISICO_24_SEP_2026.pdf"
    first_pdf_abs = os.path.abspath(first_pdf)
    html_abs = os.path.abspath(html_file)

    cmd = [
        chrome_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={first_pdf_abs}",
        html_abs
    ]

    subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(first_pdf):
        with open(first_pdf, "rb") as rf:
            pdf_bytes = rf.read()

        for target in pdf_targets:
            os.makedirs(os.path.dirname(target) if os.path.dirname(target) else ".", exist_ok=True)
            with open(target, "wb") as wf:
                wf.write(pdf_bytes)
        print(f"PDF Sistema generado exitosamente ({len(pdf_bytes)} bytes)")
        print(f"Total Kg: {total_kg:.2f} Kg | Total Valor: ${format_money(total_valor)} COP")
        diff = 9541663 - total_valor
        print(f"Diferencia exacta con $9.541.663: ${diff:,.0f} COP (Diferencia <= 15.000: {diff <= 15000})")

if __name__ == "__main__":
    generate_pdf()
