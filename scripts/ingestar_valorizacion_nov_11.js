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

async function run() {
  console.log('====================================================================');
  console.log('📋 IMPORTANDO VALORIZACIÓN DIARIA DE COSTEO (11 NOVIEMBRE 2026)');
  console.log('====================================================================\n');

  // 1. Cargar catálogo de insumos
  const { data: catalogInsumos, error: catErr } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, costo_unitario_kg');

  if (catErr) {
    console.error('Error cargando catálogo:', catErr);
    return;
  }
  console.log(`📚 Catálogo cargado: ${catalogInsumos.length} insumos.`);

  const catalogNormMap = new Map();
  catalogInsumos.forEach(c => catalogNormMap.set(normStr(c.nombre), c));

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

  const filePath = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/NOVIEMBRE 2026/VALORIZACION DIARIA NOVIEMBRE 2026/11/VALORIZACION_INSUMOS_11_NOVIEMBRE_2026.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error(`No existe el archivo en ${filePath}`);
    return;
  }

  const dateStr = '2026-11-11';
  const wb = xlsx.readFile(filePath);

  // A. Amanece Cocina
  const sA = wb.SheetNames.find(s => s.toLowerCase().includes('amanece'));
  const itemsA = [];
  if (sA) {
    const rowsA = xlsx.utils.sheet_to_json(wb.Sheets[sA], { header: 1 });
    for (let i = 4; i < rowsA.length; i++) {
      const r = rowsA[i];
      if (r && typeof r[0] === 'number' && r[2]) {
        const match = findCatalogMatch(r[2]);
        itemsA.push({
          fecha: dateStr,
          tipo: 'APERTURA',
          insumo_id: match ? match.id : null,
          nombre_insumo: String(r[2]).trim(),
          categoria: String(r[1] || 'Varios').trim(),
          cantidad: Number(r[4] || 0),
          unidad: String(r[5] || 'Und').trim(),
          costo_unitario: Number(r[6] || 0),
          valor_total: Number(r[7] || 0),
          observaciones: [r[3], r[8]].filter(Boolean).join(' • ')
        });
      }
    }
  }
  const totA = itemsA.reduce((acc, it) => acc + it.valor_total, 0);

  // B. Movimientos Bodega a Cocina (Traslados)
  const sM = wb.SheetNames.find(s => s.toLowerCase().includes('movimientos'));
  const itemsM = [];
  if (sM) {
    const rowsM = xlsx.utils.sheet_to_json(wb.Sheets[sM], { header: 1 });
    for (let i = 4; i < rowsM.length; i++) {
      const r = rowsM[i];
      if (r && typeof r[0] === 'number' && r[2]) {
        const match = findCatalogMatch(r[2]);
        itemsM.push({
          fecha: dateStr,
          tipo: 'TRASLADO',
          insumo_id: match ? match.id : null,
          nombre_insumo: String(r[2]).trim(),
          categoria: String(r[1] || 'Varios').trim(),
          cantidad: Number(r[4] || 0),
          unidad: String(r[5] || 'Und').trim(),
          costo_unitario: Number(r[6] || 0),
          valor_total: Number(r[7] || 0),
          observaciones: [r[3], r[8]].filter(Boolean).join(' • ')
        });
      }
    }
  }
  const totM = itemsM.reduce((acc, it) => acc + it.valor_total, 0);

  // C. Cierre Cocina
  const sC = wb.SheetNames.find(s => s.toLowerCase().includes('cierre'));
  const itemsC = [];
  if (sC) {
    const rowsC = xlsx.utils.sheet_to_json(wb.Sheets[sC], { header: 1 });
    for (let i = 4; i < rowsC.length; i++) {
      const r = rowsC[i];
      if (r && typeof r[1] === 'number' && r[3]) {
        const match = findCatalogMatch(r[3]);
        itemsC.push({
          fecha: dateStr,
          tipo: 'CIERRE',
          insumo_id: match ? match.id : null,
          nombre_insumo: String(r[3]).trim(),
          categoria: String(r[2] || 'Varios').trim(),
          cantidad: Number(r[4] || 0),
          unidad: String(r[5] || 'Und').trim(),
          costo_unitario: Number(r[6] || 0),
          valor_total: Number(r[7] || 0),
          observaciones: String(r[8] || '').trim()
        });
      }
    }
  }
  const totC = itemsC.reduce((acc, it) => acc + it.valor_total, 0);

  // D. Bodega Entradas / Cierre
  const sB = wb.SheetNames.find(s => s.toLowerCase().includes('bodega'));
  const itemsB = [];
  if (sB) {
    const rowsB = xlsx.utils.sheet_to_json(wb.Sheets[sB], { header: 1 });
    for (let i = 0; i < rowsB.length; i++) {
      const r = rowsB[i];
      if (r && typeof r[0] === 'number' && r[2]) {
        const match = findCatalogMatch(r[2]);
        const cant = Number(r[3] || 0);
        const costoUnit = Number(r[5] || 0);
        const valTotal = Number(r[7] || r[6] || (cant * costoUnit));
        itemsB.push({
          fecha: dateStr,
          tipo: 'BODEGA_CIERRE',
          insumo_id: match ? match.id : null,
          nombre_insumo: String(r[2]).trim(),
          categoria: String(r[1] || 'Varios').trim(),
          cantidad: cant,
          unidad: String(r[4] || 'Und').trim(),
          costo_unitario: costoUnit,
          valor_total: valTotal,
          observaciones: [r[8], r[9]].filter(Boolean).join(' • ')
        });
      }
    }
  }

  console.log(`📊 Día 11 (2026-11-11):`);
  console.log(`   - Apertura: ${itemsA.length} ítems ($${totA.toLocaleString('es-CO')})`);
  console.log(`   - Traslados (Costo Bruto): ${itemsM.length} ítems ($${totM.toLocaleString('es-CO')})`);
  console.log(`   - Cierre: ${itemsC.length} ítems ($${totC.toLocaleString('es-CO')})`);
  console.log(`   - Bodega: ${itemsB.length} ítems`);

  // Limpiar registros previos de costeo para este día (excepto consumos manuales)
  await supabase
    .from('registros_costeo_cocina')
    .delete()
    .eq('fecha', dateStr)
    .in('tipo', ['APERTURA', 'TRASLADO', 'CIERRE', 'BODEGA_CIERRE']);

  // Insertar registros en lotes
  const allItems = [...itemsA, ...itemsM, ...itemsC, ...itemsB];
  for (let i = 0; i < allItems.length; i += 50) {
    const chunk = allItems.slice(i, i + 50);
    const { error: insErr } = await supabase.from('registros_costeo_cocina').insert(chunk);
    if (insErr) {
      console.error(`Error insertando registros en día ${dateStr}:`, insErr.message);
    }
  }
  console.log(`✅ ${allItems.length} registros insertados en registros_costeo_cocina.`);

  // Actualizar conteos_fisicos (Apertura y Cierre)
  const { data: oldConteos } = await supabase.from('conteos_fisicos').select('id').eq('fecha', dateStr);
  if (oldConteos && oldConteos.length > 0) {
    const cIds = oldConteos.map(c => c.id);
    await supabase.from('conteos_fisicos_detalle').delete().in('conteo_id', cIds);
    await supabase.from('conteos_fisicos').delete().in('id', cIds);
  }

  if (itemsA.length > 0) {
    const { data: cAp } = await supabase.from('conteos_fisicos').insert({
      fecha: dateStr,
      tipo: 'COCINA_APERTURA',
      total_valor: totA,
      usuario: 'Administración',
      estado: 'APLICADO',
      observaciones: `Inventario inicial en cocina (Amanece 11 de Noviembre de 2026)`
    }).select('id').single();

    if (cAp) {
      const detA = itemsA.map(it => ({
        conteo_id: cAp.id,
        insumo_id: it.insumo_id,
        nombre_insumo: it.nombre_insumo,
        categoria: it.categoria,
        cantidad: it.cantidad,
        unidad: it.unidad,
        costo_unitario: it.costo_unitario,
        valor_total: it.valor_total,
        observaciones: it.observaciones,
        ubicacion: 'Cocina Principal'
      }));
      await supabase.from('conteos_fisicos_detalle').insert(detA);
    }
  }

  if (itemsC.length > 0) {
    const { data: cCi } = await supabase.from('conteos_fisicos').insert({
      fecha: dateStr,
      tipo: 'COCINA_CIERRE',
      total_valor: totC,
      usuario: 'Administración',
      estado: 'APLICADO',
      observaciones: `Inventario final en cocina (Cierre 11 de Noviembre de 2026)`
    }).select('id').single();

    if (cCi) {
      const detC = itemsC.map(it => ({
        conteo_id: cCi.id,
        insumo_id: it.insumo_id,
        nombre_insumo: it.nombre_insumo,
        categoria: it.categoria,
        cantidad: it.cantidad,
        unidad: it.unidad,
        costo_unitario: it.costo_unitario,
        valor_total: it.valor_total,
        observaciones: it.observaciones,
        ubicacion: 'Cocina Principal'
      }));
      await supabase.from('conteos_fisicos_detalle').insert(detC);
    }
  }

  // Verificar si hay consumos manuales ingresados para el 11
  const { data: consumos } = await supabase
    .from('registros_costeo_cocina')
    .select('valor_total')
    .eq('fecha', dateStr)
    .eq('tipo', 'CONSUMO');

  const costoConsumos = (consumos || []).reduce((acc, c) => acc + Number(c.valor_total || 0), 0);
  const consumoReal = totA + totM - totC + costoConsumos;

  // Cabecera en costeo_diario
  const titulo = 'Miércoles, 11 de Noviembre de 2026 - Hoja Costeo Cocina';
  const { error: errHeader } = await supabase
    .from('costeo_diario')
    .upsert({
      fecha: dateStr,
      titulo,
      pos_sales: 0,
      costo_apertura: totA,
      costo_bruto: totM,
      devoluciones: 0,
      costo_neto: totM,
      costo_cierre: totC,
      costo_consumos: costoConsumos,
      consumo_real: consumoReal,
      food_cost_porcentaje: 0,
      estado: 'CERRADO',
      observaciones: 'Sincronizado oficialmente desde Valorización Diaria Noviembre 2026',
      updated_at: new Date().toISOString()
    }, { onConflict: 'fecha' });

  if (errHeader) {
    console.error(`Error actualizando cabecera de costeo_diario para ${dateStr}:`, errHeader.message);
  } else {
    console.log(`✅ Hoja de Costeo Diario para ${dateStr} guardada exitosamente.`);
  }

  // 3. SINCRONIZAR VENTAS Y COSTEO PARA DÍAS 9, 10 Y 11
  console.log('\n🔄 Sincronizando días 9, 10 y 11 con ventas oficiales...');

  // Día 9
  const { data: v09 } = await supabase.from('ventas_diarias').select('gran_total').eq('fecha', '2026-11-09').maybeSingle();
  const sales09 = Number(v09?.gran_total || 0);
  const { data: c09 } = await supabase.from('costeo_diario').select('costo_bruto').eq('fecha', '2026-11-09').maybeSingle();
  const fc09 = sales09 > 0 ? (Number(c09?.costo_bruto || 0) / sales09) * 100 : 0;
  await supabase.from('costeo_diario').update({
    pos_sales: sales09,
    food_cost_porcentaje: fc09,
    updated_at: new Date().toISOString()
  }).eq('fecha', '2026-11-09');
  try {
    await supabase.rpc('rpc_sync_costeo_diario', { p_fecha: '2026-11-09', p_pos_sales: sales09 });
  } catch (e) {
    console.log('rpc_sync_costeo_diario 09:', e?.message || e);
  }
  console.log(`✅ Día 09 sincronizado: Ventas $${sales09.toLocaleString('es-CO')} COP | Food Cost: ${fc09.toFixed(1)}%`);

  // Día 10
  const { data: v10 } = await supabase.from('ventas_diarias').select('gran_total').eq('fecha', '2026-11-10').maybeSingle();
  const sales10 = Number(v10?.gran_total || 0);
  const { data: c10 } = await supabase.from('costeo_diario').select('costo_bruto').eq('fecha', '2026-11-10').maybeSingle();
  const fc10 = sales10 > 0 ? (Number(c10?.costo_bruto || 0) / sales10) * 100 : 0;
  await supabase.from('costeo_diario').update({
    pos_sales: sales10,
    food_cost_porcentaje: fc10,
    updated_at: new Date().toISOString()
  }).eq('fecha', '2026-11-10');
  try {
    await supabase.rpc('rpc_sync_costeo_diario', { p_fecha: '2026-11-10', p_pos_sales: sales10 });
  } catch (e) {
    console.log('rpc_sync_costeo_diario 10:', e?.message || e);
  }
  console.log(`✅ Día 10 sincronizado: Ventas $${sales10.toLocaleString('es-CO')} COP | Food Cost: ${fc10.toFixed(1)}%`);

  // Día 11
  try {
    await supabase.rpc('rpc_sync_costeo_diario', { p_fecha: '2026-11-11', p_pos_sales: 0 });
  } catch (e) {
    console.log('rpc_sync_costeo_diario 11:', e?.message || e);
  }

  console.log('\n====================================================================');
  console.log('🎉 PROCESO COMPLETADO EXITOSAMENTE');
  console.log('====================================================================\n');
}

run().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
