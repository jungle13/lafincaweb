import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedCierresCaja() {
  const excelPath = path.resolve(__dirname, '../DOCUMENTOS BASE/COSTOS_GASTOS_SEPTIEMBRE_2026.xlsx');
  console.log('Abriendo archivo Excel:', excelPath);

  const workbook = XLSX.readFile(excelPath);
  const ws = workbook.Sheets['Auditoria libro de Caja'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const cierres = [];

  // 1. Sección 5.1: Filas 163 a 170 (Días 11 al 14 de Septiembre)
  for (let r = 163; r <= 170; r++) {
    const row = rows[r];
    if (!row || !row[1]) continue;

    const pagFecha = String(row[1]).trim();
    const sede = String(row[2] || 'Sede Principal').trim();
    const datafonos = parseFloat(row[3]) || 0;
    const nequi = parseFloat(row[4]) || 0;
    const efectivo = parseFloat(row[5]) || 0;
    const totalCuadre = parseFloat(row[6]) || 0;
    const reporteX = parseFloat(row[7]) || 0;
    const diferencia = parseFloat(row[8]) || 0;
    const novedades = row[9] ? String(row[9]).trim() : '';

    const match = pagFecha.match(/(\d{1,2})\/(\d{1,2})/);
    let fecha = '2026-09-11';
    if (match) {
      const dia = parseInt(match[1]);
      fecha = `2026-09-${String(dia).padStart(2, '0')}`;
    }

    cierres.push({
      periodo_id: 'per-2026-09',
      fecha,
      pagina_planilla: pagFecha,
      sede_responsable: sede,
      datafonos,
      nequi,
      efectivo,
      total_cuadre: totalCuadre,
      reporte_x: reporteX,
      diferencia,
      novedades
    });
  }

  // 2. Sección 6.1: Filas 245 a 252 (Días 15 al 18 de Septiembre)
  for (let r = 245; r <= 252; r++) {
    const row = rows[r];
    if (!row || !row[1]) continue;

    const pagFecha = String(row[1]).trim();
    const sede = String(row[2] || 'Sede Principal').trim();
    const datafonos = parseFloat(row[3]) || 0;
    const nequi = parseFloat(row[4]) || 0;
    const efectivo = parseFloat(row[5]) || 0;
    const totalCuadre = parseFloat(row[6]) || 0;
    const reporteX = parseFloat(row[7]) || 0;
    const diferencia = parseFloat(row[8]) || 0;
    const novedades = row[9] ? String(row[9]).trim() : '';

    const match = pagFecha.match(/(\d{1,2})\/(\d{1,2})/);
    let fecha = '2026-09-15';
    if (match) {
      const dia = parseInt(match[1]);
      fecha = `2026-09-${String(dia).padStart(2, '0')}`;
    }

    cierres.push({
      periodo_id: 'per-2026-09',
      fecha,
      pagina_planilla: pagFecha,
      sede_responsable: sede,
      datafonos,
      nequi,
      efectivo,
      total_cuadre: totalCuadre,
      reporte_x: reporteX,
      diferencia,
      novedades
    });
  }

  console.log(`Planillas de cierre extraídas: ${cierres.length}`);

  // Limpiar datos previos del periodo
  console.log('Limpiando datos previos en auditoria_cierres_caja...');
  await supabase
    .from('auditoria_cierres_caja')
    .delete()
    .eq('periodo_id', 'per-2026-09');

  // Insertar en Supabase
  const { error: insErr } = await supabase
    .from('auditoria_cierres_caja')
    .insert(cierres);

  if (insErr) {
    console.error('Error insertando en auditoria_cierres_caja:', insErr);
    process.exit(1);
  }

  console.log('✅ Planillas de arqueo y cierre de caja insertadas con éxito en Supabase!');

  // Resumen por fecha
  const { data: check } = await supabase
    .from('auditoria_cierres_caja')
    .select('*')
    .order('fecha', { ascending: true });

  console.log('\n--- RESUMEN POR FECHA ---');
  const group = {};
  check.forEach(c => {
    if (!group[c.fecha]) group[c.fecha] = { totalCuadre: 0, reporteX: 0, count: 0 };
    group[c.fecha].totalCuadre += parseFloat(c.total_cuadre);
    group[c.fecha].reporteX += parseFloat(c.reporte_x);
    group[c.fecha].count++;
  });

  for (const [fecha, val] of Object.entries(group)) {
    console.log(`${fecha}: ${val.count} planillas | Total Cuadre: $${val.totalCuadre.toLocaleString('es-CO')} | Reporte X: $${val.reporteX.toLocaleString('es-CO')}`);
  }
}

seedCierresCaja().catch(console.error);
