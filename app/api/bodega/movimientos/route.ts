import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');
    const insumoId = searchParams.get('insumoId');

    let query = supabase
      .from('movimientos_inventario')
      .select('*, catalogo_insumos(nombre, categoria)')
      .order('fecha_hora', { ascending: false })
      .order('id', { ascending: false })
      .limit(3000);

    if (fecha) {
      query = query.eq('fecha', fecha);
    }

    if (insumoId && insumoId !== 'ALL') {
      query = query.eq('insumo_id', insumoId);
    }

    const { data, error } = await query;
    if (error) {
      const fallback = await supabase
        .from('movimientos_inventario')
        .select('*, catalogo_insumos(nombre, categoria)')
        .order('id', { ascending: false })
        .limit(3000);
      return NextResponse.json({ success: true, data: fallback.data || [] });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipo, insumoId, usuario = 'Bodeguero' } = body;

    if (!tipo || !insumoId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // 1. Obtener saldo actual en stock_actual
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

    // Obtener costo unitario
    const { data: catData } = await supabase
      .from('catalogo_insumos')
      .select('costo_unitario_kg')
      .eq('id', insumoId)
      .single();
    let costoUnitarioKg = parseFloat(catData?.costo_unitario_kg) || 0;

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const targetFecha = body.fecha || todayStr;
    const targetFechaHora = body.fecha ? `${body.fecha}T${nowIso.split('T')[1] || '12:00:00.000Z'}` : nowIso;

    let updateStockPayload: any = { 
      insumo_id: insumoId,
      bodega_sin_porcionar_kg: prevBSinPorc,
      bodega_porcionado_und: prevBPorcUnd,
      bodega_porcionado_kg: prevBPorcKg,
      cocina_sin_porcionar_kg: prevCSinPorc,
      cocina_porcionado_und: prevCPorcUnd,
      cocina_porcionado_kg: prevCPorcKg,
      updated_at: nowIso 
    };

    let insertMovPayload: any = {
      tipo_movimiento: tipo,
      insumo_id: insumoId,
      usuario: usuario,
      fecha: targetFecha,
      fecha_hora: targetFechaHora,
      costo_unitario_kg: costoUnitarioKg,
    };

    let movsToInsert: any[] = [];

    if (tipo === 'ENTRADA_COMPRA') {
      const cantidadKg = parseFloat(body.cantidadKg) || 0;
      const costoTotal = parseFloat(body.costoTotal) || 0;
      const proveedor = body.proveedor || 'Proveedor Local';
      const factura = body.factura || 'PENDIENTE';
      const newBSinPorc = prevBSinPorc + cantidadKg;

      if (cantidadKg > 0 && costoTotal > 0) {
        costoUnitarioKg = Math.round(costoTotal / cantidadKg);
        insertMovPayload.costo_unitario_kg = costoUnitarioKg;
        await supabase
          .from('catalogo_insumos')
          .update({ costo_unitario_kg: costoUnitarioKg, updated_at: nowIso })
          .eq('id', insumoId);
      }

      try {
        const { data: compra } = await supabase
          .from('compras')
          .insert([{
            fecha: todayStr,
            numero_factura: factura,
            proveedor: proveedor,
            valor_total: costoTotal,
            observaciones: body.observaciones || 'Ingreso registrado desde Terminal Bodeguero',
            usuario: usuario
          }])
          .select()
          .single();

        if (compra) {
          await supabase.from('compras_detalle').insert([{
            compra_id: compra.id,
            insumo_id: insumoId,
            cantidad_kg: cantidadKg,
            costo_unitario_kg: costoUnitarioKg,
            costo_total: costoTotal
          }]);
        }
      } catch (compraErr) {
        console.warn('Registro secundario en compras:', compraErr);
      }

      updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
      insertMovPayload.origen = `PROVEEDOR (${proveedor})`;
      insertMovPayload.destino = 'BODEGA_ENTERO';
      insertMovPayload.cant_sin_porcionar_kg = cantidadKg;
      insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
      insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
      insertMovPayload.valor_total_movimiento = costoTotal;
      insertMovPayload.observaciones = body.observaciones || `Factura: ${factura} - Proveedor: ${proveedor}`;
      movsToInsert = [insertMovPayload];
    } else if (tipo === 'PORCIONADO') {
      const kgAProcesar = parseFloat(body.kgAProcesar) || 0;
      const porciones = parseInt(body.porciones) || 0;
      const pesoPorcionesKg = parseFloat(body.pesoPorcionesKg) || 0;
      const mermaKg = parseFloat(body.mermaKg) || Math.max(0, kgAProcesar - pesoPorcionesKg);
      const mermaPesos = mermaKg * costoUnitarioKg;

      const newBSinPorc = Math.max(0, prevBSinPorc - kgAProcesar);
      const newBPorcUnd = prevBPorcUnd + porciones;
      const newBPorcKg = prevBPorcKg + pesoPorcionesKg;

      updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
      updateStockPayload.bodega_porcionado_und = newBPorcUnd;
      updateStockPayload.bodega_porcionado_kg = newBPorcKg;

      insertMovPayload.origen = 'BODEGA_ENTERO';
      insertMovPayload.destino = 'BODEGA_PORCIONADO';
      insertMovPayload.cant_sin_porcionar_kg = kgAProcesar;
      insertMovPayload.porciones_und = porciones;
      insertMovPayload.peso_porciones_kg = pesoPorcionesKg;
      insertMovPayload.merma_kg = mermaKg;
      insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
      insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
      insertMovPayload.bodega_porc_und_anterior = prevBPorcUnd;
      insertMovPayload.bodega_porc_und_nuevo = newBPorcUnd;
      insertMovPayload.bodega_porc_kg_anterior = prevBPorcKg;
      insertMovPayload.bodega_porc_kg_nuevo = newBPorcKg;
      insertMovPayload.observaciones = body.observaciones || `Procesados ${kgAProcesar} Kg ➔ ${porciones} porc (${pesoPorcionesKg} Kg). Merma: ${mermaKg.toFixed(2)} Kg`;
      movsToInsert = [insertMovPayload];
    } else if (tipo === 'TRASLADO_COCINA') {
      const isEntero = body.tipoEntrega === 'ENTERO';
      const autoPorcionar = !isEntero && (body.autoPorcionar === true);

      if (autoPorcionar) {
        const cantidad = parseInt(body.cantidad) || 0;
        const pesoKg = parseFloat(body.pesoKg) || 0;
        const kgTomadosEntero = parseFloat(body.kgTomadosEntero) || pesoKg;
        const porcionesAuto = parseInt(body.porcionesAuto) || cantidad;
        const pesoPorcionesAutoKg = parseFloat(body.pesoPorcionesAutoKg) || pesoKg;
        const mermaAutoKg = parseFloat(body.mermaAutoKg) || Math.max(0, kgTomadosEntero - pesoPorcionesAutoKg);

        const bSinPorcAfterPorc = Math.max(0, prevBSinPorc - kgTomadosEntero);
        const bPorcUndAfterPorc = prevBPorcUnd + porcionesAuto;
        const bPorcKgAfterPorc = prevBPorcKg + pesoPorcionesAutoKg;

        const bPorcUndFinal = Math.max(0, bPorcUndAfterPorc - cantidad);
        const bPorcKgFinal = Math.max(0, bPorcKgAfterPorc - pesoKg);
        const cPorcUndFinal = prevCPorcUnd + cantidad;
        const cPorcKgFinal = prevCPorcKg + pesoKg;

        updateStockPayload.bodega_sin_porcionar_kg = bSinPorcAfterPorc;
        updateStockPayload.bodega_porcionado_und = bPorcUndFinal;
        updateStockPayload.bodega_porcionado_kg = bPorcKgFinal;
        updateStockPayload.cocina_porcionado_und = cPorcUndFinal;
        updateStockPayload.cocina_porcionado_kg = cPorcKgFinal;

        const movPorcionado = {
          tipo_movimiento: 'PORCIONADO',
          insumo_id: insumoId,
          usuario: usuario,
          fecha: targetFecha,
          fecha_hora: targetFechaHora,
          costo_unitario_kg: costoUnitarioKg,
          origen: 'BODEGA_ENTERO',
          destino: 'BODEGA_PORCIONADO',
          cant_sin_porcionar_kg: kgTomadosEntero,
          porciones_und: porcionesAuto,
          peso_porciones_kg: pesoPorcionesAutoKg,
          merma_kg: mermaAutoKg,
          bodega_sin_porc_anterior_kg: prevBSinPorc,
          bodega_sin_porc_nuevo_kg: bSinPorcAfterPorc,
          bodega_porc_und_anterior: prevBPorcUnd,
          bodega_porc_und_nuevo: bPorcUndAfterPorc,
          bodega_porc_kg_anterior: prevBPorcKg,
          bodega_porc_kg_nuevo: bPorcKgAfterPorc,
          observaciones: `Auto-porcionado directo (${kgTomadosEntero} Kg entero ➔ ${porcionesAuto} porc)`,
        };

        const movTraslado = {
          tipo_movimiento: 'TRASLADO_COCINA',
          insumo_id: insumoId,
          usuario: usuario,
          fecha: targetFecha,
          fecha_hora: new Date(new Date(targetFechaHora).getTime() + 1000).toISOString(),
          costo_unitario_kg: costoUnitarioKg,
          origen: 'BODEGA_PORCIONADO',
          destino: 'COCINA_PORCIONADO',
          cant_sin_porcionar_kg: 0,
          porciones_und: cantidad,
          peso_porciones_kg: pesoKg,
          valor_total_movimiento: pesoKg * costoUnitarioKg,
          bodega_porc_und_anterior: bPorcUndAfterPorc,
          bodega_porc_und_nuevo: bPorcUndFinal,
          bodega_porc_kg_anterior: bPorcKgAfterPorc,
          bodega_porc_kg_nuevo: bPorcKgFinal,
          cocina_porc_und_anterior: prevCPorcUnd,
          cocina_porc_und_nuevo: cPorcUndFinal,
          cocina_porc_kg_anterior: prevCPorcKg,
          cocina_porc_kg_nuevo: cPorcKgFinal,
          observaciones: body.observaciones || `Despacho directo a cocina: ${cantidad} porciones (${pesoKg} Kg) [Auto-porcionado]`,
        };

        movsToInsert = [movPorcionado, movTraslado];
      } else if (!isEntero) {
        const cantidad = parseInt(body.cantidad) || 0;
        const pesoKg = parseFloat(body.pesoKg) || 0;
        const newBPorcUnd = Math.max(0, prevBPorcUnd - cantidad);
        const newBPorcKg = Math.max(0, prevBPorcKg - pesoKg);
        const newCPorcUnd = prevCPorcUnd + cantidad;
        const newCPorcKg = prevCPorcKg + pesoKg;

        updateStockPayload.bodega_porcionado_und = newBPorcUnd;
        updateStockPayload.bodega_porcionado_kg = newBPorcKg;
        updateStockPayload.cocina_porcionado_und = newCPorcUnd;
        updateStockPayload.cocina_porcionado_kg = newCPorcKg;

        insertMovPayload.origen = 'BODEGA_PORCIONADO';
        insertMovPayload.destino = 'COCINA_PORCIONADO';
        insertMovPayload.cant_sin_porcionar_kg = 0;
        insertMovPayload.porciones_und = cantidad;
        insertMovPayload.peso_porciones_kg = pesoKg;
        insertMovPayload.valor_total_movimiento = pesoKg * costoUnitarioKg;
        insertMovPayload.bodega_porc_und_anterior = prevBPorcUnd;
        insertMovPayload.bodega_porc_und_nuevo = newBPorcUnd;
        insertMovPayload.bodega_porc_kg_anterior = prevBPorcKg;
        insertMovPayload.bodega_porc_kg_nuevo = newBPorcKg;
        insertMovPayload.cocina_porc_und_anterior = prevCPorcUnd;
        insertMovPayload.cocina_porc_und_nuevo = newCPorcUnd;
        insertMovPayload.cocina_porc_kg_anterior = prevCPorcKg;
        insertMovPayload.cocina_porc_kg_nuevo = newCPorcKg;
        insertMovPayload.observaciones = body.observaciones || `Despacho a cocina: ${cantidad} porciones`;
        movsToInsert = [insertMovPayload];
      } else {
        const cantidad = parseFloat(body.cantidad) || 0;
        const newBSinPorc = Math.max(0, prevBSinPorc - cantidad);
        const newCSinPorc = prevCSinPorc + cantidad;
        updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
        updateStockPayload.cocina_sin_porcionar_kg = newCSinPorc;
        insertMovPayload.origen = 'BODEGA_ENTERO';
        insertMovPayload.destino = 'COCINA_ENTERO';
        insertMovPayload.cant_sin_porcionar_kg = cantidad;
        insertMovPayload.porciones_und = 0;
        insertMovPayload.peso_porciones_kg = 0;
        insertMovPayload.valor_total_movimiento = cantidad * costoUnitarioKg;
        insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
        insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
        insertMovPayload.cocina_sin_porc_anterior_kg = prevCSinPorc;
        insertMovPayload.cocina_sin_porc_nuevo_kg = newCSinPorc;
        insertMovPayload.observaciones = body.observaciones || `Despacho a cocina: ${cantidad} Kg`;
        movsToInsert = [insertMovPayload];
      }
    } else if (tipo === 'DEVOLUCION_COCINA') {
      const isEntero = body.tipoDevolucion === 'ENTERO';
      const cantidad = isEntero ? (parseFloat(body.cantidad) || 0) : (parseInt(body.cantidad) || 0);
      const pesoKg = parseFloat(body.pesoKg) || 0;

      if (!isEntero) {
        const newCPorcUnd = Math.max(0, prevCPorcUnd - cantidad);
        const newCPorcKg = Math.max(0, prevCPorcKg - pesoKg);
        const newBPorcUnd = prevBPorcUnd + cantidad;
        const newBPorcKg = prevBPorcKg + pesoKg;

        updateStockPayload.cocina_porcionado_und = newCPorcUnd;
        updateStockPayload.cocina_porcionado_kg = newCPorcKg;
        updateStockPayload.bodega_porcionado_und = newBPorcUnd;
        updateStockPayload.bodega_porcionado_kg = newBPorcKg;

        insertMovPayload.origen = 'COCINA_PORCIONADO';
        insertMovPayload.destino = 'BODEGA_PORCIONADO';
        insertMovPayload.cant_sin_porcionar_kg = 0;
        insertMovPayload.porciones_und = cantidad;
        insertMovPayload.peso_porciones_kg = pesoKg;
        insertMovPayload.valor_total_movimiento = pesoKg * costoUnitarioKg;
        insertMovPayload.bodega_porc_und_anterior = prevBPorcUnd;
        insertMovPayload.bodega_porc_und_nuevo = newBPorcUnd;
        insertMovPayload.bodega_porc_kg_anterior = prevBPorcKg;
        insertMovPayload.bodega_porc_kg_nuevo = newBPorcKg;
        insertMovPayload.cocina_porc_und_anterior = prevCPorcUnd;
        insertMovPayload.cocina_porc_und_nuevo = newCPorcUnd;
        insertMovPayload.cocina_porc_kg_anterior = prevCPorcKg;
        insertMovPayload.cocina_porc_kg_nuevo = newCPorcKg;
      } else {
        const newCSinPorc = Math.max(0, prevCSinPorc - cantidad);
        const newBSinPorc = prevBSinPorc + cantidad;
        updateStockPayload.cocina_sin_porcionar_kg = newCSinPorc;
        updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
        insertMovPayload.origen = 'COCINA_ENTERO';
        insertMovPayload.destino = 'BODEGA_ENTERO';
        insertMovPayload.cant_sin_porcionar_kg = cantidad;
        insertMovPayload.porciones_und = 0;
        insertMovPayload.peso_porciones_kg = 0;
        insertMovPayload.valor_total_movimiento = cantidad * costoUnitarioKg;
        insertMovPayload.cocina_sin_porc_anterior_kg = prevCSinPorc;
        insertMovPayload.cocina_sin_porc_nuevo_kg = newCSinPorc;
        insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
        insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
      }
      insertMovPayload.observaciones = body.observaciones || `Devolución a bodega: ${cantidad} ${!isEntero ? 'porciones' : 'Kg'}`;
      movsToInsert = [insertMovPayload];
    } else if (tipo === 'BAJA_MERMA' || tipo === 'DESPERDICIO') {
      const ubicacion = body.ubicacion || 'BODEGA';
      const isEntero = body.tipoProducto === 'ENTERO';
      const cantidad = isEntero ? (parseFloat(body.cantidad) || 0) : (parseInt(body.cantidad) || 0);
      const mermaKg = parseFloat(body.mermaKg) || 0;
      const mermaPesos = parseFloat(body.mermaPesos) || Math.round((mermaKg || (isEntero ? cantidad : 0)) * costoUnitarioKg);
      const motivo = body.motivo || 'DESPERDICIO_OPERATIVO';

      if (ubicacion === 'BODEGA') {
        if (isEntero) {
          const newBSinPorc = Math.max(0, prevBSinPorc - cantidad);
          updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
          insertMovPayload.origen = 'BODEGA_ENTERO';
          insertMovPayload.destino = 'MERMA_DESPERDICIO';
          insertMovPayload.cant_sin_porcionar_kg = cantidad;
          insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
          insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
        } else {
          const newBPorcUnd = Math.max(0, prevBPorcUnd - cantidad);
          const newBPorcKg = Math.max(0, prevBPorcKg - mermaKg);
          updateStockPayload.bodega_porcionado_und = newBPorcUnd;
          updateStockPayload.bodega_porcionado_kg = newBPorcKg;
          insertMovPayload.origen = 'BODEGA_PORCIONADO';
          insertMovPayload.destino = 'MERMA_DESPERDICIO';
          insertMovPayload.porciones_und = cantidad;
          insertMovPayload.peso_porciones_kg = mermaKg;
          insertMovPayload.bodega_porc_und_anterior = prevBPorcUnd;
          insertMovPayload.bodega_porc_und_nuevo = newBPorcUnd;
          insertMovPayload.bodega_porc_kg_anterior = prevBPorcKg;
          insertMovPayload.bodega_porc_kg_nuevo = newBPorcKg;
        }
      } else {
        // COCINA
        if (isEntero) {
          const newCSinPorc = Math.max(0, prevCSinPorc - cantidad);
          updateStockPayload.cocina_sin_porcionar_kg = newCSinPorc;
          insertMovPayload.origen = 'COCINA_ENTERO';
          insertMovPayload.destino = 'MERMA_DESPERDICIO';
          insertMovPayload.cant_sin_porcionar_kg = cantidad;
          insertMovPayload.cocina_sin_porc_anterior_kg = prevCSinPorc;
          insertMovPayload.cocina_sin_porc_nuevo_kg = newCSinPorc;
        } else {
          const newCPorcUnd = Math.max(0, prevCPorcUnd - cantidad);
          const newCPorcKg = Math.max(0, prevCPorcKg - mermaKg);
          updateStockPayload.cocina_porcionado_und = newCPorcUnd;
          updateStockPayload.cocina_porcionado_kg = newCPorcKg;
          insertMovPayload.origen = 'COCINA_PORCIONADO';
          insertMovPayload.destino = 'MERMA_DESPERDICIO';
          insertMovPayload.porciones_und = cantidad;
          insertMovPayload.peso_porciones_kg = mermaKg;
          insertMovPayload.cocina_porc_und_anterior = prevCPorcUnd;
          insertMovPayload.cocina_porc_und_nuevo = newCPorcUnd;
          insertMovPayload.cocina_porc_kg_anterior = prevCPorcKg;
          insertMovPayload.cocina_porc_kg_nuevo = newCPorcKg;
        }
      }

      insertMovPayload.merma_kg = mermaKg || (isEntero ? cantidad : 0);
      insertMovPayload.valor_total_movimiento = mermaPesos;
      insertMovPayload.observaciones = body.observaciones || `Baja por ${motivo} en ${ubicacion}: ${cantidad} ${isEntero ? 'Kg' : 'porciones'}`;
      movsToInsert = [insertMovPayload];
    }

    // Actualización de stock_actual mediante upsert
    const { error: stockUpdErr } = await supabase
      .from('stock_actual')
      .upsert(updateStockPayload, { onConflict: 'insumo_id' });

    if (stockUpdErr) {
      console.error('Error upsert stock_actual:', stockUpdErr);
    }

    const { data: movData, error: movInsertErr } = await supabase
      .from('movimientos_inventario')
      .insert(movsToInsert)
    if (movInsertErr) {
      console.error('Error insertando movimiento:', movInsertErr);
      return NextResponse.json({ error: movInsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: movData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
