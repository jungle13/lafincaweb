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
  '/api/empresa',
  '/api/health',
  '/api/telemetry/client-error',
  '/api/telegram/webhook',
];

const ADMIN_ONLY_API_PREFIXES = [
  '/api/compras',
  '/api/ventas',
  '/api/costeo-diario',
  '/api/operarios',
  '/api/admin-pos',
  '/api/proveedores',
  '/api/catalogo',
  '/api/recetas',
  '/api/crm',
  '/api/periodos',
];

function unauthorizedResponse(route: string, hint: string, status = 401) {
  return NextResponse.json(
    {
      error: status === 403 ? 'Acceso denegado para tu rol' : 'No autorizado',
      code: status === 403 ? 'FORBIDDEN_ROLE' : 'AUTH_REQUIRED',
      route,
      hint,
    },
    { status }
  );
}

function resolveCorsOrigin(req: NextRequest): string | null {
  const origin = req.headers.get('origin') || '';
  if (
    origin === 'tauri://localhost' ||
    origin === 'http://tauri.localhost' ||
    origin === 'https://tauri.localhost' ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    return origin;
  }
  return null;
}

function applyCorsHeaders(res: NextResponse, origin: string | null): NextResponse {
  if (!origin) return res;
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

function extractBearerOrCookie(req: NextRequest, cookieName: string): string | undefined {
  const cookieVal = req.cookies.get(cookieName)?.value;
  if (cookieVal) return cookieVal;
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const corsOrigin = resolveCorsOrigin(req);
  if (req.method === 'OPTIONS') {
    return applyCorsHeaders(new NextResponse(null, { status: 204 }), corsOrigin);
  }

  // Rutas públicas explícitas (auth y webhook de Telegram con su propio secreto)
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return applyCorsHeaders(NextResponse.next(), corsOrigin);
  }

  const mode = getAuthEnforcementMode();
  const adminToken = extractBearerOrCookie(req, AUTH_COOKIE_NAME);
  const adminSession = await verifyAuthToken(adminToken);

  // Usuario con sesión principal válida (ADMIN, GESTOR, OPERATIVO_POS o legacy admin)
  if (
    adminSession &&
    (adminSession.role === 'ADMIN' ||
      adminSession.role === 'GESTOR' ||
      adminSession.role === 'OPERATIVO_POS' ||
      adminSession.role === 'admin')
  ) {
    if (
      adminSession.role === 'OPERATIVO_POS' &&
      ADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ) {
      logSecurityAudit(pathname, req.method, 'FORBIDDEN_OPERATIVO_POS', `user=${adminSession.username}`);
      if (mode === 'enforce') {
        return applyCorsHeaders(
          unauthorizedResponse(
            pathname,
            'Tu rol OPERATIVO_POS no tiene permisos para módulos administrativos.',
            403
          ),
          corsOrigin
        );
      }
    }
    return applyCorsHeaders(NextResponse.next(), corsOrigin);
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
