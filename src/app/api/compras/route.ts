import { NextResponse } from 'next/server';
import { fetchComprasData } from '@/services/comprasService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodo_id') || 'per-2026-10';

    const data = await fetchComprasData(periodoId);

    if (!data.success) {
      return NextResponse.json({ success: false, error: data.error }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error en API compras:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error interno en compras API' },
      { status: 500 }
    );
  }
}
