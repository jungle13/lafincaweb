'use client';

import { LayoutDashboard, TrendingUp, DollarSign, ArrowUpRight } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-orange-500" />
          <span>Dashboard Ejecutivo & Ventas</span>
        </h2>
        <p className="text-sm text-slate-500">Resumen consolidado de costos de compras, porcionados y valorización</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase">Margen Bruto Estimado</div>
          <div className="text-3xl font-black text-slate-900">68.4%</div>
          <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" /> +2.4% vs mes anterior
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase">Eficiencia de Porcionado</div>
          <div className="text-3xl font-black text-purple-600">96.8%</div>
          <div className="text-xs text-slate-500 font-medium">Merma promedio controlada: 3.2%</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase">Rotación de Carnes</div>
          <div className="text-3xl font-black text-blue-600">3.8 días</div>
          <div className="text-xs text-slate-500 font-medium">Tiempo promedio de permanencia en bodega</div>
        </div>
      </div>
    </div>
  );
}
