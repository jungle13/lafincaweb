'use client';

import { DollarSign, TrendingUp, TrendingDown, Receipt, Calendar } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { InsumosKPIs } from '@/services/insumosCosteoService';

interface Props {
  kpis: InsumosKPIs;
  activeSubmoduloTitle?: string;
}

export default function InsumosKPIHeader({ kpis, activeSubmoduloTitle }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total Costos y Gastos */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Total Egresos Mes
          </span>
          <span className="p-2 bg-slate-100 rounded-xl text-slate-700">
            <DollarSign className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            $ {formatMoney(kpis.totalCostosGastos)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
            <span>{kpis.totalTransacciones} compras registradas</span>
            <span className="font-medium text-slate-700">{kpis.totalFacturas} facturas</span>
          </div>
        </div>
      </div>

      {/* 2. Total Costos Directos */}
      <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider">
            Costos Directos (COGS)
          </span>
          <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
            <TrendingUp className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-xl md:text-2xl font-bold text-emerald-700 tracking-tight">
            $ {formatMoney(kpis.totalCostosDirectos)}
          </div>
          <div className="flex items-center justify-between text-xs text-emerald-800/80 mt-1">
            <span>Materia prima e insumos</span>
            <span className="font-semibold bg-emerald-100/70 text-emerald-800 px-2 py-0.5 rounded-full text-[11px]">
              {kpis.porcentajeCostosDirectos.toFixed(1)}% del total
            </span>
          </div>
        </div>
      </div>

      {/* 3. Total Gastos Operacionales */}
      <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-amber-800 uppercase tracking-wider">
            Gastos Operativos (OPEX)
          </span>
          <span className="p-2 bg-amber-50 rounded-xl text-amber-600">
            <TrendingDown className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-xl md:text-2xl font-bold text-amber-900 tracking-tight">
            $ {formatMoney(kpis.totalGastosOperativos)}
          </div>
          <div className="flex items-center justify-between text-xs text-amber-800/80 mt-1">
            <span>Nómina, arriendo, servicios</span>
            <span className="font-semibold bg-amber-100/70 text-amber-900 px-2 py-0.5 rounded-full text-[11px]">
              {kpis.porcentajeGastosOperativos.toFixed(1)}% del total
            </span>
          </div>
        </div>
      </div>

      {/* 4. Promedio Diario */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Promedio Diario Egresos
          </span>
          <span className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
            <Calendar className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-2">
          <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            $ {formatMoney(kpis.promedioDiario)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
            <span>Ritmo de compras/día</span>
            <span className="text-indigo-600 font-medium text-[11px]">Septiembre 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
