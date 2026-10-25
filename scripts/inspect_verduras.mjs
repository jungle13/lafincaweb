import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: rows } = await supabase
    .from('transacciones_gastos_insumos')
    .select('*')
    .eq('submodulo', 'COCINA_VERDURAS_GRANO');

  const map = new Map();
  rows.forEach(r => {
    const k = r.item.trim();
    if (!map.has(k)) {
      map.set(k, { item: k, categoria: r.categoria, records: [] });
    }
    map.get(k).records.push(r);
  });

  const sorted = Array.from(map.values()).sort((a,b) => a.item.localeCompare(b.item));
  console.log(`TOTAL ITEMS EN COCINA_VERDURAS_GRANO: ${sorted.length}\n`);
  sorted.forEach(s => {
    const totCant = s.records.reduce((acc, x) => acc + (parseFloat(x.cantidad) || 0), 0);
    const totVal = s.records.reduce((acc, x) => acc + (parseFloat(x.valor_total) || 0), 0);
    const unitProm = totCant > 0 ? totVal / totCant : (parseFloat(s.records[0].costo_unitario) || 0);
    console.log(`${s.item.padEnd(30)} | ${s.categoria.padEnd(12)} | Costo Unit: $${Math.round(unitProm).toString().padStart(6)} | Compras: ${s.records.length}`);
  });
}

main();
