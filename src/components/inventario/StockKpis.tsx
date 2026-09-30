'use client';

import { useMemo } from 'react';
import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';
import { Warehouse, CookingPot } from 'lucide-react';

interface Props {
  insumos: InsumoItem[];
  showCocinaCosts?: boolean;
}

export default function StockKpis({ insumos }: Props) {
  const stats = useMemo(() => {
    let totalValorBodega = 0;
    let totalValorCocina = 0;

    insumos.forEach((item) => {
      const tipoMedida = item.tipo_medida || 'KGS_Y_UNIDADES';
      const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';
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
      
      const valorCocina = item.costo_cocina_dia != null 
        ? item.costo_cocina_dia 
        : (item.valor_total_cocina_pesos != null ? item.valor_total_cocina_pesos : 0);

      totalValorBodega += valorBodega || 0;
      totalValorCocina += valorCocina || 0;
    });

    return { totalValorBodega, totalValorCocina };
  }, [insumos]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 border-b border-slate-100">
      {/* 1. Valor Inventario en Bodega */}
      <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500 font-medium block">
            Valor Inventario en Bodega
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tracking-tight">
            $ {formatMoney(stats.totalValorBodega)}
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Warehouse className="w-5 h-5" />
        </div>
      </div>

      {/* 2. Valor Insumos en Cocina */}
      <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/70 flex items-center justify-between">
        <div>
          <span className="text-xs text-amber-900 font-medium block">
            Valor Insumos en Cocina
          </span>
          <div className="text-xl sm:text-2xl font-bold text-amber-950 mt-0.5 tracking-tight">
            $ {formatMoney(stats.totalValorCocina)}
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <CookingPot className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
