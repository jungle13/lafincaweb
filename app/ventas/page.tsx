'use client';

import { DollarSign } from 'lucide-react';

export default function VentasPage() {
  return (
    <div className="w-full space-y-6 animate-fade-in font-normal">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-medium text-slate-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-500" />
          <span>Módulo de Ventas & Comandas</span>
        </h2>
        <p className="text-xs text-slate-500 font-normal mt-0.5">Control de platos servidos y descargos automáticos de porciones</p>
      </div>
    </div>
  );
}
