'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Por favor complete todos los campos');
      return;
    }

    const ok = login(username, password);
    if (!ok) {
      setError('Usuario o contraseña incorrectos');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm border border-slate-200 rounded-xl p-8 bg-white shadow-xs">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-6">
          Bienvenida
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingrese su usuario"
              autoFocus
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 text-slate-900 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 text-slate-900 transition-colors"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 text-center font-medium pt-1">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Ingresar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
