const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Cargar variables de entorno
const envPath = path.resolve(__dirname, '../.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)[1].trim();
const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/))[1].trim();
const supabase = createClient(url, key);

async function main() {
  console.log('=== ACTUALIZACIÓN DÍA 31 DE OCTUBRE 2026 - LIBRO DE CAJA MENOR ===\n');

  const fecha = '2026-10-31';
  const periodoId = 'per-2026-10';

  // 1. Eliminar datos existentes del 31 de octubre si existieran para evitar duplicados
  console.log('1. Limpiando datos previos del 31/10/2026 si existieran...');
  await supabase.from('libro_caja_registros').delete().eq('fecha', fecha);
  await supabase.from('libro_caja_sesiones').delete().eq('fecha', fecha);
  await supabase.from('libro_caja_diario').delete().eq('fecha', fecha);

  // 2. Definir las 2 Sesiones / Planillas de Turno del día 31
  console.log('2. Insertando sesiones de turno del 31/10/2026...');
  const sesionesPayload = [
    {
      fecha,
      caja_nombre: 'CAJA 1 (PRINCIPAL)',
      cajero_nombre: 'JOHANNA',
      usuario_username: 'johanna',
      efectivo_inicial: 500000,
      efectivo_cierre: 695000,
      valor_datafonos: 2862300,
      valor_otros_medios: 0,
      total_salidas: 1634150,
      total_ajustes: 0,
      venta_pos: 5190200,
      diferencia_cuadre: 1250,
      estado: 'CERRADA_TOTAL',
      numero_turno: 1,
      tipo_cierre: 'TOTAL',
      hora_apertura: '2026-10-31T08:00:00+00:00',
      hora_cierre: '2026-10-31T23:30:00+00:00',
      observaciones: 'Pág. 61 (31/10) - Principal Johanna',
    },
    {
      fecha,
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      cajero_nombre: 'NEYMAR',
      usuario_username: 'neymar',
      efectivo_inicial: 500000,
      efectivo_cierre: 920000,
      valor_datafonos: 3453800,
      valor_otros_medios: 0,
      total_salidas: 362400,
      total_ajustes: 0,
      venta_pos: 4736400,
      diferencia_cuadre: -200,
      estado: 'CERRADA_TOTAL',
      numero_turno: 2,
      tipo_cierre: 'TOTAL',
      hora_apertura: '2026-10-31T10:00:00+00:00',
      hora_cierre: '2026-10-31T23:30:00+00:00',
      observaciones: 'Pág. 62 (31/10) - Domicilios Neymar',
    },
  ];

  const { data: sesionesInsertadas, error: sesErr } = await supabase
    .from('libro_caja_sesiones')
    .insert(sesionesPayload)
    .select();

  if (sesErr) {
    console.error('Error insertando sesiones:', sesErr);
    process.exit(1);
  }
  console.log(`✓ ${sesionesInsertadas.length} sesiones insertadas exitosamente.`);

  const sesionJohanna = sesionesInsertadas.find(s => s.cajero_nombre === 'JOHANNA');
  const sesionNeymar = sesionesInsertadas.find(s => s.cajero_nombre === 'NEYMAR');

  // 3. Definir los 15 Registros de Salidas del día 31
  console.log('3. Insertando 15 registros de salidas del 31/10/2026...');
  const registrosPayload = [
    // --- Turno Johanna (Caja Principal) ---
    {
      fecha,
      dia_mes: 31,
      orden_item: 1,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Turno / Nómina',
      categoria: 'Gastos Nómina',
      concepto: 'Turno Andrés',
      descripcion_beneficiario: 'Andrés - Turno ordinario día',
      valor_pagado: 66000,
      soporte_factura: 'CUADERNO CAJA / JOHANNA',
      responsable_caja: 'JOHANNA',
      proveedor_fuente: 'Personal Turnos',
      usuario_registro: 'JOHANNA',
      caja_nombre: 'CAJA 1 (PRINCIPAL)',
      sesion_id: sesionJohanna?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 2,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Costo / Insumo',
      categoria: 'Servicios',
      concepto: 'Hielo',
      descripcion_beneficiario: 'Compra de hielo para operación',
      valor_pagado: 32000,
      soporte_factura: 'CUADERNO CAJA / JOHANNA',
      responsable_caja: 'JOHANNA',
      proveedor_fuente: 'Distribuidora Hielo',
      usuario_registro: 'JOHANNA',
      caja_nombre: 'CAJA 1 (PRINCIPAL)',
      sesion_id: sesionJohanna?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 3,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Turno / Nómina',
      categoria: 'Gastos Nómina',
      concepto: 'Nómina Antonio',
      descripcion_beneficiario: 'Antonio - Pago nómina / gestión directiva',
      valor_pagado: 1008000,
      soporte_factura: 'CUADERNO CAJA / JOHANNA',
      responsable_caja: 'JOHANNA',
      proveedor_fuente: 'Administración',
      usuario_registro: 'JOHANNA',
      caja_nombre: 'CAJA 1 (PRINCIPAL)',
      sesion_id: sesionJohanna?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 4,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Costo / Insumo',
      categoria: 'Verduras',
      concepto: 'Aguacate',
      descripcion_beneficiario: 'Aguacates (40 unidades) para restaurante',
      valor_pagado: 200000,
      soporte_factura: 'CUADERNO CAJA / JOHANNA',
      responsable_caja: 'JOHANNA',
      proveedor_fuente: 'Plaza de Mercado',
      usuario_registro: 'JOHANNA',
      caja_nombre: 'CAJA 1 (PRINCIPAL)',
      sesion_id: sesionJohanna?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 5,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Costo / Insumo',
      categoria: 'Bebidas',
      concepto: 'Gaseosas Postobón',
      descripcion_beneficiario: 'Factura / compra gaseosas Postobón en efectivo',
      valor_pagado: 141000,
      soporte_factura: 'CUADERNO CAJA / JOHANNA',
      responsable_caja: 'JOHANNA',
      proveedor_fuente: 'Postobón',
      usuario_registro: 'JOHANNA',
      caja_nombre: 'CAJA 1 (PRINCIPAL)',
      sesion_id: sesionJohanna?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 6,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Costo / Insumo',
      categoria: 'Verduras',
      concepto: 'Pulpas de Fruta',
      descripcion_beneficiario: 'Pulpas de fruta surtidas para jugos',
      valor_pagado: 187150,
      soporte_factura: 'CUADERNO CAJA / JOHANNA',
      responsable_caja: 'JOHANNA',
      proveedor_fuente: 'Distribuidora Pulpas',
      usuario_registro: 'JOHANNA',
      caja_nombre: 'CAJA 1 (PRINCIPAL)',
      sesion_id: sesionJohanna?.id || null,
      es_ajuste: false,
    },

    // --- Turno Neymar (Caja Domicilios) ---
    {
      fecha,
      dia_mes: 31,
      orden_item: 7,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Costo / Insumo',
      categoria: 'Verduras',
      concepto: 'Yuca',
      descripcion_beneficiario: 'Yuca para restaurante',
      valor_pagado: 90000,
      soporte_factura: 'CUADERNO CAJA / NEYMAR',
      responsable_caja: 'NEYMAR',
      proveedor_fuente: 'Plaza de Mercado',
      usuario_registro: 'NEYMAR',
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      sesion_id: sesionNeymar?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 8,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Costo / Insumo',
      categoria: 'Verduras',
      concepto: 'Pulpas de Fruta',
      descripcion_beneficiario: 'Pulpas de fruta para domicilios/cocina',
      valor_pagado: 78000,
      soporte_factura: 'CUADERNO CAJA / NEYMAR',
      responsable_caja: 'NEYMAR',
      proveedor_fuente: 'Distribuidora Pulpas',
      usuario_registro: 'NEYMAR',
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      sesion_id: sesionNeymar?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 9,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Gasto Operativo',
      categoria: 'Gastos Generales',
      concepto: 'Papelería / Cuaderno',
      descripcion_beneficiario: 'Cuaderno para control operativo',
      valor_pagado: 8900,
      soporte_factura: 'CUADERNO CAJA / NEYMAR',
      responsable_caja: 'NEYMAR',
      proveedor_fuente: 'Papelería',
      usuario_registro: 'NEYMAR',
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      sesion_id: sesionNeymar?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 10,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Gasto Operativo',
      categoria: 'Gastos Limpieza',
      concepto: 'Esponjas / Aseo',
      descripcion_beneficiario: 'Esponjas de limpieza para cocina',
      valor_pagado: 13500,
      soporte_factura: 'CUADERNO CAJA / NEYMAR',
      responsable_caja: 'NEYMAR',
      proveedor_fuente: 'Supermercado Aseo',
      usuario_registro: 'NEYMAR',
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      sesion_id: sesionNeymar?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 11,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Turno / Nómina',
      categoria: 'Gastos Nómina',
      concepto: 'Turno Olga',
      descripcion_beneficiario: 'Olga - Apoyo cocina turno día',
      valor_pagado: 66000,
      soporte_factura: 'CUADERNO CAJA / NEYMAR',
      responsable_caja: 'NEYMAR',
      proveedor_fuente: 'Personal Cocina',
      usuario_registro: 'NEYMAR',
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      sesion_id: sesionNeymar?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 12,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Gasto Operativo',
      categoria: 'Gastos Generales',
      concepto: 'Crédito Don Arturo',
      descripcion_beneficiario: 'Crédito / anticipo Don Arturo (Factura chorizos)',
      valor_pagado: 48000,
      soporte_factura: 'CUADERNO CAJA / NEYMAR',
      responsable_caja: 'NEYMAR',
      proveedor_fuente: 'Anticipos Proveedores',
      usuario_registro: 'NEYMAR',
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      sesion_id: sesionNeymar?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 13,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Gasto Operativo',
      categoria: 'Gastos Generales',
      concepto: 'Crédito Jose David',
      descripcion_beneficiario: 'Crédito / anticipo empleado Jose David',
      valor_pagado: 34000,
      soporte_factura: 'CUADERNO CAJA / NEYMAR',
      responsable_caja: 'NEYMAR',
      proveedor_fuente: 'Anticipos Personal',
      usuario_registro: 'NEYMAR',
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      sesion_id: sesionNeymar?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 14,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Gasto Operativo',
      categoria: 'Gastos Generales',
      concepto: 'Crédito Daniela',
      descripcion_beneficiario: 'Crédito / anticipo empleada Daniela',
      valor_pagado: 3000,
      soporte_factura: 'CUADERNO CAJA / NEYMAR',
      responsable_caja: 'NEYMAR',
      proveedor_fuente: 'Anticipos Personal',
      usuario_registro: 'NEYMAR',
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      sesion_id: sesionNeymar?.id || null,
      es_ajuste: false,
    },
    {
      fecha,
      dia_mes: 31,
      orden_item: 15,
      tipo_libro: 'CAJA_MENOR',
      periodo_id: periodoId,
      clasificacion: 'Gasto Operativo',
      categoria: 'Gastos Generales',
      concepto: 'Crédito Eliana',
      descripcion_beneficiario: 'Crédito / anticipo empleada Eliana',
      valor_pagado: 21000,
      soporte_factura: 'CUADERNO CAJA / NEYMAR',
      responsable_caja: 'NEYMAR',
      proveedor_fuente: 'Anticipos Personal',
      usuario_registro: 'NEYMAR',
      caja_nombre: 'CAJA 2 (DOMICILIOS)',
      sesion_id: sesionNeymar?.id || null,
      es_ajuste: false,
    },
  ];

  const { data: regInsertados, error: regErr } = await supabase
    .from('libro_caja_registros')
    .insert(registrosPayload)
    .select();

  if (regErr) {
    console.error('Error insertando registros:', regErr);
    process.exit(1);
  }
  console.log(`✓ ${regInsertados.length} registros de salidas insertados exitosamente.`);

  // 4. Crear Hoja Diaria Consolidada del día 31
  console.log('4. Insertando hoja consolidada del día 31/10/2026...');
  const totalInsumos = 728150;
  const totalGastosOp = 128400;
  const totalTurnos = 1140000;
  const totalSalidas = totalInsumos + totalGastosOp + totalTurnos; // 1996550
  const totalDatafonos = 6316100;
  const efectivoFisico = 1615000;
  const ventaPos = 9926600;
  const totalCuadre = totalDatafonos + efectivoFisico + totalSalidas; // 9927650
  const diferencia = totalCuadre - ventaPos; // +1050

  const hojaPayload = {
    fecha,
    dia_mes: 31,
    tipo_libro: 'CAJA_MENOR',
    periodo_id: periodoId,
    base_inicial: 500000,
    total_datafonos: totalDatafonos,
    total_otros_medios: 0,
    efectivo_fisico_cierre: efectivoFisico,
    venta_pos_total: ventaPos,
    venta_efectivo_pos: ventaPos,
    total_costos_insumos: totalInsumos,
    total_gastos_operativos: totalGastosOp,
    total_turnos_nomina: totalTurnos,
    total_salidas: totalSalidas,
    total_ajustes: 0,
    diferencia_cuadre: diferencia,
    responsables_dia: 'Principal (Johanna) + Domicilios (Neymar)',
    estado: 'CERRADA',
    observaciones: 'Consolidado oficial Libro de Caja 31 de Octubre 2026 (Planillas 61 y 62)',
  };

  const { data: hojaInsertada, error: hojaErr } = await supabase
    .from('libro_caja_diario')
    .insert(hojaPayload)
    .select();

  if (hojaErr) {
    console.error('Error insertando hoja diaria:', hojaErr);
    process.exit(1);
  }
  console.log('✓ Hoja diaria consolidada del 31 de Octubre creada exitosamente.');

  // 5. Verificación final de totales del mes de Octubre
  console.log('\n5. Verificando totales acumulados de Octubre 2026 en Supabase...');
  const { data: todosRegistros } = await supabase
    .from('libro_caja_registros')
    .select('valor_pagado, clasificacion')
    .eq('periodo_id', periodoId);

  const totalOctubre = todosRegistros?.reduce((a, b) => a + Number(b.valor_pagado || 0), 0) || 0;
  const countOctubre = todosRegistros?.length || 0;

  const { count: countDias } = await supabase
    .from('libro_caja_diario')
    .select('*', { count: 'exact', head: true })
    .eq('periodo_id', periodoId);

  console.log(`\n========================================`);
  console.log(`RESUMEN OFICIAL OCTUBRE 2026 TRAS CARGAR DÍA 31:`);
  console.log(`Total días registrados en BD: ${countDias} (Días 1 al 31 completados)`);
  console.log(`Total registros de salidas: ${countOctubre} (Esperado Excel: 393 registros)`);
  console.log(`Total dinero salidas mes: $${totalOctubre.toLocaleString('es-CO')} COP (Esperado Excel: $37.456.580 COP)`);
  console.log(`========================================\n`);

  console.log('¡Sincronización del día 31 de Octubre completada al 100% con éxito!');
}

main().catch(console.error);
