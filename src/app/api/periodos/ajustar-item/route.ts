import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPeriodoById, getAllPeriodos } from '@/lib/periodos';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'periodos.json');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      periodo_id,
      insumo_id,
      tipo_ajuste,
      justificacion,
      fisico,
      teorico,
      usuario = 'Administrador'
    } = body;

    if (!periodo_id || !insumo_id) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios' }, { status: 400 });
    }

    // Obtener catálogo
    const { data: cat } = await supabase
      .from('catalogo_insumos')
      .select('*')
      .eq('id', insumo_id)
      .single();

    if (!cat) {
      return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 });
    }

    const costoKg = Number(cat.costo_unitario_kg) || 0;
    const pesoStd = Number(cat.peso_estandar_porcion_kg) || 0.35;

    const fisEntKg = parseFloat(fisico?.bodega_kg) || 0;
    const fisBUnd = parseInt(fisico?.bodega_und) || 0;
    const fisBPorcKg = parseFloat(fisico?.bodega_porc_kg) || (fisBUnd * pesoStd);
    const fisCUnd = parseInt(fisico?.cocina_und) || 0;
    const fisCPorcKg = fisCUnd * pesoStd;

    const teoEntKg = parseFloat(teorico?.bodega_sin_porcionar_kg) || 0;
    const teoBUnd = parseInt(teorico?.bodega_porcionado_und) || 0;
    const teoBPorcKg = parseFloat(teorico?.bodega_porcionado_kg) || (teoBUnd * pesoStd);
    const teoCUnd = parseInt(teorico?.cocina_porcionado_und) || 0;
    const teoCPorcKg = parseFloat(teorico?.cocina_porcionado_kg) || (teoCUnd * pesoStd);

    const difEntKg = fisEntKg - teoEntKg;
    const difPorcUnd = (fisBUnd + fisCUnd) - (teoBUnd + teoCUnd);
    const difTotalKg = (fisEntKg + fisBPorcKg + fisCPorcKg) - (teoEntKg + teoBPorcKg + teoCPorcKg);
    const valorImpacto = Math.abs(difTotalKg) * costoKg;

    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];

    // 1. Insertar movimiento de ajuste en Supabase
    const { error: movErr } = await supabase.from('movimientos_inventario').insert([{
      fecha: today,
      fecha_hora: nowIso,
      tipo_movimiento: 'AJUSTE_INVENTARIO',
      insumo_id: insumo_id,
      origen: difTotalKg < 0 ? 'BODEGA_Y_COCINA' : 'AJUSTE_ENTRADA',
      destino: difTotalKg < 0 ? (tipo_ajuste || 'MERMA_AUDITORIA') : 'BODEGA_ENTERO',
      cant_sin_porcionar_kg: Math.abs(difEntKg),
      porciones_und: Math.abs(difPorcUnd),
      peso_porciones_kg: Math.abs(difTotalKg - difEntKg),
      costo_unitario_kg: costoKg,
      valor_total_movimiento: Math.round(valorImpacto),
      observaciones: `[AJUSTE_CONCILIACION] ${tipo_ajuste || 'Ajuste de Cierre'}: ${justificacion || 'Conciliación física fin de mes'} | Físico: ${fisEntKg}kg ent, ${fisBUnd}u bod, ${fisCUnd}u coc vs Teórico: ${teoEntKg.toFixed(1)}kg ent, ${teoBUnd}u bod, ${teoCUnd}u coc`,
      usuario: usuario,
      bodega_sin_porc_nuevo_kg: fisEntKg,
      bodega_porc_und_nuevo: fisBUnd,
      bodega_porc_kg_nuevo: fisBPorcKg
    }]);

    if (movErr) {
      console.error('Error insertando movimiento de ajuste:', movErr);
    }

    // 2. Guardar en periodos.json el ajuste aprobado
    let periods = [];
    if (fs.existsSync(DATA_FILE)) {
      periods = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }

    const pIndex = periods.findIndex((p: any) => p.id === periodo_id || p.codigo === periodo_id);
    if (pIndex >= 0) {
      const p = periods[pIndex];
      if (!p.ajustes_aprobados) p.ajustes_aprobados = {};
      if (!p.conteo_cierre_fisico) p.conteo_cierre_fisico = {};

      p.conteo_cierre_fisico[insumo_id] = {
        bodega_kg: fisEntKg,
        bodega_und: fisBUnd,
        bodega_porc_kg: fisBPorcKg,
        cocina_und: fisCUnd,
        cocina_porc_kg: fisCPorcKg
      };

      p.ajustes_aprobados[insumo_id] = {
        tipo_ajuste,
        justificacion,
        usuario,
        fecha_ajuste: nowIso,
        dif_entero_kg: difEntKg,
        dif_porc_und: difPorcUnd,
        dif_total_kg: difTotalKg,
        valor_impacto: Math.round(valorImpacto),
        final_aprobado_kg: fisEntKg + fisBPorcKg + fisCPorcKg,
        final_aprobado_und: fisBUnd + fisCUnd,
        final_aprobado_costo: Math.round((fisEntKg + fisBPorcKg + fisCPorcKg) * costoKg)
      };

      fs.writeFileSync(DATA_FILE, JSON.stringify(periods, null, 2), 'utf8');
    }

    return NextResponse.json({
      success: true,
      message: 'Ajuste aplicado y aprobado exitosamente',
      ajuste: {
        insumo_id,
        tipo_ajuste,
        dif_total_kg: difTotalKg,
        valor_impacto: Math.round(valorImpacto)
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
