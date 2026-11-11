import { NextResponse } from 'next/server';
import {
  procesarMensajeTelegram,
  registrarUsuarioTelegram,
  enviarMensajeTelegram,
  guardarMensajeChat,
} from '@/services/telegramBotService';
import {
  parseVentasTxtContent,
  guardarVentasEnBaseDeDatos,
} from '@/services/ventasParserService';
import { procesarFlujoBorradorTelegram } from '@/services/gestorBorradoresTelegram';
import {
  enviarMensajeConMenu,
  editarMensajeTelegram,
  responderCallbackQuery,
  getMenuPrincipalKeyboard,
  getSubmenuVentasKeyboard,
  getSubmenuCosteoKeyboard,
  getSubmenuConsumosKeyboard,
  getSubmenuCajaKeyboard,
  getSubmenuComprasKeyboard,
  getSubmenuStockKeyboard,
  generarRespuestaVentas,
  generarRespuestaCosteo,
  generarRespuestaConsumosConsulta,
  generarRespuestaCaja,
  generarRespuestaCompras,
  generarRespuestaStock,
  iniciarAsistenteConsumo,
  setFechaConsumo,
  procesarTextoItemConsumo,
  mostrarPasoResponsable,
  setResponsableConsumo,
  guardarConsumoDefinitivo,
  ConsumoDraftState
} from '@/services/telegramMenuService';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const update = await req.json();

    // =========================================================================
    // CASO 1: BOTONES INTERACTIVOS (CALLBACK QUERY DE TELEGRAM)
    // =========================================================================
    if (update.callback_query) {
      const cb = update.callback_query;
      const callbackQueryId = cb.id;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const action = cb.data;

      if (!chatId || !messageId) {
        return NextResponse.json({ ok: true, note: 'No callback context' });
      }

      await responderCallbackQuery(callbackQueryId);

      // 1.1. Menú Principal
      if (action === 'menu_principal') {
        const welcome = `🥩 *Panel Operativo • Restaurante La Finca*

Selecciona una opción rápida para consultar datos en tiempo real o registrar consumos del día:`;
        await editarMensajeTelegram(chatId, messageId, welcome, getMenuPrincipalKeyboard());
        return NextResponse.json({ ok: true, menu: 'principal' });
      }

      // 1.2. Submenús principales
      if (action === 'sub_ventas') {
        const texto = `📊 *Módulo de Ventas y Facturación*\nElige qué información deseas consultar:`;
        await editarMensajeTelegram(chatId, messageId, texto, getSubmenuVentasKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_costeo') {
        const texto = `🥩 *Módulo de Costeo Diario y Cocina*\nElige qué información deseas consultar:`;
        await editarMensajeTelegram(chatId, messageId, texto, getSubmenuCosteoKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_consumos') {
        // Limpiar cualquier estado previo si cancela
        await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);
        const texto = `🍽️ *Módulo de Consumos (Platos e Insumos)*\nElige si deseas consultar existencias consumidas o ingresar un nuevo consumo:`;
        await editarMensajeTelegram(chatId, messageId, texto, getSubmenuConsumosKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_caja') {
        const texto = `💼 *Módulo de Libro de Caja Menor*\nElige qué información deseas consultar:`;
        await editarMensajeTelegram(chatId, messageId, texto, getSubmenuCajaKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_compras') {
        const texto = `🛒 *Módulo de Compras y Proveedores*\nElige qué información deseas consultar:`;
        await editarMensajeTelegram(chatId, messageId, texto, getSubmenuComprasKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_stock') {
        const texto = `📦 *Módulo de Stock Físico y Catálogo Maestro*\nElige qué información deseas consultar:`;
        await editarMensajeTelegram(chatId, messageId, texto, getSubmenuStockKeyboard());
        return NextResponse.json({ ok: true });
      }

      // 1.3. Opciones de Ventas
      if (action === 'vta_ultima' || action === 'vta_mes' || action === 'vta_top') {
        const tipo = action === 'vta_ultima' ? 'ultima' : action === 'vta_mes' ? 'mes' : 'top';
        const res = await generarRespuestaVentas(tipo);
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // 1.4. Opciones de Costeo Diario
      if (action === 'costeo_ultima' || action === 'costeo_traslados' || action === 'costeo_cierres') {
        const tipo = action === 'costeo_ultima' ? 'ultima' : action === 'costeo_traslados' ? 'traslados' : 'cierres';
        const res = await generarRespuestaCosteo(tipo);
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // 1.5. Opciones de Caja Menor
      if (action === 'caja_cuadre' || action === 'caja_bloques' || action === 'caja_cajeras') {
        const tipo = action === 'caja_cuadre' ? 'cuadre' : action === 'caja_bloques' ? 'bloques' : 'cajeras';
        const res = await generarRespuestaCaja(tipo);
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // 1.6. Opciones de Compras
      if (action === 'cmp_ultimas' || action === 'cmp_carnes' || action === 'cmp_verduras') {
        const tipo = action === 'cmp_ultimas' ? 'ultimas' : action === 'cmp_carnes' ? 'carnes' : 'verduras';
        const res = await generarRespuestaCompras(tipo);
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // 1.7. Opciones de Stock
      if (action === 'stk_carnes' || action === 'stk_precios') {
        const tipo = action === 'stk_carnes' ? 'carnes' : 'precios';
        const res = await generarRespuestaStock(tipo);
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // 1.8. Opciones de Consumos: Consulta
      if (action === 'csm_consultar') {
        const res = await generarRespuestaConsumosConsulta();
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // 1.9. Asistente de Consumos: Iniciar
      if (action === 'csm_ingresar_plato' || action === 'csm_ingresar_insumo') {
        const tipo = action === 'csm_ingresar_plato' ? 'PLATO_VENTA' : 'INSUMO_CATALOGO';
        const res = await iniciarAsistenteConsumo(chatId, tipo);
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // 1.10. Asistente de Consumos: Set Fecha
      if (action.startsWith('csm_set_fecha_')) {
        const fecha = action.replace('csm_set_fecha_', '');
        const res = await setFechaConsumo(chatId, fecha);
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // 1.11. Asistente de Consumos: Pick Plato de Venta
      if (action.startsWith('csm_pick_p_')) {
        const parts = action.replace('csm_pick_p_', '').split('_');
        const pId = parts[0];
        const cant = parseFloat(parts[1]) || 1;

        const { data: prod } = await supabase.from('productos_venta').select('*').eq('id', pId).maybeSingle();
        if (prod) {
          const { data: row } = await supabase.from('telegram_borradores_ingesta').select('items').eq('chat_id', chatId).maybeSingle();
          const state: ConsumoDraftState = row?.items || { chatId, tipoConsumo: 'PLATO_VENTA', paso: 'RESPONSABLE' };

          state.itemId = prod.id;
          state.nombreItem = prod.nombre;
          state.categoria = 'Consumido de Productos para la Venta';
          state.precioUnitario = Number(prod.precio_total || 0);
          state.cantidad = cant;
          state.unidad = prod.unidad || 'ud';
          state.total = Math.round(cant * state.precioUnitario);
          state.paso = 'RESPONSABLE';

          await supabase.from('telegram_borradores_ingesta').update({ items: state, updated_at: new Date().toISOString() }).eq('chat_id', chatId);

          const res = mostrarPasoResponsable(state);
          await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
          return NextResponse.json({ ok: true });
        }
      }

      // 1.12. Asistente de Consumos: Pick Insumo de Catálogo
      if (action.startsWith('csm_pick_i_')) {
        const parts = action.replace('csm_pick_i_', '').split('_');
        const iId = parts[0];
        const cant = parseFloat(parts[1]) || 1;

        const { data: ins } = await supabase.from('catalogo_insumos').select('*').eq('id', iId).maybeSingle();
        if (ins) {
          const { data: row } = await supabase.from('telegram_borradores_ingesta').select('items').eq('chat_id', chatId).maybeSingle();
          const state: ConsumoDraftState = row?.items || { chatId, tipoConsumo: 'INSUMO_CATALOGO', paso: 'RESPONSABLE' };

          state.itemId = ins.id;
          state.nombreItem = ins.nombre;
          state.categoria = 'Consumido del Catálogo de Insumos y Carne';
          state.precioUnitario = Number(ins.costo_unitario_kg || 0);
          state.cantidad = cant;
          state.unidad = ins.unidad_medida || 'Kg';
          state.total = Math.round(cant * state.precioUnitario);
          state.paso = 'RESPONSABLE';

          await supabase.from('telegram_borradores_ingesta').update({ items: state, updated_at: new Date().toISOString() }).eq('chat_id', chatId);

          const res = mostrarPasoResponsable(state);
          await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
          return NextResponse.json({ ok: true });
        }
      }

      // 1.13. Asistente de Consumos: Responsable
      if (action.startsWith('csm_resp_')) {
        const respCode = action.replace('csm_resp_', '');
        const label = respCode === 'Personal/Turno' ? 'Personal / Turno' :
                      respCode === 'Administración' ? 'Administración' :
                      respCode === 'Cortesía' ? 'Cortesía Cliente' :
                      respCode === 'MermaCocina' ? 'Merma / Cocina' : respCode;

        const res = await setResponsableConsumo(chatId, label);
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // 1.14. Asistente de Consumos: Guardar Definitivo
      if (action === 'csm_guardar_definitivo') {
        const res = await guardarConsumoDefinitivo(chatId);
        await editarMensajeTelegram(chatId, messageId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true, handled: false });
    }

    // =========================================================================
    // CASO 2: MENSAJE NORMAL O ADJUNTO
    // =========================================================================
    const message = update.message || update.edited_message;
    if (!message) {
      return NextResponse.json({ ok: true, note: 'No message payload' });
    }

    const chatId = message.chat?.id;
    if (!chatId) {
      return NextResponse.json({ ok: true, note: 'No chat id' });
    }

    // Capturar datos del usuario que envía el mensaje
    const from = message.from || message.chat || {};
    const sender = {
      first_name: from.first_name || message.chat?.first_name || 'Usuario',
      last_name: from.last_name || message.chat?.last_name || '',
      username: from.username || message.chat?.username || '',
    };

    // =========================================================================
    // CASO 2.1: EL USUARIO ADJUNTA UN DOCUMENTO / ARCHIVO (ej: 28.txt de ventas)
    // =========================================================================
    if (message.document) {
      const doc = message.document;
      const fileName = doc.file_name || 'documento.txt';
      const fileId = doc.file_id;

      await registrarUsuarioTelegram(chatId, sender, `[Archivo adjunto: ${fileName}]`);

      if (!fileName.toLowerCase().endsWith('.txt')) {
        const warning = `⚠️ *Formato no compatible:* Solo se admiten archivos de ventas en formato de texto plano (\`.txt\`). Recibí: \`${fileName}\`.`;
        await enviarMensajeConMenu(chatId, warning);
        await guardarMensajeChat(chatId, 'model', warning);
        return NextResponse.json({ ok: true });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN no configurado en variables de entorno');
      }

      const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const fileInfo = await fileInfoRes.json();

      if (!fileInfo.ok || !fileInfo.result?.file_path) {
        throw new Error(`No se pudo obtener la ruta del archivo de Telegram: ${fileInfo.description || 'Desconocido'}`);
      }

      const filePath = fileInfo.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

      const downloadRes = await fetch(downloadUrl);
      const arrayBuffer = await downloadRes.arrayBuffer();
      const decoder = new TextDecoder('latin1');
      const textContent = decoder.decode(arrayBuffer);

      const parsed = parseVentasTxtContent(textContent, fileName);
      await guardarVentasEnBaseDeDatos(parsed);

      const formatCOP = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

      const receipt = `🎉 *¡Ventas Registradas Exitosamente!*

📅 *Fecha de Venta:* \`${parsed.fecha}\`
📁 *Archivo:* \`${fileName}\`
📊 *Artículos Vendidos:* ${parsed.total_articulos} und (${parsed.items.length} líneas)
💰 *Total Venta Bruta:* ${formatCOP(parsed.gran_total)} COP
🪙 *Impoconsumo (8%):* ${formatCOP(parsed.impuesto)} COP
🏷️ *Venta Neta:* ${formatCOP(parsed.venta_neta)} COP

Los datos ya están disponibles en el módulo de Ventas y el panel de Auditoría.`;

      await enviarMensajeConMenu(chatId, receipt);
      await guardarMensajeChat(chatId, 'model', receipt);
      return NextResponse.json({ ok: true, ventas: true, fecha: parsed.fecha });
    }

    // =========================================================================
    // CASO 2.2: MENSAJE DE TEXTO
    // =========================================================================
    const text = (message.text || '').trim();
    if (!text) {
      return NextResponse.json({ ok: true, note: 'Empty text' });
    }

    await registrarUsuarioTelegram(chatId, sender, text);

    // Si escribe /start, /menu, menu, menú o hola -> Desplegar Menú Principal Interactivo
    const normText = text.toLowerCase();
    if (['/start', '/menu', 'menu', 'menú', 'hola', 'buenas', 'inicio'].includes(normText)) {
      // Limpiar cualquier sesión previa
      await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);

      const welcome = `🥩 *¡Hola ${sender.first_name}! Bienvenido al Asistente de La Finca.*

Toca una de las siguientes opciones para consultar la información en tiempo real o registrar consumos del día:`;

      await enviarMensajeConMenu(chatId, welcome, getMenuPrincipalKeyboard());
      await guardarMensajeChat(chatId, 'model', welcome);
      return NextResponse.json({ ok: true });
    }

    // 2.3. Interceptar si está activo en el Asistente de Consumos
    const { data: borradorRow } = await supabase
      .from('telegram_borradores_ingesta')
      .select('*')
      .eq('chat_id', chatId)
      .maybeSingle();

    if (borradorRow && borradorRow.estado === 'ASISTENTE_CONSUMO' && borradorRow.items) {
      const state: ConsumoDraftState = borradorRow.items;
      if (state.paso === 'ITEM') {
        const res = await procesarTextoItemConsumo(chatId, text, state);
        await enviarMensajeConMenu(chatId, res.texto, res.markup);
        await guardarMensajeChat(chatId, 'model', res.texto);
        return NextResponse.json({ ok: true, asistente_consumo: true });
      }
      if (state.paso === 'RESPONSABLE') {
        const res = await setResponsableConsumo(chatId, text.trim());
        await enviarMensajeConMenu(chatId, res.texto, res.markup);
        await guardarMensajeChat(chatId, 'model', res.texto);
        return NextResponse.json({ ok: true, asistente_consumo: true });
      }
    }

    // 2.4. Interceptar flujo de borrador interactivo de conteos/insumos (0 tokens LLM)
    const borradorRes = await procesarFlujoBorradorTelegram(chatId, text, sender.first_name);
    if (borradorRes.interceptado && borradorRes.respuesta) {
      await enviarMensajeConMenu(chatId, borradorRes.respuesta);
      await guardarMensajeChat(chatId, 'model', borradorRes.respuesta);
      return NextResponse.json({ ok: true, borrador: true });
    }

    // 2.5. Consulta libre procesada con Groq LLM (adjunta siempre botón de menú principal)
    const result = await procesarMensajeTelegram(chatId, text, sender);

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error('Error en webhook de Telegram:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    servicio: 'La Finca Telegram Bot Webhook & Menu Interactivo',
    hasTelegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
