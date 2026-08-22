'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  X, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { formatMoney, normalizeStr } from '@/lib/formatters';

interface CompraItem {
  id: string;
  compraId: number | string;
  fecha: string;
  factura: string;
  proveedor: string;
  insumo: string;
  categoria: string;
  cantidadKg: number;
  costoUnitarioKg: number;
  totalPesos: number;
  estadoFactura: 'COMPLETA' | 'PENDIENTE';
  observaciones?: string;
}

type SortField = 'fecha' | 'factura' | 'proveedor' | 'categoria' | 'insumo' | 'cantidadKg' | 'costoUnitarioKg' | 'totalPesos' | 'estadoFactura';

export default function ComprasPage() {
  const [compras, setCompras] = useState<CompraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('ALL');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modal de edición
  const [selectedCompra, setSelectedCompra] = useState<CompraItem | null>(null);
  const [modalFactura, setModalFactura] = useState('');
  const [modalProveedor, setModalProveedor] = useState('');
  const [modalObs, setModalObs] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCompras = async () => {
    try {
      const res = await fetch('/api/compras');
      const data = await res.json();
      if (data.data) setCompras(data.data);
    } catch (e) {
      console.error('Error fetching compras:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompras();
  }, []);

  // Extraer categorías únicas
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    compras.forEach((c) => {
      if (c.categoria) set.add(c.categoria);
    });
    return Array.from(set).sort();
  }, [compras]);

  // Filtrado
  const filteredCompras = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);
    return compras.filter((c) => {
      if (selectedCat !== 'ALL' && normalizeStr(c.categoria) !== normalizeStr(selectedCat)) {
        return false;
      }
      if (!cleanSearch) return true;
      const prov = normalizeStr(c.proveedor);
      const fac = normalizeStr(c.factura);
      const ins = normalizeStr(c.insumo);
      return prov.includes(cleanSearch) || fac.includes(cleanSearch) || ins.includes(cleanSearch);
    });
  }, [compras, searchQuery, selectedCat]);

  // Ordenamiento
  const sortedCompras = useMemo(() => {
    const list = [...filteredCompras];
    list.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      }
      return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
    return list;
  }, [filteredCompras, sortField, sortAsc]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sortedCompras.length / itemsPerPage));
  const paginatedCompras = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedCompras.slice(start, start + itemsPerPage);
  }, [sortedCompras, currentPage]);

  // Totales
  const totals = useMemo(() => {
    let sumKg = 0;
    let sumTotal = 0;
    filteredCompras.forEach((c) => {
      sumKg += c.cantidadKg || 0;
      sumTotal += c.totalPesos || 0;
    });
    return { sumKg, sumTotal };
  }, [filteredCompras]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleOpenModal = (compra: CompraItem) => {
    setSelectedCompra(compra);
    setModalFactura(compra.factura === 'Pendiente' || compra.factura === 'PENDIENTE' ? '' : compra.factura);
    setModalProveedor(compra.proveedor === 'Pendiente de Factura' || compra.proveedor === 'Proveedor Local' ? '' : compra.proveedor);
    setModalObs(compra.observaciones || '');
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompra) return;

    setSaving(true);
    try {
      const res = await fetch('/api/compras', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compraId: selectedCompra.compraId,
          numeroFactura: modalFactura.trim() || 'Pendiente',
          proveedor: modalProveedor.trim() || 'Proveedor Local',
          observaciones: modalObs.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar factura');

      setSelectedCompra(null);
      await loadCompras();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-sm font-semibold">Cargando Registro de Compras...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-fade-in">
      {/* Main Table Card (Exact match to screenshot) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
          <h2 className="font-bold text-base md:text-lg text-slate-800 tracking-tight">
            Registro Detallado de Compras
          </h2>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar por insumo, factura o prov"
                className="w-64 h-8 px-3 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Category Select */}
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
              <span>Categoría:</span>
              <select
                value={selectedCat}
                onChange={(e) => {
                  setSelectedCat(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 text-xs font-medium rounded-lg border border-slate-300 outline-none focus:border-orange-500 bg-white text-slate-800 shadow-sm cursor-pointer"
              >
                <option value="ALL">Todas las Categorías</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Desktop Table View (Exact aesthetic match to screenshot) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th
                  onClick={() => handleSort('fecha')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none"
                >
                  FECHA {sortField === 'fecha' ? (sortAsc ? '↑' : '↓') : '↑↓'}
                </th>
                <th
                  onClick={() => handleSort('factura')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none"
                >
                  Nº FACTURA {sortField === 'factura' ? (sortAsc ? '↑' : '↓') : '↑↓'}
                </th>
                <th
                  onClick={() => handleSort('proveedor')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none"
                >
                  PROVEEDOR {sortField === 'proveedor' ? (sortAsc ? '↑' : '↓') : '↑↓'}
                </th>
                <th
                  onClick={() => handleSort('categoria')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none"
                >
                  CATEGORÍA {sortField === 'categoria' ? (sortAsc ? '↑' : '↓') : '↑↓'}
                </th>
                <th
                  onClick={() => handleSort('insumo')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none"
                >
                  INSUMO COMPRADO {sortField === 'insumo' ? (sortAsc ? '↑' : '↓') : '↑↓'}
                </th>
                <th
                  onClick={() => handleSort('cantidadKg')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  CANTIDAD (KG) {sortField === 'cantidadKg' ? (sortAsc ? '↑' : '↓') : '↑↓'}
                </th>
                <th
                  onClick={() => handleSort('costoUnitarioKg')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  COSTO UNIT. {sortField === 'costoUnitarioKg' ? (sortAsc ? '↑' : '↓') : '↑↓'}
                </th>
                <th
                  onClick={() => handleSort('totalPesos')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  TOTAL FACTURA {sortField === 'totalPesos' ? (sortAsc ? '↑' : '↓') : '↑↓'}
                </th>
                <th
                  onClick={() => handleSort('estadoFactura')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 select-none"
                >
                  ESTADO FACTURA {sortField === 'estadoFactura' ? (sortAsc ? '↑' : '↓') : '↑↓'}
                </th>
                <th className="py-3 px-3 text-center">
                  ACCIÓN
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              {paginatedCompras.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    No se encontraron compras con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedCompras.map((row) => {
                  const isPending =
                    row.estadoFactura === 'PENDIENTE' ||
                    row.factura === 'Pendiente' ||
                    row.factura === 'PENDIENTE' ||
                    row.proveedor === 'Pendiente de Factura' ||
                    row.proveedor === 'Proveedor Local';

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Fecha */}
                      <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                        {row.fecha}
                      </td>

                      {/* Nº Factura */}
                      <td className="py-3 px-3">
                        {isPending && (!row.factura || row.factura === 'Pendiente' || row.factura === 'PENDIENTE') ? (
                          <span className="text-amber-600 font-bold italic inline-flex items-center gap-1">
                            ⚠️ Pendiente
                          </span>
                        ) : (
                          <strong className="font-bold text-slate-900 font-mono">
                            {row.factura}
                          </strong>
                        )}
                      </td>

                      {/* Proveedor */}
                      <td className="py-3 px-3">
                        {!row.proveedor || row.proveedor === 'Pendiente de Factura' || row.proveedor === 'Proveedor Local' ? (
                          <span className="text-slate-500 italic">
                            {row.proveedor || 'Sin especificar'}
                          </span>
                        ) : (
                          <span className="text-slate-800 font-medium">{row.proveedor}</span>
                        )}
                      </td>

                      {/* Categoría */}
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
                          {row.categoria}
                        </span>
                      </td>

                      {/* Insumo Comprado */}
                      <td className="py-3 px-3">
                        <strong className="font-bold text-slate-900 text-xs md:text-sm">
                          {row.insumo}
                        </strong>
                      </td>

                      {/* Cantidad (Kg) */}
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {row.cantidadKg > 0 ? row.cantidadKg.toFixed(2) : '-'}
                      </td>

                      {/* Costo Unitario */}
                      <td className="py-3 px-3 text-right text-slate-700">
                        {row.costoUnitarioKg > 0 ? `$ ${formatMoney(row.costoUnitarioKg)}` : '-'}
                      </td>

                      {/* Total Factura (Red font exact match) */}
                      <td className="py-3 px-3 text-right font-bold text-rose-600 text-sm">
                        $ {formatMoney(row.totalPesos)}
                      </td>

                      {/* Estado Factura */}
                      <td className="py-3 px-3 text-center">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fef3c7] text-[#b45309] border border-[#fde68a] whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3 text-[#d97706]" />
                            <span>PENDIENTE FACTURA</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0] whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 text-[#059669]" />
                            <span>COMPLETA</span>
                          </span>
                        )}
                      </td>

                      {/* Acción Button */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(row)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-sm inline-flex items-center gap-1 whitespace-nowrap ${
                            isPending
                              ? 'bg-[#f59e0b] hover:bg-[#d97706] text-white active:scale-95'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          }`}
                        >
                          <span>✏️</span>
                          <span>{isPending ? 'Completar Factura' : 'Editar'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Summary Footer Bar (Exact match to screenshot) */}
        <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 px-4 flex items-center justify-between text-xs font-bold text-slate-800">
          <div className="flex-1 text-center md:text-right md:pr-44 space-x-2">
            <span className="text-slate-500 font-semibold">Total Compras:</span>
            <span className="text-slate-900 font-bold">{totals.sumKg.toFixed(2)}</span>
          </div>
          <div className="text-right text-rose-600 font-bold text-sm md:pr-24">
            $ {formatMoney(totals.sumTotal)}
          </div>
        </div>

        {/* Pagination Bar (Exact match to screenshot) */}
        <div className="flex items-center justify-end gap-3 text-xs text-slate-500 pt-2">
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Completar / Editar Factura */}
      {selectedCompra && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>✏️</span>
                <span>Completar Datos de Factura</span>
              </h3>
              <button
                onClick={() => setSelectedCompra(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3.5 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-slate-500">Insumo: <strong className="text-slate-900">{selectedCompra.insumo}</strong></div>
                <div className="text-slate-500">Fecha: <strong className="text-slate-900">{selectedCompra.fecha}</strong> • Total: <strong className="text-rose-600">${formatMoney(selectedCompra.totalPesos)}</strong></div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Nº de Factura / Remisión *
                </label>
                <input
                  type="text"
                  required
                  value={modalFactura}
                  onChange={(e) => setModalFactura(e.target.value)}
                  placeholder="Ej. FAC-9821"
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Nombre del Proveedor *
                </label>
                <input
                  type="text"
                  required
                  value={modalProveedor}
                  onChange={(e) => setModalProveedor(e.target.value)}
                  placeholder="Ej. Frigorífico Central"
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  value={modalObs}
                  onChange={(e) => setModalObs(e.target.value)}
                  placeholder="Notas adicionales..."
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedCompra(null)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar Factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
