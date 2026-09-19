import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedLibros() {
  const excelPath = path.resolve(__dirname, '../DOCUMENTOS BASE/COSTOS_GASTOS_SEPTIEMBRE_2026.xlsx');
  console.log('Abriendo archivo Excel:', excelPath);

  const workbook = XLSX.readFile(excelPath);

  // 1. INGESTA DE LIBRO DE CAJA MENOR
  console.log('--- Procesando Auditoria libro de Caja ---');
  const sheetCaja = workbook.Sheets['Auditoria libro de Caja'];
  const cajaRaw = XLSX.utils.sheet_to_json(sheetCaja, { header: 1 });

  const cajaRecords = [];
  for (let r = 10; r < cajaRaw.length; r++) {
    const row = cajaRaw[r];
    if (!row || row.length === 0) continue;

    const pagFecha = row[1];
    const responsable = row[2];
    const itemManuscrito = row[3];
    const valorCaja = row[4];
    const categoriaCaja = row[6];
    const estadoExcel = row[7];
    const soporte = row[9];
    const diagnostico = row[11];

    if (!itemManuscrito || valorCaja === undefined || valorCaja === null) continue;

    const valNum = parseFloat(valorCaja) || 0;
    if (valNum <= 0) continue;

    // Extraer fecha del texto: ej "Pág. 1 (07/09)" -> "2026-09-07"
    let fecha = '2026-09-07';
    if (pagFecha) {
      const m = String(pagFecha).match(/(\d{1,2})\/(\d{1,2})/);
      if (m) {
        const dia = parseInt(m[1]);
        const mes = parseInt(m[2]);
        const diaFmt = dia < 10 ? `0${dia}` : `${dia}`;
        const mesFmt = mes < 10 ? `0${mes}` : `${mes}`;
        fecha = `2026-${mesFmt}-${diaFmt}`;
      }
    }

    const estadoConciliacion = String(estadoExcel || 'NO_REGISTRADO').trim().toUpperCase();
    const isCruzado = estadoConciliacion.includes('CRUZADO') || estadoConciliacion.includes('REGISTRADO');

    cajaRecords.push({
      periodo_id: 'per-2026-09',
      fecha,
      pagina_recibo: pagFecha ? String(pagFecha).trim() : 'Pág. 1',
      caja_responsable: responsable ? String(responsable).trim() : 'Caja General',
      item_manuscrito: String(itemManuscrito).trim(),
      valor_caja: valNum,
      categoria_caja: categoriaCaja ? String(categoriaCaja).trim() : 'Gastos Menores',
      estado_conciliacion: isCruzado ? 'CRUZADO_CON_FACTURA' : 'PENDIENTE_CONCILIAR',
      factura_soporte: soporte ? String(soporte).trim() : 'Sin soporte formal',
      incluido_en_costeo: isCruzado,
      diagnostico_auditoria: diagnostico ? String(diagnostico).trim() : '',
    });
  }

  console.log(`Registros parseados de Caja Menor: ${cajaRecords.length}`);

  // Limpiar e insertar Caja Menor
  await supabase.from('libro_caja_menor').delete().eq('periodo_id', 'per-2026-09');
  if (cajaRecords.length > 0) {
    for (let b = 0; b < cajaRecords.length; b += 100) {
      const batch = cajaRecords.slice(b, b + 100);
      const { error: insErr } = await supabase.from('libro_caja_menor').insert(batch);
      if (insErr) {
        console.error('Error insertando lote caja:', insErr);
        process.exit(1);
      }
    }
  }
  console.log('✓ Libro de Caja Menor insertado con éxito!');

  // 2. INGESTA DE LIBRO PRINCIPAL (DON ARTURO)
  console.log('--- Procesando Auditoría Cuaderno vs Excel (Don Arturo) ---');
  const sheetArturo = workbook.Sheets['Auditoría Cuaderno vs Excel'] || workbook.Sheets[workbook.SheetNames[1]];
  const arturoRaw = XLSX.utils.sheet_to_json(sheetArturo, { header: 1 });

  const arturoRecords = [];
  for (let r = 10; r < arturoRaw.length; r++) {
    const row = arturoRaw[r];
    if (!row || row.length === 0) continue;

    const numRenglon = row[1];
    const itemCuaderno = row[2];
    const valorCuaderno = row[3];
    const estadoConciliacion = row[4];
    const soporte = row[8];
    const obs = row[9];

    if (!itemCuaderno || valorCuaderno === undefined || valorCuaderno === null) continue;

    const valNum = parseFloat(valorCuaderno) || 0;
    if (valNum <= 0) continue;

    const estadoNorm = String(estadoConciliacion || 'INGRESADO_MANUAL').trim().toUpperCase();

    arturoRecords.push({
      periodo_id: 'per-2026-09',
      renglon_numero: parseInt(numRenglon) || (arturoRecords.length + 1),
      item_cuaderno: String(itemCuaderno).trim(),
      valor_cuaderno: valNum,
      estado_conciliacion: estadoNorm,
      factura_soporte: soporte ? String(soporte).trim() : '',
      incluido_en_costeo: true,
      observaciones_auditoria: obs ? String(obs).trim() : '',
    });
  }

  console.log(`Registros parseados de Cuaderno Don Arturo: ${arturoRecords.length}`);

  // Limpiar e insertar Cuaderno Arturo
  await supabase.from('libro_cuaderno_arturo').delete().eq('periodo_id', 'per-2026-09');
  if (arturoRecords.length > 0) {
    for (let b = 0; b < arturoRecords.length; b += 100) {
      const batch = arturoRecords.slice(b, b + 100);
      const { error: insErr } = await supabase.from('libro_cuaderno_arturo').insert(batch);
      if (insErr) {
        console.error('Error insertando lote cuaderno Arturo:', insErr);
        process.exit(1);
      }
    }
  }
  console.log('✓ Libro Principal de Don Arturo insertado con éxito!');
  console.log('✅ Ingesta de Libros de Egresos completada!');
}

seedLibros().catch((err) => {
  console.error('Error fatal en seedLibros:', err);
  process.exit(1);
});
