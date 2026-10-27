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
      const costoUnitario = Number(insumo?.costo_unitario_kg || 0);
      const porciones = Number(d.porciones_por_plato || 1);
      const cantidadPorPorcionKg = Number(d.cantidad_por_porcion_kg || 0);
      
      const isUnidad = insumo?.unidad_medida?.toLowerCase() === 'und' || 
                       insumo?.unidad_medida?.toLowerCase() === 'unidad';

      let cantidad = 0;
      let costoCalculado = 0;

      if (isUnidad) {
        cantidad = porciones;
        costoCalculado = Math.round(cantidad * costoUnitario);
      } else {
        // En Kg
        cantidad = Number((porciones * cantidadPorPorcionKg).toFixed(3));
        costoCalculado = Math.round(cantidad * costoUnitario);
      }

      detallesByPlato[d.plato_id].push({
        id: d.id,
        insumo_id: d.insumo_id,
        codigo_insumo: insumo?.codigo || '',
        nombre: insumo?.nombre || 'Insumo no encontrado',
        categoria: insumo?.categoria || 'Insumos',
        unidad: insumo?.unidad_medida || 'Kg',
        cantidad: cantidad,
        costoUnitario: costoUnitario,
        costoCalculado: costoCalculado,
        porciones_por_plato: porciones,
        cantidad_por_porcion_kg: cantidadPorPorcionKg
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
    const { plato_id, insumo_id, porciones_por_plato, cantidad_por_porcion_kg, cantidad } = body;

    if (!plato_id || !insumo_id) {
      return NextResponse.json({ success: false, error: 'plato_id e insumo_id son requeridos' }, { status: 400 });
    }

    // Consultar tipo de unidad del insumo
    const { data: insumo } = await supabase
      .from('catalogo_insumos')
      .select('unidad_medida, peso_estandar_porcion_kg')
      .eq('id', insumo_id)
      .single();

    const isUnidad = insumo?.unidad_medida?.toLowerCase() === 'und' ||
                     insumo?.unidad_medida?.toLowerCase() === 'unidad';

    let porc = porciones_por_plato || 1;
    let kgPorPorc = cantidad_por_porcion_kg || Number(insumo?.peso_estandar_porcion_kg || 0.1);

    if (cantidad !== undefined) {
      if (isUnidad) {
        porc = Number(cantidad);
        kgPorPorc = Number(insumo?.peso_estandar_porcion_kg || 0.055);
      } else {
        porc = 1;
        kgPorPorc = Number(cantidad);
      }
    }

    const { data, error } = await supabase
      .from('recetas_detalle')
      .insert({
        plato_id,
        insumo_id,
        porciones_por_plato: porc,
        cantidad_por_porcion_kg: kgPorPorc
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
    const { id, cantidad, porciones_por_plato, cantidad_por_porcion_kg } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id de receta_detalle es requerido' }, { status: 400 });
    }

    // Consultar si es unidad o Kg
    const { data: currentDet } = await supabase
      .from('recetas_detalle')
      .select('id, insumo_id, catalogo_insumos(unidad_medida)')
      .eq('id', id)
      .single();

    const isUnidad = (currentDet as any)?.catalogo_insumos?.unidad_medida?.toLowerCase() === 'und' ||
                     (currentDet as any)?.catalogo_insumos?.unidad_medida?.toLowerCase() === 'unidad';

    const updates: any = {};
    if (cantidad !== undefined) {
      if (isUnidad) {
        updates.porciones_por_plato = Number(cantidad);
      } else {
        updates.cantidad_por_porcion_kg = Number(cantidad);
        updates.porciones_por_plato = 1;
      }
    } else {
      if (porciones_por_plato !== undefined) updates.porciones_por_plato = porciones_por_plato;
      if (cantidad_por_porcion_kg !== undefined) updates.cantidad_por_porcion_kg = cantidad_por_porcion_kg;
    }

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
