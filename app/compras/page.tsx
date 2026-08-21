'use client';

import { ShoppingCart } from 'lucide-react';

export default function ComprasPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-blue-500" />
          <span>Módulo de Compras y Facturas</span>
        </h2>
        <p className="text-sm text-slate-500">Histórico de compras registradas en bodega y pendientes por liquidar</p>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-3">
        <p className="text-sm font-semibold">Todas las entradas por compra registradas por el bodeguero se sincronizan automáticamente aquí.</p>
      </div>
    </div>
  );
}
