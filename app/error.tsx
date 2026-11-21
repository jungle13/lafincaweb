'use client';

import React from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-white border border-red-200 rounded-2xl max-w-md w-full p-6 shadow-md space-y-4 text-center">
        <h2 className="text-base font-extrabold text-red-700">Algo salió mal en esta vista</h2>
        <p className="text-xs text-zinc-600">
          {error?.message || 'Error inesperado de renderizado.'}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold cursor-pointer"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold cursor-pointer"
          >
            Recargar Página
          </button>
        </div>
      </div>
    </div>
  );
}
