import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rawDailyMovements = [
  // ==========================================
  // FECHA: 20 Sep 2026 (CamScanner 22-09-2026 16.24.pdf)
  // ==========================================
  { fecha: '2026-09-20', insumo: 'Gallina', tipo: 'TRASLADO_COCINA', porc: 42, obs: 'Salida a cocina 42 porciones Gallina' },
  { fecha: '2026-09-20', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Sobrebarriga' },
  { fecha: '2026-09-20', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Lengua' },
  { fecha: '2026-09-20', insumo: 'Tamal', tipo: 'TRASLADO_COCINA', porc: 40, obs: 'Salida a cocina 40 porciones Tamal' },
  { fecha: '2026-09-20', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 8, obs: 'Salida a cocina 8 unds Papas Francesa' },
  { fecha: '2026-09-20', insumo: 'Camaron precocido', tipo: 'TRASLADO_COCINA', cantKg: 12.0, obs: 'Salida a cocina 12.0 Kg Camarón' },
  { fecha: '2026-09-20', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 120, obs: 'Salida a cocina 120 unds Huevos' },
  { fecha: '2026-09-20', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 90, obs: 'Salida a cocina 90 porciones Tocino' },
  { fecha: '2026-09-20', insumo: 'Tilapia 350/450', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Tilapia' },
  { fecha: '2026-09-20', insumo: 'Salmon', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Salmón' },
  { fecha: '2026-09-20', insumo: 'Trucha', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Trucha' },
  { fecha: '2026-09-20', insumo: 'Churrasco', tipo: 'TRASLADO_COCINA', porc: 30, obs: 'Salida a cocina 30 porciones Churrasco' },
  { fecha: '2026-09-20', insumo: 'Punta de anca', tipo: 'TRASLADO_COCINA', porc: 30, obs: 'Salida a cocina 30 porciones Punta de Anca' },
  { fecha: '2026-09-20', insumo: 'Baby beef', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Baby Beef' },
  { fecha: '2026-09-20', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 8.0, obs: 'Salida a cocina 8.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-20', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', porc: 26, obs: 'Salida a cocina 26 porciones Costilla San Luis' },
  { fecha: '2026-09-20', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', cantKg: 12.1, obs: 'Salida a cocina 12.1 Kg Lengua entera' },
  { fecha: '2026-09-20', insumo: 'Costilla de res', tipo: 'TRASLADO_COCINA', cantKg: 17.0, obs: 'Salida a cocina 17.0 Kg Costilla Blanca' },
  { fecha: '2026-09-20', insumo: 'Lomo viche', tipo: 'ENTRADA_COMPRA', cantKg: 6.7, obs: 'Entrada del día 6.7 Kg Lomo Viche' },
  { fecha: '2026-09-20', insumo: 'Carne asada', tipo: 'TRASLADO_COCINA', cantKg: 20.0, obs: 'Salida a cocina 20.0 Kg Carne Asada' },

  // ==========================================
  // FECHA: 21 Sep 2026 (CamScanner 22-09-2026 16.06.pdf - Bodeguero Jonathan)
  // ==========================================
  { fecha: '2026-09-21', insumo: 'Morrillo', tipo: 'TRASLADO_COCINA', cantKg: 8.1, obs: 'Salida a cocina 8.1 Kg Morrillo a cocinar' },
  { fecha: '2026-09-21', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 1, obs: 'Salida a cocina 1 und Francesa' },
  { fecha: '2026-09-21', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 4, obs: 'Salida a cocina 4 porciones Lomo Cerdo' },
  { fecha: '2026-09-21', insumo: 'Filete de pollo x 120', tipo: 'TRASLADO_COCINA', porc: 8, obs: 'Salida a cocina 8 porciones Filete Pollo' },
  { fecha: '2026-09-21', insumo: 'Chorizo paisa', tipo: 'TRASLADO_COCINA', porc: 19, obs: 'Salida a cocina 19 porciones Chorizo Paisa' },
  { fecha: '2026-09-21', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', porc: 3, obs: 'Salida a cocina 3 porciones Costilla San Luis' },
  { fecha: '2026-09-21', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Chicharrón/Tocino' },
  { fecha: '2026-09-21', insumo: 'Chorizo grande', tipo: 'TRASLADO_COCINA', porc: 7, obs: 'Salida a cocina 7 porciones Chorizo Grande' },
  { fecha: '2026-09-21', insumo: 'Carne asada', tipo: 'TRASLADO_COCINA', porc: 30, obs: 'Salida a cocina 30 porciones Carne Asar' },

  // ==========================================
  // FECHA: 22 Sep 2026 (CamScanner 23-09-2026 09.54.pdf)
  // ==========================================
  { fecha: '2026-09-22', insumo: 'Costilla de res', tipo: 'TRASLADO_COCINA', porc: 80, obs: 'Salida a cocina 80 porciones Costilla Res' },
  { fecha: '2026-09-22', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 27, obs: 'Salida a cocina 27 porciones Lomo Cerdo' },
  { fecha: '2026-09-22', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 2, obs: 'Salida a cocina 2 unds Papas Francesa' },
  { fecha: '2026-09-22', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-22', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 60, obs: 'Salida a cocina 60 unds Huevos' },
  { fecha: '2026-09-22', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 26.1, obs: 'Salida a cocina 26.1 Kg Sobaco' },
  { fecha: '2026-09-22', insumo: 'Pernil de pollo', tipo: 'ENTRADA_COMPRA', cantKg: 37.0, obs: 'Entrada del día 37.0 Kg Pernil Pollo' },
  { fecha: '2026-09-22', insumo: 'Pernil de pollo', tipo: 'TRASLADO_COCINA', cantKg: 37.0, obs: 'Salida a cocina 37.0 Kg Pernil Pollo' },
  { fecha: '2026-09-22', insumo: 'Pernil de pollo', tipo: 'DEVOLUCION_COCINA', porc: 130, obs: 'Devolución de cocina 130 porciones Pernil Pollo' },
  { fecha: '2026-09-22', insumo: 'Pescado bagre', tipo: 'ENTRADA_COMPRA', cantKg: 20.0, obs: 'Entrada del día 20.0 Kg Bagre' },
  { fecha: '2026-09-22', insumo: 'Pescado bagre', tipo: 'TRASLADO_COCINA', cantKg: 20.0, obs: 'Salida a cocina 20.0 Kg Bagre' }
];

async function seedMovimientos() {
  console.log('=== REGISTRO DE MOVIMIENTOS 20, 21 Y 22 SEP EN ESTADO PENDIENTE DE APROBACIÓN ===');

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

  const datesToProcess = [...new Set(rawDailyMovements.map(m => m.fecha))];
  console.log('Fechas a registrar:', datesToProcess);

  // Limpiar movimientos pendientes existentes en estas fechas si ya se habían insertado previamente
  console.log('Verificando si existen movimientos pendientes previos en estas fechas...');
  const { data: existing } = await supabase
    .from('movimientos_inventario')
    .select('id, fecha')
    .in('fecha', datesToProcess)
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  if (existing && existing.length > 0) {
    console.log(`Eliminando ${existing.length} movimientos pendientes previos en estas fechas...`);
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

  // Inserción en lotes de 50
  for (let i = 0; i < recordsToInsert.length; i += 50) {
    const batch = recordsToInsert.slice(i, i + 50);
    const { error: insErr } = await supabase.from('movimientos_inventario').insert(batch);
    if (insErr) {
      console.error(`Error insertando lote ${i}:`, insErr);
      process.exit(1);
    }
  }

  console.log('✅ Movimientos de 20, 21 y 22 Sep registrados exitosamente en estado PENDIENTE DE APROBACIÓN!');

  // Resumen final de comprobación
  const { data: finalData, error: errSummary } = await supabase
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
