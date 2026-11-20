'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Edit3, PackagePlus, Search, Trash2, X } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import type { PosCategoria, ProductoVenta } from './types';

interface PosProductsModuleProps {
  productos: ProductoVenta[];
  categorias: PosCategoria[];
  canEditProducts: boolean;
  busyAction: boolean;
  onSaveProducto: (payload: Partial<ProductoVenta>) => Promise<void>;
  onDeleteProducto: (id: string) => Promise<void>;
}

export default function PosProductsModule({
  productos,
  categorias,
  canEditProducts,
  busyAction,
  onSaveProducto,
  onDeleteProducto,
}: PosProductsModuleProps) {
  const [search, setSearch] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('TODOS');
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [focusArea, setFocusArea] = useState<'SEARCH' | 'CARDS'>('SEARCH');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProd, setEditingProd] = useState<Partial<ProductoVenta>>({});

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const departamentos = useMemo(() => {
    const set = new Set<string>();
    categorias.forEach((c) => set.add(c.nombre.toUpperCase()));
    productos.forEach((p) => {
      if (p.categoria) set.add(p.categoria.toUpperCase());
    });
    return ['TODOS', ...Array.from(set).sort()];
  }, [productos, categorias]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productos.filter((p) => {
      const catUpper = (p.categoria || 'GENERAL').toUpperCase();
      const okCat = deptoFiltro === 'TODOS' || catUpper === deptoFiltro;
      const okQ = !q || p.nombre.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q);
      return okCat && okQ;
    });
  }, [productos, deptoFiltro, search]);

  useEffect(() => {
    setFocusedIdx((prev) => {
      if (filtrados.length === 0) return 0;
      return Math.min(prev, filtrados.length - 1);
    });
  }, [filtrados.length]);

  const selectedProd = filtrados[focusedIdx] || null;

  // Auto-escritura global y navegación por flechas entre cards
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showFormModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowFormModal(false);
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const isOtherInput = target?.tagName === 'INPUT' && target !== searchInputRef.current;
      const isSelect = target?.tagName === 'SELECT';
      if (isOtherInput || isSelect || target?.tagName === 'TEXTAREA') return;

      const isTypingSearch = target === searchInputRef.current;

      if (
        !isTypingSearch &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        e.key.length === 1 &&
        /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ .-]$/.test(e.key)
      ) {
        e.preventDefault();
        setFocusArea('SEARCH');
        setSearch((prev) => prev + e.key);
        setFocusedIdx(0);
        searchInputRef.current?.focus();
        return;
      }

      if (!isTypingSearch && e.key === 'Backspace') {
        e.preventDefault();
        setFocusArea('SEARCH');
        setSearch((prev) => prev.slice(0, -1));
        setFocusedIdx(0);
        searchInputRef.current?.focus();
        return;
      }

      if (filtrados.length === 0) return;
      const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const cols = w >= 1280 ? 4 : w >= 768 ? 3 : 2;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focusArea === 'SEARCH') {
          searchInputRef.current?.blur();
          setFocusArea('CARDS');
          setFocusedIdx(0);
          cardRefs.current[0]?.scrollIntoView({ block: 'nearest' });
        } else {
          const next = Math.min(filtrados.length - 1, focusedIdx + cols);
          setFocusedIdx(next);
          cardRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        }
        return;
      }

      if (e.key === 'ArrowUp' && focusArea === 'CARDS') {
        e.preventDefault();
        if (focusedIdx < cols) {
          setFocusArea('SEARCH');
          searchInputRef.current?.focus();
        } else {
          const prev = focusedIdx - cols;
          setFocusedIdx(prev);
          cardRefs.current[prev]?.scrollIntoView({ block: 'nearest' });
        }
        return;
      }

      if (e.key === 'ArrowRight' && focusArea === 'CARDS') {
        e.preventDefault();
        const next = Math.min(filtrados.length - 1, focusedIdx + 1);
        setFocusedIdx(next);
        cardRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return;
      }

      if (e.key === 'ArrowLeft' && focusArea === 'CARDS') {
        e.preventDefault();
        const prev = Math.max(0, focusedIdx - 1);
        setFocusedIdx(prev);
        cardRefs.current[prev]?.scrollIntoView({ block: 'nearest' });
        return;
      }

      if (e.key === 'Enter' && focusArea === 'CARDS' && canEditProducts && selectedProd) {
        e.preventDefault();
        setEditingProd({ ...selectedProd });
        setShowFormModal(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showFormModal, focusArea, focusedIdx, filtrados, canEditProducts, selectedProd]);

  const openNew = () => {
    if (!canEditProducts) return;
    const defaultCat = categorias[0]?.nombre || 'PLATOS';
    setEditingProd({
      codigo: '',
      nombre: '',
      categoria: defaultCat,
      costo_unitario: 0,
      precio_total: 0,
      precio_mayoreo: 0,
      existencia: 0,
      inv_minimo: 5,
      inv_maximo: 100,
      controla_inventario: Boolean(categorias[0]?.es_inventariable),
    });
    setShowFormModal(true);
  };

  const openEdit = (prod?: ProductoVenta) => {
    if (!canEditProducts) return;
    const target = prod || selectedProd;
    if (!target) return;
    setEditingProd({ ...target });
    setShowFormModal(true);
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      filtrados.map((p) => ({
        Código: p.codigo,
        Descripción: p.nombre,
        Categoría: p.categoria,
        'P. Venta': p.precio_total,
        'Controla Inv.': p.controla_inventario ? 'Sí' : 'No',
        Existencia: p.existencia || 0,
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Catálogo Productos');
    XLSX.writeFile(wb, `Catalogo_Productos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProducts) return;
    await onSaveProducto(editingProd);
    setShowFormModal(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-100 overflow-hidden p-3 gap-3">
      {/* Buscador Prominente + Acciones */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 flex flex-col gap-2.5 shrink-0 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-5 h-5 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              autoFocus
              type="text"
              value={search}
              onFocus={() => setFocusArea('SEARCH')}
              onChange={(e) => {
                setSearch(e.target.value);
                setFocusedIdx(0);
              }}
              placeholder="Escribe el nombre o código del producto (no necesitas hacer clic, solo escribe)..."
              className="w-full pl-11 pr-4 py-2.5 bg-blue-50/40 border-2 border-blue-200 focus:border-blue-600 focus:bg-white rounded-xl text-sm font-semibold text-zinc-950 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEditProducts && (
              <>
                <button
                  onClick={openNew}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <PackagePlus className="w-4 h-4" /> Nuevo Producto
                </button>
                <button
                  onClick={() => openEdit()}
                  disabled={!selectedProd}
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 disabled:opacity-40 text-xs font-bold text-zinc-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" /> Modificar
                </button>
                <button
                  onClick={() => selectedProd && window.confirm(`¿Desactivar "${selectedProd.nombre}"?`) && onDeleteProducto(selectedProd.id)}
                  disabled={!selectedProd || busyAction}
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-red-50 border border-zinc-300 hover:border-red-300 disabled:opacity-40 text-xs font-bold text-red-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              </>
            )}

            <button
              onClick={handleExport}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-bold text-zinc-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>

        {/* Categorías en chips táctiles */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {departamentos.map((d) => {
            const active = deptoFiltro === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDeptoFiltro(d);
                  setFocusedIdx(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border cursor-pointer transition ${
                  active
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grilla de Cards */}
      <div className="flex-1 overflow-y-auto">
        {filtrados.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-400">
            No se encontraron productos con &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
            {filtrados.map((p, idx) => {
              const isFocused = focusedIdx === idx;
              return (
                <div
                  key={p.id}
                  ref={(el) => {
                    cardRefs.current[idx] = el;
                  }}
                  onClick={() => {
                    setFocusedIdx(idx);
                    setFocusArea('CARDS');
                  }}
                  onDoubleClick={() => canEditProducts && openEdit(p)}
                  className={`bg-white rounded-xl border p-4 flex flex-col justify-between gap-3 cursor-pointer transition ${
                    isFocused && focusArea === 'CARDS'
                      ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50/40 shadow-sm'
                      : isFocused
                        ? 'border-blue-400 bg-blue-50/20'
                        : 'border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[10px] font-bold text-zinc-700 uppercase truncate">
                        {p.categoria || 'GENERAL'}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">{p.codigo || '—'}</span>
                    </div>
                    <h4 className="font-bold text-sm text-zinc-950 leading-snug line-clamp-2">{p.nombre}</h4>
                  </div>

                  <div className="flex items-end justify-between pt-2 border-t border-zinc-100">
                    <div>
                      <div className="text-[10px] text-zinc-400 uppercase font-semibold">Precio Venta</div>
                      <div className="text-base font-extrabold tabular-nums text-zinc-950">
                        {formatMoney(p.precio_total)}
                      </div>
                    </div>

                    {p.controla_inventario ? (
                      <span
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold tabular-nums border ${
                          Number(p.existencia || 0) <= Number(p.inv_minimo || 0)
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        Stock: {Number(p.existencia || 0)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-zinc-400">Cocina</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Crear / Modificar Producto (solo Admin / Gestor) */}
      {showFormModal && canEditProducts && (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitForm} className="bg-white rounded-2xl border border-zinc-300 max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="font-bold text-base text-zinc-950">
                {editingProd.id ? 'Modificar Producto' : 'Nuevo Producto'}
              </h3>
              <button type="button" onClick={() => setShowFormModal(false)} className="p-1 text-zinc-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Código / PLU</label>
                <input
                  type="text"
                  value={editingProd.codigo || ''}
                  onChange={(e) => setEditingProd({ ...editingProd, codigo: e.target.value })}
                  placeholder="Auto si se deja vacío"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Categoría Normalizada</label>
                <select
                  value={(editingProd.categoria || 'PLATOS').toUpperCase()}
                  onChange={(e) => {
                    const catName = e.target.value;
                    const catObj = categorias.find((c) => c.nombre.toUpperCase() === catName);
                    setEditingProd({
                      ...editingProd,
                      categoria: catName,
                      controla_inventario: catObj ? catObj.es_inventariable : editingProd.controla_inventario,
                    });
                  }}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl bg-white font-semibold"
                >
                  {departamentos
                    .filter((d) => d !== 'TODOS')
                    .map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="font-semibold text-zinc-700 block mb-1">Descripción del Producto</label>
                <input
                  type="text"
                  required
                  value={editingProd.nombre || ''}
                  onChange={(e) => setEditingProd({ ...editingProd, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-semibold"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Costo ($)</label>
                <input
                  type="number"
                  value={editingProd.costo_unitario ?? 0}
                  onChange={(e) => setEditingProd({ ...editingProd, costo_unitario: Number(e.target.value || 0) })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Precio Venta ($)</label>
                <input
                  type="number"
                  required
                  value={editingProd.precio_total ?? 0}
                  onChange={(e) => setEditingProd({ ...editingProd, precio_total: Number(e.target.value || 0) })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-bold tabular-nums"
                />
              </div>

              <div className="col-span-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingProd.controla_inventario)}
                    onChange={(e) => setEditingProd({ ...editingProd, controla_inventario: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="font-semibold text-zinc-800">
                    Controlar stock unitario en F4 Inventario (solo bebidas, desechables o insumos)
                  </span>
                </label>
              </div>

              {editingProd.controla_inventario && (
                <>
                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Existencia Actual</label>
                    <input
                      type="number"
                      value={editingProd.existencia ?? 0}
                      onChange={(e) => setEditingProd({ ...editingProd, existencia: Number(e.target.value || 0) })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Stock Mínimo</label>
                    <input
                      type="number"
                      value={editingProd.inv_minimo ?? 0}
                      onChange={(e) => setEditingProd({ ...editingProd, inv_minimo: Number(e.target.value || 0) })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-bold tabular-nums"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
              <button type="button" onClick={() => setShowFormModal(false)} className="px-4 py-2 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-700 cursor-pointer">
                Cancelar
              </button>
              <button type="submit" disabled={busyAction} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">
                Guardar Producto
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
