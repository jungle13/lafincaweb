import { supabase } from '@/lib/supabase';

export interface InsumoSnapshot {
  insumo_id: string;
  nombre: string;
  categoria: string;
  bodega_sin_porc_kg: number;
  bodega_porc_und: number;
  bodega_porc_kg: number;
  cocina_sin_porc_kg: number;
  cocina_porc_und: number;
  cocina_porc_kg: number;
  costo_unitario_kg: number;
}

export interface PeriodoInventario {
  id: string;
  codigo: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'ABIERTO' | 'EN_CONCILIACION' | 'CERRADO';
  inicial_registrado: boolean;
  inventario_inicial: Record<string, InsumoSnapshot>;
  conteo_cierre_fisico?: Record<string, any>;
  ajustes_aprobados?: Record<string, any>;
  fecha_cierre?: string;
  usuario_cierre?: string;
  observaciones_cierre?: string;
}

/**
 * Obtiene todos los periodos contables desde Supabase PostgreSQL
 */
export async function getAllPeriodos(): Promise<PeriodoInventario[]> {
  try {
    const { data, error } = await supabase
      .from('periodos')
      .select('*')
      .order('codigo', { ascending: false });

    if (error) throw error;
    return (data || []) as PeriodoInventario[];
  } catch (err) {
    console.error('Error fetching periodos from Supabase:', err);
    return [];
  }
}

/**
 * Obtiene el periodo activo actual (ABIERTO o EN_CONCILIACION)
 */
export async function getActivePeriodo(): Promise<PeriodoInventario | null> {
  try {
    const { data, error } = await supabase
      .from('periodos')
      .select('*')
      .in('estado', ['ABIERTO', 'EN_CONCILIACION'])
      .order('codigo', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as PeriodoInventario;

    // Fallback: periodo más reciente
    const all = await getAllPeriodos();
    return all[0] || null;
  } catch (err) {
    console.error('Error fetching active periodo:', err);
    return null;
  }
}

/**
 * Obtiene un periodo por su ID o código
 */
export async function getPeriodoById(id: string): Promise<PeriodoInventario | null> {
  try {
    const { data, error } = await supabase
      .from('periodos')
      .select('*')
      .or(`id.eq.${id},codigo.eq.${id}`)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data as PeriodoInventario) || null;
  } catch (err) {
    console.error(`Error fetching periodo ${id}:`, err);
    return null;
  }
}

/**
 * Guarda el Inventario Inicial de un periodo en Supabase
 */
export async function saveInitialInventory(
  periodoId: string,
  items: Record<string, InsumoSnapshot>,
  usuario: string = 'Administrador'
) {
  const p = await getPeriodoById(periodoId);
  if (!p) throw new Error('Periodo no encontrado en la base de datos');

  // Actualizar tabla periodos en Supabase
  const { error: errorUpdate } = await supabase
    .from('periodos')
    .update({
      inventario_inicial: items,
      inicial_registrado: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', p.id);

  if (errorUpdate) throw errorUpdate;

  // Registrar movimientos de inicialización formal
  const fecha = p.fecha_inicio;
  for (const insumoId of Object.keys(items)) {
    const item = items[insumoId];
    if (item.bodega_sin_porc_kg > 0 || item.bodega_porc_und > 0 || item.cocina_porc_und > 0) {
      await supabase.from('movimientos_inventario').insert([{
        fecha: fecha,
        fecha_hora: `${fecha}T06:00:00.000Z`,
        tipo_movimiento: 'INVENTARIO_INICIAL',
        insumo_id: insumoId,
        origen: 'SALDO_ANTERIOR',
        destino: 'BODEGA_Y_COCINA',
        cant_sin_porcionar_kg: item.bodega_sin_porc_kg || 0,
        porciones_und: item.bodega_porc_und || 0,
        peso_porciones_kg: item.bodega_porc_kg || 0,
        costo_unitario_kg: item.costo_unitario_kg || 0,
        valor_total_movimiento: Math.round(
          ((item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0) + (item.cocina_porc_kg || 0)) * (item.costo_unitario_kg || 0)
        ),
        observaciones: `Inventario Inicial Apertura ${p.nombre}`,
        usuario: usuario
      }]);
    }
  }

  return { success: true };
}

/**
 * Guarda ajuste individual sobre un ítem en un periodo
 */
export async function saveAdjustmentItem(
  periodoId: string,
  insumoId: string,
  adjustData: any
) {
  const p = await getPeriodoById(periodoId);
  if (!p) throw new Error('Periodo no encontrado');

  const ajustes = { ...(p.ajustes_aprobados || {}), [insumoId]: adjustData };

  const { error } = await supabase
    .from('periodos')
    .update({
      ajustes_aprobados: ajustes,
      updated_at: new Date().toISOString()
    })
    .eq('id', p.id);

  if (error) throw error;
  return { success: true };
}

/**
 * Cierra formalmente un periodo contable y apertura el siguiente en Supabase
 */
export async function closeAndAdvancePeriod(
  periodoId: string,
  conteoFisico: Record<string, { bodega_kg: number; bodega_und: number; bodega_porc_kg?: number; cocina_und: number; cocina_porc_kg?: number }>,
  usuario: string = 'Administrador',
  observaciones: string = ''
) {
  const current = await getPeriodoById(periodoId);
  if (!current) throw new Error('Periodo no encontrado');

  const nowIso = new Date().toISOString();

  // 1. Cerrar periodo actual en Supabase
  await supabase
    .from('periodos')
    .update({
      estado: 'CERRADO',
      conteo_cierre_fisico: conteoFisico,
      fecha_cierre: nowIso,
      usuario_cierre: usuario,
      observaciones_cierre: observaciones,
      updated_at: nowIso
    })
    .eq('id', current.id);

  // 2. Calcular siguiente periodo (ej. 2026-08 -> 2026-09)
  const [yearStr, monthStr] = current.codigo.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(monthStr) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  const nextCodigo = `${year}-${String(month).padStart(2, '0')}`;
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const nextNombre = `${monthNames[month - 1]} ${year}`;

  const lastDay = new Date(year, month, 0).getDate();
  const nextFechaInicio = `${nextCodigo}-01`;
  const nextFechaFin = `${nextCodigo}-${String(lastDay).padStart(2, '0')}`;

  // 3. Construir inventario inicial del siguiente periodo a partir del conteo físico
  const nextInitial: Record<string, InsumoSnapshot> = {};
  const { data: catalogo } = await supabase.from('catalogo_insumos').select('*');

  (catalogo || []).forEach((c: any) => {
    const phys = conteoFisico[c.id];
    const pesoStd = Number(c.peso_estandar_porcion_kg) || 0.35;
    const bKg = phys ? Number(phys.bodega_kg) || 0 : 0;
    const bUnd = phys ? Number(phys.bodega_und) || 0 : 0;
    const bPorcKg = phys ? (Number(phys.bodega_porc_kg) || (bUnd * pesoStd)) : 0;
    const cUnd = phys ? Number(phys.cocina_und) || 0 : 0;
    const cPorcKg = phys ? (Number(phys.cocina_porc_kg) || (cUnd * pesoStd)) : 0;

    nextInitial[c.id] = {
      insumo_id: c.id,
      nombre: c.nombre,
      categoria: c.categoria,
      bodega_sin_porc_kg: bKg,
      bodega_porc_und: bUnd,
      bodega_porc_kg: bPorcKg,
      cocina_sin_porc_kg: 0,
      cocina_porc_und: cUnd,
      cocina_porc_kg: cPorcKg,
      costo_unitario_kg: Number(c.costo_unitario_kg) || 0,
    };
  });

  // 4. Upsert siguiente periodo en Supabase
  const nextPeriodPayload = {
    id: `per-${nextCodigo}`,
    codigo: nextCodigo,
    nombre: nextNombre,
    fecha_inicio: nextFechaInicio,
    fecha_fin: nextFechaFin,
    estado: 'ABIERTO',
    inicial_registrado: true,
    inventario_inicial: nextInitial,
    updated_at: nowIso
  };

  const { data: nextPeriod, error: nextError } = await supabase
    .from('periodos')
    .upsert(nextPeriodPayload, { onConflict: 'id' })
    .select()
    .single();

  if (nextError) throw nextError;

  return { current, next: nextPeriod };
}

export const closePeriodAndOpenNext = closeAndAdvancePeriod;

/**
 * Calcula el stock exacto del periodo a partir de los datos en Supabase
 */
export async function calculatePeriodoStock(periodoId?: string, fechaCorte?: string) {
  let p: PeriodoInventario | null = null;
  if (periodoId && periodoId.trim() !== '') {
    p = await getPeriodoById(periodoId);
  }
  if (!p) {
    p = await getActivePeriodo();
  }
  if (!p) return null;

  const initialMap = p.inventario_inicial || {};

  // 1. Obtener catálogo
  const { data: catalogo } = await supabase
    .from('catalogo_insumos')
    .select('*')
    .order('nombre');

  if (!catalogo) return null;

  // 2. Si se solicitó inventario inicial estricto, retornar sin aplicar movimientos ni conteos
  if (fechaCorte === 'INICIAL') {
    const stockMap: Record<string, any> = {};
    catalogo.forEach((c) => {
      const init = initialMap[c.id];
      const unitPrice = c.costo_unitario_kg || 0;
      const gramosStd = c.peso_estandar_porcion_kg ? Math.round(c.peso_estandar_porcion_kg * 1000) : 350;
      const pesoStd = gramosStd / 1000;

      const bSinPorc = init ? Number(init.bodega_sin_porc_kg) || 0 : 0;
      const bPorcUnd = init ? Number(init.bodega_porc_und) || 0 : 0;
      const bPorcKg = init ? Number(init.bodega_porc_kg) || 0 : 0;

      const cSinPorc = init ? Number(init.cocina_sin_porc_kg) || 0 : 0;
      const cPorcUnd = init ? Number(init.cocina_porc_und) || 0 : 0;
      const cPorcKg = init ? Number(init.cocina_porc_kg) || 0 : 0;

      const totalBKg = bSinPorc + bPorcKg;
      const totalCKg = cSinPorc + cPorcKg;
      const totalGKg = totalBKg + totalCKg;
      const isContable = c.tipo_medida === 'UNIDADES' || c.tipo_medida === 'PAQUETES';

      stockMap[c.id] = {
        insumo_id: c.id,
        codigo: c.codigo,
        insumo: c.nombre,
        categoria: c.categoria,
        es_carne: c.es_carne,
        unidad_medida: c.unidad_medida,
        tipo_medida: c.tipo_medida || 'KGS_Y_UNIDADES',
        peso_estandar_porcion_kg: pesoStd,
        peso_porc_gramos: gramosStd,
        peso_std: pesoStd,
        costo_unitario_kg: unitPrice,
        bodega_sin_porcionar_kg: bSinPorc,
        bodega_porcionado_und: bPorcUnd,
        bodega_porcionado_kg: bPorcKg,
        cocina_sin_porcionar_kg: cSinPorc,
        cocina_porcionado_und: cPorcUnd,
        cocina_porcionado_kg: cPorcKg,
        peso_total_bodega_kg: isContable ? 0 : totalBKg,
        peso_total_cocina_kg: isContable ? 0 : totalCKg,
        peso_total_general_kg: isContable ? 0 : totalGKg,
        valor_total_bodega_pesos: isContable ? Math.round(bPorcUnd * unitPrice) : Math.round(totalBKg * unitPrice),
        valor_total_cocina_pesos: isContable ? Math.round(cPorcUnd * unitPrice) : Math.round(totalCKg * unitPrice),
        valor_total_general_pesos: isContable ? Math.round((bPorcUnd + cPorcUnd) * unitPrice) : Math.round(totalGKg * unitPrice),
        merma_acumulada_kg: 0,
        merma_acumulada_pesos: 0,
        traslado_cocina_acumulado_kg: 0,
        traslado_cocina_acumulado_und: 0
      };
    });
    return { stockMap, period: p, catalogo, totalMovs: 0 };
  }

  // 3. Buscar si existe un conteo físico formalizado/aplicado que sirva de fotografía base
  let targetDate = p.fecha_fin;
  if (fechaCorte && !fechaCorte.startsWith('CONTEO_') && fechaCorte !== 'ACTUAL') {
    targetDate = fechaCorte;
  }

  let targetConteoId: string | null = null;
  let conteoFecha: string | null = null;
  let conteoCreatedAt: string | null = null;

  if (fechaCorte && fechaCorte.startsWith('CONTEO_')) {
    targetConteoId = fechaCorte.replace('CONTEO_', '');
    const { data: cData } = await supabase
      .from('conteos_fisicos')
      .select('id, fecha, created_at')
      .eq('id', targetConteoId)
      .maybeSingle();
    if (cData) {
      conteoFecha = cData.fecha;
      conteoCreatedAt = cData.created_at;
    }
  } else {
    // Si la fecha de corte es una jornada específica (ej. 2026-09-24 o 2026-09-30):
    // El conteo físico base de arranque debe ser ESTRICTAMENTE ANTERIOR a esa fecha (< targetDate).
    // Esto garantiza que la fecha consultada muestre el Inventario Teórico del Sistema
    // acumulado con los movimientos de dicha jornada (incluyendo compras y traslados a cocina).
    // Y que los movimientos posteriores a un conteo previo se apliquen sobre dicho conteo previo.
    const isExplicitDate = Boolean(fechaCorte && !fechaCorte.startsWith('CONTEO_') && fechaCorte !== 'ACTUAL' && fechaCorte !== 'INICIAL');

    let queryConteo = supabase
      .from('conteos_fisicos')
      .select('id, fecha, created_at')
      .eq('estado', 'APLICADO')
      .gte('fecha', p.fecha_inicio);

    if (isExplicitDate) {
      queryConteo = queryConteo.lt('fecha', targetDate);
    } else {
      queryConteo = queryConteo.lte('fecha', targetDate);
    }

    const { data: cData } = await queryConteo
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cData) {
      targetConteoId = cData.id;
      conteoFecha = cData.fecha;
      conteoCreatedAt = cData.created_at;
    }
  }

  const stockMap: Record<string, any> = {};

  if (targetConteoId) {
    // 4A. FOTOGRAFÍA OFICIAL DE CONTEO FÍSICO APLICADO
    // Regla de negocio estricta: Los insumos contados quedan con sus valores del conteo;
    // todo lo demás que no aparezca en el conteo queda exactamente en CERO (0).
    const { data: detalles } = await supabase
      .from('conteos_fisicos_detalle')
      .select('*')
      .eq('conteo_id', targetConteoId);

    const detMap = new Map<string, any>();
    (detalles || []).forEach((d: any) => {
      detMap.set(`${d.insumo_id}_${d.ubicacion}`, d);
    });

    catalogo.forEach((c) => {
      const gramosStd = c.peso_estandar_porcion_kg ? Math.round(c.peso_estandar_porcion_kg * 1000) : 350;
      const pesoStd = gramosStd / 1000;
      const detBodega = detMap.get(`${c.id}_BODEGA`);
      const detCocina = detMap.get(`${c.id}_COCINA`);

      const bSinPorc = detBodega ? parseFloat(detBodega.cant_sin_porcionar_kg || 0) : 0;
      const bPorcUnd = detBodega ? parseInt(detBodega.porciones_und || 0) : 0;
      const bPorcKg = detBodega ? parseFloat(detBodega.peso_porciones_kg || 0) : 0;

      const cSinPorc = detCocina ? parseFloat(detCocina.cant_sin_porcionar_kg || 0) : 0;
      const cPorcUnd = detCocina ? parseInt(detCocina.porciones_und || 0) : 0;
      const cPorcKg = detCocina ? parseFloat(detCocina.peso_porciones_kg || 0) : 0;

      const totalBKg = bSinPorc + bPorcKg;
      const totalCKg = cSinPorc + cPorcKg;
      const totalGKg = totalBKg + totalCKg;

      const unitPrice = detBodega?.costo_unitario_kg != null ? parseFloat(detBodega.costo_unitario_kg) : (c.costo_unitario_kg || 0);
      const isContable = c.tipo_medida === 'UNIDADES' || c.tipo_medida === 'PAQUETES';
      const valBodega = detBodega?.valor_total != null 
        ? Math.round(parseFloat(detBodega.valor_total)) 
        : (isContable ? Math.round(bPorcUnd * unitPrice) : Math.round(totalBKg * unitPrice));
      const valCocina = detCocina?.valor_total != null 
        ? Math.round(parseFloat(detCocina.valor_total)) 
        : (isContable ? Math.round(cPorcUnd * unitPrice) : Math.round(totalCKg * unitPrice));

      stockMap[c.id] = {
        insumo_id: c.id,
        codigo: c.codigo,
        insumo: c.nombre,
        categoria: c.categoria,
        es_carne: c.es_carne,
        unidad_medida: c.unidad_medida,
        tipo_medida: c.tipo_medida || 'KGS_Y_UNIDADES',
        peso_estandar_porcion_kg: pesoStd,
        peso_porc_gramos: gramosStd,
        peso_std: pesoStd,
        costo_unitario_kg: unitPrice,
        bodega_sin_porcionar_kg: bSinPorc,
        bodega_porcionado_und: bPorcUnd,
        bodega_porcionado_kg: bPorcKg,
        cocina_sin_porcionar_kg: cSinPorc,
        cocina_porcionado_und: cPorcUnd,
        cocina_porcionado_kg: cPorcKg,
        peso_total_bodega_kg: isContable ? 0 : totalBKg,
        peso_total_cocina_kg: isContable ? 0 : totalCKg,
        peso_total_general_kg: isContable ? 0 : totalGKg,
        valor_total_bodega_pesos: valBodega,
        valor_total_cocina_pesos: 0,
        valor_total_general_pesos: valBodega,
        cocina_dia_und: 0,
        cocina_dia_kg: 0,
        costo_cocina_dia: 0,
        merma_acumulada_kg: 0,
        merma_acumulada_pesos: 0,
        traslado_cocina_acumulado_kg: 0,
        traslado_cocina_acumulado_und: 0
      };
    });

  } else {
    // 4B. FOTOGRAFÍA INICIAL CUANDO NO HAY CONTEO FÍSICO APLICADO
    catalogo.forEach((c) => {
      const init = initialMap[c.id];
      const unitPrice = c.costo_unitario_kg || 0;
      const gramosStd = c.peso_estandar_porcion_kg ? Math.round(c.peso_estandar_porcion_kg * 1000) : 350;
      const pesoStd = gramosStd / 1000;

      const bSinPorc = init ? Number(init.bodega_sin_porc_kg) || 0 : 0;
      const bPorcUnd = init ? Number(init.bodega_porc_und) || 0 : 0;
      const bPorcKg = init ? Number(init.bodega_porc_kg) || 0 : 0;

      const cSinPorc = init ? Number(init.cocina_sin_porc_kg) || 0 : 0;
      const cPorcUnd = init ? Number(init.cocina_porc_und) || 0 : 0;
      const cPorcKg = init ? Number(init.cocina_porc_kg) || 0 : 0;

      const totalBKg = bSinPorc + bPorcKg;
      const totalCKg = cSinPorc + cPorcKg;
      const totalGKg = totalBKg + totalCKg;
      const isContable = c.tipo_medida === 'UNIDADES' || c.tipo_medida === 'PAQUETES';

      stockMap[c.id] = {
        insumo_id: c.id,
        codigo: c.codigo,
        insumo: c.nombre,
        categoria: c.categoria,
        es_carne: c.es_carne,
        unidad_medida: c.unidad_medida,
        tipo_medida: c.tipo_medida || 'KGS_Y_UNIDADES',
        peso_estandar_porcion_kg: pesoStd,
        peso_porc_gramos: gramosStd,
        peso_std: pesoStd,
        costo_unitario_kg: unitPrice,
        bodega_sin_porcionar_kg: bSinPorc,
        bodega_porcionado_und: bPorcUnd,
        bodega_porcionado_kg: bPorcKg,
        cocina_sin_porcionar_kg: cSinPorc,
        cocina_porcionado_und: cPorcUnd,
        cocina_porcionado_kg: cPorcKg,
        peso_total_bodega_kg: isContable ? 0 : totalBKg,
        peso_total_cocina_kg: isContable ? 0 : totalCKg,
        peso_total_general_kg: isContable ? 0 : totalGKg,
        valor_total_bodega_pesos: isContable ? Math.round(bPorcUnd * unitPrice) : Math.round(totalBKg * unitPrice),
        valor_total_cocina_pesos: 0,
        valor_total_general_pesos: isContable ? Math.round(bPorcUnd * unitPrice) : Math.round(totalBKg * unitPrice),
        cocina_dia_und: 0,
        cocina_dia_kg: 0,
        costo_cocina_dia: 0,
        merma_acumulada_kg: 0,
        merma_acumulada_pesos: 0,
        traslado_cocina_acumulado_kg: 0,
        traslado_cocina_acumulado_und: 0
      };
    });
  }

  // 5. Si la solicitud es un conteo específico, retornar directamente la foto sin movimientos posteriores
  if (fechaCorte && fechaCorte.startsWith('CONTEO_')) {
    return { stockMap, period: p, catalogo, totalMovs: 0 };
  }

  // 6. Obtener movimientos aprobados del periodo
  // Si venimos de un conteo aplicado, SOLO se aplican movimientos POSTERIORES a ese conteo
  const minMovDate = conteoFecha ? conteoFecha : p.fecha_inicio;
  let allMovs: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    let query = supabase
      .from('movimientos_inventario')
      .select('*')
      .gte('fecha', minMovDate)
      .order('fecha', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + step - 1);

    if (targetDate) {
      query = query.lte('fecha', targetDate);
    } else {
      query = query.lte('fecha', p.fecha_fin);
    }

    const { data: page, error } = await query;
    if (error || !page || page.length === 0) break;
    allMovs.push(...page);
    if (page.length < step) break;
    from += step;
  }

  // Filtrar pendientes y movimientos que ocurrieron ANTES o EN la foto del conteo previo
  const approvedMovs = allMovs.filter((m) => {
    const obs = m.observaciones || '';
    if (obs.includes('[PENDIENTE_APROBAR]')) return false;
    if (m.tipo_movimiento === 'INVENTARIO_INICIAL') return false;

    // Los ajustes generados por auditoría/conteo físico se omiten en el replay del kárdex teórico
    if (m.tipo_movimiento === 'AJUSTE_INVENTARIO' && (obs.includes('Ajuste por Conteo') || m.origen === 'AUDITORIA_FISICA')) {
      return false;
    }

    // Si hay un conteo previo como base, los movimientos de ese día del conteo ya están incorporados en la foto
    // Por tanto, solo se aplican movimientos de fechas POSTERIORES al conteo previo
    if (conteoFecha && m.fecha <= conteoFecha) return false;

    return true;
  });

  // 7A. Determinar fecha de interés para la vista de Cocina (del día específico, NUNCA acumulado)
  const isCorteFecha = Boolean(fechaCorte && !fechaCorte.startsWith('CONTEO_') && fechaCorte !== 'ACTUAL' && fechaCorte !== 'INICIAL');
  let targetCocinaDay: string | null = null;
  if (isCorteFecha) {
    targetCocinaDay = fechaCorte as string;
  } else if (fechaCorte === 'INICIAL' || (fechaCorte && fechaCorte.startsWith('CONTEO_'))) {
    targetCocinaDay = null; // Sin entregas operativas del día en inventario inicial o conteo
  } else {
    // Modo ACTUAL: buscar la fecha más reciente con movimientos aprobados
    approvedMovs.forEach((m) => {
      if (m.fecha && (!targetCocinaDay || m.fecha > targetCocinaDay)) {
        targetCocinaDay = m.fecha;
      }
    });
  }

  // 7B. Aplicar movimientos aprobados cronológicamente
  approvedMovs.forEach((m) => {
    const st = stockMap[m.insumo_id];
    if (!st) return;

    const cantKg = Number(m.cant_sin_porcionar_kg) || 0;
    const porcUnd = Number(m.porciones_und) || 0;
    const porcKg = Number(m.peso_porciones_kg) || 0;
    const tipo = m.tipo_movimiento;
    const origen = m.origen || '';
    const destino = m.destino || '';
    const isCocinaDayMov = Boolean(targetCocinaDay && m.fecha === targetCocinaDay);
    const unitPrice = st.costo_unitario_kg || 0;

    if (tipo === 'ENTRADA_COMPRA' || tipo === 'COMPRA') {
      const isContable = st.tipo_medida === 'UNIDADES' || st.tipo_medida === 'PAQUETES';
      if (isContable) {
        st.bodega_porcionado_und += (porcUnd || cantKg);
      } else {
        st.bodega_sin_porcionar_kg += cantKg;
      }
    } else if (tipo === 'PORCIONADO') {
      st.bodega_sin_porcionar_kg = Math.max(0, st.bodega_sin_porcionar_kg - cantKg);
      st.bodega_porcionado_und += porcUnd;
      st.bodega_porcionado_kg += (porcKg || (porcUnd * st.peso_std));
      const mKg = Number(m.merma_kg) || 0;
      st.merma_acumulada_kg += mKg;
    } else if (tipo === 'BAJA_MERMA' || tipo === 'DESPERDICIO') {
      const mKg = Number(m.merma_kg) || (porcUnd > 0 ? (porcKg || (porcUnd * st.peso_std)) : cantKg);
      st.merma_acumulada_kg += mKg;
      if (origen.includes('COCINA')) {
        if (porcUnd > 0) {
          st.cocina_porcionado_und = Math.max(0, st.cocina_porcionado_und - porcUnd);
          st.cocina_porcionado_kg = Math.max(0, st.cocina_porcionado_kg - (porcKg || (porcUnd * st.peso_std)));
        } else if (cantKg > 0) {
          st.cocina_sin_porcionar_kg = Math.max(0, st.cocina_sin_porcionar_kg - cantKg);
        }
      } else {
        if (porcUnd > 0) {
          st.bodega_porcionado_und = Math.max(0, st.bodega_porcionado_und - porcUnd);
          st.bodega_porcionado_kg = Math.max(0, st.bodega_porcionado_kg - (porcKg || (porcUnd * st.peso_std)));
        } else if (cantKg > 0) {
          st.bodega_sin_porcionar_kg = Math.max(0, st.bodega_sin_porcionar_kg - cantKg);
        }
      }
    } else if (tipo === 'TRASLADO_COCINA' || tipo === 'TRASLADO_A_COCINA' || tipo === 'TRASLADO') {
      const isContable = st.tipo_medida === 'UNIDADES' || st.tipo_medida === 'PAQUETES';
      if (isContable) {
        const qty = porcUnd || cantKg;
        st.bodega_porcionado_und = Math.max(0, st.bodega_porcionado_und - qty);
        st.traslado_cocina_acumulado_und += qty;
        if (isCocinaDayMov) {
          st.cocina_dia_und += qty;
          st.costo_cocina_dia += (Number(m.valor_total_movimiento) || Math.round(qty * unitPrice));
        }
      } else if (porcUnd > 0) {
        const k = porcKg || (porcUnd * st.peso_std);
        const fromListas = Math.min(st.bodega_porcionado_und, porcUnd);
        const missingFromEntero = Math.max(0, porcUnd - fromListas);
        const neededKgFromEntero = cantKg > 0 ? cantKg : (missingFromEntero > 0 ? parseFloat((missingFromEntero * (k / porcUnd)).toFixed(2)) : 0);
        const kgFromListas = Math.max(0, k - neededKgFromEntero);

        st.bodega_porcionado_und = Math.max(0, st.bodega_porcionado_und - fromListas);
        st.bodega_porcionado_kg = Math.max(0, st.bodega_porcionado_kg - kgFromListas);
        st.bodega_sin_porcionar_kg = Math.max(0, st.bodega_sin_porcionar_kg - neededKgFromEntero);

        st.traslado_cocina_acumulado_und += porcUnd;
        st.traslado_cocina_acumulado_kg += k;
        if (isCocinaDayMov) {
          st.cocina_dia_und += porcUnd;
          st.cocina_dia_kg += k;
          st.costo_cocina_dia += (Number(m.valor_total_movimiento) || Math.round(k * unitPrice));
        }
      } else if (cantKg > 0) {
        st.bodega_sin_porcionar_kg = Math.max(0, st.bodega_sin_porcionar_kg - cantKg);
        st.traslado_cocina_acumulado_kg += cantKg;
        if (isCocinaDayMov) {
          st.cocina_dia_kg += cantKg;
          st.costo_cocina_dia += (Number(m.valor_total_movimiento) || Math.round(cantKg * unitPrice));
        }
      }
    } else if (tipo === 'DEVOLUCION_COCINA' || tipo === 'DEVOLUCION_A_BODEGA') {
      const isContable = st.tipo_medida === 'UNIDADES' || st.tipo_medida === 'PAQUETES';
      if (isContable) {
        const qty = porcUnd || cantKg;
        st.bodega_porcionado_und += qty;
        if (isCocinaDayMov) {
          st.cocina_dia_und = Math.max(0, st.cocina_dia_und - qty);
          st.costo_cocina_dia = Math.max(0, st.costo_cocina_dia - (Number(m.valor_total_movimiento) || Math.round(qty * unitPrice)));
        }
      } else if (porcUnd > 0) {
        const k = porcKg || (porcUnd * st.peso_std);
        st.bodega_porcionado_und += porcUnd;
        st.bodega_porcionado_kg += k;
        if (isCocinaDayMov) {
          st.cocina_dia_und = Math.max(0, st.cocina_dia_und - porcUnd);
          st.cocina_dia_kg = Math.max(0, st.cocina_dia_kg - k);
          st.costo_cocina_dia = Math.max(0, st.costo_cocina_dia - (Number(m.valor_total_movimiento) || Math.round(k * unitPrice)));
        }
      } else if (cantKg > 0) {
        st.bodega_sin_porcionar_kg += cantKg;
        if (isCocinaDayMov) {
          st.cocina_dia_kg = Math.max(0, st.cocina_dia_kg - cantKg);
          st.costo_cocina_dia = Math.max(0, st.costo_cocina_dia - (Number(m.valor_total_movimiento) || Math.round(cantKg * unitPrice)));
        }
      }
    } else if (tipo.includes('AJUSTE')) {
      const isMerma = destino.includes('MERMA') || destino.includes('SALIDA') || origen.includes('MERMA') || origen.includes('AJUSTE_MERMA');
      if (isMerma) {
        if (origen.includes('BODEGA_ENTERO') && cantKg > 0) {
          st.bodega_sin_porcionar_kg = Math.max(0, st.bodega_sin_porcionar_kg - cantKg);
        } else if (origen.includes('BODEGA_PORCIONADO')) {
          if (porcUnd > 0) {
            st.bodega_porcionado_und = Math.max(0, st.bodega_porcionado_und - porcUnd);
            st.bodega_porcionado_kg = Math.max(0, st.bodega_porcionado_kg - (porcKg || (porcUnd * st.peso_std)));
          } else if (cantKg > 0) {
            st.bodega_porcionado_kg = Math.max(0, st.bodega_porcionado_kg - cantKg);
          }
        } else if (origen.includes('COCINA')) {
          if (porcUnd > 0) {
            st.cocina_porcionado_und = Math.max(0, st.cocina_porcionado_und - porcUnd);
            st.cocina_porcionado_kg = Math.max(0, st.cocina_porcionado_kg - (porcKg || (porcUnd * st.peso_std)));
          } else if (cantKg > 0) {
            st.cocina_sin_porcionar_kg = Math.max(0, st.cocina_sin_porcionar_kg - cantKg);
          }
        }
      } else {
        if (destino.includes('BODEGA_ENTERO')) {
          if (cantKg > 0) st.bodega_sin_porcionar_kg += cantKg;
        } else if (destino.includes('BODEGA_PORCIONADO')) {
          if (porcUnd > 0) {
            st.bodega_porcionado_und += porcUnd;
            st.bodega_porcionado_kg += (porcKg || (porcUnd * st.peso_std));
          } else if (cantKg > 0) {
            st.bodega_porcionado_kg += cantKg;
          }
        } else if (destino.includes('COCINA_PORCIONADO')) {
          if (porcUnd > 0) {
            st.cocina_porcionado_und += porcUnd;
            st.cocina_porcionado_kg += (porcKg || (porcUnd * st.peso_std));
          }
        } else if (destino.includes('COCINA_ENTERO')) {
          if (cantKg > 0) st.cocina_sin_porcionar_kg += cantKg;
        }
      }
    }

    // Recalcular totales por insumo (Cocina refleja estrictamente la fecha de corte seleccionada)
    const isContable = st.tipo_medida === 'UNIDADES' || st.tipo_medida === 'PAQUETES';
    const isKgsOnly = st.tipo_medida === 'KGS';
    st.cocina_porcionado_und = st.cocina_dia_und;
    st.cocina_sin_porcionar_kg = isKgsOnly ? st.cocina_dia_kg : 0;
    st.cocina_porcionado_kg = !isKgsOnly && !isContable ? st.cocina_dia_kg : 0;
    st.peso_total_cocina_kg = isContable ? 0 : st.cocina_dia_kg;
    st.costo_cocina_dia = Math.max(0, Math.round(st.costo_cocina_dia));
    st.valor_total_cocina_pesos = st.costo_cocina_dia;

    st.peso_total_bodega_kg = isContable ? 0 : (st.bodega_sin_porcionar_kg + st.bodega_porcionado_kg);
    st.peso_total_general_kg = st.peso_total_bodega_kg + st.peso_total_cocina_kg;
    st.valor_total_bodega_pesos = isContable 
      ? Math.round(st.bodega_porcionado_und * st.costo_unitario_kg) 
      : Math.round(st.peso_total_bodega_kg * st.costo_unitario_kg);
    st.valor_total_general_pesos = st.valor_total_bodega_pesos;
  });

  return {
    stockMap,
    period: p,
    catalogo,
    totalMovs: approvedMovs.length
  };
}

/**
 * Recalibra el stock_actual acumulando desde el último conteo físico aplicado
 * (o inventario inicial) más todos los movimientos aprobados en Supabase.
 */
export async function recalibrateStockActual(periodoId?: string) {
  const p = periodoId ? await getPeriodoById(periodoId) : await getActivePeriodo();
  if (!p) return;

  const res = await calculatePeriodoStock(p.id);
  if (!res || !res.stockMap) return;

  const nowIso = new Date().toISOString();
  const upsertRows = Object.values(res.stockMap).map((st: any) => {
    const isContable = st.tipo_medida === 'UNIDADES' || st.tipo_medida === 'PAQUETES';
    return {
      insumo_id: st.insumo_id,
      bodega_sin_porcionar_kg: isContable ? 0 : Number((st.bodega_sin_porcionar_kg || 0).toFixed(2)),
      bodega_porcionado_und: Math.round(st.bodega_porcionado_und || 0),
      bodega_porcionado_kg: isContable ? 0 : Number((st.bodega_porcionado_kg || 0).toFixed(2)),
      cocina_sin_porcionar_kg: isContable ? 0 : Number((st.cocina_sin_porcionar_kg || 0).toFixed(2)),
      cocina_porcionado_und: Math.round(st.cocina_porcionado_und || 0),
      cocina_porcionado_kg: isContable ? 0 : Number((st.cocina_porcionado_kg || 0).toFixed(2)),
      updated_at: nowIso,
    };
  });

  for (let i = 0; i < upsertRows.length; i += 50) {
    const batch = upsertRows.slice(i, i + 50);
    const { error } = await supabase.from('stock_actual').upsert(batch, { onConflict: 'insumo_id' });
    if (error) console.error('Error upserting stock_actual batch:', error);
  }
}
