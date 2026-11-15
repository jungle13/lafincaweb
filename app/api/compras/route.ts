import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchComprasData, fetchMesesComprasResumen } from '@/services/comprasService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    if (view === 'MESES') {
      const meses = await fetchMesesComprasResumen();
      return NextResponse.json({ success: true, meses });
    }

    const periodoId = searchParams.get('periodo_id') || 'per-2026-10';

    const data = await fetchComprasData(periodoId);

    if (!data.success) {
      return NextResponse.json({ success: false, error: data.error }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error en API compras:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error interno en compras API' },
      { status: 500 }
    );
  }
}

const normName = (s: string): string =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const resolveCatalogMatch = (rawName: string, catalogRows: any[], insumoId?: string | null) => {
  if (insumoId) {
    const byId = catalogRows.find((c: any) => c.id === insumoId);
    if (byId) return byId;
  }
  const target = normName(rawName);
  if (!target || target.length < 3) return null;

  const exact = catalogRows.find((c: any) => normName(c.nombre) === target);
  if (exact) return exact;

  const candidates = catalogRows.filter((c: any) => {
    const cn = normName(c.nombre);
    return cn.length >= 4 && (cn.includes(target) || target.includes(cn));
  });
  if (candidates.length === 0) return null;
  candidates.sort((a: any, b: any) => normName(a.nombre).length - normName(b.nombre).length);
  return candidates[0];
};

const normalizePackagingCost = (
  rawCost: number,
  rawName: string,
  rawDetalle: string,
  invUnit: string,
  catUnit: string
): number => {
  if (rawCost <= 0) return 0;
  const det = normName(`${rawName} ${rawDetalle}`);
  const uInv = normName(invUnit);
  const uCat = normName(catUnit || 'Kg');

  if ((det.includes('x 24') || det.includes('x24') || det.includes('24 und') || uInv.includes('caja') || uInv.includes('paca')) && rawCost > 20000) {
    return Math.round(rawCost / 24);
  }
  if ((det.includes('x 12') || det.includes('x12') || det.includes('12 und')) && rawCost > 12000) {
    return Math.round(rawCost / 12);
  }
  if ((det.includes('x 30') || det.includes('x30') || det.includes('panal')) && rawCost > 8000) {
    return Math.round(rawCost / 30);
  }
  if ((det.includes('bulto') || uInv.includes('bulto')) && uCat === 'kg' && rawCost > 30000) {
    return Math.round(rawCost / 50);
  }
  return Math.round(rawCost);
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      numero_factura,
      fecha,
      proveedor,
      categoria,
      origen,
      observaciones,
      periodo_id,
      items
    } = body;

    if (!numero_factura || !fecha || !proveedor) {
      return NextResponse.json(
        { success: false, error: 'El número de factura, la fecha y el proveedor son obligatorios.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe ingresar al menos un insumo en la factura.' },
        { status: 400 }
      );
    }

    const { data: catalogData } = await supabase
      .from('catalogo_insumos')
      .select('id, nombre, unidad_medida, costo_unitario_kg');
    const catalogRows = catalogData || [];

    let valor_total = 0;
    const compraId = crypto.randomUUID();
    const targetPeriodo = periodo_id || 'per-2026-10';

    const lineasToInsert = items.map((it: any) => {
      const cant = Number(it.cantidad || 0);
      const costo = Number(it.costo_unitario || 0);
      const subtotal = Number(it.valor_compra || (cant * costo));
      valor_total += subtotal;

      const catMatch = resolveCatalogMatch(it.nombre_insumo || it.detalle || '', catalogRows, it.insumo_id);
      const normalizedCostKg = normalizePackagingCost(
        costo,
        it.nombre_insumo || '',
        it.detalle || '',
        it.unidad || 'Und',
        catMatch?.unidad_medida || 'Kg'
      );

      return {
        id: crypto.randomUUID(),
        compra_id: compraId,
        insumo_id: catMatch?.id || it.insumo_id || null,
        fecha,
        numero_factura,
        proveedor,
        categoria: it.categoria || categoria || 'Otros Insumos y Servicios',
        nombre_insumo: it.nombre_insumo || 'Insumo',
        detalle: it.detalle || it.nombre_insumo || '',
        cantidad: cant,
        cantidad_kg: it.unidad === 'Kg' ? cant : cant,
        unidad: it.unidad || 'Und',
        costo_unitario: costo,
        costo_unitario_kg: normalizedCostKg > 0 ? normalizedCostKg : costo,
        valor_compra: subtotal,
        costo_total: subtotal,
        origen: origen || 'Registro manual',
        observaciones: observaciones || null,
        periodo_id: targetPeriodo
      };
    });

    // 1. Insertar en compras
    const { data: compraCreated, error: errCompra } = await supabase
      .from('compras')
      .insert({
        id: compraId,
        fecha,
        numero_factura,
        proveedor,
        valor_total,
        observaciones: observaciones || null,
        usuario: 'Administración / Facturación',
        periodo_id: targetPeriodo,
        origen: origen || 'Registro manual',
        categoria: categoria || lineasToInsert[0]?.categoria || 'Otros Insumos y Servicios',
        total_items: lineasToInsert.length
      })
      .select('*')
      .single();

    if (errCompra) {
      console.error('Error insertando compra:', errCompra);
      throw errCompra;
    }

    // 2. Insertar en compras_detalle
    const { error: errDetalle } = await supabase
      .from('compras_detalle')
      .insert(lineasToInsert);

    if (errDetalle) {
      console.error('Error insertando compras_detalle:', errDetalle);
      await supabase.from('compras').delete().eq('id', compraId);
      throw errDetalle;
    }

    // 3. Disparador automático: actualizar costo_unitario_kg en catalogo_insumos con la nueva factura
    try {
      for (const linea of lineasToInsert) {
        const rawCost = Number(linea.costo_unitario_kg || linea.costo_unitario || 0);
        if (rawCost <= 0) continue;

        const catMatch = resolveCatalogMatch(linea.nombre_insumo || '', catalogRows, linea.insumo_id);
        if (!catMatch) continue;

        // Verificar que esta factura sea >= última factura registrada para ese insumo (coherencia cronológica)
        const { data: newerInv } = await supabase
          .from('compras_detalle')
          .select('fecha')
          .eq('insumo_id', catMatch.id)
          .gt('fecha', fecha)
          .limit(1);

        if (newerInv && newerInv.length > 0) continue;

        const normalizedCost = normalizePackagingCost(
          rawCost,
          linea.nombre_insumo || '',
          linea.detalle || '',
          linea.unidad || '',
          catMatch.unidad_medida || 'Kg'
        );

        await supabase
          .from('catalogo_insumos')
          .update({
            costo_unitario_kg: normalizedCost,
            updated_at: new Date().toISOString(),
          })
          .eq('id', catMatch.id);
      }
    } catch (syncCatErr) {
      console.warn('[POST /api/compras] Advertencia actualizando precios en catálogo:', syncCatErr);
    }

    return NextResponse.json({
      success: true,
      compra: compraCreated,
      total_items: lineasToInsert.length,
      valor_total
    });
  } catch (err: any) {
    console.error('Error en POST /api/compras:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error al guardar la factura' },
      { status: 500 }
    );
  }
}
