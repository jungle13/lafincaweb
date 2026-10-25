'use client';

import React from 'react';
import { Calendar } from 'lucide-react';

export interface MonthItem {
  key: string;
  label: string;
  count: number;
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
