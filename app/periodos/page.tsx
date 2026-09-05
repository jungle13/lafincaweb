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
  Check,
  Printer,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Info,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';
import { usePeriodo } from '@/context/PeriodoContext';

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

interface AjusteAprobado {
  tipo_ajuste: string;
  justificacion: string;
  usuario: string;
  fecha_ajuste: string;
  dif_entero_kg: number;
  dif_porc_und: number;
  dif_total_kg: number;
  valor_impacto: number;
  final_aprobado_kg: number;
  final_aprobado_und: number;
  final_aprobado_costo: number;
}

export default function PeriodosPage() {
  const { periodos, selectedPeriodoId, setSelectedPeriodoId, refreshPeriodos } = usePeriodo();
  
  const [currentPeriodoData, setCurrentPeriodoData] = useState<any>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [ajustesAprobados, setAjustesAprobados] = useState<Record<string, AjusteAprobado>>({});
  const [ajustesLog, setAjustesLog] = useState<AjusteLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs: 'INICIAL' | 'BALANCE' | 'CONCILIACION' | 'AJUSTES'
  const [activeTab, setActiveTab] = useState<'INICIAL' | 'BALANCE' | 'CONCILIACION' | 'AJUSTES'>('CONCILIACION');
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

  // Tab 3: Modal de Ajuste Individual por Insumo
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<{
    insumo: Insumo;
    stock: StockItem | undefined;
    phys: { bodega_kg: string; bodega_und: string; bodega_porc_kg: string; cocina_und: string; cocina_porc_kg: string };
    difTotalKg: number;
    difPorcUnd: number;
    valorImpacto: number;
    existingAjuste?: AjusteAprobado;
  } | null>(null);
  const [itemAdjustTipo, setItemAdjustTipo] = useState('ERROR_CONTEO_PREVIO');
  const [itemAdjustJustificacion, setItemAdjustJustificacion] = useState('');
  const [savingItemAdjust, setSavingItemAdjust] = useState(false);

  // Tab 3: Modal / Vista de Impresión PDF Acta Oficial
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfFilter, setPdfFilter] = useState<'ALL' | 'WITH_STOCK_BODEGA' | 'WITH_DIFFERENCE'>('WITH_STOCK_BODEGA');
  const [pdfSearchQuery, setPdfSearchQuery] = useState('');
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageSize, setPdfPageSize] = useState<number>(15);

  // Tab 4: Formulario de ajuste manual
  const [adjInsumoId, setAdjInsumoId] = useState('');
  const [adjInsumoSearch, setAdjInsumoSearch] = useState('');
  const [isAdjInsumoDropdownOpen, setIsAdjInsumoDropdownOpen] = useState(false);
  const adjInsumoRef = useRef<HTMLDivElement>(null);

  const [adjTipo, setAdjTipo] = useState('ERROR_CONTEO_PREVIO');
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

  const loadData = async (targetId?: string) => {
    try {
      setLoading(true);
      const idToFetch = targetId || selectedPeriodoId || '';
      const url = idToFetch ? `/api/periodos?periodo_id=${idToFetch}&t=${Date.now()}` : `/api/periodos?t=${Date.now()}`;
      
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      
      if (data.success) {
        const periodObj = data.selectedPeriodo || data.activo;
        setCurrentPeriodoData(periodObj);
        setInsumos(data.insumos || []);
        setStockList(data.stock || []);
        setAjustesAprobados(data.ajustes_aprobados || periodObj?.ajustes_aprobados || {});

        const initialMap: Record<string, any> = {};
        const physMap: Record<string, any> = {};
        const savedInitial = periodObj?.inventario_inicial || {};
        const savedPhysical = data.conteo_cierre_fisico || periodObj?.conteo_cierre_fisico || {};

        (data.insumos || []).forEach((ins: Insumo) => {
          const init = savedInitial[ins.id];
          const stock = (data.stock || []).find((s: StockItem) => s.insumo_id === ins.id);
          const phys = savedPhysical[ins.id];

          initialMap[ins.id] = {
            bodega_kg: init ? String(init.bodega_sin_porc_kg ?? 0) : String(stock?.bodega_sin_porcionar_kg ?? 0),
            bodega_und: init ? String(init.bodega_porc_und ?? 0) : String(stock?.bodega_porcionado_und ?? 0),
            bodega_porc_kg: init ? String(init.bodega_porc_kg ?? 0) : String(stock?.bodega_porcionado_kg ?? 0),
            cocina_und: init ? String(init.cocina_porc_und ?? 0) : String(stock?.cocina_porcionado_und ?? 0),
            cocina_porc_kg: init ? String(init.cocina_porc_kg ?? 0) : String(stock?.cocina_porcionado_kg ?? 0),
          };

          if (phys) {
            physMap[ins.id] = {
              bodega_kg: String(phys.bodega_kg ?? 0),
              bodega_und: String(phys.bodega_und ?? 0),
              bodega_porc_kg: String(phys.bodega_porc_kg ?? 0),
              cocina_und: String(phys.cocina_und ?? 0),
              cocina_porc_kg: String(phys.cocina_porc_kg ?? 0),
            };
          } else {
            physMap[ins.id] = {
              bodega_kg: '0',
              bodega_und: '0',
              bodega_porc_kg: '0',
              cocina_und: '0',
              cocina_porc_kg: '0',
            };
          }
        });

        setInitialForm(initialMap);
        setPhysicalForm(physMap);

        if (data.insumos?.length > 0 && !adjInsumoId) {
          setAdjInsumoId(data.insumos[0].id);
          setAdjInsumoSearch(`${data.insumos[0].nombre} (${data.insumos[0].categoria})`);
        }
      }

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
    if (selectedPeriodoId) {
      loadData(selectedPeriodoId);
    }
  }, [selectedPeriodoId]);

  const currentPeriodo = currentPeriodoData || periodos.find(p => p.id === selectedPeriodoId) || null;

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
      } else if (sortField === 'inicial_bodega') {
        const initA = currentPeriodo?.inventario_inicial?.[a.id];
        const initB = currentPeriodo?.inventario_inicial?.[b.id];
        valA = (initA?.bodega_sin_porc_kg || 0) + (initA?.bodega_porc_kg || 0);
        valB = (initB?.bodega_sin_porc_kg || 0) + (initB?.bodega_porc_kg || 0);
      } else if (sortField === 'stock_bodega') {
        const stA = stockList.find((s) => s.insumo_id === a.id);
        const stB = stockList.find((s) => s.insumo_id === b.id);
        valA = (stA?.bodega_sin_porcionar_kg || 0) + (stA?.bodega_porcionado_kg || 0);
        valB = (stB?.bodega_sin_porcionar_kg || 0) + (stB?.bodega_porcionado_kg || 0);
      } else if (sortField === 'inicial_cocina') {
        const initA = currentPeriodo?.inventario_inicial?.[a.id];
        const initB = currentPeriodo?.inventario_inicial?.[b.id];
        valA = (initA?.cocina_sin_porc_kg || 0) + (initA?.cocina_porc_kg || 0);
        valB = (initB?.cocina_sin_porc_kg || 0) + (initB?.cocina_porc_kg || 0);
      } else if (sortField === 'stock_cocina') {
        const stA = stockList.find((s) => s.insumo_id === a.id);
        const stB = stockList.find((s) => s.insumo_id === b.id);
        valA = (stA?.cocina_sin_porcionar_kg || 0) + (stA?.cocina_porcionado_kg || 0);
        valB = (stB?.cocina_sin_porcionar_kg || 0) + (stB?.cocina_porcionado_kg || 0);
      } else if (sortField === 'valorizado') {
        const stA = stockList.find((s) => s.insumo_id === a.id);
        const stB = stockList.find((s) => s.insumo_id === b.id);
        const totKgA = (stA?.bodega_sin_porcionar_kg || 0) + (stA?.bodega_porcionado_kg || 0) + (stA?.cocina_sin_porcionar_kg || 0) + (stA?.cocina_porcionado_kg || 0);
        const totKgB = (stB?.bodega_sin_porcionar_kg || 0) + (stB?.bodega_porcionado_kg || 0) + (stB?.cocina_sin_porcionar_kg || 0) + (stB?.cocina_porcionado_kg || 0);
        valA = totKgA * (a.costo_unitario_kg || 0);
        valB = totKgB * (b.costo_unitario_kg || 0);
      } else if (sortField === 'dif_kg') {
        const stA = stockList.find((s) => s.insumo_id === a.id);
        const stB = stockList.find((s) => s.insumo_id === b.id);
        const phA = physicalForm[a.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
        const phB = physicalForm[b.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
        const teoA = (stA?.bodega_sin_porcionar_kg || 0) + (stA?.bodega_porcionado_kg || 0) + (stA?.cocina_sin_porcionar_kg || 0) + (stA?.cocina_porcionado_kg || 0);
        const teoB = (stB?.bodega_sin_porcionar_kg || 0) + (stB?.bodega_porcionado_kg || 0) + (stB?.cocina_sin_porcionar_kg || 0) + (stB?.cocina_porcionado_kg || 0);
        const fisA = (parseFloat(phA.bodega_kg) || 0) + (parseFloat(phA.bodega_porc_kg) || 0) + ((parseInt(phA.cocina_und) || 0) * (a.peso_estandar_porcion_kg || 0.35));
        const fisB = (parseFloat(phB.bodega_kg) || 0) + (parseFloat(phB.bodega_porc_kg) || 0) + ((parseInt(phB.cocina_und) || 0) * (b.peso_estandar_porcion_kg || 0.35));
        valA = fisA - teoA;
        valB = fisB - teoB;
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
  }, [filteredInsumos, sortField, sortAsc, initialForm, physicalForm, currentPeriodo, stockList]);

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

  // Resumen global de conciliación para métricas
  const reconciliationSummary = useMemo(() => {
    let totTeoricoKg = 0;
    let totTeoricoValor = 0;
    let totFisicoKg = 0;
    let totFisicoValor = 0;
    let totDifKg = 0;
    let totDifValor = 0;
    let totAprobadoKg = 0;
    let totAprobadoValor = 0;

    insumos.forEach((ins) => {
      const stock = stockList.find((s) => s.insumo_id === ins.id);
      const phys = physicalForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
      const pesoStd = ins.peso_estandar_porcion_kg || 0.35;
      const costo = ins.costo_unitario_kg || 0;

      const teoKg = (stock?.bodega_sin_porcionar_kg || 0) + (stock?.bodega_porcionado_kg || 0) + (stock?.cocina_sin_porcionar_kg || 0) + (stock?.cocina_porcionado_kg || 0);
      const fisKg = (parseFloat(phys.bodega_kg) || 0) + (parseFloat(phys.bodega_porc_kg) || ((parseInt(phys.bodega_und) || 0) * pesoStd)) + ((parseInt(phys.cocina_und) || 0) * pesoStd);
      const difKg = fisKg - teoKg;

      totTeoricoKg += teoKg;
      totTeoricoValor += teoKg * costo;
      totFisicoKg += fisKg;
      totFisicoValor += fisKg * costo;
      totDifKg += difKg;
      totDifValor += difKg * costo;

      const ajuste = ajustesAprobados[ins.id];
      const apKg = ajuste ? ajuste.final_aprobado_kg : (currentPeriodo?.estado === 'CERRADO' ? fisKg : teoKg);
      totAprobadoKg += apKg;
      totAprobadoValor += apKg * costo;
    });

    return {
      totTeoricoKg,
      totTeoricoValor,
      totFisicoKg,
      totFisicoValor,
      totDifKg,
      totDifValor,
      totAprobadoKg,
      totAprobadoValor,
    };
  }, [insumos, stockList, physicalForm, ajustesAprobados, currentPeriodo]);

  // Lista Filtrada y Paginada para el Modal de PDF / Acta Oficial
  const pdfFilteredInsumos = useMemo(() => {
    return insumos.filter((ins) => {
      const stock = stockList.find((s) => s.insumo_id === ins.id);
      const phys = physicalForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
      const pesoStd = ins.peso_estandar_porcion_kg || 0.35;

      const teoEntKg = stock?.bodega_sin_porcionar_kg || 0;
      const teoBUnd = stock?.bodega_porcionado_und || 0;
      const teoBPorcKg = stock?.bodega_porcionado_kg || (teoBUnd * pesoStd);
      const teoCUnd = stock?.cocina_porcionado_und || 0;
      const teoCPorcKg = stock?.cocina_porcionado_kg || (teoCUnd * pesoStd);
      const teoKg = teoEntKg + teoBPorcKg + teoCPorcKg;

      const fisEntKg = parseFloat(phys.bodega_kg) || 0;
      const fisBUnd = parseInt(phys.bodega_und) || 0;
      const fisBPorcKg = parseFloat(phys.bodega_porc_kg) || (fisBUnd * pesoStd);
      const fisCUnd = parseInt(phys.cocina_und) || 0;
      const fisCPorcKg = fisCUnd * pesoStd;
      const fisKg = fisEntKg + fisBPorcKg + fisCPorcKg;

      const difKg = fisKg - teoKg;

      // Filtro de Stock en Bodega (Kg o Und > 0 en físico o teórico)
      if (pdfFilter === 'WITH_STOCK_BODEGA') {
        const hasBodega = fisEntKg > 0 || fisBUnd > 0 || fisBPorcKg > 0 || teoEntKg > 0 || teoBUnd > 0;
        if (!hasBodega) return false;
      } else if (pdfFilter === 'WITH_DIFFERENCE') {
        if (Math.abs(difKg) < 0.01) return false;
      }

      // Buscador
      if (pdfSearchQuery.trim()) {
        const q = normalizeStr(pdfSearchQuery);
        if (!normalizeStr(ins.nombre).includes(q) && !normalizeStr(ins.codigo || '').includes(q) && !normalizeStr(ins.categoria || '').includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [insumos, stockList, physicalForm, pdfFilter, pdfSearchQuery]);

  const totalPdfPages = Math.ceil(pdfFilteredInsumos.length / (pdfPageSize === 999 ? 999999 : pdfPageSize)) || 1;

  const pdfPaginatedInsumos = useMemo(() => {
    if (pdfPageSize === 999) return pdfFilteredInsumos;
    const start = (pdfPage - 1) * pdfPageSize;
    return pdfFilteredInsumos.slice(start, start + pdfPageSize);
  }, [pdfFilteredInsumos, pdfPage, pdfPageSize]);

  // Resumen del Acta según el filtro actual
  const pdfFilteredSummary = useMemo(() => {
    let tTeoKg = 0, tTeoVal = 0, tFisKg = 0, tFisVal = 0, tDifKg = 0, tDifVal = 0, tApKg = 0, tApVal = 0;
    pdfFilteredInsumos.forEach((ins) => {
      const stock = stockList.find((s) => s.insumo_id === ins.id);
      const phys = physicalForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
      const pesoStd = ins.peso_estandar_porcion_kg || 0.35;
      const costo = ins.costo_unitario_kg || 0;

      const teoKg = (stock?.bodega_sin_porcionar_kg || 0) + (stock?.bodega_porcionado_kg || 0) + (stock?.cocina_sin_porcionar_kg || 0) + (stock?.cocina_porcionado_kg || 0);
      const fisKg = (parseFloat(phys.bodega_kg) || 0) + (parseFloat(phys.bodega_porc_kg) || ((parseInt(phys.bodega_und) || 0) * pesoStd)) + ((parseInt(phys.cocina_und) || 0) * pesoStd);
      const difKg = fisKg - teoKg;

      tTeoKg += teoKg;
      tTeoVal += teoKg * costo;
      tFisKg += fisKg;
      tFisVal += fisKg * costo;
      tDifKg += difKg;
      tDifVal += difKg * costo;

      const ajuste = ajustesAprobados[ins.id];
      const apKg = ajuste ? ajuste.final_aprobado_kg : (currentPeriodo?.estado === 'CERRADO' ? fisKg : teoKg);
      tApKg += apKg;
      tApVal += apKg * costo;
    });

    return { tTeoKg, tTeoVal, tFisKg, tFisVal, tDifKg, tDifVal, tApKg, tApVal };
  }, [pdfFilteredInsumos, stockList, physicalForm, ajustesAprobados, currentPeriodo]);

  // Reset page when filter changes
  useEffect(() => {
    setPdfPage(1);
  }, [pdfFilter, pdfSearchQuery, pdfPageSize]);

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
      await refreshPeriodos();
      await loadData(currentPeriodo.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingInitial(false);
    }
  };

  // Abrir Modal de Ajuste Individual
  const handleOpenItemAdjust = (ins: Insumo) => {
    const stock = stockList.find((s) => s.insumo_id === ins.id);
    const phys = physicalForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
    const pesoStd = ins.peso_estandar_porcion_kg || 0.35;
    const costo = ins.costo_unitario_kg || 0;

    const teoEnteroKg = stock?.bodega_sin_porcionar_kg || 0;
    const teoPorcUnd = stock?.bodega_porcionado_und || 0;
    const teoPorcKg = stock?.bodega_porcionado_kg || (teoPorcUnd * pesoStd);
    const teoCocinaUnd = stock?.cocina_porcionado_und || 0;
    const teoCocinaKg = stock?.cocina_porcionado_kg || (teoCocinaUnd * pesoStd);
    const teoTotalKg = teoEnteroKg + teoPorcKg + teoCocinaKg;

    const fisEnteroKg = parseFloat(phys.bodega_kg) || 0;
    const fisPorcUnd = parseInt(phys.bodega_und) || 0;
    const fisPorcKg = parseFloat(phys.bodega_porc_kg) || (fisPorcUnd * pesoStd);
    const fisCocinaUnd = parseInt(phys.cocina_und) || 0;
    const fisCocinaKg = fisCocinaUnd * pesoStd;
    const fisTotalKg = fisEnteroKg + fisPorcKg + fisCocinaKg;

    const difTotalKg = fisTotalKg - teoTotalKg;
    const difPorcUnd = (fisPorcUnd + fisCocinaUnd) - (teoPorcUnd + teoCocinaUnd);
    const valorImpacto = Math.abs(difTotalKg) * costo;

    const existingAjuste = ajustesAprobados[ins.id];

    setSelectedAdjustItem({
      insumo: ins,
      stock,
      phys,
      difTotalKg,
      difPorcUnd,
      valorImpacto,
      existingAjuste,
    });

    if (existingAjuste) {
      setItemAdjustTipo(existingAjuste.tipo_ajuste || 'ERROR_CONTEO_PREVIO');
      setItemAdjustJustificacion(existingAjuste.justificacion || 'Corrección por conteo');
    } else {
      setItemAdjustTipo('ERROR_CONTEO_PREVIO');
      setItemAdjustJustificacion('Corrección por conteo');
    }

    setIsAdjustModalOpen(true);
  };

  // Guardar Ajuste Individual
  const handleSaveItemAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjustItem || !currentPeriodo) return;

    setSavingItemAdjust(true);
    try {
      const { insumo, phys, stock } = selectedAdjustItem;
      const res = await fetch('/api/periodos/ajustar-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo_id: currentPeriodo.id,
          insumo_id: insumo.id,
          tipo_ajuste: itemAdjustTipo,
          justificacion: itemAdjustJustificacion.trim(),
          fisico: phys,
          teorico: stock || {},
          usuario: 'Administrador (Auditoría)',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al aplicar ajuste');

      alert(`✅ Ajuste para ${insumo.nombre} aprobado y aplicado con éxito.`);
      setIsAdjustModalOpen(false);
      await loadData(currentPeriodo.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingItemAdjust(false);
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
      await refreshPeriodos();
      await loadData(data.next.id);
      setSelectedPeriodoId(data.next.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClosingPeriod(false);
    }
  };

  // Manejar Ajuste Manual Tab 4
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
      await loadData(currentPeriodo?.id);
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
              <span className="font-semibold text-blue-900 block">
                📋 Conteo de Apertura del Periodo: {currentPeriodo?.nombre}
              </span>
              <p className="text-blue-700 leading-relaxed font-normal">
                Cantidades de apertura fijadas: <strong>Bodega Entero (Kg)</strong>, <strong>Bodega Porciones (Und y su Peso Real Kg)</strong> y <strong>Cocina Porciones</strong>. Los valores ingresados fijan el inventario base del mes.
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

          {/* Tabla de Conteo Inicial */}
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
              <span className="text-sm font-semibold text-slate-900 block">{currentPeriodo?.nombre}</span>
              <span className="text-[10px] text-slate-400">{currentPeriodo?.fecha_inicio} a {currentPeriodo?.fecha_fin}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-500 font-normal uppercase">Stock Bodega</span>
              <span className="text-base font-semibold text-amber-700 block">
                {stockList.reduce((sum, s) => sum + (s.bodega_sin_porcionar_kg || 0), 0).toFixed(2)} Kg Entero
              </span>
              <span className="text-[11px] text-purple-700 font-medium block">
                {stockList.reduce((sum, s) => sum + (s.bodega_porcionado_und || 0), 0)} und ({stockList.reduce((sum, s) => sum + (s.bodega_porcionado_kg || 0), 0).toFixed(2)} Kg) Porc.
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-500 font-normal uppercase">Stock Cocina (Acumulado)</span>
              <span className="text-base font-semibold text-orange-700 block">
                {stockList.reduce((sum, s) => sum + (s.cocina_sin_porcionar_kg || 0), 0).toFixed(2)} Kg Entero
              </span>
              <span className="text-[11px] text-orange-800 font-medium block">
                {stockList.reduce((sum, s) => sum + (s.cocina_porcionado_und || 0), 0)} und ({stockList.reduce((sum, s) => sum + (s.cocina_porcionado_kg || 0), 0).toFixed(2)} Kg) Porc.
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-500 font-normal uppercase">Valorización Total Teórica</span>
              <span className="text-base font-semibold text-emerald-700 block">
                $ {formatMoney(stockList.reduce((sum, s) => {
                  const ins = insumos.find(i => i.id === s.insumo_id);
                  const totalKg = (s.bodega_sin_porcionar_kg || 0) + (s.bodega_porcionado_kg || 0) + (s.cocina_sin_porcionar_kg || 0) + (s.cocina_porcionado_kg || 0);
                  return sum + (totalKg * (ins?.costo_unitario_kg || 0));
                }, 0))}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Bodega + Cocina acumulado</span>
            </div>
          </div>

          {/* Tabla de Balance */}
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
                    <th onClick={() => handleSort('inicial_bodega')} className="py-2.5 px-3 text-center whitespace-nowrap bg-amber-50/60 cursor-pointer hover:bg-amber-100 select-none group">
                      <div className="flex items-center justify-center gap-1">
                        <span>INICIAL BODEGA</span>
                        {renderSortIcon('inicial_bodega')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('stock_bodega')} className="py-2.5 px-3 text-center whitespace-nowrap bg-purple-50/60 cursor-pointer hover:bg-purple-100 select-none group">
                      <div className="flex items-center justify-center gap-1">
                        <span>STOCK ACTUAL BODEGA</span>
                        {renderSortIcon('stock_bodega')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('inicial_cocina')} className="py-2.5 px-3 text-center whitespace-nowrap bg-orange-50/60 cursor-pointer hover:bg-orange-100 select-none group">
                      <div className="flex items-center justify-center gap-1">
                        <span>INICIAL COCINA</span>
                        {renderSortIcon('inicial_cocina')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('stock_cocina')} className="py-2.5 px-3 text-center whitespace-nowrap bg-orange-100/60 cursor-pointer hover:bg-orange-200 select-none group">
                      <div className="flex items-center justify-center gap-1">
                        <span>STOCK ACTUAL COCINA</span>
                        {renderSortIcon('stock_cocina')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('valorizado')} className="py-2.5 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none group">
                      <div className="flex items-center justify-end gap-1">
                        <span>VALORIZADO ACTUAL</span>
                        {renderSortIcon('valorizado')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                  {sortedInsumos.map((ins) => {
                    const init = currentPeriodo?.inventario_inicial?.[ins.id];
                    const stock = stockList.find((s) => s.insumo_id === ins.id);
                    
                    const bKg = stock?.bodega_sin_porcionar_kg || 0;
                    const bPorcUnd = stock?.bodega_porcionado_und || 0;
                    const bPorcKg = stock?.bodega_porcionado_kg || 0;

                    const cKg = stock?.cocina_sin_porcionar_kg || 0;
                    const cPorcUnd = stock?.cocina_porcionado_und || 0;
                    const cPorcKg = stock?.cocina_porcionado_kg || 0;

                    const totalKg = bKg + bPorcKg + cKg + cPorcKg;
                    const valor = totalKg * (ins.costo_unitario_kg || 0);

                    // Inicial Bodega
                    const initBKg = init?.bodega_sin_porc_kg || 0;
                    const initBUnd = init?.bodega_porc_und || 0;
                    const initBPorcKg = init?.bodega_porc_kg || 0;

                    // Inicial Cocina
                    const initCKg = init?.cocina_sin_porc_kg || 0;
                    const initCUnd = init?.cocina_porc_und || 0;
                    const initCPorcKg = init?.cocina_porc_kg || 0;

                    return (
                      <tr key={ins.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {ins.nombre}
                          <span className="text-[10px] text-slate-400 block font-normal">{ins.categoria}</span>
                        </td>
                        
                        {/* INICIAL BODEGA */}
                        <td className="py-2 px-3 text-center text-slate-600 bg-amber-50/20">
                          {initBKg > 0 && <span>{initBKg.toFixed(1)} Kg</span>}
                          {initBKg > 0 && initBUnd > 0 && <span className="text-slate-400"> / </span>}
                          {initBUnd > 0 && <span>{initBUnd} und ({initBPorcKg.toFixed(2)} Kg)</span>}
                          {initBKg === 0 && initBUnd === 0 && <span className="text-slate-300">0</span>}
                        </td>

                        {/* STOCK ACTUAL BODEGA */}
                        <td className="py-2 px-3 text-center font-medium text-slate-900 bg-purple-50/20">
                          {bKg !== 0 && <span className="text-amber-800">{bKg.toFixed(2)} Kg</span>}
                          {bKg !== 0 && bPorcUnd !== 0 && <span className="text-slate-400"> / </span>}
                          {bPorcUnd !== 0 && <span className="text-purple-900">{bPorcUnd} und ({bPorcKg.toFixed(2)} Kg)</span>}
                          {bKg === 0 && bPorcUnd === 0 && <span className="text-slate-300">0</span>}
                        </td>

                        {/* INICIAL COCINA */}
                        <td className="py-2 px-3 text-center text-slate-600 bg-orange-50/20">
                          {initCKg > 0 && <span>{initCKg.toFixed(1)} Kg</span>}
                          {initCKg > 0 && initCUnd > 0 && <span className="text-slate-400"> / </span>}
                          {initCUnd > 0 && <span>{initCUnd} und ({initCPorcKg.toFixed(2)} Kg)</span>}
                          {initCKg === 0 && initCUnd === 0 && <span className="text-slate-300">0</span>}
                        </td>

                        {/* STOCK ACTUAL COCINA */}
                        <td className="py-2 px-3 text-center font-medium bg-orange-100/20">
                          {cKg !== 0 && <span className="text-amber-800">{cKg.toFixed(2)} Kg</span>}
                          {cKg !== 0 && cPorcUnd !== 0 && <span className="text-slate-400"> / </span>}
                          {cPorcUnd !== 0 && <span className="text-orange-700">{cPorcUnd} und ({cPorcKg.toFixed(2)} Kg)</span>}
                          {cKg === 0 && cPorcUnd === 0 && <span className="text-slate-300">0</span>}
                        </td>

                        {/* VALORIZADO */}
                        <td className="py-2 px-3 text-right font-semibold text-slate-900">
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

      {/* ⚖️ PESTAÑA 3: CONCILIACIÓN Y CIERRE DE MES (FOTO REAL, AJUSTES Y VALORES APROBADOS) */}
      {activeTab === 'CONCILIACION' && (
        <div className="space-y-4">
          {/* Tarjetas KPI de Auditoría y Conciliación */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-500 font-medium uppercase block">Teórico Sistema ({currentPeriodo?.nombre})</span>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-slate-900">$ {formatMoney(reconciliationSummary.totTeoricoValor)}</span>
                <span className="text-xs font-semibold text-slate-600">{reconciliationSummary.totTeoricoKg.toFixed(1)} Kg</span>
              </div>
              <p className="text-[10px] text-slate-400">Calculado según compras, traslados y porcionados</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-purple-700 font-medium uppercase block">Conteo Físico Real Auditado</span>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-purple-950">$ {formatMoney(reconciliationSummary.totFisicoValor)}</span>
                <span className="text-xs font-semibold text-purple-800">{reconciliationSummary.totFisicoKg.toFixed(1)} Kg</span>
              </div>
              <p className="text-[10px] text-purple-600/70">Pesado físico en báscula al cierre</p>
            </div>

            <div className={`p-3.5 rounded-xl border shadow-sm space-y-1 ${
              reconciliationSummary.totDifValor < 0
                ? 'bg-red-50/50 border-red-200'
                : 'bg-emerald-50/50 border-emerald-200'
            }`}>
              <span className={`text-[11px] font-medium uppercase block ${
                reconciliationSummary.totDifValor < 0 ? 'text-red-700' : 'text-emerald-700'
              }`}>
                Merma / Descuadre Neto
              </span>
              <div className="flex items-baseline justify-between">
                <span className={`text-base font-bold ${reconciliationSummary.totDifValor < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {reconciliationSummary.totDifValor < 0 ? '-' : '+'} $ {formatMoney(Math.abs(reconciliationSummary.totDifValor))}
                </span>
                <span className={`text-xs font-semibold ${reconciliationSummary.totDifValor < 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                  {reconciliationSummary.totDifKg < 0 ? '' : '+'}{reconciliationSummary.totDifKg.toFixed(1)} Kg
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Diferencia entre Físico y Teórico</p>
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-300 font-medium uppercase">Total Final Aprobado</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  {Object.keys(ajustesAprobados).length} Ajustes
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-amber-400">$ {formatMoney(reconciliationSummary.totAprobadoValor)}</span>
                <span className="text-xs font-semibold text-slate-200">{reconciliationSummary.totAprobadoKg.toFixed(1)} Kg</span>
              </div>
              <p className="text-[10px] text-slate-400">Saldo oficial conciliado para apertura</p>
            </div>
          </div>

          {/* Barra de Acciones y Filtros */}
          <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-950 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-600" /> Foto de Conciliación: {currentPeriodo?.nombre}
              </span>
              <span className="text-amber-800 hidden md:inline font-normal">
                (Teórico Sistema intacto vs Conteo Físico en Inputs)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Botón Exportar PDF */}
              <button
                type="button"
                onClick={() => {
                  setPdfFilter('WITH_STOCK_BODEGA');
                  setPdfSearchQuery('');
                  setPdfPage(1);
                  setIsPdfModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 active:scale-95 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                <span>Exportar PDF de Cierre</span>
              </button>

              {/* Botón Cerrar Periodo */}
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(true)}
                disabled={currentPeriodo?.estado === 'CERRADO'}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentPeriodo?.estado === 'CERRADO' ? 'Periodo Cerrado' : `Cerrar ${currentPeriodo?.nombre}`}</span>
              </button>
            </div>
          </div>

          {/* Filtro Rápido */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar insumo o corte en conciliación..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 font-normal"
              />
            </div>
            <div className="text-[11px] text-slate-500 font-normal">
              Mostrando <strong>{sortedInsumos.length}</strong> materias primas
            </div>
          </div>

          {/* Tabla Maestra de Conciliación */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="relative max-h-[calc(100vh-270px)] overflow-y-auto overflow-x-auto">
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

                    {/* TEÓRICO SISTEMA (INTACTO) */}
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap bg-slate-100/70">TEÓRICO ENTERO (KG)</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap bg-slate-100/70">TEÓRICO BODEGA PORC.</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap bg-slate-100/70">TEÓRICO COCINA (UND)</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap bg-slate-200/70 font-semibold">TOTAL TEÓRICO (KG)</th>

                    {/* FÍSICO REAL AUDITADO (INPUTS) */}
                    <th className="py-2.5 px-2.5 text-center bg-amber-50/90 whitespace-nowrap">FÍSICO ENTERO (KG)</th>
                    <th className="py-2.5 px-2.5 text-center bg-purple-50/90 whitespace-nowrap">FÍSICO PORC. (UND)</th>
                    <th className="py-2.5 px-2.5 text-center bg-purple-100/90 whitespace-nowrap">FÍSICO PORC. (KG)</th>
                    <th className="py-2.5 px-2.5 text-center bg-orange-50/90 whitespace-nowrap">FÍSICO COCINA (UND)</th>

                    {/* DIFERENCIAS Y COSTO */}
                    <th onClick={() => handleSort('dif_kg')} className="py-2.5 px-2.5 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none group">
                      <div className="flex items-center justify-center gap-1">
                        <span>DIFERENCIA (KG/UND)</span>
                        {renderSortIcon('dif_kg')}
                      </div>
                    </th>
                    <th className="py-2.5 px-2.5 text-right whitespace-nowrap">COSTO DESCUADRE</th>

                    {/* ACCIÓN / AJUSTE */}
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap bg-amber-100/60 font-semibold">ACCIÓN AJUSTE</th>

                    {/* VALORES FINALES APROBADOS */}
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap bg-slate-900 text-white">KG APROBADOS</th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap bg-slate-900 text-white">PORC. APROBADAS</th>
                    <th className="py-2.5 px-2.5 text-right whitespace-nowrap bg-slate-900 text-amber-400">VALOR APROBADO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                  {sortedInsumos.map((ins) => {
                    const stock = stockList.find((s) => s.insumo_id === ins.id);
                    const phys = physicalForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
                    const pesoStd = ins.peso_estandar_porcion_kg || 0.35;
                    const costoUnit = ins.costo_unitario_kg || 0;

                    // Teórico
                    const teoricoEnteroKg = stock?.bodega_sin_porcionar_kg || 0;
                    const teoricoPorcUnd = stock?.bodega_porcionado_und || 0;
                    const teoricoPorcKg = stock?.bodega_porcionado_kg || (teoricoPorcUnd * pesoStd);
                    const teoricoCocinaUnd = stock?.cocina_porcionado_und || 0;
                    const teoricoCocinaKg = stock?.cocina_porcionado_kg || (teoricoCocinaUnd * pesoStd);
                    const teoricoTotalKg = teoricoEnteroKg + teoricoPorcKg + teoricoCocinaKg;

                    // Físico
                    const fisicoEnteroKg = parseFloat(phys.bodega_kg) || 0;
                    const fisicoPorcUnd = parseInt(phys.bodega_und) || 0;
                    const fisicoPorcKg = parseFloat(phys.bodega_porc_kg) || (fisicoPorcUnd * pesoStd);
                    const fisicoCocinaUnd = parseInt(phys.cocina_und) || 0;
                    const fisicoCocinaKg = fisicoCocinaUnd * pesoStd;
                    const fisicoTotalKg = fisicoEnteroKg + fisicoPorcKg + fisicoCocinaKg;

                    // Diferencias
                    const difEnteroKg = fisicoEnteroKg - teoricoEnteroKg;
                    const difPorcUnd = (fisicoPorcUnd + fisicoCocinaUnd) - (teoricoPorcUnd + teoricoCocinaUnd);
                    const difTotalKg = fisicoTotalKg - teoricoTotalKg;
                    const costoMerma = difTotalKg * costoUnit;

                    // Ajuste Aprobado (si existe)
                    const ajuste = ajustesAprobados[ins.id];
                    const hasDifference = Math.abs(difTotalKg) >= 0.01;

                    // Valores finales aprobados
                    const finalKg = ajuste ? ajuste.final_aprobado_kg : (currentPeriodo?.estado === 'CERRADO' ? fisicoTotalKg : (hasDifference ? fisicoTotalKg : teoricoTotalKg));
                    const finalUnd = ajuste ? ajuste.final_aprobado_und : (currentPeriodo?.estado === 'CERRADO' ? (fisicoPorcUnd + fisicoCocinaUnd) : (hasDifference ? (fisicoPorcUnd + fisicoCocinaUnd) : (teoricoPorcUnd + teoricoCocinaUnd)));
                    const finalCosto = ajuste ? ajuste.final_aprobado_costo : (finalKg * costoUnit);

                    const isClosed = currentPeriodo?.estado === 'CERRADO';

                    return (
                      <tr key={ins.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Nombre */}
                        <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                          {ins.nombre}
                          <div className="text-[10px] text-slate-400 font-normal">
                            {ins.categoria} • ${formatMoney(costoUnit)}/kg
                          </div>
                        </td>

                        {/* Teórico Entero Kg */}
                        <td className="py-2 px-2.5 text-center text-slate-600 bg-slate-50/40">
                          {teoricoEnteroKg > 0 ? `${teoricoEnteroKg.toFixed(2)} Kg` : <span className="text-slate-300">0</span>}
                        </td>

                        {/* Teórico Porciones */}
                        <td className="py-2 px-2.5 text-center text-slate-600 bg-slate-50/40">
                          {teoricoPorcUnd > 0 ? (
                            <span>{teoricoPorcUnd} u <span className="text-[10px] text-slate-400">({teoricoPorcKg.toFixed(1)}k)</span></span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Teórico Cocina */}
                        <td className="py-2 px-2.5 text-center text-orange-700 bg-slate-50/40 font-medium">
                          {teoricoCocinaUnd > 0 ? `${teoricoCocinaUnd} u` : <span className="text-slate-300">0</span>}
                        </td>

                        {/* Total Teórico Kg */}
                        <td className="py-2 px-2.5 text-center font-bold text-slate-800 bg-slate-100/50">
                          {teoricoTotalKg.toFixed(2)} Kg
                        </td>

                        {/* FÍSICO: Bodega Entero Kg (Input) */}
                        <td className="py-2 px-2 text-center bg-amber-50/20">
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
                            className="w-16 h-7 text-center rounded border border-slate-300 focus:border-amber-500 font-medium text-slate-900 bg-white"
                          />
                        </td>

                        {/* FÍSICO: Bodega Porciones Und (Input) */}
                        <td className="py-2 px-2 text-center bg-purple-50/20">
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
                            className="w-14 h-7 text-center rounded border border-slate-300 focus:border-purple-500 font-medium text-purple-950 bg-white"
                          />
                        </td>

                        {/* FÍSICO: Bodega Porciones Kg Real (Input) */}
                        <td className="py-2 px-2 text-center bg-purple-100/20">
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
                            className="w-16 h-7 text-center rounded border border-purple-300 focus:border-purple-500 font-medium text-purple-950 bg-white"
                            title="Peso real en báscula"
                          />
                        </td>

                        {/* FÍSICO: Cocina Porciones Und (Input) */}
                        <td className="py-2 px-2 text-center bg-orange-50/20">
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
                            className="w-14 h-7 text-center rounded border border-orange-300 focus:border-orange-500 font-medium text-orange-950 bg-white"
                          />
                        </td>

                        {/* DIFERENCIA */}
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold inline-block ${
                              !hasDifference
                                ? 'bg-slate-100 text-slate-500'
                                : difTotalKg < 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {hasDifference ? (
                              <>
                                {difTotalKg > 0 ? '+' : ''}{difTotalKg.toFixed(2)} Kg
                                {difPorcUnd !== 0 && <span className="text-[10px] font-normal block">({difPorcUnd > 0 ? '+' : ''}{difPorcUnd} u)</span>}
                              </>
                            ) : (
                              '0.00 Kg'
                            )}
                          </span>
                        </td>

                        {/* COSTO MERMA / DESCUADRE */}
                        <td className="py-2 px-2.5 text-right font-medium whitespace-nowrap">
                          {costoMerma < -50 ? (
                            <span className="text-red-600 font-semibold">- $ {formatMoney(Math.abs(costoMerma))}</span>
                          ) : costoMerma > 50 ? (
                            <span className="text-emerald-600 font-semibold">+ $ {formatMoney(costoMerma)}</span>
                          ) : (
                            <span className="text-slate-400">$ 0</span>
                          )}
                        </td>

                        {/* BOTÓN ACCIÓN DE AJUSTE */}
                        <td className="py-2 px-2.5 text-center whitespace-nowrap bg-amber-50/30">
                          {ajuste ? (
                            <button
                              type="button"
                              onClick={() => handleOpenItemAdjust(ins)}
                              className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded-md text-[11px] font-medium inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                              title={`Ajustado por ${ajuste.usuario || 'Auditor'}: ${ajuste.tipo_ajuste} (${ajuste.justificacion})`}
                            >
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>✅ Ajustado</span>
                            </button>
                          ) : hasDifference ? (
                            <button
                              type="button"
                              onClick={() => handleOpenItemAdjust(ins)}
                              className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-[11px] font-medium inline-flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                            >
                              <Wrench className="w-3 h-3" />
                              <span>🛠️ Ajustar</span>
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-medium inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-slate-400" /> Cuadrado
                            </span>
                          )}
                        </td>

                        {/* VALORES FINALES APROBADOS */}
                        <td className="py-2 px-2.5 text-center font-bold text-slate-900 bg-slate-50">
                          {finalKg.toFixed(2)} Kg
                        </td>
                        <td className="py-2 px-2.5 text-center font-semibold text-slate-800 bg-slate-50">
                          {finalUnd} und
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-slate-900 bg-slate-50">
                          $ {formatMoney(finalCosto)}
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
          {/* Formulario Superior de Registro de Ajuste */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
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
                    <option value="ERROR_CONTEO_PREVIO">Corrección por Error de Conteo</option>
                    <option value="CONSUMO_COCINA">Consumo en Cocina / Ventas no descargadas</option>
                    <option value="MERMA_POR_DESCONGELACION">Merma por Descongelación / Porcionado</option>
                    <option value="DETERIORO_CALIDAD">Deterioro de Calidad / Descarte</option>
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
                  placeholder="Justificación detallada obligatoria (ej: Corrección por conteo)."
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

          {/* Listado de Auditorías y Ajustes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
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
                        const isNegative = adj.destino?.includes('MERMA') || adj.observaciones?.includes('-') || adj.merma_kg > 0 || (adj.cant_sin_porcionar_kg < 0);

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

      {/* 🛠️ MODAL DE AJUSTE INDIVIDUAL POR INSUMO */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Ajuste y Aprobación de Conciliación: ${selectedAdjustItem?.insumo.nombre || ''}`}
        icon={<Wrench className="w-5 h-5 text-orange-600" />}
        maxWidth="max-w-lg"
      >
        {selectedAdjustItem && (
          <form onSubmit={handleSaveItemAdjust} className="space-y-4 text-xs font-normal">
            {/* Resumen Comparativo del Insumo */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="font-semibold text-slate-900 text-sm">
                  {selectedAdjustItem.insumo.nombre}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Costo: <strong>${formatMoney(selectedAdjustItem.insumo.costo_unitario_kg)}/kg</strong>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Stock Teórico</span>
                  <span className="text-xs font-bold text-slate-800">
                    {((selectedAdjustItem.stock?.bodega_sin_porcionar_kg || 0) + (selectedAdjustItem.stock?.bodega_porcionado_kg || 0) + (selectedAdjustItem.stock?.cocina_sin_porcionar_kg || 0) + (selectedAdjustItem.stock?.cocina_porcionado_kg || 0)).toFixed(2)} Kg
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-purple-200">
                  <span className="text-[10px] text-purple-600 block uppercase font-medium">Conteo Físico</span>
                  <span className="text-xs font-bold text-purple-950">
                    {((parseFloat(selectedAdjustItem.phys.bodega_kg) || 0) + (parseFloat(selectedAdjustItem.phys.bodega_porc_kg) || 0) + ((parseInt(selectedAdjustItem.phys.cocina_und) || 0) * (selectedAdjustItem.insumo.peso_estandar_porcion_kg || 0.35))).toFixed(2)} Kg
                  </span>
                </div>
                <div className={`p-2 rounded-lg border ${
                  selectedAdjustItem.difTotalKg < 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  <span className="text-[10px] block uppercase font-medium">Diferencia Neta</span>
                  <span className="text-xs font-bold">
                    {selectedAdjustItem.difTotalKg > 0 ? '+' : ''}{selectedAdjustItem.difTotalKg.toFixed(2)} Kg
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 px-1">
                <span className="text-slate-500 font-medium">Impacto Financiero del Descuadre:</span>
                <span className={`font-bold ${selectedAdjustItem.difTotalKg < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {selectedAdjustItem.difTotalKg < 0 ? '-' : '+'} $ {formatMoney(selectedAdjustItem.valorImpacto)} COP
                </span>
              </div>
            </div>

            {/* Motivo Tipificado */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Motivo Tipificado de la Conciliación *
              </label>
              <select
                value={itemAdjustTipo}
                onChange={(e) => setItemAdjustTipo(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white font-medium outline-none"
              >
                <option value="ERROR_CONTEO_PREVIO">🔍 Corrección por Error de Conteo Previo</option>
                <option value="CONSUMO_COCINA">🍳 Consumo en Cocina / Ventas no descargadas del sistema</option>
                <option value="MERMA_POR_DESCONGELACION">💧 Merma operativa / Descongelación / Porcionado / Cocción</option>
                <option value="DETERIORO_CALIDAD">🗑️ Deterioro de Calidad / Descarte / Vencimiento</option>
                <option value="SOBRANTE_NO_REGISTRADO">➕ Sobrante Físico no Registrado</option>
              </select>
            </div>

            {/* Justificación */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Observaciones y Justificación de Auditoría *
              </label>
              <textarea
                required
                rows={3}
                value={itemAdjustJustificacion}
                onChange={(e) => setItemAdjustJustificacion(e.target.value)}
                placeholder="Corrección por conteo"
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 outline-none leading-relaxed text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingItemAdjust}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingItemAdjust ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Aprobar y Registrar Ajuste</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* 📄 MODAL / VISTA DE EXPORTACIÓN A PDF ACTA OFICIAL MEJORADA Y AJUSTADA A PANTALLA */}
      <Modal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title={`Acta Oficial de Conciliación y Cierre: ${currentPeriodo?.nombre}`}
        icon={<Printer className="w-5 h-5 text-blue-600" />}
        maxWidth="max-w-6xl"
      >
        <div className="space-y-3 text-xs font-normal">
          {/* Barra Superior de Filtros y Controles del Documento (Oculta en Impresión) */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-2.5 print:hidden">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro de Tipo de Insumos */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPdfFilter('WITH_STOCK_BODEGA')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    pdfFilter === 'WITH_STOCK_BODEGA'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🥩 Con Stock Bodega (Kg/Und &gt; 0)
                </button>
                <button
                  type="button"
                  onClick={() => setPdfFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    pdfFilter === 'ALL'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos los Insumos ({insumos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPdfFilter('WITH_DIFFERENCE')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    pdfFilter === 'WITH_DIFFERENCE'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Con Diferencias
                </button>
              </div>

              {/* Buscador Rápido en Modal */}
              <div className="relative w-40 sm:w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={pdfSearchQuery}
                  onChange={(e) => setPdfSearchQuery(e.target.value)}
                  placeholder="Buscar corte en acta..."
                  className="w-full h-7 pl-7 pr-2.5 text-[11px] rounded-lg border border-slate-300 outline-none focus:border-orange-500 bg-white"
                />
              </div>
            </div>

            {/* Controles de Paginación y Botón Imprimir */}
            <div className="flex items-center gap-2">
              {/* Selector de Tamaño de Página */}
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <span>Ver:</span>
                <select
                  value={pdfPageSize}
                  onChange={(e) => setPdfPageSize(Number(e.target.value))}
                  className="h-7 px-1.5 rounded border border-slate-300 bg-white text-slate-800 text-[11px] outline-none cursor-pointer"
                >
                  <option value={15}>15 por pág.</option>
                  <option value={25}>25 por pág.</option>
                  <option value={50}>50 por pág.</option>
                  <option value={999}>Todos ({pdfFilteredInsumos.length})</option>
                </select>
              </div>

              {/* Botón Imprimir Directo */}
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / Guardar PDF</span>
              </button>
            </div>
          </div>

          {/* Hoja Imprimible Oficial (Estilo Certificado / Acta) */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-3 text-slate-900 shadow-sm print:border-none print:p-0">
            {/* Header del Acta */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2.5">
              <div>
                <h1 className="text-base font-bold uppercase tracking-wide text-slate-950">
                  RESTAURANTE LA FINCA
                </h1>
                <h2 className="text-xs font-semibold text-slate-700 uppercase mt-0.5">
                  Acta Oficial de Conciliación y Cierre de Inventario
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Periodo: <strong>{currentPeriodo?.nombre}</strong> ({currentPeriodo?.fecha_inicio} al {currentPeriodo?.fecha_fin}) • Vista: <strong>{pdfFilter === 'WITH_STOCK_BODEGA' ? 'Insumos con Stock en Bodega' : pdfFilter === 'WITH_DIFFERENCE' ? 'Solo con Diferencias' : 'Catálogo Completo'}</strong>
                </p>
              </div>

              <div className="text-right text-[10px] space-y-0.5">
                <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 border border-slate-300 text-slate-800 inline-block">
                  ESTADO: {currentPeriodo?.estado || 'CERRADO'}
                </span>
                <div className="text-slate-500">
                  Fecha: {currentPeriodo?.fecha_cierre ? new Date(currentPeriodo.fecha_cierre).toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO')}
                </div>
                <div className="text-slate-500">
                  Auditor: {currentPeriodo?.usuario_cierre || 'Administrador General'}
                </div>
              </div>
            </div>

            {/* Resumen Ejecutivo del Cierre */}
            <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
              <div>
                <span className="text-[9px] text-slate-500 font-medium uppercase block">Total Teórico ({pdfFilteredInsumos.length} items)</span>
                <span className="text-xs font-bold text-slate-900">$ {formatMoney(pdfFilteredSummary.tTeoVal)}</span>
                <span className="text-[9px] text-slate-500 block">({pdfFilteredSummary.tTeoKg.toFixed(1)} Kg)</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-medium uppercase block">Total Conteo Físico</span>
                <span className="text-xs font-bold text-purple-950">$ {formatMoney(pdfFilteredSummary.tFisVal)}</span>
                <span className="text-[9px] text-purple-700 block">({pdfFilteredSummary.tFisKg.toFixed(1)} Kg)</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-medium uppercase block">Descuadre / Merma Neta</span>
                <span className={`text-xs font-bold ${pdfFilteredSummary.tDifVal < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {pdfFilteredSummary.tDifVal < 0 ? '-' : '+'} $ {formatMoney(Math.abs(pdfFilteredSummary.tDifVal))}
                </span>
                <span className="text-[9px] text-slate-500 block">({pdfFilteredSummary.tDifKg.toFixed(1)} Kg)</span>
              </div>
              <div className="bg-slate-900 text-white p-1 rounded-md">
                <span className="text-[9px] text-amber-300 font-medium uppercase block">Total Final Aprobado</span>
                <span className="text-xs font-bold text-amber-400">$ {formatMoney(pdfFilteredSummary.tApVal)}</span>
                <span className="text-[9px] text-slate-300 block">({pdfFilteredSummary.tApKg.toFixed(1)} Kg)</span>
              </div>
            </div>

            {/* Tabla Detallada de Insumos con Altura Ajustada */}
            <div className="border border-slate-300 rounded-lg overflow-x-auto max-h-[46vh] overflow-y-auto print:max-h-none print:overflow-visible">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm text-slate-800 font-bold uppercase text-[9px] border-b border-slate-300 shadow-2xs">
                  <tr>
                    <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Materia Prima / Corte</th>
                    <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Costo Unit.</th>
                    <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Teórico Kg</th>
                    <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Físico Bodega</th>
                    <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Físico Total</th>
                    <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Diferencia</th>
                    <th className="p-1.5 text-right border-r border-slate-300 whitespace-nowrap">Costo Merma</th>
                    <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Auditoría / Motivo</th>
                    <th className="p-1.5 text-center border-r border-slate-300 bg-slate-200 whitespace-nowrap">Kg Aprobados</th>
                    <th className="p-1.5 text-right bg-slate-200 whitespace-nowrap">Valor Aprobado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-normal">
                  {pdfPaginatedInsumos.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400 font-normal">
                        No se encontraron insumos con el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    pdfPaginatedInsumos.map((ins) => {
                      const stock = stockList.find((s) => s.insumo_id === ins.id);
                      const phys = physicalForm[ins.id] || { bodega_kg: '0', bodega_und: '0', bodega_porc_kg: '0', cocina_und: '0', cocina_porc_kg: '0' };
                      const pesoStd = ins.peso_estandar_porcion_kg || 0.35;
                      const costoUnit = ins.costo_unitario_kg || 0;

                      const teoKg = (stock?.bodega_sin_porcionar_kg || 0) + (stock?.bodega_porcionado_kg || 0) + (stock?.cocina_sin_porcionar_kg || 0) + (stock?.cocina_porcionado_kg || 0);
                      
                      const fisEntKg = parseFloat(phys.bodega_kg) || 0;
                      const fisBUnd = parseInt(phys.bodega_und) || 0;
                      const fisBPorcKg = parseFloat(phys.bodega_porc_kg) || (fisBUnd * pesoStd);
                      const fisCUnd = parseInt(phys.cocina_und) || 0;
                      const fisCPorcKg = fisCUnd * pesoStd;
                      const fisKg = fisEntKg + fisBPorcKg + fisCPorcKg;
                      const difKg = fisKg - teoKg;
                      const costoMerma = difKg * costoUnit;

                      const ajuste = ajustesAprobados[ins.id];
                      const finalKg = ajuste ? ajuste.final_aprobado_kg : (currentPeriodo?.estado === 'CERRADO' ? fisKg : (Math.abs(difKg) >= 0.01 ? fisKg : teoKg));
                      const finalCosto = finalKg * costoUnit;

                      return (
                        <tr key={ins.id} className="hover:bg-slate-50/50">
                          <td className="p-1.5 border-r border-slate-200 font-medium text-slate-900 whitespace-nowrap">
                            {ins.nombre}
                            <span className="text-[8.5px] text-slate-400 block">{ins.categoria}</span>
                          </td>
                          <td className="p-1.5 text-center border-r border-slate-200 whitespace-nowrap">
                            ${formatMoney(costoUnit)}
                          </td>
                          <td className="p-1.5 text-center border-r border-slate-200 whitespace-nowrap">
                            {teoKg.toFixed(2)}
                          </td>
                          {/* Físico Bodega */}
                          <td className="p-1.5 text-center border-r border-slate-200 font-medium text-purple-950 whitespace-nowrap">
                            {fisEntKg > 0 && <span>{fisEntKg.toFixed(1)}k ent </span>}
                            {fisBUnd > 0 && <span>{fisBUnd}u ({fisBPorcKg.toFixed(1)}k)</span>}
                            {fisEntKg === 0 && fisBUnd === 0 && <span className="text-slate-300">0</span>}
                          </td>
                          {/* Físico Total */}
                          <td className="p-1.5 text-center border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">
                            {fisKg.toFixed(2)}
                          </td>
                          <td className="p-1.5 text-center border-r border-slate-200 whitespace-nowrap">
                            <span className={Math.abs(difKg) < 0.01 ? 'text-slate-400' : difKg < 0 ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                              {difKg > 0 ? '+' : ''}{difKg.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-1.5 text-right border-r border-slate-200 whitespace-nowrap">
                            {Math.abs(costoMerma) > 50 ? (
                              <span className={costoMerma < 0 ? 'text-red-700 font-medium' : 'text-emerald-700 font-medium'}>
                                {costoMerma < 0 ? '-' : '+'} ${formatMoney(Math.abs(costoMerma))}
                              </span>
                            ) : (
                              <span className="text-slate-400">$ 0</span>
                            )}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 text-[9.5px] text-slate-600 whitespace-nowrap">
                            {ajuste ? (
                              <span className="text-emerald-700 font-medium">✅ {ajuste.justificacion || 'Corrección por conteo'}</span>
                            ) : Math.abs(difKg) >= 0.01 ? (
                              <span className="text-amber-700">Conciliado con conteo físico</span>
                            ) : (
                              <span className="text-slate-400">Sin diferencias</span>
                            )}
                          </td>
                          <td className="p-1.5 text-center border-r border-slate-200 font-bold bg-slate-50 whitespace-nowrap">
                            {finalKg.toFixed(2)}
                          </td>
                          <td className="p-1.5 text-right font-bold bg-slate-50 whitespace-nowrap">
                            ${formatMoney(finalCosto)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginador en el Pie del Modal (Oculto en Impresión) */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 print:hidden">
              <div>
                Mostrando <strong>{pdfPaginatedInsumos.length}</strong> de <strong>{pdfFilteredInsumos.length}</strong> insumos
              </div>

              {totalPdfPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pdfPage <= 1}
                    onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="font-medium text-slate-700">
                    Página {pdfPage} de {totalPdfPages}
                  </span>
                  <button
                    type="button"
                    disabled={pdfPage >= totalPdfPages}
                    onClick={() => setPdfPage((p) => Math.min(totalPdfPages, p + 1))}
                    className="px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer flex items-center gap-1"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Firmas de Auditoría */}
            <div className="grid grid-cols-3 gap-6 pt-6 mt-3 border-t border-slate-300 text-center text-xs">
              <div className="space-y-1">
                <div className="border-b border-slate-400 pb-5"></div>
                <span className="font-bold block text-slate-900 text-[10.5px]">Auditor / Control de Costos</span>
                <span className="text-[9px] text-slate-500">Verificación de Báscula y Balances</span>
              </div>
              <div className="space-y-1">
                <div className="border-b border-slate-400 pb-5"></div>
                <span className="font-bold block text-slate-900 text-[10.5px]">Jefe de Cocina / Chef</span>
                <span className="text-[9px] text-slate-500">Aceptación de Mermas y Porcionados</span>
              </div>
              <div className="space-y-1">
                <div className="border-b border-slate-400 pb-5"></div>
                <span className="font-bold block text-slate-900 text-[10.5px]">Administrador General</span>
                <span className="text-[9px] text-slate-500">Aprobación y Cierre Contable</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

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
            <span className="font-semibold block">Acciones automáticas que ejecutará el sistema:</span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
              <li>Sellar el inventario final de {currentPeriodo?.nombre}.</li>
              <li>Ajustar las existencias en base de datos según el conteo físico y ajustes aprobados.</li>
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
              className="px-4 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={closingPeriod}
              onClick={handleConfirmClosePeriod}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {closingPeriod ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Confirmar y Cerrar Periodo</span>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
