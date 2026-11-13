import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  CAJERO_COOKIE_NAME,
  getAuthEnforcementMode,
  logSecurityAudit,
  verifyAuthToken,
} from '@/lib/authServer';

const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/telegram/webhook',
];

function unauthorizedResponse(route: string, hint: string) {
  return NextResponse.json(
    {
      error: 'No autorizado',
      code: 'AUTH_REQUIRED',
      route,
      hint,
    },
    { status: 401 }
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Rutas públicas explícitas (auth y webhook de Telegram con su propio secreto)
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const mode = getAuthEnforcementMode();
  const adminToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const adminSession = await verifyAuthToken(adminToken);

  // Admin autenticado tiene acceso completo a todas las APIs
  if (adminSession && adminSession.role === 'admin') {
    return NextResponse.next();
  }

  // Portal de cajeros (/api/libros-apoyo): permite POST (LOGIN_CAJERO se valida dentro del route) o cookie de cajero
  if (pathname.startsWith('/api/libros-apoyo')) {
    const cajeroToken = req.cookies.get(CAJERO_COOKIE_NAME)?.value;
    const cajeroSession = await verifyAuthToken(cajeroToken);

    if (cajeroSession && cajeroSession.role === 'cajero') {
      return NextResponse.next();
    }

    // Permitir que POST /api/libros-apoyo llegue al handler para LOGIN_CAJERO;
    // el handler valida la sesión para las demás acciones.
    if (req.method === 'POST') {
      return NextResponse.next();
    }

    logSecurityAudit(pathname, req.method, 'MISSING_CAJERO_OR_ADMIN_SESSION');
    if (mode === 'enforce') {
      return unauthorizedResponse(
        pathname,
        'Falta sesión válida de cajero o administrador (la_finca_cajero_token / la_finca_token).'
      );
    }

    const res = NextResponse.next();
    res.headers.set('x-security-audit', 'missing-cajero-or-admin-session');
    return res;
  }

  // Resto de rutas /api/* requieren sesión admin
  logSecurityAudit(pathname, req.method, 'MISSING_ADMIN_SESSION');

  if (mode === 'enforce') {
    return unauthorizedResponse(
      pathname,
      'Falta cookie HttpOnly la_finca_token o expiró la sesión. Inicia sesión nuevamente.'
    );
  }

  const res = NextResponse.next();
  res.headers.set('x-security-audit', 'missing-admin-session');
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
