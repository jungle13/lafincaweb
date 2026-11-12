import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function classifyProduct(nombre, codigo) {
  const n = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (
    n.includes('cerv') || n.includes('cerveza') || n.includes('poker') || n.includes('aguila') || n.includes('corona') || n.includes('stella') || n.includes('costenita') || n.includes('club') ||
    n.includes('gaseosa') || n.includes('coca cola') || n.includes('postobon') || n.includes('quatro') || n.includes('sprite') || n.includes('bretana') || n.includes('soda') || n.includes('hit') ||
    n.includes('agua') || n.includes('jugo') || n.includes('limonada') || n.includes('guarapo') || n.includes('mr tea') || n.includes('pony malta') || n.includes('vive 100') || n.includes('gatorade') || n.includes('h2oh') || n.includes('del valle') ||
    n.includes('cafe') || n.includes('tinto') || n.includes('chocolate') || n.includes('milo') || n.includes('aromatica') || n.includes('jarra') || n.includes('ginger') || n.includes('michelado')
  ) {
    return { categoria: 'BEBIDAS', subcategoria: 'BEBIDAS', es_receta: false };
  }

  if (n.includes('desechable') || n.includes('bano') || n.includes('actigest') || n.includes('cigarro') || n.includes('dulce') || n.includes('chicle') || n.includes('cereal') || n.includes('hojuela') || n.includes('tangelo')) {
    return { categoria: 'OTROS', subcategoria: 'OTROS', es_receta: false };
  }

  if (
    n.includes('aguacate') || (n.includes('porc') && !n.includes('churrasco') && !n.includes('baby')) || n.includes('porcion') || n.includes('adicional') || n.includes('arepa') || (n.includes('huevo') && !n.includes('perico') && !n.includes('desayuno')) ||
    n.includes('papas fritas') || n.includes('papa cocida') || n.includes('francesa') || n.includes('arroz porc') || n.includes('patacon') || n.includes('tajadas') || n.includes('platano') || n.includes('chicharron porc') ||
    n.includes('por chicha') || n.includes('por cost') || n.includes('por pez') || n.includes('por.pescado') || n.includes('por ensalada') || n.includes('banano') || n.includes('chorizo paisa') || n.includes('choricerdo') || n.includes('choripollo') || n.includes('rellena casra') ||
    n.includes('mazamorra') || n.includes('sopa sola') || n.includes('sancocho dom') || n.includes('entrada tost')
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

function parseVentasTxtContent(content, fileName) {
  const matchFecha = content.match(/Del:\s*(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (!matchFecha) {
    throw new Error(`Formato no reconocido en ${fileName}: falta cabecera Del: DD/MM/AA`);
  }

  let year = matchFecha[3];
  if (year.length === 2) year = `20${year}`;
  const fecha = `${year}-${matchFecha[2]}-${matchFecha[1]}`;

  const dateObj = new Date(`${fecha}T12:00:00Z`);
  const diaSemana = DIAS_SEMANA[dateObj.getUTCDay()] || 'Lunes';
  const periodo_id = `per-${fecha.slice(0, 7)}`;

  const lines = content.split(/\r?\n/);
  let dayTotalArticles = 0;
  let dayBruta = 0;
  let dayDesc = 0;
  let dayNeta = 0;
  let dayImp = 0;
  let dayGranTotal = 0;
  const distinctPlatos = new Set();
  const items = [];

  const parseColValue = (str) => {
    if (!str || str.includes('*')) return 0;
    const clean = str.replace(/,/g, '').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const lineRegex = /^\s*(\d+)\s+(.+?)\s+([a-zA-Z]{2})\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,]+)\s+([\d\.\,\*]+)\s+([\d\.\,]+%?)/;

  for (const line of lines) {
    if (line.includes('TOTALES') || line.includes('Total :') || line.includes('TOTAL :')) {
      break;
    }

    const match = line.match(lineRegex);
    if (match) {
      const codigo = match[1].trim();
      const producto = match[2].trim();
      const unidad = match[3].trim().toLowerCase();
      const cant = parseColValue(match[4]);
      const vBruta = parseColValue(match[5]);
      const desc = parseColValue(match[6]);
      const vNeta = parseColValue(match[7]);
      const imp = parseColValue(match[8]);
      const granTot = parseColValue(match[9]);
      const vUnit = parseColValue(match[10]);
      const pct = parseFloat(match[11].replace('%', '')) || 0;

      if (cant > 0 || granTot > 0) {
        const classification = classifyProduct(producto, codigo);

        dayTotalArticles += cant;
        dayBruta += vBruta;
        dayDesc += desc;
        dayNeta += vNeta;
        dayImp += imp;
        dayGranTotal += granTot;
        distinctPlatos.add(producto);

        items.push({
          codigo,
          producto,
          unidad,
          cantidad: cant,
          venta_bruta: vBruta,
          descuento: desc,
          venta_neta: vNeta,
          impuesto: imp,
          gran_total: granTot,
          valor_unitario: vUnit,
          porcentaje_participacion: pct,
          categoria: classification.categoria,
          subcategoria: classification.subcategoria,
          es_receta: classification.es_receta,
        });
      }
    }
  }

  return {
    fecha,
    archivo_origen: fileName,
    dia_semana: diaSemana,
    periodo_id,
    total_articulos: dayTotalArticles,
    venta_bruta: dayBruta,
    descuento: dayDesc,
    venta_neta: dayNeta,
    impuesto: dayImp,
    gran_total: dayGranTotal,
    total_platos_distintos: distinctPlatos.size,
    ticket_promedio: distinctPlatos.size > 0 ? Math.round(dayGranTotal / distinctPlatos.size) : 0,
    items,
  };
}

async function guardarVentasEnBaseDeDatos(parsed) {
  // 1. Sincronizar productos_venta
  const productosMap = new Map();
  for (const it of parsed.items) {
    if (!productosMap.has(it.codigo)) {
      const bestPrice = it.cantidad > 0 ? Math.round(it.gran_total / it.cantidad) : it.gran_total;
      const netoUnit = Math.round(bestPrice / 1.08);
      const impUnit = bestPrice - netoUnit;

      productosMap.set(it.codigo, {
        codigo: it.codigo,
        nombre: it.producto,
        categoria: it.categoria,
        subcategoria: it.subcategoria,
        unidad: it.unidad || 'ud',
        precio_neto: netoUnit,
        tarifa_impoconsumo: 8.0,
        impoconsumo: impUnit,
        tarifa_iva: 0.0,
        iva: 0.0,
        precio_total: bestPrice,
        es_receta: it.es_receta,
        activo: true,
      });
    }
  }

  const productosList = Array.from(productosMap.values());
  if (productosList.length > 0) {
    await supabase.from('productos_venta').upsert(productosList, { onConflict: 'codigo' });

    const platosList = productosList.map((pv) => ({
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
      activo: true,
    }));
    await supabase.from('platos').upsert(platosList, { onConflict: 'codigo' });
  }

  // 2. Guardar ventas_diarias
  const dailySummaryPayload = {
    periodo_id: parsed.periodo_id,
    fecha: parsed.fecha,
    archivo_origen: parsed.archivo_origen,
    dia_semana: parsed.dia_semana,
    total_articulos: parsed.total_articulos,
    venta_bruta: parsed.venta_bruta,
    descuento: parsed.descuento,
    venta_neta: parsed.venta_neta,
    impuesto: parsed.impuesto,
    gran_total: parsed.gran_total,
    total_platos_distintos: parsed.total_platos_distintos,
    ticket_promedio: parsed.ticket_promedio,
  };

  const { error: errDaily } = await supabase
    .from('ventas_diarias')
    .upsert(dailySummaryPayload, { onConflict: 'periodo_id,fecha' });

  if (errDaily) throw new Error(`Error guardando ventas_diarias: ${errDaily.message}`);

  // 3. Eliminar ventas_detalle previas e insertar
  await supabase
    .from('ventas_detalle')
    .delete()
    .eq('periodo_id', parsed.periodo_id)
    .eq('fecha', parsed.fecha);

  const detallePayload = parsed.items.map((it) => ({
    periodo_id: parsed.periodo_id,
    fecha: parsed.fecha,
    archivo_origen: parsed.archivo_origen,
    codigo_producto: it.codigo,
    nombre_producto: it.producto,
    categoria: it.categoria,
    unidad: 'ud',
    cantidad: Number(it.cantidad || 0),
    venta_bruta: Number(it.venta_bruta || 0),
    descuento: Number(it.descuento || 0),
    venta_neta: Number(it.venta_neta || 0),
    impuesto: Number(it.impuesto || 0),
    gran_total: Number(it.gran_total || 0),
    valor_unitario: Number(it.valor_unitario || 0),
    porcentaje_dia: Number(it.porcentaje_participacion || 0),
  }));

  const batchSize = 100;
  for (let i = 0; i < detallePayload.length; i += batchSize) {
    const batch = detallePayload.slice(i, i + batchSize);
    const { error: errDet } = await supabase.from('ventas_detalle').insert(batch);
    if (errDet) throw new Error(`Error guardando detalle de ventas: ${errDet.message}`);
  }

  console.log(`✅ Ventas para ${parsed.fecha} (${parsed.archivo_origen}) guardadas: $${parsed.gran_total.toLocaleString('es-CO')} COP (${parsed.items.length} líneas)`);
}

async function run() {
  console.log('🚀 INICIANDO INGESTIÓN DE VENTAS POS NOVIEMBRE 9 Y 10...');
  const basePath = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/NOVIEMBRE 2026/VENTAS';

  const files = ['09.txt', '10.txt'];
  for (const f of files) {
    const fullPath = path.join(basePath, f);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Archivo no encontrado: ${fullPath}`);
      continue;
    }
    const content = fs.readFileSync(fullPath, 'latin1');
    const parsed = parseVentasTxtContent(content, f);
    await guardarVentasEnBaseDeDatos(parsed);
  }

  console.log('🎉 INGESTIÓN DE VENTAS 9 Y 10 COMPLETADA EXITOSAMENTE.');
}

run().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
