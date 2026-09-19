'use client';

import { useState } from 'react';
import { 
  Receipt, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  HelpCircle, 
  Calendar, 
  Building, 
  DollarSign,
  Package
} from 'lucide-react';
import { FacturaGroup } from '@/services/insumosCosteoService';
import { formatMoney } from '@/lib/formatters';

interface Props {
  facturas: FacturaGroup[];
}

export default function FacturasView({ facturas }: Props) {
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

  const toggleInvoice = (facId: string) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [facId]: !prev[facId],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    facturas.forEach((f) => {
      next[f.numeroFactura] = true;
    });
    setExpandedInvoices(next);
  };

  const collapseAll = () => {
    setExpandedInvoices({});
  };

  if (facturas.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 font-normal text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        No se encontraron facturas o comprobantes con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Barra de control para expandir/colapsar */}
      <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
        <span>Mostrando <strong>{facturas.length}</strong> comprobantes y facturas</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-orange-600 hover:text-orange-800 font-medium cursor-pointer"
          >
            Expandir todas
          </button>
          <span>&bull;</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            Colapsar todas
          </button>
        </div>
      </div>

      {/* Lista de Tarjetas de Facturas */}
      <div className="space-y-2.5">
        {facturas.map((fac) => {
          const isExpanded = !!expandedInvoices[fac.numeroFactura];
          const cruzaCuaderno = fac.relacionCuaderno?.includes('Cruza con Cuaderno');

          return (
            <div
              key={fac.numeroFactura}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
            >
              {/* Header de la Factura */}
              <div
                onClick={() => toggleInvoice(fac.numeroFactura)}
                className="p-3.5 flex items-center justify-between gap-3 cursor-pointer bg-slate-50/50 hover:bg-slate-50 select-none flex-wrap"
              >
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="p-2 bg-orange-100/70 text-orange-700 rounded-xl">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">
                        {fac.numeroFactura === 'SIN_COMPROBANTE' ? 'Sin Comprobante / Caja' : fac.numeroFactura}
                      </span>
                      {cruzaCuaderno ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Cruza Cuaderno</span>
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full border border-slate-200">
                          No cruza
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-600 font-medium">
                        <Building className="w-3 h-3 text-slate-400" />
                        {fac.proveedor}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {fac.fecha}
                      </span>
                      <span>&bull;</span>
                      <span>{fac.itemsCount} ítem{fac.itemsCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-normal">Total Factura</div>
                    <div className="text-sm md:text-base font-bold text-slate-900">
                      $ {formatMoney(fac.totalFactura)}
                    </div>
                  </div>
                  <div className="text-slate-400 p-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Detalle Desplegable de los Ítems de la Factura */}
              {isExpanded && (
                <div className="border-t border-slate-200/80 bg-white p-3 space-y-2 animate-fade-in">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                          <th className="pb-2">Ítem / Insumo</th>
                          <th className="pb-2">Categoría</th>
                          <th className="pb-2">Tipo Contable</th>
                          <th className="pb-2 text-right">Cantidad</th>
                          <th className="pb-2 text-right">Costo Unitario</th>
                          <th className="pb-2 text-right">Valor Compra</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {fac.items.map((it) => (
                          <tr key={it.id} className="hover:bg-slate-50/50">
                            <td className="py-2 pr-3">
                              <div className="font-medium text-slate-900">{it.item}</div>
                              {it.descripcion_original && it.descripcion_original !== it.item && (
                                <div className="text-[11px] text-slate-400 line-clamp-1">
                                  {it.descripcion_original}
                                </div>
                              )}
                            </td>
                            <td className="py-2 pr-2 text-slate-600">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                                {it.categoria}
                              </span>
                            </td>
                            <td className="py-2 pr-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                  it.tipo_contable === 'COSTO_DIRECTO'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {it.tipo_contable === 'COSTO_DIRECTO' ? 'Costo Directo' : 'Gasto Operacional'}
                              </span>
                            </td>
                            <td className="py-2 pr-2 text-right font-medium text-slate-700">
                              {it.cantidad > 0 ? it.cantidad : '-'}
                            </td>
                            <td className="py-2 pr-2 text-right text-slate-600">
                              {it.costo_unitario > 0 ? `$ ${formatMoney(it.costo_unitario)}` : '-'}
                            </td>
                            <td className="py-2 text-right font-semibold text-slate-900">
                              $ {formatMoney(it.valor_total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
