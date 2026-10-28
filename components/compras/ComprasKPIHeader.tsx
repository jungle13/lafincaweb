'use client';

import { DollarSign, Receipt, Package, Layers } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { ComprasKPIs } from '@/services/comprasService';

interface Props {
  kpis: ComprasKPIs;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  periodoNombre?: string;
}

export default function ComprasKPIHeader({
  kpis,
  selectedCategory,
  onSelectCategory,
  periodoNombre,
}: Props) {
  return (
    <div className="space-y-3">
      {/* 1. Métricas Principales Consolidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Invertido */}
        <div className="bg-white rounded-lg p-3.5 border border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Compras (Materia Prima)
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-md">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight font-mono">
              $ {formatMoney(kpis.totalDinero)}
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Costo directo acumulado {periodoNombre ? `(${periodoNombre})` : ''}
            </div>
          </div>
        </div>

        {/* Facturas Registradas */}
        <div className="bg-white rounded-lg p-3.5 border border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Facturas / Comprobantes
            </span>
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded-md">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {kpis.totalFacturas}{' '}
              <span className="text-xs font-normal text-slate-500">facturas</span>
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Documentos físicos y digitales auditados
            </div>
          </div>
        </div>

        {/* Total Ítems de Compra */}
        <div className="bg-white rounded-lg p-3.5 border border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Ítems y Entradas
            </span>
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-md">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {kpis.totalItems}{' '}
              <span className="text-xs font-normal text-slate-500">compras</span>
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Líneas de insumos detalladas
            </div>
          </div>
        </div>
      </div>

      {/* 2. Resumen Rápido por Categorías (Costos Directos / Materia Prima) */}
      <div className="bg-white rounded-lg p-3 border border-slate-200">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Costos Directos (Materia Prima e Insumos por Categoría)
            </h3>
          </div>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => onSelectCategory('')}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
            >
              Limpiar filtro ({selectedCategory})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {kpis.categorias.map((cat) => {
            const isSelected = selectedCategory === cat.categoria;
            return (
              <button
                key={cat.categoria}
                type="button"
                onClick={() => onSelectCategory(isSelected ? '' : cat.categoria)}
                className={`p-2 rounded-md text-left transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                    : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <div className="text-[10px] uppercase font-semibold tracking-wider truncate mb-1">
                  {cat.categoria}
                </div>
                <div
                  className={`text-xs md:text-sm font-bold font-mono ${
                    isSelected ? 'text-emerald-300' : 'text-slate-900'
                  }`}
                >
                  $ {formatMoney(cat.totalDinero)}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>{cat.numCompras} compras</span>
                  <span className="font-mono">{cat.porcentaje.toFixed(1)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
