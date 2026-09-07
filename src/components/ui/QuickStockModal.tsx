'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Boxes, 
  Search, 
  Sparkles, 
  Calendar, 
  RefreshCw, 
  TrendingUp, 
  X, 
  Layers, 
  Flame, 
  CheckCircle2, 
  Package, 
  Scissors, 
  CookingPot,
  ArrowRight,
  Filter
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';
import { InsumoItem } from '@/types';
import { usePeriodo } from '@/context/PeriodoContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'LIVE' | 'INITIAL' | 'CUTOFF';

export default function QuickStockModal({ isOpen, onClose }: Props) {
  const { periodos, currentPeriodo, selectedPeriodoId } = usePeriodo();
  
  const [viewMode, setViewMode] = useState<ViewMode>('LIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithStock, setOnlyWithStock] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  // Fecha para modo corte
  const [cutoffDate, setCutoffDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [liveInsumos, setLiveInsumos] = useState<InsumoItem[]>([]);
  const [periodStock, setPeriodStock] = useState<any[]>([]);
  const [fechasConMovimientos, setFechasConMovimientos] = useState<string[]>([]);

  // Cargar datos
  const fetchStockData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const ts = Date.now();
      const cutoffParam = viewMode === 'CUTOFF' && cutoffDate ? `&fecha_corte=${cutoffDate}` : '';
      const periodParam = selectedPeriodoId ? `&periodo_id=${selectedPeriodoId}` : '';

      const [liveRes, periodRes] = await Promise.all([
        fetch(`/api/bodega/stock?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/periodos?t=${ts}${periodParam}${cutoffParam}`, { cache: 'no-store' })
      ]);

      const liveData = await liveRes.json();
      const periodData = await periodRes.json();

      if (liveData.success) {
        setLiveInsumos(liveData.data || []);
      }

      if (periodData.success) {
        setPeriodStock(periodData.stock || []);
        setFechasConMovimientos(periodData.fechas_con_movimientos || []);
      }
    } catch (err) {
      console.error('Error fetching quick stock data:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, viewMode, cutoffDate, selectedPeriodoId]);

  useEffect(() => {
    if (isOpen) {
      fetchStockData();
    }
  }, [isOpen, fetchStockData]);

  // Lista de insumos unificada según el modo seleccionado
  const computedList = useMemo(() => {
    if (liveInsumos.length === 0) return [];

    if (viewMode === 'LIVE') {
      return liveInsumos;
    }

    if (viewMode === 'INITIAL') {
      const initialMap = currentPeriodo?.inventario_inicial || {};
      return liveInsumos.map((item) => {
        const initData = initialMap[String(item.insumo_id)] || {};
        const bSin = parseFloat(initData.bodega_sin_porc_kg ?? initData.bodega_sin_porcionar_kg) || 0;
        const bPorcUnd = parseInt(initData.bodega_porc_und ?? initData.bodega_porcionado_und) || 0;
        const bPorcKg = parseFloat(initData.bodega_porc_kg ?? initData.bodega_porcionado_kg) || 0;
        const cSin = parseFloat(initData.cocina_sin_porc_kg ?? initData.cocina_sin_porcionar_kg) || 0;
        const cPorcUnd = parseInt(initData.cocina_porc_und ?? initData.cocina_porcionado_und) || 0;
        const cPorcKg = parseFloat(initData.cocina_porc_kg ?? initData.cocina_porcionado_kg) || 0;
        const totalBodega = bSin + bPorcKg;
        const totalCocina = cSin + cPorcKg;
        const totalGeneral = totalBodega + totalCocina;
        const valor = Math.round(totalGeneral * (item.costo_unitario_kg || 0));

        return {
          ...item,
          bodega_sin_porc_kg: bSin,
          bodega_porc_und: bPorcUnd,
          bodega_porc_kg: bPorcKg,
          peso_total_bodega_kg: totalBodega,
          cocina_sin_porc_kg: cSin,
          cocina_porc_und: cPorcUnd,
          cocina_porc_kg: cPorcKg,
          peso_total_cocina_kg: totalCocina,
          peso_total_general_kg: totalGeneral,
          valor_total_general_pesos: valor
        };
      });
    }

    if (viewMode === 'CUTOFF') {
      const stockMap = new Map<string, any>();
      periodStock.forEach((s) => stockMap.set(String(s.insumo_id), s));

      return liveInsumos.map((item) => {
        const s = stockMap.get(String(item.insumo_id));
        if (!s) return item;

        const bSin = parseFloat(s.bodega_sin_porcionar_kg ?? s.bodega_sin_porc_kg) || 0;
        const bPorcUnd = parseInt(s.bodega_porcionado_und ?? s.bodega_porc_und) || 0;
        const bPorcKg = parseFloat(s.bodega_porcionado_kg ?? s.bodega_porc_kg) || 0;
        const cSin = parseFloat(s.cocina_sin_porcionar_kg ?? s.cocina_sin_porc_kg) || 0;
        const cPorcUnd = parseInt(s.cocina_porcionado_und ?? s.cocina_porc_und) || 0;
        const cPorcKg = parseFloat(s.cocina_porcionado_kg ?? s.cocina_porc_kg) || 0;
        const totalBodega = bSin + bPorcKg;
        const totalCocina = cSin + cPorcKg;
        const totalGeneral = totalBodega + totalCocina;
        const valor = Math.round(totalGeneral * (item.costo_unitario_kg || 0));

        return {
          ...item,
          bodega_sin_porc_kg: bSin,
          bodega_porc_und: bPorcUnd,
          bodega_porc_kg: bPorcKg,
          peso_total_bodega_kg: totalBodega,
          cocina_sin_porc_kg: cSin,
          cocina_porc_und: cPorcUnd,
          cocina_porc_kg: cPorcKg,
          peso_total_cocina_kg: totalCocina,
          peso_total_general_kg: totalGeneral,
          valor_total_general_pesos: valor
        };
      });
    }

    return liveInsumos;
  }, [liveInsumos, viewMode, currentPeriodo, periodStock]);

  // Obtener categorías únicas
  const categories = useMemo(() => {
    const cats = new Set<string>();
    computedList.forEach((i) => {
      if (i.categoria) cats.add(i.categoria);
    });
    return Array.from(cats).sort();
  }, [computedList]);

  // Filtrado reactivo (Búsqueda + Categoría + Stock > 0)
  const filteredItems = useMemo(() => {
    const q = normalizeStr(searchQuery);

    return computedList.filter((item) => {
      const isUnd = item.unidad_medida?.toLowerCase() === 'und' || 
                    item.categoria?.toLowerCase().includes('embutido') || 
                    item.categoria?.toLowerCase().includes('elaborado') || 
                    item.insumo?.toLowerCase().includes('chorizo') || 
                    item.insumo?.toLowerCase().includes('tamal');
      const totalBodega = isUnd 
        ? ((item.bodega_sin_porc_kg || 0) + (item.bodega_porc_und || 0))
        : (item.peso_total_bodega_kg || ((item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0)));
      const totalCocina = isUnd
        ? ((item.cocina_sin_porc_kg || 0) + (item.cocina_porc_und || 0))
        : (item.peso_total_cocina_kg || ((item.cocina_sin_porc_kg || 0) + (item.cocina_porc_kg || 0)));
      const totalGen = totalBodega + totalCocina;

      // Filtro Stock > 0
      if (onlyWithStock && totalGen <= 0) {
        return false;
      }

      // Filtro Categoría
      if (selectedCategory !== 'ALL' && item.categoria !== selectedCategory) {
        return false;
      }

      // Buscador
      if (q) {
        const nameMatch = normalizeStr(item.insumo || '').includes(q);
        const catMatch = normalizeStr(item.categoria || '').includes(q);
        if (!nameMatch && !catMatch) return false;
      }

      return true;
    });
  }, [computedList, searchQuery, onlyWithStock, selectedCategory]);

  // Total de valorización en bodega de la lista filtrada (excluye cocina)
  const kpis = useMemo(() => {
    let tValorBodegaCOP = 0;

    filteredItems.forEach((item) => {
      const isUnd = item.unidad_medida?.toLowerCase() === 'und' || 
                    item.categoria?.toLowerCase().includes('embutido') || 
                    item.categoria?.toLowerCase().includes('elaborado') || 
                    item.insumo?.toLowerCase().includes('chorizo') || 
                    item.insumo?.toLowerCase().includes('tamal');
      const totalUnitsBodega = (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_und || 0);
      const pesoBodegaKg = item.peso_total_bodega_kg || ((item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0));

      if (isUnd) {
        tValorBodegaCOP += totalUnitsBodega * (item.costo_unitario_kg || 0);
      } else {
        tValorBodegaCOP += Math.round(pesoBodegaKg * (item.costo_unitario_kg || 0));
      }
    });

    return {
      tValorBodegaCOP,
      totalItems: filteredItems.length
    };
  }, [filteredItems]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Consulta Rápida de Existencias de Inventario"
      icon={<Boxes className="w-5 h-5 text-orange-500" />}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-3.5 text-xs font-normal">
        {/* Barra Superior: Selector de Modo (En Vivo / Inicial / Por Fecha) */}
        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Tabs de Modo */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('LIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'LIVE'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>En Vivo (Actual)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('INITIAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'INITIAL'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Inicial del Periodo</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('CUTOFF')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'CUTOFF'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Corte por Fecha</span>
              </button>
            </div>

            {/* Selector de Fecha si está en modo CUTOFF */}
            {viewMode === 'CUTOFF' && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl animate-fade-in">
                <span className="text-[11px] font-semibold text-amber-900">Fecha Corte:</span>
                <input
                  type="date"
                  value={cutoffDate}
                  onChange={(e) => setCutoffDate(e.target.value)}
                  className="bg-white text-slate-800 text-xs font-bold px-2 py-0.5 rounded-lg border border-amber-300 outline-none cursor-pointer"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={fetchStockData}
            title="Refrescar existencias"
            disabled={loading}
            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 active:scale-95 transition-all shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
          </button>
        </div>

        {/* Resumen Único: Valor en Pesos de Bodega (Sin incluir cocina) */}
        <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-emerald-900/70 font-semibold block uppercase tracking-wider">
                Valor Total del Inventario en Bodega
              </span>
              <span className="text-xl md:text-2xl font-black text-emerald-900">
                ${formatMoney(kpis.tValorBodegaCOP)} <span className="text-xs font-semibold text-emerald-700/80">COP</span>
              </span>
            </div>
          </div>
          <div className="text-right text-[11px] text-emerald-900/70 font-medium hidden sm:block">
            <span className="bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-950 font-bold">
              {filteredItems.length} insumos listados
            </span>
          </div>
        </div>

        {/* Filtros Secundarios y Buscador */}
        <div className="flex items-center justify-between flex-wrap gap-2.5 bg-slate-50/80 p-2 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            {/* Buscador */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar carne o insumo (ej. Morrillo, Solomito)..."
                className="w-full h-8 pl-8 pr-7 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Selector de Categoría */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 outline-none cursor-pointer"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Switch: Solo con Stock (> 0) */}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 select-none cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={onlyWithStock}
              onChange={(e) => setOnlyWithStock(e.target.checked)}
              className="rounded text-orange-600 focus:ring-orange-500 h-3.5 w-3.5 cursor-pointer"
            />
            <span>Solo con Stock (&gt; 0) ({kpis.totalItems})</span>
          </label>
        </div>

        {/* Tabla de Resultados */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="max-h-[50vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200 shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3">Insumo / Carne</th>
                  <th className="py-2.5 px-3 text-right text-blue-700">Bodega Entero</th>
                  <th className="py-2.5 px-3 text-right text-purple-700">Bodega Porciones</th>
                  <th className="py-2.5 px-3 text-right text-amber-800">En Cocina</th>
                  <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                  <th className="py-2.5 px-3 text-right text-emerald-800">Valor Bodega</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <p className="font-medium">No se encontraron insumos con los filtros seleccionados.</p>
                      {onlyWithStock && (
                        <button
                          type="button"
                          onClick={() => setOnlyWithStock(false)}
                          className="mt-2 text-xs text-orange-600 hover:underline font-semibold"
                        >
                          Mostrar insumos con stock cero
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isUnd = item.unidad_medida?.toLowerCase() === 'und' || 
                                  item.categoria?.toLowerCase().includes('embutido') || 
                                  item.categoria?.toLowerCase().includes('elaborado') || 
                                  item.insumo?.toLowerCase().includes('chorizo') || 
                                  item.insumo?.toLowerCase().includes('tamal');
                    const totalUnitsBodega = (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_und || 0);
                    const totalUnitsCocina = (item.cocina_sin_porc_kg || 0) + (item.cocina_porc_und || 0);
                    const valorBodega = isUnd 
                      ? (totalUnitsBodega * (item.costo_unitario_kg || 0))
                      : ((item.peso_total_bodega_kg || 0) * (item.costo_unitario_kg || 0));

                    return (
                      <tr key={item.insumo_id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Carne */}
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{item.insumo}</span>
                            {isUnd && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded">
                                UND
                              </span>
                            )}
                          </div>
                          <span className="text-[9.5px] text-slate-400 uppercase font-medium">
                            {item.categoria}
                          </span>
                        </td>

                        {/* Bodega Entero */}
                        <td className="py-2 px-3 text-right font-medium text-blue-700">
                          {isUnd ? (
                            <span className="text-slate-300">-</span>
                          ) : item.bodega_sin_porc_kg > 0 ? (
                            `${item.bodega_sin_porc_kg.toFixed(2)} Kg`
                          ) : (
                            <span className="text-slate-300">0.00</span>
                          )}
                        </td>

                        {/* Bodega Porciones */}
                        <td className="py-2 px-3 text-right font-medium text-purple-700">
                          {isUnd ? (
                            <span className="font-bold">{totalUnitsBodega} und</span>
                          ) : item.bodega_porc_und > 0 ? (
                            <span>
                              <strong>{item.bodega_porc_und}</strong> und{' '}
                              <small className="text-slate-400">({item.bodega_porc_kg.toFixed(2)}k)</small>
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* En Cocina */}
                        <td className="py-2 px-3 text-right font-medium text-amber-900">
                          {isUnd ? (
                            totalUnitsCocina > 0 ? `${totalUnitsCocina} und` : <span className="text-slate-300">0</span>
                          ) : (item.cocina_porc_und > 0 || item.cocina_porc_kg > 0) ? (
                            <span>
                              {item.cocina_porc_und} und{' '}
                              <small className="text-amber-700">({item.cocina_porc_kg.toFixed(2)}k)</small>
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Costo Unitario */}
                        <td className="py-2 px-3 text-right text-slate-600 font-medium">
                          ${formatMoney(item.costo_unitario_kg)}
                          <span className="text-[9px] text-slate-400 block">{isUnd ? '/ und' : '/ Kg'}</span>
                        </td>

                        {/* Valor Bodega */}
                        <td className="py-2 px-3 text-right font-extrabold text-slate-900">
                          ${formatMoney(valorBodega)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
