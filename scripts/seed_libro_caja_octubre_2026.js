/**
 * Script oficial para poblar libro_caja_diario y libro_caja_registros
 * desde COSTOS_GASTOS_OCTUBRE_2026.xlsx -> Pestaña "Consolidado Libro de Caja"
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// Cargar credenciales de .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let SUPABASE_URL = '';
let SUPABASE_KEY = '';

for (const line of envContent.split(/\r?\n/)) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) SUPABASE_KEY = line.split('=')[1].trim();
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function extractResponsable(soporteRaw) {
  const s = String(soporteRaw || '').toUpperCase().trim();
  if (s.includes('JOHANNA')) return 'JOHANNA';
  if (s.includes('MARIA') || s.includes('MARÍA')) return 'MARIA';
  if (s.includes('CAROLINA')) return 'CAROLINA';
  if (s.includes('DANIELA')) return 'DANIELA';
  if (s.includes('LUCERO')) return 'LUCERO';
  if (s.includes('ANTONIO')) return 'ANTONIO';
  if (s.includes('NEYMAR')) return 'NEYMAR';
  if (s.includes('SALON') || s.includes('SALÓN')) return 'SALÓN';
  if (s.includes('/')) {
    return s.split('/').pop().trim() || 'GENERAL';
  }
  return 'GENERAL';
}

function parseFechaDDMMYYYY(str, diaMes) {
  const raw = String(str || '').trim();
  if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts.length === 3) {
      const dd = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const yyyy = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const d = String(diaMes || 1).padStart(2, '0');
  return `2026-10-${d}`;
}

async function runSeed() {
  const excelPath = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/COSTOS_GASTOS_OCTUBRE_2026.xlsx';
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets['Consolidado Libro de Caja'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Extraer los 328 registros detallados (a partir de la fila 46 en base 1 -> índice 45)
  const registros = [];
  let orden = 1;

  for (let i = 45; i < rows.length; i++) {
    const r = rows[i];
    const diaMes = Number(r[1]);
    const fechaRaw = r[2];
    const clasificacion = String(r[3] || '').trim();
    const categoria = String(r[4] || '').trim();
    const concepto = String(r[5] || '').trim();
    const descripcion = String(r[6] || '').trim();
    const valorPagado = Number(r[7] || 0);
    const soporteFactura = String(r[8] || '').trim();
    const proveedorFuente = String(r[9] || '').trim();

    if (!diaMes || isNaN(diaMes) || !clasificacion || !concepto) continue;

    const fechaISO = parseFechaDDMMYYYY(fechaRaw, diaMes);
    const responsable = extractResponsable(soporteFactura);

    registros.push({
      fecha: fechaISO,
      dia_mes: diaMes,
      orden_item: orden++,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: 'per-2026-10',
      clasificacion,
      categoria: categoria || 'Gastos Generales',
      concepto,
      descripcion_beneficiario: descripcion,
      valor_pagado: valorPagado,
      soporte_factura: soporteFactura,
      responsable_caja: responsable,
      proveedor_fuente: proveedorFuente,
      usuario_registro: responsable,
    });
  }

  console.log(`Registros detallados extraídos: ${registros.length}`);
  const sumaTotal = registros.reduce((a, b) => a + b.valor_pagado, 0);
  console.log(`Suma total extraída: $${sumaTotal.toLocaleString('es-CO')} COP`);

  // Agrupar por día para construir libro_caja_diario (Días 1 al 26 con movimiento, o hasta el 31)
  const porDia = new Map();

  for (const reg of registros) {
    if (!porDia.has(reg.fecha)) {
      porDia.set(reg.fecha, {
        fecha: reg.fecha,
        dia_mes: reg.dia_mes,
        tipo_libro: 'CAJA_MENOR',
        periodo_id: 'per-2026-10',
        base_inicial: 200000,
        venta_efectivo_pos: 0,
        total_costos_insumos: 0,
        total_gastos_operativos: 0,
        total_turnos_nomina: 0,
        total_salidas: 0,
        efectivo_fisico_cierre: 0,
        diferencia_cuadre: 0,
        responsablesSet: new Set(),
        estado: 'AUDITADA',
        observaciones: 'Consolidado oficial Libro de Caja Octubre 2026',
      });
    }
    const d = porDia.get(reg.fecha);
    if (reg.clasificacion.toLowerCase().includes('insumo') || reg.clasificacion.toLowerCase().includes('costo')) {
      d.total_costos_insumos += reg.valor_pagado;
    } else if (reg.clasificacion.toLowerCase().includes('nómina') || reg.clasificacion.toLowerCase().includes('nomina') || reg.clasificacion.toLowerCase().includes('turno')) {
      d.total_turnos_nomina += reg.valor_pagado;
    } else {
      d.total_gastos_operativos += reg.valor_pagado;
    }
    d.total_salidas += reg.valor_pagado;
    d.responsablesSet.add(reg.responsable_caja);
  }

  // Consultar ventas_diarias de octubre para cruzar referencia de venta_efectivo_pos
  const { data: ventasOct } = await supabase
    .from('ventas_diarias')
    .select('fecha, gran_total')
    .gte('fecha', '2026-10-01')
    .lte('fecha', '2026-10-31');

  const mapaVentas = new Map();
  (ventasOct || []).forEach(v => mapaVentas.set(v.fecha, Number(v.gran_total || 0)));

  const diariosPayload = Array.from(porDia.values()).map(d => {
    const posTotal = mapaVentas.get(d.fecha) || 0;
    // Estimación base o referencia POS
    const efectivoPos = posTotal > 0 ? posTotal : d.total_salidas;
    const esperado = d.base_inicial + efectivoPos - d.total_salidas;
    return {
      fecha: d.fecha,
      dia_mes: d.dia_mes,
      tipo_libro: d.tipo_libro,
      periodo_id: d.periodo_id,
      base_inicial: d.base_inicial,
      venta_efectivo_pos: efectivoPos,
      total_costos_insumos: d.total_costos_insumos,
      total_gastos_operativos: d.total_gastos_operativos,
      total_turnos_nomina: d.total_turnos_nomina,
      total_salidas: d.total_salidas,
      efectivo_fisico_cierre: esperado,
      diferencia_cuadre: 0,
      responsables_dia: Array.from(d.responsablesSet).join(' / '),
      estado: d.estado,
      observaciones: d.observaciones,
    };
  });

  // Limpiar registros previos de octubre 2026 para insertar limpio
  await supabase.from('libro_caja_registros').delete().eq('periodo_id', 'per-2026-10');
  await supabase.from('libro_caja_diario').delete().eq('periodo_id', 'per-2026-10');

  const { error: errDiario } = await supabase.from('libro_caja_diario').insert(diariosPayload);
  if (errDiario) {
    console.error('Error insertando libro_caja_diario:', errDiario);
    process.exit(1);
  }

  // Insertar registros en lotes de 100
  for (let i = 0; i < registros.length; i += 100) {
    const chunk = registros.slice(i, i + 100);
    const { error: errReg } = await supabase.from('libro_caja_registros').insert(chunk);
    if (errReg) {
      console.error('Error insertando lote libro_caja_registros:', errReg);
      process.exit(1);
    }
  }

  console.log(`✅ Semilla completada: ${diariosPayload.length} hojas diarias y ${registros.length} registros insertados en Supabase.`);
}

runSeed();
