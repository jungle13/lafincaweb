import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normStr(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  console.log('====================================================================');
  console.log('🍽️ IMPORTANDO CONTROL OFICIAL DE CONSUMOS INTERNOS (NOVIEMBRE 2026)');
  console.log('====================================================================\n');

  const excelPath = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/NOVIEMBRE 2026/CONTROL_CONSUMO_INTERNO_NOVIEMBRE_2026.xlsx';
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Archivo no encontrado en ${excelPath}`);
  }

  // 1. Cargar catálogo de insumos
  const { data: catalogInsumos, error: catErr } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, costo_unitario_kg');

  if (catErr) {
    throw new Error(`Error cargando catálogo: ${catErr.message}`);
  }
  console.log(`📚 Catálogo cargado: ${catalogInsumos.length} insumos.`);

  const catalogNormMap = new Map();
  catalogInsumos.forEach(c => catalogNormMap.set(normStr(c.nombre), c));

  function findCatalogMatch(name) {
    const n = normStr(name);
    if (catalogNormMap.has(n)) return catalogNormMap.get(n);
    for (const [cNorm, cObj] of catalogNormMap.entries()) {
      if ((cNorm.length > 4 && n.includes(cNorm)) || (n.length > 4 && cNorm.includes(n))) {
        return cObj;
      }
    }
    // Casos específicos conocidos
    if (n.includes('huevo')) {
      const h = catalogInsumos.find(c => normStr(c.nombre).includes('huevo'));
      if (h) return h;
    }
    if (n.includes('chicha') || n.includes('chicharron')) {
      const c = catalogInsumos.find(c => normStr(c.nombre).includes('tocino') || normStr(c.nombre).includes('chicharron'));
      if (c) return c;
    }
    if (n.includes('cost cerdo')) {
      const c = catalogInsumos.find(c => normStr(c.nombre).includes('costilla') && normStr(c.nombre).includes('cerdo'));
      if (c) return c;
    }
    if (n.includes('chorizo paisa')) {
      const c = catalogInsumos.find(c => normStr(c.nombre).includes('chorizo paisa'));
      if (c) return c;
    }
    if (n.includes('gaseosa 3')) {
      const c = catalogInsumos.find(c => normStr(c.nombre).includes('gaseosa 3'));
      if (c) return c;
    }
    if (n.includes('gatorade')) {
      const c = catalogInsumos.find(c => normStr(c.nombre).includes('gatorade'));
      if (c) return c;
    }
    return null;
  }

  // 2. Leer archivo Excel
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets['Consumos Diarios Noviembre 2026'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const consumosItems = [];

  for (let i = 24; i <= 43; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;

    const num = Number(r[0]);
    const dia = Number(r[1]);
    const fechaRaw = String(r[2]).trim(); // DD/MM/YYYY
    const [dd, mm, yyyy] = fechaRaw.split('/');
    const fecha = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;

    const codPos = String(r[3] || '').trim();
    const catExcel = String(r[4] || 'Consumos Internos').trim();
    const prodExcel = String(r[5] || '').trim();
    const cant = Number(r[6] || 0);
    const und = String(r[7] || 'Und').trim();
    const vCarta = Number(r[8] || 0);
    const vFacturado = Number(r[9] || 0);
    const costoUnit = Number(r[10] || 0);
    const costoTot = Number(r[11] || (cant * costoUnit));
    const obsBase = String(r[12] || 'Mesa Consumo - Cortesía ($0)').trim();

    const catMatch = findCatalogMatch(prodExcel);
    const obsCompleta = `${obsBase} • Cód POS: ${codPos} • Valor Carta: $${vCarta.toLocaleString('es-CO')} COP`;

    consumosItems.push({
      fecha,
      tipo: 'CONSUMO',
      insumo_id: catMatch ? catMatch.id : null,
      nombre_insumo: prodExcel,
      categoria: catExcel,
      cantidad: cant,
      unidad: und,
      costo_unitario: costoUnit,
      valor_total: costoTot,
      observaciones: obsCompleta
    });
  }

  console.log(`📋 Total consumos extraídos del Excel: ${consumosItems.length}`);
  const totalCostoConsumos = consumosItems.reduce((acc, it) => acc + it.valor_total, 0);
  console.log(`💰 Costo total de consumos internos: $${totalCostoConsumos.toLocaleString('es-CO')} COP\n`);

  // 3. Limpiar consumos anteriores en registros_costeo_cocina para Noviembre 2026
  console.log('🧹 Limpiando registros de tipo CONSUMO anteriores en Noviembre 2026...');
  const { error: delErr } = await supabase
    .from('registros_costeo_cocina')
    .delete()
    .gte('fecha', '2026-11-01')
    .lte('fecha', '2026-11-30')
    .eq('tipo', 'CONSUMO');

  if (delErr) {
    throw new Error(`Error limpiando consumos anteriores: ${delErr.message}`);
  }

  // 4. Insertar los nuevos consumos
  console.log('📥 Insertando los 20 consumos oficiales...');
  const { error: insErr } = await supabase
    .from('registros_costeo_cocina')
    .insert(consumosItems);

  if (insErr) {
    throw new Error(`Error insertando consumos: ${insErr.message}`);
  }
  console.log('✅ Consumos insertados exitosamente en registros_costeo_cocina.\n');

  // 5. Sincronizar todas las hojas de costeo diario de Noviembre (Días 1 al 11)
  console.log('🔄 Sincronizando hojas de costeo diario con rpc_sync_costeo_diario...');
  const diasNoviembre = [
    '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
    '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'
  ];

  for (const f of diasNoviembre) {
    const { data: res, error: rpcErr } = await supabase.rpc('rpc_sync_costeo_diario', {
      p_fecha: f
    });
    if (rpcErr) {
      console.error(`Error en rpc_sync_costeo_diario para ${f}:`, rpcErr.message);
    } else {
      console.log(`✅ ${f}: Consumo Interno: $${Number(res.costo_consumos || 0).toLocaleString('es-CO')} | Consumo Real: $${Number(res.consumo_real || 0).toLocaleString('es-CO')} | FC: ${res.food_cost_porcentaje}%`);
    }
  }

  // 6. Resumen final en costeo_diario
  console.log('\n📊 ESTADO FINAL DE COSTEO DIARIO NOVIEMBRE 2026:');
  const { data: cds } = await supabase
    .from('costeo_diario')
    .select('fecha, pos_sales, costo_bruto, costo_apertura, costo_cierre, costo_consumos, consumo_real, food_cost_porcentaje')
    .gte('fecha', '2026-11-01')
    .lte('fecha', '2026-11-11')
    .order('fecha', { ascending: true });

  console.table(cds);

  console.log('\n====================================================================');
  console.log('🎉 CONSUMOS DE NOVIEMBRE ACTUALIZADOS Y SINCRONIZADOS EXITOSAMENTE');
  console.log('====================================================================\n');
}

run().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
