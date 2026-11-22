'use client';

import { isTauriDesktop } from '@/lib/posHardwareBridge';

export const DESKTOP_TOKEN_KEY = 'eliana_desktop_auth_token_v1';
export const OFFLINE_SESSION_KEY = 'eliana_cached_session_v1';
export const OFFLINE_USERS_KEY = 'eliana_offline_users_v1';
export const BOUND_CAJA_CACHE_KEY = 'eliana_bound_caja_v1';
export const DESKTOP_SERVER_URL_KEY = 'eliana_pos_server_url';

export interface OfflineUserRecord {
  username: string;
  name: string;
  role: 'ADMIN' | 'GESTOR' | 'OPERATIVO_POS';
  passHash: string;
  pinHash?: string;
}

export interface CachedSessionUser {
  username: string;
  name: string;
  role: 'ADMIN' | 'GESTOR' | 'OPERATIVO_POS';
  cachedAt: number;
}

const DEFAULT_CLOUD_ORIGIN = 'https://lafincaweb.vercel.app';

export function getApiBaseUrl(): string {
  if (!isTauriDesktop()) return '';
  if (typeof window === 'undefined') return DEFAULT_CLOUD_ORIGIN;
  const raw = localStorage.getItem(DESKTOP_SERVER_URL_KEY) || DEFAULT_CLOUD_ORIGIN;
  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return parsed.origin;
  } catch {
    return DEFAULT_CLOUD_ORIGIN;
  }
}

export function getStoredDesktopToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DESKTOP_TOKEN_KEY);
}

export function saveDesktopAuthSession(
  user: { username: string; name: string; role: string },
  token?: string,
  offlineUsers?: OfflineUserRecord[]
) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(DESKTOP_TOKEN_KEY, token);
  }
  const normalizedRole =
    user.role === 'ADMIN' || user.role === 'GESTOR' ? user.role : 'OPERATIVO_POS';
  const session: CachedSessionUser = {
    username: user.username,
    name: user.name,
    role: normalizedRole,
    cachedAt: Date.now(),
  };
  localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
  if (Array.isArray(offlineUsers) && offlineUsers.length > 0) {
    localStorage.setItem(OFFLINE_USERS_KEY, JSON.stringify(offlineUsers));
  }
}

export function getCachedOfflineSession(): CachedSessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSessionUser;
    // Vigencia de 14 días para operación offline
    if (Date.now() - (parsed.cachedAt || 0) > 14 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDesktopAuthSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DESKTOP_TOKEN_KEY);
  localStorage.removeItem(OFFLINE_SESSION_KEY);
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function authenticateOffline(
  username: string,
  password: string
): Promise<CachedSessionUser | null> {
  if (typeof window === 'undefined') return null;
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();
  if (!cleanUser || !cleanPass) return null;

  try {
    const raw = localStorage.getItem(OFFLINE_USERS_KEY);
    if (!raw) return null;
    const users = JSON.parse(raw) as OfflineUserRecord[];
    const hash = await sha256Hex(`${cleanUser}:${cleanPass}`);
    const found = users.find((u) => u.username === cleanUser && u.passHash === hash);
    if (!found) return null;
    const session: CachedSessionUser = {
      username: found.username,
      name: found.name,
      role: found.role,
      cachedAt: Date.now(),
    };
    localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

export async function verifySupervisorPinOffline(
  pin: string
): Promise<{ ok: true; supervisorNombre: string } | { ok: false }> {
  if (typeof window === 'undefined') return { ok: false };
  const cleanPin = pin.trim();
  if (!cleanPin) return { ok: false };
  try {
    const raw = localStorage.getItem(OFFLINE_USERS_KEY);
    if (!raw) return { ok: false };
    const users = JSON.parse(raw) as OfflineUserRecord[];
    for (const u of users) {
      if (u.role !== 'ADMIN' && u.role !== 'GESTOR') continue;
      const expectedPinHash = await sha256Hex(`pin:${u.username}:${cleanPin}`);
      const expectedPassHash = await sha256Hex(`${u.username}:${cleanPin}`);
      if (u.pinHash === expectedPinHash || u.passHash === expectedPassHash) {
        return { ok: true, supervisorNombre: u.name || u.username };
      }
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function posFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 8000, headers, ...rest } = init;
  const baseUrl = getApiBaseUrl();
  const fullUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const mergedHeaders = new Headers(headers || {});
  const token = getStoredDesktopToken();
  if (token && !mergedHeaders.has('Authorization')) {
    mergedHeaders.set('Authorization', `Bearer ${token}`);
  }

  return fetch(fullUrl, {
    ...rest,
    headers: mergedHeaders,
    signal: rest.signal || AbortSignal.timeout(timeoutMs),
  });
}
