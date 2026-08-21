'use client';

import { PlusCircle, Scissors, ArrowRightCircle, CornerDownLeft } from 'lucide-react';

export type OperationType = 'ENTRADA_COMPRA' | 'PORCIONADO' | 'TRASLADO_COCINA' | 'DEVOLUCION_COCINA';

interface Props {
  activeTab: OperationType;
  onChangeTab: (tab: OperationType) => void;
}

const TABS = [
  { id: 'ENTRADA_COMPRA' as OperationType, label: '1. Compra', icon: PlusCircle, activeColor: 'bg-blue-600 border-blue-500 text-white' },
  { id: 'PORCIONADO' as OperationType, label: '2. Porcionado', icon: Scissors, activeColor: 'bg-purple-600 border-purple-500 text-white' },
  { id: 'TRASLADO_COCINA' as OperationType, label: '3. A Cocina', icon: ArrowRightCircle, activeColor: 'bg-orange-600 border-orange-500 text-white' },
  { id: 'DEVOLUCION_COCINA' as OperationType, label: '4. Devolución', icon: CornerDownLeft, activeColor: 'bg-emerald-600 border-emerald-500 text-white' },
];

export default function OperationTabs({ activeTab, onChangeTab }: Props) {
  return (
    <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-slate-900 rounded-t-2xl border-b border-slate-800">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-xs md:text-sm font-bold transition-all border ${
              isActive
                ? `${tab.activeColor} shadow-lg scale-[1.02]`
                : 'bg-slate-800/80 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-white stroke-[2.5]' : 'text-slate-400'}`} />
            <span className="tracking-tight truncate max-w-full">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
