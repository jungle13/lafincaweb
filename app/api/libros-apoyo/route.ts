import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  obtenerDatosLibroCaja,
  recalcularHojaDiaria,
  extractResponsableFromSoporte,
} from '@/services/libroCajaService';
import { crearNotificacionCajaMenor } from '@/services/notificacionesService';
import { formatColombiaTime, getColombiaDateStr } from '@/lib/dateUtils';
import {
  AUTH_COOKIE_NAME,
  CAJERO_COOKIE_NAME,
  getAuthEnforcementMode,
  logSecurityAudit,
  signAuthToken,
  verifyAuthToken,
} from '@/lib/authServer';

export const dynamic = 'force-dynamic';

const cachedLibroCaja = new Map<string, { data: any; expiry: number }>();

async function buildPosDiaResumenYBitacora(fecha: string, sesionesPeriodo: any[], registrosPeriodo: any[]) {
  const [ordenesRes, eventosRes] = await Promise.all([
    supabase
      .from('pos_ordenes')
      .select(
        'id, consecutivo, sesion_caja_id, caja_nombre, cajero_nombre, gran_total, pago_efectivo, pago_datafono, pago_transferencia, pago_credito, estado, created_at, closed_at'
      )
      .eq('fecha', fecha)
      .eq('estado', 'PAGADA'),
    supabase
      .from('pos_auditoria_eventos')
      .select(
        'id, sesion_caja_id, caja_nombre, usuario_cajero, autorizado_por, tipo_alerta, nivel_riesgo, orden_consecutivo, valor_afectado, descripcion, created_at'
      )
      .eq('fecha', fecha)
      .order('created_at', { ascending: false }),
  ]);

  const ordenes = ordenesRes.data || [];
  const eventos = eventosRes.data || [];
  const sesionesDia = (sesionesPeriodo || []).filter((s: any) => s.fecha === fecha);
  const registrosDia = (registrosPeriodo || []).filter((r: any) => r.fecha === fecha);

  const porSesion: Record<
    string,
    {
      cantidadOrdenes: number;
      ventasEfectivo: number;
      cntEfectivo: number;
      ventasDatafono: number;
      cntDatafono: number;
      ventasTransferencia: number;
      cntTransferencia: number;
      ventasCredito: number;
      cntCredito: number;
      totalVendido: number;
      entradasEfectivo: number;
      salidasEfectivo: number;
    }
  > = {};

  const ensureSes = (sid: string) => {
    if (!porSesion[sid]) {
      porSesion[sid] = {
        cantidadOrdenes: 0,
        ventasEfectivo: 0,
        cntEfectivo: 0,
        ventasDatafono: 0,
        cntDatafono: 0,
        ventasTransferencia: 0,
        cntTransferencia: 0,
        ventasCredito: 0,
        cntCredito: 0,
        totalVendido: 0,
        entradasEfectivo: 0,
        salidasEfectivo: 0,
      };
    }
    return porSesion[sid];
  };

  let efMonto = 0;
  let efCnt = 0;
  let datMonto = 0;
  let datCnt = 0;
  let trMonto = 0;
  let trCnt = 0;
  let crMonto = 0;
  let crCnt = 0;
  let totalVendidoPos = 0;

  for (const o of ordenes) {
    const tot = Number(o.gran_total || 0);
    const ef = Number(o.pago_efectivo || 0);
    const dat = Number(o.pago_datafono || 0);
    const tr = Number(o.pago_transferencia || 0);
    const cr = Number(o.pago_credito || 0);
    totalVendidoPos += tot;
    if (ef > 0) {
      efMonto += ef;
      efCnt += 1;
    }
    if (dat > 0) {
      datMonto += dat;
      datCnt += 1;
    }
    if (tr > 0) {
      trMonto += tr;
      trCnt += 1;
    }
    if (cr > 0) {
      crMonto += cr;
      crCnt += 1;
    }

    if (o.sesion_caja_id) {
      const s = ensureSes(o.sesion_caja_id);
      s.cantidadOrdenes += 1;
      s.totalVendido += tot;
      if (ef > 0) {
        s.ventasEfectivo += ef;
        s.cntEfectivo += 1;
      }
      if (dat > 0) {
        s.ventasDatafono += dat;
        s.cntDatafono += 1;
      }
      if (tr > 0) {
        s.ventasTransferencia += tr;
        s.cntTransferencia += 1;
      }
      if (cr > 0) {
        s.ventasCredito += cr;
        s.cntCredito += 1;
      }
    }
  }

  let entradasEfectivo = 0;
  for (const ev of eventos) {
    if (ev.tipo_alerta === 'ENTRADA_EFECTIVO_CAJA') {
      const val = Number(ev.valor_afectado || 0);
      entradasEfectivo += val;
      if (ev.sesion_caja_id) {
        ensureSes(ev.sesion_caja_id).entradasEfectivo += val;
      }
    }
  }

  let salidasEfectivo = 0;
  let costosInsumos = 0;
  let gastosOperativos = 0;
  let turnosNomina = 0;
  let prestamosAnticipos = 0;

  for (const r of registrosDia) {
    const val = Number(r.valor_pagado || 0);
    salidasEfectivo += val;
    const cl = String(r.clasificacion || '').toLowerCase();
    if (cl.includes('insumo') || cl.includes('costo')) costosInsumos += val;
    else if (cl.includes('nómina') || cl.includes('nomina') || cl.includes('turno')) turnosNomina += val;
    else if (cl.includes('préstamo') || cl.includes('prestamo') || cl.includes('anticipo')) prestamosAnticipos += val;
    else gastosOperativos += val;

    if (r.sesion_id) {
      ensureSes(r.sesion_id).salidasEfectivo += val;
    }
  }

  // Base inicial de la primera sesión del día (evita duplicar en relevos de la misma caja)
  const sesionesOrdenadas = [...sesionesDia].sort((a, b) =>
    String(a.hora_apertura || '').localeCompare(String(b.hora_apertura || ''))
  );
  const baseInicial =
    sesionesOrdenadas.length > 0 ? Number(sesionesOrdenadas[0].efectivo_inicial || 0) : 0;

  const ultimaCerrada = [...sesionesOrdenadas]
    .reverse()
    .find((s: any) => s.estado !== 'ABIERTA' && Number(s.efectivo_cierre || 0) > 0);
  const efectivoContado = ultimaCerrada ? Number(ultimaCerrada.efectivo_cierre || 0) : null;
  const efectivoEsperado = baseInicial + efMonto + entradasEfectivo - salidasEfectivo;
  const diferenciaEfectivo = efectivoContado !== null ? efectivoContado - efectivoEsperado : 0;

  // Bitácora cronológica unificada
  const bitacoraDia: Array<{
    id: string;
    ts: string;
    hora: string;
    tipo: 'TURNO' | 'ENTRADA' | 'SALIDA' | 'AUDITORIA';
    titulo: string;
    detalle: string;
    usuario: string;
    monto?: number;
    soporte?: string;
    riesgo?: string;
  }> = [];

  for (const s of sesionesOrdenadas) {
    if (s.hora_apertura) {
      bitacoraDia.push({
        id: `open-${s.id}`,
        ts: s.hora_apertura,
        hora: formatColombiaTime(s.hora_apertura),
        tipo: 'TURNO',
        titulo: `Apertura Turno #${s.numero_turno || 1} (${s.caja_nombre || 'Caja'})`,
        detalle: `Base inicial: $${Math.round(Number(s.efectivo_inicial || 0)).toLocaleString('es-CO')}`,
        usuario: s.cajero_nombre || 'Cajero',
        monto: Number(s.efectivo_inicial || 0),
      });
    }
    if (s.hora_cierre && s.estado !== 'ABIERTA') {
      const diff = Number(s.diferencia_cuadre || 0);
      bitacoraDia.push({
        id: `close-${s.id}`,
        ts: s.hora_cierre,
        hora: formatColombiaTime(s.hora_cierre),
        tipo: 'TURNO',
        titulo: `${s.estado === 'CERRADA_TOTAL' ? 'Cierre Total' : 'Cierre Parcial'} Turno #${s.numero_turno || 1}`,
        detalle: `Contado: $${Math.round(Number(s.efectivo_cierre || 0)).toLocaleString('es-CO')} · Diferencia: ${diff >= 0 ? '+' : ''}$${Math.round(diff).toLocaleString('es-CO')}`,
        usuario: s.cajero_nombre || 'Cajero',
        monto: Number(s.efectivo_cierre || 0),
      });
    }
  }

  for (const r of registrosDia) {
    const ts = r.created_at || `${fecha}T12:00:00Z`;
    bitacoraDia.push({
      id: `sal-${r.id}`,
      ts,
      hora: formatColombiaTime(ts),
      tipo: 'SALIDA',
      titulo: `${r.clasificacion || 'Salida'}: ${r.concepto}`,
      detalle: r.descripcion_beneficiario
        ? `Beneficiario: ${r.descripcion_beneficiario} (${r.categoria || ''})`
        : r.categoria || '',
      usuario: r.responsable_caja || r.usuario_registro || 'Caja',
      monto: Number(r.valor_pagado || 0),
      soporte: r.soporte_factura || undefined,
    });
  }

  for (const ev of eventos) {
    const isEnt = ev.tipo_alerta === 'ENTRADA_EFECTIVO_CAJA';
    bitacoraDia.push({
      id: `ev-${ev.id}`,
      ts: ev.created_at,
      hora: formatColombiaTime(ev.created_at),
      tipo: isEnt ? 'ENTRADA' : 'AUDITORIA',
      titulo: isEnt ? 'Entrada de Efectivo (F7)' : String(ev.tipo_alerta || 'EVENTO POS'),
      detalle: ev.descripcion || '',
      usuario: ev.usuario_cajero || 'POS',
      monto: ev.valor_afectado ? Number(ev.valor_afectado) : undefined,
      riesgo: ev.nivel_riesgo || undefined,
    });
  }

  bitacoraDia.sort((a, b) => b.ts.localeCompare(a.ts));

  return {
    posDiaResumen: {
      fecha,
      cantidadOrdenes: ordenes.length,
      totalVendidoPos,
      ventasEfectivo: { monto: efMonto, cantidad: efCnt },
      ventasDatafono: { monto: datMonto, cantidad: datCnt },
      ventasTransferencia: { monto: trMonto, cantidad: trCnt },
      ventasCredito: { monto: crMonto, cantidad: crCnt },
      baseInicial,
      entradasEfectivo,
      salidasEfectivo,
      salidasDesglose: {
        costosInsumos,
        gastosOperativos,
        turnosNomina,
        prestamosAnticipos,
      },
      efectivoEsperado,
      efectivoContado,
      diferenciaEfectivo,
      porSesion,
    },
    bitacoraDia,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const periodoId = searchParams.get('periodo_id') || 'per-2026-10';
    const tipoLibro = searchParams.get('tipo_libro') || 'CAJA_MENOR';
    const fechaParam = searchParams.get('fecha') || getColombiaDateStr();
    const cacheKey = `${periodoId}|${tipoLibro}|${fechaParam}`;

    const hit = cachedLibroCaja.get(cacheKey);
    if (hit && Date.now() < hit.expiry) {
      return NextResponse.json(hit.data);
    }

    const data = await obtenerDatosLibroCaja(periodoId, tipoLibro);
    const { posDiaResumen, bitacoraDia } = await buildPosDiaResumenYBitacora(
      fechaParam,
      data.sesiones || [],
      data.registros || []
    );

    const payload = {
      success: true,
      ...data,
      posDiaResumen,
      bitacoraDia,
    };

    cachedLibroCaja.set(cacheKey, { data: payload, expiry: Date.now() + 10000 });
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('[GET /api/libros-apoyo] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error cargando Libro de Caja Menor' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    cachedLibroCaja.clear();
    const body = await req.json();
    const { action } = body;

    // 0. Autenticar Usuario de Caja / Administradora
    if (action === 'LOGIN_CAJERO') {
      const { username = '', password_pin = '' } = body;
      const cleanUser = String(username).trim().toLowerCase();
      const cleanPin = String(password_pin).trim();

      const { data: user, error } = await supabase
        .from('libro_caja_usuarios')
        .select('*')
        .eq('username', cleanUser)
        .eq('password_pin', cleanPin)
        .eq('activo', true)
        .maybeSingle();

      if (error) throw error;
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Usuario o contraseña incorrectos. Verifica tus credenciales.' },
          { status: 401 }
        );
      }

      const response = NextResponse.json({
        success: true,
        usuario: {
          id: user.id,
          username: user.username,
          nombre_cajero: user.nombre_cajero,
          rol: user.rol,
          caja_predeterminada: user.caja_predeterminada,
        },
      });

      const cajeroToken = await signAuthToken({
        username: user.username,
        name: user.nombre_cajero || user.username,
        role: 'cajero',
      });

      response.cookies.set(CAJERO_COOKIE_NAME, cajeroToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 días
      });

      return response;
    }

    // Validar sesión para todas las demás acciones de libros-apoyo
    const adminSession = await verifyAuthToken(req.cookies.get(AUTH_COOKIE_NAME)?.value);
    const cajeroSession = await verifyAuthToken(req.cookies.get(CAJERO_COOKIE_NAME)?.value);
    if (!adminSession && !cajeroSession) {
      logSecurityAudit('/api/libros-apoyo', 'POST', `MISSING_SESSION_ACTION_${String(action || 'UNKNOWN')}`);
      if (getAuthEnforcementMode() === 'enforce') {
        return NextResponse.json(
          {
            error: 'No autorizado',
            code: 'AUTH_REQUIRED',
            route: '/api/libros-apoyo',
            hint: 'Falta sesión válida de cajero o administrador.',
          },
          { status: 401 }
        );
      }
    }

    // 1. Abrir Flujo de Caja o Recibir Turno tras Cierre Parcial (1 solo flujo por día)
    if (action === 'OPEN_FLUJO_CAJA') {
      const {
        fecha,
        caja_nombre = 'CAJA PRINCIPAL',
        cajero_nombre = 'JOHANNA',
        usuario_username = 'johanna',
        efectivo_inicial = 500000,
        tipo_libro = 'CAJA_MENOR',
      } = body;

      if (!fecha) {
        return NextResponse.json(
          { success: false, error: 'La fecha es obligatoria para abrir o recibir el flujo de caja' },
          { status: 400 }
        );
      }

      const cleanUsername = String(usuario_username || cajero_nombre).toLowerCase().trim();
      const cleanCajero = String(cajero_nombre).toUpperCase().trim();

      // Consultar todas las sesiones de ese día ordenadas por turno
      const { data: sesionesDia, error: errSes } = await supabase
        .from('libro_caja_sesiones')
        .select('*')
        .eq('fecha', fecha)
        .order('numero_turno', { ascending: true })
        .order('hora_apertura', { ascending: true });

      if (errSes) throw errSes;
      const listaSesiones = sesionesDia || [];

      // Verificar si ya hay una sesión ABIERTA en este día
      const sesionAbierta = listaSesiones.find((s: any) => s.estado === 'ABIERTA');
      if (sesionAbierta) {
        if (
          sesionAbierta.usuario_username?.toLowerCase() !== cleanUsername &&
          sesionAbierta.cajero_nombre?.toUpperCase() !== cleanCajero
        ) {
          return NextResponse.json(
            {
              success: false,
              error: `El Flujo de Caja del día ${fecha} ya está ABIERTO y en uso por ${sesionAbierta.cajero_nombre}. Para que puedas ingresar y recibir el turno, ${sesionAbierta.cajero_nombre} debe realizar primero un Cierre Parcial.`,
            },
            { status: 409 }
          );
        }

        // Si es del mismo usuario que ya lo tiene abierto, retornar su sesión activa
        return NextResponse.json({
          success: true,
          sesion: sesionAbierta,
          resumed: true,
        });
      }

      // Verificar si el flujo del día ya tuvo un CIERRE TOTAL definitivo
      const sesionCierreTotal = listaSesiones.find(
        (s: any) => s.estado === 'CERRADA_TOTAL' || s.estado === 'CERRADA' || (s.estado !== 'ABIERTA' && s.tipo_cierre === 'TOTAL')
      );
      if (sesionCierreTotal) {
        return NextResponse.json(
          {
            success: false,
            error: `El Flujo de Caja del día ${fecha} ya fue CERRADO TOTALMENTE por ${sesionCierreTotal.cajero_nombre}. No se pueden abrir más turnos ni ingresar egresos regulares (solo ajustes si eres el titular o administrador).`,
          },
          { status: 409 }
        );
      }

      // Si no hay sesiones (Turno 1) o la última sesión está en CERRADA_PARCIAL (Relevo de Turno N+1)
      const siguienteTurno = listaSesiones.length + 1;

      const { data: nuevaSesion, error: errInsert } = await supabase
        .from('libro_caja_sesiones')
        .insert({
          fecha,
          caja_nombre: caja_nombre || 'CAJA PRINCIPAL',
          cajero_nombre: cleanCajero,
          usuario_username: cleanUsername,
          efectivo_inicial: Number(efectivo_inicial || 0),
          efectivo_cierre: 0,
          valor_datafonos: 0,
          total_salidas: 0,
          total_ajustes: 0,
          estado: 'ABIERTA',
          numero_turno: siguienteTurno,
          tipo_cierre: 'PARCIAL',
        })
        .select('*')
        .single();

      if (errInsert) throw errInsert;

      await recalcularHojaDiaria(fecha, tipo_libro);

      return NextResponse.json({
        success: true,
        sesion: nuevaSesion,
        numero_turno: siguienteTurno,
      });
    }

    // 2. Cerrar Flujo de Caja: soporta CIERRE PARCIAL (solo efectivo, cambio de turno) o CIERRE TOTAL (efectivo + datáfonos + revela POS)
    if (action === 'CLOSE_FLUJO_CAJA') {
      const {
        sesion_id,
        fecha,
        usuario_username,
        cajero_nombre,
        is_admin = false,
        tipo_cierre = 'TOTAL', // 'PARCIAL' | 'TOTAL'
        efectivo_cierre = 0,
        valor_datafonos = 0,
        valor_otros_medios = 0,
        observaciones = '',
        tipo_libro = 'CAJA_MENOR',
      } = body;

      // Buscar la sesión abierta que se desea cerrar
      let targetSesion: any = null;
      if (sesion_id) {
        const { data } = await supabase
          .from('libro_caja_sesiones')
          .select('*')
          .eq('id', sesion_id)
          .maybeSingle();
        targetSesion = data;
      } else if (fecha) {
        const { data } = await supabase
          .from('libro_caja_sesiones')
          .select('*')
          .eq('fecha', fecha)
          .eq('estado', 'ABIERTA')
          .maybeSingle();
        targetSesion = data;
      }

      if (!targetSesion) {
        return NextResponse.json(
          { success: false, error: 'No se encontró una sesión abierta para cerrar en esta fecha.' },
          { status: 404 }
        );
      }

      // Validar que solo el dueño de la sesión abierta (o Admin) pueda cerrarla
      const reqUser = String(usuario_username || '').toLowerCase().trim();
      const reqCajero = String(cajero_nombre || '').toUpperCase().trim();
      const isOwner =
        (reqUser && targetSesion.usuario_username?.toLowerCase() === reqUser) ||
        (reqCajero && targetSesion.cajero_nombre?.toUpperCase() === reqCajero);

      if (!is_admin && !isOwner) {
        return NextResponse.json(
          {
            success: false,
            error: `Solo ${targetSesion.cajero_nombre} (quien abrió este turno) o un Administrador puede realizar el cierre de esta sesión.`,
          },
          { status: 403 }
        );
      }

      const esParcial = String(tipo_cierre).toUpperCase() === 'PARCIAL';
      const nuevoEstado = esParcial ? 'CERRADA_PARCIAL' : 'CERRADA_TOTAL';

      const { data: updatedSesion, error } = await supabase
        .from('libro_caja_sesiones')
        .update({
          efectivo_cierre: Number(efectivo_cierre || 0),
          valor_datafonos: esParcial ? 0 : Number(valor_datafonos || 0),
          valor_otros_medios: esParcial ? 0 : Number(valor_otros_medios || 0),
          estado: nuevoEstado,
          tipo_cierre: esParcial ? 'PARCIAL' : 'TOTAL',
          hora_cierre: new Date().toISOString(),
          observaciones: observaciones
            ? `[CIERRE ${esParcial ? 'PARCIAL' : 'TOTAL'}] ${observaciones}`
            : `Cierre ${esParcial ? 'Parcial (Entrega de Turno)' : 'Total del Día'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetSesion.id)
        .select('*')
        .single();

      if (error) throw error;

      const targetFecha = fecha || updatedSesion?.fecha;
      if (targetFecha) {
        await recalcularHojaDiaria(targetFecha, tipo_libro);
      }

      return NextResponse.json({
        success: true,
        sesion: updatedSesion,
      });
    }

    // 3. Reabrir Flujo de Caja (Exclusivo Administradora)
    if (action === 'REOPEN_FLUJO_CAJA') {
      const { sesion_id, fecha, tipo_libro = 'CAJA_MENOR' } = body;
      const { data: updated, error } = await supabase
        .from('libro_caja_sesiones')
        .update({
          estado: 'ABIERTA',
          tipo_cierre: 'PARCIAL',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sesion_id)
        .select('*')
        .single();

      if (error) throw error;
      if (fecha || updated?.fecha) {
        await recalcularHojaDiaria(fecha || updated.fecha, tipo_libro);
      }
      return NextResponse.json({ success: true, sesion: updated });
    }

    // 4. Crear nuevo registro individual o AJUSTE post-cierre en una hoja de fecha
    if (action === 'CREATE_ITEM') {
      const {
        fecha,
        clasificacion = 'Gasto Operativo',
        categoria = 'Gastos Generales',
        concepto,
        descripcion_beneficiario = '',
        valor_pagado = 0,
        soporte_factura = '',
        responsable_caja = 'JOHANNA',
        proveedor_fuente = 'Gastos Menores / Caja Menor',
        usuario_registro = 'JOHANNA',
        caja_nombre = 'CAJA PRINCIPAL',
        es_ajuste = false,
        sesion_id = null,
        is_admin = false,
        tipo_libro = 'CAJA_MENOR',
      } = body;

      if (!fecha || !concepto) {
        return NextResponse.json(
          { success: false, error: 'Fecha y concepto son obligatorios' },
          { status: 400 }
        );
      }

      const reqUser = String(usuario_registro || '').toLowerCase().trim();
      const reqCajero = String(responsable_caja || '').toUpperCase().trim();

      // Consultar las sesiones del día para aplicar reglas estrictas de negocio
      const { data: sesionesDia } = await supabase
        .from('libro_caja_sesiones')
        .select('*')
        .eq('fecha', fecha)
        .order('numero_turno', { ascending: true });

      const listaSes = sesionesDia || [];
      const sesionAbierta = listaSes.find((s: any) => s.estado === 'ABIERTA');
      const sesionCerradaTotal = listaSes.find(
        (s: any) => s.estado === 'CERRADA_TOTAL' || s.estado === 'CERRADA' || (s.estado !== 'ABIERTA' && s.tipo_cierre === 'TOTAL')
      );

      let sesionIdAsignada = sesion_id;

      // Si NO es administrador, validar estrictamente propiedad de la sesión y estado del flujo
      if (!is_admin) {
        if (!es_ajuste) {
          // Para registrar un EGRESO NORMAL:
          // Debe existir una sesión ABIERTA hoy y debe pertenecer a este usuario
          if (!sesionAbierta) {
            return NextResponse.json(
              {
                success: false,
                error: 'No tienes una sesión de Flujo de Caja ABIERTA en este día. Debes abrir el flujo o recibir el turno primero ingresando tu efectivo inicial.',
              },
              { status: 403 }
            );
          }

          const esDuenioAbierta =
            sesionAbierta.usuario_username?.toLowerCase() === reqUser ||
            sesionAbierta.cajero_nombre?.toUpperCase() === reqCajero;

          if (!esDuenioAbierta) {
            return NextResponse.json(
              {
                success: false,
                error: `No puedes ingresar egresos en una sesión abierta por otro usuario (${sesionAbierta.cajero_nombre}).`,
              },
              { status: 403 }
            );
          }

          sesionIdAsignada = sesionAbierta.id;
        } else {
          // Para registrar un AJUSTE POST-CIERRE:
          // El flujo del día debe haberse cerrado totalmente y el usuario debe haber participado / cerrado ese flujo
          if (!sesionCerradaTotal) {
            return NextResponse.json(
              {
                success: false,
                error: 'Solo se pueden registrar Ajustes posteriores cuando el Flujo de Caja del día se ha cerrado completamente.',
              },
              { status: 403 }
            );
          }

          const participoEnFlujo = listaSes.some(
            (s: any) =>
              s.usuario_username?.toLowerCase() === reqUser ||
              s.cajero_nombre?.toUpperCase() === reqCajero
          );

          if (!participoEnFlujo) {
            return NextResponse.json(
              {
                success: false,
                error: 'No puedes registrar ajustes en un flujo de caja en el que no tuviste una sesión abierta.',
              },
              { status: 403 }
            );
          }

          sesionIdAsignada = sesionCerradaTotal.id;
        }
      } else {
        // Si es Administrador y hay sesión, vincular a la sesión activa o última
        if (!sesionIdAsignada && listaSes.length > 0) {
          sesionIdAsignada = (sesionAbierta || listaSes[listaSes.length - 1]).id;
        }
      }

      const tipoAjuste = String(body.tipo_ajuste || 'EGRESO').toUpperCase();
      let finalClasificacion = clasificacion;
      let finalCategoria = categoria;
      if (es_ajuste) {
        if (tipoAjuste === 'INGRESO') {
          finalClasificacion = 'Ingreso / Entrada';
          finalCategoria = 'Ajuste Posterior (Ingreso)';
        } else {
          finalClasificacion = 'Gasto Operativo';
          finalCategoria = 'Ajuste Posterior (Egreso)';
        }
      }
      const finalConcepto = es_ajuste
        ? (concepto.toUpperCase().startsWith('[AJUSTE') ? concepto.trim() : ('[AJUSTE ' + tipoAjuste + '] ' + concepto.trim()))
        : concepto.trim();
      const diaMes = Number(fecha.split('-')[2] || 1);
      const prefijoAjuste = es_ajuste ? 'AJUSTE CAJA / ' : 'CUADERNO CAJA / ';
      const soporteFinal = soporte_factura || `${prefijoAjuste}${responsable_caja.toUpperCase()}`;

      const { data: inserted, error } = await supabase
        .from('libro_caja_registros')
        .insert({
          fecha,
          dia_mes: diaMes,
          orden_item: 999,
          tipo_libro,
          periodo_id: `per-${fecha.slice(0, 7)}`,
          clasificacion: finalClasificacion,
          categoria: finalCategoria,
          concepto: finalConcepto,
          descripcion_beneficiario: descripcion_beneficiario.trim() || concepto.trim(),
          valor_pagado: Number(valor_pagado || 0),
          soporte_factura: soporteFinal,
          responsable_caja: responsable_caja.toUpperCase().trim(),
          proveedor_fuente: es_ajuste ? 'Ajuste Posterior al Cierre de Caja' : proveedor_fuente,
          usuario_registro: usuario_registro.toUpperCase().trim(),
          caja_nombre: caja_nombre || 'CAJA PRINCIPAL',
          es_ajuste: Boolean(es_ajuste),
          sesion_id: sesionIdAsignada || null,
        })
        .select('*')
        .single();

      if (error) throw error;

      await recalcularHojaDiaria(fecha, tipo_libro);

      if (tipo_libro === 'CAJA_MENOR') {
        try {
          await crearNotificacionCajaMenor({
            fecha,
            concepto: finalConcepto,
            categoria: finalCategoria,
            monto: Number(valor_pagado || 0),
            tipoMovimiento: 'GASTO',
            responsable: responsable_caja.toUpperCase().trim(),
            observaciones: descripcion_beneficiario.trim(),
          });
        } catch (notifErr) {
          console.warn('[POST /api/libros-apoyo] No se pudo registrar notificación pendiente:', notifErr);
        }
      }

      return NextResponse.json({
        success: true,
        registro: inserted,
      });
    }

    // 5. Actualizar Cuadre / Arqueo de Caja del Día (Vista Administradora o General)
    if (action === 'UPDATE_ARQUEO') {
      const {
        fecha,
        base_inicial = 500000,
        venta_efectivo_pos = 0,
        venta_pos_total = 0,
        total_datafonos = 0,
        total_otros_medios = 0,
        efectivo_fisico_cierre = 0,
        estado = 'CERRADA',
        observaciones = '',
        tipo_libro = 'CAJA_MENOR',
      } = body;

      const { data: existing } = await supabase
        .from('libro_caja_diario')
        .select('*')
        .eq('fecha', fecha)
        .eq('tipo_libro', tipo_libro)
        .maybeSingle();

      const totalSalidas = Number(existing?.total_salidas || 0);
      const posFinal = Number(venta_pos_total || venta_efectivo_pos || existing?.venta_pos_total || 0);
      const datafonosFinal = Number(total_datafonos !== undefined ? total_datafonos : (existing?.total_datafonos || 0));
      const otrosMediosFinal = Number(total_otros_medios !== undefined ? total_otros_medios : (existing?.total_otros_medios || 0));
      const fisicoFinal = Number(efectivo_fisico_cierre !== undefined ? efectivo_fisico_cierre : (existing?.efectivo_fisico_cierre || 0));
      const baseFinal = Number(base_inicial || 500000);

      // Cuadre Oficial: Efectivo + Datáfonos + Otros Medios (Nequi) + Salidas vs Venta POS
      const totalCuadre = fisicoFinal + datafonosFinal + otrosMediosFinal + totalSalidas;
      const diferencia = totalCuadre - posFinal;

      if (existing) {
        const { error } = await supabase
          .from('libro_caja_diario')
          .update({
            base_inicial: baseFinal,
            venta_efectivo_pos: posFinal,
            venta_pos_total: posFinal,
            total_datafonos: datafonosFinal,
            total_otros_medios: otrosMediosFinal,
            efectivo_fisico_cierre: fisicoFinal,
            diferencia_cuadre: diferencia,
            estado,
            observaciones,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const diaMes = Number(fecha.split('-')[2] || 1);
        const { error } = await supabase.from('libro_caja_diario').insert({
          fecha,
          dia_mes: diaMes,
          tipo_libro,
          periodo_id: `per-${fecha.slice(0, 7)}`,
          base_inicial: baseFinal,
          venta_efectivo_pos: posFinal,
          venta_pos_total: posFinal,
          total_datafonos: datafonosFinal,
          total_otros_medios: otrosMediosFinal,
          total_costos_insumos: 0,
          total_gastos_operativos: 0,
          total_turnos_nomina: 0,
          total_salidas: 0,
          efectivo_fisico_cierre: fisicoFinal,
          diferencia_cuadre: diferencia,
          responsables_dia: 'GENERAL',
          estado,
          observaciones,
        });
        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    // 6. Crear nueva hoja diaria vacía
    if (action === 'CREATE_SHEET') {
      const { fecha, responsable_caja = 'JOHANNA', base_inicial = 200000, tipo_libro = 'CAJA_MENOR' } = body;
      await recalcularHojaDiaria(fecha, tipo_libro);
      await supabase
        .from('libro_caja_diario')
        .update({
          responsables_dia: responsable_caja.toUpperCase(),
          base_inicial: Number(base_inicial || 200000),
          estado: 'ABIERTA',
        })
        .eq('fecha', fecha)
        .eq('tipo_libro', tipo_libro);

      return NextResponse.json({ success: true });
    }

    // 6.5. Importación de Flujos de Caja Completos (.txt / IA)
    if (action === 'IMPORT_FLUJOS_CAJA') {
      const { flujos = [], replaceDates = true, tipo_libro = 'CAJA_MENOR' } = body;
      if (!Array.isArray(flujos) || flujos.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No se recibieron flujos de caja válidos para importar' },
          { status: 400 }
        );
      }

      let totalSalidasInsertadas = 0;
      const fechasProcesadas: string[] = [];

      for (const flujo of flujos) {
        const fecha = String(flujo.fecha || '').trim();
        if (!fecha || fecha.length < 8) continue;
        fechasProcesadas.push(fecha);

        const salidas = Array.isArray(flujo.salidas) ? flujo.salidas : [];
        const diaMes = Number(fecha.split('-')[2] || 1);
        const periodoId = `per-${fecha.slice(0, 7)}`;
        const responsable = String(flujo.cajera_responsable || flujo.responsables_dia || 'JOHANNA').toUpperCase().trim();
        const cajaNombre = flujo.caja_nombre || 'Caja 1';

        // 1. Si replaceDates está activo, borrar salidas previas de esa fecha
        if (replaceDates) {
          await supabase
            .from('libro_caja_registros')
            .delete()
            .eq('tipo_libro', tipo_libro)
            .eq('fecha', fecha);
        }

        // 2. Insertar salidas del flujo
        if (salidas.length > 0) {
          const payloadSalidas = salidas.map((s: any, idx: number) => ({
            fecha,
            dia_mes: diaMes,
            orden_item: idx + 1,
            tipo_libro,
            periodo_id: periodoId,
            clasificacion: String(s.clasificacion || 'Gasto Operativo').trim(),
            categoria: String(s.categoria || 'Gastos Generales').trim(),
            concepto: String(s.concepto || 'Registro Caja').trim(),
            descripcion_beneficiario: String(s.descripcion_beneficiario || s.concepto || '').trim(),
            valor_pagado: Number(s.valor_pagado || s.valor || 0),
            soporte_factura: String(s.soporte_factura || s.soporte || `CUADERNO CAJA / ${responsable}`).trim(),
            responsable_caja: s.responsable_caja ? String(s.responsable_caja).toUpperCase().trim() : responsable,
            proveedor_fuente: String(s.proveedor_fuente || 'Gastos Menores / Caja Menor').trim(),
            usuario_registro: responsable,
            caja_nombre: cajaNombre,
            es_ajuste: Boolean(s.es_ajuste),
          }));

          const { error: insErr } = await supabase.from('libro_caja_registros').insert(payloadSalidas);
          if (insErr) throw insErr;
          totalSalidasInsertadas += payloadSalidas.length;
        }

        // 3. Recalcular la hoja diaria
        await recalcularHojaDiaria(fecha, tipo_libro);

        // 4. Si el flujo incluía datos específicos de arqueo, actualizar la hoja diaria
        const updateArqueo: Record<string, any> = {};
        if (flujo.base_inicial !== undefined && flujo.base_inicial !== null && Number(flujo.base_inicial) > 0) {
          updateArqueo.base_inicial = Number(flujo.base_inicial);
        }
        if (flujo.total_datafonos !== undefined && flujo.total_datafonos !== null) {
          updateArqueo.total_datafonos = Number(flujo.total_datafonos);
        }
        if (flujo.total_otros_medios !== undefined && flujo.total_otros_medios !== null) {
          updateArqueo.total_otros_medios = Number(flujo.total_otros_medios);
        }
        if (flujo.efectivo_fisico_cierre !== undefined && flujo.efectivo_fisico_cierre !== null && Number(flujo.efectivo_fisico_cierre) > 0) {
          updateArqueo.efectivo_fisico_cierre = Number(flujo.efectivo_fisico_cierre);
        }
        if (flujo.venta_pos_total !== undefined && flujo.venta_pos_total !== null && Number(flujo.venta_pos_total) > 0) {
          updateArqueo.venta_pos_total = Number(flujo.venta_pos_total);
          updateArqueo.venta_efectivo_pos = Number(flujo.venta_pos_total);
        }
        if (flujo.observaciones !== undefined && flujo.observaciones !== '') {
          updateArqueo.observaciones = String(flujo.observaciones || '');
        }
        if (responsable) {
          updateArqueo.responsables_dia = responsable;
        }

        if (Object.keys(updateArqueo).length > 0) {
          updateArqueo.updated_at = new Date().toISOString();
          await supabase
            .from('libro_caja_diario')
            .update(updateArqueo)
            .eq('fecha', fecha)
            .eq('tipo_libro', tipo_libro);

          // Re-calcular diferencia de cuadre con los nuevos valores
          const { data: updatedSheet } = await supabase
            .from('libro_caja_diario')
            .select('*')
            .eq('fecha', fecha)
            .eq('tipo_libro', tipo_libro)
            .maybeSingle();

          if (updatedSheet) {
            const sumatoria = Number(updatedSheet.efectivo_fisico_cierre || 0) +
              Number(updatedSheet.total_datafonos || 0) +
              Number(updatedSheet.total_otros_medios || 0) +
              Number(updatedSheet.total_salidas || 0);
            const posVal = Number(updatedSheet.venta_pos_total || 0);
            await supabase
              .from('libro_caja_diario')
              .update({
                diferencia_cuadre: sumatoria - posVal,
              })
              .eq('id', updatedSheet.id);
          }
        }
      }

      return NextResponse.json({
        success: true,
        flujosProcesados: fechasProcesadas.length,
        totalSalidasInsertadas,
        fechas: fechasProcesadas,
      });
    }

    // 7. Importación Masiva desde Excel / TXT / IA
    if (action === 'BULK_IMPORT') {
      const { items = [], replaceDates = true, tipo_libro = 'CAJA_MENOR' } = body;
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No se recibieron registros válidos para importar' },
          { status: 400 }
        );
      }

      const fechasAfectadas = new Set<string>();
      const payload = items.map((it: any, idx: number) => {
        const fecha = String(it.fecha || '2026-10-01').trim();
        fechasAfectadas.add(fecha);
        const diaMes = Number(fecha.split('-')[2] || it.dia_mes || 1);
        const soporte = String(it.soporte_factura || `CUADERNO CAJA / ${it.responsable_caja || 'JOHANNA'}`).trim();
        const resp = it.responsable_caja
          ? String(it.responsable_caja).toUpperCase().trim()
          : extractResponsableFromSoporte(soporte);

        return {
          fecha,
          dia_mes: diaMes,
          orden_item: idx + 1,
          tipo_libro,
          periodo_id: `per-${fecha.slice(0, 7)}`,
          clasificacion: String(it.clasificacion || 'Gasto Operativo').trim(),
          categoria: String(it.categoria || 'Gastos Generales').trim(),
          concepto: String(it.concepto || 'Registro Caja').trim(),
          descripcion_beneficiario: String(it.descripcion_beneficiario || it.concepto || '').trim(),
          valor_pagado: Number(it.valor_pagado || 0),
          soporte_factura: soporte,
          responsable_caja: resp,
          proveedor_fuente: String(it.proveedor_fuente || 'Gastos Menores / Caja Menor').trim(),
          usuario_registro: resp,
          caja_nombre: it.caja_nombre || 'Caja 1',
          es_ajuste: Boolean(it.es_ajuste),
        };
      });

      if (replaceDates) {
        const fechasArr = Array.from(fechasAfectadas);
        await supabase
          .from('libro_caja_registros')
          .delete()
          .eq('tipo_libro', tipo_libro)
          .in('fecha', fechasArr);
      }

      for (let i = 0; i < payload.length; i += 100) {
        const chunk = payload.slice(i, i + 100);
        const { error } = await supabase.from('libro_caja_registros').insert(chunk);
        if (error) throw error;
      }

      for (const f of Array.from(fechasAfectadas)) {
        await recalcularHojaDiaria(f, tipo_libro);
      }

      return NextResponse.json({
        success: true,
        importedCount: payload.length,
        fechasActualizadas: Array.from(fechasAfectadas).length,
      });
    }

    return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('[POST /api/libros-apoyo] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error procesando solicitud' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    cachedLibroCaja.clear();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const fecha = searchParams.get('fecha');
    const tipoLibro = searchParams.get('tipo_libro') || 'CAJA_MENOR';
    const isAdmin = searchParams.get('is_admin') === 'true';
    const usuario = (searchParams.get('usuario') || '').toLowerCase().trim();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    const { data: item } = await supabase
      .from('libro_caja_registros')
      .select('fecha, sesion_id, usuario_registro, responsable_caja')
      .eq('id', id)
      .maybeSingle();

    if (!isAdmin && item) {
      // Si no es administrador, solo puede eliminar si la sesión sigue ABIERTA y es su propia sesión
      if (item.sesion_id) {
        const { data: ses } = await supabase
          .from('libro_caja_sesiones')
          .select('estado, usuario_username, cajero_nombre')
          .eq('id', item.sesion_id)
          .maybeSingle();

        if (!ses || ses.estado !== 'ABIERTA') {
          return NextResponse.json(
            { success: false, error: 'No se pueden eliminar registros de una sesión de caja que ya fue cerrada.' },
            { status: 403 }
          );
        }

        if (
          usuario &&
          ses.usuario_username?.toLowerCase() !== usuario &&
          ses.cajero_nombre?.toLowerCase() !== usuario
        ) {
          return NextResponse.json(
            { success: false, error: 'Solo el usuario titular de la sesión abierta puede eliminar sus registros.' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Solo un administrador puede eliminar registros históricos.' },
          { status: 403 }
        );
      }
    }

    const { error } = await supabase.from('libro_caja_registros').delete().eq('id', id);
    if (error) throw error;

    const targetFecha = fecha || item?.fecha;
    if (targetFecha) {
      await recalcularHojaDiaria(targetFecha, tipoLibro);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/libros-apoyo] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error eliminando registro' },
      { status: 500 }
    );
  }
}
