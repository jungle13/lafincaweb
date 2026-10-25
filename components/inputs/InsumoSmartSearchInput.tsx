'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Check } from 'lucide-react';

export interface CatalogItem {
  id: string;
  nombre: string;
  categoria: string;
  precioUnitario: number;
  unidadMedida: string;
  gramaje?: number;
}

interface InsumoSmartSearchInputProps {
  onSelectInsumo: (item: CatalogItem, cantidad: number, unidad: string) => void;
  catalog?: CatalogItem[];
  placeholder?: string;
  label?: string;
  defaultQty?: number;
  onOpenChange?: (isOpen: boolean) => void;
}

const DEFAULT_CATEGORIES = [
  'Todos',
  'Carnes',
  'Verduras',
  'Granos',
  'Desechables',
  'Bebidas',
  'Lácteos'
];

export default function InsumoSmartSearchInput({
  onSelectInsumo,
  catalog = [],
  placeholder = 'Buscar cualquier insumo (ej: Punta de anca, Arroz, Vasos, Huevos, Leche)...',
  label = 'Añadir insumo:',
  defaultQty = 1,
  onOpenChange
}: InsumoSmartSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [qty, setQty] = useState<number>(defaultQty);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const updateIsOpen = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const filteredItems = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return catalog.filter(it => {
      if (selectedCategory !== 'Todos' && !it.categoria.toLowerCase().includes(selectedCategory.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      return it.nombre.toLowerCase().includes(q) || it.categoria.toLowerCase().includes(q);
    }).slice(0, 20);
  }, [catalog, searchText, selectedCategory]);

  const handleSelect = (item: CatalogItem) => {
    onSelectInsumo(item, qty, item.unidadMedida);
    updateIsOpen(false);
    setSearchText('');
    setQty(defaultQty);
  };

  return (
    <div className={`relative pt-1 ${isOpen ? 'z-50' : 'z-10'}`}>
      {label && (
        <div className="text-[11px] font-medium text-slate-500 mb-1">
          {label}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onFocus={() => {
              updateIsOpen(true);
              setSelectedCategory('Todos');
            }}
            onChange={(e) => {
              setSearchText(e.target.value);
              if (!isOpen) updateIsOpen(true);
            }}
            placeholder={placeholder}
            className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-500 shadow-2xs transition-colors"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-2 py-1 shadow-2xs shrink-0">
          <span className="text-[10px] text-slate-400 font-medium">Cant:</span>
          <input
            type="number"
            min="0.1"
            step="any"
            value={qty}
            onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
            onFocus={() => updateIsOpen(true)}
            className="w-12 text-center font-mono font-bold text-xs bg-transparent focus:outline-none text-slate-900"
          />
        </div>
      </div>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={() => updateIsOpen(false)} 
          />

          <div className="absolute left-0 top-full mt-2 w-[420px] max-w-[95vw] bg-white border border-slate-300 rounded-lg shadow-2xl z-50 p-2.5 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 px-1">
              <span className="text-[11px] font-bold text-slate-800">
                Catálogo de Insumos ({qty} und/kg)
              </span>
              <button
                type="button"
                onClick={() => updateIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Categorías pill */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {DEFAULT_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 text-[10px] rounded font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Lista de insumos */}
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-md text-xs">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="p-2 px-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div>
                    <div className="font-semibold text-slate-900 group-hover:text-slate-950">
                      {item.nombre}
                    </div>
                    <span className="text-[9px] uppercase font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 mt-0.5 inline-block">
                      {item.categoria}
                    </span>
                  </div>

                  <div className="text-right text-[11px] font-mono text-slate-700">
                    <div>${item.precioUnitario.toLocaleString('es-CO')}/{item.unidadMedida}</div>
                    {item.gramaje ? (
                      <div className="text-[10px] text-slate-400">{item.gramaje}g/porc</div>
                    ) : null}
                  </div>
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  No se encontraron insumos coincidentes.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
