'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import { InsumoItem } from '@/types';
import { normalizeStr, formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  selectedInsumo: InsumoItem | null;
  onSelect: (insumo: InsumoItem | null) => void;
  placeholder?: string;
  label?: string;
}

export default function SmartSearchInsumo({
  insumos,
  selectedInsumo,
  onSelect,
  placeholder = 'Escribe para buscar carne o insumo (ej. Lomo, Punta de anca, Costilla)...',
  label = 'Buscar Carne / Insumo *'
}: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedInsumo) {
      setQuery(selectedInsumo.insumo);
    } else {
      setQuery('');
    }
  }, [selectedInsumo]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanQuery = normalizeStr(query);
  const filtered = insumos.filter((item) => {
    if (!cleanQuery) return true;
    const name = normalizeStr(item.insumo);
    const cat = normalizeStr(item.categoria);
    return name.includes(cleanQuery) || cat.includes(cleanQuery);
  });

  const handleClear = () => {
    setQuery('');
    onSelect(null);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs md:text-sm font-bold text-slate-800 mb-1.5">
          {label}
        </label>
      )}

      <div className="relative flex items-center w-full">
        <Search className="absolute left-3 w-5 h-5 text-slate-400 pointer-events-none z-10" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (selectedInsumo && e.target.value !== selectedInsumo.insumo) {
              onSelect(null);
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full h-12 pl-10 pr-10 text-sm md:text-base font-medium rounded-xl border-2 transition-all outline-none bg-white text-slate-900 shadow-sm ${
            selectedInsumo
              ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold'
              : 'border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15'
          }`}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs md:text-sm text-slate-500 font-medium">
              No se encontraron carnes para &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = selectedInsumo?.insumo_id === item.insumo_id;

              return (
                <div
                  key={item.insumo_id}
                  onClick={() => {
                    onSelect(item);
                    setQuery(item.insumo);
                    setIsOpen(false);
                  }}
                  className={`p-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors ${
                    isSelected ? 'bg-orange-50/80 font-bold' : ''
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{item.insumo}</span>
                      {isSelected && <Check className="w-4 h-4 text-orange-600 inline" />}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {item.categoria}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      Bodega: {item.bodega_sin_porc_kg.toFixed(1)} Kg | {item.bodega_porc_und} porc
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      ${formatMoney(item.costo_unitario_kg)} / Kg
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
