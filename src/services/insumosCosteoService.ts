import { supabase } from '@/lib/supabase';

export interface TransaccionGastoInsumo {
  id: string;
  periodo_id: string;
  fecha: string;
  dia: number;
  categoria: string;
  submodulo: 'CARNES' | 'BEBIDAS' | 'DESECHABLES' | 'NOMINA' | 'SERVICIOS_PUBLICOS' | 'ARRENDAMIENTO' | 'COCINA_VERDURAS_GRANO' | 'SERVICIOS_GENERALES' | 'INVENTARIO_INICIAL';
  tipo_contable: 'COSTO_DIRECTO' | 'GASTO_OPERATIVO';
  item: string;
  descripcion_original?: string;
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  valor_total: number;
  numero_factura: string;
  relacion_cuaderno: string;
  observacion?: string;
  created_at?: string;
}

export interface InsumosFilter {
  periodo_id?: string;
  submodulo?: string;
  fecha?: string;
  proveedor?: string;
  search?: string;
  relacion_cuaderno?: string;
  tipo_contable?: string;
}

export interface InsumosKPIs {
  totalCostosGastos: number;
  totalCostosDirectos: number;
  totalGastosOperativos: number;
  porcentajeCostosDirectos: number;
  porcentajeGastosOperativos: number;
  promedioDiario: number;
  totalTransacciones: number;
  totalFacturas: number;
}

export interface FacturaGroup {
  numeroFactura: string;
  fecha: string;
  proveedor: string;
  totalFactura: number;
  itemsCount: number;
  relacionCuaderno: string;
  items: TransaccionGastoInsumo[];
}

export interface ItemCosteoGroup {
  item: string;
  categoria: string;
  submodulo: string;
  tipoContable: string;
  proveedorPrincipal: string;
  cantidadTotal: number;
  costoPromedioPonderado: number;
  valorTotal: number;
  comprasCount: number;
  transacciones: TransaccionGastoInsumo[];
}

/**
 * Consulta transacciones aplicando filtros dinámicos
 */
export async function getTransaccionesInsumos(filter: InsumosFilter = {}): Promise<TransaccionGastoInsumo[]> {
  let query = supabase
    .from('transacciones_gastos_insumos')
    .select('*')
    .order('fecha', { ascending: false })
    .order('dia', { ascending: false })
    .order('id', { ascending: true })
    .limit(2000);

  if (filter.periodo_id && filter.periodo_id !== 'ALL') {
    query = query.eq('periodo_id', filter.periodo_id);
  }

  if (filter.submodulo && filter.submodulo !== 'ALL') {
    query = query.eq('submodulo', filter.submodulo);
  }

  if (filter.tipo_contable && filter.tipo_contable !== 'ALL') {
    query = query.eq('tipo_contable', filter.tipo_contable);
  }

  if (filter.fecha && filter.fecha !== 'ALL') {
    query = query.eq('fecha', filter.fecha);
  }

  if (filter.proveedor && filter.proveedor !== 'ALL') {
    query = query.eq('proveedor', filter.proveedor);
  }

  if (filter.relacion_cuaderno && filter.relacion_cuaderno !== 'ALL') {
    query = query.eq('relacion_cuaderno', filter.relacion_cuaderno);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching transacciones_gastos_insumos:', error);
    return [];
  }

  let results: TransaccionGastoInsumo[] = (data || []).map((row: any) => ({
    id: row.id,
    periodo_id: row.periodo_id,
    fecha: row.fecha,
    dia: parseInt(row.dia) || 1,
    categoria: row.categoria,
    submodulo: row.submodulo,
    tipo_contable: row.tipo_contable,
    item: row.item,
    descripcion_original: row.descripcion_original,
    proveedor: row.proveedor,
    cantidad: parseFloat(row.cantidad) || 0,
    costo_unitario: parseFloat(row.costo_unitario) || 0,
    valor_total: parseFloat(row.valor_total) || 0,
    numero_factura: row.numero_factura,
    relacion_cuaderno: row.relacion_cuaderno,
    observacion: row.observacion,
    created_at: row.created_at,
  }));

  // Filtrado de búsqueda textual en memoria (item, descripcion, factura, proveedor)
  if (filter.search && filter.search.trim()) {
    const q = filter.search.toLowerCase().trim();
    results = results.filter((r) => 
      r.item.toLowerCase().includes(q) ||
      (r.descripcion_original && r.descripcion_original.toLowerCase().includes(q)) ||
      r.numero_factura.toLowerCase().includes(q) ||
      r.proveedor.toLowerCase().includes(q) ||
      r.categoria.toLowerCase().includes(q)
    );
  }

  return results;
}

/**
 * Calcula los KPIs financieros y contables del set de datos
 */
export function calculateInsumosKPIs(transacciones: TransaccionGastoInsumo[]): InsumosKPIs {
  let totalCostosGastos = 0;
  let totalCostosDirectos = 0;
  let totalGastosOperativos = 0;
  const facturasSet = new Set<string>();
  const diasSet = new Set<number>();

  transacciones.forEach((t) => {
    totalCostosGastos += t.valor_total;
    if (t.tipo_contable === 'COSTO_DIRECTO') {
      totalCostosDirectos += t.valor_total;
    } else {
      totalGastosOperativos += t.valor_total;
    }
    if (t.numero_factura) facturasSet.add(t.numero_factura);
    if (t.dia) diasSet.add(t.dia);
  });

  const porcentajeCostosDirectos = totalCostosGastos > 0 ? (totalCostosDirectos / totalCostosGastos) * 100 : 0;
  const porcentajeGastosOperativos = totalCostosGastos > 0 ? (totalGastosOperativos / totalCostosGastos) * 100 : 0;
  const diasContados = diasSet.size > 0 ? diasSet.size : 1;
  const promedioDiario = totalCostosGastos / diasContados;

  return {
    totalCostosGastos,
    totalCostosDirectos,
    totalGastosOperativos,
    porcentajeCostosDirectos,
    porcentajeGastosOperativos,
    promedioDiario,
    totalTransacciones: transacciones.length,
    totalFacturas: facturasSet.size,
  };
}

/**
 * Agrupa transacciones por Comprobante / Factura
 */
export function groupTransactionsByInvoice(transacciones: TransaccionGastoInsumo[]): FacturaGroup[] {
  const map = new Map<string, FacturaGroup>();

  transacciones.forEach((t) => {
    const key = t.numero_factura || `S_FAC_${t.id}`;
    if (!map.has(key)) {
      map.set(key, {
        numeroFactura: t.numero_factura,
        fecha: t.fecha,
        proveedor: t.proveedor,
        totalFactura: t.valor_total,
        itemsCount: 1,
        relacionCuaderno: t.relacion_cuaderno,
        items: [t],
      });
    } else {
      const g = map.get(key)!;
      g.totalFactura += t.valor_total;
      g.itemsCount += 1;
      g.items.push(t);
      if (t.relacion_cuaderno === 'Cruza con Cuaderno Don Arturo') {
        g.relacionCuaderno = 'Cruza con Cuaderno Don Arturo';
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Agrupa transacciones por Insumo / Ítem de gasto
 */
export function groupTransactionsByItem(transacciones: TransaccionGastoInsumo[]): ItemCosteoGroup[] {
  const map = new Map<string, ItemCosteoGroup>();

  transacciones.forEach((t) => {
    const key = t.item.trim();
    if (!map.has(key)) {
      map.set(key, {
        item: t.item,
        categoria: t.categoria,
        submodulo: t.submodulo,
        tipoContable: t.tipo_contable,
        proveedorPrincipal: t.proveedor,
        cantidadTotal: t.cantidad,
        costoPromedioPonderado: t.costo_unitario,
        valorTotal: t.valor_total,
        comprasCount: 1,
        transacciones: [t],
      });
    } else {
      const g = map.get(key)!;
      g.cantidadTotal += t.cantidad;
      g.valorTotal += t.valor_total;
      g.comprasCount += 1;
      g.costoPromedioPonderado = g.cantidadTotal > 0 ? Math.round(g.valorTotal / g.cantidadTotal) : g.costoPromedioPonderado;
      g.transacciones.push(t);
    }
  });

  return Array.from(map.values()).sort((a, b) => b.valorTotal - a.valorTotal);
}

/**
 * Obtiene lista única de proveedores ordenados alfabéticamente
 */
export async function getProveedoresList(periodoId: string = 'per-2026-09'): Promise<string[]> {
  const { data, error } = await supabase
    .from('transacciones_gastos_insumos')
    .select('proveedor')
    .eq('periodo_id', periodoId);

  if (error || !data) return [];

  const set = new Set<string>();
  data.forEach((d: any) => {
    if (d.proveedor) set.add(d.proveedor.trim());
  });

  return Array.from(set).sort();
}
