'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { openCashDrawer } from '@/lib/posHardwareBridge';
import type { ClienteCreditoResumen, OperarioPos, PosOrden, PosOrdenItem, PosOrdenPago, ProductoVenta } from './types';

interface PosCheckoutModalProps {
  ordenActiva: PosOrden;
  itemsActivos: PosOrdenItem[];
  productos?: ProductoVenta[];
  operarios: OperarioPos[];
  creditosClientes: ClienteCreditoResumen[];
  habilitaPropinas: boolean;
  busyAction: boolean;
  onClose: () => void;
  onRegistrarPagoParcial?: (
    pago: Omit<PosOrdenPago, 'numero_pago' | 'id' | 'orden_id'>
  ) => Promise<PosOrdenPago | null>;
  onEliminarPagoParcial?: (pagoId: string) => Promise<void>;
  onConfirmarCobro: (payload: {
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
  }) => Promise<void>;
}

const BILLETES = [2000, 5000, 10000, 20000, 50000, 100000, 200000];
const AREAS_CONSUMO = ['Personal Cocina', 'Personal Caja / Servicio', 'Dueño / Gerencia', 'Cortesía / Degustación'] as const;

type FocusZone =
  | 'ITEMS'
  | 'RIGHT_PROPINA'
  | 'RIGHT_METODO'
  | 'RIGHT_EFECTIVO_INPUT'
  | 'RIGHT_BILLETES'
  | 'RIGHT_NOTA'
  | 'FINAL_CONFIRM';

export default function PosCheckoutModal({
  ordenActiva,
  itemsActivos,
  productos = [],
  operarios,
  creditosClientes,
  habilitaPropinas,
  busyAction,
  onClose,
  onRegistrarPagoParcial,
  onEliminarPagoParcial,
  onConfirmarCobro,
}: PosCheckoutModalProps) {
  const [propinaValor, setPropinaValor] = useState(0);
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [metodoPago, setMetodoPago] = useState<
    'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO' | 'MIXTO' | 'CONSUMO_INTERNO'
  >('EFECTIVO');

  // Estado único de cobro (total o parcial)
  const [pagoConEfectivo, setPagoConEfectivo] = useState(0);
  const [mixDat, setMixDat] = useState(0);
  const [mixTrf, setMixTrf] = useState(0);
  const [mixCred, setMixCred] = useState(0);
  const [comisionTarjeta, setComisionTarjeta] = useState(0);
  const [pagoNota, setPagoNota] = useState('');

  // Estado de Consumo Interno / Crédito
  const [clienteCreditoNombre, setClienteCreditoNombre] = useState(ordenActiva.cliente_nombre || '');
  const [clienteCreditoTel, setClienteCreditoTel] = useState(ordenActiva.cliente_telefono || '');
  const [areaConsumo, setAreaConsumo] = useState<string>('Personal Cocina');
  const [consumoNota, setConsumoNota] = useState('');

  // Pagos registrados (inicializado desde BD) y checkboxes de insumos
  const [pagosRegistrados, setPagosRegistrados] = useState<PosOrdenPago[]>(
    () => ordenActiva.pagos_detalle || []
  );
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() => {
    const paidIds = new Set(
      (ordenActiva.pagos_detalle || []).flatMap((p) => (p.items_pagados || []).map((i) => i.item_id))
    );
    return itemsActivos.filter((it) => !paidIds.has(it.id)).map((it) => it.id);
  });
  const [drawerStepReady, setDrawerStepReady] = useState(false);

  // Navegación teclado simplificada
  const [focusZone, setFocusZone] = useState<FocusZone>('ITEMS');
  const [focusedItemIdx, setFocusedItemIdx] = useState(0);
  const [rightBilleteIdx, setRightBilleteIdx] = useState(0);

  const itemRowRefs = useRef<Array<HTMLLabelElement | null>>([]);
  const rightEfInputRef = useRef<HTMLInputElement | null>(null);
  const rightNotaRef = useRef<HTMLInputElement | null>(null);
  const finalConfirmRef = useRef<HTMLButtonElement | null>(null);
  const submittingRef = useRef(false);

  const prodTaxMap = useMemo(() => {
    const map = new Map<string, { impo: number; iva: number }>();
    for (const p of productos) {
      map.set(p.id, {
        impo: Number(p.tarifa_impoconsumo ?? 8),
        iva: Number(p.tarifa_iva ?? 0),
      });
    }
    return map;
  }, [productos]);

  useEffect(() => {
    if (Array.isArray(ordenActiva.pagos_detalle)) {
      setPagosRegistrados(ordenActiva.pagos_detalle);
    }
  }, [ordenActiva.pagos_detalle]);

  const itemPagoMap = useMemo(() => {
    const map = new Map<string, { numero: number; metodo: string }>();
    for (const pg of pagosRegistrados) {
      for (const it of pg.items_pagados || []) {
        map.set(it.item_id, { numero: pg.numero_pago, metodo: pg.metodo_pago });
      }
    }
    return map;
  }, [pagosRegistrados]);

  const itemsPendientes = useMemo(
    () => itemsActivos.filter((it) => !itemPagoMap.has(it.id)),
    [itemsActivos, itemPagoMap]
  );

  // Mantener marcados por defecto todos los insumos pendientes al cambiar los pagos registrados
  useEffect(() => {
    setSelectedItemIds(itemsPendientes.map((it) => it.id));
  }, [itemsPendientes]);

  const esSeleccionParcial =
    selectedItemIds.length > 0 && selectedItemIds.length < itemsPendientes.length;
  const ningunSeleccionado = itemsPendientes.length > 0 && selectedItemIds.length === 0;

  const sumaSeleccionados = useMemo(
    () =>
      itemsActivos
        .filter((it) => selectedItemIds.includes(it.id))
        .reduce((acc, it) => acc + Number(it.subtotal || 0), 0),
    [itemsActivos, selectedItemIds]
  );

  const subtotalPendiente = useMemo(
    () => itemsPendientes.reduce((acc, it) => acc + Number(it.subtotal || 0), 0),
    [itemsPendientes]
  );

  const propinaParcialAcumulada = useMemo(
    () => pagosRegistrados.reduce((acc, p) => acc + Number(p.propina_monto || 0), 0),
    [pagosRegistrados]
  );

  const propinaTotalTicket = propinaParcialAcumulada + propinaValor;

  const totalFinalCobro = useMemo(() => {
    if (metodoPago === 'CONSUMO_INTERNO' && !esSeleccionParcial) {
      return Number(ordenActiva.subtotal_bruto || 0);
    }
    return Math.max(
      0,
      Number(ordenActiva.subtotal_bruto || 0) +
        Number(ordenActiva.costo_domicilio || 0) -
        descuentoValor +
        propinaTotalTicket
    );
  }, [ordenActiva, descuentoValor, propinaTotalTicket, metodoPago, esSeleccionParcial]);

  const totalPagadoMulti = useMemo(
    () => pagosRegistrados.reduce((acc, p) => acc + Number(p.monto_aplicado || 0), 0),
    [pagosRegistrados]
  );

  const faltaPorCobrar = Math.max(0, totalFinalCobro - totalPagadoMulti);

  // Base para calcular % de propina y monto objetivo del panel derecho
  const baseCobroActual = esSeleccionParcial ? sumaSeleccionados : subtotalPendiente;
  const montoACobrarAhora = esSeleccionParcial
    ? sumaSeleccionados + propinaValor
    : faltaPorCobrar;

  // Faltante en modo MIXTO sobre montoACobrarAhora
  const sumaMixNoEfectivo = mixDat + mixTrf + mixCred;
  const faltaMixEfectivo = Math.max(0, montoACobrarAhora - sumaMixNoEfectivo);

  // Al cambiar la selección de insumos o el monto objetivo, actualizar efectivo recibido
  useEffect(() => {
    setPagoConEfectivo(montoACobrarAhora);
    setRightBilleteIdx(0);
  }, [montoACobrarAhora]);

  // Si pasa a selección parcial, resetear propina del cobro actual y método CONSUMO_INTERNO si estaba activo
  useEffect(() => {
    if (esSeleccionParcial && metodoPago === 'CONSUMO_INTERNO') {
      setMetodoPago('EFECTIVO');
    }
  }, [esSeleccionParcial, metodoPago]);

  // Reiniciar paso 2 del botón Cobrar ante cualquier cambio
  useEffect(() => {
    setDrawerStepReady(false);
  }, [
    metodoPago,
    pagoConEfectivo,
    propinaValor,
    descuentoValor,
    pagosRegistrados.length,
    selectedItemIds.length,
    mixDat,
    mixTrf,
    mixCred,
  ]);

  // Enfocar automáticamente según focusZone
  useEffect(() => {
    if (focusZone === 'RIGHT_EFECTIVO_INPUT') {
      setTimeout(() => {
        rightEfInputRef.current?.focus();
        rightEfInputRef.current?.select();
      }, 15);
    } else if (focusZone === 'RIGHT_NOTA') {
      setTimeout(() => rightNotaRef.current?.focus(), 15);
    } else if (focusZone === 'FINAL_CONFIRM') {
      setTimeout(() => finalConfirmRef.current?.focus(), 15);
    } else if (focusZone === 'ITEMS') {
      if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
      }
      itemRowRefs.current[focusedItemIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (focusZone === 'RIGHT_PROPINA' || focusZone === 'RIGHT_METODO' || focusZone === 'RIGHT_BILLETES') {
      if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
      }
    }
  }, [focusZone, focusedItemIdx]);

  const rightEfInsuficiente =
    !(metodoPago === 'CONSUMO_INTERNO' && !esSeleccionParcial && pagosRegistrados.length === 0) &&
    montoACobrarAhora > 0 &&
    ((metodoPago === 'EFECTIVO' && pagoConEfectivo < montoACobrarAhora) ||
      (metodoPago === 'MIXTO' && faltaMixEfectivo > 0 && pagoConEfectivo < faltaMixEfectivo));

  const cambioDirecto =
    metodoPago === 'EFECTIVO'
      ? Math.max(0, pagoConEfectivo - montoACobrarAhora)
      : metodoPago === 'MIXTO'
        ? Math.max(0, (pagoConEfectivo || 0) - faltaMixEfectivo)
        : 0;

  const faltaDirecto =
    metodoPago === 'EFECTIVO'
      ? Math.max(0, montoACobrarAhora - pagoConEfectivo)
      : metodoPago === 'MIXTO'
        ? Math.max(0, faltaMixEfectivo - (pagoConEfectivo || 0))
        : 0;

  const handleCobroParcialSeleccion = useCallback(async () => {
    if (busyAction || submittingRef.current || !esSeleccionParcial || rightEfInsuficiente || montoACobrarAhora <= 0) return;
    submittingRef.current = true;
    try {

    const hayEfectivo =
      metodoPago === 'EFECTIVO' || (metodoPago === 'MIXTO' && faltaMixEfectivo > 0);
    if (hayEfectivo) {
      await openCashDrawer();
    }

    const itemsCovered = itemsActivos
      .filter((it) => selectedItemIds.includes(it.id))
      .map((it) => ({
        item_id: it.id,
        nombre_producto: it.nombre_producto,
        cantidad: Number(it.cantidad || 1),
        subtotal: Number(it.subtotal || 0),
      }));

    const pagosParaRegistrar: Array<Omit<PosOrdenPago, 'numero_pago' | 'id' | 'orden_id'>> = [];

    if (metodoPago === 'MIXTO') {
      if (faltaMixEfectivo > 0) {
        const rec = Math.max(faltaMixEfectivo, pagoConEfectivo || faltaMixEfectivo);
        pagosParaRegistrar.push({
          metodo_pago: 'EFECTIVO',
          monto_aplicado: faltaMixEfectivo,
          monto_recibido: rec,
          cambio_devuelto: Math.max(0, rec - faltaMixEfectivo),
          propina_monto: propinaValor,
          items_pagados: itemsCovered,
          nota: pagoNota.trim() || 'Parcial Mixto Efectivo',
        });
      }
      if (mixDat > 0) {
        pagosParaRegistrar.push({
          metodo_pago: 'DATAFONO',
          monto_aplicado: mixDat,
          monto_recibido: mixDat,
          cambio_devuelto: 0,
          propina_monto: pagosParaRegistrar.length === 0 ? propinaValor : 0,
          items_pagados: pagosParaRegistrar.length === 0 ? itemsCovered : [],
          nota: pagoNota.trim() || 'Parcial Mixto Datáfono',
        });
      }
      if (mixTrf > 0) {
        pagosParaRegistrar.push({
          metodo_pago: 'TRANSFERENCIA',
          monto_aplicado: mixTrf,
          monto_recibido: mixTrf,
          cambio_devuelto: 0,
          propina_monto: pagosParaRegistrar.length === 0 ? propinaValor : 0,
          items_pagados: pagosParaRegistrar.length === 0 ? itemsCovered : [],
          nota: pagoNota.trim() || 'Parcial Mixto Transferencia',
        });
      }
      if (mixCred > 0) {
        pagosParaRegistrar.push({
          metodo_pago: 'CREDITO',
          monto_aplicado: mixCred,
          monto_recibido: mixCred,
          cambio_devuelto: 0,
          propina_monto: pagosParaRegistrar.length === 0 ? propinaValor : 0,
          items_pagados: pagosParaRegistrar.length === 0 ? itemsCovered : [],
          nota: pagoNota.trim() || 'Parcial Mixto Crédito',
        });
      }
    } else {
      const mFinal = metodoPago === 'CONSUMO_INTERNO' ? 'EFECTIVO' : metodoPago;
      const rec = mFinal === 'EFECTIVO' ? Math.max(montoACobrarAhora, pagoConEfectivo) : montoACobrarAhora;
      pagosParaRegistrar.push({
        metodo_pago: mFinal,
        monto_aplicado: montoACobrarAhora,
        monto_recibido: rec,
        cambio_devuelto: mFinal === 'EFECTIVO' ? Math.max(0, rec - montoACobrarAhora) : 0,
        propina_monto: propinaValor,
        items_pagados: itemsCovered,
        nota: pagoNota.trim(),
      });
    }

    for (const pg of pagosParaRegistrar) {
      if (onRegistrarPagoParcial) {
        const saved = await onRegistrarPagoParcial(pg);
        if (saved) {
          setPagosRegistrados((prev) => [...prev, saved]);
        }
      } else {
        setPagosRegistrados((prev) => [
          ...prev,
          { numero_pago: prev.length + 1, ...pg },
        ]);
      }
    }

    setPropinaValor(0);
    setPagoNota('');
    setMixDat(0);
    setMixTrf(0);
    setMixCred(0);
    setFocusZone('ITEMS');
    } finally {
      submittingRef.current = false;
    }
  }, [
    busyAction,
    esSeleccionParcial,
    rightEfInsuficiente,
    montoACobrarAhora,
    metodoPago,
    faltaMixEfectivo,
    itemsActivos,
    selectedItemIds,
    pagoConEfectivo,
    propinaValor,
    pagoNota,
    mixDat,
    mixTrf,
    mixCred,
    onRegistrarPagoParcial,
  ]);

  const handleEliminarPago = async (pg: PosOrdenPago, idx: number) => {
    if (pg.id && onEliminarPagoParcial) {
      await onEliminarPagoParcial(pg.id);
    }
    setPagosRegistrados((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildRemainingPayments = useCallback(
    (startNum: number): PosOrdenPago[] => {
      const monto = faltaPorCobrar;
      if (monto <= 0) return [];
      const pendingItems = itemsPendientes.map((it) => ({
        item_id: it.id,
        nombre_producto: it.nombre_producto,
        cantidad: Number(it.cantidad || 1),
        subtotal: Number(it.subtotal || 0),
      }));

      if (metodoPago === 'MIXTO') {
        const list: PosOrdenPago[] = [];
        let n = startNum;
        if (faltaMixEfectivo > 0) {
          const rec = Math.max(faltaMixEfectivo, pagoConEfectivo || faltaMixEfectivo);
          list.push({
            numero_pago: n++,
            metodo_pago: 'EFECTIVO',
            monto_aplicado: faltaMixEfectivo,
            monto_recibido: rec,
            cambio_devuelto: Math.max(0, rec - faltaMixEfectivo),
            propina_monto: propinaValor,
            items_pagados: list.length === 0 ? pendingItems : [],
            nota: pagoNota.trim() || 'Mixto Efectivo',
          });
        }
        if (mixDat > 0) {
          list.push({
            numero_pago: n++,
            metodo_pago: 'DATAFONO',
            monto_aplicado: mixDat,
            monto_recibido: mixDat,
            cambio_devuelto: 0,
            propina_monto: list.length === 0 ? propinaValor : 0,
            items_pagados: list.length === 0 ? pendingItems : [],
            nota: pagoNota.trim() || 'Mixto Datáfono',
          });
        }
        if (mixTrf > 0) {
          list.push({
            numero_pago: n++,
            metodo_pago: 'TRANSFERENCIA',
            monto_aplicado: mixTrf,
            monto_recibido: mixTrf,
            cambio_devuelto: 0,
            propina_monto: list.length === 0 ? propinaValor : 0,
            items_pagados: list.length === 0 ? pendingItems : [],
            nota: pagoNota.trim() || 'Mixto Transferencia',
          });
        }
        if (mixCred > 0) {
          list.push({
            numero_pago: n++,
            metodo_pago: 'CREDITO',
            monto_aplicado: mixCred,
            monto_recibido: mixCred,
            cambio_devuelto: 0,
            propina_monto: list.length === 0 ? propinaValor : 0,
            items_pagados: list.length === 0 ? pendingItems : [],
            nota: pagoNota.trim() || 'Mixto Crédito',
          });
        }
        return list;
      }

      if (metodoPago === 'CONSUMO_INTERNO') return [];

      const recibido = metodoPago === 'EFECTIVO' ? Math.max(monto, pagoConEfectivo) : monto;
      return [
        {
          numero_pago: startNum,
          metodo_pago: metodoPago,
          monto_aplicado: monto,
          monto_recibido: recibido,
          cambio_devuelto: metodoPago === 'EFECTIVO' ? Math.max(0, recibido - monto) : 0,
          propina_monto: propinaValor,
          items_pagados: pendingItems,
          nota: pagoNota.trim() || (pagosRegistrados.length > 0 ? 'Saldo restante' : ''),
        },
      ];
    },
    [
      faltaPorCobrar,
      itemsPendientes,
      metodoPago,
      faltaMixEfectivo,
      pagoConEfectivo,
      propinaValor,
      pagoNota,
      mixDat,
      mixTrf,
      mixCred,
      pagosRegistrados.length,
    ]
  );

  const handleFinalConfirm = useCallback(async () => {
    if (busyAction || rightEfInsuficiente || ningunSeleccionado) return;

    if (metodoPago === 'CONSUMO_INTERNO' && pagosRegistrados.length === 0) {
      await onConfirmarCobro({
        metodo_pago: 'CONSUMO_INTERNO',
        propina: 0,
        descuento: 0,
        pago_efectivo: 0,
        pago_datafono: 0,
        pago_transferencia: 0,
        pago_credito: 0,
        efectivo_recibido: 0,
        comision_tarjeta: 0,
        cliente_nombre:
          areaConsumo === 'Cortesía / Degustación'
            ? consumoNota.trim() || clienteCreditoNombre.trim()
            : clienteCreditoNombre.trim() || ordenActiva.cliente_nombre || '',
        cliente_telefono: clienteCreditoTel.trim() || ordenActiva.cliente_telefono || '',
        area_consumo: areaConsumo,
        pagos_detalle: [],
      });
      return;
    }

    const extraPagos = faltaPorCobrar > 0 ? buildRemainingPayments(pagosRegistrados.length + 1) : [];
    const todosPagos = [...pagosRegistrados, ...extraPagos];

    const sumEf = todosPagos
      .filter((p) => p.metodo_pago === 'EFECTIVO')
      .reduce((a, b) => a + Number(b.monto_aplicado || 0), 0);
    const sumDat = todosPagos
      .filter((p) => p.metodo_pago === 'DATAFONO')
      .reduce((a, b) => a + Number(b.monto_aplicado || 0), 0);
    const sumTrf = todosPagos
      .filter((p) => p.metodo_pago === 'TRANSFERENCIA')
      .reduce((a, b) => a + Number(b.monto_aplicado || 0), 0);
    const sumCred = todosPagos
      .filter((p) => p.metodo_pago === 'CREDITO')
      .reduce((a, b) => a + Number(b.monto_aplicado || 0), 0);
    const sumEfRec = todosPagos
      .filter((p) => p.metodo_pago === 'EFECTIVO')
      .reduce((a, b) => a + Number(b.monto_recibido || b.monto_aplicado || 0), 0);

    const metodosActivos = [sumEf > 0, sumDat > 0, sumTrf > 0, sumCred > 0].filter(Boolean).length;
    const metodoFinal: 'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO' | 'MIXTO' =
      metodosActivos > 1 || todosPagos.length > 1
        ? 'MIXTO'
        : sumDat > 0
          ? 'DATAFONO'
          : sumTrf > 0
            ? 'TRANSFERENCIA'
            : sumCred > 0
              ? 'CREDITO'
              : 'EFECTIVO';

    await onConfirmarCobro({
      metodo_pago: metodoFinal,
      propina: propinaTotalTicket,
      descuento: descuentoValor,
      pago_efectivo: sumEf,
      pago_datafono: sumDat,
      pago_transferencia: sumTrf,
      pago_credito: sumCred,
      efectivo_recibido: sumEf > 0 ? sumEfRec : totalFinalCobro,
      comision_tarjeta: comisionTarjeta,
      cliente_nombre: clienteCreditoNombre.trim() || ordenActiva.cliente_nombre || '',
      cliente_telefono: clienteCreditoTel.trim() || ordenActiva.cliente_telefono || '',
      area_consumo: areaConsumo,
      pagos_detalle: todosPagos,
    });
  }, [
    busyAction,
    rightEfInsuficiente,
    ningunSeleccionado,
    metodoPago,
    pagosRegistrados,
    faltaPorCobrar,
    buildRemainingPayments,
    onConfirmarCobro,
    areaConsumo,
    consumoNota,
    clienteCreditoNombre,
    clienteCreditoTel,
    ordenActiva.cliente_nombre,
    ordenActiva.cliente_telefono,
    propinaTotalTicket,
    descuentoValor,
    totalFinalCobro,
    comisionTarjeta,
  ]);

  const handlePrimaryRightAction = useCallback(async () => {
    if (busyAction || submittingRef.current || rightEfInsuficiente || ningunSeleccionado) return;
    if (esSeleccionParcial) {
      await handleCobroParcialSeleccion();
      return;
    }
    if (metodoPago === 'CONSUMO_INTERNO' && pagosRegistrados.length === 0) {
      submittingRef.current = true;
      try {
        await handleFinalConfirm();
      } finally {
        submittingRef.current = false;
      }
      return;
    }
    if (!drawerStepReady) {
      const hayEfectivoSaldo =
        metodoPago === 'EFECTIVO' || (metodoPago === 'MIXTO' && faltaMixEfectivo > 0);
      if (hayEfectivoSaldo) {
        await openCashDrawer();
      }
      setDrawerStepReady(true);
      return;
    }
    submittingRef.current = true;
    try {
      await handleFinalConfirm();
    } finally {
      submittingRef.current = false;
    }
  }, [
    busyAction,
    rightEfInsuficiente,
    ningunSeleccionado,
    esSeleccionParcial,
    handleCobroParcialSeleccion,
    metodoPago,
    pagosRegistrados.length,
    drawerStepReady,
    faltaMixEfectivo,
    handleFinalConfirm,
  ]);

  // Navegación con flechas entre lista izquierda y controles únicos derechos
  useEffect(() => {
    const rightMetodos: Array<typeof metodoPago> =
      !esSeleccionParcial && pagosRegistrados.length === 0
        ? ['EFECTIVO', 'DATAFONO', 'TRANSFERENCIA', 'CREDITO', 'MIXTO', 'CONSUMO_INTERNO']
        : ['EFECTIVO', 'DATAFONO', 'TRANSFERENCIA', 'CREDITO', 'MIXTO'];
    const rightBilletesOpts = [
      metodoPago === 'MIXTO' ? faltaMixEfectivo : montoACobrarAhora,
      ...BILLETES,
    ];

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        void handlePrimaryRightAction();
        return;
      }

      if (focusZone === 'ITEMS') {
        if (itemsActivos.length === 0) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedItemIdx((i) => Math.min(itemsActivos.length - 1, i + 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedItemIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === ' ') {
          e.preventDefault();
          const it = itemsActivos[focusedItemIdx];
          if (it && !itemPagoMap.has(it.id)) {
            setSelectedItemIds((prev) =>
              prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]
            );
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusZone(
            habilitaPropinas && metodoPago !== 'CONSUMO_INTERNO' ? 'RIGHT_PROPINA' : 'RIGHT_METODO'
          );
          return;
        }
      }

      if (focusZone === 'RIGHT_PROPINA') {
        const pcts = [0, 0.05, 0.1];
        const curIdx = pcts.findIndex(
          (p) => Math.round(baseCobroActual * p) === propinaValor
        );
        const effIdx = curIdx < 0 ? 0 : curIdx;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (effIdx <= 0) {
            setFocusZone('ITEMS');
          } else {
            setPropinaValor(Math.round(baseCobroActual * pcts[effIdx - 1]));
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIdx = Math.min(pcts.length - 1, effIdx + 1);
          setPropinaValor(Math.round(baseCobroActual * pcts[nextIdx]));
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusZone('RIGHT_METODO');
          return;
        }
      }

      if (focusZone === 'RIGHT_METODO') {
        const curM = rightMetodos.indexOf(metodoPago);
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (curM <= 0) {
            setFocusZone('ITEMS');
          } else {
            setMetodoPago(rightMetodos[curM - 1]);
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextM = Math.min(rightMetodos.length - 1, curM + 1);
          setMetodoPago(rightMetodos[nextM]);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusZone(
            habilitaPropinas && metodoPago !== 'CONSUMO_INTERNO' ? 'RIGHT_PROPINA' : 'ITEMS'
          );
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (metodoPago === 'EFECTIVO' || metodoPago === 'MIXTO') {
            setFocusZone('RIGHT_EFECTIVO_INPUT');
          } else {
            setFocusZone('RIGHT_NOTA');
          }
          return;
        }
      }

      if (focusZone === 'RIGHT_BILLETES') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (rightBilleteIdx <= 0) {
            setFocusZone('ITEMS');
          } else {
            const nextIdx = rightBilleteIdx - 1;
            setRightBilleteIdx(nextIdx);
            setPagoConEfectivo(rightBilletesOpts[nextIdx]);
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIdx = Math.min(rightBilletesOpts.length - 1, rightBilleteIdx + 1);
          setRightBilleteIdx(nextIdx);
          setPagoConEfectivo(rightBilletesOpts[nextIdx]);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusZone('RIGHT_EFECTIVO_INPUT');
          return;
        }
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          setFocusZone('RIGHT_NOTA');
          return;
        }
      }

      if (focusZone === 'FINAL_CONFIRM') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusZone('ITEMS');
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusZone('RIGHT_NOTA');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          void handlePrimaryRightAction();
          return;
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    focusZone,
    focusedItemIdx,
    itemsActivos,
    itemPagoMap,
    esSeleccionParcial,
    rightBilleteIdx,
    habilitaPropinas,
    metodoPago,
    pagosRegistrados.length,
    propinaValor,
    baseCobroActual,
    faltaMixEfectivo,
    montoACobrarAhora,
    onClose,
    handlePrimaryRightAction,
  ]);

  return (
    <div className="fixed inset-0 z-[10000] bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl border border-zinc-300 max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="px-5 py-3.5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-extrabold text-base text-zinc-950">
              F12 — Cobrar / Cerrar {ordenActiva.mesa_numero ? `Mesa ${ordenActiva.mesa_numero}` : ordenActiva.consecutivo}
            </h3>
            <p className="text-[11px] text-zinc-500">
              Todos los insumos vienen marcados para cobro total; desmarca para cobrar solo platos específicos con los controles de la derecha.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo en 2 Columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* COLUMNA IZQUIERDA: Solo lista limpia de insumos */}
          <div
            onClick={() => setFocusZone('ITEMS')}
            className="lg:col-span-6 border-b lg:border-b-0 lg:border-r border-zinc-200 flex flex-col min-h-0 overflow-hidden bg-white"
          >
            <div className="px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-bold text-zinc-800">
                Insumos del Ticket ({itemsActivos.length})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedItemIds(itemsPendientes.map((it) => it.id))}
                  className="px-2.5 py-1 rounded-md bg-white border border-zinc-300 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  Selec. Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemIds([])}
                  className="px-2.5 py-1 rounded-md bg-white border border-zinc-300 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {itemsActivos.map((it, idx) => {
                const sub = Number(it.subtotal || 0);
                const taxInfo = it.producto_id ? prodTaxMap.get(it.producto_id) : undefined;
                const tarifa =
                  it.tarifa_impuesto !== undefined && it.tarifa_impuesto !== null
                    ? Number(it.tarifa_impuesto)
                    : taxInfo
                      ? taxInfo.impo + taxInfo.iva
                      : 8;
                const base = tarifa > 0 ? Math.round(sub / (1 + tarifa / 100)) : sub;
                const impo = sub - base;
                const taxLabel =
                  tarifa === 0
                    ? 'Exento (0%)'
                    : taxInfo && taxInfo.iva > 0 && taxInfo.impo === 0
                      ? `IVA (${tarifa}%)`
                      : `Impoconsumo (${tarifa}%)`;
                const pagoInfo = itemPagoMap.get(it.id);
                const checked = selectedItemIds.includes(it.id);
                const isFocused = focusZone === 'ITEMS' && focusedItemIdx === idx;

                return (
                  <label
                    key={it.id}
                    ref={(el) => {
                      itemRowRefs.current[idx] = el;
                    }}
                    onClick={() => {
                      setFocusedItemIdx(idx);
                      setFocusZone('ITEMS');
                    }}
                    className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition ${
                      pagoInfo
                        ? 'bg-emerald-50/60 opacity-80'
                        : checked
                          ? 'bg-blue-50/90'
                          : isFocused
                            ? 'bg-zinc-100 ring-1 ring-inset ring-blue-400'
                            : 'hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        disabled={Boolean(pagoInfo)}
                        checked={checked || Boolean(pagoInfo)}
                        onChange={() => {
                          if (pagoInfo) return;
                          setSelectedItemIds((prev) =>
                            prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]
                          );
                        }}
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-zinc-900 truncate">
                          {it.cantidad}x {it.nombre_producto}
                        </div>
                        <div className="text-[11px] text-zinc-500 tabular-nums">
                          Base: {formatMoney(base)} · {taxLabel}: {formatMoney(impo)}
                        </div>
                        {pagoInfo && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Pagado · Pago #{pagoInfo.numero} ({pagoInfo.metodo})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-extrabold text-sm tabular-nums text-zinc-950 shrink-0">
                      {formatMoney(sub)}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* COLUMNA DERECHA: Controles Únicos (Total o Selección Parcial) */}
          <div className="lg:col-span-6 p-4 overflow-y-auto space-y-3">
            {/* Cuadre en Vivo */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-zinc-100 border border-zinc-200">
                <div className="text-zinc-500">Total Ticket</div>
                <div className="text-base font-extrabold tabular-nums text-zinc-950">
                  {metodoPago === 'CONSUMO_INTERNO' && !esSeleccionParcial ? '$0' : formatMoney(totalFinalCobro)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-emerald-700">Pagado Parcial</div>
                <div className="text-base font-extrabold tabular-nums text-emerald-800">
                  {formatMoney(totalPagadoMulti)}
                </div>
              </div>
              <div
                className={`p-2.5 rounded-xl border ${
                  faltaPorCobrar === 0 && pagosRegistrados.length > 0
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div>Falta por Cobrar</div>
                <div className="text-base font-extrabold tabular-nums">
                  {metodoPago === 'CONSUMO_INTERNO' && !esSeleccionParcial ? '$0' : formatMoney(faltaPorCobrar)}
                </div>
              </div>
            </div>

            {/* Sumatoria destacada cuando solo hay algunos insumos marcados */}
            {esSeleccionParcial && (
              <div className="px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                <span className="font-bold text-blue-950">
                  Insumos seleccionados ({selectedItemIds.length} de {itemsPendientes.length}):
                </span>
                <span className="font-extrabold text-base tabular-nums text-blue-900">
                  {formatMoney(sumaSeleccionados)}
                  {propinaValor > 0 ? ` + ${formatMoney(propinaValor)} prop. = ${formatMoney(montoACobrarAhora)}` : ''}
                </span>
              </div>
            )}

            {ningunSeleccionado && (
              <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
                Marca uno o más insumos a la izquierda para registrar un cobro parcial o total.
              </div>
            )}

            {/* Propina estilo compacto container azul */}
            {habilitaPropinas && !(metodoPago === 'CONSUMO_INTERNO' && !esSeleccionParcial) && (
              <div className="space-y-1">
                <div
                  className={`bg-blue-50/60 border border-blue-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs transition ${
                    focusZone === 'RIGHT_PROPINA' ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <span className="font-semibold text-zinc-700">
                    {esSeleccionParcial ? 'Propina cobro:' : 'Propina:'}
                  </span>
                  <div className="flex items-center gap-1">
                    {[0, 0.05, 0.1].map((pct) => {
                      const valPct = Math.round(baseCobroActual * pct);
                      const isAct = propinaValor === valPct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setPropinaValor(valPct);
                            setFocusZone('RIGHT_PROPINA');
                          }}
                          className={`px-2.5 py-1 rounded border text-[11px] font-bold cursor-pointer ${
                            isAct
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-700'
                          }`}
                        >
                          {pct * 100}%
                        </button>
                      );
                    })}
                    <input
                      type="number"
                      value={propinaValor || ''}
                      onChange={(e) => setPropinaValor(Math.max(0, Number(e.target.value || 0)))}
                      placeholder="$0"
                      className="w-24 px-2 py-1 border border-zinc-300 rounded-md text-xs font-bold tabular-nums text-right bg-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                {propinaParcialAcumulada > 0 && (
                  <div className="text-[11px] text-emerald-700 font-semibold px-1 tabular-nums">
                    Propinas en abonos: {formatMoney(propinaParcialAcumulada)} · Total propina mesa: {formatMoney(propinaTotalTicket)}
                  </div>
                )}
              </div>
            )}

            {/* Descuento Global compacto (en cobro completo) */}
            {!esSeleccionParcial && metodoPago !== 'CONSUMO_INTERNO' && (
              <div className="flex items-center justify-between gap-2 text-xs px-1">
                <label className="font-semibold text-zinc-700">Descuento Global ($):</label>
                <input
                  type="number"
                  value={descuentoValor || ''}
                  onChange={(e) => setDescuentoValor(Math.max(0, Number(e.target.value || 0)))}
                  placeholder="0"
                  className="w-32 px-2.5 py-1 border border-zinc-300 rounded-lg text-xs font-bold tabular-nums text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            )}

            {/* Lista de Pagos Registrados */}
            {pagosRegistrados.length > 0 && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-zinc-800">
                  Transacciones Registradas en este Ticket ({pagosRegistrados.length})
                </div>
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {pagosRegistrados.map((pg, idx) => (
                    <div
                      key={pg.id || idx}
                      className="px-3 py-2 rounded-lg bg-white border border-zinc-200 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-zinc-900">
                          Pago #{pg.numero_pago} · {pg.metodo_pago}
                        </span>
                        {pg.nota && <span className="ml-1.5 text-zinc-500">({pg.nota})</span>}
                        {Number(pg.propina_monto || 0) > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Propina +{formatMoney(pg.propina_monto || 0)}
                          </span>
                        )}
                        {pg.metodo_pago === 'EFECTIVO' && (
                          <span className="ml-2 text-blue-700 font-semibold">
                            Pagó {formatMoney(pg.monto_recibido)} · Devuelta {formatMoney(pg.cambio_devuelto)}
                          </span>
                        )}
                        {pg.items_pagados && pg.items_pagados.length > 0 && (
                          <div className="text-[11px] text-zinc-500 truncate">
                            {pg.items_pagados.map((i) => `${i.cantidad}x ${i.nombre_producto}`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-extrabold tabular-nums">{formatMoney(pg.monto_aplicado)}</span>
                        <button
                          type="button"
                          onClick={() => void handleEliminarPago(pg, idx)}
                          className="p-1 text-zinc-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Controles Únicos de Pago */}
            {(pagosRegistrados.length === 0 || faltaPorCobrar > 0) && (
              <>
                <div
                  className={`grid ${
                    !esSeleccionParcial && pagosRegistrados.length === 0
                      ? 'grid-cols-3 sm:grid-cols-6'
                      : 'grid-cols-5'
                  } gap-1 bg-zinc-100 p-1 rounded-xl border transition ${
                    focusZone === 'RIGHT_METODO' ? 'ring-2 ring-blue-500 border-blue-400' : 'border-zinc-200'
                  }`}
                >
                  {(
                    [
                      { id: 'EFECTIVO' as const, label: 'EFECTIVO' },
                      { id: 'DATAFONO' as const, label: 'DATÁFONO' },
                      { id: 'TRANSFERENCIA' as const, label: 'TRANSF.' },
                      { id: 'CREDITO' as const, label: 'CRÉDITO' },
                      { id: 'MIXTO' as const, label: 'MIXTO' },
                      ...(!esSeleccionParcial && pagosRegistrados.length === 0
                        ? [{ id: 'CONSUMO_INTERNO' as const, label: 'CONSUMO' }]
                        : []),
                    ]
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetodoPago(m.id)}
                      className={`py-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                        metodoPago === m.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {(metodoPago === 'EFECTIVO' || metodoPago === 'MIXTO') && (
                  <div
                    className={`bg-zinc-50 border rounded-xl p-3 space-y-2.5 text-xs transition ${
                      focusZone === 'RIGHT_EFECTIVO_INPUT' || focusZone === 'RIGHT_BILLETES'
                        ? 'border-blue-400 ring-2 ring-blue-500/40'
                        : 'border-zinc-200'
                    }`}
                  >
                    {metodoPago === 'MIXTO' && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="font-semibold text-zinc-700">Datáfono</label>
                            <input
                              type="number"
                              value={mixDat}
                              onChange={(e) => setMixDat(Number(e.target.value || 0))}
                              className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg font-bold mt-1 bg-white"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-zinc-700">Transferencia</label>
                            <input
                              type="number"
                              value={mixTrf}
                              onChange={(e) => setMixTrf(Number(e.target.value || 0))}
                              className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg font-bold mt-1 bg-white"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-zinc-700">Crédito</label>
                            <input
                              type="number"
                              value={mixCred}
                              onChange={(e) => setMixCred(Number(e.target.value || 0))}
                              className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg font-bold mt-1 bg-white"
                            />
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between font-bold text-amber-950">
                          <span>Falta para completar en Efectivo:</span>
                          <span className="text-sm tabular-nums">{formatMoney(faltaMixEfectivo)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between font-semibold text-zinc-700">
                      <span>Dinero entregado ($):</span>
                      {faltaDirecto > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold tabular-nums">
                          Falta: {formatMoney(faltaDirecto)}
                        </span>
                      ) : cambioDirecto === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold tabular-nums">
                          Exacto · Devolver: $0
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold tabular-nums">
                          Devolver: {formatMoney(cambioDirecto)}
                        </span>
                      )}
                    </div>
                    <input
                      ref={rightEfInputRef}
                      type="number"
                      value={pagoConEfectivo || ''}
                      onFocus={() => setFocusZone('RIGHT_EFECTIVO_INPUT')}
                      onChange={(e) => {
                        setPagoConEfectivo(Number(e.target.value || 0));
                        setRightBilleteIdx(-1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setFocusZone('RIGHT_METODO');
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setFocusZone('RIGHT_BILLETES');
                        } else if (e.key === 'ArrowLeft') {
                          const input = e.currentTarget;
                          if ((input.selectionStart ?? 0) === 0) {
                            e.preventDefault();
                            setFocusZone('ITEMS');
                          }
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          setFocusZone('FINAL_CONFIRM');
                        }
                      }}
                      placeholder="Ingresa monto entregado..."
                      className="w-full px-3 py-2 bg-white border border-zinc-300 focus:border-blue-600 rounded-xl text-lg font-extrabold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <div
                      className={`flex gap-1.5 flex-wrap p-1 rounded-lg ${
                        focusZone === 'RIGHT_BILLETES' ? 'ring-2 ring-blue-500 bg-blue-50/60' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPagoConEfectivo(metodoPago === 'MIXTO' ? faltaMixEfectivo : montoACobrarAhora);
                          setRightBilleteIdx(0);
                          setFocusZone('RIGHT_BILLETES');
                        }}
                        className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${
                          (focusZone === 'RIGHT_BILLETES' && rightBilleteIdx === 0) ||
                          pagoConEfectivo === (metodoPago === 'MIXTO' ? faltaMixEfectivo : montoACobrarAhora)
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-800'
                        }`}
                      >
                        Exacto
                      </button>
                      {BILLETES.map((b, bIdx) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setPagoConEfectivo(b);
                            setRightBilleteIdx(bIdx + 1);
                            setFocusZone('RIGHT_BILLETES');
                          }}
                          className={`px-3 py-1.5 rounded-lg border font-bold tabular-nums cursor-pointer ${
                            (focusZone === 'RIGHT_BILLETES' && rightBilleteIdx === bIdx + 1) ||
                            pagoConEfectivo === b
                              ? 'bg-zinc-900 text-white border-zinc-900'
                              : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-800'
                          }`}
                        >
                          {formatMoney(b)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {metodoPago === 'DATAFONO' && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs">
                    <label className="font-semibold text-zinc-700 block mb-1">
                      Comisión Bancaria Datáfono (opcional $)
                    </label>
                    <input
                      type="number"
                      value={comisionTarjeta}
                      onChange={(e) => setComisionTarjeta(Number(e.target.value || 0))}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg font-bold"
                    />
                  </div>
                )}

                {(metodoPago === 'CREDITO' || (metodoPago === 'MIXTO' && mixCred > 0)) && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2 text-xs">
                    <div className="font-bold text-zinc-800">Cliente para Cargo a Crédito</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={clienteCreditoNombre}
                        onChange={(e) => setClienteCreditoNombre(e.target.value)}
                        placeholder="Nombre del cliente"
                        list="clientes-credito-list-modal"
                        className="px-3 py-2 bg-white border border-zinc-300 rounded-lg font-semibold"
                      />
                      <datalist id="clientes-credito-list-modal">
                        {creditosClientes.map((c) => (
                          <option key={c.cliente_nombre} value={c.cliente_nombre} />
                        ))}
                      </datalist>
                      <input
                        type="text"
                        value={clienteCreditoTel}
                        onChange={(e) => setClienteCreditoTel(e.target.value)}
                        placeholder="Teléfono (opcional)"
                        className="px-3 py-2 bg-white border border-zinc-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {metodoPago === 'CONSUMO_INTERNO' && !esSeleccionParcial && pagosRegistrados.length === 0 && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2.5 text-xs">
                    <div className="font-bold text-zinc-900">
                      Consumo Interno — Selecciona Cargo / Área ($0 Caja)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {AREAS_CONSUMO.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => {
                            setAreaConsumo(area);
                            setClienteCreditoNombre('');
                            setConsumoNota('');
                          }}
                          className={`py-2 px-2.5 rounded-xl border font-bold text-left cursor-pointer ${
                            areaConsumo === area
                              ? 'bg-zinc-900 text-white border-zinc-900'
                              : 'bg-white text-zinc-700 border-zinc-300'
                          }`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                    {areaConsumo === 'Cortesía / Degustación' ? (
                      <textarea
                        rows={3}
                        value={consumoNota}
                        onChange={(e) => setConsumoNota(e.target.value)}
                        placeholder="Ej: Cortesía visita ingenieros / degustación..."
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs"
                      />
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
                        {operarios
                          .filter((op) => op.cargo_area === areaConsumo)
                          .map((op) => (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => setClienteCreditoNombre(op.nombre_cajero)}
                              className={`p-2 rounded-xl border text-left cursor-pointer ${
                                clienteCreditoNombre === op.nombre_cajero
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-zinc-800 border-zinc-300'
                              }`}
                            >
                              <div className="font-bold truncate">{op.nombre_cajero}</div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Observación / Persona (aplica a cobro parcial o saldo final) */}
                {!(metodoPago === 'CONSUMO_INTERNO' && !esSeleccionParcial) && (
                  <input
                    ref={rightNotaRef}
                    type="text"
                    value={pagoNota}
                    onFocus={() => setFocusZone('RIGHT_NOTA')}
                    onChange={(e) => setPagoNota(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setFocusZone(
                          metodoPago === 'EFECTIVO' || metodoPago === 'MIXTO'
                            ? 'RIGHT_BILLETES'
                            : 'RIGHT_METODO'
                        );
                      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                        e.preventDefault();
                        setFocusZone('FINAL_CONFIRM');
                      }
                    }}
                    placeholder="Observación / Persona (opcional)"
                    className={`w-full px-3 py-2 border rounded-xl text-xs bg-white outline-none transition ${
                      focusZone === 'RIGHT_NOTA'
                        ? 'border-blue-600 ring-2 ring-blue-500/40'
                        : 'border-zinc-300 focus:border-blue-600'
                    }`}
                  />
                )}
              </>
            )}

            <button
              ref={finalConfirmRef}
              type="button"
              disabled={busyAction || rightEfInsuficiente || ningunSeleccionado}
              onClick={() => void handlePrimaryRightAction()}
              className={`w-full py-3.5 rounded-xl disabled:opacity-45 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition ${
                esSeleccionParcial
                  ? 'bg-zinc-900 hover:bg-zinc-800'
                  : drawerStepReady
                    ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-300'
                    : 'bg-emerald-600 hover:bg-emerald-700'
              } ${focusZone === 'FINAL_CONFIRM' ? 'ring-4 ring-blue-300' : ''}`}
            >
              {esSeleccionParcial ? <Plus className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {ningunSeleccionado
                ? 'Selecciona al menos 1 insumo a la izquierda'
                : rightEfInsuficiente
                  ? `Falta ${formatMoney(faltaDirecto)} en efectivo`
                  : esSeleccionParcial
                    ? `Cobro Parcial (${formatMoney(montoACobrarAhora)})`
                    : metodoPago === 'CONSUMO_INTERNO' && pagosRegistrados.length === 0
                      ? 'Registrar Consumo Interno ($0 Caja)'
                      : drawerStepReady
                        ? 'Confirmar Pago e Imprimir Ticket (Enter)'
                        : pagosRegistrados.length > 0 && faltaPorCobrar > 0
                          ? `Cobrar Saldo (${formatMoney(faltaPorCobrar)})`
                          : 'Cobrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
