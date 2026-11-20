'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getTerminalCajaNombre, isTauriDesktop } from '@/lib/empresaConfig';
import { getColombiaDateStr } from '@/lib/dateUtils';

const GESTOR_ALLOWED_PREFIXES = [
  '/',
  '/pos',
  '/libros-apoyo',
  '/compras',
  '/ventas',
  '/proveedores',
  '/catalogo',
  '/productos-venta',
  '/recetas',
  '/costeo-diario',
  '/inventario-consolidado',
  '/auditoria-cocina',
  '/operarios',
];

const OPERATIVO_ALLOWED_PREFIXES = ['/', '/pos', '/libros-apoyo'];

function isPathAllowed(pathname: string, prefixes: string[]): boolean {
  if (pathname === '/') return true;
  return prefixes.some((prefix) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`)));
}

async function syncTauriShiftFlag(isOpen: boolean) {
  if (!isTauriDesktop()) return;
  try {
    const tauri = (window as unknown as { __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } } }).__TAURI__;
    if (tauri?.core?.invoke) {
      await tauri.core.invoke('set_open_shift_state', { isOpen });
    }
  } catch {
    // Silencioso en caso de entorno sin Tauri
  }
}

export default function DesktopCloseGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  // 1. Guardia de rutas por rol (OPERATIVO_POS y GESTOR)
  useEffect(() => {
    if (!isAuthenticated || !user || !pathname) return;
    if (user.role === 'ADMIN' || user.username.toLowerCase() === 'admin') return;

    const allowed = user.role === 'OPERATIVO_POS' ? OPERATIVO_ALLOWED_PREFIXES : GESTOR_ALLOWED_PREFIXES;
    if (!isPathAllowed(pathname, allowed)) {
      router.replace('/');
    }
  }, [isAuthenticated, user, pathname, router]);

  // 2. Sincronizar estado de turno abierto del equipo actual con Tauri Rust + beforeunload
  useEffect(() => {
    if (!isAuthenticated) {
      void syncTauriShiftFlag(false);
      return;
    }

    let shiftOpenRef = false;
    let active = true;

    const checkShift = async () => {
      try {
        const caja = getTerminalCajaNombre();
        const fecha = getColombiaDateStr();
        const res = await fetch(`/api/pos?fecha=${encodeURIComponent(fecha)}&caja=${encodeURIComponent(caja)}`, {
          cache: 'no-store',
        });
        if (!res.ok || !active) return;
        const data = await res.json();
        const open = Boolean(data?.sesionActiva && data.sesionActiva.estado === 'ABIERTA');
        shiftOpenRef = open;
        await syncTauriShiftFlag(open);
      } catch {
        // Ignorar error de red transitorio
      }
    };

    void checkShift();
    const interval = setInterval(checkShift, 30000);

    const handleShiftEvent = (ev: Event) => {
      const custom = ev as CustomEvent<{ isOpen: boolean }>;
      const open = Boolean(custom?.detail?.isOpen);
      shiftOpenRef = open;
      void syncTauriShiftFlag(open);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shiftOpenRef) {
        e.preventDefault();
        e.returnValue = 'Tienes un turno de caja abierto en este equipo. Debes realizar cierre parcial o total antes de salir.';
      }
    };

    window.addEventListener('eliana-shift-state-changed', handleShiftEvent);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 3. Escuchar evento nativo de cierre de ventana Tauri ("eliana-close-requested")
    let unlistenFn: (() => void) | null = null;
    if (isTauriDesktop()) {
      const tauri = (window as unknown as {
        __TAURI__?: {
          event?: {
            listen?: (event: string, cb: () => void) => Promise<() => void>;
          };
        };
      }).__TAURI__;
      if (tauri?.event?.listen) {
        tauri.event
          .listen('eliana-close-requested', () => {
            router.push('/pos?tab=CORTE&forceClose=1');
          })
          .then((unlisten) => {
            unlistenFn = unlisten;
          })
          .catch(() => {});
      }
    }

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('eliana-shift-state-changed', handleShiftEvent);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (unlistenFn) unlistenFn();
    };
  }, [isAuthenticated, router]);

  return null;
}
