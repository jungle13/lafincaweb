import { isTauriDesktop } from './empresaConfig';

const DEVICE_ID_KEY = 'eliana_pos_device_id';
const TERMINAL_CAJA_KEY = 'eliana_pos_terminal_caja';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `pc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `pc-${Date.now()}`;
  }
}

export async function getLocalIpAddress(): Promise<string> {
  if (typeof window === 'undefined') return '';
  if (isTauriDesktop()) {
    try {
      const tauri = (window as unknown as {
        __TAURI__?: { core?: { invoke?: (cmd: string) => Promise<string> } };
      }).__TAURI__;
      if (tauri?.core?.invoke) {
        const ip = await tauri.core.invoke('get_local_ip');
        if (ip) return String(ip).trim();
      }
    } catch {
      // Silencioso
    }
  }
  return 'WEB';
}

export function setBoundTerminalCajaNombre(nombre: string) {
  if (typeof window === 'undefined' || !nombre) return;
  try {
    localStorage.setItem(TERMINAL_CAJA_KEY, nombre);
  } catch {
    // ignore
  }
}
