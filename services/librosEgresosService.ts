import { supabase } from '@/lib/supabase';

export interface RegistroCajaMenor {
  id: string;
  periodo_id: string;
  fecha: string;
  pagina_recibo?: string;
  caja_responsable: string;
  item_manuscrito: string;
  valor_caja: number;
  categoria_caja?: string;
  estado_conciliacion: string;
  factura_soporte?: string;
  transaccion_id?: string;
  incluido_en_costeo: boolean;
  diagnostico_auditoria?: string;
  created_at?: string;
}

export interface RegistroCuadernoArturo {
  id: string;
  periodo_id: string;
  renglon_numero?: number;
  item_cuaderno: string;
  valor_cuaderno: number;
  estado_conciliacion: string;
  factura_soporte?: string;
  transaccion_id?: string;
  incluido_en_costeo: boolean;
  observaciones_auditoria?: string;
  created_at?: string;
}

export interface CajaMenorKPIs {
  totalCaja: number;
  totalCruzadoFactura: number;
  totalSinFactura: number;
  totalIncluidosCosteo: number;
  totalRegistros: number;
}

export interface CuadernoArturoKPIs {
  totalArturo: number;
  totalConciliadoExacto: number;
  totalDirectoManual: number;
  totalDiferencias: number;
  totalRegistros: number;
}

/**
 * Consulta registros de Caja Menor con KPIs
 */
export async function getCajaMenorData(filter: {
  periodo_id?: string;
  responsable?: string;
  estado?: string;
  search?: string;
} = {}) {
  const periodoId = filter.periodo_id || 'per-2026-09';

  let query = supabase
    .from('libro_caja_menor')
    .select('*')
    .eq('periodo_id', periodoId)
    .order('fecha', { ascending: false })
    .order('id', { ascending: true });

  if (filter.responsable && filter.responsable !== 'ALL') {
    query = query.eq('caja_responsable', filter.responsable);
  }

  if (filter.estado && filter.estado !== 'ALL') {
    query = query.eq('estado_conciliacion', filter.estado);
  }

  const { data, error } = await query;
  if (error) throw error;

  let registros: RegistroCajaMenor[] = (data || []).map((r: any) => ({
    id: r.id,
    periodo_id: r.periodo_id,
    fecha: r.fecha,
    pagina_recibo: r.pagina_recibo,
    caja_responsable: r.caja_responsable,
    item_manuscrito: r.item_manuscrito,
    valor_caja: parseFloat(r.valor_caja) || 0,
    categoria_caja: r.categoria_caja,
    estado_conciliacion: r.estado_conciliacion,
    factura_soporte: r.factura_soporte,
    transaccion_id: r.transaccion_id,
    incluido_en_costeo: !!r.incluido_en_costeo,
    diagnostico_auditoria: r.diagnostico_auditoria,
    created_at: r.created_at,
  }));

  if (filter.search && filter.search.trim()) {
    const q = filter.search.toLowerCase().trim();
    registros = registros.filter(
      (r) =>
        r.item_manuscrito.toLowerCase().includes(q) ||
        r.caja_responsable.toLowerCase().includes(q) ||
        (r.factura_soporte && r.factura_soporte.toLowerCase().includes(q)) ||
        (r.categoria_caja && r.categoria_caja.toLowerCase().includes(q))
    );
  }

  // KPIs
  let totalCaja = 0;
  let totalCruzadoFactura = 0;
  let totalSinFactura = 0;
  let totalIncluidosCosteo = 0;
  const responsablesSet = new Set<string>();

  (data || []).forEach((r: any) => {
    const val = parseFloat(r.valor_caja) || 0;
    totalCaja += val;
    if (r.estado_conciliacion === 'CRUZADO_CON_FACTURA') {
      totalCruzadoFactura += val;
    } else {
      totalSinFactura += val;
    }
    if (r.incluido_en_costeo) {
      totalIncluidosCosteo += val;
    }
    if (r.caja_responsable) responsablesSet.add(r.caja_responsable);
  });

  const kpis: CajaMenorKPIs = {
    totalCaja,
    totalCruzadoFactura,
    totalSinFactura,
    totalIncluidosCosteo,
    totalRegistros: (data || []).length,
  };

  return {
    registros,
    kpis,
    responsables: Array.from(responsablesSet).sort(),
  };
}

/**
 * Consulta registros del Cuaderno Principal de Don Arturo con KPIs
 */
export async function getCuadernoArturoData(filter: {
  periodo_id?: string;
  estado?: string;
  search?: string;
} = {}) {
  const periodoId = filter.periodo_id || 'per-2026-09';

  let query = supabase
    .from('libro_cuaderno_arturo')
    .select('*')
    .eq('periodo_id', periodoId)
    .order('renglon_numero', { ascending: true });

  if (filter.estado && filter.estado !== 'ALL') {
    query = query.eq('estado_conciliacion', filter.estado);
  }

  const { data, error } = await query;
  if (error) throw error;

  let registros: RegistroCuadernoArturo[] = (data || []).map((r: any) => ({
    id: r.id,
    periodo_id: r.periodo_id,
    renglon_numero: parseInt(r.renglon_numero) || 0,
    item_cuaderno: r.item_cuaderno,
    valor_cuaderno: parseFloat(r.valor_cuaderno) || 0,
    estado_conciliacion: r.estado_conciliacion,
    factura_soporte: r.factura_soporte,
    transaccion_id: r.transaccion_id,
    incluido_en_costeo: !!r.incluido_en_costeo,
    observaciones_auditoria: r.observaciones_auditoria,
    created_at: r.created_at,
  }));

  if (filter.search && filter.search.trim()) {
    const q = filter.search.toLowerCase().trim();
    registros = registros.filter(
      (r) =>
        r.item_cuaderno.toLowerCase().includes(q) ||
        (r.factura_soporte && r.factura_soporte.toLowerCase().includes(q)) ||
        (r.observaciones_auditoria && r.observaciones_auditoria.toLowerCase().includes(q))
    );
  }

  // KPIs
  let totalArturo = 0;
  let totalConciliadoExacto = 0;
  let totalDirectoManual = 0;
  let totalDiferencias = 0;

  (data || []).forEach((r: any) => {
    const val = parseFloat(r.valor_cuaderno) || 0;
    totalArturo += val;
    const est = (r.estado_conciliacion || '').toUpperCase();
    if (est.includes('EXACTO') || est.includes('LEGALIZADO')) {
      totalConciliadoExacto += val;
    } else if (est.includes('MANUAL') || est.includes('CUADERNO')) {
      totalDirectoManual += val;
    } else if (est.includes('DIFERENCIA') || est.includes('FALTA')) {
      totalDiferencias += val;
    }
  });

  const kpis: CuadernoArturoKPIs = {
    totalArturo,
    totalConciliadoExacto,
    totalDirectoManual,
    totalDiferencias,
    totalRegistros: (data || []).length,
  };

  return {
    registros,
    kpis,
  };
}

/**
 * Alterna si un egreso de Caja Menor suma o no al Costeo General
 */
export async function toggleCajaCosteo(id: string, incluir: boolean) {
  const { error } = await supabase
    .from('libro_caja_menor')
    .update({ incluido_en_costeo: incluir, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return { success: true, incluido: incluir };
}

/**
 * Alterna si un egreso del Cuaderno de Don Arturo suma o no al Costeo General
 */
export async function toggleArturoCosteo(id: string, incluir: boolean) {
  const { error } = await supabase
    .from('libro_cuaderno_arturo')
    .update({ incluido_en_costeo: incluir, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return { success: true, incluido: incluir };
}
