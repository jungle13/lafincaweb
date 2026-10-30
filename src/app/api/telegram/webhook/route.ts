import { NextResponse } from 'next/server';
import { procesarMensajeTelegram, registrarUsuarioTelegram } from '@/services/telegramBotService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const update = await req.json();

    // Validar si el update contiene un mensaje de texto
    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true, note: 'No text message' });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Capturar datos del usuario que envía el mensaje
    const from = message.from || message.chat || {};
    const sender = {
      first_name: from.first_name || message.chat?.first_name || 'Usuario',
      last_name: from.last_name || message.chat?.last_name || '',
      username: from.username || message.chat?.username || '',
    };

    // Registrar o actualizar datos del usuario
    await registrarUsuarioTelegram(chatId, sender, text);

    // Comando /start o saludo
    if (text === '/start') {
      const welcome = `🥩 *¡Hola ${sender.first_name}! Bienvenido al Asistente de La Finca en Telegram.*

Puedo responder consultas operativas en tiempo real:
• 📦 *Existencias de carne:* "¿Cuánto lomo fino nos queda?"
• 💰 *Precios y Catálogo:* "¿A cómo está el kilo de costilla?"
• 🧾 *Compras y Facturas:* "¿Cuáles fueron las últimas compras?"
• 📊 *Ventas del día:* "¿Cuánto se vendió el 25 de octubre?" o "¿Cuántos churrascos se han vendido?"
• 💼 *Libro de Caja Menor:* "¿Cuánto se ha gastado en caja menor en octubre?" o "¿Qué gastos se pagaron el 25 de octubre?"

¡Pregúntame lo que necesites!`;
      const { enviarMensajeTelegram } = await import('@/services/telegramBotService');
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
