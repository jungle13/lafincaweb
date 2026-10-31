import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: Request) {
  try {
    // 1. Obtener usuarios registrados en telegram_usuarios
    const { data: usuarios, error: errU } = await supabase
      .from('telegram_usuarios')
      .select('*');

    if (errU) {
      console.error('Error obteniendo usuarios de Telegram:', errU);
    }

    // 2. Obtener los mensajes más recientes de telegram_mensajes_contexto para capturar
    // cualquier chat generado en el servidor que aún no haya sincronizado su perfil
    const { data: ultimosMsgs, error: errM } = await supabase
      .from('telegram_mensajes_contexto')
      .select('chat_id, role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(300);

    const usuariosMap = new Map<number, any>();
    (usuarios || []).forEach((u) => {
      usuariosMap.set(Number(u.chat_id), { ...u });
    });

    // Agrupar mensajes más recientes por chat_id
    const msgsPorChat = new Map<number, { ultimo_mensaje: string; ultimo_mensaje_at: string; total_en_contexto: number }>();
    (ultimosMsgs || []).forEach((m) => {
      const cId = Number(m.chat_id);
      if (!msgsPorChat.has(cId)) {
        msgsPorChat.set(cId, {
          ultimo_mensaje: m.content || '',
          ultimo_mensaje_at: m.created_at,
          total_en_contexto: 1,
        });
      } else {
        const entry = msgsPorChat.get(cId)!;
        entry.total_en_contexto++;
      }
    });

    // Fusionar mensajes en vivo del servidor con la lista de usuarios usando forEach compatible
    msgsPorChat.forEach((msgInfo, cId) => {
      if (usuariosMap.has(cId)) {
        const u = usuariosMap.get(cId);
        // Si el mensaje en contexto es más reciente o el usuario no tiene último mensaje
        if (!u.ultimo_mensaje_at || new Date(msgInfo.ultimo_mensaje_at) > new Date(u.ultimo_mensaje_at)) {
          u.ultimo_mensaje = msgInfo.ultimo_mensaje;
          u.ultimo_mensaje_at = msgInfo.ultimo_mensaje_at;
        }
      } else {
        // Chat activo en servidor que no estaba en telegram_usuarios (ej: Arturo u otros)
        const knownName =
          cId === 9126609191 ? 'Arturo' :
          cId === 9064833515 ? 'Eliana' :
          cId === 6566295870 ? 'César' : `Usuario ${cId}`;

        const knownLast =
          cId === 9126609191 ? 'Rivera' :
          cId === 9064833515 ? 'Garces' :
          cId === 6566295870 ? 'Arango' : '';

        usuariosMap.set(cId, {
          id: cId,
          chat_id: cId,
          first_name: knownName,
          last_name: knownLast,
          username: '',
          rol: 'Colaborador',
          ultimo_mensaje: msgInfo.ultimo_mensaje,
          ultimo_mensaje_at: msgInfo.ultimo_mensaje_at,
          total_mensajes: msgInfo.total_en_contexto,
          created_at: msgInfo.ultimo_mensaje_at,
          updated_at: msgInfo.ultimo_mensaje_at,
        });
      }
    });

    const conversaciones = Array.from(usuariosMap.values()).sort((a, b) => {
      const tA = a.ultimo_mensaje_at ? new Date(a.ultimo_mensaje_at).getTime() : 0;
      const tB = b.ultimo_mensaje_at ? new Date(b.ultimo_mensaje_at).getTime() : 0;
      return tB - tA;
    });

    return NextResponse.json(
      { ok: true, conversaciones },
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
    console.error('Error en /api/telegram/conversaciones:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
