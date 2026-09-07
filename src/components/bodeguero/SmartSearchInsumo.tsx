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
  placeholder = 'Escribe para buscar carne o insumo (ej. Filete de pollo, Churrasco, Tocino)...',
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
  const filtered = insumos
    .filter((item) => {
      if (!cleanQuery) return true;
      const name = normalizeStr(item.insumo);
      const cat = normalizeStr(item.categoria);
      return name.includes(cleanQuery) || cat.includes(cleanQuery);
    })
    .sort((a, b) => {
      // Priorizar items que tienen stock en bodega
      const isUndA = a.unidad_medida?.toLowerCase() === 'und' || a.categoria?.toLowerCase().includes('embutido') || a.insumo?.toLowerCase().includes('chorizo') || a.insumo?.toLowerCase().includes('tamal');
      const isUndB = b.unidad_medida?.toLowerCase() === 'und' || b.categoria?.toLowerCase().includes('embutido') || b.insumo?.toLowerCase().includes('chorizo') || b.insumo?.toLowerCase().includes('tamal');
      const stockA = isUndA ? ((a.bodega_sin_porc_kg || 0) + (a.bodega_porc_und || 0)) : ((a.bodega_sin_porc_kg || 0) + (a.bodega_porc_kg || 0));
      const stockB = isUndB ? ((b.bodega_sin_porc_kg || 0) + (b.bodega_porc_und || 0)) : ((b.bodega_sin_porc_kg || 0) + (b.bodega_porc_kg || 0));
      
      if (stockA > 0 && stockB <= 0) return -1;
      if (stockA <= 0 && stockB > 0) return 1;
      return a.insumo.localeCompare(b.insumo);
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
        <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none z-10" />
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
          className={`w-full h-10 pl-9 pr-9 text-xs md:text-sm rounded-xl border transition-all outline-none bg-white text-slate-800 placeholder-slate-400 ${
            selectedInsumo
              ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 font-semibold'
              : 'border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10'
          }`}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10 text-xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400 font-medium">
              No se encontraron carnes para &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = selectedInsumo?.insumo_id === item.insumo_id;
              const isUnd = item.unidad_medida?.toLowerCase() === 'und' || 
                            item.categoria?.toLowerCase().includes('embutido') || 
                            item.categoria?.toLowerCase().includes('elaborado') || 
                            item.insumo?.toLowerCase().includes('chorizo') || 
                            item.insumo?.toLowerCase().includes('tamal');
              const totalUnits = (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_und || 0);
              const hasStock = isUnd ? totalUnits > 0 : ((item.bodega_sin_porc_kg || 0) > 0 || (item.bodega_porc_und || 0) > 0);

              return (
                <div
                  key={item.insumo_id}
                  onClick={() => {
                    onSelect(item);
                    setQuery(item.insumo);
                    setIsOpen(false);
                  }}
                  className={`p-2.5 px-3.5 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors text-xs ${
                    isSelected ? 'bg-orange-50/80 font-bold' : ''
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs md:text-sm">
                      <span>{item.insumo}</span>
                      {isUnd && <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded">UND</span>}
                      {isSelected && <Check className="w-3.5 h-3.5 text-orange-600 inline" />}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {item.categoria}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className={`text-[11px] font-semibold px-2 py-0.5 rounded border flex items-center justify-end gap-1 ${
                      hasStock 
                        ? 'text-blue-700 bg-blue-50 border-blue-200' 
                        : 'text-slate-400 bg-slate-50 border-slate-200'
                    }`}>
                      {isUnd ? (
                        <span>Bodega: <strong>{totalUnits} und</strong></span>
                      ) : (
                        <span>Bodega: <strong>{item.bodega_sin_porc_kg.toFixed(1)} Kg</strong> | <strong>{item.bodega_porc_und} und</strong></span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-end gap-1.5">
                      {!isUnd && item.peso_porc_gramos > 0 && (
                        <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60">
                          {item.peso_porc_gramos}g/porc
                        </span>
                      )}
                      <span>${formatMoney(item.costo_unitario_kg)}/{isUnd ? 'und' : 'Kg'}</span>
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
