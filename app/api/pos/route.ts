import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { invalidateVentasCache } from '@/lib/ventasCache';
import { recalcularHojaDiaria } from '@/services/libroCajaService';
import { AUTH_COOKIE_NAME, validateAdminCredentials, verifyAuthToken } from '@/lib/authServer';
import { formatColombiaTime, getColombiaDateStr } from '@/lib/dateUtils';

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
    const fecha = searchParams.get('fecha') || getColombiaDateStr();
    const cajaNombre = searchParams.get('caja') || 'Caja 1';

    const [
      { data: mesas, error: errM },
      { data: ordenes, error: errO },
      { data: productos, error: errP },
      { data: sesiones, error: errS },
      { data: salidasCaja },
      { data: alertas },
      { data: creditosMovs },
      { data: devolucionesDia },
      { data: movimientosInventario },
      { data: diarioHoy },
      { data: operariosRows },
    ] = await Promise.all([
      supabase.from('pos_mesas').select('*').order('numero', { ascending: true }),
      supabase
        .from('pos_ordenes')
        .select('*')
        .or(`fecha.eq.${fecha},estado.in.(ABIERTA,PRECUENTA)`)
        .order('created_at', { ascending: false }),
      supabase
        .from('productos_venta')
        .select('id, codigo, nombre, categoria, subcategoria, precio_total, precio_neto, impoconsumo, activo, costo_unitario, precio_mayoreo, existencia, inv_minimo, inv_maximo')
        .eq('activo', true)
        .order('nombre', { ascending: true }),
      supabase
        .from('libro_caja_sesiones')
        .select('*')
        .eq('fecha', fecha)
        .order('numero_turno', { ascending: false }),
      supabase
        .from('libro_caja_registros')
        .select('valor_pagado, caja_nombre, responsable_caja, concepto, created_at')
        .eq('fecha', fecha)
        .eq('tipo_libro', 'CAJA_MENOR'),
      supabase
        .from('pos_auditoria_eventos')
        .select('*')
        .eq('fecha', fecha)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('pos_creditos_movimientos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('pos_devoluciones')
        .select('*')
        .eq('fecha', fecha)
        .order('created_at', { ascending: false }),
      supabase
        .from('pos_inventario_movimientos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('libro_caja_diario')
        .select('estado')
        .eq('fecha', fecha)
        .eq('tipo_libro', 'CAJA_MENOR')
        .maybeSingle(),
      supabase
        .from('libro_caja_usuarios')
        .select('id, username, nombre_cajero, cargo_area, telefono, correo, rol_sistema')
        .neq('username', 'admin')
        .eq('activo', true)
        .order('nombre_cajero', { ascending: true }),
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

    // Libro Mayor de Créditos por Cliente
    const creditosMap = new Map<string, {
      cliente_nombre: string;
      cliente_telefono: string;
      total_cargos: number;
      total_abonos: number;
      saldo: number;
      movimientos: Record<string, unknown>[];
    }>();
    for (const mov of creditosMovs || []) {
      const key = String(mov.cliente_nombre || 'Cliente General').trim();
      const entry = creditosMap.get(key) || {
        cliente_nombre: key,
        cliente_telefono: mov.cliente_telefono || '',
        total_cargos: 0,
        total_abonos: 0,
        saldo: 0,
        movimientos: [] as Record<string, unknown>[],
      };
      const mVal = Number(mov.monto || 0);
      if (mov.tipo === 'CARGO_CREDITO' || mov.tipo === 'REVERSO_ABONO') {
        entry.total_cargos += mVal;
        entry.saldo += mVal;
      } else if (mov.tipo === 'ABONO') {
        entry.total_abonos += mVal;
        entry.saldo -= mVal;
      }
      if (!entry.cliente_telefono && mov.cliente_telefono) {
        entry.cliente_telefono = mov.cliente_telefono;
      }
      entry.movimientos.push(mov);
      creditosMap.set(key, entry);
    }
    const creditosClientes = Array.from(creditosMap.values()).sort((a, b) => b.saldo - a.saldo);

    // Corte por Departamentos (solo ventas comerciales, excluyendo CONSUMO_INTERNO)
    const prodCostMap = new Map<string, number>();
    for (const p of productos || []) {
      prodCostMap.set(p.id, Number((p as any).costo_unitario || 0));
    }

    const deptoMap = new Map<string, { categoria: string; cantidad: number; total: number }>();
    const facturadasHoyAll = ordenesEnriquecidas.filter((o: any) => o.estado === 'FACTURADA' && o.fecha === fecha);
    const facturadasHoy = facturadasHoyAll.filter((o: any) => o.metodo_pago !== 'CONSUMO_INTERNO');
    const consumosInternosHoy = facturadasHoyAll.filter((o: any) => o.metodo_pago === 'CONSUMO_INTERNO');

    let gananciaEstimadaHoy = 0;
    for (const o of facturadasHoy) {
      for (const it of o.items || []) {
        if (it.estado_comanda === 'ANULADO') continue;
        const cat = it.categoria || 'General';
        const prev = deptoMap.get(cat) || { categoria: cat, cantidad: 0, total: 0 };
        const cant = Number(it.cantidad || 0);
        const sub = Number(it.subtotal || 0);
        const unitCost = it.producto_id ? (prodCostMap.get(it.producto_id) || 0) : 0;
        gananciaEstimadaHoy += Math.max(0, sub - unitCost * cant);
        prev.cantidad += cant;
        prev.total += sub;
        deptoMap.set(cat, prev);
      }
    }
    const totalDeptos = Array.from(deptoMap.values()).reduce((a, b) => a + b.total, 0);
    const corteDepartamentos = Array.from(deptoMap.values())
      .map((d) => ({
        ...d,
        porcentaje: totalDeptos > 0 ? Math.round((d.total / totalDeptos) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Abonos y entradas en efectivo del día
    const abonosEfectivoHoy = (creditosMovs || [])
      .filter((m: any) => m.fecha === fecha && m.tipo === 'ABONO' && m.metodo_pago === 'EFECTIVO')
      .reduce((acc: number, m: any) => acc + Number(m.monto || 0), 0);
    const entradasEfectivoHoy = (alertas || [])
      .filter((a: any) => a.tipo_alerta === 'ENTRADA_EFECTIVO_CAJA')
      .reduce((acc: number, a: any) => acc + Number(a.valor_afectado || 0), 0);
    const devolucionesEfectivoHoy = (devolucionesDia || [])
      .filter((d: any) => d.metodo_reembolso === 'EFECTIVO')
      .reduce((acc: number, d: any) => acc + Number(d.valor_devuelto || 0), 0);

    // Flujo cronológico de efectivo para Excel (en hora oficial Colombia)
    const flujoRaw: Array<{ ts: string; hora: string; movimiento: string; monto: number }> = [];
    if (sesionActiva) {
      const openTs = sesionActiva.hora_apertura || sesionActiva.created_at || `${fecha}T12:00:00Z`;
      flujoRaw.push({
        ts: openTs,
        hora: formatColombiaTime(openTs),
        movimiento: `Base Inicial (${cajaNombre})`,
        monto: Number(sesionActiva.base_inicial || sesionActiva.efectivo_inicial || 0),
      });
    }
    for (const o of facturadasHoy) {
      if (Number(o.pago_efectivo || 0) > 0) {
        const ts = o.closed_at || o.created_at;
        flujoRaw.push({
          ts,
          hora: formatColombiaTime(ts),
          movimiento: `Venta ${o.consecutivo}`,
          monto: Number(o.pago_efectivo),
        });
      }
    }
    for (const m of creditosMovs || []) {
      if (m.fecha === fecha && m.tipo === 'ABONO' && m.metodo_pago === 'EFECTIVO') {
        flujoRaw.push({
          ts: m.created_at,
          hora: formatColombiaTime(m.created_at),
          movimiento: `Abono Crédito (${m.cliente_nombre})`,
          monto: Number(m.monto || 0),
        });
      }
    }
    for (const a of alertas || []) {
      if (a.tipo_alerta === 'ENTRADA_EFECTIVO_CAJA') {
        flujoRaw.push({
          ts: a.created_at,
          hora: formatColombiaTime(a.created_at),
          movimiento: a.descripcion || 'Entrada de efectivo',
          monto: Number(a.valor_afectado || 0),
        });
      }
    }
    for (const s of salidasCaja || []) {
      const ts = s.created_at || `${fecha}T17:00:00Z`;
      flujoRaw.push({
        ts,
        hora: formatColombiaTime(ts),
        movimiento: `Salida: ${s.concepto || 'Libro de Caja'}`,
        monto: -Number(s.valor_pagado || 0),
      });
    }
    for (const d of devolucionesDia || []) {
      if (d.metodo_reembolso === 'EFECTIVO') {
        flujoRaw.push({
          ts: d.created_at,
          hora: formatColombiaTime(d.created_at),
          movimiento: `Devolución ${d.orden_consecutivo}: ${d.nombre_producto}`,
          monto: -Number(d.valor_devuelto || 0),
        });
      }
    }
    flujoRaw.sort((a, b) => a.ts.localeCompare(b.ts));
    let saldoCorrido = 0;
    const flujoEfectivoDetallado = flujoRaw.map((f) => {
      saldoCorrido += f.monto;
      return {
        hora: f.hora,
        movimiento: f.movimiento,
        monto: f.monto,
        efectivo_en_caja: saldoCorrido,
      };
    });

    const ultimaSesionCaja = (sesiones || []).find(
      (s: any) => (s.caja_nombre || 'Caja 1').toLowerCase() === cajaNombre.toLowerCase()
    );
    const jornadaCerradaTotal =
      !sesionActiva &&
      (diarioHoy?.estado === 'CERRADA' || ultimaSesionCaja?.estado === 'CERRADA_TOTAL');

    return NextResponse.json({
      success: true,
      fecha,
      mesas: mesasEnriquecidas,
      ordenes: ordenesEnriquecidas,
      productos: productos || [],
      sesiones: sesiones || [],
      sesionActiva,
      jornadaCerradaTotal,
      salidasDiaCaja,
      abonosEfectivoHoy,
      entradasEfectivoHoy,
      devolucionesEfectivoHoy,
      eventosTurno: alertas || [],
      creditosClientes,
      devolucionesDia: devolucionesDia || [],
      corteDepartamentos,
      flujoEfectivoDetallado,
      consumosInternosHoy,
      gananciaEstimadaHoy: Math.round(gananciaEstimadaHoy),
      movimientosInventario: movimientosInventario || [],
      operarios: operariosRows || [],
    });
  } catch (err: any) {
    console.error('Error en GET /api/pos:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error consultando POS' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const todayStr = body.fecha || getColombiaDateStr();
    const cajaNombre = body.caja_nombre || 'Caja 1';
    const cajeroNombre = body.cajero_nombre || 'CAJERO';

    // 1. Abrir turno de caja (con validación estricta de doble nivel + Bloqueo tras Cierre Total)
    if (action === 'ABRIR_TURNO_CAJA') {
      const efectivoInicial = Number(body.efectivo_inicial ?? body.base_inicial ?? 0);
      const rawUser = String(body.username || body.usuario_username || '').trim();
      const rawPass = String(body.password || body.password_pin || '').trim();

      if (!rawUser || !rawPass) {
        return NextResponse.json(
          { success: false, error: 'Debes ingresar usuario y contraseña POS para abrir turno.' },
          { status: 400 }
        );
      }

      // Verificar sesión principal firmada del equipo (doble nivel estricto)
      const mainToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      const mainSession = await verifyAuthToken(mainToken);

      // Verificar si la jornada de hoy ya tuvo Cierre Total (Corte Z)
      const [{ data: prevSesiones }, { data: diarioHoy }] = await Promise.all([
        supabase
          .from('libro_caja_sesiones')
          .select('*')
          .eq('fecha', todayStr)
          .order('numero_turno', { ascending: false }),
        supabase
          .from('libro_caja_diario')
          .select('estado')
          .eq('fecha', todayStr)
          .eq('tipo_libro', 'CAJA_MENOR')
          .maybeSingle(),
      ]);

      const sesionesCaja = (prevSesiones || []).filter(
        (s: any) => (s.caja_nombre || 'Caja 1').toLowerCase() === cajaNombre.toLowerCase()
      );
      const abiertaActual = sesionesCaja.find((s: any) => s.estado === 'ABIERTA');
      if (abiertaActual) {
        return NextResponse.json({ success: true, sesion: abiertaActual });
      }
      const ultimaCaja = sesionesCaja[0];
      if (diarioHoy?.estado === 'CERRADA' || ultimaCaja?.estado === 'CERRADA_TOTAL') {
        return NextResponse.json(
          {
            success: false,
            error:
              'La caja ya realizó su Cierre Total del Día (Corte Z) hoy. Para abrir un nuevo turno hoy, un Administrador debe autorizar "Reabrir (Admin)" en Libro de Caja.',
          },
          { status: 403 }
        );
      }

      let resolvedCajeroNombre = '';
      let resolvedUsername = '';

      const { data: dbCandidates } = await supabase
        .from('libro_caja_usuarios')
        .select('*')
        .ilike('username', rawUser)
        .eq('activo', true)
        .limit(1);

      const cajaUser = dbCandidates?.[0];
      if (cajaUser) {
        const expectedPosPass = String(cajaUser.pos_pin || cajaUser.password_pin || '').trim();
        if (expectedPosPass && expectedPosPass === rawPass) {
          resolvedCajeroNombre = cajaUser.nombre_cajero || cajaUser.nombre_completo || cajaUser.username;
          resolvedUsername = String(cajaUser.username).trim().toLowerCase();
        }
      }

      if (!resolvedUsername) {
        const adminValid = validateAdminCredentials(rawUser, rawPass);
        if (!adminValid) {
          return NextResponse.json(
            { success: false, error: 'Usuario o contraseña POS incorrectos para abrir turno.' },
            { status: 401 }
          );
        }
        resolvedCajeroNombre = adminValid.name;
        resolvedUsername = adminValid.username.toLowerCase();
      }

      // REGLA ESTRICTA DE DOBLE NIVEL: las credenciales POS deben pertenecer al usuario de la sesión principal
      if (mainSession && mainSession.username.toLowerCase() !== resolvedUsername.toLowerCase()) {
        return NextResponse.json(
          {
            success: false,
            code: 'SESSION_USER_MISMATCH',
            error: `Sesión principal incorrecta: las credenciales POS corresponden a "${resolvedUsername}", pero este equipo tiene iniciada la sesión principal de "${mainSession.username}". Cierra la sesión principal, ingresa con tu usuario y luego abre tu turno en POS.`,
          },
          { status: 403 }
        );
      }

      const nextTurno = Number(prevSesiones?.[0]?.numero_turno || 0) + 1;

      const { data: sesion, error } = await supabase
        .from('libro_caja_sesiones')
        .insert({
          fecha: todayStr,
          caja_nombre: cajaNombre,
          cajero_nombre: resolvedCajeroNombre.toUpperCase(),
          usuario_username: resolvedUsername,
          efectivo_inicial: efectivoInicial,
          estado: 'ABIERTA',
          numero_turno: nextTurno,
          hora_apertura: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;
      await recalcularHojaDiaria(todayStr, 'CAJA_MENOR').catch(() => {});
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
        pago_credito = 0,
        comision_tarjeta = 0,
        efectivo_recibido = 0,
        cliente_nombre = '',
        cliente_telefono = '',
      } = body;

      const { data: ord } = await supabase.from('pos_ordenes').select('*').eq('id', orden_id).single();
      const { data: itemsActivos } = await supabase
        .from('pos_orden_items')
        .select('*')
        .eq('orden_id', orden_id)
        .neq('estado_comanda', 'ANULADO');

      if (!ord || !itemsActivos || itemsActivos.length === 0) {
        return NextResponse.json({ success: false, error: 'La orden no tiene artículos activos para facturar.' }, { status: 400 });
      }

      const subtotalBruto = itemsActivos.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
      const descNum = Math.max(0, Number(descuento || 0));
      const propNum = Math.max(0, Number(propina || 0));
      const domNum = Math.max(0, Number(ord.costo_domicilio || 0));
      const granTotal = Math.max(0, Math.round(subtotalBruto - descNum + propNum + domNum));

      const isConsumoInterno = metodo_pago === 'CONSUMO_INTERNO';
      const areaConsumo = String(body.area_consumo || 'Personal / Interno').trim();

      let pEf = isConsumoInterno ? 0 : Number(pago_efectivo || 0);
      let pDat = isConsumoInterno ? 0 : Number(pago_datafono || 0);
      let pTr = isConsumoInterno ? 0 : Number(pago_transferencia || 0);
      let pCred = isConsumoInterno ? 0 : Number(pago_credito || 0);
      if (!isConsumoInterno) {
        if (metodo_pago === 'EFECTIVO' && pEf === 0) pEf = granTotal;
        if (metodo_pago === 'DATAFONO' && pDat === 0) pDat = granTotal;
        if ((metodo_pago === 'TRANSFERENCIA' || metodo_pago === 'TRANSFERENCIA_NEQUI') && pTr === 0) pTr = granTotal;
        if (metodo_pago === 'CREDITO' && pCred === 0) pCred = granTotal;
      }

      const finalClienteNombre = (cliente_nombre || ord.cliente_nombre || '').trim();
      if ((pCred > 0 || isConsumoInterno) && !finalClienteNombre) {
        return NextResponse.json(
          {
            success: false,
            error: isConsumoInterno
              ? 'Debes indicar el nombre de la persona o área para el consumo interno.'
              : 'Debes indicar el nombre del cliente para ventas a crédito.',
          },
          { status: 400 }
        );
      }

      const cambio =
        !isConsumoInterno && metodo_pago === 'EFECTIVO' && Number(efectivo_recibido) > granTotal
          ? Math.round(Number(efectivo_recibido) - granTotal)
          : 0;

      const nowIso = new Date().toISOString();
      const { data: facturada, error: errFac } = await supabase
        .from('pos_ordenes')
        .update({
          subtotal_bruto: Math.round(subtotalBruto),
          descuento: descNum,
          motivo_descuento: motivo_descuento || null,
          propina: isConsumoInterno ? 0 : propNum,
          gran_total: granTotal,
          metodo_pago,
          pago_efectivo: pEf,
          pago_datafono: pDat,
          pago_transferencia: pTr,
          pago_credito: pCred,
          comision_tarjeta: isConsumoInterno ? 0 : Number(comision_tarjeta || 0),
          pagado_at: isConsumoInterno || (pCred > 0 && pEf === 0 && pDat === 0 && pTr === 0) ? null : nowIso,
          cliente_nombre: finalClienteNombre || ord.cliente_nombre || null,
          cliente_telefono: (cliente_telefono || ord.cliente_telefono || '').trim() || null,
          observaciones: isConsumoInterno ? `CONSUMO INTERNO (${areaConsumo})` : ord.observaciones || null,
          efectivo_recibido: isConsumoInterno ? 0 : Number(efectivo_recibido || granTotal),
          cambio_entregado: cambio,
          estado: 'FACTURADA',
          ...(ord.canal_venta === 'DOMICILIO' ? { estado_domicilio: 'ENTREGADO' } : {}),
          closed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', orden_id)
        .select('*')
        .single();

      if (errFac) throw errFac;

      // Registrar cargo en Libro Mayor de Créditos si aplica
      if (pCred > 0) {
        await supabase.from('pos_creditos_movimientos').insert({
          fecha: todayStr,
          cliente_nombre: finalClienteNombre,
          cliente_telefono: (cliente_telefono || ord.cliente_telefono || '').trim() || null,
          tipo: 'CARGO_CREDITO',
          orden_id: ord.id,
          orden_consecutivo: ord.consecutivo,
          monto: pCred,
          metodo_pago: 'CREDITO',
          caja_nombre: cajaNombre,
          cajero_nombre: cajeroNombre,
          observaciones: `Factura ${ord.consecutivo} cargada a crédito`,
        });
      }

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

      // Descontar existencia en productos_venta y registrar movimiento
      for (const it of itemsActivos) {
        if (!it.producto_id) continue;
        const { data: prodRow } = await supabase
          .from('productos_venta')
          .select('existencia')
          .eq('id', it.producto_id)
          .maybeSingle();
        if (prodRow) {
          const ant = Number(prodRow.existencia || 0);
          const cant = Number(it.cantidad || 1);
          const nueva = Math.max(0, ant - cant);
          await supabase.from('productos_venta').update({ existencia: nueva }).eq('id', it.producto_id);
          await supabase.from('pos_inventario_movimientos').insert({
            fecha: todayStr,
            producto_id: it.producto_id,
            codigo_producto: it.codigo_producto,
            nombre_producto: it.nombre_producto,
            tipo: 'VENTA',
            cantidad_delta: -cant,
            existencia_anterior: ant,
            existencia_nueva: nueva,
            motivo: isConsumoInterno ? `Consumo Interno (${finalClienteNombre})` : `Venta ${ord.consecutivo}`,
            usuario: cajeroNombre,
          });
        }
      }

      if (isConsumoInterno) {
        // Consumo interno: NO suma a ventas_diarias ni al cuadre de caja; sí registra en consumos + bitácora
        await supabase.from('pos_auditoria_eventos').insert({
          fecha: todayStr,
          caja_nombre: cajaNombre,
          usuario_cajero: cajeroNombre,
          tipo_alerta: 'CONSUMO_INTERNO_REGISTRADO',
          nivel_riesgo: 'BAJO',
          orden_consecutivo: ord.consecutivo,
          mesa_numero: ord.mesa_numero,
          valor_afectado: granTotal,
          descripcion: `Consumo Interno valorizado en $${granTotal.toLocaleString('es-CO')} asignado a ${finalClienteNombre} (${areaConsumo}). Cobrado en caja: $0.`,
        });
        const consumoInserts = itemsActivos.map((it: any) => ({
          fecha: todayStr,
          tipo: 'CONSUMO',
          nombre_insumo: it.nombre_producto,
          categoria: it.categoria || 'Consumo Interno',
          cantidad: Number(it.cantidad || 1),
          unidad: it.unidad || 'Und',
          costo_unitario: Number(it.precio_unitario || 0),
          valor_total: Number(it.subtotal || 0),
          observaciones: `Consumo POS (${ord.consecutivo}) • ${finalClienteNombre} (${areaConsumo})`,
        }));
        await supabase.from('registros_costeo_cocina').insert(consumoInserts);
        return NextResponse.json({ success: true, orden: facturada, items: itemsActivos });
      }

      // Impactar ventas_detalle y ventas_diarias en tiempo real (solo ventas comerciales)
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
      await recalcularHojaDiaria(todayStr, 'CAJA_MENOR').catch(() => {});

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

      const [{ data: salidasRows }, { data: abonosEfRows }, { data: devEfRows }, { data: entradasEfRows }] = await Promise.all([
        supabase.from('libro_caja_registros').select('valor_pagado').eq('fecha', todayStr).eq('tipo_libro', 'CAJA_MENOR'),
        supabase.from('pos_creditos_movimientos').select('monto').eq('fecha', todayStr).eq('tipo', 'ABONO').eq('metodo_pago', 'EFECTIVO'),
        supabase.from('pos_devoluciones').select('valor_devuelto').eq('fecha', todayStr).eq('metodo_reembolso', 'EFECTIVO'),
        supabase.from('pos_auditoria_eventos').select('valor_afectado').eq('fecha', todayStr).eq('tipo_alerta', 'ENTRADA_EFECTIVO_CAJA'),
      ]);

      const totalSalidasCaja = (salidasRows || []).reduce((acc, r) => acc + Number(r.valor_pagado || 0), 0);
      const totalAbonosEfectivo = (abonosEfRows || []).reduce((acc, r) => acc + Number(r.monto || 0), 0);
      const totalDevolucionesEfectivo = (devEfRows || []).reduce((acc, r) => acc + Number(r.valor_devuelto || 0), 0);
      const totalEntradasEfectivo = (entradasEfRows || []).reduce((acc, r) => acc + Number(r.valor_afectado || 0), 0);

      const baseInicial = Number(sesion?.efectivo_inicial || 0);
      const ventasEfectivo = (ordenesHoy || []).reduce((acc, o) => acc + Number(o.pago_efectivo || 0), 0);
      const ventasDatafono = (ordenesHoy || []).reduce((acc, o) => acc + Number(o.pago_datafono || 0), 0);
      const ventasTransf = (ordenesHoy || []).reduce((acc, o) => acc + Number(o.pago_transferencia || 0), 0);
      const totalVendidoPos = (ordenesHoy || []).reduce((acc, o) => acc + Number(o.gran_total || 0), 0);

      const efectivoEsperado = Math.max(
        0,
        Math.round(
          baseInicial +
            ventasEfectivo +
            totalAbonosEfectivo +
            totalEntradasEfectivo -
            totalSalidasCaja -
            totalDevolucionesEfectivo
        )
      );
      const diferenciaEfectivo = Math.round(Number(efectivo_contado) - efectivoEsperado);

      const nowCierreIso = new Date().toISOString();
      const duracionMinutos = sesion?.hora_apertura
        ? Math.max(0, Math.round((new Date(nowCierreIso).getTime() - new Date(sesion.hora_apertura).getTime()) / 60000))
        : 0;

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
            hora_cierre: nowCierreIso,
            duracion_minutos: duracionMinutos,
            observaciones: observaciones || null,
          })
          .eq('id', sesion.id);
      }

      // Asegurar que no queden otras sesiones ABIERTA en la misma caja hoy
      await supabase
        .from('libro_caja_sesiones')
        .update({
          estado: isTotal ? 'CERRADA_TOTAL' : 'CERRADA_PARCIAL',
          tipo_cierre: isTotal ? 'TOTAL' : 'PARCIAL',
          hora_cierre: nowCierreIso,
          duracion_minutos: duracionMinutos,
        })
        .eq('fecha', todayStr)
        .eq('caja_nombre', cajaNombre)
        .eq('estado', 'ABIERTA');

      await recalcularHojaDiaria(todayStr, 'CAJA_MENOR');

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

      const resumenObj = {
        tipoCierre: isTotal ? 'TOTAL' : 'PARCIAL',
        baseInicial,
        ventasEfectivo,
        ventasDatafono,
        ventasTransf,
        totalAbonosEfectivo,
        totalEntradasEfectivo,
        totalDevolucionesEfectivo,
        totalVendidoPos,
        totalSalidasCaja,
        efectivoEsperado,
        efectivoContado: Number(efectivo_contado),
        diferenciaEfectivo,
      };

      return NextResponse.json({
        success: true,
        resumen: resumenObj,
        resumenCuadre: resumenObj,
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
          clasificacion: body.clasificacion || 'Gasto Operativo',
          concepto: String(concepto).trim(),
          categoria: body.categoria || 'Salida Rápida POS',
          descripcion_beneficiario: body.descripcion_beneficiario || '',
          valor_pagado: valor,
          metodo_pago: 'Efectivo',
          sesion_id: body.sesion_id || null,
        });
        await recalcularHojaDiaria(todayStr, 'CAJA_MENOR').catch(() => {});
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

    // 12. Registrar Abono a Crédito de Cliente (Libro Mayor)
    if (action === 'REGISTRAR_ABONO_CREDITO') {
      const { cliente_nombre, cliente_telefono = '', monto, metodo_pago = 'EFECTIVO', observaciones = '' } = body;
      const valor = Math.max(0, Math.round(Number(monto || 0)));
      if (!cliente_nombre || valor <= 0) {
        return NextResponse.json({ success: false, error: 'Cliente y monto mayor a cero son obligatorios' }, { status: 400 });
      }
      const { data: abono, error: errAb } = await supabase
        .from('pos_creditos_movimientos')
        .insert({
          fecha: todayStr,
          cliente_nombre: String(cliente_nombre).trim(),
          cliente_telefono: String(cliente_telefono || '').trim() || null,
          tipo: 'ABONO',
          monto: valor,
          metodo_pago,
          caja_nombre: cajaNombre,
          cajero_nombre: cajeroNombre,
          observaciones: observaciones || `Abono en ${metodo_pago}`,
        })
        .select('*')
        .single();
      if (errAb) throw errAb;
      return NextResponse.json({ success: true, abono });
    }

    // 13. Devolución Post-Factura (descuenta del método de reembolso y ventas del día)
    if (action === 'DEVOLVER_ITEM_FACTURADO') {
      const { orden_id, item_id, cantidad_devuelta = 1, metodo_reembolso = 'EFECTIVO', motivo = '' } = body;
      if (!orden_id || !item_id) {
        return NextResponse.json({ success: false, error: 'orden_id e item_id son requeridos' }, { status: 400 });
      }
      const [{ data: ord }, { data: item }] = await Promise.all([
        supabase.from('pos_ordenes').select('*').eq('id', orden_id).single(),
        supabase.from('pos_orden_items').select('*').eq('id', item_id).single(),
      ]);
      if (!ord || !item) {
        return NextResponse.json({ success: false, error: 'Factura o artículo no encontrado' }, { status: 404 });
      }
      const cantDev = Math.min(Number(item.cantidad || 1), Math.max(0.01, Number(cantidad_devuelta || 1)));
      const valorDev = Math.round(cantDev * Number(item.precio_unitario || 0));

      const { data: devRow, error: errDev } = await supabase
        .from('pos_devoluciones')
        .insert({
          fecha: todayStr,
          orden_id: ord.id,
          orden_consecutivo: ord.consecutivo,
          item_id: item.id,
          nombre_producto: item.nombre_producto,
          cantidad_devuelta: cantDev,
          valor_devuelto: valorDev,
          metodo_reembolso,
          motivo: motivo || 'Devolución en caja',
          caja_nombre: cajaNombre,
          cajero_nombre: cajeroNombre,
        })
        .select('*')
        .single();
      if (errDev) throw errDev;

      if (metodo_reembolso === 'CREDITO' && ord.cliente_nombre) {
        await supabase.from('pos_creditos_movimientos').insert({
          fecha: todayStr,
          cliente_nombre: ord.cliente_nombre,
          cliente_telefono: ord.cliente_telefono || null,
          tipo: 'ABONO',
          orden_id: ord.id,
          orden_consecutivo: ord.consecutivo,
          monto: valorDev,
          metodo_pago: 'CREDITO',
          caja_nombre: cajaNombre,
          cajero_nombre: cajeroNombre,
          observaciones: `Nota crédito por devolución de ${cantDev}x ${item.nombre_producto}`,
        });
      }

      // Descontar de ventas_diarias si existe registro del día
      const periodoId = `per-${todayStr.slice(0, 7)}`;
      const { data: vtaDia } = await supabase
        .from('ventas_diarias')
        .select('*')
        .eq('periodo_id', periodoId)
        .eq('fecha', todayStr)
        .maybeSingle();
      if (vtaDia) {
        await supabase
          .from('ventas_diarias')
          .update({
            venta_neta: Math.max(0, Number(vtaDia.venta_neta || 0) - valorDev),
            gran_total: Math.max(0, Number(vtaDia.gran_total || 0) - valorDev),
          })
          .eq('id', vtaDia.id);
        invalidateVentasCache();
      }

      return NextResponse.json({ success: true, devolucion: devRow });
    }

    // 14. Actualizar Cantidad / Precio Especial / Mayoreo (F11) sobre ítem abierto
    if (action === 'ACTUALIZAR_ITEM_PRECIO_CANTIDAD') {
      const { orden_id, item_id, cantidad, precio_unitario, notas_comanda } = body;
      if (!orden_id || !item_id) {
        return NextResponse.json({ success: false, error: 'orden_id e item_id son requeridos' }, { status: 400 });
      }
      const cantNum = Math.max(0.01, Number(cantidad || 1));
      const precioNum = Math.max(0, Math.round(Number(precio_unitario || 0)));
      const subtotal = Math.round(cantNum * precioNum);

      const { error: errUpd } = await supabase
        .from('pos_orden_items')
        .update({
          cantidad: cantNum,
          precio_unitario: precioNum,
          subtotal,
          ...(notas_comanda !== undefined ? { notas_comanda } : {}),
        })
        .eq('id', item_id);
      if (errUpd) throw errUpd;

      const updated = await recalcularTotalesOrden(orden_id);
      return NextResponse.json({ success: true, ...(updated || {}) });
    }

    // 15. Asignar Cliente / Personal a una orden abierta
    if (action === 'ASIGNAR_CLIENTE_ORDEN') {
      const { orden_id, cliente_nombre = '', cliente_telefono = '', observaciones = null } = body;
      if (!orden_id) {
        return NextResponse.json({ success: false, error: 'orden_id requerido' }, { status: 400 });
      }
      const { data: orden, error } = await supabase
        .from('pos_ordenes')
        .update({
          cliente_nombre: String(cliente_nombre || '').trim() || null,
          cliente_telefono: String(cliente_telefono || '').trim() || null,
          ...(observaciones !== null ? { observaciones } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orden_id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, orden });
    }

    // 15B. Asignar Mesero / Personal Operativo a una orden (para propinas y trazabilidad)
    if (action === 'ASIGNAR_MESERO_ORDEN') {
      const { orden_id, mesero_nombre = '' } = body;
      if (!orden_id) {
        return NextResponse.json({ success: false, error: 'orden_id requerido' }, { status: 400 });
      }
      const cleanMesero = String(mesero_nombre || '').trim() || null;
      const { data: orden, error } = await supabase
        .from('pos_ordenes')
        .update({
          mesero_nombre: cleanMesero,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orden_id)
        .select('*')
        .single();
      if (error) throw error;
      if (orden?.mesa_numero) {
        await supabase
          .from('pos_mesas')
          .update({ mesero_actual: cleanMesero })
          .eq('numero', orden.mesa_numero);
      }
      return NextResponse.json({ success: true, orden });
    }

    // 15C. Actualizar nota / solicitud para cocina de un ítem
    if (action === 'ACTUALIZAR_NOTA_ITEM') {
      const { item_id, notas_comanda = '' } = body;
      if (!item_id) {
        return NextResponse.json({ success: false, error: 'item_id requerido' }, { status: 400 });
      }
      const { error } = await supabase
        .from('pos_orden_items')
        .update({ notas_comanda: String(notas_comanda || '').trim() || null })
        .eq('id', item_id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 15D. Devolución completa de un ticket facturado
    if (action === 'DEVOLVER_TICKET_COMPLETO') {
      const { orden_id, metodo_reembolso = 'EFECTIVO', motivo = 'Devolución completa de ticket' } = body;
      if (!orden_id) {
        return NextResponse.json({ success: false, error: 'orden_id requerido' }, { status: 400 });
      }
      const [{ data: ord }, { data: items }] = await Promise.all([
        supabase.from('pos_ordenes').select('*').eq('id', orden_id).single(),
        supabase.from('pos_orden_items').select('*').eq('orden_id', orden_id).neq('estado_comanda', 'ANULADO'),
      ]);
      if (!ord) {
        return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
      }
      const activos = items || [];
      let totalDevuelto = 0;
      for (const it of activos) {
        const cant = Number(it.cantidad || 1);
        const val = Math.round(cant * Number(it.precio_unitario || 0));
        totalDevuelto += val;
        await supabase.from('pos_devoluciones').insert({
          fecha: todayStr,
          orden_id: ord.id,
          orden_consecutivo: ord.consecutivo,
          item_id: it.id,
          nombre_producto: it.nombre_producto,
          cantidad_devuelta: cant,
          valor_devuelto: val,
          metodo_reembolso,
          motivo,
          caja_nombre: cajaNombre,
          cajero_nombre: cajeroNombre,
        });
      }
      if (metodo_reembolso === 'CREDITO' && ord.cliente_nombre && totalDevuelto > 0) {
        await supabase.from('pos_creditos_movimientos').insert({
          fecha: todayStr,
          cliente_nombre: ord.cliente_nombre,
          cliente_telefono: ord.cliente_telefono || null,
          tipo: 'ABONO',
          orden_id: ord.id,
          orden_consecutivo: ord.consecutivo,
          monto: totalDevuelto,
          metodo_pago: 'CREDITO',
          caja_nombre: cajaNombre,
          cajero_nombre: cajeroNombre,
          observaciones: `Nota crédito por devolución completa de ${ord.consecutivo}`,
        });
      }
      if (totalDevuelto > 0) {
        const periodoId = `per-${todayStr.slice(0, 7)}`;
        const { data: vtaDia } = await supabase
          .from('ventas_diarias')
          .select('*')
          .eq('periodo_id', periodoId)
          .eq('fecha', todayStr)
          .maybeSingle();
        if (vtaDia) {
          await supabase
            .from('ventas_diarias')
            .update({
              venta_neta: Math.max(0, Number(vtaDia.venta_neta || 0) - totalDevuelto),
              gran_total: Math.max(0, Number(vtaDia.gran_total || 0) - totalDevuelto),
            })
            .eq('id', vtaDia.id);
          invalidateVentasCache();
        }
      }
      await recalcularHojaDiaria(todayStr, 'CAJA_MENOR').catch(() => {});
      return NextResponse.json({ success: true, totalDevuelto });
    }

    // 16. CRUD Productos desde F3 Productos del POS
    if (action === 'GUARDAR_PRODUCTO_POS') {
      const {
        id,
        codigo,
        nombre,
        categoria = 'General',
        costo_unitario = 0,
        precio_total = 0,
        precio_mayoreo = 0,
        existencia = 0,
        inv_minimo = 0,
        inv_maximo = 0,
      } = body;
      if (!nombre || Number(precio_total) < 0) {
        return NextResponse.json({ success: false, error: 'Nombre y precio de venta son obligatorios' }, { status: 400 });
      }
      const payload = {
        codigo: String(codigo || `P-${Date.now().toString().slice(-4)}`).trim(),
        nombre: String(nombre).trim(),
        categoria: String(categoria).trim() || 'General',
        costo_unitario: Number(costo_unitario || 0),
        precio_total: Number(precio_total || 0),
        precio_neto: Math.round(Number(precio_total || 0) / 1.08),
        precio_mayoreo: Number(precio_mayoreo || 0),
        existencia: Number(existencia || 0),
        inv_minimo: Number(inv_minimo || 0),
        inv_maximo: Number(inv_maximo || 0),
        activo: true,
      };
      const { data, error } = id
        ? await supabase.from('productos_venta').update(payload).eq('id', id).select('*').single()
        : await supabase.from('productos_venta').insert(payload).select('*').single();
      if (error) throw error;
      return NextResponse.json({ success: true, producto: data });
    }

    if (action === 'ELIMINAR_PRODUCTO_POS') {
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: 'id requerido' }, { status: 400 });
      const { error } = await supabase.from('productos_venta').update({ activo: false }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 17. Entradas y Ajustes de Inventario desde F4 Inventario
    if (action === 'AJUSTAR_INVENTARIO_POS') {
      const { producto_id, tipo = 'ENTRADA', cantidad = 0, motivo = '' } = body;
      if (!producto_id) {
        return NextResponse.json({ success: false, error: 'producto_id requerido' }, { status: 400 });
      }
      const { data: prod } = await supabase
        .from('productos_venta')
        .select('id, codigo, nombre, existencia')
        .eq('id', producto_id)
        .single();
      if (!prod) {
        return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 });
      }
      const ant = Number(prod.existencia || 0);
      const cantNum = Number(cantidad || 0);
      const nueva = tipo === 'AJUSTE' ? Math.max(0, cantNum) : Math.max(0, ant + cantNum);
      const delta = nueva - ant;

      await supabase.from('productos_venta').update({ existencia: nueva }).eq('id', prod.id);
      const { data: mov, error: errM } = await supabase
        .from('pos_inventario_movimientos')
        .insert({
          fecha: todayStr,
          producto_id: prod.id,
          codigo_producto: prod.codigo,
          nombre_producto: prod.nombre,
          tipo: tipo === 'AJUSTE' ? 'AJUSTE' : 'ENTRADA',
          cantidad_delta: delta,
          existencia_anterior: ant,
          existencia_nueva: nueva,
          motivo: motivo || (tipo === 'AJUSTE' ? 'Ajuste físico de inventario' : 'Entrada rápida en POS'),
          usuario: cajeroNombre,
        })
        .select('*')
        .single();
      if (errM) throw errM;
      return NextResponse.json({ success: true, movimiento: mov, existencia_nueva: nueva });
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
