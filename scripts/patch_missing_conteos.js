const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    if (k) env[k] = v;
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const baseDir = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/VALORIZACIÓN DIARIA';

function cleanStr(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  const { data: catalogInsumos } = await supabase.from('catalogo_insumos').select('id, nombre, categoria, unidad_medida');

  function matchInsumo(name) {
    if (!name) return null;
    const cleanN = cleanStr(name);
    for (const item of catalogInsumos) {
      const cleanCat = cleanStr(item.nombre);
      if (cleanN === cleanCat || cleanN.startsWith(cleanCat) || cleanCat.startsWith(cleanN)) return item;
    }
    const tokens = cleanN.split(' ').filter(t => t.length > 2);
    let bestMatch = null, maxOverlap = 0;
    for (const item of catalogInsumos) {
      const catTokens = cleanStr(item.nombre).split(' ').filter(t => t.length > 2);
      const overlap = tokens.filter(t => catTokens.includes(t)).length;
      if (overlap > maxOverlap && overlap >= 2) {
        maxOverlap = overlap;
        bestMatch = item;
      }
    }
    return bestMatch;
  }

  // Parse inventory rows flexible
  function parseFlexibleInventory(ws) {
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    const items = [];
    for (const r of rows) {
      if (!r || r.length < 4) continue;
      // find index of string that looks like a product name and numbers
      let prodName = null, catName = 'Proteínas e Insumos', qty = null, unit = 'Kg', price = 0, total = 0, obs = '';
      
      for (let c = 0; c < r.length; c++) {
        const val = r[c];
        if (typeof val === 'string' && val.length > 2) {
          const lower = val.toLowerCase();
          if (lower.includes('restaurante') || lower.includes('control') || lower.includes('stock físico') || lower.includes('inventario') || lower.includes('producto /') || lower.includes('código')) {
            prodName = null;
            break;
          }
          if (['carnes y pescados', 'carnes de cerdo', 'carnes de res', 'embutidos', 'huevos y lácteos', 'congelados / acompañantes', 'granos y abarrotes', 'verduras'].includes(lower)) {
            catName = val;
          } else if (!prodName && !val.startsWith('#') && isNaN(Number(val))) {
            prodName = val;
          } else if (prodName && !obs && isNaN(Number(val))) {
            obs = val;
          }
        } else if (typeof val === 'number') {
          if (qty === null) {
            // could be row number or qty
            if (val > 0 && val < 500 && (c >= 2 || (c === 1 && typeof r[0] === 'number'))) {
              qty = val;
            } else if (val >= 1000) {
              if (price === 0) price = val;
              else if (total === 0) total = val;
            }
          } else if (price === 0 && val >= 500) {
            price = val;
          } else if (total === 0 && val >= 500) {
            total = val;
          }
        }
      }

      if (prodName && (qty !== null || total > 0)) {
        if (!qty && price > 0 && total > 0) qty = total / price;
        if (!total && qty && price > 0) total = qty * price;
        items.push({
          category: catName,
          name: prodName.trim(),
          qty: qty || 1,
          unit: 'Kg',
          unitPrice: price || 0,
          total: total || 0,
          obs
        });
      }
    }
    return items;
  }

  const patchDays = [8, 9, 10, 11, 12, 13, 14];
  for (const day of patchDays) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `2026-10-${dayStr}`;
    const dayFolder = path.join(baseDir, String(day));
    if (!fs.existsSync(dayFolder)) continue;
    const files = fs.readdirSync(dayFolder).filter(f => f.endsWith('.xlsx') && !f.toLowerCase().includes('backup') && !f.toLowerCase().includes('pre_'));
    if (files.length === 0) continue;

    const wb = xlsx.readFile(path.join(dayFolder, files[0]));

    // Check if amanece already exists
    const { data: existingAmanece } = await supabase.from('conteos_fisicos').select('id').eq('fecha', dateStr).eq('tipo', 'COCINA_APERTURA').maybeSingle();
    
    if (!existingAmanece) {
      const amaneceSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('amanece') || (s.toLowerCase().includes('inventario cocina') && !s.toLowerCase().includes('cierre')));
      if (amaneceSheetName) {
        const items = parseFlexibleInventory(wb.Sheets[amaneceSheetName]);
        if (items.length > 0) {
          const totalVal = items.reduce((s, it) => s + (it.total || 0), 0);
          const { data: newC } = await supabase.from('conteos_fisicos').insert({
            fecha: dateStr,
            tipo: 'COCINA_APERTURA',
            usuario: 'Administradora / Cocina',
            estado: 'APLICADO',
            total_valor: totalVal,
            observaciones: `Inventario apertura amanece ${dateStr} (${amaneceSheetName})`
          }).select().single();

          if (newC) {
            const details = items.map(it => {
              const matched = matchInsumo(it.name);
              return {
                conteo_id: newC.id,
                insumo_id: matched ? matched.id : null,
                nombre_insumo: it.name,
                categoria: it.category,
                ubicacion: 'Cocina Principal',
                cantidad: it.qty,
                unidad: it.unit,
                costo_unitario: it.unitPrice,
                valor_total: it.total,
                observaciones: it.obs
              };
            });
            await supabase.from('conteos_fisicos_detalle').insert(details);
            console.log(`[PATCH] Day ${day}: Created COCINA_APERTURA with ${details.length} items ($${totalVal.toLocaleString('es-CO')}).`);
          }
        }
      }
    }

    // Check if cierre already exists
    const { data: existingCierre } = await supabase.from('conteos_fisicos').select('id').eq('fecha', dateStr).eq('tipo', 'COCINA_CIERRE').maybeSingle();
    if (!existingCierre) {
      const cierreSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('cierre') && !s.toLowerCase().includes('inicio'));
      if (cierreSheetName) {
        const items = parseFlexibleInventory(wb.Sheets[cierreSheetName]);
        if (items.length > 0) {
          const totalVal = items.reduce((s, it) => s + (it.total || 0), 0);
          const { data: newC } = await supabase.from('conteos_fisicos').insert({
            fecha: dateStr,
            tipo: 'COCINA_CIERRE',
            usuario: 'Administradora / Cocina',
            estado: 'APLICADO',
            total_valor: totalVal,
            observaciones: `Inventario cierre cocina ${dateStr} (${cierreSheetName})`
          }).select().single();

          if (newC) {
            const details = items.map(it => {
              const matched = matchInsumo(it.name);
              return {
                conteo_id: newC.id,
                insumo_id: matched ? matched.id : null,
                nombre_insumo: it.name,
                categoria: it.category,
                ubicacion: 'Cocina Principal',
                cantidad: it.qty,
                unidad: it.unit,
                costo_unitario: it.unitPrice,
                valor_total: it.total,
                observaciones: it.obs
              };
            });
            await supabase.from('conteos_fisicos_detalle').insert(details);
            console.log(`[PATCH] Day ${day}: Created COCINA_CIERRE with ${details.length} items ($${totalVal.toLocaleString('es-CO')}).`);
          }
        }
      }
    }
  }

  console.log('[PATCH] Done checking/patching conteos!');
}

run().catch(console.error);
