'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, History, PlusCircle, SlidersHorizontal } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import type { InventarioMovimiento, ProductoVenta } from './types';

interface PosInventoryModuleProps {
  productos: ProductoVenta[];
  movimientos: InventarioMovimiento[];
  busyAction: boolean;
  onAjustarInventario: (payload: {
    producto_id: string;
    tipo: 'ENTRADA' | 'AJUSTE';
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
  const [subTab, setSubTab] = useState<'AGREGAR' | 'BAJOS' | 'REPORTE' | 'KARDEX'>('AGREGAR');
  const [query, setQuery] = useState('');
  const [selectedProdId, setSelectedProdId] = useState<string>(productos[0]?.id || '');
  const [modoOperacion, setModoOperacion] = useState<'ENTRADA' | 'AJUSTE'>('ENTRADA');
  const [cantidad, setCantidad] = useState('1');
  const [motivo, setMotivo] = useState('');

  const matchProductos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productos.slice(0, 40);
    return productos.filter((p) => p.nombre.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q)).slice(0, 40);
  }, [productos, query]);

  const productosBajos = useMemo(
    () => productos.filter((p) => Number(p.existencia || 0) <= Number(p.inv_minimo || 0)),
    [productos]
  );

  const valorTotalInventario = useMemo(
    () => productos.reduce((acc, p) => acc + Number(p.existencia || 0) * Number(p.costo_unitario || p.precio_total || 0), 0),
    [productos]
  );

  const selectedProd = useMemo(
    () => productos.find((p) => p.id === selectedProdId) || matchProductos[0] || null,
    [productos, matchProductos, selectedProdId]
  );

  const handleAplicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProd) return;
    await onAjustarInventario({
      producto_id: selectedProd.id,
      tipo: modoOperacion,
      cantidad: Number(cantidad || 0),
      motivo: motivo.trim() || (modoOperacion === 'ENTRADA' ? 'Entrada de mercancía en POS' : 'Ajuste físico de inventario'),
    });
    setCantidad('1');
    setMotivo('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-100 overflow-hidden">
      {/* Sub-barra estilo eleventa F4 Inventario */}
      <div className="bg-white border-b border-zinc-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'AGREGAR' as const, label: 'Agregar / Ajustes', icon: PlusCircle },
            { id: 'BAJOS' as const, label: `Productos Bajos (${productosBajos.length})`, icon: AlertTriangle },
            { id: 'REPORTE' as const, label: 'Reporte de Inventario', icon: ClipboardList },
            { id: 'KARDEX' as const, label: 'Kardex de Movimientos', icon: History },
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer border ${
                  active ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="text-xs font-semibold text-zinc-600 tabular-nums">
          Valor Inventario: <b className="text-zinc-950">{formatMoney(valorTotalInventario)}</b>
        </div>
      </div>

      {subTab === 'AGREGAR' && (
        <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto">
          <div className="lg:col-span-5 bg-white rounded-lg border border-zinc-200 p-4 flex flex-col max-h-[540px]">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto o escanear código..."
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-xs mb-3 outline-none focus:border-blue-600"
            />
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200 rounded-md">
              {matchProductos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProdId(p.id)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs cursor-pointer ${
                    selectedProd?.id === p.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-zinc-900">{p.nombre}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">{p.codigo}</div>
                  </div>
                  <span className="font-bold tabular-nums text-zinc-900">Stock: {p.existencia ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleAplicar} className="lg:col-span-7 bg-white rounded-lg border border-zinc-200 p-5 space-y-4 h-fit text-xs">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950">{selectedProd?.nombre || 'Selecciona un producto'}</h3>
                <p className="text-zinc-500">Existencia actual: <b className="text-zinc-900">{selectedProd?.existencia ?? 0}</b></p>
              </div>
              <SlidersHorizontal className="w-5 h-5 text-zinc-400" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModoOperacion('ENTRADA')}
                className={`py-2.5 rounded-md font-semibold border cursor-pointer ${
                  modoOperacion === 'ENTRADA' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-300'
                }`}
              >
                + Sumar Entrada al Stock
              </button>
              <button
                type="button"
                onClick={() => setModoOperacion('AJUSTE')}
                className={`py-2.5 rounded-md font-semibold border cursor-pointer ${
                  modoOperacion === 'AJUSTE' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-300'
                }`}
              >
                Fijar Nueva Existencia (Ajuste)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  {modoOperacion === 'ENTRADA' ? 'Cantidad a Sumar' : 'Nueva Existencia Física'}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Motivo / Referencia</label>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Compra proveedor, conteo físico"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-md text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busyAction || !selectedProd}
              className="px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
            >
              Guardar Movimiento de Inventario
            </button>
          </form>
        </div>
      )}

      {(subTab === 'BAJOS' || subTab === 'REPORTE') && (
        <div className="flex-1 overflow-y-auto bg-white m-3 rounded-lg border border-zinc-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3 text-right">Existencia</th>
                <th className="py-2.5 px-3 text-right">Mínimo</th>
                <th className="py-2.5 px-3 text-right">Precio Venta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {(subTab === 'BAJOS' ? productosBajos : productos).map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="py-2 px-3 font-mono text-zinc-500">{p.codigo}</td>
                  <td className="py-2 px-3 font-semibold text-zinc-900">{p.nombre}</td>
                  <td className="py-2 px-3 text-zinc-600">{p.categoria}</td>
                  <td className="py-2 px-3 text-right font-bold text-zinc-950">{p.existencia ?? 0}</td>
                  <td className="py-2 px-3 text-right text-zinc-500">{p.inv_minimo ?? 0}</td>
                  <td className="py-2 px-3 text-right font-bold text-zinc-900">{formatMoney(p.precio_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'KARDEX' && (
        <div className="flex-1 overflow-y-auto bg-white m-3 rounded-lg border border-zinc-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3 text-right">Movimiento</th>
                <th className="py-2.5 px-3 text-right">Anterior</th>
                <th className="py-2.5 px-3 text-right">Nueva</th>
                <th className="py-2.5 px-3">Motivo</th>
                <th className="py-2.5 px-3">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {movimientos.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50">
                  <td className="py-2 px-3 text-zinc-500">{m.fecha}</td>
                  <td className="py-2 px-3 font-semibold text-zinc-900">{m.nombre_producto}</td>
                  <td className="py-2 px-3 font-semibold text-zinc-700">{m.tipo}</td>
                  <td className={`py-2 px-3 text-right font-bold ${m.cantidad_delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {m.cantidad_delta >= 0 ? '+' : ''}{m.cantidad_delta}
                  </td>
                  <td className="py-2 px-3 text-right text-zinc-500">{m.existencia_anterior}</td>
                  <td className="py-2 px-3 text-right font-bold text-zinc-900">{m.existencia_nueva}</td>
                  <td className="py-2 px-3 text-zinc-600">{m.motivo}</td>
                  <td className="py-2 px-3 text-zinc-500">{m.usuario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
