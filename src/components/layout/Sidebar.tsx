'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu,
  X,
  Home,
  ShoppingCart, 
  Beef,
  FileSpreadsheet,
  ClipboardCheck,
  BookOpen,
  TrendingUp,
  UtensilsCrossed,
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
    title: 'GENERAL',
    items: [
      { label: 'Principal', href: '/', icon: Home },
    ],
  },
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
      { label: 'Productos de Venta', href: '/productos-venta', icon: UtensilsCrossed },
      { label: 'Fichas y Recetas', href: '/recetas', icon: BookOpen },
      { label: 'Catálogo de Insumos', href: '/catalogo', icon: Beef },
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
      {/* Backdrop con oscurecimiento suave */}
      <div
        onClick={closeSidebar}
        className={`fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      />

      {/* Drawer estilo YouTube: más estrecho (235px), minimalista y tipográfico */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0f0f0f] text-[#f1f1f1] border-r border-[#272727] shadow-2xl transition-transform duration-300 ease-in-out w-[235px] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header estilo YouTube: Icono Menú + LA FINCA en texto limpio y serio */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-[#272727] shrink-0 bg-[#0f0f0f]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={closeSidebar}
              title="Cerrar menú"
              className="p-2 -ml-0.5 rounded-full text-[#f1f1f1] hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Texto LA FINCA con F ligeramente más alta, tipografía seria y limpia */}
            <Link
              href="/"
              onClick={closeSidebar}
              title="Ir a inicio"
              className="flex items-baseline select-none hover:opacity-90 transition-opacity"
            >
              <span className="text-[12.5px] font-bold text-neutral-400 tracking-wider mr-1.5 font-sans">
                LA
              </span>
              <span className="text-[22px] font-black text-white font-sans tracking-tight leading-none">
                F
              </span>
              <span className="text-[16px] font-extrabold text-white font-sans tracking-wide">
                INCA
              </span>
            </Link>
          </div>

          <button
            type="button"
            onClick={closeSidebar}
            title="Cerrar menú"
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menú de Navegación estilo YouTube: pills con esquinas suaves y espaciado compacto */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto space-y-1">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className={sIdx > 0 ? 'border-t border-[#272727] pt-2 mt-2' : ''}>
              {section.title !== 'GENERAL' && (
                <div className="px-3 pt-1 pb-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider select-none">
                  {section.title}
                </div>
              )}

              <div className="space-y-0.5">
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
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-[13px] transition-colors select-none ${
                        isActive
                          ? 'bg-white/[0.14] text-white font-semibold'
                          : 'text-[#f1f1f1]/85 hover:bg-white/[0.08] hover:text-white font-normal'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white stroke-[2.2]' : 'text-neutral-300'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {isPending && !isExact && (
                        <Loader2 className="w-3.5 h-3.5 text-neutral-300 animate-spin shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer compacto y sutil estilo YouTube */}
        <div className="p-3 px-3.5 border-t border-[#272727] text-left space-y-0.5 shrink-0 bg-[#0f0f0f]">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span>Supabase Conectado</span>
          </div>
          <p className="text-[10px] text-neutral-500 font-normal">
            La Finca Choclos y Asados • 2026
          </p>
        </div>
      </aside>
    </>
  );
}
