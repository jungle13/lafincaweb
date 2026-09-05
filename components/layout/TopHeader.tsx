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
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200/90 px-4 md:px-7 py-2.5 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
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
        </div>
      </div>

      {/* Right Controls: Period Indicator & Selector */}
      <div className="flex items-center gap-3">
        {/* Period Selector Global */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1 text-xs shadow-sm">
          <CalendarRange className="w-4 h-4 text-orange-500 shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
            <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">Periodo:</span>
            <select
              value={selectedPeriodoId}
              onChange={(e) => setSelectedPeriodoId(e.target.value)}
              className="bg-transparent text-slate-800 font-medium text-xs outline-none cursor-pointer pr-1"
            >
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.estado === 'CERRADO' ? '(Cerrado)' : p.estado === 'EN_CONCILIACION' ? '(Auditoría)' : '(En Curso)'}
                </option>
              ))}
            </select>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
              currentPeriodo?.estado === 'ABIERTO'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : currentPeriodo?.estado === 'EN_CONCILIACION'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {currentPeriodo?.estado === 'ABIERTO' ? '🟢 ABIERTO' : currentPeriodo?.estado === 'EN_CONCILIACION' ? '🟡 AUDITORÍA' : '🔒 CERRADO'}
          </span>
        </div>
      </div>
    </header>
  );
}
