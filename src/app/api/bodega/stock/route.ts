import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { InsumoItem } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let res = await supabase
      .from('catalogo_insumos')
      .select('*, stock_actual(*)')
      .eq('activo', true)
      .order('orden_visual', { ascending: true })
      .order('nombre', { ascending: true });

    if (res.error || !res.data || res.data.length === 0) {
      res = await supabase
        .from('catalogo_insumos')
        .select('*, stock_actual(*)')
        .order('id', { ascending: true });
    }

    const items: InsumoItem[] = (res.data || []).map((item: any) => {
      const st = Array.isArray(item.stock_actual) ? (item.stock_actual[0] || {}) : (item.stock_actual || {});
      const bSinPorc = parseFloat(st.bodega_sin_porcionar_kg) || 0;
      const bPorcUnd = parseInt(st.bodega_porcionado_und) || 0;
      const bPorcKg = parseFloat(st.bodega_porcionado_kg) || 0;
      const cSinPorc = parseFloat(st.cocina_sin_porcionar_kg) || 0;
      const cPorcUnd = parseInt(st.cocina_porcionado_und) || 0;
      const cPorcKg = parseFloat(st.cocina_porcionado_kg) || 0;

      const totalBodegaKg = bSinPorc + bPorcKg;
      const totalCocinaKg = cSinPorc + cPorcKg;
      const totalGeneralKg = totalBodegaKg + totalCocinaKg;

      const costoKg = parseFloat(item.costo_unitario_kg) || 0;
      const valorTotal = Math.round(totalGeneralKg * costoKg);

      let estado: 'OPTIMO' | 'BAJO' | 'AGOTADO' = 'OPTIMO';
      const stockMin = parseFloat(item.stock_minimo_kg) || 2;
      if (totalGeneralKg <= 0.05) {
        estado = 'AGOTADO';
      } else if (totalGeneralKg <= stockMin) {
        estado = 'BAJO';
      }

      return {
        insumo_id: item.id,
        insumo: item.nombre,
        categoria: item.categoria || 'CARNE DE RES',
        costo_unitario_kg: costoKg,
        peso_porc_gramos: parseInt(item.peso_porc_gramos) || 350,
        bodega_sin_porc_kg: bSinPorc,
        bodega_porc_und: bPorcUnd,
        bodega_porc_kg: bPorcKg,
        peso_total_bodega_kg: totalBodegaKg,
        cocina_sin_porc_kg: cSinPorc,
        cocina_porc_und: cPorcUnd,
        cocina_porc_kg: cPorcKg,
        peso_total_cocina_kg: totalCocinaKg,
        peso_total_general_kg: totalGeneralKg,
        valor_total_general_pesos: valorTotal,
        merma_acumulada_kg: 0,
        merma_acumulada_pesos: 0,
        estado_stock: estado,
      };
    });

    return NextResponse.json({ success: true, data: items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
