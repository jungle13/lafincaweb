'use client';

import { usePathname } from 'next/navigation';
import { Menu, User } from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';
import { useAuth } from '@/context/AuthContext';
import OperationalNotificationBell from '@/components/notifications/OperationalNotificationBell';

const VIEW_TITLES: Record<string, string> = {
  '/': 'Inicio',
  '/bodeguero': 'Terminal del Bodeguero',
  '/costeo-diario': 'Costeo Diario Cocina',
  '/libros-apoyo': 'Libros de Apoyo • Libro de Caja Menor',
  '/auditoria-cocina': 'Auditoría Cocina',
  '/recetas': 'Fichas Técnicas / Recetas',
  '/inventario': 'Inventario de Carnes',
  '/catalogo': 'Catálogo de Carnes e Insumos',
  '/ajustes': 'Inconsistencias y Ajustes',
  '/periodos': 'Control y Cierre de Periodos',
  '/dashboard': 'Dashboard General',
  '/compras': 'Entradas por Compra',
  '/ventas': 'Salidas por Venta',
  '/productos-venta': 'Productos Para la Venta',
};

export default function TopHeader() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();

  // Obtener el título según la ruta activa o formatear fallback
  const getModuleTitle = () => {
    if (VIEW_TITLES[pathname]) return VIEW_TITLES[pathname];
    const matchedKey = Object.keys(VIEW_TITLES).find(k => k !== '/' && pathname.startsWith(k));
    if (matchedKey) return VIEW_TITLES[matchedKey];
    
    const cleaned = pathname.replace('/', '').replace(/-/g, ' ');
    if (!cleaned) return 'Inicio';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const currentTitle = getModuleTitle();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 md:px-6 py-2.5 flex items-center justify-between shadow-2xs">
      {/* Botón de Menú y Título del Módulo */}
      <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          type="button"
          title="Mostrar/Ocultar Menú Lateral"
          className="p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight truncate">
          {currentTitle}
        </h1>
      </div>

      {/* Lado Derecho: Notificaciones + Perfil de Usuario con Nombre Dinámico */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0 select-none">
        {/* Campanita de Notificaciones del Día */}
        <OperationalNotificationBell />

        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <User className="w-4 h-4 text-slate-600" />
          </div>
          <span className="text-xs font-semibold text-slate-800">
            {user?.name || 'Usuario'}
          </span>
          <button
            onClick={logout}
            type="button"
            title="Cerrar sesión"
            className="ml-1 px-2 py-1 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
