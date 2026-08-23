import { NextResponse } from 'next/server';
import { getAllPeriodos, getActivePeriodo } from '@/lib/periodos';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const periodos = getAllPeriodos();
    const activo = getActivePeriodo();

    // Obtener catálogo de insumos para enriquecer vistas
    const { data: insumos } = await supabase
      .from('catalogo_insumos')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    // Obtener stock actual
    const { data: stock } = await supabase
      .from('stock_actual')
      .select('*');

    return NextResponse.json({
      success: true,
      periodos,
      activo,
      insumos: insumos || [],
      stock: stock || []
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
