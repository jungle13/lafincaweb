'use client';

import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';
import { Package, Scissors, Truck, CookingPot, TrendingDown, DollarSign } from 'lucide-react';

interface Props {
  insumos: InsumoItem[];
}

export default function StockCardsMobile({ insumos }: Props) {
  if (insumos.length === 0) {
    return (
      <div className="md:hidden text-center py-12 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
        No se encontraron insumos para la búsqueda o filtro seleccionado.
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-3 pb-8">
      {insumos.map((item) => {
        const valorBodega = item.valor_total_bodega_pesos ?? Math.round((item.peso_total_bodega_kg || 0) * (item.costo_unitario_kg || 0));
        const acumUnd = item.traslado_cocina_acumulado_und || 0;
        const acumKg = item.traslado_cocina_acumulado_kg || 0;
        const cocinaUnd = item.cocina_porc_und || 0;
        const cocinaKg = item.peso_total_cocina_kg || (item.cocina_porc_kg + item.cocina_sin_porc_kg) || 0;
        const totalBodegaKg = item.peso_total_bodega_kg || (item.bodega_sin_porc_kg + item.bodega_porc_kg) || 0;

        return (
          <div
            key={item.insumo_id}
            className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs space-y-3 active:border-orange-200 transition-all"
          >
            {/* Header del Card */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold text-sm text-slate-900 leading-snug truncate">
                    {item.insumo}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9.5px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">
                    {item.categoria}
                  </span>
                  {item.peso_porc_gramos > 0 && (
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                      {item.peso_porc_gramos}g / porc
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/70">
                <span className="text-[9px] text-slate-400 block font-medium uppercase tracking-tight">Valor Bodega</span>
                <span className="text-xs font-bold text-slate-950">${formatMoney(valorBodega)}</span>
              </div>
            </div>

            {/* Grid 2x2 de Existencias Principales */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Bodega Entero */}
              <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100/80">
                <span className="text-[10px] text-blue-900 font-semibold flex items-center gap-1">
                  <Package className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>Bodega Entero</span>
                </span>
                <div className="mt-1">
                  <span className="text-sm font-extrabold text-blue-700">
                    {item.bodega_sin_porc_kg.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-blue-900/60 font-medium ml-1">Kg</span>
                </div>
              </div>

              {/* Bodega Porciones */}
              <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100/80">
                <span className="text-[10px] text-purple-900 font-semibold flex items-center gap-1">
                  <Scissors className="w-3 h-3 text-purple-600 shrink-0" />
                  <span>Bodega Porc.</span>
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-extrabold text-purple-700">
                    {item.bodega_porc_und}
                  </span>
                  <span className="text-[10px] text-purple-900 font-medium">und</span>
                  <span className="text-[9.5px] text-purple-600/70">({item.bodega_porc_kg.toFixed(1)}k)</span>
                </div>
              </div>

              {/* Acumulado a Cocina en el periodo */}
              <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70">
                <span className="text-[10px] text-amber-950 font-semibold flex items-center gap-1">
                  <Truck className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>Acumulado Cocina</span>
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-extrabold text-amber-900">
                    {acumUnd}
                  </span>
                  <span className="text-[10px] text-amber-900 font-medium">und</span>
                  <span className="text-[9.5px] text-amber-700">({acumKg.toFixed(1)}k)</span>
                </div>
              </div>

              {/* En Cocina (Saldo Actual) */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-700 font-semibold flex items-center gap-1">
                  <CookingPot className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>Saldo en Cocina</span>
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-extrabold text-slate-900">
                    {cocinaUnd}
                  </span>
                  <span className="text-[10px] text-slate-600 font-medium">und</span>
                  <span className="text-[9.5px] text-slate-400">({cocinaKg.toFixed(1)}k)</span>
                </div>
              </div>
            </div>

            {/* Footer con Costo Unitario y Merma */}
            <div className="flex items-center justify-between text-[11px] bg-slate-50/60 p-2 rounded-xl border border-slate-200/60 text-slate-600">
              <div className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Costo/Kg: <strong className="text-slate-900">${formatMoney(item.costo_unitario_kg)}</strong></span>
              </div>

              <div className="flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                <span>Merma: <strong className={item.merma_acumulada_kg > 0 ? 'text-rose-600' : 'text-slate-500'}>
                  {item.merma_acumulada_kg > 0 ? `${item.merma_acumulada_kg.toFixed(2)} Kg` : '0.00 Kg'}
                </strong></span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
