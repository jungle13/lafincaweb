const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    if (k) env[k] = v;
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Map of Dish POS code -> Array of protein ingredients: { insumoCode, porciones, kgPorPorcion }
const RECETAS_MAPPING = {
  // Desayunos
  '19': [{ ins: 'CAR-043', porc: 2, kg: 0.055 }], // Pericos con arroz: 2 huevos AA (110g)
  '20': [{ ins: 'CAR-043', porc: 2, kg: 0.055 }], // Pericos solos: 2 huevos AA (110g)
  '21': [{ ins: 'CAR-043', porc: 2, kg: 0.055 }], // Perico con arepa: 2 huevos AA (110g)
  '7':  [{ ins: 'CAR-043', porc: 2, kg: 0.055 }], // Cacerola: 2 huevos AA (110g)
  '5':  [ // Calentado ce
    { ins: 'CAR-043', porc: 1, kg: 0.055 }, // 1 huevo AA
    { ins: 'CAR-040', porc: 1, kg: 0.100 }  // 1 chorizo
  ],
  '6':  [ // Calentado especial
    { ins: 'CAR-043', porc: 1, kg: 0.055 }, // 1 huevo AA
    { ins: 'CAR-040', porc: 1, kg: 0.100 }  // 1 chorizo
  ],
  '135': [ // Calentado chorizo
    { ins: 'CAR-043', porc: 1, kg: 0.055 }, // 1 huevo AA
    { ins: 'CAR-040', porc: 1, kg: 0.100 }  // 1 chorizo
  ],
  '136': [ // Calentado chicharron ud
    { ins: 'CAR-043', porc: 1, kg: 0.055 }, // 1 huevo AA
    { ins: 'CAR-021', porc: 1, kg: 0.200 }  // 1 chicharrón (200g)
  ],

  // Especialidades Típicas / Paisas
  '119': [ // Paisa especial
    { ins: 'CAR-021', porc: 1, kg: 0.200 }, // Chicharrón 200g
    { ins: 'CAR-040', porc: 1, kg: 0.100 }, // Chorizo 100g
    { ins: 'CAR-043', porc: 1, kg: 0.055 }  // Huevo AA 55g
  ],
  '93': [ // Paisa economico
    { ins: 'CAR-021', porc: 1, kg: 0.200 }, // Chicharrón 200g
    { ins: 'CAR-040', porc: 1, kg: 0.100 }, // Chorizo 100g
    { ins: 'CAR-043', porc: 1, kg: 0.055 }  // Huevo AA 55g
  ],
  '104': [ // Bandeja sola
    { ins: 'CAR-021', porc: 1, kg: 0.200 }, // Chicharrón 200g
    { ins: 'CAR-040', porc: 1, kg: 0.100 }  // Chorizo 100g
  ],
  '87': [ // Cazuela frijol
    { ins: 'CAR-021', porc: 1, kg: 0.200 }, // Chicharrón 200g
    { ins: 'CAR-040', porc: 1, kg: 0.100 }, // Chorizo 100g
    { ins: 'CAR-043', porc: 1, kg: 0.055 }  // Huevo AA 55g
  ],
  '94':  [{ ins: 'CAR-040', porc: 1, kg: 0.100 }], // Frijolada tradicional (Chorizo 100g)
  '233': [ // Frijolada chicha jun ud
    { ins: 'CAR-021', porc: 1, kg: 0.200 }, // Chicharrón 200g
    { ins: 'CAR-040', porc: 1, kg: 0.100 }  // Chorizo 100g
  ],
  '217': [ // Frijolada especial
    { ins: 'CAR-021', porc: 1, kg: 0.200 }, // Chicharrón 200g
    { ins: 'CAR-040', porc: 1, kg: 0.100 }  // Chorizo 100g
  ],
  '218': [ // Frijolada molida
    { ins: 'CAR-040', porc: 1, kg: 0.100 }, // Chorizo 100g
    { ins: 'CAR-002', porc: 1, kg: 0.100 }  // Carne molida 100g
  ],

  // Tamales
  '113': [{ ins: 'CAR-156', porc: 1, kg: 0.450 }], // Tamal tradicional (450g)
  '256': [{ ins: 'CAR-156', porc: 1, kg: 0.400 }], // Tamal ejecutivo (400g)

  // Res a la Parrilla & Carta
  '41':  [{ ins: 'CAR-004', porc: 1, kg: 0.400 }], // Churrasco 400 gr apr ud
  '140': [{ ins: 'CAR-004', porc: 2, kg: 0.400 }], // Prom churrasco (2 cortes x 400g = 800g)
  '227': [{ ins: 'CAR-004', porc: 2, kg: 0.400 }], // Prom churrasco (2 cortes)
  '50':  [{ ins: 'CAR-005', porc: 1, kg: 0.400 }], // Punta de anca 400
  '226': [{ ins: 'CAR-005', porc: 2, kg: 0.400 }], // Prom punta de anca (2 cortes)
  '40':  [{ ins: 'CAR-007', porc: 1, kg: 0.400 }], // Baby beef 400 gr apr ud
  '228': [{ ins: 'CAR-007', porc: 2, kg: 0.400 }], // Prom baby beef (2 cortes)
  '117': [{ ins: 'CAR-003', porc: 1, kg: 0.400 }], // Sobre domingo
  '28':  [{ ins: 'CAR-003', porc: 1, kg: 0.400 }], // Sobrebarriga
  '118': [{ ins: 'CAR-008', porc: 1, kg: 0.200 }], // Lengua domingo
  '16':  [{ ins: 'CAR-008', porc: 1, kg: 0.200 }], // Lengua menú
  '18':  [{ ins: 'CAR-009', porc: 1, kg: 0.120 }], // Morrillo
  '17':  [{ ins: 'CAR-010', porc: 1, kg: 0.250 }], // Muchacho
  '3':   [{ ins: 'CAR-013', porc: 1, kg: 0.100 }], // Asada menú (100g)
  '8':   [{ ins: 'CAR-002', porc: 1, kg: 0.100 }], // Carne molida (100g)
  '1':   [{ ins: 'CAR-002', porc: 1, kg: 0.150 }], // Albondigas (150g)
  '2':   [{ ins: 'CAR-014', porc: 1, kg: 0.115 }], // Bistec higado (115g)
  '4':   [{ ins: 'CAR-001', porc: 1, kg: 0.100 }], // Desmechada menú (100g)
  '114': [{ ins: 'CAR-001', porc: 1, kg: 0.100 }], // Porc desmechada (100g)
  '209': [{ ins: 'CAR-013', porc: 1, kg: 0.150 }], // Gulash de carne (150g)
  '15':  [{ ins: 'CAR-012', porc: 1, kg: 0.350 }], // Costilla de res (350g)
  '266': [{ ins: 'CAR-016', porc: 1, kg: 0.500 }], // Pezuña de res / pata (500g)

  // Cerdo & Chicharrones
  '44':  [{ ins: 'CAR-018', porc: 1, kg: 0.500 }], // Costilla c san luis (500g)
  '42':  [{ ins: 'CAR-019', porc: 1, kg: 0.400 }], // Costilla ahumada (400g)
  '221': [{ ins: 'CAR-019', porc: 2, kg: 0.400 }], // Prom costill ahumada ud (800g)
  '11':  [{ ins: 'CAR-017', porc: 1, kg: 0.300 }], // Costilla horno (300g)
  '13':  [{ ins: 'CAR-020', porc: 1, kg: 0.200 }], // Cerdo ejecutivo (200g)
  '14':  [{ ins: 'CAR-020', porc: 1, kg: 0.250 }], // Chuleta de cerdo (250g)
  '46':  [{ ins: 'CAR-020', porc: 1, kg: 0.350 }], // Lomo cerdo espec (350g)
  '215': [{ ins: 'CAR-020', porc: 1, kg: 0.350 }], // Super de cerdo (350g)
  '219': [{ ins: 'CAR-020', porc: 2, kg: 0.250 }], // Prom chuleta cerdo (500g)
  '225': [{ ins: 'CAR-020', porc: 2, kg: 0.350 }], // Prom lomo cerdo (700g)
  '83':  [{ ins: 'CAR-021', porc: 1, kg: 0.400 }], // Chichacharron grand (400g)
  '112': [{ ins: 'CAR-021', porc: 2, kg: 0.350 }], // Mega chicharrn 700 g ud (700g)

  // Pollo & Aves
  '214': [{ ins: 'CAR-027', porc: 1, kg: 0.350 }], // Super de pollo (350g)
  '45':  [{ ins: 'CAR-027', porc: 1, kg: 0.350 }], // Filete pechuga espec ud (350g)
  '26':  [{ ins: 'CAR-027', porc: 1, kg: 0.200 }], // Filete ejecutivo (200g)
  '27':  [{ ins: 'CAR-027', porc: 1, kg: 0.250 }], // Chuleta de pollo (250g)
  '145': [{ ins: 'CAR-027', porc: 1, kg: 0.350 }], // Pollo sudado (350g)
  '105': [{ ins: 'CAR-032', porc: 1, kg: 0.250 }], // Cordon blue (250g)
  '51':  [{ ins: 'CAR-030', porc: 1, kg: 0.250 }], // Junior ala (250g)
  '88':  [{ ins: 'CAR-031', porc: 1, kg: 0.400 }], // Junior gallina (400g)
  '92':  [{ ins: 'CAR-027', porc: 1, kg: 0.150 }], // Arroz pollo (150g)
  '220': [{ ins: 'CAR-027', porc: 2, kg: 0.250 }], // Prom chuleta pollo (500g)
  '224': [{ ins: 'CAR-027', porc: 2, kg: 0.350 }], // Prom filete pollo (700g)

  // Pescados & Mariscos
  '96':  [{ ins: 'CAR-034', porc: 1, kg: 0.440 }], // Tilapia grande 450 g ud (440g)
  '222': [{ ins: 'CAR-034', porc: 2, kg: 0.440 }], // Prom tilapia (880g)
  '68':  [ // Tilapia salsa camaro ud
    { ins: 'CAR-034', porc: 1, kg: 0.440 }, // Tilapia entera (440g)
    { ins: 'CAR-038', porc: 1, kg: 0.100 }  // Camarón salsa (100g)
  ],
  '22':  [{ ins: 'CAR-034', porc: 1, kg: 0.250 }], // Pescado sudado (250g)
  '239': [{ ins: 'CAR-034', porc: 1, kg: 0.250 }], // Pez frito (250g)
  '29':  [{ ins: 'CAR-034', porc: 1, kg: 0.250 }], // Chuleta pescado (250g)
  '255': [{ ins: 'CAR-036', porc: 1, kg: 0.240 }], // Trucha arcoíris (240g)
  '67':  [ // Trucha salsa camaron ud
    { ins: 'CAR-036', porc: 1, kg: 0.240 }, // Trucha entera (240g)
    { ins: 'CAR-038', porc: 1, kg: 0.100 }  // Camarón salsa (100g)
  ],
  '120': [{ ins: 'CAR-035', porc: 1, kg: 0.300 }], // Salmon espec (300g)
  '129': [ // Salmon salsa camaron ud
    { ins: 'CAR-035', porc: 1, kg: 0.300 }, // Salmón (300g)
    { ins: 'CAR-038', porc: 1, kg: 0.100 }  // Camarón salsa (100g)
  ],
  '12':  [{ ins: 'CAR-038', porc: 1, kg: 0.150 }], // Arroz con camaron (150g)
  '128': [{ ins: 'CAR-038', porc: 1, kg: 0.150 }], // Seviche camaron (150g)
  '311': [{ ins: 'CAR-038', porc: 1, kg: 0.180 }], // Cazuela de camaron (180g)
  '206': [{ ins: 'CAR-039', porc: 1, kg: 0.200 }], // Cazuela mariscos (200g)
  '223': [{ ins: 'CAR-039', porc: 2, kg: 0.200 }], // Promo cazuela (400g)
  '207': [{ ins: 'CAR-039', porc: 1, kg: 0.150 }], // Arroz mixto (150g)

  // Platos Combinados / Picadas
  '47': [ // Picada dos
    { ins: 'CAR-040', porc: 1, kg: 0.100 }, // 1 Chorizo
    { ins: 'CAR-021', porc: 1, kg: 0.200 }, // Chicharrón 200g
    { ins: 'CAR-013', porc: 1, kg: 0.100 }  // Carne de res 100g
  ],
  '48': [ // Picada cuatro
    { ins: 'CAR-040', porc: 2, kg: 0.100 }, // 2 Chorizos (200g)
    { ins: 'CAR-021', porc: 2, kg: 0.200 }, // 2 Chicharrones (400g)
    { ins: 'CAR-013', porc: 2, kg: 0.100 }  // 2 Carnes de res (200g)
  ],
  '229': [ // Promo chuleta mix
    { ins: 'CAR-020', porc: 1, kg: 0.250 }, // Chuleta cerdo (250g)
    { ins: 'CAR-027', porc: 1, kg: 0.250 }  // Chuleta pollo (250g)
  ]
};

async function seed() {
  console.log('--- Iniciando vinculación de recetas oficiales ---');

  const { data: platos, error: errPlatos } = await supabase.from('productos_venta').select('id, codigo, nombre, es_receta');
  if (errPlatos) throw errPlatos;

  const { data: insumos, error: errIns } = await supabase.from('catalogo_insumos').select('id, codigo, nombre, costo_unitario_kg');
  if (errIns) throw errIns;

  const insumoByCodigo = new Map(insumos.map(i => [i.codigo, i]));
  const platoByCodigo = new Map(platos.map(p => [p.codigo, p]));

  // Clear existing recetas_detalle
  console.log('Limpiando recetas_detalle existentes...');
  const { error: errDel } = await supabase.from('recetas_detalle').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (errDel) console.warn('Aviso delete:', errDel.message);

  const rowsToInsert = [];
  let mappedDishes = 0;

  for (const [posCode, components] of Object.entries(RECETAS_MAPPING)) {
    const plato = platoByCodigo.get(posCode);
    if (!plato) {
      console.warn(`Plato código ${posCode} no encontrado en base de datos`);
      continue;
    }

    mappedDishes++;

    for (const comp of components) {
      const insumo = insumoByCodigo.get(comp.ins);
      if (!insumo) {
        console.warn(`Insumo código ${comp.ins} no encontrado para plato ${plato.nombre} (#${posCode})`);
        continue;
      }

      rowsToInsert.push({
        plato_id: plato.id,
        insumo_id: insumo.id,
        porciones_por_plato: comp.porc,
        cantidad_por_porcion_kg: comp.kg
      });
    }
  }

  console.log(`Total registros a insertar en recetas_detalle: ${rowsToInsert.length} para ${mappedDishes} platos`);

  // Insert in batches of 50
  for (let i = 0; i < rowsToInsert.length; i += 50) {
    const batch = rowsToInsert.slice(i, i + 50);
    const { error: errInsBatch } = await supabase.from('recetas_detalle').insert(batch);
    if (errInsBatch) {
      console.error('Error insertando lote de recetas_detalle:', errInsBatch);
      throw errInsBatch;
    }
  }

  console.log('¡Vinculación de recetas completada exitosamente!');

  // Verify count
  const { count } = await supabase.from('recetas_detalle').select('*', { count: 'exact', head: true });
  console.log(`Verificación final: ${count} registros en recetas_detalle`);
}

seed().catch(err => {
  console.error('Fallo en seed:', err);
  process.exit(1);
});
