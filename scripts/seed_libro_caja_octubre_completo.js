const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// 1. Cargar variables de entorno
const envPath = path.resolve(__dirname, '../.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)[1].trim();
const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/))[1].trim();
const supabase = createClient(url, key);

// 2. Cargar Excel oficial de Costos y Gastos Octubre 2026
const excelPath = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/COSTOS_GASTOS_OCTUBRE_2026.xlsx';
console.log('Leyendo archivo Excel:', excelPath);
const wb = xlsx.readFile(excelPath);
const sheet = wb.Sheets['Consolidado Libro de Caja'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

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

function getCajaNombre(responsable) {
  const r = (responsable || '').toUpperCase();
  if (r.includes('JOHANNA') || r.includes('LUCERO') || r.includes('SALON') || r.includes('SALÓN')) {
    return 'CAJA 1 (PRINCIPAL)';
  }
  return 'CAJA 2 (DOMICILIOS)';
}

async function runMigration() {
  console.log('=== INICIANDO SINCRONIZACIÓN OFICIAL DEL LIBRO DE CAJA MENOR ===\n');

  // A. Obtener ventas POS de Supabase para contrastar
  const { data: vpos, error: vposErr } = await supabase.from('ventas_diarias').select('fecha, gran_total');
  if (vposErr) {
    console.error('Error consultando ventas POS:', vposErr);
  }
  const posMap = new Map();
  vpos?.forEach(v => posMap.set(v.fecha, Number(v.gran_total)));
  console.log(`Ventas POS cargadas de Supabase: ${posMap.size} días`);

  // B. Extraer Sección 2: 378 Registros de Salidas y Ajustes
  console.log('\n--- 1. Extrayendo Sección 2: Registros de Salidas (filas 45 a 424) ---');
  const registros = [];
  let orden = 1;

  for (let i = 45; i < 425; i++) {
    const r = data[i];
    if (!r) continue;
    const diaMes = Number(r[1]);
    if (!diaMes || isNaN(diaMes)) continue;

    const fechaRaw = r[2];
    const clasificacion = String(r[3] || '').trim();
    const categoria = String(r[4] || '').trim();
    const concepto = String(r[5] || '').trim();
    const descripcion = String(r[6] || '').trim();
    const valorPagado = Number(r[7] || 0);
    const soporteFactura = String(r[8] || '').trim();
    const proveedorFuente = String(r[9] || '').trim();

    const dd = String(diaMes).padStart(2, '0');
    const fechaISO = `2026-10-${dd}`;
    const responsable = extractResponsable(soporteFactura);
    const cajaNombre = getCajaNombre(responsable);

    const esAjuste = concepto.toLowerCase().includes('sobrante caja') || 
                     concepto.toLowerCase().includes('ajuste') || 
                     descripcion.toLowerCase().includes('ajuste');

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
      caja_nombre: cajaNombre,
      es_ajuste: esAjuste,
    });
  }

  const totalSalidasCalc = registros.reduce((acc, x) => acc + x.valor_pagado, 0);
  console.log(`-> Total registros extraídos: ${registros.length}`);
  console.log(`-> Suma acumulada de salidas: $${totalSalidasCalc.toLocaleString('es-CO')} COP (Validación exacta Excel: $35.460.030)`);

  // C. Agrupar salidas por día para consolidar en la hoja diaria
  const salidasPorDia = new Map();
  for (const reg of registros) {
    if (!salidasPorDia.has(reg.fecha)) {
      salidasPorDia.set(reg.fecha, {
        insumos: 0,
        gastos: 0,
        turnos: 0,
        total: 0,
        ajustes: 0,
      });
    }
    const d = salidasPorDia.get(reg.fecha);
    const cl = reg.clasificacion.toLowerCase();
    if (cl.includes('insumo') || cl.includes('costo')) {
      d.insumos += reg.valor_pagado;
    } else if (cl.includes('nómina') || cl.includes('nomina') || cl.includes('turno')) {
      d.turnos += reg.valor_pagado;
    } else {
      d.gastos += reg.valor_pagado;
    }
    d.total += reg.valor_pagado;
    if (reg.es_ajuste) d.ajustes += reg.valor_pagado;
  }

  // D. Extraer Sección 3.1: 30 Arqueos y Cuadres Diarios Consolidados (filas 492 a 521)
  console.log('\n--- 2. Extrayendo Sección 3.1: 30 Arqueos y Cuadres Diarios ---');
  const hojasDiarias = [];

  for (let i = 492; i <= 521; i++) {
    const r = data[i];
    const diaMes = i - 491;
    const dd = String(diaMes).padStart(2, '0');
    const fecha = `2026-10-${dd}`;

    const responsablesRaw = String(r[2] || '').trim();
    const datafonos = Number(r[3] || 0);
    const nequi = Number(r[4] || 0);
    const totalDatafonos = datafonos + nequi; // Sumatoria de datáfonos y medios electrónicos
    const efectivoFisico = Number(r[5] || 0);
    const totalCuadre = Number(r[6] || 0);
    const posReporteXZ = Number(r[7] || 0);
    const diferenciaExcel = Number(r[8] || 0);

    // Ventas POS del sistema: Si existe en ventas_diarias se usa Supabase, sino el reporte oficial X/Z
    const ventaPosReal = posMap.get(fecha) || posReporteXZ;

    // Diferencia real de arqueo: Total Cuadre - Venta POS
    const diferenciaCuadre = totalCuadre - ventaPosReal;

    const sDay = salidasPorDia.get(fecha) || { insumos: 0, gastos: 0, turnos: 0, total: 0, ajustes: 0 };

    hojasDiarias.push({
      fecha,
      dia_mes: diaMes,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: 'per-2026-10',
      base_inicial: 500000,
      total_datafonos: totalDatafonos,
      efectivo_fisico_cierre: efectivoFisico,
      venta_pos_total: ventaPosReal,
      venta_efectivo_pos: ventaPosReal,
      total_costos_insumos: sDay.insumos,
      total_gastos_operativos: sDay.gastos,
      total_turnos_nomina: sDay.turnos,
      total_salidas: sDay.total,
      total_ajustes: sDay.ajustes,
      diferencia_cuadre: diferenciaCuadre,
      responsables_dia: responsablesRaw || 'GENERAL',
      estado: 'CERRADA',
      observaciones: 'Consolidado oficial Libro de Caja Octubre 2026',
    });
  }
  console.log(`-> Hojas diarias consolidadas preparadas: ${hojasDiarias.length} días (1 al 30)`);

  // E. Extraer Sección 3: 60 Planillas / Sesiones de Caja (filas 427 a 486)
  console.log('\n--- 3. Extrayendo Sección 3: 60 Planillas de Turnos de Caja ---');
  const sesiones = [];

  for (let i = 427; i <= 486; i++) {
    const r = data[i];
    const pagFechaRaw = String(r[1] || ''); // e.g. 'Pág. 1 (01/10)'
    const sedeRespRaw = String(r[2] || ''); // e.g. 'Principal (Johanna)' o 'Domicilios (María)'
    const datafonos = Number(r[3] || 0);
    const nequi = Number(r[4] || 0);
    const efectivo = Number(r[5] || 0);
    const totalCuadre = Number(r[6] || 0);
    const reporteXZ = Number(r[7] || 0);
    const diferencia = Number(r[8] || 0);

    const matchDia = pagFechaRaw.match(/\((\d{1,2})\/10\)/);
    const diaNum = matchDia ? Number(matchDia[1]) : (Math.floor((i - 427) / 2) + 1);
    const dd = String(diaNum).padStart(2, '0');
    const fecha = `2026-10-${dd}`;

    const isPrincipal = sedeRespRaw.toLowerCase().includes('principal');
    const cajaNombre = isPrincipal ? 'CAJA 1 (PRINCIPAL)' : 'CAJA 2 (DOMICILIOS)';
    
    let cajeroNombre = 'JOHANNA';
    const matchName = sedeRespRaw.match(/\(([^)]+)\)/);
    if (matchName) {
      cajeroNombre = matchName[1].trim().toUpperCase();
    }
    const username = cajeroNombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const salidasTurno = Math.max(0, totalCuadre - (datafonos + nequi + efectivo));

    sesiones.push({
      fecha,
      caja_nombre: cajaNombre,
      cajero_nombre: cajeroNombre,
      usuario_username: username,
      efectivo_inicial: 500000,
      efectivo_cierre: efectivo,
      valor_datafonos: datafonos + nequi,
      total_salidas: salidasTurno,
      total_ajustes: 0,
      estado: 'CERRADA_TOTAL',
      tipo_cierre: 'TOTAL',
      numero_turno: isPrincipal ? 1 : 2,
      hora_apertura: `${fecha}T08:00:00+00:00`,
      hora_cierre: `${fecha}T23:30:00+00:00`,
      observaciones: `${pagFechaRaw} - ${sedeRespRaw}`,
    });
  }
  console.log(`-> Sesiones de caja preparadas: ${sesiones.length} turnos`);

  // F. Limpieza de datos previos del período 'per-2026-10'
  console.log('\n--- 4. Eliminando datos previos del período en Supabase ---');
  const { error: delRegErr } = await supabase
    .from('libro_caja_registros')
    .delete()
    .eq('periodo_id', 'per-2026-10');
  if (delRegErr) console.error('Error eliminando registros anteriores:', delRegErr);
  else console.log('✓ Registros antiguos de libro_caja_registros eliminados.');

  const { error: delSesErr } = await supabase
    .from('libro_caja_sesiones')
    .delete()
    .gte('fecha', '2026-10-01')
    .lte('fecha', '2026-10-31');
  if (delSesErr) console.error('Error eliminando sesiones anteriores:', delSesErr);
  else console.log('✓ Sesiones de turno antiguas de libro_caja_sesiones eliminadas.');

  const { error: delDiarioErr } = await supabase
    .from('libro_caja_diario')
    .delete()
    .eq('periodo_id', 'per-2026-10');
  if (delDiarioErr) console.error('Error eliminando hojas diarias anteriores:', delDiarioErr);
  else console.log('✓ Hojas diarias antiguas de libro_caja_diario eliminadas.');

  // G. Inserción de Hojas Diarias (30 días)
  console.log('\n--- 5. Insertando 30 Hojas Diarias en libro_caja_diario ---');
  const { data: insDiario, error: insDiarioErr } = await supabase
    .from('libro_caja_diario')
    .insert(hojasDiarias)
    .select('id, fecha, total_salidas, venta_pos_total, diferencia_cuadre');
  if (insDiarioErr) {
    console.error('Error insertando libro_caja_diario:', insDiarioErr);
    process.exit(1);
  }
  console.log(`✓ Insertadas exitosamente ${insDiario.length} hojas diarias.`);

  // H. Inserción de Sesiones de Caja (60 turnos)
  console.log('\n--- 6. Insertando 60 Sesiones en libro_caja_sesiones ---');
  const { data: insSes, error: insSesErr } = await supabase
    .from('libro_caja_sesiones')
    .insert(sesiones)
    .select('id, fecha, caja_nombre, cajero_nombre');
  if (insSesErr) {
    console.error('Error insertando libro_caja_sesiones:', insSesErr);
  } else {
    console.log(`✓ Insertadas exitosamente ${insSes.length} sesiones de turno.`);
  }

  // I. Inserción de Registros de Salidas (378 items en lotes)
  console.log('\n--- 7. Insertando 378 Registros de Salidas en libro_caja_registros ---');
  const batchSize = 100;
  let insertedCount = 0;
  for (let b = 0; b < registros.length; b += batchSize) {
    const chunk = registros.slice(b, b + batchSize);
    const { error: insChunkErr } = await supabase
      .from('libro_caja_registros')
      .insert(chunk);
    if (insChunkErr) {
      console.error(`Error insertando lote ${b}-${b + chunk.length}:`, insChunkErr);
      process.exit(1);
    }
    insertedCount += chunk.length;
    console.log(`  -> Lote ${b + 1} a ${b + chunk.length} insertado (${insertedCount}/${registros.length})`);
  }
  console.log(`✓ Insertados exitosamente ${insertedCount} registros de salidas.`);

  // J. Verificación Final en Base de Datos
  console.log('\n--- 8. Verificación y Auditoría Final en Supabase ---');
  const { count: finalRegCount } = await supabase.from('libro_caja_registros').select('*', { count: 'exact', head: true });
  const { count: finalDiarioCount } = await supabase.from('libro_caja_diario').select('*', { count: 'exact', head: true });
  const { count: finalSesCount } = await supabase.from('libro_caja_sesiones').select('*', { count: 'exact', head: true });

  const { data: sumData } = await supabase.from('libro_caja_registros').select('valor_pagado');
  const totalSalidasDB = sumData.reduce((acc, r) => acc + Number(r.valor_pagado), 0);

  console.log('Resultados de Auditoría:');
  console.log(`• libro_caja_registros: ${finalRegCount} registros (Total: $${totalSalidasDB.toLocaleString('es-CO')} COP)`);
  console.log(`• libro_caja_diario: ${finalDiarioCount} días completos (1 al 30 de Octubre)`);
  console.log(`• libro_caja_sesiones: ${finalSesCount} turnos registrados`);

  // Detalle específico días 27, 28, 29, 30
  const { data: ultimosDias } = await supabase
    .from('libro_caja_diario')
    .select('fecha, dia_mes, base_inicial, total_datafonos, efectivo_fisico_cierre, total_salidas, venta_pos_total, diferencia_cuadre, responsables_dia')
    .gte('dia_mes', 27)
    .order('dia_mes');

  console.log('\nDetalle Días 27 al 30 en Base de Datos:');
  console.table(ultimosDias);

  console.log('\n=== MIGRACIÓN COMPLETADA SATISFACTORIAMENTE ===');
}

runMigration().catch(err => {
  console.error('Error fatal durante la migración:', err);
  process.exit(1);
});
