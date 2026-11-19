import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/lib/authServer';
import { DEFAULT_EMPRESA_CONFIG } from '@/lib/empresaConfig';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('empresa_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ success: true, empresa: DEFAULT_EMPRESA_CONFIG });
    }

    return NextResponse.json({
      success: true,
      empresa: {
        ...DEFAULT_EMPRESA_CONFIG,
        ...data,
        impuesto_pct: Number(data.impuesto_pct ?? DEFAULT_EMPRESA_CONFIG.impuesto_pct),
      },
    });
  } catch {
    return NextResponse.json({ success: true, empresa: DEFAULT_EMPRESA_CONFIG });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthToken(token);
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Solo el administrador puede modificar la configuración de empresa.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const payload = {
      id: 1,
      nombre_comercial: String(body?.nombre_comercial || DEFAULT_EMPRESA_CONFIG.nombre_comercial).trim(),
      pos_nombre: String(body?.pos_nombre || DEFAULT_EMPRESA_CONFIG.pos_nombre).trim(),
      subtitulo: String(body?.subtitulo || DEFAULT_EMPRESA_CONFIG.subtitulo).trim(),
      propietario: String(body?.propietario || '').trim(),
      nit: String(body?.nit || '').trim(),
      direccion: String(body?.direccion || '').trim(),
      telefono: String(body?.telefono || '').trim(),
      logo_url: String(body?.logo_url || '').trim(),
      impuesto_nombre: String(body?.impuesto_nombre || 'Impoconsumo').trim(),
      impuesto_pct: Number(body?.impuesto_pct ?? 8),
      moneda: String(body?.moneda || 'COP').trim(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('empresa_config')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, empresa: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error guardando configuración de empresa';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
