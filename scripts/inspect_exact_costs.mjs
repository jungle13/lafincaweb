import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findItem(query) {
  const { data } = await supabase
    .from('transacciones_gastos_insumos')
    .select('*')
    .ilike('item', `%${query}%`);
  return data || [];
}

async function main() {
  const terms = [
    'Platano', 'Choclo', 'Mazorca', 'Cabezona', 'Piment', 'Zanahoria',
    'Cilantro', 'Mazamorra', 'Papa', 'Limon', 'Lima', 'Batavia',
    'Larga', 'Arroz', 'Color', 'Aceite', 'Lenteja', 'Sal', 'Banano',
    'Servilleta', 'Azucar'
  ];

  for (const t of terms) {
    const res = await findItem(t);
    console.log(`\n=== Término: ${t} (${res.length} registros) ===`);
    const uniqueItems = new Map();
    res.forEach(r => {
      const k = `${r.item} | ${r.submodulo} | ${r.categoria}`;
      if (!uniqueItems.has(k)) {
        uniqueItems.set(k, { cant: 0, val: 0, count: 0, sampleUnitCost: r.costo_unitario, desc: r.descripcion_original });
      }
      const obj = uniqueItems.get(k);
      obj.cant += (parseFloat(r.cantidad) || 0);
      obj.val += (parseFloat(r.valor_total) || 0);
      obj.count += 1;
    });

    for (const [k, v] of uniqueItems.entries()) {
      const avg = v.cant > 0 ? v.val / v.cant : v.sampleUnitCost;
      console.log(`  ${k} -> Costo Prom: $${Math.round(avg).toLocaleString('es-CO')} (Cant tot: ${v.cant}, Regs: ${v.count})`);
    }
  }
}

main();
