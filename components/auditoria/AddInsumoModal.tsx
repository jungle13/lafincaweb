'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddInsumoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    nombre: string;
    pesoPorcionGramos: number;
    unidadMedida: string;
    costoUnitarioKg: number;
    totalDisponible: number;
  }) => void;
}

export default function AddInsumoModal({
  isOpen,
  onClose,
  onAdd
}: AddInsumoModalProps) {
  const [nombre, setNombre] = useState('');
  const [pesoPorcionGramos, setPesoPorcionGramos] = useState(350);
  const [unidadMedida, setUnidadMedida] = useState('porc');
  const [costoUnitarioKg, setCostoUnitarioKg] = useState(24000);
  const [totalDisponible, setTotalDisponible] = useState(10);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    onAdd({
      nombre: nombre.trim().toUpperCase(),
      pesoPorcionGramos,
      unidadMedida,
      costoUnitarioKg,
      totalDisponible
    });

    setNombre('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-sm font-bold text-slate-900">
            Añadir Insumo a la Auditoría
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre del Insumo / Proteína:
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: PUNTA DE ANCA (400g), TRUCHA ARCOÍRIS, SALMÓN..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-500"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gramaje por porción (g):
              </label>
              <input
                type="number"
                value={pesoPorcionGramos}
                onChange={(e) => setPesoPorcionGramos(parseInt(e.target.value) || 200)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unidad de Medida:
              </label>
              <select
                value={unidadMedida}
                onChange={(e) => setUnidadMedida(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700"
              >
                <option value="porc">Porciones (porc)</option>
                <option value="und">Unidades (und)</option>
                <option value="Kg">Kilogramos (Kg)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Total Disponible (Existencias de la jornada):
            </label>
            <input
              type="number"
              min="0"
              value={totalDisponible}
              onChange={(e) => setTotalDisponible(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-mono text-slate-900 font-bold"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              Añadir Insumo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
