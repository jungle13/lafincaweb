import { NextResponse } from 'next/server';
import { getAllPeriodos, getActivePeriodo, getPeriodoById, calculatePeriodoStock } from '@/services/periodosService';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const periodoId = searchParams.get('periodo_id') || searchParams.get('codigo');
    const fechaCorte = searchParams.get('fecha_corte') || undefined;

    const periodos = await getAllPeriodos();
    const activo = await getActivePeriodo();
    const currentPeriodo = periodoId ? ((await getPeriodoById(periodoId)) || activo) : activo;

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

    // Obtener conteos físicos formalizados/aplicados en este periodo
    let conteosAplicados: any[] = [];
    if (currentPeriodo) {
      const { data: cData } = await supabase
        .from('conteos_fisicos')
        .select('id, fecha, usuario, created_at, estado')
        .eq('estado', 'APLICADO')
        .gte('fecha', currentPeriodo.fecha_inicio)
        .lte('fecha', currentPeriodo.fecha_fin)
        .order('fecha', { ascending: false });
      if (cData) conteosAplicados = cData;
    }

    // Si el corte solicitado es un conteo físico específico (ej. CONTEO_uuid)
    if (fechaCorte && fechaCorte.startsWith('CONTEO_')) {
      const targetConteoId = fechaCorte.replace('CONTEO_', '');
      const { data: conteoDetalles, error: detErr } = await supabase
        .from('conteos_fisicos_detalle')
        .select('*')
        .eq('conteo_id', targetConteoId);

      if (conteoDetalles && conteoDetalles.length > 0) {
        // Mapear el stock con la foto exacta del conteo físico
        const detMap = new Map<string, any>();
        conteoDetalles.forEach((d: any) => {
          const key = `${d.insumo_id}_${d.ubicacion}`;
          detMap.set(key, d);
        });

        stockPeriodo = stockPeriodo.map((item: any) => {
          const iId = String(item.insumo_id);
          const detBodega = detMap.get(`${iId}_BODEGA`);
          const detCocina = detMap.get(`${iId}_COCINA`);

          // Regla estricta: si el insumo no fue contado, queda en cero
          const bSinPorc = detBodega ? parseFloat(detBodega.cant_sin_porcionar_kg || 0) : 0;
          const bPorcUnd = detBodega ? parseInt(detBodega.porciones_und || 0) : 0;
          const bPorcKg = detBodega ? parseFloat(detBodega.peso_porciones_kg || 0) : 0;

          const cSinPorc = detCocina ? parseFloat(detCocina.cant_sin_porcionar_kg || 0) : 0;
          const cPorcUnd = detCocina ? parseInt(detCocina.porciones_und || 0) : 0;
          const cPorcKg = detCocina ? parseFloat(detCocina.peso_porciones_kg || 0) : 0;

          const totalBodegaKg = bSinPorc + bPorcKg;
          const totalCocinaKg = cSinPorc + cPorcKg;
          const totalGeneralKg = totalBodegaKg + totalCocinaKg;
          const unitCost = detBodega?.costo_unitario_kg != null ? parseFloat(detBodega.costo_unitario_kg) : (item.costo_unitario_kg || 0);

          const valBodega = detBodega?.valor_total != null ? Math.round(parseFloat(detBodega.valor_total)) : Math.round(totalBodegaKg * unitCost);
          const valCocina = detCocina?.valor_total != null ? Math.round(parseFloat(detCocina.valor_total)) : Math.round(totalCocinaKg * unitCost);

          return {
            ...item,
            costo_unitario_kg: unitCost,
            bodega_sin_porcionar_kg: bSinPorc,
            bodega_sin_porc_kg: bSinPorc,
            bodega_porcionado_und: bPorcUnd,
            bodega_porc_und: bPorcUnd,
            bodega_porcionado_kg: bPorcKg,
            bodega_porc_kg: bPorcKg,
            peso_total_bodega_kg: totalBodegaKg,
            cocina_sin_porcionar_kg: cSinPorc,
            cocina_sin_porc_kg: cSinPorc,
            cocina_porcionado_und: cPorcUnd,
            cocina_porc_und: cPorcUnd,
            cocina_porcionado_kg: cPorcKg,
            cocina_porc_kg: cPorcKg,
            peso_total_cocina_kg: totalCocinaKg,
            peso_total_general_kg: totalGeneralKg,
            valor_total_bodega_pesos: valBodega,
            valor_total_cocina_pesos: valCocina,
            valor_total_general_pesos: valBodega,
            merma_acumulada_kg: 0,
            merma_acumulada_pesos: 0,
            traslado_cocina_acumulado_kg: 0,
            traslado_cocina_acumulado_und: 0
          };
        });
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
      conteos_aplicados: conteosAplicados,
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
