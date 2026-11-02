'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DollarSign, 
  Calendar, 
  Award, 
  ListOrdered, 
  Loader2,
  AlertCircle,
  UploadCloud,
  ChevronRight,
  Info,
  Search,
  FileSpreadsheet,
  ArrowLeft
} from 'lucide-react';
import VentasKPIHeader from '@/components/ventas/VentasKPIHeader';
import VentasDiariasView from '@/components/ventas/VentasDiariasView';
import VentasProductosRankingView from '@/components/ventas/VentasProductosRankingView';
import VentasTransaccionesView from '@/components/ventas/VentasTransaccionesView';
import VentasExportButtons from '@/components/ventas/VentasExportButtons';
import VentasUploadModal from '@/components/ventas/VentasUploadModal';
import { 
  VentasKPIs, 
  VentaDiaria, 
  PlatoRanking,
  MesVentasResumen
} from '@/services/ventasService';
import { usePeriodo } from '@/context/PeriodoContext';

type TabView = 'DIARIO' | 'TRANSACCIONES' | 'PRODUCTOS';

export default function VentasPage() {
  const { currentPeriodo, selectedPeriodoId, setSelectedPeriodoId, periodos } = usePeriodo();

  // Estado para la vista de selección de mes a pantalla completa
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [mesesList, setMesesList] = useState<MesVentasResumen[]>([]);
  const [loadingMeses, setLoadingMeses] = useState(true);
  const [searchMonthQuery, setSearchMonthQuery] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Período activo cuando se entra al detalle
  const activePeriodoId = selectedMonthId || selectedPeriodoId || currentPeriodo?.id || 'per-2026-10';

  const periodoNombre = useMemo(() => {
    if (!activePeriodoId) return 'Octubre 2026';
    const foundMes = mesesList.find((m) => m.periodo_id === activePeriodoId);
    if (foundMes) return foundMes.nombre;
    const foundPeriodo = periodos?.find((p) => p.id === activePeriodoId);
    return foundPeriodo?.nombre || 'Octubre 2026';
  }, [activePeriodoId, mesesList, periodos]);

  // Cargar el listado de meses con ventas registradas
  const loadMeses = useCallback(async () => {
    setLoadingMeses(true);
    try {
      const res = await fetch(`/api/ventas?view=MESES&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.meses)) {
          setMesesList(json.meses);
        }
      }
    } catch (err) {
      console.error('Error cargando meses de ventas:', err);
    } finally {
      setLoadingMeses(false);
    }
  }, []);

  useEffect(() => {
    loadMeses();
  }, [loadMeses]);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('DIARIO');

  const [kpis, setKpis] = useState<VentasKPIs>({
    granTotalVentas: 0,
    ventaNeta: 0,
    impuesto: 0,
    descuentos: 0,
    totalArticulos: 0,
    totalDias: 0,
    promedioDiario: 0,
    diaRecord: null,
    totalPlatosUnicos: 0
  });

  const [diarias, setDiarias] = useState<VentaDiaria[]>([]);
  const [ranking, setRanking] = useState<PlatoRanking[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [totalVentasRanking, setTotalVentasRanking] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    if (!selectedMonthId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ventas?periodo_id=${activePeriodoId}&t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: No se pudo obtener la información de ventas`);
      }
      const json = await res.json();
      if (json.success) {
        if (json.kpis) setKpis(json.kpis);
        if (json.diarias) setDiarias(json.diarias);
        if (json.ranking) setRanking(json.ranking);
        if (json.categorias) setCategorias(json.categorias);
        if (json.totalVentas) setTotalVentasRanking(json.totalVentas);
      } else {
        throw new Error(json.error || 'Respuesta no exitosa al cargar ventas');
      }
    } catch (err: any) {
      console.error('Error cargando datos de ventas:', err);
      setError(err?.message || 'Error de conexión al cargar el módulo de ventas');
    } finally {
      setLoading(false);
    }
  }, [selectedMonthId, activePeriodoId]);

  useEffect(() => {
    if (selectedMonthId) {
      loadAllData();
    }
  }, [selectedMonthId, loadAllData]);

  // Al subir un archivo .txt con éxito
  const handleUploadSuccess = (targetPeriodoId?: string) => {
    loadMeses();
    if (targetPeriodoId) {
      setSelectedMonthId(targetPeriodoId);
      setSelectedPeriodoId(targetPeriodoId);
    } else if (selectedMonthId) {
      loadAllData();
    }
  };

  const normalize = (text: string) =>
    (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const filteredMeses = useMemo(() => {
    const q = normalize(searchMonthQuery);
    if (!q) return mesesList;
    return mesesList.filter((m) =>
      normalize(m.nombre).includes(q) ||
      normalize(m.periodo_id).includes(q)
    );
  }, [mesesList, searchMonthQuery]);

  const handleOpenMonth = (pId: string) => {
    setSelectedMonthId(pId);
    setSelectedPeriodoId(pId);
  };

  const fechasDisponibles = (diarias || []).map((d) => d.fecha);

  // =========================================================================
  // VISTA 1: LISTADO DE MESES QUE TIENEN INFORMACIÓN (A PANTALLA COMPLETA)
  // =========================================================================
  if (selectedMonthId === null) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-8 animate-fade-in font-normal">
        {/* Encabezado Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hojas de Salidas por Venta</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Listado de meses con ventas registradas ordenadas desde la más reciente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs px-3.5 py-2 rounded-md font-medium shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar Ventas (.txt)</span>
          </button>
        </div>

        {/* Buscador de Meses */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchMonthQuery}
            onChange={(e) => setSearchMonthQuery(e.target.value)}
            placeholder="Buscar por mes o año..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-hidden focus:border-slate-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Contador de Meses Registrados */}
        <p className="text-[11px] text-slate-400 mb-3 font-medium">
          {filteredMeses.length} {filteredMeses.length === 1 ? 'mes registrado' : 'meses registrados'}
        </p>

        {/* Listado de Tarjetas de Meses */}
        {loadingMeses ? (
          <div className="bg-white rounded-lg p-12 border border-slate-200 text-center text-slate-500 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            <p className="text-xs font-medium">Cargando períodos de ventas...</p>
          </div>
        ) : filteredMeses.length === 0 ? (
          <div className="bg-white rounded-lg p-10 border border-slate-200 text-center text-slate-500">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-600">No se encontraron meses con ventas registradas.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMeses.map((m) => (
              <div
                key={m.periodo_id}
                onClick={() => handleOpenMonth(m.periodo_id)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 rounded-lg cursor-pointer transition-all gap-2"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-slate-100 text-slate-600 group-hover:text-slate-900 transition-colors mt-0.5 sm:mt-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                        {m.nombre} - Salidas por Venta
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{m.total_dias} {m.total_dias === 1 ? 'día registrado' : 'días registrados'}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">
                        Total facturado: ${m.gran_total.toLocaleString('es-CO')} COP
                      </span>
                      {m.total_articulos > 0 && (
                        <>
                          <span>•</span>
                          <span>{m.total_articulos.toLocaleString('es-CO')} artículos vendidos</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenMonth(m.periodo_id);
                    }}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                  >
                    Abrir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <VentasUploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={handleUploadSuccess}
        />
      </div>
    );
  }

  // =========================================================================
  // VISTA 2: DETALLE DEL MES SELECCIONADO
  // =========================================================================
  return (
    <div className="space-y-4 w-full font-normal animate-fade-in">
      {/* Botón para regresar a la lista de meses */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSelectedMonthId(null)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md transition-all cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a lista de meses</span>
        </button>
      </div>

      {/* 🏷️ Encabezado Principal Tipo Git */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-white rounded-md">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Salidas por Venta
            </h1>
            <p className="text-xs text-slate-500">
              Registro diario de ventas y comandas • <span className="font-semibold text-slate-700">{periodoNombre}</span>
            </p>
          </div>
        </div>

        {/* Selector de Período y Acciones */}
        <div className="flex items-center gap-2 flex-wrap">
          {mesesList && mesesList.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={activePeriodoId}
                onChange={(e) => {
                  setSelectedMonthId(e.target.value);
                  setSelectedPeriodoId(e.target.value);
                }}
                className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer"
                title="Seleccionar mes / período de ventas"
              >
                {mesesList.map((m) => (
                  <option key={m.periodo_id} value={m.periodo_id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Importar Ventas (.txt)</span>
          </button>
          <VentasExportButtons
            diarias={diarias}
            ranking={ranking}
            kpis={kpis}
            periodoNombre={periodoNombre}
          />
        </div>
      </div>

      <VentasUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* 📊 Tarjetas de KPIs */}
      <VentasKPIHeader kpis={kpis} periodoNombre={periodoNombre} />

      {/* 🗂️ Pestañas del Módulo */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 select-none">
        <button
          type="button"
          onClick={() => setActiveTab('DIARIO')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'DIARIO'
              ? 'bg-slate-900 border-slate-900 text-white shadow-2xs font-semibold'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Resumen Diario</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
            activeTab === 'DIARIO' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {diarias.length} días
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TRANSACCIONES')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'TRANSACCIONES'
              ? 'bg-slate-900 border-slate-900 text-white shadow-2xs font-semibold'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>Transacciones Detalladas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PRODUCTOS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'PRODUCTOS'
              ? 'bg-slate-900 border-slate-900 text-white shadow-2xs font-semibold'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Ranking de Menú</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
            activeTab === 'PRODUCTOS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {ranking.length}
          </span>
        </button>
      </div>

      {/* ⚠️ Alerta de Error con Botón de Reintento */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-lg flex items-center justify-between gap-3 text-rose-800 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Error de conexión</p>
              <p className="text-[11px] text-rose-600">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadAllData}
            className="px-3 py-1 bg-rose-600 text-white rounded-md text-xs font-semibold hover:bg-rose-700 transition-colors shrink-0 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 📦 Contenido de la Vista Activa */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-lg border border-slate-200 space-y-2">
          <Loader2 className="w-6 h-6 text-slate-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Cargando registros de ventas...</p>
        </div>
      ) : activeTab === 'DIARIO' ? (
        <VentasDiariasView diarias={diarias} periodoId={activePeriodoId} />
      ) : activeTab === 'TRANSACCIONES' ? (
        <VentasTransaccionesView
          periodoId={activePeriodoId}
          fechasDisponibles={fechasDisponibles}
          categoriasDisponibles={categorias}
        />
      ) : (
        <VentasProductosRankingView
          ranking={ranking}
          categorias={categorias}
          totalVentas={totalVentasRanking}
        />
      )}
    </div>
  );
}
