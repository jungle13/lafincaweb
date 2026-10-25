import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const isNoCarne = (p) => {
  const s = (p || '').toLowerCase();
  if (s.includes('agua') || s.includes('gaseosa') || s.includes('cerv') || s.includes('poker') || s.includes('aguila') || s.includes('corona') || s.includes('stella') || s.includes('club')) return true;
  if (s.includes('jugo') || s.includes('limonada') || s.includes('jarra') || s.includes('gatorade') || s.includes('mr tea') || s.includes('pony') || s.includes('h2o')) return true;
  if (s.includes('cafe') || s.includes('chocolate') || s.includes('milo') || s.includes('avena') || s.includes('mazamorra') || s.includes('michelado')) return true;
  if (s.includes('desechable') || s.includes('baño') || s.includes('bao') || s.includes('actigest') || s.includes('bolsa leche') || s.includes('mix cereal')) return true;
  if (s.includes('aguacate') || s.includes('banano') || s.includes('hojuelas') || s === 'francesa') return true;
  if (s.startsWith('porc arepa') || s.startsWith('porc arroz') || s.startsWith('porc ensalada') || s.startsWith('porc maduro') || s.startsWith('porc principio')) return true;
  return false;
};

async function testControlDiario() {
  console.log('--- Probando Consolidación Día a Día ---');

  // 1. Movimientos TRASLADO_COCINA
  const { data: movs, error: errMovs } = await supabase
    .from('movimientos_inventario')
    .select('*, catalogo_insumos(codigo, nombre, categoria, costo_unitario_kg, tipo_medida)')
    .eq('tipo_movimiento', 'TRASLADO_COCINA')
    .gte('fecha', '2026-09-01')
    .lte('fecha', '2026-09-30')
    .order('fecha_hora', { ascending: true });

  if (errMovs) throw errMovs;

  // 2. Ventas Detalle
  const { data: ventas, error: errVentas } = await supabase
    .from('ventas_detalle')
    .select('*')
    .gte('fecha', '2026-09-01')
    .lte('fecha', '2026-09-30')
    .order('fecha', { ascending: true });

  if (errVentas) throw errVentas;

  const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diasMap = new Map();

  for (let d = 1; d <= 30; d++) {
    const fStr = `2026-09-${String(d).padStart(2, '0')}`;
    const dt = new Date(`${fStr}T12:00:00Z`);
    diasMap.set(fStr, {
      fecha: fStr,
      diaSemana: DIAS_SEMANA[dt.getUTCDay()],
      movimientosCarnes: [],
      platosCarnes: [],
      costoCarnes: 0,
      totalKgCarnes: 0,
      totalUndCarnes: 0,
      ventaCarnes: 0,
      platosVendidosUnd: 0,
    });
  }

  // Agrupar movimientos de carnes
  (movs || []).forEach(m => {
    const diaObj = diasMap.get(m.fecha);
    if (!diaObj) return;

    const cantKg = parseFloat(m.cant_sin_porcionar_kg) || 0;
    const porcUnd = parseInt(m.porciones_und) || 0;
    const pesoPorcKg = parseFloat(m.peso_porciones_kg) || 0;
    const totKg = cantKg + pesoPorcKg;
    const costo = parseFloat(m.valor_total_movimiento) || 0;

    diaObj.movimientosCarnes.push({
      id: m.id,
      hora: m.fecha_hora ? m.fecha_hora.substring(11, 16) : '12:00',
      insumoCodigo: m.catalogo_insumos?.codigo || 'S/C',
      insumoNombre: m.catalogo_insumos?.nombre || 'Insumo',
      categoria: m.catalogo_insumos?.categoria || 'CARNES',
      cantSinPorcKg: cantKg,
      porcionesUnd: porcUnd,
      pesoPorcKg: pesoPorcKg,
      totalKg: totKg,
      costoUnit: parseFloat(m.costo_unitario_kg) || 0,
      valorTotal: costo,
      observaciones: m.observaciones || ''
    });

    diaObj.costoCarnes += costo;
    diaObj.totalKgCarnes += totKg;
    diaObj.totalUndCarnes += porcUnd;
  });

  // Agrupar ventas de carnes
  (ventas || []).forEach(v => {
    const diaObj = diasMap.get(v.fecha);
    if (!diaObj) return;

    if (!isNoCarne(v.nombre_producto)) {
      const cant = parseFloat(v.cantidad) || 0;
      const venta = parseFloat(v.gran_total) || 0;

      diaObj.platosCarnes.push({
        id: v.id,
        codigo: v.codigo_producto,
        nombre: v.nombre_producto,
        cantidad: cant,
        valorUnitario: parseFloat(v.valor_unitario) || 0,
        granTotal: venta,
        porcentajeDia: parseFloat(v.porcentaje_dia) || 0
      });

      diaObj.ventaCarnes += venta;
      diaObj.platosVendidosUnd += cant;
    }
  });

  console.log('\n--- CONSOLIDADO DE TODOS LOS DÍAS DE SEPTIEMBRE ---');
  let sumCosto = 0;
  let sumVenta = 0;

  const tableSummary = [];
  for (const [fecha, d] of diasMap.entries()) {
    const ganancia = d.ventaCarnes - d.costoCarnes;
    const margenPct = d.ventaCarnes > 0 ? (ganancia / d.ventaCarnes) * 100 : 0;
    const foodCostPct = d.ventaCarnes > 0 ? (d.costoCarnes / d.ventaCarnes) * 100 : 0;

    sumCosto += d.costoCarnes;
    sumVenta += d.ventaCarnes;

    tableSummary.push({
      Fecha: `${fecha} (${d.diaSemana})`,
      'Movs Cocina': d.movimientosCarnes.length,
      'Costo Carnes ($)': `$${Math.round(d.costoCarnes).toLocaleString('es-CO')}`,
      'Platos Carnes': d.platosCarnes.length,
      'Ventas Carnes ($)': `$${Math.round(d.ventaCarnes).toLocaleString('es-CO')}`,
      'Ganancia ($)': `$${Math.round(ganancia).toLocaleString('es-CO')}`,
      'Margen %': `${margenPct.toFixed(1)}%`,
      'Food Cost %': `${foodCostPct.toFixed(1)}%`
    });
  }

  console.table(tableSummary.slice(0, 10));
  console.log(`\nTOTAL MES:`);
  console.log(`- Ventas Platos Carne: $${Math.round(sumVenta).toLocaleString('es-CO')} COP`);
  console.log(`- Costo Carnes Despachadas: $${Math.round(sumCosto).toLocaleString('es-CO')} COP`);
  const gananciaMes = sumVenta - sumCosto;
  const margenMes = sumVenta > 0 ? (gananciaMes / sumVenta) * 100 : 0;
  console.log(`- Ganancia Bruta Carnes: $${Math.round(gananciaMes).toLocaleString('es-CO')} COP`);
  console.log(`- Margen Bruto Mes: ${margenMes.toFixed(1)}%`);
}

testControlDiario().catch(console.error);
