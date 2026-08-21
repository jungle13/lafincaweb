'use client';

import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
}

export default function StockCardsMobile({ insumos }: Props) {
  if (insumos.length === 0) {
    return (
      <div className="md:hidden text-center py-12 text-slate-400 text-sm font-medium">
        No se encontraron insumos para la búsqueda.
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-3">
      {insumos.map((item) => {
        const statusBadge =
          item.estado_stock === 'AGOTADO' ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200">
              AGOTADO
            </span>
          ) : item.estado_stock === 'BAJO' ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
              BAJO
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
              ÓPTIMO
            </span>
          );

        return (
          <div
            key={item.insumo_id}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{item.insumo}</h3>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {item.categoria}
                </span>
              </div>
              {statusBadge}
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">📦 Bodega Entero</span>
                <span className="font-extrabold text-blue-600 text-sm">
                  {item.bodega_sin_porc_kg.toFixed(2)} Kg
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">✂️ Porciones Listas</span>
                <span className="font-extrabold text-purple-600 text-sm">
                  {item.bodega_porc_und} und{' '}
                  <small className="text-[10px] text-slate-400 font-normal">({item.bodega_porc_kg.toFixed(2)} Kg)</small>
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">🍳 En Cocina</span>
                <span className="font-extrabold text-amber-600 text-sm">
                  {item.cocina_porc_und} und{' '}
                  <small className="text-[10px] text-slate-400 font-normal">({item.cocina_porc_kg.toFixed(2)} Kg)</small>
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">📉 Merma Acum.</span>
                <span className="font-extrabold text-red-600 text-sm">
                  {item.merma_acumulada_kg > 0 ? `${item.merma_acumulada_kg.toFixed(2)} Kg` : '0.00 Kg'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100 font-semibold">
              <span>Valor Stock: <strong className="text-slate-900">${formatMoney(item.valor_total_general_pesos)}</strong></span>
              <span>Costo/Kg: <strong className="text-slate-900">${formatMoney(item.costo_unitario_kg)}</strong></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
