const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. MATRIZ DE CARNES Y PROTEÍNAS (43 ítems)
// ==========================================
const CARNES = [
  // 1. CARNE DE RES Y DERIVADOS (16)
  { num: 1, cat: 'CARNE DE RES', nombre: 'Sobaco (Carne para desmechar)', unidad: 'Kg', precio: 25900, peso: 0.1, tipo: 'KGS_Y_UNIDADES' },
  { num: 2, cat: 'CARNE DE RES', nombre: 'Carne molida de res (Sobaco)', unidad: 'Kg', precio: 25900, peso: 0.15, tipo: 'KGS_Y_UNIDADES' },
  { num: 3, cat: 'CARNE DE RES', nombre: 'Sobrebarriga delgada', unidad: 'Kg', precio: 30000, peso: 0.4, tipo: 'KGS_Y_UNIDADES' },
  { num: 4, cat: 'CARNE DE RES', nombre: 'Lomo de caracho (Churrasco Parrilla)', unidad: 'Kg', precio: 44000, peso: 0.4, tipo: 'KGS_Y_UNIDADES' },
  { num: 5, cat: 'CARNE DE RES', nombre: 'Punta de anca res', unidad: 'Kg', precio: 44000, peso: 0.4, tipo: 'KGS_Y_UNIDADES' },
  { num: 6, cat: 'CARNE DE RES', nombre: 'Lomo viche de res', unidad: 'Kg', precio: 53000, peso: 0.4, tipo: 'KGS_Y_UNIDADES' },
  { num: 7, cat: 'CARNE DE RES', nombre: 'Baby beef (Lomo viche)', unidad: 'Kg', precio: 53000, peso: 0.4, tipo: 'KGS_Y_UNIDADES' },
  { num: 8, cat: 'CARNE DE RES', nombre: 'Lengua de res', unidad: 'Kg', precio: 25000, peso: 0.4, tipo: 'KGS_Y_UNIDADES' },
  { num: 9, cat: 'CARNE DE RES', nombre: 'Morrillo de res', unidad: 'Kg', precio: 26900, peso: 0.12, tipo: 'KGS_Y_UNIDADES' },
  { num: 10, cat: 'CARNE DE RES', nombre: 'Muchacho de res', unidad: 'Kg', precio: 29500, peso: 0.25, tipo: 'KGS_Y_UNIDADES' },
  { num: 11, cat: 'CARNE DE RES', nombre: 'Caderita de res', unidad: 'Kg', precio: 33000, peso: 0.25, tipo: 'KGS_Y_UNIDADES' },
  { num: 12, cat: 'CARNE DE RES', nombre: 'Costilla de res', unidad: 'Kg', precio: 18500, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 13, cat: 'CARNE DE RES', nombre: 'Carne asada / Res para asar', unidad: 'Kg', precio: 25900, peso: 0.1, tipo: 'KGS_Y_UNIDADES' },
  { num: 14, cat: 'CARNE DE RES', nombre: 'Hígado de res', unidad: 'Kg', precio: 21500, peso: 0.115, tipo: 'KGS_Y_UNIDADES' },
  { num: 15, cat: 'CARNE DE RES', nombre: 'Callo de res (Mondongo)', unidad: 'Kg', precio: 20000, peso: 0.15, tipo: 'KGS_Y_UNIDADES' },
  { num: 16, cat: 'CARNE DE RES', nombre: 'Pata de res', unidad: 'Kg', precio: 7000, peso: 0.5, tipo: 'KGS_Y_UNIDADES' },

  // 2. CARNE DE CERDO Y CORTES PORCINOS (10)
  { num: 17, cat: 'CARNE DE CERDO', nombre: 'Costilla de cerdo especial', unidad: 'Kg', precio: 18200, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 18, cat: 'CARNE DE CERDO', nombre: 'Costilla San Luis Jr', unidad: 'Kg', precio: 22900, peso: 0.5, tipo: 'KGS_Y_UNIDADES' },
  { num: 19, cat: 'CARNE DE CERDO', nombre: 'Costilla ahumada de cerdo', unidad: 'Kg', precio: 18000, peso: 0.4, tipo: 'KGS_Y_UNIDADES' },
  { num: 20, cat: 'CARNE DE CERDO', nombre: 'Lomo de cerdo', unidad: 'Kg', precio: 19000, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 21, cat: 'CARNE DE CERDO', nombre: 'Tocineta / Tocino barril', unidad: 'Kg', precio: 16900, peso: 0.4, tipo: 'KGS_Y_UNIDADES' },
  { num: 22, cat: 'CARNE DE CERDO', nombre: 'Panceta de cerdo', unidad: 'Kg', precio: 24000, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 23, cat: 'CARNE DE CERDO', nombre: 'Pezuña de cerdo', unidad: 'Kg', precio: 9700, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 24, cat: 'CARNE DE CERDO', nombre: 'Espinazo de cerdo', unidad: 'Kg', precio: 19429, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 25, cat: 'CARNE DE CERDO', nombre: 'Pernil de cerdo', unidad: 'Kg', precio: 6500, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 26, cat: 'CARNE DE CERDO', nombre: 'Bondiola / Cabeza de lomo', unidad: 'Kg', precio: 22000, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },

  // 3. CARNE DE POLLO Y AVES (7)
  { num: 27, cat: 'CARNE POLLO', nombre: 'Filete de pollo (x 350g / x 120g)', unidad: 'Kg', precio: 18500, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 28, cat: 'CARNE POLLO', nombre: 'Pernil de pollo (Granel / Campo)', unidad: 'Kg', precio: 6500, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 29, cat: 'CARNE POLLO', nombre: 'Trozos de pechuga', unidad: 'Kg', precio: 11500, peso: 0.2, tipo: 'KGS_Y_UNIDADES' },
  { num: 30, cat: 'CARNE POLLO', nombre: 'Alas de pollo', unidad: 'Kg', precio: 21000, peso: 0.25, tipo: 'KGS_Y_UNIDADES' },
  { num: 31, cat: 'CARNE POLLO', nombre: 'Gallina (Criolla / Gigante)', unidad: 'Kg', precio: 11653, peso: 0.4, tipo: 'KGS_Y_UNIDADES' },
  { num: 32, cat: 'CARNE POLLO', nombre: 'Pechuga de pollo (Macpollo)', unidad: 'Kg', precio: 17500, peso: 0.35, tipo: 'KGS_Y_UNIDADES' },
  { num: 33, cat: 'CARNE POLLO', nombre: 'Víscera de pollo', unidad: 'Kg', precio: 3050, peso: 0.1, tipo: 'KGS_Y_UNIDADES' },

  // 4. PESCADOS Y FRUTOS DEL MAR (6)
  { num: 34, cat: 'PESCADOS Y MARISCOS', nombre: 'Tilapia roja fresca entera (450/550)', unidad: 'Kg', precio: 18000, peso: 0.44, tipo: 'KGS_Y_UNIDADES' },
  { num: 35, cat: 'PESCADOS Y MARISCOS', nombre: 'Salmón premium (Filete)', unidad: 'Kg', precio: 55000, peso: 0.3, tipo: 'KGS_Y_UNIDADES' },
  { num: 36, cat: 'PESCADOS Y MARISCOS', nombre: 'Trucha arcoíris entera', unidad: 'Kg', precio: 23000, peso: 0.24, tipo: 'KGS_Y_UNIDADES' },
  { num: 37, cat: 'PESCADOS Y MARISCOS', nombre: 'Bagre de mar', unidad: 'Kg', precio: 15500, peso: 0.25, tipo: 'KGS_Y_UNIDADES' },
  { num: 38, cat: 'PESCADOS Y MARISCOS', nombre: 'Camarón precocido de cultivo', unidad: 'Kg', precio: 22900, peso: 0.12, tipo: 'KGS_Y_UNIDADES' },
  { num: 39, cat: 'PESCADOS Y MARISCOS', nombre: 'Mix de mariscos surtido', unidad: 'Kg', precio: 24000, peso: 0.15, tipo: 'KGS_Y_UNIDADES' },

  // 5. EMBUTIDOS, CHORIZOS Y HUEVOS (4)
  { num: 40, cat: 'EMBUTIDOS', nombre: 'Chorizo Paisa tradicional', unidad: 'und', precio: 1200, peso: 0.1, tipo: 'UNIDADES' },
  { num: 41, cat: 'EMBUTIDOS', nombre: 'Chorizo coctelero / Premium', unidad: 'und', precio: 2400, peso: 0.15, tipo: 'UNIDADES' },
  { num: 42, cat: 'EMBUTIDOS', nombre: 'Morcilla / Rellena tradicional', unidad: 'Kg', precio: 19500, peso: 0.2, tipo: 'KGS_Y_UNIDADES' },
  { num: 43, cat: 'EMBUTIDOS', nombre: 'Huevos (Panal AA x 30 Unidades)', unidad: 'Panal', precio: 15000, peso: 0.055, tipo: 'PAQUETES' }
];

// ==========================================
// 2. MATRIZ DE INSUMOS OPERATIVOS (112 ítems)
// ==========================================
const INSUMOS_OPERATIVOS = [
  // 1. VERDURAS, HORTALIZAS Y FRUVER (36)
  { num: 1, cat: 'VERDURAS', nombre: 'Plátano verde', unidad: 'Kg', precio: 2000, tipo: 'KGS' },
  { num: 2, cat: 'VERDURAS', nombre: 'Plátano maduro', unidad: 'Kg', precio: 2000, tipo: 'KGS' },
  { num: 3, cat: 'VERDURAS', nombre: 'Papa capira (Bulto 50kg)', unidad: 'Bulto (50 Kg)', precio: 125000, tipo: 'PAQUETES' },
  { num: 4, cat: 'VERDURAS', nombre: 'Papa capira (Kilo)', unidad: 'Kg', precio: 2500, tipo: 'KGS' },
  { num: 5, cat: 'VERDURAS', nombre: 'Papa criolla / amarilla', unidad: 'Kg', precio: 5500, tipo: 'KGS' },
  { num: 6, cat: 'VERDURAS', nombre: 'Cebolla larga / junca', unidad: 'Kg (Atado)', precio: 2000, tipo: 'KGS' },
  { num: 7, cat: 'VERDURAS', nombre: 'Cebolla cabezona blanca', unidad: 'Kg', precio: 3500, tipo: 'KGS' },
  { num: 8, cat: 'VERDURAS', nombre: 'Tomate chonto', unidad: 'Kg', precio: 2500, tipo: 'KGS' },
  { num: 9, cat: 'VERDURAS', nombre: 'Tomate milano', unidad: 'Kg', precio: 2500, tipo: 'KGS' },
  { num: 10, cat: 'VERDURAS', nombre: 'Lechuga Batavia', unidad: 'Kg', precio: 2000, tipo: 'KGS' },
  { num: 11, cat: 'VERDURAS', nombre: 'Pepino cohombro', unidad: 'Kg', precio: 2500, tipo: 'KGS' },
  { num: 12, cat: 'VERDURAS', nombre: 'Pimentón rojo', unidad: 'Kg', precio: 5000, tipo: 'KGS' },
  { num: 13, cat: 'VERDURAS', nombre: 'Zanahoria', unidad: 'Kg', precio: 1800, tipo: 'KGS' },
  { num: 14, cat: 'VERDURAS', nombre: 'Mazorca choclo', unidad: 'Und', precio: 1400, tipo: 'UNIDADES' },
  { num: 15, cat: 'VERDURAS', nombre: 'Cilantro', unidad: 'Atado', precio: 8000, tipo: 'KGS' },
  { num: 16, cat: 'VERDURAS', nombre: 'Cimarrón', unidad: 'Atado', precio: 2000, tipo: 'KGS' },
  { num: 17, cat: 'VERDURAS', nombre: 'Limón Tahití (Bulto 55kg)', unidad: 'Bulto (55 Kg)', precio: 190000, tipo: 'PAQUETES' },
  { num: 18, cat: 'VERDURAS', nombre: 'Limón Tahití (Kilo)', unidad: 'Kg', precio: 3454.55, tipo: 'KGS' },
  { num: 19, cat: 'VERDURAS', nombre: 'Aguacate papelillo', unidad: 'Und', precio: 5000, tipo: 'UNIDADES' },
  { num: 20, cat: 'VERDURAS', nombre: 'Yuca', unidad: 'Kg', precio: 4500, tipo: 'KGS' },
  { num: 21, cat: 'VERDURAS', nombre: 'Arracacha', unidad: 'Kg', precio: 4000, tipo: 'KGS' },
  { num: 22, cat: 'VERDURAS', nombre: 'Zapallo / Ahuyama', unidad: 'Kg', precio: 1400, tipo: 'KGS' },
  { num: 23, cat: 'VERDURAS', nombre: 'Apio', unidad: 'Kg', precio: 2500, tipo: 'KGS' },
  { num: 24, cat: 'VERDURAS', nombre: 'Arveja verde desgranada', unidad: 'Kg', precio: 15000, tipo: 'KGS' },
  { num: 25, cat: 'VERDURAS', nombre: 'Habichuela', unidad: 'Kg', precio: 6000, tipo: 'KGS' },
  { num: 26, cat: 'VERDURAS', nombre: 'Brócoli', unidad: 'Kg', precio: 7000, tipo: 'KGS' },
  { num: 27, cat: 'VERDURAS', nombre: 'Coliflor', unidad: 'Kg', precio: 7000, tipo: 'KGS' },
  { num: 28, cat: 'VERDURAS', nombre: 'Espinaca', unidad: 'Kg', precio: 7000, tipo: 'KGS' },
  { num: 29, cat: 'VERDURAS', nombre: 'Fresa', unidad: 'Kg', precio: 4800, tipo: 'KGS' },
  { num: 30, cat: 'VERDURAS', nombre: 'Mango tommy', unidad: 'Kg', precio: 6000, tipo: 'KGS' },
  { num: 31, cat: 'VERDURAS', nombre: 'Mango biche', unidad: 'Kg', precio: 6000, tipo: 'KGS' },
  { num: 32, cat: 'VERDURAS', nombre: 'Manzana', unidad: 'Und', precio: 1200, tipo: 'UNIDADES' },
  { num: 33, cat: 'VERDURAS', nombre: 'Melón', unidad: 'Kg', precio: 3000, tipo: 'KGS' },
  { num: 34, cat: 'VERDURAS', nombre: 'Piña oromiel', unidad: 'Kg', precio: 3800, tipo: 'KGS' },
  { num: 35, cat: 'VERDURAS', nombre: 'Repollo morado', unidad: 'Kg', precio: 2800, tipo: 'KGS' },
  { num: 36, cat: 'VERDURAS', nombre: 'Limonada de coco (Pulpa artesanal)', unidad: 'Litro', precio: 26000, tipo: 'KGS' },

  // 2. GRANOS, ABARROTES, CONDIMENTOS Y LÁCTEOS (22)
  { num: 37, cat: 'GRANOS Y ABARROTES', nombre: 'Arroz blanco (Bulto 50kg)', unidad: 'Bulto (50 Kg)', precio: 254000, tipo: 'PAQUETES' },
  { num: 38, cat: 'GRANOS Y ABARROTES', nombre: 'Arroz blanco (Kilo)', unidad: 'Kg', precio: 5080, tipo: 'KGS' },
  { num: 39, cat: 'GRANOS Y ABARROTES', nombre: 'Sal refinada (Bulto 50kg)', unidad: 'Bulto (50 Kg)', precio: 70000, tipo: 'PAQUETES' },
  { num: 40, cat: 'GRANOS Y ABARROTES', nombre: 'Sal refinada (Kilo)', unidad: 'Kg', precio: 1400, tipo: 'KGS' },
  { num: 41, cat: 'GRANOS Y ABARROTES', nombre: 'Panela (Caja 40 und)', unidad: 'Caja (40 Und)', precio: 86000, tipo: 'PAQUETES' },
  { num: 42, cat: 'GRANOS Y ABARROTES', nombre: 'Fríjol cargamanto', unidad: 'Kg', precio: 12000, tipo: 'KGS' },
  { num: 43, cat: 'GRANOS Y ABARROTES', nombre: 'Blanquillo granel', unidad: 'Kg', precio: 11000, tipo: 'KGS' },
  { num: 44, cat: 'GRANOS Y ABARROTES', nombre: 'Aceite vegetal fritura (Bidón 20L)', unidad: 'Bidón (20 Litros)', precio: 116000, tipo: 'PAQUETES' },
  { num: 45, cat: 'GRANOS Y ABARROTES', nombre: 'Azúcar refinada granel', unidad: 'Kg', precio: 4200, tipo: 'KGS' },
  { num: 46, cat: 'GRANOS Y ABARROTES', nombre: 'Azúcar en sobre (Paq x 200)', unidad: 'Paquete (200 Und)', precio: 8400, tipo: 'PAQUETES' },
  { num: 47, cat: 'GRANOS Y ABARROTES', nombre: 'Leche entera institucional (1100 ml)', unidad: 'Bolsa (1.1 Litros)', precio: 4180, tipo: 'PAQUETES' },
  { num: 48, cat: 'GRANOS Y ABARROTES', nombre: 'Crema de leche (1000g)', unidad: 'Bolsa (1000g)', precio: 18200, tipo: 'PAQUETES' },
  { num: 49, cat: 'GRANOS Y ABARROTES', nombre: 'Leche de coco natural', unidad: 'Litro', precio: 21000, tipo: 'KGS' },
  { num: 50, cat: 'GRANOS Y ABARROTES', nombre: 'Arepas tela redonda', unidad: 'Und', precio: 150, tipo: 'UNIDADES' },
  { num: 51, cat: 'GRANOS Y ABARROTES', nombre: 'Harina de trigo', unidad: 'Kg', precio: 2100, tipo: 'KGS' },
  { num: 52, cat: 'GRANOS Y ABARROTES', nombre: 'Cuchuco de maíz sopa', unidad: 'Libra', precio: 3000, tipo: 'KGS' },
  { num: 53, cat: 'GRANOS Y ABARROTES', nombre: 'Color Azafrán condimento', unidad: 'Paquete (250g)', precio: 23800, tipo: 'PAQUETES' },
  { num: 54, cat: 'GRANOS Y ABARROTES', nombre: 'Milo en polvo', unidad: 'Kg', precio: 22000, tipo: 'KGS' },
  { num: 55, cat: 'GRANOS Y ABARROTES', nombre: 'Chocolate de mesa', unidad: 'Kg', precio: 22000, tipo: 'KGS' },
  { num: 56, cat: 'GRANOS Y ABARROTES', nombre: 'Salsa Mayonesa granel', unidad: 'Bolsa (1000g)', precio: 30350, tipo: 'PAQUETES' },
  { num: 57, cat: 'GRANOS Y ABARROTES', nombre: 'Salsa Mostaza granel', unidad: 'Bolsa (1000g)', precio: 18650, tipo: 'PAQUETES' },
  { num: 58, cat: 'GRANOS Y ABARROTES', nombre: 'Vinagre blanco', unidad: 'Frasco (1000 ml)', precio: 7200, tipo: 'PAQUETES' },

  // 3. DESECHABLES, EMPAQUES Y PRODUCTOS DE ASEO (28)
  { num: 59, cat: 'DESECHABLES', nombre: 'Contenedor térmico sopero 16 oz', unidad: 'Paquete (25 Und)', precio: 11200, tipo: 'PAQUETES' },
  { num: 60, cat: 'DESECHABLES', nombre: 'Contenedor térmico sopero 8 oz', unidad: 'Paquete (25 Und)', precio: 9100, tipo: 'PAQUETES' },
  { num: 61, cat: 'DESECHABLES', nombre: 'Portacomida térmico J2', unidad: 'Und', precio: 440, tipo: 'UNIDADES' },
  { num: 62, cat: 'DESECHABLES', nombre: 'Portacomida térmico J1', unidad: 'Und', precio: 440, tipo: 'UNIDADES' },
  { num: 63, cat: 'DESECHABLES', nombre: 'Portacomida térmico C1', unidad: 'Und', precio: 270, tipo: 'UNIDADES' },
  { num: 64, cat: 'DESECHABLES', nombre: 'Vaso plástico 9 oz vacón', unidad: 'Paquete (50 Und)', precio: 4800, tipo: 'PAQUETES' },
  { num: 65, cat: 'DESECHABLES', nombre: 'Vaso plástico 3.5 oz', unidad: 'Paquete (50 Und)', precio: 2750, tipo: 'PAQUETES' },
  { num: 66, cat: 'DESECHABLES', nombre: 'Tapa vaso 3.5 oz', unidad: 'Paquete (50 Und)', precio: 4850, tipo: 'PAQUETES' },
  { num: 67, cat: 'DESECHABLES', nombre: 'Vaso plástico Tami 12 oz', unidad: 'Paquete (50 Und)', precio: 5000, tipo: 'PAQUETES' },
  { num: 68, cat: 'DESECHABLES', nombre: 'Tapa vaso Tami 12 oz', unidad: 'Paquete (50 Und)', precio: 5000, tipo: 'PAQUETES' },
  { num: 69, cat: 'DESECHABLES', nombre: 'Copa degustación 1/2 oz con tapa', unidad: 'Paquete (50 Und)', precio: 2500, tipo: 'PAQUETES' },
  { num: 70, cat: 'DESECHABLES', nombre: 'Servilletas dispensador 1 a 1', unidad: 'Paquete (100 Und)', precio: 2000, tipo: 'PAQUETES' },
  { num: 71, cat: 'DESECHABLES', nombre: 'Salsa de tomate en sobre (x 120)', unidad: 'Paquete (120 Und)', precio: 20950, tipo: 'PAQUETES' },
  { num: 72, cat: 'DESECHABLES', nombre: 'Cubierto grande x 3 (Tenedor/Cuchillo/Serv)', unidad: 'Paquete / Set', precio: 390, tipo: 'PAQUETES' },
  { num: 73, cat: 'DESECHABLES', nombre: 'Bolsa manigueta T19', unidad: 'Paquete (100 Und)', precio: 2400, tipo: 'PAQUETES' },
  { num: 74, cat: 'DESECHABLES', nombre: 'Bolsa manigueta T25', unidad: 'Paquete (100 Und)', precio: 4600, tipo: 'PAQUETES' },
  { num: 75, cat: 'DESECHABLES', nombre: 'Bolsa manigueta T40', unidad: 'Paquete (100 Und)', precio: 9600, tipo: 'PAQUETES' },
  { num: 76, cat: 'DESECHABLES', nombre: 'Bolsa basura 65x90 negra', unidad: 'Paquete / Und', precio: 450, tipo: 'UNIDADES' },
  { num: 77, cat: 'DESECHABLES', nombre: 'Bolsa plástica transparente', unidad: 'Und', precio: 300, tipo: 'UNIDADES' },
  { num: 78, cat: 'DESECHABLES', nombre: 'Papel higiénico institucional jumbo 250m', unidad: 'Rollo (250m)', precio: 11400, tipo: 'PAQUETES' },
  { num: 79, cat: 'DESECHABLES', nombre: 'Toalla de mano Z Natural', unidad: 'Paquete (150 Und)', precio: 5200, tipo: 'PAQUETES' },
  { num: 80, cat: 'DESECHABLES', nombre: 'Jabón en polvo Dersa limón (1000g)', unidad: 'Kilo (1000g)', precio: 10600, tipo: 'PAQUETES' },
  { num: 81, cat: 'DESECHABLES', nombre: 'Alcohol antiséptico galón', unidad: 'Galón', precio: 26950, tipo: 'KGS' },
  { num: 82, cat: 'DESECHABLES', nombre: 'Desengrasante industrial Tak Tax', unidad: 'Galón', precio: 38900, tipo: 'KGS' },
  { num: 83, cat: 'DESECHABLES', nombre: 'Pato limpiador tanque azul', unidad: 'Und', precio: 7600, tipo: 'UNIDADES' },
  { num: 84, cat: 'DESECHABLES', nombre: 'Ambientador concentrado canela', unidad: 'Frasco (1000 ml)', precio: 6900, tipo: 'PAQUETES' },
  { num: 85, cat: 'DESECHABLES', nombre: 'Cloro / Límpido desinfectante galón', unidad: 'Galón', precio: 14500, tipo: 'KGS' },
  { num: 86, cat: 'DESECHABLES', nombre: 'Esponjilla brillo industrial', unidad: 'Paquete (3 Und)', precio: 3600, tipo: 'PAQUETES' },

  // 4. BEBIDAS DE TOMAR (23)
  { num: 87, cat: 'BEBIDAS', nombre: 'Cerveza Poker (Lata 330 ml)', unidad: 'Lata (Paca x 24)', precio: 3125, tipo: 'UNIDADES' },
  { num: 88, cat: 'BEBIDAS', nombre: 'Cerveza Águila Light (Lata 330 ml)', unidad: 'Lata (Paca x 24)', precio: 3125, tipo: 'UNIDADES' },
  { num: 89, cat: 'BEBIDAS', nombre: 'Cerveza Club Colombia Dorada (Lata 330 ml)', unidad: 'Lata (Paca x 24)', precio: 3229.17, tipo: 'UNIDADES' },
  { num: 90, cat: 'BEBIDAS', nombre: 'Cerveza Corona Extra (Botella 330 ml)', unidad: 'Botella (Caja x 24)', precio: 3875, tipo: 'UNIDADES' },
  { num: 91, cat: 'BEBIDAS', nombre: 'Cerveza Coronita (Botella 210 ml)', unidad: 'Botella (Caja x 24)', precio: 3458.33, tipo: 'UNIDADES' },
  { num: 92, cat: 'BEBIDAS', nombre: 'Cerveza Costeñita (Botella 175 ml)', unidad: 'Botella (Caja x 24)', precio: 2904.17, tipo: 'UNIDADES' },
  { num: 93, cat: 'BEBIDAS', nombre: 'Cerveza Stella Artois (Botella 300 ml)', unidad: 'Botella (Caja x 24)', precio: 3841.67, tipo: 'UNIDADES' },
  { num: 94, cat: 'BEBIDAS', nombre: 'Guarapo Tradicional La Finca (x 24)', unidad: 'Botella (Caja x 24)', precio: 7500, tipo: 'UNIDADES' },
  { num: 95, cat: 'BEBIDAS', nombre: 'Gaseosa Coca-Cola / Sabores PET 400 ml', unidad: 'Botella (Caja x 12)', precio: 2500, tipo: 'UNIDADES' },
  { num: 96, cat: 'BEBIDAS', nombre: 'Gaseosa Postobón Vidrio Retornable 350 ml', unidad: 'Botella (Caja x 30)', precio: 1500, tipo: 'UNIDADES' },
  { num: 97, cat: 'BEBIDAS', nombre: 'Coca-Cola Vidrio Retornable 350 ml', unidad: 'Botella (Caja x 30)', precio: 2083.33, tipo: 'UNIDADES' },
  { num: 98, cat: 'BEBIDAS', nombre: 'Gaseosa Postobón 1/4 (250 ml Vidrio)', unidad: 'Botella (Caja x 30)', precio: 1726.67, tipo: 'UNIDADES' },
  { num: 99, cat: 'BEBIDAS', nombre: 'Gaseosa Mega 3 Litros PET', unidad: 'Botella (Caja x 6)', precio: 9583.33, tipo: 'UNIDADES' },
  { num: 100, cat: 'BEBIDAS', nombre: 'Agua Cristal / Brisa PET 600 ml', unidad: 'Botella (Caja x 24)', precio: 1333.33, tipo: 'UNIDADES' },
  { num: 101, cat: 'BEBIDAS', nombre: 'Soda Bretaña Vidrio Retornable 350 ml', unidad: 'Botella (Caja x 24)', precio: 1916.67, tipo: 'UNIDADES' },
  { num: 102, cat: 'BEBIDAS', nombre: 'H2OH! Sabores PET 600 ml', unidad: 'Botella (Paca x 12)', precio: 2166.67, tipo: 'UNIDADES' },
  { num: 103, cat: 'BEBIDAS', nombre: 'Canada Dry / Ginger 300 ml', unidad: 'Botella / Lata', precio: 2083.33, tipo: 'UNIDADES' },
  { num: 104, cat: 'BEBIDAS', nombre: 'Gatorade Sabores PET 500 ml', unidad: 'Botella (Caja x 24)', precio: 3250, tipo: 'UNIDADES' },
  { num: 105, cat: 'BEBIDAS', nombre: 'Mr Tea Limón / Durazno PET 500 ml', unidad: 'Botella (Paca x 12)', precio: 2250, tipo: 'UNIDADES' },
  { num: 106, cat: 'BEBIDAS', nombre: 'Pony Malta PET 330 ml', unidad: 'Botella (Paca x 24)', precio: 2537.5, tipo: 'UNIDADES' },
  { num: 107, cat: 'BEBIDAS', nombre: 'Vive 100 Energizante PET 380 ml', unidad: 'Botella (Paca x 24)', precio: 2150, tipo: 'UNIDADES' },
  { num: 108, cat: 'BEBIDAS', nombre: 'Jugo Hit Sabores PET 500 ml', unidad: 'Botella (Paca x 12)', precio: 2500, tipo: 'UNIDADES' },
  { num: 109, cat: 'BEBIDAS', nombre: 'Jugo Del Valle / Nutiva Caja 200 ml', unidad: 'Caja Tetra (200 ml)', precio: 700, tipo: 'UNIDADES' },

  // 5. SERVICIOS OPERATIVOS E INSUMOS (3)
  { num: 110, cat: 'SERVICIOS', nombre: 'Hielo en Bloque (Media)', unidad: 'Bloque', precio: 9500, tipo: 'UNIDADES' },
  { num: 111, cat: 'SERVICIOS', nombre: 'Hielo Tubular en Bolsa 5kg', unidad: 'Bolsa (5 Kg)', precio: 5000, tipo: 'PAQUETES' },
  { num: 112, cat: 'SERVICIOS', nombre: 'Carbón vegetal para asador (Bulto)', unidad: 'Bulto', precio: 40000, tipo: 'PAQUETES' }
];

async function seed() {
  console.log('1. Preparando lista consolidada oficial...');

  // Mapear carnes a records de catalogo_insumos
  const meatRecords = CARNES.map((c) => {
    const codeNum = String(c.num).padStart(3, '0');
    return {
      codigo: `CAR-${codeNum}`,
      nombre: c.nombre.trim(),
      categoria: c.cat,
      es_carne: true,
      unidad_medida: c.unidad,
      peso_estandar_porcion_kg: c.peso,
      costo_unitario_kg: c.precio,
      stock_minimo_kg: 10,
      activo: true,
      tipo_medida: c.tipo
    };
  });

  // Mapear insumos operativos
  const opRecords = INSUMOS_OPERATIVOS.map((o) => {
    const prefixMap = {
      'VERDURAS': 'VER',
      'GRANOS Y ABARROTES': 'GRA',
      'DESECHABLES': 'DES',
      'BEBIDAS': 'BEB',
      'SERVICIOS': 'SER'
    };
    const prefix = prefixMap[o.cat] || 'INS';
    const codeNum = String(o.num).padStart(3, '0');
    return {
      codigo: `${prefix}-${codeNum}`,
      nombre: o.nombre.trim(),
      categoria: o.cat,
      es_carne: false,
      unidad_medida: o.unidad,
      peso_estandar_porcion_kg: 0,
      costo_unitario_kg: o.precio,
      stock_minimo_kg: 5,
      activo: true,
      tipo_medida: o.tipo
    };
  });

  const totalRecords = [...meatRecords, ...opRecords];
  console.log(`Total a insertar: ${totalRecords.length} ítems (${meatRecords.length} carnes + ${opRecords.length} insumos operativos)`);

  // 2. Vaciar catalogo_insumos
  console.log('2. Vaciando catalogo_insumos en Supabase...');
  const { error: delErr } = await supabase.from('catalogo_insumos').delete().neq('nombre', '__DUMMY_GUARD__');
  if (delErr) {
    console.error('Error al vaciar catalogo_insumos:', delErr);
    process.exit(1);
  }
  console.log('Tabla catalogo_insumos vaciada correctamente.');

  // 3. Insertar registros en lotes de 25
  console.log('3. Insertando registros consolidados oficiales...');
  const batchSize = 25;
  for (let i = 0; i < totalRecords.length; i += batchSize) {
    const batch = totalRecords.slice(i, i + batchSize);
    const { data, error } = await supabase.from('catalogo_insumos').insert(batch).select();
    if (error) {
      console.error(`Error insertando lote ${i} a ${i + batch.length}:`, error);
      process.exit(1);
    }
    console.log(` Insertados ${Math.min(i + batchSize, totalRecords.length)} / ${totalRecords.length}`);
  }

  // 4. Verificación final
  const { count: finalCount } = await supabase.from('catalogo_insumos').select('*', { count: 'exact', head: true });
  const { count: stockCount } = await supabase.from('stock_actual').select('*', { count: 'exact', head: true });
  console.log(`=== MIGRACIÓN COMPLETADA EXITOSAMENTE ===`);
  console.log(`catalogo_insumos total: ${finalCount}`);
  console.log(`stock_actual total: ${stockCount}`);
}

seed();
