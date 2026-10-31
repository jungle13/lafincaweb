'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import LibrosApoyoContent from '@/components/libros-apoyo/LibrosApoyoContent';

export default function CajeroPortalPage() {
  return (
    <React.Suspense
      fallback={
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="text-xs font-semibold">Cargando Portal de Caja Menor...</span>
        </div>
      }
    >
      <LibrosApoyoContent modoCajeroHermetico={true} />
    </React.Suspense>
  );
}
