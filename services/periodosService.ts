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
export async function calculatePeriodoStock(periodoId: string, fechaCorte?: string) {
  const p = await getPeriodoById(periodoId);
  if (!p) return null;

  const initialMap = p.inventario_inicial || {};

  // 1. Obtener catálogo
  const { data: catalogo } = await supabase
    .from('catalogo_insumos')
    .select('*')
    .order('nombre');

  if (!catalogo) return null;

  // 2. Obtener movimientos aprobados del periodo
  let allMovs: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    let query = supabase
      .from('movimientos_inventario')
      .select('*')
      .gte('fecha', p.fecha_inicio)
      .order('fecha', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + step - 1);

    if (fechaCorte && !fechaCorte.startsWith('CONTEO_') && fechaCorte !== 'ACTUAL' && fechaCorte !== 'INICIAL') {
      query = query.lte('fecha', fechaCorte);
    } else {
      query = query.lte('fecha', p.fecha_fin);
    }

    const { data: page, error } = await query;
    if (error || !page || page.length === 0) break;
    allMovs.push(...page);
    if (page.length < step) break;
    from += step;
  }

  // Filtrar pendientes y de apertura inicial duplicados
  const approvedMovs = allMovs.filter((m) => {
    const obs = m.observaciones || '';
    if (obs.includes('[PENDIENTE_APROBAR]')) return false;
    if (m.tipo_movimiento === 'INVENTARIO_INICIAL') return false;
    return true;
  });

  // 3. Inicializar mapa de stock con la foto inicial
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

    stockMap[c.id] = {
      insumo_id: c.id,
      codigo: c.codigo,
      insumo: c.nombre,
      categoria: c.categoria,
      es_carne: c.es_carne,
      unidad_medida: c.unidad_medida,
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
      peso_total_bodega_kg: totalBKg,
      peso_total_cocina_kg: totalCKg,
      peso_total_general_kg: totalGKg,
      valor_total_bodega_pesos: Math.round(totalBKg * unitPrice),
      valor_total_cocina_pesos: Math.round(totalCKg * unitPrice),
      valor_total_general_pesos: Math.round(totalGKg * unitPrice),
      merma_acumulada_kg: 0,
      merma_acumulada_pesos: 0,
      traslado_cocina_acumulado_kg: 0,
      traslado_cocina_acumulado_und: 0
    };
  });

  // Si se solicitó inventario inicial estricto, retornar sin aplicar movimientos
  if (fechaCorte === 'INICIAL') {
    return { stockMap, period: p, catalogo, totalMovs: 0 };
  }

  // 4. Aplicar movimientos aprobados cronológicamente
  approvedMovs.forEach((m) => {
    const st = stockMap[m.insumo_id];
    if (!st) return;

    const cantKg = Number(m.cant_sin_porcionar_kg) || 0;
    const porcUnd = Number(m.porciones_und) || 0;
    const porcKg = Number(m.peso_porciones_kg) || 0;
    const tipo = m.tipo_movimiento;
    const origen = m.origen || '';
    const destino = m.destino || '';

    if (tipo === 'ENTRADA_COMPRA' || tipo === 'COMPRA') {
      st.bodega_sin_porcionar_kg += cantKg;
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
      if (porcUnd > 0) {
        const k = porcKg || (porcUnd * st.peso_std);
        st.bodega_porcionado_und = Math.max(0, st.bodega_porcionado_und - porcUnd);
        st.bodega_porcionado_kg = Math.max(0, st.bodega_porcionado_kg - k);
        st.cocina_porcionado_und += porcUnd;
        st.cocina_porcionado_kg += k;
        st.traslado_cocina_acumulado_und += porcUnd;
        st.traslado_cocina_acumulado_kg += k;
      } else if (cantKg > 0) {
        st.bodega_sin_porcionar_kg = Math.max(0, st.bodega_sin_porcionar_kg - cantKg);
        st.cocina_sin_porcionar_kg += cantKg;
        st.traslado_cocina_acumulado_kg += cantKg;
      }
    } else if (tipo === 'DEVOLUCION_COCINA' || tipo === 'DEVOLUCION_A_BODEGA') {
      if (porcUnd > 0) {
        const k = porcKg || (porcUnd * st.peso_std);
        st.cocina_porcionado_und = Math.max(0, st.cocina_porcionado_und - porcUnd);
        st.cocina_porcionado_kg = Math.max(0, st.cocina_porcionado_kg - k);
        st.bodega_porcionado_und += porcUnd;
        st.bodega_porcionado_kg += k;
      } else if (cantKg > 0) {
        st.cocina_sin_porcionar_kg = Math.max(0, st.cocina_sin_porcionar_kg - cantKg);
        st.bodega_sin_porcionar_kg += cantKg;
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

    // Recalcular totales por insumo
    st.peso_total_bodega_kg = st.bodega_sin_porcionar_kg + st.bodega_porcionado_kg;
    st.peso_total_cocina_kg = st.cocina_sin_porcionar_kg + st.cocina_porcionado_kg;
    st.peso_total_general_kg = st.peso_total_bodega_kg + st.peso_total_cocina_kg;
    st.valor_total_bodega_pesos = Math.round(st.peso_total_bodega_kg * st.costo_unitario_kg);
    st.valor_total_cocina_pesos = Math.round(st.peso_total_cocina_kg * st.costo_unitario_kg);
    st.valor_total_general_pesos = Math.round(st.peso_total_general_kg * st.costo_unitario_kg);
  });

  return {
    stockMap,
    period: p,
    catalogo,
    totalMovs: approvedMovs.length
  };
}
