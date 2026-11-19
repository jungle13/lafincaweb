'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { User, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import ElianaBrandLogo from '@/components/brand/ElianaBrandLogo';
import { DEFAULT_EMPRESA_CONFIG, type EmpresaConfig, isTauriDesktop } from '@/lib/empresaConfig';

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [empresa, setEmpresa] = useState<EmpresaConfig>(DEFAULT_EMPRESA_CONFIG);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isTauriDesktop());
    fetch('/api/empresa', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.empresa) setEmpresa(d.empresa);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    const ok = await login(cleanUser, password);
    if (!ok) {
      setError('Usuario o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    router.replace('/');
  };

  const showCompanyName =
    empresa.nombre_comercial &&
    empresa.nombre_comercial.toUpperCase() !== 'ELIANA' &&
    empresa.nombre_comercial.toUpperCase() !== 'ELIANA POS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs px-4 select-none">
      <div className="w-full max-w-sm bg-[#0B1120] border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl animate-fade-in text-white">
        {/* Cabecera con Logo Vectorial ELIANA / ELIANA POS */}
        <div className="flex flex-col items-center justify-center mb-6 text-center">
          <div className="mb-4 flex items-center justify-center">
            <ElianaBrandLogo variant={isDesktop ? 'pos' : 'web'} theme="dark" size="lg" />
          </div>

          <h1 className="text-sm font-semibold text-slate-200 tracking-tight leading-tight">
            {isDesktop ? 'Plataforma de Punto de Venta y Operación' : empresa.subtitulo || 'Sistema de Gestión y Costeo'}
          </h1>
          {showCompanyName && (
            <p className="text-xs font-semibold text-blue-400 mt-1.5 leading-normal">
              {empresa.nombre_comercial}
            </p>
          )}
          {empresa.propietario && (
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 tracking-wide">
              {empresa.propietario}
            </p>
          )}
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
                placeholder="Ingresa tu usuario"
                autoFocus
                disabled={loading}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-900/90 border border-slate-700/80 rounded-xl outline-none focus:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-500 transition"
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
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-900/90 border border-slate-700/80 rounded-xl outline-none focus:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white placeholder-slate-500 transition"
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
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
