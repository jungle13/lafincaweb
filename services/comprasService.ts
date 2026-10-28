import { supabase } from '@/lib/supabase';

export interface CompraDetalleItem {
  id: string;
  compra_id: string;
  insumo_id: string | null;
  fecha: string;
  numero_factura: string;
  proveedor: string;
  categoria: string;
  nombre_insumo: string;
  detalle: string;
  cantidad: number;
  unidad: string;
  costo_unitario: number;
  valor_compra: number;
  origen: string;
  observaciones: string;
}

export interface CompraFacturaGroup {
  id: string;
  fecha: string;
  numero_factura: string;
  proveedor: string;
  categoria: string;
  valor_total: number;
  total_items: number;
  origen: string;
  observaciones: string;
  items: CompraDetalleItem[];
}

export interface CompraInsumoGroup {
  nombre_insumo: string;
  categoria: string;
  unidad: string;
  cantidad_total: number;
  costo_promedio: number;
  ultimo_costo: number;
  total_dinero: number;
  num_compras: number;
  proveedores: string[];
  ultima_fecha: string;
}

export interface CategoriaKPI {
  categoria: string;
  numCompras: number;
  totalDinero: number;
  porcentaje: number;
}

export interface ComprasKPIs {
  totalFacturas: number;
  totalDinero: number;
  totalItems: number;
  categorias: CategoriaKPI[];
}

export interface ComprasResponse {
  success: boolean;
  kpis: ComprasKPIs;
  facturas: CompraFacturaGroup[];
  insumos: CompraInsumoGroup[];
  lineas: CompraDetalleItem[];
  proveedores: string[];
  categorias: string[];
  fechas: string[];
  error?: string;
}

export async function fetchComprasData(periodoId: string = 'per-2026-10'): Promise<ComprasResponse> {
  try {
    // 1. Obtener todas las compras del periodo
    const { data: facturasData, error: errF } = await supabase
      .from('compras')
      .select('*')
      .eq('periodo_id', periodoId)
      .order('fecha', { ascending: false });

    if (errF) throw errF;

    // 2. Obtener todos los detalles de compras del periodo
    const { data: detallesData, error: errD } = await supabase
      .from('compras_detalle')
      .select('*')
      .eq('periodo_id', periodoId)
      .order('fecha', { ascending: false });

    if (errD) throw errD;

    const lineas: CompraDetalleItem[] = (detallesData || []).map((d) => ({
      id: d.id,
      compra_id: d.compra_id,
      insumo_id: d.insumo_id,
      fecha: d.fecha,
      numero_factura: d.numero_factura || 'S/N',
      proveedor: d.proveedor || 'Proveedor General',
      categoria: d.categoria || 'Otros Insumos y Servicios',
      nombre_insumo: d.nombre_insumo || 'Insumo',
      detalle: d.detalle || d.nombre_insumo,
      cantidad: Number(d.cantidad || 0),
      unidad: d.unidad || 'Kg',
      costo_unitario: Number(d.costo_unitario || 0),
      valor_compra: Number(d.valor_compra || 0),
      origen: d.origen || '',
      observaciones: d.observaciones || '',
    }));

    // Agrupar ítems por compra_id para las facturas
    const itemsByCompraId = new Map<string, CompraDetalleItem[]>();
    lineas.forEach((item) => {
      if (!itemsByCompraId.has(item.compra_id)) {
        itemsByCompraId.set(item.compra_id, []);
      }
      itemsByCompraId.get(item.compra_id)!.push(item);
    });

    const facturas: CompraFacturaGroup[] = (facturasData || []).map((f) => {
      const items = itemsByCompraId.get(f.id) || [];
      return {
        id: f.id,
        fecha: f.fecha,
        numero_factura: f.numero_factura || 'S/N',
        proveedor: f.proveedor || 'Proveedor General',
        categoria: f.categoria || (items[0]?.categoria ?? 'Varios'),
        valor_total: Number(f.valor_total || 0),
        total_items: items.length || f.total_items || 0,
        origen: f.origen || (items[0]?.origen ?? ''),
        observaciones: f.observaciones || '',
        items,
      };
    });

    // 3. Agrupación por Insumo
    const insumosMap = new Map<string, {
      nombre_insumo: string;
      categoria: string;
      unidad: string;
      cantidad_total: number;
      total_dinero: number;
      num_compras: number;
      proveedores: Set<string>;
      ultima_fecha: string;
      ultimo_costo: number;
    }>();

    lineas.forEach((item) => {
      const key = item.nombre_insumo;
      if (!insumosMap.has(key)) {
        insumosMap.set(key, {
          nombre_insumo: item.nombre_insumo,
          categoria: item.categoria,
          unidad: item.unidad,
          cantidad_total: 0,
          total_dinero: 0,
          num_compras: 0,
          proveedores: new Set(),
          ultima_fecha: item.fecha,
          ultimo_costo: item.costo_unitario,
        });
      }

      const entry = insumosMap.get(key)!;
      entry.cantidad_total += item.cantidad;
      entry.total_dinero += item.valor_compra;
      entry.num_compras += 1;
      entry.proveedores.add(item.proveedor);

      if (item.fecha >= entry.ultima_fecha) {
        entry.ultima_fecha = item.fecha;
        entry.ultimo_costo = item.costo_unitario;
      }
    });

    const insumos: CompraInsumoGroup[] = Array.from(insumosMap.values())
      .map((i) => ({
        nombre_insumo: i.nombre_insumo,
        categoria: i.categoria,
        unidad: i.unidad,
        cantidad_total: i.cantidad_total,
        costo_promedio: i.cantidad_total > 0 ? Math.round(i.total_dinero / i.cantidad_total) : i.ultimo_costo,
        ultimo_costo: i.ultimo_costo,
        total_dinero: i.total_dinero,
        num_compras: i.num_compras,
        proveedores: Array.from(i.proveedores),
        ultima_fecha: i.ultima_fecha,
      }))
      .sort((a, b) => b.total_dinero - a.total_dinero);

    // 4. KPIs y Categorías
    const totalFacturas = facturas.length;
    const totalItems = lineas.length;
    const totalDinero = facturas.reduce((acc, f) => acc + f.valor_total, 0);

    const catTotalsMap = new Map<string, { numCompras: number; totalDinero: number }>();
    lineas.forEach((item) => {
      const cat = item.categoria;
      if (!catTotalsMap.has(cat)) {
        catTotalsMap.set(cat, { numCompras: 0, totalDinero: 0 });
      }
      const c = catTotalsMap.get(cat)!;
      c.numCompras += 1;
      c.totalDinero += item.valor_compra;
    });

    // Categorías ordenadas según imagen oficial
    const orderCat = [
      'Carnes y Proteínas',
      'Verduras y Frutas',
      'Granos y Harinas',
      'Desechables y Empaques',
      'Bebidas y Licores',
      'Otros Insumos y Servicios',
    ];

    const categoriasKPI: CategoriaKPI[] = orderCat.map((catName) => {
      const d = catTotalsMap.get(catName) || { numCompras: 0, totalDinero: 0 };
      return {
        categoria: catName,
        numCompras: d.numCompras,
        totalDinero: d.totalDinero,
        porcentaje: totalDinero > 0 ? (d.totalDinero / totalDinero) * 100 : 0,
      };
    });

    const proveedores = Array.from(new Set(facturas.map((f) => f.proveedor))).sort();
    const categorias = orderCat;
    const fechas = Array.from(new Set(facturas.map((f) => f.fecha))).sort().reverse();

    return {
      success: true,
      kpis: {
        totalFacturas,
        totalDinero,
        totalItems,
        categorias: categoriasKPI,
      },
      facturas,
      insumos,
      lineas,
      proveedores,
      categorias,
      fechas,
    };
  } catch (err: any) {
    console.error('Error en fetchComprasData:', err);
    return {
      success: false,
      kpis: { totalFacturas: 0, totalDinero: 0, totalItems: 0, categorias: [] },
      facturas: [],
      insumos: [],
      lineas: [],
      proveedores: [],
      categorias: [],
      fechas: [],
      error: err?.message || 'Error consultando compras',
    };
  }
}
