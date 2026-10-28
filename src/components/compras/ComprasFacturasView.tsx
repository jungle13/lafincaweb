'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Receipt, 
  Calendar, 
  Building2,
  Package
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { CompraFacturaGroup } from '@/services/comprasService';
import ComprasPagination from '@/components/compras/ComprasPagination';

interface Props {
  facturas: CompraFacturaGroup[];
}

export default function ComprasFacturasView({ facturas }: Props) {
  // State de facturas desplegadas
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset page cuando cambia la lista o filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [facturas.length]);

  const totalPages = Math.ceil(facturas.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, facturas.length);
  const paginatedFacturas = facturas.slice(startIndex, endIndex);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(paginatedFacturas.map((f) => f.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  if (facturas.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 border border-slate-200 text-center text-slate-500">
        <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-medium">No se encontraron facturas con los filtros seleccionados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Barra de Controles de Expansión */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>Mostrando {startIndex + 1} a {endIndex} de {facturas.length} facturas agrupadas</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
          >
            Expandir página
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
          >
            Colapsar todas
          </button>
        </div>
      </div>

      {/* Lista de Facturas Paginadas */}
      {paginatedFacturas.map((fac) => {
        const isExpanded = expandedIds.has(fac.id);
        return (
          <div
            key={fac.id}
            className="bg-white rounded-lg border border-slate-200 overflow-hidden transition-all shadow-2xs"
          >
            {/* Encabezado de la Factura */}
            <div
              onClick={() => toggleExpand(fac.id)}
              className="p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
            >
              <div className="flex items-start sm:items-center gap-2.5">
                <button
                  type="button"
                  className="p-1 rounded text-slate-400 hover:text-slate-700 mt-0.5 sm:mt-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Fecha */}
                  <span className="flex items-center gap-1 text-xs font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {fac.fecha}
                  </span>

                  {/* Factura */}
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-900 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded">
                    <Receipt className="w-3 h-3 text-indigo-600" />
                    {fac.numero_factura}
                  </span>

                  {/* Proveedor */}
                  <span className="flex items-center gap-1 text-xs text-slate-700 font-medium">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {fac.proveedor}
                  </span>
                </div>
              </div>

              {/* Total y Metadatos de la Factura */}
              <div className="flex items-center justify-between md:justify-end gap-3 pl-7 sm:pl-0">
                {/* PDF Origen */}
                {fac.origen && (
                  <span
                    title={`Archivo de extracción: ${fac.origen}`}
                    className="hidden lg:flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded max-w-[200px] truncate"
                  >
                    <FileText className="w-3 h-3 text-rose-500 shrink-0" />
                    <span className="truncate">{fac.origen}</span>
                  </span>
                )}

                {/* Ítems count */}
                <span className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  <Package className="w-3 h-3 text-slate-400" />
                  {fac.items.length} {fac.items.length === 1 ? 'ítem' : 'ítems'}
                </span>

                {/* Total Factura */}
                <div className="text-right">
                  <div className="text-sm md:text-base font-bold text-slate-900 font-mono tracking-tight">
                    $ {formatMoney(fac.valor_total)}
                  </div>
                </div>
              </div>
            </div>

            {/* Detalle Desplegable de Ítems */}
            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-2 sm:p-3">
                <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Insumo (BD)</th>
                        <th className="py-2 px-3">Detalle Factura Original</th>
                        <th className="py-2 px-3">Categoría</th>
                        <th className="py-2 px-3 text-right">Cantidad</th>
                        <th className="py-2 px-3 text-center">Unidad</th>
                        <th className="py-2 px-3 text-right">Costo Unitario</th>
                        <th className="py-2 px-3 text-right">Total Compra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fac.items.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {it.nombre_insumo}
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                            {it.detalle}
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-[10px] uppercase font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {it.categoria}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {it.cantidad.toLocaleString('es-CO', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                              {it.unidad}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            $ {formatMoney(it.costo_unitario)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            $ {formatMoney(it.valor_compra)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold text-slate-900 text-xs">
                      <tr>
                        <td colSpan={3} className="py-2 px-3 text-slate-600 font-medium">
                          Total Factura {fac.numero_factura}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {fac.items
                            .reduce((sum, it) => sum + it.cantidad, 0)
                            .toLocaleString('es-CO', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}
                        </td>
                        <td></td>
                        <td></td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700 text-sm font-bold">
                          $ {formatMoney(fac.valor_total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Observaciones o archivo si existen */}
                {(fac.observaciones || fac.origen) && (
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>
                      {fac.observaciones && `Observación: ${fac.observaciones}`}
                    </span>
                    <span className="font-mono text-[10px]">
                      Origen: {fac.origen || 'No especificado'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Control de Paginación */}
      <ComprasPagination
        currentPage={validCurrentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={facturas.length}
        itemLabel="facturas"
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  );
}
