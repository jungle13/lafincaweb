'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, User, Home } from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';
import { useAuth } from '@/context/AuthContext';
import OperationalNotificationBell from '@/components/notifications/OperationalNotificationBell';
import ElianaBrandLogo from '@/components/brand/ElianaBrandLogo';
import { getTerminalCajaNombre } from '@/lib/empresaConfig';
import { getColombiaDateStr } from '@/lib/dateUtils';

const VIEW_TITLES: Record<string, string> = {
  '/periodos': 'Gestión de Períodos Contables',
  '/': 'Inicio',
  '/costeo-diario': 'Hoja de Costeo Diario',
  '/libros-apoyo': 'Libro de Caja',
  '/auditoria-cocina': 'Auditoría Cocina',
  '/recetas': 'Fichas Técnicas / Recetas',
  '/inventario-consolidado': 'Inventario Consolidado Diario',
  '/catalogo': 'Catálogo de Insumos',
  '/compras': 'Entradas por Compra',
  '/ventas': 'Salidas por Venta',
  '/proveedores': 'Proveedores y Pagos',
  '/productos-venta': 'Productos de Venta',
  '/operarios': 'Gestión de Operarios',
  '/chat-bot': 'Historial Telegram Bot • Asistente IA',
};

export default function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.username?.toLowerCase() === 'admin';

  // El Portal Cajero / POS es una interfaz hermética: no muestra header administrativo
  const isCajeroPortal =
    pathname?.startsWith('/libros-apoyo/acceso') ||
    pathname?.startsWith('/libros-apoyo/cajero') ||
    pathname?.startsWith('/pos');

  if (isCajeroPortal) return null;

  const getModuleTitle = () => {
    if (VIEW_TITLES[pathname]) return VIEW_TITLES[pathname];
    const matchedKey = Object.keys(VIEW_TITLES)
      .sort((a, b) => b.length - a.length)
      .find((k) => k !== '/' && pathname.startsWith(k));
    if (matchedKey) return VIEW_TITLES[matchedKey];

    const cleaned = pathname.replace('/', '').replace(/-/g, ' ');
    if (!cleaned) return 'Inicio';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const currentTitle = getModuleTitle();

  const handleLogout = async () => {
    // Verificar si existe un turno de caja abierto en este equipo antes de cerrar sesión
    try {
      const caja = getTerminalCajaNombre();
      const fecha = getColombiaDateStr();
      const res = await fetch(`/api/pos?fecha=${encodeURIComponent(fecha)}&caja=${encodeURIComponent(caja)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const sesionAbierta = data?.sesionActiva;
        if (sesionAbierta && sesionAbierta.estado === 'ABIERTA') {
          router.push('/pos?tab=CORTE&forceClose=1');
          return;
        }
      }
    } catch {
      // Continuar cierre de sesión si no se pudo consultar
    }

    await logout();
    router.replace('/');
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-3 md:px-6 py-2.5 flex items-center justify-between shadow-2xs">
      {/* Lado Izquierdo: Botón Menú (solo ADMIN) + Logo + Título del Módulo */}
      <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
        {isAdmin ? (
          <button
            onClick={toggleSidebar}
            type="button"
            title="Mostrar/Ocultar Menú Lateral"
            className="p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        ) : (
          pathname !== '/' && (
            <Link
              href="/"
              title="Volver a Inicio"
              className="p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            >
              <Home className="w-4 h-4" />
            </Link>
          )
        )}

        <Link
          href="/"
          title="Ir a Inicio"
          className="group flex items-center gap-2.5 min-w-0 hover:opacity-85 transition-opacity"
        >
          <ElianaBrandLogo variant="auto" theme="light" size="sm" />
          {pathname !== '/' && (
            <>
              <span className="h-4 w-px bg-slate-200 hidden sm:inline-block" />
              <h1 className="text-xs md:text-sm font-semibold text-slate-700 tracking-tight truncate group-hover:text-blue-600 transition-colors">
                {currentTitle}
              </h1>
            </>
          )}
        </Link>
      </div>

      {/* Lado Derecho: Notificaciones (solo ADMIN) + Perfil de Usuario */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0 select-none">
        {isAdmin && (
          <>
            <OperationalNotificationBell />
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
          </>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
          </div>
          <span className="hidden sm:inline text-xs font-semibold text-slate-800">
            {user?.name || 'Usuario'}
          </span>
          <button
            onClick={handleLogout}
            type="button"
            title="Cerrar sesión"
            className="ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-1 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer font-medium whitespace-nowrap"
          >
            <span className="sm:hidden">Salir</span>
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
}
