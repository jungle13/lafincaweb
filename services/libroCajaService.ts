import { supabase } from '@/lib/supabase';

export interface LibroCajaRegistro {
  id: string;
  fecha: string;
  dia_mes: number;
  orden_item: number;
  tipo_libro: string;
  periodo_id: string;
  clasificacion: 'Costo / Insumo' | 'Gasto Operativo' | 'Turno / Nómina' | string;
  categoria: string;
  concepto: string;
  descripcion_beneficiario: string;
  valor_pagado: number;
  soporte_factura: string;
  responsable_caja: string;
  proveedor_fuente: string;
  usuario_registro: string;
  caja_nombre?: string;
  es_ajuste?: boolean;
  sesion_id?: string | null;
  created_at?: string;
}

export interface LibroCajaDiario {
  id: string;
  fecha: string;
  dia_mes: number;
  tipo_libro: string;
  periodo_id: string;
  base_inicial: number;
  venta_efectivo_pos: number;
  venta_pos_total: number;
  total_datafonos: number;
  total_costos_insumos: number;
  total_gastos_operativos: number;
  total_turnos_nomina: number;
  total_salidas: number;
  total_ajustes: number;
  efectivo_fisico_cierre: number;
  diferencia_cuadre: number;
  responsables_dia: string;
  estado: 'ABIERTA' | 'CERRADA' | 'AUDITADA' | string;
  observaciones: string;
}

export interface LibroCajaSesion {
  id: string;
  fecha: string;
  caja_nombre: string;
  cajero_nombre: string;
  usuario_username: string;
  efectivo_inicial: number;
  efectivo_cierre: number;
  valor_datafonos: number;
  total_salidas: number;
  total_ajustes: number;
  estado: 'ABIERTA' | 'CERRADA_PARCIAL' | 'CERRADA_TOTAL' | 'CERRADA' | string;
  numero_turno?: number;
  tipo_cierre?: 'PARCIAL' | 'TOTAL' | string;
  hora_apertura?: string;
  hora_cierre?: string | null;
  observaciones?: string;
}

export interface LibroCajaUsuario {
  id: string;
  username: string;
  nombre_cajero: string;
  rol: 'CAJERO' | 'ADMIN' | string;
  caja_predeterminada: string;
  activo: boolean;
}

export interface LibroCajaKPIs {
  totalSalidasMes: number;
  totalCostosInsumos: number;
  totalGastosOperativos: number;
  totalTurnosNomina: number;
  totalAjustesMes: number;
  totalRegistros: number;
  totalDiasActivos: number;
  porCategoria: {
    categoria: string;
    clasificacion: string;
    cantidad: number;
    total: number;
    porcentaje: number;
  }[];
  porResponsable: {
    responsable: string;
    cantidad: number;
    total: number;
  }[];
}

export function extractResponsableFromSoporte(soporteRaw: string, fallback = 'JOHANNA'): string {
  const s = String(soporteRaw || '').toUpperCase().trim();
  if (s.includes('JOHANNA')) return 'JOHANNA';
  if (s.includes('MARIA') || s.includes('MARÍA')) return 'MARIA';
  if (s.includes('CAROLINA')) return 'CAROLINA';
  if (s.includes('DANIELA')) return 'DANIELA';
  if (s.includes('LUCERO')) return 'LUCERO';
  if (s.includes('ANTONIO')) return 'ANTONIO';
  if (s.includes('NEYMAR')) return 'NEYMAR';
  if (s.includes('SALON') || s.includes('SALÓN')) return 'SALÓN';
  if (s.includes('/')) {
    return s.split('/').pop()?.trim() || fallback;
  }
  return s || fallback;
}

export async function obtenerDatosLibroCaja(periodoId: string = 'per-2026-10', tipoLibro: string = 'CAJA_MENOR') {
  const [diariosRes, registrosRes, sesionesRes, ventasPosRes, usuariosRes] = await Promise.all([
    supabase
      .from('libro_caja_diario')
      .select('*')
      .eq('tipo_libro', tipoLibro)
      .order('fecha', { ascending: true }),
    supabase
      .from('libro_caja_registros')
      .select('*')
      .eq('tipo_libro', tipoLibro)
      .order('fecha', { ascending: true })
      .order('orden_item', { ascending: true }),
    supabase
      .from('libro_caja_sesiones')
      .select('*')
      .order('fecha', { ascending: false })
      .order('hora_apertura', { ascending: true }),
    supabase
      .from('ventas_diarias')
      .select('fecha, venta_neta, gran_total'),
    supabase
      .from('libro_caja_usuarios')
      .select('id, username, nombre_cajero, rol, caja_predeterminada, activo')
      .eq('activo', true)
      .order('nombre_cajero', { ascending: true }),
  ]);

  if (diariosRes.error) throw diariosRes.error;
  if (registrosRes.error) throw registrosRes.error;

  const ventasMap = new Map<string, number>();
  for (const v of ventasPosRes.data || []) {
    ventasMap.set(v.fecha, Number(v.gran_total || v.venta_neta || 0));
  }

  const sesiones: LibroCajaSesion[] = (sesionesRes.data || []).map((s: any) => ({
    ...s,
    numero_turno: Number(s.numero_turno || 1),
    tipo_cierre: s.tipo_cierre || 'TOTAL',
    efectivo_inicial: Number(s.efectivo_inicial || 0),
    efectivo_cierre: Number(s.efectivo_cierre || 0),
    valor_datafonos: Number(s.valor_datafonos || 0),
    total_salidas: Number(s.total_salidas || 0),
    total_ajustes: Number(s.total_ajustes || 0),
  }));

  const diarios: LibroCajaDiario[] = (diariosRes.data || []).map((d: any) => {
    const posOficial = Number(d.venta_pos_total || ventasMap.get(d.fecha) || d.venta_efectivo_pos || 0);
    return {
      ...d,
      dia_mes: Number(d.dia_mes || 1),
      base_inicial: Number(d.base_inicial || 0),
      venta_efectivo_pos: Number(d.venta_efectivo_pos || posOficial || 0),
      venta_pos_total: posOficial,
      total_datafonos: Number(d.total_datafonos || 0),
      total_costos_insumos: Number(d.total_costos_insumos || 0),
      total_gastos_operativos: Number(d.total_gastos_operativos || 0),
      total_turnos_nomina: Number(d.total_turnos_nomina || 0),
      total_salidas: Number(d.total_salidas || 0),
      total_ajustes: Number(d.total_ajustes || 0),
      efectivo_fisico_cierre: Number(d.efectivo_fisico_cierre || 0),
      diferencia_cuadre: Number(d.diferencia_cuadre || 0),
    };
  });

  const registros: LibroCajaRegistro[] = (registrosRes.data || []).map((r: any) => ({
    ...r,
    dia_mes: Number(r.dia_mes || 1),
    orden_item: Number(r.orden_item || 0),
    valor_pagado: Number(r.valor_pagado || 0),
    caja_nombre: r.caja_nombre || 'CAJA 1 (PRINCIPAL)',
    es_ajuste: Boolean(r.es_ajuste),
  }));

  let totalCostosInsumos = 0;
  let totalGastosOperativos = 0;
  let totalTurnosNomina = 0;
  let totalAjustesMes = 0;

  const catMap = new Map<string, { clasificacion: string; cantidad: number; total: number }>();
  const respMap = new Map<string, { cantidad: number; total: number }>();
  const conceptosSet = new Set<string>();

  for (const r of registros) {
    const val = Number(r.valor_pagado || 0);
    if (r.es_ajuste) {
      totalAjustesMes += val;
    }
    const cl = (r.clasificacion || '').toLowerCase();
    if (cl.includes('insumo') || cl.includes('costo')) {
      totalCostosInsumos += val;
    } else if (cl.includes('nómina') || cl.includes('nomina') || cl.includes('turno')) {
      totalTurnosNomina += val;
    } else {
      totalGastosOperativos += val;
    }

    const catKey = r.categoria || 'Gastos Generales';
    const currCat = catMap.get(catKey) || { clasificacion: r.clasificacion, cantidad: 0, total: 0 };
    currCat.cantidad += 1;
    currCat.total += val;
    catMap.set(catKey, currCat);

    const respKey = r.responsable_caja || 'GENERAL';
    const currResp = respMap.get(respKey) || { cantidad: 0, total: 0 };
    currResp.cantidad += 1;
    currResp.total += val;
    respMap.set(respKey, currResp);

    if (r.concepto) conceptosSet.add(r.concepto);
  }

  const totalSalidasMes = totalCostosInsumos + totalGastosOperativos + totalTurnosNomina;

  const porCategoria = Array.from(catMap.entries())
    .map(([categoria, stats]) => ({
      categoria,
      clasificacion: stats.clasificacion,
      cantidad: stats.cantidad,
      total: stats.total,
      porcentaje: totalSalidasMes > 0 ? Number(((stats.total / totalSalidasMes) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const porResponsable = Array.from(respMap.entries())
    .map(([responsable, stats]) => ({
      responsable,
      cantidad: stats.cantidad,
      total: stats.total,
    }))
    .sort((a, b) => b.total - a.total);

  const kpis: LibroCajaKPIs = {
    totalSalidasMes,
    totalCostosInsumos,
    totalGastosOperativos,
    totalTurnosNomina,
    totalAjustesMes,
    totalRegistros: registros.length,
    totalDiasActivos: diarios.filter((d) => d.total_salidas > 0).length,
    porCategoria,
    porResponsable,
  };

  return {
    kpis,
    diarios,
    registros,
    sesiones,
    usuarios: (usuariosRes.data || []) as LibroCajaUsuario[],
    categorias: Array.from(catMap.keys()).sort(),
    responsables: Array.from(respMap.keys()).sort(),
    conceptosSugeridos: Array.from(conceptosSet).sort(),
  };
}

export async function recalcularHojaDiaria(fecha: string, tipoLibro: string = 'CAJA_MENOR') {
  const [regsRes, sesRes, posRes] = await Promise.all([
    supabase
      .from('libro_caja_registros')
      .select('*')
      .eq('fecha', fecha)
      .eq('tipo_libro', tipoLibro),
    supabase
      .from('libro_caja_sesiones')
      .select('*')
      .eq('fecha', fecha),
    supabase
      .from('ventas_diarias')
      .select('gran_total, venta_neta')
      .eq('fecha', fecha)
      .maybeSingle(),
  ]);

  if (regsRes.error) throw regsRes.error;
  const regs = regsRes.data || [];
  const sesiones = sesRes.data || [];

  let costos = 0;
  let gastos = 0;
  let turnos = 0;
  let totalAjustes = 0;
  const respSet = new Set<string>();

  for (const r of regs) {
    const val = Number(r.valor_pagado || 0);
    if (r.es_ajuste) totalAjustes += val;
    const cl = String(r.clasificacion || '').toLowerCase();
    if (cl.includes('insumo') || cl.includes('costo')) costos += val;
    else if (cl.includes('nómina') || cl.includes('nomina') || cl.includes('turno')) turnos += val;
    else gastos += val;
    if (r.responsable_caja) respSet.add(r.responsable_caja);
  }

  // Recalcular salidas y ajustes por sesión de caja si hay sesiones en la fecha
  for (const ses of sesiones) {
    const regsCaja = regs.filter(
      (r: any) =>
        r.sesion_id === ses.id ||
        (!r.sesion_id && r.responsable_caja && ses.cajero_nombre && r.responsable_caja.toUpperCase() === ses.cajero_nombre.toUpperCase())
    );
    const salCaja = regsCaja.filter((r: any) => !r.es_ajuste).reduce((a: number, b: any) => a + Number(b.valor_pagado || 0), 0);
    const ajuCaja = regsCaja.filter((r: any) => r.es_ajuste).reduce((a: number, b: any) => a + Number(b.valor_pagado || 0), 0);
    await supabase
      .from('libro_caja_sesiones')
      .update({
        total_salidas: salCaja,
        total_ajustes: ajuCaja,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ses.id);
    if (ses.cajero_nombre) respSet.add(ses.cajero_nombre);
  }

  const totalSalidas = costos + gastos + turnos;
  const diaMes = Number(fecha.split('-')[2] || 1);
  const ventaPosOficial = Number(posRes.data?.gran_total || posRes.data?.venta_neta || 0);

  const { data: existing } = await supabase
    .from('libro_caja_diario')
    .select('*')
    .eq('fecha', fecha)
    .eq('tipo_libro', tipoLibro)
    .maybeSingle();

  // Ordenar sesiones cronológicamente por apertura / turno
  const sesionesOrdenadas = [...sesiones].sort(
    (a: any, b: any) => Number(a.numero_turno || 1) - Number(b.numero_turno || 1)
  );
  const primeraSesion = sesionesOrdenadas[0];
  const ultimaSesion = sesionesOrdenadas[sesionesOrdenadas.length - 1];
  const sumDatafonosSesiones = sesionesOrdenadas.reduce(
    (a: number, s: any) => a + Number(s.valor_datafonos || 0),
    0
  );

  // Determinar estado del flujo del día según las sesiones
  let estadoDia = existing?.estado || 'ABIERTA';
  if (sesionesOrdenadas.length > 0) {
    if (sesionesOrdenadas.some((s: any) => s.estado === 'ABIERTA')) {
      estadoDia = 'ABIERTA';
    } else if (
      ultimaSesion?.estado === 'CERRADA_TOTAL' ||
      ultimaSesion?.estado === 'CERRADA' ||
      ultimaSesion?.tipo_cierre === 'TOTAL'
    ) {
      estadoDia = 'CERRADA';
    } else if (ultimaSesion?.estado === 'CERRADA_PARCIAL') {
      estadoDia = 'PARCIAL';
    }
  }

  if (existing) {
    const base = primeraSesion
      ? Number(primeraSesion.efectivo_inicial || 200000)
      : Number(existing.base_inicial || 200000);
    const ventaPos = Number(existing.venta_pos_total || ventaPosOficial || existing.venta_efectivo_pos || 0);
    const fisico = ultimaSesion
      ? Number(ultimaSesion.efectivo_cierre || 0)
      : Number(existing.efectivo_fisico_cierre || 0);
    const datafonos = sesionesOrdenadas.length > 0 ? sumDatafonosSesiones : Number(existing.total_datafonos || 0);
    // Fórmula de Cuadre Real: (Efectivo Cierre + Datafonos + Total Salidas - Base Inicial) vs Venta POS
    const recaudadoReal = fisico + datafonos + totalSalidas - base;
    const diferencia = recaudadoReal - ventaPos;

    await supabase
      .from('libro_caja_diario')
      .update({
        base_inicial: base,
        venta_pos_total: ventaPos,
        venta_efectivo_pos: ventaPos,
        total_datafonos: datafonos,
        efectivo_fisico_cierre: fisico,
        total_costos_insumos: costos,
        total_gastos_operativos: gastos,
        total_turnos_nomina: turnos,
        total_salidas: totalSalidas,
        total_ajustes: totalAjustes,
        diferencia_cuadre: diferencia,
        estado: estadoDia,
        responsables_dia: Array.from(respSet).join(' / ') || existing.responsables_dia,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    const base = primeraSesion ? Number(primeraSesion.efectivo_inicial || 200000) : 200000;
    const ventaPos = ventaPosOficial || totalSalidas;
    const fisico = ultimaSesion ? Number(ultimaSesion.efectivo_cierre || 0) : base;
    const datafonos = sesionesOrdenadas.length > 0 ? sumDatafonosSesiones : 0;
    const recaudadoReal = fisico + datafonos + totalSalidas - base;
    const diferencia = recaudadoReal - ventaPos;

    await supabase.from('libro_caja_diario').insert({
      fecha,
      dia_mes: diaMes,
      tipo_libro: tipoLibro,
      periodo_id: `per-${fecha.slice(0, 7)}`,
      base_inicial: base,
      venta_efectivo_pos: ventaPos,
      venta_pos_total: ventaPos,
      total_datafonos: datafonos,
      total_costos_insumos: costos,
      total_gastos_operativos: gastos,
      total_turnos_nomina: turnos,
      total_salidas: totalSalidas,
      total_ajustes: totalAjustes,
      efectivo_fisico_cierre: fisico,
      diferencia_cuadre: diferencia,
      responsables_dia: Array.from(respSet).join(' / ') || 'JOHANNA',
      estado: estadoDia,
      observaciones: '',
    });
  }
}
