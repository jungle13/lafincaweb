import { describe, it, expect } from 'vitest';
import { formatThermalTicket, type ThermalTicketData } from '@/lib/posHardwareBridge';
import { DEFAULT_ELIANA_POS_CONFIG } from '@/lib/posConfig';

const sampleTicket: ThermalTicketData = {
  titulo: 'FACTURA DE VENTA',
  consecutivo: 'POS-0042',
  fecha: '2026-11-21 12:30',
  caja: 'Caja Principal',
  cajero: 'María',
  canal: 'SALON_MESA',
  mesaNumero: 5,
  items: [
    {
      nombre: 'Punta de Anca 350g',
      cantidad: 2,
      precioUnitario: 48000,
      subtotal: 96000,
      notas: 'Término medio',
    },
  ],
  subtotal: 96000,
  propina: 9600,
  total: 105600,
  metodoPago: 'EFECTIVO',
  efectivoRecibido: 110000,
  cambio: 4400,
};

describe('formatThermalTicket', () => {
  it('formatea tirilla de 80mm (42 columnas) con totales y nombre configurado', () => {
    const cfg = {
      ...DEFAULT_ELIANA_POS_CONFIG,
      nombreComercial: 'La Finca Asados',
      anchoTicketMm: 80 as const,
    };
    const out = formatThermalTicket(sampleTicket, cfg);
    expect(out).toContain('La Finca Asados');
    expect(out).toContain('POS-0042');
    expect(out).toContain('Punta de Anca 350g');
    expect(out).toContain('105.600');
    expect(out).toContain('4.400');
  });

  it('respeta ancho máximo de 32 caracteres por línea en modo 58mm', () => {
    const cfg = {
      ...DEFAULT_ELIANA_POS_CONFIG,
      nombreComercial: 'Restaurante Prueba Largo',
      anchoTicketMm: 58 as const,
    };
    const out = formatThermalTicket(sampleTicket, cfg);
    const maxLineLen = Math.max(...out.split('\n').map((l) => l.length));
    expect(maxLineLen).toBeLessThanOrEqual(32);
  });
});
