'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { openCashDrawer } from '@/lib/posHardwareBridge';
import type { ClienteCreditoResumen, OperarioPos, PosOrden, PosOrdenItem, PosOrdenPago } from './types';

interface PosCheckoutModalProps {
  ordenActiva: PosOrden;
  itemsActivos: PosOrdenItem[];
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
const PARTIAL_METODOS = ['EFECTIVO', 'DATAFONO', 'TRANSFERENCIA', 'CREDITO'] as const;
const AREAS_CONSUMO = ['Personal Cocina', 'Personal Caja / Servicio', 'Dueño / Gerencia', 'Cortesía / Degustación'] as const;

type FocusZone =
  | 'ITEMS'
  | 'PARTIAL_METODO'
  | 'PARTIAL_EFECTIVO_INPUT'
  | 'PARTIAL_BILLETES'
  | 'PARTIAL_NOTA'
  | 'PARTIAL_CONFIRM'
  | 'RIGHT_PROPINA'
  | 'RIGHT_METODO'
  | 'RIGHT_EFECTIVO_INPUT'
  | 'RIGHT_BILLETES'
  | 'FINAL_CONFIRM';

export default function PosCheckoutModal({
  ordenActiva,
  itemsActivos,
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

  // Estado de cobro directo / saldo restante / mixto
  const [pagoConEfectivo, setPagoConEfectivo] = useState(0);
  const [mixDat, setMixDat] = useState(0);
  const [mixTrf, setMixTrf] = useState(0);
  const [mixCred, setMixCred] = useState(0);
  const [comisionTarjeta, setComisionTarjeta] = useState(0);

  // Estado de Consumo Interno / Crédito
  const [clienteCreditoNombre, setClienteCreditoNombre] = useState(ordenActiva.cliente_nombre || '');
  const [clienteCreditoTel, setClienteCreditoTel] = useState(ordenActiva.cliente_telefono || '');
  const [areaConsumo, setAreaConsumo] = useState<string>('Personal Cocina');
  const [consumoNota, setConsumoNota] = useState('');

  // División por insumos y múltiples transacciones (inicializado con pagos persistidos en BD)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [pagosRegistrados, setPagosRegistrados] = useState<PosOrdenPago[]>(
    () => ordenActiva.pagos_detalle || []
  );
  const [pagoParcialMetodo, setPagoParcialMetodo] =
    useState<'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO'>('EFECTIVO');
  const [pagoParcialPropina, setPagoParcialPropina] = useState(0);
  const [pagoParcialMonto, setPagoParcialMonto] = useState(0);
  const [pagoParcialRecibido, setPagoParcialRecibido] = useState(0);
  const [pagoParcialNota, setPagoParcialNota] = useState('');
  const [drawerStepReady, setDrawerStepReady] = useState(false);

  // Navegación teclado continua con flechas
  const [focusZone, setFocusZone] = useState<FocusZone>('ITEMS');
  const [focusedItemIdx, setFocusedItemIdx] = useState(0);
  const [partialBilleteIdx, setPartialBilleteIdx] = useState(0);
  const [rightBilleteIdx, setRightBilleteIdx] = useState(0);

  const itemRowRefs = useRef<Array<HTMLLabelElement | null>>([]);
  const partialEfInputRef = useRef<HTMLInputElement | null>(null);
  const partialNotaRef = useRef<HTMLInputElement | null>(null);
  const partialConfirmRef = useRef<HTMLButtonElement | null>(null);
  const rightEfInputRef = useRef<HTMLInputElement | null>(null);
  const finalConfirmRef = useRef<HTMLButtonElement | null>(null);

  // Sincronizar pagos si ordenActiva.pagos_detalle cambia externamente
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

  const propinaParcialAcumulada = useMemo(
    () => pagosRegistrados.reduce((acc, p) => acc + Number(p.propina_monto || 0), 0),
    [pagosRegistrados]
  );

  const propinaTotalTicket = propinaParcialAcumulada + propinaValor;

  const totalFinalCobro = useMemo(() => {
    if (metodoPago === 'CONSUMO_INTERNO') return Number(ordenActiva.subtotal_bruto || 0);
    return Math.max(
      0,
      Number(ordenActiva.subtotal_bruto || 0) +
        Number(ordenActiva.costo_domicilio || 0) -
        descuentoValor +
        propinaTotalTicket
    );
  }, [ordenActiva, descuentoValor, propinaTotalTicket, metodoPago]);

  const subtotalPendiente = useMemo(
    () =>
      itemsActivos
        .filter((it) => !itemPagoMap.has(it.id))
        .reduce((acc, it) => acc + Number(it.subtotal || 0), 0),
    [itemsActivos, itemPagoMap]
  );

  const totalPagadoMulti = useMemo(
    () => pagosRegistrados.reduce((acc, p) => acc + Number(p.monto_aplicado || 0), 0),
    [pagosRegistrados]
  );

  const faltaPorCobrar = Math.max(0, totalFinalCobro - totalPagadoMulti);
  const montoObjetivoDerecha = pagosRegistrados.length > 0 ? faltaPorCobrar : totalFinalCobro;

  const sumaSeleccionados = useMemo(
    () =>
      itemsActivos
        .filter((it) => selectedItemIds.includes(it.id))
        .reduce((acc, it) => acc + Number(it.subtotal || 0), 0),
    [itemsActivos, selectedItemIds]
  );

  // Faltante en modo MIXTO sobre el monto objetivo de la derecha
  const sumaMixNoEfectivo = mixDat + mixTrf + mixCred;
  const faltaMixEfectivo = Math.max(0, montoObjetivoDerecha - sumaMixNoEfectivo);

  useEffect(() => {
    setPagoConEfectivo(montoObjetivoDerecha);
  }, [montoObjetivoDerecha]);

  useEffect(() => {
    setDrawerStepReady(false);
  }, [
    metodoPago,
    pagoConEfectivo,
    propinaValor,
    descuentoValor,
    pagosRegistrados.length,
    mixDat,
    mixTrf,
    mixCred,
  ]);

  useEffect(() => {
    setPagoParcialPropina(0);
  }, [selectedItemIds]);

  useEffect(() => {
    if (selectedItemIds.length > 0) {
      const totalConProp = sumaSeleccionados + pagoParcialPropina;
      setPagoParcialMonto(totalConProp);
      setPagoParcialRecibido(totalConProp);
      setPartialBilleteIdx(0);
    } else {
      setPagoParcialMonto(faltaPorCobrar);
      setPagoParcialRecibido(faltaPorCobrar);
    }
  }, [selectedItemIds, sumaSeleccionados, pagoParcialPropina, faltaPorCobrar]);

  // Enfocar inputs/botones automáticamente según focusZone
  useEffect(() => {
    if (focusZone === 'PARTIAL_EFECTIVO_INPUT') {
      setTimeout(() => {
        partialEfInputRef.current?.focus();
        partialEfInputRef.current?.select();
      }, 15);
    } else if (focusZone === 'PARTIAL_NOTA') {
      setTimeout(() => partialNotaRef.current?.focus(), 15);
    } else if (focusZone === 'PARTIAL_CONFIRM') {
      setTimeout(() => partialConfirmRef.current?.focus(), 15);
    } else if (focusZone === 'RIGHT_EFECTIVO_INPUT') {
      setTimeout(() => {
        rightEfInputRef.current?.focus();
        rightEfInputRef.current?.select();
      }, 15);
    } else if (focusZone === 'FINAL_CONFIRM') {
      setTimeout(() => finalConfirmRef.current?.focus(), 15);
    } else if (focusZone === 'ITEMS') {
      if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
      }
      itemRowRefs.current[focusedItemIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (
      focusZone === 'RIGHT_PROPINA' ||
      focusZone === 'RIGHT_METODO' ||
      focusZone === 'RIGHT_BILLETES'
    ) {
      if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
      }
    }
  }, [focusZone, focusedItemIdx]);

  const partialEfInsuficiente =
    pagoParcialMetodo === 'EFECTIVO' && pagoParcialRecibido < pagoParcialMonto;
  const partialCambio = Math.max(0, pagoParcialRecibido - pagoParcialMonto);
  const partialFalta = Math.max(0, pagoParcialMonto - pagoParcialRecibido);

  const handleAgregarTransaccion = useCallback(async () => {
    const montoAplicado = Math.min(
      faltaPorCobrar || totalFinalCobro,
      Math.max(0, Number(pagoParcialMonto || 0))
    );
    if (montoAplicado <= 0) return;
    if (pagoParcialMetodo === 'EFECTIVO' && pagoParcialRecibido < montoAplicado) return;

    const recibido =
      pagoParcialMetodo === 'EFECTIVO'
        ? Number(pagoParcialRecibido || montoAplicado)
        : montoAplicado;
    const cambio = pagoParcialMetodo === 'EFECTIVO' ? Math.max(0, recibido - montoAplicado) : 0;

    const itemsCovered = itemsActivos
      .filter((it) => selectedItemIds.includes(it.id))
      .map((it) => ({
        item_id: it.id,
        nombre_producto: it.nombre_producto,
        cantidad: Number(it.cantidad || 1),
        subtotal: Number(it.subtotal || 0),
      }));

    const payloadBase: Omit<PosOrdenPago, 'numero_pago' | 'id' | 'orden_id'> = {
      metodo_pago: pagoParcialMetodo,
      monto_aplicado: montoAplicado,
      monto_recibido: recibido,
      cambio_devuelto: cambio,
      propina_monto: pagoParcialPropina,
      items_pagados: itemsCovered,
      nota: pagoParcialNota.trim(),
    };

    if (pagoParcialMetodo === 'EFECTIVO') {
      await openCashDrawer();
    }

    if (onRegistrarPagoParcial) {
      const saved = await onRegistrarPagoParcial(payloadBase);
      if (saved) {
        setPagosRegistrados((prev) => [...prev, saved]);
      }
    } else {
      const nuevoPago: PosOrdenPago = {
        numero_pago: pagosRegistrados.length + 1,
        ...payloadBase,
      };
      setPagosRegistrados((prev) => [...prev, nuevoPago]);
    }

    const coveredSet = new Set(itemsCovered.map((i) => i.item_id));
    const nextPendingIdx = itemsActivos.findIndex(
      (it) => !itemPagoMap.has(it.id) && !coveredSet.has(it.id)
    );

    setSelectedItemIds([]);
    setPagoParcialPropina(0);
    setPagoParcialNota('');
    if (nextPendingIdx >= 0) {
      setFocusedItemIdx(nextPendingIdx);
      setFocusZone('ITEMS');
    } else {
      setFocusZone('FINAL_CONFIRM');
    }
  }, [
    faltaPorCobrar,
    totalFinalCobro,
    pagoParcialMonto,
    pagoParcialMetodo,
    pagoParcialRecibido,
    pagoParcialPropina,
    itemsActivos,
    selectedItemIds,
    pagoParcialNota,
    onRegistrarPagoParcial,
    pagosRegistrados.length,
    itemPagoMap,
  ]);

  const handleEliminarPago = async (pg: PosOrdenPago, idx: number) => {
    if (pg.id && onEliminarPagoParcial) {
      await onEliminarPagoParcial(pg.id);
    }
    setPagosRegistrados((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildRemainingPayments = useCallback(
    (startNum: number): PosOrdenPago[] => {
      const monto = montoObjetivoDerecha;
      if (monto <= 0) return [];
      const pendingItems = itemsActivos
        .filter((it) => !itemPagoMap.has(it.id))
        .map((it) => ({
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
            items_pagados: list.length === 0 ? pendingItems : [],
            nota: 'Mixto Efectivo',
          });
        }
        if (mixDat > 0) {
          list.push({
            numero_pago: n++,
            metodo_pago: 'DATAFONO',
            monto_aplicado: mixDat,
            monto_recibido: mixDat,
            cambio_devuelto: 0,
            items_pagados: list.length === 0 ? pendingItems : [],
            nota: 'Mixto Datáfono',
          });
        }
        if (mixTrf > 0) {
          list.push({
            numero_pago: n++,
            metodo_pago: 'TRANSFERENCIA',
            monto_aplicado: mixTrf,
            monto_recibido: mixTrf,
            cambio_devuelto: 0,
            items_pagados: list.length === 0 ? pendingItems : [],
            nota: 'Mixto Transferencia',
          });
        }
        if (mixCred > 0) {
          list.push({
            numero_pago: n++,
            metodo_pago: 'CREDITO',
            monto_aplicado: mixCred,
            monto_recibido: mixCred,
            cambio_devuelto: 0,
            items_pagados: list.length === 0 ? pendingItems : [],
            nota: 'Mixto Crédito',
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
          items_pagados: pendingItems,
          nota: pagosRegistrados.length > 0 ? 'Saldo restante' : '',
        },
      ];
    },
    [
      montoObjetivoDerecha,
      itemsActivos,
      itemPagoMap,
      metodoPago,
      faltaMixEfectivo,
      pagoConEfectivo,
      mixDat,
      mixTrf,
      mixCred,
      pagosRegistrados.length,
    ]
  );

  const rightEfInsuficiente =
    metodoPago !== 'CONSUMO_INTERNO' &&
    montoObjetivoDerecha > 0 &&
    ((metodoPago === 'EFECTIVO' && pagoConEfectivo < montoObjetivoDerecha) ||
      (metodoPago === 'MIXTO' && faltaMixEfectivo > 0 && pagoConEfectivo < faltaMixEfectivo));

  const handleFinalConfirm = useCallback(async () => {
    if (busyAction || rightEfInsuficiente) return;

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
    const metodoFinal:
      | 'EFECTIVO'
      | 'DATAFONO'
      | 'TRANSFERENCIA'
      | 'CREDITO'
      | 'MIXTO' =
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
    if (busyAction || rightEfInsuficiente) return;
    if (metodoPago === 'CONSUMO_INTERNO' && pagosRegistrados.length === 0) {
      await handleFinalConfirm();
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
    await handleFinalConfirm();
  }, [
    busyAction,
    rightEfInsuficiente,
    metodoPago,
    pagosRegistrados.length,
    drawerStepReady,
    faltaMixEfectivo,
    handleFinalConfirm,
  ]);

  // Navegación continua con teclas de flecha
  useEffect(() => {
    const partialBilletesOpts = [pagoParcialMonto, ...BILLETES];

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
          if (focusedItemIdx < itemsActivos.length - 1) {
            setFocusedItemIdx((i) => i + 1);
          } else if (selectedItemIds.length > 0) {
            setFocusZone('PARTIAL_METODO');
          }
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

      if (focusZone === 'PARTIAL_METODO' || focusZone === 'PARTIAL_CONFIRM') {
        if (e.key === 'ArrowRight' && focusZone === 'PARTIAL_CONFIRM') {
          e.preventDefault();
          setFocusZone(
            habilitaPropinas && metodoPago !== 'CONSUMO_INTERNO' ? 'RIGHT_PROPINA' : 'RIGHT_METODO'
          );
          return;
        }
      }

      if (focusZone === 'PARTIAL_METODO') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const cur = PARTIAL_METODOS.indexOf(pagoParcialMetodo);
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          setPagoParcialMetodo(
            PARTIAL_METODOS[(cur + dir + PARTIAL_METODOS.length) % PARTIAL_METODOS.length]
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusZone('ITEMS');
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusZone(pagoParcialMetodo === 'EFECTIVO' ? 'PARTIAL_EFECTIVO_INPUT' : 'PARTIAL_NOTA');
          return;
        }
      }

      if (focusZone === 'PARTIAL_BILLETES') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          const nextIdx =
            (partialBilleteIdx + dir + partialBilletesOpts.length) % partialBilletesOpts.length;
          setPartialBilleteIdx(nextIdx);
          setPagoParcialRecibido(partialBilletesOpts[nextIdx]);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusZone('PARTIAL_EFECTIVO_INPUT');
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusZone('PARTIAL_NOTA');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          setFocusZone('PARTIAL_CONFIRM');
          return;
        }
      }

      if (focusZone === 'PARTIAL_CONFIRM') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusZone('PARTIAL_NOTA');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleAgregarTransaccion();
          return;
        }
      }

      const rightMetodos: Array<typeof metodoPago> =
        pagosRegistrados.length === 0
          ? ['EFECTIVO', 'DATAFONO', 'TRANSFERENCIA', 'CREDITO', 'MIXTO', 'CONSUMO_INTERNO']
          : ['EFECTIVO', 'DATAFONO', 'TRANSFERENCIA', 'CREDITO', 'MIXTO'];
      const rightBilletesOpts = [
        metodoPago === 'MIXTO' ? faltaMixEfectivo : montoObjetivoDerecha,
        ...BILLETES,
      ];

      if (focusZone === 'RIGHT_PROPINA') {
        const pcts = [0, 0.05, 0.1];
        const curIdx = pcts.findIndex(
          (p) => Math.round(subtotalPendiente * p) === propinaValor
        );
        const effIdx = curIdx < 0 ? 0 : curIdx;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (effIdx <= 0) {
            setFocusZone('ITEMS');
          } else {
            setPropinaValor(Math.round(subtotalPendiente * pcts[effIdx - 1]));
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIdx = Math.min(pcts.length - 1, effIdx + 1);
          setPropinaValor(Math.round(subtotalPendiente * pcts[nextIdx]));
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
            setFocusZone('FINAL_CONFIRM');
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
          setFocusZone('FINAL_CONFIRM');
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
          if (metodoPago === 'EFECTIVO' || metodoPago === 'MIXTO') {
            setFocusZone('RIGHT_BILLETES');
          } else {
            setFocusZone('RIGHT_METODO');
          }
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
    selectedItemIds.length,
    itemPagoMap,
    pagoParcialMetodo,
    pagoParcialMonto,
    partialBilleteIdx,
    rightBilleteIdx,
    habilitaPropinas,
    metodoPago,
    pagosRegistrados.length,
    propinaValor,
    subtotalPendiente,
    faltaMixEfectivo,
    montoObjetivoDerecha,
    onClose,
    handlePrimaryRightAction,
    handleAgregarTransaccion,
  ]);

  const cambioDirecto =
    metodoPago === 'EFECTIVO'
      ? Math.max(0, pagoConEfectivo - montoObjetivoDerecha)
      : metodoPago === 'MIXTO'
        ? Math.max(0, (pagoConEfectivo || 0) - faltaMixEfectivo)
        : 0;

  const faltaDirecto =
    metodoPago === 'EFECTIVO'
      ? Math.max(0, montoObjetivoDerecha - pagoConEfectivo)
      : metodoPago === 'MIXTO'
        ? Math.max(0, faltaMixEfectivo - (pagoConEfectivo || 0))
        : 0;

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
              Usa ↑/↓ y Espacio para marcar insumos, baja al método/billetes o cobra el saldo a la derecha.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo en 2 Columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* COLUMNA IZQUIERDA: Listado de Insumos + Pago Parcial */}
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
                  onClick={() =>
                    setSelectedItemIds(itemsActivos.filter((it) => !itemPagoMap.has(it.id)).map((it) => it.id))
                  }
                  className="px-2.5 py-1 rounded-md bg-white border border-zinc-300 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  Selec. Pendientes
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemIds([])}
                  className="px-2.5 py-1 rounded-md bg-white border border-zinc-300 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {itemsActivos.map((it, idx) => {
                const sub = Number(it.subtotal || 0);
                const base = Math.round(sub / 1.08);
                const impo = sub - base;
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
                          Base: {formatMoney(base)} · Impoconsumo (8%): {formatMoney(impo)}
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

            {selectedItemIds.length > 0 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="p-3 border-t border-blue-200 bg-blue-50 space-y-2.5 shrink-0"
              >
                <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                  <span>Insumos seleccionados ({selectedItemIds.length}):</span>
                  <span className="text-base tabular-nums">
                    {formatMoney(sumaSeleccionados + pagoParcialPropina)}
                  </span>
                </div>

                {habilitaPropinas && (
                  <div className="flex items-center justify-between gap-2 text-xs bg-white/80 border border-blue-200 rounded-lg px-2.5 py-1.5">
                    <span className="font-semibold text-zinc-700">Propina cobro:</span>
                    <div className="flex items-center gap-1">
                      {[0, 0.05, 0.1].map((pct) => {
                        const valPct = Math.round(sumaSeleccionados * pct);
                        const active = pagoParcialPropina === valPct;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setPagoParcialPropina(valPct)}
                            className={`px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                            }`}
                          >
                            {pct * 100}%
                          </button>
                        );
                      })}
                      <input
                        type="number"
                        value={pagoParcialPropina || ''}
                        onChange={(e) => setPagoParcialPropina(Math.max(0, Number(e.target.value || 0)))}
                        placeholder="$0"
                        className="w-20 px-2 py-0.5 border border-zinc-300 rounded text-[11px] font-bold tabular-nums text-right bg-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                )}

                <div
                  className={`grid grid-cols-4 gap-1.5 p-1 rounded-xl transition ${
                    focusZone === 'PARTIAL_METODO' ? 'ring-2 ring-blue-600 bg-white/70' : ''
                  }`}
                >
                  {PARTIAL_METODOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setPagoParcialMetodo(m);
                        setFocusZone(m === 'EFECTIVO' ? 'PARTIAL_EFECTIVO_INPUT' : 'PARTIAL_NOTA');
                      }}
                      className={`py-2 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        pagoParcialMetodo === m
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-zinc-700 border-zinc-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {pagoParcialMetodo === 'EFECTIVO' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
                      <span>Dinero entregado ($):</span>
                      {partialEfInsuficiente ? (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold tabular-nums">
                          Falta: {formatMoney(partialFalta)}
                        </span>
                      ) : partialCambio === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold tabular-nums">
                          Exacto · Devolver: $0
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold tabular-nums">
                          Devolver: {formatMoney(partialCambio)}
                        </span>
                      )}
                    </div>

                    <input
                      ref={partialEfInputRef}
                      type="number"
                      value={pagoParcialRecibido || ''}
                      onFocus={() => setFocusZone('PARTIAL_EFECTIVO_INPUT')}
                      onChange={(e) => {
                        setPagoParcialRecibido(Number(e.target.value || 0));
                        setPartialBilleteIdx(-1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setFocusZone('PARTIAL_METODO');
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setFocusZone('PARTIAL_BILLETES');
                        } else if (e.key === 'Enter' && !partialEfInsuficiente) {
                          e.preventDefault();
                          setFocusZone('PARTIAL_NOTA');
                        }
                      }}
                      placeholder="Ingresa el monto en efectivo..."
                      className="w-full px-3 py-1.5 bg-white border border-blue-300 focus:border-blue-600 rounded-lg text-base font-extrabold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />

                    <div
                      className={`flex gap-1.5 flex-wrap p-1 rounded-lg ${
                        focusZone === 'PARTIAL_BILLETES' ? 'ring-2 ring-blue-600 bg-white/80' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPagoParcialRecibido(pagoParcialMonto);
                          setPartialBilleteIdx(0);
                        }}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-bold cursor-pointer ${
                          (focusZone === 'PARTIAL_BILLETES' && partialBilleteIdx === 0) ||
                          pagoParcialRecibido === pagoParcialMonto
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        Exacto
                      </button>
                      {BILLETES.map((b, bIdx) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setPagoParcialRecibido(b);
                            setPartialBilleteIdx(bIdx + 1);
                          }}
                          className={`px-2.5 py-1 rounded-md border text-[11px] font-bold tabular-nums cursor-pointer ${
                            (focusZone === 'PARTIAL_BILLETES' && partialBilleteIdx === bIdx + 1) ||
                            pagoParcialRecibido === b
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100'
                          }`}
                        >
                          {formatMoney(b)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={partialNotaRef}
                    type="text"
                    value={pagoParcialNota}
                    onFocus={() => setFocusZone('PARTIAL_NOTA')}
                    onChange={(e) => setPagoParcialNota(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setFocusZone(
                          pagoParcialMetodo === 'EFECTIVO' ? 'PARTIAL_BILLETES' : 'PARTIAL_METODO'
                        );
                      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                        e.preventDefault();
                        setFocusZone('PARTIAL_CONFIRM');
                      }
                    }}
                    placeholder="Observación / Persona (opcional)"
                    className="flex-1 px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white outline-none focus:border-blue-600"
                  />
                  <button
                    ref={partialConfirmRef}
                    type="button"
                    disabled={busyAction || partialEfInsuficiente || pagoParcialMonto <= 0}
                    onClick={() => void handleAgregarTransaccion()}
                    className={`px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-45 text-white text-xs font-bold flex items-center gap-1 cursor-pointer ${
                      focusZone === 'PARTIAL_CONFIRM' ? 'ring-2 ring-blue-600' : ''
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Cobro Parcial
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: Totales, Propina, Pagos Registrados y Cobro de Saldo */}
          <div className="lg:col-span-6 p-4 overflow-y-auto space-y-3.5">
            {/* Cuadre en Vivo */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-zinc-100 border border-zinc-200">
                <div className="text-zinc-500">Total Ticket</div>
                <div className="text-base font-extrabold tabular-nums text-zinc-950">
                  {metodoPago === 'CONSUMO_INTERNO' ? '$0' : formatMoney(totalFinalCobro)}
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
                  {metodoPago === 'CONSUMO_INTERNO' ? '$0' : formatMoney(faltaPorCobrar)}
                </div>
              </div>
            </div>

            {/* Propina y Descuento SIEMPRE visibles */}
            {metodoPago !== 'CONSUMO_INTERNO' && (
              <div
                className={`grid ${habilitaPropinas ? 'grid-cols-2' : 'grid-cols-1'} gap-3 text-xs p-1.5 rounded-xl transition ${
                  focusZone === 'RIGHT_PROPINA' ? 'ring-2 ring-blue-500 bg-blue-50/40' : ''
                }`}
              >
                {habilitaPropinas && (
                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">
                      {pagosRegistrados.length > 0 ? 'Propina (saldo pendiente)' : 'Propina'}
                    </label>
                    <div className="flex gap-1 mb-1">
                      {[0, 0.05, 0.1].map((pct) => {
                        const valPct = Math.round(subtotalPendiente * pct);
                        const isAct = propinaValor === valPct;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setPropinaValor(valPct);
                              setFocusZone('RIGHT_PROPINA');
                            }}
                            className={`px-2.5 py-1 rounded border font-bold cursor-pointer ${
                              isAct
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700'
                            }`}
                          >
                            {pct * 100}%
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="number"
                      value={propinaValor}
                      onChange={(e) => setPropinaValor(Number(e.target.value || 0))}
                      className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    {propinaParcialAcumulada > 0 && (
                      <div className="text-[10px] text-emerald-700 font-semibold mt-0.5 tabular-nums">
                        Propinas en abonos: {formatMoney(propinaParcialAcumulada)} · Total mesa: {formatMoney(propinaTotalTicket)}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Descuento Global ($)</label>
                  {habilitaPropinas && <div className="h-[28px]" />}
                  <input
                    type="number"
                    value={descuentoValor}
                    onChange={(e) => setDescuentoValor(Number(e.target.value || 0))}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>
            )}

            {/* Lista de Pagos Registrados */}
            {pagosRegistrados.length > 0 && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-zinc-800">
                  Transacciones Registradas en este Ticket ({pagosRegistrados.length})
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
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

            {/* Cobro del Total o Saldo Restante SIEMPRE visible mientras falte por cobrar */}
            {(pagosRegistrados.length === 0 || faltaPorCobrar > 0) && (
              <>
                <div
                  className={`grid grid-cols-3 sm:grid-cols-6 gap-1 bg-zinc-100 p-1 rounded-xl border transition ${
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
                      ...(pagosRegistrados.length === 0
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
                      <span>
                        {pagosRegistrados.length > 0
                          ? `Efectivo recibido para saldo (${formatMoney(montoObjetivoDerecha)}):`
                          : 'Efectivo recibido del cliente:'}
                      </span>
                      {faltaDirecto > 0 ? (
                        <span className="text-sm font-extrabold tabular-nums text-rose-700">
                          Falta: {formatMoney(faltaDirecto)}
                        </span>
                      ) : (
                        <span className="text-base font-extrabold tabular-nums text-blue-700">
                          Cambio: {formatMoney(cambioDirecto)}
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
                          setPagoConEfectivo(metodoPago === 'MIXTO' ? faltaMixEfectivo : montoObjetivoDerecha);
                          setRightBilleteIdx(0);
                          setFocusZone('RIGHT_BILLETES');
                        }}
                        className={`px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${
                          (focusZone === 'RIGHT_BILLETES' && rightBilleteIdx === 0) ||
                          pagoConEfectivo === (metodoPago === 'MIXTO' ? faltaMixEfectivo : montoObjetivoDerecha)
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

                {metodoPago === 'CONSUMO_INTERNO' && pagosRegistrados.length === 0 && (
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
              </>
            )}

            <button
              ref={finalConfirmRef}
              type="button"
              disabled={busyAction || rightEfInsuficiente}
              onClick={() => void handlePrimaryRightAction()}
              className={`w-full py-3.5 rounded-xl disabled:opacity-45 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition ${
                drawerStepReady
                  ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-300'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              } ${focusZone === 'FINAL_CONFIRM' ? 'ring-4 ring-blue-300' : ''}`}
            >
              <Check className="w-4 h-4" />
              {metodoPago === 'CONSUMO_INTERNO' && pagosRegistrados.length === 0
                ? 'Registrar Consumo Interno ($0 Caja)'
                : rightEfInsuficiente
                  ? `Falta ${formatMoney(faltaDirecto)} en efectivo para cerrar`
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
