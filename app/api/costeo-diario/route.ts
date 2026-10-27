import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('fecha');

    // Fetch all costeo_diario days
    let query = supabase
      .from('costeo_diario')
      .select('*')
      .order('fecha', { ascending: false });

    if (dateParam) {
      query = query.eq('fecha', dateParam);
    }

    const { data: sheetsHeader, error: headerErr } = await query;
    if (headerErr) {
      return NextResponse.json({ error: headerErr.message }, { status: 500 });
    }

    if (!sheetsHeader || sheetsHeader.length === 0) {
      return NextResponse.json({ sheets: [] });
    }

    const dates = sheetsHeader.map((h: any) => h.fecha);

    // Fetch movimientos_inventario for these dates
    const { data: movimientos, error: movErr } = await supabase
      .from('movimientos_inventario')
      .select('*')
      .in('fecha', dates)
      .order('fecha_hora', { ascending: true })
      .limit(5000);

    if (movErr) {
      console.error('Error fetching movimientos:', movErr);
    }

    // Fetch conteos_fisicos for these dates
    const { data: conteos, error: contErr } = await supabase
      .from('conteos_fisicos')
      .select('id, fecha, tipo, total_valor')
      .in('fecha', dates);

    if (contErr) {
      console.error('Error fetching conteos:', contErr);
    }

    const conteoIds = (conteos || []).map((c: any) => c.id);
    let conteoDetalles: any[] = [];
    if (conteoIds.length > 0) {
      const { data: detalles } = await supabase
        .from('conteos_fisicos_detalle')
        .select('*')
        .in('conteo_id', conteoIds);
      conteoDetalles = detalles || [];
    }

    // Map conteo details by (fecha + tipo)
    const conteosByFechaTipo: Record<string, any[]> = {};
    (conteos || []).forEach((c: any) => {
      const key = `${c.fecha}_${c.tipo}`;
      conteosByFechaTipo[key] = conteoDetalles.filter((d: any) => d.conteo_id === c.id);
    });

    // Build full sheets
    const sheets = sheetsHeader.map((header: any) => {
      const dateStr = header.fecha;
      const dayMovs = (movimientos || []).filter((m: any) => m.fecha === dateStr);
      const amaneceItems = conteosByFechaTipo[`${dateStr}_COCINA_APERTURA`] || [];

      // Group into categories
      const categoryMap = new Map<string, any[]>();

      // 1. Process Movimientos into categorized items
      dayMovs.forEach((mov: any) => {
        let cat = mov.categoria || 'Insumos Varios';
        const catLower = cat.toLowerCase();
        if (catLower.includes('verdura') || catLower.includes('fruver') || catLower.includes('hortaliza')) {
          cat = 'Verduras e Insumos';
        } else if (catLower.includes('carne') || catLower.includes('proteína') || catLower.includes('pollo') || catLower.includes('pescado') || catLower.includes('cerdo') || catLower.includes('embutido')) {
          cat = 'Carnes y Proteínas (Saldo Cocina + Traslados)';
        } else if (catLower.includes('desechable') || catLower.includes('empaque')) {
          cat = 'Desechables y Empaques';
        } else if (catLower.includes('lacteo') || catLower.includes('lácteo') || catLower.includes('huevo')) {
          cat = 'Lácteos y Huevos';
        } else if (catLower.includes('grano') || catLower.includes('abarrote')) {
          cat = 'Granos y Abarrotes';
        }

        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, []);
        }

        const itemsInCat = categoryMap.get(cat)!;
        let existingItem = itemsInCat.find(it => it.name.toLowerCase() === (mov.nombre_insumo || '').toLowerCase());

        const reg = {
          id: mov.id,
          hora: mov.fecha_hora ? new Date(mov.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '08:00 AM',
          usuario: mov.usuario || 'Administradora',
          tipo: mov.tipo_movimiento || 'BODEGA_A_COCINA',
          origen: mov.origen || 'Bodega General',
          destino: mov.destino || 'Cocina Principal',
          cantidad: Number(mov.cantidad || 0),
          unidad: mov.unidad || 'Kg',
          costoUnitario: Number(mov.costo_unitario || 0),
          total: Number(mov.valor_total_movimiento || 0),
          observaciones: mov.observaciones || ''
        };

        if (existingItem) {
          existingItem.qty += Number(mov.cantidad || 0);
          existingItem.total += Number(mov.valor_total_movimiento || 0);
          if (existingItem.registros) existingItem.registros.push(reg);
        } else {
          itemsInCat.push({
            id: `item-${mov.id}`,
            name: mov.nombre_insumo || 'Insumo sin nombre',
            qty: Number(mov.cantidad || 0),
            unit: mov.unidad || 'Kg',
            unitPrice: Number(mov.costo_unitario || 0),
            total: Number(mov.valor_total_movimiento || 0),
            registros: [reg]
          });
        }
      });

      // 2. Also incorporate Amanece into item registros if matching
      amaneceItems.forEach((am: any) => {
        const cat = 'Carnes y Proteínas (Saldo Cocina + Traslados)';
        if (!categoryMap.has(cat)) categoryMap.set(cat, []);
        const itemsInCat = categoryMap.get(cat)!;
        const existing = itemsInCat.find(it => it.name.toLowerCase().includes(am.nombre_insumo.toLowerCase()) || am.nombre_insumo.toLowerCase().includes(it.name.toLowerCase()));
        
        const amReg = {
          id: `am-${am.id}`,
          hora: '07:00 AM',
          usuario: 'Administradora / Cocina',
          tipo: 'INVENTARIO_INICIAL_COCINA' as const,
          origen: 'Inventario Cocina (Amanece)',
          destino: 'Cocina Principal',
          cantidad: Number(am.cantidad || 0),
          unidad: am.unidad || 'Kg',
          costoUnitario: Number(am.costo_unitario || 0),
          total: Number(am.valor_total || 0),
          observaciones: am.observaciones || 'Saldo físico de apertura'
        };

        if (existing) {
          if (!existing.registros) existing.registros = [];
          existing.registros.unshift(amReg);
        }
      });

      // Format category groups
      const categories = Array.from(categoryMap.entries()).map(([name, items]) => ({
        id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name,
        items
      }));

      // Sort categories so Verduras and Carnes come first
      categories.sort((a, b) => {
        if (a.name.includes('Verduras')) return -1;
        if (b.name.includes('Verduras')) return 1;
        if (a.name.includes('Carnes')) return -1;
        if (b.name.includes('Carnes')) return 1;
        return a.name.localeCompare(b.name);
      });

      const month = dateStr.startsWith('2026-10') ? '2026-10' : '2026-09';

      return {
        id: `sheet-${dateStr}`,
        month,
        dateStr,
        title: header.titulo || `${dateStr} - Hoja Costeo Cocina`,
        posSales: Number(header.pos_sales || 0),
        devoluciones: Number(header.devoluciones || 0),
        categories
      };
    });

    return NextResponse.json({ sheets });
  } catch (error: any) {
    console.error('Error in GET /api/costeo-diario:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fecha, titulo, pos_sales, movimiento } = body;

    if (!fecha) {
      return NextResponse.json({ error: 'La fecha es requerida' }, { status: 400 });
    }

    // 1. If recording a single movement
    if (movimiento) {
      const { data: newMov, error: movErr } = await supabase
        .from('movimientos_inventario')
        .insert({
          fecha,
          tipo_movimiento: movimiento.tipo || 'BODEGA_A_COCINA',
          insumo_id: movimiento.insumo_id || null,
          nombre_insumo: movimiento.nombre_insumo,
          categoria: movimiento.categoria || 'Insumos Varios',
          origen: movimiento.origen || 'Bodega General',
          destino: movimiento.destino || 'Cocina Principal',
          cantidad: movimiento.cantidad,
          unidad: movimiento.unidad || 'Kg',
          costo_unitario: movimiento.costo_unitario || 0,
          valor_total_movimiento: movimiento.total || (movimiento.cantidad * (movimiento.costo_unitario || 0)),
          usuario: movimiento.usuario || 'Administradora',
          observaciones: movimiento.observaciones || ''
        })
        .select()
        .single();

      if (movErr) throw movErr;

      // Recalculate day summary
      const { data: movs } = await supabase
        .from('movimientos_inventario')
        .select('valor_total_movimiento, tipo_movimiento')
        .eq('fecha', fecha);

      const totalBruto = (movs || [])
        .filter((m: any) => m.tipo_movimiento === 'BODEGA_A_COCINA')
        .reduce((sum: number, m: any) => sum + Number(m.valor_total_movimiento || 0), 0);

      const totalDev = (movs || [])
        .filter((m: any) => m.tipo_movimiento === 'DEVOLUCION_COCINA')
        .reduce((sum: number, m: any) => sum + Number(m.valor_total_movimiento || 0), 0);

      const totalNeto = totalBruto - totalDev;

      await supabase.from('costeo_diario').upsert({
        fecha,
        titulo: titulo || `${fecha} - Hoja Costeo Cocina`,
        pos_sales: pos_sales || 0,
        costo_bruto: totalBruto,
        devoluciones: totalDev,
        costo_neto: totalNeto,
        food_cost_porcentaje: pos_sales > 0 ? (totalNeto / pos_sales) * 100 : 0
      }, { onConflict: 'fecha' });

      return NextResponse.json({ success: true, movimiento: newMov });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST /api/costeo-diario:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
