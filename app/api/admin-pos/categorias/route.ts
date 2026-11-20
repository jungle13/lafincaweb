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
      .from('pos_categorias')
      .select('*')
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, categorias: data || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error cargando categorías' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede crear categorías.' }, { status: 403 });
    }
    const body = await req.json();
    const nombre = String(body?.nombre || '').trim().toUpperCase();
    if (!nombre) return NextResponse.json({ success: false, error: 'Nombre de categoría requerido.' }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pos_categorias')
      .insert({
        nombre,
        es_inventariable: Boolean(body?.es_inventariable),
        orden: Number(body?.orden || 0),
        activa: true,
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, categoria: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error creando categoría' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede editar categorías.' }, { status: 403 });
    }
    const body = await req.json();
    const id = String(body?.id || '').trim();
    const nombre = String(body?.nombre || '').trim().toUpperCase();
    const oldNombre = String(body?.old_nombre || '').trim().toUpperCase();
    const esInventariable = Boolean(body?.es_inventariable);
    if (!id || !nombre) return NextResponse.json({ success: false, error: 'ID y nombre requeridos.' }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pos_categorias')
      .update({ nombre, es_inventariable: esInventariable, orden: Number(body?.orden || 0) })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    // Normalizar productos pertenecientes a esta categoría
    if (oldNombre && oldNombre !== nombre) {
      await supabase
        .from('productos_venta')
        .update({ categoria: nombre, controla_inventario: esInventariable })
        .ilike('categoria', oldNombre);
    } else {
      await supabase
        .from('productos_venta')
        .update({ controla_inventario: esInventariable })
        .ilike('categoria', nombre);
    }

    return NextResponse.json({ success: true, categoria: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error actualizando categoría' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdminReq(req))) {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede eliminar categorías.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ success: false, error: 'Falta id.' }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase.from('pos_categorias').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error eliminando categoría' },
      { status: 500 }
    );
  }
}
