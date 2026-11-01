const fs = require('fs');
const XLSX = require('xlsx');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k] = v.join('=');
});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const wb = XLSX.readFile('C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/COSTOS_GASTOS_OCTUBRE_2026.xlsx');
const s = wb.Sheets['Detalle Ventas Octubre 2026'];
const dataVentas = XLSX.utils.sheet_to_json(s);

async function syncVentas() {
  console.log(`📊 Total registros de ventas en Excel: ${dataVentas.length}`);

  // 1. Agrupar por día
  const diasMap = new Map();

  dataVentas.forEach((r) => {
    const dia = Number(r['Día']);
    const fecha = `2026-10-${String(dia).padStart(2, '0')}`;
    const cod = String(r['Código'] || '').trim();
    const prod = String(r['Producto'] || '').trim();
    const cat = String(r['Categoría'] || 'Platos Fuertes / Carnes').trim();
    const unidad = String(r['Unidad'] || 'ud').trim();
    const cant = Number(r['Cantidad Vendida'] || 0);
    const unitPrice = Number(r['Precio Unitario Neto'] || 0);
    const vBruta = Number(r['Venta Bruta'] || 0);
    const desc = Number(r['Descuentos'] || 0);
    const vNeta = Number(r['Venta Neta'] || 0);
    const imp = Number(r['Impoconsumo (8%)'] || 0);
    const gTotal = Number(r['Gran Total Facturado'] || 0);
    const partDia = Number(r['% Part. Día'] || 0);

    if (!diasMap.has(fecha)) {
      diasMap.set(fecha, {
        fecha,
        dia,
        items: []
      });
    }

    diasMap.get(fecha).items.push({
      periodo_id: 'per-2026-10',
      fecha,
      archivo_origen: `${String(dia).padStart(2, '0')}.txt`,
      codigo_producto: cod,
      nombre_producto: prod,
      categoria: cat,
      unidad,
      cantidad: cant,
      venta_bruta: vBruta,
      descuento: desc,
      venta_neta: vNeta,
      impuesto: imp,
      gran_total: gTotal,
      valor_unitario: unitPrice,
      porcentaje_dia: partDia
    });
  });

  console.log(`📅 Días de venta identificados: ${diasMap.size}`);

  // 2. Limpiar ventas de Octubre 2026 en Supabase
  console.log('🧹 Limpiando ventas anteriores de Octubre 2026...');
  await sb.from('ventas_detalle').delete().eq('periodo_id', 'per-2026-10');
  await sb.from('ventas_diarias').delete().eq('periodo_id', 'per-2026-10');

  // 3. Insertar ventas_diarias y ventas_detalle por lotes
  const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  let totalItemsInserted = 0;
  let totalFacturadoMes = 0;

  for (const [fecha, dayData] of diasMap.entries()) {
    const dObj = new Date(`${fecha}T12:00:00Z`);
    const diaSemana = DIAS_SEMANA[dObj.getUTCDay()];

    const vBruta = dayData.items.reduce((s, it) => s + it.venta_bruta, 0);
    const desc = dayData.items.reduce((s, it) => s + it.descuento, 0);
    const vNeta = dayData.items.reduce((s, it) => s + it.venta_neta, 0);
    const imp = dayData.items.reduce((s, it) => s + it.impuesto, 0);
    const gTotal = dayData.items.reduce((s, it) => s + it.gran_total, 0);
    const totalArticulos = dayData.items.reduce((s, it) => s + it.cantidad, 0);
    const distinctPlatos = new Set(dayData.items.map(it => it.nombre_producto)).size;
    const ticketProm = totalArticulos > 0 ? Math.round(gTotal / totalArticulos) : 0;

    totalFacturadoMes += gTotal;

    const { error: errDia } = await sb.from('ventas_diarias').insert({
      periodo_id: 'per-2026-10',
      fecha,
      archivo_origen: `${String(dayData.dia).padStart(2, '0')}.txt`,
      dia_semana: diaSemana,
      total_articulos: totalArticulos,
      venta_bruta: vBruta,
      descuento: desc,
      venta_neta: vNeta,
      impuesto: imp,
      gran_total: gTotal,
      total_platos_distintos: distinctPlatos,
      ticket_promedio: ticketProm
    });

    if (errDia) {
      console.error(`Error insertando día ${fecha}:`, errDia.message);
    }

    // Insertar en lotes de 100 ítems
    const batchSize = 100;
    for (let i = 0; i < dayData.items.length; i += batchSize) {
      const batch = dayData.items.slice(i, i + batchSize);
      const { error: errDet } = await sb.from('ventas_detalle').insert(batch);
      if (errDet) {
        console.error(`Error insertando detalles para ${fecha}:`, errDet.message);
      } else {
        totalItemsInserted += batch.length;
      }
    }
  }

  console.log(`\n✅ Ventas de Octubre 2026 sincronizadas:`);
  console.log(`   - Días de venta: ${diasMap.size}`);
  console.log(`   - Artículos/líneas insertadas: ${totalItemsInserted}`);
  console.log(`   - Gran total facturado del mes: $${totalFacturadoMes.toLocaleString('es-CO')} COP`);
}
syncVentas();
