'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CalendarRange, 
  Package, 
  BarChart3, 
  Scale, 
  Wrench, 
  Save, 
  CheckCircle2, 
  Lock, 
  Plus, 
  Search, 
  Loader2, 
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Clock,
  User,
  HelpCircle,
  FileText,
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Check
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';

interface Insumo {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  peso_estandar_porcion_kg: number;
  costo_unitario_kg: number;
  stock_minimo_kg: number;
}

interface StockItem {
  insumo_id: string;
  bodega_sin_porcionar_kg: number;
  bodega_porcionado_und: number;
  bodega_porcionado_kg: number;
  cocina_sin_porcionar_kg: number;
  cocina_porcionado_und: number;
  cocina_porcionado_kg: number;
}

interface AjusteLogItem {
  id: string;
  fecha: string;
  fecha_hora: string;
  insumo_id: string;
  insumo_nombre?: string;
  categoria?: string;
  tipo_movimiento: string;
  origen: string;
  destino: string;
  cant_sin_porcionar_kg: number;
  porciones_und: number;
  peso_porciones_kg: number;
  merma_kg: number;
  costo_unitario_kg: number;
  valor_total_movimiento: number;
  observaciones: string;
  usuario: string;
  catalogo_insumos?: {
    nombre: string;
    categoria: string;
  };
}

interface Periodo {
  id: string;
  codigo: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'ABIERTO' | 'EN_CONCILIACION' | 'CERRADO';
  inicial_registrado: boolean;
  inventario_inicial: Record<string, any>;
  conteo_cierre_fisico?: Record<string, any>;
  fecha_cierre?: string;
  usuario_cierre?: string;
}

export default function PeriodosPage() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [activoPeriodo, setActivoPeriodo] = useState<Periodo | null>(null);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string>('');
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [ajustesLog, setAjustesLog] = useState<AjusteLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs: 'INICIAL' | 'BALANCE' | 'CONCILIACION' | 'AJUSTES'
  const [activeTab, setActiveTab] = useState<'INICIAL' | 'BALANCE' | 'CONCILIACION' | 'AJUSTES'>('INICIAL');
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');

  // Sorting State
  const [sortField, setSortField] = useState<string>('nombre');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Tab 1: Estado para editar inventario inicial
  const [initialForm, setInitialForm] = useState<Record<string, { bodega_kg: string; bodega_und: string; bodega_porc_kg: string; cocina_und: string; cocina_porc_kg: string }>>({});
  const [savingInitial, setSavingInitial] = useState(false);

  // Tab 3: Estado para conteo físico de conciliación
  const [physicalForm, setPhysicalForm] = useState<Record<string, { bodega_kg: string; bodega_und: string; bodega_porc_kg: string; cocina_und: string; cocina_porc_kg: string }>>({});
  const [closingPeriod, setClosingPeriod] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');

  // Tab 4: Formulario de ajuste manual
  const [adjInsumoId, setAdjInsumoId] = useState('');
  const [adjInsumoSearch, setAdjInsumoSearch] = useState('');
  const [isAdjInsumoDropdownOpen, setIsAdjInsumoDropdownOpen] = useState(false);
  const adjInsumoRef = useRef<HTMLDivElement>(null);

  const [adjTipo, setAdjTipo] = useState('MERMA_POR_DESCONGELACION');
  const [adjUbicacion, setAdjUbicacion] = useState('BODEGA_PORCIONADO');
  const [adjCantidad, setAdjCantidad] = useState('');
  const [adjJustificacion, setAdjJustificacion] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (adjInsumoRef.current && !adjInsumoRef.current.contains(e.target as Node)) {
        setIsAdjInsumoDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/periodos?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setPeriodos(data.periodos || []);
        const act = data.activo;
        setActivoPeriodo(act);
        setSelectedPeriodoId(act?.id || data.periodos[0]?.id || '');
        setInsumos(data.insumos || []);
        setStockList(data.stock || []);

        const initialMap: Record<string, any> = {};
        const physMap: Record<string, any> = {};
        const savedInitial = act?.inventario_inicial || {};

        (data.insumos || []).forEach((ins: Insumo) => {
          const init = savedInitial[ins.id];
          const stock = (data.stock || []).find((s: StockItem) => s.insumo_id === ins.id);

          initialMap[ins.id] = {
            bodega_kg: init ? String(init.bodega_sin_porc_kg || 0) : String(stock?.bodega_sin_porcionar_kg || 0),
            bodega_und: init ? String(init.bodega_porc_und || 0) : String(stock?.bodega_porcionado_und || 0),
            bodega_porc_kg: init ? String(init.bodega_porc_kg || 0) : String(stock?.bodega_porcionado_kg || 0),
            cocina_und: init ? String(init.cocina_porc_und || 0) : String(stock?.cocina_porcionado_und || 0),
            cocina_porc_kg: init ? String(init.cocina_porc_kg || 0) : String(stock?.cocina_porcionado_kg || 0),
          };

          physMap[ins.id] = {
            bodega_kg: String(stock?.bodega_sin_porcionar_kg || 0),
            bodega_und: String(stock?.bodega_porcionado_und || 0),
            bodega_porc_kg: String(stock?.bodega_porcionado_kg || 0),
            cocina_und: String(stock?.cocina_porcionado_und || 0),
            cocina_porc_kg: String(stock?.cocina_porcionado_kg || 0),
          };
        });

        setInitialForm(initialMap);
        setPhysicalForm(physMap);
        if (data.insumos?.length > 0) {
          setAdjInsumoId((prev) => {
            if (!prev) {
              setAdjInsumoSearch(`${data.insumos[0].nombre} (${data.insumos[0].categoria})`);
              return data.insumos[0].id;
            }
            return prev;
          });
        }
      }

      // Consultar historial de movimientos de ajustes
      const movRes = await fetch(`/api/bodega/movimientos?t=${Date.now()}`, { cache: 'no-store' });
      const movData = await movRes.json();
      const rawList = movData.data || movData.movimientos || [];
      if (Array.isArray(rawList)) {
        const filteredAdj = rawList.filter(
          (m: any) => m.tipo_movimiento === 'AJUSTE_INVENTARIO' || m.tipo_movimiento === 'INVENTARIO_INICIAL'
        );
        setAjustesLog(filteredAdj);
      }
    } catch (e) {
      console.error('Error loading periodos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentPeriodo = useMemo(() => {
    return periodos.find((p) => p.id === selectedPeriodoId) || activoPeriodo;
  }, [periodos, selectedPeriodoId, activoPeriodo]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredInsumos = useMemo(() => {
    const cleanQ = normalizeStr(searchQuery);
    return insumos.filter((item) => {
      if (catFilter !== 'ALL' && normalizeStr(item.categoria) !== normalizeStr(catFilter)) return false;
      if (!cleanQ) return true;
      return normalizeStr(item.nombre).includes(cleanQ) || normalizeStr(item.codigo).includes(cleanQ);
    });
  }, [insumos, searchQuery, catFilter]);

  const filteredAdjInsumos = useMemo(() => {
    if (!adjInsumoSearch.trim()) return insumos;
    const q = normalizeStr(adjInsumoSearch);
    return insumos.filter(
      (i) => normalizeStr(i.nombre).includes(q) || normalizeStr(i.categoria).includes(q) || (i.codigo && normalizeStr(i.codigo).includes(q))
    );
  }, [insumos, adjInsumoSearch]);

  const sortedInsumos = useMemo(() => {
    return [...filteredInsumos].sort((a, b) => {
      let valA: any = a[sortField as keyof Insumo];
      let valB: any = b[sortField as keyof Insumo];

      if (sortField === 'bodega_kg') {
        valA = parseFloat(initialForm[a.id]?.bodega_kg || '0') || 0;
        valB = parseFloat(initialForm[b.id]?.bodega_kg || '0') || 0;
      } else if (sortField === 'bodega_und') {
        valA = parseInt(initialForm[a.id]?.bodega_und || '0') || 0;
        valB = parseInt(initialForm[b.id]?.bodega_und || '0') || 0;
      } else if (sortField === 'bodega_porc_kg') {
        valA = parseFloat(initialForm[a.id]?.bodega_porc_kg || '0') || 0;
        valB = parseFloat(initialForm[b.id]?.bodega_porc_kg || '0') || 0;
      } else if (sortField === 'cocina_und') {
        valA = parseInt(initialForm[a.id]?.cocina_und || '0') || 0;
        valB = parseInt(initialForm[b.id]?.cocina_und || '0') || 0;
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [filteredInsumos, sortField, sortAsc, initialForm]);

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-orange-600 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-orange-600 font-bold" />
    );
  };

  // Manejar Guardar Inventario Inicial
  const handleSaveInitial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPeriodo) return;

    setSavingInitial(true);
    try {
      const itemsPayload: Record<string, any> = {};
      insumos.forEach((ins) => {
        const formVal = initialForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
        const bKg = parseFloat(formVal.bodega_kg) || 0;
        const bUnd = parseInt(formVal.bodega_und) || 0;
        const pesoStd = ins.peso_estandar_porcion_kg || 0.35;
        const bPorcKg = parseFloat(formVal.bodega_porc_kg) || (bUnd * pesoStd);
        const cUnd = parseInt(formVal.cocina_und) || 0;
        const cPorcKg = parseFloat(formVal.cocina_porc_kg) || (cUnd * pesoStd);

        itemsPayload[ins.id] = {
          insumo_id: ins.id,
          nombre: ins.nombre,
          categoria: ins.categoria,
          bodega_sin_porc_kg: bKg,
          bodega_porc_und: bUnd,
          bodega_porc_kg: bPorcKg,
          cocina_sin_porc_kg: 0,
          cocina_porc_und: cUnd,
          cocina_porc_kg: cPorcKg,
          costo_unitario_kg: ins.costo_unitario_kg || 0,
        };
      });

      const res = await fetch('/api/periodos/inicial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodoId: currentPeriodo.id,
          items: itemsPayload,
          usuario: 'Administrador',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar inventario inicial');

      alert(`✅ Inventario inicial de ${currentPeriodo.nombre} fijado y sincronizado con éxito.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingInitial(false);
    }
  };

  // Manejar Cierre de Periodo
  const handleConfirmClosePeriod = async () => {
    if (!currentPeriodo) return;

    setClosingPeriod(true);
    try {
      const physicalPayload: Record<string, any> = {};
      insumos.forEach((ins) => {
        const p = physicalForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
        const bUnd = parseInt(p.bodega_und) || 0;
        const pesoStd = ins.peso_estandar_porcion_kg || 0.35;
        const bPorcKg = parseFloat(p.bodega_porc_kg) || (bUnd * pesoStd);
        const cUnd = parseInt(p.cocina_und) || 0;
        const cPorcKg = parseFloat(p.cocina_porc_kg) || (cUnd * pesoStd);

        physicalPayload[ins.id] = {
          bodega_kg: parseFloat(p.bodega_kg) || 0,
          bodega_und: bUnd,
          bodega_porc_kg: bPorcKg,
          cocina_und: cUnd,
          cocina_porc_kg: cPorcKg,
        };
      });

      const res = await fetch('/api/periodos/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodoId: currentPeriodo.id,
          conteoFisico: physicalPayload,
          usuario: 'Administrador',
          observaciones: closeNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al cerrar periodo');

      setIsCloseModalOpen(false);
      alert(`🎉 Periodo ${currentPeriodo.nombre} cerrado exitosamente.\n\n✨ Se ha aperturado automáticamente el nuevo periodo ${data.next.nombre} con el inventario inicial ajustado.`);
      await loadData();
      setActiveTab('INICIAL');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClosingPeriod(false);
    }
  };

  // Manejar Ajuste Manual
  const handleSaveAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjJustificacion.trim()) return alert('Debes ingresar la justificación detallada del ajuste.');

    setSavingAdj(true);
    try {
      const res = await fetch('/api/bodega/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insumo_id: adjInsumoId,
          tipo_ajuste: adjTipo,
          ubicacion: adjUbicacion,
          cantidad: parseFloat(adjCantidad) || 0,
          justificacion: adjJustificacion.trim(),
          usuario: 'Administrador',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar ajuste');

      alert('✅ Ajuste de inventario auditado y registrado con éxito.');
      setAdjCantidad('');
      setAdjJustificacion('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingAdj(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-xs font-normal">Cargando Módulo de Periodos y Conciliación...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 animate-fade-in font-normal">
      {/* 📅 Encabezado Superior con Selector de Periodo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-medium text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-orange-500" />
            <span>Control de Periodos y Conciliación Mensual</span>
          </h2>
          <p className="text-xs text-slate-400 font-normal">
            Ciclo contable de inventario: apertura de mes, balances, auditoría física y cierres
          </p>
        </div>

        {/* Selector de Mes */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-normal">Periodo:</span>
          <select
            value={selectedPeriodoId}
            onChange={(e) => setSelectedPeriodoId(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 bg-white outline-none focus:border-orange-500 shadow-sm"
          >
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.estado})
              </option>
            ))}
          </select>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              currentPeriodo?.estado === 'ABIERTO'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : currentPeriodo?.estado === 'EN_CONCILIACION'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {currentPeriodo?.estado === 'ABIERTO' ? '🟢 EN CURSO' : currentPeriodo?.estado === 'EN_CONCILIACION' ? '🟡 EN AUDITORÍA' : '🔒 CERRADO'}
          </span>
        </div>
      </div>

      {/* 🗂️ Pestañas de Navegación del Periodo */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('INICIAL')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'INICIAL'
              ? 'border-orange-500 text-orange-600 bg-orange-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>1. Inventario Inicial ({currentPeriodo?.nombre})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BALANCE')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'BALANCE'
              ? 'border-orange-500 text-orange-600 bg-orange-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>2. Balance del Periodo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CONCILIACION')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'CONCILIACION'
              ? 'border-orange-500 text-orange-600 bg-orange-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>3. Conciliación y Cierre</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AJUSTES')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'AJUSTES'
              ? 'border-orange-500 text-orange-600 bg-orange-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>4. Historial de Ajustes y Auditorías ({ajustesLog.length})</span>
        </button>
      </div>

      {/* 📦 PESTAÑA 1: INVENTARIO INICIAL */}
      {activeTab === 'INICIAL' && (
        <div className="space-y-3.5">
          <div className="bg-blue-50/60 border border-blue-200/80 p-3 rounded-xl flex items-start justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-medium text-blue-900 block">
                📋 Conteo de Apertura del Periodo: {currentPeriodo?.nombre}
              </span>
              <p className="text-blue-700 leading-relaxed font-normal">
                Ingresa las cantidades de apertura: <strong>Bodega Entero (Kg)</strong>, <strong>Bodega Porciones (Und y su Peso Real Kg)</strong> y <strong>Cocina Porciones</strong>. Los valores ingresados fijan el inventario base del mes.
              </p>
            </div>
            {currentPeriodo?.inicial_registrado && (
              <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Inicial Fijado
              </span>
            )}
          </div>

          {/* Filtros */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por corte o insumo..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 font-normal"
              />
            </div>

            <button
              type="button"
              disabled={savingInitial || currentPeriodo?.estado === 'CERRADO'}
              onClick={handleSaveInitial}
              className="px-4 h-8 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              {savingInitial ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Guardar y Fijar Inventario Inicial</span>
            </button>
          </div>

          {/* Tabla de Conteo Inicial con Header Pegajoso y Ordenamiento */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="relative max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-normal">
                <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm text-[11px] font-medium text-slate-600 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                  <tr>
                    <th onClick={() => handleSort('codigo')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 select-none group whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>CÓDIGO</span>
                        {renderSortIcon('codigo')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('nombre')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 select-none group whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>MATERIA PRIMA / CARNE</span>
                        {renderSortIcon('nombre')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('categoria')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 select-none group whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>CATEGORÍA</span>
                        {renderSortIcon('categoria')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('bodega_kg')} className="py-2.5 px-3 text-center bg-amber-50/80 cursor-pointer hover:bg-amber-100/80 select-none group whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>BODEGA ENTERO (KG)</span>
                        {renderSortIcon('bodega_kg')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('bodega_und')} className="py-2.5 px-3 text-center bg-purple-50/80 cursor-pointer hover:bg-purple-100/80 select-none group whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>BODEGA PORC. (UND)</span>
                        {renderSortIcon('bodega_und')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('bodega_porc_kg')} className="py-2.5 px-3 text-center bg-purple-100/80 cursor-pointer hover:bg-purple-200/80 select-none group whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>BODEGA PORC. (KG)</span>
                        {renderSortIcon('bodega_porc_kg')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('cocina_und')} className="py-2.5 px-3 text-center bg-orange-50/80 cursor-pointer hover:bg-orange-100/80 select-none group whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span>COCINA PORC. (UND)</span>
                        {renderSortIcon('cocina_und')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center bg-orange-100/80 whitespace-nowrap">COCINA PORC. (KG)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">PESO ESTÁNDAR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                  {sortedInsumos.map((ins) => {
                    const val = initialForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
                    const isClosed = currentPeriodo?.estado === 'CERRADO';
                    const pesoStd = ins.peso_estandar_porcion_kg || 0.35;

                    return (
                      <tr key={ins.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{ins.codigo}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{ins.nombre}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                            {ins.categoria}
                          </span>
                        </td>

                        {/* Bodega Entero Kg */}
                        <td className="py-2 px-3 text-center bg-amber-50/20">
                          <input
                            type="number"
                            step="0.01"
                            disabled={isClosed}
                            value={val.bodega_kg}
                            onChange={(e) =>
                              setInitialForm((prev) => ({
                                ...prev,
                                [ins.id]: { ...val, bodega_kg: e.target.value },
                              }))
                            }
                            className="w-20 h-7 text-center rounded border border-slate-300 focus:border-orange-500 font-medium text-slate-900 bg-white"
                          />
                        </td>

                        {/* Bodega Porciones Und */}
                        <td className="py-2 px-3 text-center bg-purple-50/20">
                          <input
                            type="number"
                            step="1"
                            disabled={isClosed}
                            value={val.bodega_und}
                            onChange={(e) => {
                              const newUnd = e.target.value;
                              const undNum = parseInt(newUnd) || 0;
                              const autoKg = (undNum * pesoStd).toFixed(2);
                              setInitialForm((prev) => ({
                                ...prev,
                                [ins.id]: {
                                  ...val,
                                  bodega_und: newUnd,
                                  bodega_porc_kg: val.bodega_porc_kg === '0' || !val.bodega_porc_kg ? autoKg : val.bodega_porc_kg,
                                },
                              }));
                            }}
                            className="w-16 h-7 text-center rounded border border-slate-300 focus:border-purple-500 font-medium text-purple-950 bg-white"
                          />
                        </td>

                        {/* Bodega Porciones Kg Real */}
                        <td className="py-2 px-3 text-center bg-purple-100/20">
                          <input
                            type="number"
                            step="0.01"
                            disabled={isClosed}
                            value={val.bodega_porc_kg}
                            onChange={(e) =>
                              setInitialForm((prev) => ({
                                ...prev,
                                [ins.id]: { ...val, bodega_porc_kg: e.target.value },
                              }))
                            }
                            className="w-20 h-7 text-center rounded border border-purple-300 focus:border-purple-500 font-medium text-purple-950 bg-white"
                            title="Peso real en Kg de las porciones en bodega"
                          />
                        </td>

                        {/* Cocina Porciones Und */}
                        <td className="py-2 px-3 text-center bg-orange-50/20">
                          <input
                            type="number"
                            step="1"
                            disabled={isClosed}
                            value={val.cocina_und}
                            onChange={(e) => {
                              const newUnd = e.target.value;
                              const undNum = parseInt(newUnd) || 0;
                              const autoKg = (undNum * pesoStd).toFixed(2);
                              setInitialForm((prev) => ({
                                ...prev,
                                [ins.id]: {
                                  ...val,
                                  cocina_und: newUnd,
                                  cocina_porc_kg: val.cocina_porc_kg === '0' || !val.cocina_porc_kg ? autoKg : val.cocina_porc_kg,
                                },
                              }));
                            }}
                            className="w-16 h-7 text-center rounded border border-slate-300 focus:border-orange-500 font-medium text-orange-950 bg-white"
                          />
                        </td>

                        {/* Cocina Porciones Kg Real */}
                        <td className="py-2 px-3 text-center bg-orange-100/20">
                          <input
                            type="number"
                            step="0.01"
                            disabled={isClosed}
                            value={val.cocina_porc_kg}
                            onChange={(e) =>
                              setInitialForm((prev) => ({
                                ...prev,
                                [ins.id]: { ...val, cocina_porc_kg: e.target.value },
                              }))
                            }
                            className="w-20 h-7 text-center rounded border border-orange-300 focus:border-orange-500 font-medium text-orange-950 bg-white"
                            title="Peso real en Kg de las porciones en cocina"
                          />
                        </td>

                        <td className="py-2 px-3 text-right text-slate-500">
                          {Math.round(pesoStd * 1000)} g
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 📊 PESTAÑA 2: BALANCE DEL PERIODO */}
      {activeTab === 'BALANCE' && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-500 font-normal uppercase">Periodo Activo</span>
              <span className="text-sm font-medium text-slate-900 block">{currentPeriodo?.nombre}</span>
              <span className="text-[10px] text-slate-400">{currentPeriodo?.fecha_inicio} a {currentPeriodo?.fecha_fin}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-500 font-normal uppercase">Stock Entero Bodega</span>
              <span className="text-base font-medium text-amber-700 block">
                {stockList.reduce((sum, s) => sum + (s.bodega_sin_porcionar_kg || 0), 0).toFixed(2)} Kg
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-500 font-normal uppercase">Porciones Bodega</span>
              <span className="text-base font-medium text-purple-700 block">
                {stockList.reduce((sum, s) => sum + (s.bodega_porcionado_und || 0), 0)} und ({stockList.reduce((sum, s) => sum + (s.bodega_porcionado_kg || 0), 0).toFixed(2)} Kg)
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-500 font-normal uppercase">Porciones Cocina</span>
              <span className="text-base font-medium text-orange-700 block">
                {stockList.reduce((sum, s) => sum + (s.cocina_porcionado_und || 0), 0)} und ({stockList.reduce((sum, s) => sum + (s.cocina_porcionado_kg || 0), 0).toFixed(2)} Kg)
              </span>
            </div>
          </div>

          {/* Tabla de Balance en Vivo con Header Pegajoso */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="relative max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-normal">
                <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm text-[11px] font-medium text-slate-600 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                  <tr>
                    <th onClick={() => handleSort('nombre')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 select-none group whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>INSUMO / CARNE</span>
                        {renderSortIcon('nombre')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">INICIAL BODEGA</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">STOCK ACTUAL BODEGA</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">INICIAL COCINA</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">STOCK ACTUAL COCINA</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">VALORIZADO ACTUAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                  {sortedInsumos.map((ins) => {
                    const init = currentPeriodo?.inventario_inicial?.[ins.id];
                    const stock = stockList.find((s) => s.insumo_id === ins.id);
                    const bKg = stock?.bodega_sin_porcionar_kg || 0;
                    const bPorcKg = stock?.bodega_porcionado_kg || 0;
                    const cPorcKg = stock?.cocina_porcionado_kg || 0;
                    const totalKg = bKg + bPorcKg + cPorcKg;
                    const valor = totalKg * (ins.costo_unitario_kg || 0);

                    return (
                      <tr key={ins.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-medium text-slate-900">{ins.nombre}</td>
                        <td className="py-2 px-3 text-center text-slate-500">
                          {init ? `${init.bodega_sin_porc_kg} Kg / ${init.bodega_porc_und} und (${init.bodega_porc_kg.toFixed(2)} Kg)` : '0'}
                        </td>
                        <td className="py-2 px-3 text-center font-medium text-slate-800">
                          {bKg.toFixed(2)} Kg / {stock?.bodega_porcionado_und || 0} und ({bPorcKg.toFixed(2)} Kg)
                        </td>
                        <td className="py-2 px-3 text-center text-slate-500">
                          {init ? `${init.cocina_porc_und} und (${init.cocina_porc_kg.toFixed(2)} Kg)` : '0'}
                        </td>
                        <td className="py-2 px-3 text-center font-medium text-orange-700">
                          {stock?.cocina_porcionado_und || 0} und ({cPorcKg.toFixed(2)} Kg)
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          $ {formatMoney(valor)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ⚖️ PESTAÑA 3: CONCILIACIÓN Y CIERRE DE MES COMPLETA (UNIDADES Y PESO KG) */}
      {activeTab === 'CONCILIACION' && (
        <div className="space-y-3.5">
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-medium text-amber-950 text-sm flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-600" /> Auditoría de Cierre y Conciliación Física ({currentPeriodo?.nombre})
              </span>
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(true)}
                disabled={currentPeriodo?.estado === 'CERRADO'}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Aplicar Ajustes y Cerrar {currentPeriodo?.nombre}</span>
              </button>
            </div>
            <p className="text-amber-800 leading-relaxed font-normal">
              Ingresa el conteo físico real auditado en báscula: <strong>Kilos Enteros</strong>, <strong>Porciones en Bodega (Und y Kg)</strong> y <strong>Porciones en Cocina (Und)</strong>. El sistema contrastará automáticamente el <strong>Stock Teórico vs Físico Real</strong>, calculará la merma exacta y su costo financiero.
            </p>
          </div>

          {/* Tabla de Conciliación Teórico vs Físico Completa */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="relative max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-normal">
                <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm text-[11px] font-medium text-slate-600 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                  <tr>
                    {/* Carne */}
                    <th onClick={() => handleSort('nombre')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 select-none group whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>CARNE / INSUMO</span>
                        {renderSortIcon('nombre')}
                      </div>
                    </th>

                    {/* TEÓRICO SISTEMA */}
                    <th className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-100/60">TEÓRICO ENTERO (KG)</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-100/60">TEÓRICO BODEGA PORC.</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-100/60">TEÓRICO COCINA (UND)</th>

                    {/* FÍSICO REAL AUDITADO (INPUTS) */}
                    <th className="py-2.5 px-3 text-center bg-amber-50/90 whitespace-nowrap">FÍSICO ENTERO (KG)</th>
                    <th className="py-2.5 px-3 text-center bg-purple-50/90 whitespace-nowrap">FÍSICO PORC. (UND)</th>
                    <th className="py-2.5 px-3 text-center bg-purple-100/90 whitespace-nowrap">FÍSICO PORC. (KG)</th>
                    <th className="py-2.5 px-3 text-center bg-orange-50/90 whitespace-nowrap">FÍSICO COCINA (UND)</th>

                    {/* DIFERENCIAS Y COSTO */}
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">DIFERENCIA (UND / KG)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">COSTO MERMA / DESCUADRE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                  {sortedInsumos.map((ins) => {
                    const stock = stockList.find((s) => s.insumo_id === ins.id);
                    const phys = physicalForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
                    const pesoStd = ins.peso_estandar_porcion_kg || 0.35;

                    // Teórico
                    const teoricoEnteroKg = stock?.bodega_sin_porcionar_kg || 0;
                    const teoricoPorcUnd = stock?.bodega_porcionado_und || 0;
                    const teoricoPorcKg = stock?.bodega_porcionado_kg || (teoricoPorcUnd * pesoStd);
                    const teoricoCocinaUnd = stock?.cocina_porcionado_und || 0;
                    const teoricoCocinaKg = stock?.cocina_porcionado_kg || (teoricoCocinaUnd * pesoStd);

                    // Físico
                    const fisicoEnteroKg = parseFloat(phys.bodega_kg) || 0;
                    const fisicoPorcUnd = parseInt(phys.bodega_und) || 0;
                    const fisicoPorcKg = parseFloat(phys.bodega_porc_kg) || (fisicoPorcUnd * pesoStd);
                    const fisicoCocinaUnd = parseInt(phys.cocina_und) || 0;
                    const fisicoCocinaKg = fisicoCocinaUnd * pesoStd;

                    // Diferencias
                    const difEnteroKg = fisicoEnteroKg - teoricoEnteroKg;
                    const difPorcUnd = (fisicoPorcUnd + fisicoCocinaUnd) - (teoricoPorcUnd + teoricoCocinaUnd);
                    const difTotalKg = difEnteroKg + (fisicoPorcKg + fisicoCocinaKg) - (teoricoPorcKg + teoricoCocinaKg);
                    const costoMerma = Math.abs(difTotalKg) * (ins.costo_unitario_kg || 0);

                    const isClosed = currentPeriodo?.estado === 'CERRADO';

                    return (
                      <tr key={ins.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Nombre */}
                        <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                          {ins.nombre}
                          <div className="text-[10px] text-slate-400">{ins.categoria}</div>
                        </td>

                        {/* Teórico Entero Kg */}
                        <td className="py-2 px-3 text-center text-slate-600 bg-slate-50/40">
                          {teoricoEnteroKg.toFixed(2)} Kg
                        </td>

                        {/* Teórico Porciones */}
                        <td className="py-2 px-3 text-center text-slate-600 bg-slate-50/40">
                          {teoricoPorcUnd} und <span className="text-[10px] text-slate-400">({teoricoPorcKg.toFixed(2)} Kg)</span>
                        </td>

                        {/* Teórico Cocina */}
                        <td className="py-2 px-3 text-center text-orange-700 bg-slate-50/40">
                          {teoricoCocinaUnd} und
                        </td>

                        {/* FÍSICO: Bodega Entero Kg (Input) */}
                        <td className="py-2 px-3 text-center bg-amber-50/20">
                          <input
                            type="number"
                            step="0.01"
                            disabled={isClosed}
                            value={phys.bodega_kg}
                            onChange={(e) =>
                              setPhysicalForm((prev) => ({
                                ...prev,
                                [ins.id]: { ...phys, bodega_kg: e.target.value },
                              }))
                            }
                            className="w-18 h-7 text-center rounded border border-slate-300 focus:border-amber-500 font-medium text-slate-900 bg-white"
                          />
                        </td>

                        {/* FÍSICO: Bodega Porciones Und (Input) */}
                        <td className="py-2 px-3 text-center bg-purple-50/20">
                          <input
                            type="number"
                            step="1"
                            disabled={isClosed}
                            value={phys.bodega_und}
                            onChange={(e) => {
                              const newUnd = e.target.value;
                              const undNum = parseInt(newUnd) || 0;
                              const autoKg = (undNum * pesoStd).toFixed(2);
                              setPhysicalForm((prev) => ({
                                ...prev,
                                [ins.id]: {
                                  ...phys,
                                  bodega_und: newUnd,
                                  bodega_porc_kg: phys.bodega_porc_kg === '0' || !phys.bodega_porc_kg ? autoKg : phys.bodega_porc_kg,
                                },
                              }));
                            }}
                            className="w-16 h-7 text-center rounded border border-slate-300 focus:border-purple-500 font-medium text-purple-950 bg-white"
                          />
                        </td>

                        {/* FÍSICO: Bodega Porciones Kg Real (Input) */}
                        <td className="py-2 px-3 text-center bg-purple-100/20">
                          <input
                            type="number"
                            step="0.01"
                            disabled={isClosed}
                            value={phys.bodega_porc_kg}
                            onChange={(e) =>
                              setPhysicalForm((prev) => ({
                                ...prev,
                                [ins.id]: { ...phys, bodega_porc_kg: e.target.value },
                              }))
                            }
                            className="w-18 h-7 text-center rounded border border-purple-300 focus:border-purple-500 font-medium text-purple-950 bg-white"
                            title="Peso real en báscula de las porciones"
                          />
                        </td>

                        {/* FÍSICO: Cocina Porciones Und (Input) */}
                        <td className="py-2 px-3 text-center bg-orange-50/20">
                          <input
                            type="number"
                            step="1"
                            disabled={isClosed}
                            value={phys.cocina_und}
                            onChange={(e) =>
                              setPhysicalForm((prev) => ({
                                ...prev,
                                [ins.id]: { ...phys, cocina_und: e.target.value },
                              }))
                            }
                            className="w-16 h-7 text-center rounded border border-orange-300 focus:border-orange-500 font-medium text-orange-950 bg-white"
                          />
                        </td>

                        {/* DIFERENCIA */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium inline-block ${
                              Math.abs(difTotalKg) < 0.05
                                ? 'bg-slate-100 text-slate-600'
                                : difTotalKg < 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {difPorcUnd !== 0 && `${difPorcUnd > 0 ? '+' : ''}${difPorcUnd} und `}
                            {`(${difTotalKg > 0 ? '+' : ''}${difTotalKg.toFixed(2)} Kg)`}
                          </span>
                        </td>

                        {/* COSTO MERMA */}
                        <td className="py-2 px-3 text-right font-medium whitespace-nowrap">
                          {difTotalKg < -0.05 ? (
                            <span className="text-red-600">- $ {formatMoney(costoMerma)}</span>
                          ) : difTotalKg > 0.05 ? (
                            <span className="text-emerald-600">+ $ {formatMoney(costoMerma)}</span>
                          ) : (
                            <span className="text-slate-400">$ 0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ PESTAÑA 4: HISTORIAL DE AJUSTES Y FORMULARIO */}
      {activeTab === 'AJUSTES' && (
        <div className="space-y-4">
          {/* Formulario Superior Compacto de Registro de Ajuste */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-medium text-slate-900 text-xs flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-orange-500" /> Registrar Nuevo Ajuste Extraordinario
              </span>
              <span className="text-[11px] text-slate-400">Todo ajuste queda auditado con fecha, usuario y justificación</span>
            </div>

            <form onSubmit={handleSaveAjuste} className="space-y-3 text-xs font-normal">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Insumo con Buscador Inteligente */}
                <div className="relative" ref={adjInsumoRef}>
                  <label className="block text-slate-700 font-medium mb-1">Materia Prima / Carne *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={adjInsumoSearch}
                      onChange={(e) => {
                        setAdjInsumoSearch(e.target.value);
                        setIsAdjInsumoDropdownOpen(true);
                      }}
                      onFocus={() => setIsAdjInsumoDropdownOpen(true)}
                      placeholder="Escribe para buscar carne o insumo..."
                      className="w-full h-8 pl-2.5 pr-7 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white text-xs outline-none"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setIsAdjInsumoDropdownOpen(!isAdjInsumoDropdownOpen)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Menú Desplegable Inteligente */}
                  {isAdjInsumoDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {filteredAdjInsumos.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-400 text-center font-normal">
                          No se encontraron insumos
                        </div>
                      ) : (
                        filteredAdjInsumos.map((i) => {
                          const isSelected = String(i.id) === String(adjInsumoId);
                          return (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() => {
                                setAdjInsumoId(i.id);
                                setAdjInsumoSearch(`${i.nombre} (${i.categoria})`);
                                setIsAdjInsumoDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-orange-50 flex items-center justify-between transition-colors font-normal ${
                                isSelected ? 'bg-orange-50 font-medium text-orange-950' : 'text-slate-700'
                              }`}
                            >
                              <div>
                                <span className="block font-medium text-slate-900">{i.nombre}</span>
                                <span className="text-[10px] text-slate-400">{i.categoria}</span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-orange-600" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Motivo Tipificado *</label>
                  <select
                    value={adjTipo}
                    onChange={(e) => setAdjTipo(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white"
                  >
                    <option value="MERMA_POR_DESCONGELACION">Merma por Descongelación</option>
                    <option value="DETERIORO_CALIDAD">Deterioro de Calidad / Descarte</option>
                    <option value="ERROR_CONTEO_PREVIO">Corrección por Error de Conteo</option>
                    <option value="DONACION_O_DEGUSTACION">Donación o Muestra Comercial</option>
                    <option value="CONSUMO_INTERNO">Consumo Interno / Pruebas</option>
                  </select>
                </div>

                {/* Ubicación y Cantidad */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Ubicación *</label>
                    <select
                      value={adjUbicacion}
                      onChange={(e) => setAdjUbicacion(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white"
                    >
                      <option value="BODEGA_PORCIONADO">Bodega (Und)</option>
                      <option value="BODEGA_ENTERO">Bodega (Kg)</option>
                      <option value="COCINA_PORCIONADO">Cocina (Und)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Cantidad *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={adjCantidad}
                      onChange={(e) => setAdjCantidad(e.target.value)}
                      placeholder="Ej. -2 o 2"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Justificación */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={adjJustificacion}
                  onChange={(e) => setAdjJustificacion(e.target.value)}
                  placeholder="Justificación detallada obligatoria (ej: Pérdida de frío en empaque al vacío, autoriza Administrador)."
                  className="flex-1 h-8 px-3 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
                />
                <button
                  type="submit"
                  disabled={savingAdj}
                  className="px-4 h-8 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm transition-all whitespace-nowrap disabled:opacity-50"
                >
                  {savingAdj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Aplicar Ajuste</span>
                </button>
              </div>
            </form>
          </div>

          {/* 📋 TABLA DIRECTA DE AUDITORÍAS Y AJUSTES CON HEADER PEGAJOSO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Listado de Ajustes y Auditorías Registradas ({ajustesLog.length})</span>
              </h3>
              <span className="text-[11px] text-slate-400">Orden cronológico descendente</span>
            </div>

            <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="relative max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-normal">
                  <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm text-[11px] font-medium text-slate-600 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap">FECHA Y HORA</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">MATERIA PRIMA / CARNE</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">TIPO / MOTIVO DEL AJUSTE</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">CANTIDAD AJUSTADA</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">COSTO / IMPACTO</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">USUARIO</th>
                      <th className="py-2.5 px-3">JUSTIFICACIÓN / OBSERVACIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                    {ajustesLog.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-normal">
                          No hay ajustes manuales ni de auditoría registrados aún en este periodo.
                        </td>
                      </tr>
                    ) : (
                      ajustesLog.map((adj) => {
                        const name = adj.catalogo_insumos?.nombre || adj.insumo_nombre || `Insumo #${adj.insumo_id}`;
                        const timeStr = adj.fecha_hora ? new Date(adj.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                        const isNegative = adj.destino?.includes('MERMA') || adj.observaciones?.includes('-') || adj.merma_kg > 0;

                        return (
                          <tr key={adj.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* Fecha y Hora */}
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-normal">
                              <span className="block font-medium text-slate-900">{adj.fecha}</span>
                              <span className="text-[10px] text-slate-400">{timeStr}</span>
                            </td>

                            {/* Carne */}
                            <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-900">
                              {name}
                            </td>

                            {/* Tipo de Ajuste */}
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-200/80">
                                {adj.tipo_movimiento === 'INVENTARIO_INICIAL' ? '📦 APERTURA INICIAL' : adj.observaciones?.split('|')[0] || 'AJUSTE'}
                              </span>
                            </td>

                            {/* Cantidad */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  isNegative
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {adj.porciones_und ? `${isNegative ? '-' : '+'}${adj.porciones_und} und` : `${isNegative ? '-' : '+'}${(adj.cant_sin_porcionar_kg || 0).toFixed(2)} Kg`}
                              </span>
                            </td>

                            {/* Impacto */}
                            <td className="py-2.5 px-3 text-right font-medium whitespace-nowrap">
                              {adj.valor_total_movimiento ? (
                                <span className={isNegative ? 'text-red-600' : 'text-emerald-700'}>
                                  {isNegative ? '-' : '+'} $ {formatMoney(adj.valor_total_movimiento)}
                                </span>
                              ) : (
                                <span className="text-slate-400">$ 0</span>
                              )}
                            </td>

                            {/* Usuario */}
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>{adj.usuario || 'Administrador'}</span>
                              </span>
                            </td>

                            {/* Justificación */}
                            <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate" title={adj.observaciones}>
                              {adj.observaciones}
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
        </div>
      )}

      {/* 🔒 MODAL CONFIRMACIÓN DE CIERRE DE MES */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title={`Confirmar Cierre de ${currentPeriodo?.nombre}`}
        icon={<Lock className="w-5 h-5 text-amber-600" />}
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5 text-xs font-normal">
          <p className="text-slate-600 leading-relaxed">
            ¿Estás seguro de cerrar el periodo <strong>{currentPeriodo?.nombre}</strong>?
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1 text-amber-900">
            <span className="font-medium block">Acciones automáticas que ejecutará el sistema:</span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
              <li>Sellar el inventario final de {currentPeriodo?.nombre}.</li>
              <li>Ajustar las existencias en base de datos según el conteo físico.</li>
              <li><strong>Crear automáticamente el siguiente mes</strong> con este saldo conciliado como inventario inicial.</li>
            </ul>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Notas u Observaciones de Cierre</label>
            <input
              type="text"
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Ej. Cierre mensual completado con auditoría de cocina y bodega."
              className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCloseModalOpen(false)}
              className="px-4 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={closingPeriod}
              onClick={handleConfirmClosePeriod}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              {closingPeriod ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Confirmar y Cerrar Periodo</span>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
