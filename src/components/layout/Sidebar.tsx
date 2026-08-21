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
  ChefHat,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';

const NAV_ITEMS = [
  { label: 'Terminal Bodeguero', href: '/bodeguero', icon: Truck },
  { label: 'Inventario de Carnes', href: '/inventario', icon: Boxes },
  { label: 'Dashboard General', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Compras', href: '/compras', icon: ShoppingCart },
  { label: 'Ventas', href: '/ventas', icon: DollarSign },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleSidebar } = useSidebar();

  return (
    <aside
      className={`hidden md:flex flex-col bg-[#0f172a] text-slate-200 min-h-screen border-r border-slate-800 transition-all duration-300 shrink-0 sticky top-0 h-screen z-30 ${
        collapsed ? 'w-[78px]' : 'w-[260px]'
      }`}
    >
      {/* Brand Header with Logo */}
      <div className="p-4 flex flex-col items-center justify-center border-b border-slate-800/80 relative min-h-[90px]">
        {!collapsed ? (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className="relative w-36 h-12">
              <Image
                src="/Logo.png"
                alt="La Finca Logo"
                fill
                priority
                className="object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)]"
              />
            </div>
            <p className="text-[11px] font-medium text-slate-400 tracking-wide uppercase">
              Control de Bodega
            </p>
          </div>
        ) : (
          <div className="relative w-10 h-10 py-1">
            <Image
              src="/Logo.png"
              alt="Logo"
              fill
              priority
              className="object-contain"
            />
          </div>
        )}

        {/* Floating Toggle Button */}
        <button
          onClick={toggleSidebar}
          title={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-md border-2 border-slate-900 transition-transform active:scale-95"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === '/bodeguero' && pathname === '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-orange-500 text-white font-semibold shadow-lg shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800/80 text-center">
        {!collapsed ? (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Sistema en Línea</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              La Finca 2026
            </p>
          </div>
        ) : (
          <span className="w-2 h-2 rounded-full bg-emerald-400 block mx-auto animate-pulse"></span>
        )}
      </div>
    </aside>
  );
}
