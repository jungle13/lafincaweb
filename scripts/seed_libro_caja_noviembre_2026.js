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
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function extractResponsable(desc, soporte) {
  const text = `${desc || ''} ${soporte || ''}`.toUpperCase();
  if (text.includes('JOHANNA') || text.includes('JHIOANA')) return 'JOHANNA';
  if (text.includes('MARIA') || text.includes('MARÍA')) return 'MARIA';
  if (text.includes('DANIELA')) return 'DANIELA';
  if (text.includes('NEYMAR')) return 'NEYMAR';
  if (text.includes('ANTONIO')) return 'ANTONIO';
  if (text.includes('PRINCIPAL')) return 'JOHANNA';
  return 'ADMINISTRADOR';
}

function getCajaNombre(responsable) {
  const r = (responsable || '').toUpperCase();
  if (r.includes('JOHANNA') || r.includes('NEYMAR') || r.includes('ANTONIO') || r.includes('ADMINISTRADOR')) {
    return 'CAJA 1 (PRINCIPAL)';
  }
  return 'CAJA 2 (DOMICILIOS)';
}

async function seedLibroCaja() {
  console.log('====================================================');
  console.log('💼 IMPORTANDO LIBRO DE CAJA MENOR - NOVIEMBRE 2026');
  console.log('====================================================\n');

  const excelPath = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/NOVIEMBRE 2026/COSTOS_GASTOS_NOVIEMBRE_2026.xlsx';
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets['Consolidado Libro de Caja'];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // 1. Limpiar registros previos de noviembre 2026
  console.log('🧹 Limpiando registros anteriores de caja menor de Noviembre 2026...');
  await supabase.from('libro_caja_registros').delete().eq('periodo_id', 'per-2026-11');
  await supabase.from('libro_caja_diario').delete().eq('periodo_id', 'per-2026-11');

  // 2. Extraer Sección 1: Días 1 al 30 (filas 13 a 42 en 1-based -> índice 12 a 41 en 0-based)
  console.log('📅 Procesando Resumen Diario (Días 1 al 30)...');
  const dailyInserts = [];

  for (let r = 12; r <= 41; r++) {
    const row = data[r];
    if (!row || !row[1]) continue;

    const diaNum = r - 11;
    const fecha = `2026-11-${String(diaNum).padStart(2, '0')}`;
    const insumos = Number(row[2] || 0);
    const gastos = Number(row[3] || 0);
    const turnos = Number(row[4] || 0);
    const totalSalidas = Number(row[5] || 0);

    dailyInserts.push({
      fecha,
      dia_mes: diaNum,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: 'per-2026-11',
      base_inicial: 500000,
      total_costos_insumos: insumos,
      total_gastos_operativos: gastos,
      total_turnos_nomina: turnos,
      total_salidas: totalSalidas,
      responsables_dia: totalSalidas > 0 ? 'Principal (Johanna) + Domicilios (María/Daniela)' : 'Sin Movimientos',
      estado: totalSalidas > 0 ? 'CERRADA' : 'ABIERTA',
      observaciones: totalSalidas > 0 ? 'Consolidado oficial Libro de Caja Noviembre 2026' : 'Día proyectado sin salidas',
    });
  }

  const { error: errDaily } = await supabase.from('libro_caja_diario').insert(dailyInserts);
  if (errDaily) {
    console.error('Error insertando libro_caja_diario:', errDaily.message);
    return;
  }
  console.log(`✅ Hojas diarias insertadas en libro_caja_diario: ${dailyInserts.length}`);

  // 3. Extraer Sección 2: 108 Registros Detallados
  console.log('\n📝 Procesando Registros Detallados Ítem por Ítem...');
  const itemInserts = [];
  let orden = 1;

  for (const row of data) {
    if (!row || typeof row[1] !== 'number' || !row[3]) continue;
    const clasifStr = String(row[3]);
    if (!clasifStr.includes('Costo') && !clasifStr.includes('Gasto') && !clasifStr.includes('Turno')) continue;

    const diaNum = Number(row[1]);
    const fecha = `2026-11-${String(diaNum).padStart(2, '0')}`;
    const clasificacion = clasifStr.trim();
    const categoria = String(row[4] || '').trim();
    const concepto = String(row[5] || '').trim();
    const descripcion = String(row[6] || '').trim();
    const valor = Number(row[7] || 0);
    const soporte = String(row[8] || 'Recibo Caja Menor').trim();
    const proveedor = String(row[9] || 'Proveedor Local').trim();

    const responsable = extractResponsable(descripcion, soporte);
    const cajaNombre = getCajaNombre(responsable);

    itemInserts.push({
      fecha,
      dia_mes: diaNum,
      orden_item: orden++,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: 'per-2026-11',
      clasificacion,
      categoria,
      concepto,
      descripcion_beneficiario: descripcion,
      valor_pagado: valor,
      soporte_factura: soporte,
      responsable_caja: responsable,
      caja_nombre: cajaNombre,
      proveedor_fuente: proveedor,
      usuario_registro: responsable,
      es_ajuste: false,
    });
  }

  console.log(`📦 Total registros detallados a insertar: ${itemInserts.length}`);

  // Insertar en lotes de 50
  for (let i = 0; i < itemInserts.length; i += 50) {
    const batch = itemInserts.slice(i, i + 50);
    const { error: errBatch } = await supabase.from('libro_caja_registros').insert(batch);
    if (errBatch) {
      console.error(`Error insertando lote de registros (${i} - ${i + batch.length}):`, errBatch.message);
      return;
    }
  }

  const grandTotal = itemInserts.reduce((acc, it) => acc + it.valor_pagado, 0);

  console.log('\n====================================================');
  console.log('✅ LIBRO DE CAJA MENOR SINCRONIZADO CON ÉXITO');
  console.log(`📅 Hojas diarias creadas: ${dailyInserts.length}`);
  console.log(`📝 Salidas registradas: ${itemInserts.length}`);
  console.log(`💰 Gran Total Salidas de Caja Noviembre: $${grandTotal.toLocaleString('es-CO')} COP`);
  console.log('====================================================\n');
}

seedLibroCaja();
