import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Filtro estricto y coherente para asegurar que solo se incluyan ventas de platos con carnes
const isNoCarne = (p: string) => {
  const s = (p || '').toLowerCase().trim();
  // Bebidas
  if (s.includes('agua') || s.includes('gaseosa') || s.includes('cerv') || s.includes('poker') || s.includes('aguila') || s.includes('corona') || s.includes('stella') || s.includes('club') || s.includes('costeñita') || s.includes('costeita')) return true;
  if (s.includes('jugo') || s.includes('limonada') || s.includes('jarra') || s.includes('gatorade') || s.includes('mr tea') || s.includes('pony') || s.includes('h2o') || s.includes('vive 100') || s.includes('guarapo') || s.includes('frape') || s.includes('soda postobon') || s.includes('tangelo')) return true;
  if (s.includes('cafe') || s.includes('chocolate') || s.includes('milo') || s.includes('avena') || s.includes('mazamorra') || s.includes('michelado') || s.includes('tinto')) return true;
  // Desechables, aseo, misceláneos
  if (s.includes('desechable') || s.includes('baño') || s.includes('bao') || s.includes('actigest') || s.includes('bolsa leche') || s.includes('mix cereal')) return true;
  // Acompañamientos / guarniciones sin carne
  if (s.includes('aguacate') || s.includes('banano') || s.includes('hojuelas') || s === 'francesa' || s.includes('sopa sola') || s.includes('perico') || s === 'huevo' || s.includes('entrada tost ahogado')) return true;
  if (s.startsWith('porc arepa') || s.startsWith('porc arroz') || s.startsWith('porc ensalada') || s.startsWith('porc maduro') || s.startsWith('porc principio') || s.startsWith('por ensalada')) return true;
  return false;
};

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get('fecha_inicio') || '2026-09-01';
    const fechaFin = searchParams.get('fecha_fin') || '2026-09-30';

    // 1. Obtener EXCLUSIVAMENTE movimientos de carnes trasladadas a cocina (TRASLADO_COCINA)
    // Sin incluir devoluciones, solo lo que efectivamente se pasa a cocina
    let allMovs: any[] = [];
    let fromMov = 0;
    const stepMov = 1000;
    while (true) {
      const { data: chunk, error: errChunk } = await supabase
        .from('movimientos_inventario')
        .select('*, catalogo_insumos(codigo, nombre, categoria, costo_unitario_kg, tipo_medida)')
        .eq('tipo_movimiento', 'TRASLADO_COCINA')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .order('fecha_hora', { ascending: true })
        .range(fromMov, fromMov + stepMov - 1);

      if (errChunk) throw errChunk;
      if (!chunk || chunk.length === 0) break;
      allMovs.push(...chunk);
      if (chunk.length < stepMov) break;
      fromMov += stepMov;
    }

    // 2. Obtener ventas de productos con paginación completa
    let allVentas: any[] = [];
    let fromVentas = 0;
    const stepVentas = 1000;
    while (true) {
      const { data: chunkV, error: errChunkV } = await supabase
        .from('ventas_detalle')
        .select('*')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .order('fecha', { ascending: true })
        .range(fromVentas, fromVentas + stepVentas - 1);

      if (errChunkV) throw errChunkV;
      if (!chunkV || chunkV.length === 0) break;
      allVentas.push(...chunkV);
      if (chunkV.length < stepVentas) break;
      fromVentas += stepVentas;
    }

    // 3. Organizar mapa de días
    const diasMap = new Map<string, any>();

    // Inicializar días en el rango cronológico
    const start = new Date(`${fechaInicio}T12:00:00Z`);
    const end = new Date(`${fechaFin}T12:00:00Z`);
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const fStr = dt.toISOString().split('T')[0];
      diasMap.set(fStr, {
        fecha: fStr,
        diaSemana: DIAS_SEMANA[dt.getUTCDay()],
        movimientosCarnes: [],
        platosCarnes: [],
        costoCarnes: 0,
        totalKgCarnes: 0,
        totalUndCarnes: 0,
        movimientosCount: 0,
        ventaCarnes: 0,
        platosVendidosUnd: 0,
        platosCount: 0,
      });
    }

    // Acumular únicamente movimientos de lo que se pasa a cocina (TRASLADO_COCINA)
    allMovs.forEach((m: any) => {
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
        tipoMovimiento: 'TRASLADO_COCINA',
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
      diaObj.movimientosCount += 1;
    });

    // Acumular ventas de platos de carnes
    allVentas.forEach((v: any) => {
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
        diaObj.platosCount += 1;
      }
    });

    // 4. Calcular métricas financieras por día y globales
    let sumVentaTotal = 0;
    let sumCostoTotal = 0;
    let sumKgTotal = 0;
    let sumUndTotal = 0;
    let sumPlatosUndTotal = 0;
    let sumMovsCountTotal = 0;
    let mejorDia: any = null;
    let diaMayorVenta: any = null;

    const diasList = Array.from(diasMap.values()).map((d) => {
      // Ordenar movimientos por hora
      d.movimientosCarnes.sort((a: any, b: any) => a.hora.localeCompare(b.hora));
      // Ordenar platos por total de venta descendente
      d.platosCarnes.sort((a: any, b: any) => b.granTotal - a.granTotal);

      const ganancia = d.ventaCarnes - d.costoCarnes;
      const margenPct = d.ventaCarnes > 0 ? parseFloat(((ganancia / d.ventaCarnes) * 100).toFixed(1)) : 0;
      const foodCostPct = d.ventaCarnes > 0 ? parseFloat(((d.costoCarnes / d.ventaCarnes) * 100).toFixed(1)) : 0;

      sumVentaTotal += d.ventaCarnes;
      sumCostoTotal += d.costoCarnes;
      sumKgTotal += d.totalKgCarnes;
      sumUndTotal += d.totalUndCarnes;
      sumPlatosUndTotal += d.platosVendidosUnd;
      sumMovsCountTotal += d.movimientosCount;

      const diaFormateado = {
        ...d,
        costoCarnes: Math.round(d.costoCarnes),
        ventaCarnes: Math.round(d.ventaCarnes),
        totalKgCarnes: parseFloat(d.totalKgCarnes.toFixed(2)),
        ganancia: Math.round(ganancia),
        margenPct,
        foodCostPct,
        estadoRentabilidad: margenPct >= 60 ? 'EXCELENTE' : margenPct >= 35 ? 'SALUDABLE' : 'ALERTA'
      };

      if (d.ventaCarnes > 0) {
        if (!mejorDia || ganancia > mejorDia.ganancia) mejorDia = diaFormateado;
        if (!diaMayorVenta || d.ventaCarnes > diaMayorVenta.ventaCarnes) diaMayorVenta = diaFormateado;
      }

      return diaFormateado;
    });

    const gananciaTotal = sumVentaTotal - sumCostoTotal;
    const margenTotalPct = sumVentaTotal > 0 ? parseFloat(((gananciaTotal / sumVentaTotal) * 100).toFixed(1)) : 0;
    const foodCostTotalPct = sumVentaTotal > 0 ? parseFloat(((sumCostoTotal / sumVentaTotal) * 100).toFixed(1)) : 0;
    const diasConVenta = diasList.filter(d => d.ventaCarnes > 0).length || 1;

    return NextResponse.json({
      success: true,
      kpis: {
        totalVentasCarnes: Math.round(sumVentaTotal),
        totalCostoCarnes: Math.round(sumCostoTotal),
        gananciaBruta: Math.round(gananciaTotal),
        margenBrutoPct: margenTotalPct,
        foodCostPct: foodCostTotalPct,
        totalDias: diasList.length,
        diasConVenta,
        totalDespachos: sumMovsCountTotal,
        totalKgDespachados: parseFloat(sumKgTotal.toFixed(2)),
        totalPorcionesDespachadas: sumUndTotal,
        totalPlatosVendidos: Math.round(sumPlatosUndTotal),
        promedioDiarioVenta: Math.round(sumVentaTotal / diasConVenta),
        promedioDiarioCosto: Math.round(sumCostoTotal / diasConVenta),
        promedioDiarioGanancia: Math.round(gananciaTotal / diasConVenta),
        mejorDia: mejorDia ? { fecha: mejorDia.fecha, diaSemana: mejorDia.diaSemana, ganancia: mejorDia.ganancia, margenPct: mejorDia.margenPct, ventaCarnes: mejorDia.ventaCarnes } : null,
        diaMayorVenta: diaMayorVenta ? { fecha: diaMayorVenta.fecha, diaSemana: diaMayorVenta.diaSemana, venta: diaMayorVenta.ventaCarnes, costo: diaMayorVenta.costoCarnes } : null
      },
      dias: diasList
    });

  } catch (error: any) {
    console.error('Error en API control-diario:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
