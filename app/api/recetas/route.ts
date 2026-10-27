import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 1. GET: Obtener todas las recetas oficiales con sus insumos y el catálogo de insumos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const subcategoria = searchParams.get('subcategoria');

    // 1. Platos que tienen receta
    let platosQuery = supabase
      .from('platos')
      .select('id, codigo, nombre, categoria, subcategoria, precio_neto, impoconsumo, precio_total, es_receta, activo')
      .eq('es_receta', true)
      .order('subcategoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (subcategoria && subcategoria !== 'ALL') {
      platosQuery = platosQuery.eq('subcategoria', subcategoria);
    }

    if (search && search.trim()) {
      platosQuery = platosQuery.or(`nombre.ilike.%${search.trim()}%,codigo.ilike.%${search.trim()}%`);
    }

    const { data: platos, error: platosErr } = await platosQuery;
    if (platosErr) throw platosErr;

    // 2. Insumos asociados en recetas_detalle
    const { data: detalles, error: detErr } = await supabase
      .from('recetas_detalle')
      .select(`
        id,
        plato_id,
        insumo_id,
        porciones_por_plato,
        cantidad_por_porcion_kg,
        created_at,
        catalogo_insumos (
          id,
          codigo,
          nombre,
          categoria,
          unidad_medida,
          costo_unitario_kg,
          peso_estandar_porcion_kg
        )
      `);

    if (detErr) throw detErr;

    // 3. Catálogo completo de insumos para el buscador del frontend
    const { data: insumosCatalog, error: insErr } = await supabase
      .from('catalogo_insumos')
      .select('id, codigo, nombre, categoria, unidad_medida, costo_unitario_kg, peso_estandar_porcion_kg')
      .order('nombre', { ascending: true });

    if (insErr) throw insErr;

    // 4. Agrupar detalles por plato_id
    const detallesByPlato: Record<string, any[]> = {};
    (detalles || []).forEach((d: any) => {
      if (!detallesByPlato[d.plato_id]) detallesByPlato[d.plato_id] = [];
      const insumo = d.catalogo_insumos;
      const costoKg = Number(insumo?.costo_unitario_kg || 0);
      const porciones = Number(d.porciones_por_plato || 1);
      const cantidadPorPorcionKg = Number(d.cantidad_por_porcion_kg || 0);
      const cantTotalKg = porciones * cantidadPorPorcionKg;
      const costoCalculado = Math.round(cantTotalKg * costoKg);

      detallesByPlato[d.plato_id].push({
        id: d.id,
        insumo_id: d.insumo_id,
        codigo_insumo: insumo?.codigo || '',
        nombre: insumo?.nombre || 'Insumo no encontrado',
        categoria: insumo?.categoria || 'Insumos',
        unidad: insumo?.unidad_medida || 'Kg',
        porciones_por_plato: porciones,
        cantidad_por_porcion_kg: cantidadPorPorcionKg,
        cantidad_total_kg: Number(cantTotalKg.toFixed(3)),
        costo_unitario_kg: costoKg,
        costoCalculado: costoCalculado
      });
    });

    const recetas = (platos || []).map((p: any) => ({
      id: p.id,
      codigoPos: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      subcategoria: p.subcategoria,
      precioNeto: Number(p.precio_neto || 0),
      precioVentaPos: Number(p.precio_total || p.precio_neto || 0),
      ingredientes: detallesByPlato[p.id] || []
    }));

    return NextResponse.json({
      success: true,
      recetas,
      catalogoInsumos: insumosCatalog || []
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 2. POST: Vincular un insumo a un plato en recetas_detalle
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { plato_id, insumo_id, porciones_por_plato, cantidad_por_porcion_kg } = body;

    if (!plato_id || !insumo_id) {
      return NextResponse.json({ success: false, error: 'plato_id e insumo_id son requeridos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('recetas_detalle')
      .insert({
        plato_id,
        insumo_id,
        porciones_por_plato: porciones_por_plato || 1,
        cantidad_por_porcion_kg: cantidad_por_porcion_kg || 0.1
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 3. PUT: Actualizar cantidad o porciones de un insumo en recetas_detalle
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, porciones_por_plato, cantidad_por_porcion_kg } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id de receta_detalle es requerido' }, { status: 400 });
    }

    const updates: any = {};
    if (porciones_por_plato !== undefined) updates.porciones_por_plato = porciones_por_plato;
    if (cantidad_por_porcion_kg !== undefined) updates.cantidad_por_porcion_kg = cantidad_por_porcion_kg;

    const { data, error } = await supabase
      .from('recetas_detalle')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 4. DELETE: Eliminar un ingrediente de una receta o desvincular receta del plato
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const plato_id = searchParams.get('plato_id');

    if (id) {
      const { error } = await supabase.from('recetas_detalle').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    } else if (plato_id) {
      await supabase.from('recetas_detalle').delete().eq('plato_id', plato_id);
      await supabase.from('platos').update({ es_receta: false }).eq('id', plato_id);
      await supabase.from('productos_venta').update({ es_receta: false }).eq('id', plato_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'id o plato_id es requerido' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
