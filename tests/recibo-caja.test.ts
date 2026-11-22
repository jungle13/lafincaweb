import { describe, it, expect } from 'vitest';
import {
  formatReciboCajaTicket,
  type ReciboCajaTicketData,
} from '@/lib/posHardwareBridge';
import { DEFAULT_ELIANA_POS_CONFIG } from '@/lib/posConfig';

const baseRecibo: ReciboCajaTicketData = {
  consecutivo: 'RC-00014',
  fecha: '2026-11-21',
  hora: '19:30',
  cajaNombre: 'CAJA PRINCIPAL',
  cajeroNombre: 'María',
  clasificacion: 'Costo / Insumo',
  categoria: 'CARNE DE RES',
  concepto: 'Punta de Anca fresca',
  beneficiario: 'Carnes del Valle',
  cantidad: 10,
  unidadMedida: 'Kg',
  costoUnitario: 32000,
  valor: 320000,
};

describe('formatReciboCajaTicket', () => {
  it('incluye consecutivo RC, detalle de insumo y líneas de firma en 80mm', () => {
    const out = formatReciboCajaTicket(baseRecibo, DEFAULT_ELIANA_POS_CONFIG);
    expect(out).toContain('RECIBO DE CAJA');
    expect(out).toContain('No. RC-00014');
    expect(out).toContain('Cant.: 10 Kg');
    expect(out).toContain('320.000');
    expect(out).toContain('Recibi conforme');
  });

  it('respeta máximo 32 columnas en 58mm e incluye nota de anticipo', () => {
    const anticipo: ReciboCajaTicketData = {
      ...baseRecibo,
      consecutivo: 'RC-00015',
      clasificacion: 'Préstamo / Anticipo',
      concepto: 'Anticipo quincena por calamidad',
      beneficiario: 'Carlos Andrés Pérez',
      cantidad: null,
      unidadMedida: null,
      costoUnitario: null,
      valor: 150000,
    };
    const cfg = { ...DEFAULT_ELIANA_POS_CONFIG, anchoTicketMm: 58 as const };
    const out = formatReciboCajaTicket(anticipo, cfg);
    expect(out).toContain('No. RC-00015');
    expect(out).toContain('anticipo/prestamo');
    const maxLen = Math.max(...out.split('\n').map((l) => l.length));
    expect(maxLen).toBeLessThanOrEqual(32);
  });
});
