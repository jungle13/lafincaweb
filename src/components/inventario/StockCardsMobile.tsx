'use client';

import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';
import { Package, Scissors, CookingPot, DollarSign } from 'lucide-react';

interface Props {
  insumos: InsumoItem[];
  showCocinaCosts?: boolean;
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
    <div className="md:hidden space-y-3 pb-8 font-normal">
      {insumos.map((item) => {
        const tipoMedida = item.tipo_medida || 'KGS_Y_UNIDADES';
        const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';
        const isPaquetes = tipoMedida === 'PAQUETES';
        const isKgsOnly = tipoMedida === 'KGS';
        const isHybrid = tipoMedida === 'KGS_Y_UNIDADES';
        const unitLabel = isPaquetes ? 'paq' : 'und';

        const totalUnitsBodega = isContable ? (item.bodega_porc_und || item.bodega_sin_porc_kg || 0) : (item.bodega_porc_und || 0);
        const totalKgBodega = item.peso_total_bodega_kg ?? ((item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0));
        const tieneStockBodega = isContable ? (totalUnitsBodega > 0) : (totalKgBodega > 0 || totalUnitsBodega > 0);

        const valorBodega = !tieneStockBodega ? 0 : (
          (item.valor_total_bodega_pesos != null && item.valor_total_bodega_pesos > 0)
            ? item.valor_total_bodega_pesos
            : (isContable 
                ? (totalUnitsBodega * (item.costo_unitario_kg || 0))
                : Math.round(totalKgBodega * (item.costo_unitario_kg || 0)))
        );

        const cocinaUnd = item.cocina_dia_und ?? item.cocina_porc_und ?? 0;
        const cocinaKg = item.cocina_dia_kg ?? (item.peso_total_cocina_kg || (item.cocina_porc_kg + item.cocina_sin_porc_kg) || 0);
        const costoCocina = item.costo_cocina_dia ?? item.valor_total_cocina_pesos ?? 0;

        return (
          <div
            key={item.insumo_id}
            className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs space-y-3 active:border-orange-200 transition-all"
          >
            {/* Header del Card */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-slate-900 leading-snug truncate">
                  {item.insumo}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">
                    {item.categoria} • {isPaquetes ? 'PAQUETES' : isContable ? 'UND' : isKgsOnly ? 'KG' : 'KG/UND'}
                  </span>
                  {isHybrid && item.peso_porc_gramos > 0 && (
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                      {item.peso_porc_gramos}g
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <div className="bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/70">
                  <span className="text-[9px] text-blue-700 block font-semibold uppercase tracking-tight">Valor Bodega</span>
                  <span className="text-xs font-bold text-slate-950">${formatMoney(valorBodega)}</span>
                </div>
                {costoCocina > 0 && (
                  <div className="bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 animate-fade-in">
                    <span className="text-[8.5px] text-amber-800 block font-semibold uppercase tracking-tight">Costo Cocina (Día)</span>
                    <span className="text-[11px] font-bold text-amber-950">${formatMoney(costoCocina)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Grid de Existencias Principales */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Bodega Entero */}
              <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100/80">
                <span className="text-[10px] text-blue-900 font-semibold flex items-center gap-1">
                  <Package className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>Bodega Entero</span>
                </span>
                <div className="mt-1">
                  <span className="text-sm font-bold text-blue-700">
                    {isContable ? '-' : item.bodega_sin_porc_kg.toFixed(2)}
                  </span>
                  {!isContable && <span className="text-[10px] text-blue-900/60 font-medium ml-1">Kg</span>}
                </div>
              </div>

              {/* Bodega Porciones / Unidades */}
              <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100/80">
                <span className="text-[10px] text-purple-900 font-semibold flex items-center gap-1">
                  <Scissors className="w-3 h-3 text-purple-600 shrink-0" />
                  <span>{isPaquetes ? 'Bodega Paq.' : isContable ? 'Bodega Und.' : 'Bodega Porc.'}</span>
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  {isKgsOnly ? (
                    <span className="text-sm font-bold text-slate-400">-</span>
                  ) : (
                    <>
                      <span className="text-sm font-bold text-purple-700">
                        {totalUnitsBodega}
                      </span>
                      <span className="text-[10px] text-purple-900 font-medium">{unitLabel}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Total Bodega */}
              <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100/80">
                <span className="text-[10px] text-emerald-900 font-semibold block">Total Bodega</span>
                <div className="mt-1">
                  <span className="text-sm font-bold text-emerald-700">
                    {isContable ? `${totalUnitsBodega} ${unitLabel}` : `${totalKgBodega.toFixed(2)} Kg`}
                  </span>
                </div>
              </div>

              {/* Cocina (Día seleccionado) */}
              <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-100/80">
                <span className="text-[10px] text-amber-900 font-semibold flex items-center gap-1">
                  <CookingPot className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>Cocina (Día)</span>
                </span>
                <div className="mt-1">
                  <span className="text-sm font-bold text-amber-950">
                    {isKgsOnly ? `${cocinaKg.toFixed(2)} Kg` : `${cocinaUnd} ${unitLabel}`}
                  </span>
                  {isHybrid && cocinaKg > 0 && (
                    <span className="text-[10px] text-amber-800 ml-1">({cocinaKg.toFixed(1)}k)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer con Costo Unitario */}
            <div className="flex items-center justify-between text-[11px] bg-slate-50/60 p-2 rounded-xl border border-slate-200/60 text-slate-600">
              <div className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Costo/{isPaquetes ? 'Paq' : isContable ? 'Und' : 'Kg'}: <strong className="text-slate-900">${formatMoney(item.costo_unitario_kg)}</strong></span>
              </div>
              <div>
                <span>Costo Cocina: <strong className="text-amber-900">${formatMoney(costoCocina)}</strong></span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
