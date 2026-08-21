import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');
    const insumoId = searchParams.get('insumoId');

    let query = supabase
      .from('movimientos_inventario')
      .select('*, catalogo_insumos(nombre, categoria)')
      .order('fecha_movimiento', { ascending: false })
      .order('id', { ascending: false })
      .limit(100);

    if (fecha) {
      query = query.gte('fecha_movimiento', `${fecha}T00:00:00`).lte('fecha_movimiento', `${fecha}T23:59:59`);
    }

    if (insumoId && insumoId !== 'ALL') {
      query = query.eq('insumo_id', insumoId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
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

    // 1. Obtener saldo actual
    const { data: stockData, error: stockFetchErr } = await supabase
      .from('stock_actual')
      .select('*')
      .eq('insumo_id', insumoId)
      .single();

    if (stockFetchErr || !stockData) {
      return NextResponse.json({ error: 'No se encontró el stock para el insumo' }, { status: 404 });
    }

    const prevBSinPorc = parseFloat(stockData.bodega_sin_porcionar_kg) || 0;
    const prevBPorcUnd = parseInt(stockData.bodega_porcionado_und) || 0;
    const prevBPorcKg = parseFloat(stockData.bodega_porcionado_kg) || 0;
    const prevCPorcUnd = parseInt(stockData.cocina_porcionado_und) || 0;
    const prevCPorcKg = parseFloat(stockData.cocina_porcionado_kg) || 0;

    // Obtener costo unitario
    const { data: catData } = await supabase
      .from('catalogo_insumos')
      .select('costo_unitario_kg')
      .eq('id', insumoId)
      .single();
    const costoUnitarioKg = parseFloat(catData?.costo_unitario_kg) || 0;

    let updateStockPayload: any = { updated_at: new Date().toISOString() };
    let insertMovPayload: any = {
      tipo_movimiento: tipo,
      insumo_id: insumoId,
      usuario: usuario,
      fecha_movimiento: new Date().toISOString(),
      costo_unitario_kg: costoUnitarioKg,
    };

    if (tipo === 'ENTRADA_COMPRA') {
      const cantidadKg = parseFloat(body.cantidadKg) || 0;
      const costoTotal = parseFloat(body.costoTotal) || 0;
      const proveedor = body.proveedor || 'Proveedor Local';
      const factura = body.factura || 'PENDIENTE';
      const newBSinPorc = prevBSinPorc + cantidadKg;

      updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
      insertMovPayload.origen = `PROVEEDOR (${proveedor})`;
      insertMovPayload.destino = 'BODEGA_ENTERO';
      insertMovPayload.cant_sin_porcionar_kg = cantidadKg;
      insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
      insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
      insertMovPayload.valor_total_movimiento = costoTotal;
      insertMovPayload.observaciones = body.observaciones || `Factura: ${factura} - Proveedor: ${proveedor}`;
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
      insertMovPayload.merma_pesos = mermaPesos;
      insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
      insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
      insertMovPayload.bodega_porc_anterior_und = prevBPorcUnd;
      insertMovPayload.bodega_porc_nuevo_und = newBPorcUnd;
      insertMovPayload.observaciones = body.observaciones || `Procesados ${kgAProcesar} Kg ➔ ${porciones} porc (${pesoPorcionesKg} Kg). Merma: ${mermaKg.toFixed(2)} Kg`;
    } else if (tipo === 'TRASLADO_COCINA') {
      const esPorc = Boolean(body.esPorcionado);
      const cantidad = parseInt(body.cantidad) || 0;
      const pesoKg = parseFloat(body.pesoKg) || 0;

      if (esPorc) {
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
        insertMovPayload.porciones_und = cantidad;
        insertMovPayload.peso_porciones_kg = pesoKg;
        insertMovPayload.bodega_porc_anterior_und = prevBPorcUnd;
        insertMovPayload.bodega_porc_nuevo_und = newBPorcUnd;
        insertMovPayload.cocina_porc_anterior_und = prevCPorcUnd;
        insertMovPayload.cocina_porc_nuevo_und = newCPorcUnd;
      } else {
        const newBSinPorc = Math.max(0, prevBSinPorc - pesoKg);
        updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
        insertMovPayload.origen = 'BODEGA_ENTERO';
        insertMovPayload.destino = 'COCINA_ENTERO';
        insertMovPayload.cant_sin_porcionar_kg = pesoKg;
        insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
        insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
      }
      insertMovPayload.observaciones = body.observaciones || `Despacho a cocina: ${cantidad || pesoKg} ${esPorc ? 'porciones' : 'Kg'}`;
    } else if (tipo === 'DEVOLUCION_COCINA') {
      const esPorc = Boolean(body.esPorcionado);
      const cantidad = parseInt(body.cantidad) || 0;
      const pesoKg = parseFloat(body.pesoKg) || 0;

      if (esPorc) {
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
        insertMovPayload.porciones_und = cantidad;
        insertMovPayload.peso_porciones_kg = pesoKg;
        insertMovPayload.bodega_porc_anterior_und = prevBPorcUnd;
        insertMovPayload.bodega_porc_nuevo_und = newBPorcUnd;
        insertMovPayload.cocina_porc_anterior_und = prevCPorcUnd;
        insertMovPayload.cocina_porc_nuevo_und = newCPorcUnd;
      } else {
        const newBSinPorc = prevBSinPorc + pesoKg;
        updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
        insertMovPayload.origen = 'COCINA_ENTERO';
        insertMovPayload.destino = 'BODEGA_ENTERO';
        insertMovPayload.cant_sin_porcionar_kg = pesoKg;
        insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
        insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
      }
      insertMovPayload.observaciones = body.observaciones || `Devolución de cocina a bodega: ${cantidad || pesoKg} ${esPorc ? 'porciones' : 'Kg'}`;
    }

    // Ejecutar actualización de stock y creación de movimiento
    await supabase.from('stock_actual').update(updateStockPayload).eq('insumo_id', insumoId);
    const { data: movData, error: movInsertErr } = await supabase.from('movimientos_inventario').insert([insertMovPayload]).select().single();

    if (movInsertErr) {
      return NextResponse.json({ error: movInsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: movData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
