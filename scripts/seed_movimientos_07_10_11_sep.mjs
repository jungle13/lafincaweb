import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rawDailyMovements = [
  // ==========================================
  // FECHA: 7 Sep 2026 (CamScanner 24-09-2026 11.25.pdf - Pág 0) - Jonathan Ocampo
  // ==========================================
  { fecha: '2026-09-07', insumo: 'Sobrebarriga delgada', tipo: 'ENTRADA_COMPRA', cantKg: 20.0, obs: 'Entrada del día 20 Kg Sobrebarriga' },
  { fecha: '2026-09-07', insumo: 'Sobaco', tipo: 'ENTRADA_COMPRA', cantKg: 21.0, obs: 'Entrada del día 21 Kg Sobaco' },
  { fecha: '2026-09-07', insumo: 'Morrillo', tipo: 'ENTRADA_COMPRA', cantKg: 5.0, obs: 'Entrada del día 5 Kg Morrillo' },
  { fecha: '2026-09-07', insumo: 'Tocineta barril', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Tocineta barril' },
  { fecha: '2026-09-07', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 8.4, obs: 'Salida a cocina 8.4 Kg Costilla Ahumada' },
  { fecha: '2026-09-07', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 60, obs: 'Salida a cocina 60 unds Huevos' },
  { fecha: '2026-09-07', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 12, obs: 'Salida a cocina 12 porciones Lomo Cerdo' },
  { fecha: '2026-09-07', insumo: 'Filete de pollo x 120', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Filete Pollo' },
  { fecha: '2026-09-07', insumo: 'Costilla de res', tipo: 'ENTRADA_COMPRA', cantKg: 27.0, obs: 'Entrada del día 27 Kg Costilla Res (Para cocinar)' },
  { fecha: '2026-09-07', insumo: 'Morrillo', tipo: 'ENTRADA_COMPRA', cantKg: 11.0, obs: 'Entrada del día 11 Kg Morrillo (Para cocinar)' },
  { fecha: '2026-09-07', insumo: 'Sobaco', tipo: 'ENTRADA_COMPRA', cantKg: 11.0, obs: 'Entrada del día 11 Kg Sobaco (Para cocinar)' },
  { fecha: '2026-09-07', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', porc: 6, obs: 'Salida a cocina 6 porciones Lengua' },

  // ==========================================
  // FECHA: 10 Sep 2026 (CamScanner 24-09-2026 11.25.pdf - Pág 1)
  // ==========================================
  { fecha: '2026-09-10', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-10', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Lomo Cerdo' },
  { fecha: '2026-09-10', insumo: 'Chorizo paisa', tipo: 'TRASLADO_COCINA', porc: 40, obs: 'Salida a cocina 40 porciones Chorizo Paisa' },
  { fecha: '2026-09-10', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 120, obs: 'Salida a cocina 120 unds Huevos' },
  { fecha: '2026-09-10', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 1, obs: 'Salida a cocina 1 und Francesa' },
  { fecha: '2026-09-10', insumo: 'Carne asada', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Carne Asada' },
  { fecha: '2026-09-10', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Lengua' },
  { fecha: '2026-09-10', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Sobrebarriga' },
  { fecha: '2026-09-10', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 29, obs: 'Salida a cocina 29 porciones Tocino' },
  { fecha: '2026-09-10', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 8.2, obs: 'Salida a cocina 8.2 Kg Sobaco' },
  { fecha: '2026-09-10', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', cantKg: 13.0, obs: 'Salida a cocina 13.0 Kg Sobrebarriga' },
  { fecha: '2026-09-10', insumo: 'Costilla de res', tipo: 'TRASLADO_COCINA', cantKg: 17.0, obs: 'Salida a cocina 17.0 Kg Costilla Blanca' },
  { fecha: '2026-09-10', insumo: 'Chorizo de pollo', tipo: 'ENTRADA_COMPRA', cantKg: 0, porc: 7, obs: 'Entrada del día 7 unds Chorizo de Pollo' },
  { fecha: '2026-09-10', insumo: 'Chorizo de pollo', tipo: 'TRASLADO_COCINA', porc: 7, obs: 'Salida a cocina 7 porciones Chorizo de Pollo' },
  { fecha: '2026-09-10', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', cantKg: 37.2, obs: 'Salida a cocina 37.2 Kg Tocino' },
  { fecha: '2026-09-10', insumo: 'Pernil de pollo', tipo: 'ENTRADA_COMPRA', cantKg: 87.3, obs: 'Entrada del día 87.3 Kg Pernil Pollo' },
  { fecha: '2026-09-10', insumo: 'Pernil de pollo', tipo: 'DEVOLUCION_COCINA', porc: 250, obs: 'Devolución de cocina 250 porciones Pernil Pollo' },
  { fecha: '2026-09-10', insumo: 'Lomo de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 16.1, obs: 'Entrada del día 16.1 Kg Lomo Cerdo' },
  { fecha: '2026-09-10', insumo: 'Lomo de cerdo', tipo: 'DEVOLUCION_COCINA', porc: 46, obs: 'Devolución de cocina 46 porciones Lomo Cerdo' },

  // ==========================================
  // FECHA: 11 Sep 2026 (CamScanner 24-09-2026 11.25.pdf - Pág 2)
  // ==========================================
  { fecha: '2026-09-11', insumo: 'Pescado bagre', tipo: 'TRASLADO_COCINA', porc: 40, obs: 'Salida a cocina 40 porciones Bagre' },
  { fecha: '2026-09-11', insumo: 'Costilla de res', tipo: 'TRASLADO_COCINA', cantKg: 13.1, obs: 'Salida a cocina 13.1 Kg Costilla Blanca' },
  { fecha: '2026-09-11', insumo: 'Pernil de pollo', tipo: 'TRASLADO_COCINA', porc: 370, obs: 'Salida a cocina 370 porciones Pernil Pollo' },
  { fecha: '2026-09-11', insumo: 'Punta de anca', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Punta de Anca' },
  { fecha: '2026-09-11', insumo: 'Churrasco', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Churrasco' },
  { fecha: '2026-09-11', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Filete Pollo' },
  { fecha: '2026-09-11', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Lomo Cerdo' },
  { fecha: '2026-09-11', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-11', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', cantKg: 14.0, obs: 'Salida a cocina 14.0 Kg Lengua' },
  { fecha: '2026-09-11', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 8.2, obs: 'Salida a cocina 8.2 Kg Sobaco' },
  { fecha: '2026-09-11', insumo: 'Lomo de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 18.2, obs: 'Entrada del día 18.2 Kg Lomo Cerdo' },
  { fecha: '2026-09-11', insumo: 'Lomo de cerdo', tipo: 'DEVOLUCION_COCINA', porc: 50, obs: 'Devolución de cocina 50 porciones Lomo Cerdo' },
  { fecha: '2026-09-11', insumo: 'Tilapia 350/450', tipo: 'ENTRADA_COMPRA', cantKg: 20.9, obs: 'Entrada del día 20.9 Kg Tilapia' },
  { fecha: '2026-09-11', insumo: 'Tilapia 350/450', tipo: 'DEVOLUCION_COCINA', porc: 40, obs: 'Devolución de cocina 40 porciones Tilapia' },
  { fecha: '2026-09-11', insumo: 'Costilla ahumada', tipo: 'ENTRADA_COMPRA', cantKg: 40.0, obs: 'Entrada del día 40.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-11', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada (Lote Factura)' },
  { fecha: '2026-09-11', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 2, obs: 'Salida a cocina 2 unds Francesa' }
];

async function seedMovimientos() {
  console.log('=== REGISTRO DE MOVIMIENTOS 7, 10 Y 11 SEP (CAMSCANNER 24-09-2026 11.25.PDF) ===');

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

  // Limpiar si existen previos
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
      usuario: m.fecha === '2026-09-07' ? 'Jonathan Ocampo (Pendiente)' : 'Bodeguero (Pendiente)'
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

  console.log('✅ Movimientos de 7, 10 y 11 Sep registrados exitosamente en estado PENDIENTE DE APROBACIÓN!');

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
