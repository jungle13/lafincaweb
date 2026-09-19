'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  X, 
  Filter, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  ListOrdered 
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { VentaDetalle } from '@/services/ventasService';

interface Props {
  periodoId: string;
  fechasDisponibles: string[];
  categoriasDisponibles: string[];
}

export default function VentasTransaccionesView({
  periodoId,
  fechasDisponibles,
  categoriasDisponibles
}: Props) {
  const [transacciones, setTransacciones] = useState<VentaDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filtros
  const [selectedFecha, setSelectedFecha] = useState('ALL');
  const [selectedCategoria, setSelectedCategoria] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async (p: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('periodo_id', periodoId);
      params.set('view', 'TRANSACCIONES');
      params.set('page', String(p));
      params.set('pageSize', '50');

      if (selectedFecha !== 'ALL') params.set('fecha', selectedFecha);
      if (selectedCategoria !== 'ALL') params.set('categoria', selectedCategoria);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/ventas?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setTransacciones(json.transacciones || []);
        setTotalPages(json.totalPages || 1);
        setTotalCount(json.total || 0);
        setPage(json.page || 1);
      }
    } catch (e) {
      console.error('Error cargando transacciones de venta:', e);
    } finally {
      setLoading(false);
    }
  }, [periodoId, selectedFecha, selectedCategoria, searchQuery]);

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  return (
    <div className="space-y-3 font-normal text-xs">
      {/* Barra de Filtros */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-xs">
                Transacciones Detalladas ({totalCount.toLocaleString('es-CO')} registros)
              </h3>
              <p className="text-[11px] text-slate-500">Filtrable por fecha, categoría y código</p>
            </div>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por producto o código..."
              className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-slate-300 outline-none focus:border-indigo-500 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 flex items-center gap-1 text-[11px]">
            <Filter className="w-3 h-3" />
            <span>Filtros:</span>
          </span>

          {/* Filtro Fecha */}
          <select
            value={selectedFecha}
            onChange={(e) => setSelectedFecha(e.target.value)}
            className="h-7 px-2.5 rounded-lg border border-slate-300 text-slate-700 bg-white outline-none focus:border-indigo-500 text-xs cursor-pointer"
          >
            <option value="ALL">Todas las Fechas (14 días)</option>
            {fechasDisponibles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Filtro Categoría */}
          <select
            value={selectedCategoria}
            onChange={(e) => setSelectedCategoria(e.target.value)}
            className="h-7 px-2.5 rounded-lg border border-slate-300 text-slate-700 bg-white outline-none focus:border-indigo-500 text-xs cursor-pointer"
          >
            <option value="ALL">Todas las Categorías</option>
            {categoriasDisponibles.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Limpiar Filtros */}
          {(selectedFecha !== 'ALL' || selectedCategoria !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedFecha('ALL');
                setSelectedCategoria('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-auto cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Transacciones */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Cargando transacciones de ventas...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Archivo POS</th>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Plato / Producto</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3 text-center">Cantidad</th>
                    <th className="py-2.5 px-3 text-right">Venta Bruta</th>
                    <th className="py-2.5 px-3 text-right">Descuento</th>
                    <th className="py-2.5 px-3 text-right">Venta Neta</th>
                    <th className="py-2.5 px-3 text-right">Impoconsumo (8%)</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900">Total</th>
                    <th className="py-2.5 px-3 text-right">P. Unitario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {transacciones.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-900">
                        {t.fecha}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                        {t.archivo_origen}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {t.codigo_producto}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-semibold text-slate-900">
                        {t.nombre_producto}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600">
                          {t.categoria}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-center font-bold text-slate-800">
                        {t.cantidad} <span className="text-[10px] text-slate-400 font-normal">{t.unidad}</span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right text-slate-600">
                        $ {formatMoney(t.venta_bruta)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right text-red-600 font-medium">
                        {t.descuento > 0 ? `-$ ${formatMoney(t.descuento)}` : '$ 0'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right font-medium text-blue-700">
                        $ {formatMoney(t.venta_neta)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right text-amber-700">
                        $ {formatMoney(t.impuesto)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right font-bold text-slate-900 text-sm">
                        $ {formatMoney(t.gran_total)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right text-slate-500 text-[11px]">
                        $ {formatMoney(t.valor_unitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-slate-500">
                Página <strong>{page}</strong> de <strong>{totalPages}</strong> &bull; Mostrando {transacciones.length} de {totalCount} registros
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => loadData(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <button
                  onClick={() => loadData(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
