'use client';

import React from 'react';
import Link from 'next/link';
import { TableProperties, FileSpreadsheet, Plus, X, LucideIcon } from 'lucide-react';

export interface SheetTabItem {
  id: string;
  title: string;
}

interface SheetTabsBarProps {
  mainTabLabel: string;
  mainTabIcon?: LucideIcon;
  activeTabId: string | null;
  openTabs: string[];
  sheets: SheetTabItem[];
  onSelectMainTab: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (e: React.MouseEvent, tabId: string) => void;
  onNewSheetClick: () => void;
  rightAction?: React.ReactNode;
}

export default function SheetTabsBar({
  mainTabLabel,
  mainTabIcon: MainIcon = TableProperties,
  activeTabId,
  openTabs,
  sheets,
  onSelectMainTab,
  onSelectTab,
  onCloseTab,
  onNewSheetClick,
  rightAction
}: SheetTabsBarProps) {
  return (
    <div className="bg-slate-100/90 border-b border-slate-200 px-3 pt-2 flex items-center justify-between overflow-x-auto select-none">
      <div className="flex items-center gap-1 min-w-0">
        {/* Pestaña Principal (ej: Vistas de Auditoría / Vistas de Costeo) */}
        <button
          onClick={onSelectMainTab}
          className={`flex items-center gap-2 px-3 py-2 text-xs rounded-t-md transition-colors border-t-2 ${
            activeTabId === null
              ? 'bg-white text-slate-900 border-orange-600 font-semibold shadow-2xs border-x border-slate-200'
              : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60 font-medium'
          }`}
        >
          <MainIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>{mainTabLabel}</span>
        </button>

        {/* Pestañas de Hojas Abiertas */}
        {openTabs.map(tabId => {
          const sh = sheets.find(s => s.id === tabId);
          if (!sh) return null;
          const isActive = activeTabId === tabId;

          return (
            <div
              key={tabId}
              onClick={() => onSelectTab(tabId)}
              className={`group flex items-center gap-2 px-3 py-2 text-xs rounded-t-md cursor-pointer transition-all border-t-2 max-w-[240px] ${
                isActive
                  ? 'bg-white text-slate-900 border-orange-600 font-semibold shadow-2xs border-x border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60 font-medium'
              }`}
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-600' : 'text-slate-400'}`} />
              <span className="truncate">{sh.title.split(' - ')[0]}</span>
              <button
                type="button"
                onClick={(e) => onCloseTab(e, tabId)}
                className="opacity-60 hover:opacity-100 hover:bg-slate-200 p-0.5 rounded text-slate-400 hover:text-slate-700"
                title="Cerrar pestaña"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* Botón "+" para crear nueva hoja */}
        <button
          type="button"
          onClick={onNewSheetClick}
          className="p-1.5 ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors cursor-pointer flex items-center justify-center"
          title="Crear nueva hoja"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {rightAction && (
        <div className="shrink-0 ml-2">
          {rightAction}
        </div>
      )}
    </div>
  );
}
