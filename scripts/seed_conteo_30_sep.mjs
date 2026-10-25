import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Ítems del Conteo Físico de Cierre del 30 de Septiembre de 2026
 * Transcripción fiel de la auditoría de bodega de carnes
 */
const rawConteoItems30Sep = [
  // 1. Filete de Pollo: 50 unidades, 17.0 Kilos
  {
    codigo: 'CAR-041',
    nombre: 'Filete de pollox 320 gr',
    cantEnteroKg: 0,
    porcionesUnd: 50,
    pesoPorcKg: 17.0,
    obs: '50 unidades (17.0 Kilos)'
  },
  // 2. Lomo de Cerdo: 18 und 6.2 kg + 50 und 17.2 kg = 68 und, 23.4 kg
  {
    codigo: 'CAR-010',
    nombre: 'Lomo de cerdo',
    cantEnteroKg: 0,
    porcionesUnd: 68,
    pesoPorcKg: 23.4,
    obs: 'Lote 1: 18 und (6.2 kg) + Lote 2: 50 und (17.2 kg)'
  },
  // 3. Alguacil (Pescado Bagre): 40 unidades, 20.0 Kilos
  {
    codigo: 'PES-065',
    nombre: 'Pescado bagre',
    cantEnteroKg: 0,
    porcionesUnd: 40,
    pesoPorcKg: 20.0,
    obs: 'Alguacil (Bagre) 40 unidades (20.0 Kilos)'
  },
  // 4. Hígado: 50 unidades, 5.1 Kilos
  {
    codigo: 'CAR-028',
    nombre: 'Higado',
    cantEnteroKg: 0,
    porcionesUnd: 50,
    pesoPorcKg: 5.1,
    obs: '50 unidades (5.1 Kilos)'
  },
  // 5. Francesa: 1 paquete
  {
    codigo: 'VER-074',
    nombre: 'Papas a la francesa',
    cantEnteroKg: 0,
    porcionesUnd: 1,
    pesoPorcKg: 1.0,
    obs: '1 paquete'
  },
  // 6. Mix Verduras: 5 libras = 2.5 Kilos (5 paquetes de libra)
  {
    codigo: 'VER-084',
    nombre: 'Mix de verduras',
    cantEnteroKg: 0,
    porcionesUnd: 5,
    pesoPorcKg: 2.5,
    obs: '5 libras (2.5 Kilos)'
  },
  // 7. Tocino: 56 unidades 20.9 kg (porciones) + Tocino Junior 6.0 kg (entero)
  {
    codigo: 'CER-075',
    nombre: 'Tocino',
    cantEnteroKg: 6.0,
    porcionesUnd: 56,
    pesoPorcKg: 20.9,
    obs: '56 und porcionadas (20.9 kg) + Tocino Junior 6.0 kg entero'
  },
  // 8. Punta de Anca: 20 und (8.3 kg) + 3 und x 400g (1.2 kg) = 23 und, 9.5 kg
  {
    codigo: 'CAR-033',
    nombre: 'Punta de anca',
    cantEnteroKg: 0,
    porcionesUnd: 23,
    pesoPorcKg: 9.5,
    obs: '20 und estándar (8.3 kg) + 3 und x 400 gr (1.2 kg)'
  },
  // 9. Baby Beef: 3 und x 400g = 3 und, 1.2 kg
  {
    codigo: 'RES-071',
    nombre: 'Baby beef',
    cantEnteroKg: 0,
    porcionesUnd: 3,
    pesoPorcKg: 1.2,
    obs: '3 und x 400 gr (1.2 Kilos)'
  },
  // 10. Tilapia: 6 und 430g (2.58 kg) + 17 und (8.6 kg) = 23 und, 11.18 kg
  {
    codigo: 'PES-067',
    nombre: 'Tilapia 350/450',
    cantEnteroKg: 0,
    porcionesUnd: 23,
    pesoPorcKg: 11.18,
    obs: 'Lote 1: 6 und x 430g (2.58 kg) + Lote 2: 17 und (8.6 kg)'
  },
  // 11. Salmón: 2 und 300g (0.6 kg) + 8 und (3.0 kg) = 10 und, 3.6 kg
  {
    codigo: 'PES-066',
    nombre: 'Salmon',
    cantEnteroKg: 0,
    porcionesUnd: 10,
    pesoPorcKg: 3.6,
    obs: 'Lote 1: 2 und x 300g (0.6 kg) + Lote 2: 8 und (3.0 kg)'
  },
  // 12. Trucha: 5 und 230g (1.15 kg) + 9 und (4.2 kg) = 14 und, 5.35 kg
  {
    codigo: 'PES-069',
    nombre: 'Trucha',
    cantEnteroKg: 0,
    porcionesUnd: 14,
    pesoPorcKg: 5.35,
    obs: 'Lote 1: 5 und x 230g (1.15 kg) + Lote 2: 9 und (4.2 kg)'
  },
  // 13. Churrasco: 20 unidades, 8.1 Kilos
  {
    codigo: 'CAR-026',
    nombre: 'Churrasco',
    cantEnteroKg: 0,
    porcionesUnd: 20,
    pesoPorcKg: 8.1,
    obs: '20 unidades (8.1 Kilos)'
  },
  // 14. Carne Asada: 20 unidades, 2.0 Kilos
  {
    codigo: 'RES-072',
    nombre: 'Carne asada',
    cantEnteroKg: 0,
    porcionesUnd: 20,
    pesoPorcKg: 2.0,
    obs: '20 unidades (2.0 Kilos)'
  },
  // 15. Chorizo Paisa: 120 unidades
  {
    codigo: 'EMB-050',
    nombre: 'Chorizo paisa',
    cantEnteroKg: 0,
    porcionesUnd: 120,
    pesoPorcKg: 0,
    obs: '120 unidades'
  },
  // 16. Chorizo Grande de Cerdo: 12 unidades
  {
    codigo: 'EMB-054',
    nombre: 'Chorizo grande',
    cantEnteroKg: 0,
    porcionesUnd: 12,
    pesoPorcKg: 0,
    obs: '12 unidades'
  },
  // 17. Leche de Coco: 4 Litros
  {
    codigo: 'INS-085',
    nombre: 'Leche de coco',
    cantEnteroKg: 0,
    porcionesUnd: 4,
    pesoPorcKg: 4.0,
    obs: '4 Litros'
  },
  // 18. Sobrebarriga: 7 und (2.1 kg) + Sobrebarriga cocida 7.3 kg (entero)
  {
    codigo: 'CAR-035',
    nombre: 'Sobrebarriga delgada',
    cantEnteroKg: 7.3,
    porcionesUnd: 7,
    pesoPorcKg: 2.1,
    obs: '7 und porcionadas (2.1 kg) + Sobrebarriga cocida 7.3 kg entero'
  },
  // 19. Gallina: 32 presas/porciones (7.5 kg) + Gallina entera 32.7 kg
  {
    codigo: 'CAR-042',
    nombre: 'Gallina',
    cantEnteroKg: 32.7,
    porcionesUnd: 32,
    pesoPorcKg: 7.5,
    obs: '32 porciones (7.5 kg) + 32.7 kg entero'
  },
  // 20. Costilla Ahumada: 16.0 Kilos entero
  {
    codigo: 'CAR-003',
    nombre: 'Costilla ahumada',
    cantEnteroKg: 16.0,
    porcionesUnd: 0,
    pesoPorcKg: 0,
    obs: '16.0 Kilos entero'
  },
  // 21. Panceta: 4.5 Kilos entero
  {
    codigo: 'CAR-011',
    nombre: 'Panceta de cerdo',
    cantEnteroKg: 4.5,
    porcionesUnd: 0,
    pesoPorcKg: 0,
    obs: '4.5 Kilos entero'
  },
  // 22. Pezuña: 0 Kilos
  {
    codigo: 'CAR-013',
    nombre: 'Pezuña',
    cantEnteroKg: 0,
    porcionesUnd: 0,
    pesoPorcKg: 0,
    obs: '0 Kilos (Sin existencias)'
  },
  // 23. Callo: 4.4 Kilos entero
  {
    codigo: 'CAR-021',
    nombre: 'Callo',
    cantEnteroKg: 4.4,
    porcionesUnd: 0,
    pesoPorcKg: 0,
    obs: '4.4 Kilos entero'
  },
  // 24. Lomo Viche: 2.5 Kilos entero
  {
    codigo: 'CAR-030',
    nombre: 'Lomo viche',
    cantEnteroKg: 2.5,
    porcionesUnd: 0,
    pesoPorcKg: 0,
    obs: '2.5 Kilos entero'
  },
  // 25. Sobaco: 21.0 Kilos entero
  {
    codigo: 'CAR-034',
    nombre: 'Sobaco',
    cantEnteroKg: 21.0,
    porcionesUnd: 0,
    pesoPorcKg: 0,
    obs: '21.0 Kilos entero'
  },
  // 26. Costilla San Luis: 5.4 Kilos entero
  {
    codigo: 'CAR-006',
    nombre: 'Costilla san luis',
    cantEnteroKg: 5.4,
    porcionesUnd: 0,
    pesoPorcKg: 0,
    obs: '5.4 Kilos entero'
  }
];

async function seedConteo30Sep() {
  console.log('================================================================');
  console.log(' REGISTRO DE CONTEO FÍSICO CIERRE DE MES (30 DE SEPTIEMBRE 2026)');
  console.log('================================================================');

  // 1. Asegurar catálogo de insumos
  // Verificar si existe 'Leche de coco', si no, insertarlo
  const { data: cocoCheck } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre')
    .ilike('nombre', '%leche de coco%')
    .maybeSingle();

  if (!cocoCheck) {
    console.log('Creando insumo "Leche de coco" (INS-085) en catálogo...');
    const { error: insErr } = await supabase.from('catalogo_insumos').insert([{
      codigo: 'INS-085',
      nombre: 'Leche de coco',
      categoria: 'ELABORADOS',
      unidad_medida: 'Lts',
      tipo_medida: 'UNIDADES',
      costo_unitario_kg: 21000,
      peso_estandar_porcion_kg: 1.0,
      es_carne: false
    }]);
    if (insErr) {
      console.error('Error insertando Leche de coco:', insErr);
      process.exit(1);
    }
    console.log('✅ Insumo "Leche de coco" creado con éxito.');
  }

  // Cargar catálogo completo
  const { data: catalogo, error: errCat } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, tipo_medida, costo_unitario_kg, peso_estandar_porcion_kg');

  if (errCat || !catalogo) {
    console.error('Error cargando catalogo:', errCat);
    process.exit(1);
  }

  const catByCodigo = new Map();
  const catByNombre = new Map();
  catalogo.forEach(c => {
    catByCodigo.set(c.codigo.toUpperCase().trim(), c);
    catByNombre.set(c.nombre.toLowerCase().trim(), c);
  });

  const fechaConteo = '2026-09-30';

  // 2. Limpiar sesión previa si ya existiera para 30-Sep
  const { data: existingSessions } = await supabase
    .from('conteos_fisicos')
    .select('id')
    .eq('fecha', fechaConteo);

  if (existingSessions && existingSessions.length > 0) {
    console.log(`Eliminando ${existingSessions.length} sesión(es) previa(s) de conteo para ${fechaConteo}...`);
    for (const s of existingSessions) {
      await supabase.from('conteos_fisicos_detalle').delete().eq('conteo_id', s.id);
      await supabase.from('conteos_fisicos').delete().eq('id', s.id);
    }
    console.log('✅ Sesión previa eliminada para reemplazo limpio.');
  }

  // 3. Crear cabecera de la sesión de conteo físico
  // Estado: PENDIENTE (Auditoría física sin aplicar que no altera stock_actual ni movimientos)
  // Timestamp: 2026-09-30T23:59:59+00:00 (estrictamente después de los movimientos del 30)
  const { data: sesion, error: errSesion } = await supabase
    .from('conteos_fisicos')
    .insert([{
      fecha: fechaConteo,
      usuario: 'Auditor / Bodega (Cierre 30-Sep)',
      estado: 'PENDIENTE',
      created_at: '2026-09-30T23:59:59+00:00',
      updated_at: '2026-09-30T23:59:59+00:00'
    }])
    .select()
    .single();

  if (errSesion || !sesion) {
    console.error('Error creando sesión de conteo:', errSesion);
    process.exit(1);
  }

  console.log(`✅ Sesión creada con ID: ${sesion.id} (Fecha: ${sesion.fecha})`);

  // 4. Construir detalles a insertar
  const detallesToInsert = [];
  let totalKilosContados = 0;
  let totalPorcionesContadas = 0;
  let totalValorContado = 0;

  for (const item of rawConteoItems30Sep) {
    const c = catByCodigo.get(item.codigo) || catByNombre.get(item.nombre.toLowerCase().trim());
    if (!c) {
      console.error(`❌ Insumo no encontrado: "${item.nombre}" (${item.codigo})`);
      process.exit(1);
    }

    const cantEnteroKg = Number(item.cantEnteroKg || 0);
    const porcionesUnd = Number(item.porcionesUnd || 0);
    const pesoPorcKg = Number(item.pesoPorcKg || 0);
    const costoUnit = Number(c.costo_unitario_kg || 0);
    const isContable = c.tipo_medida === 'UNIDADES' || c.tipo_medida === 'PAQUETES';

    // Cálculo de valor
    const totKg = isContable ? 0 : (cantEnteroKg + pesoPorcKg);
    const valTotal = isContable
      ? Math.round(porcionesUnd * costoUnit)
      : Math.round(totKg * costoUnit);

    totalKilosContados += totKg;
    totalPorcionesContadas += porcionesUnd;
    totalValorContado += valTotal;

    detallesToInsert.push({
      conteo_id: sesion.id,
      insumo_id: c.id,
      ubicacion: 'BODEGA',
      cant_sin_porcionar_kg: cantEnteroKg,
      porciones_und: porcionesUnd,
      peso_porciones_kg: pesoPorcKg,
      costo_unitario_kg: costoUnit,
      valor_total: valTotal,
      created_at: '2026-09-30T23:59:59+00:00'
    });
  }

  const { error: errDetalles } = await supabase
    .from('conteos_fisicos_detalle')
    .insert(detallesToInsert);

  if (errDetalles) {
    console.error('Error insertando detalles:', errDetalles);
    process.exit(1);
  }

  console.log(`✅ ${detallesToInsert.length} ítems de inventario físico registrados con éxito!`);
  console.log(`- Kilos totales contados: ${totalKilosContados.toFixed(2)} Kg`);
  console.log(`- Porciones/Unidades contadas: ${totalPorcionesContadas} und`);
  console.log(`- Valor total del conteo: $${totalValorContado.toLocaleString('es-CO')} COP`);

  // 5. Verificación en BD
  const { data: checkDetalles } = await supabase
    .from('conteos_fisicos_detalle')
    .select(`
      cant_sin_porcionar_kg,
      porciones_und,
      peso_porciones_kg,
      costo_unitario_kg,
      valor_total,
      catalogo_insumos ( codigo, nombre, tipo_medida )
    `)
    .eq('conteo_id', sesion.id);

  console.log('\n--- RESUMEN DEL CONTEO FÍSICO (30-SEP-2026) ---');
  console.table(
    checkDetalles.map(d => ({
      Codigo: d.catalogo_insumos?.codigo,
      Insumo: d.catalogo_insumos?.nombre,
      'Entero (Kg)': d.cant_sin_porcionar_kg,
      'Porc (Und)': d.porciones_und,
      'Peso Porc (Kg)': d.peso_porciones_kg,
      'Costo/Kg o Und': `$${d.costo_unitario_kg}`,
      'Valor Total ($)': `$${Number(d.valor_total).toLocaleString('es-CO')}`
    }))
  );
}

seedConteo30Sep().catch(err => {
  console.error('Error fatal durante la creación del conteo:', err);
  process.exit(1);
});
