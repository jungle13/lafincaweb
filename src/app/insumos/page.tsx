'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  PackageSearch, 
  Search, 
  X, 
  Filter, 
  Receipt, 
  ListOrdered, 
  Loader2, 
  Calendar,
  Building,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import InsumosKPIHeader from '@/components/insumos/InsumosKPIHeader';
import InsumosSubmenuTabs, { SubmoduloType } from '@/components/insumos/InsumosSubmenuTabs';
import FacturasView from '@/components/insumos/FacturasView';
import InsumosTableView from '@/components/insumos/InsumosTableView';
import LibrosEgresosView from '@/components/insumos/LibrosEgresosView';
import ExportButtons from '@/components/insumos/ExportButtons';
import { 
  TransaccionGastoInsumo, 
  InsumosKPIs, 
  FacturaGroup, 
  ItemCosteoGroup 
} from '@/services/insumosCosteoService';
import { usePeriodo } from '@/context/PeriodoContext';

export default function InsumosPage() {
  const { currentPeriodo, selectedPeriodoId } = usePeriodo();

  // Estados de datos
  const [loading, setLoading] = useState(true);
  const [transacciones, setTransacciones] = useState<TransaccionGastoInsumo[]>([]);
  const [facturas, setFacturas] = useState<FacturaGroup[]>([]);
  const [items, setItems] = useState<ItemCosteoGroup[]>([]);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [kpis, setKpis] = useState<InsumosKPIs>({
    totalCostosGastos: 0,
    totalCostosDirectos: 0,
    totalGastosOperativos: 0,
    porcentajeCostosDirectos: 0,
    porcentajeGastosOperativos: 0,
    promedioDiario: 0,
    totalTransacciones: 0,
    totalFacturas: 0,
  });

  // Filtros
  const [activeSubmodulo, setActiveSubmodulo] = useState<SubmoduloType>('ALL');
  const [viewMode, setViewMode] = useState<'FACTURAS' | 'INSUMOS'>('FACTURAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProveedor, setSelectedProveedor] = useState('ALL');
  const [selectedRelacionCuaderno, setSelectedRelacionCuaderno] = useState('ALL');
  const [selectedFecha, setSelectedFecha] = useState('ALL');

  // Conteo de registros por submódulo para las insignias
  const [submoduloCounts, setSubmoduloCounts] = useState<Partial<Record<SubmoduloType, number>>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const periodoId = selectedPeriodoId || currentPeriodo?.id || 'per-2026-09';
      const params = new URLSearchParams();
      params.set('periodo_id', periodoId);
      if (activeSubmodulo !== 'ALL') params.set('submodulo', activeSubmodulo);
      if (selectedProveedor !== 'ALL') params.set('proveedor', selectedProveedor);
      if (selectedRelacionCuaderno !== 'ALL') params.set('relacion_cuaderno', selectedRelacionCuaderno);
      if (selectedFecha !== 'ALL') params.set('fecha', selectedFecha);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/insumos-costeo?${params.toString()}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (json.success && json.data) {
        setTransacciones(json.data.transacciones || []);
        setFacturas(json.data.facturas || []);
        setItems(json.data.items || []);
        setKpis(json.data.kpis);
        if (json.data.proveedores && json.data.proveedores.length > 0) {
          setProveedores(json.data.proveedores);
        }
      }
    } catch (err) {
      console.error('Error cargando insumos y costeo:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodoId, currentPeriodo?.id, activeSubmodulo, selectedProveedor, selectedRelacionCuaderno, selectedFecha, searchQuery]);

  // Carga inicial y recarga al cambiar filtros clave
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Conteo global por submódulos para badges
  useEffect(() => {
    async function loadGlobalCounts() {
      try {
        const periodoId = selectedPeriodoId || currentPeriodo?.id || 'per-2026-09';
        const [resInsumos, resCaja, resArturo] = await Promise.all([
          fetch(`/api/insumos-costeo?periodo_id=${periodoId}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null),
          fetch(`/api/libros-egresos?periodo_id=${periodoId}&libro=CAJA`, { cache: 'no-store' }).then(r => r.json()).catch(() => null),
          fetch(`/api/libros-egresos?periodo_id=${periodoId}&libro=ARTURO`, { cache: 'no-store' }).then(r => r.json()).catch(() => null)
        ]);

        const counts: Partial<Record<SubmoduloType, number>> = {};
        if (resInsumos?.success && resInsumos?.data?.transacciones) {
          counts.ALL = resInsumos.data.transacciones.length;
          resInsumos.data.transacciones.forEach((t: TransaccionGastoInsumo) => {
            const sm = t.submodulo as SubmoduloType;
            counts[sm] = (counts[sm] || 0) + 1;
          });
        }

        const totalCaja = resCaja?.kpis?.totalRegistros || 0;
        const totalArturo = resArturo?.kpis?.totalRegistros || 0;
        counts.LIBROS_EGRESOS = totalCaja + totalArturo;

        setSubmoduloCounts(counts);
      } catch (e) {
        console.warn('Error loading global counts:', e);
      }
    }
    loadGlobalCounts();
  }, [selectedPeriodoId, currentPeriodo?.id]);

  const periodoNombre = currentPeriodo?.nombre || 'Septiembre 2026';

  return (
    <div className="space-y-4 w-full px-2 sm:px-4 md:px-6 font-normal">
      {/* 🏷️ Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500 text-white rounded-xl shadow-xs">
              <PackageSearch className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                Inventario y Costeo de Insumos
              </h1>
              <p className="text-xs text-slate-500">
                Auditoría y control de compras, costos directos y gastos operativos &bull; <strong>{periodoNombre}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Acciones de Exportación */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <ExportButtons
            transacciones={transacciones}
            kpis={kpis}
            periodoNombre={periodoNombre}
            submoduloNombre={activeSubmodulo}
          />
        </div>
      </div>

      {/* 📊 Tarjetas de KPIs Gerenciales */}
      <InsumosKPIHeader kpis={kpis} />

      {/* 🗂️ Pestañas de Submódulos Solicitados */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <InsumosSubmenuTabs
          activeTab={activeSubmodulo}
          onTabChange={setActiveSubmodulo}
          counts={submoduloCounts}
        />
      </div>

      {/* 📦 Contenido Principal: Libros de Egresos vs Facturas/Insumos */}
      {activeSubmodulo === 'LIBROS_EGRESOS' ? (
        <LibrosEgresosView periodoId={selectedPeriodoId || currentPeriodo?.id || 'per-2026-09'} />
      ) : (
        <>
          {/* 🔍 Barra de Herramientas y Filtros */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* 1. Selector de Modo de Vista (Por Factura vs Por Insumo) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('FACTURAS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'FACTURAS'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 text-orange-600" />
                  <span>Por Factura / Comprobante ({facturas.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('INSUMOS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'INSUMOS'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Por Insumo / Ítem ({transacciones.length})</span>
                </button>
              </div>

              {/* 2. Buscador en Tiempo Real */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por insumo, factura, proveedor o descripción..."
                  className="w-full h-8 pl-8 pr-8 text-xs rounded-xl border border-slate-300 outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. Filtros secundarios (Proveedor, Cuaderno) */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <Filter className="w-3 h-3" />
                <span>Filtrar por:</span>
              </span>

              {/* Filtro de Proveedor */}
              <select
                value={selectedProveedor}
                onChange={(e) => setSelectedProveedor(e.target.value)}
                className="h-7 px-2.5 rounded-lg border border-slate-300 text-slate-700 bg-white outline-none focus:border-orange-500 cursor-pointer text-xs"
              >
                <option value="ALL">Todos los Proveedores ({proveedores.length})</option>
                {proveedores.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              {/* Filtro de Auditoría Cuaderno */}
              <select
                value={selectedRelacionCuaderno}
                onChange={(e) => setSelectedRelacionCuaderno(e.target.value)}
                className="h-7 px-2.5 rounded-lg border border-slate-300 text-slate-700 bg-white outline-none focus:border-orange-500 cursor-pointer text-xs"
              >
                <option value="ALL">Todos (Cuaderno y Facturas)</option>
                <option value="Cruza con Cuaderno Don Arturo">✓ Cruza con Cuaderno Don Arturo</option>
                <option value="No Cruza con Cuaderno Don Arturo">✕ No Cruza con Cuaderno</option>
              </select>

              {/* Limpiar Filtros */}
              {(activeSubmodulo !== 'ALL' || selectedProveedor !== 'ALL' || selectedRelacionCuaderno !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubmodulo('ALL');
                    setSelectedProveedor('ALL');
                    setSelectedRelacionCuaderno('ALL');
                    setSearchQuery('');
                  }}
                  className="text-orange-600 hover:text-orange-800 text-xs font-medium cursor-pointer ml-auto"
                >
                  Limpiar todos los filtros
                </button>
              )}
            </div>
          </div>

          {/* 📦 Contenido Principal según el Modo de Vista */}
          {loading ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <Loader2 className="w-7 h-7 text-orange-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Cargando transacciones de insumos y costos...</p>
            </div>
          ) : viewMode === 'FACTURAS' ? (
            <FacturasView facturas={facturas} />
          ) : (
            <InsumosTableView transacciones={transacciones} itemsAgrupados={items} />
          )}
        </>
      )}
    </div>
  );
}
