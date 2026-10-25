import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Movimientos extraídos fielmente de la planilla física de bodega:
 * REPORTE DIARIO DE MOVIMIENTOS DE BODEGA - 2026 (FECHA: 30 SEP)
 * Archivo fuente: DOCUMENTOS BASE/Movimientos/30.jpeg
 */
const rawMovements30Sep = [
  // 1. Filete Pollo (CAR-041)
  { fecha: '2026-09-30', insumo: 'Filete de pollox 320 gr', tipo: 'ENTRADA_COMPRA', cantKg: 17.0, porc: 0, obs: 'Entrada del día 17.0 Kg Filete Pollo' },
  { fecha: '2026-09-30', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 16, obs: 'Salida a cocina 16 porciones Filete Pollo' },
  { fecha: '2026-09-30', insumo: 'Filete de pollox 320 gr', tipo: 'DEVOLUCION_COCINA', cantKg: 0, porc: 50, obs: 'Devolución de cocina 50 porciones Filete Pollo' },

  // 2. Chorizo Grande (EMB-054) - Fila 3
  { fecha: '2026-09-30', insumo: 'Chorizo grande', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 12, obs: 'Salida a cocina 12 unds Chorizo Grande' },

  // 3. Ahumada (CAR-003 Costilla ahumada) - Fila 4
  { fecha: '2026-09-30', insumo: 'Costilla ahumada', tipo: 'ENTRADA_COMPRA', cantKg: 40.0, porc: 0, obs: 'Entrada del día 40.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-30', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 20.0, porc: 0, obs: 'Salida a cocina 20.0 Kg Costilla Ahumada' },

  // 4. Carne Asada (RES-072) - Fila 5
  { fecha: '2026-09-30', insumo: 'Carne asada', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 10, obs: 'Salida a cocina 10 porciones Carne Asada' },

  // 5. Tocino (CER-075) - Fila 6
  { fecha: '2026-09-30', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 10, obs: 'Salida a cocina 10 porciones Tocino' },

  // 6. Francesa (VER-074 Papas a la francesa) - Fila 7
  { fecha: '2026-09-30', insumo: 'Papas a la francesa', tipo: 'ENTRADA_COMPRA', cantKg: 2.0, porc: 2, obs: 'Entrada del día 2 paq Papa Francesa' },
  { fecha: '2026-09-30', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 2, obs: 'Salida a cocina 2 paq Papa Francesa (1+1)' },

  // 7. Punta (CAR-033 Punta de anca) - Fila 8
  { fecha: '2026-09-30', insumo: 'Punta de anca', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 5, obs: 'Salida a cocina 5 porciones Punta de Anca' },

  // 8. Lomo Cerdo (CAR-010 Lomo de cerdo) - Fila 9 (Salida)
  { fecha: '2026-09-30', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 5, obs: 'Salida a cocina 5 porciones Lomo Cerdo' },

  // 9. San Luis (CAR-006 Costilla san luis) - Fila 10
  { fecha: '2026-09-30', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 4, obs: 'Salida a cocina 4 porciones Costilla San Luis' },

  // 10. Bagre (PES-065 Pescado bagre) - Fila 11
  { fecha: '2026-09-30', insumo: 'Pescado bagre', tipo: 'ENTRADA_COMPRA', cantKg: 20.0, porc: 0, obs: 'Entrada del día 20.0 Kg Bagre' },

  // 11. Gallina (CAR-042 Gallina) - Fila 12
  { fecha: '2026-09-30', insumo: 'Gallina', tipo: 'ENTRADA_COMPRA', cantKg: 32.7, porc: 0, obs: 'Entrada del día 32.7 Kg Gallina' },

  // 12. Lomo Cerdo (CAR-010 Lomo de cerdo) - Fila 13 (Entrada y Devolución)
  { fecha: '2026-09-30', insumo: 'Lomo de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 17.7, porc: 0, obs: 'Entrada del día 17.7 Kg Lomo Cerdo' },
  { fecha: '2026-09-30', insumo: 'Lomo de cerdo', tipo: 'DEVOLUCION_COCINA', cantKg: 0, porc: 50, obs: 'Devolución de cocina 50 porciones Lomo Cerdo' },

  // 13. Higado (CAR-028 Higado) - Fila 14 (Entrada y Devolución)
  { fecha: '2026-09-30', insumo: 'Higado', tipo: 'ENTRADA_COMPRA', cantKg: 5.8, porc: 0, obs: 'Entrada del día 5.8 Kg Higado' },
  { fecha: '2026-09-30', insumo: 'Higado', tipo: 'DEVOLUCION_COCINA', cantKg: 0, porc: 51, obs: 'Devolución de cocina 51 porciones Higado' }
];

async function seedMovimientos30Sep() {
  console.log('--- Iniciando Registro de Movimientos de Bodega 30-Sep (PENDIENTE) ---');

  const { data: catalogo, error: errCat } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, costo_unitario_kg, peso_estandar_porcion_kg');

  if (errCat || !catalogo) {
    console.error('Error cargando catalogo:', errCat);
    process.exit(1);
  }

  const catMap = new Map();
  catalogo.forEach(c => {
    catMap.set(c.nombre.toLowerCase().trim(), c);
  });

  // Limpiar movimientos pendientes existentes en 2026-09-30 si los hubiera
  console.log('Verificando si existen movimientos pendientes previos en 2026-09-30...');
  const { data: existing } = await supabase
    .from('movimientos_inventario')
    .select('id, fecha')
    .eq('fecha', '2026-09-30')
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  if (existing && existing.length > 0) {
    console.log(`Eliminando ${existing.length} movimientos pendientes previos en 2026-09-30...`);
    await supabase
      .from('movimientos_inventario')
      .delete()
      .in('id', existing.map(e => e.id));
  }

  const recordsToInsert = [];

  for (const m of rawMovements30Sep) {
    const itemCat = catMap.get(m.insumo.toLowerCase().trim());
    if (!itemCat) {
      console.error(`❌ Insumo no encontrado en catalogo: "${m.insumo}"`);
      process.exit(1);
    }

    const cantKg = m.cantKg || 0;
    const porciones = m.porc || 0;
    const pesoEstandar = parseFloat(itemCat.peso_estandar_porcion_kg) || 0.25;
    const pesoPorciones = porciones > 0 ? Math.round(porciones * pesoEstandar * 100) / 100 : 0;
    const costoUnitario = parseFloat(itemCat.costo_unitario_kg) || 0;
    const totalPesos = cantKg > 0
      ? Math.round(cantKg * costoUnitario)
      : Math.round((pesoPorciones || porciones) * costoUnitario);

    const fullObs = `[PENDIENTE_APROBAR] ${m.obs} (Planilla 30-Sep)`;

    let origen = 'BODEGA_ENTERO';
    let destino = 'COCINA_ENTERO';

    if (m.tipo === 'ENTRADA_COMPRA') {
      origen = 'PROVEEDOR (Proveedor Local)';
      destino = 'BODEGA_ENTERO';
    } else if (m.tipo === 'TRASLADO_COCINA') {
      if (porciones > 0) {
        origen = 'BODEGA_PORCIONADO';
        destino = 'COCINA_PORCIONADO';
      } else {
        origen = 'BODEGA_ENTERO';
        destino = 'COCINA_ENTERO';
      }
    } else if (m.tipo === 'DEVOLUCION_COCINA') {
      if (porciones > 0) {
        origen = 'COCINA_PORCIONADO';
        destino = 'BODEGA_PORCIONADO';
      } else {
        origen = 'COCINA_ENTERO';
        destino = 'BODEGA_ENTERO';
      }
    }

    const payload = {
      fecha: m.fecha,
      fecha_hora: `${m.fecha}T12:00:00.000Z`,
      tipo_movimiento: m.tipo,
      insumo_id: itemCat.id,
      origen,
      destino,
      cant_sin_porcionar_kg: cantKg,
      porciones_und: porciones,
      peso_porciones_kg: pesoPorciones,
      merma_kg: 0,
      costo_unitario_kg: costoUnitario,
      valor_total_movimiento: totalPesos,
      observaciones: fullObs,
      usuario: 'Bodeguero (Pendiente)'
    };

    recordsToInsert.push(payload);
  }

  console.log(`Total movimientos construidos para 30-Sep: ${recordsToInsert.length}`);

  const { error: insErr } = await supabase.from('movimientos_inventario').insert(recordsToInsert);
  if (insErr) {
    console.error('Error insertando movimientos pendientes de 30-Sep:', insErr);
    process.exit(1);
  }

  console.log('✅ Los 19 movimientos del 30-Sep fueron registrados exitosamente en estado PENDIENTE DE APROBACIÓN!');

  // Validación final
  const { data: checkData } = await supabase
    .from('movimientos_inventario')
    .select('id, tipo_movimiento, porciones_und, cant_sin_porcionar_kg, valor_total_movimiento, catalogo_insumos(nombre)')
    .eq('fecha', '2026-09-30')
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  console.log(`\nVerificación en BD: ${checkData?.length} movimientos pendientes encontrados.`);
  checkData?.forEach(c => {
    const cantStr = c.cant_sin_porcionar_kg > 0 ? `${c.cant_sin_porcionar_kg} Kg` : `${c.porciones_und} und`;
    console.log(`  • [${c.tipo_movimiento}] ${c.catalogo_insumos?.nombre} -> ${cantStr} ($${Number(c.valor_total_movimiento).toLocaleString('es-CO')})`);
  });
}

seedMovimientos30Sep().catch(console.error);
