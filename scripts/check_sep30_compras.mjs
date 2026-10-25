import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data } = await supabase
    .from('transacciones_gastos_insumos')
    .select('fecha, item, categoria, cantidad, costo_unitario, valor_total, proveedor')
    .eq('submodulo', 'COCINA_VERDURAS_GRANO')
    .gte('fecha', '2026-09-20')
    .order('fecha', { ascending: false });

  console.log('Compras desde 20 Sep (COCINA_VERDURAS_GRANO):', data?.length);
  data?.forEach(d => {
    console.log(d.fecha + ' | ' + d.item.padEnd(25) + ' | Cant: ' + String(d.cantidad).padStart(5) + ' | Unit: $' + String(d.costo_unitario).padStart(6) + ' | Tot: $' + String(d.valor_total).padStart(8) + ' | ' + d.proveedor);
  });
}

main();
