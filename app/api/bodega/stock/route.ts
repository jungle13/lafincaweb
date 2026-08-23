import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { InsumoItem } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Obtener existencias directamente de la vista maestra de base de datos
    const { data: viewData, error: viewErr } = await supabase
      .from('v_inventario_en_vivo')
      .select('*');

    if (viewErr) {
      console.error('Error fetching v_inventario_en_vivo:', viewErr);
      return NextResponse.json({ error: viewErr.message }, { status: 500 });
    }

    // 2. Obtener mermas acumuladas de movimientos
    const { data: mermasData } = await supabase
      .from('movimientos_inventario')
      .select('insumo_id, merma_kg, merma_pesos')
      .gt('merma_kg', 0);

    const mermasMap = new Map<string, { mermaKg: number; mermaPesos: number }>();
    (mermasData || []).forEach((m: any) => {
      const id = String(m.insumo_id);
      const cur = mermasMap.get(id) || { mermaKg: 0, mermaPesos: 0 };
      cur.mermaKg += parseFloat(m.merma_kg) || 0;
      cur.mermaPesos += parseFloat(m.merma_pesos) || 0;
      mermasMap.set(id, cur);
    });

    const items: InsumoItem[] = (viewData || []).map((item: any) => {
      const mermaInfo = mermasMap.get(String(item.insumo_id)) || { mermaKg: 0, mermaPesos: 0 };
      const costoKg = parseFloat(item.costo_unitario_kg) || 0;
      const bSinPorc = parseFloat(item.bodega_sin_porc_kg) || 0;
      const bPorcUnd = parseInt(item.bodega_porc_und) || 0;
      const bPorcKg = parseFloat(item.bodega_porc_kg) || 0;
      const cSinPorc = parseFloat(item.cocina_sin_porc_kg) || 0;
      const cPorcUnd = parseInt(item.cocina_porc_und) || 0;
      const cPorcKg = parseFloat(item.cocina_porc_kg) || 0;
      const totalBodegaKg = parseFloat(item.peso_total_bodega_kg) || (bSinPorc + bPorcKg);
      const totalCocinaKg = parseFloat(item.peso_total_cocina_kg) || (cSinPorc + cPorcKg);
      const totalGeneralKg = parseFloat(item.peso_total_general_kg) || (totalBodegaKg + totalCocinaKg);
      const valorTotal = Math.round(totalGeneralKg * costoKg);

      return {
        insumo_id: item.insumo_id,
        codigo: item.codigo,
        insumo: item.insumo,
        categoria: item.categoria || 'CARNE DE RES',
        es_carne: item.es_carne !== false,
        costo_unitario_kg: costoKg,
        peso_porc_gramos: Math.round((parseFloat(item.peso_estandar_porcion_kg) || 0.35) * 1000),
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
        merma_acumulada_kg: mermaInfo.mermaKg,
        merma_acumulada_pesos: mermaInfo.mermaPesos,
        estado_stock: item.estado_stock || 'OPTIMO',
      };
    });

    return NextResponse.json(
      { success: true, data: items },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
