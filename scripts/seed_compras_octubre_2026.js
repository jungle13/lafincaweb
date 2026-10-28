import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectUnit(desc, cat, item) {
  const d = String(desc || '').toLowerCase();
  if (d.includes('kg') || d.includes('kilo')) return 'Kg';
  if (d.includes(' bulto')) return 'Bulto';
  if (d.includes(' cj') || d.includes('caja')) return 'Caja';
  if (d.includes('atado')) return 'Atado';
  if (d.includes('bolsa')) return 'Bolsa';
  if (d.includes('paq') || d.includes('pqte')) return 'Paquete';
  if (d.includes('pet') || d.includes('vidrio') || d.includes('lata') || d.includes('bot')) return 'Botella';
  if (d.includes('und') || d.includes('unidad')) return 'Und';
  if (d.includes('porc')) return 'Porción';
  if (d.includes('galon') || d.includes('gl')) return 'Galón';
  if (cat === 'Carnes y Proteínas') return 'Kg';
  return 'Und';
}

function mapCategory(excelCat) {
  if (excelCat === 'Carnes') return 'Carnes y Proteínas';
  if (excelCat === 'Verduras') return 'Verduras y Frutas';
  if (excelCat === 'Desechables') return 'Desechables y Empaques';
  if (excelCat === 'Grano') return 'Granos y Harinas';
  if (excelCat === 'Bebidas') return 'Bebidas y Licores';
  return 'Otros Insumos y Servicios';
}

async function seedCompras() {
  console.log('====================================================');
  console.log('🛒 IMPORTANDO COMPRAS DE COSTO DIRECTO (OCTUBRE 2026)');
  console.log('====================================================\n');

  const excelPath = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/COSTOS_GASTOS_OCTUBRE_2026.xlsx';
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets['Detalle Compras Octubre 2026'];
  const allRows = xlsx.utils.sheet_to_json(sheet);

  const directExcelCats = ['Carnes', 'Verduras', 'Desechables', 'Grano', 'Bebidas', 'Insumos', 'Servicios', 'Aseo'];
  const directRows = allRows.filter((r) => directExcelCats.includes(r['Categoría']));

  console.log(`📊 Total filas de Costo Directo extraídas: ${directRows.length}`);

  // 1. Obtener catálogo actual
  const { data: currentCatalog, error: catErr } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, unidad_medida, costo_unitario_kg');

  if (catErr) {
    console.error('Error cargando catálogo:', catErr);
    return;
  }
  console.log(`📚 Catálogo actual en BD: ${currentCatalog.length} insumos.`);

  // Mapa de búsqueda rápida en catálogo
  const catalogMap = new Map();
  currentCatalog.forEach((c) => {
    catalogMap.set(normalizeName(c.nombre), c);
  });

  // 2. Limpiar compras previas de octubre 2026
  console.log('🧹 Limpiando registros anteriores de compras de Octubre 2026...');
  await supabase.from('compras_detalle').delete().eq('periodo_id', 'per-2026-10');
  await supabase.from('compras').delete().eq('periodo_id', 'per-2026-10');

  // 3. Agrupar filas en facturas únicas (115 facturas)
  const invoiceGroups = new Map();

  directRows.forEach((r, idx) => {
    const dia = Number(r['Día']);
    const fecha = `2026-10-${String(dia).padStart(2, '0')}`;
    const fac = String(r['N° Comprobante / Factura'] || 'S/N').trim();
    const prov = String(r['Proveedor'] || 'Proveedor General').trim();
    const pdf = String(r['Archivo PDF'] || 'Sin Archivo').trim();
    const obs = String(r['Relación con el Cuaderno'] || '').trim();
    const cat = mapCategory(r['Categoría']);
    const val = Number(r['Vr. Compra'] || 0);

    const groupKey = `${fac}||${prov}||${fecha}`;

    if (!invoiceGroups.has(groupKey)) {
      invoiceGroups.set(groupKey, {
        fecha,
        numero_factura: fac,
        proveedor: prov,
        origen: pdf,
        observaciones: obs,
        categoria: cat,
        valor_total: 0,
        periodo_id: 'per-2026-10',
        usuario: 'Facturación / Costeo',
        items: [],
      });
    }

    const group = invoiceGroups.get(groupKey);
    group.valor_total += val;

    // Detectar unidad
    const detectedUnit = detectUnit(r['Descripción Original (PDF)'], cat, r['Ítem']);

    group.items.push({
      fecha,
      numero_factura: fac,
      proveedor: prov,
      categoria: cat,
      nombre_insumo: String(r['Ítem']).trim(),
      detalle: String(r['Descripción Original (PDF)'] || r['Detalle'] || r['Ítem']).trim(),
      cantidad: Number(r['Cantidad'] || 0),
      unidad: detectedUnit,
      costo_unitario: Number(r['Costo Unitario'] || 0),
      valor_compra: val,
      origen: pdf,
      observaciones: obs,
      periodo_id: 'per-2026-10',
      dia,
    });
  });

  console.log(`📦 Grupos de facturas identificados: ${invoiceGroups.size}`);

  // 4. Insertar compras y sus detalles
  let facturasInsertadas = 0;
  let itemsInsertados = 0;
  let granTotalDinero = 0;

  for (const [key, inv] of invoiceGroups.entries()) {
    // Insertar Factura
    const { data: compraCreated, error: errC } = await supabase
      .from('compras')
      .insert({
        fecha: inv.fecha,
        numero_factura: inv.numero_factura,
        proveedor: inv.proveedor,
        valor_total: inv.valor_total,
        observaciones: inv.observaciones,
        origen: inv.origen,
        categoria: inv.categoria,
        total_items: inv.items.length,
        periodo_id: inv.periodo_id,
        usuario: inv.usuario,
      })
      .select('id')
      .single();

    if (errC) {
      console.error(`Error insertando factura ${inv.numero_factura}:`, errC.message);
      continue;
    }

    facturasInsertadas++;
    granTotalDinero += inv.valor_total;
    const compraId = compraCreated.id;

    // Preparar ítems para compras_detalle
    const detailPayload = inv.items.map((item) => {
      // Buscar match en catálogo
      const norm = normalizeName(item.nombre_insumo);
      let match = catalogMap.get(norm);
      if (!match) {
        for (const [catNorm, catObj] of catalogMap.entries()) {
          if (catNorm.includes(norm) || norm.includes(catNorm)) {
            match = catObj;
            break;
          }
        }
      }

      return {
        compra_id: compraId,
        insumo_id: match ? match.id : null,
        periodo_id: item.periodo_id,
        fecha: item.fecha,
        numero_factura: item.numero_factura,
        proveedor: item.proveedor,
        categoria: item.categoria,
        nombre_insumo: item.nombre_insumo,
        detalle: item.detalle,
        cantidad: item.cantidad,
        unidad: item.unidad,
        costo_unitario: item.costo_unitario,
        valor_compra: item.valor_compra,
        cantidad_kg: item.cantidad,
        costo_unitario_kg: item.costo_unitario,
        costo_total: item.valor_compra,
        origen: item.origen,
        observaciones: item.observaciones,
      };
    });

    const { error: errD } = await supabase.from('compras_detalle').insert(detailPayload);
    if (errD) {
      console.error(`Error insertando detalles para factura ${inv.numero_factura}:`, errD.message);
    } else {
      itemsInsertados += detailPayload.length;
    }
  }

  console.log(`\n✅ Inserción de compras completada:`);
  console.log(`   - Facturas insertadas: ${facturasInsertadas}`);
  console.log(`   - Ítems de compra insertados: ${itemsInsertados}`);
  console.log(`   - Total monetario: $${granTotalDinero.toLocaleString('es-CO')} COP`);

  // 5. Actualizar Precios del Catálogo con las Facturas Más Recientes
  console.log('\n🔄 Actualizando precios en Catálogo con las facturas más recientes...');
  const latestByItem = new Map();

  directRows.forEach((r) => {
    const item = String(r['Ítem']).trim();
    const dia = Number(r['Día']);
    const costo = Number(r['Costo Unitario'] || 0);
    const cat = mapCategory(r['Categoría']);
    const unidad = detectUnit(r['Descripción Original (PDF)'], cat, item);

    if (!latestByItem.has(item) || dia > latestByItem.get(item).dia) {
      latestByItem.set(item, { dia, costo, cat, unidad });
    }
  });

  let catalogUpdatedCount = 0;
  for (const [itemName, info] of latestByItem.entries()) {
    const norm = normalizeName(itemName);
    let match = catalogMap.get(norm);
    if (!match) {
      for (const [catNorm, catObj] of catalogMap.entries()) {
        if (catNorm.includes(norm) || norm.includes(catNorm)) {
          match = catObj;
          break;
        }
      }
    }

    if (match) {
      await supabase
        .from('catalogo_insumos')
        .update({
          costo_unitario_kg: info.costo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id);
      catalogUpdatedCount++;
    }
  }

  console.log(`✅ Insumos en catálogo actualizados a su última factura: ${catalogUpdatedCount}`);
  console.log('🎉 Migración y carga completada exitosamente.');
}

seedCompras();
