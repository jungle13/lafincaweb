'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import type { ClienteCreditoResumen, OperarioPos, PosOrden, PosOrdenItem, PosOrdenPago } from './types';

interface PosCheckoutModalProps {
  ordenActiva: PosOrden;
  itemsActivos: PosOrdenItem[];
  operarios: OperarioPos[];
  creditosClientes: ClienteCreditoResumen[];
  habilitaPropinas: boolean;
  busyAction: boolean;
  onClose: () => void;
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

export default function PosCheckoutModal({
  ordenActiva,
  itemsActivos,
  operarios,
  creditosClientes,
  habilitaPropinas,
  busyAction,
  onClose,
  onConfirmarCobro,
}: PosCheckoutModalProps) {
  const [propinaValor, setPropinaValor] = useState(0);
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [metodoPago, setMetodoPago] = useState<
    'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO' | 'MIXTO' | 'CONSUMO_INTERNO'
  >('EFECTIVO');

  // Estado de cobro directo / mixto
  const [pagoConEfectivo, setPagoConEfectivo] = useState(0);
  const [mixEf, setMixEf] = useState(0);
  const [mixDat, setMixDat] = useState(0);
  const [mixTrf, setMixTrf] = useState(0);
  const [mixCred, setMixCred] = useState(0);
  const [comisionTarjeta, setComisionTarjeta] = useState(0);

  // Estado de Consumo Interno / Crédito
  const [clienteCreditoNombre, setClienteCreditoNombre] = useState('');
  const [clienteCreditoTel, setClienteCreditoTel] = useState('');
  const [areaConsumo, setAreaConsumo] = useState<string>('Personal Cocina');
  const [consumoNota, setConsumoNota] = useState('');

  // División por insumos y múltiples transacciones
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [pagosRegistrados, setPagosRegistrados] = useState<PosOrdenPago[]>([]);
  const [pagoParcialMetodo, setPagoParcialMetodo] = useState<'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO'>('EFECTIVO');
  const [pagoParcialMonto, setPagoParcialMonto] = useState(0);
  const [pagoParcialRecibido, setPagoParcialRecibido] = useState(0);
  const [pagoParcialNota, setPagoParcialNota] = useState('');

  // Navegación teclado izquierda/derecha
  const [activeCol, setActiveCol] = useState<'ITEMS' | 'PAGO'>('PAGO');
  const [focusedItemIdx, setFocusedItemIdx] = useState(0);

  const totalFinalCobro = useMemo(() => {
    if (metodoPago === 'CONSUMO_INTERNO') return Number(ordenActiva.subtotal_bruto || 0);
    return Math.max(
      0,
      Number(ordenActiva.subtotal_bruto || 0) +
        Number(ordenActiva.costo_domicilio || 0) -
        descuentoValor +
        propinaValor
    );
  }, [ordenActiva, descuentoValor, propinaValor, metodoPago]);

  // Mapa de ítems ya cubiertos por pagosRegistrados
  const itemPagoMap = useMemo(() => {
    const map = new Map<string, { numero: number; metodo: string }>();
    for (const pg of pagosRegistrados) {
      for (const it of pg.items_pagados) {
        map.set(it.item_id, { numero: pg.numero_pago, metodo: pg.metodo_pago });
      }
    }
    return map;
  }, [pagosRegistrados]);

  const totalPagadoMulti = useMemo(
    () => pagosRegistrados.reduce((acc, p) => acc + Number(p.monto_aplicado || 0), 0),
    [pagosRegistrados]
  );

  const faltaPorCobrar = Math.max(0, totalFinalCobro - totalPagadoMulti);

  const sumaSeleccionados = useMemo(
    () =>
      itemsActivos
        .filter((it) => selectedItemIds.includes(it.id))
        .reduce((acc, it) => acc + Number(it.subtotal || 0), 0),
    [itemsActivos, selectedItemIds]
  );

  // Faltante en modo MIXTO simple (cuando no hay pagosRegistrados)
  const sumaMixNoEfectivo = mixDat + mixTrf + mixCred;
  const faltaMixEfectivo = Math.max(0, totalFinalCobro - sumaMixNoEfectivo);

  useEffect(() => {
    setPagoConEfectivo(totalFinalCobro);
  }, [totalFinalCobro]);

  useEffect(() => {
    if (selectedItemIds.length > 0) {
      setPagoParcialMonto(sumaSeleccionados);
      setPagoParcialRecibido(sumaSeleccionados);
    } else if (pagosRegistrados.length > 0) {
      setPagoParcialMonto(faltaPorCobrar);
      setPagoParcialRecibido(faltaPorCobrar);
    }
  }, [selectedItemIds, sumaSeleccionados, pagosRegistrados.length, faltaPorCobrar]);

  // Navegación por teclado dentro del modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        void handleFinalConfirm();
        return;
      }

      if (e.key === 'Tab' && !isInput) {
        e.preventDefault();
        setActiveCol((c) => (c === 'ITEMS' ? 'PAGO' : 'ITEMS'));
        return;
      }

      if (activeCol === 'ITEMS' && !isInput && itemsActivos.length > 0) {
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
          setActiveCol('PAGO');
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleAgregarTransaccion = () => {
    const montoAplicado = Math.min(faltaPorCobrar || totalFinalCobro, Math.max(0, Number(pagoParcialMonto || 0)));
    if (montoAplicado <= 0) return;

    const recibido =
      pagoParcialMetodo === 'EFECTIVO'
        ? Math.max(montoAplicado, Number(pagoParcialRecibido || montoAplicado))
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

    const nuevoPago: PosOrdenPago = {
      numero_pago: pagosRegistrados.length + 1,
      metodo_pago: pagoParcialMetodo,
      monto_aplicado: montoAplicado,
      monto_recibido: recibido,
      cambio_devuelto: cambio,
      items_pagados: itemsCovered,
      nota: pagoParcialNota.trim(),
    };

    setPagosRegistrados((prev) => [...prev, nuevoPago]);
    setSelectedItemIds([]);
    setPagoParcialNota('');
    setMetodoPago('MIXTO');
  };

  const handleFinalConfirm = async () => {
    // Si hay transacciones registradas en división de cuenta
    if (pagosRegistrados.length > 0 && metodoPago !== 'CONSUMO_INTERNO') {
      const sumEf = pagosRegistrados.filter((p) => p.metodo_pago === 'EFECTIVO').reduce((a, b) => a + b.monto_aplicado, 0);
      const sumDat = pagosRegistrados.filter((p) => p.metodo_pago === 'DATAFONO').reduce((a, b) => a + b.monto_aplicado, 0);
      const sumTrf = pagosRegistrados.filter((p) => p.metodo_pago === 'TRANSFERENCIA').reduce((a, b) => a + b.monto_aplicado, 0);
      const sumCred = pagosRegistrados.filter((p) => p.metodo_pago === 'CREDITO').reduce((a, b) => a + b.monto_aplicado, 0);
      const sumRec = pagosRegistrados.filter((p) => p.metodo_pago === 'EFECTIVO').reduce((a, b) => a + b.monto_recibido, 0);

      await onConfirmarCobro({
        metodo_pago: 'MIXTO',
        propina: propinaValor,
        descuento: descuentoValor,
        pago_efectivo: sumEf,
        pago_datafono: sumDat,
        pago_transferencia: sumTrf,
        pago_credito: sumCred,
        efectivo_recibido: sumRec,
        comision_tarjeta: comisionTarjeta,
        cliente_nombre: clienteCreditoNombre.trim() || ordenActiva.cliente_nombre || '',
        cliente_telefono: clienteCreditoTel.trim() || ordenActiva.cliente_telefono || '',
        area_consumo: areaConsumo,
        pagos_detalle: pagosRegistrados,
      });
      return;
    }

    // Flujo directo o mixto simple
    const efAplicado = metodoPago === 'MIXTO' ? mixEf || faltaMixEfectivo : metodoPago === 'EFECTIVO' ? totalFinalCobro : 0;
    const efRecibido =
      metodoPago === 'EFECTIVO'
        ? Math.max(totalFinalCobro, pagoConEfectivo)
        : metodoPago === 'MIXTO'
          ? Math.max(efAplicado, pagoConEfectivo || efAplicado)
          : totalFinalCobro;

    const singleDetalle: PosOrdenPago[] =
      metodoPago === 'MIXTO'
        ? ([
            efAplicado > 0 && {
              numero_pago: 1,
              metodo_pago: 'EFECTIVO' as const,
              monto_aplicado: efAplicado,
              monto_recibido: efRecibido,
              cambio_devuelto: Math.max(0, efRecibido - efAplicado),
              items_pagados: [],
              nota: 'Mixto Efectivo',
            },
            mixDat > 0 && {
              numero_pago: 2,
              metodo_pago: 'DATAFONO' as const,
              monto_aplicado: mixDat,
              monto_recibido: mixDat,
              cambio_devuelto: 0,
              items_pagados: [],
              nota: 'Mixto Datáfono',
            },
            mixTrf > 0 && {
              numero_pago: 3,
              metodo_pago: 'TRANSFERENCIA' as const,
              monto_aplicado: mixTrf,
              monto_recibido: mixTrf,
              cambio_devuelto: 0,
              items_pagados: [],
              nota: 'Mixto Transferencia',
            },
            mixCred > 0 && {
              numero_pago: 4,
              metodo_pago: 'CREDITO' as const,
              monto_aplicado: mixCred,
              monto_recibido: mixCred,
              cambio_devuelto: 0,
              items_pagados: [],
              nota: 'Mixto Crédito',
            },
          ].filter(Boolean) as PosOrdenPago[])
        : metodoPago !== 'CONSUMO_INTERNO'
          ? [
              {
                numero_pago: 1,
                metodo_pago: metodoPago,
                monto_aplicado: totalFinalCobro,
                monto_recibido: efRecibido,
                cambio_devuelto: metodoPago === 'EFECTIVO' ? Math.max(0, efRecibido - totalFinalCobro) : 0,
                items_pagados: itemsActivos.map((it) => ({
                  item_id: it.id,
                  nombre_producto: it.nombre_producto,
                  cantidad: Number(it.cantidad || 1),
                  subtotal: Number(it.subtotal || 0),
                })),
              },
            ]
          : [];

    await onConfirmarCobro({
      metodo_pago: metodoPago,
      propina: metodoPago === 'CONSUMO_INTERNO' ? 0 : propinaValor,
      descuento: metodoPago === 'CONSUMO_INTERNO' ? 0 : descuentoValor,
      pago_efectivo: metodoPago === 'EFECTIVO' ? totalFinalCobro : metodoPago === 'MIXTO' ? efAplicado : 0,
      pago_datafono: metodoPago === 'DATAFONO' ? totalFinalCobro : metodoPago === 'MIXTO' ? mixDat : 0,
      pago_transferencia: metodoPago === 'TRANSFERENCIA' ? totalFinalCobro : metodoPago === 'MIXTO' ? mixTrf : 0,
      pago_credito: metodoPago === 'CREDITO' ? totalFinalCobro : metodoPago === 'MIXTO' ? mixCred : 0,
      efectivo_recibido: metodoPago === 'CONSUMO_INTERNO' ? 0 : efRecibido,
      comision_tarjeta: metodoPago === 'CONSUMO_INTERNO' ? 0 : comisionTarjeta,
      cliente_nombre:
        metodoPago === 'CONSUMO_INTERNO' && areaConsumo === 'Cortesía / Degustación'
          ? consumoNota.trim() || clienteCreditoNombre.trim()
          : clienteCreditoNombre.trim() || ordenActiva.cliente_nombre || '',
      cliente_telefono: clienteCreditoTel.trim() || ordenActiva.cliente_telefono || '',
      area_consumo: areaConsumo,
      pagos_detalle: singleDetalle,
    });
  };

  const cambioDirecto =
    metodoPago === 'EFECTIVO'
      ? Math.max(0, pagoConEfectivo - totalFinalCobro)
      : metodoPago === 'MIXTO'
        ? Math.max(0, (pagoConEfectivo || 0) - (mixEf || faltaMixEfectivo))
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
              Marca los insumos con checkbox para dividir pagos por persona (Datáfono, Transferencia o Efectivo con devuelta individual).
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo en 2 Columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* COLUMNA IZQUIERDA: Listado de Insumos + Impuestos + Checkboxes */}
          <div
            onClick={() => setActiveCol('ITEMS')}
            className={`lg:col-span-6 border-b lg:border-b-0 lg:border-r border-zinc-200 flex flex-col min-h-0 overflow-hidden ${
              activeCol === 'ITEMS' ? 'bg-sky-50/20' : 'bg-white'
            }`}
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
                const isFocused = activeCol === 'ITEMS' && focusedItemIdx === idx;

                return (
                  <label
                    key={it.id}
                    onClick={() => setFocusedItemIdx(idx)}
                    className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition ${
                      pagoInfo
                        ? 'bg-emerald-50/60 opacity-80'
                        : checked
                          ? 'bg-blue-50/90'
                          : isFocused
                            ? 'bg-zinc-100'
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
              <div className="p-3 border-t border-blue-200 bg-blue-50 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                  <span>Insumos seleccionados ({selectedItemIds.length}):</span>
                  <span className="text-base tabular-nums">{formatMoney(sumaSeleccionados)}</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {(['EFECTIVO', 'DATAFONO', 'TRANSFERENCIA', 'CREDITO'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPagoParcialMetodo(m)}
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
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
                      <span>Billete entregado:</span>
                      <span className="font-extrabold text-emerald-700 tabular-nums">
                        Devolver: {formatMoney(Math.max(0, pagoParcialRecibido - pagoParcialMonto))}
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setPagoParcialRecibido(pagoParcialMonto)}
                        className="px-2.5 py-1 rounded-md bg-white border border-zinc-300 text-[11px] font-bold cursor-pointer"
                      >
                        Exacto
                      </button>
                      {BILLETES.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setPagoParcialRecibido(b)}
                          className="px-2.5 py-1 rounded-md bg-white border border-zinc-300 text-[11px] font-bold tabular-nums cursor-pointer"
                        >
                          {formatMoney(b)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pagoParcialNota}
                    onChange={(e) => setPagoParcialNota(e.target.value)}
                    placeholder="Nota / Persona (opcional)"
                    className="flex-1 px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAgregarTransaccion}
                    className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Registrar Pago
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: Totales, Faltante, Métodos, Billetes y Pagos Registrados */}
          <div
            onClick={() => setActiveCol('PAGO')}
            className="lg:col-span-6 p-4 overflow-y-auto space-y-3.5"
          >
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

            {/* Lista de Pagos Registrados (División de Cuenta) */}
            {pagosRegistrados.length > 0 && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-zinc-800">
                  Transacciones Registradas en este Ticket ({pagosRegistrados.length})
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {pagosRegistrados.map((pg, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-lg bg-white border border-zinc-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-zinc-900">
                          Pago #{pg.numero_pago} · {pg.metodo_pago}
                        </span>
                        {pg.cambio_devuelto > 0 && (
                          <span className="ml-2 text-blue-700 font-semibold">
                            (Pagó {formatMoney(pg.monto_recibido)} · Devuelta {formatMoney(pg.cambio_devuelto)})
                          </span>
                        )}
                        {pg.items_pagados.length > 0 && (
                          <div className="text-[11px] text-zinc-500">
                            {pg.items_pagados.map((i) => `${i.cantidad}x ${i.nombre_producto}`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold tabular-nums">{formatMoney(pg.monto_aplicado)}</span>
                        <button
                          type="button"
                          onClick={() => setPagosRegistrados((prev) => prev.filter((_, i) => i !== idx))}
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

            {/* Propina y Descuento */}
            {metodoPago !== 'CONSUMO_INTERNO' && pagosRegistrados.length === 0 && (
              <div className={`grid ${habilitaPropinas ? 'grid-cols-2' : 'grid-cols-1'} gap-3 text-xs`}>
                {habilitaPropinas && (
                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Propina</label>
                    <div className="flex gap-1 mb-1">
                      {[0, 0.05, 0.1].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setPropinaValor(Math.round(ordenActiva.subtotal_bruto * pct))}
                          className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 font-bold text-zinc-700 cursor-pointer"
                        >
                          {pct * 100}%
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      value={propinaValor}
                      onChange={(e) => setPropinaValor(Number(e.target.value || 0))}
                      className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg font-bold tabular-nums"
                    />
                  </div>
                )}
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Descuento Global ($)</label>
                  {habilitaPropinas && <div className="h-[28px]" />}
                  <input
                    type="number"
                    value={descuentoValor}
                    onChange={(e) => setDescuentoValor(Number(e.target.value || 0))}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg font-bold tabular-nums"
                  />
                </div>
              </div>
            )}

            {/* Selector de Método */}
            {pagosRegistrados.length === 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                {(
                  [
                    { id: 'EFECTIVO', label: 'EFECTIVO' },
                    { id: 'DATAFONO', label: 'DATÁFONO' },
                    { id: 'TRANSFERENCIA', label: 'TRANSF.' },
                    { id: 'CREDITO', label: 'CRÉDITO' },
                    { id: 'MIXTO', label: 'MIXTO' },
                    { id: 'CONSUMO_INTERNO', label: 'CONSUMO' },
                  ] as const
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
            )}

            {/* Pago Efectivo Directo o Mixto */}
            {(metodoPago === 'EFECTIVO' || metodoPago === 'MIXTO') && pagosRegistrados.length === 0 && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2.5 text-xs">
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
                  <span>Efectivo recibido del cliente:</span>
                  <span className="text-base font-extrabold tabular-nums text-blue-700">
                    Cambio: {formatMoney(cambioDirecto)}
                  </span>
                </div>
                <input
                  type="number"
                  value={pagoConEfectivo}
                  onChange={(e) => {
                    setPagoConEfectivo(Number(e.target.value || 0));
                    if (metodoPago === 'MIXTO') setMixEf(faltaMixEfectivo);
                  }}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 focus:border-blue-600 rounded-xl text-lg font-extrabold tabular-nums outline-none"
                />
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPagoConEfectivo(metodoPago === 'MIXTO' ? faltaMixEfectivo : totalFinalCobro)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 font-bold cursor-pointer"
                  >
                    Exacto
                  </button>
                  {BILLETES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setPagoConEfectivo(b)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-300 font-bold tabular-nums cursor-pointer"
                    >
                      {formatMoney(b)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {metodoPago === 'DATAFONO' && pagosRegistrados.length === 0 && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs">
                <label className="font-semibold text-zinc-700 block mb-1">Comisión Bancaria Datáfono (opcional $)</label>
                <input
                  type="number"
                  value={comisionTarjeta}
                  onChange={(e) => setComisionTarjeta(Number(e.target.value || 0))}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg font-bold"
                />
              </div>
            )}

            {(metodoPago === 'CREDITO' || (metodoPago === 'MIXTO' && mixCred > 0)) && pagosRegistrados.length === 0 && (
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

            {metodoPago === 'CONSUMO_INTERNO' && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2.5 text-xs">
                <div className="font-bold text-zinc-900">Consumo Interno — Selecciona Cargo / Área ($0 Caja)</div>
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
                        areaConsumo === area ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-300'
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

            <button
              type="button"
              disabled={busyAction || (pagosRegistrados.length > 0 && faltaPorCobrar > 0)}
              onClick={() => void handleFinalConfirm()}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {metodoPago === 'CONSUMO_INTERNO'
                ? 'Registrar Consumo Interno ($0 Caja)'
                : pagosRegistrados.length > 0 && faltaPorCobrar > 0
                  ? `Falta ${formatMoney(faltaPorCobrar)} para cerrar el ticket`
                  : 'Confirmar Cobro e Imprimir Ticket (Ctrl+Enter)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
