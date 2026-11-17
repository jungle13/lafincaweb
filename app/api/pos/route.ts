import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { invalidateVentasCache } from '@/app/api/ventas/route';
import { recalcularHojaDiaria } from '@/services/libroCajaService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function inferEstacionComanda(categoria: string, nombre: string): 'COCINA_PARRILLA' | 'BEBIDAS_BAR' | 'POSTRES_ENTRADAS' {
  const c = `${categoria || ''} ${nombre || ''}`.toLowerCase();
  if (
    c.includes('bebida') ||
    c.includes('cerveza') ||
    c.includes('gaseosa') ||
    c.includes('jugo') ||
    c.includes('licor') ||
    c.includes('agua') ||
    c.includes('limonada') ||
    c.includes('cafe') ||
    c.includes('tinto')
  ) {
    return 'BEBIDAS_BAR';
  }
  if (c.includes('postre') || c.includes('entrada') || c.includes('choclo')) {
    return 'POSTRES_ENTRADAS';
  }
  return 'COCINA_PARRILLA';
}

async function recalcularTotalesOrden(ordenId: string) {
  const [{ data: orden }, { data: items }] = await Promise.all([
    supabase.from('pos_ordenes').select('*').eq('id', ordenId).single(),
    supabase
      .from('pos_orden_items')
      .select('*')
      .eq('orden_id', ordenId)
      .neq('estado_comanda', 'ANULADO'),
  ]);

  if (!orden) return null;
  const activos = items || [];
  const subtotalBruto = activos.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
  const descuento = Number(orden.descuento || 0);
  const propina = Number(orden.propina || 0);
  const costoDomicilio = Number(orden.costo_domicilio || 0);
  const granTotal = Math.max(0, Math.round(subtotalBruto - descuento + propina + costoDomicilio));

  const { data: updated } = await supabase
    .from('pos_ordenes')
    .update({
      subtotal_bruto: Math.round(subtotalBruto),
      gran_total: granTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ordenId)
    .select('*')
    .single();

  return { orden: updated, items: activos };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha') || new Date().toISOString().slice(0, 10);
    const cajaNombre = searchParams.get('caja') || 'Caja 1';

    const [
      { data: mesas, error: errM },
      { data: ordenes, error: errO },
      { data: productos, error: errP },
      { data: sesiones, error: errS },
      { data: salidasCaja },
      { data: alertas },
    ] = await Promise.all([
      supabase.from('pos_mesas').select('*').order('numero', { ascending: true }),
      supabase
        .from('pos_ordenes')
        .select('*')
        .or(`fecha.eq.${fecha},estado.in.(ABIERTA,PRECUENTA)`)
        .order('created_at', { ascending: false }),
      supabase
        .from('productos_venta')
        .select('id, codigo, nombre, categoria, subcategoria, precio_total, precio_neto, impoconsumo, activo')
        .eq('activo', true)
        .order('nombre', { ascending: true }),
      supabase
        .from('libro_caja_sesiones')
        .select('*')
        .eq('fecha', fecha)
        .order('numero_turno', { ascending: false }),
      supabase
        .from('libro_caja_registros')
        .select('valor_pagado, caja_nombre, responsable_caja')
        .eq('fecha', fecha)
        .eq('tipo_libro', 'CAJA_MENOR'),
      supabase
        .from('pos_auditoria_eventos')
        .select('*')
        .eq('fecha', fecha)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (errM) throw errM;
    if (errO) throw errO;
    if (errP) throw errP;
    if (errS) throw errS;

    const ordenIds = (ordenes || []).map((o: any) => o.id);
    let itemsAll: any[] = [];
    if (ordenIds.length > 0) {
      const { data: itemsRows } = await supabase
        .from('pos_orden_items')
        .select('*')
        .in('orden_id', ordenIds)
        .order('created_at', { ascending: true });
      itemsAll = itemsRows || [];
    }

    const itemsByOrden = new Map<string, any[]>();
    for (const it of itemsAll) {
      const list = itemsByOrden.get(it.orden_id);
      if (list) list.push(it);
      else itemsByOrden.set(it.orden_id, [it]);
    }

    const ordenesEnriquecidas = (ordenes || []).map((o: any) => ({
      ...o,
      items: itemsByOrden.get(o.id) || [],
    }));

    const ordenById = new Map<string, any>();
    for (const o of ordenesEnriquecidas) {
      ordenById.set(o.id, o);
    }

    const mesasEnriquecidas = (mesas || []).map((m: any) => ({
      ...m,
      orden_activa: m.orden_activa_id ? ordenById.get(m.orden_activa_id) || null : null,
    }));

    const sesionActiva =
      (sesiones || []).find(
        (s: any) => s.estado === 'ABIERTA' && (s.caja_nombre || 'Caja 1').toLowerCase() === cajaNombre.toLowerCase()
      ) || null;

    const salidasDiaCaja = (salidasCaja || [])
      .filter((r: any) => !r.caja_nombre || r.caja_nombre.toLowerCase() === cajaNombre.toLowerCase())
      .reduce((acc: number, r: any) => acc + Number(r.valor_pagado || 0), 0);

    return NextResponse.json({
      success: true,
      fecha,
      mesas: mesasEnriquecidas,
      ordenes: ordenesEnriquecidas,
      productos: productos || [],
      sesiones: sesiones || [],
      sesionActiva,
      salidasDiaCaja,
      eventosTurno: alertas || [],
    });
  } catch (err: any) {
    console.error('Error en GET /api/pos:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error consultando POS' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const todayStr = body.fecha || new Date().toISOString().slice(0, 10);
    const cajaNombre = body.caja_nombre || 'Caja 1';
    const cajeroNombre = body.cajero_nombre || 'CAJERO';

    // 1. Abrir turno de caja
    if (action === 'ABRIR_TURNO_CAJA') {
      const efectivoInicial = Number(body.efectivo_inicial || 0);
      const { data: prevSesiones } = await supabase
        .from('libro_caja_sesiones')
        .select('numero_turno')
        .eq('fecha', todayStr)
        .order('numero_turno', { ascending: false })
        .limit(1);
      const nextTurno = Number(prevSesiones?.[0]?.numero_turno || 0) + 1;

      const { data: sesion, error } = await supabase
        .from('libro_caja_sesiones')
        .insert({
          fecha: todayStr,
          caja_nombre: cajaNombre,
          cajero_nombre: cajeroNombre.toUpperCase(),
          usuario_username: String(body.usuario_username || cajeroNombre).toLowerCase(),
          efectivo_inicial: efectivoInicial,
          estado: 'ABIERTA',
          numero_turno: nextTurno,
          hora_apertura: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, sesion });
    }

    // 2. Abrir o agregar ítems a una orden (Mesa, Domicilio o Mostrador)
    if (action === 'ABRIR_O_AGREGAR_ORDEN') {
      const {
        orden_id,
        canal_venta = 'SALON_MESA',
        mesa_numero = null,
        mesero_nombre = null,
        cliente_nombre = null,
        cliente_telefono = null,
        cliente_direccion = null,
        costo_domicilio = 0,
        observaciones = null,
        items = [],
      } = body;

      let targetOrdenId = orden_id;

      if (!targetOrdenId) {
        const { count } = await supabase
          .from('pos_ordenes')
          .select('*', { count: 'exact', head: true })
          .eq('fecha', todayStr);
        const consecutivo = `POS-${todayStr.replace(/-/g, '').slice(2)}-${String((count || 0) + 1).padStart(3, '0')}`;

        const { data: nuevaOrden, error: errIns } = await supabase
          .from('pos_ordenes')
          .insert({
            consecutivo,
            fecha: todayStr,
            periodo_id: `per-${todayStr.slice(0, 7)}`,
            caja_nombre: cajaNombre,
            cajero_nombre: cajeroNombre,
            mesero_nombre,
            canal_venta,
            mesa_numero: canal_venta === 'SALON_MESA' ? mesa_numero : null,
            cliente_nombre,
            cliente_telefono,
            cliente_direccion,
            costo_domicilio: Number(costo_domicilio || 0),
            estado_domicilio: canal_venta === 'DOMICILIO' ? 'RECIBIDO' : null,
            observaciones,
            estado: 'ABIERTA',
          })
          .select('*')
          .single();

        if (errIns) throw errIns;
        targetOrdenId = nuevaOrden.id;

        if (canal_venta === 'SALON_MESA' && mesa_numero) {
          await supabase
            .from('pos_mesas')
            .update({
              estado: 'OCUPADA',
              orden_activa_id: targetOrdenId,
              mesero_actual: mesero_nombre || cajeroNombre,
              abierta_at: new Date().toISOString(),
              precuenta_impresa_count: 0,
              updated_at: new Date().toISOString(),
            })
            .eq('numero', mesa_numero);
        }
      }

      if (Array.isArray(items) && items.length > 0) {
        const rows = items.map((it: any) => {
          const cant = Number(it.cantidad || 1);
          const precio = Number(it.precio_unitario || 0);
          return {
            orden_id: targetOrdenId,
            producto_id: it.producto_id || null,
            codigo_producto: String(it.codigo_producto || '000'),
            nombre_producto: String(it.nombre_producto || 'Producto'),
            categoria: String(it.categoria || 'PLATOS'),
            estacion_comanda: inferEstacionComanda(it.categoria || '', it.nombre_producto || ''),
            cantidad: cant,
            unidad: it.unidad || 'Und',
            precio_unitario: precio,
            subtotal: Math.round(cant * precio),
            notas_comanda: it.notas_comanda || null,
            estado_comanda: 'PENDIENTE',
          };
        });
        const { error: errItems } = await supabase.from('pos_orden_items').insert(rows);
        if (errItems) throw errItems;
      }

      const recalc = await recalcularTotalesOrden(targetOrdenId);
      return NextResponse.json({ success: true, ...recalc });
    }

    // 3. Enviar Comanda a Cocina / Bar (marca ítems PENDIENTE -> COMANDADO)
    if (action === 'ENVIAR_COMANDA') {
      const { orden_id } = body;
      const { data: pendientes } = await supabase
        .from('pos_orden_items')
        .select('*')
        .eq('orden_id', orden_id)
        .eq('estado_comanda', 'PENDIENTE');

      if (pendientes && pendientes.length > 0) {
        const ids = pendientes.map((p: any) => p.id);
        await supabase
          .from('pos_orden_items')
          .update({ estado_comanda: 'COMANDADO', comandado_at: new Date().toISOString() })
          .in('id', ids);
      }

      // Si es domicilio y estaba RECIBIDO, pasarlo a EN_COCINA
      await supabase
        .from('pos_ordenes')
        .update({ estado_domicilio: 'EN_COCINA', updated_at: new Date().toISOString() })
        .eq('id', orden_id)
        .eq('canal_venta', 'DOMICILIO')
        .eq('estado_domicilio', 'RECIBIDO');

      const recalc = await recalcularTotalesOrden(orden_id);
      return NextResponse.json({
        success: true,
        comandados: pendientes || [],
        ...recalc,
      });
    }

    // 4. Imprimir Precuenta (con detección antifraude de reimpresión excesiva)
    if (action === 'IMPRIMIR_PRECUENTA') {
      const { orden_id } = body;
      const { data: ord } = await supabase
        .from('pos_ordenes')
        .select('*')
        .eq('id', orden_id)
        .single();

      if (!ord) {
        return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
      }

      const nextVeces = Number(ord.precuenta_impresa_veces || 0) + 1;
      await supabase
        .from('pos_ordenes')
        .update({
          estado: 'PRECUENTA',
          precuenta_impresa_veces: nextVeces,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orden_id);

      if (ord.mesa_numero) {
        await supabase
          .from('pos_mesas')
          .update({
            estado: 'PRECUENTA_IMPRESA',
            precuenta_impresa_count: nextVeces,
            updated_at: new Date().toISOString(),
          })
          .eq('numero', ord.mesa_numero);
      }

      if (nextVeces >= 3) {
        await supabase.from('pos_auditoria_eventos').insert({
          fecha: todayStr,
          caja_nombre: cajaNombre,
          usuario_cajero: cajeroNombre,
          tipo_alerta: 'REIMPRESION_EXCESIVA_PRECUENTA',
          nivel_riesgo: 'ALTO',
          orden_consecutivo: ord.consecutivo,
          mesa_numero: ord.mesa_numero,
          valor_afectado: Number(ord.gran_total || 0),
          descripcion: `Se imprimió la pre-cuenta ${nextVeces} veces para la orden ${ord.consecutivo}.`,
        });
      }

      const recalc = await recalcularTotalesOrden(orden_id);
      return NextResponse.json({ success: true, ...recalc });
    }

    // 5. Anular Ítem (Motor Antifraude automático)
    if (action === 'ANULAR_ITEM_ORDEN') {
      const { item_id, orden_id, motivo = 'Sin motivo especificado' } = body;
      const [{ data: item }, { data: ord }] = await Promise.all([
        supabase.from('pos_orden_items').select('*').eq('id', item_id).single(),
        supabase.from('pos_ordenes').select('*').eq('id', orden_id).single(),
      ]);

      if (!item || !ord) {
        return NextResponse.json({ success: false, error: 'Ítem u orden no encontrada' }, { status: 404 });
      }

      await supabase
        .from('pos_orden_items')
        .update({
          estado_comanda: 'ANULADO',
          anulado_por: cajeroNombre,
          motivo_anulacion: motivo,
        })
        .eq('id', item_id);

      // Si ya se había comandado o ya se había impreso precuenta -> Alerta Antifraude
      if (item.estado_comanda !== 'PENDIENTE' || Number(ord.precuenta_impresa_veces || 0) > 0) {
        const isPostPrecuenta = Number(ord.precuenta_impresa_veces || 0) > 0;
        await supabase.from('pos_auditoria_eventos').insert({
          fecha: todayStr,
          caja_nombre: cajaNombre,
          usuario_cajero: cajeroNombre,
          tipo_alerta: isPostPrecuenta ? 'ITEM_BORRADO_POST_PRECUENTA' : 'ITEM_BORRADO_POST_COMANDA',
          nivel_riesgo: isPostPrecuenta ? 'CRITICO' : 'ALTO',
          orden_consecutivo: ord.consecutivo,
          mesa_numero: ord.mesa_numero,
          valor_afectado: Number(item.subtotal || 0),
          descripcion: `${cajeroNombre} anuló "${item.nombre_producto}" ($${Number(item.subtotal || 0).toLocaleString('es-CO')}) ${isPostPrecuenta ? 'DESPUÉS de imprimir pre-cuenta' : 'después de comandar a cocina'}. Motivo: ${motivo}`,
        });
      }

      const recalc = await recalcularTotalesOrden(orden_id);
      return NextResponse.json({ success: true, ...recalc });
    }

    // 6. Actualizar estado de domicilio
    if (action === 'ACTUALIZAR_ESTADO_DOMICILIO') {
      const { orden_id, estado_domicilio, domiciliario_nombre } = body;
      const { data, error } = await supabase
        .from('pos_ordenes')
        .update({
          estado_domicilio,
          ...(domiciliario_nombre ? { domiciliario_nombre } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orden_id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, orden: data });
    }

    // 7. Facturar / Cobrar Orden (con Propina, Descuento, Pago Mixto e Impacto en Ventas + Caja)
    if (action === 'FACTURAR_ORDEN') {
      const {
        orden_id,
        propina = 0,
        descuento = 0,
        motivo_descuento = '',
        metodo_pago = 'EFECTIVO',
        pago_efectivo = 0,
        pago_datafono = 0,
        pago_transferencia = 0,
        efectivo_recibido = 0,
      } = body;

      const { data: ord } = await supabase.from('pos_ordenes').select('*').eq('id', orden_id).single();
      const { data: itemsActivos } = await supabase
        .from('pos_orden_items')
        .select('*')
        .eq('orden_id', orden_id)
        .neq('estado_comanda', 'ANULADO');

      if (!ord || !itemsActivos || itemsActivos.length === 0) {
        return NextResponse.json({ success: false, error: 'La orden no tiene platos activos para facturar.' }, { status: 400 });
      }

      const subtotalBruto = itemsActivos.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
      const descNum = Math.max(0, Number(descuento || 0));
      const propNum = Math.max(0, Number(propina || 0));
      const domNum = Math.max(0, Number(ord.costo_domicilio || 0));
      const granTotal = Math.max(0, Math.round(subtotalBruto - descNum + propNum + domNum));

      let pEf = Number(pago_efectivo || 0);
      let pDat = Number(pago_datafono || 0);
      let pTr = Number(pago_transferencia || 0);
      if (metodo_pago === 'EFECTIVO' && pEf === 0) pEf = granTotal;
      if (metodo_pago === 'DATAFONO' && pDat === 0) pDat = granTotal;
      if (metodo_pago === 'TRANSFERENCIA_NEQUI' && pTr === 0) pTr = granTotal;

      const cambio = metodo_pago === 'EFECTIVO' && Number(efectivo_recibido) > granTotal
        ? Math.round(Number(efectivo_recibido) - granTotal)
        : 0;

      const { data: facturada, error: errFac } = await supabase
        .from('pos_ordenes')
        .update({
          subtotal_bruto: Math.round(subtotalBruto),
          descuento: descNum,
          motivo_descuento: motivo_descuento || null,
          propina: propNum,
          gran_total: granTotal,
          metodo_pago,
          pago_efectivo: pEf,
          pago_datafono: pDat,
          pago_transferencia: pTr,
          efectivo_recibido: Number(efectivo_recibido || granTotal),
          cambio_entregado: cambio,
          estado: 'FACTURADA',
          ...(ord.canal_venta === 'DOMICILIO' ? { estado_domicilio: 'ENTREGADO' } : {}),
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orden_id)
        .select('*')
        .single();

      if (errFac) throw errFac;

      // Liberar mesa si aplica
      if (ord.mesa_numero) {
        await supabase
          .from('pos_mesas')
          .update({
            estado: 'LIBRE',
            orden_activa_id: null,
            mesero_actual: null,
            abierta_at: null,
            precuenta_impresa_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('numero', ord.mesa_numero);
      }

      // Auditoría si hubo descuento manual
      if (descNum > 0) {
        await supabase.from('pos_auditoria_eventos').insert({
          fecha: todayStr,
          caja_nombre: cajaNombre,
          usuario_cajero: cajeroNombre,
          tipo_alerta: 'DESCUENTO_MANUAL',
          nivel_riesgo: descNum >= 30000 ? 'ALTO' : 'MEDIO',
          orden_consecutivo: ord.consecutivo,
          mesa_numero: ord.mesa_numero,
          valor_afectado: descNum,
          descripcion: `Descuento manual de $${descNum.toLocaleString('es-CO')} en ${ord.consecutivo}. Motivo: ${motivo_descuento || 'No indicado'}`,
        });
      }

      // Impactar ventas_detalle y ventas_diarias en tiempo real (sin depender de .txt)
      const periodoId = `per-${todayStr.slice(0, 7)}`;
      const detalleInserts = itemsActivos.map((it: any) => ({
        periodo_id: periodoId,
        fecha: todayStr,
        archivo_origen: `POS-${cajaNombre}-${ord.consecutivo}`,
        codigo_producto: it.codigo_producto,
        nombre_producto: it.nombre_producto,
        categoria: it.categoria,
        unidad: it.unidad || 'Und',
        cantidad: Number(it.cantidad || 1),
        venta_bruta: Number(it.subtotal || 0),
        descuento: 0,
        venta_neta: Number(it.subtotal || 0),
        impuesto: 0,
        gran_total: Number(it.subtotal || 0),
        valor_unitario: Number(it.precio_unitario || 0),
      }));
      await supabase.from('ventas_detalle').insert(detalleInserts);

      // Upsert ventas_diarias del día acumulando las ventas facturadas en el POS
      const { data: existingVtaDia } = await supabase
        .from('ventas_diarias')
        .select('*')
        .eq('periodo_id', periodoId)
        .eq('fecha', todayStr)
        .maybeSingle();

      const totalCantOrden = itemsActivos.reduce((acc, it) => acc + Number(it.cantidad || 0), 0);
      const ventaSinPropina = Math.max(0, granTotal - propNum);
      if (existingVtaDia) {
        await supabase
          .from('ventas_diarias')
          .update({
            total_articulos: Number(existingVtaDia.total_articulos || 0) + totalCantOrden,
            venta_bruta: Number(existingVtaDia.venta_bruta || 0) + subtotalBruto,
            descuento: Number(existingVtaDia.descuento || 0) + descNum,
            venta_neta: Number(existingVtaDia.venta_neta || 0) + ventaSinPropina,
            gran_total: Number(existingVtaDia.gran_total || 0) + ventaSinPropina,
          })
          .eq('id', existingVtaDia.id);
      } else {
        const dt = new Date(`${todayStr}T12:00:00Z`);
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        await supabase.from('ventas_diarias').insert({
          periodo_id: periodoId,
          fecha: todayStr,
          archivo_origen: 'POS La Finca Tiempo Real',
          dia_semana: dias[dt.getUTCDay()],
          total_articulos: totalCantOrden,
          venta_bruta: subtotalBruto,
          descuento: descNum,
          venta_neta: ventaSinPropina,
          impuesto: 0,
          gran_total: ventaSinPropina,
          total_platos_distintos: itemsActivos.length,
          ticket_promedio: ventaSinPropina,
        });
      }
      invalidateVentasCache();

      return NextResponse.json({ success: true, orden: facturada, items: itemsActivos });
    }

    // 8. Cierre Parcial o Cierre Total con Arqueo Ciego Antifraude
    if (action === 'CIERRE_PARCIAL_TURNO' || action === 'CIERRE_TOTAL_CAJA') {
      const {
        sesion_id,
        efectivo_contado = 0,
        datafonos_contados = 0,
        transferencias_contadas = 0,
        observaciones = '',
      } = body;

      const isTotal = action === 'CIERRE_TOTAL_CAJA';

      // Sumar órdenes facturadas hoy en esa caja
      const { data: ordenesHoy } = await supabase
        .from('pos_ordenes')
        .select('pago_efectivo, pago_datafono, pago_transferencia, propina, gran_total, canal_venta')
        .eq('fecha', todayStr)
        .eq('estado', 'FACTURADA')
        .eq('caja_nombre', cajaNombre);

      const { data: sesion } = sesion_id
        ? await supabase.from('libro_caja_sesiones').select('*').eq('id', sesion_id).maybeSingle()
        : { data: null };

      const { data: salidasRows } = await supabase
        .from('libro_caja_registros')
        .select('valor_pagado')
        .eq('fecha', todayStr)
        .eq('tipo_libro', 'CAJA_MENOR');

      const totalSalidasCaja = (salidasRows || []).reduce((acc, r) => acc + Number(r.valor_pagado || 0), 0);
      const baseInicial = Number(sesion?.efectivo_inicial || 0);
      const ventasEfectivo = (ordenesHoy || []).reduce((acc, o) => acc + Number(o.pago_efectivo || 0), 0);
      const ventasDatafono = (ordenesHoy || []).reduce((acc, o) => acc + Number(o.pago_datafono || 0), 0);
      const ventasTransf = (ordenesHoy || []).reduce((acc, o) => acc + Number(o.pago_transferencia || 0), 0);
      const totalVendidoPos = (ordenesHoy || []).reduce((acc, o) => acc + Number(o.gran_total || 0), 0);

      const efectivoEsperado = Math.max(0, Math.round(baseInicial + ventasEfectivo - totalSalidasCaja));
      const diferenciaEfectivo = Math.round(Number(efectivo_contado) - efectivoEsperado);

      if (sesion?.id) {
        await supabase
          .from('libro_caja_sesiones')
          .update({
            efectivo_cierre: Number(efectivo_contado),
            valor_datafonos: Number(datafonos_contados),
            valor_otros_medios: Number(transferencias_contadas),
            venta_pos: totalVendidoPos,
            total_salidas: totalSalidasCaja,
            diferencia_cuadre: diferenciaEfectivo,
            estado: isTotal ? 'CERRADA_TOTAL' : 'CERRADA_PARCIAL',
            tipo_cierre: isTotal ? 'TOTAL' : 'PARCIAL',
            hora_cierre: new Date().toISOString(),
            observaciones: observaciones || null,
          })
          .eq('id', sesion.id);

        await recalcularHojaDiaria(todayStr, 'CAJA_MENOR');
      }

      if (Math.abs(diferenciaEfectivo) > 2000) {
        await supabase.from('pos_auditoria_eventos').insert({
          fecha: todayStr,
          caja_nombre: cajaNombre,
          usuario_cajero: cajeroNombre,
          tipo_alerta: 'DESCUADRE_ARQUEO_CIEGO',
          nivel_riesgo: Math.abs(diferenciaEfectivo) >= 20000 ? 'CRITICO' : 'ALTO',
          valor_afectado: Math.abs(diferenciaEfectivo),
          descripcion: `${isTotal ? 'Cierre Total' : 'Cierre Parcial'} con diferencia de $${diferenciaEfectivo.toLocaleString('es-CO')} (Esperado: $${efectivoEsperado.toLocaleString('es-CO')} vs Contado: $${Number(efectivo_contado).toLocaleString('es-CO')}).`,
        });
      }

      return NextResponse.json({
        success: true,
        resumenCuadre: {
          tipoCierre: isTotal ? 'TOTAL' : 'PARCIAL',
          baseInicial,
          ventasEfectivo,
          ventasDatafono,
          ventasTransf,
          totalVendidoPos,
          totalSalidasCaja,
          efectivoEsperado,
          efectivoContado: Number(efectivo_contado),
          diferenciaEfectivo,
        },
      });
    }

    // 9. Registrar apertura de cajón sin venta
    if (action === 'REGISTRAR_APERTURA_CAJON_SIN_VENTA') {
      await supabase.from('pos_auditoria_eventos').insert({
        fecha: todayStr,
        caja_nombre: cajaNombre,
        usuario_cajero: cajeroNombre,
        tipo_alerta: 'APERTURA_CAJON_SIN_VENTA',
        nivel_riesgo: 'MEDIO',
        valor_afectado: 0,
        descripcion: `Apertura manual del cajón monedero sin venta registrada en ${cajaNombre} por ${cajeroNombre}.`,
      });
      return NextResponse.json({ success: true });
    }

    // 10. Entradas (F7) y Salidas (F8) rápidas de efectivo en caja
    if (action === 'MOVIMIENTO_EFECTIVO_CAJA') {
      const { tipo, monto, concepto } = body;
      const valor = Math.max(0, Math.round(Number(monto || 0)));
      if (!valor || !concepto) {
        return NextResponse.json({ success: false, error: 'Monto y concepto son obligatorios' }, { status: 400 });
      }
      const isEntrada = tipo === 'ENTRADA';
      const periodoId = `per-${todayStr.slice(0, 7)}`;

      if (isEntrada) {
        await supabase.from('pos_auditoria_eventos').insert({
          fecha: todayStr,
          caja_nombre: cajaNombre,
          usuario_cajero: cajeroNombre,
          tipo_alerta: 'ENTRADA_EFECTIVO_CAJA',
          nivel_riesgo: 'BAJO',
          valor_afectado: valor,
          descripcion: `Entrada de efectivo (+$${valor.toLocaleString('es-CO')}) en ${cajaNombre}: ${String(concepto).trim()} (${cajeroNombre}).`,
        });
      } else {
        await supabase.from('libro_caja_registros').insert({
          fecha: todayStr,
          periodo_id: periodoId,
          tipo_libro: 'CAJA_MENOR',
          caja_nombre: cajaNombre,
          responsable_caja: cajeroNombre,
          concepto: String(concepto).trim(),
          categoria: 'Salida Rápida POS',
          valor_pagado: valor,
          metodo_pago: 'Efectivo',
        });
        await recalcularHojaDiaria(todayStr, cajaNombre).catch(() => {});
      }

      return NextResponse.json({ success: true, tipo, monto: valor });
    }

    // 11. Anular / Eliminar ticket completo abierto (y liberar mesa si aplica)
    if (action === 'ANULAR_ORDEN_COMPLETA') {
      const { orden_id, motivo } = body;
      if (!orden_id) {
        return NextResponse.json({ success: false, error: 'orden_id requerido' }, { status: 400 });
      }
      const { data: orden } = await supabase.from('pos_ordenes').select('*').eq('id', orden_id).single();
      if (!orden) {
        return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
      }

      await supabase
        .from('pos_ordenes')
        .update({ estado: 'ANULADA', updated_at: new Date().toISOString() })
        .eq('id', orden_id);

      await supabase
        .from('pos_orden_items')
        .update({ estado_comanda: 'ANULADO' })
        .eq('orden_id', orden_id);

      if (orden.canal_venta === 'SALON_MESA' && orden.mesa_numero) {
        await supabase
          .from('pos_mesas')
          .update({
            estado: 'LIBRE',
            orden_activa_id: null,
            mesero_actual: null,
            abierta_at: null,
          })
          .eq('numero', orden.mesa_numero);
      }

      await supabase.from('pos_auditoria_eventos').insert({
        fecha: todayStr,
        caja_nombre: cajaNombre,
        usuario_cajero: cajeroNombre,
        tipo_alerta: 'ANULACION_ORDEN_COMPLETA',
        nivel_riesgo: Number(orden.gran_total || 0) > 0 ? 'MEDIO' : 'BAJO',
        orden_consecutivo: orden.consecutivo,
        mesa_numero: orden.mesa_numero,
        valor_afectado: Number(orden.gran_total || 0),
        descripcion: `Ticket ${orden.consecutivo} cancelado por ${cajeroNombre}. Motivo: ${motivo || 'Cancelación en caja'}.`,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Acción POS no reconocida' }, { status: 400 });
  } catch (err: any) {
    console.error('Error en POST /api/pos:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error procesando operación POS' },
      { status: 500 }
    );
  }
}
