import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AUTH_COOKIE_NAME, normalizeSystemRole, verifyAuthToken } from '@/lib/authServer';
import { getColombiaDateStr } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

async function isAdminReq(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifyAuthToken(token);
  if (!session) return false;
  return normalizeSystemRole(session.role, session.username) === 'ADMIN';
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const todayStr = getColombiaDateStr();
    const [{ data: cajas, error }, { data: sesionesHoy }] = await Promise.all([
      supabase
        .from('pos_cajas')
        .select('id, nombre, es_principal, device_id, ip_local, ultima_conexion_at, activa, created_at')
        .order('es_principal', { ascending: false })
        .order('nombre', { ascending: true }),
      supabase
        .from('libro_caja_sesiones')
        .select('caja_nombre, estado')
        .eq('fecha', todayStr)
        .eq('estado', 'ABIERTA'),
    ]);
    if (error) throw error;

    const abiertasSet = new Set(
      (sesionesHoy || []).map((s: { caja_nombre?: string }) => String(s.caja_nombre || '').toUpperCase())
    );

    const enriched = (cajas || []).map((c: Record<string, unknown>) => ({
      ...c,
      vinculada: Boolean(c.device_id),
      turno_abierto: abiertasSet.has(String(c.nombre || '').toUpperCase()),
    }));

    return NextResponse.json({ success: true, cajas: enriched });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error consultando cajas' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede crear cajas.' }, { status: 403 });
    }
    const body = await req.json();
    const nombre = String(body?.nombre || '').trim().toUpperCase();
    const password_caja = String(body?.password_caja || '1234').trim();
    const es_principal = Boolean(body?.es_principal);

    if (!nombre || !password_caja) {
      return NextResponse.json({ success: false, error: 'Nombre y contraseña de caja son obligatorios.' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (es_principal) {
      await supabase.from('pos_cajas').update({ es_principal: false }).neq('nombre', nombre);
    }

    const { data, error } = await supabase
      .from('pos_cajas')
      .insert({ nombre, password_caja, es_principal, activa: true })
      .select('id, nombre, es_principal, device_id, ip_local, ultima_conexion_at, activa')
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, caja: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error creando caja' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede editar cajas.' }, { status: 403 });
    }
    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ success: false, error: 'Falta id de caja.' }, { status: 400 });

    const supabase = getSupabase();

    if (body?.action === 'LIBERAR_PC') {
      const { data, error } = await supabase
        .from('pos_cajas')
        .update({ device_id: null, ip_local: '', ultima_conexion_at: null })
        .eq('id', id)
        .select('id, nombre, es_principal, device_id, ip_local, ultima_conexion_at, activa')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, caja: data });
    }

    const nombre = String(body?.nombre || '').trim().toUpperCase();
    const es_principal = Boolean(body?.es_principal);
    if (!nombre) return NextResponse.json({ success: false, error: 'Nombre requerido.' }, { status: 400 });

    if (es_principal) {
      await supabase.from('pos_cajas').update({ es_principal: false }).neq('id', id);
    }

    const updatePayload: Record<string, unknown> = {
      nombre,
      es_principal,
      activa: body?.activa !== false,
    };
    if (body?.password_caja && String(body.password_caja).trim()) {
      updatePayload.password_caja = String(body.password_caja).trim();
    }

    const { data, error } = await supabase
      .from('pos_cajas')
      .update(updatePayload)
      .eq('id', id)
      .select('id, nombre, es_principal, device_id, ip_local, ultima_conexion_at, activa')
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, caja: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error actualizando caja' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede eliminar cajas.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ success: false, error: 'Falta id.' }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase.from('pos_cajas').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error eliminando caja' },
      { status: 500 }
    );
  }
}
