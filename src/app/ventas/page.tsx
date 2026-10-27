'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  Calendar, 
  Award, 
  ListOrdered, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import VentasKPIHeader from '@/components/ventas/VentasKPIHeader';
import VentasDiariasView from '@/components/ventas/VentasDiariasView';
import VentasProductosRankingView from '@/components/ventas/VentasProductosRankingView';
import VentasTransaccionesView from '@/components/ventas/VentasTransaccionesView';
import VentasExportButtons from '@/components/ventas/VentasExportButtons';
import { 
  VentasKPIs, 
  VentaDiaria, 
  PlatoRanking 
} from '@/services/ventasService';
import { usePeriodo } from '@/context/PeriodoContext';

type TabView = 'TRANSACCIONES' | 'DIARIO' | 'PRODUCTOS';

export default function VentasPage() {
  const { currentPeriodo, selectedPeriodoId } = usePeriodo();
  const periodoId = selectedPeriodoId || currentPeriodo?.id || 'per-2026-10';
  const periodoNombre = currentPeriodo?.nombre || 'Octubre 2026';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>('TRANSACCIONES');

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
      {/* 🏷️ Encabezado Principal Tipo Git */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-white rounded-md">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Salidas por Venta
            </h1>
            <p className="text-xs text-slate-500">
              Registro diario de ventas y comandas
            </p>
          </div>
        </div>

        {/* Acciones de Exportación */}
        <div className="flex items-center gap-2 flex-wrap">
          <VentasExportButtons
            diarias={diarias}
            ranking={ranking}
            kpis={kpis}
            periodoNombre={periodoNombre}
          />
        </div>
      </div>

      {/* 📊 Tarjetas de KPIs */}
      <VentasKPIHeader kpis={kpis} periodoNombre={periodoNombre} />

      {/* 🗂️ Pestañas del Módulo */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 select-none">
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
            {diarias.length}
          </span>
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
      ) : activeTab === 'TRANSACCIONES' ? (
        <VentasTransaccionesView
          periodoId={periodoId}
          fechasDisponibles={fechasDisponibles}
          categoriasDisponibles={categorias}
        />
      ) : activeTab === 'DIARIO' ? (
        <VentasDiariasView diarias={diarias} periodoId={periodoId} />
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
