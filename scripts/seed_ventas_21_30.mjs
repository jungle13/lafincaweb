import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function parseVentasTxt(filePath) {
  const content = fs.readFileSync(filePath, 'latin1');
  const lines = content.split('\n');

  let fecha = null;
  const matchFecha = content.match(/Del:\s*(\d{2})\/(\d{2})\/(\d{2})/);
  if (matchFecha) {
    fecha = `20${matchFecha[3]}-${matchFecha[2]}-${matchFecha[1]}`;
  }

  const items = [];
  let inData = false;

  for (const line of lines) {
    if (line.includes('=====')) {
      inData = true;
      continue;
    }
    if (!inData || !line.trim()) continue;
    if (line.includes('TOTALES') || line.includes('Total :') || line.includes('TOTAL :')) break;

    const trimmed = line.trim();
    const nums = trimmed.match(/[\d\.\,]+/g);
    if (nums && nums.length >= 7) {
      // Tomamos el código como la primera palabra
      const firstSpace = trimmed.indexOf(' ');
      const codigo = trimmed.substring(0, firstSpace).trim();
      
      // Producto: entre código y 'ud'/'kg' o primer número
      const rest = trimmed.substring(firstSpace).trim();
      const matchProd = rest.match(/^(.+?)\s+(ud|kg|paq|lt|glb)?\s+[\d\.\,]+/i);
      const producto = matchProd ? matchProd[1].trim() : rest.split(/\s{2,}/)[0].trim();

      const nLen = nums.length;
      const cant = parseFloat(nums[nLen - 8]?.replace(/,/g, '')) || parseFloat(nums[nLen - 7]?.replace(/,/g, '')) || 0;
      const vBruta = parseFloat(nums[nLen - 7]?.replace(/,/g, '')) || 0;
      const desc = parseFloat(nums[nLen - 6]?.replace(/,/g, '')) || 0;
      const vNeta = parseFloat(nums[nLen - 5]?.replace(/,/g, '')) || 0;
      const imp = parseFloat(nums[nLen - 4]?.replace(/,/g, '')) || 0;
      const granTot = parseFloat(nums[nLen - 3]?.replace(/,/g, '')) || 0;
      const vUnit = parseFloat(nums[nLen - 2]?.replace(/,/g, '')) || 0;

      if (granTot > 0 || cant > 0) {
        items.push({
          codigo,
          producto,
          cant,
          vBruta,
          desc,
          vNeta,
          imp,
          granTot,
          vUnit
        });
      }
    }
  }

  return { fecha, items };
}

async function seedDays21to30() {
  console.log('--- Iniciando Ingesta de Ventas Días 21 al 30 de Septiembre ---');

  for (let d = 21; d <= 30; d++) {
    const p = `./DOCUMENTOS BASE/ventas/${d}.txt`;
    if (!fs.existsSync(p)) continue;

    const { fecha, items } = parseVentasTxt(p);
    if (!fecha || items.length === 0) continue;

    console.log(`Procesando Día ${d} (${fecha}): ${items.length} productos vendidos...`);

    // Limpiar previo en caso de reprocesar
    await supabase.from('ventas_detalle').delete().eq('fecha', fecha);
    await supabase.from('ventas_diarias').delete().eq('fecha', fecha);

    const dDate = new Date(fecha + 'T12:00:00Z');
    const diaSemana = DIAS_SEMANA[dDate.getUTCDay()];

    const totalArticulos = items.reduce((acc, x) => acc + x.cant, 0);
    const ventaBruta = items.reduce((acc, x) => acc + x.vBruta, 0);
    const descuento = items.reduce((acc, x) => acc + x.desc, 0);
    const ventaNeta = items.reduce((acc, x) => acc + x.vNeta, 0);
    const impuesto = items.reduce((acc, x) => acc + x.imp, 0);
    const granTotal = items.reduce((acc, x) => acc + x.granTot, 0);
    const ticketPromedio = totalArticulos > 0 ? Math.round(granTotal / totalArticulos) : 0;

    // Insertar ventas_diarias
    const { error: errDia } = await supabase.from('ventas_diarias').insert([{
      periodo_id: 'per-2026-09',
      fecha,
      archivo_origen: `${d}.txt`,
      dia_semana: diaSemana,
      total_articulos: totalArticulos,
      venta_bruta: ventaBruta,
      descuento: descuento,
      venta_neta: ventaNeta,
      impuesto: impuesto,
      gran_total: granTotal,
      total_platos_distintos: items.length,
      ticket_promedio: ticketPromedio
    }]);

    if (errDia) {
      console.error(`Error en ventas_diarias día ${d}:`, errDia);
      continue;
    }

    // Insertar ventas_detalle
    const detalleRows = items.map(it => {
      const pct = granTotal > 0 ? parseFloat(((it.granTot / granTotal) * 100).toFixed(2)) : 0;
      return {
        periodo_id: 'per-2026-09',
        fecha,
        archivo_origen: `${d}.txt`,
        codigo_producto: it.codigo,
        nombre_producto: it.producto,
        categoria: 'Platos Fuertes / Carnes',
        unidad: 'ud',
        cantidad: it.cant,
        venta_bruta: it.vBruta,
        descuento: it.desc,
        venta_neta: it.vNeta,
        impuesto: it.imp,
        gran_total: it.granTot,
        valor_unitario: it.vUnit,
        porcentaje_dia: pct
      };
    });

    const batchSize = 100;
    for (let i = 0; i < detalleRows.length; i += batchSize) {
      const chunk = detalleRows.slice(i, i + batchSize);
      const { error: errChunk } = await supabase.from('ventas_detalle').insert(chunk);
      if (errChunk) console.error(`Error chunk ventas_detalle día ${d}:`, errChunk);
    }

    console.log(`✅ Día ${d} (${fecha}) completado: $${granTotal.toLocaleString('es-CO')} COP`);
  }

  console.log('\n--- VERIFICACIÓN FINAL VENTAS SEPTIEMBRE ---');
  const { data: allDias } = await supabase.from('ventas_diarias').select('fecha').order('fecha');
  console.log(`Días totales en ventas_diarias: ${allDias?.length} (Del ${allDias?.[0]?.fecha} al ${allDias?.[allDias.length - 1]?.fecha})`);
}

seedDays21to30().catch(console.error);
