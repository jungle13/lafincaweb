'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Calendar } from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Terminal del Bodeguero', subtitle: 'Control operativo de carnes y movimientos en tiempo real' },
  '/bodeguero': { title: 'Terminal del Bodeguero', subtitle: 'Control operativo de carnes y movimientos en tiempo real' },
  '/inventario': { title: 'Inventario de Carnes', subtitle: 'Monitoreo en vivo de cantidades en bodega, cocina y costos' },
  '/dashboard': { title: 'Dashboard General', subtitle: 'Resumen ejecutivo del restaurante' },
  '/compras': { title: 'Registro de Compras', subtitle: 'Ingresos y costos de materia prima' },
  '/ventas': { title: 'Módulo de Ventas', subtitle: 'Control de comandas y despachos' },
};

export default function TopHeader() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const current = VIEW_TITLES[pathname] || VIEW_TITLES['/bodeguero'];
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split('T')[0]);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200/90 px-4 md:px-7 py-3 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Left Title & Sidebar Toggle */}
      <div className="flex items-start gap-3.5">
        <button
          onClick={toggleSidebar}
          title="Mostrar/Ocultar Menú Lateral"
          className="mt-0.5 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base md:text-lg font-semibold text-slate-900 tracking-tight leading-tight">
            {current.title}
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            {current.subtitle}
          </p>

          {/* Date Picker Badge */}
          <div className="hidden sm:flex items-center gap-1.5 mt-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 font-normal">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Actualizado hasta:</span>
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="bg-transparent text-slate-800 font-medium outline-none cursor-pointer text-xs"
              />
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
