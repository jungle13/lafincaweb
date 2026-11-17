'use client';

import React, { useMemo, useState } from 'react';
import { Printer, RotateCcw, X } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import type { DevolucionDia, PosOrden, PosOrdenItem } from './types';

interface PosReturnsModalProps {
  ordenesFacturadas: PosOrden[];
  devolucionesDia: DevolucionDia[];
  busyAction: boolean;
  onClose: () => void;
  onReimprimirOrden: (orden: PosOrden) => Promise<void>;
  onDevolverItem: (payload: {
    orden_id: string;
    item_id: string;
    cantidad_devuelta: number;
    metodo_reembolso: 'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO';
    motivo: string;
  }) => Promise<void>;
}

export default function PosReturnsModal({
  ordenesFacturadas,
  devolucionesDia,
  busyAction,
  onClose,
  onReimprimirOrden,
  onDevolverItem,
}: PosReturnsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedOrdenId, setSelectedOrdenId] = useState<string>(ordenesFacturadas[0]?.id || '');
  const [devItem, setDevItem] = useState<PosOrdenItem | null>(null);
  const [devCantidad, setDevCantidad] = useState(1);
  const [devMetodo, setDevMetodo] = useState<'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO'>('EFECTIVO');
  const [devMotivo, setDevMotivo] = useState('Devolución de cliente');

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ordenesFacturadas;
    return ordenesFacturadas.filter(
      (o) =>
        o.consecutivo.toLowerCase().includes(q) ||
        (o.cliente_nombre || '').toLowerCase().includes(q)
    );
  }, [ordenesFacturadas, search]);

  const ordenActiva = useMemo(
    () => ordenesFacturadas.find((o) => o.id === selectedOrdenId) || filtradas[0] || null,
    [ordenesFacturadas, filtradas, selectedOrdenId]
  );

  const handleConfirmReturn = async () => {
    if (!ordenActiva || !devItem) return;
    await onDevolverItem({
      orden_id: ordenActiva.id,
      item_id: devItem.id,
      cantidad_devuelta: devCantidad,
      metodo_reembolso: devMetodo,
      motivo: devMotivo,
    });
    setDevItem(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-zinc-300 max-w-4xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 shrink-0">
          <h3 className="font-bold text-base text-zinc-950">
            Ventas Facturadas del Día ({ordenesFacturadas.length}) y Devoluciones ({devolucionesDia.length})
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
          <div className="md:col-span-5 flex flex-col min-h-0 border border-zinc-200 rounded-lg overflow-hidden">
            <div className="p-2 border-b border-zinc-200 bg-zinc-50">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar factura o cliente..."
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {filtradas.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-400">Sin ventas facturadas hoy.</div>
              ) : (
                filtradas.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedOrdenId(v.id);
                      setDevItem(null);
                    }}
                    className={`w-full p-3 text-left flex items-center justify-between text-xs cursor-pointer ${
                      ordenActiva?.id === v.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-zinc-900">{v.consecutivo}</div>
                      <div className="text-[11px] text-zinc-500">
                        {v.metodo_pago} {v.cliente_nombre ? `• ${v.cliente_nombre}` : ''}
                      </div>
                    </div>
                    <div className="font-bold tabular-nums text-zinc-950">{formatMoney(v.gran_total)}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col min-h-0 space-y-3 overflow-y-auto">
            {ordenActiva ? (
              <>
                <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                  <div className="text-xs">
                    <div className="font-bold text-sm text-zinc-950">{ordenActiva.consecutivo}</div>
                    <div className="text-zinc-500">
                      Canal: {ordenActiva.canal_venta} • Pago: {ordenActiva.metodo_pago}
                    </div>
                  </div>
                  <button
                    onClick={() => onReimprimirOrden(ordenActiva)}
                    className="px-3 py-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-semibold text-zinc-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Reimprimir
                  </button>
                </div>

                <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100 text-xs">
                  {ordenActiva.items
                    .filter((i) => i.estado_comanda !== 'ANULADO')
                    .map((it) => (
                      <div key={it.id} className="p-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-zinc-900">
                            {it.cantidad}x {it.nombre_producto}
                          </div>
                          <div className="text-[11px] text-zinc-500 tabular-nums">
                            {formatMoney(it.precio_unitario)} c/u • Subtotal: {formatMoney(it.subtotal)}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setDevItem(it);
                            setDevCantidad(it.cantidad);
                          }}
                          className="px-2.5 py-1 rounded border border-zinc-300 bg-white hover:bg-red-50 hover:border-red-300 text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Devolver
                        </button>
                      </div>
                    ))}
                </div>

                {devItem && (
                  <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-300 space-y-2.5 text-xs">
                    <div className="font-bold text-zinc-950">
                      Devolver artículo: {devItem.nombre_producto}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-zinc-600 block mb-1">Cantidad (máx {devItem.cantidad})</label>
                        <input
                          type="number"
                          min={0.01}
                          max={devItem.cantidad}
                          step="any"
                          value={devCantidad}
                          onChange={(e) => setDevCantidad(Number(e.target.value || 1))}
                          className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-zinc-600 block mb-1">Reembolsar por</label>
                        <select
                          value={devMetodo}
                          onChange={(e) =>
                            setDevMetodo(
                              e.target.value as 'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO'
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded font-semibold"
                        >
                          <option value="EFECTIVO">Efectivo (Descuenta de Caja)</option>
                          <option value="DATAFONO">Datáfono</option>
                          <option value="TRANSFERENCIA">Transferencia</option>
                          <option value="CREDITO">Nota Crédito a Cliente</option>
                        </select>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={devMotivo}
                      onChange={(e) => setDevMotivo(e.target.value)}
                      placeholder="Motivo de la devolución..."
                      className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDevItem(null)}
                        className="px-3 py-1.5 rounded border border-zinc-300 bg-white font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmReturn}
                        disabled={busyAction}
                        className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                      >
                        Confirmar Devolución ({formatMoney(devCantidad * devItem.precio_unitario)})
                      </button>
                    </div>
                  </div>
                )}

                {devolucionesDia.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200">
                    <div className="text-xs font-bold text-zinc-800 mb-1.5">
                      Devoluciones Registradas Hoy
                    </div>
                    <div className="space-y-1 text-xs">
                      {devolucionesDia.map((d) => (
                        <div key={d.id} className="p-2 rounded bg-zinc-50 border border-zinc-200 flex justify-between">
                          <span>
                            {d.orden_consecutivo}: {d.cantidad_devuelta}x {d.nombre_producto} ({d.metodo_reembolso})
                          </span>
                          <span className="font-bold text-red-700">-{formatMoney(d.valor_devuelto)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-zinc-400">
                Selecciona una factura para ver su detalle o procesar devoluciones.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
