import Groq from 'groq-sdk';
import { supabase } from '@/lib/supabase';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ====================================================================
// 1. FUNCIONES DE CONSULTA A BASE DE DATOS (HERRAMIENTAS PARA GROQ)
// ====================================================================

export async function consultarMovimientosCocina(fecha?: string, tipo?: string, categoria?: string, insumo?: string) {
  try {
    let q = supabase
      .from('registros_costeo_cocina')
      .select('fecha, tipo, nombre_insumo, categoria, cantidad, unidad, costo_unitario, valor_total');

    if (fecha) q = q.eq('fecha', fecha);

    if (tipo && tipo.trim() !== '' && tipo.toUpperCase() !== 'TODOS') {
      const t = tipo.trim().toUpperCase();
      if (t.includes('CIERR')) q = q.eq('tipo', 'CIERRE');
      else if (t.includes('APER')) q = q.eq('tipo', 'APERTURA');
      else if (t.includes('TRAS')) q = q.eq('tipo', 'TRASLADO');
      else if (t.includes('DEV')) q = q.eq('tipo', 'DEVOLUCION');
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

export async function consultarCompras(insumo?: string, limite: number = 6) {
  try {
    let query = supabase
      .from('compras')
      .select('id, fecha, numero_factura, proveedor, valor_total, observaciones')
      .order('fecha', { ascending: false })
      .limit(limite);

    const { data: compras, error: errCompras } = await query;
    if (errCompras) throw errCompras;

    if (compras && compras.length > 0) {
      const compraIds = compras.map((c) => c.id);
      let detQuery = supabase
        .from('compras_detalle')
        .select('compra_id, cantidad_kg, costo_unitario_kg, costo_total, insumo_id, catalogo_insumos(nombre)')
        .in('compra_id', compraIds);

      const { data: detalles } = await detQuery;

      return compras.map((c) => {
        const items = detalles?.filter((d) => d.compra_id === c.id) || [];
        return {
          fecha: c.fecha,
          numero_factura: c.numero_factura,
          proveedor: c.proveedor,
          valor_total_factura: Number(c.valor_total || 0),
          articulos: items.map((i: any) => ({
            insumo: i.catalogo_insumos?.nombre || 'Insumo',
            cantidad_kg: Number(i.cantidad_kg || 0),
            costo_unitario_kg: Number(i.costo_unitario_kg || 0),
            costo_total: Number(i.costo_total || 0),
          })),
        };
      });
    }

    return [];
  } catch (err: any) {
    return { exito: false, error: err.message };
  }
}

export async function consultarVentas(fecha?: string, producto?: string) {
  try {
    if (producto && producto.trim() !== '') {
      let q = supabase
        .from('ventas_detalle')
        .select('fecha, codigo_producto, nombre_producto, categoria, cantidad, valor_unitario, gran_total')
        .ilike('nombre_producto', `%${producto.trim()}%`);

      if (fecha) q = q.eq('fecha', fecha);
      const { data, error } = await q.order('fecha', { ascending: false }).limit(30);

      if (error) throw error;
      return {
        producto_buscado: producto,
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
      .limit(fecha ? 1 : 7);

    if (fecha) query = query.eq('fecha', fecha);

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
      .select('fecha, titulo, pos_sales, costo_bruto, devoluciones, costo_neto, food_cost_porcentaje, costo_apertura, costo_cierre, consumo_real')
      .order('fecha', { ascending: false })
      .limit(fecha ? 1 : 5);

    if (fecha) query = query.eq('fecha', fecha);

    const { data, error } = await query;
    if (error) throw error;

    return {
      registros: data?.map((r) => ({
        fecha: r.fecha,
        titulo: r.titulo,
        ventas_pos: Number(r.pos_sales || 0),
        costo_consumo_real: Number(r.consumo_real || r.costo_neto || 0),
        food_cost_pct: Number(r.food_cost_porcentaje || 0),
      })),
    };
  } catch (err: any) {
    return { exito: false, error: err.message };
  }
}

// ====================================================================
// 2. HISTORIAL DE CONTEXTO EN SUPABASE
// ====================================================================

export async function obtenerHistorialGroq(chatId: number, limite: number = 6) {
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
      content: m.content,
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

export async function enviarMensajeTelegram(chatId: number, texto: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
    });

    const data = await res.json();
    if (!data.ok) {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: texto }),
      });
    }
  } catch (err: any) {}
}

// ====================================================================
// 3. MOTOR INTELIGENTE GROQ
// ====================================================================

const systemPrompt = `
Eres el Asistente Operativo oficial de "La Finca" (Asador, Restaurante y Control de Carnes) en Telegram.
Tu misión es entregar respuestas de negocio ULTRA PUNTUALES, DIRECTAS Y EJECUTIVAS.

CALENDARIO Y FECHAS DE REFERENCIA (AÑO OPERATIVO 2026):
- Fecha de referencia actual: Octubre 2026.
- Sábado pasado: 2026-10-24
- Domingo pasado: 2026-10-25
- Lunes pasado: 2026-10-26

REGLAS DE FORMATO ESTRICTAS:
1. CERO EMOJIS: Prohibido incluir emojis en tus respuestas.
2. CERO RELLENO: No saludes, no te presentes, no uses frases de cortesía ni despedidas. Ve directo al dato numérico.
3. FORMATO NUMÉRICO Y MONETARIO:
   - Valores en pesos colombianos con separador de miles: $XX.XXX COP.
   - Cantidades con su unidad clara: Kg, Und, Porciones.
4. ESTRUCTURA DE RESPUESTA:
   - Para cierres de cocina (ej: "con cuántas carnes cerramos el domingo"):
     Usa consultar_movimientos_cocina con tipo: 'CIERRE', fecha: '2026-10-25', categoria: 'CARNE'.
     Si piden "solo cantidades", lista cada corte con su cantidad y unidad sin precios:
     - Insumo: Cantidad Unidad
     Total: Cantidad total Kg
   - Para aperturas de cocina (ej: "con cuánto abrimos"):
     Usa consultar_movimientos_cocina con tipo: 'APERTURA'.
   - Para traslados o "bajadas a cocina":
     Usa consultar_movimientos_cocina con tipo: 'TRASLADO':
     * Lista cada insumo: - Insumo: Cantidad Unidad | Costo Unitario: $COP | Total: $COP
     * Total Traslado: $COP.
   - Si piden ventas de fin de semana (sábado y domingo): indica sábado, domingo y el total consolidado.
   - Si piden "precio de venta" o "precio en carta" de un plato (ej: Tamal, Mazamorra, Churrasco, etc.):
     Usa consultar_ventas buscando el producto para devolver el precio de venta al público en carta.
   - Si piden "costo de insumo" o "costo de catálogo" de materia prima:
     Usa consultar_insumos_precios.
5. OBLIGATORIO: Siempre consulta los datos reales de la base de datos usando las herramientas. NUNCA inventes números.
`;

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
      description: 'Consulta ventas y PRECIOS DE VENTA al público en la carta de platos terminados (ej: Tamal: $24.000 COP, Tamal ejecutivo: $20.000 COP, Mazamorra: $8.000 COP, Churrasco, etc.) o cantidades vendidas.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD. Opcional.' },
          producto: { type: 'string', description: 'Nombre del plato vendido (ej: Tamal, Mazamorra, Churrasco). Opcional.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_costeo_diario',
      description: 'Consulta consumo real, food cost %, ventas POS y costos de una fecha.',
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
      description: 'Consulta compras recientes, facturas y costos de adquisición.',
      parameters: {
        type: 'object',
        properties: {
          insumo: { type: 'string', description: 'Nombre del insumo.' },
        },
      },
    },
  },
];

async function ejecutarTool(callName: string, args: any) {
  if (callName === 'consultar_movimientos_cocina' || callName === 'consultar_traslados_cocina') {
    return await consultarMovimientosCocina(args.fecha, args.tipo || (callName === 'consultar_traslados_cocina' ? 'TRASLADO' : undefined), args.categoria, args.insumo);
  } else if (callName === 'consultar_ventas') {
    return await consultarVentas(args.fecha, args.producto);
  } else if (callName === 'consultar_costeo_diario') {
    return await consultarCosteoDiario(args.fecha);
  } else if (callName === 'consultar_stock_conteo') {
    return await consultarStockConteo(args.terminoInsumo);
  } else if (callName === 'consultar_insumos_precios') {
    return await consultarInsumosPrecios(args.termino);
  } else if (callName === 'consultar_compras') {
    return await consultarCompras(args.insumo);
  }
  return { error: 'Herramienta desconocida' };
}

export async function procesarMensajeTelegram(chatId: number, textoUsuario: string) {
  try {
    const historial = await obtenerHistorialGroq(chatId, 6);
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...historial,
      { role: 'user', content: textoUsuario },
    ];

    let res = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.1,
    });

    let assistantMsg = res.choices[0].message;

    let iter = 0;
    while (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0 && iter < 6) {
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

      res = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.1,
      });

      assistantMsg = res.choices[0].message;
    }

    const respuestaFinal = assistantMsg.content || 'Sin datos disponibles para esta consulta.';

    await guardarMensajeChat(chatId, 'user', textoUsuario);
    await guardarMensajeChat(chatId, 'model', respuestaFinal);
    await enviarMensajeTelegram(chatId, respuestaFinal);

    return { exito: true, respuesta: respuestaFinal };
  } catch (err: any) {
    console.error('Error procesando mensaje de Telegram:', err);
    await enviarMensajeTelegram(chatId, 'Error consultando los datos del restaurante.');
    return { exito: false, error: err.message };
  }
}
