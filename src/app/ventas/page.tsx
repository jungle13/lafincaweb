'use client';

import { DollarSign } from 'lucide-react';

export default function VentasPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-500" />
          <span>Módulo de Ventas & Comandas</span>
        </h2>
        <p className="text-sm text-slate-500">Control de platos servidos y descargos automáticos de porciones</p>
      </div>
    </div>
  );
}
