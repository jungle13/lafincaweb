'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Truck, 
  Boxes, 
  LayoutDashboard, 
  ShoppingCart, 
  DollarSign, 
  ChefHat, 
  UtensilsCrossed 
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Terminal Bodeguero', href: '/bodeguero', icon: Truck },
  { label: 'Inventario de Carnes', href: '/inventario', icon: Boxes },
  { label: 'Dashboard General', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Compras', href: '/compras', icon: ShoppingCart },
  { label: 'Ventas', href: '/ventas', icon: DollarSign },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-100 min-h-screen border-r border-slate-800 shrink-0">
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
          <UtensilsCrossed className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-base tracking-tight text-white">LA FINCA</h2>
          <p className="text-xs text-slate-400 font-medium">Control de Bodega & Carnes</p>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === '/bodeguero' && pathname === '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        Sistema La Finca 2026
      </div>
    </aside>
  );
}
