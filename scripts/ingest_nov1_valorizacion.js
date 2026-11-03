const fs = require('fs');
const xlsx = require('xlsx');

const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k] = v.join('=');
});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function normStr(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  console.log('=================================================================');
  console.log('🚀 INGESTANDO VALORIZACIÓN 01 NOVIEMBRE 2026 EN COSTEO DIARIO');
  console.log('=================================================================\n');

  const fileNov1 = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/NOVIEMBRE 2026/VALORIZACION DIARIA NOVIEMBRE 2026/1/VALORIZACION_INSUMOS_01_NOVIEMBRE_2026.xlsx';
  const wb = xlsx.readFile(fileNov1);

  // 1. Catálogo de insumos para matching de ID
  const { data: catalog } = await sb.from('catalogo_insumos').select('id, codigo, nombre, categoria, costo_unitario_kg');
  const catalogNormMap = new Map();
  catalog.forEach(c => catalogNormMap.set(normStr(c.nombre), c));

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

  // 2. Extraer APERTURA (Inventario Cocina Amanece 01)
  const rowsA = xlsx.utils.sheet_to_json(wb.Sheets['Inventario Cocina Amanece 01'], { header: 1 });
  const itemsA = [];
  for (let i = 4; i < rowsA.length; i++) {
    const r = rowsA[i];
    if (r && r[2] && typeof r[0] === 'number') {
      const match = findCatalogMatch(r[2]);
      itemsA.push({
        fecha: '2026-11-01',
        tipo: 'APERTURA',
        insumo_id: match ? match.id : null,
        nombre_insumo: r[2],
        categoria: r[1] || 'Varios',
        cantidad: Number(r[4] || 0),
        unidad: String(r[5] || 'Und').trim(),
        costo_unitario: Number(r[6] || 0),
        valor_total: Number(r[7] || 0),
        observaciones: [r[3], r[8]].filter(Boolean).join(' • ')
      });
    }
  }
  const totalA = itemsA.reduce((acc, it) => acc + it.valor_total, 0);
  console.log(`✅ Ítems Apertura Cocina: ${itemsA.length} | Total: $${totalA.toLocaleString('es-CO')}`);

  // 3. Extraer MOVIMIENTOS (Movimientos 01-Nov)
  const rowsM = xlsx.utils.sheet_to_json(wb.Sheets['Movimientos 01-Nov'], { header: 1 });
  const itemsM = [];
  for (let i = 4; i < rowsM.length; i++) {
    const r = rowsM[i];
    if (r && r[2] && typeof r[0] === 'number') {
      const match = findCatalogMatch(r[2]);
      itemsM.push({
        fecha: '2026-11-01',
        tipo: 'TRASLADO',
        insumo_id: match ? match.id : null,
        nombre_insumo: r[2],
        categoria: r[1] || 'Varios',
        cantidad: Number(r[4] || 0),
        unidad: String(r[5] || 'Und').trim(),
        costo_unitario: Number(r[6] || 0),
        valor_total: Number(r[7] || 0),
        observaciones: String(r[3] || '').trim()
      });
    }
  }
  const totalM = itemsM.reduce((acc, it) => acc + it.valor_total, 0);
  console.log(`✅ Ítems Movimientos Bodega a Cocina: ${itemsM.length} | Total: $${totalM.toLocaleString('es-CO')}`);

  // 4. Extraer CIERRE COCINA (inventario cocina cierre 01)
  const rowsC = xlsx.utils.sheet_to_json(wb.Sheets['inventario cocina cierre 01'], { header: 1 });
  const itemsC = [];
  for (let i = 4; i < rowsC.length; i++) {
    const r = rowsC[i];
    if (r && r[3] && typeof r[1] === 'number') {
      const match = findCatalogMatch(r[3]);
      itemsC.push({
        fecha: '2026-11-01',
        tipo: 'CIERRE',
        insumo_id: match ? match.id : null,
        nombre_insumo: r[3],
        categoria: r[2] || 'Varios',
        cantidad: Number(r[4] || 0),
        unidad: String(r[5] || 'Und').trim(),
        costo_unitario: Number(r[6] || 0),
        valor_total: Number(r[7] || 0),
        observaciones: String(r[8] || '').trim()
      });
    }
  }
  const totalC = itemsC.reduce((acc, it) => acc + it.valor_total, 0);
  console.log(`✅ Ítems Cierre Cocina: ${itemsC.length} | Total: $${totalC.toLocaleString('es-CO')}`);

  // 5. Eliminar registros anteriores de APERTURA, TRASLADO y CIERRE para 2026-11-01 (limpieza idempotente)
  const { error: errDel } = await sb
    .from('registros_costeo_cocina')
    .delete()
    .eq('fecha', '2026-11-01')
    .in('tipo', ['APERTURA', 'TRASLADO', 'CIERRE']);

  if (errDel) {
    console.error('Error eliminando registros previos:', errDel);
    return;
  }
  console.log('\n🧹 Registros previos de APERTURA, TRASLADO y CIERRE eliminados con éxito.');

  // 6. Insertar en chunks en registros_costeo_cocina
  const allNewRows = [...itemsA, ...itemsM, ...itemsC];
  console.log(`📥 Insertando ${allNewRows.length} registros en registros_costeo_cocina...`);

  const chunkSize = 50;
  for (let i = 0; i < allNewRows.length; i += chunkSize) {
    const chunk = allNewRows.slice(i, i + chunkSize);
    const { error: insErr } = await sb.from('registros_costeo_cocina').insert(chunk);
    if (insErr) {
      console.error(`Error insertando chunk ${i}:`, insErr);
      return;
    }
  }
  console.log('✨ Inserción en registros_costeo_cocina completada!');

  // 7. Crear / actualizar conteos_fisicos y conteos_fisicos_detalle para COCINA_APERTURA y COCINA_CIERRE
  // A) COCINA_APERTURA
  const { data: prevContA } = await sb
    .from('conteos_fisicos')
    .select('id')
    .eq('fecha', '2026-11-01')
    .eq('tipo', 'COCINA_APERTURA');

  if (prevContA && prevContA.length > 0) {
    for (const p of prevContA) {
      await sb.from('conteos_fisicos_detalle').delete().eq('conteo_id', p.id);
      await sb.from('conteos_fisicos').delete().eq('id', p.id);
    }
  }

  const { data: newContA, error: errNewA } = await sb
    .from('conteos_fisicos')
    .insert({
      fecha: '2026-11-01',
      tipo: 'COCINA_APERTURA',
      total_valor: totalA,
      usuario: 'Administración',
      estado: 'APLICADO',
      observaciones: 'Inventario físico inicial en cocina (Amanece 01 de Noviembre de 2026)'
    })
    .select('id')
    .single();

  if (errNewA) {
    console.error('Error creando conteos_fisicos COCINA_APERTURA:', errNewA);
  } else {
    const detA = itemsA.map(it => ({
      conteo_id: newContA.id,
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
    await sb.from('conteos_fisicos_detalle').insert(detA);
    console.log(`📋 Conteo físico COCINA_APERTURA creado con ${detA.length} detalles.`);
  }

  // B) COCINA_CIERRE
  const { data: prevContC } = await sb
    .from('conteos_fisicos')
    .select('id')
    .eq('fecha', '2026-11-01')
    .eq('tipo', 'COCINA_CIERRE');

  if (prevContC && prevContC.length > 0) {
    for (const p of prevContC) {
      await sb.from('conteos_fisicos_detalle').delete().eq('conteo_id', p.id);
      await sb.from('conteos_fisicos').delete().eq('id', p.id);
    }
  }

  const { data: newContC, error: errNewC } = await sb
    .from('conteos_fisicos')
    .insert({
      fecha: '2026-11-01',
      tipo: 'COCINA_CIERRE',
      total_valor: totalC,
      usuario: 'Administración',
      estado: 'APLICADO',
      observaciones: 'Inventario físico final en cocina (Cierre 01 de Noviembre de 2026)'
    })
    .select('id')
    .single();

  if (errNewC) {
    console.error('Error creando conteos_fisicos COCINA_CIERRE:', errNewC);
  } else {
    const detC = itemsC.map(it => ({
      conteo_id: newContC.id,
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
    await sb.from('conteos_fisicos_detalle').insert(detC);
    console.log(`📋 Conteo físico COCINA_CIERRE creado con ${detC.length} detalles.`);
  }

  // 8. Sincronizar cabecera en costeo_diario
  // Calcular consumo_real: costo_apertura + costo_neto - costo_cierre + costo_consumos
  const { data: consumos } = await sb
    .from('registros_costeo_cocina')
    .select('valor_total')
    .eq('fecha', '2026-11-01')
    .eq('tipo', 'CONSUMO');

  const costoConsumos = (consumos || []).reduce((acc, c) => acc + Number(c.valor_total || 0), 0);
  const consumoReal = totalA + totalM - totalC + costoConsumos;

  console.log('\n📊 Resumen Financiero Calculado:');
  console.log(`   - Costo Apertura: $${totalA.toLocaleString('es-CO')}`);
  console.log(`   - Traslados / Movimientos (Costo Bruto): $${totalM.toLocaleString('es-CO')}`);
  console.log(`   - Costo Cierre: $${totalC.toLocaleString('es-CO')}`);
  console.log(`   - Costo Consumos Internos: $${costoConsumos.toLocaleString('es-CO')}`);
  console.log(`   - Consumo Real Cocina: $${consumoReal.toLocaleString('es-CO')}`);

  const { error: errUpCd } = await sb
    .from('costeo_diario')
    .update({
      costo_apertura: totalA,
      costo_bruto: totalM,
      devoluciones: 0,
      costo_neto: totalM,
      costo_cierre: totalC,
      costo_consumos: costoConsumos,
      consumo_real: consumoReal,
      updated_at: new Date().toISOString()
    })
    .eq('fecha', '2026-11-01');

  if (errUpCd) {
    console.error('Error actualizando cabecera costeo_diario:', errUpCd);
  } else {
    console.log('✅ Cabecera costeo_diario actualizada con éxito.');
  }

  // Invocar rpc_sync_costeo_diario
  try {
    await sb.rpc('rpc_sync_costeo_diario', {
      p_fecha: '2026-11-01',
      p_pos_sales: 0,
      p_titulo: 'Domingo, 1 de Noviembre de 2026 - Hoja Costeo Cocina'
    });
    console.log('✅ rpc_sync_costeo_diario ejecutado.');
  } catch (errRpc) {
    console.error('Error rpc:', errRpc);
  }

  console.log('\n🎉 ¡PROCESO DE ACTUALIZACIÓN DE NOVIEMBRE 1 COMPLETADO EXITOSAMENTE!');
}

run();
