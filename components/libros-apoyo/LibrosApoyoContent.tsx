'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  BookOpen,
  DollarSign,
  Receipt,
  Users,
  ShoppingBag,
  Wrench,
  Search,
  Plus,
  Trash2,
  Upload,
  UploadCloud,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Filter,
  ArrowUpRight,
  Save,
  UserCheck,
  Calculator,
  Layers,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  LogOut,
  Wallet,
  CreditCard,
  CheckSquare,
  ShieldAlert,
  ArrowLeft,
  Smartphone,
  Download,
  FileText,
  ChevronDown,
  Settings,
  Clock
} from 'lucide-react';
import { downloadCajaMenorResumenPdf } from '@/lib/exportCajaMenorPdf';
import SheetTabsBar from '@/components/sheets/SheetTabsBar';
import ImportarFlujoCajaModal from '@/components/libros-apoyo/ImportarFlujoCajaModal';
import Modal from '@/components/ui/Modal';
import { formatMoney } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import { usePeriodo } from '@/context/PeriodoContext';
import {
  LibroCajaKPIs,
  LibroCajaDiario,
  LibroCajaRegistro,
  LibroCajaSesion,
  LibroCajaUsuario,
} from '@/services/libroCajaService';
import { getCachedData, setCachedData, invalidateCache } from '@/lib/dataCache';
import { usePersistedState } from '@/lib/usePersistedState';

const CACHE_KEY = 'libro_caja_menor_oct_2026';

const CLASIFICACIONES = [
  'Costo / Insumo',
  'Gasto Operativo',
  'Turno / Nómina',
];

const CATEGORIAS_POR_CLASIFICACION: Record<string, string[]> = {
  'Costo / Insumo': [
    'Verduras',
    'Bebidas',
    'Grano',
    'Carnes',
    'Servicios',
    'Desechables',
  ],
  'Gasto Operativo': [
    'Gastos Generales',
    'Gastos Transporte',
    'Gastos Mantenimiento',
    'Gastos Limpieza',
  ],
  'Turno / Nómina': [
    'Gastos Nómina',
  ],
};

const CAJEROS_OFICIALES = [
  'JOHANNA',
  'MARIA',
  'CAROLINA',
  'DANIELA',
  'LUCERO',
  'ANTONIO',
  'NEYMAR',
  'SALÓN',
];

const CAJAS_OFICIALES = [
  'Caja 1',
  'Caja 2',
  'Caja 3',
];

function formatDateTitle(fechaStr: string): string {
  if (!fechaStr) return '';
  const parts = fechaStr.split('-');
  if (parts.length !== 3) return fechaStr;
  const meses: Record<string, string> = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
  };
  return `Día ${parts[2]} - ${parts[2]} ${meses[parts[1]] || parts[1]} ${parts[0]}`;
}

// Formateador en tiempo real con separador de miles
function formatInputValueMoney(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('es-CO');
}

function parseInputMoneyToNumber(formatted: string): number {
  return Number(formatted.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '')) || 0;
}

export default function LibrosApoyoContent({
  // Hook de autenticación global del sistema
 modoCajeroHermetico = false }: { modoCajeroHermetico?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCajeroModeUrl = searchParams.get('modo') === 'cajero';

  const cached = getCachedData<{
    kpis: LibroCajaKPIs;
    diarios: LibroCajaDiario[];
    registros: LibroCajaRegistro[];
    sesiones: LibroCajaSesion[];
    usuarios: LibroCajaUsuario[];
    categorias: string[];
    responsables: string[];
    conceptosSugeridos: string[];
  }>(CACHE_KEY);

  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  // Sesión del Cajero o Administrador logueado
  const [currentSessionUser, setCurrentSessionUser] = useState<LibroCajaUsuario | null>(null);

  // Datos principales
  const [kpis, setKpis] = useState<LibroCajaKPIs>(() => cached?.kpis || {
    totalSalidasMes: 0,
    totalCostosInsumos: 0,
    totalGastosOperativos: 0,
    totalTurnosNomina: 0,
    totalAjustesMes: 0,
    totalRegistros: 0,
    totalDiasActivos: 0,
    porCategoria: [],
    porResponsable: [],
  });
  const [diarios, setDiarios] = useState<LibroCajaDiario[]>(() => cached?.diarios || []);
  const [registros, setRegistros] = useState<LibroCajaRegistro[]>(() => cached?.registros || []);
  const [sesiones, setSesiones] = useState<LibroCajaSesion[]>(() => cached?.sesiones || []);
  const [usuarios, setUsuarios] = useState<LibroCajaUsuario[]>(() => cached?.usuarios || []);
  const [categoriasList, setCategoriasList] = useState<string[]>(() => cached?.categorias || []);
  const [responsablesList, setResponsablesList] = useState<string[]>(() => cached?.responsables || CAJEROS_OFICIALES);
  const [conceptosSugeridos, setConceptosSugeridos] = useState<string[]>(() => cached?.conceptosSugeridos || []);

  // Conexión con Períodos Contables
  const { periodos, isPeriodoCerrado } = usePeriodo();

  // Estado para la vista de selección de mes a pantalla completa
  const initialDateParam = searchParams.get('fecha');
  const [selectedMonthId, setSelectedMonthId] = usePersistedState<string | null>(
    'caja_selected_month_id',
    modoCajeroHermetico ? '2026-11' : (initialDateParam && initialDateParam.length >= 7 ? initialDateParam.slice(0, 7) : null)
  );
  const [searchMonthQuery, setSearchMonthQuery] = usePersistedState<string>('caja_search_month', '');

  // Mes seleccionado para el detalle (dinámico según la base de datos y períodos)
  const [selectedMonth, setSelectedMonth] = usePersistedState<string>('caja_selected_month', '2026-10');

  // Período cerrado si corresponde al mes seleccionado
  const isCerrado = isPeriodoCerrado(selectedMonthId || selectedMonth || '');

  // Lista dinámica de meses disponibles combinando Periodos oficiales y registros
  const availableMonths = useMemo(() => {
    const monthNames: Record<string, string> = {
      '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
      '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
      '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
    };

    const periodosMap = new Map<string, {
      codigo: string;
      periodo_id: string;
      nombre: string;
      estado: string;
      diasCount: number;
      totalSalidas: number;
      totalInsumos: number;
      totalGastosOp: number;
      totalTurnos: number;
    }>();

    // 1. Períodos oficiales de PeriodoContext (donde Noviembre 2026 ya existe)
    for (const p of periodos || []) {
      const clean = p.codigo.replace(/^per-/, '');
      const [year, month] = clean.split('-');
      const defaultNombre = `${monthNames[month] || month} ${year}`;
      periodosMap.set(clean, {
        codigo: clean,
        periodo_id: p.id || `per-${clean}`,
        nombre: p.nombre || defaultNombre,
        estado: p.estado || 'ABIERTO',
        diasCount: 0,
        totalSalidas: 0,
        totalInsumos: 0,
        totalGastosOp: 0,
        totalTurnos: 0,
      });
    }

    // 2. Si hay fechas en diarios que no estén en periodos, agregarlas
    for (const d of diarios) {
      if (!d.fecha) continue;
      const ym = d.fecha.slice(0, 7);
      if (!periodosMap.has(ym)) {
        const [year, month] = ym.split('-');
        periodosMap.set(ym, {
          codigo: ym,
          periodo_id: `per-${ym}`,
          nombre: `${monthNames[month] || month} ${year}`,
          estado: 'ABIERTO',
          diasCount: 0,
          totalSalidas: 0,
          totalInsumos: 0,
          totalGastosOp: 0,
          totalTurnos: 0,
        });
      }
    }

    // 3. Totales por mes (ignorando días vacíos sin movimientos)
    for (const d of diarios) {
      if (!d.fecha) continue;
      const tieneMovimiento =
        Number(d.total_salidas || 0) > 0 ||
        (d.responsables_dia && d.responsables_dia !== 'Sin Movimientos');
      if (!tieneMovimiento) continue;
      const ym = d.fecha.slice(0, 7);
      const item = periodosMap.get(ym);
      if (item) {
        item.diasCount += 1;
        item.totalSalidas += Number(d.total_salidas || 0);
        item.totalInsumos += Number(d.total_costos_insumos || 0);
        item.totalGastosOp += Number(d.total_gastos_operativos || 0);
        item.totalTurnos += Number(d.total_turnos_nomina || 0);
      }
    }

    return Array.from(periodosMap.values())
      .sort((a, b) => b.codigo.localeCompare(a.codigo))
      .map((item) => ({
        key: item.codigo,
        codigo: item.codigo,
        periodo_id: item.periodo_id,
        nombre: item.nombre,
        label: item.nombre,
        estado: item.estado,
        count: item.diasCount,
        diasCount: item.diasCount,
        totalSalidas: item.totalSalidas,
        totalInsumos: item.totalInsumos,
        totalGastosOp: item.totalGastosOp,
        totalTurnos: item.totalTurnos,
      }));
  }, [periodos, diarios]);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.some((m) => m.key === selectedMonth)) {
      setSelectedMonth(availableMonths[0].key);
    }
  }, [availableMonths, selectedMonth]);

  // Hojas filtradas por el mes seleccionado
  const activeMonthPrefix = selectedMonthId || selectedMonth;
  const diariosDelMes = useMemo(() => {
    const base = !activeMonthPrefix
      ? diarios
      : diarios.filter((d) => d.fecha && d.fecha.startsWith(activeMonthPrefix));
    return base.filter(
      (d) =>
        Number(d.total_salidas || 0) > 0 ||
        (d.responsables_dia && d.responsables_dia !== 'Sin Movimientos') ||
        registros.some((r) => r.fecha === d.fecha) ||
        sesiones.some((s) => s.fecha === d.fecha)
    );
  }, [diarios, activeMonthPrefix, registros, sesiones]);

  const registrosDelMes = useMemo(() => {
    if (!activeMonthPrefix) return registros;
    return registros.filter((r) => r.fecha && r.fecha.startsWith(activeMonthPrefix));
  }, [registros, activeMonthPrefix]);

  const selectedMonthLabel = useMemo(() => {
    return availableMonths.find((m) => m.key === activeMonthPrefix)?.label || 'Octubre 2026';
  }, [availableMonths, activeMonthPrefix]);

  // Normalizador y filtrado de meses para el buscador
  const normalize = (text: string) =>
    (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const filteredMeses = useMemo(() => {
    const q = normalize(searchMonthQuery);
    if (!q) return availableMonths;
    return availableMonths.filter(
      (m) => normalize(m.nombre).includes(q) || normalize(m.codigo).includes(q)
    );
  }, [availableMonths, searchMonthQuery]);

  const handleOpenMonth = (codigo: string) => {
    setSelectedMonthId(codigo);
    setSelectedMonth(codigo);
    setActiveTabId(null);
    setOpenTabs([]);
  };

  // KPIs calculados dinámicamente para el mes seleccionado
  const kpisMes = useMemo(() => {
    if (!activeMonthPrefix) return kpis;
    let totalCostosInsumos = 0;
    let totalGastosOperativos = 0;
    let totalTurnosNomina = 0;
    let totalAjustesMes = 0;

    for (const r of registrosDelMes) {
      const val = Number(r.valor_pagado || 0);
      if (r.es_ajuste) totalAjustesMes += val;
      const cl = (r.clasificacion || '').toLowerCase();
      if (cl.includes('insumo') || cl.includes('costo')) {
        totalCostosInsumos += val;
      } else if (cl.includes('nómina') || cl.includes('nomina') || cl.includes('turno')) {
        totalTurnosNomina += val;
      } else {
        totalGastosOperativos += val;
      }
    }

    const totalSalidasMes = totalCostosInsumos + totalGastosOperativos + totalTurnosNomina;

    return {
      totalSalidasMes,
      totalCostosInsumos,
      totalGastosOperativos,
      totalTurnosNomina,
      totalAjustesMes,
      totalRegistros: registrosDelMes.length,
      totalDiasActivos: diariosDelMes.length,
      porCategoria: [],
      porResponsable: [],
    };
  }, [activeMonthPrefix, registrosDelMes, diariosDelMes, kpis]);

  // Control para Contraer / Desplegar contenedor lateral izquierdo de Hojas por Fecha
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Datos enriquecidos del POS diario y Bitácora Cronológica
  const [posDiaResumen, setPosDiaResumen] = useState<any>(null);
  const [bitacoraDia, setBitacoraDia] = useState<any[]>([]);
  const [bitacoraFiltro, setBitacoraFiltro] = useState<'TODOS' | 'TURNO' | 'MOVIMIENTO' | 'AUDITORIA'>('TODOS');

  // Sistema de Pestañas
  const [openTabs, setOpenTabs] = usePersistedState<string[]>('caja_open_tabs', []);
  const [activeTabId, setActiveTabId] = usePersistedState<string | null>('caja_active_tab_id', null); // null = Vista Previa Consolidado

  // Sub-vista dentro del Consolidado Mensual
  const [consolidadoSubTab, setConsolidadoSubTab] = usePersistedState<'DIARIO' | 'CRONOLOGICO'>('caja_consolidado_subtab', 'DIARIO');

  // Filtros en la vista Cronológica Global
  const [searchQuery, setSearchQuery] = usePersistedState<string>('caja_search_query', '');
  const [selectedClasificacion, setSelectedClasificacion] = usePersistedState<string>('caja_selected_clasif', '');
  const [selectedCategoria, setSelectedCategoria] = usePersistedState<string>('caja_selected_cat', '');
  const [selectedResponsable, setSelectedResponsable] = usePersistedState<string>('caja_selected_resp', '');
  const [selectedFechaFilter, setSelectedFechaFilter] = usePersistedState<string>('caja_selected_fecha', '');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 35;

  // Estado del Cajero y Caja Activa
  const { user: globalAuthUser } = useAuth();
  const [cajeroActivo, setCajeroActivo] = useState('ADMIN');
  const [cajaActiva, setCajaActiva] = useState('Caja 1');

  // Formulario de Ingreso Rápido (Quick-Add) con formateador de miles
  const [quickClasificacion, setQuickClasificacion] = useState('Costo / Insumo');
  const [quickCategoria, setQuickCategoria] = useState('Verduras');
  const [quickConcepto, setQuickConcepto] = useState('');
  const [quickDescripcion, setQuickDescripcion] = useState('');
  const [quickValorFormatted, setQuickValorFormatted] = useState('');
  const [quickProveedor, setQuickProveedor] = useState('Gastos Menores / Caja Menor');
  const [savingItem, setSavingItem] = useState(false);

  // Formulario para Registrar AJUSTE (post-cierre)
  const [ajusteConcepto, setAjusteConcepto] = useState('');
  const [ajusteDescripcion, setAjusteDescripcion] = useState('');
  const [ajusteValorFormatted, setAjusteValorFormatted] = useState('');
  const [ajusteTipo, setAjusteTipo] = useState<'EGRESO' | 'INGRESO'>('EGRESO');
  const [savingAjuste, setSavingAjuste] = useState(false);

  // Estado de Arqueo Diario en la Hoja Activa (Vista Administradora)
  const [arqueoBase, setArqueoBase] = useState('500000');
  const [arqueoVentaPos, setArqueoVentaPos] = useState('0');
  const [arqueoEfectivoFisico, setArqueoEfectivoFisico] = useState('0');
  const [arqueoDatafonos, setArqueoDatafonos] = useState('0');
  const [arqueoOtrosMedios, setArqueoOtrosMedios] = useState('0');
  const [arqueoEstado, setArqueoEstado] = useState('AUDITADA');
  const [savingArqueo, setSavingArqueo] = useState(false);

  // Modal Apertura de Flujo de Caja (Cajero)
  const [isAbrirFlujoModalOpen, setIsAbrirFlujoModalOpen] = useState(false);
  const [flujoAperturaFecha, setFlujoAperturaFecha] = useState('2026-10-26');
  const [flujoAperturaCaja, setFlujoAperturaCaja] = useState('Caja 1');
  const [flujoAperturaEfectivoInicial, setFlujoAperturaEfectivoInicial] = useState('500.000');
  const [openingFlujo, setOpeningFlujo] = useState(false);

  // Modal Cierre de Flujo de Caja (Cajero): soporta PARCIAL (entrega de turno) o TOTAL (cierre definitivo)
  const [isCerrarFlujoModalOpen, setIsCerrarFlujoModalOpen] = useState(false);
  const [flujoCierreTipo, setFlujoCierreTipo] = useState<'PARCIAL' | 'TOTAL'>('PARCIAL');
  const [flujoCierreEfectivoFisico, setFlujoCierreEfectivoFisico] = useState('');
  const [flujoCierreDatafonos, setFlujoCierreDatafonos] = useState('');
  const [flujoCierreOtrosMedios, setFlujoCierreOtrosMedios] = useState('');
  const [flujoCierreObs, setFlujoCierreObs] = useState('');
  const [closingFlujo, setClosingFlujo] = useState(false);

  // Modal Nueva Hoja de Fecha (Administrador)
  const [isNewSheetModalOpen, setIsNewSheetModalOpen] = useState(false);
  const [newSheetDate, setNewSheetDate] = useState('2026-10-27');

  // Modal Importador Excel / IA
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isUtilidadesOpen, setIsUtilidadesOpen] = useState(false);
  const utilidadesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (utilidadesRef.current && !utilidadesRef.current.contains(event.target as Node)) {
        setIsUtilidadesOpen(false);
      }
    }
    if (isUtilidadesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUtilidadesOpen]);
  const [importPreviewItems, setImportPreviewItems] = useState<any[]>([]);
  const [importTextRaw, setImportTextRaw] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar usuario autenticado desde localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('la_finca_cajero_session');
      if (stored) {
        const u = JSON.parse(stored);
        setCurrentSessionUser(u);
        if (u.nombre_cajero) setCajeroActivo(u.nombre_cajero);
        if (u.caja_predeterminada && u.caja_predeterminada !== 'Todas las Cajas') {
          setCajaActiva(u.caja_predeterminada);
        }
      }
    } catch (e) {}
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const fechaQuery = activeTabId ? `&fecha=${encodeURIComponent(activeTabId)}` : '';
      const res = await fetch(`/api/libros-apoyo?periodo_id=per-2026-10${fechaQuery}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo cargar el Libro de Caja');
      }
      setKpis(json.kpis);
      setDiarios(json.diarios || []);
      setRegistros(json.registros || []);
      setSesiones(json.sesiones || []);
      setUsuarios(json.usuarios || []);
      setCategoriasList(json.categorias || []);
      setResponsablesList(json.responsables?.length ? json.responsables : CAJEROS_OFICIALES);
      setConceptosSugeridos(json.conceptosSugeridos || []);
      if (json.posDiaResumen) setPosDiaResumen(json.posDiaResumen);
      if (Array.isArray(json.bitacoraDia)) setBitacoraDia(json.bitacoraDia);

      setCachedData(CACHE_KEY, {
        kpis: json.kpis,
        diarios: json.diarios || [],
        registros: json.registros || [],
        sesiones: json.sesiones || [],
        usuarios: json.usuarios || [],
        categorias: json.categorias || [],
        responsables: json.responsables || CAJEROS_OFICIALES,
        conceptosSugeridos: json.conceptosSugeridos || [],
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [activeTabId]);

  useEffect(() => {
    loadData(Boolean(cached));
  }, [loadData]);

  // Actualizar categorías sugeridas cuando cambia clasificación en Quick-Add
  useEffect(() => {
    const cats = CATEGORIAS_POR_CLASIFICACION[quickClasificacion] || ['Gastos Generales'];
    setQuickCategoria(cats[0]);
    if (quickClasificacion === 'Turno / Nómina') {
      setQuickProveedor('Personal Operativo (Turnos de Caja)');
    } else {
      setQuickProveedor('Gastos Menores / Caja Menor');
    }
  }, [quickClasificacion]);

  // Sincronizar hoja activa
  const activeSheet = useMemo(() => {
    if (!activeTabId) return null;
    return diarios.find((d) => d.fecha === activeTabId) || null;
  }, [activeTabId, diarios]);

  // Determinar si el usuario actual es Administrador
  const isAdmin = !modoCajeroHermetico && (currentSessionUser?.rol === 'ADMIN' || !isCajeroModeUrl);

  const currentUsername = (currentSessionUser?.username || globalAuthUser?.username || 'admin').toLowerCase().trim();
  const currentCajeroName = (currentSessionUser?.nombre_cajero || (isAdmin ? (globalAuthUser?.name || 'ADMIN') : cajeroActivo)).toUpperCase().trim();

  // Todas las sesiones (turnos) del día activo ordenadas por turno
  const sesionesDiaActivo = useMemo(() => {
    if (!activeTabId) return [];
    return sesiones
      .filter((s) => s.fecha === activeTabId)
      .sort((a, b) => Number(a.numero_turno || 1) - Number(b.numero_turno || 1));
  }, [activeTabId, sesiones]);

  // Sesión actualmente ABIERTA en el día (si alguien tiene el turno activo)
  const sesionAbiertaDia = useMemo(() => {
    return sesionesDiaActivo.find((s) => s.estado === 'ABIERTA') || null;
  }, [sesionesDiaActivo]);

  // Última sesión registrada en el día
  const ultimaSesionDia = useMemo(() => {
    if (sesionesDiaActivo.length === 0) return null;
    return sesionesDiaActivo[sesionesDiaActivo.length - 1];
  }, [sesionesDiaActivo]);

  // ¿El flujo del día ya se cerró totalmente?
  const isFlujoCerradoTotal = useMemo(() => {
    return sesionesDiaActivo.some(
      (s) =>
        s.estado === 'CERRADA_TOTAL' ||
        s.estado === 'CERRADA' ||
        (s.estado !== 'ABIERTA' && s.tipo_cierre === 'TOTAL')
    );
  }, [sesionesDiaActivo]);

  // ¿El flujo del día está en Cierre Parcial esperando que otro cajero reciba el turno?
  const isFlujoPendienteRelevo = useMemo(() => {
    return (
      !sesionAbiertaDia &&
      !isFlujoCerradoTotal &&
      ultimaSesionDia?.estado === 'CERRADA_PARCIAL'
    );
  }, [sesionAbiertaDia, isFlujoCerradoTotal, ultimaSesionDia]);

  // ¿El usuario logueado es dueño de la sesión abierta actual?
  const isMyOpenSession = useMemo(() => {
    if (!sesionAbiertaDia) return false;
    return (
      sesionAbiertaDia.usuario_username?.toLowerCase() === currentUsername ||
      sesionAbiertaDia.cajero_nombre?.toUpperCase() === currentCajeroName
    );
  }, [sesionAbiertaDia, currentUsername, currentCajeroName]);

  // ¿El usuario logueado participó en alguno de los turnos de este flujo de caja hoy?
  const didUserParticipateInDay = useMemo(() => {
    return sesionesDiaActivo.some(
      (s) =>
        s.usuario_username?.toLowerCase() === currentUsername ||
        s.cajero_nombre?.toUpperCase() === currentCajeroName
    );
  }, [sesionesDiaActivo, currentUsername, currentCajeroName]);

  // Sesión de referencia para mostrar en cabecera (la abierta o la última del día)
  const activeSesion = sesionAbiertaDia || ultimaSesionDia;

  useEffect(() => {
    if (activeSheet) {
      setArqueoBase(String(activeSheet.base_inicial || 500000));
      setArqueoVentaPos(String(activeSheet.venta_pos_total || activeSheet.venta_efectivo_pos || 0));
      setArqueoEfectivoFisico(String(activeSheet.efectivo_fisico_cierre || 0));
      setArqueoDatafonos(String(activeSheet.total_datafonos || 0));
      setArqueoOtrosMedios(String(activeSheet.total_otros_medios || 0));
      setArqueoEstado(activeSheet.estado || 'AUDITADA');
    }
  }, [activeSheet]);

  // Hojas formateadas para SheetTabsBar
  const sheetTabItems = useMemo(() => {
    return diarios.map((d) => ({
      id: d.fecha,
      title: formatDateTitle(d.fecha),
    }));
  }, [diarios]);

  const handleExportResumenTotalizadoPdf = () => {
    const currentMonthObj = availableMonths.find((m) => m.key === selectedMonth);
    const label = currentMonthObj ? currentMonthObj.label : selectedMonth;
    downloadCajaMenorResumenPdf({
      mesLabel: label,
      diarios: diariosDelMes,
      kpis,
      registros: registros
    });
  };

  const handleOpenDaySheet = (fecha: string) => {
    if (!openTabs.includes(fecha)) {
      setOpenTabs((prev) => [...prev, fecha]);
    }
    setActiveTabId(fecha);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const next = openTabs.filter((id) => id !== tabId);
    setOpenTabs(next);
    if (activeTabId === tabId) {
      setActiveTabId(next.length > 0 ? next[next.length - 1] : null);
    }
  };

  // Filtrado de los registros en la vista Cronológica
  const filteredRegistros = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return registrosDelMes.filter((r) => {
      if (selectedClasificacion && r.clasificacion !== selectedClasificacion) return false;
      if (selectedCategoria && r.categoria !== selectedCategoria) return false;
      if (selectedResponsable && r.responsable_caja !== selectedResponsable) return false;
      if (selectedFechaFilter && r.fecha !== selectedFechaFilter) return false;
      if (q) {
        const match =
          (r.concepto || '').toLowerCase().includes(q) ||
          (r.descripcion_beneficiario || '').toLowerCase().includes(q) ||
          (r.categoria || '').toLowerCase().includes(q) ||
          (r.soporte_factura || '').toLowerCase().includes(q) ||
          (r.proveedor_fuente || '').toLowerCase().includes(q) ||
          (r.caja_nombre || '').toLowerCase().includes(q) ||
          (r.responsable_caja || '').toLowerCase().includes(q);
        return match;
      }
      return true;
    });
  }, [registrosDelMes, searchQuery, selectedClasificacion, selectedCategoria, selectedResponsable, selectedFechaFilter]);

  const totalFilteredMoney = useMemo(() => {
    return filteredRegistros.reduce((acc, r) => acc + Number(r.valor_pagado || 0), 0);
  }, [filteredRegistros]);

  const totalPages = Math.max(1, Math.ceil(filteredRegistros.length / pageSize));
  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistros.slice(start, start + pageSize);
  }, [filteredRegistros, currentPage]);

  // Registros de la hoja del día activa
  const registrosDiaActivo = useMemo(() => {
    if (!activeTabId) return [];
    return registros.filter((r) => r.fecha === activeTabId);
  }, [registros, activeTabId]);

  // 1. Abrir Flujo de Caja o Recibir Turno tras Cierre Parcial
  const handleOpenFlujoCajaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const efectivoInicialNum = parseInputMoneyToNumber(flujoAperturaEfectivoInicial);
    if (efectivoInicialNum < 0) {
      alert('Ingresa una base inicial válida.');
      return;
    }

    setOpeningFlujo(true);
    try {
      const res = await fetch('/api/libros-apoyo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'OPEN_FLUJO_CAJA',
          fecha: flujoAperturaFecha,
          caja_nombre: 'CAJA PRINCIPAL',
          cajero_nombre: currentCajeroName,
          usuario_username: currentUsername,
          efectivo_inicial: efectivoInicialNum,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo abrir el flujo de caja');
      }

      setIsAbrirFlujoModalOpen(false);
      invalidateCache(CACHE_KEY);
      await loadData(true);
      handleOpenDaySheet(flujoAperturaFecha);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setOpeningFlujo(false);
    }
  };

  // 2. Cerrar Flujo de Caja (Parcial o Total)
  const handleCloseFlujoCajaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTabId) return;

    const efectivoCierreNum = parseInputMoneyToNumber(flujoCierreEfectivoFisico);
    const datafonosNum = parseInputMoneyToNumber(flujoCierreDatafonos);
    const otrosMediosNum = parseInputMoneyToNumber(flujoCierreOtrosMedios);

    setClosingFlujo(true);
    try {
      const res = await fetch('/api/libros-apoyo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLOSE_FLUJO_CAJA',
          sesion_id: sesionAbiertaDia?.id || activeSesion?.id,
          fecha: activeTabId,
          usuario_username: currentUsername,
          cajero_nombre: currentCajeroName,
          is_admin: isAdmin,
          tipo_cierre: flujoCierreTipo,
          efectivo_cierre: efectivoCierreNum,
          valor_datafonos: datafonosNum,
          valor_otros_medios: otrosMediosNum,
          observaciones: flujoCierreObs.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo cerrar el flujo de caja');
      }

      setIsCerrarFlujoModalOpen(false);
      setFlujoCierreEfectivoFisico('');
      setFlujoCierreDatafonos('');
      setFlujoCierreOtrosMedios('');
      setFlujoCierreObs('');
      invalidateCache(CACHE_KEY);
      await loadData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClosingFlujo(false);
    }
  };

  // 3. Crear Salida Normal
  const handleAddQuickItem = async (e: React.FormEvent, targetFecha: string) => {
    e.preventDefault();
    const valorNum = parseInputMoneyToNumber(quickValorFormatted);
    if (!quickConcepto.trim() || valorNum <= 0) {
      alert('Ingresa el concepto y un valor mayor a $0.');
      return;
    }

    setSavingItem(true);
    try {
      const res = await fetch('/api/libros-apoyo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_ITEM',
          fecha: targetFecha,
          clasificacion: quickClasificacion,
          categoria: quickCategoria,
          concepto: quickConcepto.trim(),
          descripcion_beneficiario: quickDescripcion.trim() || quickConcepto.trim(),
          valor_pagado: valorNum,
          responsable_caja: currentCajeroName,
          soporte_factura: `CUADERNO CAJA / ${currentCajeroName}`,
          proveedor_fuente: quickProveedor,
          usuario_registro: currentUsername,
          caja_nombre: cajaActiva,
          es_ajuste: false,
          sesion_id: sesionAbiertaDia?.id || activeSesion?.id || null,
          is_admin: isAdmin,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al guardar salida');

      setQuickConcepto('');
      setQuickDescripcion('');
      setQuickValorFormatted('');
      invalidateCache(CACHE_KEY);
      await loadData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingItem(false);
    }
  };

  // 4. Crear AJUSTE post-cierre
  const handleAddAjusteSubmit = async (e: React.FormEvent, targetFecha: string) => {
    e.preventDefault();
    const valorNum = parseInputMoneyToNumber(ajusteValorFormatted);
    if (!ajusteConcepto.trim() || valorNum <= 0) {
      alert('Ingresa el concepto y valor del ajuste.');
      return;
    }

    setSavingAjuste(true);
    try {
      const res = await fetch('/api/libros-apoyo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_ITEM',
          fecha: targetFecha,
          clasificacion: 'Gasto Operativo',
          categoria: 'Gastos Generales',
          concepto: `[AJUSTE] ${ajusteConcepto.trim()}`,
          descripcion_beneficiario: ajusteDescripcion.trim() || ajusteConcepto.trim(),
          valor_pagado: valorNum,
          responsable_caja: currentCajeroName,
          soporte_factura: `AJUSTE CAJA / ${currentCajeroName}`,
          proveedor_fuente: 'Ajuste Posterior al Cierre de Caja',
          usuario_registro: currentUsername,
          caja_nombre: cajaActiva,
          es_ajuste: true,
          sesion_id: ultimaSesionDia?.id || activeSesion?.id || null,
          is_admin: isAdmin,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al guardar ajuste');

      setAjusteConcepto('');
      setAjusteDescripcion('');
      setAjusteValorFormatted('');
      invalidateCache(CACHE_KEY);
      await loadData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingAjuste(false);
    }
  };

  // 5. Guardar Arqueo General (Admin)
  const handleSaveArqueo = async () => {
    if (!activeTabId) return;
    setSavingArqueo(true);
    try {
      const res = await fetch('/api/libros-apoyo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_ARQUEO',
          fecha: activeTabId,
          base_inicial: Number(arqueoBase || 0),
          venta_pos_total: Number(arqueoVentaPos || 0),
          venta_efectivo_pos: Number(arqueoVentaPos || 0),
          total_datafonos: Number(arqueoDatafonos || 0),
          total_otros_medios: Number(arqueoOtrosMedios || 0),
          efectivo_fisico_cierre: Number(arqueoEfectivoFisico || 0),
          estado: arqueoEstado,
        }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar el arqueo');
      invalidateCache(CACHE_KEY);
      await loadData(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingArqueo(false);
    }
  };

  const handleDeleteRegistro = async (reg: LibroCajaRegistro) => {
    if (isCerrado) {
      alert('El período contable está cerrado. No se permite eliminar registros.');
      return;
    }
    if (!confirm(`¿Eliminar "${reg.concepto}" por ${formatMoney(reg.valor_pagado)} del día ${reg.fecha}?`)) return;
    try {
      const res = await fetch(
        `/api/libros-apoyo?id=${reg.id}&fecha=${reg.fecha}&is_admin=${isAdmin}&usuario=${encodeURIComponent(currentUsername)}`,
        {
          method: 'DELETE',
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error eliminando registro');
      invalidateCache(CACHE_KEY);
      await loadData(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('la_finca_cajero_session');
    setCurrentSessionUser(null);
    router.push('/libros-apoyo/acceso');
  };

  // Cálculos dinámicos de cuadre para el Día / Turno
  const primeraSesionDia = sesionesDiaActivo[0] || null;
  const baseFlujo = Number(primeraSesionDia?.efectivo_inicial || activeSheet?.base_inicial || 500000);
  const hayFlujoAbierto = Boolean(
    sesionAbiertaDia ||
    sesiones.some((s) => s.estado === 'ABIERTA')
  );
  const totalSalidasCajaActiva = registrosDiaActivo
    .filter((r) => !r.es_ajuste)
    .reduce((a, b) => a + Number(b.valor_pagado || 0), 0);
  const totalAjustesCajaActiva = registrosDiaActivo
    .filter((r) => r.es_ajuste)
    .reduce((a, b) => a + Number(b.valor_pagado || 0), 0);

  // Totales consolidados oficiales para el Flujo del Día:
  const efectivoDia = sesionesDiaActivo.length > 0
    ? sesionesDiaActivo.reduce((a, s) => a + Number(s.efectivo_cierre || 0), 0)
    : Number(activeSheet?.efectivo_fisico_cierre || 0);

  const datafonosDia = sesionesDiaActivo.length > 0
    ? sesionesDiaActivo.reduce((a, s) => a + Number(s.valor_datafonos || 0), 0)
    : Number(activeSheet?.total_datafonos || 0);

  const otrosMediosDia = sesionesDiaActivo.length > 0
    ? sesionesDiaActivo.reduce((a, s) => a + Number(s.valor_otros_medios || 0), 0)
    : Number(activeSheet?.total_otros_medios || 0);

  const salidasDia = totalSalidasCajaActiva > 0
    ? totalSalidasCajaActiva
    : Number(activeSheet?.total_salidas || 0);

  const ventaPosReal = Number(activeSheet?.venta_pos_total || activeSheet?.venta_efectivo_pos || 0);

  // FÓRMULA OFICIAL DE CUADRE DIARIO:
  // Efectivo + Datáfonos + Otros Medios (Nequi) + Salidas (que también se suman al total)
  const sumatoriaTotalDia = efectivoDia + datafonosDia + otrosMediosDia + salidasDia;
  const diferenciaCuadreDia = sumatoriaTotalDia - ventaPosReal;

  // Variables retrocompatibles
  const efectivoFisicoCajero = efectivoDia;
  const datafonosCajero = datafonosDia;
  const dineroRecaudadoCajero = sumatoriaTotalDia;
  const diferenciaCuadreCajero = diferenciaCuadreDia;

  // =========================================================================
  // VISTA INTERMEDIA: LISTADO DE MESES A PANTALLA COMPLETA
  // =========================================================================
  if (selectedMonthId === null && !modoCajeroHermetico) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-8 animate-fade-in font-normal">
        {/* Encabezado Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hojas de Libro de Caja</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Listado de meses con registros de caja menor ordenados desde el más reciente.
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
        {filteredMeses.length === 0 ? (
          <div className="bg-white rounded-lg p-10 border border-slate-200 text-center text-slate-500">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-600">No se encontraron meses registrados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMeses.map((m) => (
              <div
                key={m.codigo}
                onClick={() => handleOpenMonth(m.codigo)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 rounded-lg cursor-pointer transition-all gap-2"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-slate-100 text-slate-600 group-hover:text-slate-900 transition-colors mt-0.5 sm:mt-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                        {m.nombre} - Libro de Caja
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>
                        {m.diasCount} {m.diasCount === 1 ? 'día registrado' : 'días registrados'}
                      </span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">
                        Total salidas: ${m.totalSalidas.toLocaleString('es-CO')} COP
                      </span>
                      {m.totalInsumos > 0 && (
                        <>
                          <span>•</span>
                          <span>Insumos: ${m.totalInsumos.toLocaleString('es-CO')} COP</span>
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
                      handleOpenMonth(m.codigo);
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

  return (
    <div className="flex flex-col h-full max-h-full w-full overflow-hidden bg-slate-50 font-normal text-xs p-0 m-0">
      {/* 1. BARRA SUPERIOR: Hermética para Portal Cajero o Estándar SheetTabsBar para Administrador */}
      {modoCajeroHermetico ? (
        <header className="shrink-0 h-14 bg-slate-900 border-b border-slate-800 px-3 md:px-6 flex items-center justify-between text-white z-20 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5 leading-none truncate">
                Portal de Libro de Caja • La Finca
              </h1>
              <p className="text-[10px] text-slate-400 font-medium mt-1 truncate">
                Cajero: <span className="text-orange-400 font-bold">{currentCajeroName}</span>
                {sesionAbiertaDia && (
                  <span className="ml-1 text-emerald-400 font-semibold">• Turno #{sesionAbiertaDia.numero_turno || 1} Activo</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!hayFlujoAbierto && (
              <button
                type="button"
                onClick={() => {
                  setFlujoAperturaFecha(activeTabId || new Date().toISOString().split('T')[0]);
                  setFlujoAperturaEfectivoInicial('500.000');
                  setIsAbrirFlujoModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Abrir Flujo de caja</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 border border-slate-700 text-slate-300 rounded-md text-xs font-semibold transition cursor-pointer"
              title="Cerrar sesión del Portal Cajero"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </header>
      ) : (
        <div className="shrink-0 bg-white border-b border-slate-200 z-20">
          <SheetTabsBar
            mainTabLabel="Consolidado Libro Caja Menor"
            mainTabIcon={BookOpen}
            activeTabId={activeTabId}
            openTabs={openTabs}
            sheets={sheetTabItems}
            onSelectMainTab={() => setActiveTabId(null)}
            onSelectTab={(id) => setActiveTabId(id)}
            onCloseTab={handleCloseTab}
            onNewSheetClick={() => {
              if (isAdmin) setIsNewSheetModalOpen(true);
              else setIsAbrirFlujoModalOpen(true);
            }}
            onBackClick={() => {
              setSelectedMonthId(null);
              setActiveTabId(null);
            }}
            hideNewSheet={isCerrado}
            rightAction={
              <div className="flex items-center gap-2 py-1">
                {/* Botón de Abrir Flujo de Caja: SOLO si el período está abierto y no hay flujo */}
                {!isCerrado && !hayFlujoAbierto && (
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      const defaultDate = today.startsWith(selectedMonthId || '') ? today : `${selectedMonthId || '2026-11'}-01`;
                      setFlujoAperturaFecha(activeTabId || defaultDate);
                      setFlujoAperturaEfectivoInicial('500.000');
                      setIsAbrirFlujoModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Abrir Flujo de Caja</span>
                  </button>
                )}

                {/* Botón Desplegable Único de Utilidades (Importar flujo, Portal cajero, Exportar PDF) */}
                <div className="relative" ref={utilidadesRef}>
                  <button
                    type="button"
                    onClick={() => setIsUtilidadesOpen(!isUtilidadesOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap shadow-2xs transition-colors"
                    title="Utilidades (Importar flujo, Portal cajero, Exportar PDF)"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span>Utilidades</span>
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${isUtilidadesOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isUtilidadesOpen && (
                    <>
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsUtilidadesOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-1 divide-y divide-slate-100 animate-fade-in ring-1 ring-slate-900/10">
                        <div className="py-1">
                          {isAdmin && !isCerrado && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsUtilidadesOpen(false);
                                setIsImportModalOpen(true);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                              title="Importar uno o múltiples flujos de caja desde archivo .txt escaneado con IA"
                            >
                              <UploadCloud className="w-4 h-4 text-slate-500" />
                              <span>Importar Flujo de Caja</span>
                            </button>
                          )}

                          {currentSessionUser ? (
                            <button
                              type="button"
                              onClick={() => {
                                setIsUtilidadesOpen(false);
                                handleLogout();
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                            >
                              <LogOut className="w-4 h-4 text-slate-500" />
                              <span>Cerrar Sesión ({currentSessionUser.username})</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setIsUtilidadesOpen(false);
                                window.open('/libros-apoyo/acceso', '_blank', 'noopener,noreferrer');
                              }}
                              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                              title="Abrir Portal Cajero en nueva pestaña"
                            >
                              <div className="flex items-center gap-2.5">
                                <Lock className="w-4 h-4 text-slate-500" />
                                <span>Portal Cajero</span>
                              </div>
                              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setIsUtilidadesOpen(false);
                              handleExportResumenTotalizadoPdf();
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                            title="Exportar Resumen Totalizado en PDF"
                          >
                            <FileText className="w-4 h-4 text-slate-500" />
                            <span>Exportar PDF</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            }
          />
        </div>
      )}

      {/* 2. CUERPO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* =================================================================== */}
        {/* CASO 1: VISTA PREVIA CONSOLIDADO LIBRO CAJA MENOR (activeTabId === null) */}
        {/* Izquierda: Meses | Derecha: Lista de Hojas de Libro de Caja    */}
        {/* =================================================================== */}
        {activeTabId === null ? (
          <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden">
            {/* Panel Principal: Lista de Hojas de Libro de Caja (Ancho Completo) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {/* Encabezado Principal de Hojas */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                      Hojas de Libro de Caja • {selectedMonthLabel}
                    </h1>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold">
                      {diariosDelMes.length} Hojas Activas
                    </span>
                    {isCerrado && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-300">
                        Período Cerrado (Solo Lectura)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Selecciona una fecha para abrir su hoja detallada de caja, registrar gastos o auditar arqueo
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConsolidadoSubTab('DIARIO')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors cursor-pointer ${
                      consolidadoSubTab === 'DIARIO'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Resumen Totalizado
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsolidadoSubTab('CRONOLOGICO')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors cursor-pointer ${
                      consolidadoSubTab === 'CRONOLOGICO'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Registro de Ítems
                  </button>

                </div>
              </div>

              {/* 4 KPI Cards Resumen */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Salidas Caja (Mes)</div>
                  <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-1">
                    $ {formatMoney(kpisMes.totalSalidasMes)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{kpisMes.totalRegistros} salidas registradas</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">1. Insumos por Caja</div>
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-1">
                    $ {formatMoney(kpisMes.totalCostosInsumos)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Carnes, verduras y servicios</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">2. Gastos Operativos</div>
                  <div className="text-base sm:text-lg font-black font-mono text-amber-700 mt-1">
                    $ {formatMoney(kpisMes.totalGastosOperativos)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Transporte, aseo y varios</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">3. Turnos y Nómina</div>
                  <div className="text-base sm:text-lg font-black font-mono text-blue-700 mt-1">
                    $ {formatMoney(kpisMes.totalTurnosNomina)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Pagos y vales de turno</div>
                </div>
              </div>

              {/* Sub-vista B: 328 Registros Cronológicos */}
              {consolidadoSubTab === 'CRONOLOGICO' && (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-2">
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar concepto (Hielo, Turno Andrés, Aguacate, Préstamo)..."
                          className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white outline-none text-slate-800"
                        />
                      </div>
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-md font-mono font-bold text-xs whitespace-nowrap">
                        Suma: $ {formatMoney(totalFilteredMoney)}
                      </div>
                    </div>
                  </div>

                  {/* Vista Móvil de Registro de Ítems (md:hidden) */}
                  <div className="grid grid-cols-1 gap-2 md:hidden">
                    {paginatedRegistros.map((r) => (
                      <div key={r.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">{r.concepto}</span>
                            <span className="text-[11px] text-slate-500 block truncate">{r.descripcion_beneficiario || r.categoria}</span>
                          </div>
                          <span className="font-mono font-black text-slate-900 shrink-0">
                            $ {formatMoney(r.valor_pagado)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenDaySheet(r.fecha)}
                              className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded cursor-pointer"
                            >
                              Día {String(r.dia_mes).padStart(2, '0')}
                            </button>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {r.clasificacion}
                            </span>
                            <span className="font-mono text-slate-400">{r.responsable_caja}</span>
                          </div>
                          {!isCerrado && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRegistro(r)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase">
                            <th className="py-2.5 px-3">Día</th>
                            <th className="py-2.5 px-3">Clasificación</th>
                            <th className="py-2.5 px-3">Categoría</th>
                            <th className="py-2.5 px-3">Concepto</th>
                            <th className="py-2.5 px-3">Descripción</th>
                            <th className="py-2.5 px-3 text-right">Valor Pagado</th>
                            <th className="py-2.5 px-3">Cajera</th>
                            <th className="py-2.5 px-2 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedRegistros.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 whitespace-nowrap font-mono font-bold text-indigo-600">
                                <button type="button" onClick={() => handleOpenDaySheet(r.fecha)}>
                                  Día {String(r.dia_mes).padStart(2, '0')}
                                </button>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  r.clasificacion.includes('Insumo') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  r.clasificacion.includes('Turno') || r.clasificacion.includes('Nómina') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {r.clasificacion}
                                </span>
                              </td>
                              <td className="py-2 px-3">{r.categoria}</td>
                              <td className="py-2 px-3 font-semibold text-slate-900">{r.concepto}</td>
                              <td className="py-2 px-3 text-slate-500 max-w-xs truncate">{r.descripcion_beneficiario}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                $ {formatMoney(r.valor_pagado)}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px]">{r.responsable_caja}</td>
                              <td className="py-2 px-2 text-center">
                                {!isCerrado && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRegistro(r)}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Eliminar registro"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Paginador */}
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-mono">Página {currentPage} de {totalPages}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 border rounded disabled:opacity-40"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1 border rounded disabled:opacity-40"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-vista C: Resumen Diario Totalizado */}
              {consolidadoSubTab === 'DIARIO' && (
                <>
                  {/* Tarjetas Móviles para Resumen Diario (md:hidden) */}
                  <div className="grid grid-cols-1 gap-2 md:hidden">
                    {diariosDelMes.length === 0 ? (
                      <div className="p-8 text-center bg-white border border-slate-200 rounded-lg text-slate-400 text-xs">
                        No hay hojas de flujo de caja registradas para {selectedMonthLabel}.
                      </div>
                    ) : (
                      [...diariosDelMes].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((d) => (
                        <div
                          key={d.id}
                          onClick={() => handleOpenDaySheet(d.fecha)}
                          className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs cursor-pointer active:bg-slate-50"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                Día {String(d.dia_mes).padStart(2, '0')} ({d.fecha})
                              </span>
                              <span className="block text-[10px] text-slate-500">
                                Encargada: {d.responsables_dia}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase block">Total Salidas</span>
                              <span className="font-mono font-black text-sm text-slate-900">
                                $ {formatMoney(d.total_salidas)}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 font-mono text-[10px]">
                            <div className="bg-slate-50 p-1.5 rounded">
                              <span className="font-sans text-slate-400 block">Insumos</span>
                              <span className="font-semibold text-emerald-700">${formatMoney(d.total_costos_insumos)}</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded">
                              <span className="font-sans text-slate-400 block">Gastos Op.</span>
                              <span className="font-semibold text-amber-700">${formatMoney(d.total_gastos_operativos)}</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded">
                              <span className="font-sans text-slate-400 block">Turnos</span>
                              <span className="font-semibold text-blue-700">${formatMoney(d.total_turnos_nomina)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase">
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3">Encargadas</th>
                            <th className="py-2.5 px-3 text-right">Insumos</th>
                            <th className="py-2.5 px-3 text-right">Gastos Op.</th>
                            <th className="py-2.5 px-3 text-right">Turnos</th>
                            <th className="py-2.5 px-3 text-right font-bold text-slate-900">Total Salidas</th>
                            <th className="py-2.5 px-3 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {diariosDelMes.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-10 text-slate-500">
                                <FileSpreadsheet className="w-7 h-7 mx-auto text-slate-300 mb-1.5" />
                                <p className="font-semibold text-slate-700 text-xs">No hay hojas de flujo de caja registradas para {selectedMonthLabel}.</p>
                                {!isCerrado && (
                                  <p className="text-[11px] text-slate-400 mt-1">
                                    Usa el botón &quot;+ Abrir Flujo de Caja&quot; para registrar el primer día del mes.
                                  </p>
                                )}
                              </td>
                            </tr>
                          ) : (
                            [...diariosDelMes].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((d) => (
                            <tr key={d.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleOpenDaySheet(d.fecha)}>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">Día {String(d.dia_mes).padStart(2, '0')} ({d.fecha})</td>
                              <td className="py-2 px-3 text-slate-500">{d.responsables_dia}</td>
                              <td className="py-2 px-3 text-right font-mono">$ {formatMoney(d.total_costos_insumos)}</td>
                              <td className="py-2 px-3 text-right font-mono">$ {formatMoney(d.total_gastos_operativos)}</td>
                              <td className="py-2 px-3 text-right font-mono">$ {formatMoney(d.total_turnos_nomina)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">$ {formatMoney(d.total_salidas)}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="text-orange-600 underline font-medium">Abrir</span>
                              </td>
                            </tr>
                          ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* CASO 2: VISTA DETALLE DE CADA DÍA (activeTabId !== null)            */
          /* Con contenedor lateral contraíble/desplegable sin '+'                */
          /* =================================================================== */
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Área Principal de la Hoja del Día (100% ancho, sin barra Hojas por Fecha) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 space-y-4 min-w-0">
              {/* Encabezado del Día */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono font-bold text-xs">
                      {formatDateTitle(activeTabId)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                      Usuario en Sesión: {currentSessionUser ? `${currentSessionUser.nombre_cajero} (CAJERO)` : `${globalAuthUser?.name?.toUpperCase() || 'ADMIN'} (ADMIN)`}
                    </span>
                    {sesionAbiertaDia && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        TURNO #{sesionAbiertaDia.numero_turno || 1} ABIERTO POR: {sesionAbiertaDia.cajero_nombre}
                      </span>
                    )}
                    {isFlujoPendienteRelevo && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        CIERRE PARCIAL ({ultimaSesionDia?.cajero_nombre}) • ESPERANDO RELEVO EN POS
                      </span>
                    )}
                    {isFlujoCerradoTotal && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                        FLUJO DEL DÍA CERRADO TOTALMENTE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Vista de auditoría y flujo diario sincronizada con ELIANA POS (los cierres parciales, totales y arqueos se realizan exclusivamente desde el POS).
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 font-semibold text-[11px] border border-emerald-200">
                    Sincronizado con POS
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadData(false)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs cursor-pointer"
                  >
                    Actualizar
                  </button>
                  {isFlujoCerradoTotal && isAdmin && activeSesion && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('¿Reabrir la última sesión de este flujo de caja para permitir nuevas salidas?')) {
                          fetch('/api/libros-apoyo', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'REOPEN_FLUJO_CAJA', sesion_id: activeSesion.id, fecha: activeTabId }),
                          }).then(() => loadData(true));
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 font-semibold text-xs cursor-pointer"
                    >
                      Reabrir (Admin)
                    </button>
                  )}
                </div>
              </div>

              {/* ============================================================= */}
              {/* HISTORIAL DE TURNOS / SESIONES DEL FLUJO DEL DÍA              */}
              {/* ============================================================= */}
              {sesionesDiaActivo.length > 0 && (
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                      <span>Sesiones y Entrega de Turnos del Día ({sesionesDiaActivo.length})</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Trazabilidad de efectivo recibido y entregado por cajero
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sesionesDiaActivo.map((ses: any, idx) => {
                      const isThisOpen = ses.estado === 'ABIERTA';
                      const isParcial = ses.estado === 'CERRADA_PARCIAL';
                      const sesStats = posDiaResumen?.porSesion?.[ses.id];

                      const baseIni = Number(ses.efectivo_inicial || 0);
                      const vEfectivo = sesStats ? Number(sesStats.ventasEfectivo || 0) : 0;
                      const cntEfectivo = sesStats ? Number(sesStats.cntEfectivo || 0) : 0;
                      const vDatafono = sesStats ? Number(sesStats.ventasDatafono || 0) : Number(ses.valor_datafonos || 0);
                      const cntDatafono = sesStats ? Number(sesStats.cntDatafono || 0) : 0;
                      const vTransf = sesStats ? Number(sesStats.ventasTransferencia || 0) : Number(ses.valor_otros_medios || 0);
                      const cntTransf = sesStats ? Number(sesStats.cntTransferencia || 0) : 0;
                      const vCredito = sesStats ? Number(sesStats.ventasCredito || 0) : 0;
                      const cntCredito = sesStats ? Number(sesStats.cntCredito || 0) : 0;
                      const entradasSes = sesStats ? Number(sesStats.entradasEfectivo || 0) : 0;
                      const salidasSes = sesStats ? Number(sesStats.salidasEfectivo || 0) : Number(ses.total_salidas || 0);

                      const efectivoEsperadoSes = baseIni + vEfectivo + entradasSes - salidasSes;
                      const efectivoContadoSes = Number(ses.efectivo_cierre || 0);
                      const posTurno = sesStats ? Number(sesStats.totalVendido || 0) : Number(ses.venta_pos || 0);
                      const cantOrdenesSes = sesStats ? Number(sesStats.cantidadOrdenes || 0) : 0;
                      const diffTurno = isThisOpen
                        ? 0
                        : ses.diferencia_cuadre !== undefined && ses.diferencia_cuadre !== null
                          ? Number(ses.diferencia_cuadre)
                          : efectivoContadoSes - efectivoEsperadoSes;

                      const horaOpen = ses.hora_apertura
                        ? new Date(ses.hora_apertura).toLocaleTimeString('es-CO', {
                            timeZone: 'America/Bogota',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';
                      const horaClose = ses.hora_cierre
                        ? new Date(ses.hora_cierre).toLocaleTimeString('es-CO', {
                            timeZone: 'America/Bogota',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'En curso';
                      const minsDur =
                        ses.duracion_minutos && Number(ses.duracion_minutos) > 0
                          ? Number(ses.duracion_minutos)
                          : ses.hora_apertura
                            ? Math.max(
                                1,
                                Math.round(
                                  ((ses.hora_cierre ? new Date(ses.hora_cierre).getTime() : Date.now()) -
                                    new Date(ses.hora_apertura).getTime()) /
                                    60_000
                                )
                              )
                            : 0;
                      const durStr =
                        minsDur >= 60
                          ? `${Math.floor(minsDur / 60)}h ${minsDur % 60}m`
                          : `${minsDur}m`;

                      return (
                        <div
                          key={ses.id}
                          className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-2.5 transition-all shadow-2xs ${
                            isThisOpen
                              ? 'bg-emerald-50/60 border-emerald-300'
                              : isParcial
                              ? 'bg-amber-50/50 border-amber-200'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between border-b border-slate-100 pb-2 gap-2">
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate text-xs">
                                Turno #{ses.numero_turno || idx + 1} • {ses.cajero_nombre}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                                {ses.caja_nombre || 'Caja Principal'} · Apertura {horaOpen} · Cierre {horaClose} · <strong>{durStr}</strong>
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                                isThisOpen
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : isParcial
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {isThisOpen ? 'En Turno Activo' : isParcial ? 'Cierre Parcial' : 'Cierre Total'}
                            </span>
                          </div>

                          {/* Desglose completo de medios de pago, cantidades, base y movimientos */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block font-sans">Base Inicial</span>
                              <span className="font-bold text-slate-800 block mt-0.5">${formatMoney(baseIni)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block font-sans">
                                Ventas Efectivo ({cntEfectivo})
                              </span>
                              <span className="font-bold text-emerald-700 block mt-0.5">${formatMoney(vEfectivo)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block font-sans">
                                Datáfonos ({cntDatafono})
                              </span>
                              <span className="font-bold text-indigo-700 block mt-0.5">${formatMoney(vDatafono)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block font-sans">
                                Transferencias ({cntTransf})
                              </span>
                              <span className="font-bold text-purple-700 block mt-0.5">${formatMoney(vTransf)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block font-sans">
                                Créditos ({cntCredito})
                              </span>
                              <span className="font-bold text-amber-700 block mt-0.5">${formatMoney(vCredito)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-rose-700 uppercase block font-sans">
                                Entradas / Salidas
                              </span>
                              <span className="font-bold text-slate-900 block mt-0.5">
                                +${formatMoney(entradasSes)} / -${formatMoney(salidasSes)}
                              </span>
                            </div>
                          </div>

                          {/* Pie de cuadre exacto del turno */}
                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block font-sans">
                                Venta POS ({cantOrdenesSes} facturas) · Esperado Caja: ${formatMoney(efectivoEsperadoSes)}
                              </span>
                              <span className="font-mono font-black text-xs text-slate-900">
                                POS: ${formatMoney(posTurno)} · Contado: {isThisOpen ? 'En curso' : `$${formatMoney(efectivoContadoSes)}`}
                              </span>
                            </div>
                            {!isThisOpen && (
                              <div className="text-right shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded font-mono font-black text-[11px] ${
                                    diffTurno === 0
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : diffTurno > 0
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {diffTurno === 0
                                    ? 'CUADRADA ($0)'
                                    : diffTurno > 0
                                      ? `SOBRANTE +$${formatMoney(diffTurno)}`
                                      : `FALTANTE -$${formatMoney(Math.abs(diffTurno))}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* PANEL DE CUADRE DE EFECTIVO Y VENTAS POS DEL DÍA              */}
              {/* ============================================================= */}
              {(() => {
                const baseDia = posDiaResumen ? Number(posDiaResumen.baseInicial || 0) : Number(activeSheet?.base_inicial || 0);
                const vEf = posDiaResumen ? Number(posDiaResumen.ventasEfectivo?.monto || 0) : Number(activeSheet?.venta_efectivo_pos || 0);
                const vEfCnt = posDiaResumen ? Number(posDiaResumen.ventasEfectivo?.cantidad || 0) : 0;
                const vDat = posDiaResumen ? Number(posDiaResumen.ventasDatafono?.monto || 0) : datafonosDia;
                const vDatCnt = posDiaResumen ? Number(posDiaResumen.ventasDatafono?.cantidad || 0) : 0;
                const vTr = posDiaResumen ? Number(posDiaResumen.ventasTransferencia?.monto || 0) : otrosMediosDia;
                const vTrCnt = posDiaResumen ? Number(posDiaResumen.ventasTransferencia?.cantidad || 0) : 0;
                const vCr = posDiaResumen ? Number(posDiaResumen.ventasCredito?.monto || 0) : 0;
                const vCrCnt = posDiaResumen ? Number(posDiaResumen.ventasCredito?.cantidad || 0) : 0;
                const totalPosDia = posDiaResumen ? Number(posDiaResumen.totalVendidoPos || 0) : ventaPosReal;
                const totalOrdenesDia = posDiaResumen ? Number(posDiaResumen.cantidadOrdenes || 0) : 0;
                const entradasDia = posDiaResumen ? Number(posDiaResumen.entradasEfectivo || 0) : 0;
                const salidasEfectivoDia = posDiaResumen ? Number(posDiaResumen.salidasEfectivo || 0) : salidasDia;
                const esperadoDia = posDiaResumen ? Number(posDiaResumen.efectivoEsperado || 0) : baseDia + vEf + entradasDia - salidasEfectivoDia;
                const contadoDia = posDiaResumen ? posDiaResumen.efectivoContado : (efectivoDia > 0 ? efectivoDia : null);
                const diffDia = contadoDia !== null ? contadoDia - esperadoDia : 0;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Bloque Izquierdo: Ecuación de Efectivo Físico en Caja */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-slate-800" />
                          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                            Cuadre de Efectivo en Caja ({activeTabId})
                          </h3>
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold">¿Concuerda el dinero físico?</span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">(+) Base Inicial en Caja</span>
                          <span className="font-mono font-bold text-slate-900">${formatMoney(baseDia)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">(+) Ventas en Efectivo POS ({vEfCnt} facturas)</span>
                          <span className="font-mono font-bold text-emerald-700">+${formatMoney(vEf)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">(+) Entradas de Efectivo (F7)</span>
                          <span className="font-mono font-bold text-blue-700">+${formatMoney(entradasDia)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-600">(-) Salidas / Recibos de Caja (F8)</span>
                          <span className="font-mono font-bold text-rose-700">-${formatMoney(salidasEfectivoDia)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-slate-100 font-bold">
                          <span className="text-slate-900">(=) Efectivo Esperado en Caja</span>
                          <span className="font-mono text-sm text-slate-900">${formatMoney(esperadoDia)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-slate-700 font-semibold">Efectivo Físico Contado en Arqueo POS</span>
                          <span className="font-mono font-bold text-slate-900">
                            {contadoDia !== null ? `$${formatMoney(contadoDia)}` : 'Turno en curso'}
                          </span>
                        </div>
                      </div>

                      {contadoDia !== null && (
                        <div
                          className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-between ${
                            diffDia === 0
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                              : diffDia > 0
                                ? 'bg-blue-50 text-blue-900 border border-blue-200'
                                : 'bg-rose-50 text-rose-900 border border-rose-200'
                          }`}
                        >
                          <span>Resultado del Arqueo</span>
                          <span className="font-mono">
                            {diffDia === 0
                              ? 'CUADRADA ($0)'
                              : diffDia > 0
                                ? `SOBRANTE +$${formatMoney(diffDia)}`
                                : `FALTANTE -$${formatMoney(Math.abs(diffDia))}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bloque Derecho: Ventas Totales POS por Medio de Pago */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 shadow-2xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                            Resumen Ventas POS por Medio de Pago
                          </h3>
                          <span className="text-[11px] font-bold text-slate-600">{totalOrdenesDia} facturas</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
                            <div className="text-[10px] font-bold text-emerald-800 uppercase">Efectivo ({vEfCnt})</div>
                            <div className="font-mono font-black text-sm text-emerald-900 mt-0.5">${formatMoney(vEf)}</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200">
                            <div className="text-[10px] font-bold text-indigo-800 uppercase">Datáfonos ({vDatCnt})</div>
                            <div className="font-mono font-black text-sm text-indigo-900 mt-0.5">${formatMoney(vDat)}</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-200">
                            <div className="text-[10px] font-bold text-purple-800 uppercase">Transferencias ({vTrCnt})</div>
                            <div className="font-mono font-black text-sm text-purple-900 mt-0.5">${formatMoney(vTr)}</div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200">
                            <div className="text-[10px] font-bold text-amber-800 uppercase">Créditos ({vCrCnt})</div>
                            <div className="font-mono font-black text-sm text-amber-900 mt-0.5">${formatMoney(vCr)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-bold text-slate-300 uppercase">Total Vendido POS del Día</div>
                          <div className="text-[11px] text-slate-400">Suma de todos los medios de pago</div>
                        </div>
                        <div className="font-mono font-black text-lg">${formatMoney(totalPosDia)}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ============================================================= */}
              {/* REGLAS ESTRICTAS DE FORMULARIO SEGÚN SESIÓN Y USUARIO          */}
              {/* ============================================================= */}
              {(isAdmin && !isFlujoCerradoTotal) || (sesionAbiertaDia && isMyOpenSession) ? (
                /* CASO A: El usuario logueado tiene su PROPIA sesión abierta hoy (o es Admin) -> Puede ingresar egresos */
                <form
                  onSubmit={(e) => handleAddQuickItem(e, activeTabId)}
                  className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-slate-700" />
                      <span>Registrar Salida de Caja en Mi Sesión ({activeTabId})</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold">
                      Sesión activa de: {sesionAbiertaDia?.cajero_nombre || currentCajeroName}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                    <select
                      value={quickClasificacion}
                      onChange={(e) => setQuickClasificacion(e.target.value)}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 text-slate-800"
                    >
                      {CLASIFICACIONES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    <select
                      value={quickCategoria}
                      onChange={(e) => setQuickCategoria(e.target.value)}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 text-slate-800"
                    >
                      {(CATEGORIAS_POR_CLASIFICACION[quickClasificacion] || categoriasList).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        list="conceptos-caja-list-active"
                        value={quickConcepto}
                        onChange={(e) => setQuickConcepto(e.target.value)}
                        placeholder="Ítem / Concepto (ej: Hielo, Turno Andrés, Aguacate)..."
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900"
                      />
                      <datalist id="conceptos-caja-list-active">
                        {conceptosSugeridos.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    <input
                      type="text"
                      value={quickDescripcion}
                      onChange={(e) => setQuickDescripcion(e.target.value)}
                      placeholder="Descripción / Beneficiario..."
                      className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
                    />

                    {/* Input formateado automáticamente en miles */}
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-full">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={quickValorFormatted}
                          onChange={(e) => setQuickValorFormatted(formatInputValueMoney(e.target.value))}
                          placeholder="Valor COP"
                          className="w-full min-h-[40px] pl-6 pr-2 py-1.5 rounded-lg border border-slate-200 font-mono font-bold text-xs text-slate-900"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingItem}
                        className="min-h-[40px] px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                      >
                        {savingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>Agregar</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : sesionAbiertaDia && !isMyOpenSession ? (
                /* CASO B: Hay una sesión abierta pero pertenece a OTRO cajero -> Bloqueado */
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-bold text-rose-900 text-xs uppercase flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-rose-600" />
                      <span>Flujo de Caja en Uso por {sesionAbiertaDia.cajero_nombre}</span>
                    </div>
                    <p className="text-xs text-rose-800">
                      Un usuario de caja solo puede ingresar egresos en su propia sesión abierta. Para que puedas recibir el turno e ingresar salidas, <strong>{sesionAbiertaDia.cajero_nombre}</strong> debe realizar primero un <strong>Cierre Parcial</strong>.
                    </p>
                  </div>
                </div>
              ) : isFlujoPendienteRelevo ? (
                /* CASO C: El flujo tuvo un Cierre Parcial del turno anterior -> Solicita recibir turno con Efectivo Inicial */
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-bold text-amber-900 text-xs uppercase flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-amber-700" />
                      <span>Cierre Parcial Realizado por {ultimaSesionDia?.cajero_nombre} • Esperando Relevo en POS</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      El turno anterior cerró su sesión reportando <strong>$ {formatMoney(ultimaSesionDia?.efectivo_cierre || 0)}</strong> en efectivo. El siguiente cajero debe abrir el nuevo turno directamente desde el aplicativo <strong>ELIANA POS</strong>.
                    </p>
                  </div>
                </div>
              ) : !isFlujoCerradoTotal && sesionesDiaActivo.length === 0 ? (
                /* CASO D: El flujo de este día aún no ha sido abierto por ningún cajero */
                <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-slate-600" />
                      <span>Sin Flujo de Caja Abierto en esta Fecha</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Para ingresar salidas de caja, presiona el botón <strong>&ldquo;Abrir Flujo de Caja&rdquo;</strong> ubicado arriba a la derecha para ingresar la base inicial.
                    </p>
                  </div>
                </div>
              ) : isFlujoCerradoTotal && (didUserParticipateInDay || isAdmin) ? (
                /* CASO E: El flujo ya se cerró totalmente y el usuario participó en el flujo (o es Admin) -> Puede ingresar AJUSTES auditables */
                <form
                  onSubmit={(e) => handleAddAjusteSubmit(e, activeTabId)}
                  className="bg-amber-50/70 border border-amber-300 rounded-xl p-3.5 space-y-2.5 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-700" />
                      <span>Flujo Cerrado Totalmente: Registrar Ajuste Posterior (Auditable)</span>
                    </span>
                    {/* Selector de Tipo de Ajuste: Discriminación estricta de Ingreso vs Egreso */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-amber-300 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setAjusteTipo('EGRESO')}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                          ajusteTipo === 'EGRESO'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Salida / Egreso (-)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAjusteTipo('INGRESO')}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                          ajusteTipo === 'INGRESO'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Entrada / Ingreso (+)
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-800">
                    {ajusteTipo === 'INGRESO'
                      ? 'Este ajuste registrará un dinero ingresado o recuperado en caja posterior al cierre.'
                      : 'Este ajuste registrará un gasto o salida adicional identificada posterior al cierre.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      required
                      value={ajusteConcepto}
                      onChange={(e) => setAjusteConcepto(e.target.value)}
                      placeholder={ajusteTipo === 'INGRESO' ? 'Concepto de ingreso (ej: Devolución compras, propina sobrante)...' : 'Motivo del ajuste (ej: Factura olvidada, compra no reportada)...'}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg border border-amber-200 bg-white text-xs text-slate-900 sm:col-span-2"
                    />
                    <input
                      type="text"
                      value={ajusteDescripcion}
                      onChange={(e) => setAjusteDescripcion(e.target.value)}
                      placeholder="Detalle / Beneficiario..."
                      className="min-h-[40px] px-3 py-1.5 rounded-lg border border-amber-200 bg-white text-xs text-slate-800"
                    />
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-full">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={ajusteValorFormatted}
                          onChange={(e) => setAjusteValorFormatted(formatInputValueMoney(e.target.value))}
                          placeholder="Valor Ajuste"
                          className="w-full min-h-[40px] pl-6 pr-2 py-1.5 rounded-lg border border-amber-200 bg-white font-mono font-bold text-xs text-slate-900"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingAjuste}
                        className={`min-h-[40px] px-3.5 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer flex items-center gap-1 ${
                          ajusteTipo === 'INGRESO' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-800 hover:bg-amber-900'
                        }`}
                      >
                        {savingAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Guardar {ajusteTipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* CASO F: El flujo está cerrado y este usuario NO participó en él -> Solo lectura */
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span>
                      Este flujo de caja ya fue cerrado totalmente y no tuviste sesión abierta en él. Vista de solo lectura.
                    </span>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* TABLA CON LA INFORMACIÓN QUE VA INGRESANDO EN ESTA HOJA        */}
              {/* ============================================================= */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Registros de Salidas y Ajustes de la Hoja ({registrosDiaActivo.length} ítems)
                  </span>
                  <span className="font-mono font-bold text-xs text-slate-900">
                    Total Hoja: $ {formatMoney(activeSheet?.total_salidas || 0)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Recibo</th>
                        <th className="py-2.5 px-3">Tipo / Clasificación</th>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3">Concepto</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3">Caja / Cajera</th>
                        <th className="py-2.5 px-3 text-right">Valor Pagado</th>
                        <th className="py-2.5 px-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {registrosDiaActivo.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No hay salidas registradas en este día. Usa el formulario de arriba para agregar.
                          </td>
                        </tr>
                      ) : (
                        registrosDiaActivo.map((r, idx) => (
                          <tr key={r.id} className={`hover:bg-slate-50 ${r.es_ajuste ? 'bg-amber-50/50' : ''}`}>
                            <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono text-[11px] font-bold text-slate-800">
                              {r.soporte_factura ? (
                                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                  {r.soporte_factura}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {r.es_ajuste ? (
                                <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[10px]">
                                  AJUSTE
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  r.clasificacion.includes('Insumo') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  r.clasificacion.includes('Turno') || r.clasificacion.includes('Nómina') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {r.clasificacion}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">{r.categoria}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{r.concepto}</td>
                            <td className="py-2 px-3 text-slate-500">{r.descripcion_beneficiario}</td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                              {r.caja_nombre || 'CAJA 1'} • {r.responsable_caja}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              $ {formatMoney(r.valor_pagado)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {/* El cajero solo puede eliminar salidas de su propia sesión ABIERTA; el Admin puede siempre */}
                              {(isAdmin || (sesionAbiertaDia && isMyOpenSession && r.sesion_id === sesionAbiertaDia.id)) && !isCerrado ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRegistro(r)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                                  title="Eliminar registro"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span title="Bloqueado por sesión o cierre" className="inline-flex items-center justify-center">
                                  <Lock className="w-3 h-3 text-slate-300 mx-auto" />
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ============================================================= */}
              {/* BITÁCORA CRONOLÓGICA DEL DÍA (POS + CAJA + AUDITORÍA)         */}
              {/* ============================================================= */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-700" />
                    <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Bitácora Cronológica del Día ({bitacoraDia.length} eventos)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(
                      [
                        { id: 'TODOS', label: 'Todos' },
                        { id: 'TURNO', label: 'Turnos' },
                        { id: 'MOVIMIENTO', label: 'Entradas / Salidas' },
                        { id: 'AUDITORIA', label: 'Auditoría POS' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setBitacoraFiltro(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition ${
                          bitacoraFiltro === f.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const filtrados = bitacoraDia.filter((ev) => {
                    if (bitacoraFiltro === 'TODOS') return true;
                    if (bitacoraFiltro === 'TURNO') return ev.tipo === 'TURNO';
                    if (bitacoraFiltro === 'MOVIMIENTO')
                      return ev.tipo === 'ENTRADA' || ev.tipo === 'SALIDA';
                    return ev.tipo === 'AUDITORIA';
                  });
                  if (filtrados.length === 0) {
                    return (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No hay eventos cronológicos registrados para este filtro en {activeTabId}.
                      </div>
                    );
                  }
                  return (
                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                      {filtrados.map((ev) => (
                        <div key={ev.id} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50/70">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="font-mono text-[11px] font-bold text-slate-500 shrink-0 mt-0.5">
                              {ev.hora || '—'}
                            </span>
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    ev.tipo === 'TURNO'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : ev.tipo === 'SALIDA'
                                        ? 'bg-rose-100 text-rose-800'
                                        : ev.tipo === 'ENTRADA'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {ev.tipo}
                                </span>
                                {ev.soporte && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-bold text-slate-800">
                                    {ev.soporte}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-slate-900">{ev.titulo}</span>
                              </div>
                              {ev.detalle && (
                                <p className="text-[11px] text-slate-600">{ev.detalle}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {typeof ev.monto === 'number' && ev.monto > 0 && (
                              <div className="font-mono font-bold text-xs text-slate-900">
                                ${formatMoney(ev.monto)}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500">{ev.usuario}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: ABRIR FLUJO DE CAJA O RECIBIR TURNO TRAS CIERRE PARCIAL       */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isAbrirFlujoModalOpen}
        onClose={() => setIsAbrirFlujoModalOpen(false)}
        title="Iniciar Sesión en Flujo de Caja del Día"
        icon={<Wallet className="w-5 h-5 text-orange-600" />}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleOpenFlujoCajaSubmit} className="space-y-4 py-2 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Fecha del Flujo de Caja
            </label>
            <input
              type="date"
              required
              value={flujoAperturaFecha}
              onChange={(e) => setFlujoAperturaFecha(e.target.value)}
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Usuario / Cajera Autenticada
            </label>
            <div className="w-full min-h-[40px] px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-100 font-bold text-xs text-slate-800 flex items-center justify-between">
              <span>{currentCajeroName}</span>
              <span className="text-[10px] text-emerald-700 font-semibold">TITULAR DEL TURNO</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Efectivo con el que Inicia su Sesión en Caja (Conteo Manual)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">$</span>
              <input
                type="text"
                inputMode="numeric"
                required
                value={flujoAperturaEfectivoInicial}
                onChange={(e) => setFlujoAperturaEfectivoInicial(formatInputValueMoney(e.target.value))}
                placeholder="200.000"
                className="w-full min-h-[42px] pl-7 pr-3 rounded-lg border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Si estás abriendo el día, es la base inicial. Si estás recibiendo un cambio de turno tras un Cierre Parcial, ingresa el efectivo físico que contaste al recibir la caja.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAbrirFlujoModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={openingFlujo}
              className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {openingFlujo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Iniciar Mi Sesión de Caja</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 2: CIERRE PARCIAL (ENTREGA TURNO) O CIERRE TOTAL DEL FLUJO      */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isCerrarFlujoModalOpen}
        onClose={() => setIsCerrarFlujoModalOpen(false)}
        title={
          flujoCierreTipo === 'PARCIAL'
            ? 'Cierre de Caja Parcial (Entrega de Turno)'
            : 'Cierre Total del Flujo de Caja del Día'
        }
        icon={<CheckSquare className="w-5 h-5 text-emerald-600" />}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCloseFlujoCajaSubmit} className="space-y-4 py-2 text-xs">
          {/* Selector de Tipo de Cierre */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFlujoCierreTipo('PARCIAL')}
              className={`py-2 px-3 rounded-md font-bold text-xs transition-all cursor-pointer ${
                flujoCierreTipo === 'PARCIAL'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Cierre Parcial (Turno)
            </button>
            <button
              type="button"
              onClick={() => setFlujoCierreTipo('TOTAL')}
              className={`py-2 px-3 rounded-md font-bold text-xs transition-all cursor-pointer ${
                flujoCierreTipo === 'TOTAL'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Cierre Total (Final Día)
            </button>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 space-y-1">
            <div className="font-bold text-slate-900">
              {flujoCierreTipo === 'PARCIAL'
                ? `Entrega parcial de turno por ${sesionAbiertaDia?.cajero_nombre || currentCajeroName} (${activeTabId})`
                : `Cierre definitivo del día por ${sesionAbiertaDia?.cajero_nombre || currentCajeroName} (${activeTabId})`}
            </div>
            <div className="text-[11px]">
              {flujoCierreTipo === 'PARCIAL'
                ? 'Cierra tu sesión actual ingresando el efectivo contado en caja. El flujo del día seguirá abierto para que el siguiente cajero ingrese y reciba el turno.'
                : 'Cierra completamente el flujo del día ingresando el efectivo final y el total de datáfonos. Al confirmar se mostrará la Venta POS y la diferencia.'}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              {flujoCierreTipo === 'PARCIAL'
                ? 'Efectivo que hay en Caja Manualmente (Al entregar turno)'
                : 'Efectivo Físico Final en Caja'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">$</span>
              <input
                type="text"
                inputMode="numeric"
                required
                value={flujoCierreEfectivoFisico}
                onChange={(e) => setFlujoCierreEfectivoFisico(formatInputValueMoney(e.target.value))}
                placeholder="Total billetes y monedas contados"
                className="w-full min-h-[42px] pl-7 pr-3 rounded-lg border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              <span>Valor Recibido en Datáfonos</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={flujoCierreDatafonos}
                onChange={(e) => setFlujoCierreDatafonos(formatInputValueMoney(e.target.value))}
                placeholder="Total vouchers de datáfono del turno"
                className="w-full min-h-[42px] pl-7 pr-3 rounded-lg border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-purple-600" />
              <span>Otros Medios de Pago / Nequi / Transferencias</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={flujoCierreOtrosMedios}
                onChange={(e) => setFlujoCierreOtrosMedios(formatInputValueMoney(e.target.value))}
                placeholder="Total Nequi / transferencias del turno"
                className="w-full min-h-[42px] pl-7 pr-3 rounded-lg border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Observaciones del Cierre (Opcional)
            </label>
            <textarea
              rows={2}
              value={flujoCierreObs}
              onChange={(e) => setFlujoCierreObs(e.target.value)}
              placeholder={
                flujoCierreTipo === 'PARCIAL'
                  ? 'Ej: Entrego turno a Carolina con efectivo contado...'
                  : 'Ej: Cierre total del día sin novedades...'
              }
              className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCerrarFlujoModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={closingFlujo}
              className={`px-5 py-2 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm ${
                flujoCierreTipo === 'PARCIAL'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {closingFlujo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>
                {flujoCierreTipo === 'PARCIAL'
                  ? 'Confirmar Cierre Parcial'
                  : 'Confirmar Cierre Total y Ver Cuadre POS'}
              </span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 3: CREAR NUEVA HOJA DE FECHA (ADMIN)                             */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isNewSheetModalOpen}
        onClose={() => setIsNewSheetModalOpen(false)}
        title="Abrir Nueva Hoja Diaria de Libro de Caja (Admin)"
        icon={<Calendar className="w-5 h-5 text-slate-700" />}
        maxWidth="max-w-md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newSheetDate) return;
            await fetch('/api/libros-apoyo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'CREATE_SHEET',
                fecha: newSheetDate,
                responsable_caja: cajeroActivo,
                base_inicial: 200000,
              }),
            });
            invalidateCache(CACHE_KEY);
            await loadData(true);
            setIsNewSheetModalOpen(false);
            handleOpenDaySheet(newSheetDate);
          }}
          className="space-y-4 py-2"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Fecha de la Hoja
            </label>
            <input
              type="date"
              required
              value={newSheetDate}
              onChange={(e) => setNewSheetDate(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Cajera Encargada
            </label>
            <select
              value={cajeroActivo}
              onChange={(e) => setCajeroActivo(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white"
            >
              {CAJEROS_OFICIALES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewSheetModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
            >
              Abrir Hoja
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 4: IMPORTADOR INTELIGENTE DE FLUJO DE CAJA (.TXT / IA) */}
      <ImportarFlujoCajaModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={async (count) => {
          invalidateCache(CACHE_KEY);
          await loadData(true);
          alert(`¡Importación completada! Se procesaron ${count} flujos de caja exitosamente.`);
        }}
      />
    </div>
  );
}


