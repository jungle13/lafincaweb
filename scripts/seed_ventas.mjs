import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function formatISODate(dateVal, diaNum) {
  if (dateVal) {
    const s = String(dateVal).trim();
    // Format DD/MM/YYYY
    const parts = s.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }
  }
  const d = diaNum < 10 ? `0${diaNum}` : `${diaNum}`;
  return `2026-09-${d}`;
}

async function seedVentas() {
  const excelPath = path.resolve(__dirname, '../DOCUMENTOS BASE/COSTOS_GASTOS_SEPTIEMBRE_2026.xlsx');
  console.log('--- Iniciando Ingesta de Ventas desde Excel:', excelPath);

  const workbook = XLSX.readFile(excelPath);

  // 1. Parsear Detalle Ventas Septiembre 2026
  const sheetDetalle = workbook.Sheets['Detalle Ventas Septiembre 2026'];
  const rawDetalle = XLSX.utils.sheet_to_json(sheetDetalle, { header: 1 });
  console.log(`Filas brutas en Detalle Ventas: ${rawDetalle.length}`);

  const ventasDetalleRows = [];
  const platosMap = new Map();
  const dayDistinctDishes = new Map(); // fecha -> Set(codigos)
  const dayDescuentos = new Map(); // fecha -> totalDescuentos

  for (let i = 1; i < rawDetalle.length; i++) {
    const row = rawDetalle[i];
    if (!row || row.length === 0) continue;

    const diaVal = row[0];
    const fechaVal = row[1];
    const codVal = row[2];
    const catVal = row[3];
    const prodVal = row[4];
    const undVal = row[5];
    const cantVal = row[6];
    const prNetoVal = row[7];
    const vBrutaVal = row[8];
    const descVal = row[9];
    const vNetaVal = row[10];
    const impVal = row[11];
    const granTotVal = row[12];
    const pctVal = row[13];

    if (diaVal === undefined || !prodVal) continue;

    const diaNum = parseInt(diaVal) || 1;
    const fechaISO = formatISODate(fechaVal, diaNum);
    const codigo = String(codVal || '').trim();
    const nombre = String(prodVal || '').trim();
    const categoria = String(catVal || 'Platos Fuertes / Carnes').trim();
    const unidad = String(undVal || 'ud').trim().toLowerCase();

    const cant = parseFloat(cantVal) || 0;
    const valorUnitario = parseFloat(prNetoVal) || 0;
    const ventaBruta = parseFloat(vBrutaVal) || 0;
    const descuento = parseFloat(descVal) || 0;
    const ventaNeta = parseFloat(vNetaVal) || 0;
    const impuesto = parseFloat(impVal) || 0;
    const granTotal = parseFloat(granTotVal) || 0;
    const porcentaje = typeof pctVal === 'number' ? pctVal * 100 : parseFloat(pctVal) || 0;

    ventasDetalleRows.push({
      periodo_id: 'per-2026-09',
      fecha: fechaISO,
      archivo_origen: 'COSTOS_GASTOS_SEPTIEMBRE_2026.xlsx',
      codigo_producto: codigo,
      nombre_producto: nombre,
      categoria,
      unidad,
      cantidad: cant,
      venta_bruta: ventaBruta,
      descuento,
      venta_neta: ventaNeta,
      impuesto,
      gran_total: granTotal,
      valor_unitario: valorUnitario,
      porcentaje_dia: porcentaje
    });

    if (!dayDistinctDishes.has(fechaISO)) {
      dayDistinctDishes.set(fechaISO, new Set());
      dayDescuentos.set(fechaISO, 0);
    }
    dayDistinctDishes.get(fechaISO).add(codigo);
    dayDescuentos.set(fechaISO, dayDescuentos.get(fechaISO) + descuento);

    if (!platosMap.has(codigo)) {
      platosMap.set(codigo, {
        codigo,
        nombre,
        precio_venta: valorUnitario > 0 ? Math.round(valorUnitario * 1.08) : Math.round(granTotal / (cant || 1)),
        activo: true
      });
    }
  }

  // 2. Parsear Dashboard Ventas para los 20 días consolidados
  const sheetDashboard = workbook.Sheets['Dashboard Ventas'];
  const rawDashboard = XLSX.utils.sheet_to_json(sheetDashboard, { header: 1 });
  const ventasDiariasRows = [];

  // Filas en rawDashboard: índice 9 es Día 1 (01/09/2026), índice 28 es Día 20 (20/09/2026)
  for (let r = 9; r <= 28; r++) {
    const row = rawDashboard[r];
    if (!row) continue;

    const diaVal = row[1]; // Col B (Día)
    const fechaVal = row[2]; // Col C (Fecha)
    const articulosVal = row[3]; // Col D (Platos / Unid.)
    const ventaNetaVal = row[4]; // Col E (Venta Neta)
    const impuestoVal = row[5]; // Col F (Impoconsumo)
    const granTotalVal = row[6]; // Col G (Gran Total)
    const ticketVal = row[7]; // Col H (Ticket / Ítem)

    const diaNum = parseInt(diaVal);
    if (!diaNum || diaNum < 1 || diaNum > 20) continue;

    const fechaISO = formatISODate(fechaVal, diaNum);
    const dDate = new Date(fechaISO + 'T12:00:00Z');
    const diaSemana = DIAS_SEMANA[dDate.getUTCDay()];

    const articulos = parseFloat(articulosVal) || 0;
    const ventaNeta = parseFloat(ventaNetaVal) || 0;
    const impuesto = parseFloat(impuestoVal) || 0;
    const granTotal = parseFloat(granTotalVal) || 0;
    const ticket = parseFloat(ticketVal) || (articulos > 0 ? Math.round(granTotal / articulos) : 0);
    const desc = dayDescuentos.get(fechaISO) || 0;
    const ventaBruta = ventaNeta + desc;
    const distinctCount = dayDistinctDishes.has(fechaISO) ? dayDistinctDishes.get(fechaISO).size : 0;

    ventasDiariasRows.push({
      periodo_id: 'per-2026-09',
      fecha: fechaISO,
      archivo_origen: 'COSTOS_GASTOS_SEPTIEMBRE_2026.xlsx',
      dia_semana: diaSemana,
      total_articulos: articulos,
      venta_bruta: ventaBruta,
      descuento: desc,
      venta_neta: ventaNeta,
      impuesto: impuesto,
      gran_total: granTotal,
      total_platos_distintos: distinctCount,
      ticket_promedio: Math.round(ticket)
    });
  }

  console.log(`\nResumen preparado desde Excel:`);
  console.log(`- Días a insertar: ${ventasDiariasRows.length}`);
  console.log(`- Detalle a insertar: ${ventasDetalleRows.length}`);
  console.log(`- Platos únicos a insertar: ${platosMap.size}`);

  // Limpiar datos previos del periodo per-2026-09
  console.log('\nLimpiando ventas previas del periodo per-2026-09...');
  await supabase.from('ventas_detalle').delete().eq('periodo_id', 'per-2026-09');
  await supabase.from('ventas_diarias').delete().eq('periodo_id', 'per-2026-09');

  // 1. Insertar ventas_diarias
  console.log('Insertando ventas_diarias...');
  const { error: errDiarias } = await supabase.from('ventas_diarias').insert(ventasDiariasRows);
  if (errDiarias) {
    console.error('Error insertando ventas_diarias:', errDiarias);
    throw errDiarias;
  }
  console.log('✓ ventas_diarias insertadas con éxito.');

  // 2. Insertar ventas_detalle en lotes de 200
  console.log('Insertando ventas_detalle en lotes de 200...');
  const batchSize = 200;
  for (let i = 0; i < ventasDetalleRows.length; i += batchSize) {
    const chunk = ventasDetalleRows.slice(i, i + batchSize);
    const { error: errChunk } = await supabase.from('ventas_detalle').insert(chunk);
    if (errChunk) {
      console.error(`Error en lote ${i}-${i + batchSize}:`, errChunk);
      throw errChunk;
    }
    console.log(`  Insertados ${Math.min(i + batchSize, ventasDetalleRows.length)} / ${ventasDetalleRows.length}`);
  }
  console.log('✓ Todas las ventas_detalle insertadas con éxito.');

  // 3. Upsert catálogo de platos en public.platos
  console.log('Actualizando catálogo de platos en public.platos...');
  const platosArray = Array.from(platosMap.values());
  for (let i = 0; i < platosArray.length; i += batchSize) {
    const chunk = platosArray.slice(i, i + batchSize);
    const { error: errPlatos } = await supabase.from('platos').upsert(chunk, { onConflict: 'codigo' });
    if (errPlatos) {
      console.warn('Aviso insertando platos:', errPlatos.message);
    }
  }

  // 4. Verificación final de cuadre en Supabase
  const { data: checkDiarias } = await supabase
    .from('ventas_diarias')
    .select('gran_total, venta_neta, impuesto, total_articulos');
  const sumTotal = (checkDiarias || []).reduce((acc, r) => acc + parseFloat(r.gran_total || 0), 0);
  const sumNeta = (checkDiarias || []).reduce((acc, r) => acc + parseFloat(r.venta_neta || 0), 0);
  const sumImp = (checkDiarias || []).reduce((acc, r) => acc + parseFloat(r.impuesto || 0), 0);
  const sumArts = (checkDiarias || []).reduce((acc, r) => acc + parseFloat(r.total_articulos || 0), 0);

  console.log('\n=============================================');
  console.log('   RESULTADOS FINALES DE VENTAS EN SUPABASE:');
  console.log('=============================================');
  console.log(`- Días registrados: ${checkDiarias?.length}`);
  console.log(`- Total Artículos Vendidos: ${sumArts.toLocaleString('es-CO')}`);
  console.log(`- Venta Neta: $${sumNeta.toLocaleString('es-CO')}`);
  console.log(`- Impoconsumo (8%): $${sumImp.toLocaleString('es-CO')}`);
  console.log(`- GRAN TOTAL FACTURADO: $${sumTotal.toLocaleString('es-CO')}`);
  console.log('=============================================\n');
}

seedVentas().catch((err) => {
  console.error('Error fatal en seed ventas:', err);
  process.exit(1);
});
