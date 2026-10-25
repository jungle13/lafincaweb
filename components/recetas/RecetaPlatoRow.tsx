'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import InsumoRecetaCard, { InsumoRecetaData } from './InsumoRecetaCard';
import InsumoSmartSearchInput, { CatalogItem } from '@/components/inputs/InsumoSmartSearchInput';

export interface RecetaPlatoItem {
  id: string;
  codigoPos: string;
  nombre: string;
  categoria: string;
  precioVentaPos: number;
  ingredientes: InsumoRecetaData[];
}

interface RecetaPlatoRowProps {
  plato: RecetaPlatoItem;
  catalogInsumos: CatalogItem[];
  onAddInsumo: (platoId: string, item: CatalogItem, cantidad: number, unidad: string) => void;
  onUpdateInsumoQty: (platoId: string, insumoId: string, newQty: number) => void;
  onRemoveInsumo: (platoId: string, insumoId: string) => void;
  onDeletePlato: (platoId: string) => void;
}

export default function RecetaPlatoRow({
  plato,
  catalogInsumos,
  onAddInsumo,
  onUpdateInsumoQty,
  onRemoveInsumo,
  onDeletePlato
}: RecetaPlatoRowProps) {
  const [isSearching, setIsSearching] = useState(false);

  // Cálculo de Costo Total del Plato y Margen Bruto
  const costoTotal = plato.ingredientes.reduce((acc, ing) => acc + ing.costoCalculado, 0);
  const margenDinero = Math.max(0, plato.precioVentaPos - costoTotal);
  const margenPorcentaje = plato.precioVentaPos > 0 
    ? Number(((margenDinero / plato.precioVentaPos) * 100).toFixed(1))
    : 0;

  return (
    <div className={`bg-white border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all relative ${
      isSearching ? 'z-40' : 'z-10'
    }`}>
      <div className="flex flex-col md:flex-row items-stretch">
        
        {/* LADO IZQUIERDO: Plato de Comida, Precios, Costo, Margen y Buscador Inteligente */}
        <div className="w-full md:w-80 lg:w-[350px] p-4 md:p-5 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between space-y-3.5 relative rounded-l-lg">
          <div className="space-y-3">
            {/* Título del Plato y Botón Eliminar */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-slate-400">
                    #{plato.codigoPos}
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-snug">
                    {plato.nombre}
                  </h2>
                </div>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 inline-block">
                  {plato.categoria}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onDeletePlato(plato.id)}
                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer shrink-0"
                title="Eliminar plato de recetas"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Resumen Financiero: Precio Venta POS, Costo Total Insumos, Margen */}
            <div className="space-y-2 text-xs bg-slate-50/70 border border-slate-200/80 rounded-lg p-3">
              {/* Precio de Venta al Público en POS */}
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-500 font-medium">Precio Venta POS:</span>
                <span className="font-bold text-slate-900 font-mono text-xs">
                  ${plato.precioVentaPos.toLocaleString('es-CO')}
                </span>
              </div>

              {/* Costo Total de Insumos (Suma de escandallo) */}
              <div className="flex items-center justify-between text-slate-600 pt-0.5">
                <span className="text-slate-500 font-medium">Costo Insumos:</span>
                <span className="font-semibold text-slate-800 font-mono">
                  ${Math.round(costoTotal).toLocaleString('es-CO')}
                </span>
              </div>

              {/* Margen Bruto Estimado */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80">
                <span className="font-medium text-slate-700">Margen Bruto:</span>
                <span className="font-mono font-bold text-xs text-emerald-700">
                  {margenPorcentaje}%
                  <span className="text-[11px] font-normal text-slate-500 ml-1">
                    (${Math.round(margenDinero).toLocaleString('es-CO')})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Buscador Inteligente para Añadir Cualquier Insumo a la Receta */}
          <InsumoSmartSearchInput
            catalog={catalogInsumos}
            onSelectInsumo={(item, cant, unidad) => onAddInsumo(plato.id, item, cant, unidad)}
            label="Añadir insumo a la receta:"
            placeholder="Buscar insumo (ej: Papa, Carne, Arroz, Vasos)..."
            onOpenChange={setIsSearching}
          />
        </div>

        {/* LADO DERECHO: Rejilla en 2 Columnas de Insumos Necesarios */}
        <div className="flex-1 p-4 md:p-5 flex flex-col justify-center bg-white rounded-r-lg">
          {plato.ingredientes.length === 0 ? (
            <div className="h-full min-h-[90px] border border-dashed border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400 p-4">
              No hay insumos registrados para esta receta. Usa el buscador de la izquierda para vincular ingredientes.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-start">
              {plato.ingredientes.map(insumo => (
                <InsumoRecetaCard
                  key={insumo.id}
                  insumo={insumo}
                  onUpdateQty={(insumoId, newQty) => onUpdateInsumoQty(plato.id, insumoId, newQty)}
                  onRemove={(insumoId) => onRemoveInsumo(plato.id, insumoId)}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
