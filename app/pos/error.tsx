'use client';

import React from 'react';

export default function PosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[10000] bg-zinc-100 flex items-center justify-center p-4">
      <div className="bg-white border border-red-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-center">
        <h2 className="text-lg font-extrabold text-red-700">Interrupción en Pantalla POS</h2>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Tu turno de caja, mesas abiertas y pagos registrados en la base de datos están a salvo.
        </p>
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-[11px] text-red-800 font-mono break-words">
          {error?.message || 'Error inesperado de interfaz'}
        </div>
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
          >
            Recuperar POS
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold cursor-pointer"
          >
            Recargar Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
