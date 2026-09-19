const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testStock() {
  console.log('Testing v_inventario_en_vivo...');
  const { data: viewData, error: viewErr } = await supabase
    .from('v_inventario_en_vivo')
    .select('*');

  if (viewErr) {
    console.error('Error viewData:', viewErr);
    return;
  }
  console.log('viewData items count:', viewData?.length);

  console.log('Testing movimientos_inventario query...');
  const { data: mermasData, error: mermasErr } = await supabase
    .from('movimientos_inventario')
    .select('insumo_id, merma_kg, costo_unitario_kg')
    .gt('merma_kg', 0);

  if (mermasErr) {
    console.error('Error mermasData:', mermasErr);
    return;
  }
  console.log('mermasData count:', mermasData?.length);
  console.log('✅ ALL QUERIES SUCCEEDED WITH ZERO ERRORS!');
}

testStock();
