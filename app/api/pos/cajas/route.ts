import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = String(searchParams.get('device_id') || '').trim();
    const ipLocal = String(searchParams.get('ip') || '').trim();
    const supabase = getSupabase();

    if (deviceId) {
      const { data: boundCaja } = await supabase
        .from('pos_cajas')
        .select('id, nombre, es_principal, device_id, ip_local, activa')
        .eq('device_id', deviceId)
        .eq('activa', true)
        .maybeSingle();

      if (boundCaja) {
        const updateIp: Record<string, unknown> = { ultima_conexion_at: new Date().toISOString() };
        if (ipLocal && ipLocal !== boundCaja.ip_local) {
          updateIp.ip_local = ipLocal;
        }
        await supabase.from('pos_cajas').update(updateIp).eq('id', boundCaja.id);
        return NextResponse.json({
          success: true,
          bound: true,
          caja: { ...boundCaja, ip_local: ipLocal || boundCaja.ip_local },
        });
      }
    }

    const { data: allCajas, error } = await supabase
      .from('pos_cajas')
      .select('id, nombre, es_principal, device_id, ip_local, activa')
      .eq('activa', true)
      .order('es_principal', { ascending: false })
      .order('nombre', { ascending: true });

    if (error) throw error;

    const cajasLibres = (allCajas || []).filter((c: { device_id?: string | null }) => !c.device_id);
    const existePrincipalVinculada = (allCajas || []).some(
      (c: { es_principal?: boolean; device_id?: string | null }) => c.es_principal && Boolean(c.device_id)
    );

    return NextResponse.json({
      success: true,
      bound: false,
      cajasLibres,
      existePrincipalVinculada,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error consultando cajas' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rl = checkRateLimit(`pos-cajas:${ip}`, 15, 300_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Demasiados intentos. Espera ${rl.retryAfterSec}s.` },
        { status: 429 }
      );
    }
    const body = await req.json();
    const action = String(body?.action || 'VINCULAR_Y_VALIDAR_CAJA');

    if (action !== 'VINCULAR_Y_VALIDAR_CAJA') {
      return NextResponse.json({ success: false, error: 'Acción no soportada' }, { status: 400 });
    }

    const cajaId = String(body?.caja_id || '').trim();
    const passwordCaja = String(body?.password_caja || '').trim();
    const deviceId = String(body?.device_id || '').trim();
    const ipLocal = String(body?.ip_local || '').trim();

    if (!cajaId || !passwordCaja || !deviceId) {
      return NextResponse.json(
        { success: false, error: 'Debes seleccionar una caja e ingresar su contraseña.' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data: caja, error } = await supabase
      .from('pos_cajas')
      .select('*')
      .eq('id', cajaId)
      .eq('activa', true)
      .maybeSingle();

    if (error) throw error;
    if (!caja) {
      return NextResponse.json({ success: false, error: 'La caja seleccionada no existe o está inactiva.' }, { status: 404 });
    }
    if (String(caja.password_caja) !== passwordCaja) {
      return NextResponse.json({ success: false, error: 'Contraseña de caja incorrecta.' }, { status: 401 });
    }
    if (caja.device_id && caja.device_id !== deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: `La caja "${caja.nombre}" ya fue tomada por otro equipo (${caja.ip_local || 'LAN'}). Libérala desde el Admin Web si deseas reasignarla.`,
        },
        { status: 409 }
      );
    }

    const { data: updated, error: errUpd } = await supabase
      .from('pos_cajas')
      .update({
        device_id: deviceId,
        ip_local: ipLocal || caja.ip_local || '',
        ultima_conexion_at: new Date().toISOString(),
      })
      .eq('id', caja.id)
      .select('id, nombre, es_principal, device_id, ip_local')
      .single();

    if (errUpd) throw errUpd;

    return NextResponse.json({ success: true, caja: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error vinculando caja' },
      { status: 500 }
    );
  }
}
