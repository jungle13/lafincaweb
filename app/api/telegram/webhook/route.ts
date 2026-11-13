import { NextResponse } from 'next/server';
import {
  procesarMensajeTelegram,
  registrarUsuarioTelegram,
  guardarMensajeChat,
} from '@/services/telegramBotService';
import {
  parseVentasTxtContent,
  guardarVentasEnBaseDeDatos,
} from '@/services/ventasParserService';
import { procesarFlujoBorradorTelegram } from '@/services/gestorBorradoresTelegram';
import {
  enviarMensajeConMenu,
  responderCallbackQuery,
  getMenuPrincipalKeyboard,
  getSubmenuVentasKeyboard,
  getSubmenuCosteoKeyboard,
  getSubmenuConsumosKeyboard,
  getSubmenuCajaKeyboard,
  getSubmenuComprasKeyboard,
  getSubmenuPreciosKeyboard,
  generarSelectorMes,
  generarSelectorDia,
  generarRespuestaVentasUltima,
  generarRespuestaVentasMes,
  generarRespuestaVentasDia,
  generarRespuestaVentasTop,
  generarRespuestaLiquidacionDia,
  generarRespuestaTrasladosDia,
  generarRespuestaCierresDia,
  generarRespuestaConsumosConsulta,
  generarRespuestaCuadreCaja,
  generarRespuestaSalidasCajaPorDia,
  generarRespuestaCajaBloques,
  generarRespuestaCajaCajeras,
  generarRespuestaCompras,
  generarRespuestaPreciosPorCategoria,
  iniciarBusquedaPrecioInsumo,
  buscarPrecioInsumoPorTexto,
  iniciarAsistenteConsumo,
  setFechaConsumo,
  configurarPlatoEnState,
  configurarInsumoEnState,
  setResponsableConsumo,
  guardarConsumoDefinitivo,
  procesarMensajeEnAsistenteConsumo,
  ConsumoDraftState,
  InlineKeyboardMarkup
} from '@/services/telegramMenuService';
import { supabase } from '@/lib/supabase';
import { getAuthEnforcementMode, logSecurityAudit } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

// Helper para enviar SIEMPRE como un mensaje nuevo en Telegram (conserva el historial completo del chat)
async function responderNuevoMensaje(chatId: number, texto: string, markup?: InlineKeyboardMarkup) {
  await enviarMensajeConMenu(chatId, texto, markup);
  await guardarMensajeChat(chatId, 'model', texto);
}

export async function POST(req: Request) {
  try {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');

    if (expectedSecret) {
      if (incomingSecret !== expectedSecret) {
        logSecurityAudit('/api/telegram/webhook', 'POST', 'INVALID_TELEGRAM_SECRET_TOKEN');
        if (getAuthEnforcementMode() === 'enforce') {
          return NextResponse.json(
            {
              error: 'No autorizado',
              code: 'TELEGRAM_SECRET_INVALID',
              route: '/api/telegram/webhook',
              hint: 'Header x-telegram-bot-api-secret-token inválido o ausente.',
            },
            { status: 401 }
          );
        }
      }
    } else {
      logSecurityAudit('/api/telegram/webhook', 'POST', 'TELEGRAM_WEBHOOK_SECRET_NOT_CONFIGURED');
    }

    const update = await req.json();

    // =========================================================================
    // CASO 1: BOTONES INTERACTIVOS (CALLBACK QUERY DE TELEGRAM)
    // =========================================================================
    if (update.callback_query) {
      const cb = update.callback_query;
      const callbackQueryId = cb.id;
      const chatId = cb.message?.chat?.id;
      const action: string = cb.data || '';

      if (!chatId) {
        return NextResponse.json({ ok: true, note: 'No callback context' });
      }

      await responderCallbackQuery(callbackQueryId);

      // 1.1. Menú Principal
      if (action === 'menu_principal') {
        await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);
        const welcome = `🥩 *Panel Operativo • Restaurante La Finca*

Selecciona una opción rápida para consultar datos en tiempo real o registrar consumos del día:`;
        await responderNuevoMensaje(chatId, welcome, getMenuPrincipalKeyboard());
        return NextResponse.json({ ok: true, menu: 'principal' });
      }

      // 1.2. Submenús principales
      if (action === 'sub_ventas') {
        const texto = `📊 *Módulo de Ventas y Facturación*\nElige qué información deseas consultar:`;
        await responderNuevoMensaje(chatId, texto, getSubmenuVentasKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_costeo') {
        const texto = `🥩 *Módulo de Costeo Diario y Cocina*\nElige qué información deseas consultar:`;
        await responderNuevoMensaje(chatId, texto, getSubmenuCosteoKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_consumos') {
        await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);
        const texto = `🍽️ *Módulo de Consumos (Platos e Insumos)*\nElige si deseas consultar consumos registrados o ingresar uno nuevo:`;
        await responderNuevoMensaje(chatId, texto, getSubmenuConsumosKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_caja') {
        const texto = `💼 *Módulo de Libro de Caja Menor*\nElige qué información deseas consultar:`;
        await responderNuevoMensaje(chatId, texto, getSubmenuCajaKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_compras') {
        const texto = `🛒 *Módulo de Compras y Proveedores*\nElige qué información deseas consultar:`;
        await responderNuevoMensaje(chatId, texto, getSubmenuComprasKeyboard());
        return NextResponse.json({ ok: true });
      }

      if (action === 'sub_precios') {
        await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);
        const texto = `💲 *Precios Oficiales de Insumos (Catálogo Maestro)*\nSelecciona una categoría o escribe el nombre de un insumo para ver sus precios:`;
        await responderNuevoMensaje(chatId, texto, getSubmenuPreciosKeyboard());
        return NextResponse.json({ ok: true });
      }

      // -----------------------------------------------------------------------
      // 1.3. Opciones de Ventas
      // -----------------------------------------------------------------------
      if (action === 'vta_ultima') {
        const res = await generarRespuestaVentasUltima();
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'vta_ask_mes_consolidado') {
        const res = await generarSelectorMes('vta_mes_sel', 'Consolidado de Ventas por Mes', 'ventas_diarias', 'sub_ventas');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('vta_mes_sel_mes_')) {
        const ym = action.replace('vta_mes_sel_mes_', '');
        const res = await generarRespuestaVentasMes(ym);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'vta_ask_mes_dia') {
        const res = await generarSelectorMes('vta_dia_sel', 'Ventas Diarias', 'ventas_diarias', 'sub_ventas');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('vta_dia_sel_mes_') || action.startsWith('vta_dia_mes_')) {
        const ym = action.replace('vta_dia_sel_mes_', '').replace('vta_dia_mes_', '');
        const res = await generarSelectorDia('vta', ym, 'Ventas Diarias', 'ventas_diarias', 'vta_ask_mes_dia');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('vta_dia_')) {
        const fecha = action.replace('vta_dia_', '');
        const res = await generarRespuestaVentasDia(fecha);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'vta_ask_mes_top') {
        const res = await generarSelectorMes('vta_top_sel', 'Top Platos Más Vendidos', 'ventas_diarias', 'sub_ventas');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('vta_top_sel_mes_')) {
        const ym = action.replace('vta_top_sel_mes_', '');
        const res = await generarRespuestaVentasTop(ym);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // -----------------------------------------------------------------------
      // 1.4. Opciones de Costeo Diario Cocina
      // -----------------------------------------------------------------------
      if (action === 'costeo_ultima') {
        const { data: latest } = await supabase.from('costeo_diario').select('fecha').order('fecha', { ascending: false }).limit(1).maybeSingle();
        const fecha = latest?.fecha || new Date().toISOString().split('T')[0];
        const res = await generarRespuestaLiquidacionDia(fecha);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'costeo_ask_mes_liq') {
        const res = await generarSelectorMes('costeo_liq', 'Liquidación Hoja de Costeo', 'costeo_diario', 'sub_costeo');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('costeo_liq_mes_')) {
        const ym = action.replace('costeo_liq_mes_', '');
        const res = await generarSelectorDia('costeo_liq', ym, 'Liquidación Costeo', 'costeo_diario', 'costeo_ask_mes_liq');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('costeo_liq_dia_')) {
        const fecha = action.replace('costeo_liq_dia_', '');
        const res = await generarRespuestaLiquidacionDia(fecha);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'costeo_ask_mes_tras') {
        const res = await generarSelectorMes('costeo_tras', 'Traslados Bodega a Cocina', 'costeo_diario', 'sub_costeo');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('costeo_tras_mes_')) {
        const ym = action.replace('costeo_tras_mes_', '');
        const res = await generarSelectorDia('costeo_tras', ym, 'Traslados Cocina', 'costeo_diario', 'costeo_ask_mes_tras');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('costeo_tras_dia_')) {
        const fecha = action.replace('costeo_tras_dia_', '');
        const res = await generarRespuestaTrasladosDia(fecha);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'costeo_ask_mes_cie') {
        const res = await generarSelectorMes('costeo_cie', 'Cierres de Inventario', 'costeo_diario', 'sub_costeo');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('costeo_cie_mes_')) {
        const ym = action.replace('costeo_cie_mes_', '');
        const res = await generarSelectorDia('costeo_cie', ym, 'Cierres Cocina/Bodega', 'costeo_diario', 'costeo_ask_mes_cie');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('costeo_cie_dia_')) {
        const fecha = action.replace('costeo_cie_dia_', '');
        const res = await generarRespuestaCierresDia(fecha);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // -----------------------------------------------------------------------
      // 1.5. Opciones de Consumos
      // -----------------------------------------------------------------------
      if (action === 'csm_consultar_hoy') {
        const res = await generarRespuestaConsumosConsulta();
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'csm_ask_mes_con') {
        const res = await generarSelectorMes('csm_con', 'Consultar Consumos', 'costeo_diario', 'sub_consumos');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('csm_con_mes_')) {
        const ym = action.replace('csm_con_mes_', '');
        const res = await generarSelectorDia('csm_con', ym, 'Consultar Consumos', 'costeo_diario', 'csm_ask_mes_con');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('csm_con_dia_')) {
        const fecha = action.replace('csm_con_dia_', '');
        const res = await generarRespuestaConsumosConsulta(fecha);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'csm_ingresar_plato' || action === 'csm_ingresar_insumo') {
        const tipo = action === 'csm_ingresar_plato' ? 'PLATO_VENTA' : 'INSUMO_CATALOGO';
        const res = await iniciarAsistenteConsumo(chatId, tipo);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('csm_set_fecha_')) {
        const fecha = action.replace('csm_set_fecha_', '');
        const res = await setFechaConsumo(chatId, fecha);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('csm_pick_p_')) {
        const parts = action.replace('csm_pick_p_', '').split('_');
        const pId = parts[0];
        const cant = parseFloat(parts[1]) || 1;

        const { data: prod } = await supabase.from('productos_venta').select('*').eq('id', pId).maybeSingle();
        if (prod) {
          const { data: row } = await supabase.from('telegram_borradores_ingesta').select('items').eq('chat_id', chatId).maybeSingle();
          const state: ConsumoDraftState = row?.items || { chatId, tipoConsumo: 'PLATO_VENTA', paso: 'RESPONSABLE' };
          const res = await configurarPlatoEnState(chatId, prod, cant, state);
          await responderNuevoMensaje(chatId, res.texto, res.markup);
          return NextResponse.json({ ok: true });
        }
      }

      if (action.startsWith('csm_pick_i_')) {
        const parts = action.replace('csm_pick_i_', '').split('_');
        const iId = parts[0];
        const cant = parseFloat(parts[1]) || 1;

        const { data: ins } = await supabase.from('catalogo_insumos').select('*').eq('id', iId).maybeSingle();
        if (ins) {
          const { data: row } = await supabase.from('telegram_borradores_ingesta').select('items').eq('chat_id', chatId).maybeSingle();
          const state: ConsumoDraftState = row?.items || { chatId, tipoConsumo: 'INSUMO_CATALOGO', paso: 'RESPONSABLE' };
          const res = await configurarInsumoEnState(chatId, ins, cant, state);
          await responderNuevoMensaje(chatId, res.texto, res.markup);
          return NextResponse.json({ ok: true });
        }
      }

      if (action.startsWith('csm_resp_')) {
        const respCode = action.replace('csm_resp_', '');
        const label = respCode === 'Personal/Turno' ? 'Personal / Turno' :
                      respCode === 'Administración' ? 'Administración' :
                      respCode === 'Cortesía' ? 'Cortesía Cliente' :
                      respCode === 'MermaCocina' ? 'Merma / Cocina' : respCode;

        const res = await setResponsableConsumo(chatId, label);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'csm_guardar_definitivo') {
        const res = await guardarConsumoDefinitivo(chatId);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // -----------------------------------------------------------------------
      // 1.6. Opciones de Caja Menor
      // -----------------------------------------------------------------------
      if (action === 'caja_cuadre_ultimo') {
        const res = await generarRespuestaCuadreCaja();
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'caja_ask_mes_cuadre') {
        const res = await generarSelectorMes('caja_cuadre', 'Cuadre Diario de Caja', 'libro_caja_diario', 'sub_caja');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('caja_cuadre_mes_')) {
        const ym = action.replace('caja_cuadre_mes_', '');
        const res = await generarSelectorDia('caja_cuadre', ym, 'Cuadre de Caja', 'libro_caja_diario', 'caja_ask_mes_cuadre');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('caja_cuadre_dia_')) {
        const fecha = action.replace('caja_cuadre_dia_', '');
        const res = await generarRespuestaCuadreCaja(fecha);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'caja_ask_mes_salidas') {
        const res = await generarSelectorMes('caja_salidas', 'Salidas de Caja por Día', 'libro_caja_registros', 'sub_caja');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('caja_salidas_mes_')) {
        const ym = action.replace('caja_salidas_mes_', '');
        const res = await generarSelectorDia('caja_salidas', ym, 'Salidas de Caja', 'libro_caja_registros', 'caja_ask_mes_salidas');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('caja_salidas_dia_')) {
        const fecha = action.replace('caja_salidas_dia_', '');
        const res = await generarRespuestaSalidasCajaPorDia(fecha);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'caja_ask_mes_bloques') {
        const res = await generarSelectorMes('caja_bloques', 'Salidas por 3 Bloques', 'libro_caja_registros', 'sub_caja');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('caja_bloques_mes_')) {
        const ym = action.replace('caja_bloques_mes_', '');
        const res = await generarRespuestaCajaBloques(ym);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'caja_ask_mes_cajeras') {
        const res = await generarSelectorMes('caja_cajeras', 'Salidas por Cajera', 'libro_caja_registros', 'sub_caja');
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action.startsWith('caja_cajeras_mes_')) {
        const ym = action.replace('caja_cajeras_mes_', '');
        const res = await generarRespuestaCajaCajeras(ym);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // -----------------------------------------------------------------------
      // 1.7. Opciones de Compras
      // -----------------------------------------------------------------------
      if (action === 'cmp_ultimas' || action === 'cmp_carnes' || action === 'cmp_verduras') {
        const tipo = action === 'cmp_ultimas' ? 'ultimas' : action === 'cmp_carnes' ? 'carnes' : 'verduras';
        const res = await generarRespuestaCompras(tipo);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      // -----------------------------------------------------------------------
      // 1.8. Opciones de Precios Oficiales (Sin existencias)
      // -----------------------------------------------------------------------
      if (action.startsWith('prc_cat_')) {
        const catCode = action.replace('prc_cat_', '');
        const res = await generarRespuestaPreciosPorCategoria(catCode);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
        return NextResponse.json({ ok: true });
      }

      if (action === 'prc_buscar_texto') {
        const res = await iniciarBusquedaPrecioInsumo(chatId);
        await responderNuevoMensaje(chatId, res.texto, res.markup);
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

    const from = message.from || message.chat || {};
    const sender = {
      first_name: from.first_name || message.chat?.first_name || 'Usuario',
      last_name: from.last_name || message.chat?.last_name || '',
      username: from.username || message.chat?.username || '',
    };

    // -------------------------------------------------------------------------
    // 2.1. Archivo adjunto (.txt de ventas)
    // -------------------------------------------------------------------------
    if (message.document) {
      const doc = message.document;
      const fileName = doc.file_name || 'documento.txt';
      const fileId = doc.file_id;

      await registrarUsuarioTelegram(chatId, sender, `[Archivo adjunto: ${fileName}]`);

      if (!fileName.toLowerCase().endsWith('.txt')) {
        const warning = `⚠️ *Formato no compatible:* Solo se admiten archivos de ventas en formato de texto plano (\`.txt\`). Recibí: \`${fileName}\`.`;
        await responderNuevoMensaje(chatId, warning);
        return NextResponse.json({ ok: true });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN no configurado');
      }

      const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const fileInfo = await fileInfoRes.json();

      if (!fileInfo.ok || !fileInfo.result?.file_path) {
        throw new Error(`No se pudo obtener la ruta del archivo de Telegram`);
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

      await responderNuevoMensaje(chatId, receipt);
      return NextResponse.json({ ok: true, ventas: true, fecha: parsed.fecha });
    }

    // -------------------------------------------------------------------------
    // 2.2. Mensaje de Texto Normal
    // -------------------------------------------------------------------------
    const text = (message.text || '').trim();
    if (!text) {
      return NextResponse.json({ ok: true, note: 'Empty text' });
    }

    await registrarUsuarioTelegram(chatId, sender, text);

    // Saludo o comando de inicio -> Menú Principal Interactivo
    const normText = text.toLowerCase();
    if (['/start', '/menu', 'menu', 'menú', 'hola', 'buenas', 'inicio'].includes(normText)) {
      await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);

      const welcome = `🥩 *¡Hola ${sender.first_name}! Bienvenido al Asistente de La Finca.*

Toca una de las siguientes opciones para consultar la información en tiempo real o registrar consumos del día:`;

      await responderNuevoMensaje(chatId, welcome, getMenuPrincipalKeyboard());
      return NextResponse.json({ ok: true });
    }

    // 2.3. Interceptar si está activo en el Asistente de Consumos (en cualquier paso)
    const { data: borradorRow } = await supabase
      .from('telegram_borradores_ingesta')
      .select('*')
      .eq('chat_id', chatId)
      .maybeSingle();

    if (borradorRow && borradorRow.estado === 'ASISTENTE_CONSUMO' && borradorRow.items) {
      const state: ConsumoDraftState = borradorRow.items;
      const res = await procesarMensajeEnAsistenteConsumo(chatId, text, state);
      await responderNuevoMensaje(chatId, res.texto, res.markup);
      return NextResponse.json({ ok: true, asistente_consumo: true });
    }

    // 2.4. Interceptar si está buscando precio de un insumo
    if (borradorRow && borradorRow.estado === 'BUSCAR_PRECIO_INSUMO') {
      const res = await buscarPrecioInsumoPorTexto(chatId, text);
      await responderNuevoMensaje(chatId, res.texto, res.markup);
      return NextResponse.json({ ok: true, buscar_precio: true });
    }

    // 2.5. Interceptar flujo de borrador interactivo de conteos/insumos (0 tokens LLM)
    const borradorRes = await procesarFlujoBorradorTelegram(chatId, text, sender.first_name);
    if (borradorRes.interceptado && borradorRes.respuesta) {
      await responderNuevoMensaje(chatId, borradorRes.respuesta);
      return NextResponse.json({ ok: true, borrador: true });
    }

    // 2.6. Consulta libre procesada con Groq LLM (adjunta siempre botón de menú principal)
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
    timestamp: new Date().toISOString(),
  });
}
