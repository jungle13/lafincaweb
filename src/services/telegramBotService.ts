import Groq from 'groq-sdk';
import { supabase } from '@/lib/supabase';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ====================================================================
// 1. FUNCIONES DE CONSULTA A BASE DE DATOS (HERRAMIENTAS PARA GROQ)
// ====================================================================

export function parsearFiltroFecha(fechaRaw?: string, fechaFinRaw?: string): { fechaExacta?: string; fechaInicio?: string; fechaFin?: string } {
  if (!fechaRaw) return {};
  let f = fechaRaw.trim().toLowerCase().replace(/^(202[0-5])-/, '2026-');
  let fFin = fechaFinRaw ? fechaFinRaw.trim().toLowerCase().replace(/^(202[0-5])-/, '2026-') : undefined;

  if (fFin && /^\d{4}-\d{2}-\d{2}$/.test(f) && /^\d{4}-\d{2}-\d{2}$/.test(fFin)) {
    return { fechaInicio: f, fechaFin: fFin };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    return { fechaExacta: f };
  }

  if (/^\d{4}-\d{2}$/.test(f)) {
    const parts = f.split('-');
    const y = parts[0], m = parts[1];
    const dias = new Date(Number(y), Number(m), 0).getDate();
    return { fechaInicio: `${f}-01`, fechaFin: `${f}-${String(dias).padStart(2, '0')}` };
  }

  if (f.includes('oct') || f === '10') return { fechaInicio: '2026-10-01', fechaFin: '2026-10-31' };
  if (f.includes('sep') || f.includes('set') || f === '09' || f === '9') return { fechaInicio: '2026-09-01', fechaFin: '2026-09-30' };
  if (f.includes('nov') || f === '11') return { fechaInicio: '2026-11-01', fechaFin: '2026-11-30' };
  if (f.includes('dic') || f === '12') return { fechaInicio: '2026-12-01', fechaFin: '2026-12-31' };

  const matchDmy = f.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchDmy) {
    let year = matchDmy[3];
    if (Number(year) < 2026) year = '2026';
    return { fechaExacta: `${year}-${matchDmy[2].padStart(2, '0')}-${matchDmy[1].padStart(2, '0')}` };
  }

  return {};
}

export async function consultarMovimientosCocina(fecha?: string, tipo?: string, categoria?: string, insumo?: string) {
  try {
    let q = supabase
      .from('registros_costeo_cocina')
      .select('fecha, tipo, nombre_insumo, categoria, cantidad, unidad, costo_unitario, valor_total');

    if (fecha) {
      const { fechaExacta, fechaInicio, fechaFin } = parsearFiltroFecha(fecha);
      if (fechaExacta) q = q.eq('fecha', fechaExacta);
      else if (fechaInicio && fechaFin) q = q.gte('fecha', fechaInicio).lte('fecha', fechaFin);
    }

    if (tipo && tipo.trim() !== '' && tipo.toUpperCase() !== 'TODOS') {
      const t = tipo.trim().toUpperCase();
      if ((t.includes('CIERR') || t.includes('BEBIDA')) && (t.includes('BODEGA') || t.includes('GENERAL'))) q = q.eq('tipo', 'BODEGA_CIERRE');
      else if (t.includes('APER') && t.includes('BODEGA')) q = q.eq('tipo', 'BODEGA_APERTURA');
      else if (t.includes('CIERR')) q = q.eq('tipo', 'CIERRE');
      else if (t.includes('APER')) q = q.eq('tipo', 'APERTURA');
      else if (t.includes('TRAS') || t.includes('MOV')) q = q.eq('tipo', 'TRASLADO');
      else if (t.includes('DEV')) q = q.eq('tipo', 'DEVOLUCION');
      else if (t.includes('CONSUM')) q = q.eq('tipo', 'CONSUMO');
      else q = q.eq('tipo', t);
    }

    if (categoria && categoria.trim() !== '') {
      const cat = categoria.trim().toLowerCase();
      if (cat.startsWith('carne')) {
        q = q.ilike('categoria', '%carne%');
      } else {
        q = q.ilike('categoria', `%${categoria.trim()}%`);
      }
    }

    if (insumo && insumo.trim() !== '') q = q.ilike('nombre_insumo', `%${insumo.trim()}%`);

    const { data, error } = await q.order('nombre_insumo', { ascending: true }).limit(80);
    if (error) throw error;

    const totalAcumulado = (data || []).reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
    const totalCantidad = (data || []).reduce((acc, r) => acc + Number(r.cantidad || 0), 0);

    return {
      fecha: fecha || 'Registrada',
      tipo: tipo || 'General',
      categoria: categoria || 'General',
      total_items: data?.length || 0,
      total_cantidad_sumada: totalCantidad,
      total_dinero_cop: totalAcumulado,
      items: (data || []).map((r) => ({
        tipo: r.tipo,
        insumo: r.nombre_insumo,
        categoria: r.categoria,
        cantidad: Number(r.cantidad || 0),
        unidad: r.unidad,
        costo_unitario: Number(r.costo_unitario || 0),
        valor_total: Number(r.valor_total || 0),
      })),
    };
  } catch (err: any) {
    return { exito: false, error: err.message };
  }
}

export async function consultarTrasladosCocina(fecha?: string, categoria?: string, insumo?: string) {
  return await consultarMovimientosCocina(fecha, 'TRASLADO', categoria, insumo);
}

export async function consultarInsumosPrecios(termino?: string) {
  try {
    let query = supabase
      .from('catalogo_insumos')
      .select('id, codigo, nombre, categoria, unidad_medida, costo_unitario_kg, stock_minimo_kg, activo')
      .order('nombre', { ascending: true })
      .limit(20);

    if (termino && termino.trim() !== '') {
      query = query.ilike('nombre', `%${termino.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return {
      total_encontrados: data?.length || 0,
      insumos: data?.map((i) => ({
        codigo: i.codigo || 'S/C',
        nombre: i.nombre,
        categoria: i.categoria,
        unidad: i.unidad_medida,
        costo_unitario_cop: Number(i.costo_unitario_kg || 0),
        stock_minimo: Number(i.stock_minimo_kg || 0),
      })),
    };
  } catch (err: any) {
    return { exito: false, error: err.message };
  }
}

export async function consultarStockConteo(terminoInsumo?: string) {
  try {
    const { data: conteos, error: errC } = await supabase
      .from('conteos_fisicos')
      .select('id, fecha, tipo, usuario, estado, total_valor')
      .order('fecha', { ascending: false })
      .limit(3);

    if (errC) throw errC;
    if (!conteos || conteos.length === 0) {
      return { mensaje: 'No hay conteos físicos registrados' };
    }

    const conteoIds = conteos.map((c) => c.id);

    let query = supabase
      .from('conteos_fisicos_detalle')
      .select('conteo_id, nombre_insumo, categoria, ubicacion, cantidad, unidad, cant_sin_porcionar_kg, porciones_und, peso_porciones_kg, costo_unitario, valor_total')
      .in('conteo_id', conteoIds);

    if (terminoInsumo && terminoInsumo.trim() !== '') {
      const t = terminoInsumo.trim().toLowerCase();
      if (t.startsWith('carne')) {
        query = query.or('categoria.ilike.%carne%,nombre_insumo.ilike.%carne%');
      } else {
        query = query.or(`nombre_insumo.ilike.%${terminoInsumo.trim()}%,categoria.ilike.%${terminoInsumo.trim()}%`);
      }
    }

    const { data: detalles, error: errD } = await query;
    if (errD) throw errD;

    return {
      fecha_ultimo_conteo: conteos[0].fecha,
      total_items: detalles?.length || 0,
      detalles: detalles?.map((d) => ({
        insumo: d.nombre_insumo,
        categoria: d.categoria,
        ubicacion: d.ubicacion || 'BODEGA / COCINA',
        sin_porcionar_kg: Number(d.cant_sin_porcionar_kg || 0),
        porciones_und: Number(d.porciones_und || 0),
        peso_porciones_kg: Number(d.peso_porciones_kg || 0),
        costo_unitario: Number(d.costo_unitario || 0),
        valor_total_cop: Number(d.valor_total || 0),
      })),
    };
  } catch (err: any) {
    return { exito: false, error: err.message };
  }
}

export async function consultarCompras(params: any = {}) {
  try {
    if (typeof params === 'string') params = { insumo: params };
    const { insumo, categoria, proveedor, numero_factura, fecha } = params;

    // 1. Por Insumo específico
    if (insumo && insumo.trim() !== '') {
      const term = insumo.trim();
      const { data, error } = await supabase
        .from('compras_detalle')
        .select('fecha, numero_factura, proveedor, categoria, nombre_insumo, detalle, cantidad, unidad, costo_unitario, valor_compra')
        .or(`nombre_insumo.ilike.%${term}%,detalle.ilike.%${term}%`)
        .order('fecha', { ascending: false })
        .limit(30);

      if (error) throw error;
      if (!data || data.length === 0) return { mensaje: `No se encontraron compras para el insumo: ${term}` };

      const termLower = term.toLowerCase();
      data.sort((a, b) => {
        const aName = (a.nombre_insumo || '').toLowerCase();
        const bName = (b.nombre_insumo || '').toLowerCase();
        const aHas = aName.split(/\s+/).includes(termLower);
        const bHas = bName.split(/\s+/).includes(termLower);
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });

      const totalDinero = data.reduce((acc, r) => acc + Number(r.valor_compra || 0), 0);
      const totalCantidad = data.reduce((acc, r) => acc + Number(r.cantidad || 0), 0);
      const ultima = data[0];

      return {
        insumo_buscado: term,
        compras_encontradas: data.length,
        ultima_compra: {
          fecha: ultima.fecha,
          proveedor: ultima.proveedor,
          factura: ultima.numero_factura,
          insumo: ultima.nombre_insumo,
          detalle_factura: ultima.detalle,
          costo_unitario: Number(ultima.costo_unitario || 0),
          cantidad: Number(ultima.cantidad || 0),
          unidad: ultima.unidad,
          total: Number(ultima.valor_compra || 0),
        },
        acumulado_mes: {
          cantidad_total: Number(totalCantidad.toFixed(2)),
          unidad: ultima.unidad,
          dinero_total_cop: totalDinero,
          costo_promedio_kg: totalCantidad > 0 ? Math.round(totalDinero / totalCantidad) : 0,
        },
        historial_reciente: data.slice(0, 5).map((r) => ({
          fecha: r.fecha,
          proveedor: r.proveedor,
          factura: r.numero_factura,
          insumo: r.nombre_insumo,
          cantidad: Number(r.cantidad || 0),
          unidad: r.unidad,
          costo_unitario: Number(r.costo_unitario || 0),
          total: Number(r.valor_compra || 0),
        })),
      };
    }

    // 2. Por Factura específica
    if (numero_factura && numero_factura.trim() !== '') {
      const fac = numero_factura.trim();
      const { data, error } = await supabase
        .from('compras_detalle')
        .select('fecha, numero_factura, proveedor, categoria, nombre_insumo, detalle, cantidad, unidad, costo_unitario, valor_compra')
        .ilike('numero_factura', `%${fac}%`)
        .order('nombre_insumo', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return { mensaje: `No se encontró la factura: ${fac}` };

      const totalDinero = data.reduce((acc, r) => acc + Number(r.valor_compra || 0), 0);
      return {
        factura: data[0].numero_factura,
        proveedor: data[0].proveedor,
        fecha: data[0].fecha,
        categoria: data[0].categoria,
        total_factura_cop: totalDinero,
        total_articulos: data.length,
        articulos: data.map((r) => ({
          insumo: r.nombre_insumo,
          detalle: r.detalle,
          cantidad: Number(r.cantidad || 0),
          unidad: r.unidad,
          costo_unitario: Number(r.costo_unitario || 0),
          valor_total: Number(r.valor_compra || 0),
        })),
      };
    }

    // 3. Por Proveedor específico
    if (proveedor && proveedor.trim() !== '') {
      const prov = proveedor.trim();
      const { data: facturas, error } = await supabase
        .from('compras')
        .select('fecha, numero_factura, proveedor, categoria, valor_total, total_items')
        .ilike('proveedor', `%${prov}%`)
        .order('fecha', { ascending: false });

      if (error) throw error;
      if (!facturas || facturas.length === 0) return { mensaje: `No hay facturas para el proveedor: ${prov}` };

      const totalDinero = facturas.reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
      return {
        proveedor: prov,
        total_facturas: facturas.length,
        total_dinero_cop: totalDinero,
        facturas: facturas.map((f) => ({
          fecha: f.fecha,
          factura: f.numero_factura,
          categoria: f.categoria,
          total: Number(f.valor_total || 0),
          items: f.total_items,
        })),
      };
    }

    // 4. Por Categoría específica
    if (categoria && categoria.trim() !== '') {
      const cat = categoria.trim();
      let catFilter = cat;
      if (cat.toLowerCase().startsWith('carne')) catFilter = 'Carnes y Proteínas';
      else if (cat.toLowerCase().startsWith('verd') || cat.toLowerCase().startsWith('frut')) catFilter = 'Verduras y Frutas';
      else if (cat.toLowerCase().startsWith('gran') || cat.toLowerCase().startsWith('harin')) catFilter = 'Granos y Harinas';
      else if (cat.toLowerCase().startsWith('desech') || cat.toLowerCase().startsWith('empaq')) catFilter = 'Desechables y Empaques';
      else if (cat.toLowerCase().startsWith('beb') || cat.toLowerCase().startsWith('licor')) catFilter = 'Bebidas y Licores';

      const { data, error } = await supabase
        .from('compras_detalle')
        .select('fecha, numero_factura, proveedor, categoria, nombre_insumo, cantidad, unidad, costo_unitario, valor_compra')
        .ilike('categoria', `%${catFilter}%`)
        .order('fecha', { ascending: false });

      if (error) throw error;
      const totalDinero = (data || []).reduce((acc, r) => acc + Number(r.valor_compra || 0), 0);

      return {
        categoria: catFilter,
        total_compras_lineas: data?.length || 0,
        total_dinero_cop: totalDinero,
        compras_recientes: (data || []).slice(0, 8).map((r) => ({
          fecha: r.fecha,
          insumo: r.nombre_insumo,
          cantidad: Number(r.cantidad || 0),
          unidad: r.unidad,
          costo_unitario: Number(r.costo_unitario || 0),
          total: Number(r.valor_compra || 0),
          proveedor: r.proveedor,
          factura: r.numero_factura,
        })),
      };
    }

    // 5. Por Fecha específica
    if (fecha && fecha.trim() !== '') {
      const { fechaExacta, fechaInicio, fechaFin } = parsearFiltroFecha(fecha);
      let q = supabase
        .from('compras')
        .select('fecha, numero_factura, proveedor, categoria, valor_total, total_items');

      if (fechaExacta) q = q.eq('fecha', fechaExacta);
      else if (fechaInicio && fechaFin) q = q.gte('fecha', fechaInicio).lte('fecha', fechaFin);

      const { data, error } = await q.order('valor_total', { ascending: false });

      if (error) throw error;
      const total = (data || []).reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
      return {
        fecha: fecha.trim(),
        total_facturas: data?.length || 0,
        total_dinero_cop: total,
        facturas: (data || []).slice(0, 8),
      };
    }

    // 6. Resumen General de Compras (Octubre 2026)
    const { data: facturas } = await supabase.from('compras').select('valor_total');
    const { data: detalles } = await supabase.from('compras_detalle').select('categoria, valor_compra');

    const totalDinero = (facturas || []).reduce((acc, f) => acc + Number(f.valor_total || 0), 0);
    const catSummary: Record<string, { compras: number; total: number }> = {};
    for (const d of detalles || []) {
      const cat = d.categoria || 'Otros';
      catSummary[cat] = catSummary[cat] || { compras: 0, total: 0 };
      catSummary[cat].compras++;
      catSummary[cat].total += Number(d.valor_compra || 0);
    }

    return {
      resumen: 'Total Compras Octubre 2026',
      total_facturas: facturas?.length || 0,
      total_lineas_compras: detalles?.length || 0,
      gran_total_cop: totalDinero,
      categorias: Object.entries(catSummary).map(([cat, stats]) => ({
        categoria: cat,
        num_compras: stats.compras,
        total_cop: stats.total,
        porcentaje: totalDinero > 0 ? Number(((stats.total / totalDinero) * 100).toFixed(1)) : 0,
      })),
    };
  } catch (err: any) {
    return { exito: false, error: err.message };
  }
}

export async function consultarLibroCaja(params: any = {}) {
  try {
    const { fecha, fecha_fin, clasificacion, categoria, concepto, responsable, ver_resumen_diario } = params || {};

    let q = supabase
      .from('libro_caja_registros')
      .select('fecha, dia_mes, clasificacion, categoria, concepto, descripcion_beneficiario, valor_pagado, soporte_factura, responsable_caja, es_ajuste');

    if (fecha || fecha_fin) {
      const { fechaExacta, fechaInicio, fechaFin } = parsearFiltroFecha(fecha, fecha_fin);
      if (fechaExacta) q = q.eq('fecha', fechaExacta);
      else if (fechaInicio && fechaFin) q = q.gte('fecha', fechaInicio).lte('fecha', fechaFin);
    }

    if (clasificacion && clasificacion.trim() !== '') {
      const cl = clasificacion.trim().toLowerCase();
      if (cl.includes('insumo') || cl.includes('costo')) q = q.ilike('clasificacion', '%Insumo%');
      else if (cl.includes('turno') || cl.includes('nomina') || cl.includes('nómina')) q = q.or('clasificacion.ilike.%Turno%,clasificacion.ilike.%Nómina%,clasificacion.ilike.%Nomina%');
      else if (cl.includes('operativo') || cl.includes('gasto')) q = q.ilike('clasificacion', '%Operativo%');
      else q = q.ilike('clasificacion', `%${clasificacion.trim()}%`);
    }

    if (categoria && categoria.trim() !== '') {
      const cat = categoria.trim().toLowerCase().replace(/[̀-ͯ]/g, '');
      if (cat.includes('nomina') || cat.includes('turno')) q = q.ilike('categoria', '%Nómina%');
      else if (cat.includes('verdur') || cat.includes('frut')) q = q.ilike('categoria', '%Verdur%');
      else if (cat.includes('carn')) q = q.ilike('categoria', '%Carn%');
      else if (cat.includes('bebid') || cat.includes('licor') || cat.includes('gaseos')) q = q.ilike('categoria', '%Bebid%');
      else if (cat.includes('gran') || cat.includes('abarrot')) q = q.ilike('categoria', '%Gran%');
      else if (cat.includes('desech')) q = q.ilike('categoria', '%Desech%');
      else if (cat.includes('servic') || cat.includes('hielo') || cat.includes('gas')) q = q.ilike('categoria', '%Servic%');
      else if (cat.includes('transp') || cat.includes('taxi') || cat.includes('domicil')) q = q.ilike('categoria', '%Transp%');
      else if (cat.includes('manten')) q = q.ilike('categoria', '%Manten%');
      else if (cat.includes('limpiez') || cat.includes('aseo')) q = q.ilike('categoria', '%Limpiez%');
      else if (cat.includes('general')) q = q.ilike('categoria', '%General%');
      else q = q.ilike('categoria', `%${categoria.trim()}%`);
    }

    if (responsable && responsable.trim() !== '') {
      q = q.ilike('responsable_caja', `%${responsable.trim()}%`);
    }

    if (concepto && concepto.trim() !== '') {
      const term = concepto.trim();
      const sinTildes = term.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (term !== sinTildes) {
        q = q.or(`concepto.ilike.%${term}%,descripcion_beneficiario.ilike.%${term}%,concepto.ilike.%${sinTildes}%,descripcion_beneficiario.ilike.%${sinTildes}%`);
      } else {
        q = q.or(`concepto.ilike.%${term}%,descripcion_beneficiario.ilike.%${term}%`);
      }
    }

    const { data, error } = await q.order('fecha', { ascending: false }).order('orden_item', { ascending: true });
    if (error) throw error;

    const rows = data || [];
    const total = rows.reduce((acc, r) => acc + Number(r.valor_pagado || 0), 0);
    const totalInsumos = rows.filter((r) => (r.clasificacion || '').includes('Insumo')).reduce((acc, r) => acc + Number(r.valor_pagado || 0), 0);
    const totalOperativos = rows.filter((r) => (r.clasificacion || '').includes('Operativo')).reduce((acc, r) => acc + Number(r.valor_pagado || 0), 0);
    const totalNomina = rows.filter((r) => (r.clasificacion || '').includes('Nómina') || (r.clasificacion || '').includes('Turno')).reduce((acc, r) => acc + Number(r.valor_pagado || 0), 0);

    const porCategoriaMap: Record<string, { cantidad: number; total_cop: number }> = {};
    const porResponsableMap: Record<string, { cantidad: number; total_cop: number }> = {};
    for (const r of rows) {
      const cKey = r.categoria || 'Otros';
      porCategoriaMap[cKey] = porCategoriaMap[cKey] || { cantidad: 0, total_cop: 0 };
      porCategoriaMap[cKey].cantidad += 1;
      porCategoriaMap[cKey].total_cop += Number(r.valor_pagado || 0);

      const rKey = r.responsable_caja || 'GENERAL';
      porResponsableMap[rKey] = porResponsableMap[rKey] || { cantidad: 0, total_cop: 0 };
      porResponsableMap[rKey].cantidad += 1;
      porResponsableMap[rKey].total_cop += Number(r.valor_pagado || 0);
    }

    // Consultar libro_caja_diario para obtener el arqueo y cuadre diario oficial
    let cuadreDiario: any = undefined;
    let qDiario = supabase
      .from('libro_caja_diario')
      .select('fecha, dia_mes, base_inicial, venta_pos_total, venta_efectivo_pos, total_datafonos, total_salidas, efectivo_fisico_cierre, total_costos_insumos, total_gastos_operativos, total_turnos_nomina, diferencia_cuadre, responsables_dia, estado, observaciones');

    if (fecha || fecha_fin) {
      const { fechaExacta, fechaInicio, fechaFin } = parsearFiltroFecha(fecha, fecha_fin);
      if (fechaExacta) qDiario = qDiario.eq('fecha', fechaExacta);
      else if (fechaInicio && fechaFin) qDiario = qDiario.gte('fecha', fechaInicio).lte('fecha', fechaFin);
    }

    const { data: diariosData } = await qDiario.order('fecha', { ascending: false }).limit(fecha ? 1 : 5);
    if (diariosData && diariosData.length > 0) {
      cuadreDiario = diariosData.map((d) => {
        const diff = Number(d.diferencia_cuadre || 0);
        return {
          fecha: d.fecha,
          dia_mes: d.dia_mes,
          estado_periodo: d.estado,
          cajeras_responsables: d.responsables_dia,
          base_inicial_caja_cop: Number(d.base_inicial || 500000),
          venta_pos_total_cop: Number(d.venta_pos_total || 0),
          venta_efectivo_pos_cop: Number(d.venta_efectivo_pos || 0),
          datafonos_tarjetas_cop: Number(d.total_datafonos || 0),
          total_salidas_caja_cop: Number(d.total_salidas || 0),
          desglose_salidas_3_bloques: {
            insumos_por_caja_cop: Number(d.total_costos_insumos || 0),
            gastos_operativos_cop: Number(d.total_gastos_operativos || 0),
            turnos_y_nomina_cop: Number(d.total_turnos_nomina || 0)
          },
          efectivo_fisico_cierre_cop: Number(d.efectivo_fisico_cierre || 0),
          diferencia_cuadre_cop: diff,
          estado_cuadre: diff === 0 ? 'CUADRADO EXACTO' : diff > 0 ? `SOBRANTE (+$${Math.abs(diff).toLocaleString('es-CO')} COP)` : `FALTANTE (-$${Math.abs(diff).toLocaleString('es-CO')} COP)`,
          observaciones_planillas: d.observaciones || 'Sin notas'
        };
      });
    }

    return {
      modulo: 'Libro de Caja Menor (La Finca)',
      total_registros_coincidentes: rows.length,
      total_salidas_cop: total,
      desglose_3_bloques: {
        costos_materia_prima_cop: totalInsumos,
        gastos_operativos_cop: totalOperativos,
        pago_turnos_nomina_cop: totalNomina,
      },
      cuadre_diario_oficial: cuadreDiario,
      top_categorias: Object.entries(porCategoriaMap)
        .map(([cat, st]) => ({ categoria: cat, registros: st.cantidad, total_cop: st.total_cop }))
        .sort((a, b) => b.total_cop - a.total_cop)
        .slice(0, 5),
      top_cajeras: Object.entries(porResponsableMap)
        .map(([resp, st]) => ({ cajera: resp, registros: st.cantidad, total_cop: st.total_cop }))
        .sort((a, b) => b.total_cop - a.total_cop)
        .slice(0, 4),
      muestra_registros: rows.slice(0, 15).map((r) => ({
        fecha: r.fecha,
        clasificacion: r.clasificacion,
        categoria: r.categoria,
        concepto: r.concepto,
        beneficiario: r.descripcion_beneficiario,
        valor_cop: Number(r.valor_pagado || 0),
        cajera: r.responsable_caja,
      })),
    };
  } catch (err: any) {
    return { exito: false, error: err.message };
  }
}

function normalizarTerminoBusqueda(term: string): string[] {
  const limpio = term.trim().toLowerCase();
  if (limpio.startsWith('mazm') || limpio.startsWith('mazam')) return ['mazamorra', 'mazam'];
  if (limpio.startsWith('tamal')) return ['tamal'];
  if (limpio.startsWith('churr') || limpio.startsWith('churas')) return ['churrasco'];
  if (limpio.startsWith('baby') || limpio.startsWith('babi')) return ['baby', 'viche'];
  if (limpio.startsWith('costill')) return ['costilla'];
  if (limpio.startsWith('sobrebarr')) return ['sobrebarriga'];
  if (limpio.startsWith('punta')) return ['punta'];
  if (limpio.startsWith('aguacat')) return ['aguacate'];
  if (limpio.startsWith('ceboll')) return ['cebolla'];
  if (limpio.startsWith('tomat')) return ['tomate'];
  if (limpio.startsWith('platan')) return ['platano', 'plátano'];

  const variantes = [limpio];
  if (limpio.endsWith('es')) {
    variantes.push(limpio.slice(0, -2));
  } else if (limpio.endsWith('s')) {
    variantes.push(limpio.slice(0, -1));
  }
  return Array.from(new Set(variantes));
}

export async function consultarVentas(fecha?: string, producto?: string, fecha_fin?: string) {
  try {
    if (producto && producto.trim() !== '') {
      const variantes = normalizarTerminoBusqueda(producto);
      const orFilter = variantes.map((v) => `nombre_producto.ilike.%${v}%`).join(',');

      let q = supabase
        .from('ventas_detalle')
        .select('fecha, codigo_producto, nombre_producto, categoria, cantidad, valor_unitario, gran_total')
        .or(orFilter);

      const { fechaExacta, fechaInicio, fechaFin } = parsearFiltroFecha(fecha, fecha_fin);
      if (fechaExacta) q = q.eq('fecha', fechaExacta);
      else if (fechaInicio && fechaFin) q = q.gte('fecha', fechaInicio).lte('fecha', fechaFin);
      const { data, error } = await q.order('fecha', { ascending: false }).limit(60);

      if (error) throw error;

      const totalCantidad = (data || []).reduce((acc, d) => acc + Number(d.cantidad || 0), 0);
      const totalDinero = (data || []).reduce((acc, d) => acc + Number(d.gran_total || 0), 0);
      const porFecha: Record<string, number> = {};
      (data || []).forEach((d) => {
        porFecha[d.fecha] = (porFecha[d.fecha] || 0) + Number(d.cantidad || 0);
      });

      return {
        producto_buscado: producto,
        total_unidades_vendidas: totalCantidad,
        total_dinero_recaudado: totalDinero,
        desglose_por_fecha: porFecha,
        registros: data?.map((d) => ({
          fecha: d.fecha,
          producto: d.nombre_producto,
          cantidad: Number(d.cantidad || 0),
          precio_venta_publico: Number(d.cantidad ? Math.round(d.gran_total / d.cantidad) : d.valor_unitario),
          valor_neto_sin_impuesto: Number(d.valor_unitario || 0),
          total_venta: Number(d.gran_total || 0),
        })),
      };
    }

    let query = supabase
      .from('ventas_diarias')
      .select('fecha, dia_semana, total_articulos, venta_neta, gran_total, total_platos_distintos, ticket_promedio')
      .order('fecha', { ascending: false })
      .limit(fecha ? (fecha_fin ? 7 : 1) : 7);

    const { fechaExacta, fechaInicio, fechaFin } = parsearFiltroFecha(fecha, fecha_fin);
    if (fechaExacta) query = query.eq('fecha', fechaExacta);
    else if (fechaInicio && fechaFin) query = query.gte('fecha', fechaInicio).lte('fecha', fechaFin);

    const { data, error } = await query;
    if (error) throw error;

    return {
      jornadas: data?.map((j) => ({
        fecha: j.fecha,
        dia: j.dia_semana,
        platos_vendidos: Number(j.total_articulos || 0),
        venta_neta_cop: Number(j.venta_neta || 0),
        total_facturado_cop: Number(j.gran_total || 0),
      })),
    };
  } catch (err: any) {
    return { exito: false, error: err.message };
  }
}

export async function consultarCosteoDiario(fecha?: string) {
  try {
    let query = supabase
      .from('costeo_diario')
      .select('fecha, titulo, pos_sales, costo_bruto, devoluciones, costo_neto, food_cost_porcentaje, costo_apertura, costo_cierre, consumo_real, costo_consumos, estado')
      .order('fecha', { ascending: false })
      .limit(fecha ? 1 : 5);

    if (fecha) {
      const { fechaExacta, fechaInicio, fechaFin } = parsearFiltroFecha(fecha);
      if (fechaExacta) query = query.eq('fecha', fechaExacta);
      else if (fechaInicio && fechaFin) query = query.gte('fecha', fechaInicio).lte('fecha', fechaFin);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      return { mensaje: `No se encontraron hojas de costeo diario para la fecha ${fecha || 'reciente'}.` };
    }

    const hojasEnriquecidas = await Promise.all(
      data.map(async (r) => {
        const { data: movs } = await supabase
          .from('registros_costeo_cocina')
          .select('tipo, valor_total, cantidad, nombre_insumo')
          .eq('fecha', r.fecha);

        const sumPorTipo: Record<string, { total: number; count: number }> = {};
        (movs || []).forEach((m) => {
          const t = m.tipo || 'DESCONOCIDO';
          sumPorTipo[t] = sumPorTipo[t] || { total: 0, count: 0 };
          sumPorTipo[t].total += Number(m.valor_total || 0);
          sumPorTipo[t].count += 1;
        });

        const aperturaCocina = sumPorTipo['APERTURA']?.total || Number(r.costo_apertura || 0);
        const trasladosMovs = sumPorTipo['TRASLADO']?.total || Number(r.costo_bruto || 0);
        const devolucionesBodega = sumPorTipo['DEVOLUCION']?.total || Number(r.devoluciones || 0);
        const cierreCocina = sumPorTipo['CIERRE']?.total || Number(r.costo_cierre || 0);
        const consumosInternos = sumPorTipo['CONSUMO']?.total || Number(r.costo_consumos || 0);

        const consumoRealCalculado = aperturaCocina + trasladosMovs - devolucionesBodega - cierreCocina + consumosInternos;
        const consumoRealFinal = Number(r.consumo_real || consumoRealCalculado);
        const ventasPos = Number(r.pos_sales || 0);
        const rendimiento = ventasPos - consumoRealFinal;
        const foodCostPct = ventasPos > 0 ? Number(((consumoRealFinal / ventasPos) * 100).toFixed(1)) : Number(r.food_cost_porcentaje || 0);

        const bodegaApertura = sumPorTipo['BODEGA_APERTURA']?.total || 0;
        const bodegaCierre = sumPorTipo['BODEGA_CIERRE']?.total || 0;

        return {
          modulo: 'Hoja de Costeo Diario',
          fecha: r.fecha,
          titulo: r.titulo || `Hoja de Costeo Diario (${r.fecha})`,
          estado_periodo: r.estado || 'ACTIVO',
          liquidacion_cocina_del_dia: {
            costo_cocina_apertura_cop: aperturaCocina,
            costo_movimientos_a_cocina_cop: trasladosMovs,
            costo_devoluciones_a_bodega_cop: devolucionesBodega,
            costo_cocina_cierre_cop: cierreCocina,
            costo_consumos_cop: consumosInternos,
            costo_consumo_real_total_cop: consumoRealFinal,
            total_ventas_del_dia_pos_cop: ventasPos,
            rendimiento_cop: rendimiento,
            rendimiento_formato: `${rendimiento >= 0 ? '+' : '-'}$${Math.abs(rendimiento).toLocaleString('es-CO')} COP`,
            food_cost_porcentaje: `${foodCostPct}%`
          },
          liquidacion_bodega_del_dia: {
            bodega_apertura_cop: bodegaApertura,
            bodega_cierre_cop: bodegaCierre,
            items_en_bodega_cierre: sumPorTipo['BODEGA_CIERRE']?.count || 0
          }
        };
      })
    );

    return {
      modulo: 'Hoja de Costeo Diario (La Finca)',
      total_hojas: hojasEnriquecidas.length,
      hojas: hojasEnriquecidas
    };
  } catch (err: any) {
    return { exito: false, error: err.message };
  }
}

// ====================================================================
// 2. HISTORIAL DE CONTEXTO EN SUPABASE
// ====================================================================

export async function obtenerHistorialGroq(chatId: number, limite: number = 4) {
  try {
    const { data, error } = await supabase
      .from('telegram_mensajes_contexto')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) return [];

    return (data || []).reverse().map((m) => ({
      role: (m.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: (m.content || '').slice(0, 350),
    }));
  } catch (err) {
    return [];
  }
}

export async function guardarMensajeChat(chatId: number, role: 'user' | 'model', content: string) {
  try {
    await supabase.from('telegram_mensajes_contexto').insert({
      chat_id: chatId,
      role,
      content,
    });
  } catch (err: any) {}
}

export async function registrarUsuarioTelegram(
  chatId: number,
  sender?: { first_name?: string; last_name?: string; username?: string },
  ultimoTexto?: string
) {
  try {
    const { data: existing } = await supabase
      .from('telegram_usuarios')
      .select('total_mensajes, first_name, last_name, username')
      .eq('chat_id', chatId)
      .maybeSingle();

    const count = (existing?.total_mensajes || 0) + 1;

    await supabase.from('telegram_usuarios').upsert(
      {
        chat_id: chatId,
        first_name: sender?.first_name || existing?.first_name || 'Usuario',
        last_name: sender?.last_name || existing?.last_name || '',
        username: sender?.username || existing?.username || '',
        ultimo_mensaje: (ultimoTexto || '').slice(0, 500),
        ultimo_mensaje_at: new Date().toISOString(),
        total_mensajes: count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chat_id' }
    );
  } catch (err: any) {
    console.error('Error en registrarUsuarioTelegram:', err);
  }
}

export async function enviarMensajeTelegram(chatId: number, texto: string) {
  if (!TELEGRAM_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN no configurado');
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const cleanText = texto.length > 4000 ? texto.slice(0, 3950) + '\n\n...(información recortada)' : texto;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: cleanText, parse_mode: 'Markdown' }),
    });

    const data = await res.json();
    if (!data.ok) {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: cleanText }),
      });
    }
  } catch (err: any) {
    console.error('Error enviando mensaje telegram:', err);
  }
}

// ====================================================================
// 3. MOTOR INTELIGENTE GROQ
// ====================================================================

const systemPrompt = `
Eres el Asistente Operativo oficial de "La Finca" (Asador, Restaurante y Control de Inventarios) en Telegram.
Tu misión es entregar respuestas de negocio ULTRA PUNTUALES, DIRECTAS Y EJECUTIVAS sobre los módulos de La Finca.

REGLAS GENERALES:
1. CERO EMOJIS: Prohibido incluir emojis en tus respuestas.
2. CERO RELLENO: No saludes, no te presentes, no uses frases de cortesía ni despedidas. Ve directo al dato numérico y al desglose.
3. FORMATO NUMÉRICO Y MONETARIO:
   - Valores en pesos colombianos con separador de miles: $XX.XXX COP.
   - Cantidades con su unidad clara: Kg, Und, Porciones.
   - Rendimiento siempre con signo explícito: +$XX.XXX COP o -$XX.XXX COP.

4. MÓDULO HOJA DE COSTEO DIARIO (antes Costeo Diario Cocina):
   - Muestra la liquidación diaria con esta estructura ejecutiva:
     LIQUIDACIÓN COCINA DEL DÍA ({fecha}):
     - Costo Cocina Apertura: $X COP
     - Costo Movimientos a Cocina: +$X COP
     - Costo Devoluciones a Bodega: -$X COP
     - Costo Cocina Cierre: -$X COP
     - Costo Consumos: +$X COP
     - Costo Consumo Real: $X COP
     - Total de Ventas del día: $X COP
     - Rendimiento: +$X COP / -$X COP
     - Food Cost: X.X%
     LIQUIDACIÓN BODEGA DEL DÍA:
     - Bodega Apertura: $X COP
     - Bodega Cierre: $X COP
   - Si piden datos de la hoja de costeo, consumo real, rendimiento, food cost o ventas del día: Usa consultar_costeo_diario.
   - Si piden cantidades o cortes específicos (ej: carnes con que cerramos, bajadas a cocina, insumos en bodega): Usa consultar_movimientos_cocina con el tipo exacto (CIERRE, APERTURA, TRASLADO, DEVOLUCION, CONSUMO, BODEGA_APERTURA, BODEGA_CIERRE).

5. MÓDULO LIBRO DE CAJA MENOR:
   - Administrado por cajeras oficiales (Johanna turno principal, Neymar, María, Carolina, Daniela, Lucero).
   - Base Inicial diaria estándar: $500.000 COP.
   - Salidas organizadas en 3 BLOQUES:
     1. Insumos por Caja / Materia Prima (carnes, verduras, lácteos, compras menores de emergencia).
     2. Gastos Operativos (transporte, hielo, aseo, servicios, recargas, etc.).
     3. Turnos y Nómina (pagos de turnos de meseros, cocineros, vales, préstamos).
   - Estructura ejecutiva de CUADRE DIARIO ({fecha}):
     - Responsables: {Cajeras}
     - Estado Período: {CERRADA / ACTIVA}
     - Base Inicial: $500.000 COP
     - Venta POS Total: $X COP (Efectivo: $X COP | Datáfonos: $X COP)
     - Total Salidas de Caja: $X COP
       * Insumos por Caja: $X COP
       * Gastos Operativos: $X COP
       * Turnos y Nómina: $X COP
     - Efectivo Físico Cierre: $X COP
     - Diferencia Cuadre: $X COP ({CUADRADO / SOBRANTE / FALTANTE})
   - Si piden arqueo de caja, salidas, pagos de turnos, gastos operativos o compras de insumos por caja menor: Usa consultar_libro_caja.

6. REGLA ESTRICTA DE BASE DE DATOS: Siempre consulta los datos reales de la base de datos usando las herramientas. NUNCA inventes números.`;

const tools: any = [
  {
    type: 'function',
    function: {
      name: 'consultar_movimientos_cocina',
      description: 'Consulta insumos y movimientos de cocina: CIERRES (con cuánto cerramos o inventario final), APERTURAS (con cuánto abrimos), TRASLADOS (bajadas a cocina de verduras, carnes o abarrotes) o DEVOLUCIONES.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD. Domingo pasado fue 2026-10-25, sábado pasado 2026-10-24.' },
          tipo: { type: 'string', enum: ['CIERRE', 'APERTURA', 'TRASLADO', 'DEVOLUCION', 'TODOS'], description: 'Usar CIERRE si preguntan "con cuánto cerramos", APERTURA si preguntan "con cuánto abrimos", TRASLADO si preguntan "bajadas" o "traslados".' },
          categoria: { type: 'string', description: 'Categoría a filtrar (ej: CARNE, VERDURAS, ABARROTES, PESCADOS, EMBUTIDOS). Opcional.' },
          insumo: { type: 'string', description: 'Nombre de insumo específico. Opcional.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_traslados_cocina',
      description: 'Consulta traslados o bajadas a cocina en una fecha.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD.' },
          categoria: { type: 'string', description: 'Categoría a filtrar.' },
          insumo: { type: 'string', description: 'Nombre de insumo específico.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_ventas',
      description: 'Consulta ventas y PRECIOS DE VENTA al público en la carta de platos terminados (ej: Tamal: $24.000 COP, Mazamorra: $8.000 COP, etc.), cantidades vendidas y desglose por fecha.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha inicio YYYY-MM-DD. Opcional.' },
          fecha_fin: { type: 'string', description: 'Fecha fin YYYY-MM-DD (para fin de semana usar 2026-10-25). Opcional.' },
          producto: { type: 'string', description: 'Nombre del plato vendido (ej: Tamal, Mazamorra, Churrasco). Opcional.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_costeo_diario',
      description: 'Consulta la Hoja de Costeo Diario de una fecha: Liquidación Cocina del Día (Cocina Apertura, Movimientos a Cocina, Devoluciones, Cocina Cierre, Consumos, Consumo Real, Ventas POS del día, Rendimiento y Food Cost %) y Liquidación Bodega del Día (Bodega Apertura, Bodega Cierre de bebidas y abarrotes).',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_stock_conteo',
      description: 'Consulta existencias físicas del último conteo en bodega y cocina.',
      parameters: {
        type: 'object',
        properties: {
          terminoInsumo: { type: 'string', description: 'Nombre del insumo (ej: carne, costilla, pollo).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_insumos_precios',
      description: 'Consulta código, unidad y costo unitario estándar en catálogo de insumos.',
      parameters: {
        type: 'object',
        properties: {
          termino: { type: 'string', description: 'Nombre o código del insumo.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_compras',
      description: 'Consulta el módulo Entradas por Compra: total compras en dinero, facturas, compras por categoría (Carnes, Verduras, Granos, Desechables, Bebidas, etc.), costos de compra de insumos, proveedores y facturas.',
      parameters: {
        type: 'object',
        properties: {
          insumo: { type: 'string', description: 'Nombre del insumo a buscar en compras (ej: posta, sobrebarriga, solomito, pollo, papa, aceite).' },
          categoria: { type: 'string', description: 'Categoría de compras (ej: Carnes, Verduras, Granos, Desechables, Bebidas, Otros).' },
          proveedor: { type: 'string', description: 'Nombre o parte del nombre del proveedor (ej: Valencia, Monos, Tobon, San Jerónimo).' },
          numero_factura: { type: 'string', description: 'Número de factura específica (ej: FEBF-37, 985).' },
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_libro_caja',
      description: 'Consulta el Libro de Caja Menor: Cuadre y arqueo diario oficial (base inicial, venta POS total, venta efectivo, datáfonos, total salidas, efectivo físico de cierre, diferencia de cuadre, cajeras Johanna, Neymar, María, etc.), salidas en sus 3 bloques (1. Insumos por caja, 2. Gastos operativos, 3. Turnos y nómina) y registros individuales por concepto, soporte de planilla o cajera.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD o mes YYYY-MM (ej: 2026-10 o 2026-10-25). Opcional.' },
          fecha_fin: { type: 'string', description: 'Fecha fin YYYY-MM-DD para consultar un rango o fin de semana. Opcional.' },
          clasificacion: { type: 'string', description: 'Clasificación: "Costo / Insumo", "Gasto Operativo" o "Turno / Nómina". Opcional.' },
          categoria: { type: 'string', description: 'Categoría (ej: Gastos Nómina, Servicios, Verduras, Bebidas, Grano, Carnes, Desechables, Gastos Generales, Gastos Transporte). Opcional.' },
          concepto: { type: 'string', description: 'Concepto o beneficiario a buscar (ej: Hielo, Andrés, Turno, Aguacate, Préstamo). Opcional.' },
          responsable: { type: 'string', description: 'Nombre de la cajera encargada (ej: JOHANNA, MARIA, CAROLINA, DANIELA, LUCERO). Opcional.' },
          ver_resumen_diario: { type: 'boolean', description: 'True si preguntan por arqueo, cuadre de caja, venta POS del día, efectivo de cierre o sobrante/faltante de caja. Opcional.' },
        },
      },
    },
  },
];

async function ejecutarTool(callName: string, args: any) {
  if (callName === 'consultar_movimientos_cocina' || callName === 'consultar_traslados_cocina') {
    return await consultarMovimientosCocina(args.fecha, args.tipo || (callName === 'consultar_traslados_cocina' ? 'TRASLADO' : undefined), args.categoria, args.insumo);
  } else if (callName === 'consultar_ventas') {
    return await consultarVentas(args.fecha, args.producto, args.fecha_fin);
  } else if (callName === 'consultar_costeo_diario') {
    return await consultarCosteoDiario(args.fecha);
  } else if (callName === 'consultar_stock_conteo') {
    return await consultarStockConteo(args.terminoInsumo);
  } else if (callName === 'consultar_insumos_precios') {
    return await consultarInsumosPrecios(args.termino);
  } else if (callName === 'consultar_compras') {
    return await consultarCompras(args);
  } else if (callName === 'consultar_libro_caja') {
    return await consultarLibroCaja(args);
  }
  return { error: 'Herramienta desconocida' };
}

export async function procesarMensajeTelegram(
  chatId: number, 
  textoUsuario: string, 
  sender?: { first_name?: string; last_name?: string; username?: string }
) {
  try {
    // 1. Guardar mensaje del usuario INMEDIATAMENTE para trazabilidad absoluta
    await guardarMensajeChat(chatId, 'user', textoUsuario);
    if (sender) {
      await registrarUsuarioTelegram(chatId, sender, textoUsuario);
    }

    const historial = await obtenerHistorialGroq(chatId, 4);
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...historial,
      { role: 'user', content: textoUsuario },
    ];

    // Helper resiliente: intenta openai/gpt-oss-120b y ante rate limit / TPM cambia automáticamente a openai/gpt-oss-20b
    const llamarGroq = async (msgs: any[]) => {
      try {
        return await groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: msgs,
          tools,
          tool_choice: 'auto',
          temperature: 0.1,
        });
      } catch (err: any) {
        console.warn('Fallback a openai/gpt-oss-20b por error en 120b:', err?.message);
        return await groq.chat.completions.create({
          model: 'openai/gpt-oss-20b',
          messages: msgs,
          tools,
          tool_choice: 'auto',
          temperature: 0.1,
        });
      }
    };

    let res = await llamarGroq(messages);
    let assistantMsg = res.choices[0].message;

    let iter = 0;
    while (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0 && iter < 4) {
      iter++;
      messages.push(assistantMsg);

      for (const t of assistantMsg.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(t.function.arguments || '{}');
        } catch (e) {}

        const data = await ejecutarTool(t.function.name, args);

        messages.push({
          role: 'tool',
          tool_call_id: t.id,
          content: JSON.stringify(data),
        });
      }

      res = await llamarGroq(messages);
      assistantMsg = res.choices[0].message;
    }

    const respuestaFinal = assistantMsg.content || 'Sin datos disponibles para esta consulta.';

    // 2. Guardar y despachar mensaje a Telegram
    await guardarMensajeChat(chatId, 'model', respuestaFinal);
    await enviarMensajeTelegram(chatId, respuestaFinal);

    return { exito: true, respuesta: respuestaFinal };
  } catch (err: any) {
    console.error('Error procesando mensaje de Telegram:', err);
    await guardarMensajeChat(chatId, 'model', `[Error: ${err.message}]`);
    await enviarMensajeTelegram(chatId, 'Error consultando los datos del restaurante.');
    return { exito: false, error: err.message };
  }
}
