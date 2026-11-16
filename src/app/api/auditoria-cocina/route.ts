import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

let cachedAuditResponse: { sheets: any[]; expiry: number } | null = null;

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

function matchProteinItem(itemName: string, prot: any): boolean {
  if (!itemName || !prot) return false;
  const n = String(itemName).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const p = String(prot.nombre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (n.includes('salmon') && p.includes('salmon')) return true;
  if (n.includes('baby') && p.includes('baby')) return true;
  if (n.includes('punta de anca') && p.includes('punta de anca')) return true;
  if ((n.includes('churrasco') || n.includes('caracho')) && (p.includes('churrasco') || p.includes('caracho'))) return true;
  if (n.includes('sobrebarriga') && p.includes('sobrebarriga')) return true;
  if (n.includes('lengua') && p.includes('lengua')) return true;
  if (n.includes('asada') && p.includes('asada')) return true;
  if (n.includes('molida') && p.includes('molida')) return true;
  if ((n.includes('callo') || n.includes('mondongo')) && (p.includes('callo') || p.includes('mondongo'))) return true;
  if (n.includes('filete')) {
    return p.includes('filete');
  }
  if (n.includes('pechuga')) {
    return p.includes('pechuga') && !p.includes('filete');
  }
  if (n.includes('ala')) return p.includes('ala');
  if (n.includes('pernil')) return p.includes('pernil');
  if (n.includes('viscera')) return p.includes('viscera');
  if (n.includes('gallina') || n.includes('sancocho')) return p.includes('gallina') || p.includes('sancocho');
  if (n.includes('pollo') && !n.includes('repollo')) {
    if (p.includes('ala') || p.includes('pernil') || p.includes('viscera') || p.includes('filete') || p.includes('pechuga')) return false;
    return p.includes('pollo') || p.includes('gallina');
  }
  if (n.includes('lomo de cerdo') && p.includes('lomo de cerdo')) return true;
  if (n.includes('san luis') && p.includes('san luis')) return true;
  if (n.includes('ahumada') && p.includes('ahumada')) return true;
  if ((n.includes('chicharron') || n.includes('tocino')) && (p.includes('chicharron') || p.includes('tocino'))) return true;
  if (n.includes('chorizo paisa') && p.includes('chorizo paisa')) return true;
  if (n.includes('chorizo de pollo') && p.includes('chorizo de pollo')) return true;
  if ((n.includes('choricerdo') || n.includes('chorizo grande')) && (p.includes('choricerdo') || p.includes('chorizo grande'))) return true;
  if ((n.includes('morcilla') || n.includes('rellena')) && (p.includes('morcilla') || p.includes('rellena'))) return true;
  if (n.includes('tilapia') && p.includes('tilapia')) return true;
  if (n.includes('trucha') && p.includes('trucha')) return true;
  if (n.includes('camaron') && p.includes('camaron')) return true;
  if (n.includes('marisco') && p.includes('marisco')) return true;
  if (n.includes('huevo') && p.includes('huevo')) return true;
  if (n.includes('tamal') && p.includes('tamal')) return true;
  
  return cleanStr(n).includes(cleanStr(p)) || cleanStr(p).includes(cleanStr(n));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('fecha');

    if (!dateParam && cachedAuditResponse && Date.now() < cachedAuditResponse.expiry) {
      return NextResponse.json({ sheets: cachedAuditResponse.sheets });
    }

    // 1-3. Ejecutar en paralelo días, proteínas y recetas
    let query = supabase
      .from('costeo_diario')
      .select('fecha, titulo, pos_sales')
      .order('fecha', { ascending: false });

    if (dateParam) {
      query = query.eq('fecha', dateParam);
    }

    const [
      { data: days, error: daysErr },
      { data: proteinCatalog },
      { data: recipes },
    ] = await Promise.all([
      query,
      supabase
        .from('catalogo_insumos')
        .select('id, codigo, nombre, categoria, es_carne, peso_estandar_porcion_kg, costo_unitario_kg, unidad_medida')
        .or('es_carne.eq.true,categoria.ilike.%carne%,categoria.ilike.%pescado%,categoria.ilike.%pollo%,categoria.ilike.%cerdo%,categoria.ilike.%huevo%,categoria.ilike.%embutido%'),
      supabase
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
        `),
    ]);

    if (daysErr) throw daysErr;

    if (!days || days.length === 0) {
      return NextResponse.json({ sheets: [] });
    }

    const dates = days.map((d: any) => d.fecha);

    // 4-5. Ejecutar ventas_detalle y registros_costeo_cocina en paralelo
    const [
      { data: ventasDetalle },
      { data: allRegistros, error: regErr },
    ] = await Promise.all([
      supabase
        .from('ventas_detalle')
        .select('id, fecha, codigo_producto, nombre_producto, cantidad')
        .in('fecha', dates)
        .limit(10000),
      supabase
        .from('registros_costeo_cocina')
        .select('fecha, tipo, tipo_movimiento, insumo_id, nombre_insumo, cantidad, unidad, observaciones')
        .in('fecha', dates)
        .in('tipo', ['APERTURA', 'TRASLADO', 'CIERRE'])
        .limit(20000),
    ]);

    if (regErr) {
      console.error('Error fetching registros_costeo_cocina for audit:', regErr);
    }

    // Pre-indexar O(1) por fecha y por insumo_id
    const ventasByDate = new Map<string, any[]>();
    for (const v of (ventasDetalle || [])) {
      const list = ventasByDate.get(v.fecha);
      if (list) list.push(v);
      else ventasByDate.set(v.fecha, [v]);
    }

    const regsByDate = new Map<string, any[]>();
    for (const r of (allRegistros || [])) {
      const list = regsByDate.get(r.fecha);
      if (list) list.push(r);
      else regsByDate.set(r.fecha, [r]);
    }

    const recipesByInsumoId = new Map<string, any[]>();
    for (const rec of (recipes || [])) {
      const list = recipesByInsumoId.get(rec.insumo_id);
      if (list) list.push(rec);
      else recipesByInsumoId.set(rec.insumo_id, [rec]);
    }

    // Process each day
    const sheets = days.map((dayInfo: any) => {
      const dateStr = dayInfo.fecha;
      const dayVentas = ventasByDate.get(dateStr) || [];
      const dayRegs = regsByDate.get(dateStr) || [];
      
      const dayAperturaDetalles = dayRegs.filter((r: any) => r.tipo === 'APERTURA');
      const dayMovs = dayRegs.filter((r: any) => r.tipo === 'TRASLADO');
      const dayCierreDetalles = dayRegs.filter((r: any) => r.tipo === 'CIERRE');

      // Create protein audit items
      const proteinMap = new Map<string, any>();

      (proteinCatalog || []).forEach((prot: any) => {
        const stdWeight = Number(prot.peso_estandar_porcion_kg || 0.4);
        const costKg = Number(prot.costo_unitario_kg || 0);

        // Find amanece
        let amanecePorc = 0;
        const apItem = dayAperturaDetalles.find((d: any) => 
          (d.insumo_id && d.insumo_id === prot.id) ||
          matchProteinItem(d.nombre_insumo, prot)
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
            matchProteinItem(m.nombre_insumo, prot)
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
          matchProteinItem(d.nombre_insumo, prot)
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
        const relatedRecipes = recipesByInsumoId.get(prot.id) || [];

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

      const month = dateStr.slice(0, 7);

      return {
        id: `audit-${dateStr}`,
        month,
        dateStr,
        title: dayInfo.titulo || `${dateStr}`,
        posSalesTotal: Number(dayInfo.pos_sales || 0),
        items
      };
    });

    if (!dateParam) {
      cachedAuditResponse = { sheets, expiry: Date.now() + 20000 };
    }

    return NextResponse.json({ sheets });
  } catch (error: any) {
    console.error('Error in GET /api/auditoria-cocina:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
