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
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const baseDir = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/NOVIEMBRE 2026/VALORIZACION DIARIA NOVIEMBRE 2026';

function formatDateToTitle(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${dias[dateObj.getDay()]}, ${day} de ${meses[dateObj.getMonth()]} de ${year} - Hoja Costeo Cocina`;
}

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
  console.log('📋 IMPORTANDO VALORIZACIÓN DIARIA DE COSTEO (01 AL 10 NOVIEMBRE 2026)');
  console.log('====================================================================\n');

  // 1. Catálogo actual
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

  // 2. Procesar días 1 al 10
  for (let day = 1; day <= 10; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `2026-11-${dayStr}`;
    const dayFolder = path.join(baseDir, String(day));

    if (!fs.existsSync(dayFolder)) {
      console.log(`⚠️ No existe carpeta para el día ${day}`);
      continue;
    }

    const files = fs.readdirSync(dayFolder).filter(f => f.endsWith('.xlsx'));
    if (!files.length) continue;

    const filePath = path.join(dayFolder, files[0]);
    console.log(`\n=================== PROCESANDO DÍA ${dayStr} (${dateStr}) ===================`);
    const wb = xlsx.readFile(filePath);

    // A. Ventas POS
    let posSales = 0;
    const { data: vDia } = await supabase
      .from('ventas_diarias')
      .select('gran_total')
      .eq('fecha', dateStr)
      .maybeSingle();

    if (vDia && vDia.gran_total) {
      posSales = Number(vDia.gran_total);
    } else {
      const vSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('ventas'));
      if (vSheetName) {
        const vRows = xlsx.utils.sheet_to_json(wb.Sheets[vSheetName], { header: 1 });
        for (const r of vRows) {
          if (!r) continue;
          for (let c = 0; c < r.length; c++) {
            const cell = String(r[c] || '').toLowerCase();
            if (cell.includes('gran total facturado') || cell.includes('venta bruta total')) {
              const val = parseFloat(r[c + 1] || r[c + 2]);
              if (!isNaN(val) && val > 0 && posSales === 0) {
                posSales = val;
              }
            }
          }
        }
      }
    }

    // B. Amanece (Apertura Cocina)
    const sA = wb.SheetNames.find(s => s.toLowerCase().includes('amanece'));
    const itemsA = [];
    if (sA) {
      const rowsA = xlsx.utils.sheet_to_json(wb.Sheets[sA], { header: 1 });
      for (let i = 4; i < rowsA.length; i++) {
        const r = rowsA[i];
        if (r && r[2] && typeof r[0] === 'number') {
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

    // C. Movimientos (Traslados Bodega a Cocina)
    const sM = wb.SheetNames.find(s => s.toLowerCase().includes('movimientos'));
    const itemsM = [];
    if (sM) {
      const rowsM = xlsx.utils.sheet_to_json(wb.Sheets[sM], { header: 1 });
      for (let i = 4; i < rowsM.length; i++) {
        const r = rowsM[i];
        if (r && r[2] && typeof r[0] === 'number') {
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
            observaciones: String(r[3] || '').trim()
          });
        }
      }
    }
    const totM = itemsM.reduce((acc, it) => acc + it.valor_total, 0);

    // D. Cierre Cocina
    const sC = wb.SheetNames.find(s => s.toLowerCase().includes('cierre'));
    const itemsC = [];
    if (sC) {
      const rowsC = xlsx.utils.sheet_to_json(wb.Sheets[sC], { header: 1 });
      for (let i = 4; i < rowsC.length; i++) {
        const r = rowsC[i];
        if (r && r[3] && typeof r[1] === 'number') {
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

    // E. Bodega (Entradas / Cierre Bodega)
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
          const valTotal = Number(r[6] || (cant * costoUnit));
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
            observaciones: [r[7], r[8]].filter(Boolean).join(' • ')
          });
        }
      }
    }

    console.log(`📊 Día ${dayStr}:`);
    console.log(`   - Apertura: ${itemsA.length} ítems ($${totA.toLocaleString('es-CO')})`);
    console.log(`   - Traslados (Costo Bruto): ${itemsM.length} ítems ($${totM.toLocaleString('es-CO')})`);
    console.log(`   - Cierre: ${itemsC.length} ítems ($${totC.toLocaleString('es-CO')})`);
    console.log(`   - Bodega: ${itemsB.length} ítems`);
    console.log(`   - POS Sales: $${posSales.toLocaleString('es-CO')}`);

    // Limpiar registros previos de costeo para este día
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
        observaciones: `Inventario inicial en cocina (Amanece ${dayStr} de Noviembre de 2026)`
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
        observaciones: `Inventario final en cocina (Cierre ${dayStr} de Noviembre de 2026)`
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

    // Cabecera en costeo_diario
    const consumoReal = totA + totM - totC;
    const foodCostPct = posSales > 0 ? (totM / posSales) * 100 : 0;
    const titulo = formatDateToTitle(dateStr);

    const { error: errHeader } = await supabase
      .from('costeo_diario')
      .upsert({
        fecha: dateStr,
        titulo,
        pos_sales: posSales,
        costo_apertura: totA,
        costo_bruto: totM,
        devoluciones: 0,
        costo_neto: totM,
        costo_cierre: totC,
        costo_consumos: 0,
        consumo_real: consumoReal,
        food_cost_porcentaje: foodCostPct,
        estado: 'CERRADO',
        observaciones: `Sincronizado oficialmente desde Valorización Diaria Noviembre 2026`,
        updated_at: new Date().toISOString()
      }, { onConflict: 'fecha' });

    if (errHeader) {
      console.error(`Error actualizando cabecera de costeo_diario para ${dateStr}:`, errHeader.message);
    } else {
      console.log(`✅ Hoja de Costeo Diario para ${dateStr} guardada exitosamente.`);
    }
  }

  console.log('\n====================================================================');
  console.log('🎉 TODOS LOS 10 DÍAS DE COSTEO DIARIO FUERON IMPORTADOS EXITOSAMENTE');
  console.log('====================================================================\n');
}

run();
