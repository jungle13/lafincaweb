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
  const n = cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (n.includes('repollo')) return 'Repollo morado';
  if (n.includes('huevo')) return 'Huevos frescos AA';
  if (n.includes('yuca')) return 'Yuca';
  if (n.includes('platano') && n.includes('maduro')) return 'Plátano maduro';
  if (n.includes('platano') && n.includes('verde')) return 'Plátano verde';
  if (n.includes('leche') && !n.includes('mazamorra')) return 'Leche entera institucional';
  if (n.includes('mazamorra')) return 'Mazamorra con leche / Maíz peto';
  if (n.includes('chonto')) return 'Tomate chonto';
  if (n.includes('cabezona')) return 'Cebolla cabezona';
  if (n.includes('cebolla larga') || n.includes('junca')) return 'Cebolla larga';
  if (n.includes('batavia')) return 'Lechuga Batavia';
  if (n.includes('pimenton')) return 'Pimentón rojo';
  if (n.includes('zanahoria')) return 'Zanahoria';
  if (n.includes('limon')) return 'Limón Tahití';
  if (n.includes('chicharron') || n.includes('tocino')) return 'Tocino / Chicharrón cocina';
  if (n.includes('chorizo paisa')) return 'Chorizo Paisa tradicional';
  if (n.includes('chorizo de pollo') || n.includes('chorizo pollo')) return 'Chorizo de pollo';
  if (n.includes('chorizo grande') || n.includes('choricerdo')) return 'Chorizo grande / Choricerdo';
  if (n.includes('rellena') || n.includes('morcilla')) return 'Rellena / Morcilla tradicional';
  if (n.includes('ahumada')) return 'Costilla ahumada de cerdo';
  if (n.includes('san luis')) return 'Costilla San Luis cerdo';
  if (n.includes('lengua')) return 'Lengua de res';
  if (n.includes('baby')) return 'Baby beef (Lomo viche)';
  if (n.includes('churrasco') || n.includes('caracho')) return 'Lomo de caracho (Churrasco)';
  if (n.includes('punta de anca')) return 'Punta de anca res';
  if (n.includes('sobrebarriga')) return 'Sobrebarriga delgada';
  if (n.includes('trucha')) return 'Trucha arcoíris entera';
  if (n.includes('tilapia')) return 'Tilapia roja fresca entera';
  if (n.includes('salmon')) return 'Salmón premium (Filete)';
  if (n.includes('camaron')) return 'Camarón precocido de cultivo';
  if (n.includes('marisco')) return 'Mix de mariscos surtido';
  if (n.includes('francesa')) return 'Papas a la francesa';
  if (n.includes('tamal') && !n.includes('pollo')) return 'Tamales elaborados tradicionales';
  if ((n.includes('pollo') || n.includes('gallina')) && !n.includes('repollo')) {
    if (n.includes('filete') || n.includes('pechuga')) return 'Filete de pechuga pollo';
    return 'Pollo entero / Presas (Sancocho/Tamal)';
  }
  if (n.includes('servilleta')) return 'Servilletas dispensador 1 a 1';
  if (n.includes('toalla')) return 'Toalla de mano Z Natural';
  if (n.includes('vaso') && n.includes('9')) return 'Vaso plástico 9 oz';
  if (n.includes('vaso') && n.includes('12')) return 'Vaso plástico Tami 12 oz';
  if (n.includes('sopero') && n.includes('8')) return 'Contenedor térmico sopero 8 oz';
  if (n.includes('sopero') && n.includes('16')) return 'Contenedor térmico sopero 16 oz';
  if (n.includes('arroz')) return 'Arroz blanco institucional';
  if (n.includes('alguacil')) return 'Pescado Alguacil';

  const direct = catalog.find((c: any) => c.nombre.toLowerCase() === n || cleanName.toLowerCase() === c.nombre.toLowerCase());
  if (direct) return direct.nombre;

  return cleanName;
}

function resolveStandardCategory(rawCat: string, rawName: string): string {
  const cat = (rawCat || '').toLowerCase();
  const name = (rawName || '').toLowerCase();

  if (
    cat.includes('carne') || cat.includes('prote') || cat.includes('pollo') ||
    cat.includes('pescado') || cat.includes('cerdo') || cat.includes('embutido') ||
    cat.includes('res') || cat.includes('marisco') ||
    name.includes('carne') || name.includes('pechuga') || name.includes('pollo') ||
    name.includes('costilla') || name.includes('tocino') || name.includes('chicharron') ||
    name.includes('chorizo') || name.includes('morcilla') || name.includes('trucha') ||
    name.includes('tilapia') || name.includes('salmon') || name.includes('sobrebarriga') ||
    name.includes('churrasco') || name.includes('punta de anca') || name.includes('baby')
  ) {
    return 'Carnes y Proteínas (Saldo Cocina + Traslados)';
  } else if (
    cat.includes('desechable') || cat.includes('empaque') ||
    name.includes('vaso') || name.includes('servilleta') || name.includes('contenedor')
  ) {
    return 'Desechables y Empaques';
  } else if (
    cat.includes('grano') || cat.includes('abarrote') || cat.includes('lacteo') ||
    cat.includes('lácteo') || cat.includes('huevo') ||
    name.includes('arroz') || name.includes('aceite') || name.includes('frijol') ||
    name.includes('azucar') || name.includes('sal')
  ) {
    return 'Granos y Abarrotes';
  }

  return 'Verduras e Insumos';
}

async function syncCosteoDiarioSummary(targetDate: string, explicitPosSales?: number, explicitTitle?: string) {
  try {
    const { error: rpcErr } = await supabase.rpc('rpc_sync_costeo_diario', {
      p_fecha: targetDate,
      p_pos_sales: explicitPosSales !== undefined ? Number(explicitPosSales) : null,
      p_titulo: explicitTitle || null
    });
    if (rpcErr) throw rpcErr;
  } catch (rpcErr) {
    console.error('Error invoking rpc_sync_costeo_diario:', rpcErr);
  }
}

let cachedCatalog: any[] | null = null;
let cacheCatalogExpiry = 0;

async function getCachedCatalog() {
  const now = Date.now();
  if (cachedCatalog && now < cacheCatalogExpiry) {
    return cachedCatalog;
  }
  const { data } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, costo_unitario_kg');
  cachedCatalog = data || [];
  cacheCatalogExpiry = now + 60000; // Cache 60 segundos
  return cachedCatalog;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('fecha');
    const checkPrevFor = searchParams.get('checkPrevCierresFor');

    // Verificación condicional rápida de cierres del día inmediatamente anterior
    if (checkPrevFor) {
      const [y, m, d] = checkPrevFor.split('-').map(Number);
      const prevDt = new Date(Date.UTC(y, m - 1, d));
      prevDt.setUTCDate(prevDt.getUTCDate() - 1);
      const prevDate = prevDt.toISOString().split('T')[0];

      // 1. Comprobar registros_costeo_cocina
      const { data: regRows } = await supabase
        .from('registros_costeo_cocina')
        .select('tipo, cantidad')
        .eq('fecha', prevDate)
        .in('tipo', ['CIERRE', 'BODEGA_CIERRE'])
        .gt('cantidad', 0);

      let cocinaCount = (regRows || []).filter(r => r.tipo === 'CIERRE').length;
      let bodegaCount = (regRows || []).filter(r => r.tipo === 'BODEGA_CIERRE').length;

      // 2. Si no hay en registros_costeo_cocina, verificar conteos_fisicos
      if (cocinaCount === 0 || bodegaCount === 0) {
        const { data: conteos } = await supabase
          .from('conteos_fisicos')
          .select('id, tipo')
          .eq('fecha', prevDate)
          .in('tipo', ['COCINA_CIERRE', 'CIERRE', 'BODEGA_CIERRE', 'CIERRE_BODEGA']);

        if (conteos && conteos.length > 0) {
          for (const c of conteos) {
            const isCocina = c.tipo === 'COCINA_CIERRE' || c.tipo === 'CIERRE';
            const isBodega = c.tipo === 'BODEGA_CIERRE' || c.tipo === 'CIERRE_BODEGA';

            if ((isCocina && cocinaCount === 0) || (isBodega && bodegaCount === 0)) {
              const { count } = await supabase
                .from('conteos_fisicos_detalle')
                .select('*', { count: 'exact', head: true })
                .eq('conteo_id', c.id)
                .gt('cantidad', 0);

              if (isCocina && cocinaCount === 0) cocinaCount = count || 0;
              if (isBodega && bodegaCount === 0) bodegaCount = count || 0;
            }
          }
        }
      }

      return NextResponse.json({
        targetDate: checkPrevFor,
        prevDate,
        hasCocinaCierre: cocinaCount > 0,
        cocinaCierreCount: cocinaCount,
        hasBodegaCierre: bodegaCount > 0,
        bodegaCierreCount: bodegaCount
      });
    }

    // 1. Fetch catalog in parallel with headers
    let headerQuery = supabase
      .from('costeo_diario')
      .select('*')
      .order('fecha', { ascending: false });

    if (dateParam) {
      headerQuery = headerQuery.eq('fecha', dateParam);
    }

    const [catalog, { data: sheetsHeader, error: headerErr }] = await Promise.all([
      getCachedCatalog(),
      headerQuery
    ]);
    if (headerErr) {
      return NextResponse.json({ error: headerErr.message }, { status: 500 });
    }

    if (!sheetsHeader || sheetsHeader.length === 0) {
      return NextResponse.json({ sheets: [] });
    }

    const dates = sheetsHeader.map((h: any) => h.fecha);

    // 3. Fetch all registros_costeo_cocina with pagination to ensure NO date is cut off by Supabase 1000-row cap
    let allRegistros: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let regQuery = supabase
        .from('registros_costeo_cocina')
        .select('*');

      if (dateParam) {
        regQuery = regQuery.eq('fecha', dateParam);
      } else {
        regQuery = regQuery.in('fecha', dates);
      }

      const { data: pageRows, error: regErr } = await regQuery
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1);

      if (regErr) {
        console.error('Error fetching registros_costeo_cocina:', regErr);
        return NextResponse.json({ error: regErr.message }, { status: 500 });
      }

      if (pageRows && pageRows.length > 0) {
        allRegistros = allRegistros.concat(pageRows);
        if (pageRows.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    const standardCategories = [
      { id: 'verduras', name: 'Verduras e Insumos' },
      { id: 'carnes', name: 'Carnes y Proteínas (Saldo Cocina + Traslados)' },
      { id: 'granos', name: 'Granos y Abarrotes' },
      { id: 'desechables', name: 'Desechables y Empaques' },
      { id: 'consumos_insumos', name: 'Consumido del Catálogo de Insumos y Carne' },
      { id: 'consumos_productos', name: 'Consumido de Productos para la Venta' }
    ];

    // 4. Build sheets
    const sheets = sheetsHeader.map((header: any) => {
      const dateStr = header.fecha;
      const dayRegs = (allRegistros || []).filter((r: any) => r.fecha === dateStr);

      const categoryMap = new Map<string, any[]>();
      standardCategories.forEach(std => categoryMap.set(std.name, []));

      // Process all registrations of the day
      dayRegs.forEach((reg: any) => {
        let canonicalName = '';
        let resolvedCategory = '';

        let catItem: any = null;

        if (reg.tipo === 'CONSUMO') {
          canonicalName = reg.nombre_insumo;
          resolvedCategory = (reg.categoria || '').includes('Producto')
            ? 'Consumido de Productos para la Venta'
            : 'Consumido del Catálogo de Insumos y Carne';
          catItem = catalog.find((c: any) => c.nombre.toLowerCase() === canonicalName.toLowerCase());
        } else {
          canonicalName = getCanonicalName(reg.nombre_insumo, catalog);
          catItem = catalog.find((c: any) => c.nombre.toLowerCase() === canonicalName.toLowerCase());
          resolvedCategory = resolveStandardCategory(catItem?.categoria || reg.categoria, canonicalName);
        }

        if (!categoryMap.has(resolvedCategory)) {
          categoryMap.set(resolvedCategory, []);
        }

        const itemsInCat = categoryMap.get(resolvedCategory)!;
        let existingItem = itemsInCat.find((it: any) => it.name.toLowerCase() === canonicalName.toLowerCase());

        const rawQty = Number(reg.cantidad || 0);
        const unitPrice = Number(reg.costo_unitario || catItem?.costo_unitario_kg || 0);
        const total = Number(reg.valor_total || (rawQty * unitPrice));

        // Map internal tipo to UI view tipo
        let uiTipo: string = 'BODEGA_A_COCINA';
        let uiOrigen: string = 'Bodega General';
        let uiDestino: string = 'Cocina Principal';

        if (reg.tipo === 'APERTURA') {
          uiTipo = 'INVENTARIO_INICIAL_COCINA';
          uiOrigen = 'Inventario Cocina (Amanece)';
          uiDestino = 'Cocina Principal';
        } else if (reg.tipo === 'DEVOLUCION') {
          uiTipo = 'DEVOLUCION_COCINA';
          uiOrigen = 'Cocina Principal';
          uiDestino = 'Bodega General';
        } else if (reg.tipo === 'CIERRE') {
          uiTipo = 'COCINA_CIERRE';
          uiOrigen = 'Cocina Principal';
          uiDestino = 'Inventario Cierre Cocina';
        } else if (reg.tipo === 'BODEGA_APERTURA') {
          uiTipo = 'BODEGA_APERTURA';
          uiOrigen = 'Inventario Bodega';
          uiDestino = 'Bodega General';
        } else if (reg.tipo === 'BODEGA_CIERRE') {
          uiTipo = 'BODEGA_CIERRE';
          uiOrigen = 'Bodega General';
          uiDestino = 'Inventario Cierre Bodega';
        } else if (reg.tipo === 'CONSUMO') {
          uiTipo = 'CONSUMO';
          uiOrigen = 'Cocina Principal';
          uiDestino = 'Consumos';
        }

        const itemReg = {
          id: reg.id,
          hora: reg.created_at ? new Date(reg.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '08:00 AM',
          usuario: 'Administradora / Cocina',
          tipo: uiTipo,
          origen: uiOrigen,
          destino: uiDestino,
          cantidad: rawQty,
          unidad: reg.unidad || 'Kg',
          costoUnitario: unitPrice,
          total: total,
          observaciones: reg.observaciones || undefined
        };

        if (existingItem) {
          if (!existingItem.registros) existingItem.registros = [];
          existingItem.registros.push(itemReg);
          // Accumulate default qty/total if it's a traslado or consumo
          if (reg.tipo === 'TRASLADO' || reg.tipo === 'CONSUMO') {
            existingItem.qty += rawQty;
            existingItem.total += total;
          }
        } else {
          itemsInCat.push({
            id: `item-${reg.id}`,
            name: canonicalName,
            qty: (reg.tipo === 'TRASLADO' || reg.tipo === 'CONSUMO') ? rawQty : 0,
            unit: reg.unidad || 'Kg',
            unitPrice: unitPrice,
            total: (reg.tipo === 'TRASLADO' || reg.tipo === 'CONSUMO') ? total : 0,
            isInitialInventory: reg.tipo === 'APERTURA',
            registros: [itemReg]
          });
        }
      });

      // Construct category groups
      const categories = standardCategories.map(std => {
        const items = categoryMap.get(std.name) || [];
        const subtotal = items.reduce((sum: number, it: any) => sum + (Number(it.total) || 0), 0);
        return {
          id: std.id,
          name: std.name,
          subtotal,
          itemsCount: items.length,
          items
        };
      });

      categoryMap.forEach((items, name) => {
        if (!standardCategories.some(s => s.name === name)) {
          const subtotal = items.reduce((sum: number, it: any) => sum + (Number(it.total) || 0), 0);
          categories.push({
            id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name,
            subtotal,
            itemsCount: items.length,
            items
          });
        }
      });

      const month = dateStr.slice(0, 7);

      return {
        id: `sheet-${dateStr}`,
        month,
        dateStr,
        title: header.titulo || `${dateStr} - Hoja Costeo Cocina`,
        posSales: Number(header.pos_sales || 0),
        costoApertura: Number(header.costo_apertura || 0),
        costoBruto: Number(header.costo_bruto || 0),
        devoluciones: Number(header.devoluciones || 0),
        costoCierre: Number(header.costo_cierre || 0),
        costoConsumos: Number(header.costo_consumos || 0),
        consumoReal: Number(header.consumo_real || 0),
        foodCostPorcentaje: Number(header.food_cost_porcentaje || 0),
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
    const {
      fecha,
      titulo,
      pos_sales,
      movimiento,
      targetView,
      actionMode,
      items,
      bulkConteos,
      action,
      importCarryOver,
      importCocinaCierre,
      importBodegaCierre,
      tipos,
      targetTypes
    } = body;

    const targetDate = fecha || bulkConteos?.fecha;
    if (!targetDate) {
      return NextResponse.json({ error: 'La fecha es requerida' }, { status: 400 });
    }

    // Catalog for insumo linking
    const { data: catInsumos } = await supabase
      .from('catalogo_insumos')
      .select('id, nombre, categoria, costo_unitario_kg');
    const catalog = catInsumos || [];

    // 0. Manejo de Creación de Hoja de Costeo e Importación Condicional de Existencias (Cocina y Bodega)
    if (action === 'CREATE_SHEET') {
      const { data: existingSheet } = await supabase
        .from('costeo_diario')
        .select('*')
        .eq('fecha', targetDate)
        .maybeSingle();

      if (!existingSheet) {
        await supabase
          .from('costeo_diario')
          .insert({
            fecha: targetDate,
            titulo: titulo || `${targetDate} - Hoja Costeo Cocina`,
            pos_sales: Number(pos_sales || 0),
            costo_apertura: 0,
            costo_bruto: 0,
            devoluciones: 0,
            costo_cierre: 0,
            costo_neto: 0,
            consumo_real: 0,
            food_cost_porcentaje: 0
          });
      }

      // Calcular el día inmediatamente anterior
      const [y, m, d] = targetDate.split('-').map(Number);
      const prevDt = new Date(Date.UTC(y, m - 1, d));
      prevDt.setUTCDate(prevDt.getUTCDate() - 1);
      const prevDate = prevDt.toISOString().split('T')[0];

      let importedCocinaCount = 0;
      let importedBodegaCount = 0;

      const shouldImportCocina = Boolean(importCocinaCierre !== undefined ? importCocinaCierre : importCarryOver);
      const shouldImportBodega = Boolean(importBodegaCierre);

      // 1. Importar Cierre de Cocina del día anterior como APERTURA (Inventario Cocina Amanece)
      if (shouldImportCocina) {
        const { data: prevCocinaRows } = await supabase
          .from('registros_costeo_cocina')
          .select('*')
          .eq('fecha', prevDate)
          .eq('tipo', 'CIERRE')
          .gt('cantidad', 0);

        if (prevCocinaRows && prevCocinaRows.length > 0) {
          // Eliminar si ya existía apertura en targetDate para evitar duplicar
          await supabase
            .from('registros_costeo_cocina')
            .delete()
            .eq('fecha', targetDate)
            .eq('tipo', 'APERTURA');

          const newAperturaRows = prevCocinaRows.map((r: any) => ({
            fecha: targetDate,
            tipo: 'APERTURA',
            insumo_id: r.insumo_id,
            nombre_insumo: r.nombre_insumo,
            categoria: r.categoria,
            cantidad: r.cantidad,
            unidad: r.unidad || 'Kg',
            costo_unitario: r.costo_unitario,
            valor_total: r.valor_total || (Number(r.cantidad || 0) * Number(r.costo_unitario || 0)),
            observaciones: `Inventario amanece importado del cierre de cocina ${prevDate}`
          }));

          if (newAperturaRows.length > 0) {
            await supabase
              .from('registros_costeo_cocina')
              .insert(newAperturaRows);
            importedCocinaCount = newAperturaRows.length;
          }
        } else {
          // Fallback a conteos_fisicos si no está en registros_costeo_cocina
          const { data: conteoCocina } = await supabase
            .from('conteos_fisicos')
            .select('id')
            .eq('fecha', prevDate)
            .in('tipo', ['COCINA_CIERRE', 'CIERRE'])
            .maybeSingle();

          if (conteoCocina) {
            const { data: detalles } = await supabase
              .from('conteos_fisicos_detalle')
              .select('*')
              .eq('conteo_id', conteoCocina.id)
              .gt('cantidad', 0);

            if (detalles && detalles.length > 0) {
              await supabase
                .from('registros_costeo_cocina')
                .delete()
                .eq('fecha', targetDate)
                .eq('tipo', 'APERTURA');

              const newAperturaRows = detalles.map((dt: any) => {
                const catItem = catalog.find((c: any) => c.nombre.toLowerCase() === (dt.nombre_insumo || '').toLowerCase());
                const unitPrice = Number(dt.costo_unitario || catItem?.costo_unitario_kg || 0);
                const qty = Number(dt.cantidad || 0);
                return {
                  fecha: targetDate,
                  tipo: 'APERTURA',
                  insumo_id: dt.insumo_id || catItem?.id || null,
                  nombre_insumo: dt.nombre_insumo,
                  categoria: dt.categoria || catItem?.categoria || 'Verduras e Insumos',
                  cantidad: qty,
                  unidad: dt.unidad || 'Kg',
                  costo_unitario: unitPrice,
                  valor_total: Number(dt.valor_total || (qty * unitPrice)),
                  observaciones: `Inventario amanece importado del cierre físico cocina ${prevDate}`
                };
              });

              if (newAperturaRows.length > 0) {
                await supabase
                  .from('registros_costeo_cocina')
                  .insert(newAperturaRows);
                importedCocinaCount = newAperturaRows.length;
              }
            }
          }
        }
      }

      // 2. Importar Cierre de Bodega del día anterior como BODEGA_APERTURA
      if (shouldImportBodega) {
        const { data: prevBodegaRows } = await supabase
          .from('registros_costeo_cocina')
          .select('*')
          .eq('fecha', prevDate)
          .eq('tipo', 'BODEGA_CIERRE')
          .gt('cantidad', 0);

        if (prevBodegaRows && prevBodegaRows.length > 0) {
          // Eliminar si ya existía bodega apertura en targetDate para evitar duplicar
          await supabase
            .from('registros_costeo_cocina')
            .delete()
            .eq('fecha', targetDate)
            .eq('tipo', 'BODEGA_APERTURA');

          const newBodegaAperturaRows = prevBodegaRows.map((r: any) => ({
            fecha: targetDate,
            tipo: 'BODEGA_APERTURA',
            insumo_id: r.insumo_id,
            nombre_insumo: r.nombre_insumo,
            categoria: r.categoria,
            cantidad: r.cantidad,
            unidad: r.unidad || 'Kg',
            costo_unitario: r.costo_unitario,
            valor_total: r.valor_total || (Number(r.cantidad || 0) * Number(r.costo_unitario || 0)),
            observaciones: `Inventario bodega amanece importado del cierre de bodega ${prevDate}`
          }));

          if (newBodegaAperturaRows.length > 0) {
            await supabase
              .from('registros_costeo_cocina')
              .insert(newBodegaAperturaRows);
            importedBodegaCount = newBodegaAperturaRows.length;
          }
        } else {
          // Fallback a conteos_fisicos si no está en registros_costeo_cocina
          const { data: conteoBodega } = await supabase
            .from('conteos_fisicos')
            .select('id')
            .eq('fecha', prevDate)
            .in('tipo', ['BODEGA_CIERRE', 'CIERRE_BODEGA'])
            .maybeSingle();

          if (conteoBodega) {
            const { data: detalles } = await supabase
              .from('conteos_fisicos_detalle')
              .select('*')
              .eq('conteo_id', conteoBodega.id)
              .gt('cantidad', 0);

            if (detalles && detalles.length > 0) {
              await supabase
                .from('registros_costeo_cocina')
                .delete()
                .eq('fecha', targetDate)
                .eq('tipo', 'BODEGA_APERTURA');

              const newBodegaAperturaRows = detalles.map((dt: any) => {
                const catItem = catalog.find((c: any) => c.nombre.toLowerCase() === (dt.nombre_insumo || '').toLowerCase());
                const unitPrice = Number(dt.costo_unitario || catItem?.costo_unitario_kg || 0);
                const qty = Number(dt.cantidad || 0);
                return {
                  fecha: targetDate,
                  tipo: 'BODEGA_APERTURA',
                  insumo_id: dt.insumo_id || catItem?.id || null,
                  nombre_insumo: dt.nombre_insumo,
                  categoria: dt.categoria || catItem?.categoria || 'Verduras e Insumos',
                  cantidad: qty,
                  unidad: dt.unidad || 'Kg',
                  costo_unitario: unitPrice,
                  valor_total: Number(dt.valor_total || (qty * unitPrice)),
                  observaciones: `Inventario bodega amanece importado del cierre físico bodega ${prevDate}`
                };
              });

              if (newBodegaAperturaRows.length > 0) {
                await supabase
                  .from('registros_costeo_cocina')
                  .insert(newBodegaAperturaRows);
                importedBodegaCount = newBodegaAperturaRows.length;
              }
            }
          }
        }
      }

      await syncCosteoDiarioSummary(targetDate, pos_sales, titulo);

      return NextResponse.json({
        success: true,
        fecha: targetDate,
        prevDate,
        importedCocinaCount,
        importedBodegaCount,
        importedItemsCount: importedCocinaCount + importedBodegaCount,
        sourceDate: prevDate
      });
    }

    // 1. Resetear / Limpiar hoja de costeo en Base de Datos (completo o selectivo por tipo)
    if (action === 'RESET_SHEET') {
      const rawTipos = tipos || targetTypes;
      const selectedTipos: string[] = Array.isArray(rawTipos) && rawTipos.length > 0 ? rawTipos : [];

      if (selectedTipos.length > 0) {
        // Normalizar tipos a los valores exactos en registros_costeo_cocina
        const dbTipos: string[] = [];
        selectedTipos.forEach((t: any) => {
          const upper = String(t).toUpperCase().trim();
          if (upper === 'APERTURA' || upper === 'COCINA_APERTURA' || upper === 'INVENTARIO_INICIAL_COCINA') {
            dbTipos.push('APERTURA');
          } else if (upper === 'TRASLADO' || upper === 'TRASLADOS' || upper === 'BODEGA_A_COCINA' || upper === 'MOVIMIENTOS' || upper === 'COCINA_MOVIMIENTOS') {
            dbTipos.push('TRASLADO');
          } else if (upper === 'DEVOLUCION' || upper === 'DEVOLUCIONES' || upper === 'DEVOLUCION_COCINA' || upper === 'COCINA_DEVOLUCIONES') {
            dbTipos.push('DEVOLUCION');
          } else if (upper === 'CIERRE' || upper === 'COCINA_CIERRE') {
            dbTipos.push('CIERRE');
          } else if (upper === 'BODEGA_APERTURA' || upper === 'BODEGA_INICIAL') {
            dbTipos.push('BODEGA_APERTURA');
          } else if (upper === 'BODEGA_CIERRE' || upper === 'CIERRE_BODEGA') {
            dbTipos.push('BODEGA_CIERRE');
          } else {
            dbTipos.push(upper);
          }
        });

        const { error: delErr } = await supabase
          .from('registros_costeo_cocina')
          .delete()
          .eq('fecha', targetDate)
          .in('tipo', dbTipos);

        if (delErr) {
          console.error('Error al eliminar registros por tipo:', delErr);
          throw delErr;
        }

        // Si se limpió APERTURA, CIERRE, BODEGA_APERTURA o BODEGA_CIERRE, limpiar también conteos_fisicos asociados
        const conteoTipos: string[] = [];
        if (dbTipos.includes('APERTURA')) conteoTipos.push('COCINA_APERTURA', 'APERTURA');
        if (dbTipos.includes('CIERRE')) conteoTipos.push('COCINA_CIERRE', 'CIERRE');
        if (dbTipos.includes('BODEGA_APERTURA')) conteoTipos.push('BODEGA_APERTURA');
        if (dbTipos.includes('BODEGA_CIERRE')) conteoTipos.push('BODEGA_CIERRE', 'CIERRE_BODEGA');

        if (conteoTipos.length > 0) {
          const { data: cList } = await supabase
            .from('conteos_fisicos')
            .select('id')
            .eq('fecha', targetDate)
            .in('tipo', conteoTipos);

          if (cList && cList.length > 0) {
            const cIds = cList.map((c: any) => c.id);
            await supabase.from('conteos_fisicos_detalle').delete().in('conteo_id', cIds);
            await supabase.from('conteos_fisicos').delete().in('id', cIds);
          }
        }
      } else {
        // Si no se especificaron tipos, eliminar todos los registros de la fecha
        const { error: delAllErr } = await supabase
          .from('registros_costeo_cocina')
          .delete()
          .eq('fecha', targetDate);

        if (delAllErr) {
          console.error('Error al vaciar hoja completa:', delAllErr);
          throw delAllErr;
        }

        // Vaciar también todos los conteos físicos de la fecha
        const { data: cList } = await supabase
          .from('conteos_fisicos')
          .select('id')
          .eq('fecha', targetDate);

        if (cList && cList.length > 0) {
          const cIds = cList.map((c: any) => c.id);
          await supabase.from('conteos_fisicos_detalle').delete().in('conteo_id', cIds);
          await supabase.from('conteos_fisicos').delete().in('id', cIds);
        }
      }

      // Sincronizar el resumen de costeo_diario en base de datos inmediatamente
      await syncCosteoDiarioSummary(targetDate);

      return NextResponse.json({ 
        success: true, 
        message: `Hoja ${targetDate} limpiada exitosamente` 
      });
    }

    // 2. Eliminar un ítem individual o sus registros
    if (action === 'DELETE_ITEM') {
      const { registroIds, itemName } = body;
      if (Array.isArray(registroIds) && registroIds.length > 0) {
        // Remove prefixes if any
        const cleanIds = registroIds.map((id: string) => id.replace(/^(am-|ci-|item-)/, ''));
        await supabase
          .from('registros_costeo_cocina')
          .delete()
          .in('id', cleanIds);
      } else if (itemName) {
        await supabase
          .from('registros_costeo_cocina')
          .delete()
          .eq('fecha', targetDate)
          .eq('nombre_insumo', itemName);
      }

      await syncCosteoDiarioSummary(targetDate);
      return NextResponse.json({ success: true });
    }

    // 3. Manejo de Carga Masiva (Bulk Conteos desde Añadir Conteos)
    const itemsList = items || bulkConteos?.items;
    if (itemsList && Array.isArray(itemsList)) {
      const rawTarget = (targetView || bulkConteos?.targetView || 'TRASLADOS').toUpperCase();
      const actualActionMode = (actionMode || bulkConteos?.actionMode || 'SUMAR').toUpperCase();

      // Mapear vista a tipo canónico de registro
      let targetTipo = 'TRASLADO';
      if (rawTarget === 'COCINA_APERTURA' || rawTarget === 'INVENTARIO_INICIAL_COCINA' || rawTarget === 'APERTURA') {
        targetTipo = 'APERTURA';
      } else if (rawTarget === 'DEVOLUCIONES' || rawTarget === 'DEVOLUCION_COCINA' || rawTarget === 'DEVOLUCION') {
        targetTipo = 'DEVOLUCION';
      } else if (rawTarget === 'COCINA_CIERRE' || rawTarget === 'CIERRE') {
        targetTipo = 'CIERRE';
      } else if (rawTarget === 'BODEGA_APERTURA') {
        targetTipo = 'BODEGA_APERTURA';
      } else if (rawTarget === 'BODEGA_CIERRE') {
        targetTipo = 'BODEGA_CIERRE';
      }

      const rowsToInsert = itemsList.map((it: any) => {
        const rawName = it.nombre_insumo || it.name || it.itemName || '';
        const canonicalName = getCanonicalName(rawName, catalog);
        const catItem = catalog.find((c: any) => c.nombre.toLowerCase() === canonicalName.toLowerCase());

        const insumoId = it.insumo_id || catItem?.id || null;
        const categoria = catItem?.categoria || it.categoria || it.category || 'Verduras e Insumos';
        const qty = Number(it.cantidad || it.weightKg || it.qty || 0);
        const unitPrice = Number(it.costo_unitario || it.unitPrice || catItem?.costo_unitario_kg || 0);
        const total = Number(it.total || it.estimatedTotal || (qty * unitPrice));

        return {
          fecha: targetDate,
          tipo: targetTipo,
          insumo_id: insumoId,
          nombre_insumo: canonicalName,
          categoria: categoria,
          cantidad: qty,
          unidad: it.unidad || it.baseUnit || it.unit || 'Kg',
          costo_unitario: unitPrice,
          valor_total: total,
          observaciones: it.observaciones || (actualActionMode === 'REEMPLAZAR' ? 'Carga manual conteo (=)' : 'Carga manual conteo (+)')
        };
      });

      if (actualActionMode === 'REEMPLAZAR') {
        const namesToReplace = rowsToInsert.map(r => r.nombre_insumo);
        if (namesToReplace.length > 0) {
          await supabase
            .from('registros_costeo_cocina')
            .delete()
            .eq('fecha', targetDate)
            .eq('tipo', targetTipo)
            .in('nombre_insumo', namesToReplace);
        }
      }

      if (rowsToInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('registros_costeo_cocina')
          .insert(rowsToInsert);
        if (insErr) throw insErr;
      }

      await syncCosteoDiarioSummary(targetDate, pos_sales, titulo);

      return NextResponse.json({ success: true, count: itemsList.length });
    }

    // 4. Manejo de registro individual
    if (movimiento) {
      const rawTipo = (movimiento.tipo || 'TRASLADO').toUpperCase();
      let targetTipo = 'TRASLADO';
      if (rawTipo === 'INVENTARIO_INICIAL_COCINA' || rawTipo === 'COCINA_APERTURA' || rawTipo === 'APERTURA') {
        targetTipo = 'APERTURA';
      } else if (rawTipo === 'DEVOLUCION_COCINA' || rawTipo === 'DEVOLUCIONES' || rawTipo === 'DEVOLUCION') {
        targetTipo = 'DEVOLUCION';
      } else if (rawTipo === 'COCINA_CIERRE' || rawTipo === 'CIERRE') {
        targetTipo = 'CIERRE';
      } else if (rawTipo === 'BODEGA_APERTURA') {
        targetTipo = 'BODEGA_APERTURA';
      } else if (rawTipo === 'BODEGA_CIERRE') {
        targetTipo = 'BODEGA_CIERRE';
      } else if (rawTipo === 'CONSUMO' || rawTipo === 'CONSUMOS') {
        targetTipo = 'CONSUMO';
      }

      let canonicalName = movimiento.nombre_insumo;
      let targetCategoria = movimiento.categoria;
      const catItem = catalog.find((c: any) => c.nombre.toLowerCase() === (movimiento.nombre_insumo || '').toLowerCase());

      if (targetTipo === 'CONSUMO') {
        canonicalName = (movimiento.nombre_insumo || '').trim();
        targetCategoria = (movimiento.categoria || '').includes('Producto')
          ? 'Consumido de Productos para la Venta'
          : 'Consumido del Catálogo de Insumos y Carne';
      } else {
        canonicalName = getCanonicalName(movimiento.nombre_insumo, catalog);
        targetCategoria = catItem?.categoria || movimiento.categoria || 'Verduras e Insumos';
      }

      const qty = Number(movimiento.cantidad || 0);
      const unitPrice = Number(movimiento.costo_unitario || catItem?.costo_unitario_kg || 0);
      const total = Number(movimiento.total || (qty * unitPrice));

      let rowResult = null;
      if (movimiento.id && !movimiento.id.startsWith('reg-') && !movimiento.id.startsWith('item-')) {
        // Actualizar registro existente
        const { data: updatedRow, error: upErr } = await supabase
          .from('registros_costeo_cocina')
          .update({
            cantidad: qty,
            costo_unitario: unitPrice,
            valor_total: total,
            observaciones: movimiento.observaciones || ''
          })
          .eq('id', movimiento.id)
          .select()
          .maybeSingle();
        if (upErr) throw upErr;
        rowResult = updatedRow;
      } else {
        const { data: newRow, error: insErr } = await supabase
          .from('registros_costeo_cocina')
          .insert({
            fecha: targetDate,
            tipo: targetTipo,
            insumo_id: movimiento.insumo_id || catItem?.id || null,
            nombre_insumo: canonicalName,
            categoria: targetCategoria,
            cantidad: qty,
            unidad: movimiento.unidad || 'Kg',
            costo_unitario: unitPrice,
            valor_total: total,
            observaciones: movimiento.observaciones || ''
          })
          .select()
          .single();

        if (insErr) throw insErr;
        rowResult = newRow;
      }

      await syncCosteoDiarioSummary(targetDate, pos_sales, titulo);

      return NextResponse.json({ success: true, movimiento: rowResult });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in POST /api/costeo-diario:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
