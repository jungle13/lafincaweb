/**
 * Servicio Centralizado de Stock, Fórmulas y Cálculos de Carne
 * Fuente única de verdad para reglas de porcionado, mermas y costeo
 */

import { InsumoItem } from '@/types';

/**
 * Determina si un insumo se administra estrictamente por unidades
 * (embutidos, elaborados, tamales, huevos, empanadas, etc.)
 */
export function isUnidadOnly(nombre?: string, unidadMedida?: string, categoria?: string): boolean {
  const n = (nombre || '').toLowerCase();
  const c = (categoria || '').toLowerCase();
  const u = (unidadMedida || '').toLowerCase();
  return (
    u === 'und' ||
    n.includes('chorizo') ||
    n.includes('tamal') ||
    n.includes('huevo') ||
    n.includes('empanada') ||
    c.includes('embutido') ||
    c.includes('elaborado')
  );
}

/**
 * Calcula el peso estándar de una porción en Kilogramos
 */
export function getPesoPorcionKg(insumo: Partial<InsumoItem>): number {
  if (isUnidadOnly(insumo.insumo, insumo.unidad_medida, insumo.categoria)) {
    return 1;
  }
  const gramos = insumo.peso_porc_gramos || (insumo.peso_estandar_porcion_kg ? Math.round(insumo.peso_estandar_porcion_kg * 1000) : 350);
  return gramos / 1000;
}

/**
 * Calcula el costo total en pesos de una cantidad ingresada/contada
 */
export function calculateItemCostoTotal(
  insumo: Partial<InsumoItem>,
  cantSinPorcKg: number = 0,
  porcUnd: number = 0,
  pesoPorcKg: number = 0,
  costoUnitarioKg: number = 0
): number {
  const isUnd = isUnidadOnly(insumo.insumo, insumo.unidad_medida, insumo.categoria);
  const unitPrice = costoUnitarioKg || insumo.costo_unitario_kg || 0;

  if (isUnd) {
    const pesoStd = getPesoPorcionKg(insumo);
    return Math.round(porcUnd * (pesoStd > 0 ? pesoStd * unitPrice : unitPrice));
  } else {
    const totalKg = (cantSinPorcKg || 0) + (pesoPorcKg || 0);
    return Math.round(totalKg * unitPrice);
  }
}

/**
 * Calcula el estado del stock según el mínimo configurado
 */
export function getStockStatus(pesoTotalBodegaKg: number, stockMinimoKg: number = 10): 'OPTIMO' | 'BAJO' | 'AGOTADO' {
  if (pesoTotalBodegaKg <= 0) return 'AGOTADO';
  if (pesoTotalBodegaKg <= stockMinimoKg) return 'BAJO';
  return 'OPTIMO';
}

/**
 * Calcula la merma de porcionado y el porcentaje resultante
 */
export function calculateMerma(pesoInicialKg: number, pesoFinalPorcionesKg: number): { mermaKg: number; porcentajeMerma: number } {
  if (pesoInicialKg <= 0) return { mermaKg: 0, porcentajeMerma: 0 };
  const mermaKg = Math.max(0, Number((pesoInicialKg - pesoFinalPorcionesKg).toFixed(3)));
  const porcentajeMerma = Number(((mermaKg / pesoInicialKg) * 100).toFixed(1));
  return { mermaKg, porcentajeMerma };
}
