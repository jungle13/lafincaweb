'use client';

import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
}

export default function StockTableDesktop({ insumos }: Props) {
  if (insumos.length === 0) {
    return (
      <div className="hidden md:block text-center py-12 text-slate-400">
        No se encontraron insumos para la búsqueda seleccionada.
      </div>
    );
  }

  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 shadow-sm max-h-[600px] overflow-y-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-100/80 text-slate-700 font-bold sticky top-0 z-20 backdrop-blur-sm border-b border-slate-200">
          <tr>
            <th className="p-3 sticky left-0 bg-slate-100 z-30 shadow-sm">Insumo / Carne</th>
            <th className="p-3 text-right">Bodega Entero</th>
            <th className="p-3 text-right">Bodega Porciones</th>
            <th className="p-3 text-right">Total Bodega</th>
            <th className="p-3 text-right">En Cocina</th>
            <th className="p-3 text-right bg-red-50 text-red-700">Merma Acumulada</th>
            <th className="p-3 text-right">Costo/Kg</th>
            <th className="p-3 text-right">Valor Stock</th>
            <th className="p-3 text-center">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-medium text-slate-800 bg-white">
          {insumos.map((item) => {
            const statusBadge =
              item.estado_stock === 'AGOTADO' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                  AGOTADO
                </span>
              ) : item.estado_stock === 'BAJO' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
                  BAJO
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  ÓPTIMO
                </span>
              );

            return (
              <tr key={item.insumo_id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3 font-bold sticky left-0 bg-white hover:bg-slate-50 z-10 shadow-sm">
                  <div className="text-slate-900">{item.insumo}</div>
                  <div className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">{item.categoria}</div>
                </td>
                <td className="p-3 text-right font-bold text-blue-600">
                  {item.bodega_sin_porc_kg.toFixed(2)} <span className="text-[10px] text-slate-400">Kg</span>
                </td>
                <td className="p-3 text-right">
                  <span className="font-bold text-purple-600">{item.bodega_porc_und}</span> <span className="text-[10px]">und</span>
                  <div className="text-[10px] text-slate-400">{item.bodega_porc_kg.toFixed(2)} Kg</div>
                </td>
                <td className="p-3 text-right font-bold text-emerald-600">
                  {item.peso_total_bodega_kg.toFixed(2)} <span className="text-[10px] text-slate-400">Kg</span>
                </td>
                <td className="p-3 text-right">
                  <span className="font-bold text-amber-600">{item.cocina_porc_und}</span> <span className="text-[10px]">und</span>
                  <div className="text-[10px] text-slate-400">{item.cocina_porc_kg.toFixed(2)} Kg</div>
                </td>
                <td className="p-3 text-right bg-red-50/40">
                  {item.merma_acumulada_kg > 0 ? (
                    <div>
                      <div className="font-bold text-red-600">{item.merma_acumulada_kg.toFixed(2)} Kg</div>
                      <div className="text-[10px] text-red-500 font-semibold">${formatMoney(item.merma_acumulada_pesos)}</div>
                    </div>
                  ) : (
                    <span className="text-slate-400">0.00 Kg</span>
                  )}
                </td>
                <td className="p-3 text-right text-slate-600 font-semibold">
                  ${formatMoney(item.costo_unitario_kg)}
                </td>
                <td className="p-3 text-right font-bold text-sky-600">
                  ${formatMoney(item.valor_total_general_pesos)}
                </td>
                <td className="p-3 text-center">
                  {statusBadge}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
