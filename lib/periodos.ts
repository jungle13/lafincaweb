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

  // Actualizar stock_actual en Supabase y registrar movimientos de inicialización
  const fecha = p.fecha_inicio;
  for (const insumoId of Object.keys(items)) {
    const item = items[insumoId];

    // Actualizar stock_actual
    await supabase.from('stock_actual').upsert({
      insumo_id: insumoId,
      bodega_sin_porcionar_kg: item.bodega_sin_porc_kg || 0,
      bodega_porcionado_und: item.bodega_porc_und || 0,
      bodega_porcionado_kg: item.bodega_porc_kg || 0,
      cocina_sin_porcionar_kg: item.cocina_sin_porc_kg || 0,
      cocina_porcionado_und: item.cocina_porc_und || 0,
      cocina_porcionado_kg: item.cocina_porc_kg || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'insumo_id' });

    // Registrar movimiento de apertura si tiene cantidades > 0
    if (item.bodega_sin_porc_kg > 0 || item.bodega_porc_und > 0 || item.cocina_porc_und > 0) {
      await supabase.from('movimientos_inventario').insert([{
        fecha: fecha,
        fecha_hora: `${fecha}T06:00:00.000Z`,
        tipo_movimiento: 'INVENTARIO_INICIAL',
        insumo_id: insumoId,
        origen: 'APERTURA_PERIODO',
        destino: 'BODEGA_Y_COCINA',
        cant_sin_porcionar_kg: item.bodega_sin_porc_kg || 0,
        porciones_und: item.bodega_porc_und || 0,
        peso_porciones_kg: item.bodega_porc_kg || 0,
        costo_unitario_kg: item.costo_unitario_kg || 0,
        valor_total_movimiento: (item.bodega_sin_porc_kg + item.bodega_porc_kg + item.cocina_porc_kg) * (item.costo_unitario_kg || 0),
        observaciones: `Inventario Inicial Apertura Periodo ${p.nombre}`,
        usuario: usuario,
        bodega_sin_porc_nuevo_kg: item.bodega_sin_porc_kg || 0,
        bodega_porc_und_nuevo: item.bodega_porc_und || 0,
        bodega_porc_kg_nuevo: item.bodega_porc_kg || 0,
        cocina_porc_und_nuevo: item.cocina_porc_und || 0,
        cocina_porc_kg_nuevo: item.cocina_porc_kg || 0,
      }]);
    }
  }

  return p;
}

// 2. Cerrar periodo actual y abrir el siguiente
export async function closePeriodAndOpenNext(
  periodoId: string,
  conteoFisico: Record<string, { bodega_kg: number; bodega_und: number; bodega_porc_kg?: number; cocina_und: number; cocina_porc_kg?: number }>,
  usuario: string = 'Administrador',
  observaciones: string = ''
) {
  const periods = ensureDataFile();
  const index = periods.findIndex((p) => p.id === periodoId || p.codigo === periodoId);
  if (index === -1) throw new Error('Periodo no encontrado');

  const curr = periods[index];
  curr.estado = 'CERRADO';
  curr.fecha_cierre = new Date().toISOString();
  curr.usuario_cierre = usuario;
  curr.observaciones_cierre = observaciones;
  curr.conteo_cierre_fisico = conteoFisico;

  // Calcular siguiente periodo mensual
  const [yearStr, monthStr] = curr.codigo.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(monthStr);

  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }

  const nextCode = `${year}-${String(month).padStart(2, '0')}`;
  const MONTH_NAMES = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const nextName = `${MONTH_NAMES[month]} ${year}`;

  const lastDayOfNextMonth = new Date(year, month, 0).getDate();
  const nextStart = `${nextCode}-01`;
  const nextEnd = `${nextCode}-${String(lastDayOfNextMonth).padStart(2, '0')}`;

  const { data: catInsumos } = await supabase.from('catalogo_insumos').select('*');
  const catMap = new Map((catInsumos || []).map((c) => [c.id, c]));

  const nextInitial: Record<string, InsumoSnapshot> = {};

  for (const insumoId of Object.keys(conteoFisico)) {
    const f = conteoFisico[insumoId];
    const cat = catMap.get(insumoId);
    const pesoStd = cat?.peso_estandar_porcion_kg || 0.35;
    const costo = cat?.costo_unitario_kg || 0;
    const bPorcKg = f.bodega_porc_kg !== undefined ? f.bodega_porc_kg : (f.bodega_und || 0) * pesoStd;
    const cPorcKg = f.cocina_porc_kg !== undefined ? f.cocina_porc_kg : (f.cocina_und || 0) * pesoStd;

    nextInitial[insumoId] = {
      insumo_id: insumoId,
      nombre: cat?.nombre || 'Insumo',
      categoria: cat?.categoria || 'CARNE',
      bodega_sin_porc_kg: f.bodega_kg || 0,
      bodega_porc_und: f.bodega_und || 0,
      bodega_porc_kg: bPorcKg,
      cocina_sin_porc_kg: 0,
      cocina_porc_und: f.cocina_und || 0,
      cocina_porc_kg: cPorcKg,
      costo_unitario_kg: costo,
    };
  }

  const nextPeriod: PeriodoInventario = {
    id: `per-${nextCode}`,
    codigo: nextCode,
    nombre: nextName,
    fecha_inicio: nextStart,
    fecha_fin: nextEnd,
    estado: 'ABIERTO',
    inicial_registrado: true,
    inventario_inicial: nextInitial,
  };

  periods.push(nextPeriod);
  saveDataFile(periods);

  // 1. Obtener stock actual antes del ajuste para calcular diferencias y registrar auditoría
  const { data: stockPrev } = await supabase.from('stock_actual').select('*');
  const stockMap = new Map((stockPrev || []).map((s) => [s.insumo_id, s]));

  for (const insumoId of Object.keys(nextInitial)) {
    const item = nextInitial[insumoId];
    const prev = stockMap.get(insumoId);

    const bSinAnt = prev?.bodega_sin_porcionar_kg || 0;
    const bPorcUndAnt = prev?.bodega_porcionado_und || 0;
    const cPorcUndAnt = prev?.cocina_porcionado_und || 0;

    const bSinNue = item.bodega_sin_porc_kg;
    const bPorcUndNue = item.bodega_porc_und;
    const cPorcUndNue = item.cocina_porc_und;

    const difEnteroKg = bSinNue - bSinAnt;
    const difPorcUnd = (bPorcUndNue + cPorcUndNue) - (bPorcUndAnt + cPorcUndAnt);

    // Si hubo diferencia física vs teórica, registrar movimiento auditado
    if (difEnteroKg !== 0 || difPorcUnd !== 0) {
      const cat = catMap.get(insumoId);
      const pesoStd = cat?.peso_estandar_porcion_kg || 0.35;
      const costo = cat?.costo_unitario_kg || 0;
      const difTotalKg = difEnteroKg + (difPorcUnd * pesoStd);
      const valorImpacto = Math.abs(difTotalKg) * costo;

      await supabase.from('movimientos_inventario').insert([{
        fecha: curr.fecha_fin,
        fecha_hora: new Date().toISOString(),
        tipo_movimiento: 'AJUSTE_INVENTARIO',
        insumo_id: insumoId,
        origen: difTotalKg >= 0 ? 'CONCILIACION_SOBRANTE' : 'AUDITORIA_BODEGA',
        destino: difTotalKg >= 0 ? 'BODEGA_PORCIONADO' : 'CONCILIACION_MERMA',
        cant_sin_porcionar_kg: Math.abs(difEnteroKg),
        porciones_und: Math.abs(difPorcUnd),
        peso_porciones_kg: Math.abs(difPorcUnd * pesoStd),
        merma_kg: difTotalKg < 0 ? Math.abs(difTotalKg) : 0,
        costo_unitario_kg: costo,
        valor_total_movimiento: valorImpacto,
        observaciones: `[CONCILIACIÓN CIERRE ${curr.nombre}] Ajuste físico: ${difPorcUnd >= 0 ? '+' : ''}${difPorcUnd} und (${difTotalKg.toFixed(2)} Kg). ${observaciones ? 'Nota: ' + observaciones : ''}`,
        usuario: usuario,
        bodega_sin_porc_anterior_kg: bSinAnt,
        bodega_sin_porc_nuevo_kg: bSinNue,
        bodega_porc_und_anterior: bPorcUndAnt,
        bodega_porc_und_nuevo: bPorcUndNue,
        bodega_porc_kg_anterior: prev?.bodega_porcionado_kg || 0,
        bodega_porc_kg_nuevo: item.bodega_porc_kg,
        cocina_porc_und_anterior: cPorcUndAnt,
        cocina_porc_und_nuevo: cPorcUndNue,
        cocina_porc_kg_anterior: prev?.cocina_porcionado_kg || 0,
        cocina_porc_kg_nuevo: item.cocina_porc_kg,
      }]);
    }

    // Actualizar stock_actual para el nuevo periodo
    await supabase.from('stock_actual').upsert({
      insumo_id: insumoId,
      bodega_sin_porcionar_kg: item.bodega_sin_porc_kg,
      bodega_porcionado_und: item.bodega_porc_und,
      bodega_porcionado_kg: item.bodega_porc_kg,
      cocina_sin_porcionar_kg: 0,
      cocina_porcionado_und: item.cocina_porc_und,
      cocina_porcionado_kg: item.cocina_porc_kg,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'insumo_id' });
  }

  return { closed: curr, next: nextPeriod };
}
