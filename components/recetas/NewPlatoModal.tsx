'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface NewPlatoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (plato: {
    codigoPos: string;
    nombre: string;
    categoria: string;
    precioVentaPos: number;
  }) => void;
}

export default function NewPlatoModal({
  isOpen,
  onClose,
  onCreate
}: NewPlatoModalProps) {
  const [codigoPos, setCodigoPos] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Platos Fuertes');
  const [precioVentaPos, setPrecioVentaPos] = useState<number>(35000);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !codigoPos.trim()) return;

    onCreate({
      codigoPos: codigoPos.trim(),
      nombre: nombre.trim(),
      categoria,
      precioVentaPos: Math.max(0, precioVentaPos || 0)
    });

    setCodigoPos('');
    setNombre('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-sm font-bold text-slate-900">
            Nuevo Plato para Receta / Escandallo
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
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cód. POS:
              </label>
              <input
                type="text"
                value={codigoPos}
                onChange={(e) => setCodigoPos(e.target.value)}
                placeholder="Ej: 125"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-500"
                required
                autoFocus
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría:
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700"
              >
                <option value="Platos Fuertes">Platos Fuertes</option>
                <option value="Especialidades">Especialidades</option>
                <option value="Pescados">Pescados</option>
                <option value="Desayunos">Desayunos</option>
                <option value="Entradas">Entradas</option>
                <option value="Bebidas">Bebidas</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre del Plato en POS:
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Sobrebarriga en salsa criolla"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Precio de Venta POS ($ COP):
            </label>
            <input
              type="number"
              min="0"
              step="500"
              value={precioVentaPos}
              onChange={(e) => setPrecioVentaPos(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-mono text-slate-900 font-bold"
              required
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
              Crear Plato
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
