'use client';

import { usePathname } from 'next/navigation';
import { RefreshCw, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Terminal del Bodeguero', subtitle: 'Operaciones diarias de carnes en tiempo real' },
  '/bodeguero': { title: 'Terminal del Bodeguero', subtitle: 'Operaciones diarias de carnes en tiempo real' },
  '/inventario': { title: 'Inventario de Carnes', subtitle: 'Existencias en bodega, cocina, mermas y costos' },
  '/dashboard': { title: 'Dashboard Ejecutivo', subtitle: 'Métricas financieras y tendencias generales' },
  '/compras': { title: 'Módulo de Compras', subtitle: 'Histórico de facturas y proveedores' },
  '/ventas': { title: 'Módulo de Ventas', subtitle: 'Control de comandas y despachos' },
};

export default function TopHeader({ onRefresh }: { onRefresh?: () => void }) {
  const pathname = usePathname();
  const current = VIEW_TITLES[pathname] || VIEW_TITLES['/bodeguero'];
  const [spinning, setSpinning] = useState(false);

  const handleSync = () => {
    setSpinning(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setSpinning(false), 800);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 md:bg-white border-b border-slate-800 md:border-slate-200 px-4 py-3 md:px-6 md:py-3.5 flex items-center justify-between shadow-sm">
      {/* Left Info */}
      <div className="flex items-center gap-3">
        <div className="md:hidden w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
          <UtensilsCrossed className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base md:text-xl font-black md:font-bold text-white md:text-slate-900 tracking-tight">
            {current.title}
          </h1>
          <p className="hidden md:block text-xs text-slate-500 font-medium">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          title="Sincronizar Datos"
          className="flex items-center gap-2 px-3 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold bg-slate-800 md:bg-slate-100 text-slate-200 md:text-slate-700 hover:bg-slate-700 md:hover:bg-slate-200 transition-colors border border-slate-700 md:border-slate-300 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 text-sky-400 md:text-sky-600 ${spinning ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sincronizar</span>
        </button>
      </div>
    </header>
  );
}
