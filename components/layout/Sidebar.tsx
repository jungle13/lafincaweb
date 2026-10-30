'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShoppingCart, 
  Beef,
  FileSpreadsheet,
  ClipboardCheck,
  BookOpen,
  TrendingUp,
  UtensilsCrossed,
  X,
  Loader2,
  Wallet,
  Bot
} from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';

interface NavSection {
  title: string;
  items: {
    label: string;
    href: string;
    icon: any;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'INVENTARIO & BODEGA',
    items: [
      { label: 'Entradas por Compra', href: '/compras', icon: ShoppingCart },
      { label: 'Salidas por Venta', href: '/ventas', icon: TrendingUp },
    ],
  },
  {
    title: 'OPERACIONES DE COCINA',
    items: [
      { label: 'Costeo Diario Cocina', href: '/costeo-diario', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'LIBROS DE APOYO',
    items: [
      { label: 'Libro de Caja Menor', href: '/libros-apoyo', icon: Wallet },
    ],
  },
  {
    title: 'AUDITORÍA & ASISTENTE IA',
    items: [
      { label: 'Auditoría Cocina', href: '/auditoria-cocina', icon: ClipboardCheck },
      { label: 'Historial Telegram Bot', href: '/chat-bot', icon: Bot },
    ],
  },
  {
    title: 'CONFIGURACIÓN CATÁLOGO',
    items: [
      { label: 'Productos Para la Venta', href: '/productos-venta', icon: UtensilsCrossed },
      { label: 'Recetas', href: '/recetas', icon: BookOpen },
      { label: 'Catálogo de Carnes e Insumos', href: '/catalogo', icon: Beef },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isOpen, closeSidebar } = useSidebar();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Limpiar pendingHref cuando cambia la ruta
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <>
      {/* Backdrop con oscurecimiento suave (Estilo Drawer GitHub) */}
      <div
        onClick={closeSidebar}
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      />

      {/* Drawer Overlay: se desliza por encima y desaparece al contraerlo */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#050811] text-slate-300 border-r border-slate-900/80 shadow-2xl transition-transform duration-300 ease-in-out w-[270px] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header: Logo vectorizado y botón 'X' de cierre */}
        <div className="py-2.5 px-4 flex items-center justify-between border-b border-slate-900/80 shrink-0 min-h-[60px]">
          <Link href="/" onClick={closeSidebar} className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Logo_Letras_Vectorizadas.svg"
              alt="La Finca Choclos y Asados"
              className="w-[160px] max-w-[185px] h-auto max-h-12 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
            />
          </Link>

          <button
            type="button"
            onClick={closeSidebar}
            title="Cerrar menú"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-900/80 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menú de Navegación organizado en secciones */}
        <nav className="flex-1 py-3 px-3 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              <div className="px-2 pt-1 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                {section.title}
              </div>

              {section.items.map((item, idx) => {
                const Icon = item.icon;
                const isExact = pathname === item.href;
                const isPending = pendingHref === item.href;
                const isActive = isExact || isPending;

                return (
                  <Link
                    key={idx}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      if (!isExact) {
                        setPendingHref(item.href);
                      }
                      closeSidebar();
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-orange-500/15 text-orange-400 font-semibold border-l-[3px] border-orange-500 rounded-l-none'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-orange-400' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {isPending && !isExact && (
                      <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer compacto */}
        <div className="p-3 px-4 border-t border-slate-900/80 text-left space-y-1 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-normal text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span>Supabase Conectado</span>
          </div>
          <p className="text-[10px] text-slate-500 font-normal leading-tight">
            Elaborado por: Eliana Garces 2026
          </p>
        </div>
      </aside>
    </>
  );
}
