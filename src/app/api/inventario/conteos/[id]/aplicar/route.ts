import { NextResponse } from 'next/server';
import { aplicarConteoFisico } from '@/services/conteosService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await aplicarConteoFisico(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
