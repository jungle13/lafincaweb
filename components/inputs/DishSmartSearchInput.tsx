'use client';

import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { RECETAS_PLATOS_POS, PlatoReceta } from '@/lib/recetasData';

interface DishSmartSearchInputProps {
  onSelectDish: (plato: PlatoReceta, cantidad: number) => void;
  placeholder?: string;
  defaultQty?: number;
  label?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

const CATEGORIAS_FILTRO = ['Todos', 'Cerdo', 'Carnes Rojas', 'Pescados', 'Abarrotes', 'Acompañamiento'];

export default function DishSmartSearchInput({
  onSelectDish,
  placeholder = 'Buscar plato (ej: 118, Paisa)...',
  defaultQty = 1,
  label = 'Añadir plato vendido:',
  onOpenChange
}: DishSmartSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [qty, setQty] = useState<number>(defaultQty);
  const [selectedCat, setSelectedCat] = useState<string>('Todos');

  const updateIsOpen = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  const filteredPlatos = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return RECETAS_PLATOS_POS.filter(dish => {
      if (selectedCat !== 'Todos' && dish.categoria !== selectedCat) {
        return false;
      }
      if (!q) return true;
      const name = dish.nombre.toLowerCase();
      const code = dish.codigoPos.toLowerCase();
      const meat = dish.insumoCarnico.toLowerCase();
      return name.includes(q) || code.includes(q) || meat.includes(q);
    }).slice(0, 15);
  }, [searchText, selectedCat]);

  const handleSelect = (plato: PlatoReceta) => {
    onSelectDish(plato, qty);
    updateIsOpen(false);
    setSearchText('');
    setQty(defaultQty);
  };

  return (
    <div className={`relative pt-1 ${isOpen ? 'z-50' : 'z-10'}`}>
      {label && (
        <div className="text-[11px] font-medium text-slate-500 mb-1 flex items-center justify-between">
          <span>{label}</span>
        </div>
      )}

      {/* Barra de input directo + selector de cantidad */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onFocus={() => {
              updateIsOpen(true);
              setSelectedCat('Todos');
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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Input de Cantidad Vendida */}
        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-2 py-1 shadow-2xs shrink-0" title="Cantidad vendida">
          <span className="text-[10px] text-slate-400 font-medium">Cant:</span>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            onFocus={() => updateIsOpen(true)}
            className="w-8 text-center font-mono font-bold text-xs bg-transparent focus:outline-none text-slate-900"
          />
        </div>
      </div>

      {/* DROPDOWN FLOTANTE DESPLEGADO POR ENCIMA (position absolute, z-50 sin deformar container) */}
      {isOpen && (
        <>
          {/* Backdrop para cerrar al hacer clic fuera */}
          <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={() => updateIsOpen(false)} 
          />

          <div className="absolute left-0 top-full mt-2 w-[340px] sm:w-[380px] bg-white border border-slate-300 rounded-lg shadow-2xl z-50 p-2.5 space-y-2 animate-fade-in">
            {/* Header del dropdown */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 px-1">
              <span className="text-[11px] font-bold text-slate-800">
                Vincular Plato ({qty} {qty === 1 ? 'unidad' : 'unidades'})
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Categorías filtro rápidas */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {CATEGORIAS_FILTRO.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCat(cat)}
                  className={`px-2 py-0.5 text-[10px] rounded font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCat === cat
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Lista de resultados */}
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-md">
              {filteredPlatos.map(plato => (
                <div
                  key={plato.id}
                  onClick={() => handleSelect(plato)}
                  className="p-2 px-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-slate-950 truncate">
                      <span className="font-mono text-slate-400 font-normal mr-1">#{plato.codigoPos}</span>
                      <span>{plato.nombre}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {plato.categoria} • {plato.insumoCarnico}
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono text-slate-700 shrink-0">
                    <span className="font-bold text-slate-900">+{qty} und</span>
                    <div className="text-[10px] text-slate-400">
                      {(plato.porcionesCount * qty)} porc
                    </div>
                  </div>
                </div>
              ))}

              {filteredPlatos.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  No se encontraron platos coincidentes.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
