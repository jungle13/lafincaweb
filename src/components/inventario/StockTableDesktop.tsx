'use client';

import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
}

export default function StockTableDesktop({ insumos }: Props) {
  if (insumos.length === 0) {
    return (
      <div className="hidden md:block text-center py-16 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <p className="text-sm font-medium">No se encontraron carnes o insumos con los filtros seleccionados.</p>
      </div>
    );
  }

  return (
    <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/95 text-slate-700 font-semibold sticky top-0 z-20 backdrop-blur-md border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4 sticky left-0 bg-slate-50/95 z-30 font-bold text-slate-800">
                Insumo / Carne
              </th>
              <th className="py-3.5 px-3 text-right">Bodega Entero</th>
              <th className="py-3.5 px-3 text-right">Bodega Porciones</th>
              <th className="py-3.5 px-3 text-right font-bold text-slate-900">Total Bodega</th>
              <th className="py-3.5 px-3 text-right">En Cocina</th>
              <th className="py-3.5 px-3 text-right bg-rose-50/70 text-rose-700 font-semibold border-x border-rose-100/60">
                Merma Acumulada
              </th>
              <th className="py-3.5 px-3 text-right">Costo / Kg</th>
              <th className="py-3.5 px-3 text-right font-bold text-slate-900">Valor Stock</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
            {insumos.map((item) => {
              const statusBadge =
                item.estado_stock === 'AGOTADO' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    AGOTADO
                  </span>
                ) : item.estado_stock === 'BAJO' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    BAJO
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ÓPTIMO
                  </span>
                );

              return (
                <tr
                  key={item.insumo_id}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  {/* Name and Category */}
                  <td className="py-3.5 px-4 sticky left-0 bg-white group-hover:bg-slate-50/70 z-10 border-r border-slate-100 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                    <div className="font-bold text-slate-900 text-sm">{item.insumo}</div>
                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                      {item.categoria}
                    </div>
                  </td>

                  {/* Bodega Entero */}
                  <td className="py-3.5 px-3 text-right font-semibold text-blue-600">
                    {item.bodega_sin_porc_kg.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">Kg</span>
                  </td>

                  {/* Bodega Porciones */}
                  <td className="py-3.5 px-3 text-right">
                    <span className="font-semibold text-purple-600">{item.bodega_porc_und}</span>{' '}
                    <span className="text-[10px] text-slate-400">und</span>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {item.bodega_porc_kg.toFixed(2)} Kg
                    </div>
                  </td>

                  {/* Total Bodega */}
                  <td className="py-3.5 px-3 text-right font-bold text-emerald-600 bg-emerald-50/30">
                    {item.peso_total_bodega_kg.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">Kg</span>
                  </td>

                  {/* En Cocina */}
                  <td className="py-3.5 px-3 text-right">
                    <span className="font-semibold text-amber-600">{item.cocina_porc_und}</span>{' '}
                    <span className="text-[10px] text-slate-400">und</span>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {item.cocina_porc_kg.toFixed(2)} Kg
                    </div>
                  </td>

                  {/* Merma Acumulada */}
                  <td className="py-3.5 px-3 text-right bg-rose-50/40 border-x border-rose-100/50">
                    {item.merma_acumulada_kg > 0 ? (
                      <div>
                        <div className="font-bold text-rose-600">{item.merma_acumulada_kg.toFixed(2)} Kg</div>
                        <div className="text-[10px] text-rose-500 font-medium">${formatMoney(item.merma_acumulada_pesos)}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-normal">0.00 Kg</span>
                    )}
                  </td>

                  {/* Costo / Kg */}
                  <td className="py-3.5 px-3 text-right text-slate-600 font-medium">
                    ${formatMoney(item.costo_unitario_kg)}
                  </td>

                  {/* Valor Total Stock */}
                  <td className="py-3.5 px-3 text-right font-bold text-slate-900 bg-slate-50/40">
                    ${formatMoney(item.valor_total_general_pesos)}
                  </td>

                  {/* Estado */}
                  <td className="py-3.5 px-4 text-center">
                    {statusBadge}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
