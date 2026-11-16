import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  AUTH_COOKIE_NAME,
  getAuthEnforcementMode,
  verifyAuthToken,
} from '@/lib/authServer';
import {
  DESTINATARIOS_NOTIFICACION,
  DestinatarioKey,
  actualizarDestinatariosNotificacion,
  aprobarYEnviarNotificacion,
} from '@/services/notificacionesService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function verifyOnlyAdmin(req: NextRequest): Promise<{ ok: true; username: string } | { ok: false; status: number; error: string }> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifyAuthToken(token);

  if (session) {
    if (session.username.toLowerCase() !== 'admin') {
      return { ok: false, status: 403, error: 'Acceso restringido exclusivamente al Administrador.' };
    }
    return { ok: true, username: session.username };
  }

  if (getAuthEnforcementMode() === 'enforce') {
    return { ok: false, status: 401, error: 'Sesión de Administrador requerida.' };
  }

  // En modo audit, verificar header de contexto si viene desde UI
  const clientUser = req.headers.get('x-admin-user')?.toLowerCase();
  if (clientUser && clientUser !== 'admin') {
    return { ok: false, status: 403, error: 'Acceso restringido exclusivamente al Administrador.' };
  }

  return { ok: true, username: 'admin' };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyOnlyAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado');
    const evento = searchParams.get('evento');

    let query = supabase
      .from('notificaciones_sistema')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (estado && estado !== 'TODOS') {
      query = query.eq('estado', estado);
    }
    if (evento && evento !== 'TODOS') {
      query = query.eq('evento_tipo', evento);
    }

    const { data, error } = await query;
    if (error) throw error;

    const list = data || [];
    const pendientes = list.filter((n: any) => n.estado === 'PENDIENTE').length;
    const enviadas = list.filter((n: any) => n.estado === 'ENVIADA').length;

    return NextResponse.json({
      success: true,
      notificaciones: list,
      resumen: {
        total: list.length,
        pendientes,
        enviadas,
      },
      destinatariosDisponibles: Object.values(DESTINATARIOS_NOTIFICACION),
    });
  } catch (err: any) {
    console.error('Error en GET /api/notificaciones:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error cargando notificaciones' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyOnlyAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { action, id, destinatarios } = body as {
      action?: string;
      id?: string;
      destinatarios?: DestinatarioKey[];
    };

    if (!id) {
      return NextResponse.json({ success: false, error: 'El id de la notificación es obligatorio.' }, { status: 400 });
    }

    if (action === 'ACTUALIZAR_DESTINATARIOS' || action === 'DEJAR_PENDIENTE') {
      const updated = await actualizarDestinatariosNotificacion(id, destinatarios || []);
      return NextResponse.json({ success: true, notificacion: updated });
    }

    if (action === 'APROBAR_Y_ENVIAR') {
      const updated = await aprobarYEnviarNotificacion({
        id,
        destinatarios,
        adminUsername: auth.username,
      });
      return NextResponse.json({ success: true, notificacion: updated });
    }

    return NextResponse.json({ success: false, error: 'Acción no reconocida.' }, { status: 400 });
  } catch (err: any) {
    console.error('Error en POST /api/notificaciones:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error procesando notificación' },
      { status: 500 }
    );
  }
}
