const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://uexqmrspulhauubzrwyn.supabase.co', 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO');

// Movimientos a registrar del Reporte Diario 2026-09-02 (2 de Septiembre)
const movimientosSept2 = [
  // 1. Morrillo -> Salida a cocina 60 porciones
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Morrillo',
    tipoEntrega: 'PORCIONADO',
    cantidad: 60,
    pesoKg: 15.0, // 60 und * 0.25 kg = 15.0 kg
    observaciones: 'Despacho a cocina según planilla física 02-Sep'
  },
  // 2. Cordobue -> Salida a cocina 40 porciones
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Costilla Especial', // Cordobue / Costilla Especial
    tipoEntrega: 'PORCIONADO',
    cantidad: 40,
    pesoKg: 11.44, // 40 und * 0.286 kg
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Cordobue)'
  },
  // 3. Francesa (Papas a la francesa) -> Salida a cocina 1 und
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Papas a la francesa',
    tipoEntrega: 'ENTERO',
    cantidad: 1.0,
    pesoKg: 1.0,
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Francesa)'
  },
  // 4. Mix Verdura (Verduras) -> Salida a cocina 1 und
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Papas a la francesa', // Insumo de verduras/acompañamiento si aplica o nota
    tipoEntrega: 'ENTERO',
    cantidad: 1.0,
    pesoKg: 1.0,
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Mix Verdura)'
  },
  // 5. Ahumada (Costilla ahumada) -> Salida a cocina 4.0 Kg
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Costilla ahumada',
    tipoEntrega: 'ENTERO',
    cantidad: 4.0,
    pesoKg: 4.0,
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Ahumada 4.0 Kg)'
  },
  // 6. Lomo Cerdo -> Salida a cocina 10 porciones
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Lomo de cerdo',
    tipoEntrega: 'PORCIONADO',
    cantidad: 10,
    pesoKg: 2.22, // 10 * 0.222 kg
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Lomo Cerdo)'
  },
  // 7. San Luis (Costilla san luis) -> Salida a cocina 10 porciones
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Costilla san luis',
    tipoEntrega: 'PORCIONADO',
    cantidad: 10,
    pesoKg: 5.0, // 10 * 0.5 kg
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Costilla San Luis)'
  },
  // 8. Sobaco -> Salida a cocina 11.4 Kg
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Sobaco',
    tipoEntrega: 'ENTERO',
    cantidad: 11.4,
    pesoKg: 11.4,
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Sobaco 11.4 Kg)'
  },
  // 9. Higado -> Entrada compra 5.0 Kg, Salida cocina 5.0 Kg, Devolución cocina 48 porciones
  {
    tipo: 'ENTRADA_COMPRA',
    insumoNombre: 'Higado',
    cantidadKg: 5.0,
    costoTotal: 5.0 * 21500, // 107,500
    proveedor: 'Proveedor Local',
    factura: 'Planilla 02-Sep',
    observaciones: 'Entrada del día según planilla física 02-Sep (Higado 5.0 Kg)'
  },
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Higado',
    tipoEntrega: 'ENTERO',
    cantidad: 5.0,
    pesoKg: 5.0,
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Higado 5.0 Kg)'
  },
  {
    tipo: 'DEVOLUCION_COCINA',
    insumoNombre: 'Higado',
    tipoDevolucion: 'PORCIONADO',
    cantidad: 48,
    pesoKg: 15.98, // 48 * 0.333 kg
    observaciones: 'Devolución de cocina según planilla física 02-Sep (Higado 48 porciones)'
  },
  // 10. Tocino (Fila 10) -> Salida a cocina 19.0 Kg
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Tocino',
    tipoEntrega: 'ENTERO',
    cantidad: 19.0,
    pesoKg: 19.0,
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Tocino 19.0 Kg)'
  },
  // 11. Tocino (Fila 11) -> Salida a cocina 15.0 Kg, Devolución cocina 37 porciones
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Tocino',
    tipoEntrega: 'ENTERO',
    cantidad: 15.0,
    pesoKg: 15.0,
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Tocino 15.0 Kg)'
  },
  {
    tipo: 'DEVOLUCION_COCINA',
    insumoNombre: 'Tocino',
    tipoDevolucion: 'PORCIONADO',
    cantidad: 37,
    pesoKg: 14.58, // 37 * 0.394 kg
    observaciones: 'Devolución de cocina según planilla física 02-Sep (Tocino 37 porciones)'
  },
  // 12. Pernil Cerdo -> Entrada compra 34.7 Kg, Salida cocina 34.7 Kg, Devolución cocina 120 porciones
  {
    tipo: 'ENTRADA_COMPRA',
    insumoNombre: 'Pernil de cerdo',
    cantidadKg: 34.7,
    costoTotal: 34.7 * 10000, // 347,000
    proveedor: 'Proveedor Local',
    factura: 'Planilla 02-Sep',
    observaciones: 'Entrada del día según planilla física 02-Sep (Pernil Cerdo 34.7 Kg)'
  },
  {
    tipo: 'TRASLADO_COCINA',
    insumoNombre: 'Pernil de cerdo',
    tipoEntrega: 'ENTERO',
    cantidad: 34.7,
    pesoKg: 34.7,
    observaciones: 'Despacho a cocina según planilla física 02-Sep (Pernil Cerdo 34.7 Kg)'
  },
  {
    tipo: 'DEVOLUCION_COCINA',
    insumoNombre: 'Pernil de cerdo',
    tipoDevolucion: 'PORCIONADO',
    cantidad: 120,
    pesoKg: 39.96, // 120 * 0.333 kg
    observaciones: 'Devolución de cocina según planilla física 02-Sep (Pernil Cerdo 120 porciones)'
  },
  // 13. Gallina -> Entrada compra 38.6 Kg
  {
    tipo: 'ENTRADA_COMPRA',
    insumoNombre: 'Gallina',
    cantidadKg: 38.6,
    costoTotal: 38.6 * 51933, // 2,004,614
    proveedor: 'Proveedor Local',
    factura: 'Planilla 02-Sep',
    observaciones: 'Entrada del día según planilla física 02-Sep (Gallina 38.6 Kg)'
  },
  // 14. Lomo Viche -> Entrada compra 7.3 Kg
  {
    tipo: 'ENTRADA_COMPRA',
    insumoNombre: 'Lomo viche',
    cantidadKg: 7.3,
    costoTotal: 7.3 * 53000, // 386,900
    proveedor: 'Proveedor Local',
    factura: 'Planilla 02-Sep',
    observaciones: 'Entrada del día según planilla física 02-Sep (Lomo Viche 7.3 Kg)'
  }
];

async function run() {
  const { data: catalogo } = await supabase.from('catalogo_insumos').select('*');
  const catMap = new Map();
  catalogo.forEach(c => catMap.set(c.nombre.toLowerCase().trim(), c));

  console.log('Validando insumos del catálogo...');
  for (const mov of movimientosSept2) {
    const item = catMap.get(mov.insumoNombre.toLowerCase().trim());
    if (!item) {
      console.error(`❌ Insumo no encontrado: "${mov.insumoNombre}"`);
    } else {
      console.log(`✅ OK: "${mov.insumoNombre}" -> ID: ${item.id} ($${item.costo_unitario_kg}/kg)`);
    }
  }
}

run();
