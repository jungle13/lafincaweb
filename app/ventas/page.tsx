'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  Calendar, 
  Award, 
  ListOrdered, 
  PieChart, 
  RefreshCw, 
  Loader2,
  Scale,
  AlertCircle
} from 'lucide-react';
import VentasKPIHeader from '@/components/ventas/VentasKPIHeader';
import VentasDiariasView from '@/components/ventas/VentasDiariasView';
import VentasProductosRankingView from '@/components/ventas/VentasProductosRankingView';
import VentasTransaccionesView from '@/components/ventas/VentasTransaccionesView';
import VentasRentabilidadView from '@/components/ventas/VentasRentabilidadView';
import VentasCuadreCajaView from '@/components/ventas/VentasCuadreCajaView';
import VentasExportButtons from '@/components/ventas/VentasExportButtons';
import { 
  VentasKPIs, 
  VentaDiaria, 
  PlatoRanking, 
  VentasRentabilidad,
  ComparacionCuadreResult 
} from '@/services/ventasService';
import { usePeriodo } from '@/context/PeriodoContext';

type TabView = 'DIARIO' | 'PRODUCTOS' | 'TRANSACCIONES' | 'RENTABILIDAD' | 'CUADRE';

export default function VentasPage() {
  const { currentPeriodo, selectedPeriodoId } = usePeriodo();
  const periodoId = selectedPeriodoId || currentPeriodo?.id || 'per-2026-09';
  const periodoNombre = currentPeriodo?.nombre || 'Septiembre 2026';

  const [loading, setLoading] = useState(true);
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
  const [cuadreData, setCuadreData] = useState<ComparacionCuadreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rentabilidad, setRentabilidad] = useState<VentasRentabilidad>({
    totalVentas: 0,
    totalVentaNeta: 0,
    totalCostosDirectosInsumos: 0,
    margenBrutoPesos: 0,
    margenBrutoPorcentaje: 0,
    totalGastosOperativos: 0,
    utilidadOperativaEstimada: 0,
    porcentajeCostosSobreVentas: 0
  });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ventas?periodo_id=${periodoId}&t=${Date.now()}`, { cache: 'no-store' });
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
        if (json.rentabilidad) setRentabilidad(json.rentabilidad);
        if (json.cuadre) setCuadreData(json.cuadre);
      } else {
        throw new Error(json.error || 'Respuesta no exitosa al cargar ventas');
      }
    } catch (err: any) {
      console.error('Error cargando datos de ventas:', err);
      setError(err?.message || 'Error de conexión al cargar el módulo de ventas');
    } finally {
      setLoading(false);
    }
  }, [periodoId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const fechasDisponibles = (diarias || []).map((d) => d.fecha);

  return (
    <div className="space-y-4 w-full px-2 sm:px-4 md:px-6 font-normal">
      {/* 🏷️ Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                Módulo de Ventas & Comandas
              </h1>
              <p className="text-xs text-slate-500">
                Auditoría diaria de facturación, platos servidos y margen operativo &bull; <strong>{periodoNombre}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Acciones de Exportación y Recarga */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Recargar datos de ventas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <VentasExportButtons
            diarias={diarias}
            ranking={ranking}
            kpis={kpis}
            periodoNombre={periodoNombre}
          />
        </div>
      </div>

      {/* 📊 Tarjetas de KPIs Gerenciales */}
      <VentasKPIHeader kpis={kpis} periodoNombre={periodoNombre} />

      {/* 🗂️ Pestañas Principales del Módulo de Ventas */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {/* Tab 1: Resumen Diario */}
          <button
            type="button"
            onClick={() => setActiveTab('DIARIO')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'DIARIO'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${activeTab === 'DIARIO' ? 'text-white' : 'text-emerald-600'}`} />
            <span>Resumen Diario (Día a Día)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
              activeTab === 'DIARIO' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {diarias.length} días
            </span>
          </button>

          {/* Tab 2: Ranking de Menú */}
          <button
            type="button"
            onClick={() => setActiveTab('PRODUCTOS')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'PRODUCTOS'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Award className={`w-3.5 h-3.5 ${activeTab === 'PRODUCTOS' ? 'text-white' : 'text-amber-500'}`} />
            <span>Ranking de Menú & Platos</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
              activeTab === 'PRODUCTOS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {ranking.length} platos
            </span>
          </button>

          {/* Tab 3: Transacciones Detalladas */}
          <button
            type="button"
            onClick={() => setActiveTab('TRANSACCIONES')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'TRANSACCIONES'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ListOrdered className={`w-3.5 h-3.5 ${activeTab === 'TRANSACCIONES' ? 'text-white' : 'text-indigo-600'}`} />
            <span>Transacciones Detalladas</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
              activeTab === 'TRANSACCIONES' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              1,597
            </span>
          </button>

          {/* Tab 4: Rentabilidad y Margen */}
          <button
            type="button"
            onClick={() => setActiveTab('RENTABILIDAD')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'RENTABILIDAD'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <PieChart className={`w-3.5 h-3.5 ${activeTab === 'RENTABILIDAD' ? 'text-white' : 'text-purple-600'}`} />
            <span>Rentabilidad & Margen (Ventas vs Costos)</span>
          </button>

          {/* Tab 5: Cuadre de Caja vs Reporte X */}
          <button
            type="button"
            onClick={() => setActiveTab('CUADRE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'CUADRE'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Scale className={`w-3.5 h-3.5 ${activeTab === 'CUADRE' ? 'text-white' : 'text-amber-600'}`} />
            <span>Cuadre de Caja vs Reporte X</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
              activeTab === 'CUADRE' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              Auditoría
            </span>
          </button>
        </div>
      </div>

      {/* ⚠️ Alerta de Error con Botón de Reintento */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between gap-3 text-rose-800 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Error de conexión</p>
              <p className="text-[11px] text-rose-600">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadAllData}
            className="px-3.5 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 📦 Contenido de la Vista Activa */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <Loader2 className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Cargando registros de ventas...</p>
        </div>
      ) : activeTab === 'DIARIO' ? (
        <VentasDiariasView diarias={diarias} periodoId={periodoId} />
      ) : activeTab === 'PRODUCTOS' ? (
        <VentasProductosRankingView
          ranking={ranking}
          categorias={categorias}
          totalVentas={totalVentasRanking}
        />
      ) : activeTab === 'TRANSACCIONES' ? (
        <VentasTransaccionesView
          periodoId={periodoId}
          fechasDisponibles={fechasDisponibles}
          categoriasDisponibles={categorias}
        />
      ) : activeTab === 'RENTABILIDAD' ? (
        <VentasRentabilidadView rentabilidad={rentabilidad} />
      ) : (
        <VentasCuadreCajaView cuadreData={cuadreData} periodoNombre={periodoNombre} />
      )}
    </div>
  );
}
