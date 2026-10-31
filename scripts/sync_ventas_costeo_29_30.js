const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// 1. Cargar variables de entorno
const envPath = path.resolve(__dirname, '../.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)[1].trim();
const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/))[1].trim();
const supabase = createClient(url, key);

function cleanStr(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyProduct(name, code) {
  const n = (name || '').toLowerCase();
  if (
    n.includes('gaseosa') || n.includes('coca') || n.includes('postobon') || n.includes('agua') ||
    n.includes('cerveza') || n.includes('jugo') || n.includes('limonada') || n.includes('hit') ||
    n.includes('bretaña') || n.includes('soda') || n.includes('pilsen') || n.includes('aguila') ||
    n.includes('corona') || n.includes('poker') || n.includes('red bull') || n.includes('heineken') ||
    n.includes('cristal') || n.includes('brisa') || n.includes('quatro') || n.includes('sprite') ||
    n.includes('h2oh') || n.includes('mr tea') || n.includes('tamarindo') || n.includes('mora') ||
    n.includes('mango') || n.includes('maracuya') || n.includes('lulo') || n.includes('fresa') ||
    n.includes('guanabana') || n.includes('coronita') || n.includes('stella') || n.includes('club colombia') ||
    n.includes('aguardiente') || n.includes('ron') || n.includes('whisky') || n.includes('tequila') ||
    n.includes('vino') || n.includes('shot') || n.includes('trago') || n.includes('michelada') ||
    n.includes('gatorade') || n.includes('vive 100') || n.includes('speed')
  ) {
    return { categoria: 'BEBIDAS', subcategoria: 'BEBIDAS', es_receta: false };
  }
  if (
    n.includes('aguacate') || (n.includes('porc') && !n.includes('churrasco') && !n.includes('baby')) ||
    n.includes('porcion') || n.includes('adicional') || n.includes('arepa') || (n.includes('huevo') && !n.includes('perico') && !n.includes('desayuno')) ||
    n.includes('papas fritas') || n.includes('papa cocida') || n.includes('francesa') || n.includes('arroz porc') ||
    n.includes('patacon') || n.includes('tajadas') || n.includes('platano') || n.includes('chicharron porc') ||
    n.includes('por chicha') || n.includes('por cost') || n.includes('por pez') || n.includes('por.pescado') ||
    n.includes('por ensalada') || n.includes('banano') || n.includes('chorizo paisa') || n.includes('choricerdo') ||
    n.includes('choripollo') || n.includes('rellena casra') || n.includes('mazamorra') || n.includes('sopa sola') ||
    n.includes('sancocho dom') || n.includes('entrada tost')
  ) {
    return { categoria: 'ACOMPAÑAMIENTOS', subcategoria: 'ACOMPAÑAMIENTOS', es_receta: false };
  }
  if (n.includes('ejecutiv') || n.includes('menu del dia')) {
    return { categoria: 'PLATOS', subcategoria: 'MENU DEL DIA', es_receta: true };
  }
  if (n.includes('calentado') || n.includes('perico') || n.includes('desayuno') || n.includes('cacerola') || n.includes('huevos al gusto')) {
    return { categoria: 'PLATOS', subcategoria: 'DESAYUNOS', es_receta: true };
  }
  if (n.includes('frijolada') || n.includes('cazuela frijol') || n.includes('cazuela de camaron') || n.includes('cazuela mariscos')) {
    return { categoria: 'PLATOS', subcategoria: 'FRIJOLADAS', es_receta: true };
  }
  if (n.includes('bandeja') || n.includes('paisa')) {
    return { categoria: 'PLATOS', subcategoria: 'BANDEJAS PAISAS', es_receta: true };
  }
  if (n.includes('tamal')) {
    return { categoria: 'PLATOS', subcategoria: 'TAMALES', es_receta: true };
  }
  return { categoria: 'PLATOS', subcategoria: 'PLATOS A LA CARTA', es_receta: true };
}

async function runSync() {
  console.log('=== ACTUALIZACIÓN DE VENTAS Y HOJAS DE COSTEO DE COCINA (29 Y 30 DE OCTUBRE) ===\n');

  // A. Obtener Catálogo Maestro de Insumos
  const { data: catalogInsumos, error: catErr } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, unidad_medida, costo_unitario_kg');
  if (catErr) {
    console.error('Error cargando catalogo_insumos:', catErr);
    process.exit(1);
  }
  console.log(`Catálogo cargado: ${catalogInsumos.length} insumos.`);

  function matchInsumo(name) {
    if (!name) return null;
    const cleanN = cleanStr(name);
    // Casos especiales directos
    if (cleanN.includes('huevo')) return catalogInsumos.find(c => cleanStr(c.nombre).includes('huevo'));
    if (cleanN.includes('churrasco')) return catalogInsumos.find(c => cleanStr(c.nombre).includes('churrasco') || cleanStr(c.nombre).includes('caracho'));
    if (cleanN.includes('tocino') || cleanN.includes('chicharron')) return catalogInsumos.find(c => cleanStr(c.nombre).includes('tocino') || cleanStr(c.nombre).includes('chicharron'));
    if (cleanN.includes('sobrebarriga')) return catalogInsumos.find(c => cleanStr(c.nombre).includes('sobrebarriga'));
    if (cleanN.includes('albondiga')) return catalogInsumos.find(c => cleanStr(c.nombre).includes('albondiga') || cleanStr(c.nombre).includes('molida'));
    if (cleanN.includes('aromatica')) return catalogInsumos.find(c => cleanStr(c.nombre).includes('aromatica') || cleanStr(c.categoria).includes('granos'));

    // Búsqueda exacta o prefijo
    for (const item of catalogInsumos) {
      const cleanCat = cleanStr(item.nombre);
      if (cleanN === cleanCat || cleanN.startsWith(cleanCat) || cleanCat.startsWith(cleanN)) return item;
    }
    // Token overlap
    const tokens = cleanN.split(' ').filter(t => t.length > 2);
    let bestMatch = null;
    let maxOverlap = 0;
    for (const item of catalogInsumos) {
      const catTokens = cleanStr(item.nombre).split(' ').filter(t => t.length > 2);
      const overlap = tokens.filter(t => catTokens.includes(t)).length;
      if (overlap > maxOverlap && overlap >= 2) {
        maxOverlap = overlap;
        bestMatch = item;
      }
    }
    return bestMatch;
  }

  // =========================================================================
  // 1. INGESTIÓN DE VENTAS DEL DÍA 30 DE OCTUBRE
  // =========================================================================
  console.log('\n--- 1. Procesando Ventas del Día 30 de Octubre ---');
  const txtPath30 = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/VENTAS/30.txt';
  const txtContent30 = fs.readFileSync(txtPath30, 'latin1');
  const lineRegex = /^\s*(\d+)\s+(.+?)\s+([a-zA-Z]{2})\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,\*]+)\s+([\d\.\,]+%?)/;

  const parseColValue = (str) => {
    if (!str || str.includes('*')) return 0;
    const clean = str.replace(/,/g, '').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const lines30 = txtContent30.split(/\r?\n/);
  let day30TotalArticles = 0;
  let day30Bruta = 0;
  let day30Desc = 0;
  let day30Neta = 0;
  let day30Imp = 0;
  let day30GranTotal = 0;
  const distinctPlatos30 = new Set();
  const items30 = [];

  for (const line of lines30) {
    if (line.includes('TOTALES') || line.includes('Total :') || line.includes('TOTAL :')) break;
    const m = line.match(lineRegex);
    if (m) {
      const codigo = m[1].trim();
      const producto = m[2].trim();
      const unidad = m[3].trim().toLowerCase();
      const cant = parseColValue(m[4]);
      const vBruta = parseColValue(m[5]);
      const desc = parseColValue(m[6]);
      const vNeta = parseColValue(m[7]);
      const imp = parseColValue(m[8]);
      const granTot = parseColValue(m[9]);
      const vUnit = parseColValue(m[10]);
      const pct = parseFloat(m[11].replace('%', '')) || 0;

      if (cant > 0 || granTot > 0) {
        const cls = classifyProduct(producto, codigo);
        day30TotalArticles += cant;
        day30Bruta += vBruta;
        day30Desc += desc;
        day30Neta += vNeta;
        day30Imp += imp;
        day30GranTotal += granTot;
        distinctPlatos30.add(producto);

        items30.push({
          periodo_id: 'per-2026-10',
          fecha: '2026-10-30',
          archivo_origen: '30.txt',
          codigo_producto: codigo,
          nombre_producto: producto,
          categoria: cls.categoria,
          unidad: unidad || 'ud',
          cantidad: cant,
          venta_bruta: vBruta,
          descuento: desc,
          venta_neta: vNeta,
          impuesto: imp,
          gran_total: granTot,
          valor_unitario: vUnit || (cant > 0 ? Math.round(vNeta / cant) : 0),
          porcentaje_dia: pct
        });
      }
    }
  }

  console.log(`Ventas 30 extraídas: ${items30.length} productos, ${day30TotalArticles} unidades.`);
  console.log(`Venta Neta: $${day30Neta.toLocaleString('es-CO')} | Impuesto: $${day30Imp.toLocaleString('es-CO')} | Gran Total: $${day30GranTotal.toLocaleString('es-CO')}`);

  // Eliminar e insertar ventas del día 30
  await supabase.from('ventas_detalle').delete().eq('fecha', '2026-10-30');
  await supabase.from('ventas_diarias').delete().eq('fecha', '2026-10-30');

  const { error: insV30DiaErr } = await supabase.from('ventas_diarias').insert({
    periodo_id: 'per-2026-10',
    fecha: '2026-10-30',
    archivo_origen: '30.txt',
    dia_semana: 'Viernes',
    total_articulos: day30TotalArticles,
    venta_bruta: day30Bruta,
    descuento: day30Desc,
    venta_neta: day30Neta,
    impuesto: day30Imp,
    gran_total: day30GranTotal,
    total_platos_distintos: distinctPlatos30.size,
    ticket_promedio: distinctPlatos30.size > 0 ? Math.round(day30GranTotal / distinctPlatos30.size) : 0
  });
  if (insV30DiaErr) console.error('Error insertando ventas_diarias 30:', insV30DiaErr);
  else console.log('✓ ventas_diarias para 2026-10-30 guardado exitosamente.');

  const batchSize = 50;
  for (let i = 0; i < items30.length; i += batchSize) {
    const chunk = items30.slice(i, i + batchSize);
    const { error: insDet30Err } = await supabase.from('ventas_detalle').insert(chunk);
    if (insDet30Err) console.error(`Error lote ventas_detalle 30 (${i}):`, insDet30Err);
  }
  console.log(`✓ ventas_detalle para 2026-10-30 (${items30.length} registros) guardado exitosamente.`);

  // =========================================================================
  // 2. ACTUALIZACIÓN HOJA DE COSTEO COCINA DÍA 29 (VACIAR TRASLADOS, CONSERVAR APERTURA)
  // =========================================================================
  console.log('\n--- 2. Actualizando Hoja de Costeo Cocina del Día 29 ---');
  // Conservar APERTURA: Verificar registros actuales
  const { data: apertura29Rows } = await supabase
    .from('registros_costeo_cocina')
    .select('id, valor_total')
    .eq('fecha', '2026-10-29')
    .eq('tipo', 'APERTURA');

  const costoApertura29 = (apertura29Rows || []).reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
  console.log(`-> Apertura cocina conservada: ${apertura29Rows?.length || 0} ítems (Total: $${costoApertura29.toLocaleString('es-CO')} COP)`);

  // Vaciar SOLO los movimientos de traslado del día 29
  const { error: delMov29Err } = await supabase
    .from('registros_costeo_cocina')
    .delete()
    .eq('fecha', '2026-10-29')
    .neq('tipo', 'APERTURA');
  if (delMov29Err) console.error('Error borrando traslados 29:', delMov29Err);
  else console.log('✓ Traslados anteriores del 29 vaciados.');

  // Leer Excel oficial de movimientos 29
  const excelPath29 = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/VALORIZACIÓN DIARIA/29/VALORIZACION_INSUMOS_29_OCTUBRE_2026.xlsx';
  const wb29 = xlsx.readFile(excelPath29);
  const dataMov29 = xlsx.utils.sheet_to_json(wb29.Sheets['Movimientos 29-Oct'], { header: 1 });

  const nuevosMovs29 = [];
  let costoBruto29 = 0;

  for (let i = 4; i < dataMov29.length; i++) {
    const r = dataMov29[i];
    if (!r || !r[2] || isNaN(Number(r[0]))) continue;
    const numItem = r[0];
    const cat = String(r[1] || '').trim();
    const nombreInsumo = String(r[2] || '').trim();
    const descOriginal = String(r[3] || '').trim();
    const cant = Number(r[4] || 0);
    const und = String(r[5] || 'Kg').trim();
    const costUnit = Number(r[6] || 0);
    const vrTotal = Number(r[7] || (cant * costUnit));
    const soporte = String(r[8] || '').trim();

    if (cant <= 0 && vrTotal <= 0) continue;

    costoBruto29 += vrTotal;
    const matched = matchInsumo(nombreInsumo);

    nuevosMovs29.push({
      fecha: '2026-10-29',
      tipo: 'TRASLADO',
      insumo_id: matched ? matched.id : null,
      nombre_insumo: nombreInsumo,
      categoria: cat.toUpperCase(),
      cantidad: cant,
      unidad: und,
      costo_unitario: costUnit,
      valor_total: vrTotal,
      observaciones: `${descOriginal} • Soporte: ${soporte}`
    });
  }

  // Insertar nuevos movimientos del 29 en lotes
  for (let i = 0; i < nuevosMovs29.length; i += batchSize) {
    const chunk = nuevosMovs29.slice(i, i + batchSize);
    const { error: insM29Err } = await supabase.from('registros_costeo_cocina').insert(chunk);
    if (insM29Err) console.error(`Error insertando nuevos movimientos 29 (${i}):`, insM29Err);
  }
  console.log(`✓ Insertados ${nuevosMovs29.length} movimientos actuales del 29 (Total Traslados: $${costoBruto29.toLocaleString('es-CO')} COP).`);

  // Actualizar costeo_diario 29
  const consumoReal29 = costoApertura29 + costoBruto29;
  const posSales29 = 6870600;
  const foodCost29 = Math.round((consumoReal29 / posSales29) * 10000) / 100;

  const { error: upCosteo29Err } = await supabase
    .from('costeo_diario')
    .upsert({
      fecha: '2026-10-29',
      titulo: 'Jueves, 29 de Octubre de 2026 - Hoja Costeo Cocina',
      pos_sales: posSales29,
      costo_apertura: costoApertura29,
      costo_bruto: costoBruto29,
      devoluciones: 0,
      costo_cierre: 0,
      costo_neto: costoBruto29,
      consumo_real: consumoReal29,
      food_cost_porcentaje: foodCost29,
      estado: 'CERRADO',
      observaciones: 'Movimientos actualizados y conciliados con VALORIZACION_INSUMOS_29_OCTUBRE_2026.xlsx (Apertura intacta $741.855)'
    }, { onConflict: 'fecha' });

  if (upCosteo29Err) console.error('Error actualizando costeo_diario 29:', upCosteo29Err);
  else console.log(`✓ costeo_diario 2026-10-29 actualizado: Consumo Real $${consumoReal29.toLocaleString('es-CO')}, FC: ${foodCost29}%.`);

  // =========================================================================
  // 3. INGESTIÓN HOJA DE COSTEO COCINA DÍA 30
  // =========================================================================
  console.log('\n--- 3. Creando Hoja de Costeo Cocina del Día 30 ---');
  await supabase.from('registros_costeo_cocina').delete().eq('fecha', '2026-10-30');

  const excelPath30 = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/VALORIZACIÓN DIARIA/30/VALORIZACION_INSUMOS_30_OCTUBRE_2026.xlsx';
  const wb30 = xlsx.readFile(excelPath30);
  const dataMov30 = xlsx.utils.sheet_to_json(wb30.Sheets['Movimientos 30-Oct'], { header: 1 });

  const nuevosMovs30 = [];
  let costoBruto30 = 0;

  for (let i = 4; i < dataMov30.length; i++) {
    const r = dataMov30[i];
    if (!r || !r[2] || isNaN(Number(r[0]))) continue;
    const numItem = r[0];
    const cat = String(r[1] || '').trim();
    const nombreInsumo = String(r[2] || '').trim();
    const descOriginal = String(r[3] || '').trim();
    const cant = Number(r[4] || 0);
    const und = String(r[5] || 'Kg').trim();
    const costUnit = Number(r[6] || 0);
    const vrTotal = Number(r[7] || (cant * costUnit));
    const soporte = String(r[8] || '').trim();

    if (cant <= 0 && vrTotal <= 0) continue;

    costoBruto30 += vrTotal;
    const matched = matchInsumo(nombreInsumo);

    nuevosMovs30.push({
      fecha: '2026-10-30',
      tipo: 'TRASLADO',
      insumo_id: matched ? matched.id : null,
      nombre_insumo: nombreInsumo,
      categoria: cat.toUpperCase(),
      cantidad: cant,
      unidad: und,
      costo_unitario: costUnit,
      valor_total: vrTotal,
      observaciones: `${descOriginal} • Soporte: ${soporte}`
    });
  }

  // Insertar movimientos del 30 en lotes
  for (let i = 0; i < nuevosMovs30.length; i += batchSize) {
    const chunk = nuevosMovs30.slice(i, i + batchSize);
    const { error: insM30Err } = await supabase.from('registros_costeo_cocina').insert(chunk);
    if (insM30Err) console.error(`Error insertando movimientos 30 (${i}):`, insM30Err);
  }
  console.log(`✓ Insertados ${nuevosMovs30.length} movimientos del 30 (Total Traslados: $${costoBruto30.toLocaleString('es-CO')} COP).`);

  // Guardar costeo_diario 30
  const posSales30 = day30GranTotal || 7031200;
  const foodCost30 = Math.round((costoBruto30 / posSales30) * 10000) / 100;

  const { error: insCosteo30Err } = await supabase
    .from('costeo_diario')
    .upsert({
      fecha: '2026-10-30',
      titulo: 'Viernes, 30 de Octubre de 2026 - Hoja Costeo Cocina',
      pos_sales: posSales30,
      costo_apertura: 0,
      costo_bruto: costoBruto30,
      devoluciones: 0,
      costo_cierre: 0,
      costo_neto: costoBruto30,
      consumo_real: costoBruto30,
      food_cost_porcentaje: foodCost30,
      estado: 'CERRADO',
      observaciones: 'Cargado automáticamente desde VALORIZACION_INSUMOS_30_OCTUBRE_2026.xlsx'
    }, { onConflict: 'fecha' });

  if (insCosteo30Err) console.error('Error guardando costeo_diario 30:', insCosteo30Err);
  else console.log(`✓ costeo_diario 2026-10-30 creado: Consumo Real $${costoBruto30.toLocaleString('es-CO')}, FC: ${foodCost30}%.`);

  // =========================================================================
  // 4. VERIFICACIÓN Y AUDITORÍA FINAL
  // =========================================================================
  console.log('\n--- 4. Auditoría Final de Supabase ---');
  const { data: vdiarias } = await supabase.from('ventas_diarias').select('fecha, total_articulos, gran_total, total_platos_distintos').gte('fecha', '2026-10-29').order('fecha');
  console.log('ventas_diarias (29 y 30):');
  console.table(vdiarias);

  const { data: cdiarios } = await supabase.from('costeo_diario').select('fecha, pos_sales, costo_apertura, costo_bruto, consumo_real, food_cost_porcentaje').gte('fecha', '2026-10-29').order('fecha');
  console.log('costeo_diario (29 y 30):');
  console.table(cdiarios);

  const { count: countReg29 } = await supabase.from('registros_costeo_cocina').select('*', { count: 'exact', head: true }).eq('fecha', '2026-10-29');
  const { count: countReg30 } = await supabase.from('registros_costeo_cocina').select('*', { count: 'exact', head: true }).eq('fecha', '2026-10-30');
  console.log(`registros_costeo_cocina: Día 29 = ${countReg29} registros | Día 30 = ${countReg30} registros.`);

  console.log('\n=== PROCESO COMPLETADO EXITOSAMENTE ===');
}

runSync().catch(err => {
  console.error('Error fatal durante la sincronización:', err);
  process.exit(1);
});
