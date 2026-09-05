'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  Truck, 
  Boxes, 
  LayoutDashboard, 
  ShoppingCart, 
  DollarSign,
  Beef,
  CalendarRange,
  Wrench
} from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';

const NAV_ITEMS = [
  { label: 'Terminal Bodeguero', href: '/bodeguero', icon: Truck },
  { label: 'Inventario de Carnes', href: '/inventario', icon: Boxes },
  { label: 'Ajustes e Inconsistencias', href: '/ajustes', icon: Wrench },
  { label: 'Catálogo de Carnes', href: '/catalogo', icon: Beef },
  { label: 'Control de Periodos', href: '/periodos', icon: CalendarRange },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Compras', href: '/compras', icon: ShoppingCart },
  { label: 'Ventas', href: '/ventas', icon: DollarSign },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <aside
      className={`hidden md:flex flex-col bg-[#050811] text-slate-300 min-h-screen border-r border-slate-900/80 transition-all duration-300 shrink-0 sticky top-0 h-screen z-30 ${
        collapsed ? 'w-[72px]' : 'w-[205px]'
      }`}
    >
      {/* Brand Header with Wooden Board Logo */}
      <div className="p-3 flex flex-col items-center justify-center border-b border-slate-900/80 min-h-[85px]">
        {!collapsed ? (
          <div className="relative w-36 h-14">
            <Image
              src="/Logo.png"
              alt="La Finca Choclos y Asados"
              fill
              priority
              className="object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
            />
          </div>
        ) : (
          <div className="relative w-8 h-8 py-1">
            <Image
              src="/Logo.png"
              alt="Logo"
              fill
              priority
              className="object-contain"
            />
          </div>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const isExact = pathname === item.href || (item.href === '/bodeguero' && pathname === '/');

          return (
            <Link
              key={idx}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-normal transition-all ${
                collapsed ? 'justify-center !px-2' : ''
              } ${
                isExact
                  ? 'bg-orange-500/15 text-orange-400 font-medium border-l-[3px] border-orange-500 rounded-l-none'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isExact ? 'text-orange-400' : 'text-slate-400'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-900/80 text-left space-y-1">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-1.5 text-[11px] font-normal text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              <span>Supabase Conectado</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal leading-tight">
              Elaborado por: Eliana Garces 2026
            </p>
          </>
        ) : (
          <span className="w-2 h-2 rounded-full bg-emerald-400 block mx-auto animate-pulse"></span>
        )}
      </div>
    </aside>
  );
}
