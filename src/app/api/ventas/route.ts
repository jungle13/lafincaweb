import { NextResponse } from 'next/server';
import { 
  getVentasKPIs, 
  getVentasDiarias, 
  getVentasPorProducto, 
  getVentasDetalle, 
  getVentasRentabilidad,
  getComparacionCuadreVentas 
} from '@/services/ventasService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodoId = searchParams.get('periodo_id') || 'per-2026-09';
    const view = searchParams.get('view') || 'ALL';
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

    // Por defecto view === 'ALL': devolver conjunto completo para carga inicial rápida
    const [kpis, diarias, rankingData, detalleData, rentabilidad, cuadre] = await Promise.all([
      getVentasKPIs(periodoId),
      getVentasDiarias(periodoId),
      getVentasPorProducto(periodoId, categoria, search),
      getVentasDetalle({ periodoId, fecha, categoria, search, page: 1, pageSize: 50 }),
      getVentasRentabilidad(periodoId),
      getComparacionCuadreVentas(periodoId)
    ]);

    return NextResponse.json({
      success: true,
      kpis,
      diarias,
      ranking: rankingData.ranking,
      categorias: rankingData.categorias,
      detalle: detalleData,
      rentabilidad,
      cuadre
    });
  } catch (err: any) {
    console.error('Error en GET /api/ventas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

