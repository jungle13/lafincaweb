export interface EmpresaConfig {
  id: number;
  nombre_comercial: string;
  pos_nombre: string;
  subtitulo: string;
  propietario: string;
  nit: string;
  direccion: string;
  telefono: string;
  logo_url: string;
  impuesto_nombre: string;
  impuesto_pct: number;
  moneda: string;
}

export const DEFAULT_EMPRESA_CONFIG: EmpresaConfig = {
  id: 1,
  nombre_comercial: process.env.NEXT_PUBLIC_EMPRESA_NOMBRE || 'ELIANA',
  pos_nombre: process.env.NEXT_PUBLIC_POS_NOMBRE || 'ELIANA POS',
  subtitulo: process.env.NEXT_PUBLIC_EMPRESA_SUBTITULO || 'Sistema de Gestión y Costeo',
  propietario: process.env.NEXT_PUBLIC_EMPRESA_PROPIETARIO || '',
  nit: process.env.NEXT_PUBLIC_EMPRESA_NIT || '',
  direccion: process.env.NEXT_PUBLIC_EMPRESA_DIRECCION || '',
  telefono: process.env.NEXT_PUBLIC_EMPRESA_TELEFONO || '',
  logo_url: '',
  impuesto_nombre: 'Impoconsumo',
  impuesto_pct: 8,
  moneda: 'COP',
};

export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }).__TAURI__ ||
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  );
}

export function getTerminalCajaNombre(): string {
  if (typeof window === 'undefined') return 'Caja Principal';
  try {
    return localStorage.getItem('eliana_pos_terminal_caja') || 'Caja Principal';
  } catch {
    return 'Caja Principal';
  }
}

export function formatDurationHMS(startedAtIso: string | null | undefined, nowMs = Date.now()): string {
  if (!startedAtIso) return '00:00:00';
  const startMs = new Date(startedAtIso).getTime();
  if (!Number.isFinite(startMs)) return '00:00:00';
  const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatMinutesHuman(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes) || totalMinutes < 0) return '—';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hrs <= 0) return `${mins} min`;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}
