const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://uexqmrspulhauubzrwyn.supabase.co', 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO');

async function main() {
  const { data, error } = await supabase.from('movimientos_inventario')
    .select('*, catalogo_insumos(nombre)')
    .eq('fecha', '2026-09-02');
  
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Movimientos existentes en 2026-09-02:', data.length);
  data.forEach(m => {
    const nombre = m.catalogo_insumos?.nombre || m.insumo_id;
    console.log(`[ID ${m.id}] ${m.tipo_movimiento} | ${nombre} | ${m.porciones_und || 0} und | ${m.cant_sin_porcionar_kg || 0} kg | obs: ${m.observaciones}`);
  });
}
main();
