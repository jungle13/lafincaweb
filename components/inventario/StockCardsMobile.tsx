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
        const valorBodega = item.valor_total_bodega_pesos ?? Math.round((item.peso_total_bodega_kg || 0) * (item.costo_unitario_kg || 0));
        const acumUnd = item.traslado_cocina_acumulado_und || 0;
        const acumKg = item.traslado_cocina_acumulado_kg || 0;
        const cocinaUnd = item.cocina_porc_und || 0;
        const cocinaKg = item.peso_total_cocina_kg || (item.cocina_porc_kg + item.cocina_sin_porc_kg) || 0;

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
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-normal">Valor Bodega</span>
                <span className="text-sm font-bold text-slate-900">${formatMoney(valorBodega)}</span>
              </div>
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
                <span className="text-[10px] text-slate-500 font-semibold block">✂️ Bodega Porciones</span>
                <span className="font-extrabold text-purple-600 text-sm">
                  {item.bodega_porc_und} und{' '}
                  <small className="text-[10px] text-slate-400 font-normal">({item.bodega_porc_kg.toFixed(2)} Kg)</small>
                </span>
              </div>

              <div className="bg-amber-100/50 p-1.5 rounded-lg border border-amber-200/50">
                <span className="text-[10px] text-amber-900 font-semibold block">🚚 Acumulado Cocina</span>
                <span className="font-extrabold text-amber-800 text-sm">
                  {acumUnd} und{' '}
                  <small className="text-[10px] text-amber-700 font-normal">({acumKg.toFixed(2)} Kg)</small>
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">🍳 En Cocina (Saldo)</span>
                <span className="font-extrabold text-slate-800 text-sm">
                  {cocinaUnd} und{' '}
                  <small className="text-[10px] text-slate-400 font-normal">({cocinaKg.toFixed(2)} Kg)</small>
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">📉 Merma Acum.</span>
                <span className="font-extrabold text-red-600 text-sm">
                  {item.merma_acumulada_kg > 0 ? `${item.merma_acumulada_kg.toFixed(2)} Kg` : '0.00 Kg'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">🏷️ Costo / Kg</span>
                <span className="font-extrabold text-slate-700 text-sm">
                  ${formatMoney(item.costo_unitario_kg)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

