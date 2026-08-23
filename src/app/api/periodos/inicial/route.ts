import { NextResponse } from 'next/server';
import { saveInitialInventory } from '@/lib/periodos';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { periodoId, items, usuario = 'Administrador' } = body;

    if (!periodoId || !items) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (periodoId, items)' }, { status: 400 });
    }

    const updatedPeriod = await saveInitialInventory(periodoId, items, usuario);
    return NextResponse.json({ success: true, periodo: updatedPeriod });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
