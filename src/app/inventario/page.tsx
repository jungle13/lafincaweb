'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import StockKpis from '@/components/inventario/StockKpis';
import CategoryFilterChips from '@/components/inventario/CategoryFilterChips';
import StockTableDesktop from '@/components/inventario/StockTableDesktop';
import StockCardsMobile from '@/components/inventario/StockCardsMobile';
import ExportStockPdfModal from '@/components/inventario/ExportStockPdfModal';
import { InsumoItem } from '@/types';
import { 
  Search, 
  Loader2, 
  Calendar, 
  Zap, 
  Package, 
  Clock, 
  Filter, 
  Info,
  CheckCircle2,
  CalendarRange,
  Printer
} from 'lucide-react';
import { normalizeStr, formatMoney } from '@/lib/formatters';
import { usePeriodo } from '@/context/PeriodoContext';

export default function InventarioPage() {
  const { currentPeriodo, selectedPeriodoId } = usePeriodo();
  
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Modos de corte: 'ACTUAL' | 'INICIAL' | 'FECHA' | 'CONTEO'
  const [cutoffMode, setCutoffMode] = useState<'ACTUAL' | 'INICIAL' | 'FECHA' | 'CONTEO'>('ACTUAL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedConteoId, setSelectedConteoId] = useState<string>('');
  const [fechasConMovimientos, setFechasConMovimientos] = useState<string[]>([]);
  const [conteosAplicados, setConteosAplicados] = useState<any[]>([]);
  const [totalMovsAplicados, setTotalMovsAplicados] = useState<number>(0);

  // Inicializar fecha al cambiar de periodo o al cargar fechas formalizadas
  useEffect(() => {
    if (currentPeriodo) {
      if (fechasConMovimientos.length > 0) {
        setSelectedDate(fechasConMovimientos[fechasConMovimientos.length - 1]);
      } else {
        setSelectedDate(currentPeriodo.fecha_inicio);
      }
    }
  }, [currentPeriodo?.id, fechasConMovimientos]);

  const loadStock = useCallback(async () => {
    try {
      setLoading(true);
      const ts = Date.now();
      const periodParam = selectedPeriodoId ? `&periodo_id=${selectedPeriodoId}` : '';
      
      let cutoffParam = '';
      if (cutoffMode === 'INICIAL') {
        cutoffParam = '&fecha_corte=INICIAL';
      } else if (cutoffMode === 'FECHA' && selectedDate) {
        cutoffParam = `&fecha_corte=${selectedDate}`;
      } else if (cutoffMode === 'CONTEO' && selectedConteoId) {
        cutoffParam = `&fecha_corte=CONTEO_${selectedConteoId}`;
      } else {
        cutoffParam = '&fecha_corte=ACTUAL';
      }

      const [stockRes, periodRes] = await Promise.all([
        fetch(`/api/bodega/stock?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/periodos?t=${ts}${periodParam}${cutoffParam}`, { cache: 'no-store' }),
      ]);

      const data = await stockRes.json();
      const pData = await periodRes.json();

      let base: InsumoItem[] = data.data || [];

      if (pData.success) {
        setFechasConMovimientos(pData.fechas_con_movimientos || []);
        setConteosAplicados(pData.conteos_aplicados || []);
        setTotalMovsAplicados(pData.total_movs_aplicados ?? 0);

        if (Array.isArray(pData.stock) && pData.stock.length > 0) {
          const pMap = new Map<string, any>();
          pData.stock.forEach((s: any) => pMap.set(String(s.insumo_id), s));

          base = base.map((item: any) => {
            const s = pMap.get(String(item.insumo_id));
            if (!s) {
              const bTotal = (parseFloat(item.bodega_sin_porc_kg) || 0) + (parseFloat(item.bodega_porc_kg) || 0);
              const vBodega = Math.round(bTotal * (item.costo_unitario_kg || 0));
              return {
                ...item,
                valor_total_bodega_pesos: vBodega,
                valor_total_general_pesos: vBodega,
                traslado_cocina_acumulado_kg: item.traslado_cocina_acumulado_kg || 0,
                traslado_cocina_acumulado_und: item.traslado_cocina_acumulado_und || 0,
              };
            }

            const bSinPorc = parseFloat(s.bodega_sin_porcionar_kg ?? item.bodega_sin_porc_kg) || 0;
            const bPorcUnd = parseInt(s.bodega_porcionado_und ?? item.bodega_porc_und) || 0;
            const bPorcKg = parseFloat(s.bodega_porcionado_kg ?? item.bodega_porc_kg) || 0;
            const cSinPorc = parseFloat(s.cocina_sin_porcionar_kg ?? item.cocina_sin_porc_kg) || 0;
            const cPorcUnd = parseInt(s.cocina_porcionado_und ?? item.cocina_porc_und) || 0;
            const cPorcKg = parseFloat(s.cocina_porcionado_kg ?? item.cocina_porc_kg) || 0;
            const totalBodegaKg = bSinPorc + bPorcKg;
            const totalCocinaKg = cSinPorc + cPorcKg;
            const totalGeneralKg = totalBodegaKg + totalCocinaKg;
            const valorTotalBodega = Math.round(totalBodegaKg * (item.costo_unitario_kg || 0));
            const valorTotalGeneral = Math.round(totalGeneralKg * (item.costo_unitario_kg || 0));

            // Si es inventario inicial, merma y traslados acumulados son 0
            const mermaKg = cutoffMode === 'INICIAL' ? 0 : (parseFloat(s.merma_acumulada_kg ?? item.merma_acumulada_kg) || 0);
            const trasladoAcumUnd = cutoffMode === 'INICIAL' ? 0 : (parseInt(s.traslado_cocina_acumulado_und) || 0);
            const trasladoAcumKg = cutoffMode === 'INICIAL' ? 0 : (parseFloat(s.traslado_cocina_acumulado_kg) || 0);

            return {
              ...item,
              bodega_sin_porc_kg: bSinPorc,
              bodega_porc_und: bPorcUnd,
              bodega_porc_kg: bPorcKg,
              peso_total_bodega_kg: totalBodegaKg,
              cocina_sin_porc_kg: cSinPorc,
              cocina_porc_und: cPorcUnd,
              cocina_porc_kg: cPorcKg,
              peso_total_cocina_kg: totalCocinaKg,
              peso_total_general_kg: totalGeneralKg,
              valor_total_bodega_pesos: valorTotalBodega,
              valor_total_general_pesos: valorTotalBodega, // Ahora el valor del stock es estrictamente Bodega
              traslado_cocina_acumulado_und: trasladoAcumUnd,
              traslado_cocina_acumulado_kg: trasladoAcumKg,
              merma_acumulada_kg: mermaKg,
            };
          });
        }
      }

      setInsumos(base);
    } catch (e) {
      console.error('Error fetching stock:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodoId, cutoffMode, selectedDate]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const filteredInsumos = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);
    return insumos.filter((item) => {
      // 1. Filtrado por categoría
      if (selectedCat === 'CARNES') {
        if (item.es_carne === false) return false;
      } else if (selectedCat !== 'ALL') {
        const itemCat = normalizeStr(item.categoria || '');
        const targetCat = normalizeStr(selectedCat);
        if (itemCat !== targetCat) {
          if (targetCat.includes('PESCADO') && itemCat.includes('PESCADO')) {
            // match
          } else if (targetCat.includes('EMBUTIDO') && itemCat.includes('EMBUTIDO')) {
            // match
          } else {
            return false;
          }
        }
      }

      // 2. Filtrado por texto de búsqueda
      if (!cleanSearch) return true;
      const name = normalizeStr(item.insumo);
      const code = normalizeStr(item.codigo);
      const cat = normalizeStr(item.categoria);
      return name.includes(cleanSearch) || code.includes(cleanSearch) || cat.includes(cleanSearch);
    });
  }, [insumos, selectedCat, searchQuery]);

  return (
    <div className="w-full space-y-4 animate-fade-in font-normal">
      {/* KPIs Superiores Planos */}
      <StockKpis insumos={insumos} />

      {/* 📅 BARRA DE FILTRO POR FECHA / INVENTARIO INICIAL */}
      <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 shadow-sm space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Botones de Selección de Modo */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 font-medium mr-1 flex items-center gap-1">
              <CalendarRange className="w-3.5 h-3.5 text-orange-500" />
              <span>Ver Inventario:</span>
            </span>

            {/* Opción 1: Inventario Actual / Cierre */}
            <button
              type="button"
              onClick={() => setCutoffMode('ACTUAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                cutoffMode === 'ACTUAL'
                  ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Inventario Actual (En Vivo)</span>
            </button>

            {/* Opción 2: Inventario Inicial del Periodo */}
            <button
              type="button"
              onClick={() => setCutoffMode('INICIAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                cutoffMode === 'INICIAL'
                  ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Inventario Inicial ({currentPeriodo?.nombre || 'Mes'})</span>
            </button>

            {/* Opción 3: Por Fecha de Corte */}
            <button
              type="button"
              onClick={() => setCutoffMode('FECHA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                cutoffMode === 'FECHA'
                  ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Por Fecha de Corte</span>
            </button>

            {/* Opción 4: Dropdown de Conteos Físicos Aplicados */}
            {conteosAplicados.length > 0 && (
              <div className="flex items-center">
                <select
                  value={cutoffMode === 'CONTEO' ? selectedConteoId : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedConteoId(e.target.value);
                      const found = conteosAplicados.find((c: any) => c.id === e.target.value);
                      if (found) setSelectedDate(found.fecha);
                      setCutoffMode('CONTEO');
                    } else {
                      setCutoffMode('ACTUAL');
                    }
                  }}
                  className={`h-8 px-2 rounded-lg text-xs font-medium border transition-all outline-none cursor-pointer ${
                    cutoffMode === 'CONTEO'
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm font-semibold'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <option value="" className="text-slate-800 bg-white">📋 Ver Conteo Físico...</option>
                  {conteosAplicados.map((c: any) => (
                    <option key={c.id} value={c.id} className="text-slate-800 bg-white">
                      Conteo {c.fecha} ({c.usuario || 'Bodeguero'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Selector de Fecha específico (activo en modo FECHA) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-normal">Fecha de corte:</span>
            <input
              type="date"
              min={currentPeriodo?.fecha_inicio}
              max={currentPeriodo?.fecha_fin}
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCutoffMode('FECHA');
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 bg-white outline-none focus:border-orange-500 shadow-sm cursor-pointer"
            />
          </div>
        </div>

        {/* Badges Rápidos de Días y Conteos Físicos Formalizados */}
        {(fechasConMovimientos.length > 0 || conteosAplicados.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 text-xs">
            <span className="text-[11px] text-slate-400 font-normal mr-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Jornadas formalizadas (Aprobadas):</span>
            </span>
            {fechasConMovimientos.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setSelectedDate(f);
                  setCutoffMode('FECHA');
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border ${
                  cutoffMode === 'FECHA' && selectedDate === f
                    ? 'bg-orange-100 border-orange-300 text-orange-900 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                📅 {f}
              </button>
            ))}

            {/* Badges para Conteos Físicos Aplicados */}
            {conteosAplicados.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedConteoId(c.id);
                  setSelectedDate(c.fecha);
                  setCutoffMode('CONTEO');
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border flex items-center gap-1 ${
                  cutoffMode === 'CONTEO' && selectedConteoId === c.id
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-semibold'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
                title={`Ver fotografía fijada por el Conteo Físico del ${c.fecha}`}
              >
                📋 Conteo Físico ({c.fecha})
              </button>
            ))}
          </div>
        )}

        {/* Banner Informativo de Estado de la Vista */}
        <div className="flex items-center justify-between gap-2 text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200/70 text-slate-600">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span>
              {cutoffMode === 'INICIAL' && (
                <>Mostrando <strong>Inventario Inicial</strong> de {currentPeriodo?.nombre} (Foto contable al arranque del mes, sin movimientos posteriores).</>
              )}
              {cutoffMode === 'FECHA' && (
                <>Mostrando existencias con <strong>corte al {selectedDate}</strong> ({totalMovsAplicados} movimientos formalizados aplicados).</>
              )}
              {cutoffMode === 'CONTEO' && (
                <>Mostrando fotografía exacta fijada por el <strong>Conteo Físico ({selectedDate})</strong> auditado y aplicado a inventario.</>
              )}
              {cutoffMode === 'ACTUAL' && (
                <>Mostrando <strong>Inventario Actual en Curso</strong> de {currentPeriodo?.nombre} ({totalMovsAplicados} movimientos formalizados).</>
              )}
            </span>
          </div>
          {loading && (
            <div className="flex items-center gap-1 text-[11px] text-orange-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Calculando...</span>
            </div>
          )}
        </div>
      </div>

      {/* Header de Búsqueda y Filtros de Categoría */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">Control de Existencias de Carnes</h2>
          <p className="text-xs text-slate-500 font-normal">Monitoreo en vivo de bodega, cocina, mermas y costos ({currentPeriodo?.nombre || 'Periodo Activo'})</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-64 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar carne por nombre o código..."
              className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 font-normal"
            />
          </div>

          {/* Botón Exportar PDF de Inventario */}
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 active:scale-95 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Category Chips Dinámicos con Conteo Real */}
      <CategoryFilterChips insumos={insumos} selectedCat={selectedCat} onSelectCat={setSelectedCat} />

      {/* Desktop Table Plana */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          <p className="text-xs font-normal">Calculando existencias...</p>
        </div>
      ) : (
        <>
          <StockTableDesktop insumos={filteredInsumos} />
          <StockCardsMobile insumos={filteredInsumos} />
        </>
      )}

      {/* Modal de Exportación a PDF Oficial */}
      <ExportStockPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        insumos={insumos}
        periodoNombre={currentPeriodo?.nombre || 'Periodo en Curso'}
        cutoffInfo={
          cutoffMode === 'INICIAL' 
            ? 'Inventario Inicial' 
            : cutoffMode === 'FECHA' 
            ? `Corte al ${selectedDate}` 
            : 'Inventario Actual en Vivo'
        }
      />
    </div>
  );
}
