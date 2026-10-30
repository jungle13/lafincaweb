'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Lock, User, ArrowRight, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

export default function AccesoCajeroPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [passwordPin, setPasswordPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !passwordPin.trim()) {
      setError('Ingresa tu usuario y contraseña de caja.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/libros-apoyo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LOGIN_CAJERO',
          username: username.trim().toLowerCase(),
          password_pin: passwordPin.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Credenciales inválidas');
      }

      // Guardar sesión del cajero o administradora
      localStorage.setItem('la_finca_cajero_session', JSON.stringify(json.usuario));

      // Redirigir directamente a la vista Consolidado Libro Caja Menor
      if (json.usuario.rol === 'ADMIN') {
        router.push('/libros-apoyo');
      } else {
        router.push('/libros-apoyo?modo=cajero');
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const quickFillUser = (user: string, pin: string) => {
    setUsername(user);
    setPasswordPin(pin);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="bg-slate-900 p-6 text-white text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center mx-auto text-orange-400">
            <Wallet className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">
            Portal de Caja Menor • La Finca
          </h1>
          <p className="text-xs text-slate-400">
            Ingresa tu usuario y contraseña para abrir o consultar tu Flujo de Caja del día
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Usuario de Caja
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: johanna, maria, carolina, daniela..."
                className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Contraseña / PIN de Acceso
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                inputMode="numeric"
                required
                value={passwordPin}
                onChange={(e) => setPasswordPin(e.target.value)}
                placeholder="••••"
                className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando Acceso...</span>
              </>
            ) : (
              <>
                <span>Ingresar al Libro de Caja Menor</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Accesos rápidos de prueba para fácil verificación */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Usuarios Oficiales Activos (PIN: 1234):
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {['johanna', 'maria', 'carolina', 'daniela'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => quickFillUser(u, '1234')}
                  className="px-2 py-1.5 rounded border border-slate-200 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold uppercase text-[10px] transition-colors cursor-pointer"
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
