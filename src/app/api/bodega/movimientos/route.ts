import { NextResponse } from 'next/server';
import { getMovimientosInventario, registrarMovimientoBodega } from '@/services/movimientosService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha') || undefined;
    const insumoId = searchParams.get('insumoId') || undefined;

    const data = await getMovimientosInventario({ fecha, insumoId });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await registrarMovimientoBodega(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
