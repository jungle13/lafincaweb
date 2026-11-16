'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ChefHat,
  CreditCard,
  DollarSign,
  Flame,
  Lock,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  ScanBarcode,
  Search,
  ShieldAlert,
  Store,
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
  useBarcodeScanner,
} from '@/lib/posHardwareBridge';

type PosTab = 'MESAS' | 'DOMICILIOS' | 'PEDIDO' | 'CAJA_AUDITORIA';

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

interface AlertaAntifraude {
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

const OFFLINE_QUEUE_KEY = 'lafinca_pos_offline_queue_v1';
const OFFLINE_CACHE_KEY = 'lafinca_pos_snapshot_v1';

const DENOMINACIONES_COP = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const NOTAS_RAPIDAS = ['Término 3/4', 'Bien asado', 'Término medio', 'Sin ensalada', 'Para llevar'];

export default function PosRestaurantePage() {
  const { user } = useAuth();
  const cajeroNombre = user?.name || 'Cajero';

  const [tab, setTab] = useState<PosTab>('MESAS');
  const [cajaActiva, setCajaActiva] = useState<'Caja 1' | 'Caja 2' | 'Caja 3'>('Caja 1');
  const [fechaHoy] = useState(() => new Date().toISOString().slice(0, 10));
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const [mesas, setMesas] = useState<PosMesa[]>([]);
  const [ordenes, setOrdenes] = useState<PosOrden[]>([]);
  const [productos, setProductos] = useState<ProductoVenta[]>([]);
  const [sesionActiva, setSesionActiva] = useState<any | null>(null);
  const [salidasDiaCaja, setSalidasDiaCaja] = useState(0);
  const [alertas, setAlertas] = useState<AlertaAntifraude[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Filtros UI
  const [zonaMesaFiltro, setZonaMesaFiltro] = useState<string>('TODAS');
  const [catProdFiltro, setCatProdFiltro] = useState<string>('TODAS');
  const [searchProd, setSearchProd] = useState('');
  const [activeOrdenId, setActiveOrdenId] = useState<string | null>(null);
  const [scaleWeight, setScaleWeight] = useState<number | null>(null);

  // Formulario Domicilio Rápido
  const [domTelefono, setDomTelefono] = useState('');
  const [domNombre, setDomNombre] = useState('');
  const [domDireccion, setDomDireccion] = useState('');
  const [domCosto, setDomCosto] = useState('4000');

  // Cobro, Propinas y Pago Mixto
  const [showCobroPanel, setShowCobroPanel] = useState(false);
  const [propinaPct, setPropinaPct] = useState<number>(0);
  const [propinaCustom, setPropinaCustom] = useState('');
  const [descuentoValor, setDescuentoValor] = useState('0');
  const [descuentoMotivo, setDescuentoMotivo] = useState('');
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA_NEQUI' | 'MIXTO'>('EFECTIVO');
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [mixEfectivo, setMixEfectivo] = useState('0');
  const [mixDatafono, setMixDatafono] = useState('0');
  const [mixTransf, setMixTransf] = useState('0');

  // Apertura y Arqueo Ciego de Caja
  const [baseInicialInput, setBaseInicialInput] = useState('200000');
  const [billetesCount, setBilletesCount] = useState<Record<number, number>>({});
  const [monedasTotal, setMonedasTotal] = useState('0');
  const [arqueoDatafonos, setArqueoDatafonos] = useState('0');
  const [arqueoTransf, setArqueoTransf] = useState('0');
  const [arqueoObs, setArqueoObs] = useState('');
  const [ultimoResumenCierre, setUltimoResumenCierre] = useState<any | null>(null);

  const notify = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadPosData = useCallback(async () => {
    try {
      const res = await fetch(`/api/pos?fecha=${fechaHoy}&caja=${encodeURIComponent(cajaActiva)}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Sin respuesta de red');
      const data = await res.json();
      if (data.success) {
        setMesas(data.mesas || []);
        setOrdenes(data.ordenes || []);
        setProductos(data.productos || []);
        setSesionActiva(data.sesionActiva || null);
        setSalidasDiaCaja(Number(data.salidasDiaCaja || 0));
        setAlertas(data.alertasAntifraude || []);
        setIsOnline(true);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(data));
        }
      }
    } catch {
      setIsOnline(false);
      if (typeof window !== 'undefined') {
        const snap = window.localStorage.getItem(OFFLINE_CACHE_KEY);
        if (snap) {
          const parsed = JSON.parse(snap);
          setMesas(parsed.mesas || []);
          setOrdenes(parsed.ordenes || []);
          setProductos(parsed.productos || []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [fechaHoy, cajaActiva]);

  useEffect(() => {
    loadPosData();
  }, [loadPosData]);

  // Sincronización de cola offline al recuperar internet
  const syncOfflineQueue = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) {
      setOfflineQueueCount(0);
      return;
    }
    const queue: any[] = JSON.parse(raw);
    setOfflineQueueCount(queue.length);
    if (queue.length === 0 || !navigator.onLine) return;

    const remaining: any[] = [];
    for (const payload of queue) {
      try {
        const r = await fetch('/api/pos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) remaining.push(payload);
      } catch {
        remaining.push(payload);
      }
    }
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    setOfflineQueueCount(remaining.length);
    if (remaining.length < queue.length) {
      notify('ok', `Sincronizadas ${queue.length - remaining.length} operaciones locales con la nube.`);
      loadPosData();
    }
  }, [loadPosData, notify]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    syncOfflineQueue();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [syncOfflineQueue]);

  // Helper unificado de mutación POS con respaldo Offline-First
  const postPosAction = useCallback(
    async (payload: Record<string, any>) => {
      const fullPayload = {
        ...payload,
        fecha: fechaHoy,
        caja_nombre: cajaActiva,
        cajero_nombre: cajeroNombre,
      };
      setBusy(true);
      try {
        const res = await fetch('/api/pos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullPayload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Error en operación POS');
        setIsOnline(true);
        await loadPosData();
        return data;
      } catch (err: any) {
        if (!navigator.onLine || String(err?.message || '').includes('Failed to fetch')) {
          setIsOnline(false);
          if (typeof window !== 'undefined') {
            const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
            const queue = raw ? JSON.parse(raw) : [];
            queue.push(fullPayload);
            window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
            setOfflineQueueCount(queue.length);
          }
          notify('err', 'Sin internet: operación guardada en cola local para sincronizar luego.');
          return null;
        }
        notify('err', err?.message || 'Error ejecutando operación');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [fechaHoy, cajaActiva, cajeroNombre, loadPosData, notify]
  );

  const activeOrden = useMemo(
    () => ordenes.find((o) => o.id === activeOrdenId) || null,
    [ordenes, activeOrdenId]
  );

  // Pistola de código de barras: agrega producto escaneado directamente a la orden activa
  useBarcodeScanner(
    useCallback(
      (code: string) => {
        if (!activeOrden) {
          notify('err', `Código leído (${code}). Abre primero una mesa o pedido para agregarlo.`);
          return;
        }
        const match = productos.find(
          (p) => p.codigo?.toLowerCase() === code.toLowerCase() || p.nombre.toLowerCase().includes(code.toLowerCase())
        );
        if (!match) {
          notify('err', `No se encontró producto con código ${code}.`);
          return;
        }
        postPosAction({
          action: 'ABRIR_O_AGREGAR_ORDEN',
          orden_id: activeOrden.id,
          items: [
            {
              producto_id: match.id,
              codigo_producto: match.codigo,
              nombre_producto: match.nombre,
              categoria: match.categoria,
              cantidad: 1,
              precio_unitario: Number(match.precio_total || match.precio_neto || 0),
            },
          ],
        }).then(() => notify('ok', `Escaneado: ${match.nombre}`));
      },
      [activeOrden, productos, postPosAction, notify]
    )
  );

  // Abrir o seleccionar mesa
  const handleSelectMesa = async (mesa: PosMesa) => {
    if (mesa.orden_activa_id) {
      setActiveOrdenId(mesa.orden_activa_id);
      setTab('PEDIDO');
      return;
    }
    const res = await postPosAction({
      action: 'ABRIR_O_AGREGAR_ORDEN',
      canal_venta: 'SALON_MESA',
      mesa_numero: mesa.numero,
      mesero_nombre: cajeroNombre,
    });
    if (res?.orden?.id) {
      setActiveOrdenId(res.orden.id);
      setTab('PEDIDO');
    }
  };

  // Crear pedido a domicilio o mostrador
  const handleCrearDomicilio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domNombre.trim() || !domTelefono.trim()) return;
    const res = await postPosAction({
      action: 'ABRIR_O_AGREGAR_ORDEN',
      canal_venta: 'DOMICILIO',
      cliente_nombre: domNombre.trim(),
      cliente_telefono: domTelefono.trim(),
      cliente_direccion: domDireccion.trim(),
      costo_domicilio: Number(domCosto || 0),
    });
    if (res?.orden?.id) {
      setDomNombre('');
      setDomTelefono('');
      setDomDireccion('');
      setActiveOrdenId(res.orden.id);
      setTab('PEDIDO');
    }
  };

  const handleCrearMostrador = async () => {
    const res = await postPosAction({
      action: 'ABRIR_O_AGREGAR_ORDEN',
      canal_venta: 'MOSTRADOR_LLEVAR',
      cliente_nombre: 'Cliente Mostrador',
    });
    if (res?.orden?.id) {
      setActiveOrdenId(res.orden.id);
      setTab('PEDIDO');
    }
  };

  const handleAddProductToOrden = async (prod: ProductoVenta, nota?: string) => {
    if (!activeOrden) {
      notify('err', 'Selecciona una mesa o crea un pedido primero.');
      return;
    }
    await postPosAction({
      action: 'ABRIR_O_AGREGAR_ORDEN',
      orden_id: activeOrden.id,
      items: [
        {
          producto_id: prod.id,
          codigo_producto: prod.codigo,
          nombre_producto: prod.nombre,
          categoria: prod.categoria,
          cantidad: scaleWeight && scaleWeight > 0 ? scaleWeight : 1,
          unidad: scaleWeight && scaleWeight > 0 ? 'Kg' : 'Und',
          precio_unitario: Number(prod.precio_total || prod.precio_neto || 0),
          notas_comanda: nota || null,
        },
      ],
    });
    if (scaleWeight) setScaleWeight(null);
  };

  const handleAnularItem = async (item: PosOrdenItem) => {
    if (!activeOrden) return;
    let motivo = 'Ajuste antes de comanda';
    if (item.estado_comanda !== 'PENDIENTE' || activeOrden.precuenta_impresa_veces > 0) {
      const promptMsg = window.prompt(
        `⚠️ CONTROL ANTIFRAUDE: "${item.nombre_producto}" ya fue ${
          activeOrden.precuenta_impresa_veces > 0 ? 'incluido en pre-cuenta' : 'comandado a cocina'
        }.\nIngresa el motivo obligatorio de anulación:`
      );
      if (!promptMsg || !promptMsg.trim()) return;
      motivo = promptMsg.trim();
    }
    await postPosAction({
      action: 'ANULAR_ITEM_ORDEN',
      orden_id: activeOrden.id,
      item_id: item.id,
      motivo,
    });
  };

  const handleEnviarComanda = async () => {
    if (!activeOrden) return;
    const res = await postPosAction({
      action: 'ENVIAR_COMANDA',
      orden_id: activeOrden.id,
    });
    if (res?.comandados?.length > 0) {
      await printThermalTicket({
        titulo: 'COMANDA DE COCINA / PARRILLA',
        consecutivo: activeOrden.consecutivo,
        fecha: fechaHoy,
        caja: cajaActiva,
        cajero: cajeroNombre,
        canal: activeOrden.canal_venta,
        mesaNumero: activeOrden.mesa_numero,
        clienteNombre: activeOrden.cliente_nombre,
        items: res.comandados.map((it: any) => ({
          nombre: it.nombre_producto,
          cantidad: it.cantidad,
          precioUnitario: it.precio_unitario,
          subtotal: it.subtotal,
          notas: it.notas_comanda,
        })),
        subtotal: activeOrden.subtotal_bruto,
        total: activeOrden.gran_total,
        footer: '--- PREPARAR DE INMEDIATO ---',
      });
      notify('ok', `Comanda enviada (${res.comandados.length} platos nuevos).`);
    } else {
      notify('err', 'No hay platos nuevos pendientes por comandar.');
    }
  };

  const handleImprimirPrecuenta = async () => {
    if (!activeOrden) return;
    const res = await postPosAction({
      action: 'IMPRIMIR_PRECUENTA',
      orden_id: activeOrden.id,
    });
    if (res?.orden) {
      const activos = (res.items || []).filter((i: any) => i.estado_comanda !== 'ANULADO');
      await printThermalTicket({
        titulo: 'PRE-CUENTA (NO ES FACTURA)',
        consecutivo: activeOrden.consecutivo,
        fecha: fechaHoy,
        caja: cajaActiva,
        cajero: cajeroNombre,
        canal: activeOrden.canal_venta,
        mesaNumero: activeOrden.mesa_numero,
        clienteNombre: activeOrden.cliente_nombre,
        items: activos.map((it: any) => ({
          nombre: it.nombre_producto,
          cantidad: it.cantidad,
          precioUnitario: it.precio_unitario,
          subtotal: it.subtotal,
        })),
        subtotal: res.orden.subtotal_bruto,
        costoDomicilio: res.orden.costo_domicilio,
        total: res.orden.gran_total,
        footer: 'Propina voluntaria sugerida 10%. Gracias!',
      });
    }
  };

  const propinaCalculada = useMemo(() => {
    if (!activeOrden) return 0;
    if (propinaCustom.trim() !== '') return Math.max(0, Number(propinaCustom || 0));
    return Math.round((Number(activeOrden.subtotal_bruto || 0) * propinaPct) / 100);
  }, [activeOrden, propinaPct, propinaCustom]);

  const totalFinalCobro = useMemo(() => {
    if (!activeOrden) return 0;
    return Math.max(
      0,
      Math.round(
        Number(activeOrden.subtotal_bruto || 0) -
          Number(descuentoValor || 0) +
          propinaCalculada +
          Number(activeOrden.costo_domicilio || 0)
      )
    );
  }, [activeOrden, descuentoValor, propinaCalculada]);

  const handleConfirmarFactura = async () => {
    if (!activeOrden) return;
    const res = await postPosAction({
      action: 'FACTURAR_ORDEN',
      orden_id: activeOrden.id,
      propina: propinaCalculada,
      descuento: Number(descuentoValor || 0),
      motivo_descuento: descuentoMotivo,
      metodo_pago: metodoPago,
      pago_efectivo: metodoPago === 'MIXTO' ? Number(mixEfectivo || 0) : metodoPago === 'EFECTIVO' ? totalFinalCobro : 0,
      pago_datafono: metodoPago === 'MIXTO' ? Number(mixDatafono || 0) : metodoPago === 'DATAFONO' ? totalFinalCobro : 0,
      pago_transferencia:
        metodoPago === 'MIXTO' ? Number(mixTransf || 0) : metodoPago === 'TRANSFERENCIA_NEQUI' ? totalFinalCobro : 0,
      efectivo_recibido: Number(efectivoRecibido || totalFinalCobro),
    });

    if (res?.orden) {
      await openCashDrawer();
      await printThermalTicket({
        titulo: 'DOCUMENTO EQUIVALENTE / TIRILLA POS',
        consecutivo: res.orden.consecutivo,
        fecha: fechaHoy,
        caja: cajaActiva,
        cajero: cajeroNombre,
        canal: res.orden.canal_venta,
        mesaNumero: res.orden.mesa_numero,
        clienteNombre: res.orden.cliente_nombre,
        clienteTelefono: res.orden.cliente_telefono,
        clienteDireccion: res.orden.cliente_direccion,
        items: (res.items || []).map((it: any) => ({
          nombre: it.nombre_producto,
          cantidad: it.cantidad,
          precioUnitario: it.precio_unitario,
          subtotal: it.subtotal,
        })),
        subtotal: res.orden.subtotal_bruto,
        descuento: res.orden.descuento,
        propina: res.orden.propina,
        costoDomicilio: res.orden.costo_domicilio,
        total: res.orden.gran_total,
        metodoPago: res.orden.metodo_pago,
        efectivoRecibido: res.orden.efectivo_recibido,
        cambio: res.orden.cambio_entregado,
      });
      setShowCobroPanel(false);
      setActiveOrdenId(null);
      setPropinaPct(0);
      setPropinaCustom('');
      setDescuentoValor('0');
      setTab(res.orden.canal_venta === 'DOMICILIO' ? 'DOMICILIOS' : 'MESAS');
      notify('ok', `Factura ${res.orden.consecutivo} cobrada ($${formatMoney(res.orden.gran_total)}).`);
    }
  };

  // Métricas separadas: Ventas en Punto vs Ventas por Domicilio
  const metricasDia = useMemo(() => {
    const facturadas = ordenes.filter((o) => o.estado === 'FACTURADA' && o.fecha === fechaHoy);
    const enPunto = facturadas
      .filter((o) => o.canal_venta !== 'DOMICILIO')
      .reduce((acc, o) => acc + Number(o.gran_total || 0), 0);
    const domicilios = facturadas
      .filter((o) => o.canal_venta === 'DOMICILIO')
      .reduce((acc, o) => acc + Number(o.gran_total || 0), 0);
    const propinas = facturadas.reduce((acc, o) => acc + Number(o.propina || 0), 0);
    return { enPunto, domicilios, propinas, total: enPunto + domicilios, count: facturadas.length };
  }, [ordenes, fechaHoy]);

  const totalEfectivoContadoArqueo = useMemo(() => {
    const billetesSum = DENOMINACIONES_COP.reduce((acc, d) => acc + d * (billetesCount[d] || 0), 0);
    return billetesSum + Number(monedasTotal || 0);
  }, [billetesCount, monedasTotal]);

  const categoriasProductos = useMemo(() => {
    const cats = Array.from(new Set(productos.map((p) => p.categoria || 'PLATOS'))).sort();
    return ['TODAS', ...cats];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = searchProd.trim().toLowerCase();
    return productos.filter((p) => {
      if (catProdFiltro !== 'TODAS' && (p.categoria || 'PLATOS') !== catProdFiltro) return false;
      if (q && !p.nombre.toLowerCase().includes(q) && !String(p.codigo).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [productos, catProdFiltro, searchProd]);

  const domiciliosActivos = useMemo(
    () => ordenes.filter((o) => o.canal_venta === 'DOMICILIO'),
    [ordenes]
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] bg-slate-100 overflow-hidden select-none">
      {/* Barra Superior Multi-Caja + Estado Red + Periféricos */}
      <header className="bg-slate-950 text-white px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 font-extrabold text-sm">
            <Store className="w-4 h-4 text-orange-400" />
            <span>La Finca POS</span>
          </div>

          <select
            value={cajaActiva}
            onChange={(e) => setCajaActiva(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white"
          >
            <option value="Caja 1">Caja 1</option>
            <option value="Caja 2">Caja 2</option>
            <option value="Caja 3">Caja 3</option>
          </select>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? 'En Línea' : `Offline (${offlineQueueCount})`}
          </span>

          {offlineQueueCount > 0 && isOnline && (
            <button
              type="button"
              onClick={syncOfflineQueue}
              className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[11px] font-bold cursor-pointer"
            >
              Sincronizar ({offlineQueueCount})
            </button>
          )}
        </div>

        {/* Métricas en vivo: Punto vs Domicilio + Acciones rápidas Hardware */}
        <div className="flex items-center gap-2 text-xs">
          <div className="hidden md:flex items-center gap-3 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
            <span>
              Punto: <strong className="text-emerald-400 font-mono">$ {formatMoney(metricasDia.enPunto)}</strong>
            </span>
            <span>·</span>
            <span>
              Domicilios: <strong className="text-sky-400 font-mono">$ {formatMoney(metricasDia.domicilios)}</strong>
            </span>
            <span>·</span>
            <span>
              Propinas: <strong className="text-amber-300 font-mono">$ {formatMoney(metricasDia.propinas)}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={async () => {
              const w = await readScaleWeightOnce();
              if (w !== null) {
                setScaleWeight(w);
                notify('ok', `Gramera: ${w} Kg leídos`);
              } else {
                notify('err', 'No se detectó gramera conectada en puerto serial.');
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
            title="Leer peso desde gramera serial"
          >
            <Scale className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{scaleWeight ? `${scaleWeight} Kg` : 'Gramera'}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await openCashDrawer();
              await postPosAction({ action: 'REGISTRAR_APERTURA_CAJON_SIN_VENTA' });
              notify('err', 'Apertura manual de cajón registrada en bitácora antifraude.');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
            title="Abrir cajón monedero (se audita)"
          >
            <Unlock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Cajón</span>
          </button>

          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 px-2" title="Lector de código de barras activo">
            <ScanBarcode className="w-3.5 h-3.5 text-sky-400" />
          </span>
        </div>
      </header>

      {/* Navegación 4 Pestañas POS */}
      <nav className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {[
            { key: 'MESAS', label: 'Mapa de Mesas', icon: Utensils },
            { key: 'DOMICILIOS', label: `Domicilios (${domiciliosActivos.length})`, icon: Bike },
            { key: 'PEDIDO', label: activeOrden ? `Pedido ${activeOrden.consecutivo}` : 'Pedido Activo', icon: ChefHat },
            { key: 'CAJA_AUDITORIA', label: 'Cuadre Caja & Antifraude', icon: Lock },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key as PosTab)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCrearMostrador}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Venta Mostrador
          </button>
          <button
            type="button"
            onClick={loadPosData}
            className="p-2 rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </nav>

      {toast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 ${
            toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* CONTENIDO SEGÚN PESTAÑA */}
      <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
        {/* 1. MAPA DE MESAS */}
        {tab === 'MESAS' && (
          <div className="space-y-3 max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center gap-2">
              {['TODAS', 'Salón Principal', 'Terraza', 'Kiosco / Parrilla'].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZonaMesaFiltro(z)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                    zonaMesaFiltro === z
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {z === 'TODAS' ? 'Todas las Zonas' : z}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {mesas
                .filter((m) => zonaMesaFiltro === 'TODAS' || m.zona === zonaMesaFiltro)
                .map((mesa) => {
                  const isLibre = mesa.estado === 'LIBRE';
                  const isPrecuenta = mesa.estado === 'PRECUENTA_IMPRESA';
                  return (
                    <button
                      key={mesa.id}
                      type="button"
                      onClick={() => handleSelectMesa(mesa)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer active:scale-95 flex flex-col justify-between min-h-[120px] shadow-2xs ${
                        isLibre
                          ? 'bg-white border-emerald-200 hover:border-emerald-500'
                          : isPrecuenta
                            ? 'bg-sky-50 border-sky-400'
                            : 'bg-amber-50 border-amber-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-extrabold text-slate-900">{mesa.nombre}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isLibre
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPrecuenta
                                ? 'bg-sky-200 text-sky-900'
                                : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {isLibre ? 'LIBRE' : isPrecuenta ? 'PRE-CUENTA' : 'OCUPADA'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500">{mesa.zona}</div>

                      {mesa.orden_activa ? (
                        <div className="pt-2 border-t border-slate-200/70">
                          <div className="text-sm font-extrabold font-mono text-slate-900">
                            $ {formatMoney(mesa.orden_activa.gran_total)}
                          </div>
                          <div className="text-[10px] text-slate-600">
                            {mesa.orden_activa.items?.filter((i) => i.estado_comanda !== 'ANULADO').length || 0} platos ·{' '}
                            {mesa.mesero_actual || 'Caja'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-700 font-semibold">Tocar para abrir</div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* 2. DOMICILIOS */}
        {tab === 'DOMICILIOS' && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
            <form
              onSubmit={handleCrearDomicilio}
              className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 h-fit shadow-2xs"
            >
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Bike className="w-4 h-4 text-sky-600" />
                Nuevo Pedido a Domicilio
              </h2>
              <input
                type="text"
                value={domTelefono}
                onChange={(e) => setDomTelefono(e.target.value)}
                placeholder="Teléfono / WhatsApp *"
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={domNombre}
                onChange={(e) => setDomNombre(e.target.value)}
                placeholder="Nombre del Cliente *"
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={domDireccion}
                onChange={(e) => setDomDireccion(e.target.value)}
                placeholder="Dirección y Barrio *"
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
              />
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Costo Domicilio ($)</span>
                <input
                  type="number"
                  value={domCosto}
                  onChange={(e) => setDomCosto(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold mt-1"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Crear Domicilio y Tomar Platos →
              </button>
            </form>

            <div className="lg:col-span-2 space-y-2.5">
              {domiciliosActivos.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-400">
                  No hay domicilios registrados hoy.
                </div>
              ) : (
                domiciliosActivos.map((dom) => (
                  <div
                    key={dom.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold">
                          {dom.consecutivo}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{dom.cliente_nombre}</span>
                        <span className="text-xs font-mono text-slate-500">{dom.cliente_telefono}</span>
                      </div>
                      <div className="text-xs text-slate-600">{dom.cliente_direccion}</div>
                      <div className="text-xs font-bold font-mono text-emerald-700">
                        Total: $ {formatMoney(dom.gran_total)} (Envío: $ {formatMoney(dom.costo_domicilio)})
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={dom.estado_domicilio || 'RECIBIDO'}
                        onChange={(e) =>
                          postPosAction({
                            action: 'ACTUALIZAR_ESTADO_DOMICILIO',
                            orden_id: dom.id,
                            estado_domicilio: e.target.value,
                          })
                        }
                        className="border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold bg-slate-50"
                      >
                        <option value="RECIBIDO">Recibido</option>
                        <option value="EN_COCINA">En Cocina</option>
                        <option value="EN_CAMINO">En Camino</option>
                        <option value="ENTREGADO">Entregado</option>
                      </select>

                      {dom.estado !== 'FACTURADA' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveOrdenId(dom.id);
                            setTab('PEDIDO');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                        >
                          Abrir / Cobrar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. PEDIDO ACTIVO, COMANDAS Y FACTURACIÓN */}
        {tab === 'PEDIDO' && (
          <div className="h-full flex flex-col lg:flex-row gap-3 min-h-0">
            {/* Catálogo de Platos */}
            <div className="flex-1 flex flex-col min-h-0 gap-2.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchProd}
                    onChange={(e) => setSearchProd(e.target.value)}
                    placeholder="Buscar plato o código POS..."
                    className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm"
                  />
                  {searchProd && (
                    <button
                      type="button"
                      onClick={() => setSearchProd('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
                {categoriasProductos.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCatProdFiltro(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border cursor-pointer ${
                      catProdFiltro === c
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {c === 'TODAS' ? 'Todas' : c}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 pr-1">
                {productosFiltrados.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleAddProductToOrden(prod)}
                    className="bg-white border border-slate-200 hover:border-slate-900 rounded-2xl p-3 text-left flex flex-col justify-between min-h-[100px] cursor-pointer active:scale-95 transition-all shadow-2xs"
                  >
                    <div className="text-[10px] font-mono text-slate-400">#{prod.codigo}</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2">{prod.nombre}</div>
                    <div className="text-xs font-extrabold font-mono text-emerald-700 pt-1">
                      $ {formatMoney(prod.precio_total || prod.precio_neto)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tirilla de Pedido Activo */}
            <aside className="w-full lg:w-[410px] bg-white border border-slate-200 rounded-2xl flex flex-col shrink-0 shadow-sm overflow-hidden">
              {!activeOrden ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
                  Selecciona una Mesa o crea un Domicilio / Venta Mostrador.
                </div>
              ) : (
                <>
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {activeOrden.canal_venta === 'SALON_MESA'
                          ? `Mesa ${activeOrden.mesa_numero}`
                          : activeOrden.canal_venta === 'DOMICILIO'
                            ? `Domicilio · ${activeOrden.cliente_nombre}`
                            : 'Venta Mostrador'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">{activeOrden.consecutivo}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      {activeOrden.estado}
                    </span>
                  </div>

                  {/* Lista de Platos en la Orden */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-3 space-y-1">
                    {(activeOrden.items || [])
                      .filter((i) => i.estado_comanda !== 'ANULADO')
                      .map((it) => (
                        <div key={it.id} className="py-2 flex items-start justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{it.cantidad}×</span>
                              <span className="truncate">{it.nombre_producto}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] mt-0.5">
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold ${
                                  it.estado_comanda === 'COMANDADO'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {it.estado_comanda === 'COMANDADO' ? '🔥 En Cocina' : '⏳ Pendiente'}
                              </span>
                              {it.notas_comanda && <span className="text-slate-500">{it.notas_comanda}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-slate-900">$ {formatMoney(it.subtotal)}</span>
                            <button
                              type="button"
                              onClick={() => handleAnularItem(it)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                              title="Anular plato"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Notas rápidas para siguiente plato */}
                  <div className="px-3 py-1.5 border-t border-slate-100 flex items-center gap-1 overflow-x-auto">
                    {NOTAS_RAPIDAS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          const last = productosFiltrados[0];
                          if (last) handleAddProductToOrden(last, n);
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-700 whitespace-nowrap cursor-pointer"
                      >
                        + {n}
                      </button>
                    ))}
                  </div>

                  {/* Totales y Panel de Cobro */}
                  <div className="p-3.5 border-t border-slate-200 bg-slate-50 space-y-2.5">
                    <div className="flex items-center justify-between text-sm font-extrabold text-slate-900">
                      <span>TOTAL PARCIAL</span>
                      <span className="font-mono text-base">$ {formatMoney(activeOrden.gran_total)}</span>
                    </div>

                    {!showCobroPanel ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleEnviarComanda}
                          className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Flame className="w-3.5 h-3.5" />
                          Comandar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleImprimirPrecuenta}
                          className="py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Pre-cuenta
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCobroPanel(true)}
                          className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Cobrar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5 pt-1 border-t border-slate-200">
                        {/* Propina voluntaria */}
                        <div className="flex items-center justify-between gap-1 text-xs">
                          <span className="font-bold text-slate-600">Propina:</span>
                          <div className="flex items-center gap-1">
                            {[0, 5, 10].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  setPropinaCustom('');
                                  setPropinaPct(pct);
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                                  propinaPct === pct && !propinaCustom
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {pct}%
                              </button>
                            ))}
                            <input
                              type="number"
                              value={propinaCustom}
                              onChange={(e) => setPropinaCustom(e.target.value)}
                              placeholder="Otro $"
                              className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-mono"
                            />
                          </div>
                        </div>

                        {/* Método de pago */}
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { k: 'EFECTIVO', l: 'Efectivo' },
                            { k: 'DATAFONO', l: 'Datáfono' },
                            { k: 'TRANSFERENCIA_NEQUI', l: 'Nequi' },
                            { k: 'MIXTO', l: 'Mixto' },
                          ].map((mp) => (
                            <button
                              key={mp.k}
                              type="button"
                              onClick={() => setMetodoPago(mp.k as any)}
                              className={`py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                                metodoPago === mp.k
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-700 border-slate-300'
                              }`}
                            >
                              {mp.l}
                            </button>
                          ))}
                        </div>

                        {metodoPago === 'EFECTIVO' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={efectivoRecibido}
                              onChange={(e) => setEfectivoRecibido(e.target.value)}
                              placeholder={`Recibido ($${formatMoney(totalFinalCobro)})`}
                              className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => setEfectivoRecibido(String(totalFinalCobro))}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-xs font-bold cursor-pointer"
                            >
                              Exacto
                            </button>
                          </div>
                        )}

                        {metodoPago === 'MIXTO' && (
                          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                            <label>
                              Efectivo
                              <input
                                type="number"
                                value={mixEfectivo}
                                onChange={(e) => setMixEfectivo(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 font-mono"
                              />
                            </label>
                            <label>
                              Datáfono
                              <input
                                type="number"
                                value={mixDatafono}
                                onChange={(e) => setMixDatafono(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 font-mono"
                              />
                            </label>
                            <label>
                              Nequi/Transf
                              <input
                                type="number"
                                value={mixTransf}
                                onChange={(e) => setMixTransf(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 font-mono"
                              />
                            </label>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs font-extrabold text-emerald-700">
                          <span>TOTAL CON PROPINA:</span>
                          <span className="font-mono text-sm">$ {formatMoney(totalFinalCobro)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCobroPanel(false)}
                            className="py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer"
                          >
                            Volver
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={handleConfirmarFactura}
                            className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer"
                          >
                            Facturar e Imprimir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </aside>
          </div>
        )}

        {/* 4. CUADRE DE CAJA (CIERRE PARCIAL / TOTAL) + AUDITORÍA ANTIFRAUDE */}
        {tab === 'CAJA_AUDITORIA' && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Panel Izquierdo: Apertura, Arqueo Ciego, Cierre Parcial / Total */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Control y Cuadre de {cajaActiva}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {sesionActiva
                      ? `Turno #${sesionActiva.numero_turno} ABIERTO · Base: $${formatMoney(sesionActiva.efectivo_inicial)}`
                      : 'Sin turno abierto actualmente en esta caja'}
                  </p>
                </div>
              </div>

              {!sesionActiva ? (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Efectivo Inicial / Base de Caja ($)</span>
                    <input
                      type="number"
                      value={baseInicialInput}
                      onChange={(e) => setBaseInicialInput(e.target.value)}
                      className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      postPosAction({
                        action: 'ABRIR_TURNO_CAJA',
                        efectivo_inicial: Number(baseInicialInput || 0),
                      })
                    }
                    className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Abrir Turno en {cajaActiva}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase">
                    Arqueo Ciego de Billetes y Monedas (Cuenta tu cajón antes de cerrar)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DENOMINACIONES_COP.map((den) => (
                      <div key={den} className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
                        <div className="font-mono font-bold text-slate-700 mb-1">${(den / 1000).toFixed(0)}k</div>
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setBilletesCount((p) => ({ ...p, [den]: Math.max(0, (p[den] || 0) - 1) }))
                            }
                            className="p-1 rounded bg-white border border-slate-300 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-extrabold">{billetesCount[den] || 0}</span>
                          <button
                            type="button"
                            onClick={() => setBilletesCount((p) => ({ ...p, [den]: (p[den] || 0) + 1 }))}
                            className="p-1 rounded bg-white border border-slate-300 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <label className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
                      <span className="font-bold text-slate-700 block mb-1">Monedas ($)</span>
                      <input
                        type="number"
                        value={monedasTotal}
                        onChange={(e) => setMonedasTotal(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label>
                      <span className="font-bold text-slate-600">Total Vouchers Datáfonos ($)</span>
                      <input
                        type="number"
                        value={arqueoDatafonos}
                        onChange={(e) => setArqueoDatafonos(e.target.value)}
                        className="w-full mt-1 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono"
                      />
                    </label>
                    <label>
                      <span className="font-bold text-slate-600">Total Transferencias / Nequi ($)</span>
                      <input
                        type="number"
                        value={arqueoTransf}
                        onChange={(e) => setArqueoTransf(e.target.value)}
                        className="w-full mt-1 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono"
                      />
                    </label>
                  </div>

                  <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between text-xs">
                    <span>Efectivo Contado Físicamente:</span>
                    <span className="font-mono text-sm font-extrabold">$ {formatMoney(totalEfectivoContadoArqueo)}</span>
                  </div>

                  <input
                    type="text"
                    value={arqueoObs}
                    onChange={(e) => setArqueoObs(e.target.value)}
                    placeholder="Observaciones del cierre..."
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const res = await postPosAction({
                          action: 'CIERRE_PARCIAL_TURNO',
                          sesion_id: sesionActiva.id,
                          efectivo_contado: totalEfectivoContadoArqueo,
                          datafonos_contados: Number(arqueoDatafonos || 0),
                          transferencias_contadas: Number(arqueoTransf || 0),
                          observaciones: arqueoObs,
                        });
                        if (res?.resumenCuadre) setUltimoResumenCierre(res.resumenCuadre);
                      }}
                      className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Cierre Parcial (Turno)
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const res = await postPosAction({
                          action: 'CIERRE_TOTAL_CAJA',
                          sesion_id: sesionActiva.id,
                          efectivo_contado: totalEfectivoContadoArqueo,
                          datafonos_contados: Number(arqueoDatafonos || 0),
                          transferencias_contadas: Number(arqueoTransf || 0),
                          observaciones: arqueoObs,
                        });
                        if (res?.resumenCuadre) setUltimoResumenCierre(res.resumenCuadre);
                      }}
                      className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                    >
                      Cierre Total del Día (Z)
                    </button>
                  </div>
                </div>
              )}

              {ultimoResumenCierre && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="font-bold text-emerald-900">
                    Resultado {ultimoResumenCierre.tipoCierre} — Cuadre de Caja
                  </div>
                  <div>Efectivo Esperado: $ {formatMoney(ultimoResumenCierre.efectivoEsperado)}</div>
                  <div>Efectivo Contado: $ {formatMoney(ultimoResumenCierre.efectivoContado)}</div>
                  <div>Salidas Caja Menor: $ {formatMoney(ultimoResumenCierre.totalSalidasCaja)}</div>
                  <div
                    className={`font-bold ${
                      ultimoResumenCierre.diferenciaEfectivo === 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    Diferencia: $ {formatMoney(ultimoResumenCierre.diferenciaEfectivo)}
                  </div>
                </div>
              )}
            </div>

            {/* Panel Derecho: Motor Antifraude y Bitácora de Inconsistencias */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Bitácora Antifraude y Detección de Inconsistencias
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Registra automáticamente anulaciones post-comanda/precuenta, aperturas de cajón y descuadres.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
                  {alertas.length} alertas hoy
                </span>
              </div>

              <div className="space-y-2 max-h-[460px] overflow-y-auto">
                {alertas.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Sin alertas de inconsistencias o fraude el día de hoy.
                  </div>
                ) : (
                  alertas.map((al) => (
                    <div
                      key={al.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        al.nivel_riesgo === 'CRITICO'
                          ? 'bg-rose-50 border-rose-300'
                          : al.nivel_riesgo === 'ALTO'
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">{al.tipo_alerta.replace(/_/g, ' ')}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                          {al.nivel_riesgo}
                        </span>
                      </div>
                      <div className="text-slate-700">{al.descripcion}</div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between">
                        <span>
                          {al.caja_nombre} · {al.usuario_cajero}
                        </span>
                        {al.valor_afectado > 0 && (
                          <span className="font-mono font-bold text-rose-700">
                            Impacto: $ {formatMoney(al.valor_afectado)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
