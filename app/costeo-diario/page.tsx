'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet,
  ClipboardList, 
  Plus, 
  X, 
  Search, 
  Calendar, 
  Check, 
  Eye, 
  ArrowLeft,
  Trash2,
  Pencil,
  Download,
  TableProperties,
  Clock,
  ArrowRight,
  User,
  Calculator,
  Scale,
  Layers,
  History,
  Package,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Columns2,
  Info
} from 'lucide-react';

interface InsumoRegistro {
  id: string;
  hora: string;
  usuario: string;
  tipo: 'BODEGA_A_COCINA' | 'INVENTARIO_INICIAL_COCINA' | 'DEVOLUCION_COCINA' | 'COCINA_CIERRE' | 'BODEGA_APERTURA' | 'BODEGA_CIERRE';
  presentacion?: 'Entero' | 'Porcion';
  origen: string;
  destino: string;
  cantidad: number;
  unidad: string;
  modoIngreso?: 'MANUAL' | 'CALCULADO_PESO' | 'CALCULADO_UNIDAD';
  detalleCalculo?: string;
  costoUnitario: number;
  total: number;
  observaciones?: string;
}

interface InsumoItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  isInitialInventory?: boolean;
  registros?: InsumoRegistro[];
}

interface CategoryGroup {
  id: string;
  name: string;
  items: InsumoItem[];
}

interface CosteoSheet {
  id: string;
  month: '2026-10' | '2026-09';
  dateStr: string; // YYYY-MM-DD
  title: string;
  posSales: number;
  devoluciones?: number;
  categories: CategoryGroup[];
}


interface AllowedUnitOption {
  value: string;
  label: string;
  baseUnit: string;
  toBaseFactor: (catalogItem?: any) => number;
}

function getAllowedUnitsForInsumo(item?: {
  nombre?: string;
  insumo?: string;
  categoria?: string;
  unidad_medida?: string;
  tipo_medida?: string;
  es_carne?: boolean;
  peso_estandar_porcion_kg?: number;
  peso_porc_gramos?: number;
}): AllowedUnitOption[] {
  const n = (item?.nombre || item?.insumo || '').toLowerCase();
  const c = (item?.categoria || '').toLowerCase();
  const u = (item?.unidad_medida || '').toLowerCase();

  // 1. Huevos
  if (n.includes('huevo')) {
    return [
      { value: 'Und', label: 'Unidades (Und)', baseUnit: 'Und', toBaseFactor: () => 1 },
      { value: 'Panal', label: 'Panales (30 Und)', baseUnit: 'Und', toBaseFactor: () => 30 }
    ];
  }

  // 2. Leche o Líquidos (aceite, vinagre, jugos)
  if (n.includes('leche') || n.includes('aceite') || n.includes('jugo') || n.includes('líquid') || u === 'litro' || u === 'lt') {
    return [
      { value: 'Litro', label: 'Litros (Lt)', baseUnit: 'Litro', toBaseFactor: () => 1 },
      { value: 'Bolsa', label: 'Bolsas (1 Lt)', baseUnit: 'Litro', toBaseFactor: () => 1 },
      { value: 'Mililitro', label: 'Mililitros (ml)', baseUnit: 'Litro', toBaseFactor: () => 0.001 }
    ];
  }

  // 3. Desechables y Empaques
  if (c.includes('desechable') || c.includes('empaque') || n.includes('vaso') || n.includes('servilleta') || n.includes('cubierto') || n.includes('contenedor')) {
    return [
      { value: 'Paquete', label: 'Paquetes', baseUnit: 'Paquete', toBaseFactor: () => 1 },
      { value: 'Und', label: 'Unidades (Und)', baseUnit: 'Und', toBaseFactor: () => 1 }
    ];
  }

  // 4. Granos y Abarrotes
  if (c.includes('grano') || c.includes('abarrote') || n.includes('arroz') || n.includes('frijol') || n.includes('lenteja') || n.includes('azucar') || n.includes('sal')) {
    return [
      { value: 'Kg', label: 'Kilogramos (Kg)', baseUnit: 'Kg', toBaseFactor: () => 1 },
      { value: 'Libras', label: 'Libras (500g)', baseUnit: 'Kg', toBaseFactor: () => 0.5 },
      { value: 'Gramos', label: 'Gramos (g)', baseUnit: 'Kg', toBaseFactor: () => 0.001 },
      { value: 'Paquete', label: 'Paquetes', baseUnit: 'Kg', toBaseFactor: () => 1 }
    ];
  }

  // 5. Carnes y Proteínas (o insumos con porción)
  const isMeat = item?.es_carne || c.includes('carne') || c.includes('pollo') || c.includes('cerdo') || c.includes('pescado') || (item?.peso_estandar_porcion_kg && item.peso_estandar_porcion_kg > 0);
  if (isMeat) {
    const stdWeight = item?.peso_estandar_porcion_kg || (item?.peso_porc_gramos ? item.peso_porc_gramos / 1000 : getPortionWeightKg(n)) || 0.25;
    return [
      { value: 'Kg', label: 'Kilogramos (Kg)', baseUnit: 'Kg', toBaseFactor: () => 1 },
      { value: 'Porciones', label: `Porciones (${Math.round(stdWeight * 1000)}g c/u)`, baseUnit: 'Kg', toBaseFactor: () => stdWeight },
      { value: 'Libras', label: 'Libras (500g)', baseUnit: 'Kg', toBaseFactor: () => 0.5 },
      { value: 'Gramos', label: 'Gramos (g)', baseUnit: 'Kg', toBaseFactor: () => 0.001 }
    ];
  }

  // 6. Por defecto (Verduras e insumos generales)
  return [
    { value: 'Kg', label: 'Kilogramos (Kg)', baseUnit: 'Kg', toBaseFactor: () => 1 },
    { value: 'Libras', label: 'Libras (500g)', baseUnit: 'Kg', toBaseFactor: () => 0.5 },
    { value: 'Gramos', label: 'Gramos (g)', baseUnit: 'Kg', toBaseFactor: () => 0.001 },
    { value: 'Und', label: 'Unidades (Und)', baseUnit: 'Und', toBaseFactor: () => 1 },
    { value: 'Bolsa', label: 'Bolsa / Atado', baseUnit: 'Kg', toBaseFactor: () => 1 }
  ];
}

// Generador de título formal concatenando fecha
function formatDateToTitle(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const diaSemana = dias[dateObj.getDay()];
  const mesNombre = meses[dateObj.getMonth()];

  return `${diaSemana}, ${day} de ${mesNombre} de ${year} - Hoja Costeo Cocina`;
}

// Datos de prueba iniciales basados en los archivos de la Finca
const INITIAL_SHEETS: CosteoSheet[] = [
  {
    id: 'sheet-2026-10-23',
    month: '2026-10',
    dateStr: '2026-10-23',
    title: 'Viernes, 23 de Octubre de 2026 - Hoja Costeo Cocina',
    posSales: 4250000,
    devoluciones: 34000,
    categories: [
      {
        id: 'verduras',
        name: 'Verduras e Insumos',
        items: [
          { 
            id: 'v1', 
            name: 'Plátano maduro institucional', 
            qty: 49.0, 
            unit: 'Kg', 
            unitPrice: 2000, 
            total: 98000,
            registros: [
              {
                id: 'reg-v1-0',
                hora: '07:00 AM',
                usuario: 'Administradora',
                tipo: 'INVENTARIO_INICIAL_COCINA',
                origen: 'Inventario Cocina (Cierre anterior)',
                destino: 'Cocina Principal',
                cantidad: 5.0,
                unidad: 'Kg',
                modoIngreso: 'MANUAL',
                costoUnitario: 2000,
                total: 10000,
                observaciones: 'Saldo de apertura en mesón de preparación'
              },
              {
                id: 'reg-v1-1',
                hora: '08:30 AM',
                usuario: 'Bodeguero (Carlos M.)',
                tipo: 'BODEGA_A_COCINA',
                origen: 'Bodega General',
                destino: 'Cocina Principal',
                cantidad: 26.1,
                unidad: 'Kg',
                modoIngreso: 'MANUAL',
                costoUnitario: 2000,
                total: 52200,
                observaciones: 'Primera bajada matutina para patacones'
              },
              {
                id: 'reg-v1-2',
                hora: '11:45 AM',
                usuario: 'Administradora',
                tipo: 'BODEGA_A_COCINA',
                origen: 'Bodega General',
                destino: 'Cocina Principal',
                cantidad: 22.9,
                unidad: 'Kg',
                modoIngreso: 'CALCULADO_UNIDAD',
                detalleCalculo: '1 canastilla completa pesada en báscula',
                costoUnitario: 2000,
                total: 45800,
                observaciones: 'Refuerzo de mediodía según demanda'
              }
            ]
          },
          { id: 'v2', name: 'Cebolla larga / junca', qty: 7.0, unit: 'Kg', unitPrice: 2000, total: 14000 },
          { id: 'v3', name: 'Limón Tahití fresco', qty: 7.9, unit: 'Kg', unitPrice: 2500, total: 19750 },
          { id: 'v4', name: 'Tomate chonto seleccionado', qty: 2.5, unit: 'Kg', unitPrice: 2500, total: 6250 }
        ]
      },
      {
        id: 'carnes',
        name: 'Carnes y Proteínas (Saldo Cocina + Traslados)',
        items: [
          { 
            id: 'c1', 
            name: 'Costilla ahumada de cerdo (400g)', 
            qty: 12.0, 
            unit: 'Kg', 
            unitPrice: 18000, 
            total: 216000,
            isInitialInventory: true,
            registros: [
              {
                id: 'reg-c1-1',
                hora: '07:15 AM',
                usuario: 'Administradora',
                tipo: 'INVENTARIO_INICIAL_COCINA',
                origen: 'Inventario Cocina (Cierre anterior)',
                destino: 'Cocina Principal',
                cantidad: 1.6,
                unidad: 'Kg',
                modoIngreso: 'MANUAL',
                costoUnitario: 18000,
                total: 28800,
                observaciones: 'Saldo en refrigerador de cocina del día anterior'
              },
              {
                id: 'reg-c1-2',
                hora: '09:40 AM',
                usuario: 'Bodeguero (Carlos M.)',
                tipo: 'BODEGA_A_COCINA',
                origen: 'Bodega General (Cuartos Fríos)',
                destino: 'Cocina Principal',
                cantidad: 10.4,
                unidad: 'Kg',
                modoIngreso: 'CALCULADO_PESO',
                detalleCalculo: '26 porciones pesadas x 400g',
                costoUnitario: 18000,
                total: 187200,
                observaciones: 'Traslado para parrilla de almuerzos'
              },
              {
                id: 'reg-c1-3',
                hora: '03:45 PM',
                usuario: 'Administradora',
                tipo: 'DEVOLUCION_COCINA',
                origen: 'Cocina Principal',
                destino: 'Bodega General (Cuartos Fríos)',
                cantidad: 2.0,
                unidad: 'Kg',
                modoIngreso: 'MANUAL',
                detalleCalculo: '5 porciones devueltas x 400g',
                costoUnitario: 18000,
                total: 36000,
                observaciones: 'Devolución a frío por excedente de turno tarde'
              }
            ]
          },
          { id: 'c2', name: 'Filete Basa seleccionado', qty: 10.0, unit: 'Kg', unitPrice: 15500, total: 155000 },
          { id: 'c3', name: 'Punta de anca de res', qty: 2.0, unit: 'Kg', unitPrice: 44000, total: 88000 },
          { id: 'c4', name: 'Carne molida de res especial', qty: 7.1, unit: 'Kg', unitPrice: 25900, total: 183890 }
        ]
      },
      {
        id: 'granos',
        name: 'Granos y Abarrotes',
        items: [
          { id: 'g1', name: 'Arroz blanco institucional', qty: 3.0, unit: 'Kg', unitPrice: 5080, total: 15240 },
          { id: 'g2', name: 'Panela en atados', qty: 5.0, unit: 'Atado', unitPrice: 4300, total: 21500 },
          { id: 'g3', name: 'Aceite vegetal garrafa', qty: 1.0, unit: 'Und', unitPrice: 18000, total: 18000 }
        ]
      },
      {
        id: 'desechables',
        name: 'Desechables y Empaques',
        items: [
          { id: 'd1', name: 'Contenedor térmico sopero 16 oz', qty: 5.0, unit: 'Paquete', unitPrice: 11200, total: 56000 },
          { id: 'd2', name: 'Servilletas dispensador 1 a 1', qty: 5.0, unit: 'Paquete', unitPrice: 2000, total: 10000 }
        ]
      }
    ]
  },
  {
    id: 'sheet-2026-10-22',
    month: '2026-10',
    dateStr: '2026-10-22',
    title: 'Jueves, 22 de Octubre de 2026 - Hoja Costeo Cocina',
    posSales: 4250000,
    categories: [
      {
        id: 'verduras',
        name: 'Verduras e Insumos',
        items: [
          { id: 'v1', name: 'Plátano maduro institucional', qty: 49.0, unit: 'Kg', unitPrice: 2000, total: 98000 },
          { id: 'v2', name: 'Cebolla larga / junca', qty: 7.0, unit: 'Kg', unitPrice: 2000, total: 14000 }
        ]
      },
      {
        id: 'carnes',
        name: 'Carnes y Proteínas (Saldo Cocina + Traslados)',
        items: [
          { id: 'c1', name: 'Costilla ahumada de cerdo', qty: 12.0, unit: 'Kg', unitPrice: 18000, total: 216000 }
        ]
      }
    ]
  },
  {
    id: 'sheet-2026-10-21',
    month: '2026-10',
    dateStr: '2026-10-21',
    title: 'Miércoles, 21 de Octubre de 2026 - Hoja Costeo Cocina',
    posSales: 3980000,
    categories: [
      {
        id: 'verduras',
        name: 'Verduras e Insumos',
        items: [
          { id: 'v1', name: 'Plátano maduro institucional', qty: 35.0, unit: 'Kg', unitPrice: 2000, total: 70000 }
        ]
      }
    ]
  },
  {
    id: 'sheet-2026-10-20',
    month: '2026-10',
    dateStr: '2026-10-20',
    title: 'Martes, 20 de Octubre de 2026 - Hoja Costeo Cocina',
    posSales: 3750000,
    categories: []
  },
  {
    id: 'sheet-2026-09-30',
    month: '2026-09',
    dateStr: '2026-09-30',
    title: 'Miércoles, 30 de Septiembre de 2026 - Hoja Costeo Cocina',
    posSales: 4100000,
    categories: [
      {
        id: 'carnes',
        name: 'Carnes y Proteínas (Saldo Cocina + Traslados)',
        items: [
          { id: 'c1-sep', name: 'Costilla San Luis de cerdo', qty: 15.0, unit: 'Kg', unitPrice: 22900, total: 343500 }
        ]
      }
    ]
  },
  {
    id: 'sheet-2026-09-29',
    month: '2026-09',
    dateStr: '2026-09-29',
    title: 'Martes, 29 de Septiembre de 2026 - Hoja Costeo Cocina',
    posSales: 3600000,
    categories: []
  }
];

// Evaluador aritmético inteligente para campo de cantidad (soporta "26.1 + 22.9", "5*3.5", etc.)
function evaluateQtyFormula(formula: string): { value: number; isValid: boolean; preview?: string } {
  if (!formula || !formula.trim()) return { value: 0, isValid: false };
  try {
    const sanitized = formula.trim().replace(/,/g, '.').replace(/x/gi, '*');
    if (!/^[\d\s\+\-\*/\(\)\.]+$/.test(sanitized)) {
      return { value: 0, isValid: false };
    }
    // Si termina en operador mientras se escribe
    if (/[\+\-\*/]$/.test(sanitized.trim())) {
      const sub = sanitized.trim().slice(0, -1);
      const val = Function(`'use strict'; return (${sub})`)();
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        return { value: Number(val.toFixed(2)), isValid: true, preview: '... sumando' };
      }
      return { value: 0, isValid: false };
    }
    const val = Function(`'use strict'; return (${sanitized})`)();
    if (typeof val === 'number' && !isNaN(val) && isFinite(val) && val > 0) {
      const rounded = Number(val.toFixed(2));
      const hasOp = /[+\-*/]/.test(sanitized);
      return {
        value: rounded,
        isValid: true,
        preview: hasOp ? `= ${rounded}` : undefined
      };
    }
  } catch {}
  return { value: 0, isValid: false };
}

// Gramaje estándar del catálogo de carnes (peso estándar por porción en Kg)
function getPortionWeightKg(name: string): number {
  const match = name.match(/(\d+)\s*g/i);
  if (match) return parseFloat(match[1]) / 1000;
  const lower = name.toLowerCase();
  if (lower.includes('costilla')) return 0.400; // 400g
  if (lower.includes('punta de anca') || lower.includes('churrasco') || lower.includes('bife')) return 0.350; // 350g
  if (lower.includes('basa') || lower.includes('filete') || lower.includes('pechuga') || lower.includes('pollo')) return 0.300; // 300g
  if (lower.includes('sobrebarriga')) return 0.380; // 380g
  if (lower.includes('molida')) return 0.250; // 250g
  if (lower.includes('tocino') || lower.includes('chicharron')) return 0.200; // 200g
  return 0.350; // 350g estándar
}


// Catálogo maestro base con parámetros oficiales de porcionado y costos
const DEFAULT_CATALOG_ITEMS = [
  // Carnes de Res
  { codigo: 'CAR-033', nombre: 'Punta de anca', categoria: 'CARNE DE RES', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.222, costo_unitario_kg: 44000 },
  { codigo: 'CAR-026', nombre: 'Churrasco', categoria: 'CARNE DE RES', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.250, costo_unitario_kg: 38000 },
  { codigo: 'CAR-027', nombre: 'Costilla de res', categoria: 'CARNE DE RES', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.200, costo_unitario_kg: 18500 },
  { codigo: 'CAR-023', nombre: 'Carne molida', categoria: 'CARNE DE RES', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.250, costo_unitario_kg: 10900 },
  { codigo: 'CAR-020', nombre: 'Caderita', categoria: 'CARNE DE RES', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.286, costo_unitario_kg: 29800 },
  { codigo: 'CAR-034', nombre: 'Sobaco', categoria: 'CARNE DE RES', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.200, costo_unitario_kg: 25900 },
  { codigo: 'CAR-029', nombre: 'Lengua de res', categoria: 'CARNE DE RES', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.200, costo_unitario_kg: 23900 },
  // Carnes de Cerdo
  { codigo: 'CAR-003', nombre: 'Costilla ahumada', categoria: 'CARNE DE CERDO', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.222, costo_unitario_kg: 24500 },
  { codigo: 'CAR-006', nombre: 'Costilla san luis', categoria: 'CARNE DE CERDO', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.500, costo_unitario_kg: 22900 },
  { codigo: 'CAR-010', nombre: 'Lomo de cerdo', categoria: 'CARNE DE CERDO', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.222, costo_unitario_kg: 19000 },
  { codigo: 'CER-075', nombre: 'Tocino', categoria: 'CARNE DE CERDO', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.394, costo_unitario_kg: 21900 },
  { codigo: 'CAR-001', nombre: 'Bondiola importada', categoria: 'CARNE DE CERDO', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.333, costo_unitario_kg: 20000 },
  // Pollo
  { codigo: 'CAR-041', nombre: 'Filete de pollo', categoria: 'CARNE POLLO', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.200, costo_unitario_kg: 18500 },
  { codigo: 'CAR-037', nombre: 'Alas de pollo', categoria: 'CARNE POLLO', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.250, costo_unitario_kg: 15750 },
  { codigo: 'CAR-043', nombre: 'Pernil de pollo', categoria: 'CARNE POLLO', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.222, costo_unitario_kg: 7700 },
  // Pescados y Mariscos
  { codigo: 'PES-067', nombre: 'Tilapia 350/450', categoria: 'PESCADOS Y MARISCOS', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.333, costo_unitario_kg: 18000 },
  { codigo: 'PES-069', nombre: 'Trucha', categoria: 'PESCADOS Y MARISCOS', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.250, costo_unitario_kg: 23000 },
  { codigo: 'PES-066', nombre: 'Salmon', categoria: 'PESCADOS Y MARISCOS', unidad_medida: 'Kg', es_carne: true, peso_estandar_porcion_kg: 0.200, costo_unitario_kg: 55000 },
  // Huevos y Lácteos
  { codigo: 'HUE-001', nombre: 'Huevos AA frescos', categoria: 'HUEVOS Y LACTEOS', unidad_medida: 'Und', es_carne: false, costo_unitario_kg: 650 },
  { codigo: 'LAC-001', nombre: 'Leche entera pasteurizada', categoria: 'HUEVOS Y LACTEOS', unidad_medida: 'Litro', es_carne: false, costo_unitario_kg: 3800 },
  // Verduras
  { codigo: 'VER-001', nombre: 'Plátano maduro institucional', categoria: 'VERDURAS', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 2000 },
  { codigo: 'VER-002', nombre: 'Cebolla larga / junca', categoria: 'VERDURAS', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 2000 },
  { codigo: 'VER-003', nombre: 'Limón Tahití fresco', categoria: 'VERDURAS', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 2500 },
  { codigo: 'VER-004', nombre: 'Tomate chonto seleccionado', categoria: 'VERDURAS', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 2500 },
  // Granos y Abarrotes
  { codigo: 'GRA-001', nombre: 'Arroz blanco institucional', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 5080 },
  { codigo: 'GRA-002', nombre: 'Panela en atados', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Atado', es_carne: false, costo_unitario_kg: 4300 },
  { codigo: 'GRA-003', nombre: 'Aceite vegetal garrafa', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Litro', es_carne: false, costo_unitario_kg: 18000 },
  { codigo: 'GRA-004', nombre: 'Arroz', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 5080 },
  { codigo: 'GRA-005', nombre: 'Arroz Proarroz x 50 kg', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Bulto', es_carne: false, costo_unitario_kg: 254000 },
  { codigo: 'GRA-006', nombre: 'Frijol', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 8500 },
  { codigo: 'GRA-007', nombre: 'Lenteja', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 7000 },
  { codigo: 'GRA-008', nombre: 'Azúcar', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 4500 },
  { codigo: 'GRA-009', nombre: 'Sal', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 1400 },
  { codigo: 'GRA-010', nombre: 'Café', categoria: 'GRANOS Y ABARROTES', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 27500 },
  // Verduras adicionales
  { codigo: 'VER-005', nombre: 'Zanahoria', categoria: 'VERDURAS', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 2000 },
  { codigo: 'VER-006', nombre: 'Papa capira', categoria: 'VERDURAS', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 3500 },
  { codigo: 'VER-007', nombre: 'Papa criolla', categoria: 'VERDURAS', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 4000 },
  { codigo: 'VER-008', nombre: 'Cebolla cabezona', categoria: 'VERDURAS', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 3700 },
  { codigo: 'VER-009', nombre: 'Aguacate', categoria: 'VERDURAS', unidad_medida: 'Kg', es_carne: false, costo_unitario_kg: 7000 },
  { codigo: 'VER-010', nombre: 'Papas a la francesa', categoria: 'VERDURAS', unidad_medida: 'Paquete', es_carne: false, costo_unitario_kg: 7000 },
  // Desechables y Empaques (Vasos 9 oz, etc.)
  { codigo: 'DES-001', nombre: 'Contenedor térmico sopero 16 oz', categoria: 'DESECHABLES', unidad_medida: 'Paquete', es_carne: false, costo_unitario_kg: 11200 },
  { codigo: 'DES-002', nombre: 'Servilletas dispensador 1 a 1', categoria: 'DESECHABLES', unidad_medida: 'Paquete', es_carne: false, costo_unitario_kg: 2000 },
  { codigo: 'DES-003', nombre: 'Vaso Vacan 9 oz', categoria: 'DESECHABLES', unidad_medida: 'Paquete', es_carne: false, costo_unitario_kg: 3100 },
  { codigo: 'DES-004', nombre: 'Vaso cartón 9.0 onz x 50', categoria: 'DESECHABLES', unidad_medida: 'Paquete', es_carne: false, costo_unitario_kg: 3100 },
  { codigo: 'DES-005', nombre: 'Vaso Tami 12 oz Transparente', categoria: 'DESECHABLES', unidad_medida: 'Paquete', es_carne: false, costo_unitario_kg: 5000 },
  { codigo: 'DES-006', nombre: 'Tapa Vaso 12 oz Tami', categoria: 'DESECHABLES', unidad_medida: 'Paquete', es_carne: false, costo_unitario_kg: 5450 },
  { codigo: 'DES-007', nombre: 'Vasote 3.5 oz', categoria: 'DESECHABLES', unidad_medida: 'Paquete', es_carne: false, costo_unitario_kg: 2750 }
];


interface ParsedConteoItem {
  id: string;
  originalLine: string;
  itemName: string;
  category: string;
  rawQty: number;
  rawQtyStr: string;
  presentation: 'Porcion' | 'Entero';
  inputUnit: string;
  baseUnit: string;
  weightKg: number;
  unitPrice: number;
  estimatedTotal: number;
  stdPortionWeight: number;
  isMatched: boolean;
}

function normalizeStrHelper(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function mapCategoryToGroupId(catName: string): string {
  const c = normalizeStrHelper(catName);
  if (c.includes('carne') || c.includes('pollo') || c.includes('cerdo') || c.includes('pescado') || c.includes('res') || c.includes('marisco')) return 'carnes';
  if (c.includes('verdura') || c.includes('hortaliza') || c.includes('fruta')) return 'verduras';
  if (c.includes('grano') || c.includes('abarrote') || c.includes('lacteo') || c.includes('huevo')) return 'granos';
  if (c.includes('desechable') || c.includes('empaque')) return 'desechables';
  return 'carnes';
}

function isProteinItem(name: string, category: string): boolean {
  const n = normalizeStrHelper(name);
  const c = normalizeStrHelper(category);
  return (
    c.includes('carne') ||
    c.includes('pollo') ||
    c.includes('cerdo') ||
    c.includes('res') ||
    c.includes('pescado') ||
    c.includes('marisco') ||
    c.includes('embutido') ||
    n.includes('lomo') ||
    n.includes('punta de anca') ||
    n.includes('churrasco') ||
    n.includes('tocino') ||
    n.includes('chicharron') ||
    n.includes('costilla') ||
    n.includes('baby') ||
    n.includes('trucha') ||
    n.includes('salmon') ||
    n.includes('camaron') ||
    n.includes('marisco') ||
    n.includes('pechuga') ||
    n.includes('pernil') ||
    n.includes('alas') ||
    n.includes('san luis') ||
    n.includes('chorizo') ||
    n.includes('choripollo') ||
    n.includes('rellena')
  );
}

function isChorizoOrHuevo(name: string): boolean {
  const n = normalizeStrHelper(name);
  return (
    n.includes('chorizo') ||
    n.includes('choripollo') ||
    n.includes('rellena') ||
    n.includes('huevo')
  );
}

function getUnitsForItem(name: string, category: string, stdPortionWeight: number): { value: string; label: string }[] {
  const n = normalizeStrHelper(name);
  const isMeat = isProteinItem(name, category);
  const isChorizoHuevos = isChorizoOrHuevo(name);

  // 1. Huevos
  if (n.includes('huevo')) {
    return [
      { value: 'Und', label: 'Unidades (Und)' },
      { value: 'Panal', label: 'Panal (30 Und)' }
    ];
  }

  // 2. Proteínas / Carnes
  if (isMeat) {
    const porcLabel = stdPortionWeight > 0 ? `Porciones (${Math.round(stdPortionWeight * 1000)}g)` : 'Porciones';

    // Si es chorizo / choripollo / rellena: permite Und además de Porciones, Kg, Gramos, Libras
    if (isChorizoHuevos) {
      return [
        { value: 'Und', label: 'Unidades (Und)' },
        { value: 'Porciones', label: porcLabel },
        { value: 'Kg', label: 'Kilogramos (Kg)' },
        { value: 'Gramos', label: 'Gramos (g)' },
        { value: 'Libras', label: 'Libras (Lb)' }
      ];
    }

    // Demás carnes y proteínas (Porciones, Kg, Gramos, Libras)
    return [
      { value: 'Porciones', label: porcLabel },
      { value: 'Kg', label: 'Kilogramos (Kg)' },
      { value: 'Gramos', label: 'Gramos (g)' },
      { value: 'Libras', label: 'Libras (Lb)' }
    ];
  }

  // 3. Líquidos (Leche, aceites, jugos) - NUNCA llevan "Porciones"
  if (n.includes('leche') || n.includes('aceite') || n.includes('jugo') || n.includes('vinagre')) {
    return [
      { value: 'Lts', label: 'Litros (Lts)' },
      { value: 'Und', label: 'Unidades (Und)' },
      { value: 'Kg', label: 'Kilogramos (Kg)' },
      { value: 'Mililitros', label: 'Mililitros (ml)' }
    ];
  }

  // 4. Desechables y Empaques
  const c = normalizeStrHelper(category);
  if (c.includes('desechable') || c.includes('empaque')) {
    return [
      { value: 'Und', label: 'Unidades (Und)' },
      { value: 'Paquete', label: 'Paquetes' }
    ];
  }

  // 5. Verduras, Granos y Abarrotes en general - NUNCA llevan "Porciones"
  return [
    { value: 'Kg', label: 'Kilogramos (Kg)' },
    { value: 'Gramos', label: 'Gramos (g)' },
    { value: 'Libras', label: 'Libras (Lb)' },
    { value: 'Und', label: 'Unidades (Und)' }
  ];
}

function computeConteoItemEquivAndTotal(
  rawQty: number,
  unit: string,
  itemName: string,
  category: string,
  stdPortionWeight: number,
  unitPrice: number
): {
  weightKg: number;
  baseUnit: string;
  presentation: 'Porcion' | 'Entero';
  estimatedTotal: number;
} {
  const isMeat = isProteinItem(itemName, category);
  const isChorizoHuevos = isChorizoOrHuevo(itemName);
  const normName = normalizeStrHelper(itemName);

  let weightKg = rawQty;
  let baseUnit = 'Kg';
  let presentation: 'Porcion' | 'Entero' = 'Entero';
  let estimatedTotal = 0;

  // 1. Huevos
  if (normName.includes('huevo')) {
    baseUnit = 'Und';
    presentation = 'Entero';
    const effectiveUnds = unit === 'Panal' ? rawQty * 30 : rawQty;
    weightKg = effectiveUnds;
    estimatedTotal = Math.round(effectiveUnds * unitPrice);
    return { weightKg, baseUnit, presentation, estimatedTotal };
  }

  // 2. Proteínas / Carnes (siempre calculan equivalente en Kg, salvo chorizos en Und)
  if (isMeat) {
    baseUnit = 'Kg';
    if (unit === 'Porciones') {
      presentation = 'Porcion';
      const effectiveW = stdPortionWeight > 0 ? stdPortionWeight : 0.25;
      weightKg = Number((rawQty * effectiveW).toFixed(2));
      estimatedTotal = Math.round(weightKg * unitPrice);
    } else if (unit === 'Kg') {
      presentation = 'Entero';
      weightKg = Number(rawQty.toFixed(2));
      estimatedTotal = Math.round(weightKg * unitPrice);
    } else if (unit === 'Gramos') {
      presentation = 'Entero';
      weightKg = Number((rawQty / 1000).toFixed(3));
      estimatedTotal = Math.round(weightKg * unitPrice);
    } else if (unit === 'Libras') {
      presentation = 'Entero';
      weightKg = Number((rawQty * 0.5).toFixed(2));
      estimatedTotal = Math.round(weightKg * unitPrice);
    } else if (unit === 'Und') {
      if (isChorizoHuevos) {
        presentation = 'Entero';
        if (unitPrice > 5000 && stdPortionWeight > 0) {
          weightKg = Number((rawQty * stdPortionWeight).toFixed(2));
          estimatedTotal = Math.round(weightKg * unitPrice);
        } else {
          weightKg = rawQty;
          baseUnit = 'Und';
          estimatedTotal = Math.round(rawQty * unitPrice);
        }
      } else {
        presentation = 'Entero';
        weightKg = Number((rawQty * (stdPortionWeight || 0.25)).toFixed(2));
        estimatedTotal = Math.round(weightKg * unitPrice);
      }
    }
    return { weightKg, baseUnit, presentation, estimatedTotal };
  }

  // 3. Líquidos (Leche, aceites, jugos)
  if (normName.includes('leche') || normName.includes('aceite') || normName.includes('jugo')) {
    if (unit === 'Lts') {
      baseUnit = 'Lts';
      weightKg = Number(rawQty.toFixed(2));
      estimatedTotal = Math.round(weightKg * unitPrice);
    } else if (unit === 'Mililitros') {
      baseUnit = 'Lts';
      weightKg = Number((rawQty / 1000).toFixed(2));
      estimatedTotal = Math.round(weightKg * unitPrice);
    } else if (unit === 'Und') {
      baseUnit = 'Lts';
      weightKg = rawQty;
      estimatedTotal = Math.round(rawQty * unitPrice);
    } else {
      baseUnit = 'Kg';
      weightKg = Number(rawQty.toFixed(2));
      estimatedTotal = Math.round(weightKg * unitPrice);
    }
    return { weightKg, baseUnit, presentation, estimatedTotal };
  }

  // 4. Insumos generales (Verduras, Granos, Desechables)
  if (unit === 'Gramos') {
    baseUnit = 'Kg';
    weightKg = Number((rawQty / 1000).toFixed(3));
    estimatedTotal = Math.round(weightKg * unitPrice);
  } else if (unit === 'Libras') {
    baseUnit = 'Kg';
    weightKg = Number((rawQty * 0.5).toFixed(2));
    estimatedTotal = Math.round(weightKg * unitPrice);
  } else if (unit === 'Und' || unit === 'Paquete') {
    baseUnit = unit;
    weightKg = rawQty;
    estimatedTotal = Math.round(rawQty * unitPrice);
  } else {
    // Kg
    baseUnit = 'Kg';
    weightKg = Number(rawQty.toFixed(2));
    estimatedTotal = Math.round(weightKg * unitPrice);
  }

  return { weightKg, baseUnit, presentation, estimatedTotal };
}


const STOP_WORDS_SET = new Set(['de', 'la', 'el', 'los', 'las', 'en', 'con', 'y', 'a', 'un', 'una', 'por', 'para', 'del', 'al']);

function stemSpanishWord(word: string): string {
  let w = normalizeStrHelper(word);
  if (w.length <= 3) return w;
  if (w.endsWith('ces')) return w.slice(0, -3) + 'z';
  if (w.endsWith('es')) return w.slice(0, -2);
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

// Genera una lista inicial representativa de TODAS las categorías del sistema cuando no hay texto escrito
function getBalancedEmptyQueryList(items: any[]): any[] {
  const catPriority = [
    'GRANOS Y ABARROTES',
    'VERDURAS',
    'HUEVOS Y LACTEOS',
    'DESECHABLES',
    'BEBIDAS',
    'CARNE DE RES',
    'CARNE DE CERDO',
    'CARNE POLLO',
    'PESCADOS Y MARISCOS'
  ];
  const result: any[] = [];
  const pickedKeys = new Set<string>();

  catPriority.forEach(cat => {
    const matching = items.filter(it => {
      const c = normalizeStrHelper(it.categoria || '');
      const nc = normalizeStrHelper(cat);
      return c.includes(nc) || nc.includes(c);
    });
    // Escoger hasta 2 items representativos de cada categoría
    matching.slice(0, 2).forEach(it => {
      const key = it.id || it.codigo || it.nombre || it.insumo;
      if (!pickedKeys.has(key)) {
        pickedKeys.add(key);
        result.push(it);
      }
    });
  });

  // Completar hasta 20 items para ofrecer variedad inmediata
  items.forEach(it => {
    const key = it.id || it.codigo || it.nombre || it.insumo;
    if (!pickedKeys.has(key) && result.length < 20) {
      pickedKeys.add(key);
      result.push(it);
    }
  });

  return result;
}

// Buscador universal e inteligente que busca similitud en TODOS los insumos de cualquier categoría
function searchCatalogComprehensive(query: string, items: any[], activeCategoryFilter: string = 'TODOS'): any[] {
  const clean = normalizeStrHelper(query);

  let baseItems = items;
  if (activeCategoryFilter && activeCategoryFilter !== 'TODOS') {
    const filterNorm = normalizeStrHelper(activeCategoryFilter);
    baseItems = items.filter(it => {
      const c = normalizeStrHelper(it.categoria || '');
      return c.includes(filterNorm) || filterNorm.includes(c);
    });
  }

  if (!clean) {
    return getBalancedEmptyQueryList(baseItems);
  }

  const queryWords = clean.split(/\s+/).filter(w => !STOP_WORDS_SET.has(w) && w.length > 0);
  const stemmedQueryWords = queryWords.map(stemSpanishWord);

  const scored = baseItems.map(item => {
    const rawName = item.nombre || item.insumo || '';
    const normName = normalizeStrHelper(rawName);
    const catName = normalizeStrHelper(item.categoria || '');
    const nameWords = normName.split(/\s+/).filter(w => !STOP_WORDS_SET.has(w) && w.length > 0);
    const stemmedNameWords = nameWords.map(stemSpanishWord);

    let score = 0;

    // 1. Coincidencia exacta de nombre
    if (normName === clean) {
      score = 1.0;
    }
    // 2. Comienza exactamente con el texto buscado
    else if (normName.startsWith(clean)) {
      score = 0.95;
    }
    // 3. Subcadena directa dentro del nombre
    else if (normName.includes(clean)) {
      score = 0.90;
    }
    // 4. Búsqueda por categoría directa (ej: "verduras", "desechables", "bebidas", "granos")
    else if (catName.includes(clean) || clean.includes(catName)) {
      score = 0.82;
    }
    // 5. Coincidencia de tokens y raíces de palabras (ej: plurales "huevos" -> "huevo", "papas" -> "papa", "vasos 9 oz")
    else if (queryWords.length > 0) {
      let matchedStems = 0;
      stemmedQueryWords.forEach(sq => {
        const matches = stemmedNameWords.some(sn => {
          if (sn === sq) return true;
          if (sn.length >= 4 && sq.length >= 4 && (sn.includes(sq) || sq.includes(sn))) return true;
          return false;
        });
        if (matches) matchedStems++;
      });

      if (matchedStems === stemmedQueryWords.length) {
        score = 0.85;
      } else if (matchedStems > 0) {
        score = 0.50 + (0.30 * (matchedStems / stemmedQueryWords.length));
      }
    }

    // 6. Fuzzy typos para faltas de ortografía (ej: "zanahora" -> "zanahoria", "churasco" -> "churrasco")
    if (score === 0 && clean.length >= 4) {
      for (const nw of nameWords) {
        if (nw.length >= 4 && Math.abs(nw.length - clean.length) <= 2) {
          const bg = (s: string) => {
            const set = new Set<string>();
            for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
            return set;
          };
          const bg1 = bg(clean);
          const bg2 = bg(nw);
          let inter = 0;
          bg1.forEach(b => { if (bg2.has(b)) inter++; });
          const dice = (2 * inter) / (bg1.size + bg2.size || 1);
          if (dice >= 0.70) {
            score = Math.max(score, dice * 0.85);
          }
        }
      }
    }

    return { item, score };
  });

  return scored
    .filter(x => x.score >= 0.50)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

// Algoritmo de similitud difusa avanzada (soporta abreviaturas, typos como 'zanahora', tokens como 'vasos 9 oz')
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeStrHelper(str1);
  const s2 = normalizeStrHelper(str2);

  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;

  // 1. Inclusión de subcadena directa
  if (s1.includes(s2) || s2.includes(s1)) {
    const minL = Math.min(s1.length, s2.length);
    const maxL = Math.max(s1.length, s2.length);
    return 0.85 + (0.15 * (minL / maxL));
  }

  // 2. Token Matching (ej: "vasos 9 oz" vs "vaso vacan 9 oz")
  const words1 = s1.split(/\s+/).map(w => w.replace(/s$/, '').replace(/\.0$/, ''));
  const words2 = s2.split(/\s+/).map(w => w.replace(/s$/, '').replace(/\.0$/, ''));

  let matchedWords = 0;
  for (const w1 of words1) {
    if (w1.length >= 2 && words2.some(w2 => w2 === w1 || w2.includes(w1) || w1.includes(w2))) {
      matchedWords++;
    }
  }
  const tokenScore = words1.length > 0 ? (matchedWords / words1.length) * 0.9 : 0;

  // 3. Similitud Bigrama (Dice coefficient) para capturar faltas ortográficas (ej: "zanahora" -> "zanahoria")
  const bg = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const bg1 = bg(s1);
  const bg2 = bg(s2);
  let intersection = 0;
  bg1.forEach(b => {
    if (bg2.has(b)) intersection++;
  });
  const diceScore = (2 * intersection) / (bg1.size + bg2.size || 1);

  return Math.max(tokenScore, diceScore);
}

// Estilo y color distintivo de categoría para los badges
function getCategoryBadgeStyle(cat?: string): string {
  const c = (cat || '').toUpperCase();
  if (c.includes('VERDURA')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (c.includes('GRANO') || c.includes('ABARROTE')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (c.includes('DESECHABLE')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (c.includes('BEBIDA')) return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  if (c.includes('HUEVO') || c.includes('LACTEO')) return 'bg-yellow-50 text-yellow-800 border-yellow-200';
  if (c.includes('PESCADO') || c.includes('MARISCO')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (c.includes('POLLO')) return 'bg-orange-50 text-orange-700 border-orange-200';
  if (c.includes('CERDO')) return 'bg-pink-50 text-pink-700 border-pink-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

// Inferencia inteligente de categoría para cualquier insumo nuevo (evita que todo se clasifique erróneamente como carne)
function inferCategoryFromName(name: string): { category: string; isMeat: boolean; defaultUnit: string } {
  const n = normalizeStrHelper(name);

  // Desechables y Empaques (vasos, tapas, servilletas, bolsas, contenedores)
  if (
    n.includes('vaso') ||
    n.includes('tapa') ||
    n.includes('pitillo') ||
    n.includes('porta comida') ||
    n.includes('contenedor') ||
    n.includes('servilleta') ||
    n.includes('bolsa') ||
    n.includes('cubierto') ||
    n.includes('rollo') ||
    n.includes('vinipel') ||
    n.includes('aluminio') ||
    n.includes('guante') ||
    n.includes('desechable') ||
    n.includes('empaque')
  ) {
    return { category: 'Desechables y Empaques', isMeat: false, defaultUnit: 'Paquete' };
  }

  // Granos y Abarrotes (arroz, aceite, frijol, lenteja, azúcar, sal)
  if (
    n.includes('arroz') ||
    n.includes('frijol') ||
    n.includes('lenteja') ||
    n.includes('garbanzo') ||
    n.includes('blanquillo') ||
    n.includes('aceite') ||
    n.includes('azucar') ||
    n.includes('sal') ||
    n.includes('panela') ||
    n.includes('harina') ||
    n.includes('cafe') ||
    n.includes('chocolate') ||
    n.includes('vinagre') ||
    n.includes('salsa') ||
    n.includes('mayonesa') ||
    n.includes('mostaza') ||
    n.includes('pasta') ||
    n.includes('grano') ||
    n.includes('abarrote')
  ) {
    return { category: 'Granos y Abarrotes', isMeat: false, defaultUnit: 'Kg' };
  }

  // Verduras y Frutas (zanahoria, cebolla, tomate, papa, plátano)
  if (
    n.includes('zanahor') ||
    n.includes('cebolla') ||
    n.includes('tomate') ||
    n.includes('papa') ||
    n.includes('platano') ||
    n.includes('yuca') ||
    n.includes('aguacate') ||
    n.includes('limon') ||
    n.includes('cilantro') ||
    n.includes('apio') ||
    n.includes('ajo') ||
    n.includes('pimenton') ||
    n.includes('lechuga') ||
    n.includes('repollo') ||
    n.includes('arveja') ||
    n.includes('habichuela') ||
    n.includes('mazorca') ||
    n.includes('champiñon') ||
    n.includes('verdura') ||
    n.includes('fruta')
  ) {
    return { category: 'Verduras e Insumos', isMeat: false, defaultUnit: 'Kg' };
  }

  // Huevos y Lácteos
  if (n.includes('huevo')) {
    return { category: 'Huevos y Lácteos', isMeat: false, defaultUnit: 'Und' };
  }
  if (n.includes('leche') || n.includes('queso') || n.includes('crema') || n.includes('mantequilla') || n.includes('yogurt')) {
    return { category: 'Huevos y Lácteos', isMeat: false, defaultUnit: 'Lts' };
  }

  // Bebidas
  if (n.includes('gaseosa') || n.includes('cerv') || n.includes('cerveza') || n.includes('jugo') || n.includes('agua') || n.includes('bebida')) {
    return { category: 'Bebidas', isMeat: false, defaultUnit: 'Und' };
  }

  // Carnes y Proteínas
  if (isProteinItem(name, '')) {
    return { category: 'Carnes y Proteínas', isMeat: true, defaultUnit: isChorizoOrHuevo(name) ? 'Und' : 'Porciones' };
  }

  // Por defecto (Verduras e Insumos)
  return { category: 'Verduras e Insumos', isMeat: false, defaultUnit: 'Kg' };
}

function findBestCatalogMatch(query: string, catalogList: any[]): { item: any | null; score: number } {
  const normQuery = normalizeStrHelper(query);
  if (!normQuery) return { item: null, score: 0 };

  let bestItem: any = null;
  let bestScore = 0;

  for (const c of catalogList) {
    const cName = normalizeStrHelper(c.nombre || c.insumo || '');

    // Coincidencia exacta
    if (normQuery === cName) {
      return { item: c, score: 1.0 };
    }

    const score = calculateStringSimilarity(normQuery, cName);
    if (score > bestScore) {
      bestScore = score;
      bestItem = c;
    }
  }

  // Reglas directas de alta precisión para casos comunes o errores de escritura:
  if (bestScore < 0.6) {
    if (normQuery.includes('arroz')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('arroz'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('zanahor')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('zanahor'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('vaso') && (normQuery.includes('9') || normQuery.includes('9oz') || normQuery.includes('9 oz'))) {
      const it = catalogList.find(c => {
        const n = normalizeStrHelper(c.nombre || c.insumo);
        return n.includes('vaso') && n.includes('9');
      });
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('vaso') && (normQuery.includes('12') || normQuery.includes('12oz') || normQuery.includes('12 oz'))) {
      const it = catalogList.find(c => {
        const n = normalizeStrHelper(c.nombre || c.insumo);
        return n.includes('vaso') && n.includes('12');
      });
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('san luis')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('san luis'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('rellena')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('rellena'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('baby')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('baby'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('choripollo')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('choripollo'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('francesa')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('francesa'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('marisco')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('marisco'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('camaron')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('camaron'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('salmon')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('salmon'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('trucha')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('trucha'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('huevo')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('huevo'));
      if (it) return { item: it, score: 0.95 };
    }
    if (normQuery.includes('leche')) {
      const it = catalogList.find(c => normalizeStrHelper(c.nombre || c.insumo).includes('leche'));
      if (it) return { item: it, score: 0.95 };
    }
  }

  return { item: bestItem, score: bestScore };
}

function parseBulkConteosText(rawText: string, catalogList: any[]): ParsedConteoItem[] {
  const lines = rawText.split('\n');
  const results: ParsedConteoItem[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const originalLine = lines[idx].trim();
    if (!originalLine) continue;

    const normLine = normalizeStrHelper(originalLine);
    if (
      (normLine.includes('inventario') && normLine.includes('siguiente')) ||
      normLine.startsWith('buenas') ||
      normLine.startsWith('reporte') ||
      normLine.startsWith('control') ||
      normLine.startsWith('lista')
    ) {
      continue;
    }

    // 1. Extraer unidad explícita
    let explicitUnit: string | null = null;

    if (/\b(kls|kl|kg|kilos|kilo)\b/i.test(originalLine)) {
      explicitUnit = 'Kg';
    } else if (/\b(unds|und|unidades|unidad)\b/i.test(originalLine)) {
      explicitUnit = 'Und';
    } else if (/\b(porc|porciones|porcion)\b/i.test(originalLine)) {
      explicitUnit = 'Porciones';
    } else if (/\b(lts|lt|litros|litro)\b/i.test(originalLine)) {
      explicitUnit = 'Lts';
    } else if (/\b(gr|gramos|g)\b/i.test(originalLine)) {
      explicitUnit = 'Gramos';
    } else if (/\b(lbs|lb|libras|libra)\b/i.test(originalLine)) {
      explicitUnit = 'Libras';
    }

    // 2. Limpiar línea para extraer números
    const clean = originalLine
      .replace(/\b(kls|kl|kg|kilos|kilo|unds|und|unidades|unidad|porc|porciones|porcion|lts|lt|litros|litro|gr|gramos|lbs|lb|libras|libra)\.?\b/gi, '')
      .trim();

    let qty = 0;
    let rawQtyStr = '';
    let itemPart = clean;

    const matchEndFormula = clean.match(/(\d+(?:\.\d+)?(?:\s*[\+]\s*\d+(?:\.\d+)?)*)\s*[\.]?$/);
    if (matchEndFormula) {
      rawQtyStr = matchEndFormula[1].trim();
      itemPart = clean.slice(0, matchEndFormula.index).trim();
      itemPart = itemPart.replace(/[-:]\s*$/, '').trim();

      const parts = rawQtyStr.split('+').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
      qty = parts.reduce((a, b) => a + b, 0);
    } else {
      const matchAnyNum = clean.match(/(\d+(?:\.\d+)?)/);
      if (matchAnyNum) {
        qty = parseFloat(matchAnyNum[1]);
        rawQtyStr = String(qty);
        itemPart = clean.replace(matchAnyNum[0], '').replace(/[-:]\s*$/, '').trim();
      }
    }

    // 4. Coincidencia difusa con catálogo general (carnes, verduras, granos, desechables, etc.)
    const { item: matchedItem, score: matchScore } = findBestCatalogMatch(itemPart, catalogList);
    const isMatched = !!matchedItem && matchScore >= 0.55;

    // Si coincide con catálogo, adopta sus propiedades oficiales.
    // Si NO coincide, infiere inteligentemente su categoría real según su nombre (ej: "arroz" -> Granos, "vaso" -> Desechables, "zanahoria" -> Verduras):
    const inferred = inferCategoryFromName(itemPart);
    const finalName = isMatched ? (matchedItem.nombre || matchedItem.insumo) : itemPart;
    const finalCategory = isMatched ? (matchedItem.categoria || inferred.category) : inferred.category;
    const isMeat = isMatched
      ? (matchedItem.es_carne || isProteinItem(finalName, finalCategory))
      : inferred.isMeat;
    const isChorizoHuevos = isChorizoOrHuevo(finalName);
    const stdWeight = isMatched
      ? (matchedItem?.peso_estandar_porcion_kg || (matchedItem?.peso_porc_gramos ? matchedItem.peso_porc_gramos / 1000 : (isMeat ? getPortionWeightKg(finalName) : 0)))
      : (isMeat ? getPortionWeightKg(finalName) : 0);
    const unitPrice = isMatched
      ? (matchedItem?.costo_unitario_kg || matchedItem?.costoUnitario || (isMeat ? 18000 : 3500))
      : (isMeat ? 18000 : 3500);

    // Sugerencia lógica de unidad inicial si no vino explícita
    let finalUnit = explicitUnit || '';
    if (!finalUnit) {
      if (normalizeStrHelper(finalName).includes('huevo')) {
        finalUnit = 'Und';
      } else if (isMeat) {
        if (isChorizoHuevos) {
          finalUnit = 'Und';
        } else {
          finalUnit = 'Porciones';
        }
      } else if (normalizeStrHelper(finalName).includes('leche') || normalizeStrHelper(finalName).includes('aceite')) {
        finalUnit = 'Lts';
      } else if (isMatched && matchedItem?.unidad_medida) {
        finalUnit = matchedItem.unidad_medida;
      } else {
        finalUnit = inferred.defaultUnit;
      }
    }
    if (!finalUnit) {
      finalUnit = inferred.defaultUnit || 'Kg';
    }

    const calc = computeConteoItemEquivAndTotal(
      qty,
      finalUnit,
      finalName,
      finalCategory,
      stdWeight,
      unitPrice
    );

    results.push({
      id: `p-item-${idx}-${Date.now()}`,
      originalLine,
      itemName: finalName,
      category: finalCategory,
      rawQty: qty,
      rawQtyStr: rawQtyStr || String(qty),
      presentation: calc.presentation,
      inputUnit: finalUnit,
      baseUnit: calc.baseUnit,
      weightKg: calc.weightKg,
      unitPrice,
      estimatedTotal: calc.estimatedTotal,
      stdPortionWeight: stdWeight,
      isMatched: !!matchedItem
    });
  }

  return results;
}

export default function CosteoDiarioPage() {
  const [sheets, setSheets] = useState<CosteoSheet[]>(INITIAL_SHEETS);
  const [openTabs, setOpenTabs] = useState<string[]>(['sheet-2026-10-23']);
  const [activeTabId, setActiveTabId] = useState<string | null>('sheet-2026-10-23');
  const [selectedMonth, setSelectedMonth] = useState<'2026-10' | '2026-09'>('2026-10');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDate, setNewDate] = useState('2026-10-24');
  const [newCarryOver, setNewCarryOver] = useState(true);

  // Modos operativos y switches de inclusión
  const [activeOperationalView, setActiveOperationalView] = useState<
    'TRASLADOS' | 'COCINA_APERTURA' | 'DEVOLUCIONES' | 'COCINA_CIERRE' | 'BODEGA_APERTURA' | 'BODEGA_CIERRE'
  >('TRASLADOS');
  const [incluirCocinaApertura, setIncluirCocinaApertura] = useState(true);
  const [incluirDevoluciones, setIncluirDevoluciones] = useState(false);

  // Modo exclusivo para Cocina Cierre: AUTO (Cierre Automático), MANUAL (Conteo Físico), SPLIT (Comparativo)
  const [cierreViewMode, setCierreViewMode] = useState<'AUTO' | 'MANUAL' | 'SPLIT'>('AUTO');

  // Catálogo inteligente y buscador en tiempo real
  const [catalogItems, setCatalogItems] = useState<any[]>(DEFAULT_CATALOG_ITEMS);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<any | null>(null);
  const [availableUnits, setAvailableUnits] = useState<AllowedUnitOption[]>(getAllowedUnitsForInsumo());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchCategoryFilter, setSearchCategoryFilter] = useState<string>('TODOS');
  const addQtyInputRef = useRef<HTMLInputElement>(null);

  // Estado del Slide-over para Añadir Conteos Masivos por Texto
  const [isConteosDrawerOpen, setIsConteosDrawerOpen] = useState(false);
  const [conteosTargetView, setConteosTargetView] = useState<
    'COCINA_APERTURA' | 'TRASLADOS' | 'DEVOLUCIONES' | 'COCINA_CIERRE' | 'BODEGA_APERTURA' | 'BODEGA_CIERRE'
  >('COCINA_CIERRE');
  const [conteosActionMode, setConteosActionMode] = useState<'SUMAR' | 'REEMPLAZAR'>('SUMAR');
  const [conteosRawText, setConteosRawText] = useState('');
  const [parsedConteosList, setParsedConteosList] = useState<ParsedConteoItem[]>([]);
  const [conteosSuccessToast, setConteosSuccessToast] = useState('');

  // Atender enlaces profundos desde notificaciones operativas (?section=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section');
      if (
        section &&
        ['TRASLADOS', 'COCINA_APERTURA', 'DEVOLUCIONES', 'COCINA_CIERRE', 'BODEGA_APERTURA', 'BODEGA_CIERRE'].includes(section)
      ) {
        setActiveOperationalView(section as any);
      }
    }
  }, []);

  useEffect(() => {
    fetch('/api/catalogo')
      .then(r => r.json())
      .then(data => {
        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          // Fusionar insumos del servidor con insumos base para garantizar que siempre estén disponibles arroz, vasos, verduras, etc.
          const merged = [...data.data];
          const existing = new Set(data.data.map((d: any) => normalizeStrHelper(d.nombre || d.insumo || '')));
          DEFAULT_CATALOG_ITEMS.forEach(def => {
            const k = normalizeStrHelper(def.nombre);
            if (!existing.has(k)) {
              merged.push(def);
              existing.add(k);
            }
          });
          setCatalogItems(merged);
        }
      })
      .catch(() => {});
  }, []);

  // In-line Row Adding
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newInsumoName, setNewInsumoName] = useState('');
  const [newInsumoQtyFormula, setNewInsumoQtyFormula] = useState('');
  const [newInsumoUnit, setNewInsumoUnit] = useState('Kg');
  const [newInsumoPrice, setNewInsumoPrice] = useState<number | ''>(2500);

  // Live PDF preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Lateral Insumo Manager Drawer State (Despliegue rápido con teclado)
  const [activeDrawerInsumo, setActiveDrawerInsumo] = useState<{
    categoryId: string;
    categoryName: string;
    item: InsumoItem;
  } | null>(null);

  // Ref para auto-enfoque en el input de cantidad
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Formulario minimalista estilo GitHub
  const [drawerPresentacion, setDrawerPresentacion] = useState<'Entero' | 'Porcion'>('Entero');
  const [drawerQtyFormula, setDrawerQtyFormula] = useState('');
  const [drawerCustomWeight, setDrawerCustomWeight] = useState('');
  const [drawerUnitPrice, setDrawerUnitPrice] = useState<string>('');
  const [drawerObs, setDrawerObs] = useState('');
  const [drawerSuccessMsg, setDrawerSuccessMsg] = useState('');
  const [editingRegId, setEditingRegId] = useState<string | null>(null);

  // Abrir panel lateral de insumo enfocado al teclado
  const handleOpenInsumoManager = (categoryId: string, categoryName: string, item: InsumoItem) => {
    let itemWithRegistros = { ...item };
    if (!itemWithRegistros.registros || itemWithRegistros.registros.length === 0) {
      itemWithRegistros.registros = [
        {
          id: `reg-${item.id}-init`,
          hora: '08:00 AM',
          usuario: item.isInitialInventory ? 'Administradora' : 'Bodeguero (Carlos M.)',
          tipo: item.isInitialInventory ? 'INVENTARIO_INICIAL_COCINA' : 'BODEGA_A_COCINA',
          presentacion: 'Entero',
          origen: 'Bodega General',
          destino: 'Cocina Principal',
          cantidad: item.qty,
          unidad: item.unit,
          costoUnitario: item.unitPrice,
          total: item.total,
          observaciones: 'Registro inicial consolidado'
        }
      ];
    }

    const defaultPres = (item.name.toLowerCase().includes('porci') || categoryId === 'carnes') ? 'Porcion' : 'Entero';
    setDrawerPresentacion(defaultPres);
    setDrawerQtyFormula('');
    setDrawerCustomWeight('');
    setDrawerUnitPrice(item.unitPrice.toString());
    setDrawerObs('');
    setDrawerSuccessMsg('');
    setEditingRegId(null);

    setActiveDrawerInsumo({
      categoryId,
      categoryName,
      item: itemWithRegistros
    });

    // Enfoque inmediato al input de cantidad
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 100);
  };

  // Iniciar edición de un registro existente con autollenado de campos
  const handleStartEditRegistro = (reg: InsumoRegistro) => {
    setEditingRegId(reg.id);
    const pres = reg.presentacion || 'Entero';
    setDrawerPresentacion(pres);

    if (pres === 'Porcion') {
      const stdW = getPortionWeightKg(activeDrawerInsumo?.item.name || '');
      const matchPortions = reg.detalleCalculo?.match(/(\d+(\.\d+)?)\s*porciones/i);
      const portions = matchPortions ? matchPortions[1] : (stdW > 0 ? (reg.cantidad / stdW).toFixed(0) : reg.cantidad.toString());
      setDrawerQtyFormula(portions);
      setDrawerCustomWeight(reg.cantidad.toString());
    } else {
      const matchFormula = reg.detalleCalculo?.match(/Fórmula:\s*([^=]+)=/i);
      setDrawerQtyFormula(matchFormula ? matchFormula[1].trim() : reg.cantidad.toString());
      setDrawerCustomWeight('');
    }

    setDrawerUnitPrice(reg.costoUnitario.toString());
    setDrawerObs(reg.observaciones || '');
    setDrawerSuccessMsg('');

    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 50);
  };

  // Cancelar modo edición
  const handleCancelEdit = () => {
    setEditingRegId(null);
    setDrawerQtyFormula('');
    setDrawerCustomWeight('');
    setDrawerObs('');
    if (activeDrawerInsumo) {
      setDrawerUnitPrice(activeDrawerInsumo.item.unitPrice.toString());
    }
    setTimeout(() => {
      qtyInputRef.current?.focus();
    }, 50);
  };

  // Agregar nuevo registro o guardar cambios de edición (mantiene el panel abierto y re-enfoca)
  const handleAddInsumoRegistro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrawerInsumo || !activeSheet) return;

    const evalResult = evaluateQtyFormula(drawerQtyFormula);
    if (!evalResult.isValid || evalResult.value <= 0) {
      qtyInputRef.current?.focus();
      return;
    }

    let finalQty = 0;
    let detalleCalculo = undefined;
    const unitPrice = parseFloat(drawerUnitPrice) || activeDrawerInsumo.item.unitPrice;

    if (drawerPresentacion === 'Porcion') {
      const portionsCount = evalResult.value;
      const stdW = getPortionWeightKg(activeDrawerInsumo.item.name);
      const parsedCustomWeight = parseFloat(drawerCustomWeight);
      finalQty = (!isNaN(parsedCustomWeight) && parsedCustomWeight > 0)
        ? parsedCustomWeight
        : Number((portionsCount * stdW).toFixed(2));
      
      detalleCalculo = `${portionsCount} porciones (${(stdW * 1000).toFixed(0)}g c/u) = ${finalQty} ${activeDrawerInsumo.item.unit}`;
    } else {
      finalQty = evalResult.value;
      if (drawerQtyFormula.includes('+') || drawerQtyFormula.includes('*') || drawerQtyFormula.includes('/')) {
        detalleCalculo = `Fórmula: ${drawerQtyFormula} = ${finalQty}`;
      }
    }

    const regTotal = Math.round(finalQty * unitPrice);
    const now = new Date();
    const horaAuto = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

    let updatedRegistros: InsumoRegistro[] = [];

    if (editingRegId) {
      // Guardar cambio sobre registro existente
      updatedRegistros = (activeDrawerInsumo.item.registros || []).map(r => {
        if (r.id !== editingRegId) return r;
        return {
          ...r,
          presentacion: drawerPresentacion,
          cantidad: finalQty,
          unidad: activeDrawerInsumo.item.unit,
          detalleCalculo: detalleCalculo,
          costoUnitario: unitPrice,
          total: regTotal,
          observaciones: drawerObs.trim() || undefined
        };
      });
      setDrawerSuccessMsg(`✓ Cambio guardado (${finalQty} ${activeDrawerInsumo.item.unit})`);
      setEditingRegId(null);
    } else {
      // Registrar nueva bajada
      const newReg: InsumoRegistro = {
        id: `reg-${Date.now()}`,
        hora: horaAuto,
        usuario: 'Administradora',
        tipo: 'BODEGA_A_COCINA',
        presentacion: drawerPresentacion,
        origen: 'Bodega General',
        destino: 'Cocina Principal',
        cantidad: finalQty,
        unidad: activeDrawerInsumo.item.unit,
        detalleCalculo: detalleCalculo,
        costoUnitario: unitPrice,
        total: regTotal,
        observaciones: drawerObs.trim() || undefined
      };
      updatedRegistros = [...(activeDrawerInsumo.item.registros || []), newReg];
      setDrawerSuccessMsg(`✓ +${finalQty} ${activeDrawerInsumo.item.unit} ($${regTotal.toLocaleString('es-CO')})`);
    }

    const newTotalQty = Number(updatedRegistros.reduce((acc, r) => acc + r.cantidad, 0).toFixed(2));
    const newTotalCost = Math.round(newTotalQty * unitPrice);

    const updatedItem: InsumoItem = {
      ...activeDrawerInsumo.item,
      qty: newTotalQty,
      unitPrice: unitPrice,
      total: newTotalCost,
      registros: updatedRegistros
    };

    // Actualizar en el estado de sheets
    setSheets(prevSheets => prevSheets.map(s => {
      if (s.id !== activeSheet.id) return s;
      return {
        ...s,
        categories: s.categories.map(cat => {
          if (cat.id !== activeDrawerInsumo.categoryId) return cat;
          return {
            ...cat,
            items: cat.items.map(it => it.id === updatedItem.id ? updatedItem : it)
          };
        })
      };
    }));

    // Actualizar panel lateral sin cerrarlo
    setActiveDrawerInsumo({
      ...activeDrawerInsumo,
      item: updatedItem
    });

    // Limpiar campo de cantidad y notas para el siguiente ingreso
    setDrawerQtyFormula('');
    setDrawerCustomWeight('');
    setDrawerObs('');
    setTimeout(() => setDrawerSuccessMsg(''), 2500);

    // RE-ENFOCAR INMEDIATAMENTE AL INPUT PARA CONTINUAR SUMANDO CON TECLADO
    setTimeout(() => {
      qtyInputRef.current?.focus();
    }, 50);
  };

  // Eliminar registro del insumo
  const handleDeleteInsumoRegistro = (regId: string) => {
    if (!activeDrawerInsumo || !activeSheet) return;
    const currentRegistros = activeDrawerInsumo.item.registros || [];
    const updatedRegistros = currentRegistros.filter(r => r.id !== regId);
    const newTotalQty = Number(updatedRegistros.reduce((acc, r) => acc + r.cantidad, 0).toFixed(2));
    const newTotalCost = Math.round(newTotalQty * activeDrawerInsumo.item.unitPrice);

    const updatedItem: InsumoItem = {
      ...activeDrawerInsumo.item,
      qty: newTotalQty,
      total: newTotalCost,
      registros: updatedRegistros
    };

    setSheets(prevSheets => prevSheets.map(s => {
      if (s.id !== activeSheet.id) return s;
      return {
        ...s,
        categories: s.categories.map(cat => {
          if (cat.id !== activeDrawerInsumo.categoryId) return cat;
          return {
            ...cat,
            items: cat.items.map(it => it.id === updatedItem.id ? updatedItem : it)
          };
        })
      };
    }));

    setActiveDrawerInsumo({
      ...activeDrawerInsumo,
      item: updatedItem
    });
  };

  // Current Active Sheet
  const activeSheet = sheets.find(s => s.id === activeTabId);

  // Verificar si se ha diligenciado inventario de Cocina Apertura
  const hasAperturaDiligenciada = useMemo(() => {
    if (!activeSheet) return false;
    return activeSheet.categories.some(cat =>
      cat.items.some(it => {
        const regs = it.registros && it.registros.length > 0
          ? it.registros
          : (it.isInitialInventory ? [{ tipo: 'INVENTARIO_INICIAL_COCINA', cantidad: it.qty }] : []);
        return regs.some(r => r.tipo === 'INVENTARIO_INICIAL_COCINA' && r.cantidad > 0);
      })
    );
  }, [activeSheet]);

  // Obtener registros y métricas de un insumo según la vista activa y switches
  const getItemMetricsForView = (item: InsumoItem) => {
    const regs: InsumoRegistro[] = item.registros && item.registros.length > 0 ? item.registros : [
      {
        id: `reg-${item.id}-init`,
        hora: '08:00 AM',
        usuario: item.isInitialInventory ? 'Administradora' : 'Bodeguero (Carlos M.)',
        tipo: item.isInitialInventory ? 'INVENTARIO_INICIAL_COCINA' : 'BODEGA_A_COCINA',
        presentacion: 'Entero',
        origen: 'Bodega General',
        destino: 'Cocina Principal',
        cantidad: item.qty,
        unidad: item.unit,
        costoUnitario: item.unitPrice,
        total: item.total,
        observaciones: 'Registro consolidado'
      }
    ];

    let filteredRegs: InsumoRegistro[] = [];

    if (activeOperationalView === 'COCINA_APERTURA') {
      filteredRegs = regs.filter(r => r.tipo === 'INVENTARIO_INICIAL_COCINA');
    } else if (activeOperationalView === 'DEVOLUCIONES') {
      filteredRegs = regs.filter(r => r.tipo === 'DEVOLUCION_COCINA');
    } else if (activeOperationalView === 'COCINA_CIERRE') {
      // 1. Apertura Cocina
      const aperturaQty = regs.filter(r => r.tipo === 'INVENTARIO_INICIAL_COCINA').reduce((sum, r) => sum + r.cantidad, 0);
      // 2. Traslados Bodega a Cocina
      const trasladosQty = regs.filter(r => r.tipo === 'BODEGA_A_COCINA').reduce((sum, r) => sum + r.cantidad, 0);
      // 3. Devoluciones Cocina a Bodega
      const devolucionesQty = regs.filter(r => r.tipo === 'DEVOLUCION_COCINA').reduce((sum, r) => sum + r.cantidad, 0);

      // Cierre Automático = Apertura + Traslados - Devoluciones
      const autoQty = Number(Math.max(0, aperturaQty + trasladosQty - devolucionesQty).toFixed(2));
      const autoTotal = Math.round(autoQty * item.unitPrice);
      const hasAutoEntries = hasAperturaDiligenciada && (aperturaQty + trasladosQty + devolucionesQty) > 0;

      // Cierre Manual ingresado físicamente
      const manualRegs = regs.filter(r => r.tipo === 'COCINA_CIERRE');
      const manualQty = Number(manualRegs.reduce((sum, r) => sum + r.cantidad, 0).toFixed(2));
      const manualTotal = Math.round(manualQty * item.unitPrice);
      const hasManualEntries = manualRegs.length > 0;

      // Diferencia (Físico Manual vs Teórico Auto)
      const diffQty = Number((manualQty - autoQty).toFixed(2));
      const diffTotal = manualTotal - autoTotal;

      if (cierreViewMode === 'AUTO') {
        return {
          filteredRegs: [],
          manualRegs,
          qty: autoQty,
          total: autoTotal,
          hasEntries: hasAutoEntries,
          isAuto: true,
          aperturaQty,
          trasladosQty,
          devolucionesQty,
          autoQty,
          autoTotal,
          manualQty,
          manualTotal,
          hasManualEntries,
          diffQty,
          diffTotal
        };
      }

      if (cierreViewMode === 'MANUAL') {
        return {
          filteredRegs: manualRegs,
          manualRegs,
          qty: manualQty,
          total: manualTotal,
          hasEntries: hasManualEntries,
          isAuto: false,
          aperturaQty,
          trasladosQty,
          devolucionesQty,
          autoQty,
          autoTotal,
          manualQty,
          manualTotal,
          hasManualEntries,
          diffQty,
          diffTotal
        };
      }

      // Modo 'SPLIT' (Comparativo Lado a Lado)
      return {
        filteredRegs: manualRegs,
        manualRegs,
        qty: autoQty,
        total: autoTotal,
        hasEntries: hasAutoEntries || hasManualEntries,
        isAuto: true,
        aperturaQty,
        trasladosQty,
        devolucionesQty,
        autoQty,
        autoTotal,
        manualQty,
        manualTotal,
        hasManualEntries,
        diffQty,
        diffTotal
      };
    } else if (activeOperationalView === 'BODEGA_APERTURA') {
      filteredRegs = regs.filter(r => r.tipo === 'BODEGA_APERTURA');
    } else if (activeOperationalView === 'BODEGA_CIERRE') {
      filteredRegs = regs.filter(r => r.tipo === 'BODEGA_CIERRE');
    } else {
      // activeOperationalView === 'TRASLADOS'
      filteredRegs = regs.filter(r => {
        if (r.tipo === 'BODEGA_A_COCINA') return true;
        if (r.tipo === 'INVENTARIO_INICIAL_COCINA') return incluirCocinaApertura;
        if (r.tipo === 'DEVOLUCION_COCINA') return incluirDevoluciones;
        return false;
      });
    }

    let totalQty = 0;
    let totalCost = 0;

    filteredRegs.forEach(r => {
      if (activeOperationalView === 'TRASLADOS' && r.tipo === 'DEVOLUCION_COCINA') {
        totalQty -= r.cantidad;
        totalCost -= r.total;
      } else {
        totalQty += r.cantidad;
        totalCost += r.total;
      }
    });

    return {
      filteredRegs,
      manualRegs: [] as InsumoRegistro[],
      qty: Number(Math.max(0, totalQty).toFixed(2)),
      total: Math.max(0, totalCost),
      hasEntries: filteredRegs.length > 0,
      isAuto: false,
      aperturaQty: 0,
      trasladosQty: 0,
      devolucionesQty: 0,
      autoQty: 0,
      autoTotal: 0,
      manualQty: 0,
      manualTotal: 0,
      hasManualEntries: false,
      diffQty: 0,
      diffTotal: 0
    };
  };

  const calculateCategoryViewTotal = (cat: CategoryGroup) => {
    return cat.items.reduce((acc, it) => acc + getItemMetricsForView(it).total, 0);
  };

  const calculateSheetViewTotal = (sheet?: CosteoSheet) => {
    if (!sheet) return 0;
    return sheet.categories.reduce((acc, cat) => acc + calculateCategoryViewTotal(cat), 0);
  };

  // Cifras consolidadas del día para el panel lateral derecho
  const calculateCostoCocinaBruto = (sheet?: CosteoSheet): number => {
    if (!sheet) return 0;
    return sheet.categories.reduce((acc, cat) => {
      return acc + cat.items.reduce((cAcc, it) => {
        const regs = it.registros && it.registros.length > 0 ? it.registros : [
          { tipo: it.isInitialInventory ? 'INVENTARIO_INICIAL_COCINA' : 'BODEGA_A_COCINA', total: it.total } as any
        ];
        const sumBruto = regs
          .filter(r => r.tipo === 'BODEGA_A_COCINA' || r.tipo === 'INVENTARIO_INICIAL_COCINA')
          .reduce((sum, r) => sum + r.total, 0);
        return cAcc + (regs.some(r => r.tipo === 'BODEGA_A_COCINA' || r.tipo === 'INVENTARIO_INICIAL_COCINA') ? sumBruto : it.total);
      }, 0);
    }, 0);
  };

  const calculateTotalDevoluciones = (sheet?: CosteoSheet): number => {
    if (!sheet) return 0;
    let totalDev = 0;
    sheet.categories.forEach(cat => {
      cat.items.forEach(it => {
        if (it.registros) {
          it.registros.forEach(r => {
            if (r.tipo === 'DEVOLUCION_COCINA') {
              totalDev += r.total;
            }
          });
        }
      });
    });
    return totalDev > 0 ? totalDev : (sheet.devoluciones || 0);
  };

  const costoCocinaBruto = calculateCostoCocinaBruto(activeSheet);
  const totalDevoluciones = calculateTotalDevoluciones(activeSheet);
  const costoNetoCocina = Math.max(0, costoCocinaBruto - totalDevoluciones);
  const ventasDia = activeSheet?.posSales || 0;
  const rendimientoDia = ventasDia - costoNetoCocina;

  // Selección en el buscador inteligente
  const handleSelectCatalogItem = (item: any) => {
    setSelectedCatalogItem(item);
    setNewInsumoName(item.nombre || item.insumo);
    setNewInsumoPrice(item.costo_unitario_kg || 0);
    const units = getAllowedUnitsForInsumo(item);
    setAvailableUnits(units);
    setNewInsumoUnit(units[0].value);
    setIsSearchOpen(false);
    setTimeout(() => {
      addQtyInputRef.current?.focus();
    }, 50);
  };


  // Grand Total calculation
  const calculateSheetTotal = (sheet?: CosteoSheet) => {
    if (!sheet) return 0;
    return sheet.categories.reduce((acc, cat) => {
      return acc + cat.items.reduce((cAcc, it) => cAcc + it.total, 0);
    }, 0);
  };

  const calculateCategoryTotal = (cat: CategoryGroup) => {
    return cat.items.reduce((acc, it) => acc + it.total, 0);
  };

  // Open a sheet in tabs
  const handleOpenSheet = (id: string) => {
    if (!openTabs.includes(id)) {
      setOpenTabs([...openTabs, id]);
    }
    setActiveTabId(id);
  };

  // Close tab
  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const nextTabs = openTabs.filter(t => t !== id);
    setOpenTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1] : null);
    }
  };

  // Create New Sheet from Modal
  const handleCreateSheet = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `sheet-${newDate}`;
    
    // Check if exists
    const exists = sheets.find(s => s.dateStr === newDate);
    if (exists) {
      handleOpenSheet(exists.id);
      setIsModalOpen(false);
      return;
    }

    const monthKey = newDate.startsWith('2026-09') ? '2026-09' : '2026-10';
    const title = formatDateToTitle(newDate);

    const newSheet: CosteoSheet = {
      id: newId,
      month: monthKey,
      dateStr: newDate,
      title: title,
      posSales: 0,
      categories: [
        {
          id: 'verduras',
          name: 'Verduras e Insumos',
          items: []
        },
        {
          id: 'carnes',
          name: 'Carnes y Proteínas (Saldo Cocina + Traslados)',
          items: newCarryOver ? [
            { id: 'c-init-1', name: 'Costilla ahumada de cerdo', qty: 1.6, unit: 'Kg', unitPrice: 18000, total: 28800, isInitialInventory: true }
          ] : []
        },
        {
          id: 'granos',
          name: 'Granos y Abarrotes',
          items: []
        },
        {
          id: 'desechables',
          name: 'Desechables y Empaques',
          items: []
        }
      ]
    };

    setSheets([newSheet, ...sheets]);
    setOpenTabs([...openTabs, newId]);
    setActiveTabId(newId);
    setIsModalOpen(false);
  };

  // Add Item to Category con conversión inteligente a Kg según catálogo
  const handleAddItem = (catId: string) => {
    if (!newInsumoName.trim() || !activeSheet) return;

    const parsedQty = evaluateQtyFormula(newInsumoQtyFormula).value || parseFloat(newInsumoQtyFormula) || 1;
    const price = Number(newInsumoPrice) || 0;

    // Determinar factor y peso en base a la unidad seleccionada
    const unitOption = availableUnits.find(u => u.value === newInsumoUnit) || {
      value: newInsumoUnit,
      label: newInsumoUnit,
      baseUnit: newInsumoUnit,
      toBaseFactor: () => 1
    };

    const factor = unitOption.toBaseFactor(selectedCatalogItem);
    const finalQty = Number((parsedQty * factor).toFixed(2));
    const finalUnit = unitOption.baseUnit;
    const finalTotal = Math.round(finalQty * price);

    const operationalType: 'BODEGA_A_COCINA' | 'INVENTARIO_INICIAL_COCINA' | 'DEVOLUCION_COCINA' | 'COCINA_CIERRE' | 'BODEGA_APERTURA' | 'BODEGA_CIERRE' = 
      activeOperationalView === 'COCINA_APERTURA' ? 'INVENTARIO_INICIAL_COCINA' :
      activeOperationalView === 'DEVOLUCIONES' ? 'DEVOLUCION_COCINA' :
      activeOperationalView === 'COCINA_CIERRE' ? 'COCINA_CIERRE' :
      activeOperationalView === 'BODEGA_APERTURA' ? 'BODEGA_APERTURA' :
      activeOperationalView === 'BODEGA_CIERRE' ? 'BODEGA_CIERRE' : 'BODEGA_A_COCINA';

    const now = new Date();
    const horaAuto = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

    let detalle = undefined;
    if (newInsumoUnit === 'Porciones') {
      detalle = `${parsedQty} porciones calculadas (${finalQty} ${finalUnit})`;
    } else if (newInsumoUnit !== finalUnit) {
      detalle = `${parsedQty} ${newInsumoUnit} = ${finalQty} ${finalUnit}`;
    }

    const newRegistro: InsumoRegistro = {
      id: `reg-${Date.now()}`,
      hora: horaAuto,
      usuario: 'Administradora',
      tipo: operationalType,
      presentacion: newInsumoUnit === 'Porciones' ? 'Porcion' : 'Entero',
      origen: activeOperationalView === 'DEVOLUCIONES' ? 'Cocina Principal' : 'Bodega General',
      destino: activeOperationalView === 'DEVOLUCIONES' ? 'Bodega General' : 'Cocina Principal',
      cantidad: finalQty,
      unidad: finalUnit,
      detalleCalculo: detalle,
      costoUnitario: price,
      total: finalTotal,
      observaciones: activeOperationalView === 'DEVOLUCIONES' ? 'Devolución registrada a bodega' : 'Ingreso registrado'
    };

    // Enrutamiento inteligente a la categoría adecuada según la naturaleza del insumo
    let targetCatId = catId;
    const itemCat = (selectedCatalogItem?.categoria || '').toUpperCase();
    if (itemCat.includes('VERDURA')) {
      const found = activeSheet.categories.find(c => c.id === 'verduras' || c.name.toLowerCase().includes('verdura'));
      if (found) targetCatId = found.id;
    } else if (itemCat.includes('GRANO') || itemCat.includes('ABARROTE') || itemCat.includes('LACTEO') || itemCat.includes('HUEVO')) {
      const found = activeSheet.categories.find(c => c.id === 'granos' || c.name.toLowerCase().includes('grano'));
      if (found) targetCatId = found.id;
    } else if (itemCat.includes('DESECHABLE') || itemCat.includes('EMPAQUE')) {
      const found = activeSheet.categories.find(c => c.id === 'desechables' || c.name.toLowerCase().includes('desechable'));
      if (found) targetCatId = found.id;
    } else if (itemCat.includes('BEBIDA')) {
      const found = activeSheet.categories.find(c => c.id === 'bebidas' || c.name.toLowerCase().includes('bebida'));
      if (found) targetCatId = found.id;
    } else if (itemCat.includes('CARNE') || itemCat.includes('RES') || itemCat.includes('CERDO') || itemCat.includes('POLLO') || itemCat.includes('PESCADO') || itemCat.includes('EMBUTIDO')) {
      const found = activeSheet.categories.find(c => c.id === 'carnes' || c.name.toLowerCase().includes('carne'));
      if (found) targetCatId = found.id;
    }

    const targetCategory = activeSheet.categories.find(c => c.id === targetCatId);
    const existingItem = targetCategory?.items.find(it => it.name.toLowerCase() === newInsumoName.trim().toLowerCase());

    let updatedCategories: CategoryGroup[] = [];

    if (existingItem) {
      const updatedRegs = [...(existingItem.registros || []), newRegistro];
      const newTotalQty = Number(updatedRegs.reduce((acc, r) => acc + (r.tipo === 'DEVOLUCION_COCINA' ? -r.cantidad : r.cantidad), 0).toFixed(2));
      const newTotalCost = Math.round(newTotalQty * price);

      const updatedExistingItem: InsumoItem = {
        ...existingItem,
        qty: Math.max(0, newTotalQty),
        total: Math.max(0, newTotalCost),
        unitPrice: price,
        registros: updatedRegs
      };

      updatedCategories = activeSheet.categories.map(cat => {
        if (cat.id !== targetCatId) return cat;
        return {
          ...cat,
          items: cat.items.map(it => it.id === existingItem.id ? updatedExistingItem : it)
        };
      });
    } else {
      const newItem: InsumoItem = {
        id: `it-${Date.now()}`,
        name: newInsumoName.trim(),
        qty: finalQty,
        unit: finalUnit,
        unitPrice: price,
        total: finalTotal,
        registros: [newRegistro]
      };

      updatedCategories = activeSheet.categories.map(cat => {
        if (cat.id === targetCatId) {
          return { ...cat, items: [...cat.items, newItem] };
        }
        return cat;
      });
    }

    const updatedSheet = { ...activeSheet, categories: updatedCategories };
    setSheets(sheets.map(s => s.id === activeSheet.id ? updatedSheet : s));

    setNewInsumoName('');
    setNewInsumoQtyFormula('');
    setSelectedCatalogItem(null);
    setAddingCategory(null);
  };

  // Delete item
  const handleDeleteItem = (catId: string, itemId: string) => {
    if (!activeSheet) return;
    const updatedCategories = activeSheet.categories.map(cat => {
      if (cat.id === catId) {
        return { ...cat, items: cat.items.filter(it => it.id !== itemId) };
      }
      return cat;
    });
    setSheets(sheets.map(s => s.id === activeSheet.id ? { ...activeSheet, categories: updatedCategories } : s));
  };

  // Filtered sheets by selected month and search query
  const filteredSheets = sheets.filter(s => {
    const matchesMonth = s.month === selectedMonth;
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.dateStr.includes(searchQuery);
    return matchesMonth && matchesSearch;
  });

  
  // Handlers para el módulo de Añadir Conteos
  const handleParseConteos = (text: string) => {
    const parsed = parseBulkConteosText(text, catalogItems);
    setParsedConteosList(parsed);
  };

  const handleLoadSampleConteos = () => {
    const sample = `Huevos 30
Leche 3
Filetes 350 - 4
Chicharron grande 4
Lomo 350 - 2
Salmón 4
Lengua 3
Churrasco 4
Baby bef 1
Punta de anca 3
Chorizo pequeño 19
Costilla ahumada 4 kls
Chorizo grande 1
Trucha 1
Mix de mariscos 2.5
Camarón 2.1 kls
Tilapia 3
Trucha 8`;
    setConteosRawText(sample);
    handleParseConteos(sample);
  };

  const handleUpdateParsedItemQty = (itemId: string, newQty: number) => {
    setParsedConteosList(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const calc = computeConteoItemEquivAndTotal(
        newQty,
        item.inputUnit,
        item.itemName,
        item.category,
        item.stdPortionWeight,
        item.unitPrice
      );
      return {
        ...item,
        rawQty: newQty,
        rawQtyStr: String(newQty),
        weightKg: calc.weightKg,
        baseUnit: calc.baseUnit,
        presentation: calc.presentation,
        estimatedTotal: calc.estimatedTotal
      };
    }));
  };

  const handleUpdateParsedItemUnit = (itemId: string, newUnit: string) => {
    setParsedConteosList(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const calc = computeConteoItemEquivAndTotal(
        item.rawQty,
        newUnit,
        item.itemName,
        item.category,
        item.stdPortionWeight,
        item.unitPrice
      );
      return {
        ...item,
        inputUnit: newUnit,
        weightKg: calc.weightKg,
        baseUnit: calc.baseUnit,
        presentation: calc.presentation,
        estimatedTotal: calc.estimatedTotal
      };
    }));
  };

  const handleRemoveParsedItem = (itemId: string) => {
    setParsedConteosList(prev => prev.filter(it => it.id !== itemId));
  };

  const handleApplyConteos = () => {
    if (!activeSheet || parsedConteosList.length === 0) return;

    const targetType: 'INVENTARIO_INICIAL_COCINA' | 'BODEGA_A_COCINA' | 'DEVOLUCION_COCINA' | 'COCINA_CIERRE' | 'BODEGA_APERTURA' | 'BODEGA_CIERRE' =
      conteosTargetView === 'COCINA_APERTURA' ? 'INVENTARIO_INICIAL_COCINA' :
      conteosTargetView === 'DEVOLUCIONES' ? 'DEVOLUCION_COCINA' :
      conteosTargetView === 'COCINA_CIERRE' ? 'COCINA_CIERRE' :
      conteosTargetView === 'BODEGA_APERTURA' ? 'BODEGA_APERTURA' :
      conteosTargetView === 'BODEGA_CIERRE' ? 'BODEGA_CIERRE' : 'BODEGA_A_COCINA';

    const now = new Date();
    const horaAuto = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

    let updatedCategories = [...activeSheet.categories];

    parsedConteosList.forEach(pItem => {
      const targetCatId = mapCategoryToGroupId(pItem.category);
      let cat = updatedCategories.find(c => c.id === targetCatId);
      if (!cat) {
        cat = updatedCategories[0];
      }

      const newReg: InsumoRegistro = {
        id: `reg-bulk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        hora: horaAuto,
        usuario: 'Administradora',
        tipo: targetType,
        presentacion: pItem.presentation,
        origen: conteosTargetView === 'DEVOLUCIONES' ? 'Cocina Principal' : 'Bodega General',
        destino: conteosTargetView === 'DEVOLUCIONES' ? 'Bodega General' : 'Cocina Principal',
        cantidad: pItem.weightKg,
        unidad: pItem.baseUnit,
        costoUnitario: pItem.unitPrice,
        total: pItem.estimatedTotal,
        detalleCalculo: pItem.presentation === 'Porcion' ? `${pItem.rawQty} porciones (${pItem.weightKg} Kg)` : `${pItem.rawQty} ${pItem.inputUnit}`,
        observaciones: conteosActionMode === 'SUMAR' 
          ? `Bajada / conteo adicional (+) (${conteosTargetView})` 
          : `Reemplazo / corrección de valor (=) (${conteosTargetView})`
      };

      const existingItem = cat.items.find(it => normalizeStrHelper(it.name) === normalizeStrHelper(pItem.itemName));

      if (existingItem) {
        let updatedRegs: InsumoRegistro[] = [];
        if (conteosActionMode === 'SUMAR') {
          // Modo Sumar: acumula como un registro adicional al historial
          updatedRegs = [...(existingItem.registros || []), newReg];
        } else {
          // Modo Reemplazar: sustituye los registros previos de este mismo tipo/destino
          const otherTypeRegs = (existingItem.registros || []).filter(r => r.tipo !== targetType);
          updatedRegs = [...otherTypeRegs, newReg];
        }

        const newTotalQty = Number(updatedRegs.reduce((acc, r) => acc + (r.tipo === 'DEVOLUCION_COCINA' ? -r.cantidad : r.cantidad), 0).toFixed(2));
        const newTotalCost = Math.round(newTotalQty * (existingItem.unitPrice || pItem.unitPrice));

        const updatedItem: InsumoItem = {
          ...existingItem,
          qty: Math.max(0, newTotalQty),
          total: Math.max(0, newTotalCost),
          registros: updatedRegs
        };

        updatedCategories = updatedCategories.map(c => {
          if (c.id !== cat.id) return c;
          return {
            ...c,
            items: c.items.map(it => it.id === existingItem.id ? updatedItem : it)
          };
        });
      } else {
        const newItem: InsumoItem = {
          id: `it-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: pItem.itemName,
          qty: pItem.weightKg,
          unit: pItem.baseUnit,
          unitPrice: pItem.unitPrice,
          total: pItem.estimatedTotal,
          registros: [newReg]
        };

        updatedCategories = updatedCategories.map(c => {
          if (c.id !== cat.id) return c;
          return {
            ...c,
            items: [...c.items, newItem]
          };
        });
      }
    });

    const updatedSheet: CosteoSheet = {
      ...activeSheet,
      categories: updatedCategories
    };

    setSheets(sheets.map(s => s.id === activeSheet.id ? updatedSheet : s));
    setActiveOperationalView(conteosTargetView);
    setIsConteosDrawerOpen(false);
    setConteosSuccessToast(`✓ ${parsedConteosList.length} conteos ${conteosActionMode === 'SUMAR' ? 'sumados como adicionales' : 'reemplazados'} en ${conteosTargetView}`);
    setTimeout(() => setConteosSuccessToast(''), 4000);
    setConteosRawText('');
    setParsedConteosList([]);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-53px)] md:h-[calc(100vh-57px)] -m-4 -mb-20 md:-m-6 md:mb-0 bg-white overflow-hidden">
      
      {/* ============================================================ */}
      {/* SECCIÓN SUPERIOR STICKY / FIJA: PESTAÑAS + SUBHEADER ACCIONES*/}
      {/* Toda esta sección se queda quieta al hacer scroll down       */}
      {/* ============================================================ */}
      <div className="shrink-0 bg-white border-b border-slate-200 z-20 shadow-2xs">
        
        {/* 1. BARRA DE PESTAÑAS (TABS) */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-3 pt-2 flex items-center justify-between overflow-x-auto select-none">
          <div className="flex items-center gap-1 min-w-0">
            
            {/* Tab principal: Vistas de Costeo */}
            <button
              onClick={() => setActiveTabId(null)}
              className={`flex items-center gap-2 px-3 py-2 text-xs rounded-t-md transition-colors border-t-2 ${
                activeTabId === null
                  ? 'bg-white text-slate-900 border-orange-600 font-semibold shadow-2xs border-x border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60 font-medium'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5 text-slate-500" />
              <span>Vistas de Costeo</span>
            </button>

            {/* Pestañas de Hojas Abiertas */}
            {openTabs.map(tabId => {
              const sh = sheets.find(s => s.id === tabId);
              if (!sh) return null;
              const isActive = activeTabId === tabId;

              return (
                <div
                  key={tabId}
                  onClick={() => setActiveTabId(tabId)}
                  className={`group flex items-center gap-2 px-3 py-2 text-xs rounded-t-md cursor-pointer transition-all border-t-2 max-w-[240px] ${
                    isActive
                      ? 'bg-white text-slate-900 border-orange-600 font-semibold shadow-2xs border-x border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60 font-medium'
                  }`}
                >
                  <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-600' : 'text-slate-400'}`} />
                  <span className="truncate">{sh.title.split(' - ')[0]}</span>
                  <button
                    onClick={(e) => handleCloseTab(e, tabId)}
                    className="opacity-60 hover:opacity-100 hover:bg-slate-200 p-0.5 rounded text-slate-400 hover:text-slate-700"
                    title="Cerrar pestaña"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {/* Botón "+" para crear o abrir nueva hoja */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors cursor-pointer flex items-center justify-center"
              title="Crear nueva hoja de costeo"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. SUBHEADER DE LA HOJA ACTIVA (Fijo junto con pestañas al abrir una hoja) */}
        {activeSheet && (
          <div className="bg-white p-3 px-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTabId(null)}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a Hojas de Costeo</span>
                </button>
              </div>
              <h1 className="text-base md:text-lg font-bold text-slate-900 mt-1">
                {activeSheet.title}
              </h1>
              <p className="text-xs text-slate-500">
                Fecha: <span className="font-medium text-slate-700">{activeSheet.dateStr}</span> · {activeSheet.categories.reduce((acc, c) => acc + c.items.length, 0)} insumos registrados
              </p>
            </div>

            {/* Botón en el subheader para Añadir Conteos Rápidos */}
            <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
              {conteosSuccessToast && (
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md animate-fade-in">
                  {conteosSuccessToast}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsConteosDrawerOpen(true);
                  setConteosTargetView(activeOperationalView);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-300 rounded-md transition-all shadow-2xs cursor-pointer group"
                title="Añadir conteos de texto rápido"
              >
                <ClipboardList className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-900" />
                <span>Añadir Conteos</span>
              </button>
            </div>

            
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. ÁREA PRINCIPAL CON SCROLL EXCLUSIVO PARA LOS LISTADOS      */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">
        
      
      {activeTabId === null || !activeSheet ? (
        
        /* ------------------------------------------------------------ */
        /* VISTA 1: "HOJAS DE COSTEO" (Listado sobrio tipo GitHub)      */
        /* ------------------------------------------------------------ */
        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-white">
          
          {/* Sub-Sidebar Lateral: Solo Meses */}
          <aside className="w-full md:w-56 p-4 border-r border-slate-200 bg-slate-50/60 shrink-0 space-y-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
              Meses
            </p>
            <button
              onClick={() => setSelectedMonth('2026-10')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium text-left transition-colors ${
                selectedMonth === '2026-10'
                  ? 'bg-slate-200/80 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>Octubre 2026</span>
              </div>
              <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {sheets.filter(s => s.month === '2026-10').length}
              </span>
            </button>

            <button
              onClick={() => setSelectedMonth('2026-09')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium text-left transition-colors ${
                selectedMonth === '2026-09'
                  ? 'bg-slate-200/80 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>Septiembre 2026</span>
              </div>
              <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                {sheets.filter(s => s.month === '2026-09').length}
              </span>
            </button>
          </aside>

          {/* Contenido Central: Hojas de Costeo */}
          <div className="flex-1 p-4 md:p-8 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Hojas de Costeo</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Listado de hojas de costeo diario de cocina ordenadas desde la más reciente.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs px-3.5 py-2 rounded-md font-medium shadow-2xs transition-colors self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Hoja de Costeo</span>
              </button>
            </div>

            {/* Buscador */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por fecha o insumo..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-slate-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <p className="text-[11px] text-slate-400 mb-3 font-medium">
              {filteredSheets.length} {filteredSheets.length === 1 ? 'hoja registrada' : 'hojas registradas'}
            </p>

            {/* Listado de Tarjetas Minimalistas */}
            <div className="space-y-2">
              {filteredSheets.map(sh => {
                const totalCOP = calculateSheetTotal(sh);
                const isOpen = openTabs.includes(sh.id);

                return (
                  <div
                    key={sh.id}
                    onClick={() => handleOpenSheet(sh.id)}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 rounded-lg cursor-pointer transition-all gap-2"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-slate-100 text-slate-600 group-hover:text-slate-900 transition-colors mt-0.5 sm:mt-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                            {sh.title}
                          </h3>
                          {isOpen && (
                            <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              Abierta en pestaña
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{sh.categories.reduce((acc, c) => acc + c.items.length, 0)} insumos registrados</span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">
                            Costo total: ${totalCOP.toLocaleString('es-CO')} COP
                          </span>
                          {sh.posSales > 0 && (
                            <>
                              <span>•</span>
                              <span>Venta POS: ${sh.posSales.toLocaleString('es-CO')}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSheet(sh.id);
                        }}
                        className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Abrir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      ) : (

        /* ------------------------------------------------------------ */
        /* VISTA 2: HOJA ACTIVA EN CONSTRUCCIÓN (Sobria, estilo GitHub) */
        /* ------------------------------------------------------------ */
        <div className="p-4 md:p-6 pb-24 md:pb-12 w-full max-w-[1700px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
            
            {/* Columna Izquierda: Listados de Insumos */}
            <div className="flex-1 w-full min-w-0 space-y-4">

              {/* -------------------------------------------------------- */}
              {/* BARRA SUPERIOR DE VISTA OPERATIVA Y SWITCHES MINIMALISTAS */}
              {/* -------------------------------------------------------- */}
              <div className="bg-white border border-slate-200 rounded-lg p-3 px-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {activeOperationalView === 'TRASLADOS' && 'Traslados Bodega a Cocina'}
                    {activeOperationalView === 'COCINA_APERTURA' && 'Cocina Apertura (Inventario Inicial)'}
                    {activeOperationalView === 'DEVOLUCIONES' && 'Devoluciones Cocina a Bodega'}
                    {activeOperationalView === 'COCINA_CIERRE' && 'Cocina Cierre'}
                    {activeOperationalView === 'BODEGA_APERTURA' && 'Bodega Apertura'}
                    {activeOperationalView === 'BODEGA_CIERRE' && 'Bodega Cierre'}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium border border-slate-200">
                    Operación Activa
                  </span>
                </div>

                {/* Switches Minimalistas exclusivos de la vista Traslados */}
                {activeOperationalView === 'TRASLADOS' && (
                  <div className="flex items-center gap-4 text-xs select-none">
                    {/* Switch 1: Incluir Cocina Apertura */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={incluirCocinaApertura}
                        onClick={() => setIncluirCocinaApertura(!incluirCocinaApertura)}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          incluirCocinaApertura ? 'bg-slate-900' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            incluirCocinaApertura ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`text-xs transition-colors ${incluirCocinaApertura ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                        Incluir Cocina Apertura
                      </span>
                    </label>

                    <div className="h-4 w-px bg-slate-200" />

                    {/* Switch 2: Incluir Devoluciones */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={incluirDevoluciones}
                        onClick={() => setIncluirDevoluciones(!incluirDevoluciones)}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          incluirDevoluciones ? 'bg-slate-900' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            incluirDevoluciones ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`text-xs transition-colors ${incluirDevoluciones ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                        Incluir Devoluciones
                      </span>
                    </label>
                  </div>
                )}

                {/* Badges / TAGs y Botón Split exclusivos de la vista Cocina Cierre */}
                {activeOperationalView === 'COCINA_CIERRE' && (
                  <div className="flex items-center gap-2 text-xs select-none flex-wrap">
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCierreViewMode('AUTO')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          cierreViewMode === 'AUTO'
                            ? 'bg-white text-blue-700 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Calcular automáticamente: Apertura + Traslados - Devoluciones"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Cierre Automático</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCierreViewMode('MANUAL')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          cierreViewMode === 'MANUAL'
                            ? 'bg-white text-slate-900 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Ver o registrar inventario físico manual"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-600" />
                        <span>Cierre Manual</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCierreViewMode('SPLIT')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          cierreViewMode === 'SPLIT'
                            ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Comparar en la misma pantalla: Automático vs Manual y diferencias"
                      >
                        <Columns2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Comparar (Split)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mensaje Informativo: El sistema solo calcula automáticamente si se diligenció Cocina Apertura */}
              {activeOperationalView === 'COCINA_CIERRE' && cierreViewMode !== 'MANUAL' && !hasAperturaDiligenciada && (
                <div className="bg-amber-50/80 border border-amber-200/90 rounded-lg p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      El sistema solo calculará automáticamente el cierre cuando se diligencie como mínimo el inventario de <strong>Cocina Apertura</strong>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveOperationalView('COCINA_APERTURA')}
                    className="self-start sm:self-auto shrink-0 font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer text-xs"
                  >
                    Ir a Cocina Apertura →
                  </button>
                </div>
              )}

              {/* LISTADO DE CATEGORÍAS */}
              {activeSheet.categories.map((cat) => {
                const catViewTotal = calculateCategoryViewTotal(cat);
                const isAddingHere = addingCategory === cat.id;

                // Filtrar items según la vista activa
                const displayItems = cat.items.filter(it => {
                  const m = getItemMetricsForView(it);
                  if (activeOperationalView === 'TRASLADOS') return true;
                  return m.hasEntries;
                });

                // Insumos filtrados con buscador comprensivo en TODOS los insumos del sistema
                const filteredCatalog = searchCatalogComprehensive(newInsumoName, catalogItems, searchCategoryFilter);

                // Cálculo en tiempo real de equivalencia en Kg para el formulario de ingreso
                const parsedAddQty = evaluateQtyFormula(newInsumoQtyFormula).value || 0;
                const selectedUnitOpt = availableUnits.find(u => u.value === newInsumoUnit);
                const unitFactor = selectedUnitOpt ? selectedUnitOpt.toBaseFactor(selectedCatalogItem) : 1;
                const convertedBaseQty = Number((parsedAddQty * unitFactor).toFixed(2));
                const estimatedCost = Math.round(convertedBaseQty * (Number(newInsumoPrice) || 0));

                return (
                  <div
                    key={cat.id}
                    className={`bg-white border border-slate-200 rounded-lg shadow-2xs transition-all ${
                      isAddingHere ? 'relative z-50 overflow-visible' : 'relative z-0 overflow-hidden'
                    }`}
                  >
                    
                    {/* Encabezado de Categoría */}
                    <div className="p-2.5 px-4 flex items-center justify-between border-b border-slate-200 bg-slate-50/80">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">▼</span>
                        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          {cat.name}
                        </h2>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-medium">
                          {displayItems.length}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        {activeOperationalView === 'COCINA_CIERRE' && cierreViewMode === 'SPLIT' ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span>Auto: <strong className="text-blue-700 font-mono">${cat.items.reduce((acc, it) => acc + getItemMetricsForView(it).autoTotal, 0).toLocaleString('es-CO')}</strong></span>
                            <span className="text-slate-300">|</span>
                            <span>Manual: <strong className="text-slate-900 font-mono">${cat.items.reduce((acc, it) => acc + getItemMetricsForView(it).manualTotal, 0).toLocaleString('es-CO')}</strong></span>
                          </div>
                        ) : (
                          <>Subtotal: <span className="font-bold text-slate-900">${catViewTotal.toLocaleString('es-CO')}</span></>
                        )}
                      </div>
                    </div>

                    {/* Encabezado de Columnas */}
                    {activeOperationalView === 'COCINA_CIERRE' && cierreViewMode === 'SPLIT' ? (
                      <div className="hidden sm:grid grid-cols-12 gap-2 p-2 px-4 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-4">Insumo / Fórmula</div>
                        <div className="col-span-2 text-right">Cierre Auto (Teórico)</div>
                        <div className="col-span-2 text-right">Cierre Manual (Físico)</div>
                        <div className="col-span-2 text-right">Diferencia</div>
                        <div className="col-span-2 text-right">Impacto $</div>
                      </div>
                    ) : (
                      <div className="hidden sm:grid grid-cols-12 gap-2 p-2 px-4 bg-white border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <div className="col-span-6">Insumo / Producto</div>
                        <div className="col-span-2 text-right">
                          {activeOperationalView === 'COCINA_CIERRE' && cierreViewMode === 'AUTO' ? 'Cantidad Cierre Auto' : 'Cantidad'}
                        </div>
                        <div className="col-span-2 text-right">Costo Factura</div>
                        <div className="col-span-2 text-right">Subtotal</div>
                      </div>
                    )}

                    {/* Filas de Insumos */}
                    <div className="divide-y divide-slate-100">
                      {displayItems.map((item) => {
                        const metrics = getItemMetricsForView(item);

                        if (activeOperationalView === 'COCINA_CIERRE' && cierreViewMode === 'SPLIT') {
                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 px-4 hover:bg-slate-50 items-center transition-colors text-xs"
                            >
                              <div className="sm:col-span-4 flex flex-col min-w-0 pr-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="font-semibold text-slate-900 truncate">{item.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenInsumoManager(cat.id, cat.name, item)}
                                    className="text-[10px] text-slate-400 hover:text-slate-700 underline cursor-pointer shrink-0"
                                  >
                                    {metrics.manualRegs.length > 0 ? `${metrics.manualRegs.length} reg. físico` : '+ Registrar físico'}
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                  Fórmula: Ap ({metrics.aperturaQty}) + Tras ({metrics.trasladosQty}) - Dev ({metrics.devolucionesQty})
                                </div>
                              </div>

                              <div className="sm:col-span-2 sm:text-right font-mono font-medium text-blue-700">
                                {metrics.autoQty} {item.unit}
                                <div className="text-[10px] text-slate-400 font-normal">${metrics.autoTotal.toLocaleString('es-CO')}</div>
                              </div>

                              <div className="sm:col-span-2 sm:text-right font-mono font-medium text-slate-900">
                                {metrics.hasManualEntries ? (
                                  <>
                                    <span>{metrics.manualQty} {item.unit}</span>
                                    <div className="text-[10px] text-slate-400 font-normal">${metrics.manualTotal.toLocaleString('es-CO')}</div>
                                  </>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">Sin conteo</span>
                                )}
                              </div>

                              <div className="sm:col-span-2 sm:text-right font-mono font-bold">
                                {!metrics.hasManualEntries ? (
                                  <span className="text-slate-300">-</span>
                                ) : metrics.diffQty === 0 ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                                    ✓ Cuadrado
                                  </span>
                                ) : metrics.diffQty < 0 ? (
                                  <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[11px]">
                                    ⚠️ {metrics.diffQty} {item.unit}
                                  </span>
                                ) : (
                                  <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
                                    +{metrics.diffQty} {item.unit}
                                  </span>
                                )}
                              </div>

                              <div className="sm:col-span-2 sm:text-right font-mono font-bold">
                                {!metrics.hasManualEntries ? (
                                  <span className="text-slate-300">-</span>
                                ) : metrics.diffTotal === 0 ? (
                                  <span className="text-emerald-700">$0</span>
                                ) : metrics.diffTotal < 0 ? (
                                  <span className="text-rose-600">
                                    -${Math.abs(metrics.diffTotal).toLocaleString('es-CO')}
                                  </span>
                                ) : (
                                  <span className="text-blue-700">
                                    +${metrics.diffTotal.toLocaleString('es-CO')}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={item.id}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 px-4 hover:bg-slate-50 items-center transition-colors text-xs"
                          >
                            {/* Nombre Clicable - Abre Administrador Lateral */}
                            <div className="sm:col-span-6 flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleOpenInsumoManager(cat.id, cat.name, item)}
                                className="text-left font-semibold text-slate-900 hover:text-orange-600 flex items-center gap-2 transition-colors group cursor-pointer truncate"
                                title="Click para ver desglose de registros e ingresar más cantidades"
                              >
                                <span className="group-hover:underline truncate">{item.name}</span>
                                {activeOperationalView === 'COCINA_CIERRE' && cierreViewMode === 'AUTO' ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                    Auto: Ap {metrics.aperturaQty} + Tras {metrics.trasladosQty} - Dev {metrics.devolucionesQty}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 group-hover:bg-orange-50 group-hover:text-orange-700 transition-colors shrink-0">
                                    {metrics.filteredRegs.length} {metrics.filteredRegs.length === 1 ? 'registro' : 'registros'}
                                  </span>
                                )}
                              </button>
                              {item.isInitialInventory && activeOperationalView === 'TRASLADOS' && incluirCocinaApertura && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                                  Apertura
                                </span>
                              )}
                            </div>

                            {/* Cantidad y Unidad */}
                            <div className="sm:col-span-2 sm:text-right font-medium text-slate-900 font-mono">
                              {metrics.qty} {item.unit}
                            </div>

                            {/* Costo Factura */}
                            <div className="sm:col-span-2 sm:text-right text-slate-600 font-mono">
                              ${item.unitPrice.toLocaleString('es-CO')} /{item.unit}
                            </div>

                            {/* Subtotal y Eliminar */}
                            <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-3">
                              <span className="font-semibold text-slate-900 font-mono">
                                ${metrics.total.toLocaleString('es-CO')}
                              </span>
                              {activeOperationalView === 'COCINA_CIERRE' && cierreViewMode === 'AUTO' ? (
                                <span className="w-5" />
                              ) : (
                                <button
                                  onClick={() => handleDeleteItem(cat.id, item.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Eliminar insumo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Estado Vacío */}
                      {displayItems.length === 0 && !isAddingHere && (
                        <div className="p-3 text-center text-xs text-slate-400 italic">
                          Sin registros activos para esta categoría en la vista seleccionada.
                        </div>
                      )}

                      {/* Fila interactiva con BUSCADOR INTELIGENTE y selector dinámico de unidades */}
                      {isAddingHere ? (
                        <div className="p-3 bg-slate-50/90 border-t border-slate-200 space-y-2 relative z-50 overflow-visible">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            {/* Input Inteligente con Búsqueda en Vivo en TODOS los insumos */}
                            <div className="relative flex-1 min-w-[220px] z-50">
                              <div className="relative flex items-center z-10">
                                <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                <input
                                  type="text"
                                  value={newInsumoName}
                                  onChange={(e) => {
                                    setNewInsumoName(e.target.value);
                                    setIsSearchOpen(true);
                                  }}
                                  onFocus={() => setIsSearchOpen(true)}
                                  placeholder="Buscar cualquier insumo (ej: Punta de anca, Arroz, Vasos, Huevos, Leche)..."
                                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-500 shadow-2xs font-medium"
                                  autoFocus
                                />
                                {newInsumoName && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewInsumoName('');
                                      setSelectedCatalogItem(null);
                                    }}
                                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                    title="Limpiar texto"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Backdrop invisible para cerrar al hacer clic afuera */}
                              {isSearchOpen && (
                                <div
                                  className="fixed inset-0 z-40 bg-transparent"
                                  onClick={() => setIsSearchOpen(false)}
                                />
                              )}

                              {/* Dropdown de Autocompletado del Catálogo con todas las categorías */}
                              {isSearchOpen && (
                                <div className="absolute left-0 top-full mt-1.5 w-full sm:w-[480px] max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-2xl z-50 divide-y divide-slate-100 animate-fade-in ring-1 ring-slate-900/5">
                                  {/* Píldoras de filtro rápido por categoría */}
                                  <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1 overflow-x-auto no-scrollbar">
                                    {[
                                      { id: 'TODOS', label: 'Todos' },
                                      { id: 'CARNES', label: '🥩 Carnes' },
                                      { id: 'VERDURAS', label: '🥬 Verduras' },
                                      { id: 'GRANOS', label: '🌾 Granos' },
                                      { id: 'DESECHABLES', label: '📦 Desechables' },
                                      { id: 'BEBIDAS', label: '🥤 Bebidas' },
                                      { id: 'HUEVOS', label: '🥚 Lácteos/Huevos' }
                                    ].map(pill => (
                                      <button
                                        key={pill.id}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setSearchCategoryFilter(pill.id);
                                        }}
                                        className={`px-2 py-0.5 rounded-md whitespace-nowrap text-[10px] font-medium transition-colors ${
                                          searchCategoryFilter === pill.id
                                            ? 'bg-slate-900 text-white font-semibold'
                                            : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200'
                                        }`}
                                      >
                                        {pill.label}
                                      </button>
                                    ))}
                                  </div>

                                  {filteredCatalog.length > 0 ? (
                                    filteredCatalog.slice(0, 18).map((cItem) => {
                                      const stdW = cItem.peso_estandar_porcion_kg || (cItem.peso_porc_gramos ? cItem.peso_porc_gramos / 1000 : 0);
                                      return (
                                        <div
                                          key={cItem.id || cItem.codigo || cItem.nombre || cItem.insumo}
                                          onMouseDown={() => handleSelectCatalogItem(cItem)}
                                          className="p-2 px-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                                        >
                                          <div className="flex-1 min-w-0 pr-2">
                                            <div className="font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                                              <span>{cItem.nombre || cItem.insumo}</span>
                                            </div>
                                            <div className="mt-0.5">
                                              <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded border font-medium uppercase tracking-wide ${getCategoryBadgeStyle(cItem.categoria)}`}>
                                                {cItem.categoria}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <div className="font-mono font-medium text-slate-800 text-xs">
                                              ${(cItem.costo_unitario_kg || 0).toLocaleString('es-CO')}/{cItem.unidad_medida || 'Kg'}
                                            </div>
                                            {stdW > 0 && (
                                              <span className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.2 rounded border border-amber-200/80">
                                                {Math.round(stdW * 1000)}g/porc
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="p-4 text-center text-xs text-slate-400">
                                      No se encontraron insumos para &ldquo;{newInsumoName}&rdquo; en ninguna categoría.
                                    </div>
                                  )}

                                  {/* Pie informativo */}
                                  <div className="p-1.5 px-3 bg-slate-50 text-[10px] text-slate-500 border-t border-slate-100 flex items-center justify-between">
                                    <span>Catálogo activo: {catalogItems.length} insumos</span>
                                    <span>{filteredCatalog.length} coincidencias</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Campo Cantidad con soporte para fórmulas */}
                            <input
                              ref={addQtyInputRef}
                              type="text"
                              value={newInsumoQtyFormula}
                              onChange={(e) => setNewInsumoQtyFormula(e.target.value)}
                              placeholder={newInsumoUnit === 'Porciones' ? 'Porciones (ej: 3)' : 'Cantidad (ej: 5 + 2)'}
                              className="w-full sm:w-32 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-500 font-mono shadow-2xs"
                            />

                            {/* Selector de Unidad Parametrizado según el Insumo */}
                            <select
                              value={newInsumoUnit}
                              onChange={(e) => setNewInsumoUnit(e.target.value)}
                              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-500"
                            >
                              {availableUnits.map((u) => (
                                <option key={u.value} value={u.value}>
                                  {u.label}
                                </option>
                              ))}
                            </select>

                            {/* Costo Factura (Autollenado, editable) */}
                            <input
                              type="number"
                              value={newInsumoPrice}
                              onChange={(e) => setNewInsumoPrice(Number(e.target.value))}
                              placeholder="Costo Factura"
                              className="w-full sm:w-28 px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-500 font-mono"
                            />

                            {/* Botones de Confirmación */}
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => handleAddItem(cat.id)}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Guardar</span>
                              </button>
                              <button
                                onClick={() => {
                                  setAddingCategory(null);
                                  setNewInsumoName('');
                                  setSelectedCatalogItem(null);
                                  setIsSearchOpen(false);
                                }}
                                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>

                          {/* Previsualización en Vivo de la Conversión Automática a Kg */}
                          {parsedAddQty > 0 && selectedUnitOpt && (
                            <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md w-fit font-mono">
                              <span>✓ Conversión automática:</span>
                              <strong>{convertedBaseQty} {selectedUnitOpt.baseUnit}</strong>
                              <span className="text-amber-600">(${estimatedCost.toLocaleString('es-CO')} COP)</span>
                              {newInsumoUnit === 'Porciones' && (
                                <span className="text-amber-700 text-[10px]">
                                  ({parsedAddQty} porciones calculadas en base a ficha técnica)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Botón minimalista estilo GitHub */
                        <button
                          onClick={() => {
                            setAddingCategory(cat.id);
                            setNewInsumoName('');
                            setNewInsumoQtyFormula('');
                            setSelectedCatalogItem(null);
                            const defUnits = getAllowedUnitsForInsumo();
                            setAvailableUnits(defUnits);
                            setNewInsumoUnit(defUnits[0].value);
                            if (activeOperationalView === 'COCINA_CIERRE' && cierreViewMode === 'AUTO') {
                              setCierreViewMode('MANUAL');
                            }
                          }}
                          className="w-full p-2.5 px-4 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1.5 transition-colors border-t border-slate-100 text-left cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {activeOperationalView === 'COCINA_CIERRE'
                              ? `+ Añadir conteo manual de cierre a ${cat.name}...`
                              : `Añadir insumo a ${cat.name}...`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Columna Derecha: Contenedor Adicional de Liquidación y Enlaces */}
            <aside className="w-full lg:w-80 xl:w-88 shrink-0 space-y-4 lg:sticky lg:top-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-4">
                {/* Encabezado */}
                <div className="border-b border-slate-100 pb-2.5">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Liquidación del Día
                  </h3>
                </div>

                {/* Cifras Operativas */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Total Costo Cocina Bruto del dia</span>
                    <span className="font-mono font-medium text-slate-900">
                      ${costoCocinaBruto.toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Total Devoluciones</span>
                    <span className="font-mono font-medium text-slate-700">
                      -${totalDevoluciones.toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200">
                    <span className="font-semibold text-slate-800">Total Neto Cocina del día</span>
                    <span className="font-mono font-bold text-slate-900">
                      ${costoNetoCocina.toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-600">Total de Ventas del dia</span>
                    <span className="font-mono font-medium text-slate-900">
                      ${ventasDia.toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-900">Rendimiento</span>
                    <span className="font-mono font-bold text-slate-900">
                      ${rendimientoDia >= 0 ? '+' : ''}${rendimientoDia.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>

                {/* Enlaces Estéticos en formato link sobrio */}
                <div className="border-t border-slate-200 pt-3">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setActiveOperationalView('COCINA_APERTURA')}
                      className={`w-full text-left text-xs py-1 transition-colors flex items-center justify-between cursor-pointer ${
                        activeOperationalView === 'COCINA_APERTURA'
                          ? 'text-slate-950 font-bold underline'
                          : 'text-slate-600 hover:text-slate-900 hover:underline'
                      }`}
                    >
                      <span>Cocina Apertura</span>
                      {activeOperationalView === 'COCINA_APERTURA' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveOperationalView('TRASLADOS')}
                      className={`w-full text-left text-xs py-1 transition-colors flex items-center justify-between cursor-pointer ${
                        activeOperationalView === 'TRASLADOS'
                          ? 'text-slate-950 font-bold underline'
                          : 'text-slate-600 hover:text-slate-900 hover:underline'
                      }`}
                    >
                      <span>Traslados Bodega a Cocina</span>
                      {activeOperationalView === 'TRASLADOS' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveOperationalView('DEVOLUCIONES')}
                      className={`w-full text-left text-xs py-1 transition-colors flex items-center justify-between cursor-pointer ${
                        activeOperationalView === 'DEVOLUCIONES'
                          ? 'text-slate-950 font-bold underline'
                          : 'text-slate-600 hover:text-slate-900 hover:underline'
                      }`}
                    >
                      <span>Devoluciones Cocina a Bodega</span>
                      {activeOperationalView === 'DEVOLUCIONES' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveOperationalView('COCINA_CIERRE')}
                      className={`w-full text-left text-xs py-1 transition-colors flex items-center justify-between cursor-pointer ${
                        activeOperationalView === 'COCINA_CIERRE'
                          ? 'text-slate-950 font-bold underline'
                          : 'text-slate-600 hover:text-slate-900 hover:underline'
                      }`}
                    >
                      <span>Cocina Cierre</span>
                      {activeOperationalView === 'COCINA_CIERRE' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                      )}
                    </button>
                  </div>

                  {/* Separador */}
                  <div className="border-t border-slate-200 my-2.5" />

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setActiveOperationalView('BODEGA_APERTURA')}
                      className={`w-full text-left text-xs py-1 transition-colors flex items-center justify-between cursor-pointer ${
                        activeOperationalView === 'BODEGA_APERTURA'
                          ? 'text-slate-950 font-bold underline'
                          : 'text-slate-600 hover:text-slate-900 hover:underline'
                      }`}
                    >
                      <span>Bodega Apertura</span>
                      {activeOperationalView === 'BODEGA_APERTURA' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveOperationalView('BODEGA_CIERRE')}
                      className={`w-full text-left text-xs py-1 transition-colors flex items-center justify-between cursor-pointer ${
                        activeOperationalView === 'BODEGA_CIERRE'
                          ? 'text-slate-950 font-bold underline'
                          : 'text-slate-600 hover:text-slate-900 hover:underline'
                      }`}
                    >
                      <span>Bodega Cierre</span>
                      {activeOperationalView === 'BODEGA_CIERRE' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </aside>

          </div>
        </div>
      )}
    </div>

      {/* ============================================================ */}
      {/* 3. MODAL: "+ NUEVA HOJA DE COSTEO" (Sobrio)                  */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Nueva Hoja de Costeo</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elige la fecha para generar el documento oficial.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSheet} className="space-y-4">
              {/* Selector de Fecha */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Fecha de la Operación:
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-500"
                  required
                />
              </div>

              {/* Título Autogenerado */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Título de la Hoja:
                </label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-800">
                  {formatDateToTitle(newDate)}
                </div>
              </div>

              {/* Checkbox Importar Cierre */}
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newCarryOver}
                  onChange={(e) => setNewCarryOver(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span className="text-xs text-slate-600 leading-tight">
                  Importar existencias de cierre de cocina como inventario que amanece
                </span>
              </label>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear y Abrir Hoja</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3.1. CONTENEDOR LATERAL DESPLEGABLE DE IZQUIERDA A DERECHA   */}
      {/* Administrador ágil del insumo, bajadas de bodega a cocina     */}
      {/* ============================================================ */}
      
      {/* Backdrop con desenfoque */}
      {activeDrawerInsumo && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-2xs z-40 transition-opacity"
          onClick={() => setActiveDrawerInsumo(null)}
        />
      )}

      {/* Contenedor Drawer deslizante de DERECHA A IZQUIERDA */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] md:w-[560px] bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-out ${
          activeDrawerInsumo ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        aria-label="Administrador de Insumo"
      >
        {activeDrawerInsumo && (
          <div className="flex flex-col h-full bg-white select-none">
            
            {/* Header del Panel Lateral */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="text-xs text-slate-500 font-medium">
                  <span className="text-slate-600">{activeDrawerInsumo.categoryName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawerInsumo(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Cerrar panel lateral"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-base md:text-lg font-bold text-slate-900 leading-tight">
                {activeDrawerInsumo.item.name}
              </h2>

              {/* KPIs Resumen Vital */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-white border border-slate-200 rounded-md p-2 text-center shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Trasladado</p>
                  <p className="text-sm md:text-base font-extrabold text-slate-900">
                    {activeDrawerInsumo.item.qty} <span className="text-xs font-medium text-slate-500">{activeDrawerInsumo.item.unit}</span>
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-md p-2 text-center shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Costo Factura</p>
                  <p className="text-sm md:text-base font-extrabold text-slate-900">
                    ${activeDrawerInsumo.item.unitPrice.toLocaleString('es-CO')}
                  </p>
                  <p className="text-[10px] text-slate-400">/{activeDrawerInsumo.item.unit}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-md p-2 text-center shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total en Dinero</p>
                  <p className="text-sm md:text-base font-extrabold text-orange-700">
                    ${activeDrawerInsumo.item.total.toLocaleString('es-CO')}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenido con Scroll: Formulario Rápido + Historial de Bajadas */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              
              {/* Notificación de éxito */}
              {drawerSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-md flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{drawerSuccessMsg}</span>
                </div>
              )}

              {/* -------------------------------------------------------- */}
              {/* FORMULARIO LIMPIO ESTILO GITHUB                          */}
              {/* -------------------------------------------------------- */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  {editingRegId ? 'Editar Registro' : 'Ingresar Cantidad'}
                </h3>

                <form onSubmit={handleAddInsumoRegistro} className="space-y-3">
                  
                  {/* Fila 1: Presentación (Va primero!) + Costo Unitario */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Dropdown Presentación: Entero / Porción */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Presentación
                      </label>
                      <select
                        tabIndex={1}
                        value={drawerPresentacion}
                        onChange={(e) => {
                          const newP = e.target.value as 'Entero' | 'Porcion';
                          setDrawerPresentacion(newP);
                          if (newP === 'Porcion') {
                            const stdW = getPortionWeightKg(activeDrawerInsumo.item.name);
                            const pCount = evaluateQtyFormula(drawerQtyFormula).value;
                            if (pCount > 0) {
                              setDrawerCustomWeight((pCount * stdW).toFixed(2));
                            }
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-500 cursor-pointer"
                      >
                        <option value="Entero">Entero</option>
                        <option value="Porcion">Porción</option>
                      </select>
                    </div>

                    {/* Costo Unitario Factura (Autollenado y Modificable) */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Costo Unitario ($/{activeDrawerInsumo.item.unit})
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">$</span>
                        <input
                          tabIndex={2}
                          type="number"
                          step="any"
                          required
                          value={drawerUnitPrice}
                          onChange={(e) => setDrawerUnitPrice(e.target.value)}
                          placeholder="0"
                          className="w-full bg-white border border-slate-300 rounded-md pl-6 pr-2 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fila 2: Cantidad a Sumar según Presentación */}
                  {drawerPresentacion === 'Entero' ? (
                    /* MODO ENTERO: Cantidad a Sumar directa en unidad de inventario */
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-slate-800">
                          Cantidad a Sumar ({activeDrawerInsumo.item.unit})
                        </label>
                        {evaluateQtyFormula(drawerQtyFormula).preview && (
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {evaluateQtyFormula(drawerQtyFormula).preview} {activeDrawerInsumo.item.unit}
                          </span>
                        )}
                      </div>
                      
                      <div className="relative">
                        <input
                          ref={qtyInputRef}
                          type="text"
                          required
                          autoFocus
                          tabIndex={3}
                          value={drawerQtyFormula}
                          onChange={(e) => setDrawerQtyFormula(e.target.value)}
                          placeholder="Ej: 22.9  ó  10 + 12.9"
                          className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-md pl-3 pr-14 py-1.5 text-xs text-slate-900 font-bold placeholder:text-slate-400 placeholder:font-normal focus:outline-none transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                          {activeDrawerInsumo.item.unit}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* MODO PORCIÓN: Cantidad a Sumar (Porciones) + Peso Total Calculado (Kg) */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-800">
                            Cantidad a Sumar (Porciones)
                          </label>
                          {evaluateQtyFormula(drawerQtyFormula).preview && (
                            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {evaluateQtyFormula(drawerQtyFormula).preview}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            ref={qtyInputRef}
                            type="text"
                            required
                            autoFocus
                            tabIndex={3}
                            value={drawerQtyFormula}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDrawerQtyFormula(val);
                              const pCount = evaluateQtyFormula(val).value;
                              const stdW = getPortionWeightKg(activeDrawerInsumo.item.name);
                              if (pCount > 0) {
                                setDrawerCustomWeight((pCount * stdW).toFixed(2));
                              } else {
                                setDrawerCustomWeight('');
                              }
                            }}
                            placeholder="Ej: 26  ó  10 + 16"
                            className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-md pl-3 pr-20 py-1.5 text-xs text-slate-900 font-bold placeholder:text-slate-400 placeholder:font-normal focus:outline-none transition-colors"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                            Porciones
                          </span>
                        </div>
                      </div>

                      {/* Peso Total Calculado (Kg) - Modificable por el usuario */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-800">
                            Peso Total ({activeDrawerInsumo.item.unit})
                          </label>
                          <span className="text-[10px] text-slate-400">
                            {(getPortionWeightKg(activeDrawerInsumo.item.name) * 1000).toFixed(0)}g std
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            tabIndex={4}
                            type="number"
                            step="any"
                            required
                            value={drawerCustomWeight}
                            onChange={(e) => setDrawerCustomWeight(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-md pl-3 pr-12 py-1.5 text-xs text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none transition-colors"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                            {activeDrawerInsumo.item.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fila 3: Nota / Observación opcional */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nota / Observación <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      tabIndex={5}
                      type="text"
                      value={drawerObs}
                      onChange={(e) => setDrawerObs(e.target.value)}
                      placeholder="Ej: Menú del mediodía"
                      className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500"
                    />
                  </div>

                  {/* Botones de acción dinámicos: Registrar vs Cancelar / Guardar Cambio */}
                  {editingRegId ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="w-full bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold py-2 px-3 rounded-md transition-colors cursor-pointer text-center"
                      >
                        Cancelar
                      </button>
                      <button
                        tabIndex={6}
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors shadow-2xs cursor-pointer text-center active:scale-98"
                      >
                        Guardar Cambio
                      </button>
                    </div>
                  ) : (
                    <button
                      tabIndex={6}
                      type="submit"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors shadow-2xs flex items-center justify-center cursor-pointer active:scale-98"
                    >
                      Registrar
                    </button>
                  )}
                </form>
              </div>

              {/* -------------------------------------------------------- */}
              {/* HISTORIAL: LISTADO DE LAS VECES QUE SE HA INGRESADO     */}
              {/* -------------------------------------------------------- */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <span>Historial</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      ({getItemMetricsForView(activeDrawerInsumo.item).filteredRegs.length} en vista actual)
                    </span>
                  </h4>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden shadow-2xs">
                  {(!activeDrawerInsumo.item.registros || activeDrawerInsumo.item.registros.length === 0) ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No hay registros individuales todavía. Usa el formulario superior para registrar la primera bajada.
                    </div>
                  ) : (
                    getItemMetricsForView(activeDrawerInsumo.item).filteredRegs.map((reg) => (
                      <div
                        key={reg.id}
                        className="p-3 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          {/* Fila 1: Presentación + Usuario */}
                          <div className="flex items-center gap-2 flex-wrap text-[11px]">
                            <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px] border ${
                              reg.tipo === 'INVENTARIO_INICIAL_COCINA'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : reg.tipo === 'DEVOLUCION_COCINA'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {reg.tipo === 'INVENTARIO_INICIAL_COCINA' && 'Cocina Apertura'}
                              {reg.tipo === 'DEVOLUCION_COCINA' && 'Devolución Cocina → Bodega'}
                              {reg.tipo === 'BODEGA_A_COCINA' && 'Traslado Bodega → Cocina'}
                              {reg.tipo === 'COCINA_CIERRE' && 'Cocina Cierre'}
                              {reg.tipo === 'BODEGA_APERTURA' && 'Bodega Apertura'}
                              {reg.tipo === 'BODEGA_CIERRE' && 'Bodega Cierre'}
                            </span>
                            {reg.presentacion && (
                              <span className="bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded font-medium text-[10px] border border-slate-200">
                                {reg.presentacion}
                              </span>
                            )}
                            <span className="text-slate-500 font-medium text-[11px]">
                              {reg.usuario}
                            </span>
                          </div>

                          {/* Fila 2: Cantidad y Subtotal */}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              +{reg.cantidad} {reg.unidad}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600 font-medium">
                              ${reg.costoUnitario.toLocaleString('es-CO')} /{reg.unidad}
                            </span>
                            <span className="text-slate-400">=</span>
                            <span className="font-bold text-slate-900">
                              ${reg.total.toLocaleString('es-CO')} COP
                            </span>
                          </div>

                          {/* Fila 3: Detalle de cálculo u observación si existen */}
                          {(reg.detalleCalculo || reg.observaciones) && (
                            <div className="text-[11px] text-slate-500 space-y-0.5 pt-0.5">
                              {reg.detalleCalculo && (
                                <p className="italic text-slate-600">
                                  Detalle: {reg.detalleCalculo}
                                </p>
                              )}
                              {reg.observaciones && (
                                <p className="text-slate-500">
                                  Nota: "{reg.observaciones}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Botón Lapicito para Editar */}
                          <button
                            type="button"
                            onClick={() => handleStartEditRegistro(reg)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              editingRegId === reg.id
                                ? 'bg-orange-100 text-orange-700'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Editar este registro"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Botón Eliminar Registro */}
                          <button
                            type="button"
                            onClick={() => {
                              if (editingRegId === reg.id) handleCancelEdit();
                              handleDeleteInsumoRegistro(reg.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Eliminar este registro específico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Footer con botón de cerrar */}
            <div className="p-3 px-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 text-[11px]">
                Cambios reflejados automáticamente en la hoja activa
              </span>
              <button
                type="button"
                onClick={() => setActiveDrawerInsumo(null)}
                className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>

          </div>
        )}
      </aside>

      {/* ============================================================ */}
      {/* 4. MODAL: PREVISUALIZACIÓN DEL DOCUMENTO                     */}
      {/* ============================================================ */}
      {showPreviewModal && activeSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Cabecera Modal */}
            <div className="bg-slate-900 text-white p-3 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">
                  Previsualización del Formato Oficial de Valorización
                </h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo del Documento */}
            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50">
              <div className="bg-white p-6 border border-slate-200 rounded-md shadow-2xs space-y-4 font-sans text-xs">
                
                <div className="border-b border-slate-200 pb-3 text-center">
                  <h2 className="text-sm font-bold text-slate-900">
                    CHOCLOS Y ASADOS LA FINCA S.A.S.
                  </h2>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    VALORIZACIÓN DIARIA DE INSUMOS DE COCINA
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {activeSheet.title.split(' - ')[0]}
                  </p>
                </div>

                <div className="space-y-4">
                  {activeSheet.categories.map((cat) => (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex justify-between font-bold text-slate-800 border-b border-slate-200 pb-1 text-[11px] uppercase tracking-wide">
                        <span>{cat.name}</span>
                        <span>${calculateCategoryTotal(cat).toLocaleString('es-CO')}</span>
                      </div>
                      <div className="divide-y divide-slate-100 text-slate-600">
                        {cat.items.map((it) => (
                          <div key={it.id} className="flex justify-between py-1">
                            <span>{it.qty} {it.unit} · {it.name}</span>
                            <span className="font-mono text-slate-800">${it.total.toLocaleString('es-CO')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-slate-100 border border-slate-200 rounded flex justify-between items-center text-xs font-bold text-slate-900">
                  <span>COSTO TOTAL NETO TRASLADOS:</span>
                  <span className="text-sm">
                    ${calculateSheetTotal(activeSheet).toLocaleString('es-CO')} COP
                  </span>
                </div>
              </div>
            </div>

            {/* Pie Modal */}
            <div className="p-3 px-4 border-t border-slate-200 bg-white flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md font-medium"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  alert('¡PDF generado correctamente!');
                  setShowPreviewModal(false);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3.5 py-1.5 rounded-md font-medium transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </button>
            </div>

          </div>
        </div>
      )}


      {/* ============================================================ */}
      {/* 3.3. SLIDE-OVER DRAWER: AÑADIR CONTEOS (Derecha a Izquierda) */}
      {/* ============================================================ */}
      {isConteosDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-2xs z-40 transition-opacity"
          onClick={() => setIsConteosDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[700px] md:w-[820px] lg:w-[880px] bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-out ${
          isConteosDrawerOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        aria-label="Panel Añadir Conteos"
      >
        {/* Header del Panel */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/90 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-700" />
              <span>Añadir Conteos</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pega el texto del inventario o conteo para interpretarlo e ingresarlo automáticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsConteosDrawerOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Cerrar panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 select-none">
          {/* Selector Destino del Conteo + Modo de Acción Minimalista */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-2.5">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Destino del Conteo:
              </label>
              <select
                value={conteosTargetView}
                onChange={(e) => {
                  const newTarget = e.target.value as any;
                  setConteosTargetView(newTarget);
                  if (newTarget === 'TRASLADOS' || newTarget === 'DEVOLUCIONES') {
                    setConteosActionMode('SUMAR');
                  } else {
                    setConteosActionMode('REEMPLAZAR');
                  }
                }}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-500 transition-colors"
              >
                <option value="COCINA_CIERRE">Cocina Cierre (Inventario Final)</option>
                <option value="COCINA_APERTURA">Cocina Apertura (Inventario Inicial)</option>
                <option value="TRASLADOS">Traslados Bodega a Cocina</option>
                <option value="DEVOLUCIONES">Devoluciones Cocina a Bodega</option>
                <option value="BODEGA_APERTURA">Bodega Apertura</option>
                <option value="BODEGA_CIERRE">Bodega Cierre</option>
              </select>
            </div>

            {/* Acción minimalista de 1 sola línea */}
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">Acción:</span>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-medium">
                  <input
                    type="radio"
                    name="conteosActionMode"
                    value="SUMAR"
                    checked={conteosActionMode === 'SUMAR'}
                    onChange={() => setConteosActionMode('SUMAR')}
                    className="text-slate-900 focus:ring-0"
                  />
                  <span>Sumar (+)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-medium">
                  <input
                    type="radio"
                    name="conteosActionMode"
                    value="REEMPLAZAR"
                    checked={conteosActionMode === 'REEMPLAZAR'}
                    onChange={() => setConteosActionMode('REEMPLAZAR')}
                    className="text-slate-900 focus:ring-0"
                  />
                  <span>Reemplazar (=)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Textarea para pegar texto de conteos */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs space-y-2 relative">
            <div className="flex items-center justify-between pr-8">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Pegar Texto del Conteo:
              </label>
              <button
                type="button"
                onClick={handleLoadSampleConteos}
                className="text-[11px] text-orange-600 hover:text-orange-700 font-medium hover:underline cursor-pointer"
              >
                Cargar texto de ejemplo
              </button>
            </div>

            {/* Botón X en la esquina superior del contenedor para limpiar */}
            {conteosRawText && (
              <button
                type="button"
                onClick={() => {
                  setConteosRawText('');
                  setParsedConteosList([]);
                }}
                className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                title="Limpiar texto y tabla analizada"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <textarea
              rows={5}
              value={conteosRawText}
              onChange={(e) => {
                setConteosRawText(e.target.value);
                handleParseConteos(e.target.value);
              }}
              placeholder="Pega aquí los conteos (ej: San Luis 10, Punta de anca 5, Costilla ahumada 4.3 kls, Arroz 5, Vasos 9 oz 2)..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-500 transition-colors resize-y placeholder:text-slate-400"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Detecta automáticamente insumos, cantidades y unidades.</span>
              <button
                type="button"
                onClick={() => handleParseConteos(conteosRawText)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors cursor-pointer"
              >
                Re-analizar
              </button>
            </div>
          </div>

          {/* Tabla de Información Analizada y Formateada */}
          {parsedConteosList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Información Analizada ({parsedConteosList.length} items)
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">
                  Revisa y ajusta cantidades de ser necesario
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-x-auto shadow-2xs">
                <div className="min-w-[660px]">
                  {/* Encabezado con 5 columnas exactamente simétricas del mismo ancho (20% cada una) */}
                  <div className="grid grid-cols-5 gap-3 p-2.5 px-3 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider items-center select-none">
                    <div className="text-left">Insumo Identificado</div>
                    <div className="text-left">Presentación</div>
                    <div className="text-center">Cantidad</div>
                    <div className="text-right">Equiv. Total</div>
                    <div className="text-right">Subtotal / Acc.</div>
                  </div>

                  {/* Filas: exactamente 5 columnas simétricas, sin distorsión de paddings ni movimientos */}
                  {parsedConteosList.map((item) => {
                    const allowedUnits = getUnitsForItem(item.itemName, item.category, item.stdPortionWeight);

                    return (
                      <div
                        key={item.id}
                        className="p-2.5 px-3 hover:bg-slate-50/80 transition-colors grid grid-cols-5 gap-3 items-center text-xs"
                      >
                        {/* Columna 1: Insumo Identificado */}
                        <div className="min-w-0 pr-1">
                          <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5" title={item.itemName}>
                            <span className="truncate">{item.itemName}</span>
                            {!item.isMatched && (
                              <span className="text-[9px] bg-amber-50 text-amber-800 px-1 py-0.2 rounded font-medium shrink-0 border border-amber-200">
                                Nuevo
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap truncate">
                            <span className="truncate">{item.category}</span>
                          </div>
                        </div>

                        {/* Columna 2: Presentación (Dropdown sin badge, estilo Git sobrio) */}
                        <div className="min-w-0">
                          <select
                            value={item.inputUnit}
                            onChange={(e) => handleUpdateParsedItemUnit(item.id, e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-500 shadow-2xs hover:border-slate-400 transition-colors cursor-pointer truncate"
                          >
                            {allowedUnits.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Columna 3: Cantidad (Input centrado de tamaño fijo, sin distorsiones por textos dinámicos) */}
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            step="any"
                            value={item.rawQty}
                            onChange={(e) => handleUpdateParsedItemQty(item.id, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-center text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-500 shadow-2xs hover:border-slate-400 transition-colors"
                          />
                        </div>

                        {/* Columna 4: Equivalente Total (Alineado a la derecha, siempre en Kg para carnes) */}
                        <div className="text-right font-mono font-semibold text-slate-800 text-xs">
                          {item.weightKg} {item.baseUnit}
                        </div>

                        {/* Columna 5: Subtotal y Eliminar */}
                        <div className="flex items-center justify-end gap-2.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            ${item.estimatedTotal.toLocaleString('es-CO')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveParsedItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
                            title="Quitar este item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/90 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 select-none">
          <div className="text-xs text-slate-600">
            {parsedConteosList.length > 0 ? (
              <span>
                Total analizado: <strong>{parsedConteosList.length} items</strong> ·{' '}
                <strong>
                  {parsedConteosList.reduce((acc, it) => acc + (it.baseUnit === 'Kg' ? it.weightKg : 0), 0).toFixed(1)} Kg
                </strong>{' '}
                ·{' '}
                <strong className="text-slate-900">
                  ${parsedConteosList.reduce((acc, it) => acc + it.estimatedTotal, 0).toLocaleString('es-CO')} COP
                </strong>
              </span>
            ) : (
              <span className="text-slate-400">Pega texto para previsualizar los conteos</span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsConteosDrawerOpen(false)}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={parsedConteosList.length === 0}
              onClick={handleApplyConteos}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-md transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {conteosActionMode === 'SUMAR' ? 'Sumar Conteos (+)' : 'Reemplazar Conteos (=)'} ({parsedConteosList.length})
              </span>
            </button>
          </div>
        </div>
      </aside>

    </div>
  );
}
