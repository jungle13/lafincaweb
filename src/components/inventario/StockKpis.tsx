'use client';

import { useMemo } from 'react';
import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
}

export default function StockKpis({ insumos }: Props) {
  const stats = useMemo(() => {
    let totalValor = 0;
    let totalBodegaKg = 0;
    let totalCocinaKg = 0;
    let totalMermaKg = 0;

    insumos.forEach((item) => {
      const valorBodega = item.valor_total_bodega_pesos ?? Math.round((item.peso_total_bodega_kg || 0) * (item.costo_unitario_kg || 0));
      totalValor += valorBodega || 0;
      totalBodegaKg += item.peso_total_bodega_kg || 0;
      totalCocinaKg += item.peso_total_cocina_kg || 0;
      totalMermaKg += item.merma_acumulada_kg || 0;
    });

    return { totalValor, totalBodegaKg, totalCocinaKg, totalMermaKg };
  }, [insumos]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 py-2 border-b border-slate-100 font-normal">
      <div className="bg-slate-50 md:bg-transparent p-2.5 md:p-0 rounded-xl border md:border-none border-slate-200/60">
        <span className="text-[11px] md:text-xs text-slate-500 font-medium md:font-normal block">Valor Total Stock</span>
        <div className="text-base sm:text-lg md:text-xl font-bold md:font-medium text-slate-900 mt-0.5">$ {formatMoney(stats.totalValor)}</div>
      </div>
      <div className="bg-slate-50 md:bg-transparent p-2.5 md:p-0 rounded-xl border md:border-none border-slate-200/60">
        <span className="text-[11px] md:text-xs text-slate-500 font-medium md:font-normal block">Total en Bodega</span>
        <div className="text-base sm:text-lg md:text-xl font-bold md:font-medium text-blue-700 md:text-slate-900 mt-0.5">{stats.totalBodegaKg.toFixed(2)} <span className="text-xs text-slate-400 font-normal">Kg</span></div>
      </div>
      <div className="bg-slate-50 md:bg-transparent p-2.5 md:p-0 rounded-xl border md:border-none border-slate-200/60">
        <span className="text-[11px] md:text-xs text-slate-500 font-medium md:font-normal block">Total en Cocina</span>
        <div className="text-base sm:text-lg md:text-xl font-bold md:font-medium text-slate-800 md:text-slate-900 mt-0.5">{stats.totalCocinaKg.toFixed(2)} <span className="text-xs text-slate-400 font-normal">Kg</span></div>
      </div>
      <div className="bg-rose-50/50 md:bg-transparent p-2.5 md:p-0 rounded-xl border md:border-none border-rose-100/80">
        <span className="text-[11px] md:text-xs text-rose-700 md:text-slate-500 font-medium md:font-normal block">Merma Acumulada</span>
        <div className="text-base sm:text-lg md:text-xl font-bold md:font-medium text-rose-600 mt-0.5">{stats.totalMermaKg.toFixed(2)} <span className="text-xs text-rose-400 md:text-slate-400 font-normal">Kg</span></div>
      </div>
    </div>
  );
}
