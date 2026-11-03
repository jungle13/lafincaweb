'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface NewSheetDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (dateStr: string) => void;
  title?: string;
  defaultDate?: string;
}

export default function NewSheetDateModal({
  isOpen,
  onClose,
  onCreate,
  title = 'Nueva Hoja',
  defaultDate = '2026-10-24'
}: NewSheetDateModalProps) {
  const [dateVal, setDateVal] = useState(defaultDate);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateVal) return;
    onCreate(dateVal);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
      <div 
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div 
        className="relative z-10 bg-white border border-slate-200/90 rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-sm font-bold text-slate-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha de la jornada:
            </label>
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            >
              Crear y Abrir
            </button>
          </div>
        </form>
            </div>
    </div>,
    document.body
  );
}
