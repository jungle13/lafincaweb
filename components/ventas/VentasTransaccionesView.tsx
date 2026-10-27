'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  X, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  TrendingUp 
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
    <div className="space-y-3 font-normal text-xs animate-fade-in">
      {/* Barra de Filtros Minimalista */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-xs">
                Listado de Salidas por Venta ({totalCount.toLocaleString('es-CO')} registros)
              </h3>
              <p className="text-[11px] text-slate-500">
                Registro consolidado de salidas diarias
              </p>
            </div>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código o nombre de producto..."
              className="w-full h-8 pl-8 pr-7 text-xs rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white placeholder-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
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
            className="h-8 px-2.5 rounded-md border border-slate-200 text-slate-700 bg-white outline-none focus:border-slate-400 text-xs cursor-pointer"
          >
            <option value="ALL">Todas las Fechas ({fechasDisponibles.length} días)</option>
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
            className="h-8 px-2.5 rounded-md border border-slate-200 text-slate-700 bg-white outline-none focus:border-slate-400 text-xs cursor-pointer"
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
              type="button"
              onClick={() => {
                setSelectedFecha('ALL');
                setSelectedCategoria('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium ml-auto cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Transacciones Estandarizada */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="w-5 h-5 text-slate-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Cargando salidas por venta...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider select-none shadow-2xs">
                    <th className="py-2.5 px-3 whitespace-nowrap">Fecha de Venta</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Código</th>
                    <th className="py-2.5 px-3">Nombre del Producto</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Categoría</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Cantidad</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Precio Unitario</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Impoconsumo (8%)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">IVA (0%)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-slate-900">Total Vendido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {transacciones.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        No se encontraron registros de venta para este filtro.
                      </td>
                    </tr>
                  ) : (
                    transacciones.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                          {t.fecha}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          {t.codigo_producto}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-semibold text-slate-900">
                          {t.nombre_producto}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {t.categoria}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-center font-mono font-bold text-slate-800">
                          {t.cantidad} <span className="text-[10px] text-slate-400 font-normal">{t.unidad}</span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-slate-600">
                          ${formatMoney(t.valor_unitario)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-slate-500">
                          ${formatMoney(t.impuesto)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-slate-400">
                          $0
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right font-mono font-bold text-slate-900">
                          ${formatMoney(t.gran_total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-mono">
                Página <strong>{page}</strong> de <strong>{totalPages}</strong> &bull; Mostrando {transacciones.length} de {totalCount} registros
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => loadData(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadData(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer text-xs"
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
