import { supabase } from '@/lib/supabase';

export interface InsumoValidado {
  index: number; // 1-based para que el usuario pueda decir "el 2 es..."
  texto_original: string;
  nombre_catalogo: string | null;
  categoria: string | null;
  insumo_id: number | null;
  cantidad: number;
  unidad: string;
  costo_unitario: number;
  valor_total: number;
  similitud: number;
  estado: 'VALIDO' | 'DUDOSO' | 'NO_RECONOCIDO';
  sugerencias?: string[];
}

export interface BorradorIngesta {
  chat_id: number;
  fecha: string | null; // YYYY-MM-DD
  area: 'COCINA' | 'BODEGA';
  tipo: 'APERTURA' | 'TRASLADO' | 'DEVOLUCION' | 'CIERRE';
  modo_operacion: 'REEMPLAZAR' | 'SUMAR';
  items: InsumoValidado[];
  total_items: number;
  total_validos: number;
  total_pendientes: number;
  valor_total_estimado: number;
  hoja_costeo_existe: boolean;
  bloqueos: string[];
}

function normalizeString(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Coeficiente de similitud de Dice / Bigramas
function calcularSimilitud(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.88;

  const getBigrams = (s: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) bigrams.add(s.slice(i, i + 2));
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const b of Array.from(b1)) {
    if (b2.has(b)) intersection++;
  }

  return (2.0 * intersection) / (b1.size + b2.size);
}

/**
 * Parsea líneas de texto libre como:
 * "Chorizo de pollo 6"
 * "Felipe 350 - 1"
 * "Camarón 6 kls"
 */
export function extraerItemsTexto(textoPlano: string): { textoOriginal: string; nombreRaw: string; cantidad: number; unidad: string }[] {
  const lineas = textoPlano.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const resultado: { textoOriginal: string; nombreRaw: string; cantidad: number; unidad: string }[] = [];

  for (const linea of lineas) {
    // Si la línea es saludo o cabecera descriptiva, saltar
    const lNorm = normalizeString(linea);
    if (lNorm.startsWith('este es') || lNorm.startsWith('cierre del') || lNorm.startsWith('actualizalo') || lNorm.startsWith('hola') || lNorm.startsWith('por favor')) {
      continue;
    }

    // Extraer cantidad y unidad si viene "6 kls", "1 kl", "350 - 1", "Chorizo 6"
    // Caso "Felipe 350 - 1"
    let cantidad = 1;
    let unidad = 'und';
    let nombreRaw = linea;

    const matchGuionNum = linea.match(/^(.*?)\s*[\-\:]\s*([\d\.\,]+)\s*(kls?|kg|kilos?|libras?|lbs?|und|porc|g|gr)?$/i);
    const matchFinNum = linea.match(/^(.*?)\s+([\d\.\,]+)\s*(kls?|kg|kilos?|libras?|lbs?|und|porc|g|gr)?$/i);

    if (matchGuionNum) {
      nombreRaw = matchGuionNum[1].trim();
      cantidad = parseFloat(matchGuionNum[2].replace(',', '.')) || 1;
      if (matchGuionNum[3]) {
        const u = matchGuionNum[3].toLowerCase();
        unidad = u.startsWith('k') ? 'kg' : u.startsWith('l') ? 'lb' : u.startsWith('g') ? 'gr' : 'und';
      }
    } else if (matchFinNum) {
      nombreRaw = matchFinNum[1].trim();
      cantidad = parseFloat(matchFinNum[2].replace(',', '.')) || 1;
      if (matchFinNum[3]) {
        const u = matchFinNum[3].toLowerCase();
        unidad = u.startsWith('k') ? 'kg' : u.startsWith('l') ? 'lb' : u.startsWith('g') ? 'gr' : 'und';
      }
    }

    resultado.push({
      textoOriginal: linea,
      nombreRaw,
      cantidad,
      unidad,
    });
  }

  return resultado;
}

/**
 * Valida una lista de insumos contra catalogo_insumos y verifica reglas de negocio
 */
export async function validarBorradorInsumos(
  itemsRaw: { textoOriginal: string; nombreRaw: string; cantidad: number; unidad: string }[],
  fecha?: string | null,
  area: 'COCINA' | 'BODEGA' = 'COCINA',
  tipo: 'APERTURA' | 'TRASLADO' | 'DEVOLUCION' | 'CIERRE' = 'CIERRE',
  modo: 'REEMPLAZAR' | 'SUMAR' = 'REEMPLAZAR'
): Promise<BorradorIngesta> {
  // 1. Obtener catálogo maestro
  const { data: catalogo } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, unidad_medida, costo_unitario_kg, peso_estandar_porcion_kg')
    .eq('activo', true);

  const catList = catalogo || [];
  const validados: InsumoValidado[] = [];
  const bloqueos: string[] = [];

  // 2. Verificar existencia de Hoja de Costeo si es para Cocina
  let hojaExiste = false;
  if (fecha && area === 'COCINA') {
    const { data: checkHoja } = await supabase
      .from('registros_costeo_cocina')
      .select('id')
      .eq('fecha', fecha)
      .limit(1);

    hojaExiste = Boolean(checkHoja && checkHoja.length > 0);
    if (!hojaExiste) {
      bloqueos.push(
        `⚠️ La hoja de costeo para la fecha ${fecha} aún no ha sido creada en el sistema. Debes crear primero la hoja de costeo del día indicado en la plataforma web para proceder a ingresar estos conteos.`
      );
    }
  }

  if (!fecha) {
    bloqueos.push('⚠️ Falta especificar la fecha (YYYY-MM-DD) a la que corresponde este reporte.');
  }

  // 3. Validar cada ítem contra el catálogo
  let index = 1;
  let valorTotalSumado = 0;

  for (const raw of itemsRaw) {
    let mejorMatch: any = null;
    let mejorScore = 0;
    const candidatos: { item: any; score: number }[] = [];

    for (const cat of catList) {
      const score = calcularSimilitud(raw.nombreRaw, cat.nombre);
      if (score > mejorScore) {
        mejorScore = score;
        mejorMatch = cat;
      }
      if (score >= 0.6) {
        candidatos.push({ item: cat, score });
      }
    }

    let estado: 'VALIDO' | 'DUDOSO' | 'NO_RECONOCIDO' = 'NO_RECONOCIDO';
    if (mejorScore >= 0.82) {
      estado = 'VALIDO';
    } else if (mejorScore >= 0.65) {
      estado = 'DUDOSO';
    }

    const costoKg = Number(mejorMatch?.costo_unitario_kg || 0);
    const pesoStd = Number(mejorMatch?.peso_estandar_porcion_kg || 0.35);

    // Calcular costo unitario según unidad
    let costoUnit = costoKg;
    if (raw.unidad === 'und' && pesoStd > 0) {
      costoUnit = Math.round(costoKg * pesoStd);
    }

    const valorTotal = Math.round(raw.cantidad * costoUnit);
    if (estado === 'VALIDO') {
      valorTotalSumado += valorTotal;
    }

    validados.push({
      index: index++,
      texto_original: raw.textoOriginal,
      nombre_catalogo: estado !== 'NO_RECONOCIDO' && mejorMatch ? mejorMatch.nombre : null,
      categoria: mejorMatch?.categoria || null,
      insumo_id: estado !== 'NO_RECONOCIDO' && mejorMatch ? mejorMatch.id : null,
      cantidad: raw.cantidad,
      unidad: raw.unidad,
      costo_unitario: costoUnit,
      valor_total: valorTotal,
      similitud: mejorScore,
      estado,
      sugerencias: candidatos.sort((a, b) => b.score - a.score).slice(0, 3).map((c) => c.item.nombre),
    });
  }

  const totalValidos = validados.filter((v) => v.estado === 'VALIDO').length;
  const totalPendientes = validados.length - totalValidos;

  return {
    chat_id: 0,
    fecha: fecha || null,
    area,
    tipo,
    modo_operacion: modo,
    items: validados,
    total_items: validados.length,
    total_validos: totalValidos,
    total_pendientes: totalPendientes,
    valor_total_estimado: valorTotalSumado,
    hoja_costeo_existe: hojaExiste,
    bloqueos,
  };
}

/**
 * Guarda en firme un borrador validado en la base de datos de Cocina
 */
export async function aplicarBorradorEnCocina(borrador: BorradorIngesta) {
  if (!borrador.fecha) throw new Error('No se puede aplicar: falta la fecha.');
  if (borrador.total_pendientes > 0) {
    throw new Error(`Hay ${borrador.total_pendientes} ítems no reconocidos o dudosos que deben corregirse antes de guardar.`);
  }

  // Si el modo es REEMPLAZAR y es CIERRE, eliminar primero los registros de ese tipo de ese día
  if (borrador.modo_operacion === 'REEMPLAZAR') {
    await supabase
      .from('registros_costeo_cocina')
      .delete()
      .eq('fecha', borrador.fecha)
      .eq('tipo', borrador.tipo);
  }

  const payload = borrador.items.map((it) => ({
    fecha: borrador.fecha,
    tipo: borrador.tipo,
    insumo_id: it.insumo_id,
    nombre_insumo: it.nombre_catalogo,
    categoria: it.categoria || 'CARNES',
    cantidad: it.cantidad,
    unidad: it.unidad,
    costo_unitario: it.costo_unitario,
    valor_total: it.valor_total,
    observaciones: 'Ingresado vía Telegram Bot (@Finca_Eliana_bot)',
  }));

  const { error } = await supabase.from('registros_costeo_cocina').insert(payload);
  if (error) throw new Error(`Error guardando en cocina: ${error.message}`);

  // Sincronizar automáticamente el resumen y KPIs del día en costeo_diario
  try {
    await supabase.rpc('rpc_sync_costeo_diario', { p_fecha: borrador.fecha });
  } catch (rpcErr) {
    console.error('Error invocando rpc_sync_costeo_diario:', rpcErr);
  }

  return {
    success: true,
    fecha: borrador.fecha,
    tipo: borrador.tipo,
    itemsGuardados: payload.length,
    valorTotal: borrador.valor_total_estimado,
  };
}
