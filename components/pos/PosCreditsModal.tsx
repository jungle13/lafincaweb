'use client';

import React, { useMemo, useState } from 'react';
import { Search, UserCheck, X } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import type { ClienteCreditoResumen } from './types';

interface PosCreditsModalProps {
  clientes: ClienteCreditoResumen[];
  busyAction: boolean;
  onClose: () => void;
  onRegistrarAbono: (payload: {
    cliente_nombre: string;
    cliente_telefono: string;
    monto: number;
    metodo_pago: 'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA';
    observaciones: string;
  }) => Promise<void>;
}

export default function PosCreditsModal({
  clientes,
  busyAction,
  onClose,
  onRegistrarAbono,
}: PosCreditsModalProps) {
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string>(clientes[0]?.cliente_nombre || '');
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoAbono, setMetodoAbono] = useState<'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [obsAbono, setObsAbono] = useState('');

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.cliente_nombre.toLowerCase().includes(q) ||
        (c.cliente_telefono || '').toLowerCase().includes(q)
    );
  }, [clientes, query]);

  const clienteActivo = useMemo(
    () => clientes.find((c) => c.cliente_nombre === selectedName) || filtrados[0] || null,
    [clientes, filtrados, selectedName]
  );

  const handleAbonar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteActivo) return;
    const val = Number(montoAbono || 0);
    if (val <= 0) return;
    await onRegistrarAbono({
      cliente_nombre: clienteActivo.cliente_nombre,
      cliente_telefono: clienteActivo.cliente_telefono,
      monto: val,
      metodo_pago: metodoAbono,
      observaciones: obsAbono,
    });
    setMontoAbono('');
    setObsAbono('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-zinc-300 max-w-4xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-zinc-700" />
            <h3 className="font-bold text-base text-zinc-950">
              Cartera de Clientes y Créditos (Libro Mayor)
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Izquierda: Lista de clientes con saldo */}
          <div className="md:col-span-5 flex flex-col min-h-0 border border-zinc-200 rounded-lg overflow-hidden">
            <div className="p-2 border-b border-zinc-200 bg-zinc-50 relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {filtrados.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  No hay clientes con movimientos a crédito aún.
                </div>
              ) : (
                filtrados.map((c) => {
                  const active = clienteActivo?.cliente_nombre === c.cliente_nombre;
                  return (
                    <button
                      key={c.cliente_nombre}
                      onClick={() => setSelectedName(c.cliente_nombre)}
                      className={`w-full px-3 py-2.5 text-left flex items-center justify-between text-xs cursor-pointer ${
                        active ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-zinc-900">{c.cliente_nombre}</div>
                        <div className="text-[11px] text-zinc-500">{c.cliente_telefono || 'Sin teléfono'}</div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className={`font-bold ${c.saldo > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                          {formatMoney(c.saldo)}
                        </div>
                        <div className="text-[10px] text-zinc-400">Saldo</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Derecha: Estado de cuenta + Registrar Abono */}
          <div className="md:col-span-7 flex flex-col min-h-0 space-y-3">
            {clienteActivo ? (
              <>
                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs tabular-nums">
                  <div>
                    <div className="font-bold text-sm text-zinc-950">{clienteActivo.cliente_nombre}</div>
                    <div className="text-zinc-500">
                      Cargos: {formatMoney(clienteActivo.total_cargos)} • Abonos:{' '}
                      {formatMoney(clienteActivo.total_abonos)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-zinc-500">Saldo Pendiente</div>
                    <div className="text-xl font-extrabold text-zinc-950">
                      {formatMoney(clienteActivo.saldo)}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAbonar} className="p-3 rounded-lg border border-zinc-200 bg-white space-y-2">
                  <div className="text-xs font-bold text-zinc-800">Registrar Abono a Cuenta</div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={montoAbono}
                      onChange={(e) => setMontoAbono(e.target.value)}
                      placeholder="Monto ($)"
                      className="px-2.5 py-1.5 border border-zinc-300 rounded text-xs font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <select
                      value={metodoAbono}
                      onChange={(e) =>
                        setMetodoAbono(e.target.value as 'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA')
                      }
                      className="px-2.5 py-1.5 border border-zinc-300 rounded text-xs font-semibold"
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="DATAFONO">Datáfono</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                    </select>
                    <button
                      type="submit"
                      disabled={busyAction || !montoAbono}
                      className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
                    >
                      + Abonar
                    </button>
                  </div>
                  <input
                    type="text"
                    value={obsAbono}
                    onChange={(e) => setObsAbono(e.target.value)}
                    placeholder="Nota opcional del abono..."
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded text-xs"
                  />
                </form>

                <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100 text-xs tabular-nums">
                  {clienteActivo.movimientos.map((m) => (
                    <div key={m.id} className="px-3 py-2 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-zinc-900">
                          {m.tipo === 'CARGO_CREDITO' ? 'Cargo Factura' : 'Abono Recibido'}{' '}
                          {m.orden_consecutivo ? `(${m.orden_consecutivo})` : ''}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {m.fecha} • {m.metodo_pago} {m.observaciones ? `• ${m.observaciones}` : ''}
                        </div>
                      </div>
                      <span
                        className={`font-bold ${
                          m.tipo === 'CARGO_CREDITO' ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {m.tipo === 'CARGO_CREDITO' ? '+' : '-'}
                        {formatMoney(m.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-zinc-400">
                Selecciona un cliente para ver su extracto.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
