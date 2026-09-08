import { NextResponse } from 'next/server';
import { getAllPeriodos, getActivePeriodo, getPeriodoById, calculatePeriodoStock } from '@/lib/periodos';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const periodoId = searchParams.get('periodo_id') || searchParams.get('codigo');
    const fechaCorte = searchParams.get('fecha_corte') || undefined;

    const periodos = getAllPeriodos();
    const activo = getActivePeriodo();
    const currentPeriodo = periodoId ? (getPeriodoById(periodoId) || activo) : activo;

    // Obtener catálogo de insumos actualizado
    const { data: insumos } = await supabase
      .from('catalogo_insumos')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    // Calcular el stock teórico exacto del periodo seleccionado y fecha de corte
    let stockPeriodo: any[] = [];
    let totalMovs = 0;
    if (currentPeriodo) {
      const calcResult = await calculatePeriodoStock(currentPeriodo.id, fechaCorte);
      if (calcResult && calcResult.stockMap) {
        stockPeriodo = Object.values(calcResult.stockMap);
        totalMovs = (calcResult as any).totalMovs ?? 0;
      }
    }

    // Si no se pudo calcular, obtener de stock_actual como fallback
    if (stockPeriodo.length === 0) {
      const { data: stockLive } = await supabase
        .from('stock_actual')
        .select('*');
      stockPeriodo = stockLive || [];
    }

    // Obtener fechas únicas que tienen movimientos aprobados en este periodo
    let fechasConMovimientos: string[] = [];
    if (currentPeriodo) {
      const { data: movDates } = await supabase
        .from('movimientos_inventario')
        .select('fecha')
        .gte('fecha', currentPeriodo.fecha_inicio)
        .lte('fecha', currentPeriodo.fecha_fin)
        .not('tipo_movimiento', 'eq', 'INVENTARIO_INICIAL')
        .not('observaciones', 'ilike', '%[PENDIENTE_APROBAR]%')
        .order('fecha', { ascending: true });

      if (movDates) {
        fechasConMovimientos = Array.from(new Set(movDates.map((m: any) => m.fecha))).filter(Boolean);
      }
    }

    return NextResponse.json({
      success: true,
      periodos,
      activo,
      selectedPeriodo: currentPeriodo,
      fecha_corte: fechaCorte || 'ACTUAL',
      total_movs_aplicados: totalMovs,
      fechas_con_movimientos: fechasConMovimientos,
      insumos: insumos || [],
      stock: stockPeriodo,
      conteo_cierre_fisico: currentPeriodo?.conteo_cierre_fisico || {},
      ajustes_aprobados: (currentPeriodo as any)?.ajustes_aprobados || {}
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
