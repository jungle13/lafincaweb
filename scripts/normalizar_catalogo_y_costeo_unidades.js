import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isUnitOnlyRule(name) {
  const n = norm(name);
  if (n.includes('chorizo') || n.includes('choricerdo')) return true;
  if (n.includes('huevo')) return true;
  if (n.includes('pernil')) return true;
  if (n.includes('tamal') && !n.includes('hoja') && !n.includes('masa')) return true;
  return false;
}

function isLecheBolsa(name) {
  const n = norm(name);
  return n.includes('leche') && !n.includes('crema') && !n.includes('coco') && !n.includes('mazamorra');
}

function extractGramsFromText(text) {
  const m = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|grs|gramos)\b/i);
  if (m) {
    const g = parseFloat(m[1].replace(',', '.'));
    if (g > 10 && g <= 2000) return g / 1000;
  }
  return null;
}

function isWeightMeat(reg, catItem) {
  const n = norm(reg.nombre_insumo);
  const c = norm(reg.categoria || catItem?.categoria || '');
  if (isUnitOnlyRule(n) || isLecheBolsa(n)) return false;

  if (catItem?.es_carne) return true;
  if (
    c.includes('carne') ||
    c.includes('pollo') ||
    c.includes('res') ||
    c.includes('cerdo') ||
    c.includes('pescado') ||
    c.includes('marisco') ||
    c.includes('proteina')
  ) {
    return true;
  }
  return (
    n.includes('lomo') ||
    n.includes('carne') ||
    n.includes('sobrebarriga') ||
    n.includes('punta de anca') ||
    n.includes('baby beef') ||
    n.includes('churrasco') ||
    n.includes('caracho') ||
    n.includes('costilla') ||
    n.includes('san luis') ||
    n.includes('lengua') ||
    n.includes('callo') ||
    n.includes('tocino') ||
    n.includes('chicharron') ||
    n.includes('filete') ||
    n.includes('pollo') ||
    n.includes('gallina') ||
    n.includes('trucha') ||
    n.includes('tilapia') ||
    n.includes('salmon') ||
    n.includes('camaron') ||
    n.includes('marisco') ||
    n.includes('higado') ||
    n.includes('albondiga') ||
    n.includes('llama')
  );
}

async function run() {
  console.log('====================================================================');
  console.log('⚖️  NORMALIZANDO CATÁLOGO Y REGISTROS DE COSTEO A UNIDADES OFICIALES');
  console.log('====================================================================\n');

  const { data: catalog, error: catErr } = await supabase
    .from('catalogo_insumos')
    .select('*');
  if (catErr) throw catErr;

  let catUpdated = 0;
  for (const item of catalog) {
    const n = norm(item.nombre);
    let targetUnit = item.unidad_medida;
    let targetTipo = item.tipo_medida;

    if (isUnitOnlyRule(n)) {
      targetUnit = 'Und';
      targetTipo = 'UNIDADES';
    } else if (isLecheBolsa(n)) {
      targetUnit = 'Bolsa';
      targetTipo = 'PAQUETES';
    } else if (item.es_carne && !isUnitOnlyRule(n)) {
      targetUnit = 'Kg';
      targetTipo = 'KGS_Y_UNIDADES';
    }

    if (targetUnit !== item.unidad_medida || targetTipo !== item.tipo_medida) {
      const { error } = await supabase
        .from('catalogo_insumos')
        .update({
          unidad_medida: targetUnit,
          tipo_medida: targetTipo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      if (!error) {
        catUpdated++;
        console.log(`📚 Catálogo [${item.codigo}] ${item.nombre}: ${item.unidad_medida}/${item.tipo_medida} -> ${targetUnit}/${targetTipo}`);
      }
    }
  }
  console.log(`\n✅ Catálogo actualizado: ${catUpdated} ítems.\n`);

  // Recargar catálogo actualizado
  const { data: freshCatalog } = await supabase.from('catalogo_insumos').select('*');

  function findCatalogMatch(reg) {
    if (reg.insumo_id) {
      const byId = freshCatalog.find((c) => c.id === reg.insumo_id);
      if (byId) return byId;
    }
    const rn = norm(reg.nombre_insumo);
    const exact = freshCatalog.find((c) => norm(c.nombre) === rn);
    if (exact) return exact;

    if (rn.includes('asar')) return freshCatalog.find((c) => c.codigo === 'CAR-013') || null;
    if (rn.includes('lomo') && rn.includes('cerdo')) return freshCatalog.find((c) => c.codigo === 'CAR-020') || null;
    if (rn.includes('churrasco') || rn.includes('caracho')) return freshCatalog.find((c) => c.codigo === 'CAR-004') || null;
    if (rn.includes('baby')) return freshCatalog.find((c) => c.codigo === 'CAR-007') || null;
    if (rn.includes('punta de anca')) return freshCatalog.find((c) => c.codigo === 'CAR-005') || null;
    if (rn.includes('sobrebarriga')) return freshCatalog.find((c) => c.codigo === 'CAR-003') || null;
    if (rn.includes('lengua')) return freshCatalog.find((c) => c.codigo === 'CAR-008') || null;
    if (rn.includes('san luis')) return freshCatalog.find((c) => c.codigo === 'CAR-018') || null;
    if (rn.includes('tocino') || rn.includes('chicharron')) return freshCatalog.find((c) => c.codigo === 'CAR-021') || null;
    if (rn.includes('filete') && rn.includes('pollo')) return freshCatalog.find((c) => c.codigo === 'CAR-027') || null;
    if (rn.includes('trucha')) return freshCatalog.find((c) => c.codigo === 'CAR-036') || null;
    if (rn.includes('tilapia')) return freshCatalog.find((c) => c.codigo === 'CAR-034') || null;
    if (rn.includes('salmon')) return freshCatalog.find((c) => c.codigo === 'CAR-035') || null;
    if (rn.includes('camaron')) return freshCatalog.find((c) => norm(c.nombre).includes('camaron')) || null;
    if (rn.includes('marisco')) return freshCatalog.find((c) => c.codigo === 'CAR-039') || null;

    return freshCatalog.find((c) => rn.includes(norm(c.nombre)) || norm(c.nombre).includes(rn)) || null;
  }

  // Normalizar registros de noviembre 2026 en registros_costeo_cocina
  const { data: regs, error: regErr } = await supabase
    .from('registros_costeo_cocina')
    .select('*')
    .gte('fecha', '2026-11-01');
  if (regErr) throw regErr;

  let regUpdated = 0;
  for (const reg of regs) {
    if (reg.tipo === 'BODEGA_CIERRE' && norm(reg.categoria).includes('bebida')) continue;
    if (reg.tipo === 'CONSUMO') continue;

    const catItem = findCatalogMatch(reg);
    const uNorm = norm(reg.unidad);

    // 1. Leche en Bolsa
    if (isLecheBolsa(reg.nombre_insumo) && uNorm !== 'bolsa') {
      const { error } = await supabase
        .from('registros_costeo_cocina')
        .update({ unidad: 'Bolsa', insumo_id: reg.insumo_id || catItem?.id || null })
        .eq('id', reg.id);
      if (!error) regUpdated++;
      continue;
    }

    // 2. Carnes por peso guardadas en Und / Porc / Presa -> convertir a Kg
    const isUnitBasedInput = ['und', 'unidad', 'unidades', 'porc', 'porcion', 'porciones', 'presa', 'presas'].includes(uNorm);
    if (isWeightMeat(reg, catItem) && isUnitBasedInput) {
      const qtyUnd = Number(reg.cantidad || 0);
      const total = Number(reg.valor_total || 0);
      if (qtyUnd <= 0) continue;

      let pesoPorUnd = extractGramsFromText(reg.nombre_insumo) || extractGramsFromText(reg.observaciones);
      if (!pesoPorUnd && catItem?.peso_estandar_porcion_kg > 0) {
        pesoPorUnd = Number(catItem.peso_estandar_porcion_kg);
      }
      if (!pesoPorUnd && catItem?.costo_unitario_kg > 0 && total > 0) {
        // Inferir peso real desde valor_total / costo_unitario_kg
        const inferredTotalKg = total / Number(catItem.costo_unitario_kg);
        pesoPorUnd = inferredTotalKg / qtyUnd;
      }
      if (!pesoPorUnd || pesoPorUnd <= 0) {
        pesoPorUnd = 0.35; // estándar porción
      }

      const qtyKg = Number((qtyUnd * pesoPorUnd).toFixed(3));
      const unitPriceKg = qtyKg > 0 && total > 0 ? Math.round(total / qtyKg) : Number(catItem?.costo_unitario_kg || reg.costo_unitario || 0);
      const undLabel = `${qtyUnd} ${reg.unidad}`;
      const existingObs = String(reg.observaciones || '').trim();
      const newObs = existingObs.includes(undLabel)
        ? existingObs
        : [existingObs, `Equiv. ${undLabel}`].filter(Boolean).join(' • ');

      const { error } = await supabase
        .from('registros_costeo_cocina')
        .update({
          cantidad: qtyKg,
          unidad: 'Kg',
          costo_unitario: unitPriceKg,
          insumo_id: reg.insumo_id || catItem?.id || null,
          observaciones: newObs,
        })
        .eq('id', reg.id);

      if (!error) {
        regUpdated++;
        console.log(`🔄 [${reg.fecha}] ${reg.nombre_insumo}: ${qtyUnd} ${reg.unidad} ($${reg.costo_unitario}) -> ${qtyKg} Kg ($${unitPriceKg}/Kg) [Total $${total}]`);
      }
    }
  }

  console.log(`\n🎉 Registros de costeo normalizados: ${regUpdated}`);
}

run().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
