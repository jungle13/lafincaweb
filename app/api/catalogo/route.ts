import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 1. GET: Listar todos los insumos del catálogo
export async function GET() {
  try {
    const { data: dbCatalog, error } = await supabase
      .from('catalogo_insumos')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) throw error;

    // Obtener insumos adicionales de compras históricas (verduras, granos, desechables, vasos, bebidas, lácteos, etc.)
    const { data: transData } = await supabase
      .from('transacciones_gastos_insumos')
      .select('item, categoria, submodulo, costo_unitario');

    const EXCLUDED_CATEGORIES = new Set([
      'nomina',
      'nómina',
      'servicios',
      'servicios publicos',
      'servicios públicos',
      'mantenimiento',
      'gastos administrativos',
      'gastos',
      'transporte',
      'arrendamiento'
    ]);

    const EXCLUDED_SUBMODULOS = new Set([
      'NOMINA',
      'SERVICIOS_GENERALES',
      'SERVICIOS_PUBLICOS',
      'ARRENDAMIENTO'
    ]);

    const mergedMap = new Map();

    // 1. Insumos del catálogo maestro oficial
    (dbCatalog || []).forEach(item => {
      const key = (item.nombre || item.insumo || '').toLowerCase().trim();
      if (!key) return;
      
      let cat = (item.categoria || '').trim();
      const lowerName = key;
      if (lowerName.includes('huevo') || lowerName.includes('leche') || lowerName.includes('queso') || lowerName.includes('yogurt')) {
        cat = 'HUEVOS Y LACTEOS';
      }

      mergedMap.set(key, {
        ...item,
        categoria: cat
      });
    });

    // 2. Insumos de transacciones históricas (granos, verduras, desechables, vasos, bebidas, etc.)
    (transData || []).forEach(t => {
      if (!t.item) return;
      const rawName = t.item.trim();
      const key = rawName.toLowerCase();
      
      const sub = (t.submodulo || '').toUpperCase().trim();
      const rawCat = (t.categoria || '').toLowerCase().trim();

      // Excluir nóminas, servicios públicos y gastos no físicos
      if (EXCLUDED_SUBMODULOS.has(sub) || EXCLUDED_CATEGORIES.has(rawCat)) {
        return;
      }

      if (!mergedMap.has(key)) {
        let cat = 'GRANOS Y ABARROTES';
        const lowerName = rawName.toLowerCase();

        if (lowerName.includes('huevo') || lowerName.includes('leche') || lowerName.includes('queso') || lowerName.includes('crema de leche') || lowerName.includes('mantequilla')) {
          cat = 'HUEVOS Y LACTEOS';
        } else if (sub === 'DESECHABLES' || lowerName.includes('vaso') || lowerName.includes('tapa') || lowerName.includes('bolsa') || lowerName.includes('contenedor') || lowerName.includes('pitillo') || lowerName.includes('servilleta')) {
          cat = 'DESECHABLES';
        } else if (sub === 'BEBIDAS' || lowerName.includes('coca') || lowerName.includes('cerveza') || lowerName.includes('poker') || lowerName.includes('jugo') || lowerName.includes('agua') || lowerName.includes('bretaña') || lowerName.includes('postobon')) {
          cat = 'BEBIDAS';
        } else if (rawCat.includes('verdura') || lowerName.includes('papa') || lowerName.includes('tomate') || lowerName.includes('cebolla') || lowerName.includes('platano') || lowerName.includes('plátano') || lowerName.includes('limon') || lowerName.includes('limón') || lowerName.includes('aguacate') || lowerName.includes('zanahoria')) {
          cat = 'VERDURAS';
        } else if (sub === 'CARNES' || rawCat.includes('carne') || lowerName.includes('res') || lowerName.includes('cerdo') || lowerName.includes('pollo') || lowerName.includes('pescado') || lowerName.includes('costilla')) {
          if (lowerName.includes('cerdo') || lowerName.includes('tocino') || lowerName.includes('chicharron') || lowerName.includes('chicharrón') || lowerName.includes('bondiola')) {
            cat = 'CARNE DE CERDO';
          } else if (lowerName.includes('pollo') || lowerName.includes('pechuga') || lowerName.includes('alitas')) {
            cat = 'CARNE POLLO';
          } else if (lowerName.includes('pescado') || lowerName.includes('tilapia') || lowerName.includes('trucha') || lowerName.includes('salmon') || lowerName.includes('salmón') || lowerName.includes('marisco')) {
            cat = 'PESCADOS Y MARISCOS';
          } else {
            cat = 'CARNE DE RES';
          }
        }

        const isMeat = cat.includes('CARNE') || cat.includes('PESCADOS');
        const unitMed = cat === 'DESECHABLES' ? 'Paquete' : (cat === 'BEBIDAS' ? 'Und' : (cat === 'HUEVOS Y LACTEOS' ? 'Und' : 'Kg'));

        mergedMap.set(key, {
          id: `trans-${encodeURIComponent(key)}`,
          nombre: rawName,
          insumo: rawName,
          categoria: cat,
          unidad_medida: unitMed,
          tipo_medida: cat === 'DESECHABLES' ? 'PAQUETES' : 'KGS',
          es_carne: isMeat,
          peso_estandar_porcion_kg: isMeat ? 0.25 : 0,
          costo_unitario_kg: Number(t.costo_unitario) || 0
        });
      }
    });

    const fullCatalog = Array.from(mergedMap.values());

    return NextResponse.json({ success: true, data: fullCatalog }, {
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
