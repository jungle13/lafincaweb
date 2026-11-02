'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  Calendar, 
  Award, 
  ListOrdered, 
  Loader2,
  AlertCircle,
  UploadCloud,
  ChevronRight,
  Info
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
  PlatoRanking 
} from '@/services/ventasService';
import { usePeriodo } from '@/context/PeriodoContext';

type TabView = 'DIARIO' | 'TRANSACCIONES' | 'PRODUCTOS';

export default function VentasPage() {
  const { currentPeriodo, selectedPeriodoId, setSelectedPeriodoId, periodos } = usePeriodo();
  
  // Si no hay período seleccionado, arrancar en Octubre 2026 (per-2026-10) que tiene el historial activo
  const periodoId = selectedPeriodoId || 'per-2026-10';
  const periodoNombre = currentPeriodo?.nombre || (periodoId === 'per-2026-10' ? 'Octubre 2026' : 'Período Activo');

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>('DIARIO');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

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
        // Si el periodo actual devuelve 0 ventas y el usuario está en per-2026-11 pero per-2026-10 tiene ventas,
        // y no hay selección manual en localStorage, migrar a per-2026-10
        if (json.kpis && json.kpis.granTotalVentas === 0 && periodoId === 'per-2026-11') {
          const hasManualChoice = typeof window !== 'undefined' && localStorage.getItem('la_finca_periodo_id');
          if (!hasManualChoice) {
            setSelectedPeriodoId('per-2026-10');
            return;
          }
        }

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
  }, [periodoId, setSelectedPeriodoId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Al subir un archivo .txt con éxito, sincronizar de inmediato al período del archivo subido
  const handleUploadSuccess = (targetPeriodoId?: string) => {
    if (targetPeriodoId && targetPeriodoId !== periodoId) {
      setSelectedPeriodoId(targetPeriodoId);
    } else {
      loadAllData();
    }
  };

  const fechasDisponibles = (diarias || []).map((d) => d.fecha);

  return (
    <div className="space-y-4 w-full font-normal">
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
          {/* Selector de Mes / Período */}
          {periodos && periodos.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={periodoId}
                onChange={(e) => setSelectedPeriodoId(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer"
                title="Seleccionar mes / período de ventas"
              >
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.id === 'per-2026-10' ? '• (Historial Activo)' : p.estado === 'ABIERTO' ? '• (Actual)' : ''}
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

      {/* 💡 Banner informativo si el período actual no tiene ventas registradas */}
      {!loading && kpis.granTotalVentas === 0 && periodoId !== 'per-2026-10' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-amber-900 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              No hay ventas registradas para <strong>{periodoNombre}</strong>. El historial completo con el cierre del 31 está en <strong>Octubre 2026 ($238.271.863 COP)</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPeriodoId('per-2026-10')}
            className="inline-flex items-center gap-1 font-bold text-amber-900 hover:text-amber-950 underline cursor-pointer shrink-0"
          >
            <span>Ver ventas de Octubre 2026</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
        <VentasDiariasView diarias={diarias} periodoId={periodoId} />
      ) : activeTab === 'TRANSACCIONES' ? (
        <VentasTransaccionesView
          periodoId={periodoId}
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
