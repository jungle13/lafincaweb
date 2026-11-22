import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './desktop.css';
import PosAppShell from '@/components/pos/PosAppShell';
import {
  authenticateOffline,
  clearDesktopAuthSession,
  DESKTOP_SERVER_URL_KEY,
  getApiBaseUrl,
  getCachedOfflineSession,
  getStoredDesktopToken,
  posFetch,
  saveDesktopAuthSession,
  type CachedSessionUser,
  type OfflineUserRecord,
} from '@/lib/posApiClient';

function DesktopAuthGate() {
  const [session, setSession] = useState<CachedSessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverUrl, setServerUrl] = useState('https://lafincaweb.vercel.app');
  const [showServerCfg, setShowServerCfg] = useState(false);

  useEffect(() => {
    setServerUrl(getApiBaseUrl());
    const cached = getCachedOfflineSession();
    const token = getStoredDesktopToken();
    if (cached && token) {
      setSession(cached);
    }
    setChecking(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanUser = username.trim();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) {
      setErrorMsg('Ingresa usuario y contraseña.');
      return;
    }

    setSubmitting(true);
    try {
      try {
        const res = await posFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password: cleanPass }),
          timeoutMs: 6000,
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Credenciales incorrectas.');
        }
        saveDesktopAuthSession(
          data.user,
          data.token,
          data.offlineUsers as OfflineUserRecord[] | undefined
        );
        setSession(getCachedOfflineSession());
        return;
      } catch (netErr: unknown) {
        // Si es error explícito de credenciales (no de red), propagar
        const isNet =
          netErr instanceof TypeError ||
          (netErr instanceof DOMException && netErr.name === 'TimeoutError') ||
          (netErr instanceof Error && /network|fetch|timeout|failed to fetch/i.test(netErr.message));
        if (!isNet) throw netErr;

        // Modo Offline: validar contra hashes locales guardados en este equipo
        const offlineUser = await authenticateOffline(cleanUser, cleanPass);
        if (!offlineUser) {
          throw new Error(
            'Sin internet: usuario/contraseña inválidos o este equipo aún no ha iniciado sesión con internet al menos una vez.'
          );
        }
        setSession(offlineUser);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error iniciando sesión');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 text-xs text-zinc-500">
        Iniciando ELIANA POS...
      </div>
    );
  }

  if (session) {
    return (
      <PosAppShell
        user={session}
        isStandaloneDesktop={true}
        onDesktopLogout={() => {
          clearDesktopAuthSession();
          setSession(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-300 rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-zinc-900">ELIANA</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[11px] font-bold">
              POS
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Terminal de Escritorio Autónoma (Online &amp; Red Local LAN)
          </p>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1">Usuario</label>
            <input
              autoFocus
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: admin, maria"
              className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white font-bold text-xs cursor-pointer"
          >
            {submitting ? 'Verificando...' : 'Ingresar al POS'}
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-200 text-center">
          <button
            type="button"
            onClick={() => setShowServerCfg((v) => !v)}
            className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 cursor-pointer"
          >
            Configurar servidor nube ({serverUrl})
          </button>
          {showServerCfg && (
            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-zinc-300 rounded-lg text-[11px]"
              />
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(DESKTOP_SERVER_URL_KEY, serverUrl.trim());
                  setShowServerCfg(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold cursor-pointer"
              >
                Guardar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopAuthGate />
  </React.StrictMode>
);
