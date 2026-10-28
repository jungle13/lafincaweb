import os
import subprocess

def generate_reports():
    chrome_exe = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    
    # ------------------------------------------------------------------------
    # 1. GENERAR REPORTE OFICIAL DE INVENTARIO CONSOLIDADO (CON 42 GALLINAS)
    # ------------------------------------------------------------------------
    # Formato: (Nombre, Gramaje, Ubic, Entero Kg, Porc Und, Porc Kg, Total Kg/Und, EsUnd, Costo Unit, Valor Total)
    items_inv = [
        ("Papas a la francesa", "1000g / porción", "BODEGA", 0.0, 12, 12.0, 12.00, False, 6269, 75228),
        ("Tocino (Chicharrón)", "394g / porción", "BODEGA", 0.0, 145, 57.13, 57.13, False, 21900, 1251147),
        ("Mix de verduras", "1000g / porción", "BODEGA", 0.0, 10, 10.0, 10.00, False, 8487, 84870),
        ("Pescado bagre (Alguacil)", "222g / porción", "BODEGA", 0.0, 42, 9.32, 9.32, False, 14000, 130480),
        ("Muslos de pollo", "278g / porción", "BODEGA", 0.0, 80, 22.24, 22.24, False, 7700, 171248),
        ("Costilla San Luis", "500g / porción", "BODEGA", 20.0, 20, 9.0, 29.00, False, 21900, 635100),
        ("Carne asada (Corte fino)", "105g / porción", "BODEGA", 0.0, 30, 6.66, 6.66, False, 32000, 213120),
        ("Lomo de cerdo", "222g / porción", "BODEGA", 0.0, 2, 0.44, 0.44, False, 19500, 8580),
        ("Sobrebarriga delgada", "", "BODEGA", 19.5, 0, 0.0, 19.50, False, 34500, 672750),
        ("Lengua de res", "", "BODEGA", 15.0, 0, 0.0, 15.00, False, 23900, 358500),
        ("Gallinas campesinas", "", "BODEGA", 0.0, 42, 0.0, 42.00, True, 50556, 2123352),
        ("Chorizos cóctel", "", "BODEGA", 0.0, 80, 0.0, 80.00, True, 1200, 96000),
        ("Baby beef", "", "BODEGA", 0.0, 5, 1.5, 1.50, False, 45000, 67500),
        ("Costilla de cerdo especial", "", "BODEGA", 27.0, 0, 0.0, 27.00, False, 14900, 402300),
        ("Tocineta barril", "", "BODEGA", 89.0, 0, 0.0, 89.00, False, 21900, 1949100),
        ("Panceta de cerdo", "", "BODEGA", 32.0, 0, 0.0, 32.00, False, 21900, 700800),
        ("Camarón precocido", "", "BODEGA", 7.9, 0, 0.0, 7.90, False, 48000, 379200),
        ("Lomo viche especial", "", "BODEGA", 2.7, 0, 0.0, 2.70, False, 54000, 145800),
        ("Costilla ahumada", "", "BODEGA", 4.0, 0, 0.0, 4.00, False, 24000, 96000),
        ("Tilapia roja 350/450", "", "BODEGA", 0.0, 26, 10.4, 10.40, False, 18000, 187200),
        ("Trucha arcoíris", "", "BODEGA", 0.0, 10, 3.0, 3.00, False, 22000, 66000),
        ("Salmón filete", "", "BODEGA", 0.0, 5, 1.25, 1.25, False, 55000, 68750),
        ("Punta de anca", "", "BODEGA", 0.0, 57, 19.95, 19.95, False, 44000, 877800),
        ("Churrasco", "", "BODEGA", 0.0, 45, 15.75, 15.75, False, 42000, 661500),
        ("Rellena campesina", "", "BODEGA", 3.2, 0, 0.0, 3.20, False, 19500, 62400),
        ("Sobaco de res", "", "BODEGA", 24.0, 0, 0.0, 24.00, False, 25900, 621600),
    ]

    total_entero = sum(x[3] for x in items_inv)
    total_und = sum(x[4] for x in items_inv)
    total_kg = sum(x[6] for x in items_inv if not x[7])
    total_valor = sum(x[9] for x in items_inv)

    def format_money(val):
        return f"{val:,.0f}".replace(",", ".")

    rows_html = ""
    for idx, item in enumerate(items_inv):
        nombre, gramaje, ubic, entero, porc_und, porc_kg, tot, is_und, costo, valor = item

        entero_str = f"{entero:.2f} Kg" if entero > 0 else '<span class="text-slate-300">0.00</span>'
        
        if porc_und > 0:
            if is_und:
                porc_str = f'<span class="text-purple-700 font-medium">{porc_und} und</span>'
            else:
                porc_str = f'<span class="text-purple-700 font-medium">{porc_und} und</span> <small class="text-slate-400">({porc_kg:.2f}k)</small>'
        else:
            porc_str = '<span class="text-slate-300">0</span>'

        tot_str = f"{porc_und} und" if is_und else f"{tot:.2f} Kg"
        unit_str = "/ und" if is_und else "/ Kg"
        costo_str = f"${format_money(costo)}"
        valor_str = f"${format_money(valor)}"

        gramaje_html = f'<span class="text-[7.5px] text-slate-400 block">{gramaje}</span>' if gramaje else ''

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
            <td class="col-total-kg">{tot_str}</td>
            <td class="col-costo">
                {costo_str}
                <small class="text-slate-400 block text-[7px]">{unit_str}</small>
            </td>
            <td class="col-valor">{valor_str}</td>
        </tr>
        """

    html_inv = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte Oficial de Inventario y Existencias - La Finca</title>
    <style>
        @page {{
            size: landscape letter;
            margin: 4mm 6mm;
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
            font-size: 7.5px;
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
            padding: 4px 12px;
            background: #FFFFFF;
            border-bottom: 1px solid #E2E8F0;
        }}
        .modal-title-left {{
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            font-weight: 700;
            color: #1E293B;
        }}
        .modal-icon {{
            width: 14px;
            height: 14px;
            color: #2563EB;
        }}
        .modal-close-btn {{
            font-size: 12px;
            color: #94A3B8;
        }}
        
        .modal-body {{
            padding: 6px 12px 5px 12px;
        }}

        .doc-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0F172A;
            padding-bottom: 3px;
            margin-bottom: 4px;
        }}
        .doc-title-main {{
            font-size: 11.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #020617;
            margin: 0 0 1px 0;
        }}
        .doc-subtitle {{
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            color: #334155;
            margin: 0 0 1px 0;
        }}
        .doc-meta {{
            font-size: 7px;
            color: #64748B;
            margin: 0;
        }}
        .doc-meta strong {{
            color: #1E293B;
        }}

        .badge-status {{
            display: inline-block;
            padding: 1.5px 7px;
            border-radius: 9999px;
            font-size: 7px;
            font-weight: 700;
            text-transform: uppercase;
            background-color: #ECFDF5;
            color: #065F46;
            border: 1px solid #A7F3D0;
            margin-bottom: 1px;
        }}
        .doc-date-meta {{
            font-size: 7px;
            color: #64748B;
            text-align: right;
        }}

        .kpi-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr 1.3fr;
            gap: 7px;
            margin-bottom: 4px;
        }}
        .kpi-card {{
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 5px;
            padding: 3px 6px;
            text-align: center;
        }}
        .kpi-title {{
            font-size: 6.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #64748B;
            display: block;
            margin-bottom: 1px;
        }}
        .kpi-value {{
            font-size: 10.5px;
            font-weight: 800;
            color: #0F172A;
            display: block;
            line-height: 1.1;
        }}
        .kpi-sub {{
            font-size: 6.5px;
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
            border-radius: 5px;
            padding: 3px 6px;
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

        /* Data Table */
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 6.8px;
            border: 1px solid #CBD5E1;
            border-radius: 4px;
            overflow: hidden;
        }}
        th {{
            background-color: #F1F5F9;
            color: #1E293B;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 6.5px;
            letter-spacing: 0.2px;
            padding: 2px 4px;
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
            padding: 1.4px 4px;
            border-right: 1px solid #E2E8F0;
            border-bottom: 1px solid #E2E8F0;
            vertical-align: middle;
            line-height: 1.08;
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
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 6.5px;
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
            margin-top: 5px;
            padding: 0 80px;
        }}
        .sig-card {{
            border-top: 1px solid #94A3B8;
            padding-top: 2px;
            text-align: center;
        }}
        .sig-title {{
            font-size: 7px;
            font-weight: 700;
            color: #0F172A;
        }}
        .sig-sub {{
            font-size: 6px;
            color: #64748B;
        }}
    </style>
</head>
<body>

<div class="modal-wrapper">
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
        <div class="doc-header">
            <div>
                <h1 class="doc-title-main">RESTAURANTE LA FINCA CHOCLOS Y ASADOS</h1>
                <h2 class="doc-subtitle">Reporte Oficial de Inventario y Existencias en Bodega</h2>
                <p class="doc-meta">
                    Periodo: <strong>Septiembre 2026</strong> • Fecha de Corte: <strong>24 de septiembre de 2026</strong> • Ítems en reporte: <strong>{len(items_inv)}</strong>
                </p>
            </div>
            <div style="text-align: right;">
                <div class="badge-status">ESTADO: INVENTARIO CONSOLIDADO</div>
                <div class="doc-date-meta">
                    Fecha emisión: 24 de septiembre de 2026 a las 05:45 p. m.
                </div>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-title">TOTAL EXISTENCIAS EN KILOS</span>
                <span class="kpi-value">{total_kg:.2f} Kg</span>
                <span class="kpi-sub kpi-sub-purple">({total_und} unidades / porciones)</span>
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

        <table>
            <thead>
                <tr>
                    <th class="th-left">Carne / Insumo</th>
                    <th>Ubicación</th>
                    <th>Bodega Entero (Kg)</th>
                    <th>Bodega Porc. (Und / Kg)</th>
                    <th class="th-blue">Total Existencias</th>
                    <th>Costo Unit.</th>
                    <th class="th-right th-dark">Valor Total ($ COP)</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>

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

    html_path_inv = "REPORTE_OFICIAL_INVENTARIO_CON_42_GALLINAS.html"
    with open(html_path_inv, "w", encoding="utf-8") as f:
        f.write(html_inv)

    pdf_target_inv = "DOCUMENTOS BASE/REPORTE_OFICIAL_INVENTARIO_CON_42_GALLINAS.pdf"
    cmd1 = [
        chrome_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={os.path.abspath(pdf_target_inv)}",
        os.path.abspath(html_path_inv)
    ]
    subprocess.run(cmd1, capture_output=True, text=True)
    print(f"Generado exitosamente: {pdf_target_inv}")

    # También actualizar el archivo principal REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf y ACTA
    for extra in ["REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf", "ACTA_OFICIAL_CONTEO_FISICO_24_SEP_2026.pdf", "DOCUMENTOS BASE/ACTA_OFICIAL_CONTEO_FISICO_24_SEP_2026.pdf", "DOCUMENTOS BASE/REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf"]:
        with open(pdf_target_inv, "rb") as rf:
            with open(extra, "wb") as wf:
                wf.write(rf.read())
        print(f"  -> Sincronizado en: {extra}")

    # ------------------------------------------------------------------------
    # 2. GENERAR REPORTE ESPECÍFICO DE ENTRADAS Y NOVEDADES (42 GALLINAS)
    # ------------------------------------------------------------------------
    html_ent = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte Oficial de Entradas y Novedades de Bodega</title>
    <style>
        @page {{
            size: landscape letter;
            margin: 8mm 12mm;
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
            padding: 4px;
            color: #0F172A;
            font-size: 9.5px;
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
            padding: 8px 16px;
            background: #FFFFFF;
            border-bottom: 1px solid #E2E8F0;
        }}
        .modal-title-left {{
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 700;
            color: #1E293B;
        }}
        .modal-icon {{
            width: 16px;
            height: 16px;
            color: #059669;
        }}
        
        .modal-body {{
            padding: 14px 18px;
        }}

        .doc-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0F172A;
            padding-bottom: 6px;
            margin-bottom: 12px;
        }}
        .doc-title-main {{
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #020617;
            margin: 0 0 2px 0;
        }}
        .doc-subtitle {{
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #047857;
            margin: 0 0 3px 0;
        }}
        .doc-meta {{
            font-size: 8.5px;
            color: #64748B;
            margin: 0;
        }}

        .badge-status {{
            display: inline-block;
            padding: 3px 10px;
            border-radius: 9999px;
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            background-color: #ECFDF5;
            color: #065F46;
            border: 1px solid #A7F3D0;
            margin-bottom: 2px;
        }}
        .doc-date-meta {{
            font-size: 8px;
            color: #64748B;
            text-align: right;
        }}

        .kpi-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1.3fr;
            gap: 10px;
            margin-bottom: 14px;
        }}
        .kpi-card {{
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 6px;
            padding: 6px 10px;
            text-align: center;
        }}
        .kpi-title {{
            font-size: 7.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #64748B;
            display: block;
            margin-bottom: 2px;
        }}
        .kpi-value {{
            font-size: 13px;
            font-weight: 800;
            color: #0F172A;
            display: block;
        }}
        .kpi-sub {{
            font-size: 7.5px;
            font-weight: 600;
            color: #059669;
            display: block;
            margin-top: 1px;
        }}

        .kpi-card-dark {{
            background: #0F172A;
            border: 1px solid #1E293B;
            border-radius: 6px;
            padding: 6px 10px;
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

        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            border: 1px solid #CBD5E1;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 20px;
        }}
        th {{
            background-color: #0F766E;
            color: #FFFFFF;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 8px;
            letter-spacing: 0.3px;
            padding: 6px 8px;
            border-right: 1px solid #115E59;
            border-bottom: 2px solid #0F766E;
            text-align: center;
        }}
        th.th-left {{ text-align: left; }}
        th.th-right {{ text-align: right; }}

        td {{
            padding: 6px 8px;
            border-right: 1px solid #E2E8F0;
            border-bottom: 1px solid #E2E8F0;
            vertical-align: middle;
        }}
        td:last-child, th:last-child {{
            border-right: none;
        }}

        tr:nth-child(even) {{ background-color: #F8FAFC; }}

        .signatures-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            margin-top: 24px;
            padding: 0 100px;
        }}
        .sig-card {{
            border-top: 1px solid #94A3B8;
            padding-top: 4px;
            text-align: center;
        }}
        .sig-title {{
            font-size: 8.5px;
            font-weight: 700;
            color: #0F172A;
        }}
        .sig-sub {{
            font-size: 7.5px;
            color: #64748B;
        }}
    </style>
</head>
<body>

<div class="modal-wrapper">
    <div class="modal-title-bar">
        <div class="modal-title-left">
            <svg class="modal-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>Reporte Oficial de Entradas y Novedades de Bodega</span>
        </div>
        <div style="font-size: 14px; color: #94A3B8;">✕</div>
    </div>

    <div class="modal-body">
        <div class="doc-header">
            <div>
                <h1 class="doc-title-main">RESTAURANTE LA FINCA CHOCLOS Y ASADOS</h1>
                <h2 class="doc-subtitle">Acta de Ingreso de Mercancía a Bodega - Novedades del Día</h2>
                <p class="doc-meta">
                    Fecha de Recepción: <strong>24 de septiembre de 2026</strong> • Hora de Registro: <strong>05:42 PM</strong> • Destino: <strong>Bodega Central de Carnes</strong>
                </p>
            </div>
            <div style="text-align: right;">
                <div class="badge-status">ESTADO: MERCANCÍA RECIBIDA</div>
                <div class="doc-date-meta">
                    Fecha emisión: 24 de septiembre de 2026 a las 05:45 p. m.
                </div>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-title">GALLINAS RECIBIDAS</span>
                <span class="kpi-value">42 Und</span>
                <span class="kpi-sub">Lote Verificado</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">LENGUA RECIBIDA</span>
                <span class="kpi-value">15.00 Kg</span>
                <span class="kpi-sub">Lote en Cava</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-title">CHORIZOS CÓCTEL</span>
                <span class="kpi-value">80 Und</span>
                <span class="kpi-sub">Refrigerado</span>
            </div>
            <div class="kpi-card-dark">
                <span class="kpi-title">VALOR TOTAL ENTRADAS</span>
                <span class="kpi-value">$ 2.577.852</span>
                <span class="kpi-sub">(Total Valorizado del Ingreso)</span>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 5%;">#</th>
                    <th class="th-left" style="width: 25%;">Ítem / Producto</th>
                    <th style="width: 12%;">Ubicación</th>
                    <th style="width: 14%;">Cantidad Recibida</th>
                    <th style="width: 14%;">Costo Unitario Est.</th>
                    <th class="th-right" style="width: 15%;">Valor Total ($ COP)</th>
                    <th class="th-left" style="width: 15%;">Estado de Recepción</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="text-align: center; font-weight: bold;">1</td>
                    <td style="font-weight: bold; color: #0F172A;">Gallinas campesinas</td>
                    <td style="text-align: center;"><span style="background: #ECFDF5; color: #065F46; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 8px;">BODEGA</span></td>
                    <td style="text-align: center; font-weight: bold; color: #1D4ED8;">42 Unidades</td>
                    <td style="text-align: center;">$50.556 / und</td>
                    <td style="text-align: right; font-weight: bold; color: #0F172A;">$2.123.352</td>
                    <td style="color: #334155; font-weight: 600;">En Bodega</td>
                </tr>
                <tr>
                    <td style="text-align: center; font-weight: bold;">2</td>
                    <td style="font-weight: bold; color: #0F172A;">Lengua de res</td>
                    <td style="text-align: center;"><span style="background: #ECFDF5; color: #065F46; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 8px;">BODEGA</span></td>
                    <td style="text-align: center; font-weight: bold; color: #1D4ED8;">15.00 Kg</td>
                    <td style="text-align: center;">$23.900 / Kg</td>
                    <td style="text-align: right; font-weight: bold; color: #0F172A;">$358.500</td>
                    <td style="color: #334155; font-weight: 600;">En Bodega</td>
                </tr>
                <tr>
                    <td style="text-align: center; font-weight: bold;">3</td>
                    <td style="font-weight: bold; color: #0F172A;">Chorizos cóctel</td>
                    <td style="text-align: center;"><span style="background: #ECFDF5; color: #065F46; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 8px;">BODEGA</span></td>
                    <td style="text-align: center; font-weight: bold; color: #1D4ED8;">80 Unidades</td>
                    <td style="text-align: center;">$1.200 / und</td>
                    <td style="text-align: right; font-weight: bold; color: #0F172A;">$96.000</td>
                    <td style="color: #334155; font-weight: 600;">En Bodega</td>
                </tr>
                <tr style="background: #F1F5F9; font-weight: bold;">
                    <td colspan="5" style="text-align: right; font-weight: 800; font-size: 9.5px;">TOTAL GENERAL ENTRADAS:</td>
                    <td style="text-align: right; font-weight: 800; font-size: 10px; color: #0F172A;">$2.577.852</td>
                    <td style="color: #065F46;">Verificado</td>
                </tr>
            </tbody>
        </table>

        <div class="signatures-grid">
            <div class="sig-card">
                <div class="sig-title">Responsable de Recepción (Bodega)</div>
                <div class="sig-sub">Firma y Cédula</div>
            </div>
            <div class="sig-card">
                <div class="sig-title">Administración / Control de Costeo</div>
                <div class="sig-sub">Firma y Cédula</div>
            </div>
        </div>
    </div>
</div>

</body>
</html>"""

    html_path_ent = "REPORTE_ENTRADAS_NOVEDADES_24_SEP.html"
    with open(html_path_ent, "w", encoding="utf-8") as f:
        f.write(html_ent)

    pdf_target_ent = "DOCUMENTOS BASE/REPORTE_ENTRADAS_NOVEDADES_24_SEP.pdf"
    cmd2 = [
        chrome_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={os.path.abspath(pdf_target_ent)}",
        os.path.abspath(html_path_ent)
    ]
    subprocess.run(cmd2, capture_output=True, text=True)
    print(f"Generado exitosamente: {pdf_target_ent}")

if __name__ == "__main__":
    generate_reports()
