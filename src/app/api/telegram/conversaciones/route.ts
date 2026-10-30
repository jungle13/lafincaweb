import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: usuarios, error } = await supabase
      .from('telegram_usuarios')
      .select('*')
      .order('ultimo_mensaje_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo usuarios de Telegram:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, conversaciones: usuarios || [] });
  } catch (err: any) {
    console.error('Error en /api/telegram/conversaciones:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
