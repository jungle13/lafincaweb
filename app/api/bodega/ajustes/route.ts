import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Listar ajustes de inventario registrados (opcionalmente filtrados por rango de fechas del periodo)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get('fechaInicio') || searchParams.get('fecha_inicio');
    const fechaFin = searchParams.get('fechaFin') || searchParams.get('fecha_fin');

    let query = supabase
      .from('movimientos_inventario')
      .select('*, catalogo_insumos(nombre, categoria, costo_unitario_kg, peso_estandar_porcion_kg)')
      .eq('tipo_movimiento', 'AJUSTE_INVENTARIO')
      .order('fecha', { ascending: false })
      .order('fecha_hora', { ascending: false });

    if (fechaInicio) {
      query = query.gte('fecha', fechaInicio);
    }
    if (fechaFin) {
      query = query.lte('fecha', fechaFin);
    }

    const { data: rawMovs, error } = await query;

    if (error) throw error;

    const formatted = (rawMovs || []).map((m: any) => {
      const obs = m.observaciones || '';
      let tipoAjuste = 'AJUSTE_MANUAL';
      let justificacion = obs;
      let ubicacion = m.destino || m.origen || 'BODEGA_PORCIONADO';

      if (obs.includes('[AJUSTE:')) {
        const matchTipo = obs.match(/\[AJUSTE:\s*([^\]]+)\]/i);
        if (matchTipo) tipoAjuste = matchTipo[1].trim();
      }

      if (obs.includes('Ubicación:')) {
        const matchUbi = obs.match(/Ubicación:\s*([^|]+)/i);
        if (matchUbi) ubicacion = matchUbi[1].trim();
      }

      if (obs.includes('Motivo:')) {
        const matchMot = obs.match(/Motivo:\s*(.+)$/i);
        if (matchMot) justificacion = matchMot[1].trim();
      }

      const isEntrada = m.origen === 'AJUSTE_ENTRADA' || (!m.origen?.includes('MERMA') && (m.cant_sin_porcionar_kg > 0 || m.porciones_und > 0));
      const cantKg = parseFloat(m.cant_sin_porcionar_kg) || 0;
      const cantUnd = parseInt(m.porciones_und) || 0;
      const pesoPorcKg = parseFloat(m.peso_porciones_kg) || 0;
      const costoUnit = parseFloat(m.costo_unitario_kg) || m.catalogo_insumos?.costo_unitario_kg || 0;
      const valorTotal = parseFloat(m.valor_total_movimiento) || (cantKg > 0 ? cantKg * costoUnit : pesoPorcKg * costoUnit);

      return {
        id: m.id,
        fecha: m.fecha || (m.fecha_hora ? m.fecha_hora.split('T')[0] : ''),
        fechaHora: m.fecha_hora || m.created_at,
        insumoId: m.insumo_id,
        insumoNombre: m.catalogo_insumos?.nombre || 'Insumo Desconocido',
        categoria: m.catalogo_insumos?.categoria || 'GENERAL',
        origen: m.origen,
        destino: m.destino,
        ubicacion: ubicacion,
        tipoAjuste: tipoAjuste,
        isEntrada: isEntrada,
        cantidadKg: cantKg,
        porcionesUnd: cantUnd,
        pesoPorcionesKg: pesoPorcKg,
        mermaKg: parseFloat(m.merma_kg) || 0,
        costoUnitarioKg: costoUnit,
        valorTotal: valorTotal,
        justificacion: justificacion,
        observaciones: obs,
        usuario: m.usuario || 'Administrador',
        saldoAnteriorBodegaKg: parseFloat(m.bodega_sin_porc_anterior_kg) || 0,
        saldoNuevoBodegaKg: parseFloat(m.bodega_sin_porc_nuevo_kg) || 0,
        saldoAnteriorPorcUnd: parseInt(m.bodega_porc_und_anterior) || 0,
        saldoNuevoPorcUnd: parseInt(m.bodega_porc_und_nuevo) || 0,
        saldoAnteriorCocinaUnd: parseInt(m.cocina_porc_und_anterior) || 0,
        saldoNuevoCocinaUnd: parseInt(m.cocina_porc_und_nuevo) || 0,
      };
    });

    return NextResponse.json(
      { success: true, count: formatted.length, data: formatted },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Crear ajuste manual o auto-ajustar en lote inconsistencias de un día
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = 'AJUSTAR_MANUAL' } = body;

    // 🛠️ ACCIÓN: AUTO_AJUSTAR_FECHA (Genera todos los ajustes necesarios para conciliar y poder aprobar un día)
    if (action === 'AUTO_AJUSTAR_FECHA') {
      const { fecha, usuario = 'Administrador' } = body;
      if (!fecha) {
        return NextResponse.json({ error: 'Falta parámetro fecha' }, { status: 400 });
      }

      // 1. Obtener movimientos pendientes de la fecha
      const { data: dayMovs, error: fetchErr } = await supabase
        .from('movimientos_inventario')
        .select('*, catalogo_insumos(nombre, categoria, costo_unitario_kg, peso_estandar_porcion_kg)')
        .eq('fecha', fecha)
        .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

      if (fetchErr || !dayMovs || dayMovs.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: 'No hay movimientos pendientes en esta fecha para ajustar.' });
      }

      // Ordenar: 1: ENTRADA_COMPRA, 2: PORCIONADO, 3: TRASLADO_COCINA, 4: DEVOLUCION_COCINA, 5: AJUSTE_INVENTARIO
      const orderMap: Record<string, number> = {
        ENTRADA_COMPRA: 10,
        PORCIONADO: 20,
        TRASLADO_COCINA: 30,
        DEVOLUCION_COCINA: 40,
        AJUSTE_INVENTARIO: 50,
      };

      const sortedMovs = [...dayMovs].sort((a, b) => (orderMap[a.tipo_movimiento] || 50) - (orderMap[b.tipo_movimiento] || 50));

      // 2. Obtener stock actual de todos los insumos
      const { data: stockRows } = await supabase.from('stock_actual').select('*');
      const tempStockMap = new Map<string, { bSinPorc: number; bPorcUnd: number; bPorcKg: number; cSinPorc: number; cPorcUnd: number; cPorcKg: number }>();

      stockRows?.forEach((st) => {
        tempStockMap.set(String(st.insumo_id), {
          bSinPorc: parseFloat(st.bodega_sin_porcionar_kg) || 0,
          bPorcUnd: parseInt(st.bodega_porcionado_und) || 0,
          bPorcKg: parseFloat(st.bodega_porcionado_kg) || 0,
          cSinPorc: parseFloat(st.cocina_sin_porcionar_kg) || 0,
          cPorcUnd: parseInt(st.cocina_porcionado_und) || 0,
          cPorcKg: parseFloat(st.cocina_porcionado_kg) || 0,
        });
      });

      const adjustmentsToCreate: any[] = [];
      const nowIso = new Date().toISOString();

      // 3. Simular secuencia y detectar déficits paso a paso
      for (const mov of sortedMovs) {
        const idKey = String(mov.insumo_id);
        if (!tempStockMap.has(idKey)) {
          tempStockMap.set(idKey, { bSinPorc: 0, bPorcUnd: 0, bPorcKg: 0, cSinPorc: 0, cPorcUnd: 0, cPorcKg: 0 });
        }
        const cur = tempStockMap.get(idKey)!;
        const cantKg = parseFloat(mov.cant_sin_porcionar_kg) || 0;
        const porcUnd = parseInt(mov.porciones_und) || 0;
        const porcKg = parseFloat(mov.peso_porciones_kg) || 0;
        const insumoNom = mov.catalogo_insumos?.nombre || `Insumo #${mov.insumo_id}`;
        const costoKg = parseFloat(mov.costo_unitario_kg) || mov.catalogo_insumos?.costo_unitario_kg || 0;
        const pesoStd = mov.catalogo_insumos?.peso_estandar_porcion_kg || (porcUnd > 0 && porcKg > 0 ? porcKg / porcUnd : 0.35);

        if (mov.tipo_movimiento === 'ENTRADA_COMPRA') {
          cur.bSinPorc += cantKg;
        } else if (mov.tipo_movimiento === 'PORCIONADO') {
          if (cur.bSinPorc < cantKg) {
            const neededKg = parseFloat((cantKg - cur.bSinPorc).toFixed(2));
            // Crear ajuste en Bodega Entero
            adjustmentsToCreate.push({
              fecha: fecha,
              fecha_hora: nowIso,
              tipo_movimiento: 'AJUSTE_INVENTARIO',
              insumo_id: mov.insumo_id,
              insumo_nombre: insumoNom,
              origen: 'AJUSTE_ENTRADA',
              destino: 'BODEGA_ENTERO',
              ubicacion: 'BODEGA_ENTERO',
              cant_sin_porcionar_kg: neededKg,
              porciones_und: 0,
              peso_porciones_kg: 0,
              merma_kg: 0,
              costo_unitario_kg: costoKg,
              valor_total_movimiento: neededKg * costoKg,
              observaciones: `[AJUSTE: ERROR_CONTEO_PREVIO] Ubicación: BODEGA_ENTERO | Motivo: Conciliación automática para porcionado de jornada ${fecha} (Faltante ${neededKg} Kg)`,
              usuario: `${usuario} (Auto)`,
              bSinAnt: cur.bSinPorc,
              bSinNue: cur.bSinPorc + neededKg,
            });
            cur.bSinPorc += neededKg;
          }
          cur.bSinPorc = Math.max(0, cur.bSinPorc - cantKg);
          cur.bPorcUnd += porcUnd;
          cur.bPorcKg += porcKg;
        } else if (mov.tipo_movimiento === 'TRASLADO_COCINA') {
          if (porcUnd > 0) {
            if (cur.bPorcUnd < porcUnd) {
              const neededUnd = porcUnd - cur.bPorcUnd;
              const neededKg = parseFloat((neededUnd * pesoStd).toFixed(2));
              // Crear ajuste en Bodega Porcionado
              adjustmentsToCreate.push({
                fecha: fecha,
                fecha_hora: nowIso,
                tipo_movimiento: 'AJUSTE_INVENTARIO',
                insumo_id: mov.insumo_id,
                insumo_nombre: insumoNom,
                origen: 'AJUSTE_ENTRADA',
                destino: 'BODEGA_PORCIONADO',
                ubicacion: 'BODEGA_PORCIONADO',
                cant_sin_porcionar_kg: 0,
                porciones_und: neededUnd,
                peso_porciones_kg: neededKg,
                merma_kg: 0,
                costo_unitario_kg: costoKg,
                valor_total_movimiento: neededKg * costoKg,
                observaciones: `[AJUSTE: ERROR_CONTEO_PREVIO] Ubicación: BODEGA_PORCIONADO | Motivo: Conciliación automática para traslado de jornada ${fecha} (Faltante ${neededUnd} und)`,
                usuario: `${usuario} (Auto)`,
                bPorcUndAnt: cur.bPorcUnd,
                bPorcUndNue: cur.bPorcUnd + neededUnd,
              });
              cur.bPorcUnd += neededUnd;
              cur.bPorcKg += neededKg;
            }
            cur.bPorcUnd = Math.max(0, cur.bPorcUnd - porcUnd);
            cur.bPorcKg = Math.max(0, cur.bPorcKg - porcKg);
            cur.cPorcUnd += porcUnd;
            cur.cPorcKg += porcKg;
          } else {
            if (cur.bSinPorc < cantKg) {
              const neededKg = parseFloat((cantKg - cur.bSinPorc).toFixed(2));
              // Crear ajuste en Bodega Entero
              adjustmentsToCreate.push({
                fecha: fecha,
                fecha_hora: nowIso,
                tipo_movimiento: 'AJUSTE_INVENTARIO',
                insumo_id: mov.insumo_id,
                insumo_nombre: insumoNom,
                origen: 'AJUSTE_ENTRADA',
                destino: 'BODEGA_ENTERO',
                ubicacion: 'BODEGA_ENTERO',
                cant_sin_porcionar_kg: neededKg,
                porciones_und: 0,
                peso_porciones_kg: 0,
                merma_kg: 0,
                costo_unitario_kg: costoKg,
                valor_total_movimiento: neededKg * costoKg,
                observaciones: `[AJUSTE: ERROR_CONTEO_PREVIO] Ubicación: BODEGA_ENTERO | Motivo: Conciliación automática para traslado entero de jornada ${fecha} (Faltante ${neededKg} Kg)`,
                usuario: `${usuario} (Auto)`,
                bSinAnt: cur.bSinPorc,
                bSinNue: cur.bSinPorc + neededKg,
              });
              cur.bSinPorc += neededKg;
            }
            cur.bSinPorc = Math.max(0, cur.bSinPorc - cantKg);
            cur.cSinPorc += cantKg;
          }
        } else if (mov.tipo_movimiento === 'DEVOLUCION_COCINA') {
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
      }

      if (adjustmentsToCreate.length === 0) {
        return NextResponse.json({
          success: true,
          count: 0,
          message: `✅ Todos los movimientos del día ${fecha} cuentan con stock suficiente. No se requirieron ajustes.`
        });
      }

      // 4. Persistir los ajustes en movimientos_inventario
      for (const adj of adjustmentsToCreate) {
        await supabase.from('movimientos_inventario').insert([{
          fecha: adj.fecha,
          fecha_hora: adj.fecha_hora,
          tipo_movimiento: adj.tipo_movimiento,
          insumo_id: adj.insumo_id,
          origen: adj.origen,
          destino: adj.destino,
          cant_sin_porcionar_kg: adj.cant_sin_porcionar_kg,
          porciones_und: adj.porciones_und,
          peso_porciones_kg: adj.peso_porciones_kg,
          merma_kg: adj.merma_kg,
          costo_unitario_kg: adj.costo_unitario_kg,
          valor_total_movimiento: adj.valor_total_movimiento,
          observaciones: adj.observaciones,
          usuario: adj.usuario,
        }]);

        // Aplicar el ajuste directamente a stock_actual
        const { data: curSt } = await supabase.from('stock_actual').select('*').eq('insumo_id', adj.insumo_id).maybeSingle();
        if (curSt) {
          const upd: any = { updated_at: nowIso };
          if (adj.ubicacion === 'BODEGA_ENTERO') {
            upd.bodega_sin_porcionar_kg = parseFloat(((parseFloat(curSt.bodega_sin_porcionar_kg) || 0) + adj.cant_sin_porcionar_kg).toFixed(2));
          } else if (adj.ubicacion === 'BODEGA_PORCIONADO') {
            upd.bodega_porcionado_und = (parseInt(curSt.bodega_porcionado_und) || 0) + adj.porciones_und;
            upd.bodega_porcionado_kg = parseFloat(((parseFloat(curSt.bodega_porcionado_kg) || 0) + adj.peso_porciones_kg).toFixed(2));
          }
          await supabase.from('stock_actual').update(upd).eq('insumo_id', adj.insumo_id);
        }
      }

      const totalPesosAjustados = adjustmentsToCreate.reduce((acc, a) => acc + (a.valor_total_movimiento || 0), 0);

      return NextResponse.json({
        success: true,
        count: adjustmentsToCreate.length,
        totalPesos: totalPesosAjustados,
        adjustments: adjustmentsToCreate,
        message: `✅ Se aplicaron exitosamente ${adjustmentsToCreate.length} ajustes por $${Math.round(totalPesosAjustados).toLocaleString('es-CO')} en la jornada ${fecha}. Ahora todos los movimientos tienen stock suficiente.`
      });
    }

    // 🛠️ ACCIÓN MANUAL REGULAR (1 ajuste individual)
    const {
      insumo_id,
      tipo_ajuste = 'MERMA_POR_DESCONGELACION',
      ubicacion = 'BODEGA_PORCIONADO',
      cantidad = 0,
      peso_kg = 0,
      justificacion,
      usuario = 'Administrador',
      fecha = new Date().toISOString().split('T')[0]
    } = body;

    if (!insumo_id || !justificacion || !justificacion.trim()) {
      return NextResponse.json({ error: 'Insumo y Justificación detallada son obligatorios' }, { status: 400 });
    }

    const { data: stockRow, error: stockErr } = await supabase
      .from('stock_actual')
      .select('*')
      .eq('insumo_id', insumo_id)
      .maybeSingle();

    if (stockErr || !stockRow) {
      return NextResponse.json({ error: 'No se encontró registro de stock para este insumo' }, { status: 404 });
    }

    const { data: insumo } = await supabase
      .from('catalogo_insumos')
      .select('*')
      .eq('id', insumo_id)
      .single();

    const costoKg = insumo?.costo_unitario_kg || 0;
    const pesoStd = insumo?.peso_estandar_porcion_kg || 0.35;

    const bSinAnt = parseFloat(stockRow.bodega_sin_porcionar_kg) || 0;
    const bPorcUndAnt = parseInt(stockRow.bodega_porcionado_und) || 0;
    const bPorcKgAnt = parseFloat(stockRow.bodega_porcionado_kg) || 0;
    const cPorcUndAnt = parseInt(stockRow.cocina_porcionado_und) || 0;
    const cPorcKgAnt = parseFloat(stockRow.cocina_porcionado_kg) || 0;

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

    const nowIso = new Date().toISOString();

    const { error: updErr } = await supabase.from('stock_actual').update({
      bodega_sin_porcionar_kg: parseFloat(bSinNue.toFixed(2)),
      bodega_porcionado_und: Math.max(0, Math.round(bPorcUndNue)),
      bodega_porcionado_kg: parseFloat(bPorcKgNue.toFixed(2)),
      cocina_porcionado_und: Math.max(0, Math.round(cPorcUndNue)),
      cocina_porcionado_kg: parseFloat(cPorcKgNue.toFixed(2)),
      updated_at: nowIso,
    }).eq('insumo_id', insumo_id);

    if (updErr) throw updErr;

    const obsCompleta = `[AJUSTE: ${tipo_ajuste}] Ubicación: ${ubicacion} | Motivo: ${justificacion.trim()}`;
    const valorImpacto = pesoNum * costoKg;

    const { data: movInserted, error: movErr } = await supabase.from('movimientos_inventario').insert([{
      fecha: fecha,
      fecha_hora: nowIso,
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
