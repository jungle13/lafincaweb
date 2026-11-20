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
    const [{ data: zonas, error: eZ }, { data: mesas, error: eM }] = await Promise.all([
      supabase.from('pos_zonas').select('*').order('orden', { ascending: true }).order('nombre', { ascending: true }),
      supabase.from('pos_mesas').select('*').order('numero', { ascending: true }),
    ]);
    if (eZ) throw eZ;
    if (eM) throw eM;
    return NextResponse.json({ success: true, zonas: zonas || [], mesas: mesas || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error cargando zonas y mesas' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede modificar zonas o mesas.' }, { status: 403 });
    }
    const body = await req.json();
    const kind = body?.kind === 'ZONA' ? 'ZONA' : 'MESA';
    const supabase = getSupabase();

    if (kind === 'ZONA') {
      const nombre = String(body?.nombre || '').trim();
      if (!nombre) return NextResponse.json({ success: false, error: 'Nombre de zona requerido.' }, { status: 400 });
      const { data, error } = await supabase
        .from('pos_zonas')
        .insert({ nombre, orden: Number(body?.orden || 0), activa: true })
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, zona: data });
    }

    const numero = Number(body?.numero || 0);
    const nombre = String(body?.nombre || (numero > 0 ? `Mesa ${numero}` : '')).trim();
    const zona = String(body?.zona || 'Salón Principal').trim();
    const capacidad = Math.max(1, Number(body?.capacidad || 4));
    if (!numero || !nombre) {
      return NextResponse.json({ success: false, error: 'Número y nombre de mesa requeridos.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pos_mesas')
      .insert({ numero, nombre, zona, capacidad, estado: 'LIBRE' })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, mesa: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error creando registro' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede editar zonas o mesas.' }, { status: 403 });
    }
    const body = await req.json();
    const kind = body?.kind === 'ZONA' ? 'ZONA' : 'MESA';
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ success: false, error: 'Falta id.' }, { status: 400 });
    const supabase = getSupabase();

    if (kind === 'ZONA') {
      const nombre = String(body?.nombre || '').trim();
      const oldNombre = String(body?.old_nombre || '').trim();
      if (!nombre) return NextResponse.json({ success: false, error: 'Nombre requerido.' }, { status: 400 });
      const { data, error } = await supabase
        .from('pos_zonas')
        .update({ nombre, orden: Number(body?.orden || 0) })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      if (oldNombre && oldNombre !== nombre) {
        await supabase.from('pos_mesas').update({ zona: nombre }).eq('zona', oldNombre);
      }
      return NextResponse.json({ success: true, zona: data });
    }

    const { data, error } = await supabase
      .from('pos_mesas')
      .update({
        numero: Number(body?.numero),
        nombre: String(body?.nombre || '').trim(),
        zona: String(body?.zona || 'Salón Principal').trim(),
        capacidad: Math.max(1, Number(body?.capacidad || 4)),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, mesa: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error actualizando registro' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede eliminar.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get('kind') === 'ZONA' ? 'ZONA' : 'MESA';
    const id = String(searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ success: false, error: 'Falta id.' }, { status: 400 });
    const supabase = getSupabase();

    if (kind === 'ZONA') {
      const { error } = await supabase.from('pos_zonas').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const { data: mesa } = await supabase.from('pos_mesas').select('estado').eq('id', id).maybeSingle();
    if (mesa && mesa.estado !== 'LIBRE') {
      return NextResponse.json({ success: false, error: 'No puedes eliminar una mesa ocupada.' }, { status: 400 });
    }
    const { error } = await supabase.from('pos_mesas').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error eliminando registro' },
      { status: 500 }
    );
  }
}
