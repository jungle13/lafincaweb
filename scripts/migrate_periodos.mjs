import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
// Node handles env natively

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  const dataPath = path.join(process.cwd(), 'data', 'periodos.json');
  if (!fs.existsSync(dataPath)) {
    console.log('No data/periodos.json found');
    return;
  }

  const periods = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`Found ${periods.length} periods in JSON`);

  for (const p of periods) {
    const payload = {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      estado: p.estado || 'ABIERTO',
      inicial_registrado: !!p.inicial_registrado,
      inventario_inicial: p.inventario_inicial || {},
      conteo_cierre_fisico: p.conteo_cierre_fisico || {},
      ajustes_aprobados: p.ajustes_aprobados || {},
      fecha_cierre: p.fecha_cierre || null,
      usuario_cierre: p.usuario_cierre || null,
      observaciones_cierre: p.observaciones_cierre || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('periodos')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error(`Error migrating period ${p.codigo}:`, error);
    } else {
      console.log(`Migrated period: ${p.nombre} (${p.codigo})`);
    }
  }

  console.log('Migration completed successfully!');
}

migrate();
