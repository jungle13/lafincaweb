import { NextResponse } from 'next/server';
import { procesarMensajeTelegram } from '@/services/telegramBotService';

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

    // Comando /start o saludo
    if (text === '/start') {
      const welcome = `🥩 *¡Hola! Bienvenido al Asistente de La Finca en Telegram.*

Puedo responder consultas operativas en tiempo real:
• 📦 *Existencias de carne:* "¿Cuánto lomo fino nos queda?"
• 💰 *Precios y Catálogo:* "¿A cómo está el kilo de costilla?"
• 🧾 *Compras y Facturas:* "¿Cuáles fueron las últimas compras?"
• 📊 *Ventas del día:* "¿Cuánto se vendió el 25 de octubre?" o "¿Cuántos churrascos se han vendido?"

¡Pregúntame lo que necesites!`;
      const { enviarMensajeTelegram } = await import('@/services/telegramBotService');
      await enviarMensajeTelegram(chatId, welcome);
      return NextResponse.json({ ok: true });
    }

    // Procesar con Gemini y las herramientas de La Finca
    await procesarMensajeTelegram(chatId, text);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error en webhook de Telegram:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    servicio: 'La Finca Telegram Bot Webhook',
    timestamp: new Date().toISOString(),
  });
}
