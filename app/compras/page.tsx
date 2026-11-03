'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShoppingCart, 
  Receipt, 
  Package, 
  ListFilter, 
  Search, 
  X, 
  Calendar, 
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  ArrowLeft
} from 'lucide-react';
import { usePeriodo } from '@/context/PeriodoContext';
import ComprasKPIHeader from '@/components/compras/ComprasKPIHeader';
import ComprasFacturasView from '@/components/compras/ComprasFacturasView';
import ComprasInsumosView from '@/components/compras/ComprasInsumosView';
import ComprasLineasView from '@/components/compras/ComprasLineasView';
import ComprasExportButtons from '@/components/compras/ComprasExportButtons';
import NuevaCompraView from '@/components/compras/NuevaCompraView';
import { 
  ComprasKPIs, 
  CompraFacturaGroup, 
  CompraInsumoGroup, 
  CompraDetalleItem,
  MesComprasResumen
} from '@/services/comprasService';
import { getCachedData, setCachedData } from '@/lib/dataCache';

type TabView = 'FACTURAS' | 'INSUMOS' | 'LINEAS';

export default function ComprasPage() {
  const { currentPeriodo, selectedPeriodoId, setSelectedPeriodoId, periodos } = usePeriodo();

  // Estado para la vista de selección de mes a pantalla completa
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [mesesList, setMesesList] = useState<MesComprasResumen[]>([]);
  const [loadingMeses, setLoadingMeses] = useState(true);
  const [searchMonthQuery, setSearchMonthQuery] = useState('');
  const [isAddingCompra, setIsAddingCompra] = useState(false);

  // Período activo cuando se entra al detalle
  const activePeriodoId = selectedMonthId || selectedPeriodoId || currentPeriodo?.id || 'per-2026-10';

  const periodoNombre = useMemo(() => {
    if (!activePeriodoId) return 'Octubre 2026';
    const foundMes = mesesList.find((m) => m.periodo_id === activePeriodoId);
    if (foundMes) return foundMes.nombre;
    const foundPeriodo = periodos?.find((p) => p.id === activePeriodoId);
    return foundPeriodo?.nombre || 'Octubre 2026';
  }, [activePeriodoId, mesesList, periodos]);

  // Cargar el listado de meses con compras registradas
  const loadMeses = useCallback(async () => {
    setLoadingMeses(true);
    try {
      const res = await fetch(`/api/compras?view=MESES&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.meses)) {
          setMesesList(json.meses);
        }
      }
    } catch (err) {
      console.error('Error cargando meses de compras:', err);
    } finally {
      setLoadingMeses(false);
    }
  }, []);

  useEffect(() => {
    loadMeses();
  }, [loadMeses]);

  const cacheKey = `compras_data_${activePeriodoId}`;
  const cached = getCachedData<{
    kpis: ComprasKPIs;
    facturas: CompraFacturaGroup[];
    insumos: CompraInsumoGroup[];
    lineas: CompraDetalleItem[];
    proveedores: string[];
    categorias: string[];
    fechas: string[];
  }>(cacheKey);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('FACTURAS');

  // Datos del backend para el mes seleccionado
  const [kpis, setKpis] = useState<ComprasKPIs>(() => cached?.kpis || {
    totalFacturas: 0,
    totalDinero: 0,
    totalItems: 0,
    categorias: [],
  });
  const [facturas, setFacturas] = useState<CompraFacturaGroup[]>(() => cached?.facturas || []);
  const [insumos, setInsumos] = useState<CompraInsumoGroup[]>(() => cached?.insumos || []);
  const [lineas, setLineas] = useState<CompraDetalleItem[]>(() => cached?.lineas || []);
  const [proveedores, setProveedores] = useState<string[]>(() => cached?.proveedores || []);
  const [categorias, setCategorias] = useState<string[]>(() => cached?.categorias || []);
  const [fechas, setFechas] = useState<string[]>(() => cached?.fechas || []);
  const [error, setError] = useState<string | null>(null);

  // Filtros activos en vista detalle
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedProveedor, setSelectedProveedor] = useState('');
  const [selectedFecha, setSelectedFecha] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!selectedMonthId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compras?periodo_id=${activePeriodoId}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: No se pudo obtener la información de compras`);
      }
      const json = await res.json();
      if (json.success) {
        if (json.kpis) setKpis(json.kpis);
        if (json.facturas) setFacturas(json.facturas);
        if (json.insumos) setInsumos(json.insumos);
        if (json.lineas) setLineas(json.lineas);
        if (json.proveedores) setProveedores(json.proveedores);
        if (json.categorias) setCategorias(json.categorias);
        if (json.fechas) setFechas(json.fechas);

        setCachedData(cacheKey, {
          kpis: json.kpis,
          facturas: json.facturas,
          insumos: json.insumos,
          lineas: json.lineas,
          proveedores: json.proveedores,
          categorias: json.categorias,
          fechas: json.fechas,
        });
      } else {
        throw new Error(json.error || 'Respuesta no exitosa');
      }
    } catch (err: any) {
      console.error('Error cargando compras:', err);
      setError(err?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [selectedMonthId, activePeriodoId, cacheKey]);

  useEffect(() => {
    if (selectedMonthId) {
      loadData(Boolean(cached));
    }
  }, [selectedMonthId, loadData]);

  // Limpiar todos los filtros
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategoria('');
    setSelectedProveedor('');
    setSelectedFecha('');
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedCategoria || selectedProveedor || selectedFecha
  );

  // Normalizador para búsqueda inteligente
  const normalize = (text: string) =>
    (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // 1. Filtrado de Facturas
  const filteredFacturas = useMemo(() => {
    const q = normalize(searchQuery);
    return facturas.filter((fac) => {
      if (selectedCategoria && fac.categoria !== selectedCategoria && !fac.items.some((it) => it.categoria === selectedCategoria)) {
        return false;
      }
      if (selectedProveedor && fac.proveedor !== selectedProveedor) {
        return false;
      }
      if (selectedFecha && fac.fecha !== selectedFecha) {
        return false;
      }
      if (q) {
        const matchHeader =
          normalize(fac.numero_factura).includes(q) ||
          normalize(fac.proveedor).includes(q) ||
          normalize(fac.origen).includes(q) ||
          normalize(fac.observaciones).includes(q);
        const matchItems = fac.items.some(
          (it) =>
            normalize(it.nombre_insumo).includes(q) ||
            normalize(it.detalle).includes(q)
        );
        return matchHeader || matchItems;
      }
      return true;
    });
  }, [facturas, searchQuery, selectedCategoria, selectedProveedor, selectedFecha]);

  // 2. Filtrado de Insumos
  const filteredInsumos = useMemo(() => {
    const q = normalize(searchQuery);
    return insumos.filter((ins) => {
      if (selectedCategoria && ins.categoria !== selectedCategoria) return false;
      if (selectedProveedor && !ins.proveedores.includes(selectedProveedor)) return false;
      if (q) {
        return (
          normalize(ins.nombre_insumo).includes(q) ||
          ins.proveedores.some((p) => normalize(p).includes(q))
        );
      }
      return true;
    });
  }, [insumos, searchQuery, selectedCategoria, selectedProveedor]);

  // 3. Filtrado de Líneas
  const filteredLineas = useMemo(() => {
    const q = normalize(searchQuery);
    return lineas.filter((lin) => {
      if (selectedCategoria && lin.categoria !== selectedCategoria) return false;
      if (selectedProveedor && lin.proveedor !== selectedProveedor) return false;
      if (selectedFecha && lin.fecha !== selectedFecha) return false;
      if (q) {
        return (
          normalize(lin.numero_factura).includes(q) ||
          normalize(lin.proveedor).includes(q) ||
          normalize(lin.nombre_insumo).includes(q) ||
          normalize(lin.detalle).includes(q) ||
          normalize(lin.origen).includes(q)
        );
      }
      return true;
    });
  }, [lineas, searchQuery, selectedCategoria, selectedProveedor, selectedFecha]);

  // Meses filtrados por el buscador en la vista previa
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

  // =========================================================================
  // VISTA 1: LISTADO DE MESES QUE TIENEN INFORMACIÓN (A PANTALLA COMPLETA)
  // =========================================================================
  if (selectedMonthId === null) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-8 animate-fade-in font-normal">
        {/* Encabezado Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hojas de Entradas por Compra</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Listado de meses con compras registradas ordenadas desde la más reciente.
            </p>
          </div>
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
            <p className="text-xs font-medium">Cargando períodos de compras...</p>
          </div>
        ) : filteredMeses.length === 0 ? (
          <div className="bg-white rounded-lg p-10 border border-slate-200 text-center text-slate-500">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-600">No se encontraron meses con compras registradas.</p>
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
                        {m.nombre} - Facturas de Compra
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{m.total_facturas} {m.total_facturas === 1 ? 'factura registrada' : 'facturas registradas'}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">
                        Inversión total: ${m.total_dinero.toLocaleString('es-CO')} COP
                      </span>
                      {m.total_items > 0 && (
                        <>
                          <span>•</span>
                          <span>{m.total_items.toLocaleString('es-CO')} ítems comprados</span>
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
      </div>
    );
  }

  // =========================================================================
  // VISTA 2: FORMULARIO DE AÑADIR NUEVA FACTURA DE COMPRA
  // =========================================================================
  if (isAddingCompra) {
    return (
      <NuevaCompraView
        periodoId={activePeriodoId}
        periodoNombre={periodoNombre}
        proveedoresExistentes={proveedores}
        categoriasExistentes={categorias}
        onCancel={() => setIsAddingCompra(false)}
        onSuccess={() => {
          setIsAddingCompra(false);
          loadData();
          loadMeses();
        }}
      />
    );
  }

  // =========================================================================
  // VISTA 3: DETALLE DEL MES SELECCIONADO
  // =========================================================================
  return (
    <div className="space-y-4 w-full font-normal animate-fade-in">
      {/* 🏷️ Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedMonthId(null)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-md border border-slate-200 transition-colors cursor-pointer"
            title="Volver a la lista de meses"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="p-2 bg-slate-900 text-white rounded-md">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Entradas por Compra
            </h1>
            <p className="text-xs text-slate-500">
              Control de facturas de costo directo y materia prima • {periodoNombre}
            </p>
          </div>
        </div>

        {/* Acciones del Encabezado: Utilidades y Añadir Compra */}
        <div className="flex items-center gap-2 flex-wrap">
          <ComprasExportButtons
            facturas={filteredFacturas}
            insumos={filteredInsumos}
            lineas={filteredLineas}
            periodoNombre={periodoNombre}
            onAddCompra={() => setIsAddingCompra(true)}
          />
        </div>
      </div>

      {/* 📊 Tarjetas de KPIs y Categorías */}
      <ComprasKPIHeader
        kpis={kpis}
        selectedCategory={selectedCategoria}
        onSelectCategory={setSelectedCategoria}
        periodoNombre={periodoNombre}
      />

      {/* 🔍 Barra de Búsqueda Inteligente y Filtros */}
      <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-2.5 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          {/* Buscador de texto */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por factura, proveedor, insumo o detalle original del PDF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 text-sm sm:text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grid de Filtros Select */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-wrap items-center">
            {/* Filtro Proveedor */}
            <div className="w-full sm:min-w-[170px]">
              <select
                value={selectedProveedor}
                onChange={(e) => setSelectedProveedor(e.target.value)}
                className="w-full py-2 sm:py-1.5 px-2.5 min-h-[40px] sm:min-h-0 text-sm sm:text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-slate-800 cursor-pointer"
              >
                <option value="">Todos los Proveedores</option>
                {proveedores.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Categoría */}
            <div className="w-full sm:min-w-[160px]">
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="w-full py-2 sm:py-1.5 px-2.5 min-h-[40px] sm:min-h-0 text-sm sm:text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-slate-800 cursor-pointer"
              >
                <option value="">Todas las Categorías</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Fecha */}
            <div className="w-full sm:min-w-[130px]">
              <select
                value={selectedFecha}
                onChange={(e) => setSelectedFecha(e.target.value)}
                className="w-full py-2 sm:py-1.5 px-2.5 min-h-[40px] sm:min-h-0 text-sm sm:text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-slate-800 cursor-pointer font-mono"
              >
                <option value="">Todas las Fechas</option>
                {fechas.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Limpiar Filtros */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* 🗂️ Pestañas del Módulo */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 select-none">
        <button
          type="button"
          onClick={() => setActiveTab('FACTURAS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'FACTURAS'
              ? 'bg-slate-900 border-slate-900 text-white shadow-2xs font-semibold'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Por Factura</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
              activeTab === 'FACTURAS'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {filteredFacturas.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INSUMOS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'INSUMOS'
              ? 'bg-slate-900 border-slate-900 text-white shadow-2xs font-semibold'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Por Insumo (Totales)</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
              activeTab === 'INSUMOS'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {filteredInsumos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LINEAS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'LINEAS'
              ? 'bg-slate-900 border-slate-900 text-white shadow-2xs font-semibold'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Todas las Entradas (Líneas)</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
              activeTab === 'LINEAS'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {filteredLineas.length}
          </span>
        </button>
      </div>

      {/* 📄 Vistas según Pestaña Activa */}
      {loading ? (
        <div className="bg-white rounded-lg p-12 border border-slate-200 text-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
          <p className="text-xs font-medium">Cargando facturas y compras de materia prima...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-xs">
            <div className="font-semibold">Error al cargar datos</div>
            <div>{error}</div>
          </div>
        </div>
      ) : activeTab === 'FACTURAS' ? (
        <ComprasFacturasView facturas={filteredFacturas} />
      ) : activeTab === 'INSUMOS' ? (
        <ComprasInsumosView insumos={filteredInsumos} />
      ) : (
        <ComprasLineasView lineas={filteredLineas} />
      )}
    </div>
  );
}
