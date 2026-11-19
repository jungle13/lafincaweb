import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  AUTH_COOKIE_NAME,
  normalizeSystemRole,
  signAuthToken,
  validateAdminCredentials,
  type SystemRole,
} from '@/lib/authServer';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '').trim();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Usuario y contraseña requeridos.' },
        { status: 400 }
      );
    }

    let resolvedUser: { username: string; name: string; role: SystemRole } | null = null;

    // 1. Validar primero contra usuarios registrados en Supabase (libro_caja_usuarios)
    try {
      const supabase = getSupabase();
      const { data: dbUsers } = await supabase
        .from('libro_caja_usuarios')
        .select('username, nombre_completo, rol, rol_sistema, password_pin, password_sistema, activo')
        .ilike('username', username)
        .limit(1);

      const dbUser = dbUsers?.[0];
      if (dbUser && dbUser.activo !== false) {
        const expectedPass = String(dbUser.password_sistema || dbUser.password_pin || '').trim();
        if (expectedPass && expectedPass === password) {
          resolvedUser = {
            username: String(dbUser.username).trim().toLowerCase(),
            name: String(dbUser.nombre_completo || dbUser.username).trim(),
            role: normalizeSystemRole(dbUser.rol_sistema || dbUser.rol, dbUser.username),
          };
        }
      }
    } catch (dbErr) {
      console.warn('[POST /api/auth/login] Fallback a credenciales de servidor:', dbErr);
    }

    // 2. Fallback a credenciales de servidor (admin / eliana / arturo / AUTH_USERS_JSON)
    if (!resolvedUser) {
      const validServerUser = validateAdminCredentials(username, password);
      if (validServerUser) {
        resolvedUser = {
          username: validServerUser.username,
          name: validServerUser.name,
          role: normalizeSystemRole(undefined, validServerUser.username),
        };
      }
    }

    if (!resolvedUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario o contraseña incorrectos.' },
        { status: 401 }
      );
    }

    const token = await signAuthToken({
      username: resolvedUser.username,
      name: resolvedUser.name,
      role: resolvedUser.role,
    });

    const response = NextResponse.json({
      success: true,
      user: resolvedUser,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    return response;
  } catch (error: unknown) {
    console.error('[POST /api/auth/login] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error procesando inicio de sesión' },
      { status: 500 }
    );
  }
}
