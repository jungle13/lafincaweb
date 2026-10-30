import { supabase } from '@/lib/supabase';

export interface VentaItemParsed {
  codigo: string;
  producto: string;
  cantidad: number;
  venta_bruta: number;
  descuento: number;
  venta_neta: number;
  impuesto: number;
  gran_total: number;
  valor_unitario: number;
  porcentaje_participacion: number;
  categoria: string;
  subcategoria: string;
  es_receta: boolean;
}

export interface VentasParsedData {
  fecha: string; // YYYY-MM-DD
  archivo_origen: string;
  dia_semana: string;
  periodo_id: string;
  total_articulos: number;
  venta_bruta: number;
  descuento: number;
  venta_neta: number;
  impuesto: number;
  gran_total: number;
  total_platos_distintos: number;
  ticket_promedio: number;
  items: VentaItemParsed[];
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function classifyProduct(nombre: string, codigo?: string): { categoria: string; subcategoria: string; es_receta: boolean } {
  const n = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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

/**
 * Parsea el texto de un archivo de ventas POS (.txt)
 * Valida la cabecera 'Del: DD/MM/AA' y las columnas de ventas.
 */
export function parseVentasTxtContent(content: string, fileName: string = 'ventas.txt'): VentasParsedData {
  if (!content || typeof content !== 'string') {
    throw new Error('El contenido del archivo está vacío o no es texto válido.');
  }

  // 1. Validar y extraer Fecha
  const matchFecha = content.match(/Del:\s*(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (!matchFecha) {
    throw new Error(
      'Formato no reconocido: no se encontró la cabecera reglamentaria "Del: DD/MM/AA". Asegúrese de subir un reporte oficial de ventas POS.'
    );
  }

  let year = matchFecha[3];
  if (year.length === 2) year = `20${year}`;
  const fecha = `${year}-${matchFecha[2]}-${matchFecha[1]}`;

  const dateObj = new Date(`${fecha}T12:00:00Z`);
  const diaSemana = DIAS_SEMANA[dateObj.getUTCDay()] || 'Lunes';
  const periodo_id = `per-${fecha.slice(0, 7)}`;

  // 2. Validar estructura de tabla
  if (!content.includes('=====')) {
    throw new Error('Formato incompleto: falta la cabecera de datos delimitada por "=====" de ventas.');
  }

  const lines = content.split(/\r?\n/);
  let inData = false;
  let dayTotalArticles = 0;
  let dayBruta = 0;
  let dayDesc = 0;
  let dayNeta = 0;
  let dayImp = 0;
  let dayGranTotal = 0;
  const distinctPlatos = new Set<string>();
  const items: VentaItemParsed[] = [];

  for (const line of lines) {
    if (line.includes('=====')) {
      inData = true;
      continue;
    }
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
  }

  if (items.length === 0) {
    throw new Error('No se encontraron transacciones legibles dentro del archivo. Verifique que contenga filas de ventas.');
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

/**
 * Guarda las ventas parseadas en Supabase (ventas_diarias, ventas_detalle, productos_venta y platos)
 */
export async function guardarVentasEnBaseDeDatos(parsed: VentasParsedData) {
  // 1. Sincronizar productos_venta
  const productosMap = new Map<string, any>();
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
        unidad: 'ud',
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

    // Sincronizar platos para recetas
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

  // 2. Guardar o reemplazar ventas_diarias
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

  if (errDaily) throw new Error(`Error guardando resumen diario de ventas: ${errDaily.message}`);

  // 3. Eliminar ventas_detalle previas de esa fecha para evitar duplicidad y reinsertar
  await supabase
    .from('ventas_detalle')
    .delete()
    .eq('periodo_id', parsed.periodo_id)
    .eq('fecha', parsed.fecha);

  const detallePayload = parsed.items.map((it) => ({
    periodo_id: parsed.periodo_id,
    fecha: parsed.fecha,
    codigo: it.codigo,
    producto: it.producto,
    categoria: it.categoria,
    subcategoria: it.subcategoria,
    es_receta: it.es_receta,
    cantidad: it.cantidad,
    venta_bruta: it.venta_bruta,
    descuento: it.descuento,
    venta_neta: it.venta_neta,
    impuesto: it.impuesto,
    gran_total: it.gran_total,
    valor_unitario: it.valor_unitario,
    porcentaje_participacion: it.porcentaje_participacion,
  }));

  const batchSize = 100;
  for (let i = 0; i < detallePayload.length; i += batchSize) {
    const batch = detallePayload.slice(i, i + batchSize);
    const { error: errDet } = await supabase.from('ventas_detalle').insert(batch);
    if (errDet) throw new Error(`Error guardando detalle de ventas: ${errDet.message}`);
  }

  return {
    success: true,
    fecha: parsed.fecha,
    totalArticulos: parsed.total_articulos,
    granTotal: parsed.gran_total,
    totalTransacciones: parsed.items.length,
    platosDistintos: parsed.total_platos_distintos,
  };
}
