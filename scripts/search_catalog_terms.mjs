import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function searchInsumos() {
  const terms = ['coco', 'ahumad', 'sobre', 'alguacil', 'junior', 'paisa', 'cerdo', 'salmon', 'trucha', 'tilapia', 'punta', 'baby', 'lech'];
  const { data: all } = await supabase.from('catalogo_insumos').select('*');
  
  console.log(`Total in catalog: ${all?.length}`);
  for (const term of terms) {
    const matches = (all || []).filter(c => c.nombre.toLowerCase().includes(term) || c.codigo.toLowerCase().includes(term));
    console.log(`\n--- Term: "${term}" (${matches.length} matches) ---`);
    matches.forEach(m => console.log(`  [${m.codigo}] ${m.nombre} | Cat: ${m.categoria} | Tipo: ${m.tipo_medida} | PesoStd: ${m.peso_estandar_porcion_kg} | Costo: ${m.costo_unitario_kg}`));
  }
}

searchInsumos().catch(console.error);
