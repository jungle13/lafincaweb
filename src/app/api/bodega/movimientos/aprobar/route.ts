import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = 'APROBAR', movimientoId, fecha, usuario = 'Administrador', overrides = {} } = body;

    // ↺ ACCIÓN: REVERTIR_FECHA (Revertir todos los movimientos aprobados de un día a [PENDIENTE_APROBAR] y recalibrar stock)
    if (action === 'REVERTIR_FECHA') {
      if (!fecha) return NextResponse.json({ error: 'Falta parámetro fecha' }, { status: 400 });

      const { data: dayMovs, error: fetchErr } = await supabase
        .from('movimientos_inventario')
        .select('*')
        .eq('fecha', fecha)
        .not('observaciones', 'ilike', '%[PENDIENTE_APROBAR]%');

      if (fetchErr || !dayMovs || dayMovs.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: 'No hay movimientos aprobados en esta fecha para revertir.' });
      }

      for (const m of dayMovs) {
        const rawObs = m.observaciones || '';
        const cleanObs = rawObs.replace(/\[PENDIENTE_APROBAR\]/g, '').trim();
        await supabase
          .from('movimientos_inventario')
          .update({
            observaciones: `[PENDIENTE_APROBAR] ${cleanObs}`,
            usuario: 'Bodeguero (Pendiente)',
          })
          .eq('id', m.id);
      }

      // Recalibrar stock actual
      await recalibrateStockActual();

      return NextResponse.json({
        success: true,
        count: dayMovs.length,
        message: `✅ Se revirtieron ${dayMovs.length} movimientos del día ${fecha} a estado pendiente y el stock fue recalibrado.`
      });
    }

    // 🗑️ ACCIÓN: DESCARTAR_FECHA (Eliminar todos los movimientos pendientes de una fecha específica)
    if (action === 'DESCARTAR_FECHA') {
      if (!fecha) return NextResponse.json({ error: 'Falta parámetro fecha' }, { status: 400 });

      const { data: deleted, error: delErr } = await supabase
        .from('movimientos_inventario')
        .delete()
        .eq('fecha', fecha)
        .ilike('observaciones', '%[PENDIENTE_APROBAR]%')
        .select('id');

      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      return NextResponse.json({
        success: true,
        count: deleted?.length || 0,
        message: `✅ Se eliminaron ${deleted?.length || 0} movimientos pendientes del día ${fecha}.`
      });
    }

    // 🚀 ACCIÓN: APROBAR_FECHA (Aprobar en lote todos los movimientos de un día con validación estricta de stock)
    if (action === 'APROBAR_FECHA') {
      if (!fecha) return NextResponse.json({ error: 'Falta parámetro fecha' }, { status: 400 });

      // 1. Validar si existen fechas anteriores pendientes
      const { data: earlierPending } = await supabase
        .from('movimientos_inventario')
        .select('id, fecha, tipo_movimiento')
        .lt('fecha', fecha)
        .ilike('observaciones', '%[PENDIENTE_APROBAR]%')
        .order('fecha', { ascending: true })
        .limit(1);

      if (earlierPending && earlierPending.length > 0) {
        const earlierDate = earlierPending[0].fecha;
        return NextResponse.json({
          error: `⚠️ Restricción de orden cronológico: Existen movimientos pendientes del día ${earlierDate}. Debes aprobar o descartar primero los días anteriores.`
        }, { status: 400 });
      }

      // 2. Obtener todos los pendientes de esta fecha
      const { data: dayMovs, error: fetchErr } = await supabase
        .from('movimientos_inventario')
        .select('*, catalogo_insumos(nombre, categoria)')
        .eq('fecha', fecha)
        .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

      if (fetchErr || !dayMovs || dayMovs.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: 'No hay movimientos pendientes en esta fecha.' });
      }

      // Ordenar: 1: ENTRADA_COMPRA, 2: PORCIONADO, 3: DEVOLUCION_COCINA, 4: TRASLADO_COCINA
      const orderMap: Record<string, number> = {
        ENTRADA_COMPRA: 10,
        PORCIONADO: 20,
        DEVOLUCION_COCINA: 30,
        TRASLADO_COCINA: 40,
      };

      const sortedMovs = [...dayMovs].sort((a, b) => (orderMap[a.tipo_movimiento] || 50) - (orderMap[b.tipo_movimiento] || 50));

      // 3. Simular y validar que ningún insumo quede con stock insuficiente
      const insufficientItems: string[] = [];
      const tempStockMap = new Map<string, { bSinPorc: number; bPorcUnd: number; cPorcUnd: number; cSinPorc: number }>();

      const { data: allStock } = await supabase.from('stock_actual').select('*');
      allStock?.forEach(s => {
        tempStockMap.set(String(s.insumo_id), {
          bSinPorc: parseFloat(s.bodega_sin_porcionar_kg) || 0,
          bPorcUnd: parseInt(s.bodega_porcionado_und) || 0,
          cPorcUnd: parseInt(s.cocina_porcionado_und) || 0,
          cSinPorc: parseFloat(s.cocina_sin_porcionar_kg) || 0,
        });
      });

      for (const mov of sortedMovs) {
        const idKey = String(mov.insumo_id);
        if (!tempStockMap.has(idKey)) {
          tempStockMap.set(idKey, { bSinPorc: 0, bPorcUnd: 0, cPorcUnd: 0, cSinPorc: 0 });
        }
        const cur = tempStockMap.get(idKey)!;
        const cantKg = parseFloat(mov.cant_sin_porcionar_kg) || 0;
        const porcUnd = parseInt(mov.porciones_und) || 0;
        const name = mov.catalogo_insumos?.nombre || `Insumo #${mov.insumo_id}`;

        if (mov.tipo_movimiento === 'ENTRADA_COMPRA') {
          cur.bSinPorc += cantKg;
        } else if (mov.tipo_movimiento === 'PORCIONADO') {
          if (cur.bSinPorc < cantKg) {
            insufficientItems.push(`${name} (Faltan ${(cantKg - cur.bSinPorc).toFixed(2)} Kg en Bodega Entero para porcionar)`);
          } else {
            cur.bSinPorc -= cantKg;
            cur.bPorcUnd += porcUnd;
          }
        } else if (mov.tipo_movimiento === 'TRASLADO_COCINA') {
          if (porcUnd > 0) {
            if (cur.bPorcUnd < porcUnd) {
              insufficientItems.push(`${name} (Faltan ${porcUnd - cur.bPorcUnd} und en Bodega Porciones para traslado)`);
            } else {
              cur.bPorcUnd -= porcUnd;
              cur.cPorcUnd += porcUnd;
            }
          } else {
            if (cur.bSinPorc < cantKg) {
              insufficientItems.push(`${name} (Faltan ${(cantKg - cur.bSinPorc).toFixed(2)} Kg en Bodega Entero para traslado)`);
            } else {
              cur.bSinPorc -= cantKg;
              cur.cSinPorc += cantKg;
            }
          }
        } else if (mov.tipo_movimiento === 'DEVOLUCION_COCINA') {
          if (porcUnd > 0) {
            cur.cPorcUnd -= porcUnd;
            cur.bPorcUnd += porcUnd;
          } else {
            cur.cSinPorc -= cantKg;
            cur.bSinPorc += cantKg;
          }
        }
      }

      if (insufficientItems.length > 0) {
        return NextResponse.json({
          error: `⚠️ No se puede aprobar todo el día ${fecha} porque hay stock insuficiente en:\n• ${insufficientItems.join('\n• ')}\n\nPor favor, usa el botón "🛠️ Ajustar" en cada tarjeta con stock insuficiente para corregir el inventario previo antes de aprobar el día.`
        }, { status: 400 });
      }

      // 4. Si todo el stock es suficiente, aprobar en lote
      for (const mov of sortedMovs) {
        await approveSingleMovement(mov, usuario);
      }

      return NextResponse.json({
        success: true,
        count: sortedMovs.length,
        message: `✅ Se aprobaron exitosamente los ${sortedMovs.length} movimientos del día ${fecha} en orden cronológico.`
      });
    }

    if (!movimientoId) {
      return NextResponse.json({ error: 'Falta movimientoId' }, { status: 400 });
    }

    // 1. Obtener el movimiento
    const { data: mov, error: movErr } = await supabase
      .from('movimientos_inventario')
      .select('*')
      .eq('id', movimientoId)
      .single();

    if (movErr || !mov) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }

    // 2. Acción: DESCARTAR (Eliminar movimiento individual no deseado)
    if (action === 'DESCARTAR') {
      const { error: delErr } = await supabase
        .from('movimientos_inventario')
        .delete()
        .eq('id', movimientoId);

      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
      return NextResponse.json({ success: true, message: 'Movimiento descartado' });
    }

    // 3. Acción: EDITAR (Modificar datos de un movimiento pendiente)
    if (action === 'EDITAR') {
      const updateData: any = {};
      if (overrides.insumo_id) updateData.insumo_id = overrides.insumo_id;
      if (overrides.cant_sin_porcionar_kg !== undefined) updateData.cant_sin_porcionar_kg = parseFloat(overrides.cant_sin_porcionar_kg) || 0;
      if (overrides.porciones_und !== undefined) updateData.porciones_und = parseInt(overrides.porciones_und) || 0;
      if (overrides.peso_porciones_kg !== undefined) updateData.peso_porciones_kg = parseFloat(overrides.peso_porciones_kg) || 0;
      if (overrides.costo_unitario_kg !== undefined) updateData.costo_unitario_kg = parseFloat(overrides.costo_unitario_kg) || 0;
      if (overrides.valor_total_movimiento !== undefined) updateData.valor_total_movimiento = parseFloat(overrides.valor_total_movimiento) || 0;
      if (overrides.observaciones !== undefined) {
        const cleanObs = overrides.observaciones.replace(/\[PENDIENTE_APROBAR\]/g, '').trim();
        updateData.observaciones = `[PENDIENTE_APROBAR] ${cleanObs}`;
      }

      const { data: updated, error: updErr } = await supabase
        .from('movimientos_inventario')
        .update(updateData)
        .eq('id', movimientoId)
        .select('*, catalogo_insumos(nombre, categoria)')
        .single();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ success: true, data: updated });
    }

    // 4. Acción: APROBAR INDIVIDUAL CON VALIDACIÓN CRONOLÓGICA
    const movDate = mov.fecha || (mov.fecha_hora ? mov.fecha_hora.split('T')[0] : '');

    if (movDate) {
      const { data: earlierPending } = await supabase
        .from('movimientos_inventario')
        .select('id, fecha, tipo_movimiento')
        .lt('fecha', movDate)
        .ilike('observaciones', '%[PENDIENTE_APROBAR]%')
        .order('fecha', { ascending: true })
        .limit(1);

      if (earlierPending && earlierPending.length > 0) {
        const earlierDate = earlierPending[0].fecha;
        return NextResponse.json({
          error: `⚠️ Restricción de orden cronológico: Existen movimientos pendientes del día ${earlierDate}. Debes aprobar o descartar primero los días anteriores antes de aprobar movimientos del ${movDate}.`
        }, { status: 400 });
      }
    }

    const approvedMov = await approveSingleMovement(mov, usuario, overrides);
    return NextResponse.json({ success: true, data: approvedMov });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Función auxiliar para recalibrar stock_actual desde todos los movimientos aprobados
async function recalibrateStockActual() {
  const { data: approvedMovs } = await supabase
    .from('movimientos_inventario')
    .select('*')
    .not('observaciones', 'ilike', '%[PENDIENTE_APROBAR]%')
    .order('fecha', { ascending: true });

  const newStockMap = new Map<string, { bSinPorc: number; bPorcUnd: number; bPorcKg: number; cSinPorc: number; cPorcUnd: number; cPorcKg: number }>();
  const { data: cat } = await supabase.from('catalogo_insumos').select('id');
  cat?.forEach(c => {
    newStockMap.set(String(c.id), { bSinPorc: 0, bPorcUnd: 0, bPorcKg: 0, cSinPorc: 0, cPorcUnd: 0, cPorcKg: 0 });
  });

  approvedMovs?.forEach(m => {
    const idKey = String(m.insumo_id);
    if (!newStockMap.has(idKey)) {
      newStockMap.set(idKey, { bSinPorc: 0, bPorcUnd: 0, bPorcKg: 0, cSinPorc: 0, cPorcUnd: 0, cPorcKg: 0 });
    }
    const cur = newStockMap.get(idKey)!;
    const cantKg = parseFloat(m.cant_sin_porcionar_kg) || 0;
    const porcUnd = parseInt(m.porciones_und) || 0;
    const porcKg = parseFloat(m.peso_porciones_kg) || 0;

    if (m.tipo_movimiento === 'INVENTARIO_INICIAL' || m.tipo_movimiento === 'ENTRADA_COMPRA') {
      cur.bSinPorc += cantKg;
      cur.bPorcUnd += porcUnd;
      cur.bPorcKg += porcKg;
    } else if (m.tipo_movimiento === 'PORCIONADO') {
      cur.bSinPorc = Math.max(0, cur.bSinPorc - cantKg);
      cur.bPorcUnd += porcUnd;
      cur.bPorcKg += porcKg;
    } else if (m.tipo_movimiento === 'TRASLADO_COCINA') {
      if (porcUnd > 0) {
        cur.bPorcUnd = Math.max(0, cur.bPorcUnd - porcUnd);
        cur.bPorcKg = Math.max(0, cur.bPorcKg - porcKg);
        cur.cPorcUnd += porcUnd;
        cur.cPorcKg += porcKg;
      } else {
        cur.bSinPorc = Math.max(0, cur.bSinPorc - cantKg);
        cur.cSinPorc += cantKg;
      }
    } else if (m.tipo_movimiento === 'DEVOLUCION_COCINA') {
      if (porcUnd > 0) {
        cur.cPorcUnd = Math.max(0, cur.cPorcUnd - porcUnd);
        cur.cPorcKg = Math.max(0, cur.cPorcKg - porcKg);
        cur.bPorcUnd += porcUnd;
        cur.bPorcKg += porcKg;
      } else {
        cur.cSinPorc = Math.max(0, cur.cSinPorc - cantKg);
        cur.bSinPorc += cantKg;
      }
    }
  });

  const nowIso = new Date().toISOString();
  const entries = Array.from(newStockMap.entries());
  for (const [insumoId, st] of entries) {
    await supabase.from('stock_actual').upsert({
      insumo_id: Number(insumoId),
      bodega_sin_porcionar_kg: parseFloat(st.bSinPorc.toFixed(2)),
      bodega_porcionado_und: Math.max(0, Math.round(st.bPorcUnd)),
      bodega_porcionado_kg: parseFloat(st.bPorcKg.toFixed(2)),
      cocina_sin_porcionar_kg: parseFloat(st.cSinPorc.toFixed(2)),
      cocina_porcionado_und: Math.max(0, Math.round(st.cPorcUnd)),
      cocina_porcionado_kg: parseFloat(st.cPorcKg.toFixed(2)),
      updated_at: nowIso,
    });
  }
}

// Función auxiliar para aprobar un movimiento y sincronizar stock
async function approveSingleMovement(mov: any, usuario: string, overrides: any = {}) {
  const insumoId = overrides.insumo_id || mov.insumo_id;
  const tipo = mov.tipo_movimiento;
  const cantKg = overrides.cant_sin_porcionar_kg !== undefined ? parseFloat(overrides.cant_sin_porcionar_kg) : parseFloat(mov.cant_sin_porcionar_kg) || 0;
  const porciones = overrides.porciones_und !== undefined ? parseInt(overrides.porciones_und) : parseInt(mov.porciones_und) || 0;
  const pesoPorciones = overrides.peso_porciones_kg !== undefined ? parseFloat(overrides.peso_porciones_kg) : parseFloat(mov.peso_porciones_kg) || 0;
  let costoUnitarioKg = overrides.costo_unitario_kg !== undefined ? parseFloat(overrides.costo_unitario_kg) : parseFloat(mov.costo_unitario_kg) || 0;
  let totalPesos = overrides.valor_total_movimiento !== undefined ? parseFloat(overrides.valor_total_movimiento) : parseFloat(mov.valor_total_movimiento) || 0;

  // Obtener stock actual
  let { data: stockData } = await supabase
    .from('stock_actual')
    .select('*')
    .eq('insumo_id', insumoId)
    .maybeSingle();

  const prevBSinPorc = parseFloat(stockData?.bodega_sin_porcionar_kg) || 0;
  const prevBPorcUnd = parseInt(stockData?.bodega_porcionado_und) || 0;
  const prevBPorcKg = parseFloat(stockData?.bodega_porcionado_kg) || 0;
  const prevCSinPorc = parseFloat(stockData?.cocina_sin_porcionar_kg) || 0;
  const prevCPorcUnd = parseInt(stockData?.cocina_porcionado_und) || 0;
  const prevCPorcKg = parseFloat(stockData?.cocina_porcionado_kg) || 0;

  const nowIso = new Date().toISOString();
  const todayStr = mov.fecha || nowIso.split('T')[0];

  let updateStockPayload: any = {
    insumo_id: insumoId,
    bodega_sin_porcionar_kg: prevBSinPorc,
    bodega_porcionado_und: prevBPorcUnd,
    bodega_porcionado_kg: prevBPorcKg,
    cocina_sin_porcionar_kg: prevCSinPorc,
    cocina_porcionado_und: prevCPorcUnd,
    cocina_porcionado_kg: prevCPorcKg,
    updated_at: nowIso,
  };

  let movUpdatePayload: any = {
    insumo_id: insumoId,
    cant_sin_porcionar_kg: cantKg,
    porciones_und: porciones,
    peso_porciones_kg: pesoPorciones,
    costo_unitario_kg: costoUnitarioKg,
    valor_total_movimiento: totalPesos,
    usuario: `Aprobado (${usuario})`,
  };

  // Limpiar etiqueta de pendiente
  const rawObs = overrides.observaciones || mov.observaciones || '';
  movUpdatePayload.observaciones = rawObs.replace(/\[PENDIENTE_APROBAR\]/g, '').trim() || 'Movimiento aprobado';

  if (tipo === 'ENTRADA_COMPRA') {
    const newBSinPorc = prevBSinPorc + cantKg;
    updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;

    movUpdatePayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
    movUpdatePayload.bodega_sin_porc_nuevo_kg = newBSinPorc;

    if (cantKg > 0 && totalPesos > 0) {
      costoUnitarioKg = Math.round(totalPesos / cantKg);
      movUpdatePayload.costo_unitario_kg = costoUnitarioKg;
      await supabase
        .from('catalogo_insumos')
        .update({ costo_unitario_kg: costoUnitarioKg, updated_at: nowIso })
        .eq('id', insumoId);
    }

    // Crear registro oficial en compras
    let parsedFactura = 'PENDIENTE';
    let parsedProveedor = 'Proveedor Local';
    if (rawObs.includes('Factura:')) {
      const match = rawObs.match(/Factura:\s*([^|]+)/i);
      if (match) parsedFactura = match[1].trim();
    }
    if (rawObs.includes('Proveedor:')) {
      const match = rawObs.match(/Proveedor:\s*([^|]+)/i);
      if (match) parsedProveedor = match[1].trim();
    }

    try {
      const { data: compra } = await supabase
        .from('compras')
        .insert([{
          fecha: todayStr,
          numero_factura: parsedFactura,
          proveedor: parsedProveedor,
          valor_total: totalPesos,
          observaciones: movUpdatePayload.observaciones,
          usuario: usuario
        }])
        .select()
        .single();

      if (compra) {
        await supabase.from('compras_detalle').insert([{
          compra_id: compra.id,
          insumo_id: insumoId,
          cantidad_kg: cantKg,
          costo_unitario_kg: costoUnitarioKg,
          costo_total: totalPesos
        }]);
      }
    } catch (e) {
      console.warn('Registro en compras al aprobar:', e);
    }
  } else if (tipo === 'PORCIONADO') {
    const mermaKg = parseFloat(mov.merma_kg) || Math.max(0, cantKg - pesoPorciones);
    const newBSinPorc = Math.max(0, prevBSinPorc - cantKg);
    const newBPorcUnd = prevBPorcUnd + porciones;
    const newBPorcKg = prevBPorcKg + pesoPorciones;

    updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
    updateStockPayload.bodega_porcionado_und = newBPorcUnd;
    updateStockPayload.bodega_porcionado_kg = newBPorcKg;

    movUpdatePayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
    movUpdatePayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
    movUpdatePayload.bodega_porc_und_anterior = prevBPorcUnd;
    movUpdatePayload.bodega_porc_und_nuevo = newBPorcUnd;
    movUpdatePayload.bodega_porc_kg_anterior = prevBPorcKg;
    movUpdatePayload.bodega_porc_kg_nuevo = newBPorcKg;
    movUpdatePayload.merma_kg = mermaKg;
  } else if (tipo === 'TRASLADO_COCINA') {
    if (porciones > 0) {
      const newBPorcUnd = Math.max(0, prevBPorcUnd - porciones);
      const newBPorcKg = Math.max(0, prevBPorcKg - pesoPorciones);
      const newCPorcUnd = prevCPorcUnd + porciones;
      const newCPorcKg = prevCPorcKg + pesoPorciones;

      updateStockPayload.bodega_porcionado_und = newBPorcUnd;
      updateStockPayload.bodega_porcionado_kg = newBPorcKg;
      updateStockPayload.cocina_porcionado_und = newCPorcUnd;
      updateStockPayload.cocina_porcionado_kg = newCPorcKg;

      movUpdatePayload.bodega_porc_und_anterior = prevBPorcUnd;
      movUpdatePayload.bodega_porc_und_nuevo = newBPorcUnd;
      movUpdatePayload.bodega_porc_kg_anterior = prevBPorcKg;
      movUpdatePayload.bodega_porc_kg_nuevo = newBPorcKg;
      movUpdatePayload.cocina_porc_und_anterior = prevCPorcUnd;
      movUpdatePayload.cocina_porc_und_nuevo = newCPorcUnd;
      movUpdatePayload.cocina_porc_kg_anterior = prevCPorcKg;
      movUpdatePayload.cocina_porc_kg_nuevo = newCPorcKg;
    } else {
      const newBSinPorc = Math.max(0, prevBSinPorc - cantKg);
      const newCSinPorc = prevCSinPorc + cantKg;

      updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
      updateStockPayload.cocina_sin_porcionar_kg = newCSinPorc;

      movUpdatePayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
      movUpdatePayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
    }
  } else if (tipo === 'DEVOLUCION_COCINA') {
    if (porciones > 0) {
      const newCPorcUnd = Math.max(0, prevCPorcUnd - porciones);
      const newCPorcKg = Math.max(0, prevCPorcKg - pesoPorciones);
      const newBPorcUnd = prevBPorcUnd + porciones;
      const newBPorcKg = prevBPorcKg + pesoPorciones;

      updateStockPayload.cocina_porcionado_und = newCPorcUnd;
      updateStockPayload.cocina_porcionado_kg = newCPorcKg;
      updateStockPayload.bodega_porcionado_und = newBPorcUnd;
      updateStockPayload.bodega_porcionado_kg = newBPorcKg;

      movUpdatePayload.cocina_porc_und_anterior = prevCPorcUnd;
      movUpdatePayload.cocina_porc_und_nuevo = newCPorcUnd;
      movUpdatePayload.cocina_porc_kg_anterior = prevCPorcKg;
      movUpdatePayload.cocina_porc_kg_nuevo = newCPorcKg;
      movUpdatePayload.bodega_porc_und_anterior = prevBPorcUnd;
      movUpdatePayload.bodega_porc_und_nuevo = newBPorcUnd;
      movUpdatePayload.bodega_porc_kg_anterior = prevBPorcKg;
      movUpdatePayload.bodega_porc_kg_nuevo = newBPorcKg;
    } else {
      const newCSinPorc = Math.max(0, prevCSinPorc - cantKg);
      const newBSinPorc = prevBSinPorc + cantKg;

      updateStockPayload.cocina_sin_porcionar_kg = newCSinPorc;
      updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;

      movUpdatePayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
      movUpdatePayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
    }
  }

  // Actualizar tabla movimientos_inventario
  const { data: updatedMov, error: updMovErr } = await supabase
    .from('movimientos_inventario')
    .update(movUpdatePayload)
    .eq('id', mov.id)
    .select('*, catalogo_insumos(nombre, categoria)')
    .single();

  if (updMovErr) throw new Error(updMovErr.message);

  // Actualizar stock_actual
  if (stockData) {
    await supabase
      .from('stock_actual')
      .update(updateStockPayload)
      .eq('insumo_id', insumoId);
  } else {
    await supabase
      .from('stock_actual')
      .insert([updateStockPayload]);
  }

  return updatedMov;
}
