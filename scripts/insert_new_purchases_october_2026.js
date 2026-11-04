const fs = require('fs');
const XLSX = require('xlsx');
const crypto = require('crypto');

// Cargar variables de entorno
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k] = v.join('=');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const excelPath = 'C:\\Users\\USUARIO\\Desktop\\Proyectos\\Costos_Finca\\OCTUBRE 2026\\COSTOS_GASTOS_OCTUBRE_2026.xlsx';
const wb = XLSX.readFile(excelPath);
const sheet = wb.Sheets['Detalle Compras Octubre 2026'];
const excelRows = XLSX.utils.sheet_to_json(sheet);

function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapCategory(excelCat) {
  if (excelCat === 'Carnes') return 'Carnes y Proteínas';
  if (excelCat === 'Verduras') return 'Verduras y Frutas';
  if (excelCat === 'Desechables') return 'Desechables y Empaques';
  if (excelCat === 'Grano') return 'Granos y Harinas';
  if (excelCat === 'Bebidas') return 'Bebidas y Licores';
  if (['Insumos', 'Servicios', 'Aseo'].includes(excelCat)) return 'Otros Insumos y Servicios';
  if (excelCat === 'Gastos Servicios Publicos') return 'Gastos Servicios Públicos';
  if (excelCat === 'Gastos GIT Organizacional') return 'Gastos GIT Organizacional';
  if (excelCat === 'Gastos Nómina' || excelCat === 'Gastos Nomina') return 'Gastos Nómina';
  if (excelCat === 'Gastos Arrendamientos') return 'Gastos Arrendamientos';
  if (excelCat === 'Gastos Mantenimiento') return 'Gastos Mantenimiento';
  if (excelCat === 'Gastos Generales') return 'Gastos Generales';
  return excelCat || 'Otros Insumos y Servicios';
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

async function main() {
  console.log('=== INICIANDO INSERCIÓN DE FACTURAS NUEVAS DE DETALLE COMPRAS ===\n');

  // 1. Cargar catálogo de insumos
  const { data: catalog, error: errCat } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria');
  if (errCat) throw errCat;

  const catalogMap = new Map();
  catalog.forEach(c => {
    catalogMap.set(normalizeName(c.nombre), c);
  });

  // Mapeos explícitos para insumos con variaciones de nombre
  const explicitInsumoMap = {
    [normalizeName('Costilla de cerdo especial')]: 'CAR-017',
    [normalizeName('Café x libra')]: 'DIR-023',
    [normalizeName('Gaseosa 350 ml Vidrio')]: 'DIR-065',
    [normalizeName('H2OH! Sabores')]: 'BEB-102',
    [normalizeName('Agua Cristal / Brisa 600 ml')]: 'DIR-057',
    [normalizeName('Gatorade Sabores')]: 'BEB-104',
    [normalizeName('Gaseosas Varias')]: 'DIR-072',
    [normalizeName('Gaseosa 1.5 L PET')]: 'DIR-074',
    [normalizeName('Jugo Hit Sabores')]: 'BEB-108',
    [normalizeName('Inmunocal')]: 'CAR-303'
  };

  const codeToIdMap = new Map();
  catalog.forEach(c => {
    codeToIdMap.set(c.codigo, c.id);
  });

  // 2. Limpiar registro temporal anterior de Inmunocal (Inmunocal-001) para sustituirlo por el oficial de Excel
  console.log('🧹 Limpiando registro anterior de Inmunocal-001...');
  const { data: oldInmunocal } = await supabase
    .from('compras')
    .select('id')
    .ilike('numero_factura', 'Inmunocal-001');

  if (oldInmunocal && oldInmunocal.length > 0) {
    for (const old of oldInmunocal) {
      await supabase.from('compras_detalle').delete().eq('compra_id', old.id);
      await supabase.from('compras').delete().eq('id', old.id);
    }
    console.log(`✓ Eliminados ${oldInmunocal.length} registros anteriores de Inmunocal-001.`);
  }

  // 3. Consultar compras actuales en BD
  const { data: dbCompras } = await supabase.from('compras').select('id, numero_factura, valor_total, total_items');
  const facturasEnBdMap = new Map();
  dbCompras.forEach(c => {
    facturasEnBdMap.set(String(c.numero_factura || '').trim().toUpperCase(), c);
  });

  // 4. Identificar facturas nuevas e ítems faltantes
  const facturasNuevasMap = new Map();
  let missingItemDonaMary = null;

  excelRows.forEach((r, idx) => {
    const rawFac = String(r['N° Comprobante / Factura'] || '').trim();
    const facKey = rawFac.toUpperCase();
    if (!facKey) return;

    // Caso especial: Papelería de Doña Mary en FE. 19957
    if (facKey === 'FE. 19957' && String(r['Ítem']).includes('Papelería')) {
      missingItemDonaMary = {
        rowIndex: idx + 2,
        ...r
      };
      return;
    }

    if (!facturasEnBdMap.has(facKey)) {
      if (!facturasNuevasMap.has(facKey)) {
        facturasNuevasMap.set(facKey, {
          numero_factura: rawFac,
          dia: Number(r['Día']),
          fecha: `2026-10-${String(r['Día']).padStart(2, '0')}`,
          proveedor: String(r['Proveedor'] || 'Proveedor General').trim(),
          categoria_excel: String(r['Categoría'] || '').trim(),
          relacion_cuaderno: String(r['Relación con el Cuaderno'] || '').trim(),
          archivo_pdf: String(r['Archivo PDF'] || '').trim(),
          items: []
        });
      }
      facturasNuevasMap.get(facKey).items.push({
        rowIndex: idx + 2,
        item: String(r['Ítem'] || '').trim(),
        descripcion_pdf: String(r['Descripción Original (PDF)'] || '').trim(),
        cantidad: Number(r['Cantidad'] || 1),
        costo_unitario: Number(r['Costo Unitario'] || 0),
        vr_compra: Number(r['Vr. Compra'] || 0),
        detalle: String(r['Detalle'] || '').trim(),
        categoria_excel: String(r['Categoría'] || '').trim()
      });
    }
  });

  console.log(`📦 Facturas nuevas a insertar en 'compras': ${facturasNuevasMap.size}`);

  // 5. Insertar cada factura nueva y sus líneas de detalle
  let totalFacturasInsertadas = 0;
  let totalLineasInsertadas = 0;
  let totalDineroFacturas = 0;

  for (const [facKey, fData] of facturasNuevasMap.entries()) {
    const compraId = crypto.randomUUID();
    const targetPeriodo = 'per-2026-10';
    const subtotalFactura = fData.items.reduce((s, it) => s + it.vr_compra, 0);
    const mainCategory = mapCategory(fData.categoria_excel);

    // A. Insertar cabecera en public.compras
    const { error: errCompra } = await supabase
      .from('compras')
      .insert({
        id: compraId,
        fecha: fData.fecha,
        numero_factura: fData.numero_factura,
        proveedor: fData.proveedor,
        valor_total: subtotalFactura,
        observaciones: fData.relacion_cuaderno || null,
        usuario: 'Facturación / Costeo',
        periodo_id: targetPeriodo,
        origen: fData.archivo_pdf || 'Factura Electrónica',
        categoria: mainCategory,
        total_items: fData.items.length
      });

    if (errCompra) {
      console.error(`Error insertando compra ${fData.numero_factura}:`, errCompra);
      throw errCompra;
    }

    // B. Preparar líneas para public.compras_detalle
    const lineasToInsert = fData.items.map(it => {
      const lineCategory = mapCategory(it.categoria_excel);
      const normName = normalizeName(it.item);
      const explicitCode = explicitInsumoMap[normName];
      let insumoId = null;

      if (explicitCode && codeToIdMap.has(explicitCode)) {
        insumoId = codeToIdMap.get(explicitCode);
      } else if (catalogMap.has(normName)) {
        insumoId = catalogMap.get(normName).id;
      }

      const detectedUnit = detectUnit(it.descripcion_pdf, lineCategory, it.item);

      return {
        id: crypto.randomUUID(),
        compra_id: compraId,
        insumo_id: insumoId,
        fecha: fData.fecha,
        numero_factura: fData.numero_factura,
        proveedor: fData.proveedor,
        categoria: lineCategory,
        nombre_insumo: it.item,
        detalle: it.descripcion_pdf || it.detalle || it.item,
        cantidad: it.cantidad,
        cantidad_kg: detectedUnit === 'Kg' ? it.cantidad : it.cantidad,
        unidad: detectedUnit,
        costo_unitario: it.costo_unitario,
        costo_unitario_kg: it.costo_unitario,
        valor_compra: it.vr_compra,
        costo_total: it.vr_compra,
        origen: fData.archivo_pdf || 'Factura Electrónica',
        observaciones: fData.relacion_cuaderno || null,
        periodo_id: targetPeriodo
      };
    });

    const { error: errDetalles } = await supabase
      .from('compras_detalle')
      .insert(lineasToInsert);

    if (errDetalles) {
      console.error(`Error insertando compras_detalle para ${fData.numero_factura}:`, errDetalles);
      throw errDetalles;
    }

    totalFacturasInsertadas++;
    totalLineasInsertadas += lineasToInsert.length;
    totalDineroFacturas += subtotalFactura;
    console.log(`✓ Insertada Factura "${fData.numero_factura}" (${fData.fecha}) | Prov: ${fData.proveedor} | Items: ${lineasToInsert.length} | Total: $${subtotalFactura.toLocaleString('es-CO')}`);
  }

  // 6. Si faltaba el ítem de papelería en FE. 19957, insertarlo y actualizar la cabecera
  if (missingItemDonaMary) {
    console.log('\n📝 Agregando ítem faltante de Papelería a factura FE. 19957...');
    const donaMaryCompra = facturasEnBdMap.get('FE. 19957');
    if (donaMaryCompra) {
      const newLine = {
        id: crypto.randomUUID(),
        compra_id: donaMaryCompra.id,
        insumo_id: null,
        fecha: '2026-10-30',
        numero_factura: 'FE. 19957',
        proveedor: 'TIENDAS Y ABARROTES LOS DESECHABLES DOÑA MARY SAS',
        categoria: 'Gastos Generales',
        nombre_insumo: 'Papelería e Impresos',
        detalle: 'FACTURACION ELECTRONICA Y PAPELERIA (1 und @ $22.000)',
        cantidad: 1,
        cantidad_kg: 1,
        unidad: 'Und',
        costo_unitario: 22000,
        costo_unitario_kg: 22000,
        valor_compra: 22000,
        costo_total: 22000,
        origen: 'CamScanner 30-10-2026 18.46.pdf',
        observaciones: 'Factura Electrónica',
        periodo_id: 'per-2026-10'
      };

      await supabase.from('compras_detalle').insert(newLine);
      await supabase
        .from('compras')
        .update({
          valor_total: Number(donaMaryCompra.valor_total || 0) + 22000,
          total_items: Number(donaMaryCompra.total_items || 0) + 1
        })
        .eq('id', donaMaryCompra.id);

      totalLineasInsertadas++;
      console.log('✓ Ítem de Papelería e Impresos ($22.000) agregado a FE. 19957 exitosamente.');
    }
  }

  // 7. Verificación final de integridad y cuadre en Supabase
  console.log('\n====================================================');
  console.log('📊 VERIFICACIÓN Y AUDITORÍA FINAL POST-INSERCIÓN:');
  console.log('====================================================');

  const { data: finalCompras } = await supabase
    .from('compras')
    .select('id, numero_factura, valor_total, categoria')
    .eq('periodo_id', 'per-2026-10');

  const { data: finalDetalles } = await supabase
    .from('compras_detalle')
    .select('id, categoria, valor_compra')
    .eq('periodo_id', 'per-2026-10');

  const directCategories = [
    'Carnes y Proteínas',
    'Verduras y Frutas',
    'Granos y Harinas',
    'Desechables y Empaques',
    'Bebidas y Licores',
    'Otros Insumos y Servicios'
  ];

  let directSum = 0;
  let directCount = 0;
  let gastosSum = 0;
  let gastosCount = 0;

  finalDetalles.forEach(d => {
    const val = Number(d.valor_compra || 0);
    if (directCategories.includes(d.categoria)) {
      directSum += val;
      directCount++;
    } else {
      gastosSum += val;
      gastosCount++;
    }
  });

  console.log(`- Total Facturas en tabla 'compras': ${finalCompras.length}`);
  console.log(`- Total Líneas en tabla 'compras_detalle': ${finalDetalles.length} (Objetivo Excel: 798 filas)`);
  console.log(`- Total Costos Directos (Materia Prima): ${directCount} ítems | $${directSum.toLocaleString('es-CO')} (Objetivo Excel Dashboard: $105.703.012)`);
  console.log(`- Total Gastos Operacionales: ${gastosCount} ítems | $${gastosSum.toLocaleString('es-CO')} (Objetivo Excel Dashboard: $62.747.181)`);
  console.log(`- Gran Total Detalle Compras: $${(directSum + gastosSum).toLocaleString('es-CO')} (Objetivo Excel: $168.450.193)`);
}

main().catch(console.error);
