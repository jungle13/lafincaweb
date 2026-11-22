import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  AUTH_COOKIE_NAME,
  checkRateLimit,
  normalizeSystemRole,
  signAuthToken,
  validateAdminCredentials,
  type SystemRole,
} from '@/lib/authServer';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const logger = createLogger('api.auth.login');

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rl = checkRateLimit(`login:${ip}`, 12, 300_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Demasiados intentos. Espera ${rl.retryAfterSec}s.` },
        { status: 429 }
      );
    }

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
      const { data: dbUsers, error: dbErr } = await supabase
        .from('libro_caja_usuarios')
        .select('username, nombre_cajero, rol, rol_sistema, password_pin, password_sistema, activo')
        .ilike('username', username)
        .limit(1);

      if (dbErr) {
        console.warn('[POST /api/auth/login] Error consultando libro_caja_usuarios:', dbErr.message);
      }

      const dbUser = dbUsers?.[0];
      if (dbUser && dbUser.activo !== false) {
        const expectedPass = String(dbUser.password_sistema || dbUser.password_pin || '').trim();
        if (expectedPass && expectedPass === password) {
          resolvedUser = {
            username: String(dbUser.username).trim().toLowerCase(),
            name: String(dbUser.nombre_cajero || dbUser.username).trim(),
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

    // Generar catálogo de hashes offline para permitir inicio de sesión y PIN de supervisor sin internet en el .exe
    let offlineUsers: Array<{
      username: string;
      name: string;
      role: SystemRole;
      passHash: string;
      pinHash?: string;
    }> = [];
    try {
      const supabase = getSupabase();
      const { data: allUsers } = await supabase
        .from('libro_caja_usuarios')
        .select('username, nombre_cajero, rol, rol_sistema, password_pin, password_sistema, pos_pin, activo')
        .eq('activo', true);

      for (const u of allUsers || []) {
        const uname = String(u.username || '').trim().toLowerCase();
        const pass = String(u.password_sistema || u.password_pin || '').trim();
        if (!uname || !pass) continue;
        const role = normalizeSystemRole(u.rol_sistema || u.rol, uname);
        const passHash = crypto.createHash('sha256').update(`${uname}:${pass}`).digest('hex');
        const pinRaw = String(u.pos_pin || u.password_pin || pass).trim();
        const pinHash = crypto.createHash('sha256').update(`pin:${uname}:${pinRaw}`).digest('hex');
        offlineUsers.push({
          username: uname,
          name: String(u.nombre_cajero || uname).trim(),
          role,
          passHash,
          pinHash,
        });
      }
    } catch {
      // fallback: al menos incluir el usuario actual autenticado
      offlineUsers = [
        {
          username: resolvedUser.username,
          name: resolvedUser.name,
          role: resolvedUser.role,
          passHash: crypto
            .createHash('sha256')
            .update(`${resolvedUser.username}:${password}`)
            .digest('hex'),
        },
      ];
    }

    const response = NextResponse.json({
      success: true,
      user: resolvedUser,
      token,
      offlineUsers,
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
    logger.error('login_failed', error);
    return NextResponse.json(
      { success: false, error: 'Error procesando inicio de sesión' },
      { status: 500 }
    );
  }
}
