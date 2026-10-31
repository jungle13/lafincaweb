'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { User, Lock, ArrowRight, AlertCircle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs px-4 select-none">
      {/* Container principal con el azul oscuro del sidebar (#050811) */}
      <div className="w-full max-w-sm bg-[#050811] border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl animate-fade-in text-white">
        {/* Cabecera con Logo Oficial de La Finca */}
        <div className="flex flex-col items-center justify-center mb-6 text-center">
          <div className="mb-4 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/rf2.png"
              alt="La Finca Choclos y Asados"
              className="w-48 sm:w-52 h-auto max-h-16 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            />
          </div>

          <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
            Sistema de Seguimiento de Costeo
          </h1>
          <p className="text-xs font-semibold text-slate-300 mt-1.5 leading-normal">
            La Finca Choclos y Asados
          </p>
          <p className="text-[12px] text-orange-400 font-medium mt-0.5 tracking-wide">
            Eliana Garces
          </p>
        </div>

        {/* Formulario de Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Usuario
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: admin, eliana o arturo"
                autoFocus
                disabled={loading}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-900/90 border border-slate-700/80 rounded-xl outline-none focus:bg-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white placeholder-slate-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-900/90 border border-slate-700/80 rounded-xl outline-none focus:bg-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white placeholder-slate-500 transition"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-950/60 border border-red-800/80 rounded-lg text-xs text-red-200 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
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
      </div>
    </div>
  );
}
