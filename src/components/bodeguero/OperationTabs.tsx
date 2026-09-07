'use client';

import { PlusCircle, Scissors, ArrowRightCircle, CornerDownLeft, Trash2 } from 'lucide-react';

export type OperationType = 'ENTRADA_COMPRA' | 'PORCIONADO' | 'TRASLADO_COCINA' | 'DEVOLUCION_COCINA' | 'BAJA_MERMA';

interface Props {
  activeTab: OperationType;
  onChangeTab: (tab: OperationType) => void;
}

const TABS = [
  { id: 'ENTRADA_COMPRA' as OperationType, label: '1. Compra', icon: PlusCircle },
  { id: 'PORCIONADO' as OperationType, label: '2. Porcionado', icon: Scissors },
  { id: 'TRASLADO_COCINA' as OperationType, label: '3. A Cocina', icon: ArrowRightCircle },
  { id: 'DEVOLUCION_COCINA' as OperationType, label: '4. Devolución', icon: CornerDownLeft },
  { id: 'BAJA_MERMA' as OperationType, label: '5. Merma/Baja', icon: Trash2 },
];

export default function OperationTabs({ activeTab, onChangeTab }: Props) {
  return (
    <div className="flex items-center overflow-x-auto no-scrollbar scroll-smooth bg-slate-50/90 border-b border-slate-200 w-full px-1 touch-pan-x">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`flex-shrink-0 flex items-center justify-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer select-none whitespace-nowrap ${
              isActive
                ? 'bg-white border-orange-500 text-orange-600 font-bold shadow-[0_-2px_6px_rgba(0,0,0,0.02)]'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 font-medium'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-orange-500' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
