'use client';

import React from 'react';
import { X } from 'lucide-react';

export interface InsumoRecetaData {
  id: string;
  insumo_id?: string;
  codigo_insumo?: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  unidad: string;
  costoUnitario: number;
  costoCalculado: number;
}

interface InsumoRecetaCardProps {
  insumo: InsumoRecetaData;
  onUpdateQty: (insumoId: string, newQty: number) => void;
  onRemove: (insumoId: string) => void;
}

export default function InsumoRecetaCard({
  insumo,
  onUpdateQty,
  onRemove
}: InsumoRecetaCardProps) {
  const isKg = insumo.unidad.toLowerCase() === 'kg';
  const isGram = insumo.unidad.toLowerCase() === 'g';
  const stepVal = isKg ? 0.05 : isGram ? 50 : 1;
  const minVal = isKg ? 0.01 : isGram ? 10 : 0.5;

  const handleStep = (delta: number) => {
    const next = Math.max(minVal, Number((insumo.cantidad + delta).toFixed(3)));
    onUpdateQty(insumo.id, next);
  };

  return (
    <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-2.5 px-3 shadow-2xs transition-colors flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        {/* Título del Insumo y Categoría */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-900 truncate">
            {insumo.nombre}
          </span>
          <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
            {insumo.categoria}
          </span>
        </div>

        {/* Controles de Cantidad Modificable por el Usuario + Costo */}
        <div className="mt-2 flex items-center justify-between text-[11px] gap-2">
          {/* Stepper para modificar cantidad */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium text-[10px]">Cant:</span>
            <div className="flex items-center border border-slate-200 rounded bg-slate-50 text-[11px]">
              <button
                type="button"
                onClick={() => handleStep(-stepVal)}
                className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-200 rounded-l font-bold transition-colors cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                min={minVal}
                step="any"
                value={insumo.cantidad}
                onChange={(e) => onUpdateQty(insumo.id, Math.max(minVal, parseFloat(e.target.value) || minVal))}
                className="w-14 text-center font-mono font-bold text-slate-900 text-xs bg-white border-x border-slate-200 py-0.5 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleStep(stepVal)}
                className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-200 rounded-r font-bold transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
            <span className="text-[10px] text-slate-500 font-mono font-semibold">
              {insumo.unidad}
            </span>
          </div>

          {/* Costo Calculado del Insumo en este Plato */}
          <div className="text-right font-mono shrink-0">
            <span className="text-[10px] text-slate-400 mr-1">Costo:</span>
            <span className="text-slate-800 font-bold">
              ${Math.round(insumo.costoCalculado).toLocaleString('es-CO')}
            </span>
          </div>
        </div>
      </div>

      {/* Botón X para remover el insumo de la receta */}
      <button
        type="button"
        onClick={() => onRemove(insumo.id)}
        className="text-slate-300 hover:text-rose-600 p-0.5 rounded transition-colors -mr-1 -mt-1 cursor-pointer"
        title="Quitar este insumo de la receta"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
