export const AUTH_COOKIE_NAME = 'la_finca_token';
export const CAJERO_COOKIE_NAME = 'la_finca_cajero_token';

export type AuthEnforcementMode = 'audit' | 'enforce';

export interface VerifiedSession {
  username: string;
  name: string;
  role: 'admin' | 'cajero';
  iat: number;
  exp: number;
}

interface ServerUserRecord {
  password: string;
  name: string;
}

// Credenciales por defecto solo en servidor (para no romper acceso actual si no se ha definido AUTH_USERS_JSON).
// Recomendado en producción: definir AUTH_USERS_JSON en Vercel con contraseñas fuertes.
const DEFAULT_SERVER_USERS: Record<string, ServerUserRecord> = {
  admin: { password: '123', name: 'Admin' },
  eliana: { password: '123', name: 'Eliana' },
  arturo: { password: '123', name: 'Arturo' },
};

function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-only-lafinca-fallback-secret-change-in-prod'
  );
}

export function getAuthEnforcementMode(): AuthEnforcementMode {
  return process.env.AUTH_ENFORCEMENT === 'enforce' ? 'enforce' : 'audit';
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const secretBytes = new TextEncoder().encode(getAuthSecret());
  return crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

export async function signAuthToken(
  payload: { username: string; name: string; role: 'admin' | 'cajero' },
  ttlSeconds = 2592000 // 30 días
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: VerifiedSession = {
    username: payload.username,
    name: payload.name,
    role: payload.role,
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadBytes = new TextEncoder().encode(JSON.stringify(fullPayload));
  const payloadB64 = toBase64Url(payloadBytes);
  const key = await importHmacKey('sign');
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuffer));

  return `${payloadB64}.${sigB64}`;
}

export async function verifyAuthToken(token: string | undefined | null): Promise<VerifiedSession | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await importHmacKey('verify');
    const sigBytes = fromBase64Url(sigB64);
    const sigBuffer = new Uint8Array(sigBytes).buffer;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuffer,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadB64));
    const parsed = JSON.parse(payloadJson) as VerifiedSession;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.username || !parsed.exp || parsed.exp < now) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function validateAdminCredentials(
  username: string,
  password: string
): { username: string; name: string } | null {
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();
  if (!cleanUser || !cleanPass) return null;

  let usersMap: Record<string, ServerUserRecord> = DEFAULT_SERVER_USERS;
  if (process.env.AUTH_USERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.AUTH_USERS_JSON);
      if (parsed && typeof parsed === 'object') {
        usersMap = parsed;
      }
    } catch (e) {
      console.error('[authServer] AUTH_USERS_JSON inválido, usando mapa por defecto:', e);
    }
  }

  const record = usersMap[cleanUser];
  if (record && record.password === cleanPass) {
    return { username: cleanUser, name: record.name || cleanUser };
  }
  return null;
}

export function logSecurityAudit(route: string, method: string, reason: string, extra?: string): void {
  const mode = getAuthEnforcementMode();
  console.warn(
    `[SECURITY_AUDIT] mode=${mode} route=${route} method=${method} reason=${reason}${extra ? ` ${extra}` : ''}`
  );
}
