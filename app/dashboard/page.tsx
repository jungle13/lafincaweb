'use client';

import { LayoutDashboard, ArrowUpRight } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="w-full space-y-6 animate-fade-in font-normal">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-medium text-slate-900 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-orange-500" />
          <span>Dashboard Ejecutivo & Ventas</span>
        </h2>
        <p className="text-xs text-slate-500 font-normal mt-0.5">Resumen consolidado de costos de compras, porcionados y valorización</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-2 border-b border-slate-100">
        <div>
          <div className="text-xs text-slate-500 font-normal">Margen Bruto Estimado</div>
          <div className="text-2xl font-medium text-slate-900 mt-1">68.4%</div>
          <div className="text-xs text-emerald-600 font-normal flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +2.4% vs mes anterior
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500 font-normal">Eficiencia de Porcionado</div>
          <div className="text-2xl font-medium text-purple-600 mt-1">96.8%</div>
          <div className="text-xs text-slate-400 font-normal mt-1">Merma promedio controlada: 3.2%</div>
        </div>

        <div>
          <div className="text-xs text-slate-500 font-normal">Rotación de Carnes</div>
          <div className="text-2xl font-medium text-blue-600 mt-1">3.8 días</div>
          <div className="text-xs text-slate-400 font-normal mt-1">Tiempo promedio de permanencia</div>
        </div>
      </div>
    </div>
  );
}
