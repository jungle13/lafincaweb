import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Movimientos extraídos fielmente de las 9 imágenes del Formato de Reporte Diario de Movimientos de Bodega 2026
const rawDailyMovements = [
  // ==========================================
  // FECHA: 5 Sep 2026 (2026-09-05)
  // ==========================================
  { fecha: '2026-09-05', insumo: 'Gallina', tipo: 'TRASLADO_COCINA', porc: 32, obs: 'Salida a cocina 32 porciones Gallina' },
  { fecha: '2026-09-05', insumo: 'Filete de pollo x 120', tipo: 'TRASLADO_COCINA', porc: 40, obs: 'Salida a cocina 40 porciones Damas' },
  { fecha: '2026-09-05', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', porc: 12, obs: 'Salida a cocina 12 porciones Sobrebarriga' },
  { fecha: '2026-09-05', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Lengua' },
  { fecha: '2026-09-05', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 90, obs: 'Salida a cocina 90 unds Huevos' },
  { fecha: '2026-09-05', insumo: 'Chorizo paisa', tipo: 'ENTRADA_COMPRA', cantKg: 0, porc: 200, obs: 'Entrada del día 200 unds Chorizo Paisa' },
  { fecha: '2026-09-05', insumo: 'Chorizo paisa', tipo: 'TRASLADO_COCINA', porc: 80, obs: 'Salida a cocina 80 porciones Chorizo Paisa' },
  { fecha: '2026-09-05', insumo: 'Camaron precocido', tipo: 'TRASLADO_COCINA', cantKg: 6.5, obs: 'Salida a cocina 6.5 Kg Camarón' },
  { fecha: '2026-09-05', insumo: 'Marisco', tipo: 'TRASLADO_COCINA', cantKg: 7.0, obs: 'Salida a cocina 7.0 Kg Marisco' },
  { fecha: '2026-09-05', insumo: 'Trucha', tipo: 'TRASLADO_COCINA', porc: 17, obs: 'Salida a cocina 17 porciones Trucha' },
  { fecha: '2026-09-05', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 6, obs: 'Salida a cocina 6 und/paq Francesa' },
  { fecha: '2026-09-05', insumo: 'Punta de anca', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Punta de Anca' },
  { fecha: '2026-09-05', insumo: 'Churrasco', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Churrasco' },
  { fecha: '2026-09-05', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Costilla San Luis' },
  { fecha: '2026-09-05', insumo: 'Costilla ahumada', tipo: 'ENTRADA_COMPRA', cantKg: 20.0, obs: 'Entrada del día 20.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-05', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-05', insumo: 'Sobrebarriga delgada', tipo: 'ENTRADA_COMPRA', cantKg: 9.1, obs: 'Entrada del día 9.1 Kg Sobrebarriga' },
  { fecha: '2026-09-05', insumo: 'Sobaco', tipo: 'ENTRADA_COMPRA', cantKg: 13.1, obs: 'Entrada del día 13.1 Kg Sobaco' },
  { fecha: '2026-09-05', insumo: 'Lengua de res', tipo: 'ENTRADA_COMPRA', cantKg: 20.0, obs: 'Entrada del día 20.0 Kg Lengua' },
  { fecha: '2026-09-05', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', cantKg: 30.5, obs: 'Salida a cocina 30.5 Kg Costilla San Luis' },
  { fecha: '2026-09-05', insumo: 'Lomo viche', tipo: 'TRASLADO_COCINA', cantKg: 3.0, obs: 'Salida a cocina 3.0 Kg Lomo Viche' },
  { fecha: '2026-09-05', insumo: 'Chorizo grande', tipo: 'ENTRADA_COMPRA', cantKg: 0, porc: 24, obs: 'Entrada del día 24 unds Chorizo Grande' },
  { fecha: '2026-09-05', insumo: 'Chorizo grande', tipo: 'TRASLADO_COCINA', porc: 12, obs: 'Salida a cocina 12 porciones Chorizo Grande' },

  // ==========================================
  // FECHA: 6 Sep 2026 (2026-09-06)
  // ==========================================
  { fecha: '2026-09-06', insumo: 'Gallina', tipo: 'TRASLADO_COCINA', porc: 42, obs: 'Salida a cocina 42 porciones Gallina' },
  { fecha: '2026-09-06', insumo: 'Filete de pollo x 120', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Damas' },
  { fecha: '2026-09-06', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', porc: 26, obs: 'Salida a cocina 26 porciones Sobrebarriga' },
  { fecha: '2026-09-06', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', porc: 24, obs: 'Salida a cocina 24 porciones Lengua' },
  { fecha: '2026-09-06', insumo: 'Chorizo paisa', tipo: 'TRASLADO_COCINA', porc: 80, obs: 'Salida a cocina 80 porciones Chorizo Paisa' },
  { fecha: '2026-09-06', insumo: 'Camaron precocido', tipo: 'TRASLADO_COCINA', cantKg: 10.9, obs: 'Salida a cocina 10.9 Kg Camarón' },
  { fecha: '2026-09-06', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 12, obs: 'Salida a cocina 12 und Francesa' },
  { fecha: '2026-09-06', insumo: 'Salmon', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Salmón' },
  { fecha: '2026-09-06', insumo: 'Trucha', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Trucha' },
  { fecha: '2026-09-06', insumo: 'Tilapia 350/450', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Tilapia' },
  { fecha: '2026-09-06', insumo: 'Punta de anca', tipo: 'TRASLADO_COCINA', porc: 30, obs: 'Salida a cocina 30 porciones Punta de Anca' },
  { fecha: '2026-09-06', insumo: 'Churrasco', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Churrasco' },
  { fecha: '2026-09-06', insumo: 'Baby beef', tipo: 'TRASLADO_COCINA', porc: 13, obs: 'Salida a cocina 13 porciones Baby Beef' },
  { fecha: '2026-09-06', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Costilla San Luis' },
  { fecha: '2026-09-06', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 12.0, obs: 'Salida a cocina 12.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-06', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', cantKg: 42.0, obs: 'Salida a cocina 42.0 Kg Tocino' },
  { fecha: '2026-09-06', insumo: 'Tocino', tipo: 'DEVOLUCION_COCINA', porc: 40, obs: 'Devolución de cocina 40 porciones Tocino' },
  { fecha: '2026-09-06', insumo: 'Caderita', tipo: 'ENTRADA_COMPRA', cantKg: 4.1, obs: 'Entrada del día 4.1 Kg Caderita' },
  { fecha: '2026-09-06', insumo: 'Caderita', tipo: 'TRASLADO_COCINA', porc: 105, obs: 'Salida a cocina 105 porciones Caderita' },
  { fecha: '2026-09-06', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 50, obs: 'Salida a cocina 50 porciones Lomo Cerdo' },
  { fecha: '2026-09-06', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', porc: 40, obs: 'Salida a cocina 40 porciones Filete Pollo' },

  // ==========================================
  // FECHA: 9 Sep 2026 (2026-09-09)
  // ==========================================
  { fecha: '2026-09-09', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', porc: 35, obs: 'Salida a cocina 35 porciones Filete Pollo' },
  { fecha: '2026-09-09', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Lomo Cerdo' },
  { fecha: '2026-09-09', insumo: 'Costilla de res', tipo: 'TRASLADO_COCINA', porc: 68, obs: 'Salida a cocina 68 porciones Costilla Res' },
  { fecha: '2026-09-09', insumo: 'Morrillo', tipo: 'TRASLADO_COCINA', porc: 63, obs: 'Salida a cocina 63 porciones Morrillo' },
  { fecha: '2026-09-09', insumo: 'Punta de anca', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Punta de Anca' },
  { fecha: '2026-09-09', insumo: 'Churrasco', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Churrasco' },
  { fecha: '2026-09-09', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-09', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 11.2, obs: 'Salida a cocina 11.2 Kg Sobaco' },
  { fecha: '2026-09-09', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 25, obs: 'Salida a cocina 25 porciones Tocino' },
  { fecha: '2026-09-09', insumo: 'Pernil de pollo', tipo: 'ENTRADA_COMPRA', cantKg: 14.9, obs: 'Entrada del día 14.9 Kg Pernil Pollo' },
  { fecha: '2026-09-09', insumo: 'Pernil de pollo', tipo: 'DEVOLUCION_COCINA', porc: 60, obs: 'Devolución de cocina 60 porciones Pernil Pollo' },
  { fecha: '2026-09-09', insumo: 'Filete de pollox 320 gr', tipo: 'ENTRADA_COMPRA', cantKg: 14.1, obs: 'Entrada del día 14.1 Kg Filete Pollo' },
  { fecha: '2026-09-09', insumo: 'Filete de pollox 320 gr', tipo: 'DEVOLUCION_COCINA', porc: 46, obs: 'Devolución de cocina 46 porciones Filete Pollo' },
  { fecha: '2026-09-09', insumo: 'Lomo de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 13.6, obs: 'Entrada del día 13.6 Kg Lomo Cerdo' },
  { fecha: '2026-09-09', insumo: 'Lomo de cerdo', tipo: 'DEVOLUCION_COCINA', porc: 36, obs: 'Devolución de cocina 36 porciones Lomo Cerdo' },
  { fecha: '2026-09-09', insumo: 'Huevo', tipo: 'ENTRADA_COMPRA', cantKg: 0, porc: 450, obs: 'Entrada del día 450 unds Huevos' },
  { fecha: '2026-09-09', insumo: 'Pezuña de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 7.5, obs: 'Entrada del día 7.5 Kg Pezuña' },
  { fecha: '2026-09-09', insumo: 'Pezuña de cerdo', tipo: 'TRASLADO_COCINA', cantKg: 7.5, obs: 'Salida a cocina 7.5 Kg Pezuña' },

  // ==========================================
  // FECHA: 14 Sep 2026 (2026-09-14)
  // ==========================================
  { fecha: '2026-09-14', insumo: 'Tamal', tipo: 'TRASLADO_COCINA', porc: 6, obs: 'Salida a cocina 6 porciones Tamal' },
  { fecha: '2026-09-14', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Filete Pollo' },
  { fecha: '2026-09-14', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-14', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 60, obs: 'Salida a cocina 60 unds Huevos' },
  { fecha: '2026-09-14', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', porc: 6, obs: 'Salida a cocina 6 porciones Sobrebarriga' },
  { fecha: '2026-09-14', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Lengua' },
  { fecha: '2026-09-14', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 25, obs: 'Salida a cocina 25 porciones Tocino' },
  { fecha: '2026-09-14', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', cantKg: 20.4, obs: 'Salida a cocina 20.4 Kg Tocino' },
  { fecha: '2026-09-14', insumo: 'Costilla de res', tipo: 'ENTRADA_COMPRA', cantKg: 20.4, obs: 'Entrada del día 20.4 Kg Costilla Res' },
  { fecha: '2026-09-14', insumo: 'Costilla de res', tipo: 'TRASLADO_COCINA', cantKg: 5.2, obs: 'Salida a cocina 5.2 Kg Costilla Res' },
  { fecha: '2026-09-14', insumo: 'Muchacho res', tipo: 'ENTRADA_COMPRA', cantKg: 5.2, obs: 'Entrada del día 5.2 Kg Muchacho' },
  { fecha: '2026-09-14', insumo: 'Muchacho res', tipo: 'TRASLADO_COCINA', cantKg: 6.0, obs: 'Salida a cocina 6.0 Kg Muchacho' },
  { fecha: '2026-09-14', insumo: 'Callo', tipo: 'TRASLADO_COCINA', cantKg: 8.2, obs: 'Salida a cocina 8.2 Kg Callo' },
  { fecha: '2026-09-14', insumo: 'Sobaco', tipo: 'ENTRADA_COMPRA', cantKg: 19.6, obs: 'Entrada del día 19.6 Kg Sobaco' },
  { fecha: '2026-09-14', insumo: 'Carne asada', tipo: 'ENTRADA_COMPRA', cantKg: 4.1, obs: 'Entrada del día 4.1 Kg Carne Asada' },

  // ==========================================
  // FECHA: 15 Sep 2026 (2026-09-15)
  // ==========================================
  { fecha: '2026-09-15', insumo: 'Costilla de res', tipo: 'TRASLADO_COCINA', porc: 52, obs: 'Salida a cocina 52 porciones Costilla Res' },
  { fecha: '2026-09-15', insumo: 'Muchacho res', tipo: 'TRASLADO_COCINA', porc: 45, obs: 'Salida a cocina 45 porciones Muchacho' },
  { fecha: '2026-09-15', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Tocino' },
  { fecha: '2026-09-15', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 2, obs: 'Salida a cocina 2 und Francesa' },
  { fecha: '2026-09-15', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-15', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Filete Pollo' },
  { fecha: '2026-09-15', insumo: 'Filete de pollox 320 gr', tipo: 'TRASLADO_COCINA', cantKg: 11.4, obs: 'Salida a cocina 11.4 Kg Filete Pollo' },
  { fecha: '2026-09-15', insumo: 'Morrillo', tipo: 'TRASLADO_COCINA', cantKg: 8.1, obs: 'Salida a cocina 8.1 Kg Morrillo' },

  // ==========================================
  // FECHA: 17 Sep 2026 (2026-09-17)
  // ==========================================
  { fecha: '2026-09-17', insumo: 'Higado', tipo: 'TRASLADO_COCINA', porc: 45, obs: 'Salida a cocina 45 porciones Hígado' },
  { fecha: '2026-09-17', insumo: 'Lomo de cerdo', tipo: 'TRASLADO_COCINA', porc: 52, obs: 'Salida a cocina 52 porciones Lomo Cerdo' },
  { fecha: '2026-09-17', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 30, obs: 'Salida a cocina 30 porciones Tocino' },
  { fecha: '2026-09-17', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 90, obs: 'Salida a cocina 90 unds Huevos' },
  { fecha: '2026-09-17', insumo: 'Chorizo paisa', tipo: 'TRASLADO_COCINA', porc: 80, obs: 'Salida a cocina 80 porciones Chorizo Paisa' },
  { fecha: '2026-09-17', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 2, obs: 'Salida a cocina 2 und Francesa' },
  { fecha: '2026-09-17', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Sobrebarriga' },
  { fecha: '2026-09-17', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', porc: 7, obs: 'Salida a cocina 7 porciones Lengua' },
  { fecha: '2026-09-17', insumo: 'Churrasco', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Churrasco' },
  { fecha: '2026-09-17', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 7.1, obs: 'Salida a cocina 7.1 Kg Sobaco' },
  { fecha: '2026-09-17', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', cantKg: 10.1, obs: 'Salida a cocina 10.1 Kg Lengua' },
  { fecha: '2026-09-17', insumo: 'Pernil de pollo', tipo: 'ENTRADA_COMPRA', cantKg: 42.5, obs: 'Entrada del día 42.5 Kg Pernil Pollo' },
  { fecha: '2026-09-17', insumo: 'Pernil de pollo', tipo: 'DEVOLUCION_COCINA', porc: 140, obs: 'Devolución de cocina 140 porciones Pernil Pollo (Son ejecutivos)' },
  { fecha: '2026-09-17', insumo: 'Sobaco', tipo: 'ENTRADA_COMPRA', cantKg: 22.5, obs: 'Entrada del día 22.5 Kg Sobaco' },
  { fecha: '2026-09-17', insumo: 'Lengua de res', tipo: 'ENTRADA_COMPRA', cantKg: 25.2, obs: 'Entrada del día 25.2 Kg Lengua' },
  { fecha: '2026-09-17', insumo: 'Papas a la francesa', tipo: 'ENTRADA_COMPRA', cantKg: 8.0, obs: 'Entrada del día 8.0 Kg Francesa' },
  { fecha: '2026-09-17', insumo: 'Papas a la francesa', tipo: 'DEVOLUCION_COCINA', porc: 30, obs: 'Devolución de cocina 30 porciones Francesa' },
  { fecha: '2026-09-17', insumo: 'Punta de anca', tipo: 'ENTRADA_COMPRA', cantKg: 13.5, obs: 'Entrada del día 13.5 Kg Punta de Anca' },
  { fecha: '2026-09-17', insumo: 'Punta de anca', tipo: 'DEVOLUCION_COCINA', porc: 30, obs: 'Devolución de cocina 30 porciones Punta de Anca' },
  { fecha: '2026-09-17', insumo: 'Churrasco', tipo: 'ENTRADA_COMPRA', cantKg: 10.7, obs: 'Entrada del día 10.7 Kg Churrasco' },
  { fecha: '2026-09-17', insumo: 'Tocino', tipo: 'ENTRADA_COMPRA', cantKg: 70.2, obs: 'Entrada del día 70.2 Kg Tocino' },
  { fecha: '2026-09-17', insumo: 'Costilla ahumada', tipo: 'ENTRADA_COMPRA', cantKg: 27.6, obs: 'Entrada del día 27.6 Kg Costilla Ahumada' },
  { fecha: '2026-09-17', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 27.6, obs: 'Salida a cocina 27.6 Kg Costilla Ahumada' },

  // ==========================================
  // FECHA: 18 Sep 2026 (2026-09-18)
  // ==========================================
  { fecha: '2026-09-18', insumo: 'Pernil de pollo', tipo: 'TRASLADO_COCINA', porc: 120, obs: 'Salida a cocina 120 porciones Pernil Pollo' },
  { fecha: '2026-09-18', insumo: 'Bagre de mar', tipo: 'TRASLADO_COCINA', porc: 45, obs: 'Salida a cocina 45 porciones Pescado Bagre/Aguacil' },
  { fecha: '2026-09-18', insumo: 'Carne asada', tipo: 'TRASLADO_COCINA', porc: 50, obs: 'Salida a cocina 50 porciones (40+10) Carne Asada' },
  { fecha: '2026-09-18', insumo: 'Huevo', tipo: 'TRASLADO_COCINA', porc: 90, obs: 'Salida a cocina 90 unds Huevos' },
  { fecha: '2026-09-18', insumo: 'Churrasco', tipo: 'TRASLADO_COCINA', porc: 5, obs: 'Salida a cocina 5 porciones Churrasco' },
  { fecha: '2026-09-18', insumo: 'Salmon', tipo: 'TRASLADO_COCINA', porc: 2, obs: 'Salida a cocina 2 porciones Salmón' },
  { fecha: '2026-09-18', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 2, obs: 'Salida a cocina 2 und Francesa' },
  { fecha: '2026-09-18', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 35, obs: 'Salida a cocina 35 porciones Tocino' },
  { fecha: '2026-09-18', insumo: 'Filete de pollo x 120', tipo: 'ENTRADA_COMPRA', cantKg: 20.0, obs: 'Entrada del día 20.0 Kg Damas' },
  { fecha: '2026-09-18', insumo: 'Filete de pollo x 120', tipo: 'TRASLADO_COCINA', cantKg: 2.0, obs: 'Salida a cocina 2.0 Kg Damas' },
  { fecha: '2026-09-18', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', cantKg: 7.1, obs: 'Salida a cocina 7.1 Kg Sobrebarriga' },
  { fecha: '2026-09-18', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 4.0, obs: 'Salida a cocina 4.0 Kg Sobaco' },
  { fecha: '2026-09-18', insumo: 'Costilla ahumada', tipo: 'ENTRADA_COMPRA', cantKg: 40.0, obs: 'Entrada del día 40.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-18', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 22.2, obs: 'Salida a cocina 22.2 Kg Costilla Ahumada' },
  { fecha: '2026-09-18', insumo: 'Tocino', tipo: 'DEVOLUCION_COCINA', porc: 79, obs: 'Devolución de cocina 79 porciones Tocino' },
  { fecha: '2026-09-18', insumo: 'Lomo de cerdo', tipo: 'ENTRADA_COMPRA', cantKg: 26.9, obs: 'Entrada del día 26.9 Kg Lomo Cerdo' },

  // ==========================================
  // FECHA: 19 Sep 2026 (2026-09-19) - Pág 1 y 2
  // ==========================================
  { fecha: '2026-09-19', insumo: 'Gallina', tipo: 'TRASLADO_COCINA', porc: 32, obs: 'Salida a cocina 32 porciones Gallina' },
  { fecha: '2026-09-19', insumo: 'Filete de pollo x 120', tipo: 'TRASLADO_COCINA', porc: 40, obs: 'Salida a cocina 40 porciones Damas' },
  { fecha: '2026-09-19', insumo: 'Sobrebarriga delgada', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Sobrebarriga' },
  { fecha: '2026-09-19', insumo: 'Lengua de res', tipo: 'TRASLADO_COCINA', porc: 15, obs: 'Salida a cocina 15 porciones Lengua' },
  { fecha: '2026-09-19', insumo: 'Camaron precocido', tipo: 'TRASLADO_COCINA', cantKg: 8.1, obs: 'Salida a cocina 8.1 Kg Camarón' },
  { fecha: '2026-09-19', insumo: 'Salmon', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Salmón' },
  { fecha: '2026-09-19', insumo: 'Trucha', tipo: 'TRASLADO_COCINA', porc: 20, obs: 'Salida a cocina 20 porciones Trucha' },
  { fecha: '2026-09-19', insumo: 'Papas a la francesa', tipo: 'TRASLADO_COCINA', porc: 4, obs: 'Salida a cocina 4 und Francesa' },
  { fecha: '2026-09-19', insumo: 'Costilla ahumada', tipo: 'TRASLADO_COCINA', cantKg: 8.0, obs: 'Salida a cocina 8.0 Kg Costilla Ahumada' },
  { fecha: '2026-09-19', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', porc: 10, obs: 'Salida a cocina 10 porciones Costilla San Luis' },
  { fecha: '2026-09-19', insumo: 'Chorizo paisa', tipo: 'TRASLADO_COCINA', porc: 40, obs: 'Salida a cocina 40 porciones Chorizo Paisa' },
  { fecha: '2026-09-19', insumo: 'Sobaco', tipo: 'TRASLADO_COCINA', cantKg: 15.3, obs: 'Salida a cocina 15.3 Kg Sobaco' },
  { fecha: '2026-09-19', insumo: 'Costilla san luis', tipo: 'ENTRADA_COMPRA', cantKg: 20.3, obs: 'Entrada del día 20.3 Kg Costilla San Luis' },
  { fecha: '2026-09-19', insumo: 'Costilla san luis', tipo: 'TRASLADO_COCINA', cantKg: 20.3, obs: 'Salida a cocina 20.3 Kg Costilla San Luis' },
  { fecha: '2026-09-19', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', porc: 54, obs: 'Salida a cocina 54 porciones Tocino' },
  { fecha: '2026-09-19', insumo: 'Tocino', tipo: 'DEVOLUCION_COCINA', porc: 70, obs: 'Devolución de cocina 70 porciones Tocino' },
  { fecha: '2026-09-19', insumo: 'Filete de pollox 320 gr', tipo: 'ENTRADA_COMPRA', cantKg: 22.4, obs: 'Entrada del día 22.4 Kg Filete Pollo' },
  { fecha: '2026-09-19', insumo: 'Filete de pollox 320 gr', tipo: 'DEVOLUCION_COCINA', porc: 25, obs: 'Devolución de cocina 25 porciones Filete Pollo' },
  { fecha: '2026-09-19', insumo: 'Salmon', tipo: 'ENTRADA_COMPRA', cantKg: 9.7, obs: 'Entrada del día 9.7 Kg Salmón' },
  { fecha: '2026-09-19', insumo: 'Salmon', tipo: 'DEVOLUCION_COCINA', porc: 20, obs: 'Devolución de cocina 20 porciones Salmón' },
  { fecha: '2026-09-19', insumo: 'Trucha', tipo: 'ENTRADA_COMPRA', cantKg: 9.0, obs: 'Entrada del día 9.0 Kg Trucha' },
  { fecha: '2026-09-19', insumo: 'Chorizo paisa', tipo: 'ENTRADA_COMPRA', cantKg: 0, porc: 240, obs: 'Entrada del día 240 unds Chorizo Paisa' },
  { fecha: '2026-09-19', insumo: 'Chorizo grande', tipo: 'ENTRADA_COMPRA', cantKg: 0, porc: 12, obs: 'Entrada del día 12 unds Chorizo Grande' },
  { fecha: '2026-09-19', insumo: 'Tocino', tipo: 'TRASLADO_COCINA', cantKg: 24.7, obs: 'Salida a cocina 24.7 Kg Tocino' },
  // Pág 2
  { fecha: '2026-09-19', insumo: 'Sobaco', tipo: 'ENTRADA_COMPRA', cantKg: 26.2, obs: 'Entrada del día 26.2 Kg Sobaco (Pág 2)' },
  { fecha: '2026-09-19', insumo: 'Tocino', tipo: 'ENTRADA_COMPRA', cantKg: 100.2, obs: 'Entrada del día 100.2 Kg Tocino (Pág 2)' },
  { fecha: '2026-09-19', insumo: 'Camaron precocido', tipo: 'ENTRADA_COMPRA', cantKg: 20.2, obs: 'Entrada del día 20.2 Kg Camarón (Pág 2)' },
  { fecha: '2026-09-19', insumo: 'Papas a la francesa', tipo: 'ENTRADA_COMPRA', cantKg: 12.0, obs: 'Entrada del día 12.0 Kg Francesa (Pág 2)' },
  { fecha: '2026-09-19', insumo: 'Punta de anca', tipo: 'ENTRADA_COMPRA', cantKg: 16.1, obs: 'Entrada del día 16.1 Kg Punta de Anca (Pág 2)' }
];

async function seedMovimientos() {
  console.log('=== REGISTRO DE MOVIMIENTOS DE BODEGUERO EN ESTADO PENDIENTE DE APROBACIÓN ===');

  // 1. Obtener catálogo para asociar ID, peso estándar y costo
  const { data: catalogo, error: errCat } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, costo_unitario_kg, peso_estandar_porcion_kg');

  if (errCat || !catalogo) {
    console.error('Error cargando catalogo:', errCat);
    process.exit(1);
  }

  const catMap = new Map();
  catalogo.forEach(c => {
    catMap.set(c.nombre.toLowerCase().trim(), c);
  });

  const datesToProcess = [...new Set(rawDailyMovements.map(m => m.fecha))];
  console.log('Fechas a registrar:', datesToProcess);

  // Limpiar movimientos pendientes existentes en estas fechas específicas si los hay
  console.log('Verificando si existen movimientos previos en estas fechas...');
  const { data: existing } = await supabase
    .from('movimientos_inventario')
    .select('id, fecha')
    .in('fecha', datesToProcess)
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  if (existing && existing.length > 0) {
    console.log(`Eliminando ${existing.length} movimientos pendientes previos en estas fechas...`);
    await supabase
      .from('movimientos_inventario')
      .delete()
      .in('id', existing.map(e => e.id));
  }

  const recordsToInsert = [];

  for (const m of rawDailyMovements) {
    const itemCat = catMap.get(m.insumo.toLowerCase().trim());
    if (!itemCat) {
      console.error(`❌ Insumo no encontrado en catalogo: "${m.insumo}"`);
      process.exit(1);
    }

    const cantKg = m.cantKg || 0;
    const porciones = m.porc || 0;
    const pesoEstandar = parseFloat(itemCat.peso_estandar_porcion_kg) || 0.25;
    const pesoPorciones = porciones > 0 ? Math.round(porciones * pesoEstandar * 100) / 100 : 0;
    const costoUnitario = parseFloat(itemCat.costo_unitario_kg) || 0;
    const totalPesos = cantKg > 0
      ? Math.round(cantKg * costoUnitario)
      : Math.round((pesoPorciones || porciones) * costoUnitario);

    const sheetDay = m.fecha.split('-')[2];
    const fullObs = `[PENDIENTE_APROBAR] ${m.obs} (Planilla ${sheetDay}-Sep)`;

    let origen = 'BODEGA_ENTERO';
    let destino = 'COCINA_ENTERO';

    if (m.tipo === 'ENTRADA_COMPRA') {
      origen = 'PROVEEDOR (Proveedor Local)';
      destino = 'BODEGA_ENTERO';
    } else if (m.tipo === 'TRASLADO_COCINA') {
      if (porciones > 0) {
        origen = 'BODEGA_PORCIONADO';
        destino = 'COCINA_PORCIONADO';
      } else {
        origen = 'BODEGA_ENTERO';
        destino = 'COCINA_ENTERO';
      }
    } else if (m.tipo === 'DEVOLUCION_COCINA') {
      if (porciones > 0) {
        origen = 'COCINA_PORCIONADO';
        destino = 'BODEGA_PORCIONADO';
      } else {
        origen = 'COCINA_ENTERO';
        destino = 'BODEGA_ENTERO';
      }
    }

    const payload = {
      fecha: m.fecha,
      fecha_hora: `${m.fecha}T12:00:00.000Z`,
      tipo_movimiento: m.tipo,
      insumo_id: itemCat.id,
      origen,
      destino,
      cant_sin_porcionar_kg: cantKg,
      porciones_und: porciones,
      peso_porciones_kg: pesoPorciones,
      merma_kg: 0,
      costo_unitario_kg: costoUnitario,
      valor_total_movimiento: totalPesos,
      observaciones: fullObs,
      usuario: 'Bodeguero (Pendiente)'
    };

    recordsToInsert.push(payload);
  }

  console.log(`Total movimientos construidos: ${recordsToInsert.length}`);

  // Inserción en lotes de 50
  for (let i = 0; i < recordsToInsert.length; i += 50) {
    const batch = recordsToInsert.slice(i, i + 50);
    const { error: insErr } = await supabase.from('movimientos_inventario').insert(batch);
    if (insErr) {
      console.error(`Error insertando lote ${i}:`, insErr);
      process.exit(1);
    }
  }

  console.log('✅ Todos los movimientos del bodeguero registrados exitosamente en estado PENDIENTE DE APROBACIÓN!');

  // Resumen final por fecha
  const { data: finalData } = await supabase
    .from('movimientos_inventario')
    .select('fecha, tipo_movimiento')
    .in('fecha', datesToProcess)
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  const summary = {};
  (finalData || []).forEach(f => {
    summary[f.fecha] = (summary[f.fecha] || 0) + 1;
  });

  console.log('\nResumen de movimientos pendientes registrados por fecha:');
  console.table(summary);
}

seedMovimientos().catch(console.error);
