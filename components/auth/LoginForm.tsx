'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { User, Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    const ok = login(cleanUser, password);
    if (!ok) {
      setError('Usuario o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    // Redirigir siempre a la página de bienvenida (Inicio)
    router.replace('/');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs px-4 select-none">
      <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-2xl animate-fade-in">
        {/* Cabecera con Logo Oficial de La Finca */}
        <div className="flex flex-col items-center justify-center mb-6 text-center">
          <div className="bg-[#050811] px-6 py-3.5 rounded-2xl shadow-md border border-slate-900 mb-3.5 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Logo_Letras_Vectorizadas.svg"
              alt="La Finca Choclos y Asados"
              className="w-44 sm:w-48 h-auto max-h-14 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            />
          </div>

          <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
            Sistema de Control & Costeo
          </h1>
          <p className="text-[12px] text-slate-500 mt-1 leading-normal">
            Ingresa tus credenciales para acceder a la plataforma operativa
          </p>
        </div>

        {/* Formulario de Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Usuario
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: admin, eliana o arturo"
                autoFocus
                disabled={loading}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 placeholder-slate-400 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-slate-900 placeholder-slate-400 transition"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Ingresando...' : 'Ingresar al Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Footer de Seguridad */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Acceso seguro • La Finca Choclos y Asados</span>
        </div>
      </div>
    </div>
  );
}
