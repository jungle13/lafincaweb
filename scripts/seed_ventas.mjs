import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function parseNum(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/,/g, '').trim()) || 0;
}

function getCategoria(nombre) {
  const n = nombre.toLowerCase();
  if (n.includes('paisa') || n.includes('frijolada') || n.includes('bandeja') || n.includes('tamal') || n.includes('sancocho')) {
    return 'Platos Típicos';
  }
  if (n.includes('pescado') || n.includes('tilapia') || n.includes('trucha') || n.includes('salmon') || n.includes('camaron') || n.includes('marisco') || n.includes('pez frito') || n.includes('cazuela')) {
    return 'Pescados y Cazuelas';
  }
  if (n.includes('cerv') || n.includes('gaseosa') || n.includes('jugo') || n.includes('limonada') || n.includes('agua') || n.includes('cola') || n.includes('tea') || n.includes('gatorade') || n.includes('h2o') || n.includes('milo') || n.includes('soda') || n.includes('costeñita') || n.includes('michelado') || n.includes('vive') || n.includes('frape')) {
    return 'Bebidas y Licores';
  }
  if (n.includes('calentado') || n.includes('perico') || n.includes('cafe') || n.includes('chocolate') || n.includes('tinto') || n.includes('avena')) {
    return 'Desayunos y Cafetería';
  }
  if (n.includes('porc') || n.includes('por ') || n.includes('porcion') || n.includes('francesa') || n.includes('papa cocida') || n.includes('aguacate') || n.includes('entrada') || n.includes('desechable') || n.includes('baño') || n.includes('banano') || n.includes('hojuela') || n.includes('actigest') || n.includes('tangelo') || n.includes('mazamorra') || n.includes('rellena') || n.includes('choricerdo') || n.includes('choripollo') || n.includes('chorizo paisa') || n.includes('huevo') || n.includes('sopa sola')) {
    return 'Porciones y Entradas';
  }
  return 'Carnes y Parrilla';
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

async function seedVentas() {
  const dir = path.resolve(__dirname, '../DOCUMENTOS BASE/ventas');
  console.log('--- Iniciando Ingesta de Ventas desde:', dir);

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
  console.log(`Encontrados ${files.length} archivos de ventas diarios.`);

  const ventasDiariasRows = [];
  const ventasDetalleRows = [];
  const platosMap = new Map();

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'latin1');
    const lines = content.split('\n');

    // Extraer fecha
    const dateMatch = content.match(/Del:\s*(\d\d\/\d\d\/\d\d)\s*Al\s*(\d\d\/\d\d\/\d\d)/i);
    let fechaISO = '2026-09-01';
    if (dateMatch) {
      const parts = dateMatch[1].split('/');
      if (parts.length === 3) {
        fechaISO = '20' + parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
      }
    }

    const dDate = new Date(fechaISO + 'T12:00:00Z');
    const diaSemana = DIAS_SEMANA[dDate.getUTCDay()];

    let dayCant = 0;
    let dayBruta = 0;
    let dayDesc = 0;
    let dayNeta = 0;
    let dayImp = 0;
    let dayTotal = 0;
    let distinctDishes = new Set();

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].replace(/\r$/, '');
      if (rawLine.length < 60) continue;
      if (rawLine.includes('====') || rawLine.includes('CODIGO') || rawLine.includes('TOTALES')) continue;
      if (rawLine.includes('RUTA:') || rawLine.includes('ARCHIVO:') || rawLine.includes('Usuario:')) continue;
      if (rawLine.includes('CHOCLOS') || rawLine.includes('VENTAS') || rawLine.includes('POR NOMBRE')) continue;

      const codigoStr = rawLine.substring(0, 6).trim();
      if (!/^\d+$/.test(codigoStr)) continue;

      const codigo = codigoStr;
      const nombre = rawLine.substring(6, 27).trim();
      const unidad = rawLine.substring(27, 32).trim().toLowerCase() || 'ud';
      const cantStr = rawLine.substring(32, 48).trim();
      const brutaStr = rawLine.substring(48, 60).trim();
      const descStr = rawLine.substring(60, 72).trim();
      const netaStr = rawLine.substring(72, 84).trim();
      const impStr = rawLine.substring(84, 96).trim();
      const totalStr = rawLine.substring(96, 108).trim();
      const unitStr = rawLine.length >= 120 ? rawLine.substring(108, 120).trim() : '';
      const pctStr = rawLine.length >= 121 ? rawLine.substring(120).trim() : '';

      const cant = parseNum(cantStr);
      const ventaBruta = parseNum(brutaStr);
      const descuento = parseNum(descStr);
      const ventaNeta = parseNum(netaStr);
      const impuesto = parseNum(impStr);
      const granTotal = parseNum(totalStr);
      const valorUnitario = unitStr.includes('*') ? 0 : parseNum(unitStr);
      const porcentaje = pctStr ? parseFloat(pctStr.replace('%', '')) || 0 : 0;

      const categoria = getCategoria(nombre);

      dayCant += cant;
      dayBruta += ventaBruta;
      dayDesc += descuento;
      dayNeta += ventaNeta;
      dayImp += impuesto;
      dayTotal += granTotal;
      distinctDishes.add(codigo);

      ventasDetalleRows.push({
        periodo_id: 'per-2026-09',
        fecha: fechaISO,
        archivo_origen: file,
        codigo_producto: codigo,
        nombre_producto: nombre,
        categoria,
        unidad,
        cantidad: cant,
        venta_bruta: ventaBruta,
        descuento,
        venta_neta: ventaNeta,
        impuesto,
        gran_total: granTotal,
        valor_unitario: valorUnitario,
        porcentaje_dia: porcentaje
      });

      if (!platosMap.has(codigo)) {
        platosMap.set(codigo, {
          codigo,
          nombre,
          precio_venta: valorUnitario > 0 ? Math.round(valorUnitario * 1.08) : granTotal / (cant || 1),
          activo: true
        });
      }
    }

    ventasDiariasRows.push({
      periodo_id: 'per-2026-09',
      fecha: fechaISO,
      archivo_origen: file,
      dia_semana: diaSemana,
      total_articulos: dayCant,
      venta_bruta: dayBruta,
      descuento: dayDesc,
      venta_neta: dayNeta,
      impuesto: dayImp,
      gran_total: dayTotal,
      total_platos_distintos: distinctDishes.size,
      ticket_promedio: dayCant > 0 ? Math.round(dayTotal / dayCant) : 0
    });
  }

  console.log(`\nResumen preparado:`);
  console.log(`- Días a insertar: ${ventasDiariasRows.length}`);
  console.log(`- Detalle a insertar: ${ventasDetalleRows.length}`);
  console.log(`- Platos únicos a insertar: ${platosMap.size}`);

  // Limpiar datos previos del periodo si existen
  console.log('\nLimpiando ventas previas del periodo per-2026-09...');
  await supabase.from('ventas_detalle').delete().eq('periodo_id', 'per-2026-09');
  await supabase.from('ventas_diarias').delete().eq('periodo_id', 'per-2026-09');

  // 1. Insertar ventas_diarias
  console.log('Insertando ventas_diarias...');
  const { error: errDiarias } = await supabase.from('ventas_diarias').insert(ventasDiariasRows);
  if (errDiarias) {
    console.error('Error insertando ventas_diarias:', errDiarias);
    throw errDiarias;
  }
  console.log('✓ ventas_diarias insertadas con éxito.');

  // 2. Insertar ventas_detalle en lotes de 200
  console.log('Insertando ventas_detalle en lotes...');
  const batchSize = 200;
  for (let i = 0; i < ventasDetalleRows.length; i += batchSize) {
    const chunk = ventasDetalleRows.slice(i, i + batchSize);
    const { error: errChunk } = await supabase.from('ventas_detalle').insert(chunk);
    if (errChunk) {
      console.error(`Error en lote ${i}-${i + batchSize}:`, errChunk);
      throw errChunk;
    }
    console.log(`  Insertados ${Math.min(i + batchSize, ventasDetalleRows.length)} / ${ventasDetalleRows.length}`);
  }
  console.log('✓ Todas las ventas_detalle insertadas con éxito.');

  // 3. Insertar / Actualizar platos en public.platos
  console.log('Insertando catálogo de platos en public.platos...');
  const platosArray = Array.from(platosMap.values());
  for (let i = 0; i < platosArray.length; i += batchSize) {
    const chunk = platosArray.slice(i, i + batchSize);
    const { error: errPlatos } = await supabase.from('platos').upsert(chunk, { onConflict: 'codigo' }).select();
    if (errPlatos) {
      console.warn('Aviso insertando platos:', errPlatos.message);
    }
  }

  // 4. Verificación final de cuadre
  const { data: checkDiarias } = await supabase.from('ventas_diarias').select('gran_total, venta_neta, impuesto, total_articulos');
  const sumTotal = (checkDiarias || []).reduce((acc, r) => acc + parseFloat(r.gran_total || 0), 0);
  const sumNeta = (checkDiarias || []).reduce((acc, r) => acc + parseFloat(r.venta_neta || 0), 0);
  const sumImp = (checkDiarias || []).reduce((acc, r) => acc + parseFloat(r.impuesto || 0), 0);
  const sumArts = (checkDiarias || []).reduce((acc, r) => acc + parseFloat(r.total_articulos || 0), 0);

  console.log('\n=============================================');
  console.log('   RESULTADOS FINALES EN SUPABASE:');
  console.log('=============================================');
  console.log(`- Días registrados: ${checkDiarias?.length}`);
  console.log(`- Total Artículos Vendidos: ${sumArts.toLocaleString('es-CO')}`);
  console.log(`- Venta Neta: $${sumNeta.toLocaleString('es-CO')}`);
  console.log(`- Impoconsumo (8%): $${sumImp.toLocaleString('es-CO')}`);
  console.log(`- GRAN TOTAL VENTAS: $${sumTotal.toLocaleString('es-CO')}`);
  console.log('=============================================\n');
}

seedVentas().catch(console.error);
