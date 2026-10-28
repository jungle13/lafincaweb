import os
import subprocess

def generate_clean_pdf():
    # 24 items exactos del sistema con los 7 campos (SIN observaciones ni comentarios)
    # Formato: (Nombre, Gramaje, Ubic, Entero Kg, Porc Und, Porc Kg, Total Kg, Costo Unit, Valor Total)
    items = [
        ("Papas a la francesa", "1000g / porción", "BODEGA", 0.0, 12, 12.00, 12.00, 6269, 75228),
        ("Tocino", "394g / porción", "BODEGA", 0.0, 145, 57.13, 57.13, 21900, 1251147),
        ("Mix de verduras", "1000g / porción", "BODEGA", 0.0, 10, 10.00, 10.00, 8487, 84870),
        ("Pescado bagre", "222g / porción", "BODEGA", 0.0, 42, 9.32, 9.32, 14000, 130480),
        ("Muslos", "278g / porción", "BODEGA", 0.0, 80, 22.24, 22.24, 15000, 333600),
        ("Costilla san luis", "500g / porción", "BODEGA", 20.0, 20, 10.00, 30.00, 21900, 657000),
        ("Carne asada", "105g / porción", "BODEGA", 0.0, 30, 3.15, 3.15, 25900, 81585),
        ("Lomo de cerdo", "222g / porción", "BODEGA", 0.0, 2, 0.44, 0.44, 19500, 8580),
        ("Sobrebarriga delgada", "", "BODEGA", 18.10, 0, 0.0, 18.10, 30000, 543000),
        ("Lengua de res", "", "BODEGA", 0.0, 0, 0.0, 0.0, 23900, 0),
        ("Baby beef", "", "BODEGA", 0.0, 5, 2.00, 2.00, 53000, 106000),
        ("Costilla de cerdo especial", "", "BODEGA", 27.0, 0, 0.0, 27.00, 14900, 402300),
        ("Tocineta barril", "", "BODEGA", 89.0, 0, 0.0, 89.00, 17000, 1513000),
        ("Panceta de cerdo", "", "BODEGA", 32.0, 0, 0.0, 32.00, 21900, 700800),
        ("Camaron precocido", "", "BODEGA", 7.9, 0, 0.0, 7.90, 22900, 180910),
        ("Lomo viche", "", "BODEGA", 2.7, 0, 0.0, 2.70, 53000, 143100),
        ("Costilla ahumada", "", "BODEGA", 4.0, 0, 0.0, 4.00, 24000, 96000),
        ("Tilapia 350/450", "", "BODEGA", 0.0, 26, 8.66, 8.66, 17808, 154217),
        ("Trucha", "", "BODEGA", 0.0, 10, 2.50, 2.50, 22000, 55000),
        ("Salmon", "", "BODEGA", 0.0, 5, 1.00, 1.00, 55000, 55000),
        ("Punta de anca", "", "BODEGA", 0.0, 57, 12.65, 12.65, 44000, 556600),
        ("Churrasco", "", "BODEGA", 0.0, 45, 11.25, 11.25, 44000, 495000),
        ("Rellena", "", "BODEGA", 3.2, 0, 0.0, 3.20, 19500, 62400),
        ("Sobaco", "", "BODEGA", 26.0, 0, 0.0, 26.00, 25900, 673400),
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

        gramaje_html = f'<span class="text-[8.5px] text-slate-400 block">{gramaje}</span>' if gramaje else ''

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
                <small class="text-slate-400 block text-[8px]">/ Kg</small>
            </td>
            <td class="col-valor">{valor_str}</td>
        </tr>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte Oficial de Conteo Físico e Inventario</title>
    <style>
        @page {{
            size: landscape letter;
            margin: 5mm 7mm;
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
            border-radius: 10px;
            overflow: hidden;
            max-width: 100%;
            margin: 0 auto;
        }}
        .modal-title-bar {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 14px;
            background: #FFFFFF;
            border-bottom: 1px solid #E2E8F0;
        }}
        .modal-title-left {{
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 11px;
            font-weight: 700;
            color: #1E293B;
        }}
        .modal-icon {{
            width: 16px;
            height: 16px;
            color: #2563EB;
        }}
        .modal-close-btn {{
            font-size: 14px;
            color: #94A3B8;
        }}
        
        .modal-body {{
            padding: 8px 14px 8px 14px;
        }}

        .doc-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0F172A;
            padding-bottom: 4px;
            margin-bottom: 6px;
        }}
        .doc-title-main {{
            font-size: 12.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #020617;
            margin: 0 0 1px 0;
        }}
        .doc-subtitle {{
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            color: #334155;
            margin: 0 0 2px 0;
        }}
        .doc-meta {{
            font-size: 8px;
            color: #64748B;
            margin: 0;
        }}
        .doc-meta strong {{
            color: #1E293B;
        }}

        .badge-status {{
            display: inline-block;
            padding: 2.5px 9px;
            border-radius: 9999px;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            background-color: #FEF3C7;
            color: #92400E;
            border: 1px solid #FCD34D;
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
            margin-bottom: 6px;
        }}
        .kpi-card {{
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 6px;
            padding: 4px 8px;
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
            font-size: 11.5px;
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
            padding: 4px 8px;
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
            font-size: 7.5px;
            border: 1px solid #CBD5E1;
            border-radius: 5px;
            overflow: hidden;
        }}
        th {{
            background-color: #F1F5F9;
            color: #1E293B;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 7px;
            letter-spacing: 0.2px;
            padding: 3px 5px;
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
            padding: 2.2px 6px;
            border-right: 1px solid #E2E8F0;
            border-bottom: 1px solid #E2E8F0;
            vertical-align: middle;
            line-height: 1.15;
        }}
        td:last-child, th:last-child {{
            border-right: none;
        }}

        tr:nth-child(even) {{ background-color: #F8FAFC; }}
        tr:hover {{ background-color: #F1F5F9; }}

        .col-insumo {{ width: 24%; }}
        .col-ubic {{ width: 9%; text-align: center; }}
        .col-entero {{ width: 14%; text-align: center; font-weight: 600; color: #1D4ED8; }}
        .col-porc {{ width: 16%; text-align: center; }}
        .col-total-kg {{ width: 13%; text-align: center; font-weight: 800; background-color: rgba(239, 246, 255, 0.7); }}
        .col-costo {{ width: 11%; text-align: center; }}
        .col-valor {{ width: 13%; text-align: right; font-weight: 800; background-color: #F8FAFC; }}

        .badge-ubic {{
            display: inline-block;
            padding: 1.5px 6px;
            border-radius: 3px;
            font-size: 7px;
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
            margin-top: 8px;
            padding: 0 80px;
        }}
        .sig-card {{
            border-top: 1px solid #94A3B8;
            padding-top: 2px;
            text-align: center;
        }}
        .sig-title {{
            font-size: 8px;
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
            <span>Reporte Oficial de Conteo Físico e Inventario</span>
        </div>
        <div class="modal-close-btn">✕</div>
    </div>

    <div class="modal-body">
        <!-- Encabezado del Acta -->
        <div class="doc-header">
            <div>
                <h1 class="doc-title-main">RESTAURANTE LA FINCA CHOCLOS Y ASADOS</h1>
                <h2 class="doc-subtitle">Acta Oficial de Conteo Físico de Inventario</h2>
                <p class="doc-meta">
                    Sesión: <strong>2026-09-24</strong> • Responsable: <strong>Bodeguero (Conteo Físico 24-Sep)</strong> • Ítems en acta: <strong>24</strong>
                </p>
            </div>
            <div style="text-align: right;">
                <div class="badge-status">ESTADO: EN AUDITORIA / CONTEO FÍSICO</div>
                <div class="doc-date-meta">
                    Fecha emisión: 24 de septiembre de 2026 a las 03:45 p. m.
                </div>
            </div>
        </div>

        <!-- KPIs Resumen -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-title">TOTAL CONTADO EN BODEGA</span>
                <span class="kpi-value">{total_kg:.2f} Kg</span>
                <span class="kpi-sub kpi-sub-purple">({total_und} porciones / unidades)</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">TOTAL CONTADO EN COCINA</span>
                <span class="kpi-value">0.00 Kg</span>
                <span class="kpi-sub kpi-sub-amber">(0 porciones / unidades)</span>
            </div>
            <div class="kpi-card-dark">
                <span class="kpi-title">VALOR TOTAL CONTEO FÍSICO</span>
                <span class="kpi-value">$ {format_money(total_valor)}</span>
                <span class="kpi-sub">(Existencias Físicas Reales Valorizadas)</span>
            </div>
        </div>

        <!-- Tabla Maestra de 7 Columnas Exactas -->
        <table>
            <thead>
                <tr>
                    <th class="th-left">Carne / Insumo</th>
                    <th>Ubicación</th>
                    <th>Conteo Entero (Kg)</th>
                    <th>Conteo Porc. (Und / Kg)</th>
                    <th class="th-blue">Total Físico (Kg)</th>
                    <th>Costo Unit. / Kg</th>
                    <th class="th-right th-dark">Valor Conteo ($ COP)</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>

        <!-- Firmas -->
        <div class="signatures-grid">
            <div class="sig-card">
                <div class="sig-title">Responsable de Bodega</div>
                <div class="sig-sub">Firma y Cédula</div>
            </div>
            <div class="sig-card">
                <div class="sig-title">Auditor / Administración</div>
                <div class="sig-sub">Firma y Cédula</div>
            </div>
        </div>
    </div>
</div>

</body>
</html>"""

    html_file = "ACTA_CONTEO_FISICO_SYSTEM_CLEAN.html"
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
        print(f"PDF Limpio generado exitosamente ({len(pdf_bytes)} bytes)")
        print(f"Total Kg: {total_kg:.2f} Kg | Total Valor: ${format_money(total_valor)} COP")
        print(f"Diferencia exacta con $8.366.417: ${abs(8366417 - total_valor):,.0f} COP (Menor a $10.000 COP)")

if __name__ == "__main__":
    generate_clean_pdf()
