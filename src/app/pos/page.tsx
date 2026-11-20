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
  Package,
  Percent,
  Plus,
  Printer,
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
import PosReturnsModal from '@/components/pos/PosReturnsModal';
import PosTerminalSettingsModal from '@/components/pos/PosTerminalSettingsModal';
import PosProductsModule from '@/components/pos/PosProductsModule';
import PosInventoryModule from '@/components/pos/PosInventoryModule';
import { PosExitConfirmModal, PosOpenShiftGate } from '@/components/pos/PosShiftGateModal';
import ElianaBrandLogo from '@/components/brand/ElianaBrandLogo';
import { formatDurationHMS, isTauriDesktop } from '@/lib/empresaConfig';
import type {
  CierreResumen,
  ClienteCreditoResumen,
  CorteDepartamento,
  DevolucionDia,
  EventoTurno,
  FlujoEfectivoRow,
  InventarioMovimiento,
  PosMesa,
  PosOrden,
  PosOrdenItem,
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

  // Modales
  const [showCobroModal, setShowCobroModal] = useState(false);
  const [metodoPago, setMetodoPago] = useState<
    'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO' | 'MIXTO' | 'CONSUMO_INTERNO'
  >('EFECTIVO');
  const [pagoConEfectivo, setPagoConEfectivo] = useState(0);
  const [pagoEfectivo, setPagoEfectivo] = useState(0);
  const [pagoDatafono, setPagoDatafono] = useState(0);
  const [pagoTransferencia, setPagoTransferencia] = useState(0);
  const [pagoCredito, setPagoCredito] = useState(0);
  const [comisionTarjeta, setComisionTarjeta] = useState(0);
  const [clienteCreditoNombre, setClienteCreditoNombre] = useState('');
  const [clienteCreditoTel, setClienteCreditoTel] = useState('');
  const [areaConsumo, setAreaConsumo] = useState('Personal Cocina');
  const [propinaValor, setPropinaValor] = useState(0);
  const [descuentoValor, setDescuentoValor] = useState(0);

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

  const [cashFlowModal, setCashFlowModal] = useState<'ENTRADA' | 'SALIDA' | null>(null);
  const [cashFlowMonto, setCashFlowMonto] = useState('');
  const [cashFlowConcepto, setCashFlowConcepto] = useState('');
  const [cashFlowClasif, setCashFlowClasif] = useState('Gasto Operativo');

  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const buscarInputRef = useRef<HTMLInputElement | null>(null);
  const verificadorInputRef = useRef<HTMLInputElement | null>(null);

  const cajaNombre = posConfig.nombreCaja || 'Caja 1';
  const cajeroNombre = sesionActiva?.cajero_nombre || fallbackUser;
  const noSpinnerClass =
    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  const notify = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

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

  useEffect(() => {
    setPosConfig(loadElianaPosConfig());
    try {
      const savedQ = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (savedQ) setOfflineQueue(JSON.parse(savedQ));
      const savedLast = localStorage.getItem(LAST_PAYMENT_KEY);
      if (savedLast) setLastPayment(JSON.parse(savedLast));
    } catch {
      // ignore storage errors
    }
  }, []);

  const applyPosPayload = useCallback((data: Record<string, unknown>) => {
    setMesas((data.mesas as PosMesa[]) || []);
    setOrdenes((data.ordenes as PosOrden[]) || []);
    setProductos((data.productos as ProductoVenta[]) || []);
    setSesionActiva((data.sesionActiva as SesionCaja) || null);
    setSalidasDiaCaja(Number(data.salidasDiaCaja || 0));
    setAbonosEfectivoHoy(Number(data.abonosEfectivoHoy || 0));
    setEntradasEfectivoHoy(Number(data.entradasEfectivoHoy || 0));
    setDevolucionesEfectivoHoy(Number(data.devolucionesEfectivoHoy || 0));
    setEventosTurno((data.eventosTurno as EventoTurno[]) || []);
    setCreditosClientes((data.creditosClientes as ClienteCreditoResumen[]) || []);
    setDevolucionesDia((data.devolucionesDia as DevolucionDia[]) || []);
    setCorteDepartamentos((data.corteDepartamentos as CorteDepartamento[]) || []);
    setFlujoEfectivoDetallado((data.flujoEfectivoDetallado as FlujoEfectivoRow[]) || []);
    setConsumosInternosHoy((data.consumosInternosHoy as PosOrden[]) || []);
    setGananciaEstimadaHoy(Number(data.gananciaEstimadaHoy || 0));
    setMovimientosInventario((data.movimientosInventario as InventarioMovimiento[]) || []);
    setJornadaCerradaTotal(Boolean(data.jornadaCerradaTotal));
  }, []);

  const fetchPosState = useCallback(async () => {
    const fechaHoy = getColombiaDateStr();
    try {
      const res = await fetch(`/api/pos?fecha=${fechaHoy}&caja=${encodeURIComponent(cajaNombre)}`);
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
    fetchPosState();
  }, [fetchPosState]);

  const executePosAction = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const fullPayload = {
        action,
        caja_nombre: cajaNombre,
        cajero_nombre: cajeroNombre,
        ...payload,
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

      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error en operación POS');
      return data;
    },
    [cajaNombre, cajeroNombre, posConfig.ipCajaPrincipal, offlineQueue, notify]
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

  const handleEliminarTicket = async () => {
    if (!ordenActiva) return;
    if (!window.confirm(`¿Cancelar el ticket ${ordenActiva.consecutivo}?`)) return;
    setBusyAction(true);
    try {
      await executePosAction('ANULAR_ORDEN_COMPLETA', {
        orden_id: ordenActiva.id,
        motivo: 'Ticket cancelado en caja',
      });
      setOrdenActivaId(null);
      await fetchPosState();
      focusCapture();
      notify('ok', `Ticket ${ordenActiva.consecutivo} cancelado.`);
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error cancelando ticket');
    } finally {
      setBusyAction(false);
    }
  };

  const handleEnviarComanda = useCallback(async () => {
    if (!ordenActiva) return;
    const pendientes = itemsActivos.filter((i) => i.estado_comanda === 'PENDIENTE');
    if (pendientes.length === 0) {
      notify('ok', 'No hay artículos pendientes por comandar.');
      return;
    }
    setBusyAction(true);
    try {
      const res = await executePosAction('ENVIAR_COMANDA', { orden_id: ordenActiva.id });
      const porEstacion = (res.porEstacion || {}) as Record<string, PosOrdenItem[]>;
      for (const [est, its] of Object.entries(porEstacion)) {
        if (its.length > 0) {
          await printThermalTicket({
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
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error enviando comanda');
    } finally {
      setBusyAction(false);
    }
  }, [ordenActiva, itemsActivos, cajaNombre, cajeroNombre, executePosAction, fetchPosState, focusCapture, notify]);

  const handleImprimirPrecuenta = async () => {
    if (!ordenActiva) return;
    setBusyAction(true);
    try {
      await executePosAction('IMPRIMIR_PRECUENTA', { orden_id: ordenActiva.id });
      const propinaSug = posConfig.habilitaPropinas
        ? Math.round(ordenActiva.subtotal_bruto * (posConfig.porcentajePropinaSugerida / 100))
        : 0;
      await printThermalTicket({
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
    const propSug =
      posConfig.habilitaPropinas && ordenActiva.canal_venta === 'SALON_MESA'
        ? Math.round(ordenActiva.subtotal_bruto * (posConfig.porcentajePropinaSugerida / 100))
        : 0;
    const baseTotal =
      Number(ordenActiva.subtotal_bruto || 0) + Number(ordenActiva.costo_domicilio || 0) + propSug;
    setPropinaValor(propSug);
    setDescuentoValor(0);
    setMetodoPago('EFECTIVO');
    setPagoEfectivo(baseTotal);
    setPagoConEfectivo(baseTotal);
    setPagoDatafono(0);
    setPagoTransferencia(0);
    setPagoCredito(0);
    setComisionTarjeta(0);
    setClienteCreditoNombre(ordenActiva.cliente_nombre || '');
    setClienteCreditoTel(ordenActiva.cliente_telefono || '');
    setShowCobroModal(true);
  }, [ordenActiva, itemsActivos.length, posConfig, notify]);

  const totalFinalCobro = useMemo(() => {
    if (!ordenActiva) return 0;
    if (metodoPago === 'CONSUMO_INTERNO') return Number(ordenActiva.subtotal_bruto || 0);
    return Math.max(
      0,
      Number(ordenActiva.subtotal_bruto || 0) +
        Number(ordenActiva.costo_domicilio || 0) -
        descuentoValor +
        propinaValor
    );
  }, [ordenActiva, descuentoValor, propinaValor, metodoPago]);

  const cambioCalculado = useMemo(() => {
    if (metodoPago !== 'EFECTIVO') return 0;
    return Math.max(0, pagoConEfectivo - totalFinalCobro);
  }, [metodoPago, pagoConEfectivo, totalFinalCobro]);

  const handleConfirmarCobro = async () => {
    if (!ordenActiva) return;
    let ef = 0;
    let dat = 0;
    let trf = 0;
    let cred = 0;

    if (metodoPago === 'CONSUMO_INTERNO') {
      if (!clienteCreditoNombre.trim()) {
        return notify('err', 'Indica el nombre de la persona o área para el Consumo Interno.');
      }
    } else if (metodoPago === 'EFECTIVO') {
      ef = totalFinalCobro;
      if (pagoConEfectivo > 0 && pagoConEfectivo < totalFinalCobro) {
        return notify('err', 'El monto recibido en efectivo es menor al total.');
      }
    } else if (metodoPago === 'DATAFONO') {
      dat = totalFinalCobro;
    } else if (metodoPago === 'TRANSFERENCIA') {
      trf = totalFinalCobro;
    } else if (metodoPago === 'CREDITO') {
      if (!clienteCreditoNombre.trim()) {
        return notify('err', 'Ingresa el nombre del cliente para ventas a crédito.');
      }
      cred = totalFinalCobro;
    } else {
      ef = pagoEfectivo;
      dat = pagoDatafono;
      trf = pagoTransferencia;
      cred = pagoCredito;
      if (Math.abs(ef + dat + trf + cred - totalFinalCobro) > 100) {
        return notify('err', 'La suma de pagos mixtos debe coincidir con el total.');
      }
      if (cred > 0 && !clienteCreditoNombre.trim()) {
        return notify('err', 'Ingresa el cliente para la parte a crédito.');
      }
    }

    setBusyAction(true);
    try {
      await executePosAction('FACTURAR_ORDEN', {
        orden_id: ordenActiva.id,
        metodo_pago: metodoPago,
        pago_efectivo: ef,
        pago_datafono: dat,
        pago_transferencia: trf,
        pago_credito: cred,
        comision_tarjeta: comisionTarjeta,
        cliente_nombre: clienteCreditoNombre.trim() || ordenActiva.cliente_nombre,
        cliente_telefono: clienteCreditoTel.trim() || ordenActiva.cliente_telefono,
        area_consumo: areaConsumo,
        propina: metodoPago === 'CONSUMO_INTERNO' ? 0 : propinaValor,
        descuento: metodoPago === 'CONSUMO_INTERNO' ? 0 : descuentoValor,
        efectivo_recibido:
          metodoPago === 'EFECTIVO'
            ? Math.max(pagoConEfectivo, totalFinalCobro)
            : metodoPago === 'CONSUMO_INTERNO'
              ? 0
              : totalFinalCobro,
      });

      const isConsumo = metodoPago === 'CONSUMO_INTERNO';
      const ticketData: ThermalTicketData = {
        titulo: isConsumo ? 'VALE DE CONSUMO INTERNO' : 'FACTURA DE VENTA POS',
        subtitulo: isConsumo ? `SIN COBRO EN CAJA (${areaConsumo})` : undefined,
        consecutivo: ordenActiva.consecutivo,
        fecha: new Date().toLocaleString('es-CO'),
        caja: cajaNombre,
        cajero: cajeroNombre,
        canal: ordenActiva.canal_venta,
        mesaNumero: ordenActiva.mesa_numero,
        clienteNombre: clienteCreditoNombre.trim() || ordenActiva.cliente_nombre,
        clienteTelefono: clienteCreditoTel.trim() || ordenActiva.cliente_telefono,
        clienteDireccion: ordenActiva.cliente_direccion,
        items: itemsActivos.map((it) => ({
          nombre: it.nombre_producto,
          cantidad: it.cantidad,
          precioUnitario: it.precio_unitario,
          subtotal: it.subtotal,
          notas: it.notas_comanda,
        })),
        subtotal: ordenActiva.subtotal_bruto,
        descuento: isConsumo ? 0 : descuentoValor,
        propina: isConsumo ? 0 : propinaValor,
        costoDomicilio: ordenActiva.costo_domicilio,
        total: totalFinalCobro,
        metodoPago: isConsumo ? 'CONSUMO INTERNO ($0 EN CAJA)' : metodoPago,
        efectivoRecibido: metodoPago === 'EFECTIVO' ? Math.max(pagoConEfectivo, totalFinalCobro) : undefined,
        cambio: metodoPago === 'EFECTIVO' ? cambioCalculado : undefined,
        footer: isConsumo ? 'Firma Beneficiario: ___________________' : undefined,
      };

      if (!isConsumo) {
        const memory: LastPaymentMemory = {
          total: totalFinalCobro,
          pagoCon: metodoPago === 'EFECTIVO' ? Math.max(pagoConEfectivo, totalFinalCobro) : totalFinalCobro,
          cambio: cambioCalculado,
          consecutivo: ordenActiva.consecutivo,
          ticketData,
        };
        setLastPayment(memory);
        localStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify(memory));
      }

      await printThermalTicket(ticketData);
      if (ef > 0) await openCashDrawer();

      setShowCobroModal(false);
      setOrdenActivaId(null);
      await fetchPosState();
      focusCapture();
      notify(
        'ok',
        isConsumo
          ? `Consumo interno registrado (${formatMoney(totalFinalCobro)}) sin cobro en caja.`
          : `Factura ${ordenActiva.consecutivo} cobrada.`
      );
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error procesando orden');
    } finally {
      setBusyAction(false);
    }
  };

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
    await printThermalTicket({
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
      await fetchPosState();
      if (res.orden?.id) {
        setOrdenActivaId(res.orden.id);
        setActiveTab('VENTAS');
      }
      focusCapture();
      notify('ok', 'Domicilio creado.');
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error creando domicilio');
    } finally {
      setBusyAction(false);
    }
  };

  const handleRegistrarCashFlow = async () => {
    if (!cashFlowModal) return;
    const monto = Number(cashFlowMonto || 0);
    if (monto <= 0 || !cashFlowConcepto.trim()) {
      return notify('err', 'Ingresa monto válido y concepto.');
    }
    setBusyAction(true);
    try {
      await executePosAction('MOVIMIENTO_EFECTIVO_CAJA', {
        tipo: cashFlowModal,
        monto,
        concepto: cashFlowConcepto.trim(),
        clasificacion: cashFlowClasif,
        sesion_id: sesionActiva?.id || null,
      });
      setCashFlowModal(null);
      setCashFlowMonto('');
      setCashFlowConcepto('');
      await fetchPosState();
      focusCapture();
      notify('ok', `${cashFlowModal === 'ENTRADA' ? 'Entrada' : 'Salida'} de ${formatMoney(monto)} registrada.`);
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error registrando movimiento');
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

  const handleCambiarSiguienteTicket = useCallback(() => {
    if (ordenesAbiertas.length <= 1) {
      notify('ok', 'Solo hay una cuenta abierta actualmente.');
      return;
    }
    const idx = ordenesAbiertas.findIndex((o) => o.id === ordenActiva?.id);
    const next = ordenesAbiertas[(idx + 1) % ordenesAbiertas.length];
    setOrdenActivaId(next.id);
    setActiveTab('VENTAS');
    focusCapture();
  }, [ordenesAbiertas, ordenActiva, focusCapture, notify]);

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
        setShowVentasDiaModal(false);
        setShowCreditosModal(false);
        setShowSettingsModal(false);
        setShowExitModal(false);
        setCashFlowModal(null);
        setNavZone('SEARCH');
        focusCapture();
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
      if (e.key === 'F4') { e.preventDefault(); setActiveTab('INVENTARIO'); return; }
      if (e.key === 'F5') { e.preventDefault(); handleCambiarSiguienteTicket(); return; }
      if (e.key === 'F6') {
        e.preventDefault();
        if (posConfig.habilitaComandasCocina && ordenActiva && itemsActivos.some((i) => i.estado_comanda === 'PENDIENTE')) {
          handleEnviarComanda();
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
      if (e.key === 'F11') { e.preventDefault(); handleAbrirMayoreo(); return; }
      if (e.key === 'F12') { e.preventDefault(); abrirModalCobro(); return; }
      if (e.key === 'Insert' && !isAnyModalOpen) { e.preventDefault(); setShowVariosModal(true); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setShowArtComunModal(true); return; }

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
    showSettingsModal, showExitModal, cashFlowModal, abrirModalCobro, focusCapture, handleAbrirMayoreo,
    handleAbrirMesa, handleAgregarProducto, handleAnularItem, handleCambiarCantidadItem,
    handleCambiarSiguienteTicket, handleEnviarComanda, handleNuevaVentaMostrador,
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
    mods.push({ key: 'CORTE', label: 'Corte de Caja', icon: Lock });
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

  // Bloqueo de doble nivel si otro usuario dejó turno abierto en este equipo y el actual no es ADMIN
  const isDifferentShiftOwner =
    Boolean(sesionActiva.usuario_username) &&
    Boolean(user?.username) &&
    sesionActiva.usuario_username!.toLowerCase() !== user!.username.toLowerCase() &&
    user?.role !== 'ADMIN' &&
    user?.username?.toLowerCase() !== 'admin';

  if (isDifferentShiftOwner) {
    return (
      <div className="fixed inset-0 z-[10000] w-screen h-screen bg-zinc-100 flex items-center justify-center p-4 select-none">
        <div className="bg-white rounded-xl border border-red-200 max-w-md w-full p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-3 text-red-700">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="font-bold text-base">Turno abierto por otro usuario</h2>
              <p className="text-xs text-zinc-500">Control estricto de sesión por cajero</p>
            </div>
          </div>
          <p className="text-xs text-zinc-700 leading-relaxed">
            En esta terminal (<b>{cajaNombre}</b>) existe un turno de caja abierto a nombre de{' '}
            <b>{sesionActiva.cajero_nombre}</b> (usuario <b>{sesionActiva.usuario_username}</b>), pero tu sesión principal actual es <b>{user?.username}</b>.
          </p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Para evitar mezcla de turnos, <b>{sesionActiva.cajero_nombre}</b> debe ingresar con su sesión principal y realizar Cierre Parcial (X) o Total (Z) antes de que puedas abrir tu turno.
          </p>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer"
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const shiftElapsedHMS = formatDurationHMS(sesionActiva.hora_apertura, shiftNowMs);

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen bg-zinc-100 text-zinc-900 flex flex-col overflow-hidden select-none font-sans">

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

        <div className="flex items-center gap-1.5 text-xs">
          <div className="hidden xl:flex flex-col text-right pr-2 border-r border-zinc-200 leading-tight">
            <span className="text-[10px] text-zinc-400">Le atiende ({cajaNombre}):</span>
            <span className="font-bold text-zinc-900">{cajeroNombre}</span>
          </div>

          <span
            title="Tiempo transcurrido desde la apertura de este turno"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-mono font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            {shiftElapsedHMS}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md font-semibold text-xs bg-zinc-100 text-zinc-700 border border-zinc-200">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-600' : lanConnected ? 'bg-blue-600' : 'bg-amber-500'}`} />
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-zinc-500" /> : <WifiOff className="w-3.5 h-3.5 text-zinc-500" />}
          </span>

          <button
            onClick={() => setShowCreditosModal(true)}
            className="px-2.5 py-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-zinc-600" />
            <span className="hidden lg:inline">Créditos</span>
          </button>

          <button
            onClick={() => setTouchMode((v) => !v)}
            className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 border cursor-pointer ${
              touchMode ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-300 text-zinc-700'
            }`}
          >
            {touchMode ? <MonitorSmartphone className="w-3.5 h-3.5" /> : <Keyboard className="w-3.5 h-3.5" />}
          </button>

          <button onClick={handlePesarGramera} title="Leer Gramera" className="p-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 cursor-pointer">
            <Scale className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={async () => {
              await openCashDrawer();
              await executePosAction('REGISTRAR_APERTURA_CAJON_SIN_VENTA', {});
              notify('ok', 'Cajón monedero abierto.');
            }}
            title="Abrir Cajón"
            className="p-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
          </button>

          <button onClick={toggleBrowserFullscreen} title="Pantalla Completa" className="p-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 cursor-pointer">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button onClick={() => setShowSettingsModal(true)} title="Configuración" className="p-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 cursor-pointer">
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button onClick={fetchPosState} title="Sincronizar" className="p-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowExitModal(true)}
            className="px-2.5 py-1.5 rounded-md bg-white hover:bg-red-50 border border-zinc-300 hover:border-red-300 text-zinc-800 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
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
                { key: 'INS', label: 'Varios', icon: Tag, onClick: () => setShowVariosModal(true), disabled: false },
                { key: 'CTRL+P', label: 'Art. Común', icon: Flame, onClick: () => setShowArtComunModal(true), disabled: false },
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
                { key: 'F11', label: 'Mayoreo / Desc.', icon: Percent, onClick: handleAbrirMayoreo, disabled: !selectedItemId },
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

          <div className="bg-zinc-100 border-b border-zinc-200 px-3 pt-1.5 flex items-center gap-1 overflow-x-auto shrink-0">
            {ordenesAbiertas.map((ord) => {
              const isSelected = ordenActiva?.id === ord.id;
              return (
                <button
                  key={ord.id}
                  onClick={() => { setOrdenActivaId(ord.id); focusCapture(); }}
                  className={`px-3 py-1.5 rounded-t-md text-xs font-semibold border border-b-0 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    isSelected ? 'bg-white text-zinc-950 border-zinc-300' : 'bg-zinc-200 text-zinc-600 border-transparent hover:bg-zinc-50'
                  }`}
                >
                  <span>{getOrdenTabLabel(ord)}</span>
                  <span className="text-[11px] font-bold tabular-nums text-zinc-900">{formatMoney(ord.gran_total)}</span>
                </button>
              );
            })}
            <button
              ref={nuevoTicketBtnRef}
              onClick={handleNuevaVentaMostrador}
              className="px-2.5 py-1 mb-1 rounded-md bg-white hover:bg-zinc-200 border border-zinc-300 text-zinc-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <Plus className="w-3 h-3" /> Nuevo Ticket
            </button>
          </div>

          <div className="flex-1 flex min-h-0 overflow-hidden bg-white">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-zinc-200">
              {ordenActiva ? (
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase text-zinc-500 font-semibold z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-24 border-r border-zinc-200">Código</th>
                        <th className="py-2.5 px-3">Descripción del Producto</th>
                        <th className="py-2.5 px-3 text-right w-28">Precio Venta</th>
                        <th className="py-2.5 px-3 text-center w-24">Cant.</th>
                        <th className="py-2.5 px-3 text-right w-28 border-x border-zinc-200">Importe</th>
                        <th className="py-2.5 px-3 text-right w-20">Existencia</th>
                        {posConfig.habilitaComandasCocina && <th className="py-2.5 px-3 text-center w-24">Estado</th>}
                        <th className="py-2.5 px-2 text-center w-10"></th>
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
                                  ? 'bg-blue-50/90 border-l-4 border-l-blue-600'
                                  : 'hover:bg-zinc-50'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono text-xs text-zinc-500 border-r border-zinc-100">{it.codigo_producto || '—'}</td>
                              <td className="py-2.5 px-3 font-semibold text-zinc-900">
                                {it.nombre_producto}
                                {it.notas_comanda && <span className="ml-2 text-[11px] font-normal text-zinc-500">({it.notas_comanda})</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium tabular-nums text-zinc-700">{formatMoney(it.precio_unitario)}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button onClick={(e) => { e.stopPropagation(); void handleCambiarCantidadItem(it, -1); }} className="w-6 h-6 rounded border border-zinc-300 bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-700 cursor-pointer">
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="font-bold tabular-nums text-zinc-900 min-w-[24px] text-center">{it.cantidad}</span>
                                  <button onClick={(e) => { e.stopPropagation(); void handleCambiarCantidadItem(it, 1); }} className="w-6 h-6 rounded border border-zinc-300 bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-700 cursor-pointer">
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold tabular-nums text-zinc-950 border-x border-zinc-100">{formatMoney(it.subtotal)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-xs text-zinc-500">{stock}</td>
                              {posConfig.habilitaComandasCocina && (
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${it.estado_comanda === 'COMANDADO' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
                                    {it.estado_comanda}
                                  </span>
                                </td>
                              )}
                              <td className="py-2.5 px-2 text-center">
                                <button onClick={(e) => { e.stopPropagation(); handleAnularItem(it); }} className="p-1.5 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
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
                <button onClick={handleCambiarSiguienteTicket} className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer">
                  F5 - Cambiar
                </button>
                <button
                  onClick={() => {
                    if (!ordenActiva) return;
                    setAsignarNombre(ordenActiva.cliente_nombre || '');
                    setAsignarTel(ordenActiva.cliente_telefono || '');
                    setShowAsignarClienteModal(true);
                  }}
                  disabled={!ordenActiva}
                  className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Asignar Cliente / Personal</span>
                  <span className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[10px] font-mono font-semibold text-zinc-600">
                    ALT+C
                  </span>
                </button>
                {posConfig.habilitaComandasCocina && (
                  <>
                    <button onClick={handleEnviarComanda} disabled={!ordenActiva || busyAction} className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-semibold text-zinc-700 flex items-center gap-1 cursor-pointer">
                      <ChefHat className="w-3.5 h-3.5 text-zinc-600" />
                      F6 - Comandar
                    </button>
                    <button onClick={handleImprimirPrecuenta} disabled={!ordenActiva || itemsActivos.length === 0 || busyAction} className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-semibold text-zinc-700 flex items-center gap-1 cursor-pointer">
                      <Printer className="w-3.5 h-3.5 text-zinc-600" />
                      Precuenta
                    </button>
                  </>
                )}
                <button onClick={handleEliminarTicket} disabled={!ordenActiva || busyAction} className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-red-50 hover:border-red-300 disabled:opacity-40 text-xs font-semibold text-red-700 cursor-pointer">
                  Eliminar
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs bg-zinc-50 border border-zinc-200 rounded-md px-3 py-1 w-fit tabular-nums">
                <div><span className="text-zinc-500">Último Total: </span><span className="font-bold text-zinc-900">{formatMoney(lastPayment.total)}</span></div>
                <div><span className="text-zinc-500">Pagó Con: </span><span className="font-bold text-zinc-900">{formatMoney(lastPayment.pagoCon)}</span></div>
                <div><span className="text-zinc-500">Cambio: </span><span className="font-bold text-blue-700">{formatMoney(lastPayment.cambio)}</span></div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex flex-col gap-1">
                <button onClick={handleReimprimirUltimo} className="px-3 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 cursor-pointer">
                  <Printer className="w-3.5 h-3.5 text-zinc-500" />
                  Reimprimir Último Ticket
                </button>
                <button onClick={() => setShowVentasDiaModal(true)} className="px-3 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 cursor-pointer">
                  <History className="w-3.5 h-3.5 text-zinc-500" />
                  Ventas y Devoluciones ({resumenDia.cantidadFacturas})
                </button>
              </div>

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
                      <div className="font-bold tabular-nums text-zinc-950">{formatMoney(m.orden_activa.gran_total)}</div>
                      <div className="text-[11px] text-zinc-500">{m.orden_activa.items?.length || 0} ítems • {m.mesero_actual || cajeroNombre}</div>
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
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-zinc-900">{dom.consecutivo}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700">{dom.estado_domicilio || dom.estado}</span>
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
          busyAction={busyAction}
          onSaveProducto={async (payload) => {
            setBusyAction(true);
            try {
              await executePosAction('GUARDAR_PRODUCTO_POS', payload);
              await fetchPosState();
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
              await fetchPosState();
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
              await fetchPosState();
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
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-xl w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="font-bold text-base text-zinc-950">F12 — Cobrar / Cerrar {getOrdenTabLabel(ordenActiva)}</h3>
              <button onClick={() => setShowCobroModal(false)} className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500">
                  {metodoPago === 'CONSUMO_INTERNO' ? 'Valor Comercial Referencial (No entra a caja)' : 'Subtotal + Domicilio'}
                </div>
                <div className="font-bold text-base tabular-nums text-zinc-900">
                  {formatMoney(Number(ordenActiva.subtotal_bruto || 0) + Number(ordenActiva.costo_domicilio || 0))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold">
                  {metodoPago === 'CONSUMO_INTERNO' ? 'Cobro en Caja' : 'Total a Cobrar'}
                </div>
                <div className="text-3xl font-extrabold tabular-nums text-zinc-950">
                  {metodoPago === 'CONSUMO_INTERNO' ? '$0' : formatMoney(totalFinalCobro)}
                </div>
              </div>
            </div>

            {metodoPago !== 'CONSUMO_INTERNO' && (
              <div className={`grid ${posConfig.habilitaPropinas ? 'grid-cols-2' : 'grid-cols-1'} gap-3 text-xs`}>
                {posConfig.habilitaPropinas && (
                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Propina</label>
                    <div className="flex gap-1 mb-1.5">
                      {[0, 0.05, 0.1].map((pct) => (
                        <button key={pct} onClick={() => setPropinaValor(Math.round(ordenActiva.subtotal_bruto * pct))} className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 font-semibold text-zinc-700 cursor-pointer">
                          {pct * 100}%
                        </button>
                      ))}
                    </div>
                    <input type="number" value={propinaValor} onChange={(e) => setPropinaValor(Number(e.target.value || 0))} className={`w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-semibold tabular-nums text-zinc-900 ${noSpinnerClass}`} />
                  </div>
                )}
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Descuento Global ($)</label>
                  {posConfig.habilitaPropinas && <div className="h-[26px]" />}
                  <input type="number" value={descuentoValor} onChange={(e) => setDescuentoValor(Number(e.target.value || 0))} className={`w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-semibold tabular-nums text-zinc-900 ${noSpinnerClass}`} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              {[
                { id: 'EFECTIVO' as const, label: 'EFECTIVO' },
                { id: 'DATAFONO' as const, label: 'DATÁFONO' },
                { id: 'TRANSFERENCIA' as const, label: 'TRANSF.' },
                { id: 'CREDITO' as const, label: 'CRÉDITO' },
                { id: 'MIXTO' as const, label: 'MIXTO' },
                { id: 'CONSUMO_INTERNO' as const, label: 'CONSUMO' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMetodoPago(m.id)}
                  className={`py-2 rounded-md text-[11px] font-semibold cursor-pointer ${
                    metodoPago === m.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {metodoPago === 'EFECTIVO' && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
                  <span>Pagó con (Efectivo recibido):</span>
                  <span className="text-base font-bold tabular-nums text-blue-700">Cambio: {formatMoney(cambioCalculado)}</span>
                </div>
                <input autoFocus type="number" value={pagoConEfectivo} onChange={(e) => setPagoConEfectivo(Number(e.target.value || 0))} className={`w-full px-3 py-2 bg-white border border-zinc-300 focus:border-blue-600 rounded-md text-xl font-bold tabular-nums text-zinc-950 outline-none ${noSpinnerClass}`} />
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => setPagoConEfectivo(totalFinalCobro)} className="px-3 py-1 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-semibold text-zinc-800 cursor-pointer">Exacto</button>
                  {[20000, 50000, 100000, 200000].map((billete) => (
                    <button key={billete} onClick={() => setPagoConEfectivo(billete)} className="px-3 py-1 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-semibold tabular-nums text-zinc-800 cursor-pointer">{formatMoney(billete)}</button>
                  ))}
                </div>
              </div>
            )}

            {metodoPago === 'DATAFONO' && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs">
                <label className="font-semibold text-zinc-700 block mb-1">Comisión Bancaria Datáfono (opcional $)</label>
                <input type="number" value={comisionTarjeta} onChange={(e) => setComisionTarjeta(Number(e.target.value || 0))} className={`w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-md font-bold ${noSpinnerClass}`} />
              </div>
            )}

            {(metodoPago === 'CREDITO' || metodoPago === 'CONSUMO_INTERNO' || (metodoPago === 'MIXTO' && pagoCredito > 0)) && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2 text-xs">
                <div className="font-bold text-zinc-800">
                  {metodoPago === 'CONSUMO_INTERNO'
                    ? 'Consumo Interno — Beneficiario y Área (No afecta el cuadre de caja)'
                    : 'Cliente para Cargo a Crédito (Libro Mayor)'}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={clienteCreditoNombre}
                    onChange={(e) => setClienteCreditoNombre(e.target.value)}
                    placeholder={metodoPago === 'CONSUMO_INTERNO' ? 'Ej. Olga (Cocina) o Dueño' : 'Nombre completo del cliente'}
                    list="clientes-credito-list"
                    className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-md font-semibold"
                  />
                  <datalist id="clientes-credito-list">
                    {creditosClientes.map((c) => <option key={c.cliente_nombre} value={c.cliente_nombre} />)}
                  </datalist>
                  {metodoPago === 'CONSUMO_INTERNO' ? (
                    <select value={areaConsumo} onChange={(e) => setAreaConsumo(e.target.value)} className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-md font-semibold">
                      <option value="Personal Cocina">Personal Cocina</option>
                      <option value="Personal Caja / Servicio">Personal Caja / Servicio</option>
                      <option value="Dueño / Gerencia">Dueño / Gerencia</option>
                      <option value="Cortesía / Degustación">Cortesía / Degustación</option>
                    </select>
                  ) : (
                    <input type="text" value={clienteCreditoTel} onChange={(e) => setClienteCreditoTel(e.target.value)} placeholder="Teléfono (opcional)" className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-md" />
                  )}
                </div>
              </div>
            )}

            {metodoPago === 'MIXTO' && (
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><label className="font-semibold text-zinc-700">Efectivo</label><input type="number" value={pagoEfectivo} onChange={(e) => setPagoEfectivo(Number(e.target.value || 0))} className={`w-full px-2 py-1.5 border border-zinc-300 rounded-md font-bold mt-1 ${noSpinnerClass}`} /></div>
                <div><label className="font-semibold text-zinc-700">Datáfono</label><input type="number" value={pagoDatafono} onChange={(e) => setPagoDatafono(Number(e.target.value || 0))} className={`w-full px-2 py-1.5 border border-zinc-300 rounded-md font-bold mt-1 ${noSpinnerClass}`} /></div>
                <div><label className="font-semibold text-zinc-700">Transf.</label><input type="number" value={pagoTransferencia} onChange={(e) => setPagoTransferencia(Number(e.target.value || 0))} className={`w-full px-2 py-1.5 border border-zinc-300 rounded-md font-bold mt-1 ${noSpinnerClass}`} /></div>
                <div><label className="font-semibold text-zinc-700">Crédito</label><input type="number" value={pagoCredito} onChange={(e) => setPagoCredito(Number(e.target.value || 0))} className={`w-full px-2 py-1.5 border border-zinc-300 rounded-md font-bold mt-1 ${noSpinnerClass}`} /></div>
              </div>
            )}

            <button onClick={handleConfirmarCobro} disabled={busyAction} className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer">
              {metodoPago === 'CONSUMO_INTERNO' ? 'Registrar Consumo Interno ($0 Caja)' : 'Confirmar Cobro e Imprimir Ticket'}
            </button>
          </div>
        </div>
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

      {/* Modal F7 / F8 sincronizado con Libro de Caja */}
      {cashFlowModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-sm w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">{cashFlowModal === 'ENTRADA' ? 'F7 — Entrada de Efectivo' : 'F8 — Salida a Libro de Caja'}</h3>
              <button onClick={() => setCashFlowModal(null)} className="p-1 text-zinc-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            {cashFlowModal === 'SALIDA' && (
              <select value={cashFlowClasif} onChange={(e) => setCashFlowClasif(e.target.value)} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-xs font-semibold">
                <option value="Gasto Operativo">Gasto Operativo (Servicios, Hielo, Varios)</option>
                <option value="Costo / Insumo">Costo / Insumo (Compras de contado)</option>
                <option value="Turno / Nómina">Turno / Nómina (Pagos a personal)</option>
              </select>
            )}
            <input autoFocus type="number" value={cashFlowMonto} onChange={(e) => setCashFlowMonto(e.target.value)} placeholder="Monto ($)" className={`w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold ${noSpinnerClass}`} />
            <input type="text" value={cashFlowConcepto} onChange={(e) => setCashFlowConcepto(e.target.value)} placeholder="Concepto / Beneficiario" className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" />
            <button onClick={handleRegistrarCashFlow} disabled={busyAction} className="w-full py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs cursor-pointer">
              Registrar {cashFlowModal === 'ENTRADA' ? 'Entrada' : 'Salida en Libro de Caja'}
            </button>
          </div>
        </div>
      )}

      {showVentasDiaModal && (
        <PosReturnsModal
          ordenesFacturadas={ordenesFacturadasHoy}
          devolucionesDia={devolucionesDia}
          busyAction={busyAction}
          onClose={() => setShowVentasDiaModal(false)}
          onReimprimirOrden={async (orden) => {
            await printThermalTicket({
              titulo: 'COPIA DE FACTURA POS',
              consecutivo: orden.consecutivo,
              fecha: orden.fecha,
              caja: orden.caja_nombre,
              cajero: orden.cajero_nombre,
              canal: orden.canal_venta,
              mesaNumero: orden.mesa_numero,
              clienteNombre: orden.cliente_nombre,
              items: orden.items.map((it) => ({ nombre: it.nombre_producto, cantidad: it.cantidad, precioUnitario: it.precio_unitario, subtotal: it.subtotal })),
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
        />
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
              await fetchPosState();
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

      {showDomicilioModal && (
        <div className="fixed inset-0 z-[10000] bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-md w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">Nuevo Pedido a Domicilio</h3>
              <button onClick={() => setShowDomicilioModal(false)} className="p-1 text-zinc-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <input type="text" placeholder="Nombre del cliente" value={domNombre} onChange={(e) => setDomNombre(e.target.value)} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" />
            <input type="text" placeholder="Teléfono / WhatsApp" value={domTelefono} onChange={(e) => setDomTelefono(e.target.value)} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" />
            <input type="text" placeholder="Dirección completa" value={domDireccion} onChange={(e) => setDomDireccion(e.target.value)} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={domCostoEnvio} onChange={(e) => setDomCostoEnvio(Number(e.target.value || 0))} placeholder="Valor domicilio" className={`px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold ${noSpinnerClass}`} />
              <input type="text" value={domRepartidor} onChange={(e) => setDomRepartidor(e.target.value)} placeholder="Domiciliario" className="px-3 py-2 border border-zinc-300 rounded-md text-sm" />
            </div>
            <button onClick={handleCrearDomicilio} className="w-full py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer">Crear Domicilio</button>
          </div>
        </div>
      )}
    </div>
  );
}
