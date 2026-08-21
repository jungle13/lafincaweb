import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Consultar compras con sus detalles
    const { data, error } = await supabase
      .from('compras')
      .select('*, compras_detalle(*, catalogo_insumos(nombre, categoria))')
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      console.warn('Error fetching from compras table, trying movimientos_inventario:', error);
    }

    const flattened: any[] = [];

    if (data && data.length > 0) {
      data.forEach((c: any) => {
        if (c.compras_detalle && c.compras_detalle.length > 0) {
          c.compras_detalle.forEach((det: any) => {
            const insumoNom = det.catalogo_insumos?.nombre || 'Carne / Insumo';
            const catNom = det.catalogo_insumos?.categoria || 'CARNE DE RES';
            const hasFactura = Boolean(c.numero_factura && c.numero_factura !== 'Pendiente');
            const hasProv = Boolean(c.proveedor && c.proveedor !== 'Pendiente de Factura');

            flattened.push({
              id: `${c.id}-${det.id || 0}`,
              compraId: c.id,
              fecha: c.fecha || (c.created_at ? c.created_at.split('T')[0] : ''),
              factura: c.numero_factura || 'Pendiente',
              proveedor: c.proveedor || 'Proveedor Local',
              insumo: insumoNom,
              categoria: catNom,
              cantidadKg: parseFloat(det.cantidad_kg) || 0,
              costoUnitarioKg: parseFloat(det.costo_unitario_kg) || 0,
              totalPesos: parseFloat(det.costo_total) || parseFloat(c.valor_total) || 0,
              estadoFactura: (hasFactura && hasProv) ? 'LIQUIDADA' : 'PENDIENTE',
              observaciones: c.observaciones || '',
            });
          });
        } else {
          const hasFactura = Boolean(c.numero_factura && c.numero_factura !== 'Pendiente');
          const hasProv = Boolean(c.proveedor && c.proveedor !== 'Pendiente de Factura');

          flattened.push({
            id: String(c.id),
            compraId: c.id,
            fecha: c.fecha || (c.created_at ? c.created_at.split('T')[0] : ''),
            factura: c.numero_factura || 'Pendiente',
            proveedor: c.proveedor || 'Proveedor Local',
            insumo: 'Varios / Lote de Carnes',
            categoria: 'CARNES',
            cantidadKg: 0,
            costoUnitarioKg: 0,
            totalPesos: parseFloat(c.valor_total) || 0,
            estadoFactura: (hasFactura && hasProv) ? 'LIQUIDADA' : 'PENDIENTE',
            observaciones: c.observaciones || '',
          });
        }
      });
    }

    // 2. Si la tabla compras tiene pocos datos, enriquecer con movimientos ENTRADA_COMPRA
    if (flattened.length === 0) {
      const { data: movs } = await supabase
        .from('movimientos_inventario')
        .select('*, catalogo_insumos(nombre, categoria)')
        .eq('tipo_movimiento', 'ENTRADA_COMPRA')
        .order('fecha_movimiento', { ascending: false });

      if (movs && movs.length > 0) {
        movs.forEach((m: any) => {
          flattened.push({
            id: String(m.id),
            compraId: m.id,
            fecha: (m.fecha_movimiento || m.fecha_hora || '').split('T')[0],
            factura: m.observaciones?.includes('Factura:') ? m.observaciones.split('Factura:')[1].split('-')[0].trim() : 'FAC-BOD',
            proveedor: m.origen?.replace('PROVEEDOR (', '').replace(')', '') || 'Proveedor Local',
            insumo: m.catalogo_insumos?.nombre || 'Carne',
            categoria: m.catalogo_insumos?.categoria || 'CARNE DE RES',
            cantidadKg: parseFloat(m.cant_sin_porcionar_kg) || 0,
            costoUnitarioKg: parseFloat(m.costo_unitario_kg) || 0,
            totalPesos: parseFloat(m.valor_total_movimiento) || ((parseFloat(m.cant_sin_porcionar_kg) || 0) * (parseFloat(m.costo_unitario_kg) || 0)),
            estadoFactura: 'LIQUIDADA',
            observaciones: m.observaciones || '',
          });
        });
      }
    }

    return NextResponse.json({ success: true, data: flattened });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
