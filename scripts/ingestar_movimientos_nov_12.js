import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno
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

function normStr(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapCategory(excelCat, insumoNombre) {
  const n = normStr(insumoNombre);
  const c = String(excelCat || '').toUpperCase();
  if (n.includes('huevo') || n.includes('leche')) return 'Lácteos y Huevos';
  if (c.includes('RES')) return 'Carnes de Res';
  if (c.includes('CERDO')) return 'Carnes de Cerdo';
  if (c.includes('POLLO')) return 'Pollo y Aves';
  if (c.includes('EMBUTIDO')) return 'Embutidos';
  if (c.includes('PESCADO') || c.includes('MARISCO')) return 'Pescados y Mariscos';
  return 'Verduras e Insumos';
}

function resolveUnitAndQty(row) {
  const kg = Number(row['__EMPTY_5'] || 0);
  const und = Number(row['__EMPTY_6'] || 0);
  const obs = String(row['__EMPTY_10'] || '');
  const cu = Number(row['__EMPTY_8'] || 0);
  const tot = Number(row['__EMPTY_9'] || 0);

  // Si tiene unidades enteras (ej: 57 und, 6 bolsas, 120 und, 26 porc, 10 und), usar und cuando el costo unitario corresponde a unidad
  if (und > 0 && cu > 0 && Math.abs(und * cu - tot) <= Math.max(50, tot * 0.02)) {
    const unit = obs.toLowerCase().includes('bolsa') ? 'Bolsa' : 'Und';
    return { cantidad: und, unidad: unit, costo_unitario: cu, valor_total: tot };
  }
  if (kg > 0) {
    return { cantidad: kg, unidad: 'Kg', costo_unitario: cu, valor_total: tot };
  }
  return { cantidad: und || 1, unidad: 'Und', costo_unitario: cu, valor_total: tot };
}

async function run() {
  console.log('====================================================================');
  console.log('📋 IMPORTANDO MOVIMIENTOS Y COSTEO DEL 12 DE NOVIEMBRE 2026');
  console.log('====================================================================\n');

  const { data: catalogInsumos, error: catErr } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, costo_unitario_kg');

  if (catErr) throw catErr;

  const catalogNormMap = new Map();
  catalogInsumos.forEach((c) => catalogNormMap.set(normStr(c.nombre), c));

  function findCatalogMatch(name) {
    const n = normStr(name);
    if (catalogNormMap.has(n)) return catalogNormMap.get(n);
    for (const [cNorm, cObj] of catalogNormMap.entries()) {
      if ((cNorm.length > 4 && n.includes(cNorm)) || (n.length > 4 && cNorm.includes(n))) {
        return cObj;
      }
    }
    return null;
  }

  const excelPath = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/NOVIEMBRE 2026/COSTOS_GASTOS_NOVIEMBRE_2026.xlsx';
  const wb = xlsx.readFile(excelPath);
  const movRows = xlsx.utils.sheet_to_json(wb.Sheets['Movimientos Bodega - Cocina']);
  const traslados12 = movRows.filter(
    (r) => Number(r['RESTAURANTE CHOCLOS Y ASADOS LA FINCA']) === 12 && r['__EMPTY_2'] === 'TRASLADO_COCINA'
  );

  const dateStr = '2026-11-12';
  const itemsM = traslados12.map((r) => {
    const nombre = String(r['__EMPTY_3'] || '').trim();
    const match = findCatalogMatch(nombre);
    const { cantidad, unidad, costo_unitario, valor_total } = resolveUnitAndQty(r);
    return {
      fecha: dateStr,
      tipo: 'TRASLADO',
      insumo_id: match ? match.id : null,
      nombre_insumo: nombre,
      categoria: match?.categoria || mapCategory(r['__EMPTY_4'], nombre),
      cantidad,
      unidad,
      costo_unitario,
      valor_total,
      observaciones: String(r['__EMPTY_10'] || '').trim() || 'Traslado Bodega a Cocina (12-Nov)',
    };
  });

  const totM = itemsM.reduce((acc, it) => acc + Number(it.valor_total || 0), 0);
  console.log(`📦 Traslados a cocina del 12-Nov encontrados: ${itemsM.length} ítems ($${totM.toLocaleString('es-CO')} COP)`);

  // Reemplazar solo TRASLADO del 2026-11-12 (preservando APERTURA, CIERRE, CONSUMO, BODEGA_CIERRE)
  await supabase
    .from('registros_costeo_cocina')
    .delete()
    .eq('fecha', dateStr)
    .eq('tipo', 'TRASLADO');

  const { error: insErr } = await supabase.from('registros_costeo_cocina').insert(itemsM);
  if (insErr) throw insErr;

  // Leer todos los registros del 2026-11-12 para recalcular cabecera costeo_diario
  const { data: allReg12, error: regErr } = await supabase
    .from('registros_costeo_cocina')
    .select('tipo, valor_total')
    .eq('fecha', dateStr);

  if (regErr) throw regErr;

  const sumTipo = (t) =>
    (allReg12 || [])
      .filter((r) => r.tipo === t)
      .reduce((acc, r) => acc + Number(r.valor_total || 0), 0);

  const totA = sumTipo('APERTURA');
  const totTras = sumTipo('TRASLADO');
  const totDev = sumTipo('DEVOLUCION');
  const totC = sumTipo('CIERRE');
  const totCons = sumTipo('CONSUMO');

  const costoNeto = totTras - totDev;
  const consumoReal = totA + costoNeto - totC + totCons;

  const { data: v12 } = await supabase
    .from('ventas_diarias')
    .select('gran_total')
    .eq('fecha', dateStr)
    .maybeSingle();

  const posSales = Number(v12?.gran_total || 0);
  const fc12 = posSales > 0 ? (consumoReal / posSales) * 100 : 0;

  const { error: upErr } = await supabase.from('costeo_diario').upsert(
    {
      fecha: dateStr,
      titulo: 'Jueves, 12 de Noviembre de 2026 - Hoja Costeo Cocina',
      pos_sales: posSales,
      costo_apertura: totA,
      costo_bruto: totTras,
      devoluciones: totDev,
      costo_neto: costoNeto,
      costo_cierre: totC,
      costo_consumos: totCons,
      consumo_real: consumoReal,
      food_cost_porcentaje: fc12,
      estado: totC > 0 ? 'CERRADO' : 'ABIERTO',
      observaciones: 'Movimientos del 12-Nov sincronizados desde COSTOS_GASTOS_NOVIEMBRE_2026.xlsx (pendiente cierre de cocina)',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'fecha' }
  );

  if (upErr) throw upErr;

  console.log(`✅ Costeo 2026-11-12 actualizado:`);
  console.log(`   - Apertura: $${totA.toLocaleString('es-CO')} COP`);
  console.log(`   - Traslados (Bruto): $${totTras.toLocaleString('es-CO')} COP`);
  console.log(`   - Cierre: $${totC.toLocaleString('es-CO')} COP`);
  console.log(`   - Consumo Real acumulado: $${consumoReal.toLocaleString('es-CO')} COP`);

  // Asegurar día 11 sincronizado con ventas oficiales del 11
  const { data: v11 } = await supabase
    .from('ventas_diarias')
    .select('gran_total')
    .eq('fecha', '2026-11-11')
    .maybeSingle();

  if (v11?.gran_total) {
    try {
      await supabase.rpc('rpc_sync_costeo_diario', {
        p_fecha: '2026-11-11',
        p_pos_sales: Number(v11.gran_total),
      });
      console.log(`✅ Día 2026-11-11 sincronizado con ventas: $${Number(v11.gran_total).toLocaleString('es-CO')} COP`);
    } catch (e) {
      console.log('rpc_sync_costeo_diario 11:', e?.message || e);
    }
  }
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
