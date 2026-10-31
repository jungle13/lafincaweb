'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, FileSpreadsheet, ShoppingCart, Bot } from 'lucide-react';

export default function MobileBottomBar() {
  const pathname = usePathname();

  // Ocultar barra inferior en /chat-bot y en el Portal Cajero hermético
  if (
    pathname?.startsWith('/chat-bot') ||
    pathname?.startsWith('/libros-apoyo/acceso') ||
    pathname?.startsWith('/libros-apoyo/cajero')
  ) {
    return null;
  }

  const NAV_ITEMS = [
    { label: 'Inicio', href: '/', icon: Home },
    { label: 'Ventas', href: '/ventas', icon: TrendingUp },
    { label: 'Costeo', href: '/costeo-diario', icon: FileSpreadsheet },
    { label: 'Compras', href: '/compras', icon: ShoppingCart },
    { label: 'Bot IA', href: '/chat-bot', icon: Bot },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-2.5 min-h-[48px] rounded-xl text-[11px] font-bold transition-all touch-manipulation active:scale-95 select-none ${
              isActive
                ? 'text-orange-500 font-extrabold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Icon className={`w-5 h-5 transition-transform ${isActive ? 'text-orange-500 stroke-[2.5] scale-110' : 'text-slate-400'}`} />
            <span className="leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
