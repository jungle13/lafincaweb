import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Cache en memoria para acelerar respuestas de catálogo a <2ms
let cachedCatalog: any[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos

function invalidateCatalogCache() {
  cachedCatalog = null;
  cacheExpiry = 0;
}

// 1. GET: Listar todos los insumos del catálogo maestro oficial optimizado
export async function GET() {
  try {
    const now = Date.now();
    if (cachedCatalog && now < cacheExpiry) {
      return NextResponse.json({ success: true, data: cachedCatalog, cached: true }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        }
      });
    }

    const { data: dbCatalog, error } = await supabase
      .from('catalogo_insumos')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) throw error;

    cachedCatalog = dbCatalog || [];
    cacheExpiry = now + CACHE_TTL_MS;

    return NextResponse.json({ success: true, data: cachedCatalog }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
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
      tipo_medida = 'KGS_Y_UNIDADES',
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
        tipo_medida: tipo_medida.trim(),
        es_carne: Boolean(es_carne),
        peso_estandar_porcion_kg: parseFloat(peso_estandar_porcion_kg) || 0.35,
        costo_unitario_kg: parseFloat(costo_unitario_kg) || 0,
        stock_minimo_kg: parseFloat(stock_minimo_kg) || 10,
        activo: true,
      }])
      .select()
      .single();

    if (insErr) throw insErr;

    // Invalidar caché en memoria para que la siguiente consulta obtenga el nuevo insumo
    invalidateCatalogCache();

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
    if (body.tipo_medida !== undefined) updatePayload.tipo_medida = body.tipo_medida.trim();
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

    // Invalidar caché en memoria
    invalidateCatalogCache();

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

    // Eliminar de catalogo_insumos
    const { error } = await supabase
      .from('catalogo_insumos')
      .delete()
      .eq('id', id);

    if (error) {
      // Si tiene registros históricos asociados que impiden el delete directo, lo marcamos inactivo
      await supabase.from('catalogo_insumos').update({ activo: false }).eq('id', id);
      invalidateCatalogCache();
      return NextResponse.json({ success: true, message: 'Insumo archivado/inactivado (tenía registros asociados)' });
    }

    // Invalidar caché en memoria
    invalidateCatalogCache();

    return NextResponse.json({ success: true, message: 'Insumo eliminado con éxito' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
