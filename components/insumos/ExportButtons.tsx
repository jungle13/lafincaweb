'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, Printer, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { TransaccionGastoInsumo, InsumosKPIs } from '@/services/insumosCosteoService';
import { formatMoney } from '@/lib/formatters';

interface Props {
  transacciones: TransaccionGastoInsumo[];
  kpis: InsumosKPIs;
  periodoNombre?: string;
  submoduloNombre?: string;
}

export default function ExportButtons({
  transacciones,
  kpis,
  periodoNombre = 'Septiembre 2026',
  submoduloNombre = 'Consolidado General',
}: Props) {
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportExcel = () => {
    setExportingExcel(true);
    try {
      const rows = transacciones.map((t, idx) => ({
        '#': idx + 1,
        'Fecha': t.fecha,
        'Día': t.dia,
        'Categoría': t.categoria,
        'Submódulo': t.submodulo,
        'Tipo Contable': t.tipo_contable === 'COSTO_DIRECTO' ? 'Costo Directo (COGS)' : 'Gasto Operacional (OPEX)',
        'Ítem': t.item,
        'Proveedor': t.proveedor,
        'Factura / Comprobante': t.numero_factura,
        'Cantidad': t.cantidad,
        'Costo Unitario ($)': t.costo_unitario,
        'Valor Total Compra ($)': t.valor_total,
        'Cruce con Cuaderno Don Arturo': t.relacion_cuaderno,
        'Descripción Original (PDF)': t.descripcion_original || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-width de columnas
      const colWidths = [
        { wch: 5 },  // #
        { wch: 12 }, // Fecha
        { wch: 6 },  // Dia
        { wch: 15 }, // Categoria
        { wch: 20 }, // Submodulo
        { wch: 25 }, // Tipo Contable
        { wch: 30 }, // Item
        { wch: 30 }, // Proveedor
        { wch: 20 }, // Factura
        { wch: 12 }, // Cantidad
        { wch: 16 }, // Costo Unitario
        { wch: 20 }, // Valor Total
        { wch: 30 }, // Relacion Cuaderno
        { wch: 45 }, // Descripcion
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalle Compras y Gastos');

      // Hoja de Resumen KPI
      const kpiData = [
        { Concepto: 'Periodo', Valor: periodoNombre },
        { Concepto: 'Submódulo / Filtro', Valor: submoduloNombre },
        { Concepto: 'Total Compras y Egresos ($)', Valor: kpis.totalCostosGastos },
        { Concepto: 'Total Costos Directos ($)', Valor: kpis.totalCostosDirectos },
        { Concepto: '% Costos Directos', Valor: `${kpis.porcentajeCostosDirectos.toFixed(2)}%` },
        { Concepto: 'Total Gastos Operacionales ($)', Valor: kpis.totalGastosOperativos },
        { Concepto: '% Gastos Operacionales', Valor: `${kpis.porcentajeGastosOperativos.toFixed(2)}%` },
        { Concepto: 'Promedio Diario ($)', Valor: kpis.promedioDiario },
        { Concepto: 'Total Transacciones', Valor: kpis.totalTransacciones },
        { Concepto: 'Total Facturas / Comprobantes', Valor: kpis.totalFacturas },
      ];
      const kpiSheet = XLSX.utils.json_to_sheet(kpiData);
      XLSX.utils.book_append_sheet(workbook, kpiSheet, 'Resumen Gerencial');

      const safeFilename = `La_Finca_Insumos_Costos_${periodoNombre.replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(workbook, safeFilename);
    } catch (err: any) {
      console.error('Error exportando a Excel:', err);
      alert('Error al generar archivo Excel: ' + err.message);
    } finally {
      setExportingExcel(false);
    }
  };

  const handlePrintPDF = () => {
    // Generar ventana imprimible limpia
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte de Insumos, Costos y Gastos - La Finca</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #1e293b; font-size: 11px; }
            h1 { font-size: 18px; margin: 0 0 4px 0; color: #0f172a; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
            .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .kpi-card { border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background: #f8fafc; }
            .kpi-title { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }
            .kpi-val { font-size: 15px; font-weight: 700; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
            th { background: #f1f5f9; text-align: left; padding: 6px 8px; border-bottom: 1px solid #cbd5e1; color: #475569; font-weight: 600; }
            td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #fcfcfc; }
            .text-right { text-align: right; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
            .badge-costo { background: #dcfce7; color: #166534; }
            .badge-gasto { background: #fef3c7; color: #92400e; }
            .badge-cruza { background: #e0e7ff; color: #3730a3; }
            .badge-nocruza { background: #f1f5f9; color: #64748b; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>RESTAURANTE LA FINCA CHOCLOS Y ASADOS</h1>
              <p style="margin: 0; color: #64748b;">Informe Detallado de Insumos, Costos y Gastos &bull; <strong>${periodoNombre}</strong> (${submoduloNombre})</p>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              <p style="margin: 0;">Generado: ${new Date().toLocaleString('es-CO')}</p>
              <p style="margin: 0;">Total transacciones: ${transacciones.length}</p>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi-card">
              <div class="kpi-title">Total Egresos Mes</div>
              <div class="kpi-val">$ ${formatMoney(kpis.totalCostosGastos)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Costos Directos (COGS)</div>
              <div class="kpi-val" style="color: #166534;">$ ${formatMoney(kpis.totalCostosDirectos)} (${kpis.porcentajeCostosDirectos.toFixed(1)}%)</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Gastos Operacionales (OPEX)</div>
              <div class="kpi-val" style="color: #92400e;">$ ${formatMoney(kpis.totalGastosOperativos)} (${kpis.porcentajeGastosOperativos.toFixed(1)}%)</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Promedio Diario</div>
              <div class="kpi-val">$ ${formatMoney(kpis.promedioDiario)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25px;">#</th>
                <th style="width: 65px;">Fecha</th>
                <th>Ítem / Descripción</th>
                <th>Proveedor</th>
                <th>Factura</th>
                <th>Tipo</th>
                <th class="text-right">Cantidad</th>
                <th class="text-right">Unitario ($)</th>
                <th class="text-right">Total ($)</th>
                <th>Auditoría Cuaderno</th>
              </tr>
            </thead>
            <tbody>
              ${transacciones.map((t, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${t.fecha}</td>
                  <td>
                    <strong>${t.item}</strong>
                    <div style="font-size: 9px; color: #64748b;">${t.categoria} &bull; ${t.descripcion_original || ''}</div>
                  </td>
                  <td>${t.proveedor}</td>
                  <td><code>${t.numero_factura}</code></td>
                  <td>
                    <span class="badge ${t.tipo_contable === 'COSTO_DIRECTO' ? 'badge-costo' : 'badge-gasto'}">
                      ${t.tipo_contable === 'COSTO_DIRECTO' ? 'Costo Directo' : 'Gasto Operativo'}
                    </span>
                  </td>
                  <td class="text-right">${t.cantidad > 0 ? t.cantidad : '-'}</td>
                  <td class="text-right">${t.costo_unitario > 0 ? '$ ' + formatMoney(t.costo_unitario) : '-'}</td>
                  <td class="text-right" style="font-weight: 600;">$ ${formatMoney(t.valor_total)}</td>
                  <td>
                    <span class="badge ${t.relacion_cuaderno.includes('Cruza con Cuaderno') ? 'badge-cruza' : 'badge-nocruza'}">
                      ${t.relacion_cuaderno.includes('Cruza con Cuaderno') ? '✓ Cruza Cuaderno' : 'No cruza'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExportExcel}
        disabled={exportingExcel || transacciones.length === 0}
        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        title="Descargar archivo Excel .xlsx con todas las transacciones filtradas"
      >
        {exportingExcel ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
        ) : (
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
        )}
        <span>Exportar Excel</span>
      </button>

      <button
        type="button"
        onClick={handlePrintPDF}
        disabled={transacciones.length === 0}
        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        title="Imprimir reporte formal o guardar en PDF"
      >
        <Printer className="w-3.5 h-3.5 text-slate-500" />
        <span>Imprimir / PDF</span>
      </button>
    </div>
  );
}
