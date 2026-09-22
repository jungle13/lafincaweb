import { supabase } from '@/lib/supabase';

export interface VentasKPIs {
  granTotalVentas: number;
  ventaNeta: number;
  impuesto: number;
  descuentos: number;
  totalArticulos: number;
  totalDias: number;
  promedioDiario: number;
  diaRecord: {
    fecha: string;
    diaSemana: string;
    total: number;
  } | null;
  totalPlatosUnicos: number;
}

export interface VentaDiaria {
  id: string;
  periodo_id: string;
  fecha: string;
  archivo_origen: string;
  dia_semana: string;
  total_articulos: number;
  venta_bruta: number;
  descuento: number;
  venta_neta: number;
  impuesto: number;
  gran_total: number;
  total_platos_distintos: number;
  ticket_promedio: number;
}

export interface VentaDetalle {
  id: string;
  periodo_id: string;
  fecha: string;
  archivo_origen: string;
  codigo_producto: string;
  nombre_producto: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  venta_bruta: number;
  descuento: number;
  venta_neta: number;
  impuesto: number;
  gran_total: number;
  valor_unitario: number;
  porcentaje_dia: number;
}

export interface PlatoRanking {
  codigo_producto: string;
  nombre_producto: string;
  categoria: string;
  unidad: string;
  cantidad_total: number;
  gran_total: number;
  venta_neta: number;
  precio_promedio: number;
  porcentaje_ventas_total: number;
  dias_con_ventas: number;
}

export interface VentasRentabilidad {
  totalVentas: number;
  totalVentaNeta: number;
  totalCostosDirectosInsumos: number;
  margenBrutoPesos: number;
  margenBrutoPorcentaje: number;
  totalGastosOperativos: number;
  utilidadOperativaEstimada: number;
  porcentajeCostosSobreVentas: number;
}

/**
 * Obtener los KPIs consolidados de ventas para el periodo
 */
export async function getVentasKPIs(periodoId: string = 'per-2026-09'): Promise<VentasKPIs> {
  const { data: diarias, error } = await supabase
    .from('ventas_diarias')
    .select('*')
    .eq('periodo_id', periodoId)
    .order('fecha', { ascending: true });

  if (error || !diarias || diarias.length === 0) {
    return {
      granTotalVentas: 0,
      ventaNeta: 0,
      impuesto: 0,
      descuentos: 0,
      totalArticulos: 0,
      totalDias: 0,
      promedioDiario: 0,
      diaRecord: null,
      totalPlatosUnicos: 0
    };
  }

  let granTotal = 0;
  let ventaNeta = 0;
  let impuesto = 0;
  let descuentos = 0;
  let totalArticulos = 0;
  let diaRecord = { fecha: '', diaSemana: '', total: 0 };

  diarias.forEach((d) => {
    const total = parseFloat(d.gran_total || 0);
    granTotal += total;
    ventaNeta += parseFloat(d.venta_neta || 0);
    impuesto += parseFloat(d.impuesto || 0);
    descuentos += parseFloat(d.descuento || 0);
    totalArticulos += parseFloat(d.total_articulos || 0);

    if (total > diaRecord.total) {
      diaRecord = {
        fecha: d.fecha,
        diaSemana: d.dia_semana,
        total
      };
    }
  });

  const totalDias = diarias.length;
  const promedioDiario = totalDias > 0 ? granTotal / totalDias : 0;

  // Platos únicos vendidos
  const { data: dishes } = await supabase
    .from('ventas_detalle')
    .select('codigo_producto')
    .eq('periodo_id', periodoId);

  const uniqueDishes = new Set((dishes || []).map((d) => d.codigo_producto));

  return {
    granTotalVentas: granTotal,
    ventaNeta,
    impuesto,
    descuentos,
    totalArticulos,
    totalDias,
    promedioDiario,
    diaRecord: diaRecord.total > 0 ? diaRecord : null,
    totalPlatosUnicos: uniqueDishes.size
  };
}

/**
 * Obtener el listado de ventas día a día
 */
export async function getVentasDiarias(periodoId: string = 'per-2026-09'): Promise<VentaDiaria[]> {
  const { data, error } = await supabase
    .from('ventas_diarias')
    .select('*')
    .eq('periodo_id', periodoId)
    .order('fecha', { ascending: true });

  if (error) {
    console.error('Error cargando ventas diarias:', error);
    return [];
  }

  return (data || []).map((d) => ({
    id: d.id,
    periodo_id: d.periodo_id,
    fecha: d.fecha,
    archivo_origen: d.archivo_origen,
    dia_semana: d.dia_semana,
    total_articulos: parseFloat(d.total_articulos || 0),
    venta_bruta: parseFloat(d.venta_bruta || 0),
    descuento: parseFloat(d.descuento || 0),
    venta_neta: parseFloat(d.venta_neta || 0),
    impuesto: parseFloat(d.impuesto || 0),
    gran_total: parseFloat(d.gran_total || 0),
    total_platos_distintos: parseInt(d.total_platos_distintos || 0),
    ticket_promedio: parseFloat(d.ticket_promedio || 0)
  }));
}

/**
 * Obtener ranking de platos del menú consolidado por periodo
 */
export async function getVentasPorProducto(
  periodoId: string = 'per-2026-09',
  categoria: string = 'ALL',
  search: string = ''
): Promise<{ ranking: PlatoRanking[]; categorias: string[]; totalVentas: number }> {
  let query = supabase
    .from('ventas_detalle')
    .select('*')
    .eq('periodo_id', periodoId);

  if (categoria !== 'ALL') {
    query = query.eq('categoria', categoria);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error('Error cargando ranking de platos:', error);
    return { ranking: [], categorias: [], totalVentas: 0 };
  }

  const productsMap = new Map<string, {
    codigo: string;
    nombre: string;
    categoria: string;
    unidad: string;
    cantidad: number;
    gran_total: number;
    venta_neta: number;
    fechas: Set<string>;
  }>();

  const allCategories = new Set<string>();
  let totalVentas = 0;

  data.forEach((r) => {
    allCategories.add(r.categoria);
    const tot = parseFloat(r.gran_total || 0);
    totalVentas += tot;

    if (!productsMap.has(r.codigo_producto)) {
      productsMap.set(r.codigo_producto, {
        codigo: r.codigo_producto,
        nombre: r.nombre_producto,
        categoria: r.categoria,
        unidad: r.unidad || 'ud',
        cantidad: 0,
        gran_total: 0,
        venta_neta: 0,
        fechas: new Set()
      });
    }

    const p = productsMap.get(r.codigo_producto)!;
    p.cantidad += parseFloat(r.cantidad || 0);
    p.gran_total += tot;
    p.venta_neta += parseFloat(r.venta_neta || 0);
    p.fechas.add(r.fecha);
  });

  let ranking: PlatoRanking[] = Array.from(productsMap.values()).map((p) => ({
    codigo_producto: p.codigo,
    nombre_producto: p.nombre,
    categoria: p.categoria,
    unidad: p.unidad,
    cantidad_total: p.cantidad,
    gran_total: p.gran_total,
    venta_neta: p.venta_neta,
    precio_promedio: p.cantidad > 0 ? Math.round(p.gran_total / p.cantidad) : 0,
    porcentaje_ventas_total: totalVentas > 0 ? (p.gran_total / totalVentas) * 100 : 0,
    dias_con_ventas: p.fechas.size
  }));

  // Filtrado por buscador
  if (search.trim()) {
    const s = search.toLowerCase();
    ranking = ranking.filter(
      (p) =>
        p.nombre_producto.toLowerCase().includes(s) ||
        p.codigo_producto.includes(s) ||
        p.categoria.toLowerCase().includes(s)
    );
  }

  // Ordenar por defecto por mayores ingresos
  ranking.sort((a, b) => b.gran_total - a.gran_total);

  return {
    ranking,
    categorias: Array.from(allCategories).sort(),
    totalVentas
  };
}

/**
 * Obtener transacciones detalladas con paginación y filtros
 */
export async function getVentasDetalle(params: {
  periodoId?: string;
  fecha?: string;
  categoria?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ transacciones: VentaDetalle[]; total: number; page: number; totalPages: number }> {
  const {
    periodoId = 'per-2026-09',
    fecha = 'ALL',
    categoria = 'ALL',
    search = '',
    page = 1,
    pageSize = 50
  } = params;

  let query = supabase
    .from('ventas_detalle')
    .select('*', { count: 'exact' })
    .eq('periodo_id', periodoId);

  if (fecha !== 'ALL') {
    query = query.eq('fecha', fecha);
  }

  if (categoria !== 'ALL') {
    query = query.eq('categoria', categoria);
  }

  if (search.trim()) {
    const s = search.trim();
    query = query.or(`nombre_producto.ilike.%${s}%,codigo_producto.ilike.%${s}%`);
  }

  // Ordenar por fecha y luego por mayor valor
  query = query.order('fecha', { ascending: false }).order('gran_total', { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error cargando ventas detalle:', error);
    return { transacciones: [], total: 0, page: 1, totalPages: 0 };
  }

  const transacciones: VentaDetalle[] = (data || []).map((r) => ({
    id: r.id,
    periodo_id: r.periodo_id,
    fecha: r.fecha,
    archivo_origen: r.archivo_origen,
    codigo_producto: r.codigo_producto,
    nombre_producto: r.nombre_producto,
    categoria: r.categoria,
    unidad: r.unidad,
    cantidad: parseFloat(r.cantidad || 0),
    venta_bruta: parseFloat(r.venta_bruta || 0),
    descuento: parseFloat(r.descuento || 0),
    venta_neta: parseFloat(r.venta_neta || 0),
    impuesto: parseFloat(r.impuesto || 0),
    gran_total: parseFloat(r.gran_total || 0),
    valor_unitario: parseFloat(r.valor_unitario || 0),
    porcentaje_dia: parseFloat(r.porcentaje_dia || 0)
  }));

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return { transacciones, total, page, totalPages };
}

/**
 * Cruce financiero de Rentabilidad (Ventas vs Costos de Insumos)
 */
export async function getVentasRentabilidad(periodoId: string = 'per-2026-09'): Promise<VentasRentabilidad> {
  // 1. Obtener totales de ventas
  const { data: diarias } = await supabase
    .from('ventas_diarias')
    .select('gran_total, venta_neta')
    .eq('periodo_id', periodoId);

  let totalVentas = 0;
  let totalVentaNeta = 0;
  (diarias || []).forEach((d) => {
    totalVentas += parseFloat(d.gran_total || 0);
    totalVentaNeta += parseFloat(d.venta_neta || 0);
  });

  // 2. Obtener costos directos y gastos operativos de transacciones_gastos_insumos
  const { data: gastos } = await supabase
    .from('transacciones_gastos_insumos')
    .select('tipo_contable, valor_total')
    .eq('periodo_id', periodoId);

  let totalCostosDirectosInsumos = 0;
  let totalGastosOperativos = 0;

  (gastos || []).forEach((g) => {
    const val = parseFloat(g.valor_total || 0);
    if (g.tipo_contable === 'COSTO_DIRECTO') {
      totalCostosDirectosInsumos += val;
    } else {
      totalGastosOperativos += val;
    }
  });

  const margenBrutoPesos = totalVentaNeta - totalCostosDirectosInsumos;
  const margenBrutoPorcentaje = totalVentaNeta > 0 ? (margenBrutoPesos / totalVentaNeta) * 100 : 0;
  const utilidadOperativaEstimada = margenBrutoPesos - totalGastosOperativos;
  const porcentajeCostosSobreVentas = totalVentaNeta > 0 ? (totalCostosDirectosInsumos / totalVentaNeta) * 100 : 0;

  return {
    totalVentas,
    totalVentaNeta,
    totalCostosDirectosInsumos,
    margenBrutoPesos,
    margenBrutoPorcentaje,
    totalGastosOperativos,
    utilidadOperativaEstimada,
    porcentajeCostosSobreVentas
  };
}

export interface AuditoriaCierrePlanilla {
  id: string;
  fecha: string;
  pagina_planilla: string;
  sede_responsable: string;
  datafonos: number;
  nequi: number;
  efectivo: number;
  total_cuadre: number;
  reporte_x: number;
  diferencia: number;
  novedades: string;
}

export interface ComparacionVentasCuadreItem {
  fecha: string;
  dia_semana: string;
  ventas_total_txt: number;
  venta_neta: number;
  impuesto: number;
  total_articulos: number;
  reporte_x: number | null;
  diferencia_reporte_x: number | null; // ventas_total_txt - (reporte_x ?? 0)
  total_cuadre: number | null;
  diferencia_cuadre_caja: number | null; // total_cuadre - (reporte_x ?? 0)
  datafonos: number | null;
  nequi: number | null;
  efectivo: number | null;
  planillas: AuditoriaCierrePlanilla[];
  estado: 'CUADRADO_EXACTO' | 'DESCUADRE_CAJA' | 'PENDIENTE_PLANILLA';
}

export interface ComparacionCuadreResult {
  resumen: {
    totalVentasAuditadas: number;
    totalReporteX: number;
    totalCuadre: number;
    diferenciaNetaCuadre: number;
    diasConPlanilla: number;
    diasTotales: number;
  };
  comparacion: ComparacionVentasCuadreItem[];
}

export async function getComparacionCuadreVentas(
  periodoId: string = 'per-2026-09'
): Promise<ComparacionCuadreResult> {
  // 1. Obtener ventas diarias
  const { data: ventasDiarias, error: errVentas } = await supabase
    .from('ventas_diarias')
    .select('*')
    .eq('periodo_id', periodoId)
    .order('fecha', { ascending: true });

  if (errVentas) throw errVentas;

  // 2. Obtener planillas de auditoría de caja
  const { data: planillasCaja, error: errPlanillas } = await supabase
    .from('auditoria_cierres_caja')
    .select('*')
    .eq('periodo_id', periodoId)
    .order('pagina_planilla', { ascending: true });

  if (errPlanillas) throw errPlanillas;

  const planillasByFecha = new Map<string, AuditoriaCierrePlanilla[]>();
  (planillasCaja || []).forEach((p: any) => {
    const list = planillasByFecha.get(p.fecha) || [];
    list.push({
      id: p.id,
      fecha: p.fecha,
      pagina_planilla: p.pagina_planilla,
      sede_responsable: p.sede_responsable,
      datafonos: parseFloat(p.datafonos || 0),
      nequi: parseFloat(p.nequi || 0),
      efectivo: parseFloat(p.efectivo || 0),
      total_cuadre: parseFloat(p.total_cuadre || 0),
      reporte_x: parseFloat(p.reporte_x || 0),
      diferencia: parseFloat(p.diferencia || 0),
      novedades: p.novedades || ''
    });
    planillasByFecha.set(p.fecha, list);
  });

  let totalVentasAuditadas = 0;
  let totalReporteX = 0;
  let totalCuadre = 0;
  let diasConPlanilla = 0;

  const comparacion: ComparacionVentasCuadreItem[] = (ventasDiarias || []).map((vd: any) => {
    const vTotal = parseFloat(vd.gran_total || 0);
    const planillas = planillasByFecha.get(vd.fecha) || [];
    const hasPlanillas = planillas.length > 0;

    if (!hasPlanillas) {
      return {
        fecha: vd.fecha,
        dia_semana: vd.dia_semana,
        ventas_total_txt: vTotal,
        venta_neta: parseFloat(vd.venta_neta || 0),
        impuesto: parseFloat(vd.impuesto || 0),
        total_articulos: parseInt(vd.total_articulos || 0),
        reporte_x: null,
        diferencia_reporte_x: null,
        total_cuadre: null,
        diferencia_cuadre_caja: null,
        datafonos: null,
        nequi: null,
        efectivo: null,
        planillas: [],
        estado: 'PENDIENTE_PLANILLA'
      };
    }

    diasConPlanilla++;
    totalVentasAuditadas += vTotal;

    const repX = planillas.reduce((acc, p) => acc + p.reporte_x, 0);
    const totCuadre = planillas.reduce((acc, p) => acc + p.total_cuadre, 0);
    const datafonos = planillas.reduce((acc, p) => acc + p.datafonos, 0);
    const nequi = planillas.reduce((acc, p) => acc + p.nequi, 0);
    const efectivo = planillas.reduce((acc, p) => acc + p.efectivo, 0);

    totalReporteX += repX;
    totalCuadre += totCuadre;

    const difReporteX = vTotal - repX;
    const difCuadreCaja = totCuadre - repX;

    const isExact = Math.abs(difCuadreCaja) <= 1000;

    return {
      fecha: vd.fecha,
      dia_semana: vd.dia_semana,
      ventas_total_txt: vTotal,
      venta_neta: parseFloat(vd.venta_neta || 0),
      impuesto: parseFloat(vd.impuesto || 0),
      total_articulos: parseInt(vd.total_articulos || 0),
      reporte_x: repX,
      diferencia_reporte_x: difReporteX,
      total_cuadre: totCuadre,
      diferencia_cuadre_caja: difCuadreCaja,
      datafonos,
      nequi,
      efectivo,
      planillas,
      estado: isExact ? 'CUADRADO_EXACTO' : 'DESCUADRE_CAJA'
    };
  });

  const diferenciaNetaCuadre = totalCuadre - totalReporteX;

  return {
    resumen: {
      totalVentasAuditadas,
      totalReporteX,
      totalCuadre,
      diferenciaNetaCuadre,
      diasConPlanilla,
      diasTotales: ventasDiarias?.length || 0
    },
    comparacion
  };
}

