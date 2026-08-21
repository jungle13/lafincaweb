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
      sub: `${totalBodegaSinPorcKg.toFixed(1)} Kg entero | ${totalBodegaPorcUnd} porc`,
      icon: Boxes,
      color: 'border-l-blue-500 text-blue-600',
      iconColor: 'text-blue-500 bg-blue-50',
    },
    {
      title: 'Porciones Listas',
      value: `${totalBodegaPorcUnd} und`,
      sub: 'Listas para despacho',
      icon: Scissors,
      color: 'border-l-purple-500 text-purple-600',
      iconColor: 'text-purple-500 bg-purple-50',
    },
    {
      title: 'Valor Total Stock',
      value: `$ ${formatMoney(totalValorStock)}`,
      sub: 'Valorizado al costo',
      icon: DollarSign,
      color: 'border-l-emerald-500 text-emerald-600',
      iconColor: 'text-emerald-500 bg-emerald-50',
    },
    {
      title: 'Merma Acumulada',
      value: `${totalMermaKg.toFixed(2)} Kg`,
      sub: `$ ${formatMoney(totalMermaPesos)} en pérdidas`,
      icon: TrendingDown,
      color: 'border-l-red-500 text-red-600',
      iconColor: 'text-red-500 bg-red-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {KPIS.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            className={`bg-white p-3.5 md:p-4 rounded-2xl border border-slate-200 border-l-4 shadow-sm ${kpi.color} space-y-1`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 tracking-tight uppercase">
                {kpi.title}
              </span>
              <div className={`p-1.5 rounded-lg ${kpi.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
              {kpi.value}
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {kpi.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
