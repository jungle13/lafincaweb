import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AUTH_COOKIE_NAME, normalizeSystemRole, verifyAuthToken } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

const VALID_CARGOS = ['Personal Cocina', 'Personal Caja / Servicio', 'Dueño / Gerencia'] as const;

async function authorizeManager(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifyAuthToken(token);
  if (!session) return null;
  const role = normalizeSystemRole(session.role, session.username);
  if (role === 'ADMIN' || role === 'GESTOR') return { session, role };
  return null;
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('libro_caja_usuarios')
      .select('id, username, nombre_cajero, rol, rol_sistema, cargo_area, telefono, correo, caja_predeterminada, activo, created_at')
      .neq('username', 'admin')
      .order('cargo_area', { ascending: true })
      .order('nombre_cajero', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, operarios: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error consultando operarios';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeManager(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'No autorizado para gestionar operarios.' }, { status: 403 });
    }

    const body = await req.json();
    const username = String(body?.username || '').trim().toLowerCase().replace(/\s+/g, '');
    const nombre_cajero = String(body?.nombre_cajero || '').trim().toUpperCase();
    const password_pin = String(body?.password_pin || '1234').trim();
    const telefono = String(body?.telefono || '').trim();
    const correo = String(body?.correo || '').trim();
    const cargo_area = VALID_CARGOS.includes(body?.cargo_area) ? body.cargo_area : 'Personal Caja / Servicio';
    const rol_sistema = body?.rol_sistema === 'GESTOR' ? 'GESTOR' : 'OPERATIVO_POS';

    if (!username || !nombre_cajero) {
      return NextResponse.json({ success: false, error: 'Usuario y nombre completo son obligatorios.' }, { status: 400 });
    }
    if (username === 'admin') {
      return NextResponse.json({ success: false, error: 'El usuario admin no se gestiona en este módulo.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('libro_caja_usuarios')
      .insert({
        username,
        nombre_cajero,
        password_pin,
        telefono,
        correo,
        cargo_area,
        rol: rol_sistema === 'GESTOR' ? 'GESTOR' : 'CAJERO',
        rol_sistema,
        caja_predeterminada: String(body?.caja_predeterminada || 'Caja 1').trim(),
        activo: true,
      })
      .select('id, username, nombre_cajero, rol, rol_sistema, cargo_area, telefono, correo, caja_predeterminada, activo')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, operario: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error creando operario';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await authorizeManager(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'No autorizado para editar operarios.' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Falta id del operario.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('libro_caja_usuarios')
      .select('username')
      .eq('id', id)
      .maybeSingle();

    if (!existing || String(existing.username).toLowerCase() === 'admin') {
      return NextResponse.json({ success: false, error: 'No se puede modificar este usuario.' }, { status: 403 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (body?.nombre_cajero !== undefined) updatePayload.nombre_cajero = String(body.nombre_cajero).trim().toUpperCase();
    if (body?.telefono !== undefined) updatePayload.telefono = String(body.telefono).trim();
    if (body?.correo !== undefined) updatePayload.correo = String(body.correo).trim();
    if (body?.cargo_area !== undefined && VALID_CARGOS.includes(body.cargo_area)) {
      updatePayload.cargo_area = body.cargo_area;
    }
    if (body?.rol_sistema === 'GESTOR' || body?.rol_sistema === 'OPERATIVO_POS') {
      updatePayload.rol_sistema = body.rol_sistema;
      updatePayload.rol = body.rol_sistema === 'GESTOR' ? 'GESTOR' : 'CAJERO';
    }
    if (body?.password_pin && String(body.password_pin).trim()) {
      updatePayload.password_pin = String(body.password_pin).trim();
    }
    if (typeof body?.activo === 'boolean') {
      updatePayload.activo = body.activo;
    }

    const { data, error } = await supabase
      .from('libro_caja_usuarios')
      .update(updatePayload)
      .eq('id', id)
      .select('id, username, nombre_cajero, rol, rol_sistema, cargo_area, telefono, correo, caja_predeterminada, activo')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, operario: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error actualizando operario';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authorizeManager(req);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'No autorizado para desactivar operarios.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get('id') || '').trim();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Falta id.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('libro_caja_usuarios')
      .select('username')
      .eq('id', id)
      .maybeSingle();

    if (!existing || String(existing.username).toLowerCase() === 'admin') {
      return NextResponse.json({ success: false, error: 'No se puede desactivar admin.' }, { status: 403 });
    }

    const { error } = await supabase
      .from('libro_caja_usuarios')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desactivando operario';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
