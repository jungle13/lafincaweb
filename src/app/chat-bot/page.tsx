'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Send,
  Bot,
  User,
  RefreshCw,
  CheckCheck,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';

interface ConversacionUsuario {
  id: number;
  chat_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  rol?: string;
  ultimo_mensaje?: string;
  ultimo_mensaje_at?: string;
  total_mensajes?: number;
}

interface MensajeChat {
  id: string;
  chat_id: number;
  role: 'user' | 'model' | 'assistant';
  content: string;
  created_at: string;
}

const AVATAR_COLORS = [
  'bg-[#00a884]',
  'bg-emerald-700',
  'bg-teal-700',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-cyan-700',
  'bg-purple-600',
  'bg-blue-600',
];

function getAvatarColor(name: string = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function formatHora(fechaIso?: string) {
  if (!fechaIso) return '';
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatFechaBadge(fechaIso?: string) {
  if (!fechaIso) return '';
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return '';
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return formatHora(fechaIso);
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function ChatBotPage() {
  const [conversaciones, setConversaciones] = useState<ConversacionUsuario[]>([]);
  const [conversacionActiva, setConversacionActiva] = useState<ConversacionUsuario | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTab, setFiltroTab] = useState<'todos' | 'hoy'>('todos');
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [manualSpin, setManualSpin] = useState(false);

  // Registro de últimos mensajes vistos
  const [vistosMap, setVistosMap] = useState<Record<number, string>>({});

  const conversacionActivaRef = useRef<ConversacionUsuario | null>(null);
  conversacionActivaRef.current = conversacionActiva;

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll interno seguro que SOLO ajusta scrollTop del contenedor de mensajes
  // NUNCA usa scrollIntoView ni desplaza la ventana o los paneles superiores
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Cargar mapa de leídos desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('la_finca_bot_vistos');
      if (saved) setVistosMap(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const marcarComoVisto = (chatId: number, fechaMsg?: string) => {
    if (!fechaMsg) return;
    setVistosMap((prev) => {
      const updated = { ...prev, [chatId]: fechaMsg };
      try {
        localStorage.setItem('la_finca_bot_vistos', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // 1. Cargar lista de conversaciones (NUNCA auto-selecciona chat ni mueve al usuario)
  const cargarConversaciones = async (silencioso = false) => {
    if (!silencioso) setCargandoLista(true);
    try {
      const res = await fetch('/api/telegram/conversaciones');
      const data = await res.json();
      if (data.ok && Array.isArray(data.conversaciones)) {
        setConversaciones(data.conversaciones);

        // Si ya hay un chat abierto por el usuario, actualizar mensajes en silencio
        const actual = conversacionActivaRef.current;
        if (actual) {
          const chatActualizado = data.conversaciones.find((c: any) => c.chat_id === actual.chat_id);
          if (chatActualizado && chatActualizado.ultimo_mensaje_at !== actual.ultimo_mensaje_at) {
            cargarMensajesSilencioso(actual.chat_id);
            marcarComoVisto(actual.chat_id, chatActualizado.ultimo_mensaje_at);
          }
        }
      }
    } catch (e) {
      console.error('Error cargando conversaciones:', e);
    } finally {
      if (!silencioso) setCargandoLista(false);
    }
  };

  // Refrescar silenciosamente mensajes del chat activo sin loaders intrusivos
  const cargarMensajesSilencioso = async (chatId: number) => {
    try {
      const res = await fetch(`/api/telegram/conversaciones/${chatId}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.mensajes)) {
        setMensajes(data.mensajes);
        setTimeout(() => scrollToBottom(), 50);
      }
    } catch (e) {}
  };

  // 2. Selección explícita de conversación por parte del usuario
  const seleccionarConversacion = async (usuario: ConversacionUsuario) => {
    setConversacionActiva(usuario);
    marcarComoVisto(usuario.chat_id, usuario.ultimo_mensaje_at);
    setCargandoMensajes(true);
    try {
      const res = await fetch(`/api/telegram/conversaciones/${usuario.chat_id}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.mensajes)) {
        setMensajes(data.mensajes);
        setTimeout(() => scrollToBottom(), 50);
      }
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    } finally {
      setCargandoMensajes(false);
    }
  };

  // Carga inicial y sondeo periódico silencioso cada 10 segundos
  useEffect(() => {
    cargarConversaciones(false);
    const interval = setInterval(() => {
      cargarConversaciones(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Enviar mensaje manual
  const handleEnviarMensaje = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nuevoMensaje.trim() || !conversacionActiva || enviando) return;

    const textoAEnviar = nuevoMensaje.trim();
    setNuevoMensaje('');
    setEnviando(true);

    try {
      const res = await fetch(`/api/telegram/conversaciones/${conversacionActiva.chat_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoAEnviar }),
      });
      const data = await res.json();
      if (data.ok) {
        setMensajes((prev) => [
          ...prev,
          {
            id: 'temp-' + Date.now(),
            chat_id: conversacionActiva.chat_id,
            role: 'model',
            content: textoAEnviar,
            created_at: new Date().toISOString(),
          },
        ]);
        marcarComoVisto(conversacionActiva.chat_id, new Date().toISOString());
        setTimeout(() => scrollToBottom(), 60);
        cargarConversaciones(true);
      } else {
        alert('Error enviando mensaje: ' + (data.error || 'Desconocido'));
      }
    } catch (err: any) {
      alert('Error en red al enviar: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleManualRefresh = () => {
    setManualSpin(true);
    cargarConversaciones(true).finally(() => {
      if (conversacionActiva) cargarMensajesSilencioso(conversacionActiva.chat_id);
      setTimeout(() => setManualSpin(false), 500);
    });
  };

  // Filtrado de conversaciones
  const conversacionesFiltradas = conversaciones.filter((c) => {
    const nombreCompleto = `${c.first_name} ${c.last_name || ''} ${c.username || ''}`.toLowerCase();
    const coincideBusqueda =
      nombreCompleto.includes(busqueda.toLowerCase()) ||
      (c.ultimo_mensaje || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      String(c.chat_id).includes(busqueda);

    if (!coincideBusqueda) return false;
    if (filtroTab === 'hoy') {
      const d = c.ultimo_mensaje_at ? new Date(c.ultimo_mensaje_at) : null;
      return d && d.toDateString() === new Date().toDateString();
    }
    return true;
  });

  return (
    <div className="flex h-full max-h-full w-full overflow-hidden bg-[#0c1317] font-sans antialiased text-[#e9edef] select-none overscroll-none">
      {/* ========================================================================= */}
      {/* 1. PANEL IZQUIERDO: LISTA DE CHATS (SIEMPRE VISIBLE EN TABLET/DESKTOP)     */}
      {/* ========================================================================= */}
      <aside
        className={`w-full sm:w-[320px] md:w-[360px] lg:w-[400px] flex-shrink-0 flex flex-col bg-[#111b21] border-r border-[#222d34] h-full max-h-full overflow-hidden overscroll-none ${
          conversacionActiva ? 'hidden sm:flex' : 'flex'
        }`}
      >
        {/* Cabecera Izquierda Fija */}
        <div className="h-14 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222d34] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center text-white text-base shadow font-bold">
              🥩
            </div>
            <div>
              <h1 className="text-[14px] font-semibold text-[#e9edef] leading-tight flex items-center gap-1.5">
                Telegram Bot
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              </h1>
              <p className="text-[11px] text-[#8696a0] leading-none">@Finca_Eliana_bot</p>
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
            title="Refrescar chats"
            className="p-2 text-[#aebac1] hover:text-white hover:bg-[#374248] rounded-full transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${manualSpin ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Buscador Fijo */}
        <div className="p-2 bg-[#111b21] flex-shrink-0 border-b border-[#222d34]/40">
          <div className="relative flex items-center bg-[#202c33] rounded-lg px-3 py-1.5 text-sm">
            <Search className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar un chat..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-transparent text-[#d1d7db] placeholder-[#8696a0] text-[13px] outline-none"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="text-[#8696a0] hover:text-white text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Chips de filtro */}
          <div className="flex items-center gap-2 mt-2 px-1">
            <button
              onClick={() => setFiltroTab('todos')}
              className={`text-xs px-3 py-0.5 rounded-full transition-colors font-medium ${
                filtroTab === 'todos'
                  ? 'bg-[#00a884] text-[#111b21]'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroTab('hoy')}
              className={`text-xs px-3 py-0.5 rounded-full transition-colors font-medium ${
                filtroTab === 'hoy'
                  ? 'bg-[#00a884] text-[#111b21]'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              Hoy
            </button>
            <span className="text-[11px] text-[#8696a0] ml-auto font-mono">
              {conversacionesFiltradas.length} {conversacionesFiltradas.length === 1 ? 'chat' : 'chats'}
            </span>
          </div>
        </div>

        {/* Lista de hilos con scroll interno independiente y overscroll contenido */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-[#222d34]/60">
          {cargandoLista ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#8696a0] text-xs gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
              <span>Cargando conversaciones...</span>
            </div>
          ) : conversacionesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-[#8696a0] text-xs">
              No se encontraron conversaciones.
            </div>
          ) : (
            conversacionesFiltradas.map((c) => {
              const estaSeleccionado = conversacionActiva?.chat_id === c.chat_id;
              const nombreCompleto = `${c.first_name} ${c.last_name || ''}`.trim();
              const iniciales = (
                (c.first_name?.[0] || '') + (c.last_name?.[0] || '')
              ).toUpperCase() || 'U';

              const tieneMensajeNuevo =
                c.ultimo_mensaje_at &&
                (!vistosMap[c.chat_id] || c.ultimo_mensaje_at > vistosMap[c.chat_id]) &&
                conversacionActiva?.chat_id !== c.chat_id;

              return (
                <div
                  key={c.chat_id}
                  onClick={() => seleccionarConversacion(c)}
                  className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-colors ${
                    estaSeleccionado ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-[15px] shadow-sm relative ${getAvatarColor(
                      nombreCompleto
                    )}`}
                  >
                    {iniciales}
                    {tieneMensajeNuevo && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#111b21]" />
                    )}
                  </div>

                  {/* Detalle */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between leading-tight mb-1">
                      <h2 className="text-[14px] font-medium text-[#e9edef] truncate flex items-center gap-1.5">
                        {nombreCompleto}
                        {c.username && (
                          <span className="text-[11px] text-[#8696a0] font-normal truncate">
                            @{c.username}
                          </span>
                        )}
                      </h2>
                      <span
                        className={`text-[11px] flex-shrink-0 ${
                          tieneMensajeNuevo ? 'text-emerald-400 font-semibold' : 'text-[#8696a0]'
                        }`}
                      >
                        {formatFechaBadge(c.ultimo_mensaje_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[12px] text-[#8696a0] leading-snug">
                      <p className="truncate flex-1 pr-2">
                        {c.ultimo_mensaje || 'Sin mensajes aún'}
                      </p>
                      {tieneMensajeNuevo ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                      ) : c.total_mensajes ? (
                        <span className="text-[10px] bg-[#202c33] text-[#8696a0] px-1.5 py-0.5 rounded-full border border-[#2a3942]">
                          {c.total_mensajes}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. PANEL DERECHO: VISOR DE CHAT Y MENSAJES                                 */}
      {/* ========================================================================= */}
      <section
        className={`flex-1 flex flex-col bg-[#0b141a] h-full max-h-full overflow-hidden min-w-0 relative overscroll-none ${
          conversacionActiva ? 'flex' : 'hidden sm:flex'
        }`}
      >
        {conversacionActiva ? (
          <>
            {/* Header Chat Activo Fijo */}
            <div className="h-14 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222d34] flex-shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setConversacionActiva(null)}
                  className="sm:hidden p-1.5 text-[#aebac1] hover:text-white hover:bg-[#374248] rounded-full mr-1"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div
                  className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm shadow-sm ${getAvatarColor(
                    `${conversacionActiva.first_name} ${conversacionActiva.last_name || ''}`
                  )}`}
                >
                  {(
                    (conversacionActiva.first_name?.[0] || '') +
                    (conversacionActiva.last_name?.[0] || '')
                  ).toUpperCase() || 'U'}
                </div>

                <div className="min-w-0">
                  <h2 className="text-[14px] font-medium text-[#e9edef] truncate leading-tight">
                    {conversacionActiva.first_name} {conversacionActiva.last_name || ''}
                  </h2>
                  <p className="text-[11px] text-[#8696a0] truncate leading-tight">
                    {conversacionActiva.username
                      ? `@${conversacionActiva.username}`
                      : 'En línea • Telegram'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setCargandoMensajes(true);
                  cargarMensajesSilencioso(conversacionActiva.chat_id).finally(() =>
                    setCargandoMensajes(false)
                  );
                }}
                title="Actualizar conversación"
                className="p-2 text-[#aebac1] hover:text-white hover:bg-[#374248] rounded-full transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${cargandoMensajes ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>

            {/* Mensajes del Chat con scroll interno seguro y overscroll contenido */}
            <div
              ref={messagesContainerRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-10 py-4 space-y-2.5 relative"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 50% 50%, rgba(17, 27, 33, 0.95) 0%, rgba(11, 20, 26, 1) 100%)',
              }}
            >
              {/* Badge Informativo */}
              <div className="flex justify-center my-1">
                <div className="bg-[#182229] border border-[#222d34] px-3 py-1 rounded-md text-center max-w-md shadow-sm">
                  <p className="text-[10px] text-[#ffd279] flex items-center justify-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3 h-3 flex-shrink-0 text-amber-400" />
                    Auditoría sincronizada en tiempo real con Supabase y Telegram Bot API.
                  </p>
                </div>
              </div>

              {cargandoMensajes && mensajes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-[#8696a0] text-xs gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
                  <span>Cargando mensajes...</span>
                </div>
              ) : mensajes.length === 0 ? (
                <div className="text-center text-[#8696a0] text-xs py-12">
                  No hay mensajes registrados en este chat.
                </div>
              ) : (
                mensajes.map((m, idx) => {
                  const esUsuario = m.role === 'user';

                  return (
                    <div
                      key={m.id || idx}
                      className={`flex w-full ${esUsuario ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`relative max-w-[88%] md:max-w-[75%] rounded-lg px-3 py-1.5 text-[13.5px] leading-relaxed shadow-sm ${
                          esUsuario
                            ? 'bg-[#005c4b] text-white rounded-tr-none'
                            : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[#2a3942]/60'
                        }`}
                      >
                        {/* Remitente */}
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-80 flex items-center gap-1">
                          {esUsuario ? (
                            <>
                              <User className="w-2.5 h-2.5" />
                              {conversacionActiva.first_name}
                            </>
                          ) : (
                            <>
                              <Bot className="w-2.5 h-2.5 text-emerald-400" />
                              <span className="text-emerald-300">Asistente La Finca (IA)</span>
                            </>
                          )}
                        </div>

                        {/* Contenido */}
                        <div className="whitespace-pre-wrap break-words font-normal">
                          {m.content}
                        </div>

                        {/* Hora y check */}
                        <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-white/60">
                          <span>{formatHora(m.created_at)}</span>
                          {esUsuario && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Bar Fija */}
            <form
              onSubmit={handleEnviarMensaje}
              className="h-14 px-3 md:px-4 bg-[#202c33] flex items-center gap-2 md:gap-3 border-t border-[#222d34] flex-shrink-0"
            >
              <input
                type="text"
                placeholder={`Responder a ${conversacionActiva.first_name} en Telegram...`}
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                disabled={enviando}
                className="flex-1 bg-[#2a3942] text-[#d1d7db] placeholder-[#8696a0] text-sm px-4 py-2 rounded-lg outline-none focus:ring-1 focus:ring-[#00a884] transition"
              />
              <button
                type="submit"
                disabled={!nuevoMensaje.trim() || enviando}
                className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#02906f] disabled:opacity-40 disabled:hover:bg-[#00a884] flex items-center justify-center text-[#111b21] transition shadow flex-shrink-0"
                title="Enviar mensaje a Telegram"
              >
                {enviando ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#111b21]" />
                ) : (
                  <Send className="w-4 h-4 text-[#111b21]" />
                )}
              </button>
            </form>
          </>
        ) : (
          /* Estado Vacío elegante cuando no hay chat seleccionado */
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center select-none bg-[#111b21]">
            <div className="w-20 h-20 rounded-full bg-[#202c33] flex items-center justify-center text-3xl shadow-xl mb-5 border border-[#2a3942]">
              💬
            </div>
            <h2 className="text-xl font-light text-[#e9edef] mb-2">
              Historial de Telegram de La Finca
            </h2>
            <p className="text-xs text-[#8696a0] max-w-md leading-relaxed mb-6">
              Audita las interacciones, preguntas operativas y respuestas emitidas por el asistente en tiempo real. Selecciona una persona de la lista izquierda para comenzar.
            </p>

            <div className="flex items-center gap-2 text-[11px] text-[#8696a0] bg-[#202c33]/70 px-4 py-1.5 rounded-full border border-[#2a3942]/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conexión cifrada con Telegram Bot API y Supabase</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
