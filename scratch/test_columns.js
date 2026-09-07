const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase
    .from('movimientos_inventario')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting from movimientos_inventario:', error);
  } else {
    console.log('Columns in movimientos_inventario:', Object.keys(data[0] || {}));
  }
}

test();
