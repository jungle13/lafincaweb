import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatMonthName(codigo: string): string {
  const parts = codigo.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const mNum = parseInt(parts[1], 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${MONTH_NAMES[mNum - 1]} ${year}`;
    }
  }
  return codigo;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const periodoId = searchParams.get('periodo_id') || searchParams.get('codigo');

    // 1. Obtener todos los períodos oficiales desde la tabla 'periodos'
    let { data: periodosData, error: pError } = await supabase
      .from('periodos')
      .select('*')
      .order('codigo', { ascending: false });

    if (pError || !periodosData || periodosData.length === 0) {
      // Si la tabla estuviera vacía o en fallback
      periodosData = [
        {
          id: 'per-2026-11',
          codigo: '2026-11',
          nombre: 'Noviembre 2026',
          fecha_inicio: '2026-11-01',
          fecha_fin: '2026-11-30',
          estado: 'ABIERTO',
          inicial_registrado: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'per-2026-10',
          codigo: '2026-10',
          nombre: 'Octubre 2026',
          fecha_inicio: '2026-10-01',
          fecha_fin: '2026-10-31',
          estado: 'CERRADO',
          inicial_registrado: true,
          created_at: new Date().toISOString(),
        }
      ];
    }

    // 2. Extraer estadísticas de Compras
    const { data: comprasRows } = await supabase
      .from('compras')
      .select('periodo_id, fecha, valor_total');

    const comprasStats: Record<string, { count: number; total: number }> = {};
    (comprasRows || []).forEach((c: any) => {
      let pId = c.periodo_id;
      if (!pId && c.fecha) pId = `per-${c.fecha.substring(0, 7)}`;
      if (pId) {
        if (!comprasStats[pId]) comprasStats[pId] = { count: 0, total: 0 };
        comprasStats[pId].count += 1;
        comprasStats[pId].total += Number(c.valor_total || 0);
      }
    });

    // 3. Extraer estadísticas de Ventas
    const { data: ventasRows } = await supabase
      .from('ventas_diarias')
      .select('periodo_id, fecha, gran_total');

    const ventasStats: Record<string, { count: number; total: number }> = {};
    (ventasRows || []).forEach((v: any) => {
      let pId = v.periodo_id;
      if (!pId && v.fecha) pId = `per-${v.fecha.substring(0, 7)}`;
      if (pId) {
        if (!ventasStats[pId]) ventasStats[pId] = { count: 0, total: 0 };
        ventasStats[pId].count += 1;
        ventasStats[pId].total += Number(v.gran_total || 0);
      }
    });

    // 4. Extraer estadísticas de Hojas de Costeo Diario
    const { data: costeoRows } = await supabase
      .from('costeo_diario')
      .select('fecha');

    const costeoStats: Record<string, number> = {};
    (costeoRows || []).forEach((s: any) => {
      if (s.fecha && s.fecha.length >= 7) {
        const pId = `per-${s.fecha.substring(0, 7)}`;
        costeoStats[pId] = (costeoStats[pId] || 0) + 1;
      }
    });

    // 5. Mapear períodos enriquecidos con métricas
    const periodosEnriquecidos = (periodosData || []).map((p: any) => {
      const cStat = comprasStats[p.id] || { count: 0, total: 0 };
      const vStat = ventasStats[p.id] || { count: 0, total: 0 };
      const hojasCount = costeoStats[p.id] || 0;

      return {
        ...p,
        nombre: p.nombre || formatMonthName(p.codigo),
        stats: {
          compras_facturas: cStat.count,
          compras_total: cStat.total,
          ventas_dias: vStat.count,
          ventas_total: vStat.total,
          costeo_hojas: hojasCount,
        }
      };
    });

    // Período activo (el primero abierto, o el más reciente)
    const activo = periodosEnriquecidos.find((p: any) => p.estado === 'ABIERTO') || periodosEnriquecidos[0];
    const selectedPeriodo = periodoId
      ? periodosEnriquecidos.find((p: any) => p.id === periodoId || p.codigo === periodoId) || activo
      : activo;

    return NextResponse.json({
      success: true,
      periodos: periodosEnriquecidos,
      activo,
      selectedPeriodo,
      fecha_corte: 'ACTUAL',
      total_movs_aplicados: 0,
      fechas_con_movimientos: [],
      conteos_aplicados: [],
      insumos: [],
      stock: [],
      conteo_cierre_fisico: {},
      ajustes_aprobados: {},
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('Error en GET /api/periodos:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { codigo, nombre, estado = 'ABIERTO', observaciones } = body;

    if (!codigo || !/^\d{4}-\d{2}$/.test(codigo)) {
      return NextResponse.json(
        { success: false, error: 'El código del período debe tener el formato YYYY-MM (ej: 2026-11)' },
        { status: 400 }
      );
    }

    const id = `per-${codigo}`;
    const [yearStr, monthStr] = codigo.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Mes inválido. Debe estar entre 01 y 12.' },
        { status: 400 }
      );
    }

    // Calcular fechas inicio y fin
    const lastDay = new Date(year, month, 0).getDate();
    const fecha_inicio = `${codigo}-01`;
    const fecha_fin = `${codigo}-${String(lastDay).padStart(2, '0')}`;
    const nombrePeriodo = nombre?.trim() || `${MONTH_NAMES[month - 1]} ${year}`;

    // Verificar si ya existe en la base de datos
    const { data: existing } = await supabase
      .from('periodos')
      .select('id, codigo, nombre')
      .eq('id', id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: `El período "${existing.nombre}" (${existing.codigo}) ya existe en el sistema.` },
        { status: 409 }
      );
    }

    // Insertar en la tabla periodos
    const nowIso = new Date().toISOString();
    const newPeriodo = {
      id,
      codigo,
      nombre: nombrePeriodo,
      fecha_inicio,
      fecha_fin,
      estado,
      inicial_registrado: true,
      inventario_inicial: {},
      conteo_cierre_fisico: {},
      ajustes_aprobados: {},
      observaciones_cierre: observaciones || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('periodos')
      .insert([newPeriodo])
      .select()
      .single();

    if (insertError) {
      console.error('Error insertando periodo en Supabase:', insertError);
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      periodo: inserted,
      message: `Período "${nombrePeriodo}" creado exitosamente.`
    });
  } catch (err: any) {
    console.error('Error en POST /api/periodos:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Error al crear el período contable' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, estado, nombre, observaciones } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Se requiere el ID del período' }, { status: 400 });
    }

    const updates: any = {
      updated_at: new Date().toISOString()
    };
    if (estado) updates.estado = estado;
    if (nombre) updates.nombre = nombre;
    if (observaciones !== undefined) updates.observaciones_cierre = observaciones;

    const { data: updated, error: updateError } = await supabase
      .from('periodos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error actualizando periodo en Supabase:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      periodo: updated,
      message: 'Período contable actualizado exitosamente.'
    });
  } catch (err: any) {
    console.error('Error en PUT /api/periodos:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Error al actualizar período' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Se requiere el ID del período' }, { status: 400 });
    }

    // Proteger contra eliminación de períodos con compras o ventas registradas
    const { data: compras } = await supabase.from('compras').select('id').eq('periodo_id', id).limit(1);
    if (compras && compras.length > 0) {
      return NextResponse.json(
        { success: false, error: 'No se puede eliminar un período con facturas de compra registradas.' },
        { status: 400 }
      );
    }

    const { data: ventas } = await supabase.from('ventas_diarias').select('id').eq('periodo_id', id).limit(1);
    if (ventas && ventas.length > 0) {
      return NextResponse.json(
        { success: false, error: 'No se puede eliminar un período con ventas registradas.' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('periodos').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Período eliminado correctamente.' });
  } catch (err: any) {
    console.error('Error en DELETE /api/periodos:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Error al eliminar período' }, { status: 500 });
  }
}

