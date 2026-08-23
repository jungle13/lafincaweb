'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Receipt, 
  Check 
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
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

type SortField = 'fecha' | 'factura' | 'proveedor' | 'insumo' | 'cantidadKg' | 'costoUnitarioKg' | 'totalPesos';

export default function ComprasPage() {
  const [compras, setCompras] = useState<CompraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 14;

  // Modal de liquidación
  const [selectedCompra, setSelectedCompra] = useState<CompraItem | null>(null);
  const [modalFactura, setModalFactura] = useState('');
  const [modalProveedor, setModalProveedor] = useState('');
  const [modalCostoTotal, setModalCostoTotal] = useState('');
  const [modalObs, setModalObs] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCompras = async () => {
    try {
      const res = await fetch(`/api/compras?t=${Date.now()}`, { cache: 'no-store' });
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

  const totalInvertido = useMemo(() => {
    return compras.reduce((acc, c) => acc + (c.totalPesos || 0), 0);
  }, [compras]);

  // Filtrado
  const filteredCompras = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);
    if (!cleanSearch) return compras;
    return compras.filter((c) => {
      const prov = normalizeStr(c.proveedor);
      const fac = normalizeStr(c.factura);
      const ins = normalizeStr(c.insumo);
      return prov.includes(cleanSearch) || fac.includes(cleanSearch) || ins.includes(cleanSearch);
    });
  }, [compras, searchQuery]);

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
    setModalFactura(compra.factura || 'PENDIENTE');
    setModalProveedor(compra.proveedor === 'Pendiente de Factura' || compra.proveedor === 'Proveedor Local' ? '' : compra.proveedor);
    setModalCostoTotal(compra.totalPesos ? String(compra.totalPesos) : '');
    setModalObs(compra.observaciones || 'Ingreso registrado desde Terminal Bodeguero');
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
          numeroFactura: modalFactura.trim() || 'PENDIENTE',
          proveedor: modalProveedor.trim() || 'Proveedor Local',
          observaciones: modalObs.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar');

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
        <p className="text-xs font-normal">Cargando Módulo de Compras...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 animate-fade-in font-normal">
      {/* Barra Superior Plana */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-medium text-slate-900 tracking-tight">
            Registro Detallado de Compras
          </h2>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-orange-50/80 border border-orange-200/60 text-xs font-normal text-slate-700">
            <span className="text-slate-500">Inversión:</span>
            <span className="text-orange-600 font-medium">$ {formatMoney(totalInvertido)}</span>
          </span>
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por insumo, factura o proveedor"
            className="w-full h-8 px-3 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 font-normal"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-normal"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* 💻 Vista Tabla de Escritorio (hidden en móvil, visible en md+) */}
      <div className="hidden md:block w-full border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden font-normal">
        <div className="relative max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-normal">
            <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm text-slate-600 font-medium border-b border-slate-200 text-[11px] uppercase tracking-wider shadow-sm">
              <tr>
                <th
                  onClick={() => handleSort('fecha')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors select-none whitespace-nowrap"
                >
                FECHA {sortField === 'fecha' ? (sortAsc ? '↑' : '↓') : '↑↓'}
              </th>
              <th
                onClick={() => handleSort('factura')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                Nº FACTURA {sortField === 'factura' ? (sortAsc ? '↑' : '↓') : '↑↓'}
              </th>
              <th
                onClick={() => handleSort('proveedor')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                PROVEEDOR {sortField === 'proveedor' ? (sortAsc ? '↑' : '↓') : '↑↓'}
              </th>
              <th
                onClick={() => handleSort('insumo')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none"
              >
                INSUMO COMPRADO {sortField === 'insumo' ? (sortAsc ? '↑' : '↓') : '↑↓'}
              </th>
              <th
                onClick={() => handleSort('cantidadKg')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                CANT. (KG) {sortField === 'cantidadKg' ? (sortAsc ? '↑' : '↓') : '↑↓'}
              </th>
              <th
                onClick={() => handleSort('costoUnitarioKg')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                COSTO UNIT. {sortField === 'costoUnitarioKg' ? (sortAsc ? '↑' : '↓') : '↑↓'}
              </th>
              <th
                onClick={() => handleSort('totalPesos')}
                className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none whitespace-nowrap"
              >
                TOTAL {sortField === 'totalPesos' ? (sortAsc ? '↑' : '↓') : '↑↓'}
              </th>
              <th className="py-3 px-3 text-center whitespace-nowrap">
                ACCIÓN
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-slate-700 bg-white font-normal">
            {paginatedCompras.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-normal">
                  No se encontraron compras con el filtro ingresado.
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
                    <td className="py-3 px-3 text-slate-600 font-normal whitespace-nowrap text-xs">
                      {row.fecha}
                    </td>

                    {/* Nº Factura */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isPending && (!row.factura || row.factura === 'Pendiente' || row.factura === 'PENDIENTE') ? (
                        <span className="text-amber-600 font-normal italic inline-flex items-center gap-1 text-[11px]">
                          ⚠️ Pendiente
                        </span>
                      ) : (
                        <span className="text-slate-800 font-medium font-mono text-xs">
                          {row.factura}
                        </span>
                      )}
                    </td>

                    {/* Proveedor */}
                    <td className="py-3 px-3 whitespace-nowrap max-w-[160px] truncate">
                      {!row.proveedor || row.proveedor === 'Pendiente de Factura' || row.proveedor === 'Proveedor Local' ? (
                        <span className="text-slate-400 italic font-normal text-xs">
                          {row.proveedor || 'Sin especificar'}
                        </span>
                      ) : (
                        <span className="text-slate-700 font-normal text-xs">{row.proveedor}</span>
                      )}
                    </td>

                    {/* Insumo Comprado */}
                    <td className="py-3 px-3">
                      <span className="text-slate-900 font-medium text-xs md:text-sm">
                        {row.insumo}
                      </span>
                    </td>

                    {/* Cantidad (Kg) */}
                    <td className="py-3 px-3 text-right text-slate-700 font-normal whitespace-nowrap text-xs">
                      {row.cantidadKg > 0 ? `${row.cantidadKg.toFixed(2)}` : '-'}
                    </td>

                    {/* Costo Unitario */}
                    <td className="py-3 px-3 text-right text-slate-600 font-normal whitespace-nowrap text-xs">
                      {row.costoUnitarioKg > 0 ? `$ ${formatMoney(row.costoUnitarioKg)}` : '-'}
                    </td>

                    {/* Total Factura */}
                    <td className="py-3 px-3 text-right text-rose-600 font-medium text-xs md:text-sm whitespace-nowrap">
                      $ {formatMoney(row.totalPesos)}
                    </td>

                    {/* Acción Button */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenModal(row)}
                        className="px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg text-xs font-normal shadow-sm inline-flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        <span>✏️</span>
                        <span>Completar Factura</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* 📱 Vista de Tarjetas Móvil (visible en móvil, hidden en md+) */}
      <div className="block md:hidden space-y-3 pt-1">
        {paginatedCompras.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-normal text-xs">
            No se encontraron compras con el filtro ingresado.
          </div>
        ) : (
          paginatedCompras.map((row) => {
            const isPending =
              row.estadoFactura === 'PENDIENTE' ||
              row.factura === 'Pendiente' ||
              row.factura === 'PENDIENTE' ||
              row.proveedor === 'Pendiente de Factura' ||
              row.proveedor === 'Proveedor Local';

            return (
              <div
                key={row.id}
                className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-sm text-xs font-normal"
              >
                {/* Header de la tarjeta: Insumo y Total */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <span className="text-sm font-medium text-slate-900 block">{row.insumo}</span>
                    <span className="text-[11px] text-slate-400">{row.fecha}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-rose-600 block">
                      $ {formatMoney(row.totalPesos)}
                    </span>
                  </div>
                </div>

                {/* Grid de detalles */}
                <div className="grid grid-cols-2 gap-2 text-xs py-0.5">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Factura</span>
                    {isPending && (!row.factura || row.factura === 'Pendiente' || row.factura === 'PENDIENTE') ? (
                      <span className="text-amber-600 font-normal italic text-[11px]">⚠️ Pendiente</span>
                    ) : (
                      <span className="text-slate-800 font-mono text-xs">{row.factura}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Proveedor</span>
                    <span className="text-slate-700 truncate block text-xs">
                      {row.proveedor || 'Sin especificar'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Cantidad</span>
                    <span className="text-slate-800 font-medium text-xs">
                      {row.cantidadKg > 0 ? `${row.cantidadKg.toFixed(2)} Kg` : '-'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Costo / Kg</span>
                    <span className="text-slate-600 text-xs">
                      {row.costoUnitarioKg > 0 ? `$ ${formatMoney(row.costoUnitarioKg)}` : '-'}
                    </span>
                  </div>
                </div>

                {/* Botón de acción móvil */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleOpenModal(row)}
                    className="w-full py-2 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg text-xs font-medium shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <span>✏️</span>
                    <span>Completar Factura</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-slate-500 pt-2 font-normal">
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

      {/* Modal Estandarizado */}
      <Modal
        isOpen={Boolean(selectedCompra)}
        onClose={() => setSelectedCompra(null)}
        title="Completar / Liquidar Factura"
        icon={<Receipt className="w-5 h-5 text-orange-500" />}
        maxWidth="max-w-md"
      >
        {selectedCompra && (
          <form onSubmit={handleSaveModal} className="space-y-3.5 text-xs font-normal">
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
              <div className="text-slate-500 text-[11px] font-normal">
                Materia prima ingresada por Bodeguero:
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-900 font-medium text-sm">
                  {selectedCompra.insumo}
                </span>
                <span className="text-blue-600 font-medium text-xs bg-blue-100/70 px-2 py-0.5 rounded-md">
                  {selectedCompra.cantidadKg > 0 ? `${selectedCompra.cantidadKg.toFixed(2)} Kg` : 'Lote'}
                </span>
              </div>
              <div className="text-slate-400 text-[11px] font-normal">
                Fecha de recepción: {selectedCompra.fecha}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nº de Factura Oficial / Remisión *
              </label>
              <input
                type="text"
                required
                value={modalFactura}
                onChange={(e) => setModalFactura(e.target.value)}
                placeholder="PENDIENTE"
                className="w-full h-9 px-3 rounded-lg border border-orange-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 text-slate-800 font-normal outline-none shadow-sm"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Proveedor Real *
              </label>
              <input
                type="text"
                required
                value={modalProveedor}
                onChange={(e) => setModalProveedor(e.target.value)}
                placeholder="Ej. Frigorífico Central S.A.S"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 text-slate-800 font-normal outline-none shadow-sm"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Costo Total Factura ($ COP) *
              </label>
              <input
                type="number"
                required
                value={modalCostoTotal}
                onChange={(e) => setModalCostoTotal(e.target.value)}
                placeholder="Ej. 40000"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 text-slate-800 font-normal outline-none shadow-sm"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Observaciones Administrativas
              </label>
              <input
                type="text"
                value={modalObs}
                onChange={(e) => setModalObs(e.target.value)}
                placeholder="Ingreso registrado desde Terminal Bodeguero"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 text-slate-800 font-normal outline-none shadow-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCompra(null)}
                className="px-4 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white font-medium text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Guardar y Confirmar Factura</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
