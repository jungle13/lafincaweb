import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Definición de bebidas con su nombre estándar, código de catálogo (si aplica) y costo unitario real por unidad
const BEBIDA_META = {
  poker:       { nombre: 'Cerveza Poker (Lata 330 ml)',           codigo: 'BEB-087', cu: 3104 },
  club:        { nombre: 'Cerveza Club Colombia Dorada (Lata 330 ml)', codigo: 'BEB-089', cu: 3229 },
  corona:      { nombre: 'Cerveza Corona Extra (Botella 330 ml)', codigo: 'BEB-090', cu: 3875 },
  coronita:    { nombre: 'Cerveza Coronita (Botella 210 ml)',     codigo: 'BEB-091', cu: 3458 },
  costenita:   { nombre: 'Cerveza Costeñita (Botella 175 ml)',    codigo: 'BEB-092', cu: 2904 },
  guarapo:     { nombre: 'Guarapo Tradicional La Finca',          codigo: 'BEB-094', cu: 7500 },
  gatorade:    { nombre: 'Gatorade Sabores PET 500 ml',           codigo: 'BEB-104', cu: 2695 },
  mrtea:       { nombre: 'Mr Tea Limón / Durazno PET 500 ml',     codigo: 'BEB-105', cu: 2250 },
  malta:       { nombre: 'Pony Malta PET 330 ml',                 codigo: 'BEB-106', cu: 2538 },
  vive100:     { nombre: 'Vive 100 Energizante PET 380 ml',       codigo: 'BEB-107', cu: 2150 },
  h2oh:        { nombre: 'H2OH! Sabores PET 600 ml',              codigo: 'BEB-102', cu: 2160 },
  cuarto:      { nombre: 'Gaseosa Postobón 1/4 (250 ml Vidrio)',  codigo: 'BEB-098', cu: 1727 },
  agua:        { nombre: 'Agua Cristal / Brisa PET 600 ml',       codigo: 'BEB-100', cu: 1333 },
  pet400:      { nombre: 'Gaseosa Coca-Cola / Sabores PET 400 ml',codigo: 'BEB-095', cu: 2500 },
  cocacola:    { nombre: 'Coca-Cola Vidrio Retornable 350 ml',    codigo: 'BEB-097', cu: 2083 },
  hitnr:       { nombre: 'Jugo Hit Sabores PET 500 ml',           codigo: 'BEB-108', cu: 2500 },
  litros3:     { nombre: 'Gaseosa Mega 3 Litros PET',             codigo: 'BEB-099', cu: 9583 },
  ginger:      { nombre: 'Canada Dry / Ginger 300 ml',            codigo: 'BEB-103', cu: 2083 },
  soda:        { nombre: 'Soda Bretaña Vidrio Retornable 350 ml', codigo: 'BEB-101', cu: 1917 },
  vidrio350:   { nombre: 'Gaseosa Postobón Vidrio Retornable 350 ml', codigo: 'BEB-096', cu: 1500 },
  hitnrlitro:  { nombre: 'Jugo Hit Naranja 1000 ml Pet',          codigo: null,      cu: 3333 },
  speed:       { nombre: 'Energizante Speed Max 310 ml Lata',     codigo: null,      cu: 1667 },
  avena:       { nombre: 'Avena (Bebida Bodega)',                 codigo: null,      cu: 0 },
  hojuelas:    { nombre: 'Hojuelas (Bebida Bodega)',              codigo: null,      cu: 0 },
  mixcereal:   { nombre: 'Mix Cereal (Bebida Bodega)',            codigo: null,      cu: 0 },
  tangelo:     { nombre: 'Jugo Tangelo',                          codigo: 'DIR-038', cu: 1309 },
  inmunocal:   { nombre: 'Inmunocal (Bebida Bodega)',             codigo: null,      cu: 0 },
};

// Cierres diarios ("final") extraídos directamente de CUADERNOS/BEBIDAS (1-6.pdf, 6-9.pdf, 11.jpeg)
const CIERRES_POR_DIA = {
  '2026-11-01': {
    poker: 45, club: 17, corona: 42, coronita: 26, costenita: 35, guarapo: 24, gatorade: 26,
    mrtea: 10, malta: 6, vive100: 28, h2oh: 31, cuarto: 70, agua: 126, pet400: 78, cocacola: 62,
    hitnr: 37, litros3: 9, ginger: 8, soda: 40, avena: 2, hojuelas: 2, mixcereal: 1, tangelo: 3,
  },
  '2026-11-02': {
    poker: 33, club: 15, corona: 39, coronita: 26, costenita: 35, guarapo: 23, gatorade: 25,
    mrtea: 8, malta: 4, vive100: 28, h2oh: 28, cuarto: 61, agua: 165, pet400: 136, cocacola: 58,
    hitnr: 34, litros3: 9, ginger: 7, soda: 34, vidrio350: 93, avena: 2, hojuelas: 2, mixcereal: 1,
    tangelo: 3, inmunocal: 3,
  },
  '2026-11-03': {
    poker: 33, club: 12, corona: 34, coronita: 26, costenita: 35, guarapo: 23, gatorade: 25,
    mrtea: 8, malta: 4, vive100: 28, h2oh: 28, cuarto: 58, agua: 160, pet400: 129, cocacola: 58,
    hitnr: 33, litros3: 9, ginger: 7, soda: 33, vidrio350: 92, avena: 2, hojuelas: 1, mixcereal: 1,
    tangelo: 3, inmunocal: 3,
  },
  '2026-11-04': {
    poker: 33, club: 10, corona: 35, coronita: 26, costenita: 35, guarapo: 23, gatorade: 23,
    mrtea: 7, vive100: 25, h2oh: 25, cuarto: 50, agua: 146, pet400: 124, cocacola: 54,
    hitnr: 32, litros3: 9, ginger: 7, soda: 32, vidrio350: 90, avena: 4, hojuelas: 1, mixcereal: 1,
    tangelo: 3, inmunocal: 3,
  },
  '2026-11-05': {
    poker: 32, club: 10, corona: 34, coronita: 26, costenita: 35, guarapo: 20, gatorade: 22,
    mrtea: 6, vive100: 25, h2oh: 24, cuarto: 73, agua: 103, pet400: 113, cocacola: 52,
    hitnr: 29, litros3: 8, ginger: 7, soda: 32, vidrio350: 85, avena: 4, hojuelas: 1, mixcereal: 1,
    tangelo: 3, inmunocal: 3,
  },
  '2026-11-06': {
    poker: 31, club: 9, corona: 32, coronita: 23, costenita: 35, guarapo: 20, gatorade: 20,
    vive100: 24, mrtea: 6, agua: 112, cuarto: 69, pet400: 102, cocacola: 49, h2oh: 23,
    hitnr: 29, litros3: 7, ginger: 6, soda: 29, vidrio350: 82, avena: 4, hojuelas: 1, mixcereal: 1,
    tangelo: 2, inmunocal: 3,
  },
  // Días 7 y 9 solo tienen columna "inicio" diligenciada (sin "final")
  '2026-11-08': {
    poker: 46, club: 49, corona: 45, coronita: 23, costenita: 30, guarapo: 17, gatorade: 29,
    malta: 20, mrtea: 5, vive100: 23, agua: 118, cuarto: 59, pet400: 71, cocacola: 38, h2oh: 33,
    hitnr: 24, ginger: 4, soda: 48, vidrio350: 145, hitnrlitro: 3, speed: 4, avena: 3, inmunocal: 3,
  },
  '2026-11-11': {
    poker: 39, club: 46, corona: 43, coronita: 21, costenita: 30, guarapo: 17, gatorade: 23,
    malta: 16, mrtea: 4, vive100: 20, agua: 101, cuarto: 63, pet400: 136, cocacola: 34, h2oh: 30,
    hitnr: 22, litros3: 6, ginger: 4, soda: 38, vidrio350: 62, hitnrlitro: 2, speed: 4, avena: 2,
    inmunocal: 3,
  },
};

async function run() {
  console.log('====================================================================');
  console.log('🥤 IMPORTANDO BODEGA CIERRE BEBIDAS - NOVIEMBRE 2026');
  console.log('====================================================================\n');

  const { data: cat } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre')
    .ilike('categoria', '%bebida%');

  const codeToId = new Map();
  (cat || []).forEach((c) => {
    if (c.codigo) codeToId.set(c.codigo, c.id);
  });

  let totalInserted = 0;

  for (const [fecha, counts] of Object.entries(CIERRES_POR_DIA)) {
    // Limpiar solo BODEGA_CIERRE de bebidas en esta fecha (preservando carnes/pescados)
    await supabase
      .from('registros_costeo_cocina')
      .delete()
      .eq('fecha', fecha)
      .eq('tipo', 'BODEGA_CIERRE')
      .in('categoria', ['Bebidas y Licores', 'BEBIDAS']);

    const rows = [];
    for (const [key, qty] of Object.entries(counts)) {
      if (!qty || qty <= 0) continue;
      const meta = BEBIDA_META[key];
      if (!meta) continue;
      rows.push({
        fecha,
        tipo: 'BODEGA_CIERRE',
        insumo_id: meta.codigo ? codeToId.get(meta.codigo) || null : null,
        nombre_insumo: meta.nombre,
        categoria: 'Bebidas y Licores',
        cantidad: qty,
        unidad: 'Und',
        costo_unitario: meta.cu,
        valor_total: Math.round(qty * meta.cu),
        observaciones: 'Conteo diario Cuaderno Bebidas (Cierre Bodega)',
      });
    }

    const { error } = await supabase.from('registros_costeo_cocina').insert(rows);
    if (error) {
      console.error(`❌ Error en ${fecha}:`, error.message);
    } else {
      const totalVal = rows.reduce((a, r) => a + r.valor_total, 0);
      totalInserted += rows.length;
      console.log(`✅ ${fecha}: ${rows.length} bebidas en Bodega Cierre ($${totalVal.toLocaleString('es-CO')} COP)`);
    }
  }

  console.log(`\n🎉 Total registros de bebidas insertados: ${totalInserted}`);
}

run().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
