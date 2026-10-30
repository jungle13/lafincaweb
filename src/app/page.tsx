'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';

export default function HomePage() {
  const { user } = useAuth();
  const { openSidebar } = useSidebar();

  const greeting = user?.name === 'Eliana' ? 'Bienvenida' : 'Bienvenido';

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center px-4 bg-white select-none">
      <h1 className="text-3xl sm:text-4xl font-light text-slate-800 tracking-tight mb-3">
        {greeting}, <span className="font-semibold text-slate-900">{user?.name}</span>
      </h1>
      <p className="text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
        El sistema está listo. Puedes dirigirte a cualquier módulo utilizando el menú lateral.
      </p>
      <button
        onClick={openSidebar}
        type="button"
        className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
      >
        Abrir menú
      </button>
    </div>
  );
}
