import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Movimientos extraídos fielmente de la planilla física de bodega:
 * REPORTE DIARIO DE MOVIMIENTOS DE BODEGA - 2026 (FECHA: 29 SEP)
 * Archivo fuente: CamScanner 01-10-2026 09.13.pdf / DOCUMENTOS BASE/Movimientos/29.jpeg
 */
const rawMovements29Sep = [
  // 1. Costilla Res (CAR-027 Costilla de res) - Fila 1
  { fecha: '2026-09-29', insumo: 'Costilla de res', tipo: 'ENTRADA_COMPRA', cantKg: 28.1, porc: 0, obs: 'Entrada del día 28.1 Kg Costilla Res' },
  { fecha: '2026-09-29', insumo: 'Costilla de res', tipo: 'TRASLADO_COCINA', cantKg: 28.1, porc: 89, obs: 'Salida a cocina 89 porciones Costilla Res (28.1 Kg)' },
  { fecha: '2026-09-29', insumo: 'Costilla de res', tipo: 'DEVOLUCION_COCINA', cantKg: 0, porc: 89, obs: 'Devolución de cocina 89 porciones Costilla Res' },

  // 2. Morrillo (CAR-031 Morrillo) - Fila 2
  { fecha: '2026-09-29', insumo: 'Morrillo', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 60, obs: 'Salida a cocina 60 porciones Morrillo' },

  // 3. Filete Pollo (CAR-041 Filete de pollox 320 gr) - Fila 3
  { fecha: '2026-09-29', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 11, obs: 'Salida a cocina 11 porciones Filete Pollo' },

  // 4. Tocino (CER-075 Tocino) - Fila 4 (10 porciones, 5.6 Kg)
  { fecha: '2026-09-29', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', cantKg: 5.6, porc: 10, obs: 'Salida a cocina 10 porciones Tocino (5.6 Kg)' },

  // 5. Huevos (CAR-047 / INS-046 Huevo) - Fila 5
  { fecha: '2026-09-29', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 60, obs: 'Salida a cocina 60 unds Huevos' },

  // 6. Francesa (VER-074 Papas a la francesa) - Fila 6
  { fecha: '2026-09-29', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', cantKg: 0, porc: 8, obs: 'Salida a cocina 8 paq Papa Francesa' },

  // 7. Caderita (CAR-020 Caderita) - Fila 7 (Entrada y Devolución)
  { fecha: '2026-09-29', insumo: 'Caderita', tipo: 'ENTRADA_COMPRA', cantKg: 4.1, porc: 0, obs: 'Entrada del día 4.1 Kg Caderita' },
  { fecha: '2026-09-29', insumo: 'Caderita', tipo: 'DEVOLUCION_COCINA', cantKg: 0, porc: 40, obs: 'Devolución de cocina 40 porciones Caderita' },

  // 8. Tocino (CER-075 Tocino) - Fila 8 (32.1 Kg entero)
  { fecha: '2026-09-29', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', cantKg: 32.1, porc: 0, obs: 'Salida a cocina 32.1 Kg Tocino' }
];

async function seedMovimientos29Sep() {
  console.log('--- Iniciando Registro de Movimientos de Bodega 29-Sep (PENDIENTE) ---');

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

  // Limpiar movimientos pendientes previos en 2026-09-29 si existieran
  console.log('Verificando si existen movimientos pendientes previos en 2026-09-29...');
  const { data: existing } = await supabase
    .from('movimientos_inventario')
    .select('id, fecha')
    .eq('fecha', '2026-09-29')
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  if (existing && existing.length > 0) {
    console.log(`Eliminando ${existing.length} movimientos pendientes previos en 2026-09-29...`);
    await supabase
      .from('movimientos_inventario')
      .delete()
      .in('id', existing.map(e => e.id));
  }

  const recordsToInsert = [];

  for (const m of rawMovements29Sep) {
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

    const fullObs = `[PENDIENTE_APROBAR] ${m.obs} (Planilla 29-Sep)`;

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

  console.log(`Total movimientos construidos para 29-Sep: ${recordsToInsert.length}`);

  const { error: insErr } = await supabase.from('movimientos_inventario').insert(recordsToInsert);
  if (insErr) {
    console.error('Error insertando movimientos pendientes de 29-Sep:', insErr);
    process.exit(1);
  }

  console.log('✅ Los 11 movimientos del 29-Sep fueron registrados exitosamente en estado PENDIENTE DE APROBACIÓN!');

  // Validación final
  const { data: checkData } = await supabase
    .from('movimientos_inventario')
    .select('id, tipo_movimiento, porciones_und, cant_sin_porcionar_kg, valor_total_movimiento, catalogo_insumos(nombre)')
    .eq('fecha', '2026-09-29')
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  console.log(`\nVerificación en BD: ${checkData?.length} movimientos pendientes encontrados.`);
  checkData?.forEach(c => {
    const cantStr = c.cant_sin_porcionar_kg > 0 ? `${c.cant_sin_porcionar_kg} Kg` : `${c.porciones_und} und`;
    console.log(`  • [${c.tipo_movimiento}] ${c.catalogo_insumos?.nombre} -> ${cantStr} ($${Number(c.valor_total_movimiento).toLocaleString('es-CO')})`);
  });
}

seedMovimientos29Sep().catch(console.error);
