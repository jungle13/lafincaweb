import { NextResponse } from 'next/server';
import { getConteosList, createConteoSession } from '@/services/conteosService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getConteosList();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { fecha, usuario } = await req.json();
    const data = await createConteoSession(fecha, usuario);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
