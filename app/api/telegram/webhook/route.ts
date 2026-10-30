import { NextResponse } from 'next/server';
import {
  procesarMensajeTelegram,
  registrarUsuarioTelegram,
  enviarMensajeTelegram,
  guardarMensajeChat,
} from '@/services/telegramBotService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const update = await req.json();

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
    // CASO 1: EL USUARIO ADJUNTA UN DOCUMENTO / ARCHIVO (ej: 28.txt de ventas)
    // =========================================================================
    if (message.document) {
      const doc = message.document;
      const fileName = doc.file_name || 'documento.txt';
      const fileId = doc.file_id;

      // Registrar interacción
      await registrarUsuarioTelegram(chatId, sender, `[Archivo adjunto: ${fileName}]`);

      // Validar si es un archivo de texto de ventas
      if (!fileName.toLowerCase().endsWith('.txt')) {
        const warning = `⚠️ *Formato no compatible:* Solo se admiten archivos de ventas en formato de texto plano (\`.txt\`). Recibí: \`${fileName}\`.`;
        await enviarMensajeTelegram(chatId, warning);
        await guardarMensajeChat(chatId, 'model', warning);
        return NextResponse.json({ ok: true });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN no configurado en variables de entorno');
      }

      // 1. Obtener la ruta de descarga desde Telegram Bot API
      const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const fileInfo = await fileInfoRes.json();

      if (!fileInfo.ok || !fileInfo.result?.file_path) {
        throw new Error(`No se pudo obtener la ruta del archivo de Telegram: ${fileInfo.description || 'Desconocido'}`);
      }

      const filePath = fileInfo.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

      // 2. Descargar el archivo con decodificación Latin1/Windows-1252
      const downloadRes = await fetch(downloadUrl);
      const arrayBuffer = await downloadRes.arrayBuffer();
      const decoder = new TextDecoder('latin1');
      const textContent = decoder.decode(arrayBuffer);

      // 3. Procesar mediante el servicio unificado de ventas (0 tokens de IA consumidos)
      const { parseVentasTxtContent, guardarVentasEnBaseDeDatos } = await import('@/services/ventasParserService');
      const parsed = parseVentasTxtContent(textContent, fileName);
      await guardarVentasEnBaseDeDatos(parsed);

      // 4. Formatear y enviar comprobante inmediato al chat
      const formatCOP = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

      const receipt = `🎉 *¡Ventas Registradas Exitosamente!*

📅 *Fecha de Venta:* \`${parsed.fecha}\`
📁 *Archivo:* \`${fileName}\`
📊 *Artículos Vendidos:* ${parsed.total_articulos} und (${parsed.items.length} líneas)
💰 *Total Venta Bruta:* ${formatCOP(parsed.gran_total)} COP
🪙 *Impoconsumo (8%):* ${formatCOP(parsed.impuesto)} COP
🏷️ *Venta Neta:* ${formatCOP(parsed.venta_neta)} COP

Los datos ya están disponibles en el módulo de Ventas y el panel de Auditoría.`;

      await enviarMensajeTelegram(chatId, receipt);
      await guardarMensajeChat(chatId, 'model', receipt);
      return NextResponse.json({ ok: true, ventas: true, fecha: parsed.fecha });
    }

    // =========================================================================
    // CASO 2: MENSAJE DE TEXTO NORMAL
    // =========================================================================
    const text = (message.text || '').trim();
    if (!text) {
      return NextResponse.json({ ok: true, note: 'Empty text' });
    }

    // Registrar interacción del usuario
    await registrarUsuarioTelegram(chatId, sender, text);

    // Comando /start o saludo
    if (text === '/start') {
      const welcome = `🥩 *¡Hola ${sender.first_name}! Bienvenido al Asistente de La Finca en Telegram.*

Puedo responder consultas operativas en tiempo real:
• 📦 *Existencias de carne:* "¿Cuánto lomo fino nos queda?"
• 💰 *Precios y Catálogo:* "¿A cómo está el kilo de costilla?"
• 🧾 *Compras y Facturas:* "¿Cuáles fueron las últimas compras?"
• 📊 *Ventas del día:* "¿Cuánto se vendió el 25 de octubre?" o "¿Cuántos churrascos se han vendido?"
• 💼 *Libro de Caja Menor:* "¿Cuánto se ha gastado en caja menor en octubre?"
• 📁 *Carga de Ventas:* Arrastra o adjunta el archivo \`.txt\` del día (ej: \`28.txt\`) y lo procesaré de inmediato.
• 📝 *Conteo e Insumos:* Pega una lista (ej: *"Apertura de cocina del 29: Chorizo 6, Felipe 1..."*) para validarla interactivamente antes de guardarla.

¡Pregúntame lo que necesites!`;
      await enviarMensajeTelegram(chatId, welcome);
      return NextResponse.json({ ok: true });
    }

    // Interceptar flujo de borrador interactivo de conteos/insumos (0 tokens LLM)
    const { procesarFlujoBorradorTelegram } = await import('@/services/gestorBorradoresTelegram');
    const borradorRes = await procesarFlujoBorradorTelegram(chatId, text, sender.first_name);
    if (borradorRes.interceptado && borradorRes.respuesta) {
      await enviarMensajeTelegram(chatId, borradorRes.respuesta);
      await guardarMensajeChat(chatId, 'model', borradorRes.respuesta);
      return NextResponse.json({ ok: true, borrador: true });
    }

    // Procesar con Groq y las herramientas de La Finca
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
    servicio: 'La Finca Telegram Bot Webhook',
    hasTelegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
