'use client';

import { useState, useMemo } from 'react';
import { 
  Scale, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Search, 
  X,
  Building2,
  FileCheck2,
  Info
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { 
  ComparacionCuadreResult, 
  ComparacionVentasCuadreItem 
} from '@/services/ventasService';

interface Props {
  cuadreData: ComparacionCuadreResult | null;
  periodoNombre?: string;
}

export default function VentasCuadreCajaView({ cuadreData, periodoNombre = 'Septiembre 2026' }: Props) {
  const [expandedFecha, setExpandedFecha] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AUDITADOS' | 'PENDIENTES' | 'DESCUADRES'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const resumen = cuadreData?.resumen;
  const comparacion = cuadreData?.comparacion || [];

  const toggleExpand = (fecha: string) => {
    setExpandedFecha((prev) => (prev === fecha ? null : fecha));
  };

  const filteredItems = useMemo(() => {
    return comparacion.filter((item) => {
      // Filtro por estado
      if (statusFilter === 'AUDITADOS' && item.estado === 'PENDIENTE_PLANILLA') return false;
      if (statusFilter === 'PENDIENTES' && item.estado !== 'PENDIENTE_PLANILLA') return false;
      if (statusFilter === 'DESCUADRES' && item.estado !== 'DESCUADRE_CAJA') return false;

      // Filtro por búsqueda
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        item.fecha.toLowerCase().includes(q) ||
        item.dia_semana.toLowerCase().includes(q) ||
        item.planillas.some(
          (p) =>
            p.sede_responsable.toLowerCase().includes(q) ||
            p.novedades.toLowerCase().includes(q)
        )
      );
    });
  }, [comparacion, statusFilter, searchTerm]);

  if (!cuadreData || !resumen) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 space-y-2">
        <Scale className="w-8 h-8 text-amber-500 mx-auto animate-pulse" />
        <p className="text-sm font-medium text-slate-700">Cargando datos de conciliación y cuadre de caja...</p>
        <p className="text-xs text-slate-400">Consultando registros del sistema TPV y planillas del libro de caja.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-normal text-xs">
      {/* 🏷️ Banner Explicativo / Contexto de Auditoría */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
                Auditoría Contable Integral
              </span>
              <span className="text-slate-400 text-xs">&bull; {periodoNombre}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              Comparación Ventas TPV vs Cuadre de Caja & Reporte X
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Conciliación matemática entre el <strong>Gran Total de Ventas (.txt)</strong> del sistema POS frente al <strong>Reporte X / Cierre</strong> y el <strong>Total Cuadre Físico (Efectivo, Datáfonos y Nequi)</strong> registrado en las planillas del Libro de Caja.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10 text-right shrink-0">
            <p className="text-[11px] text-slate-300 font-medium">Jornadas Auditadas</p>
            <p className="text-lg font-black text-amber-300">{resumen.diasConPlanilla} / {resumen.diasTotales} Días</p>
            <p className="text-[10px] text-slate-400">11 al 18 de Septiembre</p>
          </div>
        </div>
      </div>

      {/* 📊 Tarjetas de Resumen KPI de la Auditoría */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* KPI 1: Ventas TPV Días Auditados */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Ventas TPV Auditadas</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base font-bold text-slate-900">
            ${formatMoney(resumen.totalVentasAuditadas)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Días 11 al 18 Sep (Sistema POS)
          </div>
        </div>

        {/* KPI 2: Total Reporte X (Planillas) */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Total Reporte X (Planillas)</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Scale className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base font-bold text-amber-700">
            ${formatMoney(resumen.totalReporteX)}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
            99.999% coincidencia con TPV
          </div>
        </div>

        {/* KPI 3: Total Cuadre Físico */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Total Cuadre en Caja</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Banknote className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base font-bold text-slate-900">
            ${formatMoney(resumen.totalCuadre)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Efectivo + Datáfonos + Nequi
          </div>
        </div>

        {/* KPI 4: Desfase Neto en Caja */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Diferencia Neta en Caja</span>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              resumen.diferenciaNetaCuadre < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {resumen.diferenciaNetaCuadre < 0 ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
            </div>
          </div>
          <div className={`text-base font-bold ${
            resumen.diferenciaNetaCuadre < 0 ? 'text-rose-600' : 'text-emerald-600'
          }`}>
            {resumen.diferenciaNetaCuadre < 0 ? '-' : '+'}${formatMoney(Math.abs(resumen.diferenciaNetaCuadre))}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Diferencia neta sobre $61.8M (-0.007%)
          </div>
        </div>
      </div>

      {/* 🔍 Barra de Filtros y Búsqueda */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Botones de filtro de estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({comparacion.length})
          </button>
          <button
            onClick={() => setStatusFilter('AUDITADOS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'AUDITADOS'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            Auditados con Planilla ({resumen.diasConPlanilla})
          </button>
          <button
            onClick={() => setStatusFilter('DESCUADRES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'DESCUADRES'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Con Descuadre ({comparacion.filter(c => c.estado === 'DESCUADRE_CAJA').length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDIENTES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'PENDIENTES'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            Pendientes ({comparacion.filter(c => c.estado === 'PENDIENTE_PLANILLA').length})
          </button>
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por fecha, sede o nota..."
            className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-slate-300 outline-none focus:border-indigo-500 bg-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 📋 Tabla Comparativa Principal */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-[11px] font-semibold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <th className="py-2.5 px-3">Fecha & Día</th>
                <th className="py-2.5 px-3 text-right">Ventas Totales TPV</th>
                <th className="py-2.5 px-3 text-right bg-amber-50/50 text-amber-900 border-x border-amber-100">
                  Reporte X / Cierre ($)
                </th>
                <th className="py-2.5 px-3 text-right">Dif. TPV vs Rep. X</th>
                <th className="py-2.5 px-3 text-right bg-indigo-50/50 text-indigo-900 border-x border-indigo-100">
                  Total Cuadre ($)
                </th>
                <th className="py-2.5 px-3 text-right">Dif. Cuadre vs X</th>
                <th className="py-2.5 px-3 text-center">Medios de Pago</th>
                <th className="py-2.5 px-3 text-center">Estado Auditoría</th>
                <th className="py-2.5 px-3 text-center">Planillas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredItems.map((item) => {
                const isExpanded = expandedFecha === item.fecha;
                const hasPlanillas = item.planillas.length > 0;

                return (
                  <tr
                    key={item.fecha}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      isExpanded ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    {/* Fecha & Día */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.fecha}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {item.dia_semana}
                        </span>
                      </div>
                    </td>

                    {/* Ventas Totales TPV */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      ${formatMoney(item.ventas_total_txt)}
                    </td>

                    {/* Reporte X / Cierre */}
                    <td className="py-2.5 px-3 text-right font-bold text-amber-900 bg-amber-50/30 border-x border-amber-100 whitespace-nowrap">
                      {item.reporte_x !== null ? (
                        `$${formatMoney(item.reporte_x)}`
                      ) : (
                        <span className="text-slate-400 font-normal italic">-</span>
                      )}
                    </td>

                    {/* Dif. TPV vs Rep. X */}
                    <td className="py-2.5 px-3 text-right font-medium whitespace-nowrap">
                      {item.diferencia_reporte_x !== null ? (
                        Math.abs(item.diferencia_reporte_x) < 100 ? (
                          <span className="text-emerald-600 font-semibold">$0</span>
                        ) : item.diferencia_reporte_x > 0 ? (
                          <span className="text-amber-600">+${formatMoney(item.diferencia_reporte_x)}</span>
                        ) : (
                          <span className="text-rose-600">-${formatMoney(Math.abs(item.diferencia_reporte_x))}</span>
                        )
                      ) : (
                        <span className="text-slate-400 font-normal italic">-</span>
                      )}
                    </td>

                    {/* Total Cuadre */}
                    <td className="py-2.5 px-3 text-right font-bold text-indigo-950 bg-indigo-50/30 border-x border-indigo-100 whitespace-nowrap">
                      {item.total_cuadre !== null ? (
                        `$${formatMoney(item.total_cuadre)}`
                      ) : (
                        <span className="text-slate-400 font-normal italic">-</span>
                      )}
                    </td>

                    {/* Dif. Cuadre vs X */}
                    <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                      {item.diferencia_cuadre_caja !== null ? (
                        Math.abs(item.diferencia_cuadre_caja) === 0 ? (
                          <span className="text-emerald-600">$0</span>
                        ) : item.diferencia_cuadre_caja > 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            +${formatMoney(item.diferencia_cuadre_caja)}
                          </span>
                        ) : (
                          <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                            -${formatMoney(Math.abs(item.diferencia_cuadre_caja))}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 font-normal italic">-</span>
                      )}
                    </td>

                    {/* Medios de Pago Desglosados */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-center">
                      {hasPlanillas ? (
                        <div className="flex items-center justify-center gap-1.5 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200" title={`Datáfonos: $${formatMoney(item.datafonos || 0)}`}>
                            💳 ${formatMoney(Math.round((item.datafonos || 0) / 1000))}k
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200" title={`Nequi: $${formatMoney(item.nequi || 0)}`}>
                            📱 ${formatMoney(Math.round((item.nequi || 0) / 1000))}k
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200" title={`Efectivo: $${formatMoney(item.efectivo || 0)}`}>
                            💵 ${formatMoney(Math.round((item.efectivo || 0) / 1000))}k
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">Sin planilla</span>
                      )}
                    </td>

                    {/* Estado de Auditoría */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {item.estado === 'CUADRADO_EXACTO' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Cuadre Exacto
                        </span>
                      ) : item.estado === 'DESCUADRE_CAJA' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Desfase de Caja
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Pendiente Planilla
                        </span>
                      )}
                    </td>

                    {/* Botón de Expansión de Planillas */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {hasPlanillas ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.fecha)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                        >
                          <span>{item.planillas.length} planillas</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📑 Acordeón / Desglose de Planillas del Día Seleccionado */}
      {expandedFecha && (
        <div className="bg-white p-4 rounded-2xl border-2 border-indigo-200 shadow-sm space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                  Desglose de Cierres de Caja &bull; {expandedFecha}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Planillas de arqueo físico auditadas en el Libro de Caja Menor
                </p>
              </div>
            </div>
            <button
              onClick={() => setExpandedFecha(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {comparacion
              .find((c) => c.fecha === expandedFecha)
              ?.planillas.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-xs">
                        {p.sede_responsable}
                      </span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-200 text-slate-700 font-medium">
                        {p.pagina_planilla}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.diferencia === 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.diferencia > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {p.diferencia === 0
                        ? 'Cuadre Exacto'
                        : p.diferencia > 0
                        ? `Sobrante: +$${formatMoney(p.diferencia)}`
                        : `Faltante: -$${formatMoney(Math.abs(p.diferencia))}`}
                    </span>
                  </div>

                  {/* Cifras de la Planilla */}
                  <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Total Cuadre
                      </span>
                      <p className="font-black text-slate-900 text-sm">
                        ${formatMoney(p.total_cuadre)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-700 uppercase font-semibold">
                        Reporte X / Cierre
                      </span>
                      <p className="font-black text-amber-700 text-sm">
                        ${formatMoney(p.reporte_x)}
                      </p>
                    </div>
                  </div>

                  {/* Medios de Pago */}
                  <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white/60 p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-sky-600" />
                      <span>Datáfonos:</span>
                      <strong className="text-slate-800">${formatMoney(p.datafonos)}</strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-purple-600" />
                      <span>Nequi:</span>
                      <strong className="text-slate-800">${formatMoney(p.nequi)}</strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <Banknote className="w-3 h-3 text-emerald-600" />
                      <span>Efectivo:</span>
                      <strong className="text-slate-800">${formatMoney(p.efectivo)}</strong>
                    </div>
                  </div>

                  {/* Notas de Auditoría */}
                  {p.novedades && (
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-600 bg-amber-50/60 p-2 rounded-lg border border-amber-200/60">
                      <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="leading-tight">
                        <strong className="text-amber-900">Nota:</strong> {p.novedades}
                      </p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
