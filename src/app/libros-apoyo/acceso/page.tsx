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

      // Redirigir al Portal Cajero Hermético
      router.push('/libros-apoyo/cajero');
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
        <div className="bg-[#050811] p-6 text-white text-center space-y-3">
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/rf2.png"
              alt="La Finca Choclos y Asados"
              className="h-10 w-auto object-contain mx-auto filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">
              Portal de Caja Menor
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Ingresa tu usuario y contraseña para abrir o consultar tu Flujo de Caja del día
            </p>
          </div>
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
            className="w-full min-h-[46px] rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Ingresar al Portal Cajero</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Acceso Rápido Cajeros Oficiales (Demo / Facilidad) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center mb-2">
            Cajeros Autorizados (PIN por defecto: 1234)
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { user: 'johanna', label: 'Johanna' },
              { user: 'maria', label: 'María' },
              { user: 'carolina', label: 'Carolina' },
              { user: 'daniela', label: 'Daniela' },
              { user: 'lucero', label: 'Lucero' },
              { user: 'admin', label: 'Admin' },
            ].map((c) => (
              <button
                key={c.user}
                type="button"
                onClick={() => quickFillUser(c.user, '1234')}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-200 text-slate-700 font-medium text-[11px] transition text-center truncate cursor-pointer"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 text-center">
          <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Módulo de Control de Efectivo y Caja Menor • La Finca</span>
          </p>
        </div>
      </div>
    </div>
  );
}
