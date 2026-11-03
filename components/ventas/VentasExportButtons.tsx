'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  Loader2, 
  SlidersHorizontal, 
  ChevronDown 
} from 'lucide-react';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExportExcel = async () => {
    setDropdownOpen(false);
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
        'Cantidad Vendida': p.cantidad_total,
        Unidad: p.unidad,
        'Precio Promedio ($)': p.precio_promedio,
        'Venta Neta ($)': p.venta_neta,
        'Total Facturado ($)': p.gran_total,
        'Participación Total': `${p.porcentaje_ventas_total.toFixed(2)}%`,
        'Días con Ventas': p.dias_con_ventas
      }));
      const wsRanking = XLSX.utils.json_to_sheet(rankingRows);
      XLSX.utils.book_append_sheet(wb, wsRanking, 'Ranking Menú');

      // Hoja 3: KPIs Consolidados
      const kpisRows = [
        { Métrica: 'Período', Valor: periodoNombre },
        { Métrica: 'Gran Total Ventas (Facturado)', Valor: kpis.granTotalVentas },
        { Métrica: 'Venta Neta', Valor: kpis.ventaNeta },
        { Métrica: 'Impoconsumo (8%)', Valor: kpis.impuesto },
        { Métrica: 'Descuentos Totales', Valor: kpis.descuentos },
        { Métrica: 'Total Artículos Vendidos', Valor: kpis.totalArticulos },
        { Métrica: 'Días Operativos Registrados', Valor: kpis.totalDias },
        { Métrica: 'Promedio Diario Facturado', Valor: kpis.promedioDiario },
        {
          Métrica: 'Día Récord en Ventas',
          Valor: kpis.diaRecord
            ? `${kpis.diaRecord.fecha} (${kpis.diaRecord.diaSemana}): $${kpis.diaRecord.total.toLocaleString('es-CO')}`
            : 'N/A'
        },
        { Métrica: 'Total Platos Únicos en Carta', Valor: kpis.totalPlatosUnicos }
      ];
      const wsKpis = XLSX.utils.json_to_sheet(kpisRows);
      XLSX.utils.book_append_sheet(wb, wsKpis, 'KPIs Consolidados');

      const fileName = `VENTAS_LA_FINCA_${periodoNombre.replace(/\s+/g, '_').toUpperCase()}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Error exportando Excel de Ventas:', err);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = () => {
    setDropdownOpen(false);
    setExportingPdf(true);
    try {
      downloadVentasResumenPdf({
        diarias,
        kpis,
        periodoNombre,
        reportTitle: 'SALIDAS POR VENTAS — INFORME MENSUAL CONSOLIDADO'
      });
    } catch (err) {
      console.error('Error exportando PDF de Ventas:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={exportingPdf || exportingExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
        title="Menú de utilidades y exportación"
      >
        {exportingPdf || exportingExcel ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
        ) : (
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
        )}
        <span>Utilidades</span>
        <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
      </button>

      {/* Menú Desplegable */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 animate-in fade-in duration-100">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-0.5">
            Exportación de Datos
          </div>

          {/* Opción PDF */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={diarias.length === 0}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer disabled:opacity-40"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800">Exportar PDF</div>
              <div className="text-[10px] text-slate-500">Resumen institucional (1 hoja)</div>
            </div>
          </button>

          {/* Opción Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={diarias.length === 0}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800">Exportar Excel</div>
              <div className="text-[10px] text-slate-500">Libro consolidado (3 hojas)</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
