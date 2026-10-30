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
      const fileName = doc.file_name || 'ventas.txt';

      await registrarUsuarioTelegram(chatId, sender, `[Archivo adjunto: ${fileName}]`);

      if (fileName.toLowerCase().endsWith('.txt')) {
        const { parseVentasTxtContent, guardarVentasEnBaseDeDatos } = await import('@/services/ventasParserService');
        const token = process.env.TELEGRAM_BOT_TOKEN;

        try {
          await enviarMensajeTelegram(chatId, `⏳ Procesando reporte de ventas \`${fileName}\`...`);

          // 1. Obtener la ruta del archivo en Telegram
          const fileInfoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${doc.file_id}`);
          const fileInfo = await fileInfoRes.json();
          if (!fileInfo.ok || !fileInfo.result?.file_path) {
            throw new Error('No se pudo descargar el archivo desde los servidores de Telegram.');
          }

          // 2. Descargar el archivo
          const fileDownloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`;
          const downloadRes = await fetch(fileDownloadUrl);
          const arrayBuffer = await downloadRes.arrayBuffer();

          // 3. Decodificar en latin1 / ISO-8859-1 para caracteres de caja
          const decoder = new TextDecoder('latin1');
          const fileContent = decoder.decode(arrayBuffer);

          // 4. Parsear con reglas de negocio POS
          const parsed = parseVentasTxtContent(fileContent, fileName);

          // 5. Guardar en Supabase
          const guardado = await guardarVentasEnBaseDeDatos(parsed);

          // 6. Confirmación ejecutiva formateada
          const respuesta = `🧾 *¡Archivo de Ventas Procesado con Éxito!*
          
📁 *Archivo:* \`${fileName}\`
📅 *Fecha:* ${parsed.fecha} (${parsed.dia_semana})
📦 *Artículos Vendidos:* ${parsed.total_articulos.toLocaleString('es-CO')} und
🍽️ *Platos Distintos:* ${parsed.total_platos_distintos}
💰 *Venta Neta:* $${parsed.venta_neta.toLocaleString('es-CO')} COP
🏷️ *Impoconsumo (8%):* $${parsed.impuesto.toLocaleString('es-CO')} COP
💵 *Gran Total Ventas:* $${parsed.gran_total.toLocaleString('es-CO')} COP

✅ Los datos se han guardado e integrado en el sistema. Ya están disponibles en los módulos de Ventas y Costeo.`;

          await enviarMensajeTelegram(chatId, respuesta);
          await guardarMensajeChat(chatId, 'model', respuesta);

          return NextResponse.json({ ok: true, guardado });
        } catch (err: any) {
          const errRespuesta = `❌ *Error procesando archivo de ventas*\n\n⚠️ ${err.message}\n\nAsegúrate de enviar un archivo .txt con el reporte oficial de caja POS (con la cabecera 'Del: DD/MM/AA').`;
          await enviarMensajeTelegram(chatId, errRespuesta);
          await guardarMensajeChat(chatId, 'model', errRespuesta);
          return NextResponse.json({ ok: false, error: err.message });
        }
      } else {
        const warning = `⚠️ Formato no compatible: Enviaste \`${fileName}\`. Para ingresar ventas debes subir un archivo con extensión \`.txt\`.`;
        await enviarMensajeTelegram(chatId, warning);
        await guardarMensajeChat(chatId, 'model', warning);
        return NextResponse.json({ ok: true });
      }
    }

    // =========================================================================
    // CASO 2: MENSAJE DE TEXTO NORMAL
    // =========================================================================
    if (!message.text) {
      return NextResponse.json({ ok: true, note: 'No text or supported document' });
    }

    const text = message.text.trim();

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

¡Pregúntame lo que necesites!`;
      await enviarMensajeTelegram(chatId, welcome);
      return NextResponse.json({ ok: true });
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
