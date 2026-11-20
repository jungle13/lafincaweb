'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  History,
  MinusCircle,
  PackageCheck,
  PlusCircle,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { formatColombiaTime } from '@/lib/dateUtils';
import type { InventarioMovimiento, ProductoVenta } from './types';

interface PosInventoryModuleProps {
  productos: ProductoVenta[];
  movimientos: InventarioMovimiento[];
  busyAction: boolean;
  onAjustarInventario: (payload: {
    producto_id: string;
    tipo: 'ENTRADA' | 'MERMA' | 'AJUSTE';
    cantidad: number;
    motivo: string;
  }) => Promise<void>;
}

export default function PosInventoryModule({
  productos,
  movimientos,
  busyAction,
  onAjustarInventario,
}: PosInventoryModuleProps) {
  const [subTab, setSubTab] = useState<'OPERAR' | 'BAJOS' | 'KARDEX'>('OPERAR');
  const [catFilter, setCatFilter] = useState('TODAS');
  const [query, setQuery] = useState('');
  const [modoOperacion, setModoOperacion] = useState<'ENTRADA' | 'MERMA' | 'AJUSTE'>('ENTRADA');
  const [cantidad, setCantidad] = useState('1');
  const [motivo, setMotivo] = useState('');

  // ÚNICAMENTE bebidas, desechables e insumos con control de inventario (excluye platos preparados)
  const inventariables = useMemo(
    () => productos.filter((p) => Boolean(p.controla_inventario)),
    [productos]
  );

  const categoriasInv = useMemo(() => {
    const set = new Set<string>();
    inventariables.forEach((p) => set.add((p.categoria || 'OTROS').toUpperCase()));
    return ['TODAS', ...Array.from(set).sort()];
  }, [inventariables]);

  const [selectedProdId, setSelectedProdId] = useState<string>(inventariables[0]?.id || '');

  const matchProductos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inventariables.filter((p) => {
      const okCat = catFilter === 'TODAS' || (p.categoria || 'OTROS').toUpperCase() === catFilter;
      const okQ = !q || p.nombre.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q);
      return okCat && okQ;
    });
  }, [inventariables, catFilter, query]);

  const productosBajos = useMemo(
    () => inventariables.filter((p) => Number(p.existencia || 0) <= Number(p.inv_minimo || 0)),
    [inventariables]
  );

  const valorTotalInventario = useMemo(
    () =>
      inventariables.reduce(
        (acc, p) => acc + Number(p.existencia || 0) * Number(p.costo_unitario || p.precio_total || 0),
        0
      ),
    [inventariables]
  );

  const selectedProd = useMemo(
    () => inventariables.find((p) => p.id === selectedProdId) || matchProductos[0] || null,
    [inventariables, matchProductos, selectedProdId]
  );

  const handleAplicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProd) return;
    await onAjustarInventario({
      producto_id: selectedProd.id,
      tipo: modoOperacion,
      cantidad: Number(cantidad || 0),
      motivo:
        motivo.trim() ||
        (modoOperacion === 'ENTRADA'
          ? 'Surtido / Entrada en POS'
          : modoOperacion === 'MERMA'
            ? 'Merma / Daño registrado en POS'
            : 'Conteo físico de inventario'),
    });
    setCantidad('1');
    setMotivo('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-100 overflow-hidden p-3 gap-3">
      {/* Encabezado Claro: Solo Bebidas, Desechables e Insumos */}
      <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSubTab('OPERAR')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
              subTab === 'OPERAR' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-300'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Control de Stock ({inventariables.length})
          </button>
          <button
            onClick={() => setSubTab('BAJOS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
              subTab === 'BAJOS'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Stock Bajo / Agotado ({productosBajos.length})
          </button>
          <button
            onClick={() => setSubTab('KARDEX')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
              subTab === 'KARDEX' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-300'
            }`}
          >
            <History className="w-4 h-4" />
            Historial de Movimientos
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 font-semibold">
            Platos de cocina excluidos automáticamente
          </span>
          <span className="font-bold text-zinc-900 tabular-nums">
            Valorizado: {formatMoney(valorTotalInventario)}
          </span>
        </div>
      </div>

      {subTab === 'OPERAR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Izquierda: Lista de Bebidas, Desechables e Insumos */}
          <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl flex flex-col min-h-0 overflow-hidden">
            <div className="p-2.5 border-b border-zinc-200 space-y-2 bg-zinc-50 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar bebida, desechable o insumo..."
                  className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium bg-white outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                {categoriasInv.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCatFilter(c)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap cursor-pointer ${
                      catFilter === c
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-700 border-zinc-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {matchProductos.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  No hay insumos inventariables en esta categoría. Configura categorías en Administración POS.
                </div>
              ) : (
                matchProductos.map((p) => {
                  const stock = Number(p.existencia || 0);
                  const min = Number(p.inv_minimo || 0);
                  const isOut = stock <= 0;
                  const isLow = stock > 0 && stock <= min;
                  const active = selectedProd?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProdId(p.id)}
                      className={`w-full px-3.5 py-3 text-left flex items-center justify-between gap-2 cursor-pointer transition ${
                        active ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-zinc-900 truncate">{p.nombre}</div>
                        <div className="text-[11px] text-zinc-500">
                          {p.categoria} · Mín: {min}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold tabular-nums border shrink-0 ${
                          isOut
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : isLow
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {stock} ud
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Derecha: 3 Acciones Claras */}
          <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-5 overflow-y-auto">
            {selectedProd ? (
              <form onSubmit={handleAplicar} className="space-y-4">
                <div className="border-b border-zinc-200 pb-3 flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-[10px] font-bold text-zinc-700 uppercase">
                      {selectedProd.categoria}
                    </span>
                    <h3 className="text-lg font-extrabold text-zinc-950 mt-1">{selectedProd.nombre}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Stock Actual</div>
                    <div className="text-2xl font-extrabold tabular-nums text-zinc-950">
                      {Number(selectedProd.existencia || 0)} ud
                    </div>
                  </div>
                </div>

                {/* 3 Cards Grandes de Acción */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModoOperacion('ENTRADA')}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                      modoOperacion === 'ENTRADA'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-zinc-50 text-zinc-800 border-zinc-300 hover:bg-emerald-50'
                    }`}
                  >
                    <PlusCircle className="w-5 h-5 mb-1.5" />
                    <div className="font-bold text-xs">+ Entrada (Surtido)</div>
                    <div className={`text-[11px] ${modoOperacion === 'ENTRADA' ? 'text-emerald-100' : 'text-zinc-500'}`}>
                      Sumar compra o surtido
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoOperacion('MERMA')}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                      modoOperacion === 'MERMA'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-zinc-50 text-zinc-800 border-zinc-300 hover:bg-rose-50'
                    }`}
                  >
                    <MinusCircle className="w-5 h-5 mb-1.5" />
                    <div className="font-bold text-xs">- Salida / Merma</div>
                    <div className={`text-[11px] ${modoOperacion === 'MERMA' ? 'text-rose-100' : 'text-zinc-500'}`}>
                      Daño, rotura o vencimiento
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoOperacion('AJUSTE')}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                      modoOperacion === 'AJUSTE'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-zinc-50 text-zinc-800 border-zinc-300 hover:bg-blue-50'
                    }`}
                  >
                    <SlidersHorizontal className="w-5 h-5 mb-1.5" />
                    <div className="font-bold text-xs">= Conteo Físico</div>
                    <div className={`text-[11px] ${modoOperacion === 'AJUSTE' ? 'text-blue-100' : 'text-zinc-500'}`}>
                      Fijar stock real contado
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-zinc-700 block mb-1">
                      {modoOperacion === 'AJUSTE'
                        ? 'Cantidad Real Contada'
                        : modoOperacion === 'MERMA'
                          ? 'Unidades a Descontar'
                          : 'Unidades a Sumar'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      required
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-base font-extrabold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-zinc-700 block mb-1">Motivo / Referencia</label>
                    <input
                      type="text"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder={
                        modoOperacion === 'MERMA'
                          ? 'Ej: Botella rota en nevera'
                          : 'Ej: Factura proveedor / Conteo turno'
                      }
                      className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busyAction}
                  className="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold cursor-pointer"
                >
                  Guardar Movimiento de Inventario
                </button>
              </form>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                Selecciona una bebida, desechable o insumo de la izquierda.
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'BAJOS' && (
        <div className="bg-white border border-zinc-200 rounded-xl flex-1 overflow-y-auto divide-y divide-zinc-100">
          {productosBajos.length === 0 ? (
            <div className="p-10 text-center text-sm text-emerald-700 font-semibold">
              Todas las bebidas, desechables e insumos están por encima del stock mínimo.
            </div>
          ) : (
            productosBajos.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-zinc-900">{p.nombre}</div>
                  <div className="text-xs text-zinc-500">
                    {p.categoria} · Mínimo esperado: {Number(p.inv_minimo || 0)} ud
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 font-extrabold text-sm tabular-nums">
                  {Number(p.existencia || 0)} ud
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'KARDEX' && (
        <div className="bg-white border border-zinc-200 rounded-xl flex-1 overflow-y-auto divide-y divide-zinc-100">
          {movimientos.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-400">
              No hay movimientos de inventario registrados todavía.
            </div>
          ) : (
            movimientos.map((m) => (
              <div key={m.id} className="px-4 py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-sm text-zinc-900">{m.nombre_producto}</div>
                  <div className="text-zinc-500">
                    {m.motivo || m.tipo} · {m.usuario || 'POS'} · {formatColombiaTime(m.created_at)}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className={`font-extrabold text-sm ${m.cantidad_delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {m.cantidad_delta >= 0 ? `+${m.cantidad_delta}` : m.cantidad_delta}
                  </div>
                  <div className="text-zinc-500">
                    {m.existencia_anterior} → <b>{m.existencia_nueva}</b>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
