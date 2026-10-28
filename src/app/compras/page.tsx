'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShoppingCart, 
  Receipt, 
  Package, 
  ListFilter, 
  Search, 
  X, 
  Layers, 
  Calendar, 
  Building2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { usePeriodo } from '@/context/PeriodoContext';
import ComprasKPIHeader from '@/components/compras/ComprasKPIHeader';
import ComprasFacturasView from '@/components/compras/ComprasFacturasView';
import ComprasInsumosView from '@/components/compras/ComprasInsumosView';
import ComprasLineasView from '@/components/compras/ComprasLineasView';
import ComprasExportButtons from '@/components/compras/ComprasExportButtons';
import { 
  ComprasKPIs, 
  CompraFacturaGroup, 
  CompraInsumoGroup, 
  CompraDetalleItem 
} from '@/services/comprasService';
import { getCachedData, setCachedData } from '@/lib/dataCache';

type TabView = 'FACTURAS' | 'INSUMOS' | 'LINEAS';

export default function ComprasPage() {
  const { currentPeriodo, selectedPeriodoId } = usePeriodo();
  const periodoId = selectedPeriodoId || currentPeriodo?.id || 'per-2026-10';
  const periodoNombre = currentPeriodo?.nombre || 'Octubre 2026';
  const cacheKey = `compras_data_${periodoId}`;

  const cached = getCachedData<{
    kpis: ComprasKPIs;
    facturas: CompraFacturaGroup[];
    insumos: CompraInsumoGroup[];
    lineas: CompraDetalleItem[];
    proveedores: string[];
    categorias: string[];
    fechas: string[];
  }>(cacheKey);

  const [loading, setLoading] = useState(!cached);
  const [activeTab, setActiveTab] = useState<TabView>('FACTURAS');

  // Datos del backend
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

  // Filtros activos
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedProveedor, setSelectedProveedor] = useState('');
  const [selectedFecha, setSelectedFecha] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compras?periodo_id=${periodoId}&t=${Date.now()}`, {
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
  }, [periodoId, cacheKey]);

  useEffect(() => {
    loadData(Boolean(cached));
  }, [loadData]);

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
      // Filtro Categoría
      if (selectedCategoria && fac.categoria !== selectedCategoria && !fac.items.some((it) => it.categoria === selectedCategoria)) {
        return false;
      }
      // Filtro Proveedor
      if (selectedProveedor && fac.proveedor !== selectedProveedor) {
        return false;
      }
      // Filtro Fecha
      if (selectedFecha && fac.fecha !== selectedFecha) {
        return false;
      }
      // Buscador Inteligente
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

  return (
    <div className="space-y-4 w-full font-normal">
      {/* 🏷️ Encabezado Principal Tipo Git */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
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

        {/* Acciones de Exportación */}
        <div className="flex items-center gap-2 flex-wrap">
          <ComprasExportButtons
            facturas={filteredFacturas}
            insumos={filteredInsumos}
            lineas={filteredLineas}
            periodoNombre={periodoNombre}
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

          {/* Grid de Filtros Select en Móvil */}
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
        {/* Pestaña Facturas (Default) */}
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

        {/* Pestaña Insumos Consolidados */}
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

        {/* Pestaña Líneas Detalladas */}
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
