import fs from 'fs';
import path from 'path';
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
  codigo: string; // ej: "2026-08"
  nombre: string; // ej: "Agosto 2026"
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'ABIERTO' | 'EN_CONCILIACION' | 'CERRADO';
  inicial_registrado: boolean;
  inventario_inicial: Record<string, InsumoSnapshot>;
  conteo_cierre_fisico?: Record<string, { bodega_kg: number; bodega_und: number; bodega_porc_kg?: number; cocina_und: number; cocina_porc_kg?: number }>;
  ajustes_aprobados?: Record<string, any>;
  fecha_cierre?: string;
  usuario_cierre?: string;
  observaciones_cierre?: string;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'periodos.json');

function ensureDataFile(): PeriodoInventario[] {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultPeriod: PeriodoInventario = {
      id: 'per-2026-08',
      codigo: '2026-08',
      nombre: 'Agosto 2026',
      fecha_inicio: '2026-08-01',
      fecha_fin: '2026-08-31',
      estado: 'ABIERTO',
      inicial_registrado: false,
      inventario_inicial: {},
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify([defaultPeriod], null, 2), 'utf8');
    return [defaultPeriod];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveDataFile(periods: PeriodoInventario[]) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(periods, null, 2), 'utf8');
}

export function getAllPeriodos(): PeriodoInventario[] {
  return ensureDataFile().sort((a, b) => b.codigo.localeCompare(a.codigo));
}

export function getActivePeriodo(): PeriodoInventario {
  const all = ensureDataFile();
  const active = all.find((p) => p.estado === 'ABIERTO' || p.estado === 'EN_CONCILIACION');
  if (active) return active;
  return all[0];
}

export function getPeriodoById(id: string): PeriodoInventario | undefined {
  return ensureDataFile().find((p) => p.id === id || p.codigo === id);
}

// Recalibra el stock_actual acumulando desde el inventario inicial del periodo activo + todos los movimientos aprobados
export async function recalibrateStockActual() {
  const activePeriodo = getActivePeriodo();
  if (!activePeriodo) return;
  const initialMap = activePeriodo?.inventario_inicial || {};

  // 1. Obtener catálogo
  const { data: catalogo } = await supabase
    .from('catalogo_insumos')
    .select('*')
    .order('nombre');

  if (!catalogo) return;

  // 2. Obtener movimientos aprobados del periodo activo
  let allMovs: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    let query = supabase
      .from('movimientos_inventario')
      .select('*')
      .order('fecha', { ascending: true })
      .order('fecha_hora', { ascending: true })
      .range(from, from + step - 1);

    if (activePeriodo.fecha_inicio) {
      query = query.gte('fecha', activePeriodo.fecha_inicio);
    }
    if (activePeriodo.fecha_fin) {
      query = query.lte('fecha', activePeriodo.fecha_fin);
    }

    const { data: movs, error: movErr } = await query;

    if (movErr || !movs || movs.length === 0) break;
    allMovs = allMovs.concat(movs);
    if (movs.length < step) break;
    from += step;
  }

  // Filtrar movimientos aprobados (excluyendo pendientes e inventario inicial)
  const approvedMovs = allMovs.filter((m) => {
    const isPending = m.observaciones && m.observaciones.includes('[PENDIENTE_APROBAR]');
    if (isPending) return false;
    if (m.tipo_movimiento === 'INVENTARIO_INICIAL') return false;
    return true;
  });

  const stockMap: Record<string, {
    insumo_id: string;
    peso_std: number;
    bSinPorc: number;
    bPorcUnd: number;
    bPorcKg: number;
    cSinPorc: number;
    cPorcUnd: number;
    cPorcKg: number;
  }> = {};

  catalogo.forEach((c) => {
    const init = initialMap[c.id] || {};
    const pesoStd = Number(c.peso_estandar_porcion_kg) || 0.35;
    const bSin = Number(init.bodega_sin_porc_kg) || 0;
    const bUnd = Number(init.bodega_porc_und) || 0;
    const bKg = Number(init.bodega_porc_kg) || (bUnd * pesoStd);

    const cSin = Number(init.cocina_sin_porc_kg) || 0;
    const cUnd = Number(init.cocina_porc_und) || 0;
    const cKg = Number(init.cocina_porc_kg) || (cUnd * pesoStd);

    stockMap[c.id] = {
      insumo_id: c.id,
      peso_std: pesoStd,
      bSinPorc: bSin,
      bPorcUnd: bUnd,
      bPorcKg: bKg,
      cSinPorc: cSin,
      cPorcUnd: cUnd,
      cPorcKg: cKg,
    };
  });

  // Procesar movimientos aprobados en orden cronológico
  approvedMovs.forEach((m) => {
    const st = stockMap[m.insumo_id];
    if (!st) return;

    const cantKg = Number(m.cant_sin_porcionar_kg) || 0;
    const porcUnd = Number(m.porciones_und) || 0;
    const porcKg = Number(m.peso_porciones_kg) || (porcUnd * st.peso_std);
    const tipo = (m.tipo_movimiento || '').toUpperCase();
    const origen = (m.origen || '').toUpperCase();
    const destino = (m.destino || '').toUpperCase();

    if (tipo === 'ENTRADA_COMPRA' || tipo === 'COMPRA' || tipo === 'ENTRADA') {
      if (destino.includes('PORCIONADO') || porcUnd > 0) {
        st.bPorcUnd += porcUnd;
        st.bPorcKg += (porcKg || (porcUnd * st.peso_std));
      } else {
        st.bSinPorc += cantKg;
      }
    } else if (tipo === 'PORCIONADO') {
      st.bSinPorc = Math.max(0, st.bSinPorc - cantKg);
      st.bPorcUnd += porcUnd;
      st.bPorcKg += (porcKg || (porcUnd * st.peso_std));
    } else if (tipo === 'TRASLADO_COCINA' || tipo === 'TRASLADO_A_COCINA' || tipo === 'TRASLADO') {
      if (porcUnd > 0) {
        const u = porcUnd;
        const k = porcKg || (u * st.peso_std);
        st.bPorcUnd = Math.max(0, st.bPorcUnd - u);
        st.bPorcKg = Math.max(0, st.bPorcKg - k);
        st.cPorcUnd += u;
        st.cPorcKg += k;
      } else if (cantKg > 0) {
        st.bSinPorc = Math.max(0, st.bSinPorc - cantKg);
        st.cSinPorc += cantKg;
      }
    } else if (tipo === 'DEVOLUCION_COCINA' || tipo === 'DEVOLUCION_A_BODEGA') {
      if (porcUnd > 0) {
        const u = porcUnd;
        const k = porcKg || (u * st.peso_std);
        st.cPorcUnd = Math.max(0, st.cPorcUnd - u);
        st.cPorcKg = Math.max(0, st.cPorcKg - k);
        st.bPorcUnd += u;
        st.bPorcKg += k;
      } else if (cantKg > 0) {
        st.cSinPorc = Math.max(0, st.cSinPorc - cantKg);
        st.bSinPorc += cantKg;
      }
    } else if (tipo.includes('AJUSTE')) {
      if (destino.includes('BODEGA_ENTERO') || origen === 'AJUSTE_ENTRADA') {
        if (cantKg > 0) st.bSinPorc += cantKg;
      }
      if (destino.includes('BODEGA_PORCIONADO')) {
        if (porcUnd > 0) {
          st.bPorcUnd += porcUnd;
          st.bPorcKg += (porcKg || (porcUnd * st.peso_std));
        } else if (cantKg > 0) {
          st.bPorcKg += cantKg;
        }
      }
      if (destino.includes('COCINA_PORCIONADO')) {
        if (porcUnd > 0) {
          st.cPorcUnd += porcUnd;
          st.cPorcKg += (porcKg || (porcUnd * st.peso_std));
        }
      }
      if (destino.includes('COCINA_ENTERO')) {
        if (cantKg > 0) st.cSinPorc += cantKg;
      }
      if (destino.includes('MERMA') || destino.includes('SALIDA') || origen.includes('MERMA')) {
        if (origen.includes('BODEGA_ENTERO') && cantKg > 0) st.bSinPorc -= cantKg;
        if (origen.includes('BODEGA_PORCIONADO')) {
          if (porcUnd > 0) {
            st.bPorcUnd -= porcUnd;
            st.bPorcKg += (porcKg || (porcUnd * st.peso_std));
          }
        }
        if (origen.includes('COCINA')) {
          if (porcUnd > 0) {
            st.cPorcUnd -= porcUnd;
            st.cPorcKg += (porcKg || (porcUnd * st.peso_std));
          }
        }
      }
    }
  });

  const nowIso = new Date().toISOString();
  const upsertRows = Object.values(stockMap).map((st) => {
    const bKg = Number(st.bSinPorc.toFixed(2));
    const bPorcUnd = Math.round(st.bPorcUnd);
    const bPorcKg = Number(st.bPorcKg.toFixed(2));

    const cKg = Number(st.cSinPorc.toFixed(2));
    const cPorcUnd = Math.round(st.cPorcUnd);
    const cPorcKg = Number(st.cPorcKg.toFixed(2));

    return {
      insumo_id: st.insumo_id,
      bodega_sin_porcionar_kg: bKg,
      bodega_porcionado_und: bPorcUnd,
      bodega_porcionado_kg: bPorcKg,
      cocina_sin_porcionar_kg: cKg,
      cocina_porcionado_und: cPorcUnd,
      cocina_porcionado_kg: cPorcKg,
      updated_at: nowIso,
    };
  });

  // Guardar en batches en Supabase
  for (let i = 0; i < upsertRows.length; i += 50) {
    const batch = upsertRows.slice(i, i + 50);
    await supabase.from('stock_actual').upsert(batch, { onConflict: 'insumo_id' });
  }
}

// Calcula el stock teórico exacto de un periodo específico a partir de su inventario inicial y sus movimientos
export async function calculatePeriodoStock(periodoId: string, fechaCorte?: string) {
  const p = getPeriodoById(periodoId) || getActivePeriodo();
  const initialMap = p?.inventario_inicial || {};

  const { data: catalogo } = await supabase
    .from('catalogo_insumos')
    .select('*')
    .order('nombre');

  if (!catalogo) return { stockMap: {}, period: p };

  const stockMap: Record<string, {
    insumo_id: string;
    bodega_sin_porcionar_kg: number;
    bodega_porcionado_und: number;
    bodega_porcionado_kg: number;
    cocina_sin_porcionar_kg: number;
    cocina_porcionado_und: number;
    cocina_porcionado_kg: number;
    peso_std: number;
    traslado_cocina_acumulado_und: number;
    traslado_cocina_acumulado_kg: number;
    merma_acumulada_kg: number;
    merma_acumulada_pesos: number;
  }> = {};

  catalogo.forEach((c) => {
    const init = initialMap[c.id] || {};
    const pesoStd = Number(c.peso_estandar_porcion_kg) || 0.35;
    const bSin = Number(init.bodega_sin_porc_kg) || 0;
    const bUnd = Number(init.bodega_porc_und) || 0;
    const bKg = Number(init.bodega_porc_kg) || (bUnd * pesoStd);

    const cSin = Number(init.cocina_sin_porc_kg) || 0;
    const cUnd = Number(init.cocina_porc_und) || 0;
    const cKg = Number(init.cocina_porc_kg) || (cUnd * pesoStd);

    stockMap[c.id] = {
      insumo_id: c.id,
      peso_std: pesoStd,
      bodega_sin_porcionar_kg: bSin,
      bodega_porcionado_und: bUnd,
      bodega_porcionado_kg: bKg,
      cocina_sin_porcionar_kg: cSin,
      cocina_porcionado_und: cUnd,
      cocina_porcionado_kg: cKg,
      traslado_cocina_acumulado_und: 0,
      traslado_cocina_acumulado_kg: 0,
      merma_acumulada_kg: 0,
      merma_acumulada_pesos: 0,
    };
  });

  // Si se solicita expresamente el INVENTARIO_INICIAL, retornamos inmediatamente el stock base
  if (fechaCorte === 'INICIAL') {
    return {
      stockMap,
      period: p,
      catalogo,
      totalMovs: 0,
    };
  }

  // Movimientos de este periodo (filtrados por fecha_inicio y fecha_fin / fechaCorte)
  let allMovs: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    let query = supabase
      .from('movimientos_inventario')
      .select('*')
      .order('fecha', { ascending: true })
      .order('fecha_hora', { ascending: true })
      .range(from, from + step - 1);

    if (p?.fecha_inicio) query = query.gte('fecha', p.fecha_inicio);
    if (fechaCorte && fechaCorte !== 'ACTUAL' && fechaCorte !== 'TODOS' && fechaCorte !== 'INICIAL') {
      query = query.lte('fecha', fechaCorte);
    } else if (p?.fecha_fin) {
      query = query.lte('fecha', p.fecha_fin);
    }

    const { data: movs, error: movErr } = await query;
    if (movErr || !movs || movs.length === 0) break;
    allMovs = allMovs.concat(movs);
    if (movs.length < step) break;
    from += step;
  }

  const approvedMovs = allMovs.filter((m) => {
    const isPending = m.observaciones && m.observaciones.includes('[PENDIENTE_APROBAR]');
    if (isPending) return false;
    if (m.tipo_movimiento === 'INVENTARIO_INICIAL') return false;
    return true;
  });

  approvedMovs.forEach((m) => {
    const st = stockMap[m.insumo_id];
    if (!st) return;

    const cantKg = Number(m.cant_sin_porcionar_kg) || 0;
    const porcUnd = Number(m.porciones_und) || 0;
    const porcKg = Number(m.peso_porciones_kg) || (porcUnd * st.peso_std);
    const tipo = (m.tipo_movimiento || '').toUpperCase();
    const origen = (m.origen || '').toUpperCase();
    const destino = (m.destino || '').toUpperCase();

    if (tipo === 'ENTRADA_COMPRA' || tipo === 'COMPRA' || tipo === 'ENTRADA') {
      if (destino.includes('PORCIONADO') || porcUnd > 0) {
        st.bodega_porcionado_und += porcUnd;
        st.bodega_porcionado_kg += (porcKg || (porcUnd * st.peso_std));
      } else {
        st.bodega_sin_porcionar_kg += cantKg;
      }
    } else if (tipo === 'PORCIONADO') {
      st.bodega_sin_porcionar_kg = Math.max(0, st.bodega_sin_porcionar_kg - cantKg);
      st.bodega_porcionado_und += porcUnd;
      st.bodega_porcionado_kg += (porcKg || (porcUnd * st.peso_std));
      st.merma_acumulada_kg += Number(m.merma_kg) || 0;
      st.merma_acumulada_pesos += Number(m.merma_pesos) || 0;
    } else if (tipo === 'TRASLADO_COCINA' || tipo === 'TRASLADO_A_COCINA' || tipo === 'TRASLADO') {
      if (porcUnd > 0) {
        const u = porcUnd;
        const k = porcKg || (u * st.peso_std);
        st.bodega_porcionado_und = Math.max(0, st.bodega_porcionado_und - u);
        st.bodega_porcionado_kg = Math.max(0, st.bodega_porcionado_kg - k);
        st.cocina_porcionado_und += u;
        st.cocina_porcionado_kg += k;
        st.traslado_cocina_acumulado_und += u;
        st.traslado_cocina_acumulado_kg += k;
      } else if (cantKg > 0) {
        st.bodega_sin_porcionar_kg = Math.max(0, st.bodega_sin_porcionar_kg - cantKg);
        st.cocina_sin_porcionar_kg += cantKg;
        st.traslado_cocina_acumulado_kg += cantKg;
      }
    } else if (tipo === 'DEVOLUCION_COCINA' || tipo === 'DEVOLUCION_A_BODEGA') {
      if (porcUnd > 0) {
        const u = porcUnd;
        const k = porcKg || (u * st.peso_std);
        st.cocina_porcionado_und = Math.max(0, st.cocina_porcionado_und - u);
        st.cocina_porcionado_kg = Math.max(0, st.cocina_porcionado_kg - k);
        st.bodega_porcionado_und += u;
        st.bodega_porcionado_kg += k;
      } else if (cantKg > 0) {
        st.cocina_sin_porcionar_kg = Math.max(0, st.cocina_sin_porcionar_kg - cantKg);
        st.bodega_sin_porcionar_kg += cantKg;
      }
    } else if (tipo.includes('AJUSTE')) {
      if (destino.includes('BODEGA_ENTERO') || origen === 'AJUSTE_ENTRADA') {
        if (cantKg > 0) st.bodega_sin_porcionar_kg += cantKg;
      }
      if (destino.includes('BODEGA_PORCIONADO')) {
        if (porcUnd > 0) {
          st.bodega_porcionado_und += porcUnd;
          st.bodega_porcionado_kg += (porcKg || (porcUnd * st.peso_std));
        } else if (cantKg > 0) {
          st.bodega_porcionado_kg += cantKg;
        }
      }
      if (destino.includes('COCINA_PORCIONADO')) {
        if (porcUnd > 0) {
          st.cocina_porcionado_und += porcUnd;
          st.cocina_porcionado_kg += (porcKg || (porcUnd * st.peso_std));
        }
      }
      if (destino.includes('COCINA_ENTERO')) {
        if (cantKg > 0) st.cocina_sin_porcionar_kg += cantKg;
      }
      if (destino.includes('MERMA') || destino.includes('SALIDA') || origen.includes('MERMA')) {
        if (origen.includes('BODEGA_ENTERO') && cantKg > 0) st.bodega_sin_porcionar_kg -= cantKg;
        if (origen.includes('BODEGA_PORCIONADO')) {
          if (porcUnd > 0) {
            st.bodega_porcionado_und -= porcUnd;
            st.bodega_porcionado_kg += (porcKg || (porcUnd * st.peso_std));
          }
        }
        if (origen.includes('COCINA')) {
          if (porcUnd > 0) {
            st.cocina_porcionado_und -= porcUnd;
            st.cocina_porcionado_kg += (porcKg || (porcUnd * st.peso_std));
          }
        }
      }
    }
  });

  return {
    stockMap,
    period: p,
    catalogo,
    totalMovs: approvedMovs.length
  };
}

// 1. Guardar Inventario Inicial
export async function saveInitialInventory(
  periodoId: string,
  items: Record<string, InsumoSnapshot>,
  usuario: string = 'Administrador'
) {
  const periods = ensureDataFile();
  const index = periods.findIndex((p) => p.id === periodoId || p.codigo === periodoId);
  if (index === -1) throw new Error('Periodo no encontrado');

  const p = periods[index];
  p.inventario_inicial = items;
  p.inicial_registrado = true;
  saveDataFile(periods);

  // Registrar movimientos de inicialización
  const fecha = p.fecha_inicio;
  for (const insumoId of Object.keys(items)) {
    const item = items[insumoId];

    // Registrar movimiento de apertura si tiene cantidades > 0
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
        usuario: usuario,
        observaciones: `Inventario inicial registrado para periodo ${p.nombre}`
      }]);
    }
  }

  return p;
}

// 2. Cerrar Periodo y Aperturar Siguiente
export async function closeAndAdvancePeriod(
  periodoId: string,
  conteoFisico: Record<string, { bodega_kg: number; bodega_und: number; bodega_porc_kg?: number; cocina_und: number; cocina_porc_kg?: number }>,
  usuario: string = 'Administrador',
  observaciones: string = ''
) {
  const periods = ensureDataFile();
  const index = periods.findIndex((p) => p.id === periodoId || p.codigo === periodoId);
  if (index === -1) throw new Error('Periodo no encontrado');

  const current = periods[index];
  current.estado = 'CERRADO';
  current.conteo_cierre_fisico = conteoFisico;
  current.fecha_cierre = new Date().toISOString();
  current.usuario_cierre = usuario;
  current.observaciones_cierre = observaciones;

  // Calcular el siguiente periodo (ej: "2026-08" -> "2026-09")
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

  // Construir inventario inicial del siguiente periodo a partir del conteo fisico del cierre
  const nextInitial: Record<string, InsumoSnapshot> = {};
  const { data: catalogo } = await supabase.from('catalogo_insumos').select('*');

  (catalogo || []).forEach((c) => {
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

  let nextPeriod = periods.find((p) => p.codigo === nextCodigo);
  if (!nextPeriod) {
    nextPeriod = {
      id: `per-${nextCodigo}`,
      codigo: nextCodigo,
      nombre: nextNombre,
      fecha_inicio: nextFechaInicio,
      fecha_fin: nextFechaFin,
      estado: 'ABIERTO',
      inicial_registrado: true,
      inventario_inicial: nextInitial,
    };
    periods.push(nextPeriod);
  } else {
    nextPeriod.estado = 'ABIERTO';
    nextPeriod.inicial_registrado = true;
    nextPeriod.inventario_inicial = nextInitial;
  }

  saveDataFile(periods);

  return { current, next: nextPeriod };
}

export const closePeriodAndOpenNext = closeAndAdvancePeriod;
