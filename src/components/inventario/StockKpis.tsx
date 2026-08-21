'use client';

import { Boxes, Scissors, DollarSign, TrendingDown } from 'lucide-react';
import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
}

export default function StockKpis({ insumos }: Props) {
  let totalBodegaKg = 0;
  let totalBodegaPorcUnd = 0;
  let totalBodegaSinPorcKg = 0;
  let totalValorStock = 0;
  let totalMermaKg = 0;
  let totalMermaPesos = 0;

  insumos.forEach((item) => {
    totalBodegaKg += item.peso_total_bodega_kg || 0;
    totalBodegaPorcUnd += item.bodega_porc_und || 0;
    totalBodegaSinPorcKg += item.bodega_sin_porc_kg || 0;
    totalValorStock += item.valor_total_general_pesos || 0;
    totalMermaKg += item.merma_acumulada_kg || 0;
    totalMermaPesos += item.merma_acumulada_pesos || 0;
  });

  const KPIS = [
    {
      title: 'Stock Total Bodega',
      value: `${totalBodegaKg.toFixed(1)} Kg`,
      sub: `${totalBodegaSinPorcKg.toFixed(1)} Kg entero • ${totalBodegaPorcUnd} porc`,
      icon: Boxes,
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
      accent: 'border-l-blue-500',
    },
    {
      title: 'Porciones Listas',
      value: `${totalBodegaPorcUnd} und`,
      sub: 'Listas para despacho a cocina',
      icon: Scissors,
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
      accent: 'border-l-purple-500',
    },
    {
      title: 'Valor Total Stock',
      value: `$ ${formatMoney(totalValorStock)}`,
      sub: 'Valorizado a costo promedio',
      icon: DollarSign,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      accent: 'border-l-emerald-500',
    },
    {
      title: 'Merma Acumulada',
      value: `${totalMermaKg.toFixed(2)} Kg`,
      sub: `$ ${formatMoney(totalMermaPesos)} en pérdidas`,
      icon: TrendingDown,
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
      accent: 'border-l-rose-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
      {KPIS.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            className={`bg-white p-4 rounded-2xl border border-slate-200/90 border-l-[3.5px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all ${kpi.accent}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {kpi.title}
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              {kpi.value}
            </div>
            <div className="text-xs text-slate-500 font-normal mt-1 truncate">
              {kpi.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
