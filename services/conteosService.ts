/**
 * Servicio Centralizado de Conteos Físicos y Auditorías de Inventario
 */

import { supabase } from '@/lib/supabase';
import { isUnidadOnly } from './stockService';

export interface ConteoFisicoItem {
  id: string;
  fecha: string;
  usuario: string;
  estado: 'PENDIENTE' | 'APLICADO';
  created_at: string;
  updated_at: string;
}

export interface ConteoDetalleItem {
  id: string;
  conteo_id: string;
  insumo_id: string;
  ubicacion: 'BODEGA' | 'COCINA';
  cant_sin_porcionar_kg: number;
  porciones_und: number;
  peso_porciones_kg: number;
  costo_unitario_kg: number;
  valor_total: number;
  created_at: string;
  catalogo_insumos?: {
    nombre: string;
    unidad_medida: string;
    categoria: string;
  };
}

/**
 * Obtiene el listado de todas las sesiones de conteo
 */
export async function getConteosList(): Promise<ConteoFisicoItem[]> {
  const { data, error } = await supabase
    .from('conteos_fisicos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ConteoFisicoItem[];
}

/**
 * Crea una nueva sesión de conteo en estado PENDIENTE
 */
export async function createConteoSession(fecha: string, usuario: string = 'Bodeguero'): Promise<ConteoFisicoItem> {
  const { data, error } = await supabase
    .from('conteos_fisicos')
    .insert([{ fecha, usuario, estado: 'PENDIENTE' }])
    .select()
    .single();

  if (error) throw error;
  return data as ConteoFisicoItem;
}

/**
 * Obtiene los detalles y cabecera de un conteo específico
 */
export async function getConteoDetails(conteoId: string) {
  const { data: conteo, error: errConteo } = await supabase
    .from('conteos_fisicos')
    .select('*')
    .eq('id', conteoId)
    .single();

  if (errConteo) throw errConteo;

  const { data: detalles, error: errDetalles } = await supabase
    .from('conteos_fisicos_detalle')
    .select(`
      *,
      catalogo_insumos ( nombre, unidad_medida, categoria )
    `)
    .eq('conteo_id', conteoId)
    .order('created_at', { ascending: false });

  if (errDetalles) throw errDetalles;

  return { conteo: conteo as ConteoFisicoItem, detalles: detalles as ConteoDetalleItem[] };
}

/**
 * Agrega o actualiza un ítem en la sesión de conteo
 */
export async function addConteoItem(conteoId: string, item: {
  insumo_id: string;
  ubicacion: 'BODEGA' | 'COCINA';
  cant_sin_porcionar_kg: number;
  porciones_und: number;
  peso_porciones_kg: number;
  costo_unitario_kg: number;
  valor_total: number;
}) {
  const { data: conteo } = await supabase
    .from('conteos_fisicos')
    .select('estado')
    .eq('id', conteoId)
    .single();

  if (conteo?.estado === 'APLICADO') {
    throw new Error('No se pueden agregar ítems a un conteo ya aplicado.');
  }

  const { error } = await supabase
    .from('conteos_fisicos_detalle')
    .insert([{
      conteo_id: conteoId,
      insumo_id: item.insumo_id,
      ubicacion: item.ubicacion,
      cant_sin_porcionar_kg: item.cant_sin_porcionar_kg || 0,
      porciones_und: item.porciones_und || 0,
      peso_porciones_kg: item.peso_porciones_kg || 0,
      costo_unitario_kg: item.costo_unitario_kg || 0,
      valor_total: item.valor_total || 0
    }]);

  if (error) throw error;
  return { success: true };
}

/**
 * Elimina un ítem de la sesión de conteo
 */
export async function removeConteoItem(conteoId: string, detalleId: string) {
  const { error } = await supabase
    .from('conteos_fisicos_detalle')
    .delete()
    .eq('id', detalleId)
    .eq('conteo_id', conteoId);

  if (error) throw error;
  return { success: true };
}

/**
 * Aplica formalmente el conteo físico a la base de datos:
 * 1. Calcula discrepancias vs stock_actual
 * 2. Genera movimientos AJUSTE_INVENTARIO
 * 3. Actualiza stock_actual
 * 4. Pasa estado a APLICADO
 */
export async function aplicarConteoFisico(conteoId: string) {
  const { conteo, detalles } = await getConteoDetails(conteoId);

  if (conteo.estado === 'APLICADO') {
    throw new Error('El conteo ya fue aplicado con anterioridad.');
  }

  if (!detalles || detalles.length === 0) {
    throw new Error('El conteo no tiene ítems registrados para aplicar.');
  }

  for (const det of detalles) {
    const { data: stock, error: errStock } = await supabase
      .from('stock_actual')
      .select('*')
      .eq('insumo_id', det.insumo_id)
      .single();

    if (errStock || !stock) continue;

    const esBodega = det.ubicacion === 'BODEGA';
    const cantSinPorcContada = parseFloat(String(det.cant_sin_porcionar_kg || 0));
    const porcUndContada = parseInt(String(det.porciones_und || 0));
    const porcKgContada = parseFloat(String(det.peso_porciones_kg || 0));

    const cantSinPorcActual = esBodega ? (stock.bodega_sin_porcionar_kg || 0) : (stock.cocina_sin_porcionar_kg || 0);
    const porcUndActual = esBodega ? (stock.bodega_porcionado_und || 0) : (stock.cocina_porcionado_und || 0);
    const porcKgActual = esBodega ? (stock.bodega_porcionado_kg || 0) : (stock.cocina_porcionado_kg || 0);

    const diffSinPorc = cantSinPorcContada - cantSinPorcActual;
    const diffUnd = porcUndContada - porcUndActual;
    const diffKg = porcKgContada - porcKgActual;

    if (diffSinPorc === 0 && diffUnd === 0 && diffKg === 0) {
      continue;
    }

    // Insertar movimiento de ajuste formal
    const mov = {
      fecha: conteo.fecha || new Date().toISOString().split('T')[0],
      fecha_hora: new Date().toISOString(),
      tipo_movimiento: 'AJUSTE_INVENTARIO',
      insumo_id: det.insumo_id,
      origen: 'AUDITORIA_FISICA',
      destino: det.ubicacion,
      cant_sin_porcionar_kg: diffSinPorc,
      porciones_und: diffUnd,
      peso_porciones_kg: diffKg,
      costo_unitario_kg: det.costo_unitario_kg,
      valor_total_movimiento: Math.round((diffSinPorc + diffKg) * (det.costo_unitario_kg || 0)),
      observaciones: `Ajuste por Conteo Físico #${conteoId.substring(0, 8)}`,
      usuario: conteo.usuario,
      bodega_sin_porc_nuevo_kg: esBodega ? cantSinPorcContada : stock.bodega_sin_porcionar_kg,
      bodega_porc_und_nuevo: esBodega ? porcUndContada : stock.bodega_porcionado_und,
      bodega_porc_kg_nuevo: esBodega ? porcKgContada : stock.bodega_porcionado_kg,
      cocina_sin_porc_nuevo_kg: !esBodega ? cantSinPorcContada : stock.cocina_sin_porcionar_kg,
      cocina_porc_und_nuevo: !esBodega ? porcUndContada : stock.cocina_porcionado_und,
      cocina_porc_kg_nuevo: !esBodega ? porcKgContada : stock.cocina_porcionado_kg,
    };

    const { error: errMov } = await supabase.from('movimientos_inventario').insert([mov]);
    if (errMov) throw errMov;

    // Actualizar stock_actual para fijar las existencias contadas
    const updateData: any = {};
    if (esBodega) {
      updateData.bodega_sin_porcionar_kg = cantSinPorcContada;
      updateData.bodega_porcionado_und = porcUndContada;
      updateData.bodega_porcionado_kg = porcKgContada;
    } else {
      updateData.cocina_sin_porcionar_kg = cantSinPorcContada;
      updateData.cocina_porcionado_und = porcUndContada;
      updateData.cocina_porcionado_kg = porcKgContada;
    }

    const { error: errUpd } = await supabase
      .from('stock_actual')
      .update(updateData)
      .eq('insumo_id', det.insumo_id);

    if (errUpd) throw errUpd;
  }

  // Marcar sesión como APLICADO
  const { error: errFinal } = await supabase
    .from('conteos_fisicos')
    .update({ estado: 'APLICADO', updated_at: new Date().toISOString() })
    .eq('id', conteoId);

  if (errFinal) throw errFinal;

  return { success: true };
}
