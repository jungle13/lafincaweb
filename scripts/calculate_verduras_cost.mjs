import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const itemsToCheck = [
  { raw: 'Platano', search: 'Platano', cant: 32.9, med: 'Kg' },
  { raw: 'Choclo', search: 'Mazorca', cant: 17, med: 'Und' },
  { raw: 'Cabezona', search: 'Cebolla Cabezona', cant: 2.1, med: 'Kg' },
  { raw: 'Pimenton', search: 'Pimenton', cant: 1.0, med: 'Kg' },
  { raw: 'Zanahoria', search: 'Zanahoria', cant: 1.6, med: 'Kg' },
  { raw: 'Cilantro', search: 'Cilantro', cant: 1.0, med: 'Atado' },
  { raw: 'Mazamorra', search: 'Mazamorra', cant: 1.0, med: 'Bolsa' },
  { raw: 'Papa lavada', search: 'Papa Capira', cant: 1.2, med: 'Kg' },
  { raw: 'Lima (Limón)', search: 'Limon', cant: 7.9, med: 'Kg' },
  { raw: 'Batavia', search: 'Batavia', cant: 7.7, med: 'Kg' },
  { raw: 'Cebolla Larga', search: 'Cebolla Larga', cant: 3.9, med: 'Kg' },
  { raw: 'Papa común', search: 'Papa', cant: 13.1, med: 'Kg' },
  { raw: 'Arroz', search: 'Arroz', cant: 3.0, med: 'Kg' },
  { raw: 'Color', search: 'Color', cant: 0.5, med: 'Lb' },
  { raw: 'Aceite', search: 'Aceite', cant: 1.0, med: 'Galón' },
  { raw: 'Lentejas', search: 'Lenteja', cant: 3.0, med: 'Lb' },
  { raw: 'Sal', search: 'Sal', cant: 10.0, med: 'Lb' },
  { raw: 'Bananos', search: 'Banano', cant: 1.0, med: 'Kg' },
  { raw: 'Servilletas', search: 'Servilleta', cant: 7.0, med: 'Paq' },
  { raw: 'Azúcar sobre', search: 'Azucar', cant: 1.0, med: 'Caja/Paq' },
];

async function main() {
  console.log('=== PRECIOS Y COSTOS DE CADA INSUMO SEGÚN COMPRAS ===');
  let totalAdicional = 0;

  for (const item of itemsToCheck) {
    const { data } = await supabase
      .from('transacciones_gastos_insumos')
      .select('item, cantidad, costo_unitario, valor_total, fecha, proveedor')
      .ilike('item', `%${item.search}%`)
      .order('fecha', { ascending: false });

    let unitCost = 0;
    if (data && data.length > 0) {
      // Tomar el más reciente de septiembre
      const latest = data[0];
      unitCost = parseFloat(latest.costo_unitario) || 0;
      
      // Si el item es arroz por bulto 50kg ($254.000), por kg es $5.080
      if (item.raw === 'Arroz' && unitCost > 50000) {
        unitCost = Math.round(unitCost / 50); // $5.080/kg
      }
      // Si cebolla larga es por atado 25kg ($60.000), por kg es $2.400
      if (item.raw === 'Cebolla Larga' && unitCost > 20000) {
        unitCost = Math.round(unitCost / 25); // $2.400/kg
      }
      // Si papa capira es bulto 50kg ($125.000), por kg es $2.500
      if ((item.raw === 'Papa lavada' || item.raw === 'Papa común') && unitCost > 50000) {
        unitCost = Math.round(unitCost / 50); // $2.500/kg
      }
      // Si sal es bulto 50kg ($70.000), por lb es $700 o $1.400/kg
      if (item.raw === 'Sal' && unitCost > 20000) {
        unitCost = 700; // $700 / lb
      }
      // Si mazamorra bulto
      if (item.raw === 'Mazamorra' && unitCost > 15000) {
        unitCost = 8500; // bolsa de mazamorra
      }
    } else {
      if (item.raw === 'Bananos') unitCost = 2000;
    }

    const subtotal = Math.round(item.cant * unitCost);
    totalAdicional += subtotal;

    console.log(
      item.raw.padEnd(16) + ' | Cant: ' + String(item.cant).padStart(5) + ' ' + item.med.padEnd(5) +
      ' | Costo Unit: $' + unitCost.toLocaleString('es-CO').padStart(6) +
      ' | Subtotal: $' + subtotal.toLocaleString('es-CO').padStart(8)
    );
  }

  console.log('----------------------------------------------------');
  console.log('TOTAL COSTO ADICIONAL VERDURAS Y GRANOS: $' + totalAdicional.toLocaleString('es-CO') + ' COP');
}

main();
