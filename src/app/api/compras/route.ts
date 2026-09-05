import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPeriodoById } from '@/lib/periodos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get('fecha_inicio');
    const fechaFin = searchParams.get('fecha_fin');
    const periodoId = searchParams.get('periodo_id');

    let start = fechaInicio;
    let end = fechaFin;

    if (periodoId && (!start || !end)) {
      const p = getPeriodoById(periodoId);
      if (p) {
        start = start || p.fecha_inicio;
        end = end || p.fecha_fin;
      }
    }

    // 1. Consultar compras con sus detalles
    let query = supabase
      .from('compras')
      .select('*, compras_detalle(*, catalogo_insumos(nombre, categoria))')
      .order('fecha', { ascending: false });

    if (start) {
      query = query.gte('fecha', start);
    }
    if (end) {
      query = query.lte('fecha', end);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Error fetching from compras table:', error);
    }

    const flattened: any[] = [];

    if (data && data.length > 0) {
      data.forEach((c: any) => {
        if (c.compras_detalle && c.compras_detalle.length > 0) {
          c.compras_detalle.forEach((det: any) => {
            const insumoNom = det.catalogo_insumos?.nombre || 'Insumo';
            const catNom = det.catalogo_insumos?.categoria || 'CARNE DE RES';
            const hasFactura = Boolean(c.numero_factura && c.numero_factura !== 'Pendiente' && c.numero_factura !== 'PENDIENTE');
            const hasProv = Boolean(c.proveedor && c.proveedor !== 'Pendiente de Factura' && c.proveedor !== 'Proveedor Local');

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
              estadoFactura: (hasFactura && hasProv) ? 'COMPLETA' : 'PENDIENTE',
              observaciones: c.observaciones || '',
            });
          });
        } else {
          const hasFactura = Boolean(c.numero_factura && c.numero_factura !== 'Pendiente' && c.numero_factura !== 'PENDIENTE');
          const hasProv = Boolean(c.proveedor && c.proveedor !== 'Pendiente de Factura' && c.proveedor !== 'Proveedor Local');

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
            estadoFactura: (hasFactura && hasProv) ? 'COMPLETA' : 'PENDIENTE',
            observaciones: c.observaciones || '',
          });
        }
      });
    }

    // 2. Fallback con movimientos ENTRADA_COMPRA si compras estuviese vacío
    if (flattened.length === 0) {
      let movQuery = supabase
        .from('movimientos_inventario')
        .select('*, catalogo_insumos(nombre, categoria)')
        .eq('tipo_movimiento', 'ENTRADA_COMPRA')
        .order('fecha_hora', { ascending: false });

      if (start) movQuery = movQuery.gte('fecha', start);
      if (end) movQuery = movQuery.lte('fecha', end);

      const { data: movs } = await movQuery;

      if (movs && movs.length > 0) {
        movs.forEach((m: any) => {
          flattened.push({
            id: String(m.id),
            compraId: m.id,
            fecha: (m.fecha || m.fecha_hora || '').split('T')[0],
            factura: m.observaciones?.includes('Factura:') ? m.observaciones.split('Factura:')[1].split('-')[0].trim() : 'Pendiente',
            proveedor: m.origen?.replace('PROVEEDOR (', '').replace(')', '') || 'Proveedor Local',
            insumo: m.catalogo_insumos?.nombre || 'Carne',
            categoria: m.catalogo_insumos?.categoria || 'CARNE DE RES',
            cantidadKg: parseFloat(m.cant_sin_porcionar_kg) || 0,
            costoUnitarioKg: parseFloat(m.costo_unitario_kg) || 0,
            totalPesos: parseFloat(m.valor_total_movimiento) || ((parseFloat(m.cant_sin_porcionar_kg) || 0) * (parseFloat(m.costo_unitario_kg) || 0)),
            estadoFactura: 'PENDIENTE',
            observaciones: m.observaciones || '',
          });
        });
      }
    }

    return NextResponse.json(
      { success: true, data: flattened },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { compraId, numeroFactura, proveedor, observaciones } = body;

    if (!compraId) {
      return NextResponse.json({ error: 'Falta compraId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('compras')
      .update({
        numero_factura: numeroFactura || 'PENDIENTE',
        proveedor: proveedor || 'Proveedor Local',
        observaciones: observaciones || '',
      })
      .eq('id', compraId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
