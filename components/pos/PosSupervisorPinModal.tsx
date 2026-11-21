'use client';

import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface PosSupervisorPinModalProps {
  actionLabel: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}

export default function PosSupervisorPinModal({
  actionLabel,
  onConfirm,
  onCancel,
}: PosSupervisorPinModalProps) {
  const [pin, setPin] = useState('');

  return (
    <div className="fixed inset-0 z-[10050] bg-zinc-950/65 backdrop-blur-xs flex items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pin.trim()) return;
          onConfirm(pin.trim());
        }}
        className="bg-white rounded-2xl border border-zinc-300 max-w-sm w-full p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2 text-amber-700">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h3 className="font-extrabold text-sm text-zinc-950">Autorización de Supervisor</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed">
          La operación <b>{actionLabel}</b> requiere PIN o contraseña de un usuario <b>ADMIN</b> o <b>GESTOR</b>.
        </p>

        <input
          type="password"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Ingresa PIN / Contraseña de Supervisor"
          className="w-full px-3 py-2.5 border border-zinc-300 focus:border-blue-600 rounded-xl text-sm font-bold outline-none"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!pin.trim()}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
          >
            Autorizar (Enter)
          </button>
        </div>
      </form>
    </div>
  );
}
