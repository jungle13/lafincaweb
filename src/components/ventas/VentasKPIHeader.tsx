'use client';

import { DollarSign, TrendingUp, ShoppingBag, Award, Receipt, Calendar } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { VentasKPIs } from '@/services/ventasService';

interface Props {
  kpis: VentasKPIs;
  periodoNombre?: string;
}

export default function VentasKPIHeader({ kpis, periodoNombre = 'Septiembre 2026' }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {/* 1. Gran Total Ventas */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Facturado
          </span>
          <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
            $ {formatMoney(kpis.granTotalVentas)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            Cobrado a clientes
          </div>
        </div>
      </div>

      {/* 2. Venta Neta */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Venta Neta
          </span>
          <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-lg md:text-xl font-bold text-blue-700 tracking-tight">
            $ {formatMoney(kpis.ventaNeta)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Base antes de impuestos
          </div>
        </div>
      </div>

      {/* 3. Impoconsumo 8% */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs hover:border-amber-300 transition-all">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Impoconsumo (8%)
          </span>
          <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
            <Receipt className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-lg md:text-xl font-bold text-amber-700 tracking-tight">
            $ {formatMoney(kpis.impuesto)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Impuesto al consumo recaudado
          </div>
        </div>
      </div>

      {/* 4. Artículos y Platos */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition-all">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Artículos Servidos
          </span>
          <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <ShoppingBag className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-lg md:text-xl font-bold text-indigo-700 tracking-tight">
            {formatMoney(kpis.totalArticulos)} <span className="text-xs font-normal text-slate-500">uds</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {kpis.totalPlatosUnicos} platos en catálogo
          </div>
        </div>
      </div>

      {/* 5. Promedio Diario */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs hover:border-purple-300 transition-all">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Promedio Diario
          </span>
          <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
            <Calendar className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-lg md:text-xl font-bold text-purple-700 tracking-tight">
            $ {formatMoney(kpis.promedioDiario)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            En {kpis.totalDias} días analizados
          </div>
        </div>
      </div>

      {/* 6. Día Récord */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50/70 rounded-2xl p-3.5 border border-amber-200/80 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
            Día Récord
          </span>
          <span className="p-1.5 bg-amber-500 text-white rounded-lg shadow-xs">
            <Award className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-lg md:text-xl font-bold text-amber-900 tracking-tight">
            $ {formatMoney(kpis.diaRecord?.total || 0)}
          </div>
          <div className="text-[11px] text-amber-800/90 font-medium mt-0.5 truncate">
            {kpis.diaRecord ? `${kpis.diaRecord.diaSemana} ${kpis.diaRecord.fecha.split('-')[2]}/09` : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}
