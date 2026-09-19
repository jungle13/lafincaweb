import { NextResponse } from 'next/server';
import { getConteoDetails, addConteoItem, removeConteoItem } from '@/services/conteosService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { conteo, detalles } = await getConteoDetails(params.id);
    return NextResponse.json({ success: true, conteo, detalles });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    await addConteoItem(params.id, body);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const detalleId = searchParams.get('detalleId');
    if (!detalleId) throw new Error('Falta el ID del detalle');
    await removeConteoItem(params.id, detalleId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
