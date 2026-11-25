import { describe, it, expect } from 'vitest';

function calcularOrdenTotal(params: {
  items: Array<{ cantidad: number; precio_unitario: number; anulado?: boolean }>;
  descuento?: number;
  propina?: number;
  costoDomicilio?: number;
}) {
  const subtotalBruto = params.items
    .filter((i) => !i.anulado)
    .reduce((acc, i) => acc + Math.max(0, i.cantidad) * Math.max(0, i.precio_unitario), 0);

  const descuento = Math.max(0, Math.round(params.descuento || 0));
  const propina = Math.max(0, Math.round(params.propina || 0));
  const domicilio = Math.max(0, Math.round(params.costoDomicilio || 0));
  const granTotal = Math.max(0, Math.round(subtotalBruto - descuento + propina + domicilio));

  return { subtotalBruto: Math.round(subtotalBruto), granTotal };
}

function validarPagoMixto(params: {
  granTotal: number;
  efectivo: number;
  datafono: number;
  transferencia: number;
  credito: number;
  efectivoRecibido?: number;
}) {
  if (params.efectivo < 0 || params.datafono < 0 || params.transferencia < 0 || params.credito < 0) {
    return { ok: false, error: 'No se permiten montos negativos' };
  }
  const sumaMedios = params.efectivo + params.datafono + params.transferencia + params.credito;
  if (sumaMedios < params.granTotal) {
    return { ok: false, error: 'El pago total es menor al valor de la factura' };
  }
  const recibido = params.efectivoRecibido ?? params.efectivo;
  if (params.efectivo > 0 && recibido < params.efectivo) {
    return { ok: false, error: 'Efectivo recibido insuficiente' };
  }
  const cambio = Math.max(0, recibido - params.efectivo);
  return { ok: true, cambio, sumaMedios };
}

describe('Lógica de Checkout: Totales, Pagos Mixtos, Propina y Vueltas', () => {
  it('calcula granTotal = subtotal - descuento + propina + domicilio excluyendo anulados', () => {
    const res = calcularOrdenTotal({
      items: [
        { cantidad: 2, precio_unitario: 45_000 },
        { cantidad: 1, precio_unitario: 18_000, anulado: true },
      ],
      descuento: 5_000,
      propina: 9_000,
      costoDomicilio: 4_000,
    });
    expect(res.subtotalBruto).toBe(90_000);
    expect(res.granTotal).toBe(98_000);
  });

  it('valida pago mixto (Efectivo + Transferencia + Datáfono) y calcula vueltas exactas', () => {
    const res = validarPagoMixto({
      granTotal: 100_000,
      efectivo: 50_000,
      transferencia: 30_000,
      datafono: 20_000,
      credito: 0,
      efectivoRecibido: 100_000,
    });
    expect(res.ok).toBe(true);
    expect(res.cambio).toBe(50_000);
  });

  it('rechaza pagos menores al total o con montos negativos', () => {
    expect(
      validarPagoMixto({
        granTotal: 80_000,
        efectivo: 40_000,
        datafono: 20_000,
        transferencia: 0,
        credito: 0,
      }).ok
    ).toBe(false);

    expect(
      validarPagoMixto({
        granTotal: 50_000,
        efectivo: -10_000,
        datafono: 60_000,
        transferencia: 0,
        credito: 0,
      }).ok
    ).toBe(false);
  });
});
