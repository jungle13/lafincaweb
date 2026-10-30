import { supabase } from '@/lib/supabase';
import {
  extraerItemsTexto,
  validarBorradorInsumos,
  aplicarBorradorEnCocina,
  BorradorIngesta,
} from './validadorInsumosService';
import { parsearFiltroFecha } from './telegramBotService';

export async function procesarFlujoBorradorTelegram(
  chatId: number,
  texto: string,
  senderName: string
): Promise<{ interceptado: boolean; respuesta?: string }> {
  const tNorm = texto.trim().toLowerCase();

  // 1. Verificar si hay un borrador activo para este chat
  const { data: borradorRow } = await supabase
    .from('telegram_borradores_ingesta')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle();

  // Caso: Cancelar borrador
  if (borradorRow && (tNorm === 'cancelar' || tNorm === 'borrar borrador' || tNorm === 'descartar')) {
    await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);
    return {
      interceptado: true,
      respuesta: '🗑️ *Borrador cancelado y descartado.* Ningún dato fue guardado en el sistema.',
    };
  }

  // Caso: Confirmar guardado
  if (borradorRow && (tNorm === 'confirmar' || tNorm === 'si' || tNorm === 'sí' || tNorm === 'guardar')) {
    const borrador: BorradorIngesta = borradorRow.items;

    // Si faltan datos clave (fecha)
    if (!borradorRow.fecha) {
      return {
        interceptado: true,
        respuesta: '⚠️ *No se puede guardar aún:* Falta especificar la fecha. Responde por ejemplo: *"es del 29 de octubre"*.',
      };
    }

    if (borrador.total_pendientes > 0) {
      return {
        interceptado: true,
        respuesta: `⚠️ *Aún no se puede guardar:* Tienes ${borrador.total_pendientes} ítem(s) no reconocidos o dudosos.\n\nPor favor corrige los ítems pendientes (ejemplo: *"el 2 es Filete de pollo"*) o escribe *"cancelar"* si deseas descartar.`,
      };
    }

    if (!borrador.hoja_costeo_existe && borrador.area === 'COCINA') {
      return {
        interceptado: true,
        respuesta: `⛔ *Hoja de costeo inexistente:*\n${borrador.bloqueos.join('\n')}`,
      };
    }

    // Aplicar a Cocina
    try {
      const res = await aplicarBorradorEnCocina(borrador);
      await supabase.from('telegram_borradores_ingesta').delete().eq('chat_id', chatId);

      return {
        interceptado: true,
        respuesta: `🎉 *¡${borrador.tipo} de ${borrador.area} Guardado con Éxito!*

📅 *Fecha:* ${res.fecha}
📋 *Ítems Registrados:* ${res.itemsGuardados} insumos
💰 *Valor Total Calculado:* $${res.valorTotal.toLocaleString('es-CO')} COP
🔄 *Modo:* ${borrador.modo_operacion}

Los datos ya están actualizados en el módulo de Costeo Diario Cocina y listos para auditoría.`,
      };
    } catch (e: any) {
      return {
        interceptado: true,
        respuesta: `❌ Error guardando en base de datos: ${e.message}`,
      };
    }
  }

  // Caso: Corrección de un ítem ("el 2 es Filete de pollo", "cambiar 2 por Filete")
  if (borradorRow) {
    const matchCorr = texto.match(/(?:el|ítem|item|cambiar)?\s*(\d{1,2})\s*(?:es|era|por|a)?\s+(.+)/i);
    if (matchCorr) {
      const idx = parseInt(matchCorr[1], 10);
      const nuevoTexto = matchCorr[2].trim();

      const borrador: BorradorIngesta = borradorRow.items;
      const targetItem = borrador.items.find((it) => it.index === idx);

      if (targetItem) {
        // Re-extraer cantidad si viene en el texto nuevo
        const reExt = extraerItemsTexto(nuevoTexto);
        const cant = reExt[0]?.cantidad || targetItem.cantidad;
        const und = reExt[0]?.unidad !== 'und' ? reExt[0]?.unidad : targetItem.unidad;
        const nombreLimpio = reExt[0]?.nombreRaw || nuevoTexto;

        // Reconstruir lista de items para revalidar
        const rawItems = borrador.items.map((it) => ({
          textoOriginal: it.index === idx ? `${nombreLimpio} ${cant} ${und}` : it.texto_original,
          nombreRaw: it.index === idx ? nombreLimpio : (it.estado === 'VALIDO' ? (it.nombre_catalogo || it.texto_original) : it.texto_original),
          cantidad: it.index === idx ? cant : it.cantidad,
          unidad: it.index === idx ? und : it.unidad,
        }));

        const nuevoBorrador = await validarBorradorInsumos(
          rawItems,
          borradorRow.fecha,
          borrador.area,
          borrador.tipo,
          borrador.modo_operacion
        );

        // Actualizar borrador en BD
        await supabase.from('telegram_borradores_ingesta').update({
          items: nuevoBorrador,
          estado: nuevoBorrador.total_pendientes === 0 ? 'PENDIENTE_CONFIRMACION' : 'PENDIENTE_DATOS',
          updated_at: new Date().toISOString(),
        }).eq('chat_id', chatId);

        return {
          interceptado: true,
          respuesta: formatearRespuestaBorrador(nuevoBorrador),
        };
      }
    }

    // Caso: Indicar o cambiar la fecha en el borrador existente
    const { fechaExacta } = parsearFiltroFecha(texto);
    if (fechaExacta) {
      const borrador: BorradorIngesta = borradorRow.items;
      const rawItems = borrador.items.map((it) => ({
        textoOriginal: it.texto_original,
        nombreRaw: it.estado === 'VALIDO' ? (it.nombre_catalogo || it.texto_original) : it.texto_original,
        cantidad: it.cantidad,
        unidad: it.unidad,
      }));

      const nuevoBorrador = await validarBorradorInsumos(
        rawItems,
        fechaExacta,
        borrador.area,
        borrador.tipo,
        borrador.modo_operacion
      );

      await supabase.from('telegram_borradores_ingesta').update({
        fecha: fechaExacta,
        items: nuevoBorrador,
        estado: nuevoBorrador.total_pendientes === 0 ? 'PENDIENTE_CONFIRMACION' : 'PENDIENTE_DATOS',
        updated_at: new Date().toISOString(),
      }).eq('chat_id', chatId);

      return {
        interceptado: true,
        respuesta: formatearRespuestaBorrador(nuevoBorrador),
      };
    }
  }

  // 2. Detectar si el texto entrante contiene una lista de insumos
  const itemsDetectados = extraerItemsTexto(texto);
  if (itemsDetectados.length >= 2) {
    let tipo: 'APERTURA' | 'TRASLADO' | 'DEVOLUCION' | 'CIERRE' = 'CIERRE';
    if (tNorm.includes('apertura')) tipo = 'APERTURA';
    else if (tNorm.includes('traslado') || tNorm.includes('movimiento')) tipo = 'TRASLADO';
    else if (tNorm.includes('devoluci')) tipo = 'DEVOLUCION';

    const modo = tipo === 'TRASLADO' ? 'SUMAR' : 'REEMPLAZAR';
    const area = tNorm.includes('bodega') ? 'BODEGA' : 'COCINA';

    const { fechaExacta } = parsearFiltroFecha(texto);

    const borrador = await validarBorradorInsumos(itemsDetectados, fechaExacta, area, tipo, modo);

    // Guardar o actualizar en BD
    await supabase.from('telegram_borradores_ingesta').upsert(
      {
        chat_id: chatId,
        fecha: fechaExacta || null,
        area,
        tipo,
        modo_operacion: modo,
        items: borrador,
        estado: borrador.total_pendientes === 0 ? 'PENDIENTE_CONFIRMACION' : 'PENDIENTE_DATOS',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chat_id' }
    );

    return {
      interceptado: true,
      respuesta: formatearRespuestaBorrador(borrador),
    };
  }

  return { interceptado: false };
}

function formatearRespuestaBorrador(b: BorradorIngesta): string {
  let msg = `📋 *Borrador de ${b.tipo} de ${b.area}*\n`;
  if (b.fecha) {
    msg += `📅 *Fecha:* ${b.fecha}\n`;
    msg += `🔄 *Modo:* ${b.modo_operacion === 'REEMPLAZAR' ? 'Reemplazar conteo anterior' : 'Sumar a lo existente'}\n\n`;
  } else {
    msg += `⚠️ *Fecha pendiente:* Por favor indícame la fecha (ej: *"es del 29 de octubre"*).\n\n`;
  }

  if (b.bloqueos && b.bloqueos.length > 0) {
    msg += `${b.bloqueos.join('\n')}\n\n`;
  }

  msg += `*Ítems procesados (${b.total_validos}/${b.total_items} válidos):*\n`;

  for (const it of b.items) {
    if (it.estado === 'VALIDO') {
      msg += `✅ *${it.index}.* ${it.nombre_catalogo}: ${it.cantidad} ${it.unidad} ($${it.valor_total.toLocaleString('es-CO')})\n`;
    } else if (it.estado === 'DUDOSO') {
      msg += `🟡 *${it.index}.* \`${it.texto_original}\` ➔ ¿Es *${it.nombre_catalogo}*? (Confirma o corrige)\n`;
    } else {
      msg += `❌ *${it.index}.* \`${it.texto_original}\` ➔ *[No reconocido en catálogo]*\n`;
      if (it.sugerencias && it.sugerencias.length > 0) {
        msg += `   _Sugerencias: ${it.sugerencias.join(', ')}_\n`;
      }
    }
  }

  msg += `\n💰 *Total Estimado:* $${b.valor_total_estimado.toLocaleString('es-CO')} COP\n`;

  if (b.total_pendientes > 0) {
    msg += `\n⚠️ *Tienes ${b.total_pendientes} ítem(s) por corregir.*`;
    msg += `\n👉 Para corregir uno, escribe por ejemplo: *"el 2 es Filete de pollo"* o *"el 4 es Baby Beef"*.`;
    msg += `\n👉 Para descartar todo, escribe *"cancelar"*.`;
  } else if (!b.fecha) {
    msg += `\n👉 Para continuar, indícame la fecha: *"es del 29 de octubre"*.`;
  } else if (!b.hoja_costeo_existe && b.area === 'COCINA') {
    msg += `\n⛔ *Debes crear la hoja de costeo del ${b.fecha} en el sistema web antes de poder guardarlo.*`;
  } else {
    msg += `\n✨ *¡Todos los ítems están validados y listos para ingresar!*`;
    msg += `\n👉 Escribe *CONFIRMAR* o *SI* para guardar definitivamente en la base de datos.`;
    msg += `\n👉 O escribe *"cancelar"* para anular.`;
  }

  return msg;
}
