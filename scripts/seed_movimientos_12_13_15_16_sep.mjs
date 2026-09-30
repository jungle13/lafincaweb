import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rawDailyMovements = [
  // ==========================================
  // FECHA: 12 Sep 2026 (WhatsApp Image 11.05.15 AM.jpeg)
  // ==========================================
  { fecha: '2026-09-12', insumo: 'Gallina', tipo: 'TRASLADO_COCINA', porc: 32, obs: 'Salida a cocina 32 porciones Gallina' },
  { fecha: '2026-09-12', insumo: 'Filete de pollo x 120', tipo: 'TRASLADO_COCINA', porc: 30, obs: 'Salida a cocina 30 porciones Damas' },
  { fecha: '2026-09-12', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', porc: 14, obs: 'Salida a cocina 14 porciones Sobrebarriga' },
  { fecha: '2026-09-12', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 60, obs: 'Salida a cocina 60 unds Huevos' },
  { fecha: '2026-09-12', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 8, obs: 'Salida a cocina 8 unds Papas Francesa' },
  { fecha: '2026-09-12', insumo: 'Punta de anca', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Punta de Anca' },
  { fecha: '2026-09-12', insumo: 'Tilapia 350/450', tipo: 'TRASLADO_COCINA', porc: 14, obs: 'Salida a cocina 14 porciones Tilapia' },
  { fecha: '2026-09-12', insumo: 'Chorizo paisa', tipo: 'TRASLADO_COCINA', porc: 40, obs: 'Salida a cocina 40 porciones Chorizo Paisa' },
  { fecha: '2026-09-12', insumo: 'Camaron precocido', tipo: 'TRASLADO_COCINA', cantKg: 10.0, obs: 'Salida a cocina 10.0 Kg Camarón' },
  { fecha: '2026-09-12', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', cantKg: 20.0, obs: 'Salida a cocina 20.0 Kg Costilla San Luis' },
  { fecha: '2026-09-12', insumo: 'Sobrebarriga delgada', tipo: 'ENTRADA_COMPRA', cantKg: 39.7, obs: 'Entrada del día 39.7 Kg Sobrebarriga' },
  { fecha: '2026-09-12', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', cantKg: 19.1, obs: 'Salida a cocina 19.1 Kg Sobrebarriga' },
  { fecha: '2026-09-12', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 12.0, obs: 'Salida a cocina 12.0 Kg Sobaco' },
  { fecha: '2026-09-12', insumo: 'Callo', tipo: 'ENTRADA_COMPRA', cantKg: 4.6, obs: 'Entrada del día 4.6 Kg Callo' },
  { fecha: '2026-09-12', insumo: 'Huevo', tipo: 'ENTRADA_COMPRA', cantKg: 0, porc: 300, obs: 'Entrada del día 300 unds Huevos' },

  // ==========================================
  // FECHA: 13 Sep 2026 - Pág 1 (WhatsApp Image 11.05.15 AM (1).jpeg)
  // ==========================================
  { fecha: '2026-09-13', insumo: 'Churrasco', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Churrasco (Pág 1)' },
  { fecha: '2026-09-13', insumo: 'Punta de anca', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Punta de Anca (Pág 1)' },
  { fecha: '2026-09-13', insumo: 'Baby beef', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Baby Beef (Pág 1)' },
  { fecha: '2026-09-13', insumo: 'Tilapia 350/450', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Tilapia (Pág 1)' },
  { fecha: '2026-09-13', insumo: 'Salmon', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Salmón (Pág 1)' },
  { fecha: '2026-09-13', insumo: 'Trucha', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Trucha (Pág 1)' },
  { fecha: '2026-09-13', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', porc: 30, obs: 'Salida a cocina 30 porciones Costilla San Luis (Pág 1)' },
  { fecha: '2026-09-13', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 95, obs: 'Salida a cocina 95 porciones Tocino (Pág 1)' },
  { fecha: '2026-09-13', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', cantKg: 59.3, obs: 'Salida a cocina 59.3 Kg Tocino (Pág 1)' },
  { fecha: '2026-09-13', insumo: 'Chorizo grande', tipo: 'TRASLADO_COCINA', porc: 12, obs: 'Salida a cocina 12 porciones Chorizo Grande (Pág 1)' },

  // ==========================================
  // FECHA: 13 Sep 2026 - Pág 2 (WhatsApp Image 11.05.15 AM (2).jpeg)
  // ==========================================
  { fecha: '2026-09-13', insumo: 'Sobaco', tipo: 'ENTRADA_COMPRA', cantKg: 26.7, obs: 'Entrada del día 26.7 Kg Sobaco (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Tocino', tipo: 'ENTRADA_COMPRA', cantKg: 106.3, obs: 'Entrada del día 106.3 Kg Tocino (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Sobrebarriga delgada', tipo: 'ENTRADA_COMPRA', cantKg: 29.9, obs: 'Entrada del día 29.9 Kg Sobrebarriga (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Papas a la francesa', tipo: 'ENTRADA_COMPRA', cantKg: 8.0, obs: 'Entrada del día 8.0 Kg Francesa (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Punta de anca', tipo: 'ENTRADA_COMPRA', cantKg: 11.7, obs: 'Entrada del día 11.7 Kg Punta de Anca (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Costilla san luis', tipo: 'ENTRADA_COMPRA', cantKg: 41.6, obs: 'Entrada del día 41.6 Kg Costilla San Luis (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Mix de verduras', tipo: 'ENTRADA_COMPRA', cantKg: 10.0, obs: 'Entrada del día 20 lb (10 Kg) Mix de Verdura (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Morrillo', tipo: 'ENTRADA_COMPRA', cantKg: 19.2, obs: 'Entrada del día 19.2 Kg Morrillo (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Callo', tipo: 'ENTRADA_COMPRA', cantKg: 9.1, obs: 'Entrada del día 9.1 Kg Callo (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Gallina', tipo: 'TRASLADO_COCINA', porc: 42, obs: 'Salida a cocina 42 porciones Gallina (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Tamal', tipo: 'TRASLADO_COCINA', porc: 50, obs: 'Salida a cocina 50 porciones Tamal (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Sobrebarriga (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 8, obs: 'Salida a cocina 8 unds Francesa (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 90, obs: 'Salida a cocina 90 unds Huevos (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 39, obs: 'Salida a cocina 39 porciones Lomo Cerdo (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', porc: 34, obs: 'Salida a cocina 34 porciones Filete Pollo (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Chorizo paisa', tipo: 'TRASLADO_COCINA', porc: 80, obs: 'Salida a cocina 80 porciones Chorizo Paisa (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Mix de verduras', tipo: 'TRASLADO_COCINA', cantKg: 1.0, porc: 2, obs: 'Salida a cocina 2 lb (1 Kg) Mix de Verdura (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 8.0, obs: 'Salida a cocina 8.0 Kg Costilla Ahumada (Pág 2)' },
  { fecha: '2026-09-13', insumo: 'Camaron precocido', tipo: 'TRASLADO_COCINA', cantKg: 10.0, obs: 'Salida a cocina 10.0 Kg Camarón (Pág 2)' },

  // ==========================================
  // FECHA: 15 Sep 2026 (WhatsApp Image 11.05.15 AM (4).jpeg - Corregido y Alineado)
  // ==========================================
  { fecha: '2026-09-15', insumo: 'Costilla de res', tipo: 'TRASLADO_COCINA', porc: 52, obs: 'Salida a cocina 52 porciones Costilla Res' },
  { fecha: '2026-09-15', insumo: 'Muchacho res', tipo: 'TRASLADO_COCINA', porc: 45, obs: 'Salida a cocina 45 porciones Muchacho' },
  { fecha: '2026-09-15', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Tocino' },
  { fecha: '2026-09-15', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 2, obs: 'Salida a cocina 2 und Francesa' },
  { fecha: '2026-09-15', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-15', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Filete Pollo' },
  { fecha: '2026-09-15', insumo: 'Morrillo', tipo: 'TRASLADO_COCINA', cantKg: 11.4, obs: 'Salida a cocina 11.4 Kg Morrillo' },
  { fecha: '2026-09-15', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 8.1, obs: 'Salida a cocina 8.1 Kg Sobaco' },

  // ==========================================
  // FECHA: 16 Sep 2026 (WhatsApp Image 11.05.15 AM (5).jpeg)
  // ==========================================
  { fecha: '2026-09-16', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Filete Pollo' },
  { fecha: '2026-09-16', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Lomo Cerdo' },
  { fecha: '2026-09-16', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 8.0, obs: 'Salida a cocina 8.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-16', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 1, obs: 'Salida a cocina 1 und Francesa' },
  { fecha: '2026-09-16', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 25, obs: 'Salida a cocina 25 porciones Tocino' },
  { fecha: '2026-09-16', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 60, obs: 'Salida a cocina 60 unds Huevos' },
  { fecha: '2026-09-16', insumo: 'Sobrebarriga delgada', tipo: 'ENTRADA_COMPRA', cantKg: 37.0, obs: 'Entrada del día 37.0 Kg Sobrebarriga' },
  { fecha: '2026-09-16', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', cantKg: 19.7, obs: 'Salida a cocina 19.7 Kg Sobrebarriga' },
  { fecha: '2026-09-16', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Costilla San Luis' },
  { fecha: '2026-09-16', insumo: 'Pescado bagre', tipo: 'ENTRADA_COMPRA', cantKg: 18.2, obs: 'Entrada del día 18.2 Kg Bagre' },
  { fecha: '2026-09-16', insumo: 'Pescado bagre', tipo: 'DEVOLUCION_COCINA', porc: 47, obs: 'Devolución de cocina 47 porciones Bagre' },
  { fecha: '2026-09-16', insumo: 'Gallina', tipo: 'ENTRADA_COMPRA', cantKg: 48.1, obs: 'Entrada del día 48.1 Kg Gallina' },
  { fecha: '2026-09-16', insumo: 'Filete de pollox 320 gr', tipo: 'ENTRADA_COMPRA', cantKg: 16.2, obs: 'Entrada del día 16.2 Kg Filete Pollo' },
  { fecha: '2026-09-16', insumo: 'Filete de pollox 320 gr', tipo: 'DEVOLUCION_COCINA', porc: 45, obs: 'Devolución de cocina 45 porciones Filete Pollo' },
  { fecha: '2026-09-16', insumo: 'Marisco', tipo: 'ENTRADA_COMPRA', cantKg: 5.0, obs: 'Entrada del día 5.0 Kg Marisco' },
  { fecha: '2026-09-16', insumo: 'Salmon', tipo: 'ENTRADA_COMPRA', cantKg: 4.9, obs: 'Entrada del día 4.9 Kg Salmón' },
  { fecha: '2026-09-16', insumo: 'Salmon', tipo: 'DEVOLUCION_COCINA', porc: 15, obs: 'Devolución de cocina 15 porciones Salmón' },
  { fecha: '2026-09-16', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', cantKg: 51.2, obs: 'Salida a cocina 51.2 Kg Tocino' },
  { fecha: '2026-09-16', insumo: 'Higado', tipo: 'ENTRADA_COMPRA', cantKg: 5.0, obs: 'Entrada del día 5.0 Kg Hígado' },
  { fecha: '2026-09-16', insumo: 'Higado', tipo: 'DEVOLUCION_COCINA', porc: 45, obs: 'Devolución de cocina 45 porciones Hígado' },
  { fecha: '2026-09-16', insumo: 'Pernil de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 6.0, obs: 'Entrada del día 6.0 Kg Pernil Cerdo' },
  { fecha: '2026-09-16', insumo: 'Pernil de cerdo', tipo: 'DEVOLUCION_COCINA', porc: 52, obs: 'Devolución de cocina 52 porciones Pernil Cerdo' },
  { fecha: '2026-09-16', insumo: 'Lomo de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 16.4, obs: 'Entrada del día 16.4 Kg Lomo Cerdo' },
  { fecha: '2026-09-16', insumo: 'Lomo de cerdo', tipo: 'DEVOLUCION_COCINA', porc: 40, obs: 'Devolución de cocina 40 porciones Lomo Cerdo' }
];

async function seedMovimientos() {
  console.log('=== REGISTRO DE MOVIMIENTOS FALTANTES 12, 13, 15, 16 SEP EN ESTADO PENDIENTE ===');

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
  console.log('Fechas a registrar/actualizar:', datesToProcess);

  // Limpiar movimientos pendientes existentes en estas fechas específicas
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

  console.log('✅ Movimientos de 12, 13, 15 y 16 Sep registrados exitosamente en estado PENDIENTE DE APROBACIÓN!');

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
