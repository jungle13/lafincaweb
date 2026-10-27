import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 1. GET: Listar todos los productos para la venta
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const subcategoria = searchParams.get('subcategoria');
    const search = searchParams.get('search');
    const esReceta = searchParams.get('es_receta');

    let query = supabase
      .from('productos_venta')
      .select('*')
      .order('categoria', { ascending: true })
      .order('subcategoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (categoria && categoria !== 'ALL') {
      query = query.eq('categoria', categoria);
    }

    if (subcategoria && subcategoria !== 'ALL') {
      query = query.eq('subcategoria', subcategoria);
    }

    if (esReceta === 'true') {
      query = query.eq('es_receta', true);
    } else if (esReceta === 'false') {
      query = query.eq('es_receta', false);
    }

    if (search && search.trim()) {
      query = query.or(`nombre.ilike.%${search.trim()}%,codigo.ilike.%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. POST: Crear nuevo producto para la venta
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      codigo,
      nombre,
      categoria = 'PLATOS',
      subcategoria = 'PLATOS A LA CARTA',
      unidad = 'ud',
      precio_total = 0,
      tarifa_impoconsumo = 8.0,
      tarifa_iva = 0.0,
      es_receta = true,
      activo = true
    } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre del producto es obligatorio' }, { status: 400 });
    }

    const cleanCodigo = codigo && codigo.trim() ? codigo.trim() : `PRD-${Date.now().toString().slice(-4)}`;
    const totalVal = parseFloat(precio_total) || 0;
    const factorImp = 1 + ((parseFloat(tarifa_impoconsumo) || 0) / 100);
    const netoVal = Math.round(totalVal / factorImp);
    const impVal = totalVal - netoVal;

    const newProduct = {
      codigo: cleanCodigo,
      nombre: nombre.trim(),
      categoria: categoria.trim(),
      subcategoria: subcategoria.trim(),
      unidad: unidad.trim(),
      precio_neto: netoVal,
      tarifa_impoconsumo: parseFloat(tarifa_impoconsumo) || 8.0,
      impoconsumo: impVal,
      tarifa_iva: parseFloat(tarifa_iva) || 0.0,
      iva: 0.0,
      precio_total: totalVal,
      es_receta: Boolean(es_receta),
      activo: Boolean(activo),
      updated_at: new Date().toISOString()
    };

    const { data: created, error } = await supabase
      .from('productos_venta')
      .insert([newProduct])
      .select()
      .single();

    if (error) throw error;

    // Sincronizar con tabla platos para módulo de Recetas
    await supabase.from('platos').upsert({
      codigo: cleanCodigo,
      nombre: nombre.trim(),
      precio_venta: totalVal,
      categoria: categoria.trim(),
      subcategoria: subcategoria.trim(),
      precio_neto: netoVal,
      impoconsumo: impVal,
      iva: 0.0,
      precio_total: totalVal,
      es_receta: Boolean(es_receta),
      unidad: unidad.trim(),
      activo: Boolean(activo)
    }, { onConflict: 'codigo' });

    return NextResponse.json({ success: true, data: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 3. PUT: Actualizar producto para la venta
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      codigo,
      nombre,
      categoria,
      subcategoria,
      unidad,
      precio_total,
      tarifa_impoconsumo,
      es_receta,
      activo
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'El ID del producto es obligatorio' }, { status: 400 });
    }

    const totalVal = parseFloat(precio_total) || 0;
    const factorImp = 1 + ((parseFloat(tarifa_impoconsumo) || 8.0) / 100);
    const netoVal = Math.round(totalVal / factorImp);
    const impVal = totalVal - netoVal;

    const updates: any = {
      updated_at: new Date().toISOString()
    };
    if (codigo !== undefined) updates.codigo = codigo.trim();
    if (nombre !== undefined) updates.nombre = nombre.trim();
    if (categoria !== undefined) updates.categoria = categoria.trim();
    if (subcategoria !== undefined) updates.subcategoria = subcategoria.trim();
    if (unidad !== undefined) updates.unidad = unidad.trim();
    if (precio_total !== undefined) {
      updates.precio_total = totalVal;
      updates.precio_neto = netoVal;
      updates.impoconsumo = impVal;
    }
    if (tarifa_impoconsumo !== undefined) updates.tarifa_impoconsumo = parseFloat(tarifa_impoconsumo);
    if (es_receta !== undefined) updates.es_receta = Boolean(es_receta);
    if (activo !== undefined) updates.activo = Boolean(activo);

    const { data: updated, error } = await supabase
      .from('productos_venta')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Sincronizar con tabla platos
    if (updated?.codigo) {
      await supabase.from('platos').upsert({
        codigo: updated.codigo,
        nombre: updated.nombre,
        precio_venta: updated.precio_total,
        categoria: updated.categoria,
        subcategoria: updated.subcategoria,
        precio_neto: updated.precio_neto,
        impoconsumo: updated.impoconsumo,
        iva: updated.iva,
        precio_total: updated.precio_total,
        es_receta: updated.es_receta,
        unidad: updated.unidad,
        activo: updated.activo
      }, { onConflict: 'codigo' });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 4. DELETE: Eliminar producto para la venta
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const { error } = await supabase.from('productos_venta').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
