const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(l => {
  const [k, ...v] = l.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function seedCierre25() {
  const wb = XLSX.readFile('C:\\Users\\USUARIO\\Desktop\\Proyectos\\Costos_Finca\\OCTUBRE 2026\\VALORIZACIÓN DIARIA\\25\\VALORIZACION_INSUMOS_25_OCTUBRE_2026.xlsx');
  const sCierre = wb.Sheets['inventario cocina cierre 25'];
  const rows = XLSX.utils.sheet_to_json(sCierre, {header: 1});

  const { data: conteo, error: cErr } = await supabase
    .from('conteos_fisicos')
    .select('id, fecha, tipo')
    .eq('fecha', '2026-10-25')
    .eq('tipo', 'COCINA_CIERRE')
    .single();

  if (cErr || !conteo) {
    console.error('Conteo COCINA_CIERRE for 2026-10-25 not found:', cErr);
    return;
  }

  const items = [];
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1] || typeof r[1] !== 'number') continue;
    const cat = r[2];
    const name = r[3];
    const qty = Number(r[4] || 0);
    const unit = r[5];
    const unitCost = Number(r[6] || 0);
    const totalVal = Number(r[7] || (qty * unitCost));
    const obs = r[8] || '';

    items.push({
      conteo_id: conteo.id,
      ubicacion: 'COCINA',
      nombre_insumo: name,
      categoria: cat,
      cantidad: qty,
      unidad: unit,
      costo_unitario: unitCost,
      valor_total: totalVal,
      observaciones: obs
    });
  }

  // Delete existing details if any
  await supabase.from('conteos_fisicos_detalle').delete().eq('conteo_id', conteo.id);

  // Insert details
  const { data: inserted, error: inErr } = await supabase.from('conteos_fisicos_detalle').insert(items).select();
  if (inErr) {
    console.error('Error inserting closing details:', inErr);
  } else {
    console.log(`Successfully inserted ${inserted.length} details into conteos_fisicos_detalle for Day 25!`);
  }
}

seedCierre25();
