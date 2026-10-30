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
  MessageSquare,
  Sparkles,
  Phone,
  Video,
  MoreVertical,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
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

// Generador de color de avatar según nombre
const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-teal-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-cyan-600',
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
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
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
  const [actualizando, setActualizando] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Cargar lista de conversaciones
  const cargarConversaciones = async (silencioso = false) => {
    if (!silencioso) setCargandoLista(true);
    setActualizando(true);
    try {
      const res = await fetch('/api/telegram/conversaciones');
      const data = await res.json();
      if (data.ok && Array.isArray(data.conversaciones)) {
        setConversaciones(data.conversaciones);
        // Si no hay activa y hay conversaciones en desktop, seleccionar la primera
        if (!conversacionActiva && data.conversaciones.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
          seleccionarConversacion(data.conversaciones[0]);
        }
      }
    } catch (e) {
      console.error('Error cargando conversaciones:', e);
    } finally {
      setCargandoLista(false);
      setActualizando(false);
    }
  };

  // 2. Cargar mensajes de la conversación seleccionada
  const seleccionarConversacion = async (usuario: ConversacionUsuario) => {
    setConversacionActiva(usuario);
    setCargandoMensajes(true);
    try {
      const res = await fetch(`/api/telegram/conversaciones/${usuario.chat_id}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.mensajes)) {
        setMensajes(data.mensajes);
      }
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    } finally {
      setCargandoMensajes(false);
    }
  };

  useEffect(() => {
    cargarConversaciones();
    // Auto-refresco silencioso cada 15 segundos
    const interval = setInterval(() => {
      cargarConversaciones(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Scroll automático hacia el último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Enviar respuesta administrativa manual al chat de Telegram
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
        // Añadir a mensajes en tiempo real
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
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[#0c1317] font-sans antialiased text-[#e9edef]">
      {/* ========================================================================= */}
      {/* 1. PANEL IZQUIERDO: LISTA DE CONVERSACIONES (ESTILO WHATSAPP WEB)         */}
      {/* ========================================================================= */}
      <div
        className={`w-full md:w-[380px] lg:w-[420px] flex-shrink-0 flex flex-col bg-[#111b21] border-r border-[#222d34] ${
          conversacionActiva ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Cabecera de la lista */}
        <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222d34]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-700/80 flex items-center justify-center text-white shadow-inner font-bold">
              🥩
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-slate-100 flex items-center gap-1.5 leading-tight">
                Telegram Bot
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/30">
                  En Vivo
                </span>
              </h1>
              <p className="text-[11px] text-[#8696a0] leading-tight">@Finca_Eliana_bot</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => cargarConversaciones()}
              disabled={actualizando}
              title="Refrescar conversaciones"
              className="p-2 text-[#aebac1] hover:text-white hover:bg-[#374248] rounded-full transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${actualizando ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="p-2.5 bg-[#111b21]">
          <div className="relative flex items-center bg-[#202c33] rounded-lg px-3 py-1.5 text-sm">
            <Search className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar un chat o iniciar uno nuevo"
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
              className={`text-xs px-3 py-1 rounded-full transition-colors font-medium ${
                filtroTab === 'todos'
                  ? 'bg-[#00a884] text-[#111b21]'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroTab('hoy')}
              className={`text-xs px-3 py-1 rounded-full transition-colors font-medium ${
                filtroTab === 'hoy'
                  ? 'bg-[#00a884] text-[#111b21]'
                  : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              Hoy
            </button>
            <span className="text-[11px] text-[#8696a0] ml-auto">
              {conversacionesFiltradas.length} {conversacionesFiltradas.length === 1 ? 'chat' : 'chats'}
            </span>
          </div>
        </div>

        {/* Lista de hilos de conversación */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/60">
          {cargandoLista ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#8696a0] text-xs gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <span>Cargando conversaciones...</span>
            </div>
          ) : conversacionesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-[#8696a0] text-xs">
              No se encontraron conversaciones que coincidan con la búsqueda.
            </div>
          ) : (
            conversacionesFiltradas.map((c) => {
              const estaSeleccionado = conversacionActiva?.chat_id === c.chat_id;
              const nombreCompleto = `${c.first_name} ${c.last_name || ''}`.trim();
              const iniciales = (
                (c.first_name?.[0] || '') + (c.last_name?.[0] || '')
              ).toUpperCase() || 'U';

              return (
                <div
                  key={c.chat_id}
                  onClick={() => seleccionarConversacion(c)}
                  className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-colors ${
                    estaSeleccionado ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                  }`}
                >
                  {/* Avatar con iniciales */}
                  <div
                    className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-base shadow-sm ${getAvatarColor(
                      nombreCompleto
                    )}`}
                  >
                    {iniciales}
                  </div>

                  {/* Info del chat */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between leading-tight mb-1">
                      <h2 className="text-[15px] font-medium text-[#e9edef] truncate">
                        {nombreCompleto}
                      </h2>
                      <span className="text-[11px] text-[#8696a0] flex-shrink-0">
                        {formatFechaBadge(c.ultimo_mensaje_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[13px] text-[#8696a0] leading-snug">
                      <p className="truncate flex-1 pr-2">
                        {c.ultimo_mensaje || 'Sin mensajes aún'}
                      </p>
                      {c.total_mensajes ? (
                        <span className="text-[10px] bg-[#202c33] text-emerald-400 font-medium px-2 py-0.5 rounded-full border border-emerald-500/20">
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
      </div>

      {/* ========================================================================= */}
      {/* 2. PANEL DERECHO: VISOR DE CHAT Y MENSAJES (ESTILO WHATSAPP WEB)           */}
      {/* ========================================================================= */}
      <div
        className={`flex-1 flex flex-col bg-[#0b141a] relative ${
          conversacionActiva ? 'flex' : 'hidden md:flex'
        }`}
      >
        {conversacionActiva ? (
          <>
            {/* Header del Chat Activo */}
            <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222d34] flex-shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setConversacionActiva(null)}
                  className="md:hidden p-1.5 text-[#aebac1] hover:text-white hover:bg-[#374248] rounded-full mr-1"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div
                  className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold shadow-sm ${getAvatarColor(
                    `${conversacionActiva.first_name} ${conversacionActiva.last_name || ''}`
                  )}`}
                >
                  {(
                    (conversacionActiva.first_name?.[0] || '') +
                    (conversacionActiva.last_name?.[0] || '')
                  ).toUpperCase() || 'U'}
                </div>

                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-[#e9edef] truncate leading-tight">
                    {conversacionActiva.first_name} {conversacionActiva.last_name || ''}
                  </h2>
                  <p className="text-[11px] text-[#8696a0] truncate leading-tight flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Chat ID: {conversacionActiva.chat_id}</span>
                    {conversacionActiva.username && (
                      <span className="text-emerald-400">@{conversacionActiva.username}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => seleccionarConversacion(conversacionActiva)}
                  title="Actualizar mensajes"
                  className="p-2 text-[#aebac1] hover:text-white hover:bg-[#374248] rounded-full transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${cargandoMensajes ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Contenedor de Mensajes con Fondo Tipo WhatsApp */}
            <div
              className="flex-1 overflow-y-auto px-4 md:px-12 py-6 space-y-3 relative"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 50% 50%, rgba(17, 27, 33, 0.9) 0%, rgba(11, 20, 26, 0.98) 100%)',
              }}
            >
              {/* Aviso de Auditoría Segura */}
              <div className="flex justify-center my-2">
                <div className="bg-[#182229] border border-[#222d34] px-4 py-1.5 rounded-lg text-center max-w-md shadow-sm">
                  <p className="text-[11px] text-[#ffd279] flex items-center justify-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                    Historial de auditoría conectado a Groq IA y Supabase en tiempo real.
                  </p>
                </div>
              </div>

              {cargandoMensajes && mensajes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-[#8696a0] text-xs gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  <span>Cargando mensajes del usuario...</span>
                </div>
              ) : mensajes.length === 0 ? (
                <div className="text-center text-[#8696a0] text-xs py-12">
                  No hay mensajes registrados aún en este chat.
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
                        className={`relative max-w-[85%] md:max-w-[70%] rounded-lg px-3.5 py-2 text-[14px] leading-relaxed shadow-md ${
                          esUsuario
                            ? 'bg-[#005c4b] text-white rounded-tr-none'
                            : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[#2a3942]/60'
                        }`}
                      >
                        {/* Etiqueta de emisor */}
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-75 flex items-center gap-1">
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

                        {/* Texto del mensaje */}
                        <div className="whitespace-pre-wrap break-words font-normal">
                          {m.content}
                        </div>

                        {/* Hora y checkmarks */}
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/60">
                          <span>{formatHora(m.created_at)}</span>
                          {esUsuario && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Barra Inferior: Respuesta Administrativa Manual */}
            <form
              onSubmit={handleEnviarMensaje}
              className="h-16 px-4 bg-[#202c33] flex items-center gap-3 border-t border-[#222d34] flex-shrink-0"
            >
              <input
                type="text"
                placeholder={`Responder directamente a ${conversacionActiva.first_name} en Telegram...`}
                value={nuevoMensaje}
                onChange={(e) => setNuevoMensaje(e.target.value)}
                disabled={enviando}
                className="flex-1 bg-[#2a3942] text-[#d1d7db] placeholder-[#8696a0] text-sm px-4 py-2.5 rounded-lg outline-none focus:ring-1 focus:ring-[#00a884] transition"
              />
              <button
                type="submit"
                disabled={!nuevoMensaje.trim() || enviando}
                className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#02906f] disabled:opacity-40 disabled:hover:bg-[#00a884] flex items-center justify-center text-[#111b21] transition shadow-md flex-shrink-0"
                title="Enviar mensaje al chat de Telegram"
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
          /* Estado Vacío cuando no hay chat seleccionado (Estilo WhatsApp Web) */
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center select-none bg-[#111b21]">
            <div className="w-24 h-24 rounded-full bg-[#202c33] flex items-center justify-center text-4xl shadow-xl mb-6 border border-[#2a3942]">
              💬
            </div>
            <h2 className="text-2xl font-light text-[#e9edef] mb-2">
              Historial de Telegram de La Finca
            </h2>
            <p className="text-sm text-[#8696a0] max-w-md leading-relaxed mb-8">
              Audita en tiempo real las consultas operativas que hacen los administradores,
              socios y colaboradores al Bot de Telegram. Selecciona un chat de la lista izquierda para comenzar.
            </p>

            <div className="flex items-center gap-2 text-xs text-[#8696a0] bg-[#202c33]/70 px-4 py-2 rounded-full border border-[#2a3942]/60">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sincronizado de forma bidireccional con Telegram y Supabase</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
