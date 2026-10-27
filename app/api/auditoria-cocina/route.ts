import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function cleanStr(s: any): string {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('fecha');

    // 1. Fetch days from costeo_diario
    let query = supabase
      .from('costeo_diario')
      .select('fecha, titulo, pos_sales')
      .order('fecha', { ascending: false });

    if (dateParam) {
      query = query.eq('fecha', dateParam);
    }

    const { data: days, error: daysErr } = await query;
    if (daysErr) throw daysErr;

    if (!days || days.length === 0) {
      return NextResponse.json({ sheets: [] });
    }

    // 2. Fetch protein catalog items
    const { data: proteinCatalog } = await supabase
      .from('catalogo_insumos')
      .select('id, codigo, nombre, categoria, es_carne, peso_estandar_porcion_kg, costo_unitario_kg, unidad_medida')
      .or('es_carne.eq.true,categoria.ilike.%carne%,categoria.ilike.%pescado%,categoria.ilike.%pollo%,categoria.ilike.%cerdo%,categoria.ilike.%huevo%');

    // 3. Fetch recipe details (recetas_detalle joined with productos_venta and catalogo_insumos)
    const { data: recipes } = await supabase
      .from('recetas_detalle')
      .select(`
        id,
        plato_id,
        insumo_id,
        porciones_por_plato,
        cantidad_por_porcion_kg,
        productos_venta (
          id,
          codigo,
          nombre,
          categoria
        ),
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

    const dates = days.map((d: any) => d.fecha);

    // 4. Fetch ventas_detalle for these dates
    const { data: ventasDetalle } = await supabase
      .from('ventas_detalle')
      .select('*')
      .in('fecha', dates)
      .limit(10000);

    // 5. Fetch movimientos_inventario for these dates
    const { data: movimientos } = await supabase
      .from('movimientos_inventario')
      .select('*')
      .in('fecha', dates)
      .limit(10000);

    // 6. Fetch conteos_fisicos and details for these dates
    const { data: conteos } = await supabase
      .from('conteos_fisicos')
      .select('id, fecha, tipo')
      .in('fecha', dates)
      .limit(500);

    const conteoIds = (conteos || []).map((c: any) => c.id);
    let conteoDetalles: any[] = [];
    if (conteoIds.length > 0) {
      const { data: cd } = await supabase
        .from('conteos_fisicos_detalle')
        .select('*')
        .in('conteo_id', conteoIds)
        .limit(10000);
      conteoDetalles = cd || [];
    }

    // Process each day
    const sheets = days.map((dayInfo: any) => {
      const dateStr = dayInfo.fecha;
      const dayVentas = (ventasDetalle || []).filter((v: any) => v.fecha === dateStr);
      const dayMovs = (movimientos || []).filter((m: any) => m.fecha === dateStr);
      
      const dayAperturaConteo = (conteos || []).find((c: any) => c.fecha === dateStr && c.tipo === 'COCINA_APERTURA');
      const dayCierreConteo = (conteos || []).find((c: any) => c.fecha === dateStr && c.tipo === 'COCINA_CIERRE');

      const dayAperturaDetalles = dayAperturaConteo ? conteoDetalles.filter((d: any) => d.conteo_id === dayAperturaConteo.id) : [];
      const dayCierreDetalles = dayCierreConteo ? conteoDetalles.filter((d: any) => d.conteo_id === dayCierreConteo.id) : [];

      // Create protein audit items
      const proteinMap = new Map<string, any>();

      (proteinCatalog || []).forEach((prot: any) => {
        const stdWeight = Number(prot.peso_estandar_porcion_kg || 0.4);
        const costKg = Number(prot.costo_unitario_kg || 0);

        // Find amanece
        let amanecePorc = 0;
        const apItem = dayAperturaDetalles.find((d: any) => 
          (d.insumo_id && d.insumo_id === prot.id) ||
          cleanStr(d.nombre_insumo).includes(cleanStr(prot.nombre)) ||
          cleanStr(prot.nombre).includes(cleanStr(d.nombre_insumo))
        );
        if (apItem) {
          const qty = Number(apItem.cantidad || 0);
          if (prot.unidad_medida === 'Und' || apItem.unidad === 'Und' || prot.codigo === 'CAR-043') {
            amanecePorc = Math.round(qty);
          } else {
            amanecePorc = stdWeight > 0 ? Math.round(qty / stdWeight) : Math.round(qty);
          }
        }

        // Find bajadas
        let bajadasPorc = 0;
        const movItems = dayMovs.filter((m: any) => 
          m.tipo_movimiento === 'BODEGA_A_COCINA' && (
            (m.insumo_id && m.insumo_id === prot.id) ||
            cleanStr(m.nombre_insumo).includes(cleanStr(prot.nombre)) ||
            cleanStr(prot.nombre).includes(cleanStr(m.nombre_insumo))
          )
        );
        movItems.forEach((m: any) => {
          const qty = Number(m.cantidad || 0);
          if (prot.unidad_medida === 'Und' || m.unidad === 'Und' || prot.codigo === 'CAR-043') {
            bajadasPorc += Math.round(qty);
          } else {
            bajadasPorc += stdWeight > 0 ? Math.round(qty / stdWeight) : Math.round(qty);
          }
        });

        // Si los movimientos del Formato Resumen ya incluían el inventario amanece, deducir para no duplicar
        if (amanecePorc > 0 && bajadasPorc >= amanecePorc) {
          const hasAmaneceNote = movItems.some((m: any) => 
            (m.observaciones && m.observaciones.toLowerCase().includes('cocina')) ||
            (m.nombre_insumo && m.nombre_insumo.toLowerCase().includes('cocina'))
          );
          if (hasAmaneceNote) {
            bajadasPorc = Math.max(0, bajadasPorc - amanecePorc);
          }
        }

        // Find cierre real
        let cierreRealPorc = 0;
        const ciItem = dayCierreDetalles.find((d: any) => 
          (d.insumo_id && d.insumo_id === prot.id) ||
          cleanStr(d.nombre_insumo).includes(cleanStr(prot.nombre)) ||
          cleanStr(prot.nombre).includes(cleanStr(d.nombre_insumo))
        );
        if (ciItem) {
          const qty = Number(ciItem.cantidad || 0);
          if (prot.unidad_medida === 'Und' || ciItem.unidad === 'Und' || prot.codigo === 'CAR-043') {
            cierreRealPorc = Math.round(qty);
          } else {
            cierreRealPorc = stdWeight > 0 ? Math.round(qty / stdWeight) : Math.round(qty);
          }
        }

        // Deductions from POS sales according to recipes
        const platosDeducidos: any[] = [];
        const relatedRecipes = (recipes || []).filter((r: any) => r.insumo_id === prot.id);

        relatedRecipes.forEach((rec: any) => {
          const prodVenta = rec.productos_venta as any;
          if (!prodVenta) return;

          // Find sales of this product on this day
          const salesMatch = dayVentas.filter((v: any) => 
            v.codigo_producto === prodVenta.codigo ||
            cleanStr(v.nombre_producto) === cleanStr(prodVenta.nombre)
          );

          salesMatch.forEach((v: any) => {
            const cantVendida = Number(v.cantidad || 0);
            if (cantVendida > 0) {
              const porcPerDish = Number(rec.porciones_por_plato || 1);
              const porcDeducidas = cantVendida * porcPerDish;
              const kgPerDish = Number(rec.cantidad_por_porcion_kg || stdWeight);
              const kgDeducidos = cantVendida * kgPerDish;

              platosDeducidos.push({
                id: `v-${v.id}`,
                codigoPos: prodVenta.codigo || v.codigo_producto || '',
                nombrePlato: prodVenta.nombre || v.nombre_producto || '',
                cantidad: cantVendida,
                porcionesDeducidas: porcDeducidas,
                kgDeducidos: Number(kgDeducidos.toFixed(2))
              });
            }
          });
        });

        const totalDisponible = amanecePorc + bajadasPorc;

        // Only include if there was activity (amanece, bajada, or sales)
        if (totalDisponible > 0 || platosDeducidos.length > 0 || cierreRealPorc > 0) {
          proteinMap.set(prot.id, {
            id: `p-${prot.id}`,
            insumo: `${prot.nombre.toUpperCase()} (${Math.round(stdWeight * 1000)}g)`,
            categoria: prot.categoria,
            pesoPorcionGramos: Math.round(stdWeight * 1000),
            unidadMedida: prot.unidad_medida === 'Und' ? 'und' : 'porc',
            costoUnitarioKg: costKg,
            totalDisponiblePorciones: totalDisponible,
            amanecePorciones: amanecePorc,
            bajadasPorciones: bajadasPorc,
            cierreRealPorciones: cierreRealPorc,
            platos: platosDeducidos
          });
        }
      });

      const items = Array.from(proteinMap.values());
      // Sort so highest activity items appear first
      items.sort((a, b) => b.totalDisponiblePorciones - a.totalDisponiblePorciones);

      const month = dateStr.startsWith('2026-10') ? '2026-10' : '2026-09';

      return {
        id: `audit-${dateStr}`,
        month,
        dateStr,
        title: dayInfo.titulo || `${dateStr}`,
        posSalesTotal: Number(dayInfo.pos_sales || 0),
        items
      };
    });

    return NextResponse.json({ sheets });
  } catch (error: any) {
    console.error('Error in GET /api/auditoria-cocina:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
