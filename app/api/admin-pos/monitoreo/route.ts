import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  AUTH_COOKIE_NAME,
  getAuthEnforcementMode,
  verifyAuthToken,
} from '@/lib/authServer';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const logger = createLogger('api.admin-pos.monitoreo');

function getBogotaDateISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

export interface AlertaMonitoreo {
  id: string;
  severidad: 'ALTA' | 'MEDIA';
  categoria: 'ANTIFRAUDE' | 'CAJA' | 'OPERACION' | 'INVENTARIO';
  titulo: string;
  detalle: string;
  usuario?: string;
  monto?: number;
  hora?: string;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthToken(token);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sesión requerida para acceder al monitoreo.' },
        { status: 401 }
      );
    }

    const isAdmin =
      session.role === 'ADMIN' ||
      session.role === 'admin' ||
      session.username.toLowerCase() === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acceso restringido al Administrador.' },
        { status: 403 }
      );
    }

    const fechaHoy = getBogotaDateISO();
    const dbStart = Date.now();

    const [
      cajasRes,
      ordenesHoyRes,
      sesionesHoyRes,
      auditoriaRes,
      stockCriticoRes,
    ] = await Promise.all([
      supabase
        .from('pos_cajas')
        .select('id, nombre, es_principal, ip_local, ultima_conexion_at, activa')
        .order('es_principal', { ascending: false }),
      supabase
        .from('pos_ordenes')
        .select(
          'id, consecutivo, caja_nombre, canal_venta, mesa_numero, gran_total, metodo_pago, pago_efectivo, pago_datafono, pago_transferencia, pago_credito, estado, created_at, pagado_at'
        )
        .eq('fecha', fechaHoy),
      supabase
        .from('libro_caja_sesiones')
        .select(
          'id, caja_nombre, cajero_nombre, usuario_username, estado, venta_pos, diferencia_cuadre, hora_apertura, hora_cierre'
        )
        .eq('fecha', fechaHoy)
        .order('hora_apertura', { ascending: false }),
      supabase
        .from('pos_auditoria_eventos')
        .select(
          'id, caja_nombre, usuario_cajero, autorizado_por, tipo_alerta, nivel_riesgo, orden_consecutivo, mesa_numero, valor_afectado, descripcion, created_at'
        )
        .eq('fecha', fechaHoy)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('productos_venta')
        .select('id, codigo, nombre, categoria, existencia, inv_minimo, controla_inventario')
        .eq('activo', true)
        .eq('controla_inventario', true)
        .lte('existencia', 5)
        .order('existencia', { ascending: true })
        .limit(25),
    ]);

    const dbLatencyMs = Date.now() - dbStart;

    if (cajasRes.error) throw cajasRes.error;
    if (ordenesHoyRes.error) throw ordenesHoyRes.error;
    if (sesionesHoyRes.error) throw sesionesHoyRes.error;
    if (auditoriaRes.error) throw auditoriaRes.error;

    const cajas = cajasRes.data || [];
    const ordenes = ordenesHoyRes.data || [];
    const sesiones = sesionesHoyRes.data || [];
    const auditoria = auditoriaRes.data || [];
    const stockCritico = stockCriticoRes.error ? [] : stockCriticoRes.data || [];

    const pagadas = ordenes.filter((o) => o.estado === 'PAGADA');
    const abiertas = ordenes.filter((o) => o.estado === 'ABIERTA');
    const anuladas = ordenes.filter((o) => o.estado === 'ANULADA' || o.estado === 'CANCELADA');

    const totalVentas = pagadas.reduce((acc, o) => acc + Number(o.gran_total || 0), 0);
    const ticketPromedio = pagadas.length > 0 ? Math.round(totalVentas / pagadas.length) : 0;

    const metodosPago = {
      efectivo: pagadas.reduce((acc, o) => acc + Number(o.pago_efectivo || 0), 0),
      datafono: pagadas.reduce((acc, o) => acc + Number(o.pago_datafono || 0), 0),
      transferencia: pagadas.reduce((acc, o) => acc + Number(o.pago_transferencia || 0), 0),
      credito: pagadas.reduce((acc, o) => acc + Number(o.pago_credito || 0), 0),
    };

    const nowMs = Date.now();
    const mesasLargas = abiertas.filter((o) => {
      if (!o.created_at) return false;
      const elapsedMin = (nowMs - new Date(o.created_at).getTime()) / 60_000;
      return elapsedMin > 120;
    });

    const alertas: AlertaMonitoreo[] = [];

    // 1. Alertas de descuadre en cierres de caja
    for (const s of sesiones) {
      const diff = Number(s.diferencia_cuadre || 0);
      if (s.estado === 'CERRADA' && Math.abs(diff) > 10_000) {
        alertas.push({
          id: `cuadre-${s.id}`,
          severidad: 'ALTA',
          categoria: 'CAJA',
          titulo: `Descuadre en ${s.caja_nombre || 'Caja'}`,
          detalle: `Diferencia registrada de $${Math.round(diff).toLocaleString('es-CO')} COP al cerrar turno.`,
          usuario: s.cajero_nombre || s.usuario_username || undefined,
          monto: diff,
          hora: s.hora_cierre || undefined,
        });
      }
    }

    // 2. Alertas antifraude por anulaciones/devoluciones de alto monto o ráfagas
    const conteoAnulacionesPorCajero = new Map<string, number>();
    for (const ev of auditoria) {
      const tipo = String(ev.tipo_alerta || '').toUpperCase();
      const monto = Number(ev.valor_afectado || 0);
      const cajero = ev.usuario_cajero || 'Desconocido';

      if (tipo.includes('ANULA') || tipo.includes('ELIMINAR')) {
        conteoAnulacionesPorCajero.set(cajero, (conteoAnulacionesPorCajero.get(cajero) || 0) + 1);
      }

      if (
        (tipo.includes('ANULA') || tipo.includes('DEVOLUCION') || tipo.includes('ELIMINAR')) &&
        monto >= 80_000
      ) {
        alertas.push({
          id: `audit-${ev.id}`,
          severidad: 'ALTA',
          categoria: 'ANTIFRAUDE',
          titulo: `${ev.tipo_alerta} de alto monto`,
          detalle: ev.descripcion || `Orden ${ev.orden_consecutivo || '-'}`,
          usuario: cajero,
          monto,
          hora: ev.created_at,
        });
      }
    }

    for (const [cajero, count] of Array.from(conteoAnulacionesPorCajero.entries())) {
      if (count >= 3) {
        alertas.push({
          id: `rafaga-${cajero}`,
          severidad: 'ALTA',
          categoria: 'ANTIFRAUDE',
          titulo: `Ráfaga de anulaciones (${count} en el turno)`,
          detalle: `El usuario ${cajero} acumula ${count} eventos de anulación/eliminación hoy.`,
          usuario: cajero,
        });
      }
    }

    // 3. Mesas abiertas por más de 2 horas
    for (const m of mesasLargas) {
      alertas.push({
        id: `mesa-larga-${m.id}`,
        severidad: 'MEDIA',
        categoria: 'OPERACION',
        titulo: m.mesa_numero ? `Mesa ${m.mesa_numero} abierta > 2h` : `Orden ${m.consecutivo} abierta > 2h`,
        detalle: `Total actual $${Math.round(Number(m.gran_total || 0)).toLocaleString('es-CO')} COP sin cobro.`,
        monto: Number(m.gran_total || 0),
        hora: m.created_at,
      });
    }

    // 4. Stock crítico
    for (const prod of stockCritico) {
      const existencia = Number(prod.existencia || 0);
      if (existencia <= 0 || (prod.inv_minimo && existencia <= Number(prod.inv_minimo))) {
        alertas.push({
          id: `stock-${prod.id}`,
          severidad: existencia <= 0 ? 'ALTA' : 'MEDIA',
          categoria: 'INVENTARIO',
          titulo: existencia <= 0 ? `Sin stock: ${prod.nombre}` : `Stock bajo: ${prod.nombre}`,
          detalle: `Existencia actual: ${existencia} (mínimo: ${prod.inv_minimo ?? 0}).`,
        });
      }
    }

    // Ordenar alertas: ALTA primero
    alertas.sort((a, b) => (a.severidad === b.severidad ? 0 : a.severidad === 'ALTA' ? -1 : 1));

    logger.info('monitoreo_consultado', {
      durationMs: Date.now() - startedAt,
      dbLatencyMs,
      alertas: alertas.length,
    });

    return NextResponse.json({
      success: true,
      fechaOperativa: fechaHoy,
      generatedAt: new Date().toISOString(),
      telegramActivo: false,
      salud: {
        bdOk: true,
        dbLatencyMs,
        authEnforcement: getAuthEnforcementMode(),
        cajasTotales: cajas.length,
        cajasActivas: cajas.filter((c) => c.activa !== false).length,
      },
      ventasHoy: {
        totalFacturado: totalVentas,
        ordenesPagadas: pagadas.length,
        ordenesAbiertas: abiertas.length,
        ordenesAnuladas: anuladas.length,
        ticketPromedio,
        metodosPago,
      },
      cajas,
      sesionesHoy: sesiones,
      alertas,
      auditoriaReciente: auditoria.slice(0, 20),
      stockCritico,
    });
  } catch (err: unknown) {
    logger.error('monitoreo_error', err, { durationMs: Date.now() - startedAt });
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Error generando tablero de monitoreo',
      },
      { status: 500 }
    );
  }
}
