import catalogoOficial from '@/lib/catalogo-oficial.json';

export type SeccionConteoKey = 
  | 'COCINA_APERTURA' 
  | 'TRASLADOS' 
  | 'DEVOLUCIONES' 
  | 'COCINA_CIERRE' 
  | 'CONSUMOS' 
  | 'BODEGA_APERTURA' 
  | 'BODEGA_CIERRE';

export const SECCIONES_CONTEO_CONFIG: Record<
  SeccionConteoKey, 
  { label: string; operationalView: string; color: string; description: string }
> = {
  COCINA_APERTURA: {
    label: 'Cocina Apertura',
    operationalView: 'COCINA_APERTURA',
    color: 'emerald',
    description: 'Inventario inicial al inicio de la jornada en cocina'
  },
  TRASLADOS: {
    label: 'Movimientos a Cocina',
    operationalView: 'TRASLADOS',
    color: 'indigo',
    description: 'Insumos trasladados desde Bodega a Cocina'
  },
  DEVOLUCIONES: {
    label: 'Devoluciones a Bodega',
    operationalView: 'DEVOLUCIONES',
    color: 'amber',
    description: 'Insumos devueltos de Cocina a Bodega'
  },
  COCINA_CIERRE: {
    label: 'Cocina Cierre',
    operationalView: 'COCINA_CIERRE',
    color: 'blue',
    description: 'Conteo final al cierre de la cocina'
  },
  CONSUMOS: {
    label: 'Consumos Internos',
    operationalView: 'CONSUMOS',
    color: 'purple',
    description: 'Consumos del personal, cortesías o mermas operativas'
  },
  BODEGA_APERTURA: {
    label: 'Bodega Apertura',
    operationalView: 'BODEGA_APERTURA',
    color: 'teal',
    description: 'Inventario inicial en bodega general'
  },
  BODEGA_CIERRE: {
    label: 'Bodega Cierre (Bebidas)',
    operationalView: 'BODEGA_CIERRE',
    color: 'slate',
    description: 'Conteo final de bodega general y bebidas'
  }
};

export interface ConteoItemParsed {
  id: string;
  rawTextOriginal: string;
  catalogItemId: string | null;
  nombreCanonical: string;
  categoria: string;
  cantidad: number;
  unidad: string;
  costoUnitario: number;
  subtotal: number;
  detalle: string;
  isMatched: boolean;
}

export interface ConteoSeccionParsed {
  key: SeccionConteoKey;
  label: string;
  items: ConteoItemParsed[];
}

export interface ConteoArchivoParsed {
  fecha: string | null;
  observaciones: string;
  secciones: Record<SeccionConteoKey, ConteoSeccionParsed>;
  seccionesConDatos: SeccionConteoKey[];
  totalItems: number;
  totalMatched: number;
  totalUnmatched: number;
}

export function normalizeStr(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Mapeo inteligente con catálogo oficial de La Finca
 */
export function matchCatalogItem(rawName: string, catalog: any[] = catalogoOficial): any | null {
  if (!rawName) return null;
  const n = normalizeStr(rawName);

  // 1. Coincidencia exacta por nombre oficial normalizado
  const exact = catalog.find((c: any) => normalizeStr(c.nombre) === n);
  if (exact) return exact;

  // 2. Diccionario de equivalencias canónicas frecuentes en La Finca
  const aliasRules: Array<{ test: (s: string) => boolean; target: string }> = [
    { test: s => s.includes('repollo') && s.includes('morad'), target: 'repollo morado' },
    { test: s => s.includes('repollo'), target: 'repollo blanco' },
    { test: s => s.includes('huevo'), target: 'huevos frescos aa' },
    { test: s => s.includes('yuca'), target: 'yuca' },
    { test: s => s.includes('platano') && s.includes('madur'), target: 'platano maduro' },
    { test: s => s.includes('platano') && s.includes('verd'), target: 'platano verde' },
    { test: s => s.includes('leche') && !s.includes('mazamorra'), target: 'leche entera' },
    { test: s => s.includes('mazamorra'), target: 'mazamorra' },
    { test: s => s.includes('tomate') && (s.includes('chonto') || !s.includes('arbol')), target: 'tomate chonto' },
    { test: s => s.includes('tomate') && s.includes('arbol'), target: 'tomate de arbol' },
    { test: s => s.includes('cebolla') && (s.includes('cabezona') || s.includes('blanca')), target: 'cebolla cabezona' },
    { test: s => s.includes('cebolla') && (s.includes('larga') || s.includes('junca')), target: 'cebolla larga' },
    { test: s => s.includes('batavia') || s.includes('lechuga'), target: 'lechuga batavia' },
    { test: s => s.includes('pimenton'), target: 'pimenton rojo' },
    { test: s => s.includes('zanahoria'), target: 'zanahoria' },
    { test: s => s.includes('papa') && s.includes('criolla'), target: 'papa criolla' },
    { test: s => s.includes('papa') && (s.includes('pastusa') || s.includes('negra')), target: 'papa pastusa' },
    { test: s => s.includes('francesa'), target: 'papas a la francesa' },
    { test: s => s.includes('limon') || s.includes('tahiti'), target: 'limon tahiti' },
    { test: s => s.includes('aguacate'), target: 'aguacate papelillo' },
    { test: s => s.includes('cilantro'), target: 'cilantro' },
    { test: s => s.includes('chicharron') || s.includes('tocino'), target: 'tocino / chicharron cocina' },
    { test: s => s.includes('chorizo') && s.includes('paisa'), target: 'chorizo paisa tradicional' },
    { test: s => s.includes('chorizo') && s.includes('pollo'), target: 'chorizo de pollo' },
    { test: s => s.includes('chorizo') && (s.includes('cerdo') || s.includes('grande')), target: 'chorizo grande / choricerdo' },
    { test: s => s.includes('rellena') || s.includes('morcilla'), target: 'rellena / morcilla tradicional' },
    { test: s => s.includes('costilla') && s.includes('ahumad'), target: 'costilla ahumada de cerdo' },
    { test: s => s.includes('costilla') && (s.includes('san luis') || s.includes('cerdo')), target: 'costilla san luis cerdo' },
    { test: s => s.includes('lengua'), target: 'lengua de res' },
    { test: s => s.includes('baby') || (s.includes('lomo') && s.includes('viche')), target: 'baby beef (lomo viche)' },
    { test: s => s.includes('churrasco') || s.includes('caracho'), target: 'lomo de caracho (churrasco)' },
    { test: s => s.includes('punta de anca'), target: 'punta de anca res' },
    { test: s => s.includes('sobrebarriga'), target: 'sobrebarriga delgada' },
    { test: s => s.includes('trucha'), target: 'trucha arcoiris entera' },
    { test: s => s.includes('tilapia'), target: 'tilapia roja fresca entera' },
    { test: s => s.includes('salmon'), target: 'salmon' },
    { test: s => s.includes('camaron'), target: 'camaron' },
    { test: s => s.includes('alguacil'), target: 'pescado alguacil' },
    { test: s => s.includes('pechuga') || (s.includes('pollo') && s.includes('filete')), target: 'filete de pechuga pollo' },
    { test: s => s.includes('pollo entero') || s.includes('gallina') || s.includes('presa'), target: 'pollo entero' },
    { test: s => s.includes('club colombia'), target: 'cerveza club colombia' },
    { test: s => s.includes('aguila light'), target: 'cerveza aguila light' },
    { test: s => s.includes('aguila original'), target: 'cerveza aguila' },
    { test: s => s.includes('poker'), target: 'cerveza poker' },
    { test: s => s.includes('heineken'), target: 'cerveza heineken' },
    { test: s => s.includes('postobon') || s.includes('manzana') || s.includes('colombiana'), target: 'gaseosa postobon' },
    { test: s => s.includes('coca cola') || s.includes('cocacola'), target: 'coca cola' },
    { test: s => s.includes('cristal') || (s.includes('agua') && s.includes('600')), target: 'agua cristal' },
    { test: s => s.includes('servilleta'), target: 'servilletas' },
    { test: s => s.includes('vaso') && s.includes('9'), target: 'vaso plastico 9 oz' },
    { test: s => s.includes('vaso') && s.includes('12'), target: 'vaso plastico tami 12 oz' },
    { test: s => s.includes('aceite'), target: 'aceite' },
    { test: s => s.includes('arroz'), target: 'arroz' }
  ];

  for (const rule of aliasRules) {
    if (rule.test(n)) {
      const match = catalog.find((c: any) => normalizeStr(c.nombre).includes(rule.target));
      if (match) return match;
    }
  }

  // 3. Coincidencia parcial (el catálogo contiene las palabras clave del insumo o viceversa)
  const tokens = n.split(/\s+/).filter(w => w.length > 3);
  if (tokens.length > 0) {
    const partial = catalog.find((c: any) => {
      const cn = normalizeStr(c.nombre);
      const matchCount = tokens.filter(t => cn.includes(t)).length;
      return matchCount >= Math.min(2, tokens.length);
    });
    if (partial) return partial;
  }

  return null;
}

/**
 * Extrae y parsea el archivo de texto estructurado de conteos
 */
export function parseConteosTxt(
  text: string, 
  catalog: any[] = catalogoOficial
): ConteoArchivoParsed {
  const result: ConteoArchivoParsed = {
    fecha: null,
    observaciones: '',
    secciones: {
      COCINA_APERTURA: { key: 'COCINA_APERTURA', label: SECCIONES_CONTEO_CONFIG.COCINA_APERTURA.label, items: [] },
      TRASLADOS: { key: 'TRASLADOS', label: SECCIONES_CONTEO_CONFIG.TRASLADOS.label, items: [] },
      DEVOLUCIONES: { key: 'DEVOLUCIONES', label: SECCIONES_CONTEO_CONFIG.DEVOLUCIONES.label, items: [] },
      COCINA_CIERRE: { key: 'COCINA_CIERRE', label: SECCIONES_CONTEO_CONFIG.COCINA_CIERRE.label, items: [] },
      CONSUMOS: { key: 'CONSUMOS', label: SECCIONES_CONTEO_CONFIG.CONSUMOS.label, items: [] },
      BODEGA_APERTURA: { key: 'BODEGA_APERTURA', label: SECCIONES_CONTEO_CONFIG.BODEGA_APERTURA.label, items: [] },
      BODEGA_CIERRE: { key: 'BODEGA_CIERRE', label: SECCIONES_CONTEO_CONFIG.BODEGA_CIERRE.label, items: [] }
    },
    seccionesConDatos: [],
    totalItems: 0,
    totalMatched: 0,
    totalUnmatched: 0
  };

  if (!text || !text.trim()) return result;

  const lines = text.split(/\r?\n/);
  let currentSection: SeccionConteoKey | null = null;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detectar Fecha
    const fechaMatch = line.match(/^FECHA\s*:\s*(\d{4}-\d{2}-\d{2})/i);
    if (fechaMatch) {
      result.fecha = fechaMatch[1];
      continue;
    }

    // Detectar Observaciones
    const obsMatch = line.match(/^OBSERVACIONES\s*:\s*(.+)$/i);
    if (obsMatch && !obsMatch[1].toLowerCase().includes('sin observaciones')) {
      result.observaciones = obsMatch[1].trim();
      continue;
    }

    // Detectar Encabezados de Sección
    const normLine = normalizeStr(line);
    if (normLine.includes('1.') && normLine.includes('cocina apertura') || normLine === 'cocina apertura') {
      currentSection = 'COCINA_APERTURA';
      continue;
    }
    if (normLine.includes('2.') && (normLine.includes('movimientos') || normLine.includes('traslados')) || normLine.includes('movimientos a cocina')) {
      currentSection = 'TRASLADOS';
      continue;
    }
    if (normLine.includes('3.') && normLine.includes('devolucion') || normLine.includes('devoluciones a bodega')) {
      currentSection = 'DEVOLUCIONES';
      continue;
    }
    if (normLine.includes('4.') && normLine.includes('cocina cierre') || normLine === 'cocina cierre') {
      currentSection = 'COCINA_CIERRE';
      continue;
    }
    if (normLine.includes('5.') && (normLine.includes('consumos') || normLine.includes('personal')) || normLine.includes('consumos internos')) {
      currentSection = 'CONSUMOS';
      continue;
    }
    if (normLine.includes('6.') && normLine.includes('bodega apertura') || normLine === 'bodega apertura') {
      currentSection = 'BODEGA_APERTURA';
      continue;
    }
    if (normLine.includes('7.') && (normLine.includes('bodega cierre') || normLine.includes('bebidas')) || normLine.includes('bodega cierre')) {
      currentSection = 'BODEGA_CIERRE';
      continue;
    }

    // Omitir separadores decorativos o etiquetas de fin
    if (line.startsWith('=') || line.startsWith('#') || normLine.includes('fin del archivo') || normLine.includes('formato:')) {
      continue;
    }

    // Omitir indicadores de [SIN REGISTROS]
    if (normLine.includes('[sin registros]') || normLine.includes('sin registros') || normLine === 'ninguno') {
      continue;
    }

    // Si estamos dentro de una sección, parsear el ítem
    if (currentSection) {
      // Limpiar prefijo '-' o '*' o bullets
      const cleanLine = line.replace(/^[-*•\d+.]\s*/, '').trim();
      if (!cleanLine) continue;

      let rawName = '';
      let rawQty = 0;
      let rawUnit = 'Kg';
      let detalle = '';

      if (cleanLine.includes('|')) {
        // Formato separado por barras
        const parts = cleanLine.split('|').map(p => p.trim());
        rawName = parts[0] || '';
        
        if (parts[1]) {
          const parsedNum = parseFloat(parts[1].replace(',', '.'));
          rawQty = isNaN(parsedNum) ? 0 : parsedNum;
        }

        if (parts[2]) {
          rawUnit = parts[2];
        }

        if (parts[3]) {
          detalle = parts[3];
        }
      } else {
        // Formato libre o con dos puntos: Ej. "Lomo de res: 4.5 Kg (15 porciones)"
        const colonSplit = cleanLine.split(':');
        if (colonSplit.length >= 2) {
          rawName = colonSplit[0].trim();
          const rest = colonSplit.slice(1).join(':').trim();
          const numMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)?/);
          if (numMatch) {
            rawQty = parseFloat(numMatch[1].replace(',', '.')) || 0;
            rawUnit = numMatch[2] || 'Kg';
          }
          detalle = rest.replace(/(\d+(?:[.,]\d+)?)\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)?/, '').replace(/^\s*[-(),]\s*/, '').trim();
        } else {
          // Intento regex: "Tomate chonto 12 kg"
          const match = cleanLine.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?(?:\s+(.*))?$/);
          if (match) {
            rawName = match[1].trim();
            rawQty = parseFloat(match[2].replace(',', '.')) || 0;
            rawUnit = match[3] || 'Kg';
            detalle = match[4]?.trim() || '';
          } else {
            rawName = cleanLine;
            rawQty = 0;
          }
        }
      }

      if (!rawName) continue;

      // Normalizar unidad
      const unitNorm = normalizeStr(rawUnit);
      let standardizedUnit = 'Kg';
      if (unitNorm === 'und' || unitNorm === 'unds' || unitNorm.includes('unidad')) {
        standardizedUnit = 'Und';
      } else if (unitNorm === 'g' || unitNorm === 'gr' || unitNorm.includes('gramo')) {
        standardizedUnit = 'Gramos';
      } else if (unitNorm.includes('bot') || unitNorm.includes('caja')) {
        standardizedUnit = 'Botella';
      } else if (unitNorm.includes('porc')) {
        standardizedUnit = 'Porción';
      }

      // Buscar coincidencia en catálogo
      const matched = matchCatalogItem(rawName, catalog);
      const isMatched = !!matched;
      const catalogItemId = matched?.id || null;
      const nombreCanonical = matched?.nombre || '';
      const categoria = matched?.categoria || 'Sin vincular';
      const costoUnitario = Number(matched?.costo_unitario_kg || matched?.costo_unitario || 0);
      const subtotal = Math.round(rawQty * costoUnitario);

      const parsedItem: ConteoItemParsed = {
        id: `conteo-item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        rawTextOriginal: rawName,
        catalogItemId,
        nombreCanonical,
        categoria,
        cantidad: rawQty,
        unidad: standardizedUnit,
        costoUnitario,
        subtotal,
        detalle,
        isMatched
      };

      result.secciones[currentSection].items.push(parsedItem);
      result.totalItems++;
      if (isMatched) {
        result.totalMatched++;
      } else {
        result.totalUnmatched++;
      }
    }
  }

  // Identificar secciones que tienen al menos un ítem
  (Object.keys(result.secciones) as SeccionConteoKey[]).forEach(key => {
    if (result.secciones[key].items.length > 0) {
      result.seccionesConDatos.push(key);
    }
  });

  return result;
}

/**
 * Prompt oficial estandarizado para que cualquier IA procese fotos de planillas físicas
 */
export const PROMPT_IMPORTAR_CONTEOS = `Eres un asistente experto en digitalización de inventarios y conteos físicos del restaurante campestre "La Finca".
Tu misión es recibir fotos o transcripciones de planillas físicas diarias de conteos y generar UN ÚNICO archivo de texto plano (.txt) perfectamente estructurado y estandarizado para el sistema contable de La Finca.

INSTRUCCIONES CLAVE:
1. Extrae los conteos de cada foto y organízalos estrictamente en las siguientes 7 secciones operativas:
   1. COCINA APERTURA (Inventario inicial de cocina en la mañana)
   2. MOVIMIENTOS A COCINA (Insumos trasladados desde Bodega a Cocina)
   3. DEVOLUCIONES A BODEGA (Insumos devueltos de Cocina a Bodega)
   4. COCINA CIERRE (Conteo físico nocturno al finalizar el servicio en cocina)
   5. CONSUMOS INTERNOS (Consumos de personal, cortesías o mermas)
   6. BODEGA APERTURA (Inventario inicial en Bodega general)
   7. BODEGA CIERRE (INCLUYE BEBIDAS) (Conteo final de carnes, abarrotes y bebidas en bodega)

2. ESTRUCTURA FIJA Y OBLIGATORIA:
   - El archivo .txt SIEMPRE debe contener las 7 secciones en el mismo orden, incluso si alguna hoja no tiene insumos o no se proporcionó foto.
   - Si una sección no tiene registros o no hay foto de ella, escribe obligatoriamente: [SIN REGISTROS]

3. FORMATO DE CADA LÍNEA DE INSUMO:
   Escribe cada insumo en una línea individual con el formato separado por barras verticales (|):
   - Insumo | Cantidad | Unidad | Detalle/Observación (opcional)

   Ejemplos:
   - Lomo de caracho (Churrasco) | 4.5 | Kg | 15 porciones
   - Tomate chonto | 12.0 | Kg | Canastilla bodega
   - Cerveza Club Colombia | 48 | Und | 2 petacas
   - Cerveza Águila Light | 36 | Und
   - Gaseosa Postobón 350ml | 3 | Und | Almuerzo personal
   - Costilla San Luis cerdo | 8.2 | Kg
   - Tocino / Chicharrón cocina | 10.5 | Kg
   - Papas a la francesa | 15.0 | Kg | Bolsas congelador

4. REGLAS DE NOMBRES Y UNIDADES:
   - Usa los nombres canónicos del catálogo de La Finca:
     * Carnes: "Punta de anca res", "Lomo de caracho (Churrasco)", "Baby beef (Lomo viche)", "Sobrebarriga delgada", "Costilla San Luis cerdo", "Costilla ahumada de cerdo", "Tocino / Chicharrón cocina", "Chorizo Paisa tradicional", "Chorizo de pollo", "Rellena / Morcilla tradicional", "Lengua de res", "Filete de pechuga pollo", "Pollo entero / Presas (Sancocho/Tamal)", "Trucha arcoíris entera", "Tilapia roja fresca entera", "Salmón premium (Filete)", "Camarón precocido de cultivo".
     * Fruver/Verduras: "Tomate chonto", "Cebolla cabezona", "Cebolla larga", "Plátano maduro", "Plátano verde", "Yuca", "Papa criolla", "Papa pastusa", "Papas a la francesa", "Zanahoria", "Pimentón rojo", "Lechuga Batavia", "Repollo morado", "Limón Tahití", "Aguacate papelillo", "Cilantro", "Mazorca choclo".
     * Abarrotes y Lácteos: "Huevos frescos AA", "Leche entera institucional", "Arroz blanco institucional", "Aceite vegetal 20L", "Mazamorra con leche / Maíz peto".
     * Bebidas: "Cerveza Club Colombia", "Cerveza Águila Light", "Cerveza Águila Original", "Cerveza Poker", "Cerveza Heineken", "Gaseosa Postobón 350ml", "Coca Cola 350ml", "Agua Cristal / Brisa PET 600 ml".
   - Unidades permitidas: Kg, Gramos, Und, Botella, Porción.

5. PLANTILLA EXACTA A GENERAR (Devuelve solo este texto plano):
======================================================================
HOJA DE COSTEO DIARIO - IMPORTACIÓN DE CONTEOS LA FINCA
======================================================================
FECHA: YYYY-MM-DD
OBSERVACIONES: Conteo oficial extraído de planillas físicas

======================================================================
1. COCINA APERTURA
======================================================================
[SIN REGISTROS]

======================================================================
2. MOVIMIENTOS A COCINA
======================================================================
[SIN REGISTROS]

======================================================================
3. DEVOLUCIONES A BODEGA
======================================================================
[SIN REGISTROS]

======================================================================
4. COCINA CIERRE
======================================================================
[SIN REGISTROS]

======================================================================
5. CONSUMOS INTERNOS
======================================================================
[SIN REGISTROS]

======================================================================
6. BODEGA APERTURA
======================================================================
[SIN REGISTROS]

======================================================================
7. BODEGA CIERRE (INCLUYE BEBIDAS)
======================================================================
[SIN REGISTROS]
======================================================================
FIN DEL ARCHIVO
`;
