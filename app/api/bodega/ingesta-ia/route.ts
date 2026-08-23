import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeStr } from '@/lib/formatters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INGEST_TOKEN = process.env.INGEST_SECRET_TOKEN || 'la-finca-ia-secret-2026';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Validar token si se proporciona o en producción
    if (token && token !== INGEST_TOKEN) {
      return NextResponse.json({ error: 'Token de autorización inválido' }, { status: 401 });
    }

    const body = await request.json();
    const rawMovimientos = Array.isArray(body) ? body : (body.movimientos || [body]);

    if (rawMovimientos.length === 0) {
      return NextResponse.json({ error: 'No se enviaron movimientos para procesar' }, { status: 400 });
    }

    // 1. Obtener catálogo completo para mapeo inteligente
    const { data: catalogo } = await supabase
      .from('catalogo_insumos')
      .select('id, nombre, codigo, costo_unitario_kg, peso_estandar_porcion_kg');

    const catList = catalogo || [];

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    const insertedRows: any[] = [];
    const errors: any[] = [];

    for (const item of rawMovimientos) {
      try {
        let insumoId = item.insumo_id;

        // Mapeo por nombre si no viene el UUID
        if (!insumoId && item.nombre_insumo) {
          const cleanName = normalizeStr(item.nombre_insumo);
          const found = catList.find((c) => {
            const catName = normalizeStr(c.nombre);
            const catCode = normalizeStr(c.codigo || '');
            return catName.includes(cleanName) || cleanName.includes(catName) || catCode === cleanName;
          });
          if (found) insumoId = found.id;
        }

        if (!insumoId) {
          errors.push({ item, error: `Insumo no encontrado en catálogo para: ${item.nombre_insumo || 'Desconocido'}` });
          continue;
        }

        const catInsumo = catList.find((c) => c.id === insumoId);
        const costoKg = parseFloat(item.costo_unitario_kg) || parseFloat(catInsumo?.costo_unitario_kg) || 0;
        const totalPesos = parseFloat(item.valor_total_movimiento) || (parseFloat(item.cant_sin_porcionar_kg || 0) * costoKg) || 0;

        const tipo = item.tipo_movimiento || 'ENTRADA_COMPRA';
        const obsPrefix = '[PENDIENTE_APROBAR]';
        const rawObs = item.observaciones || (item.proveedor ? `Proveedor: ${item.proveedor} | Factura: ${item.numero_factura || 'Pendiente'}` : 'Extraído automáticamente por Agente IA');
        const finalObs = rawObs.startsWith(obsPrefix) ? rawObs : `${obsPrefix} ${rawObs}`;

        const payload: any = {
          fecha: item.fecha || todayStr,
          fecha_hora: item.fecha_hora || nowIso,
          tipo_movimiento: tipo,
          insumo_id: insumoId,
          origen: item.origen || (tipo === 'ENTRADA_COMPRA' ? `PROVEEDOR (${item.proveedor || 'Local'})` : tipo === 'PORCIONADO' ? 'BODEGA_ENTERO' : tipo === 'TRASLADO_COCINA' ? 'BODEGA_PORCIONADO' : 'COCINA_PORCIONADO'),
          destino: item.destino || (tipo === 'ENTRADA_COMPRA' ? 'BODEGA_ENTERO' : tipo === 'PORCIONADO' ? 'BODEGA_PORCIONADO' : tipo === 'TRASLADO_COCINA' ? 'COCINA_PORCIONADO' : 'BODEGA_PORCIONADO'),
          cant_sin_porcionar_kg: parseFloat(item.cant_sin_porcionar_kg) || 0,
          porciones_und: parseInt(item.porciones_und) || 0,
          peso_porciones_kg: parseFloat(item.peso_porciones_kg) || 0,
          merma_kg: parseFloat(item.merma_kg) || 0,
          costo_unitario_kg: costoKg,
          valor_total_movimiento: totalPesos,
          observaciones: finalObs,
          usuario: item.usuario || 'Antigravity AI (Pendiente)',
        };

        const { data: inserted, error: insErr } = await supabase
          .from('movimientos_inventario')
          .insert([payload])
          .select('*, catalogo_insumos(nombre, categoria)')
          .single();

        if (insErr) {
          errors.push({ item, error: insErr.message });
        } else {
          insertedRows.push(inserted);
        }
      } catch (e: any) {
        errors.push({ item, error: e.message });
      }
    }

    return NextResponse.json({
      success: true,
      insertedCount: insertedRows.length,
      movimientos: insertedRows,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
