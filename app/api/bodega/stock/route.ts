import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { InsumoItem } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Obtener mermas acumuladas
    const mermasMap: Record<string, { kg: number; pesos: number }> = {};
    try {
      const { data: movsMerma } = await supabase
        .from('movimientos_inventario')
        .select('insumo_id, merma_kg, costo_unitario_kg');

      if (movsMerma && movsMerma.length > 0) {
        movsMerma.forEach((m: any) => {
          const id = String(m.insumo_id);
          const kg = parseFloat(m.merma_kg) || 0;
          const cost = parseFloat(m.costo_unitario_kg) || 0;
          if (!mermasMap[id]) mermasMap[id] = { kg: 0, pesos: 0 };
          mermasMap[id].kg += kg;
          mermasMap[id].pesos += (kg * cost);
        });
      }
    } catch (e) {
      console.warn('Error fetching mermas map:', e);
    }

    // 2. Obtener catálogo y stock actual
    const res = await supabase
      .from('catalogo_insumos')
      .select('*, stock_actual(*)')
      .eq('activo', true)
      .order('es_carne', { ascending: false })
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }

    const items: InsumoItem[] = (res.data || []).map((item: any) => {
      const st = Array.isArray(item.stock_actual) ? (item.stock_actual[0] || {}) : (item.stock_actual || {});
      const bSinPorc = parseFloat(st.bodega_sin_porcionar_kg) || 0;
      const bPorcUnd = parseInt(st.bodega_porcionado_und) || 0;
      const bPorcKg = parseFloat(st.bodega_porcionado_kg) || 0;
      const cSinPorc = parseFloat(st.cocina_sin_porcionar_kg) || 0;
      const cPorcUnd = parseInt(st.cocina_porcionado_und) || 0;
      const cPorcKg = parseFloat(st.cocina_porcionado_kg) || 0;
      const costoU = parseFloat(item.costo_unitario_kg) || 0;
      const stockMin = parseFloat(item.stock_minimo_kg) || 10;

      const totalBodegaKg = bSinPorc + bPorcKg;
      const totalCocinaKg = cSinPorc + cPorcKg;
      const totalGenKg = totalBodegaKg + totalCocinaKg;

      const mermaData = mermasMap[String(item.id)] || mermasMap[item.nombre] || { kg: 0, pesos: 0 };

      let estado: 'OPTIMO' | 'BAJO' | 'AGOTADO' = 'OPTIMO';
      if (totalGenKg <= 0) estado = 'AGOTADO';
      else if (totalGenKg <= stockMin) estado = 'BAJO';

      return {
        insumo_id: item.id,
        codigo: item.codigo,
        insumo: item.nombre,
        categoria: item.categoria,
        es_carne: item.es_carne,
        unidad_medida: item.unidad_medida,
        costo_unitario_kg: costoU,
        peso_porc_gramos: Math.round((parseFloat(item.peso_estandar_porcion_kg) || 0.35) * 1000),
        bodega_sin_porc_kg: bSinPorc,
        bodega_porc_und: bPorcUnd,
        bodega_porc_kg: bPorcKg,
        peso_total_bodega_kg: totalBodegaKg,
        cocina_porc_und: cPorcUnd,
        cocina_porc_kg: cPorcKg,
        valor_total_general_pesos: totalBodegaKg * costoU,
        merma_acumulada_kg: mermaData.kg,
        merma_acumulada_pesos: mermaData.pesos,
        estado_stock: estado,
      };
    });

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
