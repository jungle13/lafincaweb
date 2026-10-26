'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  ShoppingCart, 
  Beef,
  PackageSearch,
  FileSpreadsheet,
  ClipboardCheck,
  BookOpen,
  X
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
    ],
  },
  {
    title: 'OPERACIONES DE COCINA',
    items: [
      { label: 'Costeo Diario Cocina', href: '/costeo-diario', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'AUDITORÍA & CONTROL',
    items: [
      { label: 'Auditoría Cocina', href: '/auditoria-cocina', icon: ClipboardCheck },
    ],
  },
  {
    title: 'CONFIGURACIÓN CATÁLOGO',
    items: [
      { label: 'Recetas', href: '/recetas', icon: BookOpen },
      { label: 'Catálogo de Carnes', href: '/catalogo', icon: Beef },
      { label: 'Insumos y Costos', href: '/insumos', icon: PackageSearch },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isOpen, closeSidebar } = useSidebar();

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
        {/* Header compacto: Logo a la izquierda sin márgenes excesivos y botón 'X' a la derecha */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-900/80 shrink-0">
          <div className="relative w-28 h-8">
            <Image
              src="/Logo.png"
              alt="La Finca Choclos y Asados"
              fill
              priority
              className="object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
            />
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

        {/* Menú de Navegación organizado en 4 secciones */}
        <nav className="flex-1 py-3 px-3 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              <div className="px-2 pt-1 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                {section.title}
              </div>

              {section.items.map((item, idx) => {
                const Icon = item.icon;
                const isExact = pathname === item.href;

                return (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={closeSidebar}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isExact
                        ? 'bg-orange-500/15 text-orange-400 font-semibold border-l-[3px] border-orange-500 rounded-l-none'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isExact ? 'text-orange-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
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
