'use client';

import React from 'react';
import { Calendar } from 'lucide-react';

export interface MonthItem {
  key: string;
  label: string;
  count: number;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Convierte una clave tipo 'YYYY-MM' (ej: '2026-11') en un nombre amigable: 'Noviembre 2026'
 */
export function formatMonthLabel(key: string): string {
  if (!key || typeof key !== 'string') return key || '';
  const parts = key.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const mNum = parseInt(parts[1], 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${MONTH_NAMES[mNum - 1]} ${year}`;
    }
  }
  return key;
}

/**
 * Construye de forma dinámica la lista de meses disponibles a partir de cualquier lista
 * de objetos que tengan `month` o `dateStr`.
 * Si se pasa `selectedMonth`, asegura que dicho mes aparezca en la lista aunque tenga 0 elementos.
 */
export function buildDynamicMonths(
  items: { month?: string; dateStr?: string }[],
  selectedMonth?: string,
  extraMonthKeys?: string[]
): MonthItem[] {
  const map = new Map<string, number>();

  items.forEach(it => {
    const mKey = it.month || (it.dateStr ? it.dateStr.slice(0, 7) : '');
    if (mKey && mKey.length >= 7) {
      map.set(mKey, (map.get(mKey) || 0) + 1);
    }
  });

  if (extraMonthKeys && Array.isArray(extraMonthKeys)) {
    extraMonthKeys.forEach(k => {
      const cleanKey = k.replace(/^per-/, '');
      if (cleanKey && cleanKey.length >= 7 && !map.has(cleanKey)) {
        map.set(cleanKey, 0);
      }
    });
  }

  if (selectedMonth && selectedMonth.length >= 7 && !map.has(selectedMonth)) {
    map.set(selectedMonth, 0);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // Más reciente primero
    .map(([key, count]) => ({
      key,
      label: formatMonthLabel(key),
      count
    }));
}

interface MonthSidebarProps {
  months: MonthItem[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  title?: string;
}

export default function MonthSidebar({
  months,
  selectedMonth,
  onSelectMonth,
  title = 'Meses'
}: MonthSidebarProps) {
  return (
    <aside className="w-full md:w-56 p-4 border-r border-slate-200 bg-slate-50/60 shrink-0 space-y-1">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
        {title}
      </p>
      {months.map(m => (
        <button
          key={m.key}
          type="button"
          onClick={() => onSelectMonth(m.key)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium text-left transition-colors cursor-pointer ${
            selectedMonth === m.key
              ? 'bg-slate-200/80 text-slate-900 font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>{m.label}</span>
          </div>
          <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
            {m.count}
          </span>
        </button>
      ))}
    </aside>
  );
}
