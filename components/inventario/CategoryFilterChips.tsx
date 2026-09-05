'use client';

import { useMemo } from 'react';
import { InsumoItem } from '@/types';
import { normalizeStr } from '@/lib/formatters';

interface Props {
  insumos?: InsumoItem[];
  selectedCat: string;
  onSelectCat: (cat: string) => void;
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  'CARNE DE RES': { label: 'Res', icon: '🥩' },
  'CARNE DE CERDO': { label: 'Cerdo', icon: '🐷' },
  'CARNE POLLO': { label: 'Pollo', icon: '🍗' },
  'PESCADOS Y MARISCOS': { label: 'Pescados y Mariscos', icon: '🐟' },
  'PESCADOS': { label: 'Pescados y Mariscos', icon: '🐟' },
  'EMBUTIDO': { label: 'Embutidos', icon: '🌭' },
  'EMBUTIDOS': { label: 'Embutidos', icon: '🌭' },
  'MIXTO': { label: 'Mixto', icon: '🥓' },
  'VERDURAS': { label: 'Verduras', icon: '🥗' },
  'ELABORADOS': { label: 'Elaborados', icon: '🍱' },
};

export default function CategoryFilterChips({ insumos = [], selectedCat, onSelectCat }: Props) {
  const categoriesList = useMemo(() => {
    const counts: Record<string, number> = {};
    let carnesCount = 0;

    insumos.forEach((item) => {
      const cat = (item.categoria || 'SIN CATEGORIA').trim().toUpperCase();
      counts[cat] = (counts[cat] || 0) + 1;
      if (item.es_carne !== false) {
        carnesCount++;
      }
    });

    const totalCount = insumos.length;

    // Lista ordenada de categorías con Todas y Solo Carnes al inicio
    const list = [
      { id: 'ALL', label: 'Todos los Insumos', count: totalCount, icon: '📋' },
      { id: 'CARNES', label: 'Solo Carnes', count: carnesCount, icon: '🥩' },
    ];

    const knownKeys = [
      'CARNE DE RES',
      'CARNE DE CERDO',
      'CARNE POLLO',
      'PESCADOS Y MARISCOS',
      'EMBUTIDO',
      'MIXTO',
      'VERDURAS',
      'ELABORADOS'
    ];

    knownKeys.forEach((key) => {
      if (counts[key]) {
        const meta = CATEGORY_META[key] || { label: key, icon: '📦' };
        list.push({
          id: key,
          label: meta.label,
          count: counts[key],
          icon: meta.icon,
        });
      }
    });

    // Otras categorías no contempladas
    Object.keys(counts).forEach((catKey) => {
      if (!knownKeys.includes(catKey) && counts[catKey] > 0) {
        const meta = CATEGORY_META[catKey] || { label: catKey, icon: '📦' };
        list.push({
          id: catKey,
          label: meta.label,
          count: counts[catKey],
          icon: meta.icon,
        });
      }
    });

    return list;
  }, [insumos]);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar scroll-smooth">
      {categoriesList.map((cat) => {
        const isActive = selectedCat === cat.id;

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCat(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
              isActive
                ? 'bg-orange-600 border-orange-600 text-white font-semibold shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {cat.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

