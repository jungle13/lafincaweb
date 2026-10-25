'use client';

import React from 'react';
import { X } from 'lucide-react';

export interface DishSoldCardData {
  id: string;
  codigoPos: string;
  nombrePlato: string;
  cantidad: number;
  porcionesDeducidas: number;
  kgDeducidos: number;
  unidadMedida?: string;
}

interface DishSoldCardProps {
  dish: DishSoldCardData;
  unidadMedida?: string;
  onRemove: (dishId: string) => void;
}

export default function DishSoldCard({
  dish,
  unidadMedida = 'porc',
  onRemove
}: DishSoldCardProps) {
  return (
    <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-2.5 px-3.5 shadow-2xs transition-colors flex items-start justify-between gap-2.5">
      <div className="min-w-0 flex-1">
        {/* Título del Plato */}
        <div className="text-xs font-bold text-slate-900 truncate">
          <span className="font-mono text-slate-400 font-medium mr-1.5">#{dish.codigoPos}</span>
          <span>{dish.nombrePlato}</span>
        </div>

        {/* Dos datos indispensables: Platos Vendidos e Insumos Usados */}
        <div className="mt-1.5 flex flex-col gap-0.5 text-[11px]">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-slate-400">Platos Vendidos:</span>
            <span className="font-mono font-bold text-slate-900">{dish.cantidad} und</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-slate-400">Insumos Usados:</span>
            <span className="font-mono font-semibold text-slate-800">
              {dish.porcionesDeducidas} {dish.unidadMedida || unidadMedida} ({dish.kgDeducidos} Kg)
            </span>
          </div>
        </div>
      </div>

      {/* Botón discreto para retirar plato */}
      <button
        type="button"
        onClick={() => onRemove(dish.id)}
        className="text-slate-300 hover:text-rose-600 p-0.5 rounded transition-colors -mr-1 -mt-1 cursor-pointer"
        title="Quitar plato"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
