export type PosMacroCategory =
  | 'CARNES'
  | 'VERDURAS'
  | 'GRANOS'
  | 'BEBIDAS'
  | 'DESECHABLES'
  | 'PLATOS_VENTA';

export interface PosCatalogItem {
  id: string;
  codigo?: string;
  nombre: string;
  categoria?: string;
  unidad_medida?: string;
  tipo_medida?: string;
  es_carne?: boolean;
  peso_estandar_porcion_kg?: number;
  costo_unitario_kg?: number;
  esPlatoVenta?: boolean;
}

export interface PosEquivalenceOption {
  id: string;
  label: string;
  shortLabel: string;
  factorToBase: number;
  baseUnit: string;
  isPortion?: boolean;
}

export interface InsumoVisualMeta {
  emoji: string;
  macroCategory: PosMacroCategory;
  accentBg: string;
  accentBorder: string;
  accentText: string;
}

function normStr(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function resolvePosMacroCategory(item: PosCatalogItem): PosMacroCategory {
  if (item.esPlatoVenta) return 'PLATOS_VENTA';
  const cat = normStr(item.categoria || '');
  const name = normStr(item.nombre || '');

  // 1. Verduras e insumos frescos (prioritario para evitar falsos positivos)
  if (
    cat.includes('verdura') || cat.includes('fruver') || cat.includes('hortaliza') || cat.includes('fruta') ||
    name.includes('limon') || name.includes('tahiti') || name.includes('aguacate') ||
    name.includes('tomate') || name.includes('cebolla') || name.includes('papa') ||
    name.includes('platano') || name.includes('yuca') || name.includes('zanahoria') ||
    name.includes('cilantro') || name.includes('habichuela') || name.includes('arveja') ||
    name.includes('pimenton') || name.includes('lechuga') || name.includes('repollo') ||
    name.includes('champinon') || name.includes('ahuyama') || name.includes('calabacin') ||
    name.includes('pepino') || name.includes('espinaca') || name.includes('apio') ||
    name.includes('guasca') || name.includes('perejil') || name.includes('ajo') ||
    name.includes('mazorca') || name.includes('choclo') || name.includes('fruti')
  ) {
    return 'VERDURAS';
  }

  // 2. Desechables y Empaques
  if (
    cat.includes('desechable') || cat.includes('empaque') || cat.includes('aseo') ||
    name.includes('vaso') || name.includes('plato') || name.includes('portacomida') ||
    name.includes('servilleta') || name.includes('bolsa') || name.includes('cubierto') ||
    name.includes('tenedor') || name.includes('cuchara') || name.includes('aluminio') ||
    name.includes('vinipel') || name.includes('icopor') || name.includes('pitillo') ||
    name.includes('guante') || name.includes('jabon')
  ) {
    return 'DESECHABLES';
  }

  // 3. Bebidas
  if (
    cat.includes('bebida') || cat.includes('licor') || cat.includes('cerveza') ||
    name.includes('cerveza') || name.includes('poker') || name.includes('aguila') ||
    name.includes('club colombia') || name.includes('coronita') || name.includes('costena') ||
    name.includes('coca') || name.includes('quatro') || name.includes('sprite') ||
    name.includes('premio') || name.includes('postobon') || name.includes('soda') ||
    name.includes('agua ') || name.includes('hatsuzu') || name.includes('bretana') ||
    name.includes('pony') || name.includes('hit') || name.includes('jugo')
  ) {
    return 'BEBIDAS';
  }

  // 4. Carnes y Proteínas
  if (
    item.es_carne ||
    cat.includes('carne') || cat.includes('res') || cat.includes('cerdo') ||
    cat.includes('pollo') || cat.includes('pescado') || cat.includes('marisco') ||
    cat.includes('proteina') || cat.includes('embutido') ||
    name.includes('lomo') || name.includes('punta de anca') || name.includes('churrasco') ||
    name.includes('sobrebarriga') || name.includes('costilla') || name.includes('pechuga') ||
    name.includes('pernil') || name.includes('pollo') || name.includes('trucha') ||
    name.includes('salmon') || name.includes('camaron') || name.includes('basa') ||
    name.includes('chorizo') || name.includes('morcilla') || name.includes('chicharron') ||
    name.includes('tocino') || name.includes('carne') || name.includes('molida')
  ) {
    return 'CARNES';
  }

  // 5. Granos y Abarrotes por defecto
  return 'GRANOS';
}

export function getInsumoVisualMeta(item: PosCatalogItem): InsumoVisualMeta {
  const macroCategory = resolvePosMacroCategory(item);
  if (macroCategory === 'PLATOS_VENTA') {
    return {
      emoji: '🍽️',
      macroCategory,
      accentBg: 'bg-purple-50/70',
      accentBorder: 'border-purple-200',
      accentText: 'text-purple-700',
    };
  }
  const n = normStr(item.nombre || '');

  let emoji = '📦';
  if (n.includes('tamal')) emoji = '🫔';
  else if (n.includes('huevo')) emoji = '🥚';
  else if (n.includes('chorizo') || n.includes('morcilla') || n.includes('rellena')) emoji = '🌭';
  else if (n.includes('trucha') || n.includes('salmon') || n.includes('basa') || n.includes('camaron') || n.includes('pescado')) emoji = '🐟';
  else if (n.includes('pollo') || n.includes('pechuga') || n.includes('pernil') || n.includes('alas')) emoji = '🍗';
  else if (n.includes('cerdo') || n.includes('tocino') || n.includes('chicharron') || n.includes('costilla')) emoji = '🥓';
  else if (macroCategory === 'CARNES') emoji = '🥩';
  else if (n.includes('leche') || n.includes('queso') || n.includes('cuajada') || n.includes('crema')) emoji = '🥛';
  else if (n.includes('papa') || n.includes('yuca') || n.includes('platano')) emoji = '🥔';
  else if (n.includes('limon') || n.includes('aguacate') || n.includes('tomate') || n.includes('cebolla')) emoji = '🥬';
  else if (macroCategory === 'VERDURAS') emoji = '🥦';
  else if (macroCategory === 'BEBIDAS') emoji = n.includes('cerveza') || n.includes('poker') || n.includes('aguila') ? '🍺' : '🥤';
  else if (macroCategory === 'DESECHABLES') emoji = '🥡';
  else if (macroCategory === 'GRANOS') emoji = '🌾';

  if (macroCategory === 'CARNES') {
    return {
      emoji,
      macroCategory,
      accentBg: 'bg-rose-50/70',
      accentBorder: 'border-rose-200',
      accentText: 'text-rose-700',
    };
  }
  if (macroCategory === 'VERDURAS') {
    return {
      emoji,
      macroCategory,
      accentBg: 'bg-emerald-50/70',
      accentBorder: 'border-emerald-200',
      accentText: 'text-emerald-700',
    };
  }
  if (macroCategory === 'BEBIDAS') {
    return {
      emoji,
      macroCategory,
      accentBg: 'bg-sky-50/70',
      accentBorder: 'border-sky-200',
      accentText: 'text-sky-700',
    };
  }
  if (macroCategory === 'DESECHABLES') {
    return {
      emoji,
      macroCategory,
      accentBg: 'bg-amber-50/70',
      accentBorder: 'border-amber-200',
      accentText: 'text-amber-700',
    };
  }
  return {
    emoji,
    macroCategory,
    accentBg: 'bg-orange-50/70',
    accentBorder: 'border-orange-200',
    accentText: 'text-orange-700',
  };
}

export function getPortionWeightKgForPos(item: PosCatalogItem): number {
  const std = Number(item.peso_estandar_porcion_kg || 0);
  if (std > 0) return std;
  const match = (item.nombre || '').match(/(\d+)\s*g/i);
  if (match) return parseFloat(match[1]) / 1000;
  const n = normStr(item.nombre || '');
  if (n.includes('costilla')) return 0.4;
  if (n.includes('punta de anca') || n.includes('churrasco') || n.includes('bife')) return 0.35;
  if (n.includes('basa') || n.includes('filete') || n.includes('pechuga') || n.includes('pollo')) return 0.3;
  if (n.includes('sobrebarriga')) return 0.38;
  if (n.includes('molida')) return 0.25;
  return 0.25;
}

export function resolveOfficialBaseUnit(item: PosCatalogItem): string {
  const n = normStr(item.nombre || '');
  if (n.includes('chorizo') || n.includes('choripollo') || n.includes('huevo') || n.includes('pernil') || n.includes('tamal')) {
    return 'Und';
  }
  if (n.includes('leche') && !n.includes('condensada')) {
    return 'Bolsa';
  }
  const u = (item.unidad_medida || '').trim();
  if (u) return u;
  return 'Kg';
}

export function getPosEquivalenceOptions(item: PosCatalogItem): PosEquivalenceOption[] {
  if (item.esPlatoVenta) {
    return [
      { id: 'und', label: 'Platos / Unidades', shortLabel: 'Und', factorToBase: 1, baseUnit: 'Und' },
    ];
  }
  const n = normStr(item.nombre || '');
  const baseUnit = resolveOfficialBaseUnit(item);
  const macro = resolvePosMacroCategory(item);

  // Huevos -> Unidades / Panal x30 / Medio panal x15
  if (n.includes('huevo')) {
    return [
      { id: 'und', label: 'Unidades', shortLabel: 'Und', factorToBase: 1, baseUnit: 'Und' },
      { id: 'panal30', label: 'Panal (30 Und)', shortLabel: 'Panal x30', factorToBase: 30, baseUnit: 'Und' },
      { id: 'panal15', label: 'Medio Panal (15)', shortLabel: '½ Panal', factorToBase: 15, baseUnit: 'Und' },
    ];
  }

  // Chorizos, perniles, tamales -> Unidades directas
  if (baseUnit === 'Und' && (n.includes('chorizo') || n.includes('choripollo') || n.includes('pernil') || n.includes('tamal'))) {
    return [
      { id: 'und', label: 'Unidades', shortLabel: 'Und', factorToBase: 1, baseUnit: 'Und' },
    ];
  }

  // Leche -> Bolsa / Lts
  if (baseUnit === 'Bolsa') {
    return [
      { id: 'bolsa', label: 'Bolsas', shortLabel: 'Bolsa', factorToBase: 1, baseUnit: 'Bolsa' },
      { id: 'paca6', label: 'Paca (6 Bolsas)', shortLabel: 'Paca x6', factorToBase: 6, baseUnit: 'Bolsa' },
    ];
  }

  // Carnes porcionables -> Porciones + Kg + Libras + Gramos
  if (macro === 'CARNES') {
    const portionKg = getPortionWeightKgForPos(item);
    const gramsLabel = Math.round(portionKg * 1000);
    return [
      {
        id: 'porcion',
        label: `Porciones (${gramsLabel}g)`,
        shortLabel: `Porc (${gramsLabel}g)`,
        factorToBase: portionKg,
        baseUnit: 'Kg',
        isPortion: true,
      },
      { id: 'kg', label: 'Kilogramos (Kg)', shortLabel: 'Kg', factorToBase: 1, baseUnit: 'Kg' },
      { id: 'lb', label: 'Libras (500g)', shortLabel: 'Lb (0.5Kg)', factorToBase: 0.5, baseUnit: 'Kg' },
      { id: 'gr', label: 'Gramos (g)', shortLabel: 'Gramos', factorToBase: 0.001, baseUnit: 'Kg' },
    ];
  }

  // Bebidas y Desechables por unidad/paquete
  if (macro === 'BEBIDAS' || macro === 'DESECHABLES' || baseUnit === 'Und' || baseUnit.toLowerCase().includes('paq')) {
    return [
      { id: 'base', label: baseUnit, shortLabel: baseUnit, factorToBase: 1, baseUnit },
      { id: 'caja12', label: `Caja x12 ${baseUnit}`, shortLabel: 'Caja x12', factorToBase: 12, baseUnit },
      { id: 'caja24', label: `Caja x24 ${baseUnit}`, shortLabel: 'Caja x24', factorToBase: 24, baseUnit },
    ];
  }

  // Verduras, Granos y Abarrotes por peso
  return [
    { id: 'kg', label: 'Kilogramos (Kg)', shortLabel: 'Kg', factorToBase: 1, baseUnit: 'Kg' },
    { id: 'lb', label: 'Libras (500g)', shortLabel: 'Lb (0.5Kg)', factorToBase: 0.5, baseUnit: 'Kg' },
    { id: 'arroba', label: 'Arroba (12.5 Kg)', shortLabel: '@ 12.5Kg', factorToBase: 12.5, baseUnit: 'Kg' },
    { id: 'bulto50', label: 'Bulto (50 Kg)', shortLabel: 'Bulto 50Kg', factorToBase: 50, baseUnit: 'Kg' },
    { id: 'gr', label: 'Gramos (g)', shortLabel: 'Gramos', factorToBase: 0.001, baseUnit: 'Kg' },
  ];
}

export function evaluatePosExpression(rawExpr: string): { valid: boolean; sum: number; partsCount: number } {
  const cleaned = String(rawExpr || '')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/\+$/, '');

  if (!cleaned) return { valid: false, sum: 0, partsCount: 0 };
  if (!/^[0-9.+]+$/.test(cleaned)) return { valid: false, sum: 0, partsCount: 0 };

  const parts = cleaned.split('+').filter((p) => p.length > 0);
  if (parts.length === 0) return { valid: false, sum: 0, partsCount: 0 };

  let total = 0;
  for (const part of parts) {
    const val = Number(part);
    if (isNaN(val) || !isFinite(val)) {
      return { valid: false, sum: 0, partsCount: 0 };
    }
    total += val;
  }

  return {
    valid: total > 0,
    sum: Number(total.toFixed(4)),
    partsCount: parts.length,
  };
}
