'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type DestinatarioKey = 'eliana' | 'arturo' | 'admin';

interface NotificacionItem {
  id: string;
  evento_tipo: 'FACTURA_COMPRA' | 'CAJA_MENOR' | 'VENTAS_DIA';
  titulo: string;
  contenido: string;
  fecha_evento: string;
  referencia_id?: string | null;
  modulo_origen: string;
  estado: 'PENDIENTE' | 'ENVIADA';
  canal_telegram: boolean;
  canal_correo: boolean;
  destinatarios: DestinatarioKey[];
  enviado_por?: string | null;
  enviado_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

const DESTINATARIOS_OPCIONES: Array<{ key: 'eliana' | 'arturo'; nombre: string; cargo: string }> = [
  { key: 'eliana', nombre: 'Eliana Garces', cargo: 'Administración' },
  { key: 'arturo', nombre: 'Arturo Rivera', cargo: 'Operación' },
];

export default function NotificacionesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.username?.toLowerCase() === 'admin';

  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'PENDIENTE' | 'ENVIADA'>('TODOS');
  const [filtroEvento, setFiltroEvento] = useState<'TODOS' | 'FACTURA_COMPRA' | 'CAJA_MENOR' | 'VENTAS_DIA'>('TODOS');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftDestinatarios, setDraftDestinatarios] = useState<Record<string, DestinatarioKey[]>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchNotificaciones = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/notificaciones', {
        cache: 'no-store',
        headers: {
          'x-admin-user': user?.username || '',
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudieron cargar las notificaciones.');
      }
      const list: NotificacionItem[] = data.notificaciones || [];
      setNotificaciones(list);

      const initialDrafts: Record<string, DestinatarioKey[]> = {};
      for (const n of list) {
        initialDrafts[n.id] = Array.isArray(n.destinatarios) ? n.destinatarios : ['eliana', 'arturo'];
      }
      setDraftDestinatarios(initialDrafts);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error consultando notificaciones.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.username]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchNotificaciones();
    } else if (!authLoading && !isAdmin) {
      setLoading(false);
    }
  }, [authLoading, isAdmin, fetchNotificaciones]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const toggleDestinatario = (notifId: string, key: 'eliana' | 'arturo') => {
    setDraftDestinatarios((prev) => {
      const current = prev[notifId] || ['eliana', 'arturo'];
      const exists = current.includes(key);
      const next = exists ? current.filter((k) => k !== key) : [...current, key];
      return { ...prev, [notifId]: next };
    });
  };

  const handleDejarPendiente = async (notif: NotificacionItem) => {
    const dests = draftDestinatarios[notif.id] || notif.destinatarios || [];
    setSubmittingId(notif.id);
    try {
      const res = await fetch('/api/notificaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': user?.username || '',
        },
        body: JSON.stringify({
          action: 'DEJAR_PENDIENTE',
          id: notif.id,
          destinatarios: dests,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error guardando estado.');

      setNotificaciones((prev) => prev.map((n) => (n.id === notif.id ? data.notificacion : n)));
      setExpandedId(null);
      showToast('Notificación guardada en estado Pendiente.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo actualizar la notificación.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleAprobarYEnviar = async (notif: NotificacionItem) => {
    const dests = draftDestinatarios[notif.id] || notif.destinatarios || [];
    if (dests.length === 0) {
      setErrorMsg('Selecciona al menos un destinatario (Eliana o Arturo) antes de enviar.');
      return;
    }
    setSubmittingId(notif.id);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/notificaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': user?.username || '',
        },
        body: JSON.stringify({
          action: 'APROBAR_Y_ENVIAR',
          id: notif.id,
          destinatarios: dests,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error enviando por Telegram.');

      setNotificaciones((prev) => prev.map((n) => (n.id === notif.id ? data.notificacion : n)));
      showToast('Notificación aprobada y enviada por Telegram.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error enviando la notificación.');
    } finally {
      setSubmittingId(null);
    }
  };

  const filtradas = useMemo(() => {
    return notificaciones.filter((n) => {
      if (filtroEstado !== 'TODOS' && n.estado !== filtroEstado) return false;
      if (filtroEvento !== 'TODOS' && n.evento_tipo !== filtroEvento) return false;
      return true;
    });
  }, [notificaciones, filtroEstado, filtroEvento]);

  const resumen = useMemo(() => {
    const pendientes = notificaciones.filter((n) => n.estado === 'PENDIENTE').length;
    const enviadas = notificaciones.filter((n) => n.estado === 'ENVIADA').length;
    return { total: notificaciones.length, pendientes, enviadas };
  }, [notificaciones]);

  if (authLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Verificando permisos de Administrador...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto mt-8">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3 shadow-2xs">
          <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Acceso Exclusivo de Administrador</h1>
          <p className="text-xs text-slate-500">
            Solo el usuario Administrador puede revisar, aprobar o enviar notificaciones del sistema.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const getEventoBadge = (tipo: NotificacionItem['evento_tipo']) => {
    if (tipo === 'FACTURA_COMPRA') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
          Factura de Compra
        </span>
      );
    }
    if (tipo === 'CAJA_MENOR') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Libro de Caja
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        Ventas del Día
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header limpio */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Centro de Notificaciones</h1>
            <p className="text-xs text-slate-500">
              Las notificaciones se generan en estado pendiente para tu aprobación antes de enviarse por Telegram.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" />
            {resumen.pendientes} Pendientes
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {resumen.enviadas} Enviadas
          </span>
          <button
            type="button"
            onClick={fetchNotificaciones}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between">
          <span>{toastMsg}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5">
          {(['TODOS', 'PENDIENTE', 'ENVIADA'] as const).map((est) => (
            <button
              key={est}
              type="button"
              onClick={() => setFiltroEstado(est)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filtroEstado === est
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {est === 'TODOS' ? `Todas (${resumen.total})` : est === 'PENDIENTE' ? `Pendientes (${resumen.pendientes})` : `Enviadas (${resumen.enviadas})`}
            </button>
          ))}
        </div>

        <select
          value={filtroEvento}
          onChange={(e) => setFiltroEvento(e.target.value as any)}
          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-slate-500"
        >
          <option value="TODOS">Todos los módulos</option>
          <option value="FACTURA_COMPRA">Facturas de Compra</option>
          <option value="CAJA_MENOR">Libro de Caja</option>
          <option value="VENTAS_DIA">Ventas del Día</option>
        </select>
      </div>

      {/* Listado limpio de notificaciones (sin ventanas modales) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden divide-y divide-slate-200">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">Cargando notificaciones...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No hay notificaciones registradas con los filtros seleccionados.
          </div>
        ) : (
          filtradas.map((notif) => {
            const isExpanded = expandedId === notif.id;
            const currentDests = draftDestinatarios[notif.id] || notif.destinatarios || [];
            const isBusy = submittingId === notif.id;

            return (
              <div key={notif.id} className="transition-colors">
                {/* Fila principal del listado */}
                <div className="px-4 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 hover:bg-slate-50/70">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {notif.estado === 'PENDIENTE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pendiente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Enviada
                        </span>
                      )}

                      {getEventoBadge(notif.evento_tipo)}

                      <span className="text-[11px] text-slate-400 font-mono">
                        {notif.fecha_evento}
                      </span>
                    </div>

                    <h2 className="text-sm font-semibold text-slate-900 truncate">
                      {notif.titulo}
                    </h2>

                    <p className="text-xs text-slate-500 line-clamp-1">
                      {notif.contenido.replace(/\*/g, '').replace(/\n+/g, ' · ')}
                    </p>
                  </div>

                  {/* Destinatarios, Medio y Botón Ver */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {/* Destinatarios */}
                    <div className="flex items-center gap-1">
                      {currentDests.length === 0 ? (
                        <span className="text-[11px] text-red-500 font-medium">Sin destinatarios</span>
                      ) : (
                        currentDests.map((dKey) => (
                          <span
                            key={dKey}
                            className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium capitalize"
                          >
                            {dKey}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Medio de envío: Telegram activo + Correo deshabilitado */}
                    <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                      <span
                        title="Envío por Telegram activo"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-semibold"
                      >
                        <Send className="w-3 h-3" />
                        Telegram
                      </span>
                      <span
                        title="Correo electrónico desactivado (Próximamente)"
                        className="inline-flex items-center justify-center p-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-400 opacity-45 cursor-not-allowed"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    {/* Botón Ver (despliega inline sin modal) */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : notif.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Panel desplegable inline (sin modal) */}
                {isExpanded && (
                  <div className="bg-slate-50/90 border-t border-slate-200 px-5 py-4 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Contenido exacto del mensaje */}
                      <div className="lg:col-span-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Mensaje que se enviará por Telegram
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Generada: {new Date(notif.created_at).toLocaleString('es-CO')}
                          </span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3.5 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                          {notif.contenido.replace(/\*/g, '')}
                        </div>

                        {notif.metadata?.url_detalle && (
                          <div className="pt-1">
                            <Link
                              href={notif.metadata.url_detalle}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                            >
                              Abrir detalle de la factura en Compras →
                            </Link>
                          </div>
                        )}

                        {notif.metadata?.telegram_button && (
                          <div className="text-[11px] text-slate-500">
                            Botón incluido en Telegram:{' '}
                            <span className="font-semibold text-slate-700">
                              {notif.metadata.telegram_button.text}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Destinatarios y aprobación */}
                      <div className="space-y-3 bg-white border border-slate-200 rounded-lg p-3.5">
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                            Destinatarios (Agregar o Eliminar)
                          </span>
                          <div className="flex flex-col gap-2">
                            {DESTINATARIOS_OPCIONES.map((dest) => {
                              const selected = currentDests.includes(dest.key);
                              return (
                                <button
                                  key={dest.key}
                                  type="button"
                                  disabled={notif.estado === 'ENVIADA' || isBusy}
                                  onClick={() => toggleDestinatario(notif.id, dest.key)}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                                    notif.estado === 'ENVIADA' ? 'cursor-default opacity-80' : 'cursor-pointer'
                                  } ${
                                    selected
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="text-left">
                                    <div className="font-semibold">{dest.nombre}</div>
                                    <div className={`text-[10px] ${selected ? 'text-slate-300' : 'text-slate-400'}`}>
                                      {dest.cargo}
                                    </div>
                                  </div>
                                  {selected ? (
                                    <UserCheck className="w-4 h-4 shrink-0" />
                                  ) : (
                                    <UserPlus className="w-4 h-4 shrink-0 text-slate-400" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {notif.estado === 'PENDIENTE' ? (
                          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                            <button
                              type="button"
                              disabled={isBusy || currentDests.length === 0}
                              onClick={() => handleAprobarYEnviar(notif)}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {isBusy ? 'Enviando...' : 'Aprobar y Enviar por Telegram'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDejarPendiente(notif)}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Dejar Pendiente
                            </button>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-slate-100 text-xs text-emerald-700 space-y-1">
                            <div className="font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              Notificación Enviada
                            </div>
                            {notif.enviado_at && (
                              <div className="text-[11px] text-slate-500">
                                {new Date(notif.enviado_at).toLocaleString('es-CO')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
