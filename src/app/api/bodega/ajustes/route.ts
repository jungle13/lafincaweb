import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      insumo_id,
      tipo_ajuste = 'MERMA_POR_DESCONGELACION',
      ubicacion = 'BODEGA_PORCIONADO', // 'BODEGA_ENTERO' | 'BODEGA_PORCIONADO' | 'COCINA_PORCIONADO'
      cantidad = 0, // Positivo para ingreso, negativo para merma/salida
      peso_kg = 0,
      justificacion,
      usuario = 'Administrador',
      fecha = new Date().toISOString().split('T')[0]
    } = body;

    if (!insumo_id || !justificacion || !justificacion.trim()) {
      return NextResponse.json({ error: 'Insumo y Justificación detallada son obligatorios' }, { status: 400 });
    }

    // 1. Obtener stock actual del insumo
    const { data: stockRow, error: stockErr } = await supabase
      .from('stock_actual')
      .select('*')
      .eq('insumo_id', insumo_id)
      .maybeSingle();

    if (stockErr || !stockRow) {
      return NextResponse.json({ error: 'No se encontró registro de stock para este insumo' }, { status: 404 });
    }

    // 2. Obtener insumo para costo unitario
    const { data: insumo } = await supabase
      .from('catalogo_insumos')
      .select('*')
      .eq('id', insumo_id)
      .single();

    const costoKg = insumo?.costo_unitario_kg || 0;
    const pesoStd = insumo?.peso_estandar_porcion_kg || 0.35;

    // 3. Calcular saldos anteriores y nuevos
    const bSinAnt = stockRow.bodega_sin_porcionar_kg || 0;
    const bPorcUndAnt = stockRow.bodega_porcionado_und || 0;
    const bPorcKgAnt = stockRow.bodega_porcionado_kg || 0;
    const cPorcUndAnt = stockRow.cocina_porcionado_und || 0;
    const cPorcKgAnt = stockRow.cocina_porcionado_kg || 0;

    let bSinNue = bSinAnt;
    let bPorcUndNue = bPorcUndAnt;
    let bPorcKgNue = bPorcKgAnt;
    let cPorcUndNue = cPorcUndAnt;
    let cPorcKgNue = cPorcKgAnt;

    const cantNum = parseFloat(cantidad) || 0;
    const pesoNum = parseFloat(peso_kg) || (Math.abs(cantNum) * pesoStd);

    if (ubicacion === 'BODEGA_ENTERO') {
      bSinNue = Math.max(0, bSinAnt + cantNum);
    } else if (ubicacion === 'BODEGA_PORCIONADO') {
      bPorcUndNue = Math.max(0, bPorcUndAnt + Math.round(cantNum));
      bPorcKgNue = Math.max(0, bPorcKgAnt + (cantNum * pesoStd));
    } else if (ubicacion === 'COCINA_PORCIONADO') {
      cPorcUndNue = Math.max(0, cPorcUndAnt + Math.round(cantNum));
      cPorcKgNue = Math.max(0, cPorcKgAnt + (cantNum * pesoStd));
    }

    // 4. Actualizar stock_actual
    const { error: updErr } = await supabase.from('stock_actual').update({
      bodega_sin_porcionar_kg: bSinNue,
      bodega_porcionado_und: bPorcUndNue,
      bodega_porcionado_kg: bPorcKgNue,
      cocina_porcionado_und: cPorcUndNue,
      cocina_porcionado_kg: cPorcKgNue,
      updated_at: new Date().toISOString(),
    }).eq('insumo_id', insumo_id);

    if (updErr) throw updErr;

    // 5. Insertar movimiento de AJUSTE_AUDITORIA
    const obsCompleta = `[AJUSTE: ${tipo_ajuste}] Ubicación: ${ubicacion} | Motivo: ${justificacion.trim()}`;
    const valorImpacto = pesoNum * costoKg;

    const { data: movInserted, error: movErr } = await supabase.from('movimientos_inventario').insert([{
      fecha: fecha,
      fecha_hora: new Date().toISOString(),
      tipo_movimiento: 'AJUSTE_INVENTARIO',
      insumo_id: insumo_id,
      origen: cantNum >= 0 ? 'AJUSTE_ENTRADA' : ubicacion,
      destino: cantNum >= 0 ? ubicacion : 'AJUSTE_MERMA',
      cant_sin_porcionar_kg: ubicacion === 'BODEGA_ENTERO' ? Math.abs(cantNum) : 0,
      porciones_und: ubicacion !== 'BODEGA_ENTERO' ? Math.abs(cantNum) : 0,
      peso_porciones_kg: ubicacion !== 'BODEGA_ENTERO' ? pesoNum : 0,
      merma_kg: cantNum < 0 ? pesoNum : 0,
      costo_unitario_kg: costoKg,
      valor_total_movimiento: valorImpacto,
      observaciones: obsCompleta,
      usuario: usuario,
      bodega_sin_porc_anterior_kg: bSinAnt,
      bodega_sin_porc_nuevo_kg: bSinNue,
      bodega_porc_und_anterior: bPorcUndAnt,
      bodega_porc_und_nuevo: bPorcUndNue,
      bodega_porc_kg_anterior: bPorcKgAnt,
      bodega_porc_kg_nuevo: bPorcKgNue,
      cocina_porc_und_anterior: cPorcUndAnt,
      cocina_porc_und_nuevo: cPorcUndNue,
      cocina_porc_kg_anterior: cPorcKgAnt,
      cocina_porc_kg_nuevo: cPorcKgNue,
    }]).select().single();

    if (movErr) throw movErr;

    return NextResponse.json({ success: true, movimiento: movInserted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
