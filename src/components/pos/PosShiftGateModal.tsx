'use client';

import React, { useState } from 'react';
import { Lock, LogOut, ShieldCheck, Unlock, X } from 'lucide-react';
import type { SesionCaja } from './types';

interface PosOpenShiftGateProps {
  cajaNombre: string;
  busyAction: boolean;
  onOpenShift: (payload: {
    username: string;
    password: string;
    caja_nombre: string;
    efectivo_inicial: number;
  }) => Promise<void>;
  onExitWithoutOpen: () => void;
}

export function PosOpenShiftGate({
  cajaNombre,
  busyAction,
  onOpenShift,
  onExitWithoutOpen,
}: PosOpenShiftGateProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [caja, setCaja] = useState(cajaNombre);
  const [baseInicial, setBaseInicial] = useState('200000');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    await onOpenShift({
      username: username.trim(),
      password: password.trim(),
      caja_nombre: caja,
      efectivo_inicial: Number(baseInicial || 0),
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-zinc-300 max-w-md w-full p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-zinc-900 text-white font-bold text-sm flex items-center justify-center">
              E
            </span>
            <div>
              <h2 className="font-bold text-base text-zinc-950">Apertura de Turno — Eliana POS</h2>
              <p className="text-[11px] text-zinc-500">
                No hay turno abierto. Ingresa tus credenciales y el fondo inicial de caja.
              </p>
            </div>
          </div>
          <Lock className="w-5 h-5 text-zinc-400" />
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-zinc-700 block mb-1">Usuario de Cajero / Admin</label>
            <input
              autoFocus
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. johanna o admin"
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-medium outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="font-semibold text-zinc-700 block mb-1">Contraseña / PIN</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-medium outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Terminal / Caja</label>
              <select
                value={caja}
                onChange={(e) => setCaja(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-md text-xs font-semibold bg-white"
              >
                <option value="Caja 1">Caja 1</option>
                <option value="Caja 2">Caja 2</option>
                <option value="Caja Principal">Caja Principal</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Monto Inicial en Caja ($)</label>
              <input
                type="number"
                min={0}
                required
                value={baseInicial}
                onChange={(e) => setBaseInicial(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={onExitWithoutOpen}
            className="px-4 py-2 rounded-md border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
          >
            Salir al Panel
          </button>
          <button
            type="submit"
            disabled={busyAction}
            className="px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            Abrir Turno e Iniciar Caja
          </button>
        </div>
      </form>
    </div>
  );
}

interface PosExitModalProps {
  sesionActiva: SesionCaja | null;
  onClose: () => void;
  onLeaveOpenAndExit: () => void;
  onGoToCutAndClose: () => void;
}

export function PosExitConfirmModal({
  sesionActiva,
  onClose,
  onLeaveOpenAndExit,
  onGoToCutAndClose,
}: PosExitModalProps) {
  return (
    <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-zinc-300 max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2">
            <LogOut className="w-5 h-5 text-zinc-700" />
            <h3 className="font-bold text-base text-zinc-950">Salir de Eliana POS</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed">
          {sesionActiva
            ? `El Turno #${sesionActiva.numero_turno} (${sesionActiva.cajero_nombre} — ${sesionActiva.caja_nombre}) continúa abierto. ¿Qué deseas hacer antes de salir?`
            : '¿Deseas salir del módulo Eliana POS hacia el panel administrativo?'}
        </p>

        <div className="space-y-2">
          {sesionActiva && (
            <button
              onClick={onGoToCutAndClose}
              className="w-full py-2.5 px-4 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              Ir a Corte de Caja para Cerrar Turno
            </button>
          )}
          <button
            onClick={onLeaveOpenAndExit}
            className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            {sesionActiva ? 'Dejar Turno Abierto y Salir' : 'Salir al Panel Administrativo'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-semibold cursor-pointer"
          >
            Cancelar y Seguir en Caja
          </button>
        </div>
      </div>
    </div>
  );
}
