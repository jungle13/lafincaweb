import { supabase } from '@/lib/supabase';
import { enviarMensajeConMenu, InlineKeyboardMarkup } from '@/services/telegramMenuService';
import { guardarMensajeChat } from '@/services/telegramBotService';

export type DestinatarioKey = 'eliana' | 'arturo' | 'admin';
export type EventoNotificacionTipo = 'FACTURA_COMPRA' | 'CAJA_MENOR' | 'VENTAS_DIA';
export type EstadoNotificacion = 'PENDIENTE' | 'ENVIADA';

export interface DestinatarioConfig {
  key: DestinatarioKey;
  nombre: string;
  rol: string;
  chatId: number;
  editableEnUI: boolean;
}

export const DESTINATARIOS_NOTIFICACION: Record<DestinatarioKey, DestinatarioConfig> = {
  eliana: {
    key: 'eliana',
    nombre: 'Eliana Garces',
    rol: 'Administración',
    chatId: 9064833515,
    editableEnUI: true,
  },
  arturo: {
    key: 'arturo',
    nombre: 'Arturo Rivera',
    rol: 'Operación',
    chatId: 9126609191,
    editableEnUI: true,
  },
  admin: {
    key: 'admin',
    nombre: 'Administrador',
    rol: 'Admin',
    chatId: 6566295870,
    editableEnUI: false,
  },
};

function sanitizeDestinatarios(input?: unknown): DestinatarioKey[] {
  if (!Array.isArray(input)) return ['eliana', 'arturo'];
  const valid = new Set<DestinatarioKey>();
  for (const item of input) {
    const k = String(item || '').trim().toLowerCase();
    if (k === 'eliana' || k === 'arturo' || k === 'admin') {
      valid.add(k);
    }
  }
  return Array.from(valid);
}

/**
 * Crea una notificación en estado PENDIENTE (nunca envía por Telegram automáticamente).
 */
export async function crearNotificacionPendiente(params: {
  evento_tipo: EventoNotificacionTipo;
  titulo: string;
  contenido: string;
  fecha_evento: string;
  referencia_id?: string | null;
  modulo_origen: string;
  destinatarios?: DestinatarioKey[];
  metadata?: Record<string, any>;
}) {
  const destinatarios = sanitizeDestinatarios(params.destinatarios);
  const { data, error } = await supabase
    .from('notificaciones_sistema')
    .insert({
      evento_tipo: params.evento_tipo,
      titulo: params.titulo,
      contenido: params.contenido,
      fecha_evento: params.fecha_evento,
      referencia_id: params.referencia_id || null,
      modulo_origen: params.modulo_origen,
      estado: 'PENDIENTE',
      canal_telegram: true,
      canal_correo: false,
      destinatarios: destinatarios.length > 0 ? destinatarios : ['eliana', 'arturo'],
      metadata: params.metadata || {},
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Notificación automática (en estado PENDIENTE) al registrar una Factura de Compra.
 * Regla: mostrar únicamente Proveedor, Valor de la factura y enlace al detalle en Compras.
 */
export async function crearNotificacionFacturaCompra(params: {
  compraId?: string;
  numeroFactura: string;
  proveedor: string;
  fecha: string;
  valorTotal: number;
  appBaseUrl?: string;
}) {
  const baseUrl = (params.appBaseUrl || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const relativePath = `/compras?factura=${encodeURIComponent(params.numeroFactura)}&fecha=${encodeURIComponent(params.fecha)}`;
  const fullUrl = baseUrl ? `${baseUrl}${relativePath}` : relativePath;
  const valorFormateado = `$${Math.round(Number(params.valorTotal || 0)).toLocaleString('es-CO')} COP`;

  const contenido = [
    '🧾 *Nueva Factura de Compra Registrada*',
    '',
    `• *Proveedor:* ${params.proveedor}`,
    `• *Valor de la Factura:* ${valorFormateado}`,
    '',
    '¿Desea ver el detalle de los insumos? Diríjase al siguiente enlace:',
    fullUrl,
  ].join('\n');

  const isPublicHttps = fullUrl.startsWith('https://') && !fullUrl.includes('localhost');

  return crearNotificacionPendiente({
    evento_tipo: 'FACTURA_COMPRA',
    titulo: `Factura de Compra #${params.numeroFactura} — ${params.proveedor}`,
    contenido,
    fecha_evento: params.fecha,
    referencia_id: params.compraId || params.numeroFactura,
    modulo_origen: 'Compras',
    destinatarios: ['eliana', 'arturo'],
    metadata: {
      numero_factura: params.numeroFactura,
      proveedor: params.proveedor,
      valor_total: Math.round(Number(params.valorTotal || 0)),
      fecha: params.fecha,
      url_detalle: relativePath,
      full_url: fullUrl,
      telegram_button: isPublicHttps
        ? {
            type: 'url',
            text: '🔎 Ver detalle de insumos en Compras',
            url: fullUrl,
          }
        : null,
    },
  });
}

/**
 * Notificación automática (en estado PENDIENTE) al registrar en Libro de Caja Menor.
 * Regla: mostrar desglose de qué se pagó; si la descripción es larga, incluir botón en Telegram
 * para desplegar el detalle completo de gastos/pagos de ese día.
 */
export async function crearNotificacionCajaMenor(params: {
  fecha: string;
  concepto: string;
  categoria?: string;
  monto: number;
  tipoMovimiento?: 'INGRESO' | 'GASTO';
  responsable?: string;
  observaciones?: string;
  detallesLista?: Array<{ concepto: string; valor: number }>;
}) {
  const montoFmt = `$${Math.round(Number(params.monto || 0)).toLocaleString('es-CO')} COP`;
  const esIngreso = params.tipoMovimiento === 'INGRESO';
  const etiquetaTipo = esIngreso ? 'Ingreso / Base' : 'Pago / Salida de Caja';

  const desgloseTexto =
    params.detallesLista && params.detallesLista.length > 0
      ? params.detallesLista
          .map((d) => `• ${d.concepto}: $${Math.round(Number(d.valor || 0)).toLocaleString('es-CO')} COP`)
          .join('\n')
      : `• *Concepto pagado:* ${params.concepto}\n• *Valor:* ${montoFmt}`;

  const obsClean = (params.observaciones || '').trim();
  const fullDesc = `${desgloseTexto}${obsClean ? `\n• *Detalle:* ${obsClean}` : ''}`;
  const esDescripcionLarga = fullDesc.length > 260 || (params.detallesLista?.length || 0) > 4;

  const resumenVisible = esDescripcionLarga
    ? `${fullDesc.slice(0, 240).trim()}...\n\n_La descripción es extensa. Pulse el botón inferior para ver el detalle completo de gastos y pagos del día ${params.fecha}._`
    : fullDesc;

  const contenido = [
    `💼 *Nuevo Registro en Libro de Caja Menor*`,
    `• *Fecha:* ${params.fecha}`,
    `• *Tipo:* ${etiquetaTipo}`,
    params.categoria ? `• *Categoría:* ${params.categoria}` : '',
    params.responsable ? `• *Responsable:* ${params.responsable}` : '',
    '',
    '*Desglose:*',
    resumenVisible,
  ]
    .filter(Boolean)
    .join('\n');

  return crearNotificacionPendiente({
    evento_tipo: 'CAJA_MENOR',
    titulo: `Caja Menor (${params.fecha}) — ${params.concepto.slice(0, 60)}`,
    contenido,
    fecha_evento: params.fecha,
    referencia_id: params.fecha,
    modulo_origen: 'Libro de Caja Menor',
    destinatarios: ['eliana', 'arturo'],
    metadata: {
      fecha: params.fecha,
      concepto: params.concepto,
      monto: Math.round(Number(params.monto || 0)),
      es_descripcion_larga: esDescripcionLarga,
      telegram_button: {
        type: 'callback',
        text: `📋 Ver detalle de gastos/pagos (${params.fecha})`,
        callback_data: `caja_salidas_dia_${params.fecha}`,
      },
    },
  });
}

/**
 * Notificación automática (en estado PENDIENTE) al cargar Ventas del Día.
 */
export async function crearNotificacionVentasDia(params: {
  fecha: string;
  diaSemana?: string;
  totalArticulos: number;
  granTotal: number;
  platosDistintos?: number;
}) {
  const totalFmt = `$${Math.round(Number(params.granTotal || 0)).toLocaleString('es-CO')} COP`;
  const contenido = [
    `📊 *Reporte de Ventas del Día*`,
    '',
    `• *Fecha:* ${params.fecha}${params.diaSemana ? ` (${params.diaSemana})` : ''}`,
    `• *Total Artículos:* ${params.totalArticulos}`,
    params.platosDistintos ? `• *Platos Distintos:* ${params.platosDistintos}` : '',
    `• *Gran Total Ventas:* ${totalFmt}`,
  ]
    .filter(Boolean)
    .join('\n');

  return crearNotificacionPendiente({
    evento_tipo: 'VENTAS_DIA',
    titulo: `Ventas del Día — ${params.fecha} (${totalFmt})`,
    contenido,
    fecha_evento: params.fecha,
    referencia_id: params.fecha,
    modulo_origen: 'Salidas por Venta',
    destinatarios: ['eliana', 'arturo'],
    metadata: {
      fecha: params.fecha,
      gran_total: Math.round(Number(params.granTotal || 0)),
      total_articulos: params.totalArticulos,
    },
  });
}

/**
 * Actualiza los destinatarios de una notificación manteniendo su estado PENDIENTE.
 */
export async function actualizarDestinatariosNotificacion(
  id: string,
  destinatariosInput: DestinatarioKey[]
) {
  const destinatarios = sanitizeDestinatarios(destinatariosInput);
  const { data, error } = await supabase
    .from('notificaciones_sistema')
    .update({
      destinatarios,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Aprueba y envía la notificación por Telegram a los destinatarios seleccionados,
 * actualizando el estado a ENVIADA.
 */
export async function aprobarYEnviarNotificacion(params: {
  id: string;
  destinatarios?: DestinatarioKey[];
  adminUsername: string;
}) {
  const { data: notif, error: fetchErr } = await supabase
    .from('notificaciones_sistema')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchErr || !notif) {
    throw new Error('Notificación no encontrada.');
  }

  const destinatariosFinales = sanitizeDestinatarios(
    params.destinatarios && params.destinatarios.length > 0
      ? params.destinatarios
      : notif.destinatarios
  );

  if (destinatariosFinales.length === 0) {
    throw new Error('Debe seleccionar al menos un destinatario para enviar la notificación.');
  }

  // Construir botón inline si aplica en metadata
  let replyMarkup: InlineKeyboardMarkup | undefined;
  const tgBtn = notif.metadata?.telegram_button;
  if (tgBtn?.type === 'url' && typeof tgBtn.url === 'string' && tgBtn.url.startsWith('https://')) {
    replyMarkup = {
      inline_keyboard: [[{ text: tgBtn.text || 'Ver en Sistema', url: tgBtn.url }]],
    };
  } else if (tgBtn?.type === 'callback' && typeof tgBtn.callback_data === 'string') {
    replyMarkup = {
      inline_keyboard: [[{ text: tgBtn.text || 'Ver detalle', callback_data: tgBtn.callback_data }]],
    };
  }

  // Enviar por Telegram a cada destinatario seleccionado
  for (const key of destinatariosFinales) {
    const dest = DESTINATARIOS_NOTIFICACION[key];
    if (!dest?.chatId) continue;
    await enviarMensajeConMenu(dest.chatId, notif.contenido, replyMarkup);
    await guardarMensajeChat(dest.chatId, 'model', notif.contenido);
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from('notificaciones_sistema')
    .update({
      estado: 'ENVIADA',
      destinatarios: destinatariosFinales,
      enviado_por: params.adminUsername || 'admin',
      enviado_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', params.id)
    .select('*')
    .single();

  if (updErr) throw updErr;
  return updated;
}
