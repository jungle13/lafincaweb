'use client';

import { useState, useEffect } from 'react';
import { FileText, Package } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { CompraDetalleItem } from '@/services/comprasService';
import ComprasPagination from '@/components/compras/ComprasPagination';

interface Props {
  lineas: CompraDetalleItem[];
}

export default function ComprasLineasView({ lineas }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset page cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [lineas.length]);

  if (lineas.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 border border-slate-200 text-center text-slate-500">
        <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-medium">No se encontraron líneas de compra con los filtros seleccionados.</p>
      </div>
    );
  }

  const granTotalLineas = lineas.reduce((acc, l) => acc + l.valor_compra, 0);
  const totalCantidadLineas = lineas.reduce((acc, l) => acc + l.cantidad, 0);

  const totalPages = Math.ceil(lineas.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, lineas.length);
  const paginatedLineas = lineas.slice(startIndex, endIndex);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>Mostrando {startIndex + 1} a {endIndex} de {lineas.length} registros individuales</span>
        <span className="font-mono font-bold text-slate-900">
          Total: $ {formatMoney(granTotalLineas)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Fecha</th>
              <th className="py-2.5 px-3">N° Factura</th>
              <th className="py-2.5 px-3">Proveedor</th>
              <th className="py-2.5 px-3">Categoría</th>
              <th className="py-2.5 px-3">Insumo (BD)</th>
              <th className="py-2.5 px-3">Detalle Original (PDF)</th>
              <th className="py-2.5 px-3 text-right">Cantidad</th>
              <th className="py-2.5 px-3 text-center">Unidad</th>
              <th className="py-2.5 px-3 text-right">Costo Unitario</th>
              <th className="py-2.5 px-3 text-right">Total Compra</th>
              <th className="py-2.5 px-3">Origen PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedLineas.map((l, idx) => (
              <tr key={l.id || idx} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                  {l.fecha}
                </td>
                <td className="py-2 px-3 font-semibold text-slate-900 font-mono whitespace-nowrap">
                  {l.numero_factura}
                </td>
                <td className="py-2 px-3 text-slate-700 max-w-[150px] truncate" title={l.proveedor}>
                  {l.proveedor}
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className="text-[10px] uppercase font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                    {l.categoria}
                  </span>
                </td>
                <td className="py-2 px-3 font-semibold text-slate-900">
                  {l.nombre_insumo}
                </td>
                <td className="py-2 px-3 text-slate-500 font-mono text-[11px] max-w-[200px] truncate" title={l.detalle}>
                  {l.detalle}
                </td>
                <td className="py-2 px-3 text-right font-mono font-medium">
                  {l.cantidad.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                    {l.unidad}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono text-slate-600">
                  $ {formatMoney(l.costo_unitario)}
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                  $ {formatMoney(l.valor_compra)}
                </td>
                <td className="py-2 px-3 text-slate-400 font-mono text-[10px] max-w-[120px] truncate" title={l.origen}>
                  {l.origen}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold text-slate-900 text-xs">
            <tr>
              <td colSpan={6} className="py-2.5 px-3 text-slate-600 font-medium">
                Total Registros ({lineas.length} Líneas)
              </td>
              <td className="py-2.5 px-3 text-right font-mono">
                {totalCantidadLineas.toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td colSpan={2}></td>
              <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-sm font-bold">
                $ {formatMoney(granTotalLineas)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Control de Paginación */}
      <ComprasPagination
        currentPage={validCurrentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={lineas.length}
        itemLabel="líneas de compra"
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        pageSizeOptions={[15, 25, 50, 100, 200]}
      />
    </div>
  );
}
