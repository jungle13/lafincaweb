'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Calendar, CalendarRange } from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';
import { usePeriodo } from '@/context/PeriodoContext';

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Terminal del Bodeguero', subtitle: 'Control operativo de carnes y movimientos en tiempo real' },
  '/bodeguero': { title: 'Terminal del Bodeguero', subtitle: 'Control operativo de carnes y movimientos en tiempo real' },
  '/inventario': { title: 'Inventario de Carnes', subtitle: 'Monitoreo en vivo de cantidades en bodega, cocina y costos' },
  '/ajustes': { title: 'Inconsistencias y Ajustes de Inventario', subtitle: 'Auditoría y trazabilidad de ajustes aplicados por errores de conteo y mermas' },
  '/catalogo': { title: 'Catálogo de Carnes e Insumos', subtitle: 'Gramajes estándar por porción, precios unitarios y rendimientos' },
  '/periodos': { title: 'Control y Cierre de Periodos', subtitle: 'Aperturas mensuales, arqueo inicial y cierre auditado de inventarios' },
  '/dashboard': { title: 'Dashboard General', subtitle: 'Resumen ejecutivo del restaurante' },
  '/compras': { title: 'Registro de Compras', subtitle: 'Ingresos y costos de materia prima' },
  '/ventas': { title: 'Módulo de Ventas', subtitle: 'Control de comandas y despachos' },
};

export default function TopHeader() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const { periodos, selectedPeriodoId, currentPeriodo, setSelectedPeriodoId } = usePeriodo();
  const current = VIEW_TITLES[pathname] || VIEW_TITLES['/bodeguero'];
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split('T')[0]);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200/90 px-3 md:px-7 py-2 md:py-2.5 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Left Title & Sidebar Toggle */}
      <div className="flex items-center md:items-start gap-2.5 md:gap-3.5 min-w-0">
        <button
          onClick={toggleSidebar}
          title="Mostrar/Ocultar Menú Lateral"
          className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 active:bg-slate-100 transition-colors border border-slate-200/60 md:border-transparent shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm md:text-lg font-bold md:font-semibold text-slate-900 tracking-tight leading-tight truncate">
            {current.title}
          </h1>
          <p className="text-[11px] md:text-xs text-slate-500 font-normal truncate hidden sm:block">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls: Period Indicator & Selector */}
      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        {/* Period Selector Global */}
        <div className="flex items-center gap-1 md:gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2 md:px-2.5 py-1 text-xs shadow-sm">
          <CalendarRange className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-500 shrink-0" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-normal hidden lg:inline">Periodo:</span>
            <select
              value={selectedPeriodoId}
              onChange={(e) => setSelectedPeriodoId(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold md:font-medium text-[11px] md:text-xs outline-none cursor-pointer max-w-[110px] sm:max-w-none truncate"
            >
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.estado === 'CERRADO' ? '(Cerrado)' : p.estado === 'EN_CONCILIACION' ? '(Auditoría)' : ''}
                </option>
              ))}
            </select>
          </div>
          <span
            className={`px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold md:font-medium border ${
              currentPeriodo?.estado === 'ABIERTO'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : currentPeriodo?.estado === 'EN_CONCILIACION'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {currentPeriodo?.estado === 'ABIERTO' ? '🟢 ABIERTO' : currentPeriodo?.estado === 'EN_CONCILIACION' ? '🟡 AUDIT.' : '🔒 CERRADO'}
          </span>
        </div>
      </div>
    </header>
  );
}
