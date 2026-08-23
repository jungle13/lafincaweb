import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 1. GET: Listar todos los insumos del catálogo
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('catalogo_insumos')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. POST: Crear un nuevo insumo / carne
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nombre,
      categoria = 'CARNE DE RES',
      unidad_medida = 'Kg',
      es_carne = true,
      peso_estandar_porcion_kg = 0.35,
      costo_unitario_kg = 0,
      stock_minimo_kg = 10,
      codigo
    } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre del insumo es obligatorio' }, { status: 400 });
    }

    const cleanCodigo = codigo && codigo.trim() ? codigo.trim() : `INS-${Date.now().toString().slice(-6)}`;

    // Inserción en catalogo_insumos
    const { data: created, error: insErr } = await supabase
      .from('catalogo_insumos')
      .insert([{
        codigo: cleanCodigo,
        nombre: nombre.trim(),
        categoria: categoria.trim(),
        unidad_medida: unidad_medida.trim(),
        es_carne: Boolean(es_carne),
        peso_estandar_porcion_kg: parseFloat(peso_estandar_porcion_kg) || 0.35,
        costo_unitario_kg: parseFloat(costo_unitario_kg) || 0,
        stock_minimo_kg: parseFloat(stock_minimo_kg) || 10,
        activo: true,
      }])
      .select()
      .single();

    if (insErr) throw insErr;

    // Asegurar registro inicial en stock_actual
    if (created) {
      await supabase.from('stock_actual').upsert({
        insumo_id: created.id,
        bodega_sin_porcionar_kg: 0,
        bodega_porcionado_und: 0,
        bodega_porcionado_kg: 0,
        cocina_sin_porcionar_kg: 0,
        cocina_porcionado_und: 0,
        cocina_porcionado_kg: 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'insumo_id' });
    }

    return NextResponse.json({ success: true, data: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 3. PUT: Actualizar un insumo existente
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      nombre,
      categoria,
      unidad_medida,
      es_carne,
      peso_estandar_porcion_kg,
      costo_unitario_kg,
      stock_minimo_kg,
      codigo
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del insumo' }, { status: 400 });
    }

    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (nombre !== undefined) updatePayload.nombre = nombre.trim();
    if (categoria !== undefined) updatePayload.categoria = categoria.trim();
    if (unidad_medida !== undefined) updatePayload.unidad_medida = unidad_medida.trim();
    if (es_carne !== undefined) updatePayload.es_carne = Boolean(es_carne);
    if (peso_estandar_porcion_kg !== undefined) updatePayload.peso_estandar_porcion_kg = parseFloat(peso_estandar_porcion_kg) || 0.35;
    if (costo_unitario_kg !== undefined) updatePayload.costo_unitario_kg = parseFloat(costo_unitario_kg) || 0;
    if (stock_minimo_kg !== undefined) updatePayload.stock_minimo_kg = parseFloat(stock_minimo_kg) || 10;
    if (codigo !== undefined) updatePayload.codigo = codigo.trim();

    const { data: updated, error: updErr } = await supabase
      .from('catalogo_insumos')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw updErr;

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 4. DELETE: Eliminar un insumo
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del insumo a eliminar' }, { status: 400 });
    }

    // 1. Eliminar de stock_actual primero para no violar Foreign Key
    await supabase.from('stock_actual').delete().eq('insumo_id', id);

    // 2. Eliminar de catalogo_insumos
    const { error } = await supabase
      .from('catalogo_insumos')
      .delete()
      .eq('id', id);

    if (error) {
      // Si tiene movimientos históricos que bloquean el delete directo, lo marcamos como inactivo
      await supabase.from('catalogo_insumos').update({ activo: false }).eq('id', id);
      return NextResponse.json({ success: true, message: 'Insumo archivado/inactivado (tenía movimientos asociados)' });
    }

    return NextResponse.json({ success: true, message: 'Insumo eliminado con éxito' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
