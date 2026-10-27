const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseKey);

const dir = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/VENTAS';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && !f.includes('(1)')).sort();

console.log(`Cargando ${files.length} archivos de ventas de Octubre 2026...`);

function classifyProduct(nombre, codigo) {
  const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. BEBIDAS
  if (
    n.includes('cerv') || n.includes('cerveza') || n.includes('poker') || n.includes('aguila') || n.includes('corona') || n.includes('stella') || n.includes('costenita') || n.includes('club') ||
    n.includes('gaseosa') || n.includes('coca cola') || n.includes('postobon') || n.includes('quatro') || n.includes('sprite') || n.includes('bretana') || n.includes('soda') || n.includes('hit') ||
    n.includes('agua') || n.includes('jugo') || n.includes('limonada') || n.includes('guarapo') || n.includes('mr tea') || n.includes('pony malta') || n.includes('vive 100') || n.includes('gatorade') || n.includes('h2oh') || n.includes('del valle') ||
    n.includes('cafe') || n.includes('tinto') || n.includes('chocolate') || n.includes('milo') || n.includes('aromatica') || n.includes('jarra') || n.includes('ginger') || n.includes('michelado')
  ) {
    return { categoria: 'BEBIDAS', subcategoria: 'BEBIDAS', es_receta: false };
  }

  // 2. DESECHABLES / OTROS
  if (n.includes('desechable') || n.includes('bano') || n.includes('actigest') || n.includes('cigarro') || n.includes('dulce') || n.includes('chicle') || n.includes('cereal') || n.includes('hojuela') || n.includes('tangelo')) {
    return { categoria: 'OTROS', subcategoria: 'OTROS', es_receta: false };
  }

  // 3. ACOMPAÑAMIENTOS
  if (
    n.includes('aguacate') || (n.includes('porc') && !n.includes('churrasco') && !n.includes('baby')) || n.includes('porcion') || n.includes('adicional') || n.includes('arepa') || (n.includes('huevo') && !n.includes('perico') && !n.includes('desayuno')) ||
    n.includes('papas fritas') || n.includes('papa cocida') || n.includes('francesa') || n.includes('arroz porc') || n.includes('patacon') || n.includes('tajadas') || n.includes('platano') || n.includes('chicharron porc') ||
    n.includes('por chicha') || n.includes('por cost') || n.includes('por pez') || n.includes('por.pescado') || n.includes('por ensalada') || n.includes('banano') || n.includes('chorizo paisa') || n.includes('choricerdo') || n.includes('choripollo') || n.includes('rellena casra') ||
    n.includes('mazamorra') || n.includes('sopa sola') || n.includes('sancocho dom') || n.includes('entrada tost')
  ) {
    return { categoria: 'ACOMPAÑAMIENTOS', subcategoria: 'ACOMPAÑAMIENTOS', es_receta: false };
  }

  // 4. PLATOS
  // 4.1 MENU DEL DIA (Ejecutivos)
  if (n.includes('ejecutiv') || n.includes('menu del dia')) {
    return { categoria: 'PLATOS', subcategoria: 'MENU DEL DIA', es_receta: true };
  }

  // 4.2 DESAYUNOS
  if (n.includes('calentado') || n.includes('perico') || n.includes('desayuno') || n.includes('cacerola') || n.includes('huevos al gusto')) {
    return { categoria: 'PLATOS', subcategoria: 'DESAYUNOS', es_receta: true };
  }

  // 4.3 FRIJOLADAS
  if (n.includes('frijolada') || n.includes('cazuela frijol') || n.includes('cazuela de camaron') || n.includes('cazuela mariscos')) {
    return { categoria: 'PLATOS', subcategoria: 'FRIJOLADAS', es_receta: true };
  }

  // 4.4 BANDEJAS PAISAS
  if (n.includes('bandeja') || n.includes('paisa')) {
    return { categoria: 'PLATOS', subcategoria: 'BANDEJAS PAISAS', es_receta: true };
  }

  // 4.5 TAMALES
  if (n.includes('tamal')) {
    return { categoria: 'PLATOS', subcategoria: 'TAMALES', es_receta: true };
  }

  // 4.6 PLATOS A LA CARTA
  return { categoria: 'PLATOS', subcategoria: 'PLATOS A LA CARTA', es_receta: true };
}

const productsCatalogMap = new Map();
const allSalesDetails = [];
const allDailySummaries = [];

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

files.forEach(file => {
  const content = fs.readFileSync(path.join(dir, file), 'latin1');
  const lines = content.split('\n');

  let fecha = null;
  const matchFecha = content.match(/Del:\s*(\d{2})\/(\d{2})\/(\d{2})/);
  if (matchFecha) {
    fecha = `20${matchFecha[3]}-${matchFecha[2]}-${matchFecha[1]}`;
  }

  const dateObj = new Date(fecha + 'T12:00:00Z');
  const diaSemana = DIAS_SEMANA[dateObj.getUTCDay()] || 'Lunes';

  let inData = false;
  let dayTotalArticles = 0;
  let dayBruta = 0;
  let dayDesc = 0;
  let dayNeta = 0;
  let dayImp = 0;
  let dayGranTotal = 0;
  const distinctPlatos = new Set();

  for (const line of lines) {
    if (line.includes('=====')) { inData = true; continue; }
    if (!inData || !line.trim()) continue;
    if (line.includes('TOTALES') || line.includes('Total :') || line.includes('TOTAL :')) break;

    const trimmed = line.trim();
    const parts = trimmed.split(/\s{2,}/);
    if (parts.length >= 7) {
      const codigo = parts[0].trim();
      const producto = parts[1].trim();
      const nums = trimmed.match(/[\d\.\,]+/g);
      if (nums && nums.length >= 7) {
        const nLen = nums.length;
        const cant = parseFloat(nums[nLen - 8]?.replace(/,/g, '')) || parseFloat(nums[nLen - 7]?.replace(/,/g, '')) || 0;
        const vBruta = parseFloat(nums[nLen - 7]?.replace(/,/g, '')) || 0;
        const desc = parseFloat(nums[nLen - 6]?.replace(/,/g, '')) || 0;
        const vNeta = parseFloat(nums[nLen - 5]?.replace(/,/g, '')) || 0;
        const imp = parseFloat(nums[nLen - 4]?.replace(/,/g, '')) || 0;
        const granTot = parseFloat(nums[nLen - 3]?.replace(/,/g, '')) || 0;
        const vUnit = parseFloat(nums[nLen - 2]?.replace(/,/g, '')) || 0;
        const pct = parseFloat(nums[nLen - 1]?.replace(/,/g, '')) || 0;

        if (cant > 0 || granTot > 0) {
          const classification = classifyProduct(producto, codigo);

          // Guardar en el catálogo de productos vendibles
          if (!productsCatalogMap.has(codigo)) {
            productsCatalogMap.set(codigo, {
              codigo,
              nombre: producto,
              categoria: classification.categoria,
              subcategoria: classification.subcategoria,
              es_receta: classification.es_receta,
              preciosTotales: []
            });
          }
          const prodRecord = productsCatalogMap.get(codigo);
          if (cant > 0) {
            prodRecord.preciosTotales.push(Math.round(granTot / cant));
          }

          // Guardar detalle de transacción
          allSalesDetails.push({
            periodo_id: 'per-2026-10',
            fecha,
            archivo_origen: file,
            codigo_producto: codigo,
            nombre_producto: producto,
            categoria: classification.categoria,
            unidad: 'ud',
            cantidad: cant,
            venta_bruta: vBruta,
            descuento: desc,
            venta_neta: vNeta,
            impuesto: imp,
            gran_total: granTot,
            valor_unitario: vUnit,
            porcentaje_dia: pct
          });

          dayTotalArticles += cant;
          dayBruta += vBruta;
          dayDesc += desc;
          dayNeta += vNeta;
          dayImp += imp;
          dayGranTotal += granTot;
          distinctPlatos.add(codigo);
        }
      }
    }
  }

  allDailySummaries.push({
    periodo_id: 'per-2026-10',
    fecha,
    archivo_origen: file,
    dia_semana: diaSemana,
    total_articulos: dayTotalArticles,
    venta_bruta: dayBruta,
    descuento: dayDesc,
    venta_neta: dayNeta,
    impuesto: dayImp,
    gran_total: dayGranTotal,
    total_platos_distintos: distinctPlatos.size,
    ticket_promedio: distinctPlatos.size > 0 ? Math.round(dayGranTotal / distinctPlatos.size) : 0
  });
});

async function runMigration() {
  console.log(`\n1. Procesando Catálogo Maestro de Productos para la Venta (${productsCatalogMap.size} ítems)...`);

  const productosVentaList = [];
  productsCatalogMap.forEach(p => {
    // Determinar precio total unitario más frecuente
    const priceCounts = {};
    p.preciosTotales.forEach(pr => { priceCounts[pr] = (priceCounts[pr] || 0) + 1; });
    const bestPriceTotal = Number(Object.keys(priceCounts).sort((a,b) => priceCounts[b] - priceCounts[a])[0]) || 0;
    
    // Desglose de impoconsumo 8%
    const netoUnit = Math.round(bestPriceTotal / 1.08);
    const impUnit = bestPriceTotal - netoUnit;

    productosVentaList.push({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      subcategoria: p.subcategoria,
      unidad: 'ud',
      precio_neto: netoUnit,
      tarifa_impoconsumo: 8.0,
      impoconsumo: impUnit,
      tarifa_iva: 0.0,
      iva: 0.0,
      precio_total: bestPriceTotal,
      es_receta: p.es_receta,
      activo: true
    });
  });

  // Guardar en productos_venta
  console.log('Insertando o actualizando productos_venta...');
  const { error: pveErr } = await supabase.from('productos_venta').upsert(productosVentaList, { onConflict: 'codigo' });
  if (pveErr) {
    console.error('Error al insertar en productos_venta:', pveErr);
  } else {
    console.log(` productos_venta actualizados: ${productosVentaList.length}`);
  }

  // Sincronizar en platos (para recetas)
  console.log('Sincronizando platos para el módulo de Recetas...');
  const platosList = productosVentaList.map(pv => ({
    codigo: pv.codigo,
    nombre: pv.nombre,
    precio_venta: pv.precio_total,
    categoria: pv.categoria,
    subcategoria: pv.subcategoria,
    precio_neto: pv.precio_neto,
    impoconsumo: pv.impoconsumo,
    iva: pv.iva,
    precio_total: pv.precio_total,
    es_receta: pv.es_receta,
    unidad: pv.unidad,
    activo: true
  }));
  const { error: plErr } = await supabase.from('platos').upsert(platosList, { onConflict: 'codigo' });
  if (plErr) {
    console.error('Error al sincronizar platos:', plErr);
  } else {
    console.log(` Tabla platos sincronizada: ${platosList.length}`);
  }

  // 2. Limpiar e insertar ventas_diarias para Octubre 2026
  console.log(`\n2. Guardando Resumen Diario de Ventas (${allDailySummaries.length} días)...`);
  await supabase.from('ventas_diarias').delete().eq('periodo_id', 'per-2026-10');
  const { error: vdErr } = await supabase.from('ventas_diarias').insert(allDailySummaries);
  if (vdErr) console.error('Error en ventas_diarias:', vdErr);
  else console.log(` ventas_diarias insertadas: ${allDailySummaries.length}`);

  // 3. Limpiar e insertar ventas_detalle para Octubre 2026
  console.log(`\n3. Guardando Detalle de Ventas (${allSalesDetails.length} transacciones)...`);
  await supabase.from('ventas_detalle').delete().eq('periodo_id', 'per-2026-10');
  const batchSize = 100;
  for (let i = 0; i < allSalesDetails.length; i += batchSize) {
    const batch = allSalesDetails.slice(i, i + batchSize);
    const { error: dtErr } = await supabase.from('ventas_detalle').insert(batch);
    if (dtErr) {
      console.error(`Error en lote ${i} de ventas_detalle:`, dtErr);
      break;
    }
    console.log(` Guardados ${Math.min(i + batchSize, allSalesDetails.length)} / ${allSalesDetails.length}`);
  }

  // Total acumulado general
  const sumVentasOct = allDailySummaries.reduce((acc, d) => acc + d.gran_total, 0);
  console.log(`\n=== MIGRACIÓN DE VENTAS OCTUBRE 2026 COMPLETADA ===`);
  console.log(`Días procesados: ${allDailySummaries.length}`);
  console.log(`Transacciones de venta: ${allSalesDetails.length}`);
  console.log(`Gran Total Ventas Octubre 2026: $${sumVentasOct.toLocaleString('es-CO')}`);
}

runMigration();
