import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  const { data: catalogo } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, unidad_medida, tipo_medida, costo_unitario_kg, peso_estandar_porcion_kg')
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true });

  console.log('Total insumos in catalog:', catalogo?.length);
  catalogo?.forEach(c => {
    console.log(`${(c.codigo || '').padEnd(8)} | ${(c.nombre || '').padEnd(32)} | ${(c.categoria || '').padEnd(16)} | ${(c.tipo_medida || c.unidad_medida || '').padEnd(15)} | Std: ${c.peso_estandar_porcion_kg} | $${c.costo_unitario_kg}`);
  });
}

inspect().catch(console.error);
