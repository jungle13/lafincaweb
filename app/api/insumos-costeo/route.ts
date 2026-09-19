import { NextResponse } from 'next/server';
import { 
  getTransaccionesInsumos, 
  calculateInsumosKPIs, 
  groupTransactionsByInvoice, 
  groupTransactionsByItem, 
  getProveedoresList 
} from '@/services/insumosCosteoService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo_id = searchParams.get('periodo_id') || 'per-2026-09';
    const submodulo = searchParams.get('submodulo') || undefined;
    const tipo_contable = searchParams.get('tipo_contable') || undefined;
    const fecha = searchParams.get('fecha') || undefined;
    const proveedor = searchParams.get('proveedor') || undefined;
    const search = searchParams.get('search') || undefined;
    const relacion_cuaderno = searchParams.get('relacion_cuaderno') || undefined;

    const [transacciones, proveedores] = await Promise.all([
      getTransaccionesInsumos({
        periodo_id,
        submodulo,
        tipo_contable,
        fecha,
        proveedor,
        search,
        relacion_cuaderno,
      }),
      getProveedoresList(periodo_id),
    ]);

    const kpis = calculateInsumosKPIs(transacciones);
    const facturas = groupTransactionsByInvoice(transacciones);
    const items = groupTransactionsByItem(transacciones);

    return NextResponse.json({
      success: true,
      data: {
        kpis,
        transacciones,
        facturas,
        items,
        proveedores,
      },
    });
  } catch (err: any) {
    console.error('Error en GET /api/insumos-costeo:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
