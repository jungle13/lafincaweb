'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Calendar, User, ArrowRight, ClipboardList } from 'lucide-react';

export default function ConteosFisicosPage() {
  const router = useRouter();
  const [conteos, setConteos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadConteos = async () => {
    try {
      const res = await fetch('/api/inventario/conteos?t=' + Date.now());
      const data = await res.json();
      if (data.success) {
        setConteos(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConteos();
  }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const res = await fetch('/api/inventario/conteos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: new Date().toISOString().split('T')[0],
          usuario: 'Bodeguero'
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        router.push(`/inventario/conteos/${data.data.id}`);
      }
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade-in font-normal text-slate-800">
      {/* Header simple y limpio */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-base md:text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-orange-500" />
            Conteos Físicos de Inventario
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro y control de auditorías de existencias físicas en bodega y cocina
          </p>
        </div>
        
        <button
          onClick={handleCreate}
          disabled={creating}
          className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Nuevo Conteo Físico
        </button>
      </div>

      {/* Tabla de conteos */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            <span className="text-xs">Cargando conteos...</span>
          </div>
        ) : conteos.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No se han registrado sesiones de conteo físico aún. Haz clic en "Nuevo Conteo Físico" para comenzar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="text-[11px] font-semibold text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha de Creación</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conteos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {c.fecha}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {c.usuario}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        c.estado === 'APLICADO' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px]">
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/inventario/conteos/${c.id}`)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {c.estado === 'APLICADO' ? 'Ver Detalles' : 'Continuar Conteo'}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
