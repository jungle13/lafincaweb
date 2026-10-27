import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function cleanInsumoDisplayName(raw: string): { cleanName: string; extractedObs: string } {
  if (!raw) return { cleanName: 'Insumo', extractedObs: '' };
  let original = raw.trim();
  let extractedObs = '';

  const parenMatch = original.match(/\((?:Mov|Cocina|Reporte|Soporte|Factura|Cierre|YP|FE|FVE|REM)[\s\S]*?\)/i);
  if (parenMatch) {
    extractedObs = parenMatch[0].replace(/^\(|\)$/g, '').trim();
  }

  let clean = original
    .replace(/\s*\((?:Mov|Cocina|Reporte|Soporte|Factura|Cierre|YP|FE|FVE|REM)[\s\S]*?\)/gi, '')
    .replace(/\s*-\s*\d+(?:[.,]\d+)?\s*(?:kg|kls|kilos|unds|und|unidades|bolsas|bolsa|paq|paquetes|tarros|tarro|porc|porciones)\b[\s\S]*/gi, '')
    .replace(/\s*\[[\s\S]*?\]/g, '')
    .replace(/[\s-]+$/, '')
    .trim();

  return { cleanName: clean || original, extractedObs };
}

function getCanonicalName(rawName: string, catalog: any[]): string {
  const { cleanName } = cleanInsumoDisplayName(rawName);
  const n = cleanName.toLowerCase();
  
  if (n.includes('huevo')) return 'Huevos frescos AA';
  if (n.includes('yuca')) return 'Yuca';
  if (n.includes('platano') && n.includes('maduro')) return 'Plátano maduro';
  if (n.includes('platano') && n.includes('verde')) return 'Plátano verde';
  if (n.includes('leche')) return 'Leche entera institucional';
  if (n.includes('chonto')) return 'Tomate chonto';
  if (n.includes('cabezona')) return 'Cebolla cabezona';
  if (n.includes('cebolla larga') || n.includes('junca')) return 'Cebolla larga';
  if (n.includes('batavia')) return 'Lechuga Batavia';
  if (n.includes('pimenton')) return 'Pimentón rojo';
  if (n.includes('zanahoria')) return 'Zanahoria';
  if (n.includes('limon')) return 'Limón Tahití';
  if (n.includes('chicharron') || n.includes('tocino')) return 'Tocino / Chicharrón cocina';
  if (n.includes('chorizo paisa')) return 'Chorizo Paisa tradicional';
  if (n.includes('chorizo de pollo')) return 'Chorizo de pollo';
  if (n.includes('chorizo grande') || n.includes('choricerdo')) return 'Chorizo grande / Choricerdo';
  if (n.includes('ahumada')) return 'Costilla ahumada de cerdo';
  if (n.includes('san luis')) return 'Costilla San Luis cerdo';
  if (n.includes('lengua')) return 'Lengua de res';
  if (n.includes('baby')) return 'Baby beef (Lomo viche)';
  if (n.includes('churrasco')) return 'Lomo de caracho (Churrasco)';
  if (n.includes('punta de anca')) return 'Punta de anca res';
  if (n.includes('sobrebarriga')) return 'Sobrebarriga delgada';
  if (n.includes('trucha')) return 'Trucha arcoíris entera';
  if (n.includes('tilapia')) return 'Tilapia roja fresca entera';
  if (n.includes('salmon')) return 'Salmón premium (Filete)';
  if (n.includes('camaron')) return 'Camarón precocido de cultivo';
  if (n.includes('marisco')) return 'Mix de mariscos surtido';
  if (n.includes('servilleta')) return 'Servilletas dispensador 1 a 1';
  if (n.includes('toalla')) return 'Toalla de mano Z Natural';
  if (n.includes('vaso') && n.includes('9')) return 'Vaso plástico 9 oz';
  if (n.includes('vaso') && n.includes('12')) return 'Vaso plástico Tami 12 oz';
  if (n.includes('sopero') && n.includes('8')) return 'Contenedor térmico sopero 8 oz';
  if (n.includes('sopero') && n.includes('16')) return 'Contenedor térmico sopero 16 oz';
  if (n.includes('arroz')) return 'Arroz blanco institucional';
  if (n.includes('alguacil')) return 'Pescado Alguacil';

  // Direct match with catalog
  const direct = catalog.find((c: any) => c.nombre.toLowerCase() === n || cleanName.toLowerCase() === c.nombre.toLowerCase());
  if (direct) return direct.nombre;

  return cleanName;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('fecha');

    // Fetch catalog insumos for canonical naming
    const { data: catalogInsumos } = await supabase
      .from('catalogo_insumos')
      .select('id, codigo, nombre, categoria');
    const catalog = catalogInsumos || [];

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
        const canonicalName = getCanonicalName(mov.nombre_insumo, catalog);
        const { extractedObs } = cleanInsumoDisplayName(mov.nombre_insumo);

        let existingItem = itemsInCat.find(it => it.name.toLowerCase() === canonicalName.toLowerCase());

        const rawQty = Number(mov.cantidad || 0);
        const unitPrice = Number(mov.costo_unitario || 0);

        const reg = {
          id: mov.id,
          hora: mov.fecha_hora ? new Date(mov.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '08:00 AM',
          usuario: mov.usuario || 'Administradora',
          tipo: mov.tipo_movimiento || 'BODEGA_A_COCINA',
          origen: mov.origen || 'Bodega General',
          destino: mov.destino || 'Cocina Principal',
          cantidad: rawQty,
          unidad: mov.unidad || 'Kg',
          costoUnitario: unitPrice,
          total: Number(mov.valor_total_movimiento || (rawQty * unitPrice)),
          observaciones: mov.observaciones || extractedObs || undefined
        };

        if (existingItem) {
          existingItem.qty += rawQty;
          existingItem.total += Number(mov.valor_total_movimiento || (rawQty * unitPrice));
          if (existingItem.registros) existingItem.registros.push(reg);
        } else {
          itemsInCat.push({
            id: `item-${mov.id}`,
            name: canonicalName,
            qty: rawQty,
            unit: mov.unidad || 'Kg',
            unitPrice: unitPrice,
            total: Number(mov.valor_total_movimiento || (rawQty * unitPrice)),
            registros: [reg]
          });
        }
      });

      // 2. Incorporate Amanece into item registros without double-counting
      amaneceItems.forEach((am: any) => {
        const canonicalAmName = getCanonicalName(am.nombre_insumo, catalog);
        const { extractedObs: amObs } = cleanInsumoDisplayName(am.nombre_insumo);
        const amQty = Number(am.cantidad || 0);
        const amUnitPrice = Number(am.costo_unitario || 0);
        const amTotal = Number(am.valor_total || (amQty * amUnitPrice));

        let foundCat = 'Carnes y Proteínas (Saldo Cocina + Traslados)';
        let existingItem: any = null;

        Array.from(categoryMap.entries()).forEach(([catName, items]: [string, any[]]) => {
          const match = items.find((it: any) => it.name.toLowerCase() === canonicalAmName.toLowerCase());
          if (match && !existingItem) {
            existingItem = match;
            foundCat = catName;
          }
        });

        const amReg = {
          id: `am-${am.id}`,
          hora: '07:00 AM',
          usuario: 'Administradora / Cocina',
          tipo: 'INVENTARIO_INICIAL_COCINA' as const,
          origen: 'Inventario Cocina (Amanece)',
          destino: 'Cocina Principal',
          cantidad: amQty,
          unidad: am.unidad || 'Kg',
          costoUnitario: amUnitPrice,
          total: amTotal,
          observaciones: am.observaciones || amObs || 'Saldo físico de apertura'
        };

        if (existingItem) {
          // Adjust existing traslado registration so that Apertura + Traslado = Total
          // If total in sheet was Q and Amanece was A:
          // The real traslado was Math.max(0, Q - A)
          const totalSheetQty = existingItem.qty;
          const realTrasladoQty = Number(Math.max(0, totalSheetQty - amQty).toFixed(2));
          
          if (existingItem.registros && existingItem.registros.length > 0) {
            existingItem.registros.forEach((r: any) => {
              if (r.tipo === 'BODEGA_A_COCINA') {
                r.cantidad = realTrasladoQty;
                r.total = Math.round(realTrasladoQty * r.costoUnitario);
              }
            });
            existingItem.registros.unshift(amReg);
          } else {
            existingItem.registros = [amReg];
          }
          // The item's total quantity remains totalSheetQty (or amQty if larger)
          existingItem.qty = Math.max(totalSheetQty, amQty);
          existingItem.total = Math.round(existingItem.qty * existingItem.unitPrice);
        } else {
          // If item was not in movimientos, add it as pure Apertura item
          if (!categoryMap.has(foundCat)) categoryMap.set(foundCat, []);
          categoryMap.get(foundCat)!.push({
            id: `am-item-${am.id}`,
            name: canonicalAmName,
            qty: amQty,
            unit: am.unidad || 'Kg',
            unitPrice: amUnitPrice,
            total: amTotal,
            isInitialInventory: true,
            registros: [amReg]
          });
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
