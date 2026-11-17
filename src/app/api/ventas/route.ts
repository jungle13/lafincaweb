import { NextResponse } from 'next/server';
import { 
  getVentasKPIs, 
  getVentasDiarias, 
  getVentasPorProducto, 
  getVentasDetalle, 
  getVentasRentabilidad,
  getComparacionCuadreVentas,
  fetchMesesVentasResumen,
  getVentasResumenCompleto
} from '@/services/ventasService';

import { cachedVentasByPeriodo } from '@/lib/ventasCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'ALL';

    if (view === 'MESES') {
      const meses = await fetchMesesVentasResumen();
      return NextResponse.json({ success: true, meses });
    }

    const periodoId = searchParams.get('periodo_id') || 'per-2026-10';
    const fecha = searchParams.get('fecha') || 'ALL';
    const categoria = searchParams.get('categoria') || 'ALL';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    if (view === 'DIARIO') {
      const [kpis, diarias] = await Promise.all([
        getVentasKPIs(periodoId),
        getVentasDiarias(periodoId)
      ]);
      return NextResponse.json({ success: true, kpis, diarias });
    }

    if (view === 'PRODUCTOS') {
      const [kpis, rankingData] = await Promise.all([
        getVentasKPIs(periodoId),
        getVentasPorProducto(periodoId, categoria, search)
      ]);
      return NextResponse.json({
        success: true,
        kpis,
        ranking: rankingData.ranking,
        categorias: rankingData.categorias,
        totalVentas: rankingData.totalVentas
      });
    }

    if (view === 'TRANSACCIONES') {
      const detalleData = await getVentasDetalle({
        periodoId,
        fecha,
        categoria,
        search,
        page,
        pageSize
      });
      return NextResponse.json({ success: true, ...detalleData });
    }

    if (view === 'RENTABILIDAD') {
      const rentabilidad = await getVentasRentabilidad(periodoId);
      return NextResponse.json({ success: true, rentabilidad });
    }

    if (view === 'CUADRE') {
      const cuadre = await getComparacionCuadreVentas(periodoId);
      return NextResponse.json({ success: true, ...cuadre });
    }

    // Por defecto view === 'ALL': carga consolidada en 2 consultas con caché 20s
    const cacheKey = `${periodoId}|${categoria}|${search}`;
    const cached = cachedVentasByPeriodo.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return NextResponse.json(cached.data);
    }

    const resumen = await getVentasResumenCompleto(periodoId);
    const payload = {
      success: true,
      kpis: resumen.kpis,
      diarias: resumen.diarias,
      ranking: resumen.ranking,
      categorias: resumen.categorias,
      totalVentas: resumen.totalVentas,
    };

    cachedVentasByPeriodo.set(cacheKey, { data: payload, expiry: Date.now() + 20000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('Error en GET /api/ventas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
