/**
 * Servicio Centralizado de Movimientos de Inventario y Auditoría
 * Maneja compras, porcionados, traslados, devoluciones, mermas, auto-porcionado y aprobaciones.
 */

import { supabase } from '@/lib/supabase';

export interface GetMovimientosFilter {
  fecha?: string;
  insumoId?: string;
}

export async function getMovimientosInventario(filters: GetMovimientosFilter = {}) {
  let query = supabase
    .from('movimientos_inventario')
    .select('*, catalogo_insumos(nombre, categoria)')
    .order('fecha_hora', { ascending: false })
    .order('id', { ascending: false })
    .limit(3000);

  if (filters.fecha) {
    query = query.eq('fecha', filters.fecha);
  }

  if (filters.insumoId && filters.insumoId !== 'ALL') {
    query = query.eq('insumo_id', filters.insumoId);
  }

  const { data, error } = await query;
  if (error) {
    const fallback = await supabase
      .from('movimientos_inventario')
      .select('*, catalogo_insumos(nombre, categoria)')
      .order('id', { ascending: false })
      .limit(3000);
    return fallback.data || [];
  }

  return data || [];
}

export interface RegistrarMovimientoBodegaInput {
  tipo: string;
  insumoId: string | number;
  usuario?: string;
  fecha?: string;
  cantidadKg?: number | string;
  cantidadUnd?: number | string;
  costoTotal?: number | string;
  proveedor?: string;
  factura?: string;
  observaciones?: string;
  kgAProcesar?: number | string;
  porciones?: number | string;
  pesoPorcionesKg?: number | string;
  mermaKg?: number | string;
  tipoEntrega?: 'ENTERO' | 'PORCIONADO';
  autoPorcionar?: boolean;
  cantidad?: number | string;
  pesoKg?: number | string;
  kgTomadosEntero?: number | string;
  porcionesAuto?: number | string;
  pesoPorcionesAutoKg?: number | string;
  mermaAutoKg?: number | string;
  tipoDevolucion?: 'ENTERO' | 'PORCIONADO';
  ubicacion?: 'BODEGA' | 'COCINA';
  tipoProducto?: 'ENTERO' | 'PORCIONADO';
  mermaPesos?: number | string;
  motivo?: string;
}

export async function registrarMovimientoBodega(body: RegistrarMovimientoBodegaInput) {
  const { tipo, insumoId, usuario = 'Bodeguero' } = body;

  if (!tipo || !insumoId) {
    const error: any = new Error('Faltan campos obligatorios (tipo, insumoId)');
    error.status = 400;
    throw error;
  }

  // 1. Obtener saldo actual en stock_actual
  const { data: stockData } = await supabase
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

  // 2. Obtener costo unitario y peso estándar
  const { data: catData } = await supabase
    .from('catalogo_insumos')
    .select('costo_unitario_kg, peso_estandar_porcion_kg, tipo_medida')
    .eq('id', insumoId)
    .single();
  let costoUnitarioKg = parseFloat(catData?.costo_unitario_kg) || 0;
  const pesoEstandarPorcionKg = parseFloat(catData?.peso_estandar_porcion_kg) || 0.35;
  const tipoMedida = catData?.tipo_medida || 'KGS_Y_UNIDADES';
  const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';

  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];
  const targetFecha = body.fecha || todayStr;
  const targetFechaHora = body.fecha ? `${body.fecha}T${nowIso.split('T')[1] || '12:00:00.000Z'}` : nowIso;

  const updateStockPayload: any = { 
    insumo_id: insumoId,
    bodega_sin_porcionar_kg: prevBSinPorc,
    bodega_porcionado_und: prevBPorcUnd,
    bodega_porcionado_kg: prevBPorcKg,
    cocina_sin_porcionar_kg: prevCSinPorc,
    cocina_porcionado_und: prevCPorcUnd,
    cocina_porcionado_kg: prevCPorcKg,
    updated_at: nowIso 
  };

  const insertMovPayload: any = {
    tipo_movimiento: tipo,
    insumo_id: insumoId,
    usuario: usuario,
    fecha: targetFecha,
    fecha_hora: targetFechaHora,
    costo_unitario_kg: costoUnitarioKg,
  };

  let movsToInsert: any[] = [];

  if (tipo === 'ENTRADA_COMPRA') {
    const cantidadUnd = isContable ? (parseInt(String(body.cantidadUnd)) || parseInt(String(body.cantidadKg)) || 0) : 0;
    const cantidadKg = isContable ? 0 : (parseFloat(String(body.cantidadKg)) || 0);
    const costoTotal = parseFloat(String(body.costoTotal)) || 0;
    const proveedor = body.proveedor || 'Proveedor Local';
    const factura = body.factura || 'PENDIENTE';

    if (isContable) {
      const newBPorcUnd = prevBPorcUnd + cantidadUnd;

      if (cantidadUnd > 0 && costoTotal > 0) {
        costoUnitarioKg = Math.round(costoTotal / cantidadUnd);
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
            cantidad_kg: cantidadUnd,
            costo_unitario_kg: costoUnitarioKg,
            costo_total: costoTotal
          }]);
        }
      } catch (compraErr) {
        console.warn('Registro secundario en compras:', compraErr);
      }

      updateStockPayload.bodega_porcionado_und = newBPorcUnd;
      insertMovPayload.origen = `PROVEEDOR (${proveedor})`;
      insertMovPayload.destino = 'BODEGA_PORCIONADO';
      insertMovPayload.cant_sin_porcionar_kg = 0;
      insertMovPayload.porciones_und = cantidadUnd;
      insertMovPayload.peso_porciones_kg = 0;
      insertMovPayload.bodega_porc_und_anterior = prevBPorcUnd;
      insertMovPayload.bodega_porc_und_nuevo = newBPorcUnd;
      insertMovPayload.valor_total_movimiento = costoTotal;
      insertMovPayload.observaciones = body.observaciones || `Factura: ${factura} - Proveedor: ${proveedor}`;
      movsToInsert = [insertMovPayload];
    } else {
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
      insertMovPayload.porciones_und = 0;
      insertMovPayload.peso_porciones_kg = 0;
      insertMovPayload.bodega_sin_porc_anterior_kg = prevBSinPorc;
      insertMovPayload.bodega_sin_porc_nuevo_kg = newBSinPorc;
      insertMovPayload.valor_total_movimiento = costoTotal;
      insertMovPayload.observaciones = body.observaciones || `Factura: ${factura} - Proveedor: ${proveedor}`;
      movsToInsert = [insertMovPayload];
    }
  } else if (tipo === 'PORCIONADO') {
    const kgAProcesar = parseFloat(String(body.kgAProcesar)) || 0;
    const porciones = parseInt(String(body.porciones)) || 0;
    const pesoPorcionesKg = parseFloat(String(body.pesoPorcionesKg)) || 0;
    const mermaKg = parseFloat(String(body.mermaKg)) || Math.max(0, kgAProcesar - pesoPorcionesKg);

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
    if (isContable) {
      const cantidad = parseInt(String(body.cantidad)) || 0;
      const newBPorcUnd = Math.max(0, prevBPorcUnd - cantidad);
      const newCPorcUnd = prevCPorcUnd + cantidad;

      updateStockPayload.bodega_porcionado_und = newBPorcUnd;
      updateStockPayload.cocina_porcionado_und = newCPorcUnd;

      insertMovPayload.origen = 'BODEGA_PORCIONADO';
      insertMovPayload.destino = 'COCINA_PORCIONADO';
      insertMovPayload.cant_sin_porcionar_kg = 0;
      insertMovPayload.porciones_und = cantidad;
      insertMovPayload.peso_porciones_kg = 0;
      insertMovPayload.valor_total_movimiento = cantidad * costoUnitarioKg;
      insertMovPayload.bodega_porc_und_anterior = prevBPorcUnd;
      insertMovPayload.bodega_porc_und_nuevo = newBPorcUnd;
      insertMovPayload.cocina_porc_und_anterior = prevCPorcUnd;
      insertMovPayload.cocina_porc_und_nuevo = newCPorcUnd;
      insertMovPayload.observaciones = body.observaciones || `Despacho a cocina: ${cantidad} ${tipoMedida === 'PAQUETES' ? 'paquetes' : 'und'}`;
      movsToInsert = [insertMovPayload];
    } else {
      const isEntero = body.tipoEntrega === 'ENTERO';

    if (!isEntero) {
      const cantidad = parseInt(String(body.cantidad)) || 0;
      const pesoKg = parseFloat(String(body.pesoKg)) || 0;
      const pesoStd = (cantidad > 0 && pesoKg > 0) ? (pesoKg / cantidad) : (pesoEstandarPorcionKg || 0.35);

      // Determinar si alcanza con porciones listas o si se toma de entero
      const porcFromListas = Math.min(prevBPorcUnd, cantidad);
      const porcFromEntero = Math.max(0, cantidad - porcFromListas);
      const kgFromEntero = porcFromEntero > 0 ? parseFloat((porcFromEntero * pesoStd).toFixed(2)) : 0;
      const kgFromListas = parseFloat((pesoKg - kgFromEntero).toFixed(2));

      const newBSinPorc = Math.max(0, prevBSinPorc - kgFromEntero);
      const newBPorcUnd = Math.max(0, prevBPorcUnd - porcFromListas);
      const newBPorcKg = Math.max(0, prevBPorcKg - kgFromListas);
      const newCPorcUnd = prevCPorcUnd + cantidad;
      const newCPorcKg = prevCPorcKg + pesoKg;

      updateStockPayload.bodega_sin_porcionar_kg = newBSinPorc;
      updateStockPayload.bodega_porcionado_und = newBPorcUnd;
      updateStockPayload.bodega_porcionado_kg = newBPorcKg;
      updateStockPayload.cocina_porcionado_und = newCPorcUnd;
      updateStockPayload.cocina_porcionado_kg = newCPorcKg;

      if (porcFromEntero > 0) {
        // Auto-porcionado transparente: Genera el movimiento de porcionado y el de traslado
        const movPorcionado = {
          tipo_movimiento: 'PORCIONADO',
          insumo_id: insumoId,
          usuario: usuario,
          fecha: targetFecha,
          fecha_hora: targetFechaHora,
          costo_unitario_kg: costoUnitarioKg,
          origen: 'BODEGA_ENTERO',
          destino: 'BODEGA_PORCIONADO',
          cant_sin_porcionar_kg: kgFromEntero,
          porciones_und: porcFromEntero,
          peso_porciones_kg: kgFromEntero,
          merma_kg: 0,
          bodega_sin_porc_anterior_kg: prevBSinPorc,
          bodega_sin_porc_nuevo_kg: newBSinPorc,
          bodega_porc_und_anterior: prevBPorcUnd,
          bodega_porc_und_nuevo: prevBPorcUnd + porcFromEntero,
          bodega_porc_kg_anterior: prevBPorcKg,
          bodega_porc_kg_nuevo: prevBPorcKg + kgFromEntero,
          observaciones: `Auto-porcionado transparente (${kgFromEntero} Kg entero ➔ ${porcFromEntero} porc para traslado)`,
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
          bodega_porc_und_anterior: prevBPorcUnd + porcFromEntero,
          bodega_porc_und_nuevo: newBPorcUnd,
          bodega_porc_kg_anterior: prevBPorcKg + kgFromEntero,
          bodega_porc_kg_nuevo: newBPorcKg,
          cocina_porc_und_anterior: prevCPorcUnd,
          cocina_porc_und_nuevo: newCPorcUnd,
          cocina_porc_kg_anterior: prevCPorcKg,
          cocina_porc_kg_nuevo: newCPorcKg,
          observaciones: body.observaciones || (
            porcFromListas > 0
              ? `Despacho a cocina: ${cantidad} porciones (${porcFromListas} de bodega + ${porcFromEntero} autoporcionadas)`
              : `Despacho a cocina: ${cantidad} porciones (${pesoKg} Kg autoporcionados)`
          ),
        };

        movsToInsert = [movPorcionado, movTraslado];
      } else {
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
      }
    } else {
      const cantidad = parseFloat(String(body.cantidad)) || 0;
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
  }
} else if (tipo === 'DEVOLUCION_COCINA') {
    const isEntero = body.tipoDevolucion === 'ENTERO';
    const cantidad = isEntero ? (parseFloat(String(body.cantidad)) || 0) : (parseInt(String(body.cantidad)) || 0);
    const pesoKg = parseFloat(String(body.pesoKg)) || 0;

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
    const cantidad = isEntero ? (parseFloat(String(body.cantidad)) || 0) : (parseInt(String(body.cantidad)) || 0);
    const mermaKg = parseFloat(String(body.mermaKg)) || 0;
    const mermaPesos = parseFloat(String(body.mermaPesos)) || Math.round((mermaKg || (isEntero ? cantidad : 0)) * costoUnitarioKg);
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
    .select();

  if (movInsertErr) {
    console.error('Error insertando movimiento:', movInsertErr);
    throw movInsertErr;
  }

  return { success: true, data: movData };
}

/**
 * Aprueba formalmente un movimiento individual retirando la marca [PENDIENTE_APROBAR]
 */
export async function aprobarMovimiento(movimientoId: string, usuario: string = 'Administrador') {
  const { data: mov, error: errGet } = await supabase
    .from('movimientos_inventario')
    .select('*')
    .eq('id', movimientoId)
    .single();

  if (errGet || !mov) throw new Error('Movimiento no encontrado');

  const cleanObs = (mov.observaciones || '').replace(/\[PENDIENTE_APROBAR\]/g, '').trim();

  const { error: errUpd } = await supabase
    .from('movimientos_inventario')
    .update({
      observaciones: cleanObs,
      usuario: usuario,
      fecha_hora: new Date().toISOString()
    })
    .eq('id', movimientoId);

  if (errUpd) throw errUpd;
  return { success: true };
}
