'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import LibrosApoyoContent from '@/components/libros-apoyo/LibrosApoyoContent';

export default function LibrosApoyoPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          <span className="text-xs font-medium">Cargando Libro de Caja Menor...</span>
        </div>
      }
    >
      <LibrosApoyoContent modoCajeroHermetico={false} />
    </React.Suspense>
  );
}
