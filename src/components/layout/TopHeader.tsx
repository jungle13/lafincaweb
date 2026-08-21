'use client';

import { usePathname } from 'next/navigation';
import { Menu, Printer, UtensilsCrossed } from 'lucide-react';
import Image from 'next/image';
import { useSidebar } from '@/context/SidebarContext';

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Terminal del Bodeguero', subtitle: 'Operaciones diarias de carnes en tiempo real' },
  '/bodeguero': { title: 'Terminal del Bodeguero', subtitle: 'Operaciones diarias de carnes en tiempo real' },
  '/inventario': { title: 'Estado Real del Inventario de Carnes', subtitle: 'Monitoreo en vivo de cantidades en bodega, cortes en cocina, costos y valorización' },
  '/dashboard': { title: 'Dashboard General', subtitle: 'Resumen ejecutivo y tendencias del restaurante' },
  '/compras': { title: 'Módulo de Compras', subtitle: 'Historial de facturas y abastecimiento de insumos' },
  '/ventas': { title: 'Módulo de Ventas', subtitle: 'Control de platos servidos y descargos' },
};

export default function TopHeader() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const current = VIEW_TITLES[pathname] || VIEW_TITLES['/bodeguero'];

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200/90 px-4 md:px-6 py-3 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Left Title & Sidebar Toggle */}
      <div className="flex items-center gap-3">
        {/* Toggle button on desktop & mobile */}
        <button
          onClick={toggleSidebar}
          title="Mostrar/Ocultar Menú Lateral"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile brand icon */}
        <div className="md:hidden relative w-8 h-8">
          <Image src="/Logo.png" alt="Logo" fill className="object-contain" />
        </div>

        <div>
          <h1 className="text-base md:text-xl font-bold text-slate-900 tracking-tight leading-tight">
            {current.title}
          </h1>
          <p className="hidden md:block text-xs text-slate-500 font-normal mt-0.5">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <a
          href="/formato-bodeguero.html"
          target="_blank"
          rel="noopener noreferrer"
          title="Imprimir formato físico diario para el bodeguero"
          className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-300 transition-colors shadow-sm"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          <span>Formato Físico</span>
        </a>
      </div>
    </header>
  );
}
