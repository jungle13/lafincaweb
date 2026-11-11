import { supabase } from '@/lib/supabase';
import {
  consultarVentas,
  consultarCosteoDiario,
  consultarMovimientosCocina,
  consultarLibroCaja,
  consultarCompras,
  consultarStockConteo,
  consultarInsumosPrecios,
  enviarMensajeTelegram,
  guardarMensajeChat
} from './telegramBotService';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// ============================================================================
// 1. HELPERS DE ENVÍO Y EDICIÓN DE MENSAJES CON BOTONES INTERACTIVOS
// ============================================================================

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export async function enviarMensajeConMenu(
  chatId: number,
  texto: string,
  replyMarkup?: InlineKeyboardMarkup
) {
  if (!TELEGRAM_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const cleanText = texto.length > 4000 ? texto.slice(0, 3950) + '\n\n...(información recortada)' : texto;

  // Botón por defecto para volver al menú principal si no viene uno
  let finalMarkup = replyMarkup;
  if (!finalMarkup) {
    finalMarkup = {
      inline_keyboard: [[{ text: '🏠 Menú Principal', callback_data: 'menu_principal' }]]
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: cleanText,
        parse_mode: 'Markdown',
        reply_markup: finalMarkup
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: cleanText,
          reply_markup: finalMarkup
        }),
      });
    }
  } catch (err: any) {
    console.error('Error enviando mensaje con menú telegram:', err);
  }
}

export async function editarMensajeTelegram(
  chatId: number,
  messageId: number,
  texto: string,
  replyMarkup?: InlineKeyboardMarkup
) {
  if (!TELEGRAM_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`;
  const cleanText = texto.length > 4000 ? texto.slice(0, 3950) + '\n\n...(información recortada)' : texto;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: cleanText,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      }),
    });
  } catch (err: any) {
    console.error('Error editando mensaje telegram:', err);
  }
}

export async function responderCallbackQuery(callbackQueryId: string, texto?: string) {
  if (!TELEGRAM_TOKEN || !callbackQueryId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: texto || '',
      }),
    });
  } catch (err) {}
}

// ============================================================================
// 2. TECLADOS INTERACTIVOS (MENÚ PRINCIPAL Y SUBMENÚS)
// ============================================================================

export function getMenuPrincipalKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📊 1. Ventas y Facturación', callback_data: 'sub_ventas' },
        { text: '🥩 2. Costeo Diario Cocina', callback_data: 'sub_costeo' }
      ],
      [
        { text: '🍽️ 3. Consumos (Ver / Ingresar)', callback_data: 'sub_consumos' },
        { text: '💼 4. Libro de Caja Menor', callback_data: 'sub_caja' }
      ],
      [
        { text: '🛒 5. Compras y Facturas', callback_data: 'sub_compras' },
        { text: '📦 6. Stock y Catálogo', callback_data: 'sub_stock' }
      ]
    ]
  };
}

export function getSubmenuVentasKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '📅 Ventas del Día (Última Jornada)', callback_data: 'vta_ultima' }],
      [{ text: '📆 Ventas del Mes (Noviembre 2026)', callback_data: 'vta_mes' }],
      [{ text: '🏆 Top 5 Platos Más Vendidos', callback_data: 'vta_top' }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

export function getSubmenuCosteoKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '📋 Liquidación Última Hoja Activa', callback_data: 'costeo_ultima' }],
      [{ text: '🔄 Traslados Bodega a Cocina', callback_data: 'costeo_traslados' }],
      [{ text: '⚖️ Cierre Cocina vs Bodega', callback_data: 'costeo_cierres' }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

export function getSubmenuConsumosKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🔎 Consultar Consumos del Día', callback_data: 'csm_consultar' }],
      [{ text: '➕ Ingresar Consumo de Plato (Venta)', callback_data: 'csm_ingresar_plato' }],
      [{ text: '➕ Ingresar Consumo de Insumo / Carne', callback_data: 'csm_ingresar_insumo' }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

export function getSubmenuCajaKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '💵 Cuadre de Caja (Último Día)', callback_data: 'caja_cuadre' }],
      [{ text: '📊 Salidas por 3 Bloques (Mes)', callback_data: 'caja_bloques' }],
      [{ text: '👩‍💼 Salidas por Cajera', callback_data: 'caja_cajeras' }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

export function getSubmenuComprasKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🧾 Últimas Facturas Registradas', callback_data: 'cmp_ultimas' }],
      [{ text: '🥩 Compras de Carnes', callback_data: 'cmp_carnes' }],
      [{ text: '🥬 Compras de Verduras e Insumos', callback_data: 'cmp_verduras' }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

export function getSubmenuStockKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🥩 Existencias de Carnes (Conteo Físico)', callback_data: 'stk_carnes' }],
      [{ text: '💲 Precios Oficiales Catálogo', callback_data: 'stk_precios' }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

// ============================================================================
// 3. ESTADOS DE LA SESIÓN PARA INGRESO GUIADO DE CONSUMOS
// ============================================================================

export interface ConsumoDraftState {
  chatId: number;
  tipoConsumo: 'PLATO_VENTA' | 'INSUMO_CATALOGO';
  paso: 'FECHA' | 'ITEM' | 'CANTIDAD' | 'RESPONSABLE' | 'CONFIRMACION';
  fecha?: string;
  itemId?: string | number;
  nombreItem?: string;
  categoria?: string;
  precioUnitario?: number;
  cantidad?: number;
  unidad?: string;
  total?: number;
  responsable?: string;
}

// ============================================================================
// 4. GENERADORES DE INFORMACIÓN DE CONSULTA DIRECTA (RÁPIDOS, 0 TOKENS)
// ============================================================================

const formatCOP = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

export async function generarRespuestaVentas(tipo: 'ultima' | 'mes' | 'top'): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  if (tipo === 'ultima') {
    const res: any = await consultarVentas();
    const jornadas = res?.jornadas || [];
    if (!res || jornadas.length === 0) {
      return {
        texto: '⚠️ *No se encontraron registros de ventas recientes.*',
        markup: getSubmenuVentasKeyboard()
      };
    }
    const d = jornadas[0];
    const texto = `📊 *Ventas de la Última Jornada Registrada*

📅 *Fecha:* \`${d.fecha}\` (${d.dia || 'Jornada'})
💰 *Gran Total Cobrado:* *${formatCOP(d.total_facturado_cop || 0)} COP*
🏷️ *Venta Neta:* ${formatCOP(d.venta_neta_cop || 0)} COP
📦 *Artículos Servidos:* ${(d.platos_vendidos || 0).toLocaleString('es-CO')} und`;

    return {
      texto,
      markup: {
        inline_keyboard: [
          [{ text: '🏆 Ver Top Platos', callback_data: 'vta_top' }],
          [{ text: '🔙 Volver a Ventas', callback_data: 'sub_ventas' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
        ]
      }
    };
  }

  if (tipo === 'mes') {
    const res: any = await consultarVentas('2026-11');
    const dias = res?.jornadas || [];
    const totalMes = dias.reduce((acc: number, d: any) => acc + (d.total_facturado_cop || 0), 0);
    const artsMes = dias.reduce((acc: number, d: any) => acc + (d.platos_vendidos || 0), 0);

    const texto = `📆 *Consolidado de Ventas • Noviembre 2026*

💰 *Gran Total Facturado:* *${formatCOP(totalMes)} COP*
📦 *Total Artículos Vendidos:* ${artsMes.toLocaleString('es-CO')} uds
📅 *Jornadas con Ventas:* ${dias.length} días registrados

*Últimos días:*
${dias.slice(0, 5).map((d: any) => `• \`${d.fecha}\`: ${formatCOP(d.total_facturado_cop || 0)} COP (${d.platos_vendidos || 0} uds)`).join('\n')}`;

    return {
      texto,
      markup: {
        inline_keyboard: [
          [{ text: '🏆 Top Platos Más Vendidos', callback_data: 'vta_top' }],
          [{ text: '🔙 Volver a Ventas', callback_data: 'sub_ventas' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
        ]
      }
    };
  }

  // Top platos
  const { data: ranking } = await supabase
    .from('ventas_detalle')
    .select('nombre_producto, cantidad, gran_total')
    .order('cantidad', { ascending: false })
    .limit(100);

  const aggMap = new Map<string, { cant: number; total: number }>();
  for (const r of ranking || []) {
    const curr = aggMap.get(r.nombre_producto) || { cant: 0, total: 0 };
    curr.cant += Number(r.cantidad || 0);
    curr.total += Number(r.gran_total || 0);
    aggMap.set(r.nombre_producto, curr);
  }

  const sorted = Array.from(aggMap.entries())
    .sort((a, b) => b[1].cant - a[1].cant)
    .slice(0, 5);

  let texto = `🏆 *Top 5 Platos Más Vendidos en La Finca*\n\n`;
  sorted.forEach(([nombre, s], idx) => {
    texto += `*${idx + 1}. ${nombre}*\n   • ${s.cant} porciones vendidas\n   • ${formatCOP(s.total)} COP recaudados\n`;
  });

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '📅 Ventas del Día', callback_data: 'vta_ultima' }],
        [{ text: '🔙 Volver a Ventas', callback_data: 'sub_ventas' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaCosteo(tipo: 'ultima' | 'traslados' | 'cierres'): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const res = await consultarCosteoDiario();
  if (!res || !res.hojas || res.hojas.length === 0) {
    return {
      texto: '⚠️ *No hay hojas de costeo diario registradas actualmente.*',
      markup: getSubmenuCosteoKeyboard()
    };
  }

  const h = res.hojas[0];
  const c = h.liquidacion_cocina_del_dia;
  const b = h.liquidacion_bodega_del_dia;

  if (tipo === 'ultima') {
    const texto = `📋 *Liquidación Hoja de Costeo Diario*
📅 *Fecha:* \`${h.fecha}\` (${h.titulo})

*Liquidación Cocina:*
• Apertura (Amanece): ${formatCOP(c.costo_cocina_apertura_cop)} COP
• + Traslados Bodega: +${formatCOP(c.costo_movimientos_a_cocina_cop)} COP
• - Devoluciones Bodega: -${formatCOP(c.costo_devoluciones_a_bodega_cop)} COP
• - Cierre Físico Cocina: -${formatCOP(c.costo_cocina_cierre_cop)} COP
• + Consumos Internos: +${formatCOP(c.costo_consumos_cop)} COP
━━━━━━━━━━━━━━━━━━━
🔥 *Consumo Real Total:* *${formatCOP(c.costo_consumo_real_total_cop)} COP*
💵 *Ventas del Día (POS):* ${formatCOP(c.total_ventas_del_dia_pos_cop)} COP
📈 *Rendimiento:* ${c.rendimiento_formato}
🎯 *Food Cost:* *${c.food_cost_porcentaje}*`;

    return {
      texto,
      markup: {
        inline_keyboard: [
          [{ text: '🔄 Ver Traslados', callback_data: 'costeo_traslados' }, { text: '⚖️ Ver Cierres', callback_data: 'costeo_cierres' }],
          [{ text: '🔙 Volver a Costeo', callback_data: 'sub_costeo' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
        ]
      }
    };
  }

  if (tipo === 'traslados') {
    const movs = await consultarMovimientosCocina(h.fecha, 'TRASLADO');
    const items = movs?.items || [];

    let texto = `🔄 *Traslados Bodega a Cocina • ${h.fecha}*\n`;
    texto += `💰 *Total Trasladado:* *${formatCOP(movs?.total_dinero_cop || 0)} COP*\n`;
    texto += `📦 *Registros:* ${items.length} movimientos\n\n`;

    if (items.length === 0) {
      texto += `_No hay traslados cargados para este día._`;
    } else {
      texto += items.slice(0, 10).map((it: any) => `• *${it.insumo}:* ${it.cantidad} ${it.unidad} (${formatCOP(it.valor_total)})`).join('\n');
      if (items.length > 10) texto += `\n_...y ${items.length - 10} insumos más._`;
    }

    return {
      texto,
      markup: {
        inline_keyboard: [
          [{ text: '📋 Ver Liquidación Completa', callback_data: 'costeo_ultima' }],
          [{ text: '🔙 Volver a Costeo', callback_data: 'sub_costeo' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
        ]
      }
    };
  }

  // Cierres
  const texto = `⚖️ *Cierres de Inventario • ${h.fecha}*

*Cocina Cierre:*
• Valor en Cocina: ${formatCOP(c.costo_cocina_cierre_cop)} COP

*Bodega Cierre:*
• Existencias Físicas: ${formatCOP(b.bodega_cierre_cop)} COP
• Ítems contados: ${b.items_en_bodega_cierre} insumos`;

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '📋 Ver Liquidación', callback_data: 'costeo_ultima' }],
        [{ text: '🔙 Volver a Costeo', callback_data: 'sub_costeo' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaConsumosConsulta(fechaParam?: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  // Buscar última fecha si no viene especificada
  let fechaTarget = fechaParam;
  if (!fechaTarget) {
    const { data: latest } = await supabase
      .from('costeo_diario')
      .select('fecha')
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();
    fechaTarget = latest?.fecha || '2026-11-10';
  }

  const { data: rows } = await supabase
    .from('registros_costeo_cocina')
    .select('*')
    .eq('fecha', fechaTarget)
    .eq('tipo', 'CONSUMO')
    .order('categoria', { ascending: true })
    .order('nombre_insumo', { ascending: true });

  const platos = (rows || []).filter(r => (r.categoria || '').includes('Producto'));
  const insumos = (rows || []).filter(r => !(r.categoria || '').includes('Producto'));

  const totalPlatos = platos.reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
  const totalInsumos = insumos.reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
  const granTotal = totalPlatos + totalInsumos;

  let texto = `🍽️ *Consumos del Día • ${fechaTarget}*\n\n`;
  texto += `💰 *Gran Total Consumos:* *${formatCOP(granTotal)} COP*\n\n`;

  texto += `*1. Consumido de Productos para la Venta (${platos.length})*\n`;
  if (platos.length === 0) {
    texto += `_Sin consumo de platos de venta registrados._\n`;
  } else {
    platos.forEach(p => {
      texto += `• *${p.nombre_producto || p.nombre_insumo}:* ${p.cantidad} ${p.unidad} ➔ ${formatCOP(p.valor_total)}${p.observaciones ? ` _(${p.observaciones})_` : ''}\n`;
    });
    texto += `*Subtotal Platos:* ${formatCOP(totalPlatos)} COP\n`;
  }

  texto += `\n*2. Consumido de Insumos y Carnes (${insumos.length})*\n`;
  if (insumos.length === 0) {
    texto += `_Sin consumo de insumos/carnes registrados._\n`;
  } else {
    insumos.forEach(i => {
      texto += `• *${i.nombre_insumo}:* ${i.cantidad} ${i.unidad} ➔ ${formatCOP(i.valor_total)}${i.observaciones ? ` _(${i.observaciones})_` : ''}\n`;
    });
    texto += `*Subtotal Insumos:* ${formatCOP(totalInsumos)} COP\n`;
  }

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '➕ Ingresar Consumo de Plato', callback_data: 'csm_ingresar_plato' }],
        [{ text: '➕ Ingresar Consumo de Insumo', callback_data: 'csm_ingresar_insumo' }],
        [{ text: '🔙 Volver a Consumos', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaCaja(tipo: 'cuadre' | 'bloques' | 'cajeras'): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const res = await consultarLibroCaja({ ver_resumen_diario: true });
  const cuadres = res?.cuadre_diario_oficial || [];

  if (tipo === 'cuadre') {
    if (cuadres.length === 0) {
      return {
        texto: '⚠️ *No hay registros de arqueo o cuadre de caja activos.*',
        markup: getSubmenuCajaKeyboard()
      };
    }
    const c = cuadres[0];
    const texto = `💵 *Cuadre y Arqueo Diario de Caja Menor*

📅 *Fecha:* \`${c.fecha}\` (Día ${c.dia_mes})
👩‍💼 *Cajera Encargada:* ${c.cajeras_responsables}
💰 *Venta POS Total:* ${formatCOP(c.venta_pos_total_cop)} COP
💵 *Efectivo POS:* ${formatCOP(c.venta_efectivo_pos_cop)} COP
💳 *Datáfonos:* ${formatCOP(c.datafonos_tarjetas_cop)} COP
🛑 *Total Salidas Pagadas:* -${formatCOP(c.total_salidas_caja_cop)} COP
💵 *Efectivo Físico Cierre:* ${formatCOP(c.efectivo_fisico_cierre_cop)} COP
━━━━━━━━━━━━━━━━━━━
🎯 *Estado Cuadre:* *${c.estado_cuadre}*`;

    return {
      texto,
      markup: {
        inline_keyboard: [
          [{ text: '📊 Salidas por 3 Bloques', callback_data: 'caja_bloques' }],
          [{ text: '🔙 Volver a Caja Menor', callback_data: 'sub_caja' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
        ]
      }
    };
  }

  if (tipo === 'bloques') {
    const b: any = res?.desglose_3_bloques || {};
    const total = res?.total_salidas_cop || 0;

    const texto = `📊 *Salidas de Caja Menor por 3 Bloques (Nov 2026)*

1️⃣ *Insumos por Caja:* ${formatCOP(b.costos_materia_prima_cop || 0)} COP
2️⃣ *Gastos Operativos:* ${formatCOP(b.gastos_operativos_cop || 0)} COP
3️⃣ *Turnos y Nómina:* ${formatCOP(b.pago_turnos_nomina_cop || 0)} COP
━━━━━━━━━━━━━━━━━━━
💰 *Total Egresos Mes:* *${formatCOP(total)} COP* (${res?.total_registros_coincidentes || 0} comprobantes)`;

    return {
      texto,
      markup: {
        inline_keyboard: [
          [{ text: '👩‍💼 Salidas por Cajera', callback_data: 'caja_cajeras' }],
          [{ text: '🔙 Volver a Caja Menor', callback_data: 'sub_caja' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
        ]
      }
    };
  }

  // Cajeras
  const cajeras = res?.top_cajeras || [];
  let texto = `👩‍💼 *Salidas Registradas por Cajera*\n\n`;
  cajeras.forEach((c: any) => {
    texto += `• *${c.cajera}:* ${formatCOP(c.total_cop)} COP (${c.registros} salidas)\n`;
  });

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '💵 Cuadre de Caja', callback_data: 'caja_cuadre' }],
        [{ text: '🔙 Volver a Caja Menor', callback_data: 'sub_caja' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaCompras(tipo: 'ultimas' | 'carnes' | 'verduras'): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  if (tipo === 'ultimas') {
    const { data: facturas } = await supabase
      .from('compras')
      .select('fecha, numero_factura, proveedor, categoria, valor_total, total_items')
      .order('fecha', { ascending: false })
      .limit(5);

    let texto = `🧾 *Últimas Facturas de Proveedores Registradas*\n\n`;
    (facturas || []).forEach(f => {
      texto += `• \`${f.fecha}\` • *${f.proveedor}*\n   Factura: \`${f.numero_factura}\` ➔ *${formatCOP(f.valor_total || 0)} COP* (${f.total_items} ítems)\n`;
    });

    return {
      texto,
      markup: {
        inline_keyboard: [
          [{ text: '🥩 Compras Carnes', callback_data: 'cmp_carnes' }, { text: '🥬 Compras Verduras', callback_data: 'cmp_verduras' }],
          [{ text: '🔙 Volver a Compras', callback_data: 'sub_compras' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
        ]
      }
    };
  }

  const catParam = tipo === 'carnes' ? 'Carnes y Proteínas' : 'Verduras y Frutas';
  const res = await consultarCompras({ categoria: catParam });
  const items = res?.compras_recientes || [];

  let texto = `🛒 *Compras Recientes: ${catParam}*\n\n`;
  texto += `💰 *Total Dinero en Categoría:* *${formatCOP(res?.total_dinero_cop || 0)} COP*\n\n`;

  items.slice(0, 6).forEach((i: any) => {
    texto += `• \`${i.fecha}\` *${i.insumo}:* ${i.cantidad} ${i.unidad} ➔ ${formatCOP(i.total)} (${i.proveedor})\n`;
  });

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🧾 Últimas Facturas', callback_data: 'cmp_ultimas' }],
        [{ text: '🔙 Volver a Compras', callback_data: 'sub_compras' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaStock(tipo: 'carnes' | 'precios'): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  if (tipo === 'carnes') {
    const res = await consultarStockConteo('carne');
    const detalles = res?.detalles || [];

    let texto = `🥩 *Existencias de Carnes en Bodega / Cocina*\n`;
    texto += `📅 *Último Conteo Físico:* \`${res?.fecha_ultimo_conteo || 'Reciente'}\`\n\n`;

    if (detalles.length === 0) {
      texto += `_No se encontraron registros de carne en los últimos conteos._`;
    } else {
      detalles.slice(0, 8).forEach((d: any) => {
        texto += `• *${d.insumo}:*\n   ${d.sin_porcionar_kg > 0 ? `${d.sin_porcionar_kg} Kg entero ` : ''}${d.porciones_und > 0 ? `${d.porciones_und} porciones (${d.peso_porciones_kg} Kg)` : ''} ➔ ${formatCOP(d.valor_total_cop)}\n`;
      });
    }

    return {
      texto,
      markup: {
        inline_keyboard: [
          [{ text: '💲 Precios Catálogo', callback_data: 'stk_precios' }],
          [{ text: '🔙 Volver a Stock', callback_data: 'sub_stock' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
        ]
      }
    };
  }

  // Precios
  const res = await consultarInsumosPrecios();
  const insumos = res?.insumos || [];

  let texto = `💲 *Precios Oficiales de Insumos (Catálogo Maestro)*\n\n`;
  insumos.slice(0, 10).forEach((i: any) => {
    texto += `• *${i.nombre}:* ${formatCOP(i.costo_unitario_cop)} / ${i.unidad}\n`;
  });

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🥩 Ver Existencias', callback_data: 'stk_carnes' }],
        [{ text: '🔙 Volver a Stock', callback_data: 'sub_stock' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

// ============================================================================
// 5. MÁQUINA DE ESTADOS: ASISTENTE INTERACTIVO DE CONSUMOS
// ============================================================================

export async function iniciarAsistenteConsumo(
  chatId: number,
  tipo: 'PLATO_VENTA' | 'INSUMO_CATALOGO'
): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  // Obtener las últimas 4 hojas de costeo disponibles para que el usuario escoja la fecha
  const { data: hojas } = await supabase
    .from('costeo_diario')
    .select('fecha, titulo')
    .order('fecha', { ascending: false })
    .limit(4);

  const fechaButtons: InlineKeyboardButton[][] = (hojas || []).map(h => [
    { text: `📅 ${h.fecha} (${h.titulo.replace(/.*-/, '').trim()})`, callback_data: `csm_set_fecha_${h.fecha}` }
  ]);

  fechaButtons.push([
    { text: '✏️ Fecha de Hoy', callback_data: `csm_set_fecha_${new Date().toISOString().split('T')[0]}` }
  ]);
  fechaButtons.push([
    { text: '❌ Cancelar', callback_data: 'sub_consumos' },
    { text: '🏠 Menú Principal', callback_data: 'menu_principal' }
  ]);

  // Guardar estado inicial en telegram_borradores_ingesta o memoria
  const draftData: ConsumoDraftState = {
    chatId,
    tipoConsumo: tipo,
    paso: 'FECHA'
  };

  await supabase.from('telegram_borradores_ingesta').upsert(
    {
      chat_id: chatId,
      area: 'COCINA',
      tipo: 'CONSUMO',
      modo_operacion: 'SUMAR',
      items: draftData,
      estado: 'ASISTENTE_CONSUMO',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chat_id' }
  );

  const nombreTipo = tipo === 'PLATO_VENTA' ? 'Plato de la Carta (Venta)' : 'Insumo o Carne de Cocina';

  const texto = `🍽️ *Registrar Consumo: ${nombreTipo}*

*Paso 1:* Selecciona o toca la fecha de la hoja de costeo a la que pertenece este consumo:`;

  return {
    texto,
    markup: { inline_keyboard: fechaButtons }
  };
}

export async function setFechaConsumo(
  chatId: number,
  fecha: string
): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const { data: row } = await supabase
    .from('telegram_borradores_ingesta')
    .select('items')
    .eq('chat_id', chatId)
    .maybeSingle();

  const state: ConsumoDraftState = row?.items || {
    chatId,
    tipoConsumo: 'PLATO_VENTA',
    paso: 'ITEM'
  };

  state.fecha = fecha;
  state.paso = 'ITEM';

  await supabase.from('telegram_borradores_ingesta').update({
    fecha,
    items: state,
    updated_at: new Date().toISOString()
  }).eq('chat_id', chatId);

  const esPlato = state.tipoConsumo === 'PLATO_VENTA';

  const texto = `📅 *Fecha seleccionada:* \`${fecha}\`

*Paso 2:* Escribe en el chat el nombre ${esPlato ? 'del plato para la venta' : 'del insumo o carne'} y opcionalmente su cantidad.

_Ejemplos válidos:_
${esPlato ? '• "2 Churrascos"\n• "1 Limonada natural"\n• "Pechuga gratinada"' : '• "Costilla ahumada 1.5 kg"\n• "Chorizo 4 porc"\n• "Tomate 2 kg"'}`;

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '❌ Cancelar Consumo', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function procesarTextoItemConsumo(
  chatId: number,
  textoUsuario: string,
  state: ConsumoDraftState
): Promise<{ texto: string; markup?: InlineKeyboardMarkup }> {
  const esPlato = state.tipoConsumo === 'PLATO_VENTA';

  // Extraer posible cantidad del texto (ej: "2 churrascos" o "churrasco 2")
  let cantidadDetectada = 1;
  let queryName = textoUsuario.trim();

  const matchNum = textoUsuario.match(/^(?:(\d+(?:[.,]\d+)?)\s+)?(.*?)(?:\s+(\d+(?:[.,]\d+)?)\s*(?:und|ud|kg|kls|porc|porciones|g|gr)?)?$/i);
  if (matchNum) {
    if (matchNum[1]) {
      cantidadDetectada = parseFloat(matchNum[1].replace(',', '.')) || 1;
      queryName = matchNum[2].trim();
    } else if (matchNum[3]) {
      cantidadDetectada = parseFloat(matchNum[3].replace(',', '.')) || 1;
      queryName = matchNum[2].trim();
    }
  }

  if (esPlato) {
    // Buscar en productos_venta
    const { data: prods } = await supabase
      .from('productos_venta')
      .select('id, nombre, precio_total, unidad, categoria')
      .eq('activo', true)
      .ilike('nombre', `%${queryName}%`)
      .limit(6);

    if (!prods || prods.length === 0) {
      return {
        texto: `❌ No encontré ningún plato para la venta que coincida con: *"${queryName}"*.\n\nPor favor intenta escribirlo de otra forma o toca *Cancelar*.`,
        markup: {
          inline_keyboard: [
            [{ text: '❌ Cancelar', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
          ]
        }
      };
    }

    if (prods.length === 1 || prods[0].nombre.toLowerCase() === queryName.toLowerCase()) {
      const p = prods[0];
      state.itemId = p.id;
      state.nombreItem = p.nombre;
      state.categoria = 'Consumido de Productos para la Venta';
      state.precioUnitario = Number(p.precio_total || 0);
      state.cantidad = cantidadDetectada;
      state.unidad = p.unidad || 'ud';
      state.total = Math.round(cantidadDetectada * state.precioUnitario);
      state.paso = 'RESPONSABLE';

      await supabase.from('telegram_borradores_ingesta').update({ items: state, updated_at: new Date().toISOString() }).eq('chat_id', chatId);

      return mostrarPasoResponsable(state);
    }

    // Múltiples coincidencias: Mostrar botones
    const buttons: InlineKeyboardButton[][] = prods.map(p => [
      { text: `${p.nombre} (${formatCOP(p.precio_total || 0)})`, callback_data: `csm_pick_p_${p.id}_${cantidadDetectada}` }
    ]);
    buttons.push([{ text: '❌ Cancelar', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]);

    return {
      texto: `🔍 Encontré varias opciones para *"${queryName}"*. Toca el plato exacto:`,
      markup: { inline_keyboard: buttons }
    };
  } else {
    // Buscar en catalogo_insumos
    const { data: ins } = await supabase
      .from('catalogo_insumos')
      .select('id, nombre, categoria, costo_unitario_kg, unidad_medida')
      .eq('activo', true)
      .ilike('nombre', `%${queryName}%`)
      .limit(6);

    if (!ins || ins.length === 0) {
      return {
        texto: `❌ No encontré ningún insumo en el catálogo que coincida con: *"${queryName}"*.\n\nIntenta escribir otro nombre o toca *Cancelar*.`,
        markup: {
          inline_keyboard: [
            [{ text: '❌ Cancelar', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
          ]
        }
      };
    }

    if (ins.length === 1 || ins[0].nombre.toLowerCase() === queryName.toLowerCase()) {
      const i = ins[0];
      state.itemId = i.id;
      state.nombreItem = i.nombre;
      state.categoria = 'Consumido del Catálogo de Insumos y Carne';
      state.precioUnitario = Number(i.costo_unitario_kg || 0);
      state.cantidad = cantidadDetectada;
      state.unidad = i.unidad_medida || 'Kg';
      state.total = Math.round(cantidadDetectada * state.precioUnitario);
      state.paso = 'RESPONSABLE';

      await supabase.from('telegram_borradores_ingesta').update({ items: state, updated_at: new Date().toISOString() }).eq('chat_id', chatId);

      return mostrarPasoResponsable(state);
    }

    const buttons: InlineKeyboardButton[][] = ins.map(i => [
      { text: `${i.nombre} (${formatCOP(i.costo_unitario_kg || 0)}/${i.unidad_medida})`, callback_data: `csm_pick_i_${i.id}_${cantidadDetectada}` }
    ]);
    buttons.push([{ text: '❌ Cancelar', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]);

    return {
      texto: `🔍 Encontré varios insumos para *"${queryName}"*. Toca el correcto:`,
      markup: { inline_keyboard: buttons }
    };
  }
}

export function mostrarPasoResponsable(state: ConsumoDraftState): { texto: string; markup: InlineKeyboardMarkup } {
  const texto = `✅ *Ítem Seleccionado:* ${state.nombreItem}
📊 *Cantidad:* ${state.cantidad} ${state.unidad}
💰 *Valor Unitario:* ${formatCOP(state.precioUnitario || 0)} COP
💵 *Subtotal:* *${formatCOP(state.total || 0)} COP*

*Paso 3:* Selecciona el responsable o motivo de este consumo:`;

  const buttons: InlineKeyboardButton[][] = [
    [
      { text: '👨‍🍳 Personal / Turno', callback_data: 'csm_resp_Personal/Turno' },
      { text: '👔 Administración', callback_data: 'csm_resp_Administración' }
    ],
    [
      { text: '🎁 Cortesía Cliente', callback_data: 'csm_resp_Cortesía' },
      { text: '⚠️ Merma / Cocina', callback_data: 'csm_resp_MermaCocina' }
    ],
    [
      { text: '❌ Cancelar', callback_data: 'sub_consumos' },
      { text: '🏠 Menú Principal', callback_data: 'menu_principal' }
    ]
  ];

  return { texto, markup: { inline_keyboard: buttons } };
}

export async function setResponsableConsumo(
  chatId: number,
  responsable: string
): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const { data: row } = await supabase
    .from('telegram_borradores_ingesta')
    .select('items')
    .eq('chat_id', chatId)
    .maybeSingle();

  const state: ConsumoDraftState = row?.items;
  if (!state) {
    return {
      texto: '⚠️ Sesión de consumo expirada.',
      markup: getMenuPrincipalKeyboard()
    };
  }

  state.responsable = responsable;
  state.paso = 'CONFIRMACION';

  await supabase.from('telegram_borradores_ingesta').update({ items: state, updated_at: new Date().toISOString() }).eq('chat_id', chatId);

  const texto = `📋 *Resumen de Consumo Listo para Guardar*

📅 *Fecha Hoja Costeo:* \`${state.fecha}\`
📂 *Categoría:* ${state.categoria}
🍽️ *Producto / Insumo:* *${state.nombreItem}*
🔢 *Cantidad:* ${state.cantidad} ${state.unidad}
💵 *Valor Unitario:* ${formatCOP(state.precioUnitario || 0)} COP
💰 *Total Consumo:* *${formatCOP(state.total || 0)} COP*
👤 *Responsable / Motivo:* ${state.responsable}

¿Deseas confirmar e ingresar este consumo en el sistema?`;

  const buttons: InlineKeyboardButton[][] = [
    [{ text: '✅ Confirmar y Guardar en Cocina', callback_data: 'csm_guardar_definitivo' }],
    [{ text: '❌ Cancelar', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
  ];

  return { texto, markup: { inline_keyboard: buttons } };
}

export async function guardarConsumoDefinitivo(chatId: number): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const { data: row } = await supabase
    .from('telegram_borradores_ingesta')
    .select('items')
    .eq('chat_id', chatId)
    .maybeSingle();

  const state: ConsumoDraftState = row?.items;
  if (!state || !state.fecha || !state.nombreItem) {
    return {
      texto: '⚠️ No hay ningún consumo pendiente por guardar.',
      markup: getMenuPrincipalKeyboard()
    };
  }

  // Insertar en registros_costeo_cocina
  const payload = {
    fecha: state.fecha,
    tipo: 'CONSUMO',
    insumo_id: typeof state.itemId === 'string' ? null : state.itemId,
    nombre_insumo: state.nombreItem,
    categoria: state.categoria,
    cantidad: state.cantidad,
    unidad: state.unidad,
    costo_unitario: state.precioUnitario,
    valor_total: state.total,
    observaciones: `Consumo registrado vía Telegram (@Finca_Eliana_bot) - Motivo: ${state.responsable}`
  };

  const { error } = await supabase.from('registros_costeo_cocina').insert([payload]);
  if (error) {
    return {
      texto: `❌ *Error al guardar el consumo:* ${error.message}`,
      markup: getSubmenuConsumosKeyboard()
    };
  }

  // Sincronizar resumen en costeo_diario
  try {
    await supabase.rpc('rpc_sync_costeo_diario', { p_fecha: state.fecha });
  } catch (rpcErr) {
    console.error('Error invocando rpc_sync_costeo_diario:', rpcErr);
  }

  // Limpiar borrador
  await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);

  const texto = `🎉 *¡Consumo Guardado Exitosamente!*

📅 *Fecha:* \`${state.fecha}\`
🍽️ *Ítem:* *${state.nombreItem}*
🔢 *Cantidad:* ${state.cantidad} ${state.unidad}
💰 *Total Registrado:* *${formatCOP(state.total || 0)} COP*
👤 *Motivo:* ${state.responsable}

Los datos ya se encuentran reflejados en la Hoja de Costeo Diario y en el cálculo del Consumo Real del restaurante.`;

  const buttons: InlineKeyboardButton[][] = [
    [{ text: '🔎 Consultar Consumos del Día', callback_data: 'csm_consultar' }],
    [{ text: '➕ Ingresar Otro Consumo', callback_data: 'sub_consumos' }],
    [{ text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
  ];

  return { texto, markup: { inline_keyboard: buttons } };
}
