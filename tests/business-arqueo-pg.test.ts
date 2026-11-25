import { describe, it, expect } from 'vitest';

function calcularCuadreCaja(params: {
  baseInicial: number;
  ventasEfectivo: number;
  entradasEfectivo: number;
  salidasEfectivo: number;
  efectivoContado: number;
}) {
  const esperado =
    params.baseInicial +
    params.ventasEfectivo +
    params.entradasEfectivo -
    params.salidasEfectivo;
  const diferencia = params.efectivoContado - esperado;
  const estado =
    diferencia === 0 ? 'CUADRADA' : diferencia > 0 ? 'SOBRANTE' : 'FALTANTE';
  return { esperado, diferencia, estado };
}

function clasificarSalidasLibro(
  registros: Array<{ clasificacion: string; valor_pagado: number }>
) {
  let totalCostosInsumos = 0;
  let totalGastosOperativos = 0;
  let totalTurnosNomina = 0;
  let totalPrestamosAnticipos = 0;

  for (const r of registros) {
    const val = Number(r.valor_pagado || 0);
    const cl = (r.clasificacion || '').toLowerCase();
    if (cl.includes('insumo') || cl.includes('costo')) {
      totalCostosInsumos += val;
    } else if (cl.includes('nómina') || cl.includes('nomina') || cl.includes('turno')) {
      totalTurnosNomina += val;
    } else if (cl.includes('préstamo') || cl.includes('prestamo') || cl.includes('anticipo')) {
      totalPrestamosAnticipos += val;
    } else {
      totalGastosOperativos += val;
    }
  }

  const totalSalidasMes =
    totalCostosInsumos +
    totalGastosOperativos +
    totalTurnosNomina +
    totalPrestamosAnticipos;

  return {
    totalCostosInsumos,
    totalGastosOperativos,
    totalTurnosNomina,
    totalPrestamosAnticipos,
    totalSalidasMes,
  };
}

describe('Lógica Contable: Arqueo de Caja y Separación P&G', () => {
  it('calcula cuadre exacto incluyendo base inicial (evita falso sobrante)', () => {
    const res = calcularCuadreCaja({
      baseInicial: 500_000,
      ventasEfectivo: 153_816,
      entradasEfectivo: 0,
      salidasEfectivo: 0,
      efectivoContado: 655_000,
    });
    expect(res.esperado).toBe(653_816);
    expect(res.diferencia).toBe(1_184);
    expect(res.estado).toBe('SOBRANTE');
  });

  it('calcula CUADRADA cuando efectivo contado coincide con base + ventas + entradas - salidas', () => {
    const res = calcularCuadreCaja({
      baseInicial: 200_000,
      ventasEfectivo: 450_000,
      entradasEfectivo: 50_000,
      salidasEfectivo: 120_000,
      efectivoContado: 580_000,
    });
    expect(res.esperado).toBe(580_000);
    expect(res.diferencia).toBe(0);
    expect(res.estado).toBe('CUADRADA');
  });

  it('detecta FALTANTE negativo cuando falta dinero en caja', () => {
    const res = calcularCuadreCaja({
      baseInicial: 300_000,
      ventasEfectivo: 100_000,
      entradasEfectivo: 0,
      salidasEfectivo: 20_000,
      efectivoContado: 370_000,
    });
    expect(res.esperado).toBe(380_000);
    expect(res.diferencia).toBe(-10_000);
    expect(res.estado).toBe('FALTANTE');
  });

  it('Préstamo / Anticipo resta efectivo físico pero NO contamina Gastos Operativos ni Costos del P&G', () => {
    const resumen = clasificarSalidasLibro([
      { clasificacion: 'Gasto Operativo', valor_pagado: 40_000 },
      { clasificacion: 'Costo / Insumo', valor_pagado: 100_000 },
      { clasificacion: 'Turno / Nómina', valor_pagado: 60_000 },
      { clasificacion: 'Préstamo / Anticipo', valor_pagado: 150_000 },
    ]);

    expect(resumen.totalGastosOperativos).toBe(40_000);
    expect(resumen.totalCostosInsumos).toBe(100_000);
    expect(resumen.totalTurnosNomina).toBe(60_000);
    expect(resumen.totalPrestamosAnticipos).toBe(150_000);
    expect(resumen.totalSalidasMes).toBe(350_000);
  });
});
