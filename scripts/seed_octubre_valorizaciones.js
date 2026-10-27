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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const baseDir = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/VALORIZACIÓN DIARIA';

function formatDateToTitle(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${dias[dateObj.getDay()]}, ${day} de ${meses[dateObj.getMonth()]} de ${year} - Hoja Costeo Cocina`;
}

// Clean and normalize strings for matching
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
  console.log('Fetching catalog insumos...');
  const { data: catalogInsumos, error: catErr } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, es_carne, unidad_medida, costo_unitario_kg, peso_estandar_porcion_kg');
  
  if (catErr) {
    console.error('Error fetching catalog:', catErr);
    return;
  }
  console.log(`Loaded ${catalogInsumos.length} catalog items.`);

  function matchInsumo(name) {
    if (!name) return null;
    const cleanN = cleanStr(name);
    // 1. Exact or startsWith match
    for (const item of catalogInsumos) {
      const cleanCat = cleanStr(item.nombre);
      if (cleanN === cleanCat) return item;
      if (cleanN.startsWith(cleanCat) || cleanCat.startsWith(cleanN)) return item;
    }
    // 2. Token overlap
    const tokens = cleanN.split(' ').filter(t => t.length > 2);
    let bestMatch = null;
    let maxOverlap = 0;
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

  // Parse Resumen Sheet (movimientos / bajadas consolidadas a cocina)
  function parseResumenSheet(ws) {
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    const items = [];
    let currentCategory = 'Verduras e Insumos';

    let headerRowIdx = -1;
    let colCant = -1, colUnd = -1, colProd = -1, colUnit = -1, colTotal = -1;

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const r = rows[i];
      if (!r) continue;
      for (let c = 0; c < r.length; c++) {
        const val = String(r[c] || '').toLowerCase().trim();
        if (val.includes('cantidad')) colCant = c;
        if (val.includes('unidad') || val === 'und') colUnd = c;
        if (val.includes('producto') || val.includes('ítem') || val.includes('item') || val.includes('insumo')) colProd = c;
        if (val.includes('v. unitario') || val.includes('costo') || val.includes('v unitario') || val.includes('costo unit')) colUnit = c;
        if (val.includes('v. total') || val.includes('v total') || val.includes('vr. total') || val.includes('total')) colTotal = c;
      }
      if (colCant !== -1 && (colProd !== -1 || colUnd !== -1)) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      colCant = 1; colUnd = 2; colProd = 3; colUnit = 4; colTotal = 5;
      headerRowIdx = 1;
    }

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      const nonEmpties = r.filter(x => x !== null && x !== undefined && x !== '');
      if (nonEmpties.length === 1 && typeof nonEmpties[0] === 'string') {
        const text = nonEmpties[0].trim();
        if (!text.toLowerCase().includes('total') && !text.toLowerCase().includes('subtotal')) {
          currentCategory = text;
          continue;
        }
      }

      const prodName = r[colProd];
      if (!prodName || typeof prodName !== 'string') continue;
      if (prodName.toLowerCase().includes('total') || prodName.toLowerCase().includes('subtotal') || prodName.toLowerCase().includes('gran total')) continue;

      const qty = parseFloat(r[colCant]);
      const total = parseFloat(r[colTotal]);
      if (isNaN(qty) && isNaN(total)) continue;

      const unit = String(r[colUnd] || 'Kg').trim();
      const unitPrice = parseFloat(r[colUnit]) || (qty > 0 && total > 0 ? Math.round(total / qty) : 0);

      items.push({
        category: currentCategory,
        name: prodName.trim(),
        qty: isNaN(qty) ? 1 : qty,
        unit,
        unitPrice,
        total: isNaN(total) ? (qty * unitPrice) : total
      });
    }

    return items;
  }

  // Parse Inventory Sheet (Amanece / Cierre)
  function parseInventorySheet(ws) {
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    const items = [];
    let currentCategory = 'Proteínas e Insumos';

    let headerRowIdx = -1;
    let colProd = -1, colCant = -1, colUnd = -1, colUnit = -1, colTotal = -1, colObs = -1, colCat = -1;

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const r = rows[i];
      if (!r) continue;
      let tempCat = -1, tempProd = -1, tempCant = -1, tempUnd = -1, tempUnit = -1, tempTotal = -1, tempObs = -1;
      for (let c = 0; c < r.length; c++) {
        const val = String(r[c] || '').toLowerCase().trim();
        if (val.includes('categoría') || val.includes('categoria')) tempCat = c;
        if (val.includes('producto') || val.includes('ítem') || val.includes('insumo')) tempProd = c;
        if (val.includes('cantidad') || val.includes('conteo') || val.includes('stock')) tempCant = c;
        if (val.includes('unidad') || val === 'und') tempUnd = c;
        if (val.includes('costo') || val.includes('precio') || val.includes('unit')) tempUnit = c;
        if (val.includes('total') || val.includes('valor')) tempTotal = c;
        if (val.includes('obs') || val.includes('detalle') || val.includes('soporte') || val.includes('estado')) tempObs = c;
      }
      if (tempProd !== -1 && (tempCant !== -1 || tempTotal !== -1)) {
        headerRowIdx = i;
        colCat = tempCat;
        colProd = tempProd;
        colCant = tempCant;
        colUnd = tempUnd;
        colUnit = tempUnit;
        colTotal = tempTotal;
        colObs = tempObs;
        break;
      }
    }

    if (headerRowIdx === -1) {
      return items;
    }

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      const nonEmpties = r.filter(x => x !== null && x !== undefined && x !== '');
      if (nonEmpties.length === 1 && typeof nonEmpties[0] === 'string') {
        const text = nonEmpties[0].trim();
        if (!text.toLowerCase().includes('total') && !text.toLowerCase().includes('inventario') && !text.toLowerCase().includes('control')) {
          currentCategory = text;
          continue;
        }
      }

      const prodName = r[colProd];
      if (!prodName || typeof prodName !== 'string') continue;
      if (prodName.toLowerCase().includes('total') || prodName.toLowerCase().includes('subtotal') || prodName.toLowerCase().includes('gran total')) continue;

      const qty = parseFloat(r[colCant]);
      const total = colTotal !== -1 ? parseFloat(r[colTotal]) : NaN;
      if (isNaN(qty) && isNaN(total)) continue;

      const unit = colUnd !== -1 && r[colUnd] ? String(r[colUnd]).trim() : 'Kg';
      const unitPrice = colUnit !== -1 ? parseFloat(r[colUnit]) : 0;
      const cat = colCat !== -1 && r[colCat] ? String(r[colCat]).trim() : currentCategory;
      const obs = colObs !== -1 && r[colObs] ? String(r[colObs]).trim() : '';

      items.push({
        category: cat,
        name: prodName.trim(),
        qty: isNaN(qty) ? 1 : qty,
        unit,
        unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
        total: isNaN(total) ? (qty * (unitPrice || 0)) : total,
        obs
      });
    }

    return items;
  }

  // Iterate over all days 8 to 25
  for (let day = 8; day <= 25; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `2026-10-${dayStr}`;
    const dayFolder = path.join(baseDir, String(day));
    if (!fs.existsSync(dayFolder)) continue;

    const files = fs.readdirSync(dayFolder).filter(f => 
      f.endsWith('.xlsx') && 
      !f.toLowerCase().includes('backup') && 
      !f.toLowerCase().includes('pre_')
    );
    if (files.length === 0) continue;

    const filePath = path.join(dayFolder, files[0]);
    console.log(`\n=================== PROCESSING DAY ${day} (${dateStr}) ===================`);
    const wb = xlsx.readFile(filePath);

    // 1. Get POS sales for this day
    let posSales = 0;
    const { data: vDia } = await supabase.from('ventas_diarias').select('gran_total, venta_neta').eq('fecha', dateStr).single();
    if (vDia && vDia.gran_total) {
      posSales = Number(vDia.gran_total);
    } else {
      // Check ventas sheet in workbook
      const vSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('ventas'));
      if (vSheetName) {
        const vWs = wb.Sheets[vSheetName];
        const vRows = xlsx.utils.sheet_to_json(vWs, { header: 1 });
        for (const r of vRows) {
          if (!r) continue;
          for (let c = 0; c < r.length; c++) {
            const cell = String(r[c] || '').toLowerCase();
            if (cell.includes('gran total facturado') || cell.includes('venta bruta total')) {
              const val = parseFloat(r[c + 1] || r[c + 2]);
              if (!isNaN(val) && val > 0 && posSales === 0) {
                posSales = val;
              }
            }
          }
        }
      }
    }

    // 2. Parse Formato Resumen (Movimientos a cocina)
    const resumenSheet = wb.SheetNames.find(s => s.toLowerCase().includes('formato resumen') || s.toLowerCase().includes('resumen'));
    let resumenItems = [];
    if (resumenSheet) {
      resumenItems = parseResumenSheet(wb.Sheets[resumenSheet]);
    }
    console.log(`Parsed ${resumenItems.length} items from Resumen.`);

    // 3. Parse Amanece (Apertura de Cocina)
    const amaneceSheet = wb.SheetNames.find(s => s.toLowerCase().includes('amanece') || (s.toLowerCase().includes('inventario cocina') && !s.toLowerCase().includes('cierre')));
    let amaneceItems = [];
    if (amaneceSheet) {
      amaneceItems = parseInventorySheet(wb.Sheets[amaneceSheet]);
    }
    console.log(`Parsed ${amaneceItems.length} items from Amanece (${amaneceSheet || 'none'}).`);

    // 4. Parse Cierre de Cocina
    const cierreSheet = wb.SheetNames.find(s => s.toLowerCase().includes('cierre') && !s.toLowerCase().includes('inicio'));
    let cierreItems = [];
    if (cierreSheet) {
      cierreItems = parseInventorySheet(wb.Sheets[cierreSheet]);
    }
    console.log(`Parsed ${cierreItems.length} items from Cierre (${cierreSheet || 'none'}).`);

    // Calculate totals
    const costoBruto = resumenItems.reduce((acc, it) => acc + (it.total || 0), 0);
    const devoluciones = 0; // standard devoluciones if noted
    const costoNeto = costoBruto - devoluciones;
    const foodCostPct = posSales > 0 ? (costoNeto / posSales) * 100 : 0;
    const title = formatDateToTitle(dateStr);

    // Save/Upsert into costeo_diario
    const { data: costeoRow, error: costeoErr } = await supabase
      .from('costeo_diario')
      .upsert({
        fecha: dateStr,
        titulo: title,
        pos_sales: posSales,
        costo_bruto: costoBruto,
        devoluciones: devoluciones,
        costo_neto: costoNeto,
        food_cost_porcentaje: foodCostPct,
        estado: 'CERRADO',
        observaciones: `Cargado automáticamente desde ${files[0]}`
      }, { onConflict: 'fecha' })
      .select()
      .single();

    if (costeoErr) {
      console.error(`Error saving costeo_diario for ${dateStr}:`, costeoErr);
    } else {
      console.log(`Saved costeo_diario: Costo Bruto $${costoBruto.toLocaleString('es-CO')}, POS $${posSales.toLocaleString('es-CO')}, FC: ${foodCostPct.toFixed(1)}%`);
    }

    // Clean previous movimientos for this date to avoid duplication
    await supabase.from('movimientos_inventario').delete().eq('fecha', dateStr);

    // Insert Movimientos Inventario
    if (resumenItems.length > 0) {
      const movPayload = resumenItems.map(it => {
        const matched = matchInsumo(it.name);
        return {
          fecha: dateStr,
          tipo_movimiento: 'BODEGA_A_COCINA',
          insumo_id: matched ? matched.id : null,
          nombre_insumo: it.name,
          categoria: it.category || (matched ? matched.categoria : 'Insumos Varios'),
          origen: 'Bodega General',
          destino: 'Cocina Principal',
          cantidad: it.qty,
          unidad: it.unit || (matched ? matched.unidad_medida : 'Kg'),
          costo_unitario: it.unitPrice,
          valor_total_movimiento: it.total,
          usuario: 'Administradora'
        };
      });

      const { error: movErr } = await supabase.from('movimientos_inventario').insert(movPayload);
      if (movErr) console.error(`Error inserting movimientos for ${dateStr}:`, movErr);
      else console.log(`Inserted ${movPayload.length} movimientos_inventario.`);
    }

    // Save Conteos Físicos (Amanece y Cierre)
    // Delete existing conteos for this date to avoid duplication
    const { data: existingConteos } = await supabase.from('conteos_fisicos').select('id').eq('fecha', dateStr);
    if (existingConteos && existingConteos.length > 0) {
      const ids = existingConteos.map(c => c.id);
      await supabase.from('conteos_fisicos_detalle').delete().in('conteo_id', ids);
      await supabase.from('conteos_fisicos').delete().in('id', ids);
    }

    // Insert Amanece
    if (amaneceItems.length > 0) {
      const totalAmanece = amaneceItems.reduce((acc, it) => acc + (it.total || 0), 0);
      const { data: conteoApertura, error: apErr } = await supabase
        .from('conteos_fisicos')
        .insert({
          fecha: dateStr,
          tipo: 'COCINA_APERTURA',
          usuario: 'Administradora / Cocina',
          estado: 'APLICADO',
          total_valor: totalAmanece,
          observaciones: `Inventario físico de apertura / amanece ${dateStr}`
        })
        .select()
        .single();

      if (!apErr && conteoApertura) {
        const apDetails = amaneceItems.map(it => {
          const matched = matchInsumo(it.name);
          return {
            conteo_id: conteoApertura.id,
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
        await supabase.from('conteos_fisicos_detalle').insert(apDetails);
        console.log(`Saved COCINA_APERTURA with ${apDetails.length} items (Total: $${totalAmanece.toLocaleString('es-CO')}).`);
      }
    }

    // Insert Cierre
    if (cierreItems.length > 0) {
      const totalCierre = cierreItems.reduce((acc, it) => acc + (it.total || 0), 0);
      const { data: conteoCierre, error: ciErr } = await supabase
        .from('conteos_fisicos')
        .insert({
          fecha: dateStr,
          tipo: 'COCINA_CIERRE',
          usuario: 'Administradora / Cocina',
          estado: 'APLICADO',
          total_valor: totalCierre,
          observaciones: `Inventario físico de cierre de cocina ${dateStr}`
        })
        .select()
        .single();

      if (!ciErr && conteoCierre) {
        const ciDetails = cierreItems.map(it => {
          const matched = matchInsumo(it.name);
          return {
            conteo_id: conteoCierre.id,
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
        await supabase.from('conteos_fisicos_detalle').insert(ciDetails);
        console.log(`Saved COCINA_CIERRE with ${ciDetails.length} items (Total: $${totalCierre.toLocaleString('es-CO')}).`);
      }
    }
  }

  console.log('\n================ ALL 18 DAYS PROCESSED SUCCESSFULLY! ================');
}

run().catch(console.error);
