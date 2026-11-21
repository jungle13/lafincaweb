'use client';

import { useEffect, useRef } from 'react';
import {
  loadElianaPosConfig,
  type ElianaPosConfig,
  type ModeloBascula,
  type ModeloCajon,
} from '@/lib/posConfig';

export interface ThermalTicketData {
  titulo: string;
  subtitulo?: string;
  consecutivo: string;
  fecha: string;
  caja: string;
  cajero: string;
  canal: 'SALON_MESA' | 'DOMICILIO' | 'MOSTRADOR_LLEVAR';
  mesaNumero?: number | null;
  clienteNombre?: string | null;
  clienteTelefono?: string | null;
  clienteDireccion?: string | null;
  items: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    notas?: string | null;
  }>;
  subtotal: number;
  descuento?: number;
  propina?: number;
  costoDomicilio?: number;
  total: number;
  metodoPago?: string;
  efectivoRecibido?: number;
  cambio?: number;
  footer?: string;
}

interface TauriWindowLike {
  __TAURI__?: {
    core?: {
      invoke?: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
  };
  __TAURI_INTERNALS__?: {
    invoke?: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  };
}

export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as TauriWindowLike;
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

async function invokeTauri<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!isTauriDesktop()) return { ok: false, error: 'Entorno web sin puente Tauri' };
  try {
    const w = window as unknown as TauriWindowLike;
    const core = w.__TAURI__?.core || w.__TAURI_INTERNALS__;
    if (core?.invoke) {
      const data = await core.invoke<T>(cmd, args);
      return { ok: true, data };
    }
    return { ok: false, error: 'Bridge Tauri no disponible' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ElianaBridge] Error invocando comando ${cmd}:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Construye el texto plano formateado para tirilla térmica de 80mm (42 col) o 58mm (32 col),
 * usando exclusivamente la identidad comercial configurada por el usuario (cero textos quemados).
 */
export function formatThermalTicket(
  ticket: ThermalTicketData,
  configOverride?: ElianaPosConfig
): string {
  const cfg = configOverride || loadElianaPosConfig();
  const cols = cfg.anchoTicketMm === 58 ? 32 : 42;
  const line = '-'.repeat(cols);
  const center = (txt: string) => {
    const clean = txt.slice(0, cols);
    const pad = Math.max(0, Math.floor((cols - clean.length) / 2));
    return ' '.repeat(pad) + clean;
  };

  const lines: string[] = [
    center(cfg.nombreComercial || 'Eliana POS'),
    cfg.subtituloComercial ? center(cfg.subtituloComercial) : '',
    cfg.nit ? center(`NIT: ${cfg.nit}`) : '',
    cfg.direccion ? center(cfg.direccion) : '',
    cfg.telefono ? center(`Tel: ${cfg.telefono}`) : '',
    line,
    ticket.titulo.toUpperCase(),
    ticket.subtitulo || '',
    `Doc: ${ticket.consecutivo}`,
    `Fecha: ${ticket.fecha}`,
    `Caja: ${ticket.caja} | Cajero: ${ticket.cajero}`,
    ticket.canal === 'SALON_MESA'
      ? `Canal: MESA ${ticket.mesaNumero || ''}`
      : ticket.canal === 'DOMICILIO'
        ? 'Canal: DOMICILIO'
        : 'Canal: MOSTRADOR',
  ].filter(Boolean);

  if (ticket.clienteNombre) lines.push(`Cliente: ${ticket.clienteNombre}`);
  if (ticket.clienteTelefono) lines.push(`Tel: ${ticket.clienteTelefono}`);
  if (ticket.clienteDireccion) lines.push(`Dir: ${ticket.clienteDireccion}`);

  lines.push(line);
  lines.push(cols === 32 ? 'CANT DESCRIPCION         TOTAL' : 'CANT  DESCRIPCION                  TOTAL');
  lines.push(line);

  const nameWidth = cols === 32 ? 15 : 24;
  for (const it of ticket.items) {
    const qtyStr = String(it.cantidad).padEnd(cols === 32 ? 4 : 5, ' ');
    const nameStr = it.nombre.slice(0, nameWidth).padEnd(nameWidth, ' ');
    const totStr = `$${Math.round(it.subtotal).toLocaleString('es-CO')}`.padStart(
      cols - qtyStr.length - nameStr.length,
      ' '
    );
    lines.push(`${qtyStr}${nameStr}${totStr}`);
    if (it.notas) {
      lines.push(`  * ${it.notas}`);
    }
  }

  lines.push(line);
  lines.push(`SUBTOTAL:      $${Math.round(ticket.subtotal).toLocaleString('es-CO')}`);
  if (ticket.descuento && ticket.descuento > 0) {
    lines.push(`DESCUENTO:    -$${Math.round(ticket.descuento).toLocaleString('es-CO')}`);
  }
  if (ticket.costoDomicilio && ticket.costoDomicilio > 0) {
    lines.push(`DOMICILIO:     $${Math.round(ticket.costoDomicilio).toLocaleString('es-CO')}`);
  }
  if (ticket.propina && ticket.propina > 0) {
    lines.push(`PROPINA:       $${Math.round(ticket.propina).toLocaleString('es-CO')}`);
  }
  lines.push(`TOTAL:         $${Math.round(ticket.total).toLocaleString('es-CO')}`);

  if (ticket.metodoPago) {
    lines.push(`PAGO: ${ticket.metodoPago}`);
  }
  if (ticket.efectivoRecibido && ticket.efectivoRecibido > 0) {
    lines.push(`RECIBIDO:      $${Math.round(ticket.efectivoRecibido).toLocaleString('es-CO')}`);
    lines.push(`CAMBIO:        $${Math.round(ticket.cambio || 0).toLocaleString('es-CO')}`);
  }

  lines.push(line);
  lines.push(center(ticket.footer || cfg.mensajePieTicket || '¡Gracias por su compra!'));

  const fitted = lines.flatMap((l) => {
    if (l.length <= cols) return [l];
    const chunks: string[] = [];
    for (let i = 0; i < l.length; i += cols) {
      chunks.push(l.slice(i, i + cols));
    }
    return chunks;
  });
  fitted.push('\n\n\n');

  return fitted.join('\n');
}

/**
 * Envía el ticket a la impresora térmica nativa en Tauri o usa diálogo de impresión del navegador.
 */
export async function printThermalTicket(
  ticket: ThermalTicketData,
  printerIpOverride?: string
): Promise<{ ok: boolean; mode: 'tauri' | 'browser'; error?: string; rawText?: string }> {
  const cfg = loadElianaPosConfig();
  const rawText = formatThermalTicket(ticket, cfg);
  const printerIp = printerIpOverride || cfg.ipImpresora || '127.0.0.1:9100';

  if (isTauriDesktop()) {
    const res = await invokeTauri<string>('print_escpos_ticket', {
      printerIp,
      content: rawText,
    });
    if (res.ok) return { ok: true, mode: 'tauri' };
    return { ok: false, mode: 'tauri', error: res.error, rawText };
  }

  if (typeof window !== 'undefined') {
    const win = window.open('', '_blank', 'width=340,height=600');
    if (win) {
      const mm = cfg.anchoTicketMm || 80;
      win.document.write(`
        <html>
          <head>
            <title>${ticket.titulo}</title>
            <style>
              @page { size: ${mm}mm auto; margin: 2mm; }
              body { font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; margin: 0; padding: 6px; }
            </style>
          </head>
          <body>${rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
        </html>
      `);
      win.document.close();
    }
  }
  return { ok: true, mode: 'browser' };
}

/**
 * Envía el pulso de apertura de cajón monedero según el perfil de impresora configurado.
 */
export async function openCashDrawer(
  printerIpOverride?: string,
  modelOverride?: ModeloCajon
): Promise<{ ok: boolean; error?: string }> {
  const cfg = loadElianaPosConfig();
  if (isTauriDesktop()) {
    const res = await invokeTauri('open_cash_drawer', {
      printerIp: printerIpOverride || cfg.ipImpresora || '127.0.0.1:9100',
      model: modelOverride || cfg.modeloCajon || 'EPSON_STD',
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }
  return { ok: false, error: 'Disponible solo en aplicativo de escritorio' };
}

/**
 * Lee peso en vivo desde una gramera serial (Torrey, Rhino, CAS, Kretz o WebSerial).
 */
export async function readScaleWeightOnce(
  portNameOverride?: string,
  modelOverride?: ModeloBascula
): Promise<number | null> {
  const cfg = loadElianaPosConfig();
  const portName = portNameOverride || cfg.puertoBascula || 'COM3';
  const model = modelOverride || cfg.modeloBascula || 'TORREY_MFQ';

  if (isTauriDesktop()) {
    const res = await invokeTauri<number>('read_scale_weight', { portName, model });
    return res.ok && typeof res.data === 'number' ? res.data : null;
  }

  try {
    const nav = navigator as unknown as {
      serial?: {
        requestPort: () => Promise<{
          open: (opts: { baudRate: number }) => Promise<void>;
          readable: { getReader: () => { read: () => Promise<{ value?: Uint8Array }>; releaseLock: () => void } };
          close: () => Promise<void>;
        }>;
      };
    };
    if (nav?.serial?.requestPort) {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 9600 });
      const reader = port.readable.getReader();
      const { value } = await reader.read();
      reader.releaseLock();
      await port.close();
      if (value) {
        const text = new TextDecoder().decode(value);
        const match = text.match(/(\d+(?:\.\d+)?)/);
        if (match) return parseFloat(match[1]);
      }
    }
  } catch (err) {
    console.warn('[WebSerial] No se pudo leer gramera:', err);
  }
  return null;
}

/**
 * Puente LAN Multi-Caja: obtiene la IP local del PC principal y sincroniza con el servidor LAN Rust (:4545).
 */
export async function getLocalLanIp(): Promise<string> {
  if (isTauriDesktop()) {
    const res = await invokeTauri<string>('get_local_ip');
    if (res.ok && res.data) return res.data;
  }
  return '127.0.0.1';
}

export function normalizeLanBaseUrl(ipCajaPrincipal: string): string {
  const clean = (ipCajaPrincipal || '127.0.0.1:4545').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const withPort = clean.includes(':') ? clean : `${clean}:4545`;
  return `http://${withPort}`;
}

export async function checkLanHealth(ipCajaPrincipal: string): Promise<boolean> {
  try {
    const res = await fetch(`${normalizeLanBaseUrl(ipCajaPrincipal)}/lan/health`, {
      signal: AbortSignal.timeout(1800),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function lanSyncSnapshot(ipCajaPrincipal: string, snapshot: unknown): Promise<void> {
  try {
    await fetch(`${normalizeLanBaseUrl(ipCajaPrincipal)}/lan/sync-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // ignore if LAN server is not active (e.g. web browser mode)
  }
}

export async function lanGetState<T = Record<string, unknown>>(ipCajaPrincipal: string): Promise<T | null> {
  try {
    const res = await fetch(`${normalizeLanBaseUrl(ipCajaPrincipal)}/lan/state`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function lanPostAction<T = Record<string, unknown>>(
  ipCajaPrincipal: string,
  payload: Record<string, unknown>
): Promise<T | null> {
  try {
    const res = await fetch(`${normalizeLanBaseUrl(ipCajaPrincipal)}/lan/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Hook global para pistolas lectoras de código de barras (USB HID / emulación teclado).
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef('');
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      const now = Date.now();
      const diff = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3 && diff < 120) {
          const code = bufferRef.current.trim();
          bufferRef.current = '';
          if (!isInput) {
            e.preventDefault();
          }
          onScan(code);
          return;
        }
        bufferRef.current = '';
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (diff > 80) {
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, enabled]);
}

export interface DesktopDiagnostics {
  localIp: string;
  lanServerRunning: boolean;
  lanPort: number;
  lanBindError: string | null;
  lanStorePath: string;
  pendingOpsCount: number;
  stateFileBytes: number;
  serialPorts: string[];
}

export async function getDesktopDiagnostics(): Promise<
  { ok: true; data: DesktopDiagnostics } | { ok: false; error: string }
> {
  return invokeTauri<DesktopDiagnostics>('get_desktop_diagnostics');
}

export async function testPrinterConnection(
  printerIp: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const cleanIp = (printerIp || '').trim();
  if (!cleanIp) {
    return { ok: false, error: 'No hay IP de impresora configurada.' };
  }
  const res = await invokeTauri<string>('test_printer_connection', { printerIp: cleanIp });
  if (res.ok) {
    return { ok: true, message: res.data };
  }
  return { ok: false, error: res.error };
}
