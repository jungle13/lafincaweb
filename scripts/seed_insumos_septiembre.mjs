import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function extractProvider(desc, item) {
  if (!desc && !item) return 'Proveedor Directo / General';
  const descStr = String(desc || item).trim();

  // Pattern: (Provider - Invoice) or (Provider Invoice)
  const match = descStr.match(/\((.*?)\)/);
  if (match) {
    const inside = match[1].trim();
    const parts = inside.split(' - ');
    let p = parts[0].trim();
    p = p.replace(/^Factura\s+/i, '')
         .replace(/^Remisi[oó]n\s+/i, '')
         .replace(/^Cuenta de Cobro\s+/i, '')
         .trim();
    if (p.length > 1) return p;
  }

  // Common fallbacks based on item or desc
  if (/pezuña|cerdo|chicharr[oó]n|costilla/i.test(item)) return 'Supertiendas Cañaveral / Carnes';
  if (/bagre|trucha|pescado|salm[oó]n|marisco|tilapia/i.test(item)) return 'Frio Sabor / Gabriel Ramirez';
  if (/cerveza|corona|poker|aguila|club colombia/i.test(item)) return 'Global Liquors / Bavaria';
  if (/coca|gaseosa|agua cristal/i.test(item)) return 'Coca-Cola FEMSA';
  if (/chucho/i.test(item) || /chucho/i.test(descStr)) return 'Verduras Chucho';
  if (/piamonte/i.test(item) || /piamonte/i.test(descStr)) return 'Granero Piamonte';
  if (/alpina/i.test(item) || /alpina/i.test(descStr)) return 'Alpina';
  if (/zenu/i.test(item) || /zenu/i.test(descStr)) return 'Zenú';
  if (/alkosto/i.test(item) || /alkosto/i.test(descStr)) return 'Alkosto';
  if (/eliana/i.test(item) || /eliana/i.test(descStr)) return 'Eliana Murillo Hincapie';
  if (/contadora/i.test(item) || /contadora/i.test(descStr)) return 'Contadora';

  return 'Proveedor General / Local';
}

function classifySubmodule(categoria, item, desc) {
  const cat = (categoria || '').trim();
  const it = (item || '').trim().toLowerCase();
  const ds = (desc || '').trim().toLowerCase();

  const opexCategories = [
    'Servicios',
    'Mantenimiento',
    'Gastos Administrativos',
    'Gastos',
    'Servicios Públicos',
    'Transporte',
    'Nómina'
  ];

  const isOpex = opexCategories.includes(cat);
  const tipo_contable = isOpex ? 'GASTO_OPERATIVO' : 'COSTO_DIRECTO';

  let submodulo = 'SERVICIOS_GENERALES';

  if (cat === 'Carnes') {
    submodulo = 'CARNES';
  } else if (cat === 'Bebidas') {
    submodulo = 'BEBIDAS';
  } else if (cat === 'Desechables') {
    submodulo = 'DESECHABLES';
  } else if (cat === 'Verduras' || cat === 'Grano' || cat === 'Abarrotes' || cat === 'Insumos' || cat === 'Aseo') {
    submodulo = 'COCINA_VERDURAS_GRANO';
  } else if (cat === 'INVENTARIO INICIAL') {
    submodulo = 'INVENTARIO_INICIAL';
  } else if (cat === 'Nómina') {
    submodulo = 'NOMINA';
  } else if (cat === 'Servicios Públicos') {
    submodulo = 'SERVICIOS_PUBLICOS';
  } else if (cat === 'Servicios') {
    if (it.includes('arriendo') || ds.includes('arriendo')) {
      submodulo = 'ARRENDAMIENTO';
    } else if (
      /turno|andres|sebastian|wilson|diego|eliana|contadora|vigilancia|n[oó]mina|incentivo/i.test(it) ||
      /turno|andres|sebastian|wilson|diego|eliana|contadora|vigilancia|n[oó]mina|incentivo/i.test(ds)
    ) {
      submodulo = 'NOMINA';
    } else if (
      /software|energia|agua|gas|epm|emcali|servicios p[uú]blicos|internet|tv/i.test(it) ||
      /software|energia|agua|gas|epm|emcali|servicios p[uú]blicos|internet|tv/i.test(ds)
    ) {
      submodulo = 'SERVICIOS_PUBLICOS';
    } else {
      submodulo = 'SERVICIOS_GENERALES';
    }
  } else {
    submodulo = 'SERVICIOS_GENERALES';
  }

  return { submodulo, tipo_contable };
}

async function seed() {
  const excelPath = path.resolve(__dirname, '../DOCUMENTOS BASE/COSTOS_GASTOS_SEPTIEMBRE_2026.xlsx');
  console.log('Abriendo archivo Excel:', excelPath);

  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Detalle Compras Septiembre 2026'];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`Filas brutas en hoja: ${rawRows.length}`);

  const records = [];
  let totalVr = 0;
  let directCost = 0;
  let operatingExp = 0;

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const diaVal = row[0];
    const catVal = row[1];
    const itemVal = row[2];
    const descVal = row[3];
    const cantVal = row[4];
    const costoVal = row[5];
    const vrVal = row[6];
    const facVal = row[7];
    const cruceVal = row[8];

    if (!catVal && !vrVal) continue;

    const diaNum = parseInt(diaVal) || 1;
    const diaFormatted = diaNum < 10 ? `0${diaNum}` : `${diaNum}`;
    const fecha = `2026-09-${diaFormatted}`;

    const valorTotal = parseFloat(vrVal) || 0;
    const cantidad = parseFloat(cantVal) || 0;
    const costoUnitario = parseFloat(costoVal) || 0;
    const categoria = String(catVal || 'Servicios').trim();
    const item = String(itemVal || descVal || 'Gasto General').trim();
    const descripcionOriginal = descVal ? String(descVal).trim() : item;
    const numeroFactura = facVal ? String(facVal).trim() : 'SIN_COMPROBANTE';
    const relacionCuaderno = cruceVal ? String(cruceVal).trim() : 'No Cruza con Cuaderno Don Arturo';

    const proveedor = extractProvider(descripcionOriginal, item);
    const { submodulo, tipo_contable } = classifySubmodule(categoria, item, descripcionOriginal);

    totalVr += valorTotal;
    if (tipo_contable === 'COSTO_DIRECTO') directCost += valorTotal;
    else operatingExp += valorTotal;

    records.push({
      periodo_id: 'per-2026-09',
      fecha,
      dia: diaNum,
      categoria,
      submodulo,
      tipo_contable,
      item,
      descripcion_original: descripcionOriginal,
      proveedor,
      cantidad,
      costo_unitario: costoUnitario,
      valor_total: valorTotal,
      numero_factura: numeroFactura,
      relacion_cuaderno: relacionCuaderno,
      observacion: `Importado de Detalle Compras Septiembre 2026 (Fila Excel ${i + 1})`
    });
  }

  console.log(`Transacciones parseadas: ${records.length}`);
  console.log(`Total Valor Compra: $${totalVr.toLocaleString('es-CO')}`);
  console.log(`Costos Directos: $${directCost.toLocaleString('es-CO')}`);
  console.log(`Gastos Operativos: $${operatingExp.toLocaleString('es-CO')}`);

  // Limpiar registros existentes del periodo para evitar duplicación
  console.log('Limpiando registros previos de per-2026-09...');
  const { error: delErr } = await supabase
    .from('transacciones_gastos_insumos')
    .delete()
    .eq('periodo_id', 'per-2026-09');

  if (delErr) {
    console.warn('Aviso limpiando transacciones previas:', delErr.message);
  }

  // Inserción en lotes de 100
  console.log('Insertando registros en lotes de 100 en Supabase...');
  for (let b = 0; b < records.length; b += 100) {
    const batch = records.slice(b, b + 100);
    const { error: insErr } = await supabase
      .from('transacciones_gastos_insumos')
      .insert(batch);

    if (insErr) {
      console.error(`Error en lote ${b}..${b + batch.length}:`, insErr);
      process.exit(1);
    }
    console.log(`  ✓ Insertados ${b + batch.length} de ${records.length}`);
  }

  console.log('✅ Ingesta finalizada con éxito en Supabase!');
}

seed().catch((err) => {
  console.error('Error fatal en seed:', err);
  process.exit(1);
});
