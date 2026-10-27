'use client';

import { DollarSign, TrendingUp, Award, Receipt } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { VentasKPIs } from '@/services/ventasService';

interface Props {
  kpis: VentasKPIs;
  periodoNombre?: string;
}

export default function VentasKPIHeader({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Gran Total Ventas */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Facturado
          </span>
          <span className="p-1 bg-slate-100 text-slate-700 rounded">
            <DollarSign className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="mt-1.5">
          <div className="text-lg md:text-xl font-bold text-slate-900 tracking-tight font-mono">
            $ {formatMoney(kpis.granTotalVentas)}
          </div>
          <div className="text-[11px] text-slate-500 font-normal mt-0.5">
            Cobrado a clientes
          </div>
        </div>
      </div>

      {/* 2. Venta Neta */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Venta Neta
          </span>
          <span className="p-1 bg-slate-100 text-slate-700 rounded">
            <TrendingUp className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="mt-1.5">
          <div className="text-lg md:text-xl font-bold text-slate-900 tracking-tight font-mono">
            $ {formatMoney(kpis.ventaNeta)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Base antes de impuestos
          </div>
        </div>
      </div>

      {/* 3. Impoconsumo 8% */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Impoconsumo (8%)
          </span>
          <span className="p-1 bg-slate-100 text-slate-700 rounded">
            <Receipt className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="mt-1.5">
          <div className="text-lg md:text-xl font-bold text-slate-900 tracking-tight font-mono">
            $ {formatMoney(kpis.impuesto)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Impuesto al consumo recaudado
          </div>
        </div>
      </div>

      {/* 4. Día Récord */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Día Récord
          </span>
          <span className="p-1 bg-slate-100 text-slate-700 rounded">
            <Award className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="mt-1.5">
          <div className="text-lg md:text-xl font-bold text-slate-900 tracking-tight font-mono">
            $ {formatMoney(kpis.diaRecord?.total || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {kpis.diaRecord && kpis.diaRecord.fecha
              ? `${kpis.diaRecord.diaSemana} ${kpis.diaRecord.fecha.split('-')[2]}/${kpis.diaRecord.fecha.split('-')[1]}`
              : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}
