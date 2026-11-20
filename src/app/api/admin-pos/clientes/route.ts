import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AUTH_COOKIE_NAME, normalizeSystemRole, verifyAuthToken } from '@/lib/authServer';

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
    const { data, error } = await supabase
      .from('pos_clientes')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, clientes: data || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error cargando clientes' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede crear clientes.' }, { status: 403 });
    }
    const body = await req.json();
    const nombre = String(body?.nombre || '').trim();
    if (!nombre) return NextResponse.json({ success: false, error: 'Nombre requerido.' }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pos_clientes')
      .insert({
        nombre,
        telefono: String(body?.telefono || '').trim(),
        direccion: String(body?.direccion || '').trim(),
        barrio: String(body?.barrio || '').trim(),
        correo: String(body?.correo || '').trim(),
        notas: String(body?.notas || '').trim(),
        activo: true,
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, cliente: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error creando cliente' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede editar clientes.' }, { status: 403 });
    }
    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ success: false, error: 'Falta id.' }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pos_clientes')
      .update({
        nombre: String(body?.nombre || '').trim(),
        telefono: String(body?.telefono || '').trim(),
        direccion: String(body?.direccion || '').trim(),
        barrio: String(body?.barrio || '').trim(),
        correo: String(body?.correo || '').trim(),
        notas: String(body?.notas || '').trim(),
        activo: body?.activo !== false,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, cliente: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error actualizando cliente' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede eliminar clientes.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ success: false, error: 'Falta id.' }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase.from('pos_clientes').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error eliminando cliente' },
      { status: 500 }
    );
  }
}
