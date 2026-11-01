const fs = require('fs');
const XLSX = require('xlsx');
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

async function ingestBodegaCierre31() {
  console.log('====================================================');
  console.log('📦 INGRESANDO COSTEO BODEGA CIERRE (31 OCTUBRE 2026)');
  console.log('====================================================\n');

  const pValorizacion = 'C:\\Users\\USUARIO\\Desktop\\Proyectos\\Costos_Finca\\OCTUBRE 2026\\VALORIZACIÓN DIARIA\\31\\VALORIZACION_INSUMOS_31_OCTUBRE_2026.xlsx';
  const wb = XLSX.readFile(pValorizacion);
  const sheet = wb.Sheets['Costeo Bodega Cierre'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const excelItems = [];
  rows.forEach((r) => {
    if (r && typeof r[1] === 'number' && r[3] && typeof r[5] === 'number') {
      excelItems.push({
        num: r[1],
        cat: String(r[2] || 'Varios').trim(),
        insumo: String(r[3]).trim(),
        detalle: String(r[4] || '').trim(),
        cantidad: Number(r[5] || 0),
        unidad: String(r[6] || 'Und').trim(),
        costoUnit: Number(r[7] || 0),
        total: Number(r[8] || 0),
        soporte: String(r[9] || '').trim()
      });
    }
  });

  console.log(`📊 Total ítems extraídos de Excel: ${excelItems.length}`);

  // 1. Obtener catálogo para vincular insumo_id
  const { data: catalog } = await sb.from('catalogo_insumos').select('id, nombre, categoria');
  const catalogMap = new Map();
  (catalog || []).forEach(c => catalogMap.set(normStr(c.nombre), c));

  // 2. Obtener registros existentes de BODEGA_CIERRE en 2026-10-31
  const { data: dbItems, error: errDb } = await sb
    .from('registros_costeo_cocina')
    .select('*')
    .eq('fecha', '2026-10-31')
    .eq('tipo', 'BODEGA_CIERRE');

  if (errDb) {
    console.error('Error obteniendo registros de BODEGA_CIERRE:', errDb);
    return;
  }

  console.log(`📂 Registros existentes en BD para 2026-10-31 (BODEGA_CIERRE): ${dbItems.length}`);

  let sumadosCount = 0;
  let insertadosCount = 0;

  for (const item of excelItems) {
    const itemNorm = normStr(item.insumo);

    // Buscar si ya existe en la BD
    const existing = dbItems.find(db => {
      const dbNorm = normStr(db.nombre_insumo);
      return dbNorm === itemNorm || (dbNorm.length > 5 && itemNorm.includes(dbNorm)) || (itemNorm.length > 5 && dbNorm.includes(itemNorm));
    });

    // Buscar match en catálogo
    let catMatch = catalogMap.get(itemNorm);
    if (!catMatch) {
      for (const [cNorm, cObj] of catalogMap.entries()) {
        if ((cNorm.length > 4 && itemNorm.includes(cNorm)) || (itemNorm.length > 4 && cNorm.includes(itemNorm))) {
          catMatch = cObj;
          break;
        }
      }
    }

    if (existing) {
      // SUMAR
      const newQty = Number((Number(existing.cantidad) + item.cantidad).toFixed(2));
      const unitCost = item.costoUnit || existing.costo_unitario;
      const newTotal = Math.round(newQty * unitCost);

      const { error: errUp } = await sb
        .from('registros_costeo_cocina')
        .update({
          cantidad: newQty,
          costo_unitario: unitCost,
          valor_total: newTotal,
          observaciones: `${existing.observaciones || ''} | +${item.cantidad} ${item.unidad} (${item.soporte || 'Costeo Bodega Cierre 31-Oct'})`.trim()
        })
        .eq('id', existing.id);

      if (errUp) {
        console.error(`Error sumando a ${existing.nombre_insumo}:`, errUp.message);
      } else {
        sumadosCount++;
        console.log(`➕ SUMADO: ${item.insumo} -> Antes: ${existing.cantidad}, Ahora: ${newQty} ${existing.unidad} ($${newTotal.toLocaleString('es-CO')})`);
      }
    } else {
      // INSERTAR NUEVO
      const { error: errIns } = await sb
        .from('registros_costeo_cocina')
        .insert({
          fecha: '2026-10-31',
          tipo: 'BODEGA_CIERRE',
          insumo_id: catMatch ? catMatch.id : null,
          nombre_insumo: item.insumo,
          categoria: item.cat,
          cantidad: item.cantidad,
          unidad: item.unidad,
          costo_unitario: item.costoUnit,
          valor_total: item.total,
          observaciones: item.soporte || 'Costeo Bodega Cierre 31-Oct (Físico)'
        });

      if (errIns) {
        console.error(`Error insertando ${item.insumo}:`, errIns.message);
      } else {
        insertadosCount++;
        console.log(`✨ INSERTADO: ${item.insumo} -> ${item.cantidad} ${item.unidad} @ $${item.costoUnit} ($${item.total.toLocaleString('es-CO')})`);
      }
    }
  }

  // 3. Recalcular total de BODEGA_CIERRE para 2026-10-31
  const { data: finalItems } = await sb
    .from('registros_costeo_cocina')
    .select('valor_total')
    .eq('fecha', '2026-10-31')
    .eq('tipo', 'BODEGA_CIERRE');

  const totalBodegaCierre31 = (finalItems || []).reduce((s, it) => s + (Number(it.valor_total) || 0), 0);

  // Actualizar conteos_fisicos
  await sb
    .from('conteos_fisicos')
    .update({
      total_valor: totalBodegaCierre31,
      observaciones: 'Conteo físico oficial cierre bodega 31 de octubre 2026 (Consolidado + Costeo Bodega Cierre)'
    })
    .eq('fecha', '2026-10-31')
    .eq('tipo', 'BODEGA_CIERRE');

  console.log(`\n✅ Proceso completado exitosamente:`);
  console.log(`   - Ítems sumados a existentes: ${sumadosCount}`);
  console.log(`   - Nuevos ítems insertados: ${insertadosCount}`);
  console.log(`   - Total registros BODEGA_CIERRE en 31-Oct: ${(finalItems || []).length}`);
  console.log(`   - Gran Total Bodega Cierre 31-Oct: $${totalBodegaCierre31.toLocaleString('es-CO')} COP`);
}
ingestBodegaCierre31();
