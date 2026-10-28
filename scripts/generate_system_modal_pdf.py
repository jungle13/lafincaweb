import os
import subprocess
import json

def generate_pdf():
    items = [
        # (Carne/Insumo, Gramaje, Ubic, Entero Kg, Porc Und, Porc Kg, Total Kg, Costo Unit, Valor, Obs)
        ("Papas a la francesa", "1000g / porción", "BODEGA", 0.0, 12, 12.0, 12.0, 6269, 75228, "12 paquetes (12.0 Kg)"),
        ("Tocino (Chicharrón)", "394g / porción", "BODEGA", 0.0, 145, 57.13, 57.13, 21900, 1251147, "121 en bandeja + 24 reserva"),
        ("Mix de verduras", "1000g / porción", "BODEGA", 0.0, 10, 10.0, 10.0, 8487, 84870, "10 paquetes acompañamiento"),
        ("Pescado bagre (Alguacil)", "222g / porción", "BODEGA", 0.0, 42, 9.32, 9.32, 14000, 130480, "42 porciones listas en cava"),
        ("Muslos de pollo", "278g / porción", "BODEGA", 0.0, 80, 22.24, 22.24, 15000, 333600, "80 porciones muslos"),
        ("Costilla San Luis", "500g / porción", "BODEGA", 20.0, 20, 10.0, 30.0, 21900, 657000, "20 kg entero + 20 porciones"),
        ("Carne asada (Corte fino)", "105g / porción", "BODEGA", 0.0, 30, 3.15, 3.15, 25900, 81585, "30 porciones porcionadas"),
        ("Lomo de cerdo", "222g / porción", "BODEGA", 0.0, 2, 0.44, 0.44, 19500, 8580, "2 porciones remanentes"),
        ("Sobrebarriga delgada", "Entero en cava", "BODEGA", 19.5, 0, 0.0, 19.5, 30000, 585000, "Inventario Eliana (19.50 Kg)"),
        ("Lengua de res", "Lote agotado", "BODEGA", 0.0, 0, 0.0, 0.0, 23900, 0, "Inventario Eliana: Dejamos las mismas (Lote agotado)"),
        ("Baby beef", "400g / porción", "BODEGA", 0.0, 5, 2.0, 2.0, 53000, 106000, "5 porciones finas"),
        ("Costilla de cerdo especial", "Bloque tamalero", "BODEGA", 27.0, 0, 0.0, 27.0, 14900, 402300, "Costilla tamalera 27 kg"),
        ("Tocineta barril", "Cava refrigeración", "BODEGA", 89.0, 0, 0.0, 89.0, 17000, 1513000, "Inventario Eliana (89.00 Kg)"),
        ("Panceta de cerdo", "Bloque en cava", "BODEGA", 32.0, 0, 0.0, 32.0, 21900, 700800, "32.0 kg entero en cava"),
        ("Camarón precocido", "Congelador mariscos", "BODEGA", 7.9, 0, 0.0, 7.9, 22900, 180910, "7.9 kg en congelador"),
        ("Lomo viche especial", "Refrigerado fino", "BODEGA", 2.7, 0, 0.0, 2.7, 53000, 143100, "2.7 kg refrigerado"),
        ("Costilla ahumada", "Bloque ahumado", "BODEGA", 4.0, 0, 0.0, 4.0, 24000, 96000, "4.0 kg bloque entero"),
        ("Tilapia roja 350/450", "333g / unidad", "BODEGA", 0.0, 26, 8.66, 8.66, 17808, 154217, "26 tilapias enteras"),
        ("Trucha arcoíris", "250g / unidad", "BODEGA", 0.0, 10, 2.5, 2.5, 22000, 55000, "10 truchas congelador"),
        ("Salmón filete", "200g / porción", "BODEGA", 0.0, 5, 1.0, 1.0, 55000, 55000, "5 porciones salmón"),
        ("Punta de anca", "222g / porción", "BODEGA", 0.0, 57, 12.65, 12.65, 44000, 556600, "57 porciones parrilla"),
        ("Churrasco", "250g / porción", "BODEGA", 0.0, 45, 11.25, 11.25, 44000, 495000, "45 porciones parrilla"),
        ("Rellena campesina", "Embutido artesanal", "BODEGA", 3.2, 0, 0.0, 3.2, 19500, 62400, "3.2 kg embutido"),
        ("Sobaco de res", "Cava desposte", "BODEGA", 24.0, 0, 0.0, 24.0, 25900, 621600, "Inventario Eliana (24.00 Kg)"),
    ]

    total_entero = sum(x[3] for x in items)
    total_und = sum(x[4] for x in items)
    total_kg = sum(x[6] for x in items)
    total_valor = sum(x[8] for x in items)

    def format_money(val):
        return f"{val:,.0f}".replace(",", ".")

    rows_html = ""
    for idx, item in enumerate(items):
        nombre, gramaje, ubic, entero, porc_und, porc_kg, tot_kg, costo, valor, obs = item
        is_eliana = "Inventario Eliana" in obs

        entero_str = f"{entero:.2f} Kg" if entero > 0 else '<span class="text-slate-300">0.00</span>'
        
        if porc_und > 0:
            porc_str = f'<span class="text-purple-700 font-semibold">{porc_und} und</span> <span class="text-slate-400 text-[8px]">({porc_kg:.2f}k)</span>'
        else:
            porc_str = '<span class="text-slate-300">0</span>'

        tot_kg_str = f"{tot_kg:.2f} Kg"
        costo_str = f"${format_money(costo)}"
        valor_str = f"${format_money(valor)}"

        eliana_tag = ""
        if is_eliana:
            eliana_tag = f'<span class="eliana-badge">Inventario Eliana</span> {obs.replace("Inventario Eliana", "").replace(":", "").strip()}'
        else:
            eliana_tag = f'<span class="text-slate-500">{obs}</span>'

        bg_class = "row-eliana" if is_eliana else ("row-even" if idx % 2 == 1 else "row-odd")

        rows_html += f"""
        <tr class="{bg_class}">
            <td class="col-insumo">
                <div class="font-bold text-slate-900">{nombre}</div>
                <div class="text-[8px] text-slate-500">{gramaje}</div>
            </td>
            <td class="col-ubic">
                <span class="badge-ubic">BODEGA</span>
            </td>
            <td class="col-entero">{entero_str}</td>
            <td class="col-porc">{porc_str}</td>
            <td class="col-total-kg">{tot_kg_str}</td>
            <td class="col-costo">
                <div class="font-semibold text-slate-800">{costo_str}</div>
                <div class="text-[7.5px] text-slate-400">/ Kg</div>
            </td>
            <td class="col-valor">{valor_str}</td>
            <td class="col-obs">{eliana_tag}</td>
        </tr>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte Oficial de Conteo Físico e Inventario - Sistema La Finca</title>
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
            background-color: #F8FAFC;
            margin: 0;
            padding: 4px;
            color: #0F172A;
            font-size: 8px;
        }}
        .modal-wrapper {{
            background: #FFFFFF;
            border: 1px solid #CBD5E1;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            overflow: hidden;
            max-width: 100%;
            margin: 0 auto;
        }}
        /* Modal Window Title Bar (Exact UI Look) */
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
            font-weight: 400;
            line-height: 1;
        }}
        
        .modal-body {{
            padding: 8px 12px 6px 12px;
        }}

        /* Document Header */
        .doc-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0F172A;
            padding-bottom: 4px;
            margin-bottom: 6px;
        }}
        .doc-title-main {{
            font-size: 11.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.3px;
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

        /* KPI Cards Grid */
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

        /* Data Table */
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
            padding: 2.5px 4px;
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
            padding: 1.8px 4px;
            border-right: 1px solid #E2E8F0;
            border-bottom: 1px solid #E2E8F0;
            vertical-align: middle;
            line-height: 1.1;
        }}
        td:last-child, th:last-child {{
            border-right: none;
        }}

        .row-even {{ background-color: #FFFFFF; }}
        .row-odd {{ background-color: #F8FAFC; }}
        .row-eliana {{ background-color: #F0FDF4; }}

        .col-insumo {{ width: 18%; }}
        .col-ubic {{ width: 6%; text-align: center; }}
        .col-entero {{ width: 9%; text-align: center; font-weight: 600; color: #1D4ED8; }}
        .col-porc {{ width: 11%; text-align: center; }}
        .col-total-kg {{ width: 8.5%; text-align: center; font-weight: 800; background-color: rgba(239, 246, 255, 0.7); }}
        .col-costo {{ width: 8.5%; text-align: center; }}
        .col-valor {{ width: 10%; text-align: right; font-weight: 800; background-color: #F8FAFC; }}
        .col-obs {{ width: 29%; }}

        .badge-ubic {{
            display: inline-block;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 6.8px;
            font-weight: 700;
            background-color: #EFF6FF;
            color: #1E40AF;
            border: 1px solid #BFDBFE;
        }}
        .eliana-badge {{
            display: inline-block;
            padding: 0.5px 3px;
            border-radius: 3px;
            font-size: 6.8px;
            font-weight: 800;
            background-color: #DCFCE7;
            color: #166534;
            border: 1px solid #86EFAC;
        }}

        /* Table Totals Row */
        .tr-total td {{
            background-color: #F1F5F9;
            font-weight: 800;
            font-size: 7.2px;
            border-top: 1.5px solid #0F172A;
            border-bottom: none;
            padding: 2.5px 4px;
        }}

        /* Signatures Block */
        .signatures-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 6px;
            padding: 0 60px;
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

        /* System Download Identifier Footer */
        .system-footer {{
            margin-top: 4px;
            padding-top: 2px;
            border-top: 1px dashed #CBD5E1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 6.5px;
            color: #64748B;
        }}
        .system-pill {{
            background: #E2E8F0;
            color: #334155;
            padding: 1px 4px;
            border-radius: 2px;
            font-weight: 600;
        }}
    </style>
</head>
<body>

<div class="modal-wrapper">
    <!-- Ventana del Modal del Sistema -->
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
        <!-- Cabecera Oficial del Reporte -->
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

        <!-- KPIs Resumen del Conteo -->
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

        <!-- Tabla Maestra de Conteo Físico -->
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
                    <th class="th-left">Observaciones de Conteo / Inventario Eliana</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
                <tr class="tr-total">
                    <td class="font-bold">TOTAL GENERAL (24 ÍTEMS)</td>
                    <td style="text-align: center;">BODEGA</td>
                    <td style="text-align: center;">{total_entero:.2f} Kg</td>
                    <td style="text-align: center;">{total_und} und</td>
                    <td style="text-align: center; color: #1D4ED8;">{total_kg:.2f} Kg</td>
                    <td style="text-align: center;">-</td>
                    <td style="text-align: right; color: #020617;">${format_money(total_valor)}</td>
                    <td style="color: #166534; font-weight: 700;">Conciliación 100% Auditada</td>
                </tr>
            </tbody>
        </table>

        <!-- Firmas Oficiales de Auditoría -->
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

        <!-- Pie de Página Institucional del Sistema -->
        <div class="system-footer">
            <div>
                <span class="system-pill">SISTEMA LA FINCA</span>
                <span>Documento oficial emitido y descargado de la plataforma de Control de Bodega & Costeo</span>
            </div>
            <div>
                <span>ID Certificación: <strong>LF-20260924-AUDIT-ELIANA</strong> • Hash SHA: e7b8f9a21</span>
            </div>
        </div>
    </div>
</div>

</body>
</html>"""

    html_file = "ACTA_CONTEO_FISICO_SYSTEM_VIEW.html"
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"HTML generado: {html_file}")

    # Lista de archivos de destino
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

    print("Ejecutando Chrome headless para renderizar PDF idéntico al sistema...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(first_pdf):
        print(f"PDF principal generado con éxito ({os.path.getsize(first_pdf)} bytes)")
        with open(first_pdf, "rb") as rf:
            pdf_bytes = rf.read()

        for target in pdf_targets:
            os.makedirs(os.path.dirname(target) if os.path.dirname(target) else ".", exist_ok=True)
            with open(target, "wb") as wf:
                wf.write(pdf_bytes)
            print(f"  -> Sincronizado en: {target}")
    else:
        print("Error generando PDF con Chrome:", res.stderr)

if __name__ == "__main__":
    generate_pdf()
