'use client';

import { useMemo } from 'react';
import { InsumoItem } from '@/types';

interface Props {
  insumos?: InsumoItem[];
  selectedCat: string;
  onSelectCat: (cat: string) => void;
}

export default function CategoryFilterChips({ insumos = [], selectedCat, onSelectCat }: Props) {
  const { totalCount, carnesCount, withStockCount, categories } = useMemo(() => {
    const counts: Record<string, number> = {};
    let carnes = 0;
    let withStock = 0;

    insumos.forEach((item) => {
      const cat = (item.categoria || 'SIN CATEGORIA').trim().toUpperCase();
      counts[cat] = (counts[cat] || 0) + 1;
      if (item.es_carne !== false) {
        carnes++;
      }
      const totalBodega = (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0);
      if (totalBodega > 0 || (item.bodega_porc_und || 0) > 0) {
        withStock++;
      }
    });

    const knownKeys = [
      { id: 'CARNE DE RES', label: 'Res' },
      { id: 'CARNE DE CERDO', label: 'Cerdo' },
      { id: 'CARNE POLLO', label: 'Pollo' },
      { id: 'PESCADOS Y MARISCOS', label: 'Pescados y Mariscos' },
      { id: 'EMBUTIDO', label: 'Embutidos' },
      { id: 'MIXTO', label: 'Mixto' },
      { id: 'VERDURAS', label: 'Verduras' },
      { id: 'ELABORADOS', label: 'Elaborados' },
    ];

    const catList: { id: string; label: string; count: number }[] = [];

    knownKeys.forEach((k) => {
      if (counts[k.id]) {
        catList.push({ id: k.id, label: k.label, count: counts[k.id] });
      }
    });

    Object.keys(counts).forEach((catKey) => {
      if (!knownKeys.some((k) => k.id === catKey) && counts[catKey] > 0) {
        catList.push({ id: catKey, label: catKey, count: counts[catKey] });
      }
    });

    return { 
      totalCount: insumos.length, 
      carnesCount: carnes, 
      withStockCount: withStock,
      categories: catList 
    };
  }, [insumos]);

  const isSpecificCat = !['ALL', 'CARNES', 'WITH_STOCK'].includes(selectedCat);

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x py-1 w-full sm:flex-wrap text-xs font-normal">
      {/* Segmented Control para Vista Principal (Con Existencias, Solo Carnes, Todos) */}
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => onSelectCat('WITH_STOCK')}
          className={`px-3 py-1.5 min-h-[36px] sm:min-h-[28px] rounded-md text-xs font-medium transition-all cursor-pointer touch-manipulation active:scale-95 whitespace-nowrap ${
            selectedCat === 'WITH_STOCK'
              ? 'bg-orange-600 text-white shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🥩 Con Existencias ({withStockCount})
        </button>

        <button
          type="button"
          onClick={() => onSelectCat('CARNES')}
          className={`px-3 py-1.5 min-h-[36px] sm:min-h-[28px] rounded-md text-xs font-medium transition-all cursor-pointer touch-manipulation active:scale-95 whitespace-nowrap ${
            selectedCat === 'CARNES'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Solo Carnes ({carnesCount})
        </button>

        <button
          type="button"
          onClick={() => onSelectCat('ALL')}
          className={`px-3 py-1.5 min-h-[36px] sm:min-h-[28px] rounded-md text-xs font-medium transition-all cursor-pointer touch-manipulation active:scale-95 whitespace-nowrap ${
            selectedCat === 'ALL'
              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Todos ({totalCount})
        </button>
      </div>

      {/* Selector Desplegable de Categoría para evitar sobrecarga visual */}
      <div className="relative shrink-0">
        <select
          value={isSpecificCat ? selectedCat : ''}
          onChange={(e) => onSelectCat(e.target.value || 'ALL')}
          className={`h-9 sm:h-7 px-2.5 rounded-lg text-xs font-medium border transition-all cursor-pointer outline-none touch-manipulation ${
            isSpecificCat
              ? 'bg-orange-50 border-orange-300 text-orange-900 font-semibold'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <option value="">Filtrar por categoría...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.count})
            </option>
          ))}
        </select>
      </div>

      {/* Indicador de filtro activo con opción de limpiar */}
      {isSpecificCat && (
        <button
          type="button"
          onClick={() => onSelectCat('ALL')}
          className="text-xs text-slate-400 hover:text-rose-600 transition-colors underline cursor-pointer ml-1 shrink-0 touch-manipulation py-1"
        >
          Limpiar filtro
        </button>
      )}
    </div>
  );
}
