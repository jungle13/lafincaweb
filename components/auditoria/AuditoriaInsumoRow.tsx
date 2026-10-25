'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PlatoReceta } from '@/lib/recetasData';
import DishSmartSearchInput from '@/components/inputs/DishSmartSearchInput';
import DishSoldCard, { DishSoldCardData } from './DishSoldCard';

export interface InsumoAuditItem {
  id: string;
  insumo: string;
  categoria: string;
  pesoPorcionGramos: number;
  unidadMedida: string;
  costoUnitarioKg: number;
  totalDisponiblePorciones: number;
  amanecePorciones?: number;
  bajadasPorciones?: number;
  platos: DishSoldCardData[];
}

interface AuditoriaInsumoRowProps {
  item: InsumoAuditItem;
  onAddDish: (proteinaId: string, plato: PlatoReceta, qty: number) => void;
  onRemoveDish: (proteinaId: string, dishId: string) => void;
  onDeleteRow: (proteinaId: string) => void;
}

export default function AuditoriaInsumoRow({
  item,
  onAddDish,
  onRemoveDish,
  onDeleteRow
}: AuditoriaInsumoRowProps) {
  const [isSearching, setIsSearching] = useState(false);

  const totalDispPorciones = item.totalDisponiblePorciones !== undefined
    ? item.totalDisponiblePorciones
    : ((item.amanecePorciones || 0) + (item.bajadasPorciones || 0));
  const totalDispKg = Number(((totalDispPorciones * item.pesoPorcionGramos) / 1000).toFixed(2));

  const totalConsumoPorciones = item.platos.reduce((acc, d) => acc + d.porcionesDeducidas, 0);
  const totalConsumoKg = Number(item.platos.reduce((acc, d) => acc + d.kgDeducidos, 0).toFixed(2));

  const difPorciones = totalDispPorciones - totalConsumoPorciones;
  const difKg = Number((totalDispKg - totalConsumoKg).toFixed(2));
  const isDescuadre = difPorciones < 0;

  return (
    <div
      className={`bg-white border rounded-lg shadow-2xs transition-all relative ${
        isSearching ? 'z-40' : 'z-10'
      } ${
        isDescuadre ? 'border-rose-300' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col md:flex-row items-stretch">
        {/* LADO IZQUIERDO: Resumen no editable + Buscador Inteligente */}
        <div className="w-full md:w-80 lg:w-[350px] p-4 md:p-5 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between space-y-3.5 relative rounded-l-lg">
          <div className="space-y-3">
            {/* Título y Borrar Fila */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isDescuadre ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
                <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-snug">
                  {item.insumo}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onDeleteRow(item.id)}
                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                title="Eliminar insumo de la auditoría"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Resumen: Total Disponible (Fijo), Total Usado, Saldo */}
            <div className="space-y-2 text-xs bg-slate-50/70 border border-slate-200/80 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-500 font-medium">Total Disponible:</span>
                <span className="font-bold text-slate-900 font-mono text-xs">
                  {totalDispPorciones} {item.unidadMedida} <span className="text-[11px] text-slate-400 font-normal">({totalDispKg} Kg)</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600 pt-0.5">
                <span className="text-slate-500 font-medium">Total Usado:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {totalConsumoPorciones} {item.unidadMedida} <span className="text-[11px] text-slate-400 font-normal">({totalConsumoKg} Kg)</span>
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80">
                <span className="font-medium text-slate-700">Saldo:</span>
                <span className={`font-mono font-bold text-xs ${
                  isDescuadre ? 'text-rose-600' : 'text-emerald-700'
                }`}>
                  {difPorciones >= 0 ? `+${difPorciones}` : difPorciones} {item.unidadMedida}
                  <span className="text-[11px] font-normal ml-1">
                    ({difPorciones >= 0 ? `+${difKg}` : difKg} Kg)
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Buscador inteligente de platos POS */}
          <DishSmartSearchInput
            onSelectDish={(plato, qty) => onAddDish(item.id, plato, qty)}
            onOpenChange={setIsSearching}
          />
        </div>

        {/* LADO DERECHO: Rejilla de 2 Columnas de Platos Asignados */}
        <div className="flex-1 p-4 md:p-5 flex flex-col justify-center bg-white rounded-r-lg">
          {item.platos.length === 0 ? (
            <div className="h-full min-h-[90px] border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400 p-4">
              No hay platos asignados aún. Usa el buscador de la izquierda para vincular platos vendidos.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-start">
              {item.platos.map(dish => (
                <DishSoldCard
                  key={dish.id}
                  dish={dish}
                  unidadMedida={item.unidadMedida}
                  onRemove={(dId) => onRemoveDish(item.id, dId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
