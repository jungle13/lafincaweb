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
  ArrowLeft
} from 'lucide-react';
import SheetTabsBar from '@/components/sheets/SheetTabsBar';
import Modal from '@/components/ui/Modal';
import { formatMoney } from '@/lib/formatters';
import {
  LibroCajaKPIs,
  LibroCajaDiario,
  LibroCajaRegistro,
  LibroCajaSesion,
  LibroCajaUsuario,
} from '@/services/libroCajaService';
import { getCachedData, setCachedData, invalidateCache } from '@/lib/dataCache';

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
  'CAJA 1 (PRINCIPAL)',
  'CAJA 2 (AUXILIAR)',
  'CAJA 3 (PARRILLA / BAR)',
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

function LibrosApoyoContent() {
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

  // Mes seleccionado para el panel izquierdo (dinámico según la base de datos)
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');

  // Lista dinámica de meses disponibles en la base de datos
  const availableMonths = useMemo(() => {
    const monthNames: Record<string, string> = {
      '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
      '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
      '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
    };
    const counts = new Map<string, number>();
    for (const d of diarios) {
      if (!d.fecha) continue;
      const ym = d.fecha.slice(0, 7);
      counts.set(ym, (counts.get(ym) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ym, count]) => {
        const [year, month] = ym.split('-');
        return {
          key: ym,
          label: `${monthNames[month] || month} ${year}`,
          count,
        };
      });
  }, [diarios]);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.some((m) => m.key === selectedMonth)) {
      setSelectedMonth(availableMonths[0].key);
    }
  }, [availableMonths, selectedMonth]);

  // Hojas filtradas por el mes seleccionado en el panel izquierdo
  const diariosDelMes = useMemo(() => {
    if (!selectedMonth) return diarios;
    return diarios.filter((d) => d.fecha.startsWith(selectedMonth));
  }, [diarios, selectedMonth]);

  const selectedMonthLabel = useMemo(() => {
    return availableMonths.find((m) => m.key === selectedMonth)?.label || 'Octubre 2026';
  }, [availableMonths, selectedMonth]);

  // Control para Contraer / Desplegar contenedor lateral izquierdo de Hojas por Fecha
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Sistema de Pestañas
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null); // null = Vista Previa Consolidado

  // Sub-vista dentro del Consolidado Mensual
  const [consolidadoSubTab, setConsolidadoSubTab] = useState<'HOJAS_MES' | 'CRONOLOGICO' | 'DIARIO' | 'ENCARGADOS'>('HOJAS_MES');

  // Filtros en la vista Cronológica Global
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClasificacion, setSelectedClasificacion] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedResponsable, setSelectedResponsable] = useState('');
  const [selectedFechaFilter, setSelectedFechaFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 35;

  // Estado del Cajero y Caja Activa
  const [cajeroActivo, setCajeroActivo] = useState('JOHANNA');
  const [cajaActiva, setCajaActiva] = useState('CAJA 1 (PRINCIPAL)');

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
  const [savingAjuste, setSavingAjuste] = useState(false);

  // Estado de Arqueo Diario en la Hoja Activa (Vista Administradora)
  const [arqueoBase, setArqueoBase] = useState('200000');
  const [arqueoVentaPos, setArqueoVentaPos] = useState('0');
  const [arqueoEfectivoFisico, setArqueoEfectivoFisico] = useState('0');
  const [arqueoDatafonos, setArqueoDatafonos] = useState('0');
  const [arqueoEstado, setArqueoEstado] = useState('AUDITADA');
  const [savingArqueo, setSavingArqueo] = useState(false);

  // Modal Apertura de Flujo de Caja (Cajero)
  const [isAbrirFlujoModalOpen, setIsAbrirFlujoModalOpen] = useState(false);
  const [flujoAperturaFecha, setFlujoAperturaFecha] = useState('2026-10-26');
  const [flujoAperturaCaja, setFlujoAperturaCaja] = useState('CAJA 1 (PRINCIPAL)');
  const [flujoAperturaEfectivoInicial, setFlujoAperturaEfectivoInicial] = useState('200.000');
  const [openingFlujo, setOpeningFlujo] = useState(false);

  // Modal Cierre de Flujo de Caja (Cajero): soporta PARCIAL (entrega de turno) o TOTAL (cierre definitivo)
  const [isCerrarFlujoModalOpen, setIsCerrarFlujoModalOpen] = useState(false);
  const [flujoCierreTipo, setFlujoCierreTipo] = useState<'PARCIAL' | 'TOTAL'>('PARCIAL');
  const [flujoCierreEfectivoFisico, setFlujoCierreEfectivoFisico] = useState('');
  const [flujoCierreDatafonos, setFlujoCierreDatafonos] = useState('');
  const [flujoCierreObs, setFlujoCierreObs] = useState('');
  const [closingFlujo, setClosingFlujo] = useState(false);

  // Modal Nueva Hoja de Fecha (Administrador)
  const [isNewSheetModalOpen, setIsNewSheetModalOpen] = useState(false);
  const [newSheetDate, setNewSheetDate] = useState('2026-10-27');

  // Modal Importador Excel / IA
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
        if (u.caja_predeterminada && u.caja_predeterminada !== 'TODAS LAS CAJAS') {
          setCajaActiva(u.caja_predeterminada);
        }
      }
    } catch (e) {}
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/libros-apoyo?periodo_id=per-2026-10&t=${Date.now()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo cargar el Libro de Caja Menor');
      }
      setKpis(json.kpis);
      setDiarios(json.diarios || []);
      setRegistros(json.registros || []);
      setSesiones(json.sesiones || []);
      setUsuarios(json.usuarios || []);
      setCategoriasList(json.categorias || []);
      setResponsablesList(json.responsables?.length ? json.responsables : CAJEROS_OFICIALES);
      setConceptosSugeridos(json.conceptosSugeridos || []);

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
  }, []);

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
  const isAdmin = currentSessionUser?.rol === 'ADMIN' || !isCajeroModeUrl;

  const currentUsername = (currentSessionUser?.username || cajeroActivo || '').toLowerCase().trim();
  const currentCajeroName = (currentSessionUser?.nombre_cajero || cajeroActivo || '').toUpperCase().trim();

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
      setArqueoBase(String(activeSheet.base_inicial || 200000));
      setArqueoVentaPos(String(activeSheet.venta_pos_total || activeSheet.venta_efectivo_pos || 0));
      setArqueoEfectivoFisico(String(activeSheet.efectivo_fisico_cierre || 0));
      setArqueoDatafonos(String(activeSheet.total_datafonos || 0));
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
    return registros.filter((r) => {
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
  }, [registros, searchQuery, selectedClasificacion, selectedCategoria, selectedResponsable, selectedFechaFilter]);

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
    const datafonosNum = flujoCierreTipo === 'TOTAL' ? parseInputMoneyToNumber(flujoCierreDatafonos) : 0;

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
    if (!confirm(`¿Eliminar "${reg.concepto}" por $${formatMoney(reg.valor_pagado)} del día ${reg.fecha}?`)) return;
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
  const baseFlujo = Number(primeraSesionDia?.efectivo_inicial || activeSheet?.base_inicial || 200000);
  const totalSalidasCajaActiva = registrosDiaActivo
    .filter((r) => !r.es_ajuste)
    .reduce((a, b) => a + Number(b.valor_pagado || 0), 0);
  const totalAjustesCajaActiva = registrosDiaActivo
    .filter((r) => r.es_ajuste)
    .reduce((a, b) => a + Number(b.valor_pagado || 0), 0);

  const efectivoFisicoCajero = Number(ultimaSesionDia?.efectivo_cierre || activeSheet?.efectivo_fisico_cierre || 0);
  const datafonosCajero = sesionesDiaActivo.length > 0
    ? sesionesDiaActivo.reduce((a, s) => a + Number(s.valor_datafonos || 0), 0)
    : Number(activeSheet?.total_datafonos || 0);
  const ventaPosReal = Number(activeSheet?.venta_pos_total || activeSheet?.venta_efectivo_pos || 0);

  // Cuadre total: (Físico + Datáfonos + Salidas - Base Inicial) vs Venta POS
  const dineroRecaudadoCajero = efectivoFisicoCajero + datafonosCajero + totalSalidasCajaActiva - baseFlujo;
  const diferenciaCuadreCajero = dineroRecaudadoCajero - ventaPosReal;

  return (
    <div className="flex flex-col h-[calc(100dvh-53px)] md:h-[calc(100vh-57px)] -m-2.5 sm:-m-4 md:-m-6 -mb-20 md:mb-0 bg-slate-50 overflow-hidden font-normal text-xs">
      {/* 1. BARRA SUPERIOR DE PESTAÑAS (SheetTabsBar) */}
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
          rightAction={
            <div className="flex items-center gap-2 py-1">
              {/* Botón de Abrir Flujo de Caja */}
              <button
                type="button"
                onClick={() => setIsAbrirFlujoModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Abrir Flujo de Caja</span>
              </button>

              {/* Enlace / Botón al Portal de Login Cajero */}
              {currentSessionUser ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-semibold cursor-pointer"
                  title="Cerrar sesión de cajero"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir ({currentSessionUser.username})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/libros-apoyo/acceso')}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-md text-xs font-semibold cursor-pointer"
                  title="Acceso directo para cajeros con PIN"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Portal Cajero</span>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar Excel / IA</span>
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* 2. CUERPO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* =================================================================== */}
        {/* CASO 1: VISTA PREVIA CONSOLIDADO LIBRO CAJA MENOR (activeTabId === null) */}
        {/* Izquierda: Meses | Derecha: Lista de Hojas de Libro de Caja Menor    */}
        {/* =================================================================== */}
        {activeTabId === null ? (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-white overflow-hidden">
            {/* Panel Izquierdo: Lista de Meses (idéntico a Costeo Diario Cocina) */}
            <aside className="w-full md:w-56 p-4 border-r border-slate-200 bg-slate-50/60 shrink-0 space-y-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
                Meses
              </p>
              {availableMonths.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMonth(m.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium text-left transition-colors cursor-pointer ${
                    selectedMonth === m.key
                      ? 'bg-slate-200/80 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span>{m.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {m.count}
                  </span>
                </button>
              ))}
              {availableMonths.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-slate-400">
                  Sin meses registrados
                </div>
              )}
            </aside>

            {/* Panel Derecho: Lista de Hojas de Libro de Caja Menor */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {/* Encabezado Principal de Hojas */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                      Hojas de Libro de Caja Menor
                    </h1>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold">
                      {diariosDelMes.length} Hojas Activas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Selecciona una fecha para abrir su hoja detallada de caja, registrar gastos o auditar arqueo
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConsolidadoSubTab('HOJAS_MES')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors ${
                      consolidadoSubTab === 'HOJAS_MES'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Hojas por Fecha
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsolidadoSubTab('CRONOLOGICO')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors ${
                      consolidadoSubTab === 'CRONOLOGICO'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Registro 328 Ítems
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsolidadoSubTab('DIARIO')}
                    className={`px-3 py-1.5 rounded-md font-semibold text-xs border transition-colors ${
                      consolidadoSubTab === 'DIARIO'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Resumen Totalizado
                  </button>
                </div>
              </div>

              {/* 4 KPI Cards Resumen */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Salidas Caja (Mes)</div>
                  <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-1">
                    $ {formatMoney(kpis.totalSalidasMes)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{kpis.totalRegistros} salidas registradas</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">1. Insumos por Caja</div>
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-1">
                    $ {formatMoney(kpis.totalCostosInsumos)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Carnes, verduras y servicios</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">2. Gastos Operativos</div>
                  <div className="text-base sm:text-lg font-black font-mono text-amber-700 mt-1">
                    $ {formatMoney(kpis.totalGastosOperativos)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Transporte, aseo y varios</div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">3. Turnos y Nómina</div>
                  <div className="text-base sm:text-lg font-black font-mono text-blue-700 mt-1">
                    $ {formatMoney(kpis.totalTurnosNomina)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Pagos y vales de turno</div>
                </div>
              </div>

              {/* Sub-vista A: Lista de Tarjetas de Hojas de Libro de Caja */}
              {consolidadoSubTab === 'HOJAS_MES' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>Hojas de {selectedMonthLabel}:</span>
                    <span>Ordenadas desde la más reciente</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {[...diariosDelMes].reverse().map((d) => {
                      const sesDia = sesiones.filter((s) => s.fecha === d.fecha);
                      const sesAbierta = sesDia.find((s) => s.estado === 'ABIERTA');
                      const sesCerradaTotal = sesDia.find(
                        (s) => s.estado === 'CERRADA_TOTAL' || s.estado === 'CERRADA' || (s.estado !== 'ABIERTA' && s.tipo_cierre === 'TOTAL')
                      );
                      const sesParcial = !sesAbierta && !sesCerradaTotal && sesDia.some((s) => s.estado === 'CERRADA_PARCIAL');
                      return (
                        <div
                          key={d.id}
                          onClick={() => handleOpenDaySheet(d.fecha)}
                          className="bg-white hover:bg-slate-50/90 border border-slate-200 hover:border-slate-400 rounded-xl p-3.5 transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-3 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-sm text-slate-900 group-hover:text-orange-600 transition-colors">
                                  Día {String(d.dia_mes).padStart(2, '0')} • {d.fecha}
                                </span>
                                {sesAbierta && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">
                                    En Turno: {sesAbierta.cajero_nombre}
                                  </span>
                                )}
                                {sesParcial && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800">
                                    Cierre Parcial (Disponible Relevo)
                                  </span>
                                )}
                                {sesCerradaTotal && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-700">
                                    Cerrado Total
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Encargada: <strong className="text-slate-700">{d.responsables_dia || 'JOHANNA'}</strong>
                              </p>
                            </div>

                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 group-hover:text-orange-600">
                              <span>Abrir hoja</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 text-center font-mono">
                            <div className="bg-slate-50 p-1.5 rounded">
                              <span className="text-[9px] text-slate-400 block font-sans">Insumos</span>
                              <span className="font-bold text-emerald-800 text-xs">${formatMoney(d.total_costos_insumos)}</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded">
                              <span className="text-[9px] text-slate-400 block font-sans">Gastos</span>
                              <span className="font-bold text-amber-800 text-xs">${formatMoney(d.total_gastos_operativos)}</span>
                            </div>
                            <div className="bg-slate-50 p-1.5 rounded">
                              <span className="text-[9px] text-slate-400 block font-sans">Total Salidas</span>
                              <span className="font-bold text-slate-900 text-xs">${formatMoney(d.total_salidas)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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

                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
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
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRegistro(r)}
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
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
                        {diariosDelMes.map((d) => (
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* CASO 2: VISTA DETALLE DE CADA DÍA (activeTabId !== null)            */
          /* Con contenedor lateral contraíble/desplegable sin '+'                */
          /* =================================================================== */
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Contenedor Lateral Izquierdo de Hojas por Fecha (Contraíble) */}
            <aside
              className={`transition-all duration-300 bg-white border-r border-slate-200 shrink-0 flex flex-col overflow-hidden ${
                isSidebarOpen ? 'w-60' : 'w-0 border-r-0'
              }`}
            >
              {isSidebarOpen && (
                <>
                  <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                      <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                        Hojas por Fecha
                      </span>
                    </div>
                    {/* Botón para contraer el panel */}
                    <button
                      type="button"
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
                      title="Ocultar lista de días"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveTabId(null)}
                      className="w-full text-left px-2.5 py-2 rounded-md transition-colors flex items-center justify-between text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <span className="font-bold text-slate-900">Consolidado (Mes)</span>
                      <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {diarios.map((d) => {
                      const isSelected = activeTabId === d.fecha;
                      return (
                        <button
                          key={d.fecha}
                          type="button"
                          onClick={() => handleOpenDaySheet(d.fecha)}
                          className={`w-full text-left px-2.5 py-2 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-orange-50 border border-orange-200 text-slate-900 font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs truncate">
                              Día {String(d.dia_mes).padStart(2, '0')} • {d.fecha.slice(5)}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {d.responsables_dia || 'JOHANNA'}
                            </div>
                          </div>
                          <span className="font-mono text-[11px] font-semibold text-slate-800 shrink-0">
                            ${formatMoney(d.total_salidas)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </aside>

            {/* Área Principal de la Hoja del Día */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 space-y-4 min-w-0">
              {/* Botón Flotante / Visible para Desplegar el Panel si está cerrado */}
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-400 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
                >
                  <PanelLeftOpen className="w-4 h-4 text-slate-600" />
                  <span>Mostrar Hojas por Fecha</span>
                </button>
              )}

              {/* Encabezado del Día */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono font-bold text-xs">
                      {formatDateTitle(activeTabId)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                      Usuario en Sesión: {currentCajeroName} {isAdmin ? '(ADMIN)' : '(CAJERO)'}
                    </span>
                    {sesionAbiertaDia && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        TURNO #{sesionAbiertaDia.numero_turno || 1} ABIERTO POR: {sesionAbiertaDia.cajero_nombre}
                      </span>
                    )}
                    {isFlujoPendienteRelevo && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        CIERRE PARCIAL ({ultimaSesionDia?.cajero_nombre}) • ESPERANDO RELEVO
                      </span>
                    )}
                    {isFlujoCerradoTotal && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                        FLUJO DEL DÍA CERRADO TOTALMENTE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Un único flujo de caja por día con control de sesiones por usuario, cierres parciales (entrega de turno) y cierre total
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Si el usuario actual tiene la sesión ABIERTA (o es Admin y hay sesión abierta) */}
                  {sesionAbiertaDia && (isMyOpenSession || isAdmin) && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setFlujoCierreTipo('PARCIAL');
                          setIsCerrarFlujoModalOpen(true);
                        }}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Cierre Parcial (Entregar Turno)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFlujoCierreTipo('TOTAL');
                          setIsCerrarFlujoModalOpen(true);
                        }}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Cierre Total del Día</span>
                      </button>
                    </>
                  )}

                  {/* Si no hay sesiones hoy o está en Cierre Parcial esperando relevo */}
                  {!sesionAbiertaDia && !isFlujoCerradoTotal && (
                    <button
                      type="button"
                      onClick={() => {
                        setFlujoAperturaFecha(activeTabId);
                        if (isFlujoPendienteRelevo && ultimaSesionDia?.efectivo_cierre) {
                          setFlujoAperturaEfectivoInicial(formatMoney(ultimaSesionDia.efectivo_cierre));
                        } else {
                          setFlujoAperturaEfectivoInicial('200.000');
                        }
                        setIsAbrirFlujoModalOpen(true);
                      }}
                      className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>
                        {isFlujoPendienteRelevo
                          ? 'Recibir Turno (Relevo de Caja)'
                          : 'Abrir Flujo de Caja'}
                      </span>
                    </button>
                  )}

                  {/* Si el flujo ya fue cerrado totalmente */}
                  {isFlujoCerradoTotal && (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 border border-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Flujo Cerrado Total</span>
                      </span>
                      {isAdmin && activeSesion && (
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {sesionesDiaActivo.map((ses, idx) => {
                      const isThisOpen = ses.estado === 'ABIERTA';
                      const isParcial = ses.estado === 'CERRADA_PARCIAL';
                      return (
                        <div
                          key={ses.id}
                          className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-1.5 ${
                            isThisOpen
                              ? 'bg-emerald-50/60 border-emerald-300'
                              : isParcial
                              ? 'bg-amber-50/50 border-amber-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">
                              Turno #{ses.numero_turno || idx + 1} • {ses.cajero_nombre}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                isThisOpen
                                  ? 'bg-emerald-200 text-emerald-900'
                                  : isParcial
                                  ? 'bg-amber-200 text-amber-900'
                                  : 'bg-slate-200 text-slate-800'
                              }`}
                            >
                              {isThisOpen
                                ? 'En Turno Activo'
                                : isParcial
                                ? 'Cierre Parcial'
                                : 'Cierre Total'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-200/60 font-mono text-[11px]">
                            <div>
                              <span className="text-[9px] text-slate-500 block font-sans">Efectivo Inicial</span>
                              <span className="font-bold text-slate-900">${formatMoney(ses.efectivo_inicial)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 block font-sans">Salidas Turno</span>
                              <span className="font-bold text-rose-700">${formatMoney(ses.total_salidas)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 block font-sans">Efectivo Cierre</span>
                              <span className="font-bold text-slate-900">
                                {isThisOpen ? 'En curso' : `$${formatMoney(ses.efectivo_cierre)}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* PANEL DE CUADRE DE EFECTIVO DEL DÍA                           */}
              {/* ============================================================= */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-slate-800" />
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Cuadre de Efectivo del Flujo del Día ({activeTabId})
                    </h3>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleSaveArqueo}
                      disabled={savingArqueo}
                      className="flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
                    >
                      {savingArqueo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Guardar Arqueo Admin</span>
                    </button>
                  )}
                </div>

                {/* 5 Columnas de Flujo */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      (+) Base Inicial Día
                    </span>
                    <span className="font-mono font-black text-sm text-slate-900 mt-1 block">
                      $ {formatMoney(baseFlujo)}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      (-) Salidas Registradas
                    </span>
                    <span className="font-mono font-black text-sm text-rose-700 mt-1 block">
                      $ {formatMoney(totalSalidasCajaActiva)}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      (+) Efectivo Físico Cierre
                    </span>
                    <span className="font-mono font-black text-sm text-slate-900 mt-1 block">
                      {isFlujoCerradoTotal || isFlujoPendienteRelevo || isAdmin
                        ? `$ ${formatMoney(efectivoFisicoCajero)}`
                        : '•••••••• (Al cerrar)'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      (+) Recibido en Datáfonos
                    </span>
                    <span className="font-mono font-black text-sm text-indigo-700 mt-1 block">
                      {isFlujoCerradoTotal || isAdmin
                        ? `$ ${formatMoney(datafonosCajero)}`
                        : '•••••••• (Cierre Total)'}
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1 bg-slate-900 text-white p-2.5 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block">
                      Venta POS y Cuadre
                    </span>
                    {isFlujoCerradoTotal || isAdmin ? (
                      <div className="mt-1">
                        <div className="font-mono font-bold text-xs text-slate-200">
                          POS: $ {formatMoney(ventaPosReal)}
                        </div>
                        <div className={`font-mono font-black text-xs ${
                          diferenciaCuadreCajero === 0 ? 'text-emerald-400' : diferenciaCuadreCajero > 0 ? 'text-blue-400' : 'text-rose-400'
                        }`}>
                          {diferenciaCuadreCajero === 0 ? 'CUADRADA ($0)' : diferenciaCuadreCajero > 0 ? `SOBRANTE +$${formatMoney(diferenciaCuadreCajero)}` : `FALTANTE -$${formatMoney(Math.abs(diferenciaCuadreCajero))}`}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 mt-1 leading-tight">
                        Oculto hasta realizar el Cierre Total del flujo.
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                      <span>Cierre Parcial Realizado por {ultimaSesionDia?.cajero_nombre} • Turno Disponible</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      El turno anterior cerró su sesión reportando <strong>$ {formatMoney(ultimaSesionDia?.efectivo_cierre || 0)}</strong> en efectivo. Para empezar a registrar egresos en este flujo de caja, inicia tu sesión ingresando manualmente el efectivo con el que recibes la caja.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFlujoAperturaFecha(activeTabId);
                      setFlujoAperturaEfectivoInicial(formatMoney(ultimaSesionDia?.efectivo_cierre || 200000));
                      setIsAbrirFlujoModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-sm"
                  >
                    Recibir Turno e Ingresar Efectivo Inicial
                  </button>
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
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-700" />
                      <span>Flujo Cerrado Totalmente: Registrar Ajuste Posterior (Auditable)</span>
                    </span>
                    <span className="text-[11px] text-amber-800">
                      Los egresos regulares están bloqueados. Todo ingreso quedará guardado como <strong>[AJUSTE]</strong>.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      required
                      value={ajusteConcepto}
                      onChange={(e) => setAjusteConcepto(e.target.value)}
                      placeholder="Motivo del Ajuste (ej: Factura olvidada, propina adicional)..."
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
                        className="min-h-[40px] px-3.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        {savingAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Guardar Ajuste</span>
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
                              {(isAdmin || (sesionAbiertaDia && isMyOpenSession && r.sesion_id === sesionAbiertaDia.id)) ? (
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

          {flujoCierreTipo === 'TOTAL' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>Valor Completo Recibido en Datáfonos del Día</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={flujoCierreDatafonos}
                  onChange={(e) => setFlujoCierreDatafonos(formatInputValueMoney(e.target.value))}
                  placeholder="Total vouchers de datáfono del día"
                  className="w-full min-h-[42px] pl-7 pr-3 rounded-lg border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          )}

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
        title="Abrir Nueva Hoja Diaria de Caja Menor (Admin)"
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
      {/* MODAL 4: IMPORTADOR DRAG & DROP (EXCEL / IA)                           */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Libro de Caja Menor (Excel Maestro o Escaneo IA)"
        icon={<FileSpreadsheet className="w-5 h-5 text-slate-700" />}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 py-2 text-xs">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const buffer = await file.arrayBuffer();
                const wb = XLSX.read(buffer, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                alert(`Archivo leído: ${rows.length} filas.`);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-slate-900 rounded-xl p-6 text-center cursor-pointer bg-slate-50/70 transition-colors"
          >
            <Upload className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            <p className="font-bold text-slate-800 text-sm">
              Arrastra aquí tu archivo COSTOS_GASTOS_OCTUBRE_2026.xlsx o haz clic para seleccionarlo
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">
              O pega líneas escaneadas por IA:
            </label>
            <textarea
              rows={3}
              value={importTextRaw}
              onChange={(e) => setImportTextRaw(e.target.value)}
              placeholder="27/10/2026 | Costo / Insumo | Servicios | Hielo | Hielo en bolsa | 32000 | JOHANNA"
              className="w-full p-2.5 rounded-lg border border-slate-200 font-mono text-xs"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function LibrosApoyoPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
          <span className="text-xs font-medium">Cargando Libro de Caja Menor...</span>
        </div>
      }
    >
      <LibrosApoyoContent />
    </React.Suspense>
  );
}
