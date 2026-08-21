'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, Boxes, LayoutDashboard, ShoppingCart } from 'lucide-react';

export default function MobileBottomBar() {
  const pathname = usePathname();

  const NAV_ITEMS = [
    { label: 'Bodeguero', href: '/bodeguero', icon: Truck },
    { label: 'Inventario', href: '/inventario', icon: Boxes },
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Compras', href: '/compras', icon: ShoppingCart },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl safe-area-pb">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href === '/bodeguero' && pathname === '/');

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-[11px] font-bold transition-all ${
              isActive
                ? 'text-orange-500 scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-orange-500 stroke-[2.5]' : 'text-slate-400'}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
