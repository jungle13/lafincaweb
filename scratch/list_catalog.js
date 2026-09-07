const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://uexqmrspulhauubzrwyn.supabase.co', 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO');

async function main() {
  const { data: insumos } = await supabase.from('catalogo_insumos').select('id, nombre, categoria, peso_estandar_porcion_kg, costo_unitario_kg');
  insumos.sort((a,b) => a.nombre.localeCompare(b.nombre));
  insumos.forEach(i => console.log(`${i.id} | ${i.nombre} | ${i.categoria} | ${i.peso_estandar_porcion_kg} | $${i.costo_unitario_kg}`));
}
main();
