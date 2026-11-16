import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normProvName(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET() {
  try {
    const [{ data: provRows, error: errP }, { data: comprasRows, error: errC }] = await Promise.all([
      supabase.from('proveedores').select('*').order('codigo', { ascending: true }),
      supabase
        .from('compras')
        .select('id, fecha, numero_factura, proveedor, categoria, valor_total, estado_pago, valor_pagado, fecha_pago, comprobante_egreso')
        .order('fecha', { ascending: false }),
    ]);

    if (errP) throw errP;
    if (errC) throw errC;

    const comprasByNorm = new Map<string, any[]>();
    for (const c of (comprasRows || [])) {
      const k = normProvName(c.proveedor || '');
      if (!k) continue;
      if (!comprasByNorm.has(k)) comprasByNorm.set(k, []);
      comprasByNorm.get(k)!.push(c);
    }

    const proveedoresEnriquecidos = (provRows || []).map((p: any) => {
      const k = normProvName(p.nombre || '');
      const facturas = (comprasByNorm.get(k) || []).map((f: any) => {
        const valorTotal = Number(f.valor_total || 0);
        const estadoPago = String(f.estado_pago || 'PENDIENTE').toUpperCase();
        const valorPagado =
          estadoPago === 'PAGADO'
            ? (Number(f.valor_pagado || 0) > 0 ? Number(f.valor_pagado) : valorTotal)
            : estadoPago === 'PARCIAL'
              ? Number(f.valor_pagado || 0)
              : 0;
        return {
          id: f.id,
          fecha: f.fecha,
          numero_factura: f.numero_factura || 'S/N',
          categoria: f.categoria || p.categoria_principal || '',
          valor_total: valorTotal,
          estado_pago: estadoPago,
          valor_pagado: valorPagado,
          saldo_pendiente: Math.max(0, valorTotal - valorPagado),
          fecha_pago: f.fecha_pago || null,
          comprobante_egreso: f.comprobante_egreso || null,
        };
      });

      const total_comprado = facturas.reduce((acc, f) => acc + f.valor_total, 0);
      const total_pagado = facturas.reduce((acc, f) => acc + f.valor_pagado, 0);
      const fechas_facturas = Array.from(new Set(facturas.map((f) => f.fecha))).sort().reverse();

      return {
        ...p,
        cantidad_facturas: facturas.length,
        total_comprado,
        total_pagado,
        saldo_pendiente: Math.max(0, total_comprado - total_pagado),
        fechas_facturas,
        ultima_compra: fechas_facturas[0] || null,
        facturas,
      };
    });

    let maxNum = 0;
    for (const p of (provRows || [])) {
      const m = String(p.codigo || '').match(/(\d+)$/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }
    const siguienteCodigo = `PROV-${String(maxNum + 1).padStart(3, '0')}`;

    return NextResponse.json({
      success: true,
      proveedores: proveedoresEnriquecidos,
      siguienteCodigo,
    });
  } catch (err: any) {
    console.error('Error en GET /api/proveedores:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error consultando proveedores' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      codigo,
      nombre,
      nit_telefono,
      categoria_principal,
      observaciones,
    } = body;

    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre del proveedor es obligatorio.' },
        { status: 400 }
      );
    }

    const cleanName = String(nombre).trim();
    let finalCodigo = String(codigo || '').trim().toUpperCase();

    if (!finalCodigo && !id) {
      const { data: allProvs } = await supabase.from('proveedores').select('codigo');
      let maxNum = 0;
      for (const p of (allProvs || [])) {
        const m = String(p.codigo || '').match(/(\d+)$/);
        if (m) maxNum = Math.max(maxNum, Number(m[1]));
      }
      finalCodigo = `PROV-${String(maxNum + 1).padStart(3, '0')}`;
    }

    if (id) {
      const { data, error } = await supabase
        .from('proveedores')
        .update({
          ...(finalCodigo ? { codigo: finalCodigo } : {}),
          nombre: cleanName,
          nit_telefono: nit_telefono || null,
          categoria_principal: categoria_principal || 'Insumos Generales',
          observaciones: observaciones || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, proveedor: data });
    }

    const { data, error } = await supabase
      .from('proveedores')
      .insert({
        codigo: finalCodigo,
        nombre: cleanName,
        nit_telefono: nit_telefono || null,
        categoria_principal: categoria_principal || 'Insumos Generales',
        observaciones: observaciones || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, proveedor: data });
  } catch (err: any) {
    console.error('Error en POST /api/proveedores:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error guardando proveedor' },
      { status: 500 }
    );
  }
}
