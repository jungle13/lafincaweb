'use client';

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Edit3, FolderTree, PackagePlus, Search, Trash2, X } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import type { ProductoVenta } from './types';

interface PosProductsModuleProps {
  productos: ProductoVenta[];
  busyAction: boolean;
  onSaveProducto: (payload: Partial<ProductoVenta>) => Promise<void>;
  onDeleteProducto: (id: string) => Promise<void>;
}

export default function PosProductsModule({
  productos,
  busyAction,
  onSaveProducto,
  onDeleteProducto,
}: PosProductsModuleProps) {
  const [search, setSearch] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('TODOS');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProd, setEditingProd] = useState<Partial<ProductoVenta>>({});

  const departamentos = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p) => set.add(p.categoria || 'General'));
    return ['TODOS', ...Array.from(set).sort()];
  }, [productos]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productos.filter((p) => {
      const okCat = deptoFiltro === 'TODOS' || (p.categoria || 'General') === deptoFiltro;
      const okQ = !q || p.nombre.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q);
      return okCat && okQ;
    });
  }, [productos, deptoFiltro, search]);

  const selectedProd = useMemo(
    () => productos.find((p) => p.id === selectedId) || null,
    [productos, selectedId]
  );

  const openNew = () => {
    setEditingProd({
      codigo: '',
      nombre: '',
      categoria: 'Platos',
      costo_unitario: 0,
      precio_total: 0,
      precio_mayoreo: 0,
      existencia: 0,
      inv_minimo: 5,
      inv_maximo: 100,
    });
    setShowFormModal(true);
  };

  const openEdit = () => {
    if (!selectedProd) return;
    setEditingProd({ ...selectedProd });
    setShowFormModal(true);
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      filtrados.map((p) => ({
        Código: p.codigo,
        Descripción: p.nombre,
        Departamento: p.categoria,
        Costo: p.costo_unitario || 0,
        'P. Venta': p.precio_total,
        'P. Mayoreo': p.precio_mayoreo || 0,
        Existencia: p.existencia || 0,
        'Inv. Mínimo': p.inv_minimo || 0,
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Catálogo Productos');
    XLSX.writeFile(wb, `Catalogo_Productos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveProducto(editingProd);
    setShowFormModal(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-100 overflow-hidden">
      {/* Sub-barra estilo eleventa F3 Productos */}
      <div className="bg-white border-b border-zinc-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={openNew}
            className="px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <PackagePlus className="w-3.5 h-3.5" /> Nuevo Producto
          </button>
          <button
            onClick={openEdit}
            disabled={!selectedProd}
            className="px-3 py-1.5 rounded-md bg-white hover:bg-zinc-100 disabled:opacity-40 border border-zinc-300 text-zinc-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-zinc-600" /> Modificar
          </button>
          <button
            onClick={() => selectedProd && window.confirm(`¿Eliminar "${selectedProd.nombre}"?`) && onDeleteProducto(selectedProd.id)}
            disabled={!selectedProd || busyAction}
            className="px-3 py-1.5 rounded-md bg-white hover:bg-red-50 disabled:opacity-40 border border-zinc-300 text-red-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-600" /> Exportar Excel
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto o código..."
              className="pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-300 rounded-md text-xs outline-none focus:border-blue-600"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <FolderTree className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={deptoFiltro}
              onChange={(e) => setDeptoFiltro(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-md text-xs font-semibold"
            >
              {departamentos.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla Catálogo de Productos */}
      <div className="flex-1 overflow-y-auto bg-white m-3 rounded-lg border border-zinc-200">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase">
            <tr>
              <th className="py-2.5 px-3">Código</th>
              <th className="py-2.5 px-3">Descripción del Producto</th>
              <th className="py-2.5 px-3">Departamento</th>
              <th className="py-2.5 px-3 text-right">Costo</th>
              <th className="py-2.5 px-3 text-right">P. Venta</th>
              <th className="py-2.5 px-3 text-right">P. Mayoreo</th>
              <th className="py-2.5 px-3 text-right">Existencia</th>
              <th className="py-2.5 px-3 text-right">Inv. Mínimo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {filtrados.map((p) => {
              const sel = selectedId === p.id;
              const bajo = Number(p.existencia || 0) <= Number(p.inv_minimo || 0) && Number(p.inv_minimo || 0) > 0;
              return (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  onDoubleClick={() => { setEditingProd({ ...p }); setShowFormModal(true); }}
                  className={`cursor-pointer ${sel ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-zinc-50'}`}
                >
                  <td className="py-2 px-3 font-mono text-zinc-500">{p.codigo}</td>
                  <td className="py-2 px-3 font-semibold text-zinc-900">{p.nombre}</td>
                  <td className="py-2 px-3 text-zinc-600">{p.categoria}</td>
                  <td className="py-2 px-3 text-right text-zinc-600">{formatMoney(p.costo_unitario || 0)}</td>
                  <td className="py-2 px-3 text-right font-bold text-zinc-950">{formatMoney(p.precio_total)}</td>
                  <td className="py-2 px-3 text-right text-zinc-700">{formatMoney(p.precio_mayoreo || 0)}</td>
                  <td className={`py-2 px-3 text-right font-bold ${bajo ? 'text-red-700' : 'text-zinc-900'}`}>
                    {p.existencia ?? 0}
                  </td>
                  <td className="py-2 px-3 text-right text-zinc-500">{p.inv_minimo ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showFormModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitForm} className="bg-white rounded-xl border border-zinc-300 max-w-lg w-full p-5 space-y-3 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
              <h3 className="font-bold text-base text-zinc-950">
                {editingProd.id ? 'Modificar Producto' : 'Nuevo Producto'}
              </h3>
              <button type="button" onClick={() => setShowFormModal(false)} className="p-1 text-zinc-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Código de Barras / PLU</label>
                <input type="text" value={editingProd.codigo || ''} onChange={(e) => setEditingProd({ ...editingProd, codigo: e.target.value })} placeholder="Auto si vacío" className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-mono" />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Departamento / Categoría</label>
                <input type="text" required value={editingProd.categoria || ''} onChange={(e) => setEditingProd({ ...editingProd, categoria: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-300 rounded" />
              </div>
            </div>
            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Descripción del Producto</label>
              <input type="text" required value={editingProd.nombre || ''} onChange={(e) => setEditingProd({ ...editingProd, nombre: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-semibold" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Costo ($)</label>
                <input type="number" value={editingProd.costo_unitario ?? 0} onChange={(e) => setEditingProd({ ...editingProd, costo_unitario: Number(e.target.value || 0) })} className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-bold" />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Precio Venta ($)</label>
                <input type="number" required value={editingProd.precio_total ?? 0} onChange={(e) => setEditingProd({ ...editingProd, precio_total: Number(e.target.value || 0) })} className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-bold" />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">P. Mayoreo ($)</label>
                <input type="number" value={editingProd.precio_mayoreo ?? 0} onChange={(e) => setEditingProd({ ...editingProd, precio_mayoreo: Number(e.target.value || 0) })} className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Existencia Actual</label>
                <input type="number" step="any" value={editingProd.existencia ?? 0} onChange={(e) => setEditingProd({ ...editingProd, existencia: Number(e.target.value || 0) })} className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-bold" />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Inv. Mínimo</label>
                <input type="number" step="any" value={editingProd.inv_minimo ?? 0} onChange={(e) => setEditingProd({ ...editingProd, inv_minimo: Number(e.target.value || 0) })} className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-bold" />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Inv. Máximo</label>
                <input type="number" step="any" value={editingProd.inv_maximo ?? 0} onChange={(e) => setEditingProd({ ...editingProd, inv_maximo: Number(e.target.value || 0) })} className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-bold" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
              <button type="button" onClick={() => setShowFormModal(false)} className="px-4 py-2 rounded border border-zinc-300 font-semibold cursor-pointer">Cancelar</button>
              <button type="submit" disabled={busyAction} className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer">Guardar Producto</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
