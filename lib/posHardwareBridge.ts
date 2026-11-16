'use client';

import { useEffect, useRef } from 'react';

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

export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__);
}

async function invokeTauri<T = any>(cmd: string, args?: Record<string, any>): Promise<T | null> {
  if (!isTauriDesktop()) return null;
  try {
    const core = (window as any).__TAURI__?.core || (window as any).__TAURI_INTERNALS__;
    if (core?.invoke) {
      return await core.invoke(cmd, args);
    }
  } catch (err) {
    console.warn(`[TauriBridge] Error invocando comando ${cmd}:`, err);
  }
  return null;
}

/**
 * Construye el texto plano formateado para tirilla térmica de 80mm (42 columnas).
 */
export function formatThermalTicket80mm(ticket: ThermalTicketData): string {
  const line = '------------------------------------------';
  const lines: string[] = [
    '       RESTAURANTE LA FINCA               ',
    '       Choclos y Asados                   ',
    line,
    `${ticket.titulo.toUpperCase()}`,
    ticket.subtitulo ? ticket.subtitulo : '',
    `Doc: ${ticket.consecutivo}   Fecha: ${ticket.fecha}`,
    `Caja: ${ticket.caja}   Cajero: ${ticket.cajero}`,
    ticket.canal === 'SALON_MESA'
      ? `Canal: MESA ${ticket.mesaNumero || ''}`
      : ticket.canal === 'DOMICILIO'
        ? 'Canal: DOMICILIO'
        : 'Canal: PARA LLEVAR / MOSTRADOR',
  ].filter(Boolean);

  if (ticket.clienteNombre) {
    lines.push(`Cliente: ${ticket.clienteNombre}`);
  }
  if (ticket.clienteTelefono) {
    lines.push(`Tel: ${ticket.clienteTelefono}`);
  }
  if (ticket.clienteDireccion) {
    lines.push(`Dir: ${ticket.clienteDireccion}`);
  }

  lines.push(line);
  lines.push('CANT  DESCRIPCION                  TOTAL  ');
  lines.push(line);

  for (const it of ticket.items) {
    const qtyStr = String(it.cantidad).padEnd(5, ' ');
    const nameStr = it.nombre.slice(0, 24).padEnd(24, ' ');
    const totStr = `$${Math.round(it.subtotal).toLocaleString('es-CO')}`.padStart(12, ' ');
    lines.push(`${qtyStr} ${nameStr}${totStr}`);
    if (it.notas) {
      lines.push(`   * Nota: ${it.notas}`);
    }
  }

  lines.push(line);
  lines.push(`SUBTOTAL:        $${Math.round(ticket.subtotal).toLocaleString('es-CO')}`);
  if (ticket.descuento && ticket.descuento > 0) {
    lines.push(`DESCUENTO:      -$${Math.round(ticket.descuento).toLocaleString('es-CO')}`);
  }
  if (ticket.costoDomicilio && ticket.costoDomicilio > 0) {
    lines.push(`DOMICILIO:       $${Math.round(ticket.costoDomicilio).toLocaleString('es-CO')}`);
  }
  if (ticket.propina && ticket.propina > 0) {
    lines.push(`PROPINA VOL.:    $${Math.round(ticket.propina).toLocaleString('es-CO')}`);
  }
  lines.push(`TOTAL A PAGAR:   $${Math.round(ticket.total).toLocaleString('es-CO')}`);

  if (ticket.metodoPago) {
    lines.push(`Forma de Pago: ${ticket.metodoPago}`);
  }
  if (ticket.efectivoRecibido && ticket.efectivoRecibido > 0) {
    lines.push(`Recibido: $${Math.round(ticket.efectivoRecibido).toLocaleString('es-CO')}  Cambio: $${Math.round(ticket.cambio || 0).toLocaleString('es-CO')}`);
  }

  lines.push(line);
  lines.push(ticket.footer || '    Gracias por preferir La Finca!        ');
  lines.push('\n\n\n');

  return lines.join('\n');
}

/**
 * Imprime en impresora térmica vía Tauri Rust (TCP 9100 / USB) o abre impresión térmica 80mm en navegador.
 */
export async function printThermalTicket(
  ticket: ThermalTicketData,
  printerIp?: string
): Promise<{ ok: boolean; mode: 'tauri' | 'browser' }> {
  const rawText = formatThermalTicket80mm(ticket);

  if (isTauriDesktop()) {
    await invokeTauri('print_escpos_ticket', {
      printerIp: printerIp || '127.0.0.1:9100',
      content: rawText,
    });
    return { ok: true, mode: 'tauri' };
  }

  // Fallback limpio en navegador: ventana de impresión 80mm
  if (typeof window !== 'undefined') {
    const win = window.open('', '_blank', 'width=340,height=600');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>${ticket.titulo}</title>
            <style>
              @page { size: 80mm auto; margin: 2mm; }
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
 * Envía el pulso de apertura de cajón monedero (RJ11 conectado a la impresora térmica).
 */
export async function openCashDrawer(printerIp?: string): Promise<boolean> {
  if (isTauriDesktop()) {
    await invokeTauri('open_cash_drawer', {
      printerIp: printerIp || '127.0.0.1:9100',
    });
    return true;
  }
  return false;
}

/**
 * Lee peso en vivo desde una gramera serial conectada (Tauri Rust COM o WebSerial API en Chrome/Edge).
 */
export async function readScaleWeightOnce(portName: string = 'COM3'): Promise<number | null> {
  if (isTauriDesktop()) {
    const kg = await invokeTauri<number>('read_scale_weight', { portName });
    return typeof kg === 'number' ? kg : null;
  }

  // Soporte WebSerial API en navegadores Chromium
  try {
    const nav = navigator as any;
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
 * Hook global para pistolas lectoras de código de barras (USB HID / emulación teclado).
 * Captura ráfagas rápidas (< 45ms entre caracteres) terminadas en Enter.
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
          e.preventDefault();
          const scanned = bufferRef.current.trim();
          bufferRef.current = '';
          onScan(scanned);
          return;
        }
        bufferRef.current = '';
        return;
      }

      if (e.key.length === 1) {
        if (diff > 60 && !isInput) {
          bufferRef.current = e.key;
        } else if (diff <= 60) {
          bufferRef.current += e.key;
        } else {
          bufferRef.current = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, enabled]);
}
