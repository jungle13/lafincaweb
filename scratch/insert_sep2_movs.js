const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient('https://uexqmrspulhauubzrwyn.supabase.co', 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO');

async function insertSept2Movements() {
  const targetDate = '2026-09-02';
  
  // 1. Obtener catálogo
  const { data: catalogo, error: catErr } = await supabase.from('catalogo_insumos').select('*');
  if (catErr || !catalogo) {
    console.error('Error cargando catalogo:', catErr);
    return;
  }
  const catMap = new Map();
  catalogo.forEach(c => catMap.set(c.nombre.toLowerCase().trim(), c));

  // Definición de las filas del reporte de WhatsApp 2026-09-02
  const filasPlanilla = [
    // 1. Morrillo -> Salida a cocina 60 porciones
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Morrillo',
      tipoEntrega: 'PORCIONADO',
      cantidad: 60,
      pesoKg: 15.0, // 60 * 0.25
      obs: 'Salida a cocina 60 porciones (Planilla 02-Sep)'
    },
    // 2. Cordobue -> Salida a cocina 40 porciones (Costilla Especial)
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Costilla Especial',
      tipoEntrega: 'PORCIONADO',
      cantidad: 40,
      pesoKg: 11.44, // 40 * 0.286
      obs: 'Salida a cocina 40 porciones - Cordobue (Planilla 02-Sep)'
    },
    // 3. Francesa -> Salida a cocina 1 und
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Papas a la francesa',
      tipoEntrega: 'ENTERO',
      cantidad: 1.0,
      pesoKg: 1.0,
      obs: 'Salida a cocina 1 und Francesa (Planilla 02-Sep)'
    },
    // 4. Mix Verdura -> Salida a cocina 1 und
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Papas a la francesa', // Insumo acompañamiento
      tipoEntrega: 'ENTERO',
      cantidad: 1.0,
      pesoKg: 1.0,
      obs: 'Salida a cocina 1 und Mix Verdura (Planilla 02-Sep)'
    },
    // 5. Ahumada -> Salida a cocina 4.0 Kg
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Costilla ahumada',
      tipoEntrega: 'ENTERO',
      cantidad: 4.0,
      pesoKg: 4.0,
      obs: 'Salida a cocina 4.0 Kg Ahumada (Planilla 02-Sep)'
    },
    // 6. Lomo Cerdo -> Salida a cocina 10 porciones
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Lomo de cerdo',
      tipoEntrega: 'PORCIONADO',
      cantidad: 10,
      pesoKg: 2.22, // 10 * 0.222
      obs: 'Salida a cocina 10 porciones Lomo Cerdo (Planilla 02-Sep)'
    },
    // 7. San Luis -> Salida a cocina 10 porciones
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Costilla san luis',
      tipoEntrega: 'PORCIONADO',
      cantidad: 10,
      pesoKg: 5.0, // 10 * 0.5
      obs: 'Salida a cocina 10 porciones Costilla San Luis (Planilla 02-Sep)'
    },
    // 8. Sobaco -> Salida a cocina 11.4 Kg
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Sobaco',
      tipoEntrega: 'ENTERO',
      cantidad: 11.4,
      pesoKg: 11.4,
      obs: 'Salida a cocina 11.4 Kg Sobaco (Planilla 02-Sep)'
    },
    // 9. Higado -> Entrada 5.0 Kg, Salida cocina 5.0 Kg, Devolución 48 porciones
    {
      tipo: 'ENTRADA_COMPRA',
      carne: 'Higado',
      cantidadKg: 5.0,
      costoTotal: 107500,
      proveedor: 'Proveedor Local',
      factura: 'Planilla 02-Sep',
      obs: 'Entrada del día 5.0 Kg Higado (Planilla 02-Sep)'
    },
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Higado',
      tipoEntrega: 'ENTERO',
      cantidad: 5.0,
      pesoKg: 5.0,
      obs: 'Salida a cocina 5.0 Kg Higado (Planilla 02-Sep)'
    },
    {
      tipo: 'DEVOLUCION_COCINA',
      carne: 'Higado',
      tipoDevolucion: 'PORCIONADO',
      cantidad: 48,
      pesoKg: 15.98,
      obs: 'Devolución de cocina 48 porciones Higado (Planilla 02-Sep)'
    },
    // 10. Tocino -> Salida cocina 19.0 Kg
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Tocino',
      tipoEntrega: 'ENTERO',
      cantidad: 19.0,
      pesoKg: 19.0,
      obs: 'Salida a cocina 19.0 Kg Tocino (Planilla 02-Sep)'
    },
    // 11. Tocino -> Salida cocina 15.0 Kg, Devolución 37 porciones
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Tocino',
      tipoEntrega: 'ENTERO',
      cantidad: 15.0,
      pesoKg: 15.0,
      obs: 'Salida a cocina 15.0 Kg Tocino (Planilla 02-Sep)'
    },
    {
      tipo: 'DEVOLUCION_COCINA',
      carne: 'Tocino',
      tipoDevolucion: 'PORCIONADO',
      cantidad: 37,
      pesoKg: 14.58,
      obs: 'Devolución de cocina 37 porciones Tocino (Planilla 02-Sep)'
    },
    // 12. Pernil Cerdo -> Entrada 34.7 Kg, Salida cocina 34.7 Kg, Devolución 120 porciones
    {
      tipo: 'ENTRADA_COMPRA',
      carne: 'Pernil de cerdo',
      cantidadKg: 34.7,
      costoTotal: 347000,
      proveedor: 'Proveedor Local',
      factura: 'Planilla 02-Sep',
      obs: 'Entrada del día 34.7 Kg Pernil Cerdo (Planilla 02-Sep)'
    },
    {
      tipo: 'TRASLADO_COCINA',
      carne: 'Pernil de cerdo',
      tipoEntrega: 'ENTERO',
      cantidad: 34.7,
      pesoKg: 34.7,
      obs: 'Salida a cocina 34.7 Kg Pernil Cerdo (Planilla 02-Sep)'
    },
    {
      tipo: 'DEVOLUCION_COCINA',
      carne: 'Pernil de cerdo',
      tipoDevolucion: 'PORCIONADO',
      cantidad: 120,
      pesoKg: 39.96,
      obs: 'Devolución de cocina 120 porciones Pernil Cerdo (Planilla 02-Sep)'
    },
    // 13. Gallina -> Entrada 38.6 Kg
    {
      tipo: 'ENTRADA_COMPRA',
      carne: 'Gallina',
      cantidadKg: 38.6,
      costoTotal: 2004614,
      proveedor: 'Proveedor Local',
      factura: 'Planilla 02-Sep',
      obs: 'Entrada del día 38.6 Kg Gallina (Planilla 02-Sep)'
    },
    // 14. Lomo Viche -> Entrada 7.3 Kg
    {
      tipo: 'ENTRADA_COMPRA',
      carne: 'Lomo viche',
      cantidadKg: 7.3,
      costoTotal: 386900,
      proveedor: 'Proveedor Local',
      factura: 'Planilla 02-Sep',
      obs: 'Entrada del día 7.3 Kg Lomo Viche (Planilla 02-Sep)'
    }
  ];

  console.log(`Insertando ${filasPlanilla.length} movimientos para ${targetDate}...`);
  
  let baseHour = 8;
  let baseMin = 0;

  for (let i = 0; i < filasPlanilla.length; i++) {
    const item = filasPlanilla[i];
    const insumo = catMap.get(item.carne.toLowerCase().trim());
    if (!insumo) {
      console.error(`Insumo no encontrado: ${item.carne}`);
      continue;
    }

    const minStr = String(baseMin).padStart(2, '0');
    const hourStr = String(baseHour).padStart(2, '0');
    const fechaHora = `${targetDate}T${hourStr}:${minStr}:00.000Z`;
    baseMin += 3;
    if (baseMin >= 60) {
      baseHour++;
      baseMin = 0;
    }

    const costoUnit = insumo.costo_unitario_kg || 0;
    let movPayload = {
      tipo_movimiento: item.tipo,
      insumo_id: insumo.id,
      usuario: 'Bodeguero',
      fecha: targetDate,
      fecha_hora: fechaHora,
      costo_unitario_kg: costoUnit,
      observaciones: item.obs
    };

    if (item.tipo === 'ENTRADA_COMPRA') {
      movPayload.origen = `PROVEEDOR (${item.proveedor})`;
      movPayload.destino = 'BODEGA_ENTERO';
      movPayload.cant_sin_porcionar_kg = item.cantidadKg;
      movPayload.valor_total_movimiento = item.costoTotal;
    } else if (item.tipo === 'TRASLADO_COCINA') {
      if (item.tipoEntrega === 'PORCIONADO') {
        movPayload.origen = 'BODEGA_PORCIONADO';
        movPayload.destino = 'COCINA_PORCIONADO';
        movPayload.porciones_und = item.cantidad;
        movPayload.peso_porciones_kg = item.pesoKg;
        movPayload.valor_total_movimiento = Math.round(item.pesoKg * costoUnit);
      } else {
        movPayload.origen = 'BODEGA_ENTERO';
        movPayload.destino = 'COCINA_ENTERO';
        movPayload.cant_sin_porcionar_kg = item.cantidad;
        movPayload.valor_total_movimiento = Math.round(item.cantidad * costoUnit);
      }
    } else if (item.tipo === 'DEVOLUCION_COCINA') {
      if (item.tipoDevolucion === 'PORCIONADO') {
        movPayload.origen = 'COCINA_PORCIONADO';
        movPayload.destino = 'BODEGA_PORCIONADO';
        movPayload.porciones_und = item.cantidad;
        movPayload.peso_porciones_kg = item.pesoKg;
        movPayload.valor_total_movimiento = Math.round(item.pesoKg * costoUnit);
      } else {
        movPayload.origen = 'COCINA_ENTERO';
        movPayload.destino = 'BODEGA_ENTERO';
        movPayload.cant_sin_porcionar_kg = item.cantidad;
        movPayload.valor_total_movimiento = Math.round(item.cantidad * costoUnit);
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from('movimientos_inventario')
      .insert([movPayload])
      .select();

    if (insErr) {
      console.error(`❌ Error insertando ${item.carne} (${item.tipo}):`, insErr);
    } else {
      console.log(`✅ [${i+1}/${filasPlanilla.length}] Insertado ${item.carne} (${item.tipo}) - ID: ${inserted[0]?.id}`);
    }
  }

  console.log('✅ Todos los movimientos del 02-Sep insertados en la base de datos Supabase con éxito.');
}

insertSept2Movements();
