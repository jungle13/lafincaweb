/**
 * Script de Polling Local para el Bot de Telegram de La Finca
 * Impulsado por GROQ (OpenAI GPT-OSS 120B en LPU ultrarrápido).
 * 14.400 peticiones diarias gratis, sin caídas de cuota.
 */

import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

// Cargar variables desde .env.local de forma nativa sin exponer secretos en el código
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (e) {}

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
  console.error('ERROR: Faltan variables TELEGRAM_BOT_TOKEN o GROQ_API_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

console.log('----------------------------------------------------');
console.log('🥩 INICIANDO BOT DE TELEGRAM (LA FINCA) CON GROQ');
console.log('🤖 Usuario del bot: @Finca_Eliana_bot');
console.log('⚡ Motor IA: Groq (GPT-OSS 120B) - Cuota Ilimitada');
console.log('----------------------------------------------------');

async function deleteWebhook() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`);
    const data = await res.json();
    console.log('📡 Webhook previo liberado para polling:', data.description || 'OK');
  } catch (e) {
    console.warn('Advertencia liberando webhook:', e.message);
  }
}

async function enviarMensajeTelegram(chatId, texto) {
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
  } catch (err) {
    console.error('Error enviando a Telegram:', err.message);
  }
}

// 1. Consultar movimientos de cocina (Cierres, Aperturas, Traslados, Devoluciones)
async function consultarMovimientosCocina(fecha, tipo, categoria, insumo) {
  try {
    let q = supabase
      .from('registros_costeo_cocina')
      .select('fecha, tipo, nombre_insumo, categoria, cantidad, unidad, costo_unitario, valor_total');

    if (fecha) q = q.eq('fecha', fecha);

    // Normalizar tipo de movimiento
    if (tipo && tipo.trim() !== '' && tipo.toUpperCase() !== 'TODOS') {
      const t = tipo.trim().toUpperCase();
      if (t.includes('CIERR')) q = q.eq('tipo', 'CIERRE');
      else if (t.includes('APER')) q = q.eq('tipo', 'APERTURA');
      else if (t.includes('TRAS')) q = q.eq('tipo', 'TRASLADO');
      else if (t.includes('DEV')) q = q.eq('tipo', 'DEVOLUCION');
      else q = q.eq('tipo', t);
    }

    // Normalizar categoría (ej: "carnes" -> "%carne%")
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
  } catch (e) {
    return { error: e.message };
  }
}

// 2. Consultar Stock (Conteos Físicos)
async function consultarStock(termino) {
  try {
    const { data: conteos } = await supabase
      .from('conteos_fisicos')
      .select('id, fecha, tipo')
      .order('fecha', { ascending: false })
      .limit(3);

    if (!conteos || conteos.length === 0) return { mensaje: 'No hay conteos registrados' };
    const ids = conteos.map((c) => c.id);

    let query = supabase
      .from('conteos_fisicos_detalle')
      .select('nombre_insumo, categoria, ubicacion, cantidad, unidad, cant_sin_porcionar_kg, porciones_und, peso_porciones_kg, costo_unitario, valor_total')
      .in('conteo_id', ids);

    if (termino && termino.trim() !== '') {
      const t = termino.trim().toLowerCase();
      if (t.startsWith('carne')) {
        query = query.or('categoria.ilike.%carne%,nombre_insumo.ilike.%carne%');
      } else {
        query = query.or(`nombre_insumo.ilike.%${termino.trim()}%,categoria.ilike.%${termino.trim()}%`);
      }
    }
    const { data } = await query;
    return { fecha_ultimo_conteo: conteos[0].fecha, items: data || [] };
  } catch (e) {
    return { error: e.message };
  }
}

// 3. Consultar Insumos / Precios
async function consultarInsumosPrecios(termino) {
  try {
    let query = supabase
      .from('catalogo_insumos')
      .select('codigo, nombre, categoria, unidad_medida, costo_unitario_kg, stock_minimo_kg')
      .order('nombre', { ascending: true })
      .limit(20);

    if (termino) query = query.ilike('nombre', `%${termino.trim()}%`);
    const { data } = await query;
    return { insumos: data || [] };
  } catch (e) {
    return { error: e.message };
  }
}

// 4. Consultar Compras
async function consultarCompras(insumo) {
  try {
    const { data: compras } = await supabase
      .from('compras')
      .select('id, fecha, numero_factura, proveedor, valor_total')
      .order('fecha', { ascending: false })
      .limit(5);

    if (!compras || compras.length === 0) return { compras: [] };

    const ids = compras.map((c) => c.id);
    const { data: detalles } = await supabase
      .from('compras_detalle')
      .select('compra_id, cantidad_kg, costo_unitario_kg, costo_total, insumo_id, catalogo_insumos(nombre)')
      .in('compra_id', ids);

    return compras.map((c) => ({
      fecha: c.fecha,
      factura: c.numero_factura,
      proveedor: c.proveedor,
      total: c.valor_total,
      articulos: (detalles || []).filter((d) => d.compra_id === c.id).map((i) => ({
        insumo: i.catalogo_insumos?.nombre,
        cantidad_kg: i.cantidad_kg,
        costo_unitario: i.costo_unitario_kg,
        costo_total: i.costo_total,
      })),
    }));
  } catch (e) {
    return { error: e.message };
  }
}

// 5. Consultar Ventas y Precios de Platos en Carta
async function consultarVentas(fecha, producto) {
  try {
    if (producto && producto.trim() !== '') {
      let q = supabase
        .from('ventas_detalle')
        .select('fecha, nombre_producto, cantidad, valor_unitario, gran_total')
        .ilike('nombre_producto', `%${producto.trim()}%`);

      if (fecha) q = q.eq('fecha', fecha);
      const { data } = await q.order('fecha', { ascending: false }).limit(30);
      return {
        ventas_producto: (data || []).map((r) => ({
          fecha: r.fecha,
          producto: r.nombre_producto,
          cantidad_vendida: Number(r.cantidad || 0),
          precio_venta_publico: Number(r.cantidad ? Math.round(r.gran_total / r.cantidad) : r.valor_unitario),
          valor_neto_sin_impuesto: Number(r.valor_unitario || 0),
          total_vendido: Number(r.gran_total || 0),
        })),
      };
    }

    let query = supabase
      .from('ventas_diarias')
      .select('fecha, dia_semana, total_articulos, venta_neta, gran_total')
      .order('fecha', { ascending: false })
      .limit(fecha ? 1 : 7);

    if (fecha) query = query.eq('fecha', fecha);
    const { data } = await query;
    return { jornadas: data || [] };
  } catch (e) {
    return { error: e.message };
  }
}

// 6. Consultar Costeo Diario
async function consultarCosteoDiario(fecha) {
  try {
    let query = supabase
      .from('costeo_diario')
      .select('fecha, titulo, pos_sales, costo_bruto, devoluciones, costo_neto, food_cost_porcentaje, costo_apertura, costo_cierre, consumo_real')
      .order('fecha', { ascending: false })
      .limit(fecha ? 1 : 5);

    if (fecha) query = query.eq('fecha', fecha);
    const { data } = await query;
    return { costeo: data || [] };
  } catch (e) {
    return { error: e.message };
  }
}

async function obtenerHistorialGroq(chatId) {
  try {
    const { data } = await supabase
      .from('telegram_mensajes_contexto')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(6);

    return (data || []).reverse().map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    }));
  } catch (e) {
    return [];
  }
}

async function guardarMensaje(chatId, role, content) {
  try {
    await supabase.from('telegram_mensajes_contexto').insert({ chat_id: chatId, role, content });
  } catch (e) {}
}

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

const tools = [
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
      description: 'Consulta ventas y PRECIOS DE VENTA al público en la carta de platos terminados (ej: Tamal: $24.000 COP, Tamal ejecutivo: $20.000 COP, Mazamorra: $8.000 COP, Churrasco, etc.) o cantidades vendidas en fechas específicas.',
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
          fecha: { type: 'string', description: 'Fecha YYYY-MM-DD (ej: 2026-10-25).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_stock_conteo',
      description: 'Consulta existencias físicas del último conteo de bodega o cocina.',
      parameters: {
        type: 'object',
        properties: {
          terminoInsumo: { type: 'string', description: 'Nombre del insumo a buscar (ej: carne, costilla, pollo).' },
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
          insumo: { type: 'string', description: 'Nombre del insumo a buscar en compras.' },
        },
      },
    },
  },
];

async function ejecutarTool(callName, args) {
  if (callName === 'consultar_movimientos_cocina' || callName === 'consultar_traslados_cocina') {
    return await consultarMovimientosCocina(args.fecha, args.tipo || (callName === 'consultar_traslados_cocina' ? 'TRASLADO' : undefined), args.categoria, args.insumo);
  } else if (callName === 'consultar_ventas') {
    return await consultarVentas(args.fecha, args.producto);
  } else if (callName === 'consultar_costeo_diario') {
    return await consultarCosteoDiario(args.fecha);
  } else if (callName === 'consultar_stock_conteo') {
    return await consultarStock(args.terminoInsumo);
  } else if (callName === 'consultar_insumos_precios') {
    return await consultarInsumosPrecios(args.termino);
  } else if (callName === 'consultar_compras') {
    return await consultarCompras(args.insumo);
  }
  return { error: 'Herramienta desconocida' };
}

async function procesarMensaje(chatId, texto) {
  console.log(`\n📩 Mensaje recibido de [Chat ${chatId}]: "${texto}"`);

  if (texto === '/start') {
    const welcome = `Asistente de La Finca listo.
Consultas disponibles:
- Traslados/bajadas a cocina (verduras, carnes, abarrotes)
- Existencias en bodega y cocina
- Precios y costos de catálogo
- Ventas y platos vendidos
- Consumo real y costeo diario`;
    await enviarMensajeTelegram(chatId, welcome);
    await guardarMensaje(chatId, 'user', texto);
    await guardarMensaje(chatId, 'model', welcome);
    return;
  }

  try {
    const historial = await obtenerHistorialGroq(chatId);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...historial,
      { role: 'user', content: texto },
    ];

    let res = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.1,
    });

    let assistantMsg = res.choices[0].message;

    // Loop de Tools si el modelo solicita consultar la base de datos (soporta llamadas múltiples encadenadas)
    let iter = 0;
    while (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0 && iter < 6) {
      iter++;
      messages.push(assistantMsg);

      for (const t of assistantMsg.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(t.function.arguments || '{}');
        } catch (e) {}

        console.log(`🔧 Groq invocó herramienta: "${t.function.name}" con args:`, args);
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
    console.log(`🤖 Respuesta: "${respuestaFinal.slice(0, 100)}..."`);
    await guardarMensaje(chatId, 'user', texto);
    await guardarMensaje(chatId, 'model', respuestaFinal);
    await enviarMensajeTelegram(chatId, respuestaFinal);
  } catch (err) {
    console.error('Error procesando mensaje:', err);
    await enviarMensajeTelegram(chatId, 'Error consultando los datos del restaurante.');
  }
}

let offset = 0;
async function poll() {
  await deleteWebhook();
  console.log('✅ Bot listo y escuchando en Telegram con GROQ. ¡Escríbele desde tu celular a @Finca_Eliana_bot!\n');

  while (true) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=25`);
      const data = await res.json();

      if (data.ok && data.result) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          const msg = update.message || update.edited_message;
          if (msg && msg.text) {
            await procesarMensaje(msg.chat.id, msg.text.trim());
          }
        }
      }
    } catch (err) {
      console.warn('Reintentando polling...', err.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

poll();
