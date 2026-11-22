'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Bike,
  Boxes,
  ChefHat,
  Clock,
  CreditCard,
  Delete,
  DollarSign,
  Flame,
  History,
  Keyboard,
  Lock,
  LogOut,
  Maximize2,
  Minus,
  MonitorSmartphone,
  MoreVertical,
  Package,
  Pencil,
  Percent,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Scale,
  ScanBarcode,
  Search,
  Settings,
  ShieldAlert,
  Tag,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  Utensils,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/formatters';
import { getColombiaDateStr } from '@/lib/dateUtils';
import {
  DEFAULT_ELIANA_POS_CONFIG,
  loadElianaPosConfig,
  saveElianaPosConfig,
  type ElianaPosConfig,
} from '@/lib/posConfig';
import {
  lanGetState,
  lanPostAction,
  lanSyncSnapshot,
  openCashDrawer,
  printThermalTicket,
  readScaleWeightOnce,
  type ThermalTicketData,
  useBarcodeScanner,
} from '@/lib/posHardwareBridge';
import PosCashCutView from '@/components/pos/PosCashCutView';
import PosCreditsModal from '@/components/pos/PosCreditsModal';
import PosSalesHistoryView from '@/components/pos/PosSalesHistoryView';
import PosTerminalSettingsModal from '@/components/pos/PosTerminalSettingsModal';
import PosProductsModule from '@/components/pos/PosProductsModule';
import PosCashFlowModal from '@/components/pos/PosCashFlowModal';
import PosInventoryModule from '@/components/pos/PosInventoryModule';
import PosCheckoutModal from '@/components/pos/PosCheckoutModal';
import PosSupervisorPinModal from '@/components/pos/PosSupervisorPinModal';
import { PosExitConfirmModal, PosOpenShiftGate } from '@/components/pos/PosShiftGateModal';
import ElianaBrandLogo from '@/components/brand/ElianaBrandLogo';
import { formatDurationHMS, isTauriDesktop } from '@/lib/empresaConfig';
import {
  getLocalIpAddress,
  getOrCreateDeviceId,
  setBoundTerminalCajaNombre,
} from '@/lib/terminalIdentity';
import type {
  CierreResumen,
  ClienteCreditoResumen,
  CorteDepartamento,
  DevolucionDia,
  EventoTurno,
  FlujoEfectivoRow,
  InventarioMovimiento,
  OperarioPos,
  PosCaja,
  PosCategoria,
  PosMesa,
  PosOrden,
  PosOrdenItem,
  PosOrdenPago,
  PosTab,
  ProductoVenta,
  SesionCaja,
} from '@/components/pos/types';

interface OfflineOp {
  id: string;
  action: string;
  payload: Record<string, unknown>;
}

interface LastPaymentMemory {
  total: number;
  pagoCon: number;
  cambio: number;
  consecutivo: string;
  ticketData?: ThermalTicketData;
}

const OFFLINE_QUEUE_KEY = 'eliana_pos_offline_queue_v1';
const LAST_PAYMENT_KEY = 'eliana_pos_last_payment_v1';

function getOrdenTabLabel(orden: PosOrden): string {
  if (orden.canal_venta === 'SALON_MESA' && orden.mesa_numero) {
    return `Mesa ${orden.mesa_numero}`;
  }
  if (orden.canal_venta === 'DOMICILIO') {
    return `Dom. ${orden.cliente_nombre?.split(' ')[0] || orden.consecutivo}`;
  }
  return `Mostrador ${orden.consecutivo.split('-').pop() || ''}`;
}

export default function ElianaPosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fallbackUser = user?.name || user?.username || 'Cajero Principal';
  const canEditProducts = user?.role !== 'OPERATIVO_POS';

  const [posConfig, setPosConfig] = useState<ElianaPosConfig>(DEFAULT_ELIANA_POS_CONFIG);
  const [activeTab, setActiveTab] = useState<PosTab>('VENTAS');
  const [touchMode, setTouchMode] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [lanConnected, setLanConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  // Datos principales
  const [mesas, setMesas] = useState<PosMesa[]>([]);
  const [ordenes, setOrdenes] = useState<PosOrden[]>([]);
  const [productos, setProductos] = useState<ProductoVenta[]>([]);
  const [sesionActiva, setSesionActiva] = useState<SesionCaja | null>(null);
  const [salidasDiaCaja, setSalidasDiaCaja] = useState(0);
  const [abonosEfectivoHoy, setAbonosEfectivoHoy] = useState(0);
  const [entradasEfectivoHoy, setEntradasEfectivoHoy] = useState(0);
  const [devolucionesEfectivoHoy, setDevolucionesEfectivoHoy] = useState(0);
  const [eventosTurno, setEventosTurno] = useState<EventoTurno[]>([]);
  const [creditosClientes, setCreditosClientes] = useState<ClienteCreditoResumen[]>([]);
  const [devolucionesDia, setDevolucionesDia] = useState<DevolucionDia[]>([]);
  const [corteDepartamentos, setCorteDepartamentos] = useState<CorteDepartamento[]>([]);
  const [flujoEfectivoDetallado, setFlujoEfectivoDetallado] = useState<FlujoEfectivoRow[]>([]);
  const [consumosInternosHoy, setConsumosInternosHoy] = useState<PosOrden[]>([]);
  const [gananciaEstimadaHoy, setGananciaEstimadaHoy] = useState(0);
  const [movimientosInventario, setMovimientosInventario] = useState<InventarioMovimiento[]>([]);
  const [jornadaCerradaTotal, setJornadaCerradaTotal] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOp[]>([]);
  const [forceCloseMode, setForceCloseMode] = useState(false);
  const [shiftNowMs, setShiftNowMs] = useState<number>(() => Date.now());

  // Navegación / selección
  const [zonaFiltro, setZonaFiltro] = useState('Todas');
  const [ordenActivaId, setOrdenActivaId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [captureInput, setCaptureInput] = useState('');
  const [catFiltro, setCatFiltro] = useState('TODAS');
  const [navZone, setNavZone] = useState<'SEARCH' | 'CATEGORIES' | 'PRODUCTS' | 'TICKET'>('SEARCH');
  const [focusedProductIndex, setFocusedProductIndex] = useState(0);
  const [mesasNavZone, setMesasNavZone] = useState<'NONE' | 'ZONES' | 'TABLES' | 'MOSTRADOR'>('NONE');
  const [focusedMesaIndex, setFocusedMesaIndex] = useState(0);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const productCardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const categoryBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const ticketRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const nuevoTicketBtnRef = useRef<HTMLButtonElement | null>(null);
  const ventaMostradorBtnRef = useRef<HTMLButtonElement | null>(null);
  const zonaBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mesaCardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [lastPayment, setLastPayment] = useState<LastPaymentMemory>({
    total: 0,
    pagoCon: 0,
    cambio: 0,
    consecutivo: '',
  });

  // Modales y Terminal Multi-Caja
  const [showCobroModal, setShowCobroModal] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [ipLocal, setIpLocal] = useState('127.0.0.1');
  const [boundCaja, setBoundCaja] = useState<PosCaja | null>(null);
  const [cajasLibres, setCajasLibres] = useState<PosCaja[]>([]);
  const [cajasAbiertasHoy, setCajasAbiertasHoy] = useState<string[]>([]);

  const [showAsignarClienteModal, setShowAsignarClienteModal] = useState(false);
  const [asignarNombre, setAsignarNombre] = useState('');
  const [asignarTel, setAsignarTel] = useState('');

  const [showDomicilioModal, setShowDomicilioModal] = useState(false);
  const [domNombre, setDomNombre] = useState('');
  const [domTelefono, setDomTelefono] = useState('');
  const [domDireccion, setDomDireccion] = useState('');
  const [domCostoEnvio, setDomCostoEnvio] = useState(4000);
  const [domRepartidor, setDomRepartidor] = useState('Domiciliario 1');

  const [showBuscarModal, setShowBuscarModal] = useState(false);
  const [buscarQuery, setBuscarQuery] = useState('');
  const [buscarIndex, setBuscarIndex] = useState(0);

  const [showVerificadorModal, setShowVerificadorModal] = useState(false);
  const [verificadorQuery, setVerificadorQuery] = useState('');

  const [showVariosModal, setShowVariosModal] = useState(false);
  const [variosNombre, setVariosNombre] = useState('Artículo Varios');
  const [variosCantidad, setVariosCantidad] = useState(1);
  const [variosPrecio, setVariosPrecio] = useState(5000);

  const [showMayoreoModal, setShowMayoreoModal] = useState(false);
  const [mayoreoCantidad, setMayoreoCantidad] = useState(1);
  const [mayoreoPrecio, setMayoreoPrecio] = useState(0);
  const [mayoreoNotas, setMayoreoNotas] = useState('');

  const [showArtComunModal, setShowArtComunModal] = useState(false);
  const [showVentasDiaModal, setShowVentasDiaModal] = useState(false);
  const [showCreditosModal, setShowCreditosModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showCancelarTicketModal, setShowCancelarTicketModal] = useState(false);
  const [operarios, setOperarios] = useState<OperarioPos[]>([]);
  const [categorias, setCategorias] = useState<PosCategoria[]>([]);
  const [showMoreToolsMenu, setShowMoreToolsMenu] = useState(false);
  const [showAsignarMesaModal, setShowAsignarMesaModal] = useState(false);
  const [focusedAsignarMesaIdx, setFocusedAsignarMesaIdx] = useState(0);
  const asignarMesaBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [domModoConversion, setDomModoConversion] = useState(false);
  const [showAsignarMeseroModal, setShowAsignarMeseroModal] = useState(false);
  const [focusedMeseroIdx, setFocusedMeseroIdx] = useState(0);
  const [showReenviarComandaModal, setShowReenviarComandaModal] = useState(false);
  const [reenviarComandaFocusBtn, setReenviarComandaFocusBtn] = useState<'CANCEL' | 'CONFIRM'>('CONFIRM');
  const [domDistanciaInfo, setDomDistanciaInfo] = useState<string>('');
  const [calcDomLoading, setCalcDomLoading] = useState(false);
  const [notaItemTarget, setNotaItemTarget] = useState<PosOrdenItem | null>(null);
  const [notaItemText, setNotaItemText] = useState('');

  const [cashFlowModal, setCashFlowModal] = useState<'ENTRADA' | 'SALIDA' | null>(null);

  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const buscarInputRef = useRef<HTMLInputElement | null>(null);
  const verificadorInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [failedPrints, setFailedPrints] = useState<Array<{ id: string; ticket: ThermalTicketData; error: string }>>([]);
  const [supervisorPrompt, setSupervisorPrompt] = useState<{
    actionLabel: string;
    resolve: (pin: string | null) => void;
  } | null>(null);

  const cajaNombre = boundCaja?.nombre || posConfig.nombreCaja || 'CAJA PRINCIPAL';
  const cajeroNombre = sesionActiva?.cajero_nombre || fallbackUser;
  const noSpinnerClass =
    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  const notify = useCallback((type: 'ok' | 'err', text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const requestSupervisorPin = useCallback((actionLabel: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setSupervisorPrompt({ actionLabel, resolve });
    });
  }, []);

  const safePrintTicket = useCallback(
    async (ticket: ThermalTicketData) => {
      const res = await printThermalTicket(ticket);
      if (!res.ok) {
        const errMsg = res.error || 'Error de conexión con impresora térmica';
        setFailedPrints((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ticket, error: errMsg },
        ]);
        notify('err', `Error imprimiendo: ${errMsg}`);
      }
      return res;
    },
    [notify]
  );

  const focusCapture = useCallback(() => {
    setTimeout(() => captureInputRef.current?.focus(), 40);
  }, []);

  const toggleBrowserFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const refreshTerminalCajas = useCallback(async (devId: string, ip: string) => {
    try {
      const res = await fetch(`/api/pos/cajas?device_id=${encodeURIComponent(devId)}&ip=${encodeURIComponent(ip)}`);
      const data = await res.json();
      if (data.success) {
        const bound = ((data.boundCaja || data.caja) as PosCaja | null) || null;
        setBoundCaja(bound);
        setCajasLibres((data.cajasLibres as PosCaja[]) || []);
        if (bound?.nombre) {
          setBoundTerminalCajaNombre(bound.nombre);
        }
      }
    } catch {
      // ignore offline error
    }
  }, []);

  useEffect(() => {
    setPosConfig(loadElianaPosConfig());
    const dId = getOrCreateDeviceId();
    setDeviceId(dId);
    getLocalIpAddress().then((ip) => {
      setIpLocal(ip);
      void refreshTerminalCajas(dId, ip);
    });
    try {
      const savedQ = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (savedQ) setOfflineQueue(JSON.parse(savedQ));
      const savedLast = localStorage.getItem(LAST_PAYMENT_KEY);
      if (savedLast) setLastPayment(JSON.parse(savedLast));
    } catch {
      // ignore storage errors
    }
  }, [refreshTerminalCajas]);

  const applyPosPayload = useCallback((data: Record<string, unknown>) => {
    setMesas((data.mesas as PosMesa[]) || []);
    setOrdenes((data.ordenes as PosOrden[]) || []);
    if (Array.isArray(data.productos)) setProductos(data.productos as ProductoVenta[]);
    setSesionActiva((data.sesionActiva as SesionCaja) || null);
    setSalidasDiaCaja(Number(data.salidasDiaCaja || 0));
    setAbonosEfectivoHoy(Number(data.abonosEfectivoHoy || 0));
    setEntradasEfectivoHoy(Number(data.entradasEfectivoHoy || 0));
    setDevolucionesEfectivoHoy(Number(data.devolucionesEfectivoHoy || 0));
    setEventosTurno((data.eventosTurno as EventoTurno[]) || []);
    if (Array.isArray(data.creditosClientes)) setCreditosClientes(data.creditosClientes as ClienteCreditoResumen[]);
    setDevolucionesDia((data.devolucionesDia as DevolucionDia[]) || []);
    setCorteDepartamentos((data.corteDepartamentos as CorteDepartamento[]) || []);
    setFlujoEfectivoDetallado((data.flujoEfectivoDetallado as FlujoEfectivoRow[]) || []);
    setConsumosInternosHoy((data.consumosInternosHoy as PosOrden[]) || []);
    setGananciaEstimadaHoy(Number(data.gananciaEstimadaHoy || 0));
    if (Array.isArray(data.movimientosInventario)) setMovimientosInventario(data.movimientosInventario as InventarioMovimiento[]);
    if (Array.isArray(data.operarios)) setOperarios(data.operarios as OperarioPos[]);
    if (Array.isArray(data.categorias)) setCategorias(data.categorias as PosCategoria[]);
    if (Array.isArray(data.cajasAbiertasHoy)) setCajasAbiertasHoy(data.cajasAbiertasHoy as string[]);
    setJornadaCerradaTotal(Boolean(data.jornadaCerradaTotal));
  }, []);

  const fetchPosState = useCallback(async (scope: 'live' | 'full' = 'live') => {
    const fechaHoy = getColombiaDateStr();
    try {
      const res = await fetch(`/api/pos?fecha=${fechaHoy}&caja=${encodeURIComponent(cajaNombre)}&scope=${scope}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.success) {
        applyPosPayload(data);
        setLanConnected(false);
        if (posConfig.rolTerminal === 'PRINCIPAL') {
          lanSyncSnapshot(posConfig.ipCajaPrincipal, data);
        }
        return;
      }
    } catch {
      const lanData = await lanGetState(posConfig.ipCajaPrincipal);
      if (lanData) {
        applyPosPayload(lanData);
        setLanConnected(true);
        notify('ok', 'Operando en Red Local LAN (sin internet).');
      } else {
        notify('err', 'Sin conexión al servidor ni a Caja Principal LAN.');
      }
    } finally {
      setLoading(false);
    }
  }, [cajaNombre, posConfig.rolTerminal, posConfig.ipCajaPrincipal, applyPosPayload, notify]);

  useEffect(() => {
    void fetchPosState('full');
  }, [fetchPosState]);

  // Sincronización periódica multi-caja en vistas compartidas (Mesas, Domicilios, Ventas) y al recuperar foco
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void fetchPosState('live');
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchPosState]);

  useEffect(() => {
    if (activeTab !== 'MESAS' && activeTab !== 'DOMICILIOS' && activeTab !== 'VENTAS_DIA') return;
    const timer = setInterval(() => {
      if (navigator.onLine) {
        void fetchPosState('live');
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [activeTab, fetchPosState]);

  const executePosAction = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const needsIdemp = action === 'REGISTRAR_PAGO_PARCIAL' || action === 'MOVIMIENTO_EFECTIVO_CAJA';
      const idempKey =
        needsIdemp && !payload.idempotency_key && typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : payload.idempotency_key;

      const fullPayload: Record<string, unknown> = {
        action,
        caja_nombre: cajaNombre,
        caja_id: boundCaja?.id || null,
        sesion_caja_id: sesionActiva?.id || null,
        cajero_nombre: cajeroNombre,
        ...payload,
        ...(idempKey ? { idempotency_key: idempKey } : {}),
      };

      if (!navigator.onLine) {
        const lanRes = await lanPostAction(posConfig.ipCajaPrincipal, fullPayload);
        if (lanRes?.success) {
          setLanConnected(true);
          notify('ok', 'Operación guardada en Caja Principal (LAN sin internet).');
          return { success: true, lan: true };
        }
        const queued: OfflineOp = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action,
          payload: fullPayload,
        };
        const updated = [...offlineQueue, queued];
        setOfflineQueue(updated);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
        notify('ok', `Guardado en respaldo local (${updated.length} en cola).`);
        return { success: true, offline: true };
      }

      const sendReq = async (bodyObj: Record<string, unknown>) => {
        const res = await fetch('/api/pos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj),
          signal: AbortSignal.timeout(12000),
        });
        return res.json();
      };

      let data = await sendReq(fullPayload);
      if (!data.success && data.code === 'SUPERVISOR_PIN_REQUIRED') {
        const pin = await requestSupervisorPin(action);
        if (!pin) throw new Error('Operación cancelada: requiere PIN de Supervisor.');
        data = await sendReq({ ...fullPayload, supervisor_pin: pin });
      }
      if (!data.success) throw new Error(data.error || 'Error en operación POS');
      return data;
    },
    [cajaNombre, boundCaja?.id, sesionActiva?.id, cajeroNombre, posConfig.ipCajaPrincipal, offlineQueue, notify, requestSupervisorPin]
  );

  const syncOfflineQueue = useCallback(async () => {
    if (!navigator.onLine || offlineQueue.length === 0) return;
    let synced = 0;
    const remaining: OfflineOp[] = [];
    for (const op of offlineQueue) {
      try {
        const res = await fetch('/api/pos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.payload),
        });
        const data = await res.json();
        if (data.success) synced++;
        else remaining.push(op);
      } catch {
        remaining.push(op);
      }
    }
    setOfflineQueue(remaining);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    if (synced > 0) {
      notify('ok', `${synced} operación(es) offline sincronizada(s).`);
      fetchPosState();
    }
  }, [offlineQueue, notify, fetchPosState]);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const goOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
      fetchPosState();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [syncOfflineQueue, fetchPosState]);

  const prodStockMap = useMemo(() => {
    const m = new Map<string, number>();
    productos.forEach((p) => m.set(p.id, Number(p.existencia ?? 0)));
    return m;
  }, [productos]);

  const ordenesAbiertas = useMemo(
    () => ordenes.filter((o) => o.estado === 'ABIERTA' || o.estado === 'PRECUENTA'),
    [ordenes]
  );
  const ordenesFacturadasHoy = useMemo(
    () => ordenes.filter((o) => o.estado === 'FACTURADA' && o.metodo_pago !== 'CONSUMO_INTERNO'),
    [ordenes]
  );
  const ordenActiva = useMemo(
    () => ordenesAbiertas.find((o) => o.id === ordenActivaId) || ordenesAbiertas[0] || null,
    [ordenesAbiertas, ordenActivaId]
  );

  useEffect(() => {
    if (!ordenActivaId && ordenesAbiertas.length > 0) {
      setOrdenActivaId(ordenesAbiertas[0].id);
    }
  }, [ordenActivaId, ordenesAbiertas]);

  const itemsActivos = useMemo(
    () => (ordenActiva?.items || []).filter((i) => i.estado_comanda !== 'ANULADO'),
    [ordenActiva]
  );

  useEffect(() => {
    if (itemsActivos.length === 0) setSelectedItemId(null);
    else if (!selectedItemId || !itemsActivos.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(itemsActivos[itemsActivos.length - 1].id);
    }
  }, [itemsActivos, selectedItemId]);

  const categoriasProductos = useMemo(() => {
    const cats = new Set<string>();
    productos.forEach((p) => cats.add(p.categoria || 'General'));
    return ['TODAS', ...Array.from(cats)];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = captureInput.trim().toLowerCase();
    return productos.filter((p) => {
      const okCat = catFiltro === 'TODAS' || (p.categoria || 'General') === catFiltro;
      const okQ = !q || p.nombre.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q);
      return okCat && okQ;
    });
  }, [productos, catFiltro, captureInput]);

  const productosBusquedaModal = useMemo(() => {
    const q = buscarQuery.trim().toLowerCase();
    if (!q) return productos.slice(0, 30);
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q))
      .slice(0, 30);
  }, [productos, buscarQuery]);

  const productosComunes = useMemo(() => productos.slice(0, 12), [productos]);

  const verificadorMatch = useMemo(() => {
    const q = verificadorQuery.trim().toLowerCase();
    if (!q) return [];
    return productos
      .filter((p) => p.nombre.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [productos, verificadorQuery]);

  const zonasDisponibles = useMemo(() => ['Todas', ...(posConfig.zonasMesas || [])], [posConfig.zonasMesas]);

  const mesasFiltradas = useMemo(() => {
    if (zonaFiltro === 'Todas') return mesas;
    return mesas.filter((m) => m.zona === zonaFiltro);
  }, [mesas, zonaFiltro]);

  const ordenesDomicilio = useMemo(
    () => ordenes.filter((o) => o.canal_venta === 'DOMICILIO' && o.estado !== 'ANULADA'),
    [ordenes]
  );

  const resumenDia = useMemo(() => {
    const totalPunto = ordenesFacturadasHoy
      .filter((o) => o.canal_venta !== 'DOMICILIO')
      .reduce((acc, o) => acc + Number(o.gran_total || 0), 0);
    const totalDomicilios = ordenesFacturadasHoy
      .filter((o) => o.canal_venta === 'DOMICILIO')
      .reduce((acc, o) => acc + Number(o.gran_total || 0), 0);
    const totalPropinas = ordenesFacturadasHoy.reduce((acc, o) => acc + Number(o.propina || 0), 0);
    const totalEfectivo = ordenesFacturadasHoy.reduce((acc, o) => acc + Number(o.pago_efectivo || 0), 0);
    const totalDatafono = ordenesFacturadasHoy.reduce((acc, o) => acc + Number(o.pago_datafono || 0), 0);
    const totalTransferencia = ordenesFacturadasHoy.reduce(
      (acc, o) => acc + Number(o.pago_transferencia || 0),
      0
    );
    return {
      totalPunto,
      totalDomicilios,
      totalPropinas,
      totalEfectivo,
      totalDatafono,
      totalTransferencia,
      cantidadFacturas: ordenesFacturadasHoy.length,
    };
  }, [ordenesFacturadasHoy]);

  const handleAbrirMesa = async (mesa: PosMesa) => {
    if (mesa.orden_activa_id && mesa.orden_activa) {
      setOrdenActivaId(mesa.orden_activa.id);
      setActiveTab('VENTAS');
      focusCapture();
      return;
    }
    setBusyAction(true);
    try {
      const res = await executePosAction('ABRIR_O_AGREGAR_ORDEN', {
        canal_venta: 'SALON_MESA',
        mesa_numero: mesa.numero,
        mesero_nombre: cajeroNombre,
        items: [],
      });
      await fetchPosState();
      if (res.orden?.id) setOrdenActivaId(res.orden.id);
      setActiveTab('VENTAS');
      focusCapture();
      notify('ok', `Mesa ${mesa.numero} abierta.`);
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error abriendo mesa');
    } finally {
      setBusyAction(false);
    }
  };

  const handleNuevaVentaMostrador = useCallback(async () => {
    setBusyAction(true);
    try {
      const res = await executePosAction('ABRIR_O_AGREGAR_ORDEN', {
        canal_venta: 'MOSTRADOR_LLEVAR',
        items: [],
      });
      await fetchPosState();
      if (res.orden?.id) setOrdenActivaId(res.orden.id);
      setActiveTab('VENTAS');
      focusCapture();
      notify('ok', 'Nuevo ticket abierto.');
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error creando ticket');
    } finally {
      setBusyAction(false);
    }
  }, [executePosAction, fetchPosState, focusCapture, notify]);

  const handleAgregarProducto = useCallback(
    async (prod: ProductoVenta, cantidad = 1) => {
      setBusyAction(true);
      try {
        const res = await executePosAction('ABRIR_O_AGREGAR_ORDEN', {
          orden_id: ordenActiva?.id,
          canal_venta: ordenActiva?.canal_venta || 'MOSTRADOR_LLEVAR',
          mesa_numero: ordenActiva?.mesa_numero || null,
          items: [
            {
              producto_id: prod.id,
              codigo_producto: prod.codigo,
              nombre_producto: prod.nombre,
              categoria: prod.categoria,
              cantidad,
              unidad: 'Und',
              precio_unitario: Number(prod.precio_total || 0),
            },
          ],
        });
        await fetchPosState();
        if (res.orden?.id) setOrdenActivaId(res.orden.id);
        setCaptureInput('');
        focusCapture();
      } catch (e: unknown) {
        notify('err', e instanceof Error ? e.message : 'Error agregando producto');
      } finally {
        setBusyAction(false);
      }
    },
    [ordenActiva, executePosAction, fetchPosState, focusCapture, notify]
  );

  const handleAgregarVarios = async () => {
    if (!variosNombre.trim() || variosPrecio <= 0 || variosCantidad <= 0) {
      return notify('err', 'Completa descripción, cantidad y precio.');
    }
    setBusyAction(true);
    try {
      const res = await executePosAction('ABRIR_O_AGREGAR_ORDEN', {
        orden_id: ordenActiva?.id,
        canal_venta: ordenActiva?.canal_venta || 'MOSTRADOR_LLEVAR',
        mesa_numero: ordenActiva?.mesa_numero || null,
        items: [
          {
            producto_id: null,
            codigo_producto: 'VAR-001',
            nombre_producto: variosNombre.trim(),
            categoria: 'Varios',
            cantidad: variosCantidad,
            unidad: 'Und',
            precio_unitario: variosPrecio,
          },
        ],
      });
      await fetchPosState();
      if (res.orden?.id) setOrdenActivaId(res.orden.id);
      setShowVariosModal(false);
      focusCapture();
      notify('ok', `"${variosNombre.trim()}" agregado.`);
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error agregando ítem');
    } finally {
      setBusyAction(false);
    }
  };

  const handleAbrirMayoreo = useCallback(() => {
    const sel = itemsActivos.find((i) => i.id === selectedItemId);
    if (!sel) {
      notify('err', 'Selecciona una línea de la tabla para ajustar precio o cantidad.');
      return;
    }
    setMayoreoCantidad(sel.cantidad);
    setMayoreoPrecio(sel.precio_unitario);
    setMayoreoNotas(sel.notas_comanda || '');
    setShowMayoreoModal(true);
  }, [itemsActivos, selectedItemId, notify]);

  const handleGuardarMayoreo = async () => {
    const sel = itemsActivos.find((i) => i.id === selectedItemId);
    if (!sel || !ordenActiva) return;
    setBusyAction(true);
    try {
      await executePosAction('ACTUALIZAR_ITEM_PRECIO_CANTIDAD', {
        orden_id: ordenActiva.id,
        item_id: sel.id,
        cantidad: mayoreoCantidad,
        precio_unitario: mayoreoPrecio,
        notas_comanda: mayoreoNotas.trim() || null,
      });
      setShowMayoreoModal(false);
      await fetchPosState();
      focusCapture();
      notify('ok', 'Precio y cantidad actualizados.');
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error actualizando línea');
    } finally {
      setBusyAction(false);
    }
  };

  const handleAnularItem = useCallback(
    async (item: PosOrdenItem) => {
      if (!ordenActiva) return;
      let motivo = 'Ajuste en caja';
      if (item.estado_comanda === 'COMANDADO') {
        const resp = window.prompt(
          `El ítem "${item.nombre_producto}" ya fue enviado a preparación. Ingresa el motivo:`
        );
        if (!resp || !resp.trim()) return;
        motivo = resp.trim();
      }
      const currentIdx = itemsActivos.findIndex((i) => i.id === item.id);
      const remaining = itemsActivos.filter((i) => i.id !== item.id);
      const nextSelected =
        remaining.length > 0
          ? remaining[Math.min(currentIdx, remaining.length - 1)].id
          : null;

      setBusyAction(true);
      try {
        await executePosAction('ANULAR_ITEM_ORDEN', {
          item_id: item.id,
          orden_id: ordenActiva.id,
          motivo,
          usuario: cajeroNombre,
        });
        setSelectedItemId(nextSelected);
        if (!nextSelected) setNavZone('SEARCH');
        await fetchPosState();
      } catch (e: unknown) {
        notify('err', e instanceof Error ? e.message : 'Error anulando producto');
      } finally {
        setBusyAction(false);
      }
    },
    [ordenActiva, itemsActivos, cajeroNombre, executePosAction, fetchPosState, notify]
  );

  const handleCambiarCantidadItem = useCallback(
    async (item: PosOrdenItem, delta: number) => {
      if (!ordenActiva || delta === 0) return;
      const nextQty = Number(item.cantidad || 0) + delta;
      if (nextQty <= 0) {
        await handleAnularItem(item);
        return;
      }
      if (delta > 0) {
        await handleAgregarProducto(
          {
            id: item.producto_id || '',
            codigo: item.codigo_producto,
            nombre: item.nombre_producto,
            categoria: item.categoria,
            precio_total: item.precio_unitario,
            precio_neto: item.precio_unitario,
          },
          delta
        );
        return;
      }
      setBusyAction(true);
      try {
        await executePosAction('ACTUALIZAR_ITEM_PRECIO_CANTIDAD', {
          orden_id: ordenActiva.id,
          item_id: item.id,
          cantidad: nextQty,
          precio_unitario: item.precio_unitario,
          notas_comanda: item.notas_comanda || null,
        });
        await fetchPosState();
      } catch (e: unknown) {
        notify('err', e instanceof Error ? e.message : 'Error actualizando cantidad');
      } finally {
        setBusyAction(false);
      }
    },
    [ordenActiva, handleAnularItem, handleAgregarProducto, executePosAction, fetchPosState, notify]
  );

  const handleConfirmarCancelarTicket = useCallback(async () => {
    if (!ordenActiva) return;
    setBusyAction(true);
    try {
      await executePosAction('ANULAR_ORDEN_COMPLETA', {
        orden_id: ordenActiva.id,
        motivo: 'Ticket cancelado en caja',
      });
      setShowCancelarTicketModal(false);
      setOrdenActivaId(null);
      setSelectedItemId(null);
      setNavZone('SEARCH');
      await fetchPosState();
      focusCapture();
      notify('ok', `Ticket ${getOrdenTabLabel(ordenActiva)} cancelado.`);
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error cancelando ticket');
    } finally {
      setBusyAction(false);
    }
  }, [ordenActiva, executePosAction, fetchPosState, focusCapture, notify]);

  const handleEliminarTicket = () => {
    if (!ordenActiva) return;
    setShowCancelarTicketModal(true);
  };

  const handleEnviarComanda = useCallback(
    async (forceResend = false) => {
      if (!ordenActiva) return;
      const pendientes = itemsActivos.filter((i) => i.estado_comanda === 'PENDIENTE');
      if (pendientes.length === 0 && !forceResend) {
        if (itemsActivos.length === 0) {
          notify('err', 'No hay productos en este ticket para enviar a cocina.');
          return;
        }
        setReenviarComandaFocusBtn('CONFIRM');
        setShowReenviarComandaModal(true);
        return;
      }
      setBusyAction(true);
      try {
        if (pendientes.length > 0) {
          const res = await executePosAction('ENVIAR_COMANDA', { orden_id: ordenActiva.id });
          const porEstacion = (res.porEstacion || {}) as Record<string, PosOrdenItem[]>;
          for (const [est, its] of Object.entries(porEstacion)) {
            if (its.length > 0) {
              await safePrintTicket({
                titulo: `COMANDA - ${est}`,
                consecutivo: ordenActiva.consecutivo,
                fecha: new Date().toLocaleString('es-CO'),
                caja: cajaNombre,
                cajero: cajeroNombre,
                canal: ordenActiva.canal_venta,
                mesaNumero: ordenActiva.mesa_numero,
                clienteNombre: ordenActiva.cliente_nombre,
                items: its.map((x) => ({
                  nombre: x.nombre_producto,
                  cantidad: x.cantidad,
                  precioUnitario: x.precio_unitario,
                  subtotal: x.subtotal,
                  notas: x.notas_comanda,
                })),
                subtotal: its.reduce((a, b) => a + Number(b.subtotal || 0), 0),
                total: its.reduce((a, b) => a + Number(b.subtotal || 0), 0),
              });
            }
          }
          await fetchPosState();
          focusCapture();
          notify('ok', `Comanda enviada (${pendientes.length} ítems).`);
        } else {
          // Reenvío completo de comanda ya enviada
          const porEst: Record<string, PosOrdenItem[]> = {};
          for (const it of itemsActivos) {
            const est = it.estacion_comanda || 'COCINA_PARRILLA';
            if (!porEst[est]) porEst[est] = [];
            porEst[est].push(it);
          }
          for (const [est, its] of Object.entries(porEst)) {
            await safePrintTicket({
              titulo: `REENVÍO COMANDA - ${est}`,
              consecutivo: ordenActiva.consecutivo,
              fecha: new Date().toLocaleString('es-CO'),
              caja: cajaNombre,
              cajero: cajeroNombre,
              canal: ordenActiva.canal_venta,
              mesaNumero: ordenActiva.mesa_numero,
              clienteNombre: ordenActiva.cliente_nombre,
              items: its.map((x) => ({
                nombre: x.nombre_producto,
                cantidad: x.cantidad,
                precioUnitario: x.precio_unitario,
                subtotal: x.subtotal,
                notas: x.notas_comanda,
              })),
              subtotal: its.reduce((a, b) => a + Number(b.subtotal || 0), 0),
              total: its.reduce((a, b) => a + Number(b.subtotal || 0), 0),
            });
          }
          setShowReenviarComandaModal(false);
          focusCapture();
          notify('ok', `Comanda reenviada a cocina (${itemsActivos.length} ítems).`);
        }
      } catch (e: unknown) {
        notify('err', e instanceof Error ? e.message : 'Error enviando comanda');
      } finally {
        setBusyAction(false);
      }
    },
    [ordenActiva, itemsActivos, cajaNombre, cajeroNombre, executePosAction, fetchPosState, focusCapture, notify]
  );

  const handleImprimirPrecuenta = async () => {
    if (!ordenActiva) return;
    setBusyAction(true);
    try {
      await executePosAction('IMPRIMIR_PRECUENTA', { orden_id: ordenActiva.id });
      const propinaSug = posConfig.habilitaPropinas
        ? Math.round(ordenActiva.subtotal_bruto * (posConfig.porcentajePropinaSugerida / 100))
        : 0;
      await safePrintTicket({
        titulo: 'PRECUENTA',
        subtitulo: 'Documento informativo - No es factura',
        consecutivo: ordenActiva.consecutivo,
        fecha: new Date().toLocaleString('es-CO'),
        caja: cajaNombre,
        cajero: cajeroNombre,
        canal: ordenActiva.canal_venta,
        mesaNumero: ordenActiva.mesa_numero,
        clienteNombre: ordenActiva.cliente_nombre,
        items: itemsActivos.map((it) => ({
          nombre: it.nombre_producto,
          cantidad: it.cantidad,
          precioUnitario: it.precio_unitario,
          subtotal: it.subtotal,
          notas: it.notas_comanda,
        })),
        subtotal: ordenActiva.subtotal_bruto,
        propina: propinaSug,
        costoDomicilio: ordenActiva.costo_domicilio,
        total: ordenActiva.subtotal_bruto + propinaSug + Number(ordenActiva.costo_domicilio || 0),
      });
      await fetchPosState();
      notify('ok', 'Precuenta impresa.');
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error imprimiendo precuenta');
    } finally {
      setBusyAction(false);
    }
  };

  const abrirModalCobro = useCallback(() => {
    if (!ordenActiva || itemsActivos.length === 0) {
      notify('err', 'Agrega al menos un artículo antes de cobrar.');
      return;
    }
    setShowCobroModal(true);
  }, [ordenActiva, itemsActivos.length, notify]);

  const handleConfirmarCobro = async (payload: {
    metodo_pago: 'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO' | 'MIXTO' | 'CONSUMO_INTERNO';
    propina: number;
    descuento: number;
    pago_efectivo: number;
    pago_datafono: number;
    pago_transferencia: number;
    pago_credito: number;
    efectivo_recibido: number;
    comision_tarjeta: number;
    cliente_nombre: string;
    cliente_telefono: string;
    area_consumo: string;
    pagos_detalle: PosOrdenPago[];
  }) => {
    if (!ordenActiva) return;
    const isConsumo = payload.metodo_pago === 'CONSUMO_INTERNO';
    const totalFinal = isConsumo
      ? Number(ordenActiva.subtotal_bruto || 0)
      : Math.max(
          0,
          Number(ordenActiva.subtotal_bruto || 0) +
            Number(ordenActiva.costo_domicilio || 0) -
            payload.descuento +
            payload.propina
        );
    const cambioEntregado = isConsumo
      ? 0
      : Math.max(0, payload.efectivo_recibido - payload.pago_efectivo);

    setBusyAction(true);
    try {
      await executePosAction('FACTURAR_ORDEN', {
        orden_id: ordenActiva.id,
        metodo_pago: payload.metodo_pago,
        pago_efectivo: payload.pago_efectivo,
        pago_datafono: payload.pago_datafono,
        pago_transferencia: payload.pago_transferencia,
        pago_credito: payload.pago_credito,
        comision_tarjeta: payload.comision_tarjeta,
        cliente_nombre: payload.cliente_nombre || ordenActiva.cliente_nombre,
        cliente_telefono: payload.cliente_telefono || ordenActiva.cliente_telefono,
        area_consumo: payload.area_consumo,
        propina: isConsumo ? 0 : payload.propina,
        descuento: isConsumo ? 0 : payload.descuento,
        efectivo_recibido: payload.efectivo_recibido,
        pagos_detalle: payload.pagos_detalle,
      });

      const ticketData: ThermalTicketData = {
        titulo: isConsumo ? 'VALE DE CONSUMO INTERNO' : 'FACTURA DE VENTA POS',
        subtitulo: isConsumo ? `SIN COBRO EN CAJA (${payload.area_consumo})` : undefined,
        consecutivo: ordenActiva.consecutivo,
        fecha: new Date().toLocaleString('es-CO'),
        caja: cajaNombre,
        cajero: cajeroNombre,
        canal: ordenActiva.canal_venta,
        mesaNumero: ordenActiva.mesa_numero,
        clienteNombre: payload.cliente_nombre || ordenActiva.cliente_nombre,
        clienteTelefono: payload.cliente_telefono || ordenActiva.cliente_telefono,
        clienteDireccion: ordenActiva.cliente_direccion,
        items: itemsActivos.map((it) => ({
          nombre: it.nombre_producto,
          cantidad: it.cantidad,
          precioUnitario: it.precio_unitario,
          subtotal: it.subtotal,
          notas: it.notas_comanda,
        })),
        subtotal: ordenActiva.subtotal_bruto,
        descuento: isConsumo ? 0 : payload.descuento,
        propina: isConsumo ? 0 : payload.propina,
        costoDomicilio: ordenActiva.costo_domicilio,
        total: totalFinal,
        metodoPago: isConsumo ? 'CONSUMO INTERNO ($0 EN CAJA)' : payload.metodo_pago,
        efectivoRecibido: payload.pago_efectivo > 0 ? payload.efectivo_recibido : undefined,
        cambio: payload.pago_efectivo > 0 ? cambioEntregado : undefined,
        footer: isConsumo ? 'Firma Beneficiario: ___________________' : undefined,
      };

      if (!isConsumo) {
        const memory: LastPaymentMemory = {
          total: totalFinal,
          pagoCon: payload.efectivo_recibido || totalFinal,
          cambio: cambioEntregado,
          consecutivo: ordenActiva.consecutivo,
          ticketData,
        };
        setLastPayment(memory);
        localStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify(memory));
      }

      await safePrintTicket(ticketData);

      setShowCobroModal(false);
      setOrdenActivaId(null);
      await fetchPosState();
      focusCapture();
      notify(
        'ok',
        isConsumo
          ? `Consumo interno registrado (${formatMoney(totalFinal)}) sin cobro en caja.`
          : `Factura ${ordenActiva.consecutivo} cobrada.`
      );
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error procesando orden');
    } finally {
      setBusyAction(false);
    }
  };

  const openAsignarMesaModal = useCallback(() => {
    const firstLibre = mesas.findIndex(
      (m) => m.estado === 'LIBRE' || (ordenActiva && m.orden_activa_id === ordenActiva.id)
    );
    setFocusedAsignarMesaIdx(firstLibre >= 0 ? firstLibre : 0);
    setShowAsignarMesaModal(true);
  }, [mesas, ordenActiva]);

  const handleAsignarMesaSeleccionada = useCallback(
    async (m: PosMesa) => {
      if (!ordenActiva) return;
      const libre = m.estado === 'LIBRE' || m.orden_activa_id === ordenActiva.id;
      if (!libre || busyAction) return;
      setBusyAction(true);
      try {
        await executePosAction('CAMBIAR_CANAL_ORDEN', {
          orden_id: ordenActiva.id,
          canal_venta: 'SALON_MESA',
          mesa_numero: m.numero,
        });
        setShowAsignarMesaModal(false);
        await fetchPosState();
        focusCapture();
        notify('ok', `Ticket asignado a ${m.nombre}.`);
      } catch (err: unknown) {
        notify('err', err instanceof Error ? err.message : 'Error asignando mesa');
      } finally {
        setBusyAction(false);
      }
    },
    [ordenActiva, busyAction, executePosAction, fetchPosState, focusCapture, notify]
  );

  const handleAsignarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ordenActiva) return;
    setBusyAction(true);
    try {
      await executePosAction('ASIGNAR_CLIENTE_ORDEN', {
        orden_id: ordenActiva.id,
        cliente_nombre: asignarNombre.trim(),
        cliente_telefono: asignarTel.trim(),
      });
      setShowAsignarClienteModal(false);
      await fetchPosState();
      focusCapture();
      notify('ok', `Cliente "${asignarNombre.trim() || 'Sin asignar'}" actualizado.`);
    } catch (err: unknown) {
      notify('err', err instanceof Error ? err.message : 'Error asignando cliente');
    } finally {
      setBusyAction(false);
    }
  };

  const handleReimprimirUltimo = async () => {
    if (!lastPayment.ticketData) {
      return notify('err', 'Aún no hay un ticket reciente en esta caja.');
    }
    await safePrintTicket({
      ...lastPayment.ticketData,
      subtitulo: `COPIA DE TICKET (${lastPayment.consecutivo})`,
    });
    notify('ok', `Copia de ${lastPayment.consecutivo} enviada a impresora.`);
  };

  const handleCrearDomicilio = async () => {
    if (!domNombre.trim() || !domTelefono.trim() || !domDireccion.trim()) {
      return notify('err', 'Nombre, teléfono y dirección son obligatorios.');
    }
    setBusyAction(true);
    try {
      if (domModoConversion && ordenActiva) {
        await executePosAction('CAMBIAR_CANAL_ORDEN', {
          orden_id: ordenActiva.id,
          canal_venta: 'DOMICILIO',
          cliente_nombre: domNombre.trim(),
          cliente_telefono: domTelefono.trim(),
          cliente_direccion: domDireccion.trim(),
          costo_domicilio: domCostoEnvio,
          domiciliario_nombre: domRepartidor,
        });
        setShowDomicilioModal(false);
        setDomModoConversion(false);
        setDomNombre('');
        setDomTelefono('');
        setDomDireccion('');
        setDomDistanciaInfo('');
        await fetchPosState();
        focusCapture();
        notify('ok', 'Ticket convertido a Domicilio conservando sus productos.');
      } else {
        const res = await executePosAction('ABRIR_O_AGREGAR_ORDEN', {
          canal_venta: 'DOMICILIO',
          cliente_nombre: domNombre.trim(),
          cliente_telefono: domTelefono.trim(),
          cliente_direccion: domDireccion.trim(),
          costo_domicilio: domCostoEnvio,
          domiciliario_nombre: domRepartidor,
          items: [],
        });
        setShowDomicilioModal(false);
        setDomNombre('');
        setDomTelefono('');
        setDomDireccion('');
        setDomDistanciaInfo('');
        await fetchPosState();
        if (res.orden?.id) {
          setOrdenActivaId(res.orden.id);
          setActiveTab('VENTAS');
        }
        focusCapture();
        notify('ok', 'Domicilio creado.');
      }
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error creando domicilio');
    } finally {
      setBusyAction(false);
    }
  };

  const handlePesarGramera = async () => {
    try {
      const kg = await readScaleWeightOnce();
      if (kg === null) notify('err', 'Gramera no conectada o sin lectura disponible.');
      else notify('ok', `Gramera: ${Math.round(kg * 1000)} g (${kg.toFixed(3)} kg)`);
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Gramera no conectada');
    }
  };

  const handleCambiarTicketDireccion = useCallback(
    (delta: 1 | -1) => {
      if (ordenesAbiertas.length <= 1) {
        notify('ok', 'Solo hay una cuenta abierta actualmente.');
        return;
      }
      const idx = ordenesAbiertas.findIndex((o) => o.id === ordenActiva?.id);
      const baseIdx = idx < 0 ? 0 : idx;
      const nextIdx = (baseIdx + delta + ordenesAbiertas.length) % ordenesAbiertas.length;
      const next = ordenesAbiertas[nextIdx];
      setOrdenActivaId(next.id);
      setSelectedItemId(null);
      setActiveTab('VENTAS');
      setNavZone('SEARCH');
      focusCapture();
    },
    [ordenesAbiertas, ordenActiva, focusCapture, notify]
  );

  const handleCambiarSiguienteTicket = useCallback(() => {
    handleCambiarTicketDireccion(1);
  }, [handleCambiarTicketDireccion]);

  useBarcodeScanner((barcode) => {
    const match = productos.find((p) => (p.codigo || '').toLowerCase() === barcode.toLowerCase());
    if (match) {
      handleAgregarProducto(match, 1);
      notify('ok', `Escaneado: ${match.nombre}`);
    } else {
      setCaptureInput(barcode);
      notify('err', `Código ${barcode} no encontrado.`);
    }
  });

  useEffect(() => {
    setFocusedProductIndex((prev) => {
      if (productosFiltrados.length === 0) return 0;
      return Math.min(prev, productosFiltrados.length - 1);
    });
  }, [productosFiltrados.length]);

  useEffect(() => {
    if (itemsActivos.length === 0 && navZone === 'TICKET') {
      setNavZone('SEARCH');
    }
  }, [itemsActivos.length, navZone]);

  useEffect(() => {
    setFocusedMesaIndex((prev) => {
      if (mesasFiltradas.length === 0) return 0;
      return Math.min(prev, mesasFiltradas.length - 1);
    });
  }, [mesasFiltradas.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!sesionActiva) return;
      const target = e.target as HTMLElement | null;
      const isTextArea = target?.tagName === 'TEXTAREA';
      const isOtherInput = target?.tagName === 'INPUT' && target !== captureInputRef.current;
      const isAnyModalOpen =
        showCobroModal ||
        showAsignarClienteModal ||
        showBuscarModal ||
        showVerificadorModal ||
        showVariosModal ||
        showMayoreoModal ||
        showArtComunModal ||
        showDomicilioModal ||
        showVentasDiaModal ||
        showCreditosModal ||
        showSettingsModal ||
        showExitModal ||
        showCancelarTicketModal ||
        showAsignarMeseroModal ||
        showAsignarMesaModal ||
        showReenviarComandaModal ||
        notaItemTarget !== null ||
        cashFlowModal !== null;

      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCobroModal(false);
        setShowAsignarClienteModal(false);
        setShowBuscarModal(false);
        setShowVerificadorModal(false);
        setShowVariosModal(false);
        setShowMayoreoModal(false);
        setShowArtComunModal(false);
        setShowDomicilioModal(false);
        setDomModoConversion(false);
        setShowVentasDiaModal(false);
        setShowCreditosModal(false);
        setShowSettingsModal(false);
        setShowExitModal(false);
        setShowCancelarTicketModal(false);
        setShowAsignarMeseroModal(false);
        setShowAsignarMesaModal(false);
        setShowMoreToolsMenu(false);
        setShowReenviarComandaModal(false);
        setNotaItemTarget(null);
        setCashFlowModal(null);
        setNavZone('SEARCH');
        focusCapture();
        return;
      }

      // Navegación 2D por teclado dentro del modal Asignar Mesa (Alt+S)
      if (showAsignarMesaModal && ordenActiva) {
        if (mesas.length === 0) return;
        const cols = typeof window !== 'undefined' && window.innerWidth >= 640 ? 4 : 3;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = Math.min(mesas.length - 1, focusedAsignarMesaIdx + 1);
          setFocusedAsignarMesaIdx(next);
          asignarMesaBtnRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = Math.max(0, focusedAsignarMesaIdx - 1);
          setFocusedAsignarMesaIdx(prev);
          asignarMesaBtnRefs.current[prev]?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = Math.min(mesas.length - 1, focusedAsignarMesaIdx + cols);
          setFocusedAsignarMesaIdx(next);
          asignarMesaBtnRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = Math.max(0, focusedAsignarMesaIdx - cols);
          setFocusedAsignarMesaIdx(prev);
          asignarMesaBtnRefs.current[prev]?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const m = mesas[focusedAsignarMesaIdx];
          if (m) void handleAsignarMesaSeleccionada(m);
          return;
        }
        return;
      }

      // Navegación por teclado dentro del modal Reenviar Comanda
      if (showReenviarComandaModal) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
          e.preventDefault();
          setReenviarComandaFocusBtn((p) => (p === 'CONFIRM' ? 'CANCEL' : 'CONFIRM'));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (reenviarComandaFocusBtn === 'CONFIRM') {
            void handleEnviarComanda(true);
          } else {
            setShowReenviarComandaModal(false);
            focusCapture();
          }
          return;
        }
        return;
      }

      // Navegación por teclado dentro del modal Asignar Personal / Mesero (Alt+M)
      if (showAsignarMeseroModal && operarios.length > 0) {
        const cols = typeof window !== 'undefined' && window.innerWidth >= 640 ? 3 : 2;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusedMeseroIdx((i) => Math.min(operarios.length - 1, i + 1));
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusedMeseroIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedMeseroIdx((i) => Math.min(operarios.length - 1, i + cols));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedMeseroIdx((i) => Math.max(0, i - cols));
          return;
        }
        if (e.key === 'Enter' && ordenActiva) {
          const op = operarios[focusedMeseroIdx];
          if (op) {
            e.preventDefault();
            setBusyAction(true);
            void executePosAction('ASIGNAR_MESERO_ORDEN', {
              orden_id: ordenActiva.id,
              mesero_nombre: op.nombre_cajero,
            })
              .then(async () => {
                setShowAsignarMeseroModal(false);
                await fetchPosState();
                focusCapture();
                notify('ok', `Personal asignado: ${op.nombre_cajero}`);
              })
              .catch((err: unknown) => {
                notify('err', err instanceof Error ? err.message : 'Error asignando personal');
              })
              .finally(() => setBusyAction(false));
          }
          return;
        }
        return;
      }

      // PosCheckoutModal maneja su propia navegación por teclado
      if (showCobroModal && ordenActiva) {
        return;
      }

      if (e.key === 'F1') { e.preventDefault(); setActiveTab('VENTAS'); setNavZone('SEARCH'); focusCapture(); return; }
      if (e.key === 'F2' && e.shiftKey && posConfig.habilitaDomicilios) {
        e.preventDefault();
        setActiveTab('DOMICILIOS');
        return;
      }
      if (e.key === 'F2' && !e.shiftKey && posConfig.habilitaMesas) {
        e.preventDefault();
        setActiveTab('MESAS');
        setMesasNavZone('NONE');
        setFocusedMesaIndex(0);
        return;
      }
      if (e.key === 'F3') { e.preventDefault(); setActiveTab('PRODUCTOS'); return; }
      if (e.key === 'F4' && e.shiftKey) {
        e.preventDefault();
        setActiveTab('CORTE');
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setActiveTab('CORTE');
        return;
      }
      if (e.key === 'F4' && !e.shiftKey) { e.preventDefault(); setActiveTab('INVENTARIO'); return; }
      if (e.key === 'F5') { e.preventDefault(); setActiveTab('VENTAS_DIA'); return; }
      if (e.key === 'F6') {
        e.preventDefault();
        if (posConfig.habilitaComandasCocina && ordenActiva && itemsActivos.length > 0) {
          void handleEnviarComanda(false);
        } else {
          handleNuevaVentaMostrador();
        }
        return;
      }
      if (e.key === 'F7') { e.preventDefault(); setCashFlowModal('ENTRADA'); return; }
      if (e.key === 'F8') { e.preventDefault(); setCashFlowModal('SALIDA'); return; }
      if (e.key === 'F9') {
        e.preventDefault();
        setVerificadorQuery('');
        setShowVerificadorModal(true);
        setTimeout(() => verificadorInputRef.current?.focus(), 60);
        return;
      }
      if (e.key === 'F10') {
        e.preventDefault();
        setBuscarQuery('');
        setBuscarIndex(0);
        setShowBuscarModal(true);
        setTimeout(() => buscarInputRef.current?.focus(), 60);
        return;
      }
      if (e.key === 'F12') { e.preventDefault(); abrirModalCobro(); return; }

      // Atajo fácil para Asignar Cliente / Personal: Alt+C o Ctrl+B
      if (
        !isAnyModalOpen &&
        ordenActiva &&
        ((e.altKey && e.key.toLowerCase() === 'c') || (e.ctrlKey && e.key.toLowerCase() === 'b'))
      ) {
        e.preventDefault();
        setAsignarNombre(ordenActiva.cliente_nombre || '');
        setAsignarTel(ordenActiva.cliente_telefono || '');
        setShowAsignarClienteModal(true);
        return;
      }

      // Atajo fácil para Asignar Personal / Mesero: Alt+M
      if (!isAnyModalOpen && ordenActiva && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        const curIdx = operarios.findIndex((o) => o.nombre_cajero === ordenActiva.mesero_nombre);
        setFocusedMeseroIdx(curIdx >= 0 ? curIdx : 0);
        setShowAsignarMeseroModal(true);
        return;
      }

      // Atajo rápido: Alt+S (Asignar Mesa) / Alt+D (Pasar a Domicilio)
      if (!isAnyModalOpen && ordenActiva && e.altKey && e.key.toLowerCase() === 's' && posConfig.habilitaMesas) {
        e.preventDefault();
        openAsignarMesaModal();
        return;
      }
      if (!isAnyModalOpen && ordenActiva && e.altKey && e.key.toLowerCase() === 'd' && posConfig.habilitaDomicilios) {
        e.preventDefault();
        setDomNombre(ordenActiva.cliente_nombre || '');
        setDomTelefono(ordenActiva.cliente_telefono || '');
        setDomDireccion(ordenActiva.cliente_direccion || '');
        setDomModoConversion(true);
        setShowDomicilioModal(true);
        return;
      }

      // Navegación por teclado exclusiva en módulo F2: MESAS
      if (activeTab === 'MESAS' && posConfig.habilitaMesas && !isAnyModalOpen && !isTextArea && !isOtherInput) {
        const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const mesaCols = w >= 1280 ? 6 : w >= 768 ? 5 : w >= 640 ? 4 : 2;
        const zonaIdx = Math.max(0, zonasDisponibles.indexOf(zonaFiltro));

        if (e.key === 'Tab') {
          e.preventDefault();
          if (mesasNavZone !== 'MOSTRADOR') {
            setMesasNavZone('MOSTRADOR');
            ventaMostradorBtnRef.current?.focus();
          } else {
            setMesasNavZone('NONE');
            ventaMostradorBtnRef.current?.blur();
          }
          return;
        }
        if (e.key === 'Enter' && mesasNavZone === 'MOSTRADOR') {
          e.preventDefault();
          handleNuevaVentaMostrador();
          return;
        }
        if (e.key === 'Enter' && mesasNavZone === 'TABLES') {
          const m = mesasFiltradas[focusedMesaIndex];
          if (m) {
            e.preventDefault();
            void handleAbrirMesa(m);
          }
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (mesasNavZone === 'NONE' || mesasNavZone === 'MOSTRADOR') {
            ventaMostradorBtnRef.current?.blur();
            setMesasNavZone('ZONES');
            zonaBtnRefs.current[zonaIdx]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
          } else if (mesasNavZone === 'ZONES' && mesasFiltradas.length > 0) {
            setMesasNavZone('TABLES');
            setFocusedMesaIndex(0);
            mesaCardRefs.current[0]?.scrollIntoView({ block: 'nearest' });
          } else if (mesasNavZone === 'TABLES' && mesasFiltradas.length > 0) {
            const nextIdx = Math.min(mesasFiltradas.length - 1, focusedMesaIndex + mesaCols);
            setFocusedMesaIndex(nextIdx);
            mesaCardRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest' });
          }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (mesasNavZone === 'TABLES') {
            if (focusedMesaIndex < mesaCols) {
              setMesasNavZone('ZONES');
              zonaBtnRefs.current[zonaIdx]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
            } else {
              const prevIdx = focusedMesaIndex - mesaCols;
              setFocusedMesaIndex(prevIdx);
              mesaCardRefs.current[prevIdx]?.scrollIntoView({ block: 'nearest' });
            }
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          if (mesasNavZone === 'ZONES' && zonasDisponibles.length > 0) {
            e.preventDefault();
            const nextZ = Math.min(zonasDisponibles.length - 1, zonaIdx + 1);
            setZonaFiltro(zonasDisponibles[nextZ]);
            setFocusedMesaIndex(0);
            zonaBtnRefs.current[nextZ]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
            return;
          }
          if (mesasNavZone === 'TABLES' && mesasFiltradas.length > 0) {
            e.preventDefault();
            const nextIdx = Math.min(mesasFiltradas.length - 1, focusedMesaIndex + 1);
            setFocusedMesaIndex(nextIdx);
            mesaCardRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest' });
            return;
          }
        }
        if (e.key === 'ArrowLeft') {
          if (mesasNavZone === 'ZONES' && zonasDisponibles.length > 0) {
            e.preventDefault();
            const prevZ = Math.max(0, zonaIdx - 1);
            setZonaFiltro(zonasDisponibles[prevZ]);
            setFocusedMesaIndex(0);
            zonaBtnRefs.current[prevZ]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
            return;
          }
          if (mesasNavZone === 'TABLES' && mesasFiltradas.length > 0) {
            e.preventDefault();
            const prevIdx = Math.max(0, focusedMesaIndex - 1);
            setFocusedMesaIndex(prevIdx);
            mesaCardRefs.current[prevIdx]?.scrollIntoView({ block: 'nearest' });
            return;
          }
        }
        return;
      }

      if (isAnyModalOpen || isTextArea || isOtherInput || activeTab !== 'VENTAS') return;

      // TAB una sola vez en F1 Ventas posiciona en "+ Nuevo Ticket" (Enter crea nuevo ticket)
      if (e.key === 'Tab') {
        e.preventDefault();
        if (document.activeElement !== nuevoTicketBtnRef.current) {
          nuevoTicketBtnRef.current?.focus();
        } else {
          setNavZone('SEARCH');
          focusCapture();
        }
        return;
      }

      const isTypingInCapture = target === captureInputRef.current;
      const inputEl = captureInputRef.current;
      const caretAtStart = !isTypingInCapture || ((inputEl?.selectionStart ?? 0) === 0 && (inputEl?.selectionEnd ?? 0) === 0);
      const caretAtEnd = !isTypingInCapture || ((inputEl?.selectionEnd ?? captureInput.length) >= captureInput.length);
      const gridCols = typeof window !== 'undefined' && window.innerWidth >= 1280 ? 3 : 2;
      const catIdx = Math.max(0, categoriasProductos.indexOf(catFiltro));

      // Auto-escritura global: cualquier carácter imprimible fuera del input escribe directo en Código/Producto
      if (
        !isTypingInCapture &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        e.key.length === 1 &&
        e.key !== '+' &&
        e.key !== '-' &&
        /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ .,/]$/.test(e.key)
      ) {
        e.preventDefault();
        setNavZone('SEARCH');
        setCaptureInput((prev) => prev + e.key);
        captureInputRef.current?.focus();
        return;
      }

      if (!isTypingInCapture && e.key === 'Backspace') {
        e.preventDefault();
        setNavZone('SEARCH');
        setCaptureInput((prev) => prev.slice(0, -1));
        captureInputRef.current?.focus();
        return;
      }

      // Shift + Flecha Derecha / Izquierda: moverse entre tickets abiertos
      if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        handleCambiarTicketDireccion(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }

      // Shift + Supr (Delete): cancelar ticket abierto con confirmación
      if (e.shiftKey && e.key === 'Delete') {
        if (ordenActiva) {
          e.preventDefault();
          setShowCancelarTicketModal(true);
        }
        return;
      }

      // Controles de cantidad y eliminación sobre el ítem seleccionado del ticket
      if (e.key === 'Delete' && (!isTypingInCapture || captureInput === '')) {
        const selected = itemsActivos.find((i) => i.id === selectedItemId);
        if (selected) { e.preventDefault(); void handleAnularItem(selected); }
        return;
      }

      if ((e.key === '+' || e.key === 'Add') && (navZone === 'TICKET' || !isTypingInCapture || captureInput === '')) {
        const selected = itemsActivos.find((i) => i.id === selectedItemId);
        if (selected) { e.preventDefault(); void handleCambiarCantidadItem(selected, 1); return; }
      }

      if ((e.key === '-' || e.key === 'Subtract') && (navZone === 'TICKET' || !isTypingInCapture || captureInput === '')) {
        const selected = itemsActivos.find((i) => i.id === selectedItemId);
        if (selected) { e.preventDefault(); void handleCambiarCantidadItem(selected, -1); return; }
      }

      // Enter en grilla derecha de productos agrega el producto enfocado
      if (e.key === 'Enter' && navZone === 'PRODUCTS') {
        const prod = productosFiltrados[focusedProductIndex];
        if (prod) {
          e.preventDefault();
          void handleAgregarProducto(prod, 1);
        }
        return;
      }

      // Enter en listado izquierdo (ticket) abre el modal "Ingresa solicitudes para cocina"
      if (e.key === 'Enter' && navZone === 'TICKET') {
        const selected = itemsActivos.find((i) => i.id === selectedItemId);
        if (selected) {
          e.preventDefault();
          setNotaItemTarget(selected);
          setNotaItemText(selected.notas_comanda || '');
        }
        return;
      }

      // Flecha Derecha: entra a categorías / avanza categorías / avanza en grilla / vuelve de ticket a categorías
      if (e.key === 'ArrowRight') {
        if (navZone === 'SEARCH' && caretAtEnd && touchMode && categoriasProductos.length > 0) {
          e.preventDefault();
          captureInputRef.current?.blur();
          setNavZone('CATEGORIES');
          categoryBtnRefs.current[catIdx]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
          return;
        }
        if (navZone === 'CATEGORIES' && categoriasProductos.length > 0) {
          e.preventDefault();
          const nextCatIdx = Math.min(categoriasProductos.length - 1, catIdx + 1);
          setCatFiltro(categoriasProductos[nextCatIdx]);
          setFocusedProductIndex(0);
          categoryBtnRefs.current[nextCatIdx]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
          return;
        }
        if (navZone === 'PRODUCTS' && productosFiltrados.length > 0) {
          e.preventDefault();
          const nextIdx = Math.min(productosFiltrados.length - 1, focusedProductIndex + 1);
          setFocusedProductIndex(nextIdx);
          productCardRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (navZone === 'TICKET' && touchMode && categoriasProductos.length > 0) {
          e.preventDefault();
          setNavZone('CATEGORIES');
          categoryBtnRefs.current[catIdx]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
          return;
        }
      }

      // Flecha Izquierda: retrocede categorías o salta al listado de productos del ticket
      if (e.key === 'ArrowLeft') {
        if (navZone === 'SEARCH' && caretAtStart && itemsActivos.length > 0) {
          e.preventDefault();
          captureInputRef.current?.blur();
          const targetId = itemsActivos.some((i) => i.id === selectedItemId) ? selectedItemId! : itemsActivos[0].id;
          setSelectedItemId(targetId);
          setNavZone('TICKET');
          ticketRowRefs.current[targetId]?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (navZone === 'CATEGORIES') {
          e.preventDefault();
          if (catIdx > 0) {
            const prevCatIdx = catIdx - 1;
            setCatFiltro(categoriasProductos[prevCatIdx]);
            setFocusedProductIndex(0);
            categoryBtnRefs.current[prevCatIdx]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
          } else if (itemsActivos.length > 0) {
            const targetId = itemsActivos.some((i) => i.id === selectedItemId) ? selectedItemId! : itemsActivos[0].id;
            setSelectedItemId(targetId);
            setNavZone('TICKET');
            ticketRowRefs.current[targetId]?.scrollIntoView({ block: 'nearest' });
          }
          return;
        }
        if (navZone === 'PRODUCTS') {
          e.preventDefault();
          if (focusedProductIndex % gridCols === 0 && itemsActivos.length > 0) {
            const targetId = itemsActivos.some((i) => i.id === selectedItemId) ? selectedItemId! : itemsActivos[0].id;
            setSelectedItemId(targetId);
            setNavZone('TICKET');
            ticketRowRefs.current[targetId]?.scrollIntoView({ block: 'nearest' });
          } else if (focusedProductIndex > 0) {
            const prevIdx = focusedProductIndex - 1;
            setFocusedProductIndex(prevIdx);
            productCardRefs.current[prevIdx]?.scrollIntoView({ block: 'nearest' });
          }
          return;
        }
      }

      // Flecha Abajo: entra al contenedor derecho desde Search/Categorías o navega filas
      if (e.key === 'ArrowDown') {
        if ((navZone === 'SEARCH' || navZone === 'CATEGORIES') && touchMode && productosFiltrados.length > 0) {
          e.preventDefault();
          captureInputRef.current?.blur();
          setFocusedProductIndex(0);
          setNavZone('PRODUCTS');
          productCardRefs.current[0]?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (navZone === 'PRODUCTS' && productosFiltrados.length > 0) {
          e.preventDefault();
          const nextIdx = Math.min(productosFiltrados.length - 1, focusedProductIndex + gridCols);
          setFocusedProductIndex(nextIdx);
          productCardRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (navZone === 'TICKET' && itemsActivos.length > 0) {
          e.preventDefault();
          const idx = itemsActivos.findIndex((i) => i.id === selectedItemId);
          const nextItem = itemsActivos[idx < 0 ? 0 : Math.min(itemsActivos.length - 1, idx + 1)];
          setSelectedItemId(nextItem.id);
          ticketRowRefs.current[nextItem.id]?.scrollIntoView({ block: 'nearest' });
          return;
        }
      }

      // Flecha Arriba: navega hacia arriba en productos o ticket
      if (e.key === 'ArrowUp') {
        if (navZone === 'PRODUCTS') {
          e.preventDefault();
          if (focusedProductIndex < gridCols) {
            setNavZone('CATEGORIES');
            categoryBtnRefs.current[catIdx]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
          } else {
            const prevIdx = focusedProductIndex - gridCols;
            setFocusedProductIndex(prevIdx);
            productCardRefs.current[prevIdx]?.scrollIntoView({ block: 'nearest' });
          }
          return;
        }
        if (navZone === 'TICKET' && itemsActivos.length > 0) {
          e.preventDefault();
          const idx = itemsActivos.findIndex((i) => i.id === selectedItemId);
          const prevItem = itemsActivos[idx < 0 ? 0 : Math.max(0, idx - 1)];
          setSelectedItemId(prevItem.id);
          ticketRowRefs.current[prevItem.id]?.scrollIntoView({ block: 'nearest' });
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    sesionActiva, activeTab, captureInput, itemsActivos, selectedItemId, ordenActiva, posConfig,
    navZone, focusedProductIndex, categoriasProductos, catFiltro, productosFiltrados, touchMode,
    mesasNavZone, focusedMesaIndex, zonasDisponibles, zonaFiltro, mesasFiltradas,
    showCobroModal, showAsignarClienteModal, showBuscarModal, showVerificadorModal, showVariosModal,
    showMayoreoModal, showArtComunModal, showDomicilioModal, showVentasDiaModal, showCreditosModal,
    showSettingsModal, showExitModal, showCancelarTicketModal, showAsignarMeseroModal, showAsignarMesaModal, showReenviarComandaModal,
    reenviarComandaFocusBtn, focusedMeseroIdx, focusedAsignarMesaIdx, mesas, operarios,
    notaItemTarget, cashFlowModal, abrirModalCobro, openAsignarMesaModal, handleAsignarMesaSeleccionada, focusCapture, handleAbrirMayoreo, executePosAction, fetchPosState, notify,
    handleAbrirMesa, handleAgregarProducto, handleAnularItem, handleCambiarCantidadItem,
    handleCambiarSiguienteTicket, handleCambiarTicketDireccion, handleEnviarComanda, handleNuevaVentaMostrador,
  ]);

  const handleCaptureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = captureInput.trim().toLowerCase();
    if (!q) return;
    const exactCode = productos.find((p) => (p.codigo || '').toLowerCase() === q);
    const firstMatch = exactCode || productosFiltrados[0];
    if (firstMatch) handleAgregarProducto(firstMatch, 1);
    else notify('err', `No se encontró producto con "${captureInput}".`);
  };

  const navModules = useMemo(() => {
    const mods: Array<{ key: PosTab; fKey?: string; label: string; icon: typeof ScanBarcode }> = [
      { key: 'VENTAS', fKey: 'F1', label: 'Ventas', icon: ScanBarcode },
    ];
    if (posConfig.habilitaMesas) {
      mods.push({
        key: 'MESAS',
        fKey: 'F2',
        label: `Mesas (${mesas.filter((m) => m.estado !== 'LIBRE').length})`,
        icon: Utensils,
      });
    }
    if (posConfig.habilitaDomicilios) {
      mods.push({
        key: 'DOMICILIOS',
        fKey: 'Shift+F2',
        label: `Domicilios (${ordenesDomicilio.filter((d) => d.estado !== 'FACTURADA').length})`,
        icon: Bike,
      });
    }
    mods.push({ key: 'PRODUCTOS', fKey: 'F3', label: 'Productos', icon: Package });
    mods.push({ key: 'INVENTARIO', fKey: 'F4', label: 'Inventario', icon: Boxes });
    mods.push({ key: 'VENTAS_DIA', fKey: 'F5', label: 'Ventas / Dev.', icon: Receipt });
    mods.push({ key: 'CORTE', fKey: 'Shift+F4', label: 'Corte de Caja', icon: Lock });
    return mods;
  }, [posConfig.habilitaMesas, posConfig.habilitaDomicilios, mesas, ordenesDomicilio]);

  // Leer parámetros ?tab=CORTE&forceClose=1 cuando se intercepta el cierre del aplicativo
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'CORTE') {
      setActiveTab('CORTE');
    }
    if (params.get('forceClose') === '1') {
      setForceCloseMode(true);
      setActiveTab('CORTE');
    }
  }, []);

  // Sincronizar bandera de turno abierto con Tauri Rust (DesktopCloseGuard)
  useEffect(() => {
    if (loading) return;
    const isOpen = Boolean(sesionActiva && sesionActiva.estado === 'ABIERTA');
    window.dispatchEvent(new CustomEvent('eliana-shift-state-changed', { detail: { isOpen } }));
    // Si venía de un intento de cierre obligatorio del aplicativo y ya cerró la caja, cerrar limpiamente
    if (forceCloseMode && !isOpen) {
      if (isTauriDesktop()) {
        const tauri = (window as unknown as {
          __TAURI__?: { core?: { invoke?: (cmd: string) => Promise<unknown> } };
        }).__TAURI__;
        if (tauri?.core?.invoke) {
          void tauri.core.invoke('allow_close_app');
        }
      } else {
        setForceCloseMode(false);
        router.push('/');
      }
    }
  }, [loading, sesionActiva, forceCloseMode, router]);

  // Temporizador en vivo del turno abierto (HH:MM:SS)
  useEffect(() => {
    if (!sesionActiva?.hora_apertura) return;
    setShiftNowMs(Date.now());
    const t = setInterval(() => setShiftNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sesionActiva?.hora_apertura]);

  // Acceso 100% hermético: nunca renderiza la interfaz del POS hasta validar turno abierto
  if (loading) {
    return (
      <div className="fixed inset-0 z-[10000] w-screen h-screen bg-zinc-100 flex flex-col items-center justify-center gap-3 select-none">
        <ElianaBrandLogo variant="pos" theme="light" size="md" />
        <div className="text-xs text-zinc-500">Verificando estado del turno...</div>
      </div>
    );
  }

  if (!sesionActiva) {
    return (
      <PosOpenShiftGate
        cajaNombre={cajaNombre}
        boundCaja={boundCaja}
        cajasLibres={cajasLibres}
        deviceId={deviceId}
        ipLocal={ipLocal}
        jornadaCerradaTotal={jornadaCerradaTotal}
        errorMsg={shiftError}
        busyAction={busyAction}
        onExitWithoutOpen={() => router.push('/')}
        onOpenShift={async (payload) => {
          setBusyAction(true);
          setShiftError(null);
          try {
            const res = await fetch('/api/pos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'ABRIR_TURNO_CAJA', ...payload }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Error abriendo turno');
            setBoundTerminalCajaNombre(payload.caja_nombre);
            const nextCfg = { ...posConfig, nombreCaja: payload.caja_nombre };
            setPosConfig(nextCfg);
            saveElianaPosConfig(nextCfg);
            await refreshTerminalCajas(payload.device_id, payload.ip_local);
            await fetchPosState();
            notify('ok', `Turno abierto en ${payload.caja_nombre}.`);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Credenciales inválidas';
            setShiftError(msg);
          } finally {
            setBusyAction(false);
          }
        }}
      />
    );
  }

  const shiftElapsedHMS = formatDurationHMS(sesionActiva.hora_apertura, shiftNowMs);

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen bg-zinc-100 text-zinc-900 flex flex-col overflow-hidden select-none font-sans">

      {failedPrints.length > 0 && (
        <div className="bg-red-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 shrink-0" />
            <span>
              Error de impresora ({failedPrints.length} pendiente{failedPrints.length > 1 ? 's' : ''}): {failedPrints[0].error}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const pending = [...failedPrints];
                setFailedPrints([]);
                for (const item of pending) {
                  await safePrintTicket(item.ticket);
                }
              }}
              className="px-3 py-1 rounded bg-white text-red-700 hover:bg-red-50 text-xs font-bold cursor-pointer"
            >
              Reintentar Impresión ({failedPrints.length})
            </button>
            <button
              type="button"
              onClick={() => setFailedPrints([])}
              className="px-2 py-1 rounded bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {supervisorPrompt && (
        <PosSupervisorPinModal
          actionLabel={supervisorPrompt.actionLabel}
          onConfirm={(pin) => {
            const res = supervisorPrompt.resolve;
            setSupervisorPrompt(null);
            res(pin);
          }}
          onCancel={() => {
            const res = supervisorPrompt.resolve;
            setSupervisorPrompt(null);
            res(null);
          }}
        />
      )}

      {forceCloseMode && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              Tienes un turno de caja abierto en <b>{cajaNombre}</b>. Realiza el arqueo y presiona <b>Cierre Parcial (X)</b> o <b>Cierre Total (Z)</b> para cerrar el aplicativo de forma segura.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setForceCloseMode(false)}
            className="px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-[11px] font-bold cursor-pointer shrink-0"
          >
            Seguir trabajando
          </button>
        </div>
      )}

      {toast && (
        <div
          className={`fixed top-14 right-4 z-[10001] px-4 py-2.5 rounded-lg shadow-lg border text-xs font-semibold flex items-center gap-2 ${
            toast.type === 'ok' ? 'bg-white text-zinc-900 border-zinc-300' : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${toast.type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`} />
          {toast.text}
        </div>
      )}

      {/* 1. BARRA SUPERIOR WINDOWS 11 ENTERPRISE */}
      <header className="bg-white text-zinc-900 px-3 py-2 flex items-center justify-between gap-2 shrink-0 border-b border-zinc-200">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 pr-3 border-r border-zinc-200">
            <ElianaBrandLogo variant="pos" theme="light" size="sm" />
          </div>

          <nav className="flex items-center gap-1 flex-wrap">
            {navModules.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200 hover:text-zinc-950'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.fKey && (
                    <span
                      className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold ${
                        active ? 'bg-zinc-700 text-zinc-100' : 'bg-white text-zinc-600 border border-zinc-200'
                      }`}
                    >
                      {tab.fKey}
                    </span>
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 text-xs relative">
          <div className="hidden xl:flex flex-col text-right pr-2 border-r border-zinc-200 leading-tight">
            <span className="text-[10px] text-zinc-400 flex items-center justify-end gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : lanConnected ? 'bg-blue-500' : 'bg-amber-500'}`} />
              {cajaNombre}
            </span>
            <span className="font-bold text-zinc-900">{cajeroNombre}</span>
          </div>

          <span
            title="Tiempo transcurrido desde la apertura de este turno"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            {shiftElapsedHMS}
          </span>

          <button
            onClick={() => setShowCreditosModal(true)}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-zinc-600" />
            <span className="hidden lg:inline">Créditos</span>
          </button>

          <button
            onClick={async () => {
              await openCashDrawer();
              await executePosAction('REGISTRAR_APERTURA_CAJON_SIN_VENTA', {});
              notify('ok', 'Cajón monedero abierto.');
            }}
            title="Abrir Caja Registradora"
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Unlock className="w-4 h-4 text-zinc-700" />
            <span className="hidden lg:inline">Cajón</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreToolsMenu((v) => !v)}
              title="Más herramientas (Gramera, Panel táctil, Pantalla completa, Configuración)"
              className="p-2 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMoreToolsMenu && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white border border-zinc-200 rounded-xl shadow-xl py-1.5 z-[10002]">
                <button
                  type="button"
                  onClick={() => { setShowMoreToolsMenu(false); setTouchMode((v) => !v); }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 flex items-center gap-2 cursor-pointer"
                >
                  {touchMode ? <MonitorSmartphone className="w-4 h-4" /> : <Keyboard className="w-4 h-4" />}
                  {touchMode ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMoreToolsMenu(false); void handlePesarGramera(); }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 flex items-center gap-2 cursor-pointer"
                >
                  <Scale className="w-4 h-4" /> Leer Gramera
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMoreToolsMenu(false); toggleBrowserFullscreen(); }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 flex items-center gap-2 cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" /> Pantalla Completa
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMoreToolsMenu(false); void fetchPosState(); }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sincronizar Datos
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMoreToolsMenu(false); setShowSettingsModal(true); }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 flex items-center gap-2 cursor-pointer border-t border-zinc-100 mt-1 pt-2"
                >
                  <Settings className="w-4 h-4" /> Configuración Terminal
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowExitModal(true)}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-300 hover:border-red-300 text-zinc-800 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* ==================== F1: VENTAS ==================== */}
      {activeTab === 'VENTAS' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="bg-white border-b border-zinc-200 px-3 py-2 flex flex-col gap-2 shrink-0">
            <form onSubmit={handleCaptureSubmit} className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-700 whitespace-nowrap">Código / Producto:</label>
              <div className="relative flex-1 max-w-2xl">
                <ScanBarcode className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={captureInputRef}
                  autoFocus
                  type="text"
                  value={captureInput}
                  onFocus={() => setNavZone('SEARCH')}
                  onChange={(e) => setCaptureInput(e.target.value)}
                  placeholder="Escanea código de barras o escribe nombre del producto y presiona ENTER..."
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-300 focus:border-blue-600 focus:bg-white rounded-md text-sm font-medium text-zinc-900 outline-none"
                />
              </div>
              <button type="submit" className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                ENTER - Agregar Producto
              </button>
              {ordenActiva?.cliente_nombre && (
                <span className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
                  Cliente: {ordenActiva.cliente_nombre}
                </span>
              )}
            </form>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                {
                  key: 'F10',
                  label: 'Buscar',
                  icon: Search,
                  onClick: () => {
                    setBuscarQuery('');
                    setBuscarIndex(0);
                    setShowBuscarModal(true);
                    setTimeout(() => buscarInputRef.current?.focus(), 60);
                  },
                  disabled: false,
                },
                { key: 'F7', label: 'Entradas', icon: ArrowDownCircle, onClick: () => setCashFlowModal('ENTRADA'), disabled: false },
                { key: 'F8', label: 'Salidas', icon: ArrowUpCircle, onClick: () => setCashFlowModal('SALIDA'), disabled: false },
                {
                  key: 'DEL',
                  label: 'Borrar Art.',
                  icon: Delete,
                  onClick: () => {
                    const sel = itemsActivos.find((i) => i.id === selectedItemId);
                    if (sel) handleAnularItem(sel);
                  },
                  disabled: !selectedItemId,
                },
                {
                  key: 'F9',
                  label: 'Verificador',
                  icon: DollarSign,
                  onClick: () => {
                    setVerificadorQuery('');
                    setShowVerificadorModal(true);
                    setTimeout(() => verificadorInputRef.current?.focus(), 60);
                  },
                  disabled: false,
                },
              ].map((btn) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.key}
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                    className="px-2.5 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-medium text-zinc-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[10px] font-mono font-semibold text-zinc-700">
                      {btn.key}
                    </span>
                    <span>{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-zinc-200/80 border-b border-zinc-300 px-3 pt-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {ordenesAbiertas.map((ord) => {
              const isSelected = ordenActiva?.id === ord.id;
              const canalTabColor =
                ord.canal_venta === 'SALON_MESA'
                  ? isSelected
                    ? 'bg-sky-100 text-sky-950 border-sky-400 shadow-xs'
                    : 'bg-sky-50/80 text-sky-800 border-sky-200 hover:bg-sky-100/70'
                  : ord.canal_venta === 'DOMICILIO'
                    ? isSelected
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-400 shadow-xs'
                      : 'bg-emerald-50/80 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                    : isSelected
                      ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-xs'
                      : 'bg-amber-50/80 text-amber-800 border-amber-200 hover:bg-amber-100/70';
              const pagadoParcialOrd = (ord.pagos_detalle || []).reduce(
                (acc, p) => acc + Number(p.monto_aplicado || 0),
                0
              );
              const faltaOrd = Math.max(0, Number(ord.gran_total || 0) - pagadoParcialOrd);
              return (
                <button
                  key={ord.id}
                  onClick={() => { setOrdenActivaId(ord.id); focusCapture(); }}
                  className={`px-3.5 py-2 rounded-t-lg text-xs font-bold border border-b-0 flex items-center gap-2 whitespace-nowrap cursor-pointer transition ${canalTabColor}`}
                >
                  <span>{getOrdenTabLabel(ord)}</span>
                  <span className="text-xs font-extrabold tabular-nums">{formatMoney(ord.gran_total)}</span>
                  {pagadoParcialOrd > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold tabular-nums">
                      Abono {formatMoney(pagadoParcialOrd)} · Falta {formatMoney(faltaOrd)}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              ref={nuevoTicketBtnRef}
              onClick={handleNuevaVentaMostrador}
              className="px-3 py-1.5 mb-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo Ticket
            </button>
          </div>

          <div className="flex-1 flex min-h-0 overflow-hidden bg-white">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-zinc-200">
              {ordenActiva ? (
                <>
                  {/* Barra destacada de Ticket Activo (armonía estilo eleventa) */}
                  <div
                    className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
                      ordenActiva.canal_venta === 'SALON_MESA'
                        ? 'bg-sky-100/90 border-sky-300 text-sky-950 border-l-4 border-l-sky-600'
                        : ordenActiva.canal_venta === 'DOMICILIO'
                          ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950 border-l-4 border-l-emerald-600'
                          : 'bg-amber-100/90 border-amber-300 text-amber-950 border-l-4 border-l-amber-500'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-extrabold tracking-tight uppercase">
                        VENTA — {getOrdenTabLabel(ordenActiva)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/80 border border-black/10 text-xs font-bold">
                        Mesero: {ordenActiva.mesero_nombre || 'Sin asignar'}
                      </span>
                      {ordenActiva.cliente_nombre && (
                        <span className="px-2 py-0.5 rounded-md bg-white/80 border border-black/10 text-xs font-semibold">
                          Cliente: {ordenActiva.cliente_nombre}
                        </span>
                      )}
                      {ordenActiva.created_at && (
                        <span className="px-2 py-0.5 rounded-md bg-white/80 border border-black/10 text-xs font-bold tabular-nums inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDurationHMS(ordenActiva.created_at, shiftNowMs)}
                        </span>
                      )}
                      {(ordenActiva.pagos_detalle?.length || 0) > 0 && (() => {
                        const abonado = (ordenActiva.pagos_detalle || []).reduce(
                          (a, p) => a + Number(p.monto_aplicado || 0),
                          0
                        );
                        const falta = Math.max(0, Number(ordenActiva.gran_total || 0) - abonado);
                        return (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-xs font-bold tabular-nums">
                            Pagos ({ordenActiva.pagos_detalle?.length}): {formatMoney(abonado)} · Falta {formatMoney(falta)}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      {posConfig.habilitaMesas && (
                        <button
                          type="button"
                          onClick={openAsignarMesaModal}
                          className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white border border-black/15 text-xs font-bold text-zinc-900 flex items-center gap-1 cursor-pointer"
                        >
                          <Utensils className="w-3.5 h-3.5 text-sky-700" />
                          <span>{ordenActiva.mesa_numero ? 'Cambiar Mesa' : 'Asignar Mesa'}</span>
                          <span className="text-[10px] font-mono text-zinc-500">ALT+S</span>
                        </button>
                      )}
                      {posConfig.habilitaDomicilios && ordenActiva.canal_venta !== 'DOMICILIO' && (
                        <button
                          type="button"
                          onClick={() => {
                            setDomNombre(ordenActiva.cliente_nombre || '');
                            setDomTelefono(ordenActiva.cliente_telefono || '');
                            setDomDireccion(ordenActiva.cliente_direccion || '');
                            setDomModoConversion(true);
                            setShowDomicilioModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white border border-black/15 text-xs font-bold text-zinc-900 flex items-center gap-1 cursor-pointer"
                        >
                          <Bike className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Pasar a Domicilio</span>
                          <span className="text-[10px] font-mono text-zinc-500">ALT+D</span>
                        </button>
                      )}
                      <span className="text-sm font-extrabold tabular-nums pl-1">
                        {formatMoney(ordenActiva.gran_total)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-zinc-100 border-b border-zinc-300 text-xs uppercase text-zinc-600 font-bold z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-24 border-r border-zinc-200 bg-sky-50/70">Código</th>
                          <th className="py-2.5 px-3">Descripción del Producto</th>
                          <th className="py-2.5 px-3 text-right w-28">Precio Venta</th>
                          <th className="py-2.5 px-3 text-center w-28">Cant.</th>
                          <th className="py-2.5 px-3 text-right w-28 border-x border-zinc-200 bg-emerald-50/70">Importe</th>
                          <th className="py-2.5 px-3 text-right w-20">Exist.</th>
                          {posConfig.habilitaComandasCocina && <th className="py-2.5 px-3 text-center w-24">Estado</th>}
                          <th className="py-2.5 px-2 text-center w-20">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-sm">
                        {itemsActivos.length === 0 ? (
                          <tr>
                            <td colSpan={posConfig.habilitaComandasCocina ? 8 : 7} className="py-24 text-center text-zinc-400">
                              <p className="font-semibold text-base text-zinc-600">Cuenta vacía ({getOrdenTabLabel(ordenActiva)})</p>
                              <p className="text-xs mt-1 text-zinc-500">Escanea un código, escribe un producto arriba o selecciona en el panel táctil.</p>
                            </td>
                          </tr>
                        ) : (
                          itemsActivos.map((it) => {
                            const isRowSel = selectedItemId === it.id;
                            const stock = it.producto_id ? (prodStockMap.get(it.producto_id) ?? 0) : 0;
                            return (
                              <tr
                                key={it.id}
                                ref={(el) => {
                                  ticketRowRefs.current[it.id] = el;
                                }}
                                onClick={() => {
                                  setSelectedItemId(it.id);
                                  setNavZone('TICKET');
                                }}
                                className={`cursor-pointer transition-colors ${
                                  isRowSel
                                    ? 'bg-blue-100/80 border-l-4 border-l-blue-600'
                                    : 'hover:bg-zinc-50'
                                }`}
                              >
                                <td className="py-3 px-3 font-mono text-xs text-zinc-600 border-r border-zinc-200/80 bg-sky-50/45">{it.codigo_producto || '—'}</td>
                                <td className="py-3 px-3 font-semibold text-[15px] text-zinc-900">
                                  <div>{it.nombre_producto}</div>
                                  {it.notas_comanda && (
                                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100/90 border border-amber-300 text-xs font-semibold text-amber-950">
                                      Cocina: {it.notas_comanda}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right font-semibold tabular-nums text-zinc-700">{formatMoney(it.precio_unitario)}</td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button onClick={(e) => { e.stopPropagation(); void handleCambiarCantidadItem(it, -1); }} className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-700 cursor-pointer">
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="font-extrabold text-base tabular-nums text-zinc-950 min-w-[26px] text-center">{it.cantidad}</span>
                                    <button onClick={(e) => { e.stopPropagation(); void handleCambiarCantidadItem(it, 1); }} className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-700 cursor-pointer">
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right font-extrabold text-[15px] tabular-nums text-zinc-950 border-x border-zinc-200/80 bg-emerald-50/50">{formatMoney(it.subtotal)}</td>
                                <td className="py-3 px-3 text-right font-semibold tabular-nums text-xs text-zinc-500">{stock}</td>
                                {posConfig.habilitaComandasCocina && (
                                  <td className="py-3 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${it.estado_comanda === 'COMANDADO' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
                                      {it.estado_comanda}
                                    </span>
                                  </td>
                                )}
                                <td className="py-3 px-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      title="Ingresa solicitudes para cocina"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedItemId(it.id);
                                        setNotaItemTarget(it);
                                        setNotaItemText(it.notas_comanda || '');
                                      }}
                                      className="p-2 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 cursor-pointer"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); void handleAnularItem(it); }} className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-6">
                  <p className="font-semibold text-zinc-700">No hay cuentas abiertas</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={handleNuevaVentaMostrador} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer">+ Abrir Venta Mostrador</button>
                    {posConfig.habilitaMesas && (
                      <button onClick={() => setActiveTab('MESAS')} className="px-4 py-2 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 font-semibold text-xs cursor-pointer">F2 Ver Mapa de Mesas</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {touchMode && (
              <div className="w-[40%] max-w-[520px] min-w-[320px] bg-zinc-50 flex flex-col min-h-0 overflow-hidden">
                <div className="p-2 border-b border-zinc-200 bg-white flex items-center gap-1.5 overflow-x-auto shrink-0">
                  {categoriasProductos.map((c, cIdx) => {
                    const isCatActive = catFiltro === c;
                    const isCatFocused = navZone === 'CATEGORIES' && isCatActive;
                    return (
                      <button
                        key={c}
                        ref={(el) => {
                          categoryBtnRefs.current[cIdx] = el;
                        }}
                        onClick={() => {
                          setCatFiltro(c);
                          setFocusedProductIndex(0);
                          setNavZone('CATEGORIES');
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer border transition-all ${
                          isCatActive
                            ? isCatFocused
                              ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-1 shadow-sm'
                              : 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-2 xl:grid-cols-3 gap-2 content-start">
                  {productosFiltrados.map((p, pIdx) => {
                    const isProdFocused = navZone === 'PRODUCTS' && focusedProductIndex === pIdx;
                    return (
                      <button
                        key={p.id}
                        ref={(el) => {
                          productCardRefs.current[pIdx] = el;
                        }}
                        disabled={busyAction}
                        onClick={() => {
                          setFocusedProductIndex(pIdx);
                          setNavZone('PRODUCTS');
                          void handleAgregarProducto(p, 1);
                        }}
                        className={`p-2.5 rounded-lg border text-left flex flex-col justify-between min-h-[76px] cursor-pointer transition-all ${
                          isProdFocused
                            ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500 shadow-xs'
                            : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50 active:bg-zinc-100'
                        }`}
                      >
                        <span className="font-semibold text-xs text-zinc-900 leading-snug line-clamp-2">{p.nombre}</span>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] font-mono text-zinc-400">{p.codigo}</span>
                          <span className="text-xs font-bold tabular-nums text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">{formatMoney(p.precio_total)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <footer className="bg-white border-t border-zinc-200 px-3 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-zinc-700 mr-2 tabular-nums">
                  {itemsActivos.reduce((a, b) => a + Number(b.cantidad || 0), 0)} Productos en la venta actual
                </span>
                <button onClick={handleCambiarSiguienteTicket} className="px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-700 cursor-pointer">
                  Shift+←/→ Cambiar
                </button>
                <button
                  onClick={() => {
                    if (!ordenActiva) return;
                    setAsignarNombre(ordenActiva.cliente_nombre || '');
                    setAsignarTel(ordenActiva.cliente_telefono || '');
                    setShowAsignarClienteModal(true);
                  }}
                  disabled={!ordenActiva}
                  className="px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-bold text-zinc-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-zinc-600" />
                  <span>Asignar Cliente</span>
                  <span className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[10px] font-mono font-bold text-zinc-600">
                    ALT+C
                  </span>
                </button>
                <button
                  onClick={() => {
                    if (!ordenActiva) return;
                    const curIdx = operarios.findIndex((o) => o.nombre_cajero === ordenActiva.mesero_nombre);
                    setFocusedMeseroIdx(curIdx >= 0 ? curIdx : 0);
                    setShowAsignarMeseroModal(true);
                  }}
                  disabled={!ordenActiva}
                  className="px-3 py-1.5 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 disabled:opacity-40 text-xs font-bold text-sky-900 flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-sky-700" />
                  <span>Asignar Personal</span>
                  <span className="px-1 py-0.5 rounded bg-white border border-sky-200 text-[10px] font-mono font-bold text-sky-700">
                    ALT+M
                  </span>
                </button>
                {posConfig.habilitaComandasCocina && (
                  <>
                    <button onClick={() => void handleEnviarComanda(false)} disabled={!ordenActiva || busyAction} className="px-2.5 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-bold text-zinc-700 flex items-center gap-1 cursor-pointer">
                      <ChefHat className="w-3.5 h-3.5 text-zinc-600" />
                      F6 - Comandar
                    </button>
                    <button onClick={handleImprimirPrecuenta} disabled={!ordenActiva || itemsActivos.length === 0 || busyAction} className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-semibold text-zinc-700 flex items-center gap-1 cursor-pointer">
                      <Printer className="w-3.5 h-3.5 text-zinc-600" />
                      Precuenta
                    </button>
                  </>
                )}
                <button onClick={handleEliminarTicket} disabled={!ordenActiva || busyAction} className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-red-50 hover:border-red-300 disabled:opacity-40 text-xs font-semibold text-red-700 flex items-center gap-1.5 cursor-pointer">
                  <span>Eliminar</span>
                  <span className="px-1 py-0.5 rounded bg-red-50 border border-red-200 text-[10px] font-mono font-semibold text-red-600">
                    SHIFT+DEL
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs bg-zinc-50 border border-zinc-200 rounded-md px-3 py-1 w-fit tabular-nums">
                <div><span className="text-zinc-500">Último Total: </span><span className="font-bold text-zinc-900">{formatMoney(lastPayment.total)}</span></div>
                <div><span className="text-zinc-500">Pagó Con: </span><span className="font-bold text-zinc-900">{formatMoney(lastPayment.pagoCon)}</span></div>
                <div><span className="text-zinc-500">Cambio: </span><span className="font-bold text-blue-700">{formatMoney(lastPayment.cambio)}</span></div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button onClick={handleReimprimirUltimo} className="px-3.5 py-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-700 flex items-center gap-1.5 cursor-pointer">
                <Printer className="w-4 h-4 text-zinc-500" />
                Reimprimir Último Ticket
              </button>

              <button onClick={abrirModalCobro} disabled={!ordenActiva || itemsActivos.length === 0 || busyAction} className="px-6 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-base flex items-center gap-2 cursor-pointer">
                <CreditCard className="w-5 h-5" />
                F12 - Cobrar
              </button>

              <div className="bg-zinc-100 text-zinc-950 px-5 py-2 rounded-lg border border-zinc-300 min-w-[180px] text-right">
                <div className="text-[10px] font-semibold uppercase text-zinc-500 leading-none">Total Cuenta</div>
                <div className="text-3xl font-extrabold tabular-nums tracking-tight leading-tight text-zinc-950">
                  {formatMoney(ordenActiva?.gran_total || 0)}
                </div>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* ==================== F2: MAPA DE MESAS ==================== */}
      {activeTab === 'MESAS' && posConfig.habilitaMesas && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-zinc-100">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {zonasDisponibles.map((z, zIdx) => {
                const isZoneActive = zonaFiltro === z;
                const isZoneFocused = mesasNavZone === 'ZONES' && isZoneActive;
                return (
                  <button
                    key={z}
                    ref={(el) => {
                      zonaBtnRefs.current[zIdx] = el;
                    }}
                    onClick={() => {
                      setZonaFiltro(z);
                      setFocusedMesaIndex(0);
                      setMesasNavZone('ZONES');
                    }}
                    className={`px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer border transition-all ${
                      isZoneActive
                        ? isZoneFocused
                          ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-1 shadow-sm'
                          : 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {z}
                  </button>
                );
              })}
            </div>
            <button
              ref={ventaMostradorBtnRef}
              onClick={handleNuevaVentaMostrador}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              <Plus className="w-4 h-4" /> Venta Mostrador / Para Llevar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
            {mesasFiltradas.map((m, mIdx) => {
              const ocupada = m.estado !== 'LIBRE';
              const isMesaFocused = mesasNavZone === 'TABLES' && focusedMesaIndex === mIdx;
              return (
                <button
                  key={m.id}
                  ref={(el) => {
                    mesaCardRefs.current[mIdx] = el;
                  }}
                  onClick={() => {
                    setFocusedMesaIndex(mIdx);
                    setMesasNavZone('TABLES');
                    void handleAbrirMesa(m);
                  }}
                  className={`p-4 rounded-lg border text-left cursor-pointer flex flex-col justify-between min-h-[120px] transition-all ${
                    isMesaFocused
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500 shadow-sm'
                      : m.estado === 'PRECUENTA_IMPRESA'
                        ? 'bg-white border-blue-500 ring-1 ring-blue-500'
                        : ocupada
                          ? 'bg-white border-zinc-900 ring-1 ring-zinc-900'
                          : 'bg-white border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-zinc-900">{m.nombre}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${m.estado === 'PRECUENTA_IMPRESA' ? 'bg-blue-50 text-blue-700 border-blue-200' : ocupada ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                      {m.estado}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500">{m.zona}</div>
                  {ocupada && m.orden_activa ? (
                    <div className="mt-2 pt-2 border-t border-zinc-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold tabular-nums text-zinc-950">{formatMoney(m.orden_activa.gran_total)}</div>
                        {(m.abierta_at || m.orden_activa.created_at) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-bold tabular-nums text-amber-900">
                            <Clock className="w-3 h-3" />
                            {formatDurationHMS(m.abierta_at || m.orden_activa.created_at!, shiftNowMs)}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500">{m.orden_activa.items?.length || 0} ítems • {m.mesero_actual || cajeroNombre}</div>
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        {(m.caja_ocupante || m.orden_activa.caja_nombre) && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[10px] font-bold text-zinc-700">
                            Caja: {m.caja_ocupante || m.orden_activa.caja_nombre}
                          </span>
                        )}
                        {(m.orden_activa.pagos_detalle?.length || 0) > 0 && (() => {
                          const abonado = (m.orden_activa.pagos_detalle || []).reduce(
                            (a, p) => a + Number(p.monto_aplicado || 0),
                            0
                          );
                          const falta = Math.max(0, Number(m.orden_activa.gran_total || 0) - abonado);
                          return (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-[10px] font-bold tabular-nums text-emerald-900">
                              Pagado {formatMoney(abonado)} · Falta {formatMoney(falta)}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-zinc-500 font-medium">Clic para abrir</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== DOMICILIOS ==================== */}
      {activeTab === 'DOMICILIOS' && posConfig.habilitaDomicilios && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-zinc-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Despacho de Domicilios</h2>
              <p className="text-xs text-zinc-500">Pedidos separados de las ventas en punto</p>
            </div>
            <button onClick={() => setShowDomicilioModal(true)} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer">
              <Bike className="w-4 h-4" /> + Nuevo Domicilio
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ordenesDomicilio.map((dom) => (
              <div key={dom.id} className="bg-white rounded-lg border border-zinc-200 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-zinc-900">{dom.consecutivo}</span>
                    <div className="flex items-center gap-1.5">
                      {dom.estado !== 'FACTURADA' && dom.created_at && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 tabular-nums inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDurationHMS(dom.created_at, shiftNowMs)}
                        </span>
                      )}
                      {dom.caja_nombre && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800">
                          Caja: {dom.caja_nombre}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700">{dom.estado_domicilio || dom.estado}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-zinc-800">{dom.cliente_nombre}</div>
                  <div className="text-xs text-zinc-600">{dom.cliente_telefono}</div>
                  <div className="text-xs text-zinc-600">{dom.cliente_direccion}</div>
                  <div className="text-xs text-zinc-500 mt-1">Repartidor: <b>{dom.domiciliario_nombre || 'Sin asignar'}</b> • Envío: {formatMoney(dom.costo_domicilio)}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <span className="font-bold tabular-nums text-zinc-950">{formatMoney(dom.gran_total)}</span>
                  <div className="flex gap-1.5">
                    {dom.estado !== 'FACTURADA' && (
                      <button onClick={() => { setOrdenActivaId(dom.id); setActiveTab('VENTAS'); }} className="px-2.5 py-1 rounded bg-zinc-900 text-white text-xs font-semibold cursor-pointer">Abrir (F1)</button>
                    )}
                    {dom.estado_domicilio === 'EN_PREPARACION' && (
                      <button onClick={async () => { await executePosAction('ACTUALIZAR_ESTADO_DOMICILIO', { orden_id: dom.id, estado_domicilio: 'EN_RUTA' }); fetchPosState(); }} className="px-2.5 py-1 rounded bg-white border border-zinc-300 text-zinc-800 text-xs font-semibold cursor-pointer">En Ruta</button>
                    )}
                    {dom.estado_domicilio === 'EN_RUTA' && (
                      <button onClick={async () => { await executePosAction('ACTUALIZAR_ESTADO_DOMICILIO', { orden_id: dom.id, estado_domicilio: 'ENTREGADO' }); fetchPosState(); }} className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-semibold cursor-pointer">Entregado</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== F3: PRODUCTOS ==================== */}
      {activeTab === 'PRODUCTOS' && (
        <PosProductsModule
          productos={productos}
          categorias={categorias}
          canEditProducts={canEditProducts}
          busyAction={busyAction}
          onSaveProducto={async (payload) => {
            setBusyAction(true);
            try {
              await executePosAction('GUARDAR_PRODUCTO_POS', payload);
              await fetchPosState('full');
              notify('ok', 'Producto guardado correctamente.');
            } catch (e: unknown) {
              notify('err', e instanceof Error ? e.message : 'Error guardando producto');
            } finally {
              setBusyAction(false);
            }
          }}
          onDeleteProducto={async (id) => {
            setBusyAction(true);
            try {
              await executePosAction('ELIMINAR_PRODUCTO_POS', { id });
              await fetchPosState('full');
              notify('ok', 'Producto eliminado del catálogo.');
            } catch (e: unknown) {
              notify('err', e instanceof Error ? e.message : 'Error eliminando producto');
            } finally {
              setBusyAction(false);
            }
          }}
        />
      )}

      {/* ==================== F4: INVENTARIO ==================== */}
      {activeTab === 'INVENTARIO' && (
        <PosInventoryModule
          productos={productos}
          movimientos={movimientosInventario}
          busyAction={busyAction}
          onAjustarInventario={async (payload) => {
            setBusyAction(true);
            try {
              await executePosAction('AJUSTAR_INVENTARIO_POS', payload);
              await fetchPosState('full');
              notify('ok', 'Movimiento de inventario registrado.');
            } catch (e: unknown) {
              notify('err', e instanceof Error ? e.message : 'Error actualizando inventario');
            } finally {
              setBusyAction(false);
            }
          }}
        />
      )}

      {/* ==================== CORTE DE CAJA (3 COLUMNAS CONSERVADAS) ==================== */}
      {activeTab === 'CORTE' && (
        <PosCashCutView
          config={posConfig}
          cajaNombre={cajaNombre}
          cajeroNombre={cajeroNombre}
          sesionActiva={sesionActiva}
          resumenDia={resumenDia}
          salidasDiaCaja={salidasDiaCaja}
          abonosEfectivoHoy={abonosEfectivoHoy}
          entradasEfectivoHoy={entradasEfectivoHoy}
          devolucionesEfectivoHoy={devolucionesEfectivoHoy}
          corteDepartamentos={corteDepartamentos}
          flujoEfectivoDetallado={flujoEfectivoDetallado}
          consumosInternosHoy={consumosInternosHoy}
          gananciaEstimadaHoy={gananciaEstimadaHoy}
          eventosTurno={eventosTurno}
          busyAction={busyAction}
          onExecuteCierre={async (tipo, contado, obs) => {
            setBusyAction(true);
            try {
              const res = await executePosAction(tipo, {
                sesion_id: sesionActiva?.id,
                efectivo_contado: contado,
                observaciones: obs,
              });
              await fetchPosState();
              notify('ok', `${tipo === 'CIERRE_TOTAL_CAJA' ? 'Cierre Total (Z)' : 'Cierre Parcial (X)'} ejecutado.`);
              return (res.resumen as CierreResumen) || null;
            } catch (e: unknown) {
              notify('err', e instanceof Error ? e.message : 'Error ejecutando cierre');
              return null;
            } finally {
              setBusyAction(false);
            }
          }}
        />
      )}

      {/* ==================== MODAL F12: COBRAR O CONSUMO INTERNO ==================== */}
      {showCobroModal && ordenActiva && (
        <PosCheckoutModal
          ordenActiva={ordenActiva}
          itemsActivos={itemsActivos}
          productos={productos}
          operarios={operarios}
          creditosClientes={creditosClientes}
          habilitaPropinas={posConfig.habilitaPropinas}
          busyAction={busyAction}
          onClose={() => setShowCobroModal(false)}
          onRegistrarPagoParcial={async (pago) => {
            try {
              const res = await executePosAction('REGISTRAR_PAGO_PARCIAL', {
                orden_id: ordenActiva.id,
                ...pago,
              });
              await fetchPosState();
              notify('ok', `Pago parcial de ${formatMoney(pago.monto_aplicado)} guardado.`);
              return res?.pago || null;
            } catch (e: unknown) {
              notify('err', e instanceof Error ? e.message : 'Error guardando pago parcial');
              return null;
            }
          }}
          onEliminarPagoParcial={async (pagoId) => {
            try {
              await executePosAction('ELIMINAR_PAGO_PARCIAL', {
                orden_id: ordenActiva.id,
                pago_id: pagoId,
              });
              await fetchPosState();
              notify('ok', 'Pago parcial eliminado.');
            } catch (e: unknown) {
              notify('err', e instanceof Error ? e.message : 'Error eliminando pago parcial');
            }
          }}
          onConfirmarCobro={handleConfirmarCobro}
        />
      )}

      {/* Modal Asignar Cliente / Personal */}
      {showAsignarClienteModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <form onSubmit={handleAsignarCliente} className="bg-white rounded-xl border border-zinc-300 max-w-sm w-full p-5 space-y-3 shadow-xl text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">Asignar Cliente o Personal</h3>
              <button type="button" onClick={() => setShowAsignarClienteModal(false)} className="p-1 text-zinc-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input type="text" autoFocus value={asignarNombre} onChange={(e) => setAsignarNombre(e.target.value)} placeholder="Nombre del cliente o colaborador" className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-medium" />
            <input type="text" value={asignarTel} onChange={(e) => setAsignarTel(e.target.value)} placeholder="Teléfono (opcional)" className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" />
            <button type="submit" disabled={busyAction} className="w-full py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer">Guardar Asignación</button>
          </form>
        </div>
      )}

      {/* Modal Confirmación Cancelar Ticket (Shift + Supr) */}
      {showCancelarTicketModal && ordenActiva && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950">Cancelar Ticket</h3>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  ¿Desea cancelar el ticket <b className="text-zinc-950">{getOrdenTabLabel(ordenActiva)}</b> por monto de{' '}
                  <b className="text-red-700 tabular-nums">{formatMoney(ordenActiva.gran_total)}</b>?
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCancelarTicketModal(false);
                  focusCapture();
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => {
                  setShowCancelarTicketModal(false);
                  focusCapture();
                }}
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                autoFocus
                disabled={busyAction}
                onClick={() => void handleConfirmarCancelarTicket()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                {busyAction ? 'Cancelando...' : 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal F11 */}
      {showMayoreoModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-sm w-full p-5 space-y-3 shadow-xl text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">F11 — Ajustar Precio / Cantidad</h3>
              <button onClick={() => setShowMayoreoModal(false)} className="p-1 text-zinc-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="font-semibold text-zinc-700 block mb-1">Cantidad</label><input type="number" step="any" value={mayoreoCantidad} onChange={(e) => setMayoreoCantidad(Number(e.target.value || 1))} className={`w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-bold ${noSpinnerClass}`} /></div>
              <div><label className="font-semibold text-zinc-700 block mb-1">Precio Unitario ($)</label><input type="number" value={mayoreoPrecio} onChange={(e) => setMayoreoPrecio(Number(e.target.value || 0))} className={`w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-bold ${noSpinnerClass}`} /></div>
            </div>
            <div><label className="font-semibold text-zinc-700 block mb-1">Nota / Observación</label><input type="text" value={mayoreoNotas} onChange={(e) => setMayoreoNotas(e.target.value)} placeholder="Ej. Término 3/4, precio mayoreo..." className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md" /></div>
            <button onClick={handleGuardarMayoreo} disabled={busyAction} className="w-full py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer">Aplicar Cambios</button>
          </div>
        </div>
      )}

      {/* Modal F10 */}
      {showBuscarModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-2xl w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">F10 — Buscador de Productos</h3>
              <button onClick={() => setShowBuscarModal(false)} className="p-1 text-zinc-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <input
              ref={buscarInputRef}
              type="text"
              value={buscarQuery}
              onChange={(e) => { setBuscarQuery(e.target.value); setBuscarIndex(0); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setBuscarIndex((i) => Math.min(productosBusquedaModal.length - 1, i + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setBuscarIndex((i) => Math.max(0, i - 1)); }
                else if (e.key === 'Enter' && productosBusquedaModal[buscarIndex]) {
                  e.preventDefault();
                  handleAgregarProducto(productosBusquedaModal[buscarIndex], 1);
                  setShowBuscarModal(false);
                }
              }}
              placeholder="Escribe nombre o código... (↑/↓ y ENTER para agregar)"
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-medium outline-none focus:border-blue-600"
            />
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200 rounded-md">
              {productosBusquedaModal.map((p, idx) => (
                <button key={p.id} onClick={() => { handleAgregarProducto(p, 1); setShowBuscarModal(false); }} className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs cursor-pointer ${idx === buscarIndex ? 'bg-blue-50 font-semibold' : 'hover:bg-zinc-50'}`}>
                  <div><span className="font-mono text-zinc-400 mr-2">{p.codigo}</span><span className="text-zinc-900">{p.nombre}</span></div>
                  <span className="font-bold tabular-nums text-zinc-900">{formatMoney(p.precio_total)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal F9 */}
      {showVerificadorModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-md w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">F9 — Verificador de Precios</h3>
              <button onClick={() => setShowVerificadorModal(false)} className="p-1 text-zinc-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <input ref={verificadorInputRef} type="text" value={verificadorQuery} onChange={(e) => setVerificadorQuery(e.target.value)} placeholder="Escanea código o escribe nombre..." className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-medium outline-none focus:border-blue-600" />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {verificadorMatch.map((p) => (
                <div key={p.id} className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                  <div><div className="text-xs font-mono text-zinc-500">{p.codigo}</div><div className="font-semibold text-sm text-zinc-900">{p.nombre}</div></div>
                  <div className="text-xl font-extrabold tabular-nums text-zinc-950">{formatMoney(p.precio_total)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal INS */}
      {showVariosModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-sm w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">INS — Agregar Artículo Varios</h3>
              <button onClick={() => setShowVariosModal(false)} className="p-1 text-zinc-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <input type="text" value={variosNombre} onChange={(e) => setVariosNombre(e.target.value)} placeholder="Descripción" className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-medium" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={variosCantidad} onChange={(e) => setVariosCantidad(Number(e.target.value || 1))} placeholder="Cant." className={`px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold ${noSpinnerClass}`} />
              <input type="number" value={variosPrecio} onChange={(e) => setVariosPrecio(Number(e.target.value || 0))} placeholder="Precio" className={`px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold ${noSpinnerClass}`} />
            </div>
            <button onClick={handleAgregarVarios} className="w-full py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer">Agregar a la Cuenta</button>
          </div>
        </div>
      )}

      {/* Modal CTRL+P */}
      {showArtComunModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-lg w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">CTRL+P — Artículos Comunes</h3>
              <button onClick={() => setShowArtComunModal(false)} className="p-1 text-zinc-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {productosComunes.map((p) => (
                <button key={p.id} onClick={() => { handleAgregarProducto(p, 1); setShowArtComunModal(false); }} className="p-3 rounded-lg border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-left cursor-pointer">
                  <div className="font-semibold text-xs text-zinc-900 line-clamp-2">{p.nombre}</div>
                  <div className="font-bold text-xs tabular-nums text-zinc-700 mt-1">{formatMoney(p.precio_total)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal F7 / F8 sincronizado con Libro de Caja y Recibo de Caja único */}
      {cashFlowModal && (
        <PosCashFlowModal
          mode={cashFlowModal}
          sesionId={sesionActiva?.id || null}
          busyAction={busyAction}
          executePosAction={executePosAction}
          onCompleted={async () => {
            await fetchPosState();
          }}
          onClose={() => {
            setCashFlowModal(null);
            focusCapture();
          }}
          notify={notify}
        />
      )}

      {/* ==================== F5: VENTAS Y DEVOLUCIONES (INTEGRADO) ==================== */}
      {activeTab === 'VENTAS_DIA' && (
        <PosSalesHistoryView
          currentCajaNombre={cajaNombre}
          cajasAbiertasHoy={cajasAbiertasHoy}
          ordenesFacturadas={ordenesFacturadasHoy}
          consumosInternosHoy={consumosInternosHoy}
          devolucionesDia={devolucionesDia}
          busyAction={busyAction}
          onReimprimirOrden={async (orden) => {
            await safePrintTicket({
              titulo: 'COPIA DE FACTURA POS',
              consecutivo: orden.consecutivo,
              fecha: orden.fecha,
              caja: orden.caja_nombre,
              cajero: orden.cajero_nombre,
              canal: orden.canal_venta,
              mesaNumero: orden.mesa_numero,
              clienteNombre: orden.cliente_nombre,
              items: orden.items.map((it) => ({
                nombre: it.nombre_producto,
                cantidad: it.cantidad,
                precioUnitario: it.precio_unitario,
                subtotal: it.subtotal,
              })),
              subtotal: orden.subtotal_bruto,
              descuento: orden.descuento,
              propina: orden.propina,
              costoDomicilio: orden.costo_domicilio,
              total: orden.gran_total,
              metodoPago: orden.metodo_pago,
            });
            notify('ok', `Copia de ${orden.consecutivo} enviada.`);
          }}
          onDevolverItem={async (payload) => {
            setBusyAction(true);
            try {
              await executePosAction('DEVOLVER_ITEM_FACTURADO', payload);
              await fetchPosState();
              notify('ok', 'Devolución registrada y descontada del cuadre.');
            } catch (e: unknown) {
              notify('err', e instanceof Error ? e.message : 'Error procesando devolución');
            } finally {
              setBusyAction(false);
            }
          }}
          onDevolverTicketCompleto={async (payload) => {
            setBusyAction(true);
            try {
              await executePosAction('DEVOLVER_TICKET_COMPLETO', payload);
              await fetchPosState();
              notify('ok', 'Devolución completa del ticket registrada.');
            } catch (e: unknown) {
              notify('err', e instanceof Error ? e.message : 'Error devolviendo ticket');
            } finally {
              setBusyAction(false);
            }
          }}
        />
      )}

      {/* Modal Asignar Personal / Mesero (Alt+M) */}
      {showAsignarMeseroModal && ordenActiva && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-300 max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950">Asignar Personal / Mesero (Alt+M)</h3>
                <p className="text-xs text-zinc-500">
                  Las propinas de {getOrdenTabLabel(ordenActiva)} se atribuirán al personal seleccionado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAsignarMeseroModal(false);
                  focusCapture();
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
              {operarios.map((op, opIdx) => {
                const selected = ordenActiva.mesero_nombre === op.nombre_cajero;
                const isKeyFocused = focusedMeseroIdx === opIdx;
                return (
                  <button
                    key={op.id}
                    type="button"
                    disabled={busyAction}
                    onClick={async () => {
                      setBusyAction(true);
                      try {
                        await executePosAction('ASIGNAR_MESERO_ORDEN', {
                          orden_id: ordenActiva.id,
                          mesero_nombre: op.nombre_cajero,
                        });
                        setShowAsignarMeseroModal(false);
                        await fetchPosState();
                        focusCapture();
                        notify('ok', `Personal asignado: ${op.nombre_cajero}`);
                      } catch (e: unknown) {
                        notify('err', e instanceof Error ? e.message : 'Error asignando personal');
                      } finally {
                        setBusyAction(false);
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                      selected
                        ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                        : 'bg-zinc-50 text-zinc-900 border-zinc-300 hover:bg-sky-50 hover:border-sky-400'
                    } ${isKeyFocused ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                  >
                    <div className="font-bold text-sm truncate">{op.nombre_cajero}</div>
                    <div className={`text-[11px] truncate mt-0.5 ${selected ? 'text-sky-100' : 'text-zinc-500'}`}>
                      {op.cargo_area}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ingresa Solicitudes para Cocina (Lapicito / Enter en Ticket) */}
      {notaItemTarget && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950/55 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusyAction(true);
              try {
                await executePosAction('ACTUALIZAR_NOTA_ITEM', {
                  item_id: notaItemTarget.id,
                  notas_comanda: notaItemText,
                });
                setNotaItemTarget(null);
                await fetchPosState();
                focusCapture();
                notify('ok', 'Solicitud para cocina guardada.');
              } catch (err: unknown) {
                notify('err', err instanceof Error ? err.message : 'Error guardando solicitud');
              } finally {
                setBusyAction(false);
              }
            }}
            className="bg-white rounded-2xl border border-zinc-300 max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950">Ingresa solicitudes para cocina</h3>
                <p className="text-xs text-zinc-500">{notaItemTarget.nombre_producto}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNotaItemTarget(null);
                  focusCapture();
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['Sin cebolla', 'Término 3/4', 'Bien asado', 'Sin sal', 'Salsa aparte', 'Para llevar'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setNotaItemText((prev) => (prev ? `${prev}, ${chip}` : chip))}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-bold text-amber-900 cursor-pointer"
                >
                  + {chip}
                </button>
              ))}
            </div>

            <input
              type="text"
              autoFocus
              value={notaItemText}
              onChange={(e) => setNotaItemText(e.target.value)}
              placeholder="Ej: Sin ensalada, término medio, bien cocido..."
              className="w-full px-3.5 py-2.5 border border-zinc-300 focus:border-blue-500 rounded-xl text-sm font-medium outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNotaItemTarget(null);
                  focusCapture();
                }}
                className="px-4 py-2 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busyAction}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Guardar Solicitud
              </button>
            </div>
          </form>
        </div>
      )}

      {showCreditosModal && (
        <PosCreditsModal
          clientes={creditosClientes}
          busyAction={busyAction}
          onClose={() => setShowCreditosModal(false)}
          onRegistrarAbono={async (payload) => {
            setBusyAction(true);
            try {
              await executePosAction('REGISTRAR_ABONO_CREDITO', payload);
              await fetchPosState('full');
              notify('ok', `Abono de ${formatMoney(payload.monto)} registrado.`);
            } catch (e: unknown) {
              notify('err', e instanceof Error ? e.message : 'Error registrando abono');
            } finally {
              setBusyAction(false);
            }
          }}
        />
      )}

      {showSettingsModal && (
        <PosTerminalSettingsModal
          config={posConfig}
          onClose={() => setShowSettingsModal(false)}
          onSave={(next) => {
            setPosConfig(next);
            saveElianaPosConfig(next);
            if (!next.habilitaMesas && activeTab === 'MESAS') setActiveTab('VENTAS');
            if (!next.habilitaDomicilios && activeTab === 'DOMICILIOS') setActiveTab('VENTAS');
            notify('ok', 'Configuración guardada.');
          }}
        />
      )}

      {showExitModal && (
        <PosExitConfirmModal
          sesionActiva={sesionActiva}
          onClose={() => setShowExitModal(false)}
          onGoToCutAndClose={() => {
            setShowExitModal(false);
            setActiveTab('CORTE');
          }}
          onLeaveOpenAndExit={() => {
            setShowExitModal(false);
            router.push('/');
          }}
        />
      )}

      {/* Modal Confirmación Reenviar Comanda a Cocina (F6) */}
      {showReenviarComandaModal && ordenActiva && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-300 max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950">Comanda ya enviada anteriormente</h3>
                <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
                  Ya enviaste la comanda de este ticket (<b className="text-zinc-900">{getOrdenTabLabel(ordenActiva)}</b>). ¿Estás seguro de que deseas enviar nuevamente la comanda de este ticket a cocina?
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReenviarComandaModal(false);
                  focusCapture();
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => {
                  setShowReenviarComandaModal(false);
                  focusCapture();
                }}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
                  reenviarComandaFocusBtn === 'CANCEL'
                    ? 'bg-zinc-900 text-white border-zinc-900 ring-2 ring-blue-400'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleEnviarComanda(true)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                  reenviarComandaFocusBtn === 'CONFIRM'
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                    : 'bg-blue-600/90 hover:bg-blue-700 text-white'
                }`}
              >
                Sí, enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Asignar / Cambiar Mesa a Ticket Abierto (Alt+S) */}
      {showAsignarMesaModal && ordenActiva && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-300 max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950">Asignar Mesa a {getOrdenTabLabel(ordenActiva)}</h3>
                <p className="text-xs text-zinc-500">Usa ↑ ↓ ← → para elegir mesa y Enter para confirmar.</p>
              </div>
              <button type="button" onClick={() => setShowAsignarMesaModal(false)} className="p-1.5 text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-80 overflow-y-auto p-1">
              {mesas.map((m, idx) => {
                const libre = m.estado === 'LIBRE' || m.orden_activa_id === ordenActiva.id;
                const isFocused = focusedAsignarMesaIdx === idx;
                return (
                  <button
                    key={m.id}
                    ref={(el) => {
                      asignarMesaBtnRefs.current[idx] = el;
                    }}
                    type="button"
                    disabled={!libre || busyAction}
                    onClick={() => void handleAsignarMesaSeleccionada(m)}
                    className={`p-3 rounded-xl border text-left transition ${
                      libre
                        ? isFocused
                          ? 'bg-sky-100 border-blue-600 ring-2 ring-blue-600 text-sky-950 cursor-pointer shadow-sm'
                          : 'bg-sky-50/70 hover:bg-sky-100 border-sky-300 text-sky-950 cursor-pointer'
                        : isFocused
                          ? 'bg-zinc-200 border-zinc-400 ring-2 ring-zinc-400 text-zinc-500 opacity-75 cursor-not-allowed'
                          : 'bg-zinc-100 border-zinc-200 text-zinc-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="font-bold text-sm">{m.nombre}</div>
                    <div className="text-[11px]">{m.zona} · {libre ? 'Disponible' : 'Ocupada'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showDomicilioModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-300 max-w-lg w-full p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
              <div>
                <h3 className="font-bold text-base text-zinc-900">
                  {domModoConversion ? 'Pasar Ticket a Domicilio' : 'Nuevo Pedido a Domicilio'}
                </h3>
                <p className="text-[11px] text-zinc-500">Origen: Av. Pasoancho con 72 esquina, Cali</p>
              </div>
              <button onClick={() => { setShowDomicilioModal(false); setDomModoConversion(false); }} className="p-1 text-zinc-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input type="text" placeholder="Nombre del cliente" value={domNombre} onChange={(e) => setDomNombre(e.target.value)} className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm" />
              <input type="text" placeholder="Teléfono / WhatsApp" value={domTelefono} onChange={(e) => setDomTelefono(e.target.value)} className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm" />
            </div>

            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Dirección completa en Cali (Ej: Cra 80 # 14-20)"
                  value={domDireccion}
                  onChange={(e) => setDomDireccion(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-zinc-300 rounded-xl text-sm"
                />
                <button
                  type="button"
                  disabled={calcDomLoading || domDireccion.trim().length < 4}
                  onClick={async () => {
                    setCalcDomLoading(true);
                    setDomDistanciaInfo('');
                    try {
                      const res = await fetch('/api/pos/distancia-domicilio', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ direccion: domDireccion }),
                      });
                      const data = await res.json();
                      if (!res.ok || !data?.success) {
                        setDomDistanciaInfo(data?.error || 'No se pudo calcular distancia.');
                      } else {
                        setDomCostoEnvio(Number(data.tarifaSugerida || 4000));
                        setDomDistanciaInfo(
                          `${data.distanciaKm} km · ~${data.duracionMin} min · Sugerido: ${formatMoney(data.tarifaSugerida)}`
                        );
                      }
                    } catch {
                      setDomDistanciaInfo('Error calculando distancia.');
                    } finally {
                      setCalcDomLoading(false);
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  {calcDomLoading ? 'Calculando...' : 'Calcular Distancia'}
                </button>
              </div>
              {domDistanciaInfo && (
                <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                  {domDistanciaInfo}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Valor Domicilio ($)</label>
              <input type="number" value={domCostoEnvio} onChange={(e) => setDomCostoEnvio(Number(e.target.value || 0))} placeholder="Valor domicilio" className={`w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm font-bold ${noSpinnerClass}`} />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">Seleccionar Domiciliario:</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Domiciliario 1', 'Domiciliario 2', 'Domiciliario 3'] as const).map((rep) => {
                  const active = domRepartidor === rep;
                  return (
                    <button
                      key={rep}
                      type="button"
                      onClick={() => setDomRepartidor(rep)}
                      className={`py-3 px-2 rounded-xl border text-xs font-bold text-center cursor-pointer transition ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-zinc-50 text-zinc-800 border-zinc-300 hover:bg-blue-50'
                      }`}
                    >
                      {rep}
                    </button>
                  );
                })}
              </div>
            </div>

            <button onClick={handleCrearDomicilio} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer">
              Crear Domicilio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
