import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { enviarMensajeTelegram, guardarMensajeChat } from '@/services/telegramBotService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const chatId = Number(params.chatId);
    if (!chatId) {
      return NextResponse.json({ ok: false, error: 'Chat ID inválido' }, { status: 400 });
    }

    // 1. Obtener datos del usuario
    const { data: usuario } = await supabase
      .from('telegram_usuarios')
      .select('*')
      .eq('chat_id', chatId)
      .maybeSingle();

    // 2. Obtener mensajes ordenados cronológicamente
    const { data: mensajes, error: msgError } = await supabase
      .from('telegram_mensajes_contexto')
      .select('id, chat_id, role, content, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(300);

    if (msgError) {
      return NextResponse.json({ ok: false, error: msgError.message }, { status: 500 });
    }

    const defaultName =
      chatId === 9126609191 ? 'Arturo' :
      chatId === 9064833515 ? 'Eliana' :
      chatId === 6566295870 ? 'César' : 'Usuario';

    const defaultLast =
      chatId === 9126609191 ? 'Rivera' :
      chatId === 9064833515 ? 'Garces' :
      chatId === 6566295870 ? 'Arango' : '';

    return NextResponse.json(
      {
        ok: true,
        usuario: usuario || { chat_id: chatId, first_name: defaultName, last_name: defaultLast, rol: 'Colaborador' },
        mensajes: mensajes || [],
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'CDN-Cache-Control': 'no-store',
          'Vercel-CDN-Cache-Control': 'no-store',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { chatId: string } }) {
  try {
    const chatId = Number(params.chatId);
    if (!chatId) {
      return NextResponse.json({ ok: false, error: 'Chat ID inválido' }, { status: 400 });
    }

    const body = await req.json();
    const texto = body.texto?.trim();
    if (!texto) {
      return NextResponse.json({ ok: false, error: 'El mensaje no puede estar vacío' }, { status: 400 });
    }

    // 1. Enviar mensaje a Telegram
    await enviarMensajeTelegram(chatId, texto);

    // 2. Guardar en historial
    await guardarMensajeChat(chatId, 'model', texto);

    // 3. Actualizar último mensaje en perfil de usuario
    await supabase.from('telegram_usuarios').upsert(
      {
        chat_id: chatId,
        ultimo_mensaje: texto.slice(0, 500),
        ultimo_mensaje_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chat_id' }
    );

    return NextResponse.json({ ok: true, mensaje: 'Mensaje enviado exitosamente' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
