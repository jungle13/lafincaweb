import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  signAuthToken,
  validateAdminCredentials,
} from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body?.username || '');
    const password = String(body?.password || '');

    const validUser = validateAdminCredentials(username, password);
    if (!validUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario o contraseña incorrectos.' },
        { status: 401 }
      );
    }

    const token = await signAuthToken({
      username: validUser.username,
      name: validUser.name,
      role: 'admin',
    });

    const response = NextResponse.json({
      success: true,
      user: validUser,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    return response;
  } catch (error: any) {
    console.error('[POST /api/auth/login] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error procesando inicio de sesión' },
      { status: 500 }
    );
  }
}
