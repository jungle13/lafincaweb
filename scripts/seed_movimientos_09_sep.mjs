import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rawDailyMovements = [
  // ==========================================
  // FECHA: 9 Sep 2026 (CamScanner 24-09-2026 12.00.pdf)
  // ==========================================
  { fecha: '2026-09-09', insumo: 'Pernil de pollo', tipo: 'TRASLADO_COCINA', porc: 50, obs: 'Salida a cocina 50 porciones Pollo' },
  { fecha: '2026-09-09', insumo: 'Pezuña de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 6.5, obs: 'Entrada del día 6.5 Kg Pezuña' },
  { fecha: '2026-09-09', insumo: 'Pezuña de cerdo', tipo: 'TRASLADO_COCINA', cantKg: 6.5, obs: 'Salida a cocina 6.5 Kg Pezuña' },
  { fecha: '2026-09-09', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-09', insumo: 'Chorizo paisa', tipo: 'TRASLADO_COCINA', porc: 40, obs: 'Salida a cocina 40 porciones Chorizo Paisa' },
  { fecha: '2026-09-09', insumo: 'Chorizo grande', tipo: 'TRASLADO_COCINA', porc: 12, obs: 'Salida a cocina 12 porciones Chorizo Grande' },
  { fecha: '2026-09-09', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Costilla San Luis' },
  { fecha: '2026-09-09', insumo: 'Papas a la francesa', tipo: 'ENTRADA_COMPRA', cantKg: 16.0, obs: 'Entrada del día 16 Kg Francesa' },
  { fecha: '2026-09-09', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 1, obs: 'Salida a cocina 1 und Francesa' },
  { fecha: '2026-09-09', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 30, obs: 'Salida a cocina 30 porciones Tocino' },
  { fecha: '2026-09-09', insumo: 'Lengua de res', tipo: 'ENTRADA_COMPRA', cantKg: 24.0, obs: 'Entrada del día 24.0 Kg Lengua' },
  { fecha: '2026-09-09', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', cantKg: 10.9, obs: 'Salida a cocina 10.9 Kg Lengua' },
  { fecha: '2026-09-09', insumo: 'Sobaco', tipo: 'ENTRADA_COMPRA', cantKg: 22.0, obs: 'Entrada del día 22.0 Kg Sobaco' },
  { fecha: '2026-09-09', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 6.8, obs: 'Salida a cocina 6.8 Kg Sobaco' },
  { fecha: '2026-09-09', insumo: 'Bagre de mar', tipo: 'ENTRADA_COMPRA', cantKg: 18.9, obs: 'Entrada del día 18.9 Kg Alguacil (Bagre de mar)' },
  { fecha: '2026-09-09', insumo: 'Bagre de mar', tipo: 'DEVOLUCION_COCINA', porc: 40, obs: 'Devolución de cocina 40 porciones Alguacil (Bagre de mar)' },
  { fecha: '2026-09-09', insumo: 'Costilla de cerdo especial', tipo: 'ENTRADA_COMPRA', cantKg: 28.6, obs: 'Entrada del día 28.6 Kg Costilla Especial' },
  { fecha: '2026-09-09', insumo: 'Tocineta barril', tipo: 'ENTRADA_COMPRA', cantKg: 68.7, obs: 'Entrada del día 68.7 Kg Tocineta Barril' },
  { fecha: '2026-09-09', insumo: 'Tocineta barril', tipo: 'TRASLADO_COCINA', cantKg: 10.9, obs: 'Salida a cocina 10.9 Kg Tocineta Barril' },
  { fecha: '2026-09-09', insumo: 'Camaron precocido', tipo: 'ENTRADA_COMPRA', cantKg: 20.0, obs: 'Entrada del día 20.0 Kg Camarón' },
  { fecha: '2026-09-09', insumo: 'Trozos de pechuga', tipo: 'ENTRADA_COMPRA', cantKg: 17.0, obs: 'Entrada del día 17.0 Kg Trozos de Pechuga' },
  { fecha: '2026-09-09', insumo: 'Filete de pollox 320 gr', tipo: 'ENTRADA_COMPRA', cantKg: 13.6, obs: 'Entrada del día 13.6 Kg Filete Pollo' },
  { fecha: '2026-09-09', insumo: 'Filete de pollox 320 gr', tipo: 'DEVOLUCION_COCINA', porc: 40, obs: 'Devolución de cocina 40 porciones Filete Pollo' },
  { fecha: '2026-09-09', insumo: 'Lomo de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 27.9, obs: 'Entrada del día 27.9 Kg Lomo Cerdo' },
  { fecha: '2026-09-09', insumo: 'Lomo de cerdo', tipo: 'DEVOLUCION_COCINA', porc: 250, obs: 'Devolución de cocina 250 porciones Lomo Cerdo' },
  { fecha: '2026-09-09', insumo: 'Pernil de pollo', tipo: 'ENTRADA_COMPRA', cantKg: 43.4, obs: 'Entrada del día 43.4 Kg Pernil Pollo' },
  { fecha: '2026-09-09', insumo: 'Pernil de pollo', tipo: 'DEVOLUCION_COCINA', porc: 120, obs: 'Devolución de cocina 120 porciones Pernil Pollo' }
];

async function seedMovimientos() {
  console.log('=== REGISTRO DE MOVIMIENTOS 9 SEP (CAMSCANNER 24-09-2026 12.00.PDF) ===');

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

  const datesToProcess = ['2026-09-09'];
  console.log('Fechas a registrar:', datesToProcess);

  // Limpiar si existen previos en 2026-09-09
  console.log('Verificando si existen movimientos pendientes previos en 2026-09-09...');
  const { data: existing } = await supabase
    .from('movimientos_inventario')
    .select('id, fecha')
    .in('fecha', datesToProcess)
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  if (existing && existing.length > 0) {
    console.log(`Eliminando ${existing.length} movimientos pendientes previos...`);
    await supabase
      .from('movimientos_inventario')
      .delete()
      .in('id', existing.map(e => e.id));
  }

  const recordsToInsert = [];

  for (const m of rawDailyMovements) {
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

    const sheetDay = m.fecha.split('-')[2];
    const fullObs = `[PENDIENTE_APROBAR] ${m.obs} (Planilla ${sheetDay}-Sep)`;

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

  console.log(`Total movimientos construidos: ${recordsToInsert.length}`);

  for (let i = 0; i < recordsToInsert.length; i += 50) {
    const batch = recordsToInsert.slice(i, i + 50);
    const { error: insErr } = await supabase.from('movimientos_inventario').insert(batch);
    if (insErr) {
      console.error(`Error insertando lote ${i}:`, insErr);
      process.exit(1);
    }
  }

  console.log('✅ Movimientos de 9 Sep registrados exitosamente en estado PENDIENTE DE APROBACIÓN!');

  const { data: finalData } = await supabase
    .from('movimientos_inventario')
    .select('fecha, tipo_movimiento')
    .in('fecha', datesToProcess)
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  const summary = {};
  (finalData || []).forEach(f => {
    summary[f.fecha] = (summary[f.fecha] || 0) + 1;
  });

  console.log('\nResumen de movimientos pendientes registrados en Supabase:');
  console.table(summary);
}

seedMovimientos().catch(console.error);
