import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const itemsConteo = [
  // ==========================================
  // PÁGINA 0: CARNE UNIDAD (Porciones / Unidades)
  // ==========================================
  { insumo: 'Papas a la francesa', cantKg: 0, porc: 12, obs: '12 paquetes' },
  { insumo: 'Tocino', cantKg: 0, porc: 145, obs: '121 + 24 porciones' },
  { insumo: 'Mix de verduras', cantKg: 0, porc: 10, obs: '10 paquetes' },
  { insumo: 'Pescado bagre', cantKg: 0, porc: 42, obs: 'Alguacil -> es bagre 42 porciones' },
  { insumo: 'Muslos', cantKg: 0, porc: 80, obs: '80 porciones muslos' },
  { insumo: 'Costilla san luis', cantKg: 20.0, porc: 20, obs: '20 porciones + 20 kg entero' },
  { insumo: 'Carne asada', cantKg: 0, porc: 30, obs: '30 porciones' },
  { insumo: 'Lomo de cerdo', cantKg: 0, porc: 2, obs: '2 porciones' },
  { insumo: 'Sobrebarriga delgada', cantKg: 18.0, porc: 0, obs: '18 kg entero (Porciones: Falta)' },
  { insumo: 'Lengua de res', cantKg: 0, porc: 0, obs: 'Falta (0 porciones)' },
  { insumo: 'Baby beef', cantKg: 0, porc: 5, obs: '5 porciones' },

  // ==========================================
  // PÁGINA 1: CARNE KILOS (Entero / Kilos)
  // ==========================================
  { insumo: 'Costilla de cerdo especial', cantKg: 27.0, porc: 0, obs: 'Costilla tamalera 27 kg' },
  { insumo: 'Tocineta barril', cantKg: 89.6, porc: 0, obs: 'Tocino barril 24.8 + 64.8 kg (entró ayer)' },
  { insumo: 'Panceta de cerdo', cantKg: 32.0, porc: 0, obs: 'Panceta cerdo 32 kg' },
  { insumo: 'Camaron precocido', cantKg: 7.9, porc: 0, obs: 'Camarón 7.9 kg' },
  { insumo: 'Lomo viche', cantKg: 2.7, porc: 0, obs: 'Lomo viche 2.7 kg' },
  { insumo: 'Costilla ahumada', cantKg: 4.0, porc: 0, obs: 'Costilla ahumada 4 kg' },
  { insumo: 'Tilapia 350/450', cantKg: 0, porc: 26, obs: '26 tilapias' },
  { insumo: 'Trucha', cantKg: 0, porc: 10, obs: '10 truchas' },
  { insumo: 'Salmon', cantKg: 0, porc: 5, obs: '5 salmones' },
  { insumo: 'Punta de anca', cantKg: 0, porc: 57, obs: '57 porciones punta de anca' },
  { insumo: 'Churrasco', cantKg: 0, porc: 45, obs: '45 porciones churrasco' },
  { insumo: 'Rellena', cantKg: 3.2, porc: 0, obs: 'Rellena 3.2 kg' },
  { insumo: 'Sobaco', cantKg: 26.0, porc: 0, obs: 'Sobaco 26 kg' }
];

async function seedConteoFisico() {
  console.log('=== REGISTRO DE CONTEO FÍSICO 24 DE SEPTIEMBRE DE 2026 ===');

  // 1. Obtener catálogo
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

  const fechaHoy = '2026-09-24';

  // 2. Limpiar sesión previa si ya existía para hoy
  const { data: existingSessions } = await supabase
    .from('conteos_fisicos')
    .select('id')
    .eq('fecha', fechaHoy);

  if (existingSessions && existingSessions.length > 0) {
    console.log(`Eliminando ${existingSessions.length} sesión(es) previa(s) de conteo para ${fechaHoy}...`);
    for (const s of existingSessions) {
      await supabase.from('conteos_fisicos_detalle').delete().eq('conteo_id', s.id);
      await supabase.from('conteos_fisicos').delete().eq('id', s.id);
    }
  }

  // 3. Crear cabecera de la sesión de conteo físico
  const { data: sesion, error: errSesion } = await supabase
    .from('conteos_fisicos')
    .insert([{
      fecha: fechaHoy,
      usuario: 'Bodeguero (Conteo Físico 24-Sep)',
      estado: 'PENDIENTE'
    }])
    .select()
    .single();

  if (errSesion || !sesion) {
    console.error('Error creando sesión de conteo:', errSesion);
    process.exit(1);
  }

  console.log(`✅ Sesión creada con ID: ${sesion.id} (Fecha: ${sesion.fecha})`);

  // 4. Construir detalles
  const detallesToInsert = [];

  for (const item of itemsConteo) {
    const c = catMap.get(item.insumo.toLowerCase().trim());
    if (!c) {
      console.error(`❌ Insumo no encontrado: "${item.insumo}"`);
      process.exit(1);
    }

    const cantKg = item.cantKg || 0;
    const porciones = item.porc || 0;
    const pesoEstandar = parseFloat(c.peso_estandar_porcion_kg) || 0.25;
    const pesoPorciones = porciones > 0 ? Math.round(porciones * pesoEstandar * 100) / 100 : 0;
    const costoUnitario = parseFloat(c.costo_unitario_kg) || 0;
    
    // Valor total estimado
    const valorTotal = cantKg > 0 && porciones > 0
      ? Math.round((cantKg + pesoPorciones) * costoUnitario)
      : cantKg > 0
        ? Math.round(cantKg * costoUnitario)
        : Math.round((pesoPorciones || porciones) * costoUnitario);

    detallesToInsert.push({
      conteo_id: sesion.id,
      insumo_id: c.id,
      ubicacion: 'BODEGA',
      cant_sin_porcionar_kg: cantKg,
      porciones_und: porciones,
      peso_porciones_kg: pesoPorciones,
      costo_unitario_kg: costoUnitario,
      valor_total: valorTotal
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

  // Resumen
  const { data: check } = await supabase
    .from('conteos_fisicos_detalle')
    .select(`
      cant_sin_porcionar_kg,
      porciones_und,
      peso_porciones_kg,
      costo_unitario_kg,
      valor_total,
      catalogo_insumos ( codigo, nombre, unidad_medida )
    `)
    .eq('conteo_id', sesion.id);

  console.log('\nResumen de ítems contados hoy (24-Sep-2026):');
  console.table(
    check.map(d => ({
      Codigo: d.catalogo_insumos?.codigo,
      Insumo: d.catalogo_insumos?.nombre,
      'Entero (Kg)': d.cant_sin_porcionar_kg,
      'Porciones (Und)': d.porciones_und,
      'Peso Porc (Kg)': d.peso_porciones_kg,
      'Costo/Kg': d.costo_unitario_kg,
      'Valor Total': d.valor_total
    }))
  );
}

seedConteoFisico().catch(console.error);
