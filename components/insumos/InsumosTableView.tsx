'use client';

import { useState } from 'react';
import { 
  Package, 
  CheckCircle2, 
  ListOrdered, 
  Layers, 
  ChevronLeft, 
  ChevronRight,
  Receipt
} from 'lucide-react';
import { TransaccionGastoInsumo, ItemCosteoGroup } from '@/services/insumosCosteoService';
import { formatMoney } from '@/lib/formatters';

interface Props {
  transacciones: TransaccionGastoInsumo[];
  itemsAgrupados: ItemCosteoGroup[];
}

export default function InsumosTableView({ transacciones, itemsAgrupados }: Props) {
  const [displayMode, setDisplayMode] = useState<'DETALLADO' | 'CONSOLIDADO'>('DETALLADO');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const totalPages = Math.ceil(
    (displayMode === 'DETALLADO' ? transacciones.length : itemsAgrupados.length) / itemsPerPage
  );

  const paginatedTransacciones = transacciones.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const paginatedItems = itemsAgrupados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleModeChange = (mode: 'DETALLADO' | 'CONSOLIDADO') => {
    setDisplayMode(mode);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-3">
      {/* Selector de Modo de Tabla: Detalle vs Consolidado */}
      <div className="flex items-center justify-between text-xs text-slate-500 pb-1 flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => handleModeChange('DETALLADO')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              displayMode === 'DETALLADO'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Transacciones Individuales ({transacciones.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('CONSOLIDADO')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              displayMode === 'CONSOLIDADO'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Consolidado por Ítem ({itemsAgrupados.length})</span>
          </button>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Página <strong>{currentPage}</strong> de {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Tabla según el modo seleccionado */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {displayMode === 'DETALLADO' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Ítem / Insumo</th>
                  <th className="py-2.5 px-3">Proveedor</th>
                  <th className="py-2.5 px-3">Comprobante</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3 text-right">Cantidad</th>
                  <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                  <th className="py-2.5 px-3 text-right">Valor Compra</th>
                  <th className="py-2.5 px-3 text-center">Cuaderno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTransacciones.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No se encontraron transacciones.
                    </td>
                  </tr>
                ) : (
                  paginatedTransacciones.map((t) => {
                    const cruza = t.relacion_cuaderno?.includes('Cruza con Cuaderno');

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {t.fecha}
                        </td>
                        <td className="py-2.5 px-3 max-w-[220px]">
                          <div className="font-semibold text-slate-900 truncate" title={t.item}>
                            {t.item}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate" title={t.descripcion_original}>
                            {t.categoria} &bull; {t.descripcion_original}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 max-w-[150px] truncate" title={t.proveedor}>
                          {t.proveedor}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <code className="text-[11px] font-medium bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {t.numero_factura}
                          </code>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              t.tipo_contable === 'COSTO_DIRECTO'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {t.tipo_contable === 'COSTO_DIRECTO' ? 'Costo Directo' : 'Gasto Operativo'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {t.cantidad > 0 ? t.cantidad : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {t.costo_unitario > 0 ? `$ ${formatMoney(t.costo_unitario)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          $ {formatMoney(t.valor_total)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {cruza ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Cruza</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">No cruza</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Ítem / Insumo</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Tipo Contable</th>
                  <th className="py-2.5 px-3">Proveedor Principal</th>
                  <th className="py-2.5 px-3 text-center">N° Compras</th>
                  <th className="py-2.5 px-3 text-right">Cantidad Total</th>
                  <th className="py-2.5 px-3 text-right">Costo Promedio</th>
                  <th className="py-2.5 px-3 text-right">Total Invertido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No hay ítems para mostrar.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr key={item.item} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {item.item}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                          {item.categoria}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            item.tipoContable === 'COSTO_DIRECTO'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {item.tipoContable === 'COSTO_DIRECTO' ? 'Costo Directo' : 'Gasto Operativo'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[160px] truncate" title={item.proveedorPrincipal}>
                        {item.proveedorPrincipal}
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px]">
                          {item.comprasCount}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                        {item.cantidadTotal > 0 ? item.cantidadTotal.toFixed(2) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {item.costoPromedioPonderado > 0 ? `$ ${formatMoney(item.costoPromedioPonderado)}` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        $ {formatMoney(item.valorTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
