import { supabase } from '@/lib/supabase';
import {
  consultarVentas,
  consultarCosteoDiario,
  consultarMovimientosCocina,
  consultarLibroCaja,
  consultarCompras,
  consultarInsumosPrecios,
} from './telegramBotService';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lafincaweb.vercel.app';

// ============================================================================
// 1. HELPERS DE ENVÍO CON BOTONES INTERACTIVOS (SIEMPRE MENSAJES NUEVOS)
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

const formatCOP = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

const MESES_NOMBRES: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
};

function formatMesNombre(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MESES_NOMBRES[m] || m} ${y}`;
}

function getRangoMes(ym: string): { inicio: string; fin: string } {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    inicio: `${ym}-01`,
    fin: `${ym}-${String(lastDay).padStart(2, '0')}`
  };
}

// ============================================================================
// 2. GENERADORES REUTILIZABLES DE SELECCIÓN MES Y DÍA
// ============================================================================

export async function generarSelectorMes(
  prefijoCallback: string,
  tituloModulo: string,
  tabla: string,
  volverCallback: string = 'menu_principal'
): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  // Obtener fechas únicas
  const { data } = await supabase
    .from(tabla)
    .select('fecha')
    .order('fecha', { ascending: false });

  const mesesSet = new Set<string>();
  (data || []).forEach(r => {
    if (r.fecha && r.fecha.length >= 7) {
      mesesSet.add(r.fecha.slice(0, 7));
    }
  });

  const meses = Array.from(mesesSet).sort().reverse();
  if (meses.length === 0) {
    // Si no hay en tabla, por defecto noviembre y octubre 2026
    meses.push('2026-11', '2026-10');
  }

  const buttons: InlineKeyboardButton[][] = meses.map(ym => [
    { text: `📅 ${formatMesNombre(ym)}`, callback_data: `${prefijoCallback}_mes_${ym}` }
  ]);

  buttons.push([
    { text: '🔙 Volver', callback_data: volverCallback },
    { text: '🏠 Menú Principal', callback_data: 'menu_principal' }
  ]);

  return {
    texto: `🗓️ *${tituloModulo}*\n\nSelecciona el *Mes* que deseas consultar:`,
    markup: { inline_keyboard: buttons }
  };
}

export async function generarSelectorDia(
  prefijoCallback: string,
  ym: string,
  tituloModulo: string,
  tabla: string,
  volverCallback: string
): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const rango = getRangoMes(ym);
  const { data, error } = await supabase
    .from(tabla)
    .select('fecha')
    .gte('fecha', rango.inicio)
    .lte('fecha', rango.fin)
    .order('fecha', { ascending: true });

  if (error) {
    console.error(`Error consultando fechas en ${tabla} para ${ym}:`, error);
  }

  const diasSet = new Set<string>();
  (data || []).forEach(r => {
    if (r.fecha) diasSet.add(r.fecha);
  });

  const fechas = Array.from(diasSet).sort();
  const buttons: InlineKeyboardButton[][] = [];

  // Agrupar fechas en filas de 3 botones
  let currentRow: InlineKeyboardButton[] = [];
  fechas.forEach((f, idx) => {
    const diaNum = f.split('-')[2];
    currentRow.push({
      text: `Día ${diaNum}`,
      callback_data: `${prefijoCallback}_dia_${f}`
    });
    if (currentRow.length === 3 || idx === fechas.length - 1) {
      buttons.push(currentRow);
      currentRow = [];
    }
  });

  if (buttons.length === 0) {
    buttons.push([{ text: `Sin registros en ${formatMesNombre(ym)}`, callback_data: volverCallback }]);
  }

  buttons.push([
    { text: '🔙 Cambiar Mes', callback_data: volverCallback },
    { text: '🏠 Menú Principal', callback_data: 'menu_principal' }
  ]);

  return {
    texto: `📅 *${tituloModulo} • ${formatMesNombre(ym)}*\n\nSelecciona el *Día* exacto que deseas consultar:`,
    markup: { inline_keyboard: buttons }
  };
}

// ============================================================================
// 3. TECLADOS INTERACTIVOS (MENÚ PRINCIPAL Y SUBMENÚS)
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
        { text: '💲 6. Precios Oficiales Insumos', callback_data: 'sub_precios' }
      ]
    ]
  };
}

export function getSubmenuVentasKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '📆 Consolidado de Ventas por Mes', callback_data: 'vta_ask_mes_consolidado' }],
      [{ text: '📅 Ventas Detalladas por Día', callback_data: 'vta_ask_mes_dia' }],
      [{ text: '⚡ Ventas de la Última Jornada', callback_data: 'vta_ultima' }],
      [{ text: '🏆 Top Platos Más Vendidos por Mes', callback_data: 'vta_ask_mes_top' }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

export function getSubmenuCosteoKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '📋 Liquidación del Día (Elegir Fecha)', callback_data: 'costeo_ask_mes_liq' }],
      [{ text: '🔄 Traslados Bodega a Cocina (Elegir Fecha)', callback_data: 'costeo_ask_mes_tras' }],
      [{ text: '⚖️ Cierres Cocina y Bodega (Elegir Fecha)', callback_data: 'costeo_ask_mes_cie' }],
      [{ text: '⚡ Liquidación Última Hoja Activa', callback_data: 'costeo_ultima' }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

export function getSubmenuConsumosKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🔎 Consultar Consumos por Fecha', callback_data: 'csm_ask_mes_con' }],
      [{ text: '⚡ Consumos del Día de Hoy', callback_data: 'csm_consultar_hoy' }],
      [{ text: '➕ Ingresar Consumo de Plato (Venta)', callback_data: 'csm_ingresar_plato' }],
      [{ text: '➕ Ingresar Consumo de Insumo / Carne', callback_data: 'csm_ingresar_insumo' }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

export function getSubmenuCajaKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '💵 Cuadre de Caja (Elegir Mes y Día)', callback_data: 'caja_ask_mes_cuadre' }],
      [{ text: '⚡ Cuadre de Caja (Último Día Activo)', callback_data: 'caja_cuadre_ultimo' }],
      [{ text: '🧾 Mostrar Salidas por Día (Detalle y Valor)', callback_data: 'caja_ask_mes_salidas' }],
      [{ text: '📊 Salidas por 3 Bloques (Elegir Mes)', callback_data: 'caja_ask_mes_bloques' }],
      [{ text: '👩‍💼 Salidas por Cajera (Elegir Mes)', callback_data: 'caja_ask_mes_cajeras' }],
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
      [{ text: '🌐 Ver Compras en el Aplicativo', url: `${APP_BASE_URL}/compras` }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

export function getSubmenuPreciosKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '🔍 Escribir Nombre de Insumo', callback_data: 'prc_buscar_texto' }],
      [
        { text: '🥩 Carnes y Proteínas', callback_data: 'prc_cat_Carnes' },
        { text: '🥬 Verduras y Frutas', callback_data: 'prc_cat_Verduras' }
      ],
      [
        { text: '🌾 Granos y Abarrotes', callback_data: 'prc_cat_Granos' },
        { text: '🧀 Lácteos y Huevos', callback_data: 'prc_cat_Lacteos' }
      ],
      [
        { text: '🥤 Bebidas', callback_data: 'prc_cat_Bebidas' },
        { text: '🥡 Desechables y Aseo', callback_data: 'prc_cat_Desechables' }
      ],
      [{ text: '🌐 Ver Catálogo Completo en Web', url: `${APP_BASE_URL}/catalogo` }],
      [{ text: '🏠 Volver al Menú Principal', callback_data: 'menu_principal' }]
    ]
  };
}

// ============================================================================
// 4. GENERADORES DE INFORMACIÓN DE VENTAS
// ============================================================================

export async function generarRespuestaVentasUltima(): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
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
        [{ text: '🌐 Ver en Aplicativo Web', url: `${APP_BASE_URL}/ventas` }],
        [{ text: '🔙 Volver a Ventas', callback_data: 'sub_ventas' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaVentasMes(ym: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const rango = getRangoMes(ym);
  const { data: rows, error } = await supabase
    .from('ventas_diarias')
    .select('fecha, dia_semana, total_articulos, venta_neta, impuesto_consumo, gran_total')
    .gte('fecha', rango.inicio)
    .lte('fecha', rango.fin)
    .order('fecha', { ascending: false });

  if (error || !rows || rows.length === 0) {
    return {
      texto: `⚠️ *No se encontraron ventas para ${formatMesNombre(ym)}.*`,
      markup: getSubmenuVentasKeyboard()
    };
  }

  const totalCobrado = rows.reduce((acc, r) => acc + Number(r.gran_total || 0), 0);
  const totalNeto = rows.reduce((acc, r) => acc + Number(r.venta_neta || 0), 0);
  const totalImpuesto = rows.reduce((acc, r) => acc + Number(r.impuesto_consumo || 0), 0);
  const totalArticulos = rows.reduce((acc, r) => acc + Number(r.total_articulos || 0), 0);

  let texto = `📆 *Consolidado de Ventas • ${formatMesNombre(ym)}*\n\n`;
  texto += `💰 *Gran Total Facturado:* *${formatCOP(totalCobrado)} COP*\n`;
  texto += `🏷️ *Venta Neta:* ${formatCOP(totalNeto)} COP\n`;
  texto += `🪙 *Impoconsumo (8%):* ${formatCOP(totalImpuesto)} COP\n`;
  texto += `📦 *Artículos Totales:* ${totalArticulos.toLocaleString('es-CO')} uds\n`;
  texto += `📅 *Jornadas con Venta:* ${rows.length} días registrados\n\n`;

  texto += `*Últimos días del mes:*\n`;
  rows.slice(0, 6).forEach(r => {
    texto += `• \`${r.fecha}\` (${r.dia_semana || ''}): ${formatCOP(r.gran_total)} COP (${r.total_articulos} uds)\n`;
  });

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Detalle Completo en Web', url: `${APP_BASE_URL}/ventas` }],
        [{ text: '🔙 Cambiar Mes', callback_data: 'vta_ask_mes_consolidado' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaVentasDia(fecha: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const { data: diaRow } = await supabase
    .from('ventas_diarias')
    .select('*')
    .eq('fecha', fecha)
    .maybeSingle();

  if (!diaRow) {
    return {
      texto: `⚠️ *No hay registro de ventas para el día ${fecha}.*`,
      markup: getSubmenuVentasKeyboard()
    };
  }

  // Top 5 platos de ese día
  const { data: topPlatos } = await supabase
    .from('ventas_detalle')
    .select('nombre_producto, cantidad, gran_total')
    .eq('fecha', fecha)
    .order('cantidad', { ascending: false })
    .limit(5);

  let texto = `📊 *Ventas del Día • ${fecha}* (${diaRow.dia_semana || ''})\n\n`;
  texto += `💰 *Gran Total:* *${formatCOP(diaRow.gran_total || 0)} COP*\n`;
  texto += `🏷️ *Venta Neta:* ${formatCOP(diaRow.venta_neta || 0)} COP\n`;
  texto += `🪙 *Impoconsumo (8%):* ${formatCOP(diaRow.impuesto_consumo || 0)} COP\n`;
  texto += `📦 *Artículos Servidos:* ${(diaRow.total_articulos || 0).toLocaleString('es-CO')} uds\n`;
  texto += `📋 *Platos Diferentes:* ${diaRow.total_platos_distintos || 0} ítems\n`;
  texto += `🎟️ *Ticket Promedio:* ${formatCOP(diaRow.ticket_promedio || 0)} COP\n\n`;

  if (topPlatos && topPlatos.length > 0) {
    texto += `*🏆 Top Platos Más Vendidos de este Día:*\n`;
    topPlatos.forEach((p, idx) => {
      texto += `${idx + 1}. *${p.nombre_producto}:* ${p.cantidad} uds (${formatCOP(p.gran_total || 0)})\n`;
    });
  }

  const ym = fecha.slice(0, 7);
  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Ventas en Aplicativo Web', url: `${APP_BASE_URL}/ventas` }],
        [{ text: '🔙 Elegir Otro Día', callback_data: `vta_dia_mes_${ym}` }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaVentasTop(ym: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const rango = getRangoMes(ym);
  const { data: ranking } = await supabase
    .from('ventas_detalle')
    .select('nombre_producto, cantidad, gran_total')
    .gte('fecha', rango.inicio)
    .lte('fecha', rango.fin)
    .order('cantidad', { ascending: false })
    .limit(300);

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

  let texto = `🏆 *Top 5 Platos Más Vendidos • ${formatMesNombre(ym)}*\n\n`;
  if (sorted.length === 0) {
    texto += `_No hay detalle de platos registrados para este mes._`;
  } else {
    sorted.forEach(([nombre, s], idx) => {
      texto += `*${idx + 1}. ${nombre}*\n   • ${s.cant} porciones vendidas\n   • ${formatCOP(s.total)} COP recaudados\n`;
    });
  }

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver en Aplicativo Web', url: `${APP_BASE_URL}/ventas` }],
        [{ text: '🔙 Cambiar Mes', callback_data: 'vta_ask_mes_top' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

// ============================================================================
// 5. GENERADORES DE COSTEO DIARIO Y COCINA (CON DEEP LINKS AL APLICATIVO)
// ============================================================================

export async function generarRespuestaLiquidacionDia(fecha: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const res = await consultarCosteoDiario(fecha);
  const hojas = res?.hojas || [];
  const h = hojas.find((x: any) => x.fecha === fecha) || hojas[0];

  if (!h) {
    return {
      texto: `⚠️ *No se encontró hoja de costeo para la fecha ${fecha}.*`,
      markup: getSubmenuCosteoKeyboard()
    };
  }

  const c = h.liquidacion_cocina_del_dia || {};
  const ym = fecha.slice(0, 7);

  const texto = `📋 *Liquidación Hoja de Costeo Diario*
📅 *Fecha:* \`${h.fecha}\` (${h.titulo || 'Cocina'})

*Liquidación Cocina:*
• Apertura (Amanece): ${formatCOP(c.costo_cocina_apertura_cop || 0)} COP
• + Traslados Bodega: +${formatCOP(c.costo_movimientos_a_cocina_cop || 0)} COP
• - Devoluciones Bodega: -${formatCOP(c.costo_devoluciones_a_bodega_cop || 0)} COP
• - Cierre Físico Cocina: -${formatCOP(c.costo_cocina_cierre_cop || 0)} COP
• + Consumos Internos: +${formatCOP(c.costo_consumos_cop || 0)} COP
━━━━━━━━━━━━━━━━━━━
🔥 *Consumo Real Total:* *${formatCOP(c.costo_consumo_real_total_cop || 0)} COP*
💵 *Ventas del Día (POS):* ${formatCOP(c.total_ventas_del_dia_pos_cop || 0)} COP
📈 *Rendimiento:* ${c.rendimiento_formato || '$0'}
🎯 *Food Cost:* *${c.food_cost_porcentaje || '0.0%'}*`;

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Detalle de Liquidación en Aplicativo', url: `${APP_BASE_URL}/costeo-diario?fecha=${fecha}&section=COCINA_APERTURA` }],
        [
          { text: '🔄 Ver Traslados', callback_data: `costeo_tras_dia_${fecha}` },
          { text: '⚖️ Ver Cierres', callback_data: `costeo_cie_dia_${fecha}` }
        ],
        [{ text: '🔙 Elegir Otro Día', callback_data: `costeo_liq_mes_${ym}` }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaTrasladosDia(fecha: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const movs = await consultarMovimientosCocina(fecha, 'TRASLADO');
  const items = movs?.items || [];
  const ym = fecha.slice(0, 7);

  let texto = `🔄 *Traslados Bodega a Cocina • ${fecha}*\n`;
  texto += `💰 *Total Trasladado:* *${formatCOP(movs?.total_dinero_cop || 0)} COP*\n`;
  texto += `📦 *Registros:* ${items.length} movimientos\n\n`;

  if (items.length === 0) {
    texto += `_No hay traslados cargados para este día._`;
  } else {
    texto += items.slice(0, 15).map((it: any) => `• *${it.insumo}:* ${it.cantidad} ${it.unidad} (${formatCOP(it.valor_total)})`).join('\n');
    if (items.length > 15) texto += `\n_...y ${items.length - 15} insumos más._`;
  }

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Traslados en Aplicativo Web', url: `${APP_BASE_URL}/costeo-diario?fecha=${fecha}&section=TRASLADOS` }],
        [{ text: '📋 Ver Liquidación del Día', callback_data: `costeo_liq_dia_${fecha}` }],
        [{ text: '🔙 Elegir Otro Día', callback_data: `costeo_tras_mes_${ym}` }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaCierresDia(fecha: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const res = await consultarCosteoDiario(fecha);
  const hojas = res?.hojas || [];
  const h = hojas.find((x: any) => x.fecha === fecha) || hojas[0];
  const c = h?.liquidacion_cocina_del_dia || {};
  const b = h?.liquidacion_bodega_del_dia || {};
  const ym = fecha.slice(0, 7);

  const texto = `⚖️ *Cierres de Inventario • ${fecha}*

*Cocina Cierre:*
• Valor en Cocina: ${formatCOP(c.costo_cocina_cierre_cop || 0)} COP

*Bodega Cierre:*
• Existencias Físicas: ${formatCOP(b.bodega_cierre_cop || 0)} COP
• Ítems contados: ${b.items_en_bodega_cierre || 0} insumos`;

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Cierres en Aplicativo Web', url: `${APP_BASE_URL}/costeo-diario?fecha=${fecha}&section=COCINA_CIERRE` }],
        [{ text: '📋 Ver Liquidación del Día', callback_data: `costeo_liq_dia_${fecha}` }],
        [{ text: '🔙 Elegir Otro Día', callback_data: `costeo_cie_mes_${ym}` }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

// ============================================================================
// 6. GENERADORES DE CONSUMOS (CONSULTA Y ASISTENTE INTELIGENTE)
// ============================================================================

export async function generarRespuestaConsumosConsulta(fechaParam?: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  let fechaTarget = fechaParam;
  if (!fechaTarget) {
    const { data: latest } = await supabase
      .from('costeo_diario')
      .select('fecha')
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();
    fechaTarget = latest?.fecha || new Date().toISOString().split('T')[0];
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
      texto += `• *${p.nombre_insumo}:* ${p.cantidad} ${p.unidad} ➔ ${formatCOP(p.valor_total)}${p.observaciones ? ` _(${p.observaciones})_` : ''}\n`;
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
        [{ text: '🌐 Ver Consumos en Aplicativo Web', url: `${APP_BASE_URL}/costeo-diario?fecha=${fechaTarget}&section=CONSUMOS` }],
        [{ text: '➕ Ingresar Consumo de Plato', callback_data: 'csm_ingresar_plato' }],
        [{ text: '➕ Ingresar Consumo de Insumo', callback_data: 'csm_ingresar_insumo' }],
        [{ text: '🔙 Volver a Consumos', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

// ============================================================================
// 7. MÁQUINA DE ESTADOS: ASISTENTE INTELIGENTE DE CONSUMOS (CON RECETAS)
// ============================================================================

export interface RecetaInsumoCalculado {
  insumoId: number | string | null;
  nombreInsumo: string;
  categoriaInsumo: string;
  cantidadUnitaria: number;
  cantidadTotal: number;
  unidad: string;
  costoUnitario: number;
  costoTotal: number;
}

export interface ConsumoDraftState {
  chatId: number;
  tipoConsumo: 'PLATO_VENTA' | 'INSUMO_CATALOGO';
  paso: 'FECHA' | 'ITEM' | 'RESPONSABLE' | 'CONFIRMACION';
  fecha?: string;
  itemId?: string | number;
  nombreItem?: string;
  categoria?: string;
  precioVentaUnitario?: number;
  precioUnitario?: number;
  cantidad?: number;
  unidad?: string;
  total?: number;
  responsable?: string;
  insumosReceta?: RecetaInsumoCalculado[];
}

export async function iniciarAsistenteConsumo(
  chatId: number,
  tipo: 'PLATO_VENTA' | 'INSUMO_CATALOGO'
): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const { data: hojas } = await supabase
    .from('costeo_diario')
    .select('fecha, titulo')
    .order('fecha', { ascending: false })
    .limit(4);

  const fechaButtons: InlineKeyboardButton[][] = (hojas || []).map(h => [
    { text: `📅 ${h.fecha} (${(h.titulo || '').replace(/.*-/, '').trim() || 'Hoja'})`, callback_data: `csm_set_fecha_${h.fecha}` }
  ]);

  fechaButtons.push([
    { text: '✏️ Fecha de Hoy', callback_data: `csm_set_fecha_${new Date().toISOString().split('T')[0]}` }
  ]);
  fechaButtons.push([
    { text: '❌ Cancelar', callback_data: 'sub_consumos' },
    { text: '🏠 Menú Principal', callback_data: 'menu_principal' }
  ]);

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
${esPlato ? '• "2 Bandejas Paisas"\n• "1 Limonada natural"\n• "Pechuga gratinada"' : '• "Costilla ahumada 1.5 kg"\n• "Chorizo 4 porc"\n• "Tomate 2 kg"'}`;

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '❌ Cancelar Consumo', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

// Búsqueda de insumos por ficha técnica en recetas_detalle
async function cargarInsumosDeReceta(platoId: string, cantidadPlatos: number): Promise<RecetaInsumoCalculado[]> {
  try {
    const { data: detalles, error } = await supabase
      .from('recetas_detalle')
      .select(`
        id,
        porciones_por_plato,
        cantidad_por_porcion_kg,
        catalogo_insumos (
          id,
          nombre,
          categoria,
          unidad_medida,
          costo_unitario_kg
        )
      `)
      .eq('plato_id', platoId);

    if (error || !detalles || detalles.length === 0) return [];

    return detalles.map((d: any) => {
      const insumo = d.catalogo_insumos;
      const costoUnitario = Number(insumo?.costo_unitario_kg || 0);
      const porciones = Number(d.porciones_por_plato || 1);
      const kgPorcion = Number(d.cantidad_por_porcion_kg || 0);
      const isUnidad = (insumo?.unidad_medida || '').toLowerCase().includes('und') ||
                       (insumo?.unidad_medida || '').toLowerCase().includes('unidad');

      const cantUnitaria = isUnidad ? porciones : Number((porciones * kgPorcion).toFixed(3));
      const cantTotal = Number((cantUnitaria * cantidadPlatos).toFixed(3));
      const costoTotal = Math.round(cantTotal * costoUnitario);

      return {
        insumoId: insumo?.id || null,
        nombreInsumo: insumo?.nombre || 'Insumo de Receta',
        categoriaInsumo: insumo?.categoria || 'Carnes y Proteínas',
        cantidadUnitaria: cantUnitaria,
        cantidadTotal: cantTotal,
        unidad: insumo?.unidad_medida || (isUnidad ? 'Und' : 'Kg'),
        costoUnitario,
        costoTotal
      };
    });
  } catch (err) {
    console.error('Error cargando insumos de receta:', err);
    return [];
  }
}

export async function configurarPlatoEnState(
  chatId: number,
  prod: any,
  cantidad: number,
  state: ConsumoDraftState
): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  state.itemId = prod.id;
  state.nombreItem = prod.nombre;
  state.categoria = 'Consumido de Productos para la Venta';
  state.precioVentaUnitario = Number(prod.precio_total || prod.precio_neto || 0);
  state.cantidad = cantidad;
  state.unidad = prod.unidad || 'ud';

  // Consultar ficha técnica / receta
  const insumos = await cargarInsumosDeReceta(prod.id, cantidad);
  state.insumosReceta = insumos;

  if (insumos.length > 0) {
    const costoTotalInsumos = insumos.reduce((acc, i) => acc + i.costoTotal, 0);
    state.precioUnitario = Math.round(costoTotalInsumos / cantidad);
    state.total = costoTotalInsumos;
  } else {
    state.precioUnitario = state.precioVentaUnitario;
    state.total = Math.round(cantidad * state.precioUnitario);
  }

  state.paso = 'RESPONSABLE';
  await supabase.from('telegram_borradores_ingesta').update({ items: state, updated_at: new Date().toISOString() }).eq('chat_id', chatId);

  return mostrarPasoResponsable(state);
}

export async function configurarInsumoEnState(
  chatId: number,
  ins: any,
  cantidad: number,
  state: ConsumoDraftState
): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  state.itemId = ins.id;
  state.nombreItem = ins.nombre;
  state.categoria = 'Consumido del Catálogo de Insumos y Carne';
  state.precioUnitario = Number(ins.costo_unitario_kg || 0);
  state.cantidad = cantidad;
  state.unidad = ins.unidad_medida || 'Kg';
  state.total = Math.round(cantidad * state.precioUnitario);
  state.insumosReceta = [];
  state.paso = 'RESPONSABLE';

  await supabase.from('telegram_borradores_ingesta').update({ items: state, updated_at: new Date().toISOString() }).eq('chat_id', chatId);

  return mostrarPasoResponsable(state);
}

export async function procesarTextoItemConsumo(
  chatId: number,
  textoUsuario: string,
  state: ConsumoDraftState
): Promise<{ texto: string; markup?: InlineKeyboardMarkup }> {
  const esPlato = state.tipoConsumo === 'PLATO_VENTA';

  // Extraer posible cantidad del texto
  let cantidadDetectada = 1;
  let queryName = textoUsuario.trim();

  const matchNum = textoUsuario.match(/^(?:(\d+(?:[.,]\d+)?)\s+)?(.*?)(?:\s+(\d+(?:[.,]\d+)?)\s*(?:und|ud|uds|kg|kls|porc|porciones|g|gr)?)?$/i);
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
    // Normalizar término (eliminar 'es' / 's' finales para buscar singular y plural)
    const sinPlural = queryName.replace(/es\b/gi, '').replace(/s\b/gi, '').trim();

    const { data: prods } = await supabase
      .from('productos_venta')
      .select('id, nombre, precio_total, precio_neto, unidad, categoria, subcategoria')
      .eq('activo', true)
      .or(`nombre.ilike.%${queryName}%,nombre.ilike.%${sinPlural}%,subcategoria.ilike.%${queryName}%`)
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
      return configurarPlatoEnState(chatId, prods[0], cantidadDetectada, state);
    }

    const buttons: InlineKeyboardButton[][] = prods.map(p => [
      { text: `${p.nombre} (${formatCOP(p.precio_total || p.precio_neto || 0)})`, callback_data: `csm_pick_p_${p.id}_${cantidadDetectada}` }
    ]);
    buttons.push([{ text: '❌ Cancelar', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]);

    return {
      texto: `🔍 Encontré varias opciones para *"${queryName}"*. Toca el plato exacto:`,
      markup: { inline_keyboard: buttons }
    };
  } else {
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
      return configurarInsumoEnState(chatId, ins[0], cantidadDetectada, state);
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
  let texto = `✅ *Ítem Seleccionado:* *${state.nombreItem}*\n`;
  texto += `📊 *Cantidad:* ${state.cantidad} ${state.unidad}\n`;

  if (state.insumosReceta && state.insumosReceta.length > 0) {
    texto += `\n🥩 *Insumos Identificados en Cocina (Ficha Técnica):*\n`;
    state.insumosReceta.forEach(ins => {
      texto += `• *${ins.nombreInsumo}:* ${ins.cantidadTotal} ${ins.unidad} (${formatCOP(ins.costoTotal)} COP)\n`;
    });
    texto += `💰 *Costo Total Insumos:* *${formatCOP(state.total || 0)} COP*\n\n`;
  } else {
    texto += `💰 *Valor Unitario:* ${formatCOP(state.precioUnitario || 0)} COP\n`;
    texto += `💵 *Subtotal:* *${formatCOP(state.total || 0)} COP*\n\n`;
  }

  texto += `*Paso 3:* Selecciona el responsable o motivo de este consumo (o escribe uno en el chat):`;

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

  return mostrarResumenConfirmacionConsumo(state);
}

export function mostrarResumenConfirmacionConsumo(state: ConsumoDraftState): { texto: string; markup: InlineKeyboardMarkup } {
  let texto = `📋 *Resumen de Consumo Listo para Guardar*\n\n`;
  texto += `📅 *Fecha Hoja Costeo:* \`${state.fecha}\`\n`;
  texto += `📂 *Categoría:* ${state.categoria}\n`;
  texto += `🍽️ *Producto / Insumo:* *${state.nombreItem}*\n`;
  texto += `🔢 *Cantidad:* ${state.cantidad} ${state.unidad}\n`;
  texto += `👤 *Responsable / Motivo:* ${state.responsable || 'Personal / Turno'}\n\n`;

  if (state.insumosReceta && state.insumosReceta.length > 0) {
    texto += `🥩 *Insumos de Receta a Costear en Cocina:*\n`;
    state.insumosReceta.forEach(ins => {
      texto += `• *${ins.nombreInsumo}:* ${ins.cantidadTotal} ${ins.unidad} (${formatCOP(ins.costoTotal)} COP)\n`;
    });
    texto += `💰 *Costo Total Consumo:* *${formatCOP(state.total || 0)} COP*\n\n`;
  } else {
    texto += `💵 *Valor Unitario:* ${formatCOP(state.precioUnitario || 0)} COP\n`;
    texto += `💰 *Total Consumo:* *${formatCOP(state.total || 0)} COP*\n\n`;
  }

  texto += `_Tip: Si te equivocaste en la cantidad, puedes escribir en el chat por ejemplo: "Fueron 2 unds" o "son 3"._\n\n`;
  texto += `¿Deseas confirmar e ingresar este consumo en el sistema?`;

  const buttons: InlineKeyboardButton[][] = [
    [{ text: '✅ Confirmar y Guardar en Cocina', callback_data: 'csm_guardar_definitivo' }],
    [{ text: '❌ Cancelar', callback_data: 'sub_consumos' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
  ];

  return { texto, markup: { inline_keyboard: buttons } };
}

// Función orquestadora que maneja mensajes de texto durante cualquier paso del asistente de consumos
export async function procesarMensajeEnAsistenteConsumo(
  chatId: number,
  texto: string,
  state: ConsumoDraftState
): Promise<{ texto: string; markup?: InlineKeyboardMarkup }> {
  const tNorm = texto.trim().toLowerCase();

  // 1. Cancelar
  if (tNorm === 'cancelar' || tNorm === 'descartar') {
    await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);
    return {
      texto: '🗑️ *Registro de consumo cancelado.*',
      markup: getSubmenuConsumosKeyboard()
    };
  }

  // 2. Si está en paso ITEM, procesar búsqueda de insumo/plato
  if (state.paso === 'ITEM') {
    return procesarTextoItemConsumo(chatId, texto, state);
  }

  // 3. Si está en paso RESPONSABLE o CONFIRMACION, verificar si el usuario está corrigiendo la cantidad
  // Ejemplos: "Fueron 2 unds", "fueron 3", "son 2", "cambia a 4", "2 unidades", "3"
  const matchQty = texto.match(/(?:fueron|eran|son|cambia(?:r)?\s*a|poner|ajustar\s*a)?\s*(\d+(?:[.,]\d+)?)\s*(?:und|uds|unidades|kg|kls|porc|porciones)?/i);
  if (matchQty && matchQty[1]) {
    const nuevaCant = parseFloat(matchQty[1].replace(',', '.'));
    if (!isNaN(nuevaCant) && nuevaCant > 0) {
      state.cantidad = nuevaCant;

      // Recalcular insumos de receta si aplica
      if (state.insumosReceta && state.insumosReceta.length > 0) {
        state.insumosReceta = state.insumosReceta.map(ins => {
          const nuevaCantTotal = Number((ins.cantidadUnitaria * nuevaCant).toFixed(3));
          const nuevoCostoTotal = Math.round(nuevaCantTotal * ins.costoUnitario);
          return {
            ...ins,
            cantidadTotal: nuevaCantTotal,
            costoTotal: nuevoCostoTotal
          };
        });
        const costoTotal = state.insumosReceta.reduce((acc, i) => acc + i.costoTotal, 0);
        state.total = costoTotal;
      } else {
        state.total = Math.round(nuevaCant * (state.precioUnitario || 0));
      }

      state.paso = 'CONFIRMACION';
      await supabase.from('telegram_borradores_ingesta').update({ items: state, updated_at: new Date().toISOString() }).eq('chat_id', chatId);

      const res = mostrarResumenConfirmacionConsumo(state);
      res.texto = `✏️ *Cantidad actualizada a ${nuevaCant} ${state.unidad || 'ud'}.*\n\n` + res.texto;
      return res;
    }
  }

  // 4. Si escribe "confirmar", "si", "guardar"
  if (tNorm === 'confirmar' || tNorm === 'si' || tNorm === 'sí' || tNorm === 'guardar') {
    return guardarConsumoDefinitivo(chatId);
  }

  // 5. Si está en paso RESPONSABLE y escribió un nombre/motivo sin números
  if (state.paso === 'RESPONSABLE') {
    return setResponsableConsumo(chatId, texto.trim());
  }

  // 6. Si ya está en CONFIRMACION y escribió otra cosa, recordar confirmar
  return mostrarResumenConfirmacionConsumo(state);
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

  const responsableFinal = state.responsable || 'Personal / Turno';
  let rowsToInsert: any[] = [];

  // Si tiene receta desglosada, guardar cada insumo en registros_costeo_cocina
  if (state.insumosReceta && state.insumosReceta.length > 0) {
    rowsToInsert = state.insumosReceta.map(ins => ({
      fecha: state.fecha,
      tipo: 'CONSUMO',
      insumo_id: ins.insumoId,
      nombre_insumo: ins.nombreInsumo,
      categoria: 'Consumido del Catálogo de Insumos y Carne',
      cantidad: ins.cantidadTotal,
      unidad: ins.unidad,
      costo_unitario: ins.costoUnitario,
      valor_total: ins.costoTotal,
      observaciones: `Consumo Plato: ${state.cantidad}x ${state.nombreItem} - Motivo: ${responsableFinal}`
    }));
  } else {
    rowsToInsert = [{
      fecha: state.fecha,
      tipo: 'CONSUMO',
      insumo_id: typeof state.itemId === 'string' ? null : state.itemId,
      nombre_insumo: state.nombreItem,
      categoria: state.categoria,
      cantidad: state.cantidad,
      unidad: state.unidad,
      costo_unitario: state.precioUnitario,
      valor_total: state.total,
      observaciones: `Consumo vía Telegram (@Finca_Eliana_bot) - Motivo: ${responsableFinal}`
    }];
  }

  const { error } = await supabase.from('registros_costeo_cocina').insert(rowsToInsert);
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

  let texto = `🎉 *¡Consumo Guardado Exitosamente en Cocina!*\n\n`;
  texto += `📅 *Fecha:* \`${state.fecha}\`\n`;
  texto += `🍽️ *Ítem:* *${state.nombreItem}*\n`;
  texto += `🔢 *Cantidad:* ${state.cantidad} ${state.unidad}\n`;
  texto += `💰 *Total Registrado:* *${formatCOP(state.total || 0)} COP*\n`;
  texto += `👤 *Motivo:* ${responsableFinal}\n\n`;

  if (state.insumosReceta && state.insumosReceta.length > 0) {
    texto += `🥩 *Insumos descontados de la ficha técnica (${state.insumosReceta.length}):*\n`;
    state.insumosReceta.forEach(i => {
      texto += `• ${i.nombreInsumo}: ${i.cantidadTotal} ${i.unidad} (${formatCOP(i.costoTotal)})\n`;
    });
    texto += `\n`;
  }

  texto += `Los datos ya se encuentran reflejados en la Hoja de Costeo Diario del aplicativo.`;

  const buttons: InlineKeyboardButton[][] = [
    [{ text: '🌐 Ver Consumos en Aplicativo Web', url: `${APP_BASE_URL}/costeo-diario?fecha=${state.fecha}&section=CONSUMOS` }],
    [{ text: '🔎 Consultar Consumos del Día', callback_data: `csm_con_dia_${state.fecha}` }],
    [{ text: '➕ Ingresar Otro Consumo', callback_data: 'sub_consumos' }],
    [{ text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
  ];

  return { texto, markup: { inline_keyboard: buttons } };
}

// ============================================================================
// 8. GENERADORES DE LIBRO DE CAJA MENOR (CUADRE, 3 BLOQUES Y SALIDAS POR DÍA)
// ============================================================================

export async function generarRespuestaCuadreCaja(fechaParam?: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const res = await consultarLibroCaja({ fecha: fechaParam, ver_resumen_diario: true });
  const cuadres = res?.cuadre_diario_oficial || [];

  if (cuadres.length === 0) {
    return {
      texto: `⚠️ *No hay registro de arqueo o cuadre de caja para ${fechaParam ? `el día ${fechaParam}` : 'días recientes'}.*`,
      markup: getSubmenuCajaKeyboard()
    };
  }

  const c = cuadres[0];
  const texto = `💵 *Cuadre y Arqueo Diario de Caja Menor*

📅 *Fecha:* \`${c.fecha}\` (Día ${c.dia_mes || ''})
👩‍💼 *Cajera Encargada:* ${c.cajeras_responsables || 'Cajera'}
💰 *Venta POS Total:* ${formatCOP(c.venta_pos_total_cop || 0)} COP
💵 *Efectivo POS:* ${formatCOP(c.venta_efectivo_pos_cop || 0)} COP
💳 *Datáfonos:* ${formatCOP(c.datafonos_tarjetas_cop || 0)} COP
🛑 *Total Salidas Pagadas:* -${formatCOP(c.total_salidas_caja_cop || 0)} COP
💵 *Efectivo Físico Cierre:* ${formatCOP(c.efectivo_fisico_cierre_cop || 0)} COP
━━━━━━━━━━━━━━━━━━━
🎯 *Estado Cuadre:* *${c.estado_cuadre || 'CUADRADO'}*`;

  const ym = c.fecha.slice(0, 7);
  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Día en Libro de Caja Web', url: `${APP_BASE_URL}/libros-apoyo?fecha=${c.fecha}` }],
        [{ text: '🧾 Ver Salidas de este Día', callback_data: `caja_salidas_dia_${c.fecha}` }],
        [{ text: '🔙 Elegir Otro Día', callback_data: `caja_cuadre_mes_${ym}` }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaSalidasCajaPorDia(fecha: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const { data: rows, error } = await supabase
    .from('libro_caja_registros')
    .select('fecha, dia_mes, clasificacion, categoria, concepto, descripcion_beneficiario, valor_pagado, responsable_caja')
    .eq('fecha', fecha)
    .order('orden_item', { ascending: true });

  if (error || !rows || rows.length === 0) {
    return {
      texto: `⚠️ *No se encontraron salidas registradas en caja menor para el día ${fecha}.*`,
      markup: getSubmenuCajaKeyboard()
    };
  }

  const total = rows.reduce((acc, r) => acc + Number(r.valor_pagado || 0), 0);
  const ym = fecha.slice(0, 7);

  let texto = `🧾 *Salidas de Caja Menor • ${fecha}*\n`;
  texto += `💰 *Total Egresos del Día:* *${formatCOP(total)} COP* (${rows.length} comprobantes)\n\n`;

  rows.forEach((r, idx) => {
    const desc = r.concepto || r.descripcion_beneficiario || 'Gasto registrado';
    const cat = r.categoria || r.clasificacion || '';
    texto += `${idx + 1}. *${desc}*\n   • ${cat} ➔ *${formatCOP(r.valor_pagado || 0)} COP*${r.responsable_caja ? ` _(${r.responsable_caja})_` : ''}\n`;
  });

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver en Libro de Caja Web', url: `${APP_BASE_URL}/libros-apoyo?fecha=${fecha}` }],
        [{ text: '💵 Ver Cuadre de este Día', callback_data: `caja_cuadre_dia_${fecha}` }],
        [{ text: '🔙 Elegir Otro Día', callback_data: `caja_salidas_mes_${ym}` }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaCajaBloques(ym: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const res = await consultarLibroCaja({ fecha: ym });
  const b: any = res?.desglose_3_bloques || {};
  const total = res?.total_salidas_cop || 0;

  const texto = `📊 *Salidas de Caja Menor por 3 Bloques • ${formatMesNombre(ym)}*

1️⃣ *Insumos por Caja:* ${formatCOP(b.costos_materia_prima_cop || 0)} COP
2️⃣ *Gastos Operativos:* ${formatCOP(b.gastos_operativos_cop || 0)} COP
3️⃣ *Turnos y Nómina:* ${formatCOP(b.pago_turnos_nomina_cop || 0)} COP
━━━━━━━━━━━━━━━━━━━
💰 *Total Egresos Mes:* *${formatCOP(total)} COP* (${res?.total_registros_coincidentes || 0} comprobantes)`;

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Libro de Caja en Web', url: `${APP_BASE_URL}/libros-apoyo` }],
        [{ text: '👩‍💼 Ver por Cajera', callback_data: `caja_cajeras_mes_${ym}` }],
        [{ text: '🔙 Cambiar Mes', callback_data: 'caja_ask_mes_bloques' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function generarRespuestaCajaCajeras(ym: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const res = await consultarLibroCaja({ fecha: ym });
  const cajeras = res?.top_cajeras || [];

  let texto = `👩‍💼 *Salidas Registradas por Cajera • ${formatMesNombre(ym)}*\n\n`;
  if (cajeras.length === 0) {
    texto += `_No hay salidas registradas en este mes._`;
  } else {
    cajeras.forEach((c: any) => {
      texto += `• *${c.cajera}:* ${formatCOP(c.total_cop)} COP (${c.registros} salidas)\n`;
    });
  }

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Libro de Caja en Web', url: `${APP_BASE_URL}/libros-apoyo` }],
        [{ text: '📊 Ver 3 Bloques', callback_data: `caja_bloques_mes_${ym}` }],
        [{ text: '🔙 Cambiar Mes', callback_data: 'caja_ask_mes_cajeras' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

// ============================================================================
// 9. GENERADORES DE COMPRAS
// ============================================================================

export async function generarRespuestaCompras(tipo: 'ultimas' | 'carnes' | 'verduras'): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  if (tipo === 'ultimas') {
    const { data: facturas } = await supabase
      .from('compras')
      .select('fecha, numero_factura, proveedor, categoria, valor_total, total_items')
      .order('fecha', { ascending: false })
      .limit(6);

    let texto = `🧾 *Últimas Facturas de Proveedores Registradas*\n\n`;
    (facturas || []).forEach(f => {
      texto += `• \`${f.fecha}\` • *${f.proveedor}*\n   Factura: \`${f.numero_factura}\` ➔ *${formatCOP(f.valor_total || 0)} COP* (${f.total_items} ítems)\n`;
    });

    return {
      texto,
      markup: {
        inline_keyboard: [
          [{ text: '🌐 Ver Compras en Web', url: `${APP_BASE_URL}/compras` }],
          [{ text: '🥩 Compras Carnes', callback_data: 'cmp_carnes' }, { text: '🥬 Compras Verduras', callback_data: 'cmp_verduras' }],
          [{ text: '🔙 Volver a Compras', callback_data: 'sub_compras' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
        ]
      }
    };
  }

  const catParam = tipo === 'carnes' ? 'Carnes y Proteínas' : 'Verduras e Insumos';
  const res = await consultarCompras({ categoria: catParam });
  const items = res?.compras_recientes || [];

  let texto = `🛒 *Compras Recientes: ${catParam}*\n\n`;
  texto += `💰 *Total Dinero en Categoría:* *${formatCOP(res?.total_dinero_cop || 0)} COP*\n\n`;

  items.slice(0, 8).forEach((i: any) => {
    texto += `• \`${i.fecha}\` *${i.insumo}:* ${i.cantidad} ${i.unidad} ➔ ${formatCOP(i.total)} (${i.proveedor})\n`;
  });

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Compras en Web', url: `${APP_BASE_URL}/compras` }],
        [{ text: '🧾 Últimas Facturas', callback_data: 'cmp_ultimas' }],
        [{ text: '🔙 Volver a Compras', callback_data: 'sub_compras' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

// ============================================================================
// 10. GENERADORES DE PRECIOS OFICIALES (POR CATEGORÍA O BÚSQUEDA DE TEXTO)
// ============================================================================

export async function generarRespuestaPreciosPorCategoria(catCode: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  const catMap: Record<string, string> = {
    'Carnes': 'Carnes y Proteínas',
    'Verduras': 'Verduras e Insumos',
    'Granos': 'Granos y Abarrotes',
    'Lacteos': 'Lácteos y Huevos',
    'Bebidas': 'Bebidas',
    'Desechables': 'Desechables y Empaques'
  };

  const catName = catMap[catCode] || catCode;

  const { data: insumos } = await supabase
    .from('catalogo_insumos')
    .select('nombre, categoria, costo_unitario_kg, unidad_medida, peso_estandar_porcion_kg')
    .eq('activo', true)
    .ilike('categoria', `%${catCode}%`)
    .order('nombre', { ascending: true });

  let texto = `💲 *Precios Oficiales • ${catName}*\n\n`;
  if (!insumos || insumos.length === 0) {
    texto += `_No se encontraron insumos activos en esta categoría._`;
  } else {
    insumos.forEach(i => {
      const precio = formatCOP(Number(i.costo_unitario_kg || 0));
      const und = i.unidad_medida || 'Kg';
      let extraPorcion = '';
      if (i.peso_estandar_porcion_kg && Number(i.peso_estandar_porcion_kg) > 0) {
        const costoPorc = Math.round(Number(i.costo_unitario_kg || 0) * Number(i.peso_estandar_porcion_kg));
        extraPorcion = ` (Porción: ${formatCOP(costoPorc)})`;
      }
      texto += `• *${i.nombre}:* ${precio} / ${und}${extraPorcion}\n`;
    });
  }

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🌐 Ver Catálogo Completo en Web', url: `${APP_BASE_URL}/catalogo` }],
        [{ text: '🔍 Buscar Otro Insumo', callback_data: 'prc_buscar_texto' }],
        [{ text: '🔙 Volver a Categorías', callback_data: 'sub_precios' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function iniciarBusquedaPrecioInsumo(chatId: number): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  // Guardar estado en telegram_borradores_ingesta
  await supabase.from('telegram_borradores_ingesta').upsert(
    {
      chat_id: chatId,
      area: 'COCINA',
      tipo: 'PRECIOS',
      modo_operacion: 'CONSULTAR',
      items: {},
      estado: 'BUSCAR_PRECIO_INSUMO',
      updated_at: new Date().toISOString()
    },
    { onConflict: 'chat_id' }
  );

  const texto = `🔍 *Consulta de Precios Oficiales*

Por favor escribe en el chat el nombre del insumo o producto que deseas consultar (ejemplo: *"Punta de anca"*, *"Aceite"*, *"Tomate"*, *"Bandeja"*):`;

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '❌ Cancelar Búsqueda', callback_data: 'sub_precios' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}

export async function buscarPrecioInsumoPorTexto(chatId: number, query: string): Promise<{ texto: string; markup: InlineKeyboardMarkup }> {
  // Limpiar estado
  await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);

  const q = query.trim();

  // 1. Buscar en catalogo_insumos
  const { data: insumos } = await supabase
    .from('catalogo_insumos')
    .select('nombre, categoria, costo_unitario_kg, unidad_medida, peso_estandar_porcion_kg')
    .eq('activo', true)
    .ilike('nombre', `%${q}%`)
    .limit(8);

  // 2. Buscar en productos_venta
  const { data: platos } = await supabase
    .from('productos_venta')
    .select('nombre, categoria, precio_total, precio_neto, unidad')
    .eq('activo', true)
    .ilike('nombre', `%${q}%`)
    .limit(6);

  let texto = `🔍 *Resultados de Precios para: "${q}"*\n\n`;

  let totalEncontrados = (insumos?.length || 0) + (platos?.length || 0);
  if (totalEncontrados === 0) {
    texto += `❌ _No se encontraron insumos ni platos que coincidan con ese nombre._\n\nPuedes consultar el catálogo completo en la web o elegir una categoría:`;
  } else {
    if (insumos && insumos.length > 0) {
      texto += `🥩 *Insumos del Catálogo:*\n`;
      insumos.forEach(i => {
        const precio = formatCOP(Number(i.costo_unitario_kg || 0));
        const und = i.unidad_medida || 'Kg';
        let extra = '';
        if (i.peso_estandar_porcion_kg && Number(i.peso_estandar_porcion_kg) > 0) {
          const porc = Math.round(Number(i.costo_unitario_kg || 0) * Number(i.peso_estandar_porcion_kg));
          extra = ` (Porción: ${formatCOP(porc)})`;
        }
        texto += `• *${i.nombre}:* ${precio} / ${und}${extra} _(${i.categoria || 'Insumo'})_\n`;
      });
      texto += `\n`;
    }

    if (platos && platos.length > 0) {
      texto += `🍽️ *Platos de la Carta (Venta POS):*\n`;
      platos.forEach(p => {
        const precio = formatCOP(Number(p.precio_total || p.precio_neto || 0));
        texto += `• *${p.nombre}:* ${precio} COP (${p.unidad || 'ud'})\n`;
      });
    }
  }

  return {
    texto,
    markup: {
      inline_keyboard: [
        [{ text: '🔍 Buscar Otro Insumo', callback_data: 'prc_buscar_texto' }],
        [{ text: '🔙 Categorías de Precios', callback_data: 'sub_precios' }, { text: '🏠 Menú Principal', callback_data: 'menu_principal' }]
      ]
    }
  };
}
