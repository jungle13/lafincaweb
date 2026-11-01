import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PeriodoInventario {
  id: string;
  codigo: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'ABIERTO' | 'EN_CONCILIACION' | 'CERRADO';
  inicial_registrado: boolean;
  inventario_inicial: Record<string, any>;
  conteo_cierre_fisico?: Record<string, any>;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getPeriodoFromMonthKey(monthKey: string, isLatest: boolean): PeriodoInventario {
  const parts = monthKey.split('-');
  const year = parseInt(parts[0], 10);
  const mNum = parseInt(parts[1], 10);
  const name = (mNum >= 1 && mNum <= 12) ? `${MONTH_NAMES[mNum - 1]} ${year}` : monthKey;

  const lastDay = new Date(year, mNum, 0).getDate();
  const fecha_inicio = `${monthKey}-01`;
  const fecha_fin = `${monthKey}-${String(lastDay).padStart(2, '0')}`;

  return {
    id: `per-${monthKey}`,
    codigo: monthKey,
    nombre: name,
    fecha_inicio,
    fecha_fin,
    estado: isLatest ? 'ABIERTO' : 'CERRADO',
    inicial_registrado: true,
    inventario_inicial: {},
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const periodoId = searchParams.get('periodo_id') || searchParams.get('codigo');

    // Conjunto de meses disponibles
    const monthKeys = new Set<string>();
    
    // Meses operacionales base
    monthKeys.add('2026-11');
    monthKeys.add('2026-10');
    monthKeys.add('2026-09');

    // Consultar dinámicamente fechas en costeo_diario
    try {
      const { data: sheets } = await supabase
        .from('costeo_diario')
        .select('fecha');
      (sheets || []).forEach((s: any) => {
        if (s.fecha && s.fecha.length >= 7) {
          monthKeys.add(s.fecha.slice(0, 7));
        }
      });
    } catch (_) {
      // Si la consulta falla, se mantienen los meses base
    }

    // Ordenar descendente (más reciente primero: 2026-11, 2026-10, 2026-09...)
    const sortedKeys = Array.from(monthKeys).sort((a, b) => b.localeCompare(a));
    const periodos = sortedKeys.map((k, idx) => getPeriodoFromMonthKey(k, idx === 0));

    const activo = periodos[0];
    const currentPeriodo = periodoId
      ? periodos.find(p => p.id === periodoId || p.codigo === periodoId) || activo
      : activo;

    return NextResponse.json({
      success: true,
      periodos,
      activo,
      selectedPeriodo: currentPeriodo,
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
