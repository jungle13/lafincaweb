import { NextResponse } from 'next/server';

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

const OPERATIONAL_PERIODOS: PeriodoInventario[] = [
  {
    id: 'per-2026-10',
    codigo: '2026-10',
    nombre: 'Octubre 2026',
    fecha_inicio: '2026-10-01',
    fecha_fin: '2026-10-31',
    estado: 'ABIERTO',
    inicial_registrado: true,
    inventario_inicial: {},
  },
  {
    id: 'per-2026-09',
    codigo: '2026-09',
    nombre: 'Septiembre 2026',
    fecha_inicio: '2026-09-01',
    fecha_fin: '2026-09-30',
    estado: 'CERRADO',
    inicial_registrado: true,
    inventario_inicial: {},
  },
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const periodoId = searchParams.get('periodo_id') || searchParams.get('codigo');

    const activo = OPERATIONAL_PERIODOS[0];
    const currentPeriodo = periodoId
      ? OPERATIONAL_PERIODOS.find(p => p.id === periodoId || p.codigo === periodoId) || activo
      : activo;

    return NextResponse.json({
      success: true,
      periodos: OPERATIONAL_PERIODOS,
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
