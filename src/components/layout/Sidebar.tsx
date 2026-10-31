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

  // El Portal Cajero es una interfaz totalmente hermética: no tiene sidebar
  const isCajeroPortal =
    pathname?.startsWith('/libros-apoyo/acceso') ||
    pathname?.startsWith('/libros-apoyo/cajero');

  if (isCajeroPortal) return null;

  return (
    <>
      {/* Backdrop con oscurecimiento suave */}
      <div
        onClick={closeSidebar}
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      />

      {/* Drawer con fondo azul oscuro original (#050811) y ancho estético compacto (235px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#050811] text-slate-300 border-r border-slate-900/80 shadow-2xl transition-transform duration-300 ease-in-out w-[235px] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header: Botón Hamburguesa + Mazorquita blanca + FINCA */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-slate-900/80 shrink-0 bg-[#050811]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={closeSidebar}
              title="Cerrar menú"
              className="p-1.5 -ml-0.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900/80 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo Oficial de La Finca SVG (E:\RESTAURANTE LA FINCA\SVG\Recurso 1.svg) */}
            <Link
              href="/"
              onClick={closeSidebar}
              title="Ir a Principal"
              className="flex items-center select-none hover:opacity-90 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/rf2.png"
                alt="La Finca Choclos y Asados"
                className="h-7 w-auto object-contain max-w-[120px]"
              />
            </Link>
          </div>

          <button
            type="button"
            onClick={closeSidebar}
            title="Cerrar menú"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-900/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menú de Navegación: tamaño text-xs original, espaciado fino, divisores limpios, selección y hover naranja */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-2">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div
              key={sIdx}
              className={sIdx > 0 ? 'border-t border-slate-800/80 pt-2.5 mt-2.5 space-y-1' : 'space-y-1'}
            >
              {section.title !== 'GENERAL' && (
                <div className="px-2.5 pt-0.5 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  {section.title}
                </div>
              )}

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
                    className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-[12px] font-normal transition-all select-none ${
                      isActive
                        ? 'bg-orange-500/15 text-orange-400 font-semibold border-l-[3px] border-orange-500 rounded-l-none'
                        : 'text-slate-400 hover:text-orange-300 hover:bg-orange-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-orange-400'
                            : 'text-slate-400 group-hover:text-orange-300'
                        }`}
                      />
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

        {/* Footer original con fondo azul oscuro */}
        <div className="p-3 px-4 border-t border-slate-900/80 text-left space-y-1 shrink-0 bg-[#050811]">
          <div className="flex items-center gap-1.5 text-[11px] font-normal text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span>Supabase Conectado</span>
          </div>
          <p className="text-[10px] text-slate-500 font-normal leading-tight">
            La Finca Choclos y Asados • 2026
          </p>
        </div>
      </aside>
    </>
  );
}
