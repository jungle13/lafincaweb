'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Printer,
  RotateCcw,
  Search,
  User,
  Utensils,
  CreditCard,
  Clock,
  Coffee,
  Receipt,
  CheckCircle2,
  X,
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { formatColombiaTime } from '@/lib/dateUtils';
import type { DevolucionDia, PosOrden, PosOrdenItem } from './types';

interface PosSalesHistoryViewProps {
  currentCajaNombre: string;
  cajasAbiertasHoy: string[];
  ordenesFacturadas: PosOrden[];
  consumosInternosHoy: PosOrden[];
  devolucionesDia: DevolucionDia[];
  busyAction: boolean;
  onReimprimirOrden: (orden: PosOrden) => Promise<void>;
  onDevolverItem: (payload: {
    orden_id: string;
    item_id: string;
    cantidad_devuelta: number;
    metodo_reembolso: 'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO';
    motivo: string;
  }) => Promise<void>;
  onDevolverTicketCompleto: (payload: {
    orden_id: string;
    metodo_reembolso: 'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO';
    motivo: string;
  }) => Promise<void>;
}

type SubTab = 'FACTURAS' | 'TOTALIZADOS' | 'CONSUMOS';
type QuickFilter = 'TODOS' | 'CONSUMO' | 'DEVOLUCIONES' | 'CREDITO';

function formatElapsedDuration(startIso?: string | null, endIso?: string | null): string | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const totalSec = Math.floor((end - start) / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function getChannelBadge(o: PosOrden) {
  if (o.canal_venta === 'SALON_MESA' && o.mesa_numero) {
    return {
      label: `Mesa ${o.mesa_numero}`,
      cls: 'bg-sky-100 text-sky-900 border-sky-300',
    };
  }
  if (o.canal_venta === 'DOMICILIO') {
    return {
      label: 'Domicilio',
      cls: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    };
  }
  return {
    label: 'Mostrador',
    cls: 'bg-amber-100 text-amber-900 border-amber-300',
  };
}

export default function PosSalesHistoryView({
  currentCajaNombre,
  cajasAbiertasHoy,
  ordenesFacturadas,
  consumosInternosHoy,
  devolucionesDia,
  busyAction,
  onReimprimirOrden,
  onDevolverItem,
  onDevolverTicketCompleto,
}: PosSalesHistoryViewProps) {
  const [subTab, setSubTab] = useState<SubTab>('FACTURAS');
  const [cajaFilter, setCajaFilter] = useState<string>(currentCajaNombre || 'TODAS');
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('TODOS');
  const [metodoFilter, setMetodoFilter] = useState<string>('TODOS');
  const [meseroFilter, setMeseroFilter] = useState<string>('TODOS');
  const [mesaFilter, setMesaFilter] = useState<string>('TODOS');
  const [selectedOrdenId, setSelectedOrdenId] = useState<string>(ordenesFacturadas[0]?.id || '');

  // Modales internos de devolución
  const [devItem, setDevItem] = useState<PosOrdenItem | null>(null);
  const [devFullTicket, setDevFullTicket] = useState(false);
  const [devCantidad, setDevCantidad] = useState(1);
  const [devMetodo, setDevMetodo] = useState<'EFECTIVO' | 'DATAFONO' | 'TRANSFERENCIA' | 'CREDITO'>('EFECTIVO');
  const [devMotivo, setDevMotivo] = useState('Devolución en caja');

  const cajasDisponibles = useMemo(() => {
    const set = new Set<string>();
    if (currentCajaNombre) set.add(currentCajaNombre);
    cajasAbiertasHoy.forEach((c) => { if (c) set.add(c); });
    ordenesFacturadas.forEach((o) => { if (o.caja_nombre) set.add(o.caja_nombre); });
    consumosInternosHoy.forEach((o) => { if (o.caja_nombre) set.add(o.caja_nombre); });
    return Array.from(set).sort();
  }, [currentCajaNombre, cajasAbiertasHoy, ordenesFacturadas, consumosInternosHoy]);

  const ordenesPorCaja = useMemo(() => {
    if (cajaFilter === 'TODAS') return ordenesFacturadas;
    return ordenesFacturadas.filter((o) => (o.caja_nombre || currentCajaNombre) === cajaFilter);
  }, [ordenesFacturadas, cajaFilter, currentCajaNombre]);

  const consumosPorCaja = useMemo(() => {
    if (cajaFilter === 'TODAS') return consumosInternosHoy;
    return consumosInternosHoy.filter((o) => (o.caja_nombre || currentCajaNombre) === cajaFilter);
  }, [consumosInternosHoy, cajaFilter, currentCajaNombre]);

  const allTickets = useMemo(() => {
    const map = new Map<string, PosOrden>();
    for (const o of ordenesPorCaja) map.set(o.id, o);
    for (const c of consumosPorCaja) map.set(c.id, c);
    return Array.from(map.values()).sort((a, b) =>
      String(b.pagado_at || b.created_at || '').localeCompare(String(a.pagado_at || a.created_at || ''))
    );
  }, [ordenesPorCaja, consumosPorCaja]);

  const devolucionesPorOrden = useMemo(() => {
    const map = new Map<string, DevolucionDia[]>();
    for (const d of devolucionesDia) {
      const list = map.get(d.orden_id) || [];
      list.push(d);
      map.set(d.orden_id, list);
    }
    return map;
  }, [devolucionesDia]);

  const meserosUnicos = useMemo(() => {
    const set = new Set<string>();
    allTickets.forEach((o) => {
      const m = (o.mesero_nombre || o.cajero_nombre || '').trim();
      if (m) set.add(m);
    });
    return ['TODOS', ...Array.from(set).sort()];
  }, [allTickets]);

  const mesasUnicas = useMemo(() => {
    const set = new Set<string>();
    allTickets.forEach((o) => set.add(getChannelBadge(o).label));
    return ['TODOS', ...Array.from(set).sort()];
  }, [allTickets]);

  const totales = useMemo(() => {
    const comerciales = ordenesPorCaja.filter((o) => o.metodo_pago !== 'CONSUMO_INTERNO');
    const totalComercial = comerciales.reduce((acc, o) => acc + Number(o.gran_total || 0), 0);
    const efectivo = comerciales.reduce((acc, o) => acc + Number(o.pago_efectivo || 0), 0);
    const datafono = comerciales.reduce((acc, o) => acc + Number(o.pago_datafono || 0), 0);
    const transferencia = comerciales.reduce((acc, o) => acc + Number(o.pago_transferencia || 0), 0);
    const credito = comerciales.reduce((acc, o) => acc + Number(o.pago_credito || 0), 0);
    const propinas = comerciales.reduce((acc, o) => acc + Number(o.propina || 0), 0);
    const idsCaja = new Set(allTickets.map((t) => t.id));
    const totalDevoluciones = devolucionesDia
      .filter((d) => cajaFilter === 'TODAS' || idsCaja.has(d.orden_id))
      .reduce((acc, d) => acc + Number(d.valor_devuelto || 0), 0);
    const totalConsumo = consumosPorCaja.reduce(
      (acc, o) => acc + Number(o.subtotal_bruto || o.gran_total || 0),
      0
    );
    return {
      cantidadComercial: comerciales.length,
      totalComercial,
      efectivo,
      datafono,
      transferencia,
      credito,
      propinas,
      totalDevoluciones,
      totalConsumo,
    };
  }, [ordenesPorCaja, devolucionesDia, consumosPorCaja, allTickets, cajaFilter]);

  const ticketsFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTickets.filter((o) => {
      if (quickFilter === 'CONSUMO' && o.metodo_pago !== 'CONSUMO_INTERNO') return false;
      if (quickFilter === 'CREDITO' && Number(o.pago_credito || 0) <= 0 && o.metodo_pago !== 'CREDITO') return false;
      if (quickFilter === 'DEVOLUCIONES' && !devolucionesPorOrden.has(o.id)) return false;

      if (metodoFilter !== 'TODOS' && o.metodo_pago !== metodoFilter) return false;
      const meseroOrd = (o.mesero_nombre || o.cajero_nombre || '').trim();
      if (meseroFilter !== 'TODOS' && meseroOrd !== meseroFilter) return false;
      if (mesaFilter !== 'TODOS' && getChannelBadge(o).label !== mesaFilter) return false;

      if (!q) return true;
      return (
        o.consecutivo.toLowerCase().includes(q) ||
        (o.cliente_nombre || '').toLowerCase().includes(q) ||
        meseroOrd.toLowerCase().includes(q) ||
        getChannelBadge(o).label.toLowerCase().includes(q) ||
        (o.items || []).some((it) => it.nombre_producto.toLowerCase().includes(q))
      );
    });
  }, [allTickets, quickFilter, metodoFilter, meseroFilter, mesaFilter, search, devolucionesPorOrden]);

  const ordenActiva = useMemo(
    () => allTickets.find((o) => o.id === selectedOrdenId) || ticketsFiltrados[0] || null,
    [allTickets, ticketsFiltrados, selectedOrdenId]
  );

  const isReadOnlyOtherCaja =
    cajaFilter !== currentCajaNombre ||
    Boolean(ordenActiva?.caja_nombre && currentCajaNombre && ordenActiva.caja_nombre !== currentCajaNombre);

  // Totalizados por Mesa/Canal y por Mesero
  const resumenPorMesa = useMemo(() => {
    const map = new Map<string, { label: string; count: number; total: number; propinas: number }>();
    for (const o of ordenesFacturadas) {
      if (o.metodo_pago === 'CONSUMO_INTERNO') continue;
      const key = getChannelBadge(o).label;
      const cur = map.get(key) || { label: key, count: 0, total: 0, propinas: 0 };
      cur.count += 1;
      cur.total += Number(o.gran_total || 0);
      cur.propinas += Number(o.propina || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [ordenesFacturadas]);

  const resumenPorMesero = useMemo(() => {
    const map = new Map<string, { label: string; count: number; total: number; propinas: number }>();
    for (const o of ordenesFacturadas) {
      if (o.metodo_pago === 'CONSUMO_INTERNO') continue;
      const key = (o.mesero_nombre || o.cajero_nombre || 'SIN ASIGNAR').trim();
      const cur = map.get(key) || { label: key, count: 0, total: 0, propinas: 0 };
      cur.count += 1;
      cur.total += Number(o.gran_total || 0);
      cur.propinas += Number(o.propina || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [ordenesFacturadas]);

  const submittingReturnRef = useRef(false);

  const handleConfirmReturn = async () => {
    if (!ordenActiva || submittingReturnRef.current) return;
    submittingReturnRef.current = true;
    try {
      if (devFullTicket) {
        await onDevolverTicketCompleto({
          orden_id: ordenActiva.id,
          metodo_reembolso: devMetodo,
          motivo: devMotivo,
        });
        setDevFullTicket(false);
        return;
      }
      if (!devItem) return;
      await onDevolverItem({
        orden_id: ordenActiva.id,
        item_id: devItem.id,
        cantidad_devuelta: devCantidad,
        metodo_reembolso: devMetodo,
        motivo: devMotivo,
      });
      setDevItem(null);
    } finally {
      submittingReturnRef.current = false;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-100 p-3 gap-3">
      {/* 1. KPIs Totalizados del Día */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 shrink-0">
        <div className="bg-zinc-900 text-white rounded-lg px-3 py-2 col-span-2 sm:col-span-2">
          <div className="text-[11px] text-zinc-300 font-medium">Total Ventas ({totales.cantidadComercial} tickets)</div>
          <div className="text-lg font-extrabold tabular-nums">{formatMoney(totales.totalComercial)}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2">
          <div className="text-[11px] text-zinc-500 font-medium">Efectivo</div>
          <div className="text-sm font-bold tabular-nums text-emerald-700">{formatMoney(totales.efectivo)}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2">
          <div className="text-[11px] text-zinc-500 font-medium">Datáfono</div>
          <div className="text-sm font-bold tabular-nums text-blue-700">{formatMoney(totales.datafono)}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2">
          <div className="text-[11px] text-zinc-500 font-medium">Transferencia</div>
          <div className="text-sm font-bold tabular-nums text-indigo-700">{formatMoney(totales.transferencia)}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2">
          <div className="text-[11px] text-zinc-500 font-medium">Crédito</div>
          <div className="text-sm font-bold tabular-nums text-amber-700">{formatMoney(totales.credito)}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2">
          <div className="text-[11px] text-zinc-500 font-medium">Propinas</div>
          <div className="text-sm font-bold tabular-nums text-zinc-900">{formatMoney(totales.propinas)}</div>
        </div>
        <div className="bg-white border border-rose-200 rounded-lg px-3 py-2">
          <div className="text-[11px] text-rose-600 font-medium">Devoluciones / Consumo</div>
          <div className="text-xs font-bold tabular-nums text-rose-700">
            -{formatMoney(totales.totalDevoluciones)} · <span className="text-zinc-600">{formatMoney(totales.totalConsumo)}</span>
          </div>
        </div>
      </div>

      {/* 2. Sub-navegación táctil + Filtros */}
      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'FACTURAS', label: `Facturas y Devoluciones (${allTickets.length})` },
                { id: 'TOTALIZADOS', label: 'Totalizados por Mesa y Mesero' },
                { id: 'CONSUMOS', label: `Consumos Internos (${consumosInternosHoy.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer border transition ${
                  subTab === t.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar # factura, cliente, mesero, producto..."
              className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {subTab === 'FACTURAS' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-100">
            {(
              [
                { id: 'TODOS', label: 'Todos' },
                { id: 'CONSUMO', label: 'Solo Consumo' },
                { id: 'DEVOLUCIONES', label: `Con Devolución (${devolucionesDia.length})` },
                { id: 'CREDITO', label: 'Créditos' },
              ] as const
            ).map((qf) => (
              <button
                key={qf.id}
                type="button"
                onClick={() => setQuickFilter(qf.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                  quickFilter === qf.id
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                {qf.label}
              </button>
            ))}

            <span className="h-5 w-px bg-zinc-200 mx-1" />

            <select
              value={cajaFilter}
              onChange={(e) => setCajaFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-300 bg-zinc-50 text-zinc-900 outline-none focus:border-zinc-900 cursor-pointer"
            >
              <option value="TODAS">Caja: Todas</option>
              {cajasDisponibles.map((c) => (
                <option key={c} value={c}>
                  Caja: {c}{c === currentCajaNombre ? ' (Esta PC)' : ''}
                </option>
              ))}
            </select>

            <select
              value={metodoFilter}
              onChange={(e) => setMetodoFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-300 bg-blue-50/70 text-blue-950 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="TODOS">Pago: Todos</option>
              <option value="EFECTIVO">Pago: Efectivo</option>
              <option value="DATAFONO">Pago: Datáfono</option>
              <option value="TRANSFERENCIA">Pago: Transferencia</option>
              <option value="CREDITO">Pago: Crédito</option>
              <option value="MIXTO">Pago: Mixto</option>
            </select>

            <select
              value={meseroFilter}
              onChange={(e) => setMeseroFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-300 bg-emerald-50/70 text-emerald-950 outline-none focus:border-emerald-500 cursor-pointer"
            >
              {meserosUnicos.map((ms) => (
                <option key={ms} value={ms}>
                  {ms === 'TODOS' ? 'Mesero: Todos' : `Mesero: ${ms}`}
                </option>
              ))}
            </select>

            <select
              value={mesaFilter}
              onChange={(e) => setMesaFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-sky-300 bg-sky-50/70 text-sky-950 outline-none focus:border-sky-500 cursor-pointer"
            >
              {mesasUnicas.map((mc) => (
                <option key={mc} value={mc}>
                  {mc === 'TODOS' ? 'Mesa / Canal: Todos' : mc}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3. Contenido Principal */}
      {subTab === 'FACTURAS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Lista Izquierda de Facturas */}
          <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl flex flex-col min-h-0 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700 flex items-center justify-between">
              <span>Tickets Filtrados ({ticketsFiltrados.length})</span>
              <span className="text-[11px] font-normal text-zinc-500">Toca un ticket para ver detalle</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {ticketsFiltrados.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  No hay tickets que coincidan con los filtros seleccionados.
                </div>
              ) : (
                ticketsFiltrados.map((o) => {
                  const badge = getChannelBadge(o);
                  const devs = devolucionesPorOrden.get(o.id) || [];
                  const active = ordenActiva?.id === o.id;
                  const isConsumo = o.metodo_pago === 'CONSUMO_INTERNO';
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOrdenId(o.id)}
                      className={`w-full px-3.5 py-3 text-left flex items-center justify-between gap-2 cursor-pointer transition ${
                        active ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-zinc-950">{o.consecutivo}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.cls}`}>
                            {badge.label}
                          </span>
                          {isConsumo && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              CONSUMO
                            </span>
                          )}
                          {devs.length > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              DEV. ({devs.length})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-600 truncate">
                          Mesero: <b>{o.mesero_nombre || o.cajero_nombre}</b>
                          {o.cliente_nombre ? ` · Cliente: ${o.cliente_nombre}` : ''}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {o.metodo_pago} · Pagado: {formatColombiaTime(o.pagado_at || o.closed_at || o.created_at)}
                          {(() => {
                            const dur = formatElapsedDuration(o.created_at, o.pagado_at || o.closed_at);
                            return dur ? (
                              <span className="ml-1.5 text-amber-700 font-semibold">· ⏱ {dur}</span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-sm tabular-nums text-zinc-950">
                          {isConsumo ? '$0 (Ref ' + formatMoney(o.subtotal_bruto || o.gran_total) + ')' : formatMoney(o.gran_total)}
                        </div>
                        {Number(o.propina || 0) > 0 && (
                          <div className="text-[11px] font-semibold text-emerald-700 tabular-nums">
                            +{formatMoney(o.propina)} prop.
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Detalle Derecho Completo del Ticket */}
          <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl flex flex-col min-h-0 overflow-hidden">
            {isReadOnlyOtherCaja && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs font-semibold text-amber-900 flex items-center justify-between shrink-0">
                <span>
                  Visualizando ventas de {cajaFilter === 'TODAS' ? (ordenActiva?.caja_nombre || 'otra caja') : cajaFilter} — Solo consulta (devoluciones deshabilitadas)
                </span>
              </div>
            )}
            {ordenActiva ? (
              <>
                <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-zinc-950">{ordenActiva.consecutivo}</h3>
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getChannelBadge(ordenActiva).cls}`}>
                        {getChannelBadge(ordenActiva).label}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-zinc-900 text-white">
                        {ordenActiva.metodo_pago}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        Mesero: <b className="text-zinc-900">{ordenActiva.mesero_nombre || ordenActiva.cajero_nombre}</b>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        Pedido: <b>{formatColombiaTime(ordenActiva.created_at)}</b> · Pago:{' '}
                        <b>{formatColombiaTime(ordenActiva.pagado_at || ordenActiva.closed_at || ordenActiva.created_at)}</b>
                        {(() => {
                          const dur = formatElapsedDuration(
                            ordenActiva.created_at,
                            ordenActiva.pagado_at || ordenActiva.closed_at
                          );
                          return dur ? (
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900">
                              Duración: {dur}
                            </span>
                          ) : null;
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => void onReimprimirOrden(ordenActiva)}
                      className="px-3.5 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-bold text-zinc-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Reimprimir
                    </button>
                    {ordenActiva.metodo_pago !== 'CONSUMO_INTERNO' && !isReadOnlyOtherCaja && (
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() => {
                          setDevItem(null);
                          setDevFullTicket(true);
                          setDevMotivo('Devolución completa de ticket');
                        }}
                        className="px-3.5 py-2 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-800 flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Devolver Ticket Completo
                      </button>
                    )}
                  </div>
                </div>

                {/* Resumen Financiero Detallado del Ticket */}
                <div className="p-3 border-b border-zinc-200 grid grid-cols-2 sm:grid-cols-5 gap-2 bg-white shrink-0 text-xs">
                  <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="text-zinc-500">Total Ticket</div>
                    <div className="font-extrabold text-sm tabular-nums text-zinc-950">{formatMoney(ordenActiva.gran_total)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="text-zinc-500">Cantidad Pagada</div>
                    <div className="font-bold text-sm tabular-nums text-zinc-900">
                      {formatMoney(ordenActiva.efectivo_recibido || ordenActiva.gran_total)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="text-zinc-500">Devuelta / Cambio</div>
                    <div className="font-bold text-sm tabular-nums text-blue-700">
                      {formatMoney(ordenActiva.cambio_entregado || 0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="text-zinc-500">Propina</div>
                    <div className="font-bold text-sm tabular-nums text-emerald-700">
                      {formatMoney(ordenActiva.propina || 0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                    <div className="text-zinc-500">
                      {Number(ordenActiva.pago_credito || 0) > 0 || ordenActiva.metodo_pago === 'CREDITO'
                        ? 'Crédito Asignado a'
                        : 'Cliente / Beneficiario'}
                    </div>
                    <div className="font-bold text-xs text-zinc-900 truncate">
                      {ordenActiva.cliente_nombre || 'Público General'}
                    </div>
                  </div>
                </div>

                {ordenActiva.observaciones && (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 shrink-0">
                    <b>Observación:</b> {ordenActiva.observaciones}
                  </div>
                )}

                {/* Tabla de Productos del Ticket */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {(ordenActiva.items || []).map((it) => (
                    <div
                      key={it.id}
                      className="p-3 rounded-xl border border-zinc-200 bg-white flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-zinc-900">
                          {it.cantidad}x {it.nombre_producto}
                        </div>
                        <div className="text-xs text-zinc-500 tabular-nums">
                          {formatMoney(it.precio_unitario)} c/u · Subtotal: <b className="text-zinc-800">{formatMoney(it.subtotal)}</b>
                        </div>
                        {it.notas_comanda && (
                          <div className="mt-1 inline-block px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900">
                            Nota cocina: {it.notas_comanda}
                          </div>
                        )}
                      </div>
                      {ordenActiva.metodo_pago !== 'CONSUMO_INTERNO' && !isReadOnlyOtherCaja && (
                        <button
                          type="button"
                          onClick={() => {
                            setDevFullTicket(false);
                            setDevItem(it);
                            setDevCantidad(it.cantidad);
                            setDevMotivo('Devolución de producto');
                          }}
                          className="px-3.5 py-2 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Devolver
                        </button>
                      )}
                    </div>
                  ))}

                  {ordenActiva.pagos_detalle && ordenActiva.pagos_detalle.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Desglose de Transacciones y Devueltas ({ordenActiva.pagos_detalle.length})
                      </div>
                      <div className="space-y-1.5">
                        {ordenActiva.pagos_detalle.map((pg, idx) => (
                          <div
                            key={pg.id || idx}
                            className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/80 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white text-[10px] font-bold">
                                  Pago #{pg.numero_pago}
                                </span>
                                <span className="font-bold text-zinc-900">{pg.metodo_pago}</span>
                                {pg.nota && (
                                  <span className="text-zinc-500">· {pg.nota}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 tabular-nums">
                                <span className="font-extrabold text-zinc-900">
                                  Aplicado: {formatMoney(pg.monto_aplicado)}
                                </span>
                                {Number(pg.propina_monto || 0) > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    Propina: +{formatMoney(pg.propina_monto || 0)}
                                  </span>
                                )}
                                {pg.metodo_pago === 'EFECTIVO' && (
                                  <>
                                    <span className="text-zinc-600">
                                      Recibido: <b>{formatMoney(pg.monto_recibido)}</b>
                                    </span>
                                    <span className="text-blue-700 font-bold">
                                      Devuelta: {formatMoney(pg.cambio_devuelto)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {pg.items_pagados && pg.items_pagados.length > 0 && (
                              <div className="text-[11px] text-zinc-600">
                                Insumos: {pg.items_pagados.map((ip) => `${ip.cantidad}x ${ip.nombre_producto}`).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
                Selecciona una factura de la izquierda para ver su detalle completo.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-vista Totalizados por Mesa y por Mesero */}
      {subTab === 'TOTALIZADOS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0 overflow-hidden">
          <div className="bg-white border border-zinc-200 rounded-xl flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2 font-bold text-sm text-zinc-900">
              <Utensils className="w-4 h-4 text-sky-600" />
              Totalizado Ventas por Mesa / Canal
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {resumenPorMesa.map((r) => (
                <div key={r.label} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-bold text-zinc-900">{r.label}</div>
                    <div className="text-xs text-zinc-500">{r.count} facturas</div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="font-extrabold text-zinc-950">{formatMoney(r.total)}</div>
                    <div className="text-xs text-emerald-700">Propinas: {formatMoney(r.propinas)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2 font-bold text-sm text-zinc-900">
              <User className="w-4 h-4 text-emerald-600" />
              Totalizado Ventas y Propinas por Mesero
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {resumenPorMesero.map((r) => (
                <div key={r.label} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-bold text-zinc-900">{r.label}</div>
                    <div className="text-xs text-zinc-500">{r.count} facturas atendidas</div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="font-extrabold text-zinc-950">{formatMoney(r.total)}</div>
                    <div className="text-xs font-bold text-emerald-700">Propinas ganadas: {formatMoney(r.propinas)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-vista Consumos Internos */}
      {subTab === 'CONSUMOS' && (
        <div className="bg-white border border-zinc-200 rounded-xl flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-100">
          {consumosInternosHoy.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-400">
              No hay consumos internos ni cortesías registrados hoy.
            </div>
          ) : (
            consumosInternosHoy.map((c) => (
              <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-sm text-zinc-950">{c.consecutivo}</span>
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-bold">
                      {c.cliente_nombre || 'Consumo Interno'}
                    </span>
                    <span className="text-xs text-zinc-500">{formatColombiaTime(c.pagado_at || c.created_at)}</span>
                  </div>
                  {c.observaciones && <p className="text-xs text-zinc-600">{c.observaciones}</p>}
                  <p className="text-xs text-zinc-500">
                    {(c.items || []).map((i) => `${i.cantidad}x ${i.nombre_producto}`).join(', ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-zinc-500">Valor Referencial</div>
                  <div className="font-extrabold text-sm tabular-nums text-zinc-900">
                    {formatMoney(c.subtotal_bruto || c.gran_total)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Confirmación de Devolución (Insumo o Ticket Completo) */}
      {(devItem || devFullTicket) && ordenActiva && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-300 max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h4 className="font-bold text-base text-zinc-950">
                {devFullTicket
                  ? `Devolver Ticket Completo (${ordenActiva.consecutivo})`
                  : `Devolver: ${devItem?.nombre_producto}`}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setDevItem(null);
                  setDevFullTicket(false);
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!devFullTicket && devItem && (
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Cantidad a devolver (máx. {devItem.cantidad})
                </label>
                <input
                  type="number"
                  min={1}
                  max={devItem.cantidad}
                  value={devCantidad}
                  onChange={(e) => setDevCantidad(Number(e.target.value || 1))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-bold"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">Método de Reembolso</label>
              <div className="grid grid-cols-2 gap-2">
                {(['EFECTIVO', 'DATAFONO', 'TRANSFERENCIA', 'CREDITO'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDevMetodo(m)}
                    className={`py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      devMetodo === m
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Motivo de Devolución</label>
              <input
                type="text"
                value={devMotivo}
                onChange={(e) => setDevMotivo(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDevItem(null);
                  setDevFullTicket(false);
                }}
                className="px-4 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleConfirmReturn()}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Devolución
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
