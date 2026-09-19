'use client';

import { useState } from 'react';
import { Download, Printer, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { VentaDiaria, PlatoRanking, VentasKPIs } from '@/services/ventasService';

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
  periodoNombre = 'Septiembre 2026'
}: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
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
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExportExcel}
        disabled={exporting}
        className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        title="Descargar reporte completo en Excel"
      >
        {exporting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5 text-emerald-600" />
        )}
        <span>Exportar Excel</span>
      </button>

      <button
        type="button"
        onClick={handlePrint}
        className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
        title="Imprimir o guardar en PDF"
      >
        <Printer className="w-3.5 h-3.5 text-slate-500" />
        <span>Imprimir / PDF</span>
      </button>
    </div>
  );
}
