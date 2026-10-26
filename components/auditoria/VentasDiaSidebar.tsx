'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Receipt, Check, GripVertical } from 'lucide-react';

export interface VentaPlatoItem {
  codigo: string;
  nombre: string;
  cantidad: number;
}

interface VentasDiaSidebarProps {
  ventas: VentaPlatoItem[];
  dateStr: string;
  onClose: () => void;
}

export default function VentasDiaSidebar({
  ventas,
  dateStr,
  onClose
}: VentasDiaSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const totalUnidades = useMemo(() => {
    return ventas.reduce((acc, v) => acc + v.cantidad, 0);
  }, [ventas]);

  const filteredVentas = useMemo(() => {
    if (!searchTerm.trim()) return ventas;
    const q = searchTerm.toLowerCase().trim();
    return ventas.filter(v => 
      v.nombre.toLowerCase().includes(q) || 
      v.codigo.toLowerCase().includes(q)
    );
  }, [ventas, searchTerm]);

  const handleCopy = (v: VentaPlatoItem) => {
    navigator.clipboard.writeText(v.nombre);
    setCopiedId(v.codigo);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <aside className="w-72 lg:w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col h-full z-10 select-none animate-fade-in">
      {/* Header del Sidebar */}
      <div className="p-3.5 px-4 border-b border-slate-200 bg-slate-50/70 shrink-0 flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
            <Receipt className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span>Ventas del Día (POS)</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
            {ventas.length} platos · <strong className="text-slate-700 font-mono">{totalUnidades}</strong> unds totales
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer shrink-0"
          title="Ocultar listado de ventas"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Buscador Rápido */}
      <div className="p-2.5 px-3 border-b border-slate-100 bg-white shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por código o nombre..."
            className="w-full pl-8 pr-7 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-slate-400 rounded-md text-xs text-slate-900 focus:outline-none transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Listado Simplificado de Ventas */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredVentas.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No hay platos que coincidan con la búsqueda.
          </div>
        ) : (
          filteredVentas.map((v) => {
            const isCopied = copiedId === v.codigo;

            return (
              <div
                key={`${v.codigo}-${v.nombre}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify(v));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => handleCopy(v)}
                className="flex items-center justify-between py-2 px-2.5 hover:bg-slate-50 transition-colors cursor-grab active:cursor-grabbing group select-none hover:shadow-2xs"
                title="Arrastra este plato a una proteína para vincularlo (o clic para copiar)"
              >
                <div className="min-w-0 pr-2 flex items-center gap-1.5">
                  <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab" />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-slate-400 font-bold shrink-0">
                      #{v.codigo}
                    </span>
                    <span className="text-xs font-medium text-slate-800 group-hover:text-slate-950 truncate">
                      {v.nombre}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {isCopied ? (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Copiado
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 group-hover:bg-slate-200/80 px-2 py-0.5 rounded transition-colors shadow-2xs">
                      {v.cantidad} <span className="text-[10px] font-normal text-slate-500">und</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Minimalista con Instrucción */}
      <div className="p-2.5 px-3 border-t border-slate-200 bg-slate-50/70 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
        <span>Mostrando: <strong>{filteredVentas.length}</strong> de {ventas.length}</span>
        <span className="text-[10px] text-slate-400 font-medium">Arrastra para vincular</span>
      </div>
    </aside>
  );
}
