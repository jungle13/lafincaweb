'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { VentaDiaria, PlatoRanking, VentasKPIs } from '@/services/ventasService';
import { downloadVentasResumenPdf } from '@/lib/exportVentasResumenPdf';

interface Props {
  diarias: VentaDiaria[];
  ranking: PlatoRanking[];
  kpis: VentasKPIs;
  periodoNombre?: string;
}

export default function VentasExportButtons({
  diarias,
  ranking,
  kpis,
  periodoNombre = 'Octubre 2026'
}: Props) {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen Diario
      const resumenRows = diarias.map((d) => ({
        Fecha: d.fecha,
        'Día de la Semana': d.dia_semana,
        'Total Artículos (Uds)': d.total_articulos,
        'Platos Distintos': d.total_platos_distintos,
        'Venta Bruta ($)': d.venta_bruta,
        'Descuentos ($)': d.descuento,
        'Venta Neta ($)': d.venta_neta,
        'Impoconsumo 8% ($)': d.impuesto,
        'Gran Total ($)': d.gran_total,
        'Ticket Promedio ($)': d.ticket_promedio
      }));
      const wsDiarias = XLSX.utils.json_to_sheet(resumenRows);
      XLSX.utils.book_append_sheet(wb, wsDiarias, 'Resumen Diario');

      // Hoja 2: Ranking de Menú
      const rankingRows = ranking.map((p, idx) => ({
        '#': idx + 1,
        Código: p.codigo_producto,
        Plato: p.nombre_producto,
        Categoría: p.categoria,
        'Cantidad Total': p.cantidad_total,
        Unidad: p.unidad,
        'Precio Promedio ($)': p.precio_promedio,
        'Venta Neta ($)': p.venta_neta,
        'Total Facturado ($)': p.gran_total,
        '% Part. Menú': `${p.porcentaje_ventas_total.toFixed(2)}%`
      }));
      const wsRanking = XLSX.utils.json_to_sheet(rankingRows);
      XLSX.utils.book_append_sheet(wb, wsRanking, 'Ranking Platos');

      // Hoja 3: KPIs Ejecutivos
      const kpisRows = [
        { Indicador: 'Gran Total Ventas', Valor: kpis.granTotalVentas },
        { Indicador: 'Venta Neta', Valor: kpis.ventaNeta },
        { Indicador: 'Impoconsumo (8%)', Valor: kpis.impuesto },
        { Indicador: 'Descuentos Otorgados', Valor: kpis.descuentos },
        { Indicador: 'Artículos Servidos (Uds)', Valor: kpis.totalArticulos },
        { Indicador: 'Platos en Catálogo', Valor: kpis.totalPlatosUnicos },
        { Indicador: 'Días con Venta', Valor: kpis.totalDias },
        { Indicador: 'Promedio Diario ($)', Valor: kpis.promedioDiario },
        { Indicador: 'Día Récord', Valor: kpis.diaRecord ? `${kpis.diaRecord.fecha} ($${kpis.diaRecord.total.toLocaleString('es-CO')})` : 'N/A' }
      ];
      const wsKPIs = XLSX.utils.json_to_sheet(kpisRows);
      XLSX.utils.book_append_sheet(wb, wsKPIs, 'KPIs Ejecutivos');

      XLSX.writeFile(wb, `Ventas_La_Finca_${periodoNombre.replace(/\s+/g, '_')}.xlsx`);
    } catch (err) {
      console.error('Error exportando Excel:', err);
      alert('Ocurrió un error al generar el archivo Excel.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = () => {
    setExportingPdf(true);
    try {
      downloadVentasResumenPdf({
        diarias,
        kpis,
        periodoNombre,
        reportTitle: 'SALIDAS POR VENTA — RESUMEN DIARIO CONSOLIDADO'
      });
    } catch (err) {
      console.error('Error exportando PDF de Ventas:', err);
      alert('Ocurrió un error al generar el documento PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Botón Exportar PDF Estándar */}
      <button
        type="button"
        onClick={handleExportPdf}
        disabled={exportingPdf || diarias.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
        title="Exportar informe PDF oficial de resumen diario de ventas"
      >
        {exportingPdf ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-slate-300" />
        )}
        <span>Exportar PDF</span>
      </button>

      {/* Botón Exportar Excel */}
      <button
        type="button"
        onClick={handleExportExcel}
        disabled={exportingExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
        title="Descargar reporte completo en Excel"
      >
        {exportingExcel ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5 text-slate-500" />
        )}
        <span>Exportar Excel</span>
      </button>
    </div>
  );
}
