'use client';

import React, { useEffect, useState } from 'react';
import { Lock, LogOut, Monitor, ShieldAlert, ShieldCheck, Unlock, X } from 'lucide-react';
import type { PosCaja, SesionCaja } from './types';
import ElianaBrandLogo from '@/components/brand/ElianaBrandLogo';

interface PosOpenShiftGateProps {
  cajaNombre: string;
  boundCaja: PosCaja | null;
  cajasLibres: PosCaja[];
  deviceId: string;
  ipLocal: string;
  jornadaCerradaTotal: boolean;
  errorMsg?: string | null;
  busyAction: boolean;
  onOpenShift: (payload: {
    caja_id: string;
    caja_nombre: string;
    password: string;
    efectivo_inicial: number;
    device_id: string;
    ip_local: string;
  }) => Promise<void>;
  onExitWithoutOpen: () => void;
}

export function PosOpenShiftGate({
  cajaNombre,
  boundCaja,
  cajasLibres,
  deviceId,
  ipLocal,
  jornadaCerradaTotal,
  errorMsg,
  busyAction,
  onOpenShift,
  onExitWithoutOpen,
}: PosOpenShiftGateProps) {
  const [selectedCajaId, setSelectedCajaId] = useState<string>(boundCaja?.id || cajasLibres[0]?.id || '');
  const [password, setPassword] = useState('');
  const [baseInicial, setBaseInicial] = useState('200000');

  useEffect(() => {
    if (boundCaja?.id) {
      setSelectedCajaId(boundCaja.id);
    } else if (cajasLibres.length > 0 && !cajasLibres.some((c) => c.id === selectedCajaId)) {
      setSelectedCajaId(cajasLibres[0].id);
    }
  }, [boundCaja, cajasLibres, selectedCajaId]);

  const activeCajaObj = boundCaja || cajasLibres.find((c) => c.id === selectedCajaId) || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jornadaCerradaTotal || !activeCajaObj || !password.trim()) return;
    await onOpenShift({
      caja_id: activeCajaObj.id,
      caja_nombre: activeCajaObj.nombre,
      password: password.trim(),
      efectivo_inicial: Number(baseInicial || 0),
      device_id: deviceId,
      ip_local: ipLocal,
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] w-screen h-screen bg-zinc-100 flex items-center justify-center p-4 select-none">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-zinc-300 max-w-md w-full p-6 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <div className="space-y-1">
            <ElianaBrandLogo variant="pos" theme="light" size="sm" />
            <p className="text-[11px] text-zinc-500">
              {boundCaja ? (
                <>
                  Terminal vinculada: <b>{boundCaja.nombre}</b>
                  {ipLocal ? ` · IP ${ipLocal}` : ''}
                </>
              ) : (
                <>Configuración Inicial de Caja en este PC {ipLocal ? `(${ipLocal})` : ''}</>
              )}
            </p>
          </div>
          <Lock className="w-5 h-5 text-zinc-400" />
        </div>

        {jornadaCerradaTotal ? (
          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-300 text-xs space-y-1.5 text-zinc-700">
            <div className="flex items-center gap-1.5 font-bold text-zinc-950">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              Jornada del día cerrada totalmente (Corte Z)
            </div>
            <p className="leading-relaxed">
              La caja <b>{cajaNombre}</b> ya realizó su arqueo y cierre total del día. Para abrir un nuevo turno hoy, un Administrador debe autorizar <b>Reabrir (Admin)</b> desde <b>Libro de Caja</b>.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            {errorMsg && (
              <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-red-800 font-semibold">
                {errorMsg}
              </div>
            )}

            {boundCaja ? (
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-sky-700" />
                  <div>
                    <div className="font-extrabold text-sm text-sky-950">{boundCaja.nombre}</div>
                    <div className="text-[11px] text-sky-700">
                      {boundCaja.es_principal ? 'Caja Principal del Negocio' : 'Caja Auxiliar'}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-[10px] font-bold text-sky-800">
                  PC Vinculado
                </span>
              </div>
            ) : cajasLibres.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                No hay cajas libres disponibles. Pide al Administrador crear o liberar una caja desde el módulo web <b>Administración POS</b>.
              </div>
            ) : (
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  Selecciona la Caja para este PC (única vez)
                </label>
                <select
                  value={selectedCajaId}
                  onChange={(e) => setSelectedCajaId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm font-bold bg-white outline-none focus:border-blue-600"
                >
                  {cajasLibres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.es_principal ? '(Principal)' : '(Auxiliar)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Contraseña de la Caja</label>
              <input
                autoFocus
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm font-medium outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Monto Inicial en Caja ($)</label>
              <input
                type="number"
                min={0}
                required
                value={baseInicial}
                onChange={(e) => setBaseInicial(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={onExitWithoutOpen}
            className="px-3.5 py-2.5 rounded-xl border border-zinc-300 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer"
          >
            Salir al Panel
          </button>

          {!jornadaCerradaTotal && activeCajaObj && (
            <button
              type="submit"
              disabled={busyAction}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              {busyAction ? 'Validando...' : boundCaja ? 'Abrir Turno en Caja' : 'Vincular PC y Abrir Turno'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

interface PosExitConfirmModalProps {
  sesionActiva: SesionCaja | null;
  onClose: () => void;
  onGoToCutAndClose: () => void;
  onLeaveOpenAndExit: () => void;
}

export function PosExitConfirmModal({
  sesionActiva,
  onClose,
  onGoToCutAndClose,
  onLeaveOpenAndExit,
}: PosExitConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[10000] bg-zinc-950/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-zinc-300 max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
          <h3 className="font-bold text-base text-zinc-950">Salir de ELIANA POS</h3>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-700 leading-relaxed">
          {sesionActiva ? (
            <>
              Actualmente tienes el <b>Turno #{sesionActiva.numero_turno}</b> abierto en <b>{sesionActiva.caja_nombre}</b>. ¿Qué deseas hacer antes de volver al panel administrativo?
            </>
          ) : (
            'No hay turno abierto en este momento. ¿Deseas salir al panel administrativo?'
          )}
        </p>

        <div className="space-y-2">
          {sesionActiva && (
            <button
              onClick={onGoToCutAndClose}
              className="w-full py-2.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              Ir a Corte de Caja y Cerrar Turno (X / Z)
            </button>
          )}

          <button
            onClick={onLeaveOpenAndExit}
            className="w-full py-2.5 px-3 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {sesionActiva ? 'Dejar Turno Abierto y Salir al Panel' : 'Salir al Panel'}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-800 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
