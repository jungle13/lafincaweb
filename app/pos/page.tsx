'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Bike,
  ChefHat,
  CreditCard,
  Delete,
  DollarSign,
  Flame,
  History,
  Home,
  Keyboard,
  Lock,
  Minus,
  MonitorSmartphone,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  ScanBarcode,
  Search,
  Store,
  Tag,
  Trash2,
  Unlock,
  Utensils,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/formatters';
import {
  openCashDrawer,
  printThermalTicket,
  readScaleWeightOnce,
  type ThermalTicketData,
  useBarcodeScanner,
} from '@/lib/posHardwareBridge';

type PosTab = 'VENTAS' | 'MESAS' | 'DOMICILIOS' | 'CORTE';

interface PosMesa {
  id: string;
  numero: number;
  nombre: string;
  zona: string;
  capacidad: number;
  estado: 'LIBRE' | 'OCUPADA' | 'PRECUENTA_IMPRESA';
  orden_activa_id: string | null;
  mesero_actual: string | null;
  abierta_at: string | null;
  orden_activa?: PosOrden | null;
}

interface PosOrdenItem {
  id: string;
  orden_id: string;
  producto_id: string | null;
  codigo_producto: string;
  nombre_producto: string;
  categoria: string;
  estacion_comanda: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  subtotal: number;
  notas_comanda: string | null;
  estado_comanda: 'PENDIENTE' | 'COMANDADO' | 'ENTREGADO' | 'ANULADO';
}

interface PosOrden {
  id: string;
  consecutivo: string;
  fecha: string;
  caja_nombre: string;
  cajero_nombre: string;
  mesero_nombre: string | null;
  canal_venta: 'SALON_MESA' | 'DOMICILIO' | 'MOSTRADOR_LLEVAR';
  mesa_numero: number | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  domiciliario_nombre: string | null;
  costo_domicilio: number;
  estado_domicilio: string | null;
  subtotal_bruto: number;
  descuento: number;
  propina: number;
  gran_total: number;
  metodo_pago: string;
  pago_efectivo: number;
  pago_datafono: number;
  pago_transferencia: number;
  estado: 'ABIERTA' | 'PRECUENTA' | 'FACTURADA' | 'ANULADA';
  precuenta_impresa_veces: number;
  items: PosOrdenItem[];
}

interface ProductoVenta {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  subcategoria?: string;
  precio_total: number;
  precio_neto: number;
}

interface SesionCaja {
  id: string;
  caja_nombre: string;
  cajero_nombre: string;
  numero_turno: number;
  base_inicial: number;
  estado: string;
}

interface EventoTurno {
  id: string;
  tipo_alerta: string;
  nivel_riesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  caja_nombre: string;
  usuario_cajero: string;
  orden_consecutivo: string | null;
  mesa_numero: number | null;
  valor_afectado: number;
  descripcion: string;
  created_at: string;
}

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

interface CierreResumen {
  tipoCierre: string;
  baseInicial: number;
  ventasEfectivo: number;
  ventasDatafono: number;
  ventasTransf: number;
  totalVendidoPos: number;
  totalSalidasCaja: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferenciaEfectivo: number;
}

const OFFLINE_QUEUE_KEY = 'lafinca_pos_offline_queue_v1';
const LAST_PAYMENT_KEY = 'lafinca_pos_last_payment_v1';
const ZONAS = ['Todas', 'Salón Principal', 'Terraza', 'Kiosco / Parrilla'];

function getOrdenTabLabel(orden: PosOrden): string {
  if (orden.canal_venta === 'SALON_MESA' && orden.mesa_numero) {
    return `Mesa ${orden.mesa_numero}`;
  }
  if (orden.canal_venta === 'DOMICILIO') {
    return `Dom. ${orden.cliente_nombre?.split(' ')[0] || orden.consecutivo}`;
  }
  return `Mostrador ${orden.consecutivo.split('-').pop() || ''}`;
}

export default function PosDesktopPage() {
  const { user } = useAuth();
  const cajeroNombre = user?.name || user?.username || 'Cajero Principal';

  const [activeTab, setActiveTab] = useState<PosTab>('VENTAS');
  const [cajaNombre, setCajaNombre] = useState<'Caja 1' | 'Caja 2'>('Caja 1');
  const [touchMode, setTouchMode] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  // Datos principales
  const [mesas, setMesas] = useState<PosMesa[]>([]);
  const [ordenes, setOrdenes] = useState<PosOrden[]>([]);
  const [productos, setProductos] = useState<ProductoVenta[]>([]);
  const [sesionActiva, setSesionActiva] = useState<SesionCaja | null>(null);
  const [salidasDiaCaja, setSalidasDiaCaja] = useState<number>(0);
  const [eventosTurno, setEventosTurno] = useState<EventoTurno[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOp[]>([]);

  // Navegación / selección estilo eleventa
  const [zonaFiltro, setZonaFiltro] = useState('Todas');
  const [ordenActivaId, setOrdenActivaId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [captureInput, setCaptureInput] = useState('');
  const [catFiltro, setCatFiltro] = useState('TODAS');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Memoria último cobro y reimpresión
  const [lastPayment, setLastPayment] = useState<LastPaymentMemory>({
    total: 0,
    pagoCon: 0,
    cambio: 0,
    consecutivo: '',
  });

  // Modales operativos
  const [showCobroModal, setShowCobroModal] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'MIXTO'>('EFECTIVO');
  const [pagoConEfectivo, setPagoConEfectivo] = useState(0);
  const [pagoEfectivo, setPagoEfectivo] = useState(0);
  const [pagoDatafono, setPagoDatafono] = useState(0);
  const [pagoTransferencia, setPagoTransferencia] = useState(0);
  const [propinaValor, setPropinaValor] = useState(0);
  const [descuentoValor, setDescuentoValor] = useState(0);

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
  const [variosNombre, setVariosNombre] = useState('Adicional Especial');
  const [variosCantidad, setVariosCantidad] = useState(1);
  const [variosPrecio, setVariosPrecio] = useState(5000);

  const [showArtComunModal, setShowArtComunModal] = useState(false);
  const [showVentasDiaModal, setShowVentasDiaModal] = useState(false);

  const [cashFlowModal, setCashFlowModal] = useState<'ENTRADA' | 'SALIDA' | null>(null);
  const [cashFlowMonto, setCashFlowMonto] = useState('');
  const [cashFlowConcepto, setCashFlowConcepto] = useState('');

  const [showAbrirCajaModal, setShowAbrirCajaModal] = useState(false);
  const [baseInicialInput, setBaseInicialInput] = useState('200000');

  const [efectivoContado, setEfectivoContado] = useState('');
  const [obsCierre, setObsCierre] = useState('');
  const [ultimoCierreResumen, setUltimoCierreResumen] = useState<CierreResumen | null>(null);

  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const buscarInputRef = useRef<HTMLInputElement | null>(null);
  const verificadorInputRef = useRef<HTMLInputElement | null>(null);

  const notify = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const focusCapture = useCallback(() => {
    setTimeout(() => captureInputRef.current?.focus(), 40);
  }, []);

  const fetchPosState = useCallback(async () => {
    try {
      const fechaHoy = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/pos?fecha=${fechaHoy}&caja=${encodeURIComponent(cajaNombre)}`);
      const data = await res.json();
      if (data.success) {
        setMesas(data.mesas || []);
        setOrdenes(data.ordenes || []);
        setProductos(data.productos || []);
        setSesionActiva(data.sesionActiva || null);
        setSalidasDiaCaja(data.salidasDiaCaja || 0);
        setEventosTurno(data.eventosTurno || []);
      }
    } catch {
      notify('err', 'Sin conexión al servidor — trabajando con respaldo local.');
    } finally {
      setLoading(false);
    }
  }, [cajaNombre, notify]);

  useEffect(() => {
    fetchPosState();
  }, [fetchPosState]);

  useEffect(() => {
    try {
      const savedQ = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (savedQ) setOfflineQueue(JSON.parse(savedQ));
      const savedLast = localStorage.getItem(LAST_PAYMENT_KEY);
      if (savedLast) setLastPayment(JSON.parse(savedLast));
    } catch {
      // ignore storage parse error
    }
  }, []);

  const executePosAction = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const fullPayload = {
        action,
        caja_nombre: cajaNombre,
        cajero_nombre: cajeroNombre,
        ...payload,
      };

      if (!navigator.onLine) {
        const queued: OfflineOp = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action,
          payload: fullPayload,
        };
        const updated = [...offlineQueue, queued];
        setOfflineQueue(updated);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
        notify('ok', `Guardado offline (${updated.length} en cola).`);
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
    [cajaNombre, cajeroNombre, offlineQueue, notify]
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
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [syncOfflineQueue]);

  // Cuentas abiertas y facturadas
  const ordenesAbiertas = useMemo(
    () => ordenes.filter((o) => o.estado === 'ABIERTA' || o.estado === 'PRECUENTA'),
    [ordenes]
  );

  const ordenesFacturadasHoy = useMemo(
    () => ordenes.filter((o) => o.estado === 'FACTURADA'),
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
    if (itemsActivos.length === 0) {
      setSelectedItemId(null);
    } else if (!selectedItemId || !itemsActivos.some((i) => i.id === selectedItemId)) {
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

  // Acciones de Ticket y Mesa
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
      notify('ok', 'Nuevo ticket de mostrador abierto.');
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

  const handleCambiarCantidadItem = useCallback(
    async (item: PosOrdenItem, delta: number) => {
      if (!ordenActiva) return;
      if (delta < 0 && item.cantidad <= 1) {
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
      }
    },
    [ordenActiva, handleAgregarProducto]
  );

  const handleAnularItem = useCallback(
    async (item: PosOrdenItem) => {
      if (!ordenActiva) return;
      let motivo = 'Ajuste de pedido en caja';
      if (item.estado_comanda === 'COMANDADO') {
        const resp = window.prompt(
          `El plato "${item.nombre_producto}" ya fue enviado a cocina. Ingresa el motivo de la anulación:`
        );
        if (!resp || !resp.trim()) return;
        motivo = resp.trim();
      }
      setBusyAction(true);
      try {
        await executePosAction('ANULAR_ITEM_ORDEN', {
          item_id: item.id,
          orden_id: ordenActiva.id,
          motivo,
        });
        await fetchPosState();
        focusCapture();
        notify('ok', 'Ítem eliminado de la cuenta.');
      } catch (e: unknown) {
        notify('err', e instanceof Error ? e.message : 'Error anulando ítem');
      } finally {
        setBusyAction(false);
      }
    },
    [ordenActiva, executePosAction, fetchPosState, focusCapture, notify]
  );

  const handleEliminarTicket = async () => {
    if (!ordenActiva) return;
    if (!window.confirm(`¿Cancelar y eliminar el ticket ${ordenActiva.consecutivo}?`)) return;
    setBusyAction(true);
    try {
      await executePosAction('ANULAR_ORDEN_COMPLETA', {
        orden_id: ordenActiva.id,
        motivo: 'Ticket cancelado por cajero',
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
      notify('ok', 'No hay platos pendientes por enviar a cocina.');
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
      notify('ok', `Comanda enviada (${pendientes.length} platos).`);
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
      const propinaSug = Math.round(ordenActiva.subtotal_bruto * 0.1);
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
        footer: 'Incluye propina sugerida del 10%',
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
      notify('err', 'Agrega al menos un producto antes de cobrar.');
      return;
    }
    const baseTotal = Number(ordenActiva.subtotal_bruto || 0) + Number(ordenActiva.costo_domicilio || 0);
    setPropinaValor(ordenActiva.canal_venta === 'SALON_MESA' ? Math.round(ordenActiva.subtotal_bruto * 0.1) : 0);
    setDescuentoValor(0);
    setMetodoPago('EFECTIVO');
    setPagoEfectivo(baseTotal);
    setPagoConEfectivo(baseTotal);
    setPagoDatafono(0);
    setPagoTransferencia(0);
    setShowCobroModal(true);
  }, [ordenActiva, itemsActivos.length, notify]);

  const totalFinalCobro = useMemo(() => {
    if (!ordenActiva) return 0;
    return Math.max(
      0,
      Number(ordenActiva.subtotal_bruto || 0) +
        Number(ordenActiva.costo_domicilio || 0) -
        descuentoValor +
        propinaValor
    );
  }, [ordenActiva, descuentoValor, propinaValor]);

  const cambioCalculado = useMemo(() => {
    if (metodoPago !== 'EFECTIVO') return 0;
    return Math.max(0, pagoConEfectivo - totalFinalCobro);
  }, [metodoPago, pagoConEfectivo, totalFinalCobro]);

  const handleConfirmarCobro = async () => {
    if (!ordenActiva) return;
    let ef = 0;
    let dat = 0;
    let trf = 0;
    if (metodoPago === 'EFECTIVO') {
      ef = totalFinalCobro;
      if (pagoConEfectivo > 0 && pagoConEfectivo < totalFinalCobro) {
        return notify('err', 'El monto recibido en efectivo es menor al total.');
      }
    } else if (metodoPago === 'DATAFONO') {
      dat = totalFinalCobro;
    } else if (metodoPago === 'TRANSFERENCIA') {
      trf = totalFinalCobro;
    } else {
      ef = pagoEfectivo;
      dat = pagoDatafono;
      trf = pagoTransferencia;
      if (Math.abs(ef + dat + trf - totalFinalCobro) > 100) {
        return notify('err', 'La suma de pagos mixtos debe coincidir con el total.');
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
        propina: propinaValor,
        descuento: descuentoValor,
      });

      const ticketData: ThermalTicketData = {
        titulo: 'FACTURA DE VENTA POS',
        consecutivo: ordenActiva.consecutivo,
        fecha: new Date().toLocaleString('es-CO'),
        caja: cajaNombre,
        cajero: cajeroNombre,
        canal: ordenActiva.canal_venta,
        mesaNumero: ordenActiva.mesa_numero,
        clienteNombre: ordenActiva.cliente_nombre,
        clienteTelefono: ordenActiva.cliente_telefono,
        clienteDireccion: ordenActiva.cliente_direccion,
        items: itemsActivos.map((it) => ({
          nombre: it.nombre_producto,
          cantidad: it.cantidad,
          precioUnitario: it.precio_unitario,
          subtotal: it.subtotal,
          notas: it.notas_comanda,
        })),
        subtotal: ordenActiva.subtotal_bruto,
        descuento: descuentoValor,
        propina: propinaValor,
        costoDomicilio: ordenActiva.costo_domicilio,
        total: totalFinalCobro,
        metodoPago,
        efectivoRecibido: metodoPago === 'EFECTIVO' ? Math.max(pagoConEfectivo, totalFinalCobro) : undefined,
        cambio: metodoPago === 'EFECTIVO' ? cambioCalculado : undefined,
        footer: '¡Gracias por su visita!',
      };

      const memory: LastPaymentMemory = {
        total: totalFinalCobro,
        pagoCon: metodoPago === 'EFECTIVO' ? Math.max(pagoConEfectivo, totalFinalCobro) : totalFinalCobro,
        cambio: cambioCalculado,
        consecutivo: ordenActiva.consecutivo,
        ticketData,
      };
      setLastPayment(memory);
      localStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify(memory));

      await printThermalTicket(ticketData);
      if (ef > 0) await openCashDrawer();

      setShowCobroModal(false);
      setOrdenActivaId(null);
      await fetchPosState();
      focusCapture();
      notify('ok', `Factura ${ordenActiva.consecutivo} cobrada. Cambio: ${formatMoney(cambioCalculado)}.`);
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error cobrando orden');
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
      notify('ok', 'Domicilio creado y listo para agregar platos.');
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
      });
      setCashFlowModal(null);
      setCashFlowMonto('');
      setCashFlowConcepto('');
      await fetchPosState();
      focusCapture();
      notify(
        'ok',
        `${cashFlowModal === 'ENTRADA' ? 'Entrada' : 'Salida'} de ${formatMoney(monto)} registrada.`
      );
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error registrando movimiento de caja');
    } finally {
      setBusyAction(false);
    }
  };

  const handleAbrirTurnoCaja = async () => {
    setBusyAction(true);
    try {
      await executePosAction('ABRIR_TURNO_CAJA', { base_inicial: Number(baseInicialInput || 200000) });
      setShowAbrirCajaModal(false);
      await fetchPosState();
      notify('ok', `Turno abierto en ${cajaNombre}.`);
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error abriendo turno');
    } finally {
      setBusyAction(false);
    }
  };

  const handleCierreCaja = async (tipo: 'CIERRE_PARCIAL_TURNO' | 'CIERRE_TOTAL_CAJA') => {
    if (!efectivoContado) {
      return notify('err', 'Ingresa el efectivo físico contado en el cajón.');
    }
    setBusyAction(true);
    try {
      const res = await executePosAction(tipo, {
        efectivo_contado: Number(efectivoContado),
        observaciones: obsCierre,
      });
      setUltimoCierreResumen(res.resumen);
      await fetchPosState();
      notify('ok', `${tipo === 'CIERRE_TOTAL_CAJA' ? 'Cierre Total (Z)' : 'Cierre Parcial (X)'} ejecutado.`);
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error ejecutando cierre');
    } finally {
      setBusyAction(false);
    }
  };

  const handlePesarGramera = async () => {
    try {
      const kg = await readScaleWeightOnce();
      if (kg === null) {
        notify('err', 'Gramera no conectada o sin lectura disponible.');
      } else {
        notify('ok', `Gramera: ${Math.round(kg * 1000)} g (${kg.toFixed(3)} kg)`);
      }
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

  // Lector de códigos de barras USB/HID
  useBarcodeScanner((barcode) => {
    const match = productos.find(
      (p) => (p.codigo || '').toLowerCase() === barcode.toLowerCase()
    );
    if (match) {
      handleAgregarProducto(match, 1);
      notify('ok', `Escaneado: ${match.nombre}`);
    } else {
      setCaptureInput(barcode);
      notify('err', `Código ${barcode} no encontrado en productos.`);
    }
  });

  // Motor global de atajos de teclado estilo eleventa (F1-F12, INS, DEL, +, -, flechas, ESC)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextArea = target?.tagName === 'TEXTAREA';
      const isAnyModalOpen =
        showCobroModal ||
        showBuscarModal ||
        showVerificadorModal ||
        showVariosModal ||
        showArtComunModal ||
        showDomicilioModal ||
        showVentasDiaModal ||
        showAbrirCajaModal ||
        cashFlowModal !== null;

      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCobroModal(false);
        setShowBuscarModal(false);
        setShowVerificadorModal(false);
        setShowVariosModal(false);
        setShowArtComunModal(false);
        setShowDomicilioModal(false);
        setShowVentasDiaModal(false);
        setShowAbrirCajaModal(false);
        setCashFlowModal(null);
        focusCapture();
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('VENTAS');
        focusCapture();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('MESAS');
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('DOMICILIOS');
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('CORTE');
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        handleCambiarSiguienteTicket();
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        if (ordenActiva && itemsActivos.some((i) => i.estado_comanda === 'PENDIENTE')) {
          handleEnviarComanda();
        } else {
          handleNuevaVentaMostrador();
        }
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        setCashFlowModal('ENTRADA');
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        setCashFlowModal('SALIDA');
        return;
      }
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
      if (e.key === 'F12') {
        e.preventDefault();
        abrirModalCobro();
        return;
      }
      if (e.key === 'Insert' && !isAnyModalOpen) {
        e.preventDefault();
        setShowVariosModal(true);
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowArtComunModal(true);
        return;
      }

      if (isAnyModalOpen || isTextArea || activeTab !== 'VENTAS') return;

      const isTypingInCapture = target === captureInputRef.current;

      if (e.key === 'Delete' && (!isTypingInCapture || captureInput === '')) {
        const selected = itemsActivos.find((i) => i.id === selectedItemId);
        if (selected) {
          e.preventDefault();
          handleAnularItem(selected);
        }
        return;
      }

      if (e.key === 'ArrowDown' && itemsActivos.length > 0) {
        e.preventDefault();
        const idx = itemsActivos.findIndex((i) => i.id === selectedItemId);
        const nextIdx = idx < 0 ? 0 : Math.min(itemsActivos.length - 1, idx + 1);
        setSelectedItemId(itemsActivos[nextIdx].id);
        return;
      }

      if (e.key === 'ArrowUp' && itemsActivos.length > 0) {
        e.preventDefault();
        const idx = itemsActivos.findIndex((i) => i.id === selectedItemId);
        const prevIdx = idx < 0 ? 0 : Math.max(0, idx - 1);
        setSelectedItemId(itemsActivos[prevIdx].id);
        return;
      }

      if ((e.key === '+' || e.key === 'Add') && (!isTypingInCapture || captureInput === '')) {
        const selected = itemsActivos.find((i) => i.id === selectedItemId);
        if (selected) {
          e.preventDefault();
          handleCambiarCantidadItem(selected, 1);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    captureInput,
    itemsActivos,
    selectedItemId,
    ordenActiva,
    showCobroModal,
    showBuscarModal,
    showVerificadorModal,
    showVariosModal,
    showArtComunModal,
    showDomicilioModal,
    showVentasDiaModal,
    showAbrirCajaModal,
    cashFlowModal,
    abrirModalCobro,
    focusCapture,
    handleAnularItem,
    handleCambiarCantidadItem,
    handleCambiarSiguienteTicket,
    handleEnviarComanda,
    handleNuevaVentaMostrador,
  ]);

  const handleCaptureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = captureInput.trim().toLowerCase();
    if (!q) return;
    const exactCode = productos.find((p) => (p.codigo || '').toLowerCase() === q);
    const firstMatch = exactCode || productosFiltrados[0];
    if (firstMatch) {
      handleAgregarProducto(firstMatch, 1);
    } else {
      notify('err', `No se encontró producto con "${captureInput}".`);
    }
  };

  const noSpinnerClass =
    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  return (
    <div className="fixed inset-0 w-screen h-screen bg-zinc-100 text-zinc-900 flex flex-col overflow-hidden select-none font-sans">
      {/* Toast flotante sólido */}
      {toast && (
        <div
          className={`fixed top-14 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-semibold flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-white text-zinc-900 border-zinc-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              toast.type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          />
          {toast.text}
        </div>
      )}

      {/* 1. BARRA SUPERIOR ESTILO WINDOWS 11 ENTERPRISE (SÓLIDA Y CLARA) */}
      <header className="bg-white text-zinc-900 px-3 py-2 flex items-center justify-between gap-2 shrink-0 border-b border-zinc-200">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/"
            title="Volver al Panel Administrativo"
            className="p-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700 transition"
          >
            <Home className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 pr-3 border-r border-zinc-200">
            <span className="w-6 h-6 rounded-md bg-zinc-900 text-white font-bold text-xs flex items-center justify-center">
              E
            </span>
            <span className="font-bold text-sm tracking-tight text-zinc-950">Eliana POS</span>
          </div>

          {/* Botones de módulos F1 - F4 */}
          <nav className="flex items-center gap-1">
            {[
              { key: 'VENTAS' as PosTab, fKey: 'F1', label: 'Ventas', icon: ScanBarcode },
              {
                key: 'MESAS' as PosTab,
                fKey: 'F2',
                label: `Mesas (${mesas.filter((m) => m.estado !== 'LIBRE').length})`,
                icon: Utensils,
              },
              {
                key: 'DOMICILIOS' as PosTab,
                fKey: 'F3',
                label: `Domicilios (${ordenesDomicilio.filter((d) => d.estado !== 'FACTURADA').length})`,
                icon: Bike,
              },
              { key: 'CORTE' as PosTab, fKey: 'F4', label: 'Corte de Caja', icon: Lock },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200 hover:text-zinc-950'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      active ? 'bg-zinc-700 text-zinc-100' : 'bg-white text-zinc-600 border border-zinc-200'
                    }`}
                  >
                    {tab.fKey}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Derecha: Controles unificados monocromáticos */}
        <div className="flex items-center gap-1.5 text-xs">
          <select
            value={cajaNombre}
            onChange={(e) => setCajaNombre(e.target.value as 'Caja 1' | 'Caja 2')}
            className="bg-white border border-zinc-300 text-zinc-900 rounded-md px-2.5 py-1.5 font-semibold text-xs outline-none focus:border-blue-600"
          >
            <option value="Caja 1">Caja 1</option>
            <option value="Caja 2">Caja 2</option>
          </select>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-semibold text-xs bg-zinc-100 text-zinc-700 border border-zinc-200">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-600' : 'bg-amber-500'}`} />
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-zinc-500" /> : <WifiOff className="w-3.5 h-3.5 text-zinc-500" />}
            {isOnline ? 'En Línea' : `Offline (${offlineQueue.length})`}
          </span>

          <button
            onClick={() => setTouchMode((v) => !v)}
            title="Alternar entre Modo Híbrido Táctil y Modo Clásico Tabla"
            className={`px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1.5 border cursor-pointer transition ${
              touchMode
                ? 'bg-zinc-900 border-zinc-900 text-white'
                : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            {touchMode ? <MonitorSmartphone className="w-3.5 h-3.5" /> : <Keyboard className="w-3.5 h-3.5" />}
            {touchMode ? 'Táctil + Teclado' : 'Solo Tabla'}
          </button>

          <button
            onClick={handlePesarGramera}
            className="px-2.5 py-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Scale className="w-3.5 h-3.5 text-zinc-600" />
            <span className="hidden lg:inline">Gramera</span>
          </button>

          <button
            onClick={async () => {
              await openCashDrawer();
              await executePosAction('REGISTRAR_APERTURA_CAJON_SIN_VENTA', {});
              notify('ok', 'Cajón monedero abierto.');
            }}
            className="px-2.5 py-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Unlock className="w-3.5 h-3.5 text-zinc-600" />
            <span className="hidden lg:inline">Cajón</span>
          </button>

          <button
            onClick={fetchPosState}
            title="Sincronizar"
            className="p-1.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Banner discreto de turno cerrado */}
      {!sesionActiva && (
        <div className="bg-zinc-100 border-b border-zinc-200 px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-zinc-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>
              Turno cerrado en <b>{cajaNombre}</b> ({cajeroNombre}). Abre el turno para registrar la base inicial.
            </span>
          </div>
          <button
            onClick={() => setShowAbrirCajaModal(true)}
            className="px-3 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-semibold cursor-pointer transition"
          >
            Abrir Turno
          </button>
        </div>
      )}

      {/* ==================== MÓDULO F1: VENTAS ==================== */}
      {activeTab === 'VENTAS' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* 2. BARRA DE CAPTURA + ACCIONES RÁPIDAS MONOCROMÁTICAS */}
          <div className="bg-white border-b border-zinc-200 px-3 py-2 flex flex-col gap-2 shrink-0">
            <form onSubmit={handleCaptureSubmit} className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-700 whitespace-nowrap">
                Código / Producto:
              </label>
              <div className="relative flex-1 max-w-2xl">
                <ScanBarcode className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={captureInputRef}
                  autoFocus
                  type="text"
                  value={captureInput}
                  onChange={(e) => setCaptureInput(e.target.value)}
                  placeholder="Escanea código de barras o escribe nombre del plato / bebida y presiona ENTER..."
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-300 focus:border-blue-600 focus:bg-white rounded-md text-sm font-medium text-zinc-900 outline-none transition"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                ENTER - Agregar Producto
              </button>
            </form>

            {/* Sub-barra de botones rápidos limpia y uniforme */}
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
                    className="px-2.5 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-medium text-zinc-700 flex items-center gap-1.5 cursor-pointer transition"
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

          {/* 3. PESTAÑAS DE CUENTAS ABIERTAS */}
          <div className="bg-zinc-100 border-b border-zinc-200 px-3 pt-1.5 flex items-center gap-1 overflow-x-auto shrink-0">
            {ordenesAbiertas.map((ord) => {
              const isSelected = ordenActiva?.id === ord.id;
              return (
                <button
                  key={ord.id}
                  onClick={() => {
                    setOrdenActivaId(ord.id);
                    focusCapture();
                  }}
                  className={`px-3 py-1.5 rounded-t-md text-xs font-semibold border border-b-0 flex items-center gap-2 whitespace-nowrap cursor-pointer transition ${
                    isSelected
                      ? 'bg-white text-zinc-950 border-zinc-300'
                      : 'bg-zinc-200 text-zinc-600 border-transparent hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <span>{getOrdenTabLabel(ord)}</span>
                  <span className="text-[11px] font-bold tabular-nums text-zinc-900">
                    {formatMoney(ord.gran_total)}
                  </span>
                </button>
              );
            })}
            <button
              onClick={handleNuevaVentaMostrador}
              className="px-2.5 py-1 mb-1 rounded-md bg-white hover:bg-zinc-200 border border-zinc-300 text-zinc-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap transition"
            >
              <Plus className="w-3 h-3" /> Nuevo Ticket
            </button>
          </div>

          {/* 4. ÁREA CENTRAL DE TRABAJO (TABLA LIMPIA + PANEL TÁCTIL SÓLIDO) */}
          <div className="flex-1 flex min-h-0 overflow-hidden bg-white">
            {/* Izquierda: Tabla de Venta */}
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
                        <th className="py-2.5 px-3 text-right w-32 border-x border-zinc-200">Importe</th>
                        <th className="py-2.5 px-3 text-center w-28">Estado</th>
                        <th className="py-2.5 px-2 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-sm">
                      {itemsActivos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-24 text-center text-zinc-400">
                            <p className="font-semibold text-base text-zinc-600">
                              Cuenta vacía ({getOrdenTabLabel(ordenActiva)})
                            </p>
                            <p className="text-xs mt-1 text-zinc-500">
                              Escanea un código, escribe un producto arriba o selecciona un plato en el panel táctil.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        itemsActivos.map((it) => {
                          const isRowSel = selectedItemId === it.id;
                          return (
                            <tr
                              key={it.id}
                              onClick={() => setSelectedItemId(it.id)}
                              className={`cursor-pointer transition ${
                                isRowSel ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-zinc-50'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono text-xs text-zinc-500 border-r border-zinc-100">
                                {it.codigo_producto || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-zinc-900">
                                {it.nombre_producto}
                                <span className="ml-2 text-[10px] font-medium text-zinc-400">
                                  {it.estacion_comanda}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium tabular-nums text-zinc-700">
                                {formatMoney(it.precio_unitario)}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="font-bold tabular-nums text-zinc-900 min-w-[24px] text-center">
                                    {it.cantidad}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCambiarCantidadItem(it, 1);
                                    }}
                                    title="Agregar +1"
                                    className="w-6 h-6 rounded border border-zinc-300 bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-700 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold tabular-nums text-zinc-950 border-x border-zinc-100">
                                {formatMoney(it.subtotal)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                    it.estado_comanda === 'COMANDADO'
                                      ? 'bg-zinc-900 text-white border-zinc-900'
                                      : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                  }`}
                                >
                                  {it.estado_comanda}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAnularItem(it);
                                  }}
                                  title="Quitar ítem (DEL)"
                                  className="p-1.5 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition"
                                >
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
                  <Store className="w-10 h-10 mb-2 text-zinc-300" />
                  <p className="font-semibold text-zinc-700">No hay cuentas abiertas</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleNuevaVentaMostrador}
                      className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer transition"
                    >
                      + Abrir Venta Mostrador
                    </button>
                    <button
                      onClick={() => setActiveTab('MESAS')}
                      className="px-4 py-2 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 font-semibold text-xs cursor-pointer transition"
                    >
                      F2 Ver Mapa de Mesas
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Derecha: Panel Táctil Sobrio */}
            {touchMode && (
              <div className="w-[40%] max-w-[520px] min-w-[320px] bg-zinc-50 flex flex-col min-h-0 overflow-hidden">
                <div className="p-2 border-b border-zinc-200 bg-white flex items-center gap-1.5 overflow-x-auto shrink-0">
                  {categoriasProductos.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCatFiltro(c)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition border ${
                        catFiltro === c
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 grid grid-cols-2 xl:grid-cols-3 gap-2 content-start">
                  {productosFiltrados.map((p) => (
                    <button
                      key={p.id}
                      disabled={busyAction}
                      onClick={() => handleAgregarProducto(p, 1)}
                      className="p-2.5 rounded-lg border border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50 active:bg-zinc-100 text-left transition flex flex-col justify-between min-h-[76px] cursor-pointer"
                    >
                      <span className="font-semibold text-xs text-zinc-900 leading-snug line-clamp-2">
                        {p.nombre}
                      </span>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] font-mono text-zinc-400">{p.codigo}</span>
                        <span className="text-xs font-bold tabular-nums text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                          {formatMoney(p.precio_total)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5. BARRA INFERIOR PERSISTENTE ESTILO WINDOWS 11 */}
          <footer className="bg-white border-t border-zinc-200 px-3 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-zinc-700 mr-2 tabular-nums">
                  {itemsActivos.reduce((a, b) => a + Number(b.cantidad || 0), 0)} Productos en la venta actual
                </span>
                <button
                  onClick={handleCambiarSiguienteTicket}
                  className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 cursor-pointer transition"
                >
                  F5 - Cambiar
                </button>
                <button
                  onClick={handleEnviarComanda}
                  disabled={!ordenActiva || busyAction}
                  className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 cursor-pointer transition"
                >
                  <ChefHat className="w-3.5 h-3.5 text-zinc-600" />
                  F6 - Comandar Cocina
                </button>
                <button
                  onClick={handleImprimirPrecuenta}
                  disabled={!ordenActiva || itemsActivos.length === 0 || busyAction}
                  className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Printer className="w-3.5 h-3.5 text-zinc-600" />
                  Precuenta
                </button>
                <button
                  onClick={handleEliminarTicket}
                  disabled={!ordenActiva || busyAction}
                  className="px-2.5 py-1 rounded-md border border-zinc-300 bg-white hover:bg-red-50 hover:border-red-300 disabled:opacity-40 text-xs font-semibold text-red-700 cursor-pointer transition"
                >
                  Eliminar Ticket
                </button>
              </div>

              {/* Memoria del Último Ticket */}
              <div className="flex items-center gap-4 text-xs bg-zinc-50 border border-zinc-200 rounded-md px-3 py-1 w-fit tabular-nums">
                <div>
                  <span className="text-zinc-500">Último Total: </span>
                  <span className="font-bold text-zinc-900">{formatMoney(lastPayment.total)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Pagó Con: </span>
                  <span className="font-bold text-zinc-900">{formatMoney(lastPayment.pagoCon)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Cambio: </span>
                  <span className="font-bold text-blue-700">{formatMoney(lastPayment.cambio)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleReimprimirUltimo}
                  className="px-3 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Printer className="w-3.5 h-3.5 text-zinc-500" />
                  Reimprimir Último Ticket
                </button>
                <button
                  onClick={() => setShowVentasDiaModal(true)}
                  className="px-3 py-1 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 cursor-pointer transition"
                >
                  <History className="w-3.5 h-3.5 text-zinc-500" />
                  Ventas del Día ({resumenDia.cantidadFacturas})
                </button>
              </div>

              <button
                onClick={abrirModalCobro}
                disabled={!ordenActiva || itemsActivos.length === 0 || busyAction}
                className="px-6 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-base flex items-center gap-2 cursor-pointer transition"
              >
                <CreditCard className="w-5 h-5" />
                F12 - Cobrar
              </button>

              <div className="bg-zinc-100 text-zinc-950 px-5 py-2 rounded-lg border border-zinc-300 min-w-[180px] text-right">
                <div className="text-[10px] font-semibold uppercase text-zinc-500 leading-none">
                  Total Cuenta
                </div>
                <div className="text-3xl font-extrabold tabular-nums tracking-tight leading-tight text-zinc-950">
                  {formatMoney(ordenActiva?.gran_total || 0)}
                </div>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* ==================== MÓDULO F2: MAPA DE MESAS ==================== */}
      {activeTab === 'MESAS' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-zinc-100">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {ZONAS.map((z) => (
                <button
                  key={z}
                  onClick={() => setZonaFiltro(z)}
                  className={`px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer border transition ${
                    zonaFiltro === z
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
            <button
              onClick={handleNuevaVentaMostrador}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <Plus className="w-4 h-4" /> Venta Mostrador / Para Llevar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
            {mesasFiltradas.map((m) => {
              const ocupada = m.estado !== 'LIBRE';
              return (
                <button
                  key={m.id}
                  onClick={() => handleAbrirMesa(m)}
                  className={`p-4 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between min-h-[120px] ${
                    m.estado === 'PRECUENTA_IMPRESA'
                      ? 'bg-white border-blue-500 ring-1 ring-blue-500'
                      : ocupada
                        ? 'bg-white border-zinc-900 ring-1 ring-zinc-900'
                        : 'bg-white border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-zinc-900">{m.nombre}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        m.estado === 'PRECUENTA_IMPRESA'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : ocupada
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      {m.estado}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500">{m.zona}</div>
                  {ocupada && m.orden_activa ? (
                    <div className="mt-2 pt-2 border-t border-zinc-200">
                      <div className="font-bold tabular-nums text-zinc-950">
                        {formatMoney(m.orden_activa.gran_total)}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {m.orden_activa.items?.length || 0} platos • {m.mesero_actual || cajeroNombre}
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

      {/* ==================== MÓDULO F3: DOMICILIOS ==================== */}
      {activeTab === 'DOMICILIOS' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-zinc-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Despacho de Domicilios</h2>
              <p className="text-xs text-zinc-500">Pedidos separados de las ventas en punto</p>
            </div>
            <button
              onClick={() => setShowDomicilioModal(true)}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <Bike className="w-4 h-4" /> + Nuevo Domicilio
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ordenesDomicilio.map((dom) => (
              <div
                key={dom.id}
                className="bg-white rounded-lg border border-zinc-200 p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-zinc-900">{dom.consecutivo}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700">
                      {dom.estado_domicilio || dom.estado}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-zinc-800">{dom.cliente_nombre}</div>
                  <div className="text-xs text-zinc-600">{dom.cliente_telefono}</div>
                  <div className="text-xs text-zinc-600">{dom.cliente_direccion}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Repartidor: <b>{dom.domiciliario_nombre || 'Sin asignar'}</b> • Envío:{' '}
                    {formatMoney(dom.costo_domicilio)}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <span className="font-bold tabular-nums text-zinc-950">{formatMoney(dom.gran_total)}</span>
                  <div className="flex gap-1.5">
                    {dom.estado !== 'FACTURADA' && (
                      <button
                        onClick={() => {
                          setOrdenActivaId(dom.id);
                          setActiveTab('VENTAS');
                        }}
                        className="px-2.5 py-1 rounded bg-zinc-900 text-white text-xs font-semibold cursor-pointer"
                      >
                        Abrir (F1)
                      </button>
                    )}
                    {dom.estado_domicilio === 'EN_PREPARACION' && (
                      <button
                        onClick={async () => {
                          await executePosAction('ACTUALIZAR_ESTADO_DOMICILIO', {
                            orden_id: dom.id,
                            estado_domicilio: 'EN_RUTA',
                          });
                          fetchPosState();
                        }}
                        className="px-2.5 py-1 rounded bg-white border border-zinc-300 text-zinc-800 text-xs font-semibold cursor-pointer"
                      >
                        En Ruta
                      </button>
                    )}
                    {dom.estado_domicilio === 'EN_RUTA' && (
                      <button
                        onClick={async () => {
                          await executePosAction('ACTUALIZAR_ESTADO_DOMICILIO', {
                            orden_id: dom.id,
                            estado_domicilio: 'ENTREGADO',
                          });
                          fetchPosState();
                        }}
                        className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Entregado
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== MÓDULO F4: CORTE Y CUADRE DE CAJA ==================== */}
      {activeTab === 'CORTE' && (
        <div className="flex-1 p-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-4 content-start bg-zinc-100">
          <div className="bg-white rounded-lg border border-zinc-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900">
                Corte y Cuadre de Caja — {cajaNombre}
              </h2>
              <span className="text-xs font-medium text-zinc-500">
                Turno #{sesionActiva?.numero_turno || 1} ({cajeroNombre})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              {[
                { label: 'Base Inicial', value: sesionActiva?.base_inicial || 0 },
                { label: 'Efectivo Ventas', value: resumenDia.totalEfectivo },
                { label: 'Datáfono', value: resumenDia.totalDatafono },
                { label: 'Transferencias', value: resumenDia.totalTransferencia },
                { label: 'Salidas Caja Menor', value: salidasDiaCaja },
                { label: 'Propinas', value: resumenDia.totalPropinas },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-md bg-zinc-50 border border-zinc-200">
                  <div className="text-zinc-500">{stat.label}</div>
                  <div className="font-bold tabular-nums text-zinc-950 text-sm mt-0.5">
                    {formatMoney(stat.value)}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 pt-3 border-t border-zinc-200">
              <label className="text-xs font-semibold text-zinc-700 block">
                Efectivo físico contado en cajón (Cierre ciego)
              </label>
              <input
                type="number"
                value={efectivoContado}
                onChange={(e) => setEfectivoContado(e.target.value)}
                placeholder="Ej. 850000"
                className={`w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold text-zinc-900 ${noSpinnerClass}`}
              />
              <textarea
                value={obsCierre}
                onChange={(e) => setObsCierre(e.target.value)}
                placeholder="Observaciones del turno..."
                rows={2}
                className="w-full px-3 py-2 border border-zinc-300 rounded-md text-xs text-zinc-800"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCierreCaja('CIERRE_PARCIAL_TURNO')}
                  disabled={busyAction}
                  className="py-2.5 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-900 font-semibold text-xs cursor-pointer transition"
                >
                  Cierre Parcial (Corte X)
                </button>
                <button
                  onClick={() => handleCierreCaja('CIERRE_TOTAL_CAJA')}
                  disabled={busyAction}
                  className="py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs cursor-pointer transition"
                >
                  Cierre Total (Corte Z)
                </button>
              </div>
            </div>

            {ultimoCierreResumen && (
              <div className="p-3 rounded-md border border-zinc-200 bg-zinc-50 text-xs space-y-1 tabular-nums">
                <div className="font-bold text-zinc-900">
                  Resultado del Corte ({ultimoCierreResumen.tipoCierre})
                </div>
                <div>Efectivo Esperado: {formatMoney(ultimoCierreResumen.efectivoEsperado)}</div>
                <div>Efectivo Contado: {formatMoney(ultimoCierreResumen.efectivoContado)}</div>
                <div
                  className={`font-bold ${
                    ultimoCierreResumen.diferenciaEfectivo === 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  Diferencia: {formatMoney(ultimoCierreResumen.diferenciaEfectivo)}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-zinc-200 p-5 flex flex-col max-h-[520px]">
            <h3 className="text-sm font-bold text-zinc-900 mb-3">
              Bitácora de Eventos del Turno ({eventosTurno.length})
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {eventosTurno.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-10">
                  Sin novedades registradas en el turno.
                </div>
              ) : (
                eventosTurno.map((ev) => (
                  <div key={ev.id} className="p-2.5 rounded-md border border-zinc-200 bg-zinc-50 text-xs">
                    <div className="flex items-center justify-between font-semibold text-zinc-800">
                      <span>{ev.tipo_alerta.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(ev.created_at).toLocaleTimeString('es-CO')}
                      </span>
                    </div>
                    <p className="text-zinc-600 mt-1">{ev.descripcion}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODALES OPERATIVOS (SÓLIDOS SIN TRANSPARENCIAS) ==================== */}

      {/* Modal F12 - Cobrar */}
      {showCobroModal && ordenActiva && (
        <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="font-bold text-base text-zinc-950">
                F12 — Cobrar {getOrdenTabLabel(ordenActiva)}
              </h3>
              <button
                onClick={() => setShowCobroModal(false)}
                className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500">Subtotal + Domicilio</div>
                <div className="font-bold text-base tabular-nums text-zinc-900">
                  {formatMoney(
                    Number(ordenActiva.subtotal_bruto || 0) + Number(ordenActiva.costo_domicilio || 0)
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold">
                  Total a Cobrar
                </div>
                <div className="text-3xl font-extrabold tabular-nums text-zinc-950">
                  {formatMoney(totalFinalCobro)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Propina</label>
                <div className="flex gap-1 mb-1.5">
                  {[0, 0.05, 0.1].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setPropinaValor(Math.round(ordenActiva.subtotal_bruto * pct))}
                      className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 font-semibold text-zinc-700 cursor-pointer"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={propinaValor}
                  onChange={(e) => setPropinaValor(Number(e.target.value || 0))}
                  className={`w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-semibold tabular-nums text-zinc-900 ${noSpinnerClass}`}
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Descuento</label>
                <div className="h-[26px]" />
                <input
                  type="number"
                  value={descuentoValor}
                  onChange={(e) => setDescuentoValor(Number(e.target.value || 0))}
                  className={`w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-semibold tabular-nums text-zinc-900 ${noSpinnerClass}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              {(['EFECTIVO', 'DATAFONO', 'TRANSFERENCIA', 'MIXTO'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodoPago(m)}
                  className={`py-2 rounded-md text-xs font-semibold cursor-pointer transition ${
                    metodoPago === m
                      ? 'bg-zinc-900 text-white'
                      : 'bg-transparent text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {metodoPago === 'EFECTIVO' && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
                  <span>Pagó con (Efectivo recibido):</span>
                  <span className="text-base font-bold tabular-nums text-blue-700">
                    Cambio: {formatMoney(cambioCalculado)}
                  </span>
                </div>
                <input
                  autoFocus
                  type="number"
                  value={pagoConEfectivo}
                  onChange={(e) => setPagoConEfectivo(Number(e.target.value || 0))}
                  className={`w-full px-3 py-2 bg-white border border-zinc-300 focus:border-blue-600 rounded-md text-xl font-bold tabular-nums text-zinc-950 outline-none ${noSpinnerClass}`}
                />
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setPagoConEfectivo(totalFinalCobro)}
                    className="px-3 py-1 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-semibold text-zinc-800 cursor-pointer"
                  >
                    Exacto
                  </button>
                  {[20000, 50000, 100000, 200000].map((billete) => (
                    <button
                      key={billete}
                      onClick={() => setPagoConEfectivo(billete)}
                      className="px-3 py-1 rounded-md bg-white hover:bg-zinc-100 border border-zinc-300 text-xs font-semibold tabular-nums text-zinc-800 cursor-pointer"
                    >
                      {formatMoney(billete)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {metodoPago === 'MIXTO' && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="font-semibold text-zinc-700">Efectivo</label>
                  <input
                    type="number"
                    value={pagoEfectivo}
                    onChange={(e) => setPagoEfectivo(Number(e.target.value || 0))}
                    className={`w-full px-2 py-1.5 border border-zinc-300 rounded-md font-bold mt-1 ${noSpinnerClass}`}
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700">Datáfono</label>
                  <input
                    type="number"
                    value={pagoDatafono}
                    onChange={(e) => setPagoDatafono(Number(e.target.value || 0))}
                    className={`w-full px-2 py-1.5 border border-zinc-300 rounded-md font-bold mt-1 ${noSpinnerClass}`}
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700">Transferencia</label>
                  <input
                    type="number"
                    value={pagoTransferencia}
                    onChange={(e) => setPagoTransferencia(Number(e.target.value || 0))}
                    className={`w-full px-2 py-1.5 border border-zinc-300 rounded-md font-bold mt-1 ${noSpinnerClass}`}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleConfirmarCobro}
              disabled={busyAction}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer transition"
            >
              Confirmar Cobro e Imprimir Ticket
            </button>
          </div>
        </div>
      )}

      {/* Modal F10 - Buscar Producto */}
      {showBuscarModal && (
        <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-2xl w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">F10 — Buscador de Productos</h3>
              <button onClick={() => setShowBuscarModal(false)} className="p-1 text-zinc-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              ref={buscarInputRef}
              type="text"
              value={buscarQuery}
              onChange={(e) => {
                setBuscarQuery(e.target.value);
                setBuscarIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setBuscarIndex((i) => Math.min(productosBusquedaModal.length - 1, i + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setBuscarIndex((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter' && productosBusquedaModal[buscarIndex]) {
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
                <button
                  key={p.id}
                  onClick={() => {
                    handleAgregarProducto(p, 1);
                    setShowBuscarModal(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs cursor-pointer ${
                    idx === buscarIndex ? 'bg-blue-50 font-semibold' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div>
                    <span className="font-mono text-zinc-400 mr-2">{p.codigo}</span>
                    <span className="text-zinc-900">{p.nombre}</span>
                  </div>
                  <span className="font-bold tabular-nums text-zinc-900">{formatMoney(p.precio_total)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal F9 - Verificador de Precios */}
      {showVerificadorModal && (
        <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-md w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">F9 — Verificador de Precios</h3>
              <button onClick={() => setShowVerificadorModal(false)} className="p-1 text-zinc-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              ref={verificadorInputRef}
              type="text"
              value={verificadorQuery}
              onChange={(e) => setVerificadorQuery(e.target.value)}
              placeholder="Escanea código o escribe nombre del plato..."
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-medium outline-none focus:border-blue-600"
            />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {verificadorMatch.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-mono text-zinc-500">{p.codigo}</div>
                    <div className="font-semibold text-sm text-zinc-900">{p.nombre}</div>
                  </div>
                  <div className="text-xl font-extrabold tabular-nums text-zinc-950">
                    {formatMoney(p.precio_total)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal INS - Artículo Varios */}
      {showVariosModal && (
        <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-sm w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">INS — Agregar Artículo Varios</h3>
              <button onClick={() => setShowVariosModal(false)} className="p-1 text-zinc-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={variosNombre}
              onChange={(e) => setVariosNombre(e.target.value)}
              placeholder="Descripción (ej. Adicional especial)"
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-medium"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={variosCantidad}
                onChange={(e) => setVariosCantidad(Number(e.target.value || 1))}
                placeholder="Cant."
                className={`px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold ${noSpinnerClass}`}
              />
              <input
                type="number"
                value={variosPrecio}
                onChange={(e) => setVariosPrecio(Number(e.target.value || 0))}
                placeholder="Precio"
                className={`px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold ${noSpinnerClass}`}
              />
            </div>
            <button
              onClick={handleAgregarVarios}
              className="w-full py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer"
            >
              Agregar a la Cuenta
            </button>
          </div>
        </div>
      )}

      {/* Modal CTRL+P - Artículos Comunes */}
      {showArtComunModal && (
        <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-lg w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">CTRL+P — Artículos Comunes</h3>
              <button onClick={() => setShowArtComunModal(false)} className="p-1 text-zinc-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {productosComunes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    handleAgregarProducto(p, 1);
                    setShowArtComunModal(false);
                  }}
                  className="p-3 rounded-lg border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-left cursor-pointer"
                >
                  <div className="font-semibold text-xs text-zinc-900 line-clamp-2">{p.nombre}</div>
                  <div className="font-bold text-xs tabular-nums text-zinc-700 mt-1">
                    {formatMoney(p.precio_total)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal F7 / F8 - Entrada o Salida de Efectivo */}
      {cashFlowModal && (
        <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-sm w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">
                {cashFlowModal === 'ENTRADA' ? 'F7 — Entrada de Efectivo' : 'F8 — Salida de Efectivo'}
              </h3>
              <button onClick={() => setCashFlowModal(null)} className="p-1 text-zinc-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              autoFocus
              type="number"
              value={cashFlowMonto}
              onChange={(e) => setCashFlowMonto(e.target.value)}
              placeholder="Monto ($)"
              className={`w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold ${noSpinnerClass}`}
            />
            <input
              type="text"
              value={cashFlowConcepto}
              onChange={(e) => setCashFlowConcepto(e.target.value)}
              placeholder="Concepto / Motivo (ej. Sencillo, Hielo, Domicilio)"
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
            />
            <button
              onClick={handleRegistrarCashFlow}
              disabled={busyAction}
              className="w-full py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs cursor-pointer"
            >
              Registrar {cashFlowModal === 'ENTRADA' ? 'Entrada' : 'Salida'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Ventas del Día */}
      {showVentasDiaModal && (
        <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-2xl w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">
                Ventas Facturadas del Día ({ordenesFacturadasHoy.length})
              </h3>
              <button onClick={() => setShowVentasDiaModal(false)} className="p-1 text-zinc-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-zinc-200 border border-zinc-200 rounded-md">
              {ordenesFacturadasHoy.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-400">Sin ventas facturadas hoy.</div>
              ) : (
                ordenesFacturadasHoy.map((v) => (
                  <div key={v.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-zinc-900">
                        {v.consecutivo} • {v.canal_venta}
                      </div>
                      <div className="text-zinc-500">
                        {v.metodo_pago} • {v.items.length} ítems
                      </div>
                    </div>
                    <div className="font-bold tabular-nums text-sm text-zinc-950">
                      {formatMoney(v.gran_total)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Domicilio */}
      {showDomicilioModal && (
        <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-md w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900">Nuevo Pedido a Domicilio</h3>
              <button onClick={() => setShowDomicilioModal(false)} className="p-1 text-zinc-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Nombre del cliente"
              value={domNombre}
              onChange={(e) => setDomNombre(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
            />
            <input
              type="text"
              placeholder="Teléfono / WhatsApp"
              value={domTelefono}
              onChange={(e) => setDomTelefono(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
            />
            <input
              type="text"
              placeholder="Dirección completa"
              value={domDireccion}
              onChange={(e) => setDomDireccion(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={domCostoEnvio}
                onChange={(e) => setDomCostoEnvio(Number(e.target.value || 0))}
                placeholder="Valor domicilio"
                className={`px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold ${noSpinnerClass}`}
              />
              <input
                type="text"
                value={domRepartidor}
                onChange={(e) => setDomRepartidor(e.target.value)}
                placeholder="Domiciliario"
                className="px-3 py-2 border border-zinc-300 rounded-md text-sm"
              />
            </div>
            <button
              onClick={handleCrearDomicilio}
              className="w-full py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer"
            >
              Crear Domicilio
            </button>
          </div>
        </div>
      )}

      {/* Modal Abrir Turno */}
      {showAbrirCajaModal && (
        <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-300 max-w-sm w-full p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-base text-zinc-900">Abrir Turno — {cajaNombre}</h3>
            <label className="text-xs font-semibold text-zinc-600 block">
              Base inicial de efectivo ($)
            </label>
            <input
              type="number"
              value={baseInicialInput}
              onChange={(e) => setBaseInicialInput(e.target.value)}
              className={`w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold ${noSpinnerClass}`}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAbrirCajaModal(false)}
                className="flex-1 py-2 rounded-md border border-zinc-300 text-xs font-semibold text-zinc-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAbrirTurnoCaja}
                className="flex-1 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Abrir Turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
