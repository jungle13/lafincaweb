import { NextResponse } from 'next/server';
import { closePeriodAndOpenNext } from '@/lib/periodos';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { periodoId, conteoFisico, usuario = 'Administrador', observaciones = '' } = body;

    if (!periodoId || !conteoFisico) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (periodoId, conteoFisico)' }, { status: 400 });
    }

    const result = await closePeriodAndOpenNext(periodoId, conteoFisico, usuario, observaciones);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
