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
  FileText
} from 'lucide-react';
import { normalizeStr } from '@/lib/formatters';
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

  // Inicializar fecha solo al cambiar de periodo o si aún no está definida
  const [lastPeriodoId, setLastPeriodoId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentPeriodo) return;

    if (currentPeriodo.id !== lastPeriodoId) {
      setLastPeriodoId(currentPeriodo.id);
      if (fechasConMovimientos.length > 0) {
        setSelectedDate(fechasConMovimientos[fechasConMovimientos.length - 1]);
      } else {
        setSelectedDate(currentPeriodo.fecha_inicio);
      }
    } else if (!selectedDate && fechasConMovimientos.length > 0) {
      setSelectedDate(fechasConMovimientos[fechasConMovimientos.length - 1]);
    }
  }, [currentPeriodo?.id, lastPeriodoId, fechasConMovimientos, selectedDate]);

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
            const tipoMedida = item.tipo_medida || s?.tipo_medida || 'KGS_Y_UNIDADES';
            const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';

            if (!s) {
              const bTotal = (parseFloat(item.bodega_sin_porc_kg) || 0) + (parseFloat(item.bodega_porc_kg) || 0);
              const vBodega = item.valor_total_bodega_pesos != null 
                ? Math.round(item.valor_total_bodega_pesos)
                : (isContable 
                    ? Math.round((parseInt(item.bodega_porc_und) || 0) * (item.costo_unitario_kg || 0))
                    : Math.round(bTotal * (item.costo_unitario_kg || 0)));
              return {
                ...item,
                tipo_medida: tipoMedida,
                valor_total_bodega_pesos: vBodega,
                valor_total_general_pesos: vBodega,
                valor_total_cocina_pesos: 0,
                cocina_dia_und: 0,
                cocina_dia_kg: 0,
                costo_cocina_dia: 0,
                merma_acumulada_kg: 0,
              };
            }

            const bSinPorc = parseFloat(s.bodega_sin_porcionar_kg ?? item.bodega_sin_porc_kg) || 0;
            const bPorcUnd = parseInt(s.bodega_porcionado_und ?? item.bodega_porc_und) || 0;
            const bPorcKg = parseFloat(s.bodega_porcionado_kg ?? item.bodega_porc_kg) || 0;
            const cSinPorc = parseFloat(s.cocina_sin_porcionar_kg ?? item.cocina_sin_porc_kg) || 0;
            const cPorcUnd = parseInt(s.cocina_porcionado_und ?? item.cocina_porc_und) || 0;
            const cPorcKg = parseFloat(s.cocina_porcionado_kg ?? item.cocina_porc_kg) || 0;
            const totalBodegaKg = isContable ? 0 : (bSinPorc + bPorcKg);
            const totalCocinaKg = isContable ? 0 : (cSinPorc + cPorcKg);
            const totalGeneralKg = totalBodegaKg + totalCocinaKg;
            const valorTotalBodega = s.valor_total_bodega_pesos != null 
              ? Math.round(s.valor_total_bodega_pesos) 
              : (isContable 
                  ? Math.round(bPorcUnd * (item.costo_unitario_kg || 0))
                  : Math.round(totalBodegaKg * (item.costo_unitario_kg || 0)));

            const cocinaDiaUnd = s.cocina_dia_und !== undefined ? s.cocina_dia_und : cPorcUnd;
            const cocinaDiaKg = s.cocina_dia_kg !== undefined ? s.cocina_dia_kg : totalCocinaKg;
            const costoCocinaDia = s.costo_cocina_dia !== undefined 
              ? Math.round(s.costo_cocina_dia) 
              : (s.valor_total_cocina_pesos != null ? Math.round(s.valor_total_cocina_pesos) : 0);

            return {
              ...item,
              tipo_medida: tipoMedida,
              costo_unitario_kg: s.costo_unitario_kg ?? item.costo_unitario_kg,
              bodega_sin_porc_kg: bSinPorc,
              bodega_porc_und: bPorcUnd,
              bodega_porc_kg: bPorcKg,
              peso_total_bodega_kg: totalBodegaKg,
              cocina_sin_porc_kg: cSinPorc,
              cocina_porc_und: cocinaDiaUnd,
              cocina_porc_kg: cPorcKg,
              peso_total_cocina_kg: cocinaDiaKg,
              valor_total_bodega_pesos: valorTotalBodega,
              cocina_dia_und: cocinaDiaUnd,
              cocina_dia_kg: cocinaDiaKg,
              costo_cocina_dia: costoCocinaDia,
              valor_total_cocina_pesos: costoCocinaDia,
              merma_acumulada_kg: 0,
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
  }, [selectedPeriodoId, cutoffMode, selectedDate, selectedConteoId]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const filteredInsumos = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);
    return insumos.filter((item) => {
      // 1. Filtrado por tipo / categoría
      if (selectedCat === 'WITH_STOCK') {
        const totalBodega = (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0);
        if (totalBodega <= 0 && (item.bodega_porc_und || 0) <= 0) return false;
      } else if (selectedCat === 'CARNES') {
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
    <div className="w-full space-y-3.5 animate-fade-in font-normal">
      {/* KPIs Superiores: Valor Inventario en Bodega y Valor Insumos en Cocina */}
      <StockKpis insumos={insumos} />

      {/* Barra de Selección de Modo y Fecha Simplificada */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Segmented Control de Modo de Inventario */}
          <div className="flex items-center overflow-x-auto no-scrollbar touch-pan-x rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-medium w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setCutoffMode('ACTUAL')}
              className={`px-3 py-1.5 min-h-[36px] sm:min-h-[28px] rounded-md transition-all cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                cutoffMode === 'ACTUAL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              En Vivo (Actual)
            </button>

            <button
              type="button"
              onClick={() => setCutoffMode('FECHA')}
              className={`px-3 py-1.5 min-h-[36px] sm:min-h-[28px] rounded-md transition-all cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                cutoffMode === 'FECHA'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Fecha de Corte
            </button>

            <button
              type="button"
              onClick={() => setCutoffMode('INICIAL')}
              className={`px-3 py-1.5 min-h-[36px] sm:min-h-[28px] rounded-md transition-all cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                cutoffMode === 'INICIAL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inventario Inicial
            </button>

            {conteosAplicados.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedConteoId(conteosAplicados[0].id);
                  setSelectedDate(conteosAplicados[0].fecha);
                  setCutoffMode('CONTEO');
                }}
                className={`px-3 py-1.5 min-h-[36px] sm:min-h-[28px] rounded-md transition-all cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                  cutoffMode === 'CONTEO'
                    ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Conteo Físico
              </button>
            )}
          </div>

          {/* Controles de Selección de Fecha Contextuales */}
          {cutoffMode === 'FECHA' && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-500 font-normal">Fecha de corte:</span>
              <input
                type="date"
                min={currentPeriodo?.fecha_inicio}
                max={currentPeriodo?.fecha_fin}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setCutoffMode('FECHA');
                }}
                className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 bg-white outline-none focus:border-orange-500 shadow-2xs cursor-pointer"
              />

              {fechasConMovimientos.length > 0 && (
                <select
                  value={fechasConMovimientos.includes(selectedDate) ? selectedDate : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setCutoffMode('FECHA');
                    }
                  }}
                  className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white outline-none cursor-pointer"
                >
                  <option value="">Ir a jornada aprobada...</option>
                  {fechasConMovimientos.map((f) => (
                    <option key={f} value={f}>
                      Jornada {f}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {cutoffMode === 'CONTEO' && conteosAplicados.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-normal">Auditoría:</span>
              <select
                value={selectedConteoId}
                onChange={(e) => {
                  setSelectedConteoId(e.target.value);
                  const found = conteosAplicados.find((c: any) => c.id === e.target.value);
                  if (found) setSelectedDate(found.fecha);
                }}
                className="h-8 px-2.5 rounded-lg border border-emerald-300 text-xs font-semibold text-emerald-900 bg-emerald-50 outline-none cursor-pointer"
              >
                {conteosAplicados.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    Conteo {c.fecha} ({c.usuario || 'Bodeguero'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Resumen Contextual Discreto de Una Sola Línea */}
        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
          <div>
            {cutoffMode === 'INICIAL' && (
              <span>Inventario inicial de {currentPeriodo?.nombre || 'periodo'} (arranque del mes).</span>
            )}
            {cutoffMode === 'FECHA' && (
              <span>Corte al {selectedDate} ({totalMovsAplicados} movimientos aplicados). La columna <strong>Cocina</strong> refleja los movimientos de este día.</span>
            )}
            {cutoffMode === 'CONTEO' && (
              <span>Fotografía de conteo físico aplicado del {selectedDate}.</span>
            )}
            {cutoffMode === 'ACTUAL' && (
              <span>Inventario en vivo ({totalMovsAplicados} movimientos aplicados). La columna <strong>Cocina</strong> refleja la jornada activa.</span>
            )}
          </div>
          {loading && (
            <div className="flex items-center gap-1 text-[11px] text-orange-600 shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Calculando...</span>
            </div>
          )}
        </div>
      </div>

      {/* Header de Búsqueda y Exportación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">Control de Existencias de Carnes</h2>
          <p className="text-xs text-slate-500 font-normal">Monitoreo de bodega, entregas a cocina y costos ({currentPeriodo?.nombre || 'Periodo Activo'})</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar carne por nombre o código..."
              className="w-full h-8 pl-9 pr-3 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 font-normal"
            />
          </div>

          {/* Botón Reporte Oficial */}
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 active:scale-95 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Reporte Oficial</span>
          </button>
        </div>
      </div>

      {/* Filtros de Categoría Simplificados */}
      <CategoryFilterChips insumos={insumos} selectedCat={selectedCat} onSelectCat={setSelectedCat} />

      {/* Tablas de Existencias */}
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

      {/* Modal de Exportación a PDF y Reportes Oficiales */}
      <ExportStockPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        insumos={insumos}
        periodoNombre={currentPeriodo?.nombre || 'Periodo en Curso'}
        cutoffMode={cutoffMode}
        selectedDate={selectedDate}
        selectedConteoId={selectedConteoId}
        periodoId={selectedPeriodoId}
        fechaInicio={currentPeriodo?.fecha_inicio}
        fechaFin={currentPeriodo?.fecha_fin}
        fechasConMovimientos={fechasConMovimientos}
        conteosAplicados={conteosAplicados}
        onSelectCutoff={(mode, date, conteoId) => {
          setCutoffMode(mode);
          if (date) setSelectedDate(date);
          if (conteoId) setSelectedConteoId(conteoId);
        }}
        cutoffInfo={
          cutoffMode === 'INICIAL' 
            ? 'Inventario Inicial' 
            : cutoffMode === 'FECHA' 
            ? `Corte al ${selectedDate}` 
            : cutoffMode === 'CONTEO'
            ? 'Conteo Físico'
            : 'Inventario Actual en Vivo'
        }
      />
    </div>
  );
}
