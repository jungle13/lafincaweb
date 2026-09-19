import { NextResponse } from 'next/server';
import { 
  getCajaMenorData, 
  getCuadernoArturoData, 
  toggleCajaCosteo, 
  toggleArturoCosteo 
} from '@/services/librosEgresosService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const libro = searchParams.get('libro') || 'CAJA';
    const periodo_id = searchParams.get('periodo_id') || 'per-2026-09';
    const responsable = searchParams.get('responsable') || undefined;
    const estado = searchParams.get('estado') || undefined;
    const search = searchParams.get('search') || undefined;

    if (libro === 'ARTURO') {
      const data = await getCuadernoArturoData({ periodo_id, estado, search });
      return NextResponse.json({ success: true, libro: 'ARTURO', ...data });
    }

    // Default CAJA
    const data = await getCajaMenorData({ periodo_id, responsable, estado, search });
    return NextResponse.json({ success: true, libro: 'CAJA', ...data });
  } catch (err: any) {
    console.error('Error en GET /api/libros-egresos:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, incluir } = body;

    if (!id || action === undefined) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (action, id)' }, { status: 400 });
    }

    if (action === 'TOGGLE_CAJA') {
      const res = await toggleCajaCosteo(id, !!incluir);
      return NextResponse.json(res);
    } else if (action === 'TOGGLE_ARTURO') {
      const res = await toggleArturoCosteo(id, !!incluir);
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err: any) {
    console.error('Error en POST /api/libros-egresos:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
