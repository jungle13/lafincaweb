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
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInvoiceCostForUnit(inv, targetUnit) {
  const rawCost = Number(inv.costo_unitario_kg || inv.costo_unitario || 0);
  if (rawCost <= 0) return 0;

  const invUnit = norm(inv.unidad);
  const tgtUnit = norm(targetUnit);
  const det = norm(`${inv.nombre_insumo || ''} ${inv.detalle || ''}`);

  // Cajas / pacas x 24 unidades (cervezas, pony malta, etc.) cuando el costeo está en Und
  if (tgtUnit === 'und' && (invUnit.includes('caja') || invUnit.includes('paca') || det.includes('caja 24') || det.includes('x 24') || det.includes('24 und'))) {
    if (rawCost > 20000) {
      return Math.round(rawCost / 24);
    }
  }
  // Cajas x 12
  if (tgtUnit === 'und' && (det.includes('x 12') || det.includes('12 und')) && rawCost > 12000) {
    return Math.round(rawCost / 12);
  }
  // Cajas x 30 (panal de huevos / gaseosas)
  if (tgtUnit === 'und' && (det.includes('x 30') || det.includes('30 und') || invUnit.includes('panal')) && rawCost > 8000) {
    return Math.round(rawCost / 30);
  }
  // Bulto de papa / carbón / arroz -> si costeo está en Kg y factura por bulto de 50kg
  if (tgtUnit === 'kg' && invUnit.includes('bulto') && rawCost > 30000) {
    return Math.round(rawCost / 50);
  }

  return Math.round(rawCost);
}

function getAliasKeywords(name) {
  const n = norm(name);
  if (n.includes('trucha')) return ['trucha'];
  if (n.includes('tilapia')) return ['tilapia'];
  if (n.includes('salmon')) return ['salmon'];
  if (n.includes('camaron')) return ['camaron'];
  if (n.includes('marisco')) return ['marisco'];
  if (n.includes('sobrebarriga')) return ['sobrebarriga'];
  if (n.includes('punta de anca')) return ['punta de anca'];
  if (n.includes('baby beef') || n.includes('lomo viche')) return ['baby beef', 'lomo viche'];
  if (n.includes('caracho') || n.includes('churrasco')) return ['caracho', 'churrasco'];
  if (n.includes('lomo de cerdo')) return ['lomo de cerdo'];
  if (n.includes('costilla ahumada')) return ['costilla ahumada'];
  if (n.includes('san luis')) return ['san luis'];
  if (n.includes('costilla de res')) return ['costilla de res'];
  if (n.includes('costilla de cerdo')) return ['costilla de cerdo'];
  if (n.includes('lengua')) return ['lengua'];
  if (n.includes('callo')) return ['callo'];
  if (n.includes('tocino') || n.includes('chicharron')) return ['tocino', 'tocineta', 'chicharron'];
  if (n.includes('asar')) return ['asar', 'asada', 'cadera', 'bola'];
  if (n.includes('filete') && n.includes('pollo')) return ['filete', 'pechuga'];
  if (n.includes('pechuga')) return ['pechuga'];
  if (n.includes('pernil')) return ['pernil'];
  if (n.includes('chorizo paisa')) return ['chorizo paisa'];
  if (n.includes('chorizo grande') || n.includes('choricerdo')) return ['chorizo grande', 'choricerdo'];
  if (n.includes('chorizo de pollo') || n.includes('chorizo pollo')) return ['chorizo pollo', 'chorizo de pollo'];
  if (n.includes('rellena') || n.includes('morcilla')) return ['rellena', 'morcilla'];
  if (n.includes('huevo')) return ['huevo'];
  if (n.includes('leche') && !n.includes('crema') && !n.includes('coco')) return ['leche entera', 'leche institucional'];
  if (n.includes('crema de leche')) return ['crema de leche'];
  if (n.includes('platano')) return ['platano'];
  if (n.includes('tomate chonto')) return ['tomate chonto', 'tomate'];
  if (n.includes('cebolla cabezona')) return ['cabezona'];
  if (n.includes('cebolla larga') || n.includes('junca')) return ['cebolla larga', 'junca'];
  if (n.includes('pimenton')) return ['pimenton'];
  if (n.includes('zanahoria')) return ['zanahoria'];
  if (n.includes('papa amarilla') || n.includes('criolla')) return ['papa amarilla', 'criolla'];
  if (n.includes('papa mambera') || n.includes('capira')) return ['mambera', 'capira', 'papa'];
  if (n.includes('yuca')) return ['yuca'];
  if (n.includes('batavia') || n.includes('lechuga')) return ['batavia', 'lechuga'];
  if (n.includes('repollo')) return ['repollo'];
  if (n.includes('limon') && !n.includes('polvo') && !n.includes('zumo')) return ['limon'];
  if (n.includes('cilantro')) return ['cilantro'];
  if (n.includes('cimarron')) return ['cimarron'];
  if (n.includes('aguacate')) return ['aguacate'];
  if (n.includes('francesa')) return ['francesa'];
  if (n.includes('arroz')) return ['arroz'];
  if (n.includes('aceite')) return ['aceite'];
  return [];
}

function findMatchingInvoice(reg, invoicesDesc) {
  const targetDate = reg.fecha;
  const rName = norm(reg.nombre_insumo);
  const aliases = getAliasKeywords(reg.nombre_insumo);

  // Filtrar estrictamente facturas con fecha <= fecha del costeo (ordenadas DESC)
  const candidates = invoicesDesc.filter((inv) => inv.fecha <= targetDate);

  // 1. Por insumo_id exacto
  if (reg.insumo_id) {
    const byId = candidates.find((inv) => inv.insumo_id === reg.insumo_id);
    if (byId) return byId;
  }

  // 2. Por nombre exacto normalizado
  const byExact = candidates.find((inv) => norm(inv.nombre_insumo) === rName);
  if (byExact) return byExact;

  // 3. Por inclusión mutua (evitando falsos positivos cortos)
  const byInc = candidates.find((inv) => {
    const inName = norm(inv.nombre_insumo);
    return (inName.length >= 5 && rName.includes(inName)) || (rName.length >= 5 && inName.includes(rName));
  });
  if (byInc) return byInc;

  // 4. Por alias clave
  if (aliases.length > 0) {
    const byAlias = candidates.find((inv) => {
      const inName = norm(`${inv.nombre_insumo} ${inv.detalle || ''}`);
      return aliases.some((kw) => inName.includes(kw));
    });
    if (byAlias) return byAlias;
  }

  return null;
}

async function run() {
  console.log('====================================================================');
  console.log('💰 RECALCULANDO PRECIOS DE COSTEO CON COHERENCIA CRONOLÓGICA DE FACTURAS');
  console.log('====================================================================\n');

  // 1. Corregir peso estándar de Trucha (200g = 0.20 Kg @ $23.000/Kg = $4.600/und)
  await supabase
    .from('catalogo_insumos')
    .update({ peso_estandar_porcion_kg: 0.2, costo_unitario_kg: 23000, updated_at: new Date().toISOString() })
    .eq('codigo', 'CAR-036');

  // 2. Cargar compras_detalle de Oct y Nov 2026 ordenadas DESC por fecha
  let allInv = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('compras_detalle')
      .select('id, insumo_id, fecha, numero_factura, proveedor, nombre_insumo, detalle, unidad, costo_unitario, costo_unitario_kg')
      .gte('fecha', '2026-10-01')
      .order('fecha', { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allInv = allInv.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`🧾 Facturas/líneas cargadas (Oct-Nov 2026): ${allInv.length}`);

  // 3. Cargar registros de noviembre en registros_costeo_cocina
  let regs = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('registros_costeo_cocina')
      .select('*')
      .gte('fecha', '2026-11-01')
      .order('fecha', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    regs = regs.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`📋 Registros de costeo noviembre: ${regs.length}\n`);

  let updatedCount = 0;
  let skippedNoInv = 0;
  const touchedDates = new Set();

  for (const reg of regs) {
    if (reg.tipo === 'CONSUMO') continue; // Consumos usan precio venta / receta

    let qty = Number(reg.cantidad || 0);
    let cu = Number(reg.costo_unitario || 0);
    let unit = reg.unidad || 'Kg';

    // Corrección específica de Trucha si quedó con 0.24 Kg/und (ej: 1.44 Kg para 6 und o 1.68 Kg para 7 und @ $19.167)
    const nName = norm(reg.nombre_insumo);
    if (nName.includes('trucha') && unit === 'Kg' && Math.abs(cu - 19167) < 50) {
      const approxUnd = Math.round(qty / 0.24);
      if (approxUnd > 0 && Math.abs(approxUnd * 0.24 - qty) < 0.05) {
        qty = Number((approxUnd * 0.2).toFixed(2));
      }
    }

    const inv = findMatchingInvoice(reg, allInv);
    if (!inv) {
      skippedNoInv++;
      continue;
    }

    const invCu = normalizeInvoiceCostForUnit(inv, unit);
    if (invCu <= 0) continue;

    // Evitar distorsiones si la unidad de factura es incompatible por un factor absurdo (>4x o <0.25x cuando ya tiene precio válido y no es Trucha)
    const ratio = cu > 0 ? invCu / cu : 1;
    const isReasonable = cu === 0 || (ratio >= 0.4 && ratio <= 2.5) || nName.includes('trucha');

    if (!isReasonable) {
      continue;
    }

    const newTotal = Math.round(qty * invCu);
    if (qty !== Number(reg.cantidad) || invCu !== Number(reg.costo_unitario) || newTotal !== Number(reg.valor_total)) {
      const { error: upErr } = await supabase
        .from('registros_costeo_cocina')
        .update({
          cantidad: qty,
          costo_unitario: invCu,
          valor_total: newTotal,
        })
        .eq('id', reg.id);

      if (!upErr) {
        updatedCount++;
        touchedDates.add(reg.fecha);
      }
    }
  }

  console.log(`✅ Registros actualizados con precio de factura vigente: ${updatedCount}`);
  console.log(`ℹ️  Registros sin factura coincidente (se conservó su precio): ${skippedNoInv}`);

  // 4. Recalcular resúmenes de costeo_diario para todas las fechas de noviembre
  const { data: novHeaders } = await supabase
    .from('costeo_diario')
    .select('fecha, pos_sales')
    .gte('fecha', '2026-11-01')
    .order('fecha', { ascending: true });

  for (const h of novHeaders || []) {
    const { data: dayRegs } = await supabase
      .from('registros_costeo_cocina')
      .select('tipo, valor_total')
      .eq('fecha', h.fecha);

    const sumTipo = (t) =>
      (dayRegs || [])
        .filter((r) => r.tipo === t)
        .reduce((acc, r) => acc + Number(r.valor_total || 0), 0);

    const ap = sumTipo('APERTURA');
    const tras = sumTipo('TRASLADO');
    const dev = sumTipo('DEVOLUCION');
    const cie = sumTipo('CIERRE');
    const cons = sumTipo('CONSUMO');
    const neto = tras - dev;
    const real = ap + neto - cie + cons;
    const sales = Number(h.pos_sales || 0);
    const fc = sales > 0 ? Number(((real / sales) * 100).toFixed(2)) : 0;

    await supabase
      .from('costeo_diario')
      .update({
        costo_apertura: ap,
        costo_bruto: tras,
        devoluciones: dev,
        costo_neto: neto,
        costo_cierre: cie,
        costo_consumos: cons,
        consumo_real: real,
        food_cost_porcentaje: fc,
        updated_at: new Date().toISOString(),
      })
      .eq('fecha', h.fecha);

    console.log(`📅 ${h.fecha}: Ap=$${ap.toLocaleString('es-CO')} | Mov=$${tras.toLocaleString('es-CO')} | Cie=$${cie.toLocaleString('es-CO')} | Real=$${real.toLocaleString('es-CO')}`);
  }

  // 5. Sincronizar catalogo_insumos con la última factura disponible por insumo
  const { data: catalog } = await supabase.from('catalogo_insumos').select('id, nombre, unidad_medida, costo_unitario_kg');
  let catSyncCount = 0;
  for (const c of catalog || []) {
    const inv = findMatchingInvoice({ fecha: '2026-12-31', insumo_id: c.id, nombre_insumo: c.nombre }, allInv);
    if (!inv) continue;
    const invCu = normalizeInvoiceCostForUnit(inv, c.unidad_medida || 'Kg');
    if (invCu > 0 && invCu !== Number(c.costo_unitario_kg)) {
      const ratio = Number(c.costo_unitario_kg) > 0 ? invCu / Number(c.costo_unitario_kg) : 1;
      if (Number(c.costo_unitario_kg) === 0 || (ratio >= 0.4 && ratio <= 2.5)) {
        await supabase
          .from('catalogo_insumos')
          .update({ costo_unitario_kg: invCu, updated_at: new Date().toISOString() })
          .eq('id', c.id);
        catSyncCount++;
      }
    }
  }
  console.log(`\n📚 Catálogo actualizado con última factura vigente: ${catSyncCount} insumos.`);
}

run().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
