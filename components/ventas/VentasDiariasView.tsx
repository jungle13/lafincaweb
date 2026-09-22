'use client';

import { useState } from 'react';
import { 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Flame, 
  Sparkles, 
  Clock, 
  Utensils, 
  Receipt,
  FileText,
  Search,
  X
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { VentaDiaria, VentaDetalle } from '@/services/ventasService';

interface Props {
  diarias: VentaDiaria[];
  periodoId: string;
}

export default function VentasDiariasView({ diarias, periodoId }: Props) {
  const [expandedFecha, setExpandedFecha] = useState<string | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [detalleDia, setDetalleDia] = useState<VentaDetalle[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  const toggleExpand = async (fecha: string) => {
    if (expandedFecha === fecha) {
      setExpandedFecha(null);
      setDetalleDia([]);
      return;
    }

    setExpandedFecha(fecha);
    setLoadingDetalle(true);
    try {
      const res = await fetch(`/api/ventas?periodo_id=${periodoId}&view=TRANSACCIONES&fecha=${fecha}&pageSize=200`);
      const json = await res.json();
      if (json.success && json.transacciones) {
        setDetalleDia(json.transacciones);
      }
    } catch (e) {
      console.error('Error cargando detalle del día:', e);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const filteredDiarias = (diarias || []).filter((d) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (d.fecha || '').includes(q) || (d.dia_semana || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3 font-normal text-xs">
      {/* Barra de Filtro de Días */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-xs">Resumen Diario de Ventas</h3>
            <p className="text-[11px] text-slate-500">{diarias?.length || 0} días del periodo Septiembre 2026</p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Buscar por fecha o día..."
            className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-slate-300 outline-none focus:border-emerald-500 bg-white"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Días */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <th className="py-2.5 px-3">Fecha & Día</th>
                <th className="py-2.5 px-3 text-center">Artículos</th>
                <th className="py-2.5 px-3 text-center">Variedad</th>
                <th className="py-2.5 px-3 text-right">Venta Bruta</th>
                <th className="py-2.5 px-3 text-right">Descuentos</th>
                <th className="py-2.5 px-3 text-right">Venta Neta</th>
                <th className="py-2.5 px-3 text-right">Impoconsumo (8%)</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900">Gran Total</th>
                <th className="py-2.5 px-3 text-right">Ticket Prom.</th>
                <th className="py-2.5 px-3 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredDiarias.map((d) => {
                const isFinDeSemana = d.dia_semana === 'Sábado' || d.dia_semana === 'Domingo';
                const isRecord = d.gran_total >= 20000000;
                const isExpanded = expandedFecha === d.fecha;

                return (
                  <tr
                    key={d.id || d.fecha}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isExpanded ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    {/* Fecha & Día */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{d.fecha}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            isRecord
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5'
                              : isFinDeSemana
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isRecord && <Flame className="w-2.5 h-2.5 text-amber-600" />}
                          {d.dia_semana}
                        </span>
                      </div>
                    </td>

                    {/* Total Artículos */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap font-medium text-slate-800">
                      {formatMoney(d.total_articulos)} <span className="text-[10px] text-slate-400">uds</span>
                    </td>

                    {/* Platos Distintos */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap text-slate-600">
                      {d.total_platos_distintos} ítems
                    </td>

                    {/* Venta Bruta */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-slate-600">
                      $ {formatMoney(d.venta_bruta)}
                    </td>

                    {/* Descuentos */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-red-600 font-medium">
                      {d.descuento > 0 ? `-$ ${formatMoney(d.descuento)}` : '$ 0'}
                    </td>

                    {/* Venta Neta */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium text-blue-700">
                      $ {formatMoney(d.venta_neta)}
                    </td>

                    {/* Impoconsumo */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-amber-700">
                      $ {formatMoney(d.impuesto)}
                    </td>

                    {/* Gran Total */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-slate-900 text-sm">
                      $ {formatMoney(d.gran_total)}
                    </td>

                    {/* Ticket Promedio */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-slate-500 text-[11px]">
                      $ {formatMoney(d.ticket_promedio)}
                    </td>

                    {/* Botón Ver Platos */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleExpand(d.fecha)}
                        className={`p-1.5 rounded-lg border text-[11px] font-medium transition-all flex items-center gap-1 mx-auto cursor-pointer ${
                          isExpanded
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{isExpanded ? 'Cerrar' : 'Ver Platos'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acordeón de Detalle Desplegado */}
      {expandedFecha && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm animate-fade-in space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <Utensils className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Desglose de Platos Servidos &bull; {expandedFecha}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {detalleDia.length} productos facturados en esta jornada
                </p>
              </div>
            </div>

            <button
              onClick={() => setExpandedFecha(null)}
              className="text-xs text-slate-400 hover:text-slate-700 font-medium cursor-pointer"
            >
              Cerrar Desglose ✕
            </button>
          </div>

          {loadingDetalle ? (
            <div className="py-8 text-center text-slate-400 text-xs font-medium animate-pulse">
              Cargando detalle de platos de la fecha...
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 sticky top-0">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Plato / Producto</th>
                    <th className="py-2 px-3">Categoría</th>
                    <th className="py-2 px-3 text-center">Cantidad</th>
                    <th className="py-2 px-3 text-right">Venta Neta</th>
                    <th className="py-2 px-3 text-right">Impuesto</th>
                    <th className="py-2 px-3 text-right font-bold text-slate-900">Total</th>
                    <th className="py-2 px-3 text-right">P. Unitario</th>
                    <th className="py-2 px-3 text-center">% Jornada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {detalleDia.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="py-1.5 px-3 font-mono text-[11px] text-slate-400">
                        {item.codigo_producto}
                      </td>
                      <td className="py-1.5 px-3 font-medium text-slate-900">
                        {item.nombre_producto}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px]">
                          {item.categoria}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center font-semibold text-slate-800">
                        {item.cantidad} {item.unidad}
                      </td>
                      <td className="py-1.5 px-3 text-right text-blue-700">
                        $ {formatMoney(item.venta_neta)}
                      </td>
                      <td className="py-1.5 px-3 text-right text-amber-700">
                        $ {formatMoney(item.impuesto)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                        $ {formatMoney(item.gran_total)}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-500 text-[11px]">
                        $ {formatMoney(item.valor_unitario)}
                      </td>
                      <td className="py-1.5 px-3 text-center font-medium text-slate-600">
                        {item.porcentaje_dia}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
