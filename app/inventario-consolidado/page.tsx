'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Pencil,
  Trash2,
  Clock,
  User,
  Calculator,
  History,
  FileSpreadsheet, 
  Layers, 
  Search, 
  Calendar, 
  ArrowLeft, 
  X, 
  Loader2,
  Columns,
  ListFilter,
  Plus,
  Check,
  ClipboardList,
  Sparkles,
  CheckCircle2,
  Download
} from 'lucide-react';
import MonthSidebar, { MonthItem, formatMonthLabel, buildDynamicMonths } from '@/components/sheets/MonthSidebar';
import { usePeriodo } from '@/context/PeriodoContext';
import { downloadInventarioConsolidadoPdf } from '@/lib/exportInventarioConsolidadoPdf';

interface RegistroItem {
  id: string;
  hora: string;
  usuario: string;
  tipo: string;
  origen: string;
  destino: string;
  cantidad: number;
  unidad: string;
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
  registros: RegistroItem[];
}

interface CategoryGroup {
  id: string;
  name: string;
  items: InsumoItem[];
  subtotal: number;
  itemsCount: number;
}

interface CosteoSheet {
  id: string;
  title: string;
  dateStr: string;
  posSales: number;
  categories: CategoryGroup[];
}

interface AllowedUnitOption {
  value: string;
  label: string;
  baseUnit: string;
  toBaseFactor: (catalogItem?: any) => number;
}

interface ParsedConteoItem {
  id: string;
  originalLine: string;
  itemName: string;
  category: string;
  rawQty: number;
  rawQtyStr: string;
  presentation: 'Entero' | 'Porcion';
  inputUnit: string;
  baseUnit: string;
  weightKg: number;
  unitPrice: number;
  estimatedTotal: number;
  stdPortionWeight?: number;
  isMatched: boolean;
  catalogItemId?: string;
  catalogItem?: any;
}

// Unidades comunes por defecto (garantiza que el select NUNCA esté vacío)
const DEFAULT_UNITS: AllowedUnitOption[] = [
  { value: 'Kg', label: 'Kilogramos (Kg)', baseUnit: 'Kg', toBaseFactor: () => 1 },
  { value: 'Und', label: 'Unidades (Und)', baseUnit: 'Und', toBaseFactor: () => 1 },
  { value: 'Libras', label: 'Libras (500g)', baseUnit: 'Kg', toBaseFactor: () => 0.5 },
  { value: 'Gramos', label: 'Gramos (g)', baseUnit: 'Kg', toBaseFactor: () => 0.001 },
  { value: 'Paquete', label: 'Paquetes', baseUnit: 'Paquete', toBaseFactor: () => 1 },
  { value: 'Porciones', label: 'Porciones', baseUnit: 'Kg', toBaseFactor: () => 0.25 },
  { value: 'Litro', label: 'Litros (Lt)', baseUnit: 'Litro', toBaseFactor: () => 1 },
  { value: 'Bolsa', label: 'Bolsas', baseUnit: 'Bolsa', toBaseFactor: () => 1 },
  { value: 'Atado', label: 'Atados', baseUnit: 'Atado', toBaseFactor: () => 1 },
  { value: 'Bulto', label: 'Bultos', baseUnit: 'Bulto', toBaseFactor: () => 1 }
];

// ==========================================
// HELPERS DE NORMALIZACIÓN Y MATEMÁTICAS
// ==========================================
function normalizeStrHelper(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function evaluateQtyFormula(formula: string): { value: number; isValid: boolean; preview?: string } {
  if (!formula || !formula.trim()) return { value: 0, isValid: false };
  const sanitized = formula.replace(/,/g, '.').replace(/[^0-9+\-*/.()]/g, '').trim();
  if (!sanitized) return { value: 0, isValid: false };
  try {
    if (/[+\-*/]$/.test(sanitized)) {
      const sub = sanitized.slice(0, -1);
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

function isPortionableMeat(catalogItem?: any, name: string = '', category: string = ''): boolean {
  const n = normalizeStrHelper(name || catalogItem?.nombre || catalogItem?.insumo || '');
  if (n.includes('tamal') || n.includes('huevo')) return false;

  const tipo = catalogItem?.tipo_medida || '';
  if (tipo === 'UNIDADES') {
    if (!n.includes('chorizo') && !n.includes('morcilla') && !n.includes('rellena')) return false;
  }

  if (catalogItem?.es_carne && (tipo === 'KGS_Y_UNIDADES' || tipo === 'KGS')) return true;
  if (catalogItem?.es_carne && Number(catalogItem?.peso_estandar_porcion_kg) > 0 && tipo !== 'UNIDADES') return true;

  const c = normalizeStrHelper(category || catalogItem?.categoria || '');
  return c.includes('carne') || c.includes('res') || c.includes('cerdo') || c.includes('pollo') || c.includes('pescado');
}

function getPortionWeightKg(name: string): number {
  const match = name.match(/(\d+)\s*g/i);
  if (match) return parseFloat(match[1]) / 1000;
  const lower = name.toLowerCase();
  if (lower.includes('costilla')) return 0.400;
  if (lower.includes('punta de anca') || lower.includes('churrasco') || lower.includes('bife')) return 0.350;
  if (lower.includes('basa') || lower.includes('filete') || lower.includes('pechuga') || lower.includes('pollo')) return 0.300;
  if (lower.includes('sobrebarriga')) return 0.380;
  if (lower.includes('molida')) return 0.250;
  if (lower.includes('tocino') || lower.includes('chicharron')) return 0.200;
  return 0.350;
}

function getAllowedUnitsForInsumo(item?: {
  nombre?: string;
  insumo?: string;
  categoria?: string;
  unidad_medida?: string;
  tipo_medida?: string;
  es_carne?: boolean;
}): AllowedUnitOption[] {
  if (!item) return DEFAULT_UNITS;

  const n = (item?.nombre || item?.insumo || '').toLowerCase();
  const c = (item?.categoria || '').toLowerCase();
  const u = (item?.unidad_medida || '').toLowerCase();
  const tipo = item?.tipo_medida || '';

  if (n.includes('huevo')) {
    return [
      { value: 'Und', label: 'Unidades (Und)', baseUnit: 'Und', toBaseFactor: () => 1 },
      { value: 'Panal', label: 'Panales (30 Und)', baseUnit: 'Und', toBaseFactor: () => 30 }
    ];
  }

  if (n.includes('leche') || n.includes('aceite') || n.includes('jugo') || u === 'litro' || u === 'lt' || u.includes('bidon')) {
    return [
      { value: 'Litro', label: 'Litros (Lt)', baseUnit: 'Litro', toBaseFactor: () => 1 },
      { value: 'Bolsa', label: 'Bolsas (1.1 Lt)', baseUnit: 'Litro', toBaseFactor: () => 1.1 },
      { value: 'Bidón', label: 'Bidones (20 Lt)', baseUnit: 'Litro', toBaseFactor: () => 20 },
      { value: 'Mililitro', label: 'Mililitros (ml)', baseUnit: 'Litro', toBaseFactor: () => 0.001 }
    ];
  }

  if (tipo === 'PAQUETES' || c.includes('desechable') || c.includes('empaque') || n.includes('vaso') || n.includes('servilleta') || n.includes('bolsa')) {
    return [
      { value: 'Paquete', label: 'Paquetes', baseUnit: 'Paquete', toBaseFactor: () => 1 },
      { value: 'Und', label: 'Unidades (Und)', baseUnit: 'Und', toBaseFactor: () => 1 },
      { value: 'Rollo', label: 'Rollos', baseUnit: 'Und', toBaseFactor: () => 1 }
    ];
  }

  if (isPortionableMeat(item, n, c)) {
    const stdWeight = getPortionWeightKg(n);
    return [
      { value: 'Kg', label: 'Kilogramos (Kg)', baseUnit: 'Kg', toBaseFactor: () => 1 },
      { value: 'Porciones', label: `Porciones (${Math.round(stdWeight * 1000)}g c/u)`, baseUnit: 'Kg', toBaseFactor: () => stdWeight },
      { value: 'Libras', label: 'Libras (500g)', baseUnit: 'Kg', toBaseFactor: () => 0.5 },
      { value: 'Gramos', label: 'Gramos (g)', baseUnit: 'Kg', toBaseFactor: () => 0.001 },
      { value: 'Und', label: 'Unidades (Und)', baseUnit: 'Und', toBaseFactor: () => 1 }
    ];
  }

  return DEFAULT_UNITS;
}

function getCategoryBadgeStyle(cat?: string): string {
  const c = (cat || '').toUpperCase();
  if (c.includes('VERDURA')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (c.includes('GRANO') || c.includes('ABARROTE')) return 'bg-amber-50 text-amber-900 border-amber-200';
  if (c.includes('DESECHABLE') || c.includes('EMPAQUE')) return 'bg-indigo-50 text-indigo-800 border-indigo-200';
  if (c.includes('BEBIDA')) return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  if (c.includes('HUEVO') || c.includes('LACTEO')) return 'bg-yellow-50 text-yellow-900 border-yellow-200';
  if (c.includes('CARNE') || c.includes('POLLO') || c.includes('RES') || c.includes('CERDO') || c.includes('PESCADO')) return 'bg-rose-50 text-rose-800 border-rose-200';
  return 'bg-slate-100 text-slate-800 border-slate-200';
}

function inferCategoryFromName(name: string): { category: string; defaultUnit: string } {
  const n = normalizeStrHelper(name);
  if (n.includes('vaso') || n.includes('tapa') || n.includes('pitillo') || n.includes('contenedor') || n.includes('servilleta') || n.includes('bolsa') || n.includes('guante')) {
    return { category: 'Desechables y Empaques', defaultUnit: 'Paquete' };
  }
  if (n.includes('arroz') || n.includes('frijol') || n.includes('lenteja') || n.includes('aceite') || n.includes('azucar') || n.includes('sal') || n.includes('panela') || n.includes('harina') || n.includes('cafe') || n.includes('chocolate') || n.includes('salsa') || n.includes('mayonesa') || n.includes('mostaza') || n.includes('pasta')) {
    return { category: 'Granos y Abarrotes', defaultUnit: 'Kg' };
  }
  if (n.includes('zanahor') || n.includes('cebolla') || n.includes('tomate') || n.includes('papa') || n.includes('platano') || n.includes('yuca') || n.includes('limon') || n.includes('cilantro') || n.includes('ajo') || n.includes('pimenton') || n.includes('lechuga') || n.includes('carbon')) {
    return { category: 'Verduras e Insumos', defaultUnit: 'Kg' };
  }
  if (n.includes('huevo') || n.includes('leche') || n.includes('queso')) {
    return { category: 'Huevos y Lácteos', defaultUnit: n.includes('huevo') ? 'Und' : 'Lts' };
  }
  if (
    n.includes('gaseosa') || n.includes('cerv') || n.includes('cerveza') || n.includes('poker') || n.includes('club colombia') ||
    n.includes('aguila') || n.includes('costeñ') || n.includes('corona') || n.includes('stella') || n.includes('heineken') ||
    n.includes('jugo') || n.includes('gatorade') || n.includes('red bull') || n.includes('vive 100') || n.includes('speed') ||
    n.includes('monster') || n.includes('postobon') || n.includes('coca') || (n.includes('hit') && !n.includes('tahiti')) || n.includes('pony') ||
    n.includes('malta') || n.includes('licor') || n.includes('aguardiente') || n.includes('ron') || n.includes('whisky') ||
    n.includes('tequila') || n.includes('vodka') || n.includes('vino') || n.includes('soda') || n.includes('bretaña') ||
    (n.includes('agua') && !n.includes('aguacate') && !n.includes('aguapanela') && !n.includes('aguamadre')) ||
    n.includes('bebida')
  ) {
    return { category: 'Bebidas', defaultUnit: 'Und' };
  }
  if (n.includes('carne') || n.includes('res') || n.includes('cerdo') || n.includes('pollo') || n.includes('churrasco') || n.includes('costilla') || n.includes('lomo') || n.includes('punta de anca') || n.includes('chorizo')) {
    return { category: 'Carnes y Proteínas', defaultUnit: 'Kg' };
  }
  return { category: 'Verduras e Insumos', defaultUnit: 'Kg' };
}

function findBestCatalogMatch(query: string, catalogList: any[]): { item: any | null; score: number } {
  const normQuery = normalizeStrHelper(query);
  if (!normQuery) return { item: null, score: 0 };

  for (const c of catalogList) {
    const cName = normalizeStrHelper(c.nombre || c.insumo || '');
    if (cName === normQuery) return { item: c, score: 1.0 };
  }
  for (const c of catalogList) {
    const cName = normalizeStrHelper(c.nombre || c.insumo || '');
    if (cName.includes(normQuery) || normQuery.includes(cName)) return { item: c, score: 0.85 };
  }
  return { item: null, score: 0 };
}

function parseBulkConteosText(rawText: string, catalogList: any[]): ParsedConteoItem[] {
  const lines = rawText.split('\n');
  const results: ParsedConteoItem[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (!line) continue;

    let explicitUnit: string | null = null;
    if (/\b(kg|kilos|kilo|kls)\b/i.test(line)) explicitUnit = 'Kg';
    else if (/\b(und|unds|unidades|unidad)\b/i.test(line)) explicitUnit = 'Und';
    else if (/\b(porc|porciones|porcion)\b/i.test(line)) explicitUnit = 'Porciones';
    else if (/\b(lts|lt|litros|litro)\b/i.test(line)) explicitUnit = 'Lts';
    else if (/\b(lbs|lb|libras|libra)\b/i.test(line)) explicitUnit = 'Libras';
    else if (/\b(gr|gramos|g)\b/i.test(line)) explicitUnit = 'Gramos';
    else if (/\b(paq|paquetes|paquete)\b/i.test(line)) explicitUnit = 'Paquete';
    else if (/\b(atado|atados)\b/i.test(line)) explicitUnit = 'Atado';
    else if (/\b(bulto|bultos)\b/i.test(line)) explicitUnit = 'Bulto';
    else if (/\b(bolsa|bolsas)\b/i.test(line)) explicitUnit = 'Bolsa';

    const clean = line
      .replace(/\b(kg|kilos|kilo|und|unds|unidades|unidad|porc|porciones|lts|litros|lbs|libras|gr|gramos|paq|paquete|atado|bulto|bolsa)\b/gi, '')
      .trim();

    let qty = 1;
    let itemPart = clean;
    const matchNum = clean.match(/(\d+(?:[.,]\d+)?)/);
    if (matchNum) {
      qty = parseFloat(matchNum[1].replace(',', '.'));
      itemPart = clean.replace(matchNum[0], '').replace(/[-:(]/g, '').trim();
    }

    itemPart = itemPart.replace(/[()\[\]]/g, '').trim();
    const { item: matchedItem, score } = findBestCatalogMatch(itemPart, catalogList);
    const isMatched = !!matchedItem && score >= 0.7;
    const inferred = inferCategoryFromName(itemPart);

    const finalName = isMatched ? (matchedItem.nombre || matchedItem.insumo) : itemPart;
    const finalCategory = isMatched ? (matchedItem.categoria || inferred.category) : inferred.category;
    const finalUnit = explicitUnit || (isMatched && matchedItem.unidad_medida) || inferred.defaultUnit;
    const unitPrice = isMatched && Number(matchedItem.costo_unitario_kg) > 0 ? Number(matchedItem.costo_unitario_kg) : 5000;

    results.push({
      id: `conteo-bulk-${idx}-${Date.now()}`,
      originalLine: line,
      itemName: finalName,
      category: finalCategory,
      rawQty: qty,
      rawQtyStr: String(qty),
      presentation: 'Entero',
      inputUnit: finalUnit,
      baseUnit: finalUnit,
      weightKg: qty,
      unitPrice,
      estimatedTotal: Math.round(qty * unitPrice),
      isMatched,
      catalogItemId: matchedItem?.id
    });
  }

  return results;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function InventarioConsolidadoPage() {
  const [sheets, setSheets] = useState<CosteoSheet[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11');
  const [searchQuery, setSearchQuery] = useState('');
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Modo de visualización: 'CONSOLIDADO' | 'COCINA_CIERRE' | 'BODEGA_CIERRE' | 'PARALELO'
  const [viewMode, setViewMode] = useState<'CONSOLIDADO' | 'COCINA_CIERRE' | 'BODEGA_CIERRE' | 'PARALELO'>('CONSOLIDADO');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Slide-over Drawer: Añadir Conteos Masivos por Texto
  const [isConteosDrawerOpen, setIsConteosDrawerOpen] = useState(false);
  const [conteosActionMode, setConteosActionMode] = useState<'SUMAR' | 'REEMPLAZAR'>('REEMPLAZAR');
  const [conteosRawText, setConteosRawText] = useState('');
  const [parsedConteosList, setParsedConteosList] = useState<ParsedConteoItem[]>([]);
  const [toastMessage, setToastMessage] = useState('');

  // ESTADO DEL INPUT INTELIGENTE GLOBAL:
  // Controla si está desplegado o si se muestra el botón "+ Añadir insumo..."
  const [isAddingGlobalItem, setIsAddingGlobalItem] = useState(false);
  const [newInsumoName, setNewInsumoName] = useState('');
  const [newInsumoQtyFormula, setNewInsumoQtyFormula] = useState('');
  const [newInsumoUnit, setNewInsumoUnit] = useState<string>('Kg');
  const [newInsumoPrice, setNewInsumoPrice] = useState<number | ''>('');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<any | null>(null);
  const [availableUnits, setAvailableUnits] = useState<AllowedUnitOption[]>(DEFAULT_UNITS);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchCategoryFilter, setSearchCategoryFilter] = useState('TODOS');
  const [savingManualItem, setSavingManualItem] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar hojas desde /api/costeo-diario y catálogo desde /api/catalogo
  const fetchSheets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/costeo-diario?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.sheets && Array.isArray(data.sheets) && data.sheets.length > 0) {
        setSheets(data.sheets);
        const latestMonth = data.sheets[0].month || data.sheets[0].dateStr.slice(0, 7);
        setSelectedMonth(prev => {
          const hasInPrev = data.sheets.some((s: any) => s.dateStr.startsWith(prev));
          return hasInPrev ? prev : latestMonth;
        });
      }
    } catch (err) {
      console.error('Error fetching sheets for consolidado:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetch(`/api/catalogo?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.data && Array.isArray(data.data)) {
        setCatalogItems(data.data);
      }
    } catch (err) {
      console.error('Error fetching catalog:', err);
    }
  };

  useEffect(() => {
    fetchSheets();
    fetchCatalog();
  }, []);

  // Meses disponibles calculados dinámicamente con las hojas reales
  const { periodos } = usePeriodo();
  const months: MonthItem[] = useMemo(() => {
    const extra = (periodos || []).map(p => p.codigo);
    return buildDynamicMonths(sheets, selectedMonth, extra);
  }, [sheets, selectedMonth, periodos]);

  // Hojas filtradas para la lista
  const filteredSheets = useMemo(() => {
    return sheets.filter(s => {
      const matchMonth = s.dateStr.startsWith(selectedMonth);
      const matchQuery = !searchQuery.trim() || 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.dateStr.includes(searchQuery);
      return matchMonth && matchQuery;
    });
  }, [sheets, selectedMonth, searchQuery]);

  // Hoja activa actualmente
  const activeSheet = useMemo(() => {
    if (!activeTabId) return null;
    return sheets.find(s => s.id === activeTabId) || null;
  }, [sheets, activeTabId]);

  // Abrir y cerrar pestañas
  const handleOpenSheet = (sheetId: string) => {
    if (!openTabs.includes(sheetId)) {
      setOpenTabs([...openTabs, sheetId]);
    }
    setActiveTabId(sheetId);
    setIsAddingGlobalItem(false);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const nextTabs = openTabs.filter(id => id !== tabId);
    setOpenTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1] : null);
    }
  };

  // Expandir / colapsar categorías
  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };
  const expandAllCategories = () => setCollapsedCategories({});
  const collapseAllCategories = () => {
    if (!activeSheet) return;
    const all: Record<string, boolean> = {};
    activeSheet.categories.forEach(c => { all[c.id] = true; });
    setCollapsedCategories(all);
  };

  // Helper de métricas consolidadas por insumo
  const getItemConsolidatedMetrics = (item: InsumoItem) => {
    const regs = item.registros || [];
    const cocinaRegs = regs.filter(r => r.tipo === 'COCINA_CIERRE' || r.tipo === 'CIERRE');
    const cocinaQty = cocinaRegs.reduce((sum, r) => sum + Number(r.cantidad || 0), 0);
    const cocinaTotal = cocinaRegs.reduce((sum, r) => sum + Number(r.total || 0), 0);

    const bodegaRegs = regs.filter(r => r.tipo === 'BODEGA_CIERRE');
    const bodegaQty = bodegaRegs.reduce((sum, r) => sum + Number(r.cantidad || 0), 0);
    const bodegaTotal = bodegaRegs.reduce((sum, r) => sum + Number(r.total || 0), 0);

    const unitPrice = Number(item.unitPrice || (cocinaQty > 0 ? cocinaTotal / cocinaQty : bodegaQty > 0 ? bodegaTotal / bodegaQty : 0));
    const totalConsolidado = cocinaTotal + bodegaTotal;

    return {
      cocinaQty,
      cocinaTotal,
      bodegaQty,
      bodegaTotal,
      unitPrice,
      totalConsolidado,
      totalQty: cocinaQty + bodegaQty,
      hasCocina: cocinaQty > 0,
      hasBodega: bodegaQty > 0,
      hasAny: cocinaQty > 0 || bodegaQty > 0
    };
  };

  // Totales de la hoja activa
  const sheetTotals = useMemo(() => {
    if (!activeSheet) {
      return {
        costoCocinaCierre: 0,
        costoBodegaCierre: 0,
        costoTotalConsolidado: 0,
        cocinaItemsCount: 0,
        bodegaItemsCount: 0,
        totalItemsCount: 0
      };
    }

    let cocinaTot = 0;
    let bodegaTot = 0;
    let cocinaCount = 0;
    let bodegaCount = 0;

    activeSheet.categories.forEach(cat => {
      cat.items.forEach(it => {
        const m = getItemConsolidatedMetrics(it);
        if (m.hasCocina) {
          cocinaTot += m.cocinaTotal;
          cocinaCount++;
        }
        if (m.hasBodega) {
          bodegaTot += m.bodegaTotal;
          bodegaCount++;
        }
      });
    });

    return {
      costoCocinaCierre: Math.round(cocinaTot),
      costoBodegaCierre: Math.round(bodegaTot),
      costoTotalConsolidado: Math.round(cocinaTot + bodegaTot),
      cocinaItemsCount: cocinaCount,
      bodegaItemsCount: bodegaCount,
      totalItemsCount: cocinaCount + bodegaCount
    };
  }, [activeSheet]);

  const formatSheetTitle = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    const monthsNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthName = monthsNames[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)} de ${monthName} de ${y}`;
  };

  // Autocompletado del catálogo
  const filteredCatalog = useMemo(() => {
    if (!newInsumoName.trim()) return [];
    const q = normalizeStrHelper(newInsumoName);
    return catalogItems
      .filter(item => {
        const matchName = normalizeStrHelper(item.nombre || item.insumo || '').includes(q);
        if (searchCategoryFilter === 'TODOS') return matchName;
        return matchName && normalizeStrHelper(item.categoria || '').includes(normalizeStrHelper(searchCategoryFilter));
      })
      .slice(0, 16);
  }, [newInsumoName, catalogItems, searchCategoryFilter]);

  // Selección de ítem desde el catálogo
  const handleSelectCatalogItem = (item: any) => {
    const itemName = item.nombre || item.insumo;
    setNewInsumoName(itemName);
    setSelectedCatalogItem(item);
    setIsSearchOpen(false);

    if (item.costo_unitario_kg) {
      setNewInsumoPrice(Number(item.costo_unitario_kg));
    }
    const units = getAllowedUnitsForInsumo(item);
    setAvailableUnits(units.length > 0 ? units : DEFAULT_UNITS);
    if (units.length > 0) {
      setNewInsumoUnit(units[0].value);
    }
  };

  // Handlers para el Slide-over de Añadir Conteos
  const handleParseConteos = (text: string) => {
    const parsed = parseBulkConteosText(text, catalogItems);
    setParsedConteosList(parsed);
  };

  const handleApplyBulkConteos = async () => {
    if (!activeSheet || parsedConteosList.length === 0) return;

    // El destino es estrictamente la hoja donde está parado (viewMode)
    const targetOperationalView = viewMode === 'COCINA_CIERRE' ? 'COCINA_CIERRE' : 'BODEGA_CIERRE';

    const itemsPayload = parsedConteosList.map(p => ({
      insumo_id: p.catalogItemId || null,
      nombre_insumo: p.itemName,
      categoria: p.category,
      cantidad: p.weightKg,
      unidad: p.baseUnit,
      costo_unitario: p.unitPrice,
      total: p.estimatedTotal,
      observaciones: `${p.rawQty} ${p.inputUnit}`
    }));

    try {
      const res = await fetch('/api/costeo-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: activeSheet.dateStr,
          targetView: targetOperationalView,
          actionMode: conteosActionMode,
          items: itemsPayload
        })
      });

      if (!res.ok) throw new Error('Error al guardar conteos');

      setIsConteosDrawerOpen(false);
      setConteosRawText('');
      setParsedConteosList([]);
      setToastMessage(`✓ ${itemsPayload.length} conteos guardados en ${targetOperationalView === 'COCINA_CIERRE' ? 'Cocina Cierre' : 'Bodega Cierre'}`);
      setTimeout(() => setToastMessage(''), 4000);
      await fetchSheets();
    } catch (err) {
      console.error(err);
      alert('Error al persistir los conteos masivos en base de datos.');
    }
  };

  // Enrutamiento automático a la categoría correspondiente
  const determineTargetCategory = (insumoName: string, catalogItem?: any): { id: string; name: string } => {
    if (!activeSheet) return { id: 'verduras', name: 'Verduras e Insumos' };

    const catNameCatalog = (catalogItem?.categoria || '').toUpperCase();
    const inferred = inferCategoryFromName(insumoName);
    const targetCatUpper = catNameCatalog || inferred.category.toUpperCase();

    if (targetCatUpper.includes('CARNE') || targetCatUpper.includes('RES') || targetCatUpper.includes('CERDO') || targetCatUpper.includes('POLLO') || targetCatUpper.includes('PESCADO')) {
      const found = activeSheet.categories.find(c => c.id === 'carnes' || c.name.toLowerCase().includes('carne'));
      if (found) return { id: found.id, name: found.name };
    }
    if (targetCatUpper.includes('GRANO') || targetCatUpper.includes('ABARROTE')) {
      const found = activeSheet.categories.find(c => c.id === 'granos' || c.name.toLowerCase().includes('grano'));
      if (found) return { id: found.id, name: found.name };
    }
    if (targetCatUpper.includes('DESECHABLE') || targetCatUpper.includes('EMPAQUE')) {
      const found = activeSheet.categories.find(c => c.id === 'desechables' || c.name.toLowerCase().includes('desechable'));
      if (found) return { id: found.id, name: found.name };
    }
    if (targetCatUpper.includes('HUEVO') || targetCatUpper.includes('LACTEO')) {
      const found = activeSheet.categories.find(c => c.id === 'huevos' || c.name.toLowerCase().includes('huevo') || c.name.toLowerCase().includes('lacteo'));
      if (found) return { id: found.id, name: found.name };
    }
    if (targetCatUpper.includes('BEBIDA')) {
      const found = activeSheet.categories.find(c => c.id === 'bebidas' || c.name.toLowerCase().includes('bebida'));
      if (found) return { id: found.id, name: found.name };
    }
    const foundVerd = activeSheet.categories.find(c => c.id === 'verduras' || c.name.toLowerCase().includes('verdura'));
    if (foundVerd) return { id: foundVerd.id, name: foundVerd.name };

    return { id: activeSheet.categories[0]?.id || 'verduras', name: activeSheet.categories[0]?.name || 'Verduras e Insumos' };
  };

  // Handler para Añadir Insumo desde el ÚNICO input inteligente superior
  const handleAddGlobalManualItem = async () => {
    if (!newInsumoName.trim() || !activeSheet) return;

    // El destino es automáticamente la hoja activa donde está parado el usuario
    const targetOperationalView = viewMode === 'COCINA_CIERRE' ? 'COCINA_CIERRE' : 'BODEGA_CIERRE';

    const parsedQty = evaluateQtyFormula(newInsumoQtyFormula).value || parseFloat(newInsumoQtyFormula) || 1;
    const price = Number(newInsumoPrice) || 0;

    const unitOpt = availableUnits.find(u => u.value === newInsumoUnit) || {
      value: newInsumoUnit || 'Kg',
      label: newInsumoUnit || 'Kg',
      baseUnit: newInsumoUnit || 'Kg',
      toBaseFactor: () => 1
    };

    const finalQty = Number((parsedQty * unitOpt.toBaseFactor(selectedCatalogItem)).toFixed(2));
    const finalUnit = unitOpt.baseUnit;
    const finalTotal = Math.round(finalQty * price);

    const targetCat = determineTargetCategory(newInsumoName.trim(), selectedCatalogItem);

    setSavingManualItem(true);
    try {
      const res = await fetch('/api/costeo-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: activeSheet.dateStr,
          titulo: activeSheet.title,
          pos_sales: activeSheet.posSales,
          targetView: targetOperationalView,
          movimiento: {
            tipo: targetOperationalView,
            insumo_id: selectedCatalogItem?.id || null,
            nombre_insumo: newInsumoName.trim(),
            categoria: targetCat.name,
            cantidad: finalQty,
            unidad: finalUnit,
            costo_unitario: price,
            total: finalTotal,
            observaciones: `Conteo ingresado en ${targetOperationalView === 'BODEGA_CIERRE' ? 'Bodega Cierre' : 'Cocina Cierre'}`
          }
        })
      });

      if (!res.ok) throw new Error('Error guardando insumo');

      setCollapsedCategories(prev => ({ ...prev, [targetCat.id]: false }));
      setToastMessage(`✓ "${newInsumoName.trim()}" agregado a ${targetCat.name} (${targetOperationalView === 'BODEGA_CIERRE' ? 'Bodega' : 'Cocina'})`);
      setTimeout(() => setToastMessage(''), 4500);

      setNewInsumoName('');
      setNewInsumoQtyFormula('');
      setNewInsumoPrice('');
      setSelectedCatalogItem(null);
      await fetchSheets();

      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } catch (err) {
      console.error(err);
      alert('Error al guardar el insumo en base de datos.');
    } finally {
      setSavingManualItem(false);
    }
  };

  const handleCancelInput = () => {
    setNewInsumoName('');
    setNewInsumoQtyFormula('');
    setNewInsumoPrice('');
    setSelectedCatalogItem(null);
    setIsSearchOpen(false);
    setIsAddingGlobalItem(false);
  };

  // Lateral Insumo Manager Drawer State (Similar a Costeo Diario)
  const [activeDrawerInsumo, setActiveDrawerInsumo] = useState<{
    categoryId: string;
    categoryName: string;
    item: InsumoItem;
  } | null>(null);

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const [drawerTargetView, setDrawerTargetView] = useState<'COCINA_CIERRE' | 'BODEGA_CIERRE'>('COCINA_CIERRE');
  const [drawerPresentacion, setDrawerPresentacion] = useState<'Entero' | 'Porcion'>('Entero');
  const [drawerQtyFormula, setDrawerQtyFormula] = useState('');
  const [drawerCustomWeight, setDrawerCustomWeight] = useState('');
  const [drawerUnitPrice, setDrawerUnitPrice] = useState<string>('');
  const [drawerObs, setDrawerObs] = useState('');
  const [drawerSuccessMsg, setDrawerSuccessMsg] = useState('');
  const [editingRegId, setEditingRegId] = useState<string | null>(null);
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);

  // Abrir panel lateral de insumo
  const handleOpenInsumoManager = (categoryId: string, categoryName: string, item: InsumoItem) => {
    let itemWithRegistros = { ...item };
    if (!itemWithRegistros.registros) {
      itemWithRegistros.registros = [];
    }

    const initialTarget: 'COCINA_CIERRE' | 'BODEGA_CIERRE' = 
      viewMode === 'BODEGA_CIERRE' ? 'BODEGA_CIERRE' : 'COCINA_CIERRE';
    setDrawerTargetView(initialTarget);

    const defaultPres = (item.name.toLowerCase().includes('porci') || categoryId === 'carnes') ? 'Porcion' : 'Entero';
    setDrawerPresentacion(defaultPres);
    setDrawerQtyFormula('');
    setDrawerCustomWeight('');
    setDrawerUnitPrice(item.unitPrice ? item.unitPrice.toString() : '');
    setDrawerObs('');
    setDrawerSuccessMsg('');
    setEditingRegId(null);

    setActiveDrawerInsumo({
      categoryId,
      categoryName,
      item: itemWithRegistros
    });

    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 100);
  };

  const handleStartEditRegistro = (reg: RegistroItem) => {
    setEditingRegId(reg.id);
    if (reg.tipo === 'BODEGA_CIERRE') {
      setDrawerTargetView('BODEGA_CIERRE');
    } else {
      setDrawerTargetView('COCINA_CIERRE');
    }

    const isPorcion = (activeDrawerInsumo?.item.name.toLowerCase().includes('porci') || activeDrawerInsumo?.categoryId === 'carnes');
    setDrawerPresentacion(isPorcion ? 'Porcion' : 'Entero');

    if (isPorcion) {
      const stdW = getPortionWeightKg(activeDrawerInsumo?.item.name || '');
      const portions = stdW > 0 ? (reg.cantidad / stdW).toFixed(0) : reg.cantidad.toString();
      setDrawerQtyFormula(portions);
      setDrawerCustomWeight(reg.cantidad.toString());
    } else {
      setDrawerQtyFormula(reg.cantidad.toString());
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

  const handleCancelEdit = () => {
    setEditingRegId(null);
    setDrawerQtyFormula('');
    setDrawerCustomWeight('');
    setDrawerObs('');
    if (activeDrawerInsumo) {
      setDrawerUnitPrice(activeDrawerInsumo.item.unitPrice ? activeDrawerInsumo.item.unitPrice.toString() : '');
    }
    setTimeout(() => {
      qtyInputRef.current?.focus();
    }, 50);
  };

  const handleAddInsumoRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrawerInsumo || !activeSheet) return;

    const evalResult = evaluateQtyFormula(drawerQtyFormula);
    if (!evalResult.isValid || evalResult.value <= 0) {
      qtyInputRef.current?.focus();
      return;
    }

    let finalQty = 0;
    const unitPrice = parseFloat(drawerUnitPrice) || activeDrawerInsumo.item.unitPrice || 0;

    if (drawerPresentacion === 'Porcion') {
      const portionsCount = evalResult.value;
      const stdW = getPortionWeightKg(activeDrawerInsumo.item.name);
      const parsedCustomWeight = parseFloat(drawerCustomWeight);
      finalQty = (!isNaN(parsedCustomWeight) && parsedCustomWeight > 0)
        ? parsedCustomWeight
        : Number((portionsCount * stdW).toFixed(2));
    } else {
      finalQty = evalResult.value;
    }

    const regTotal = Math.round(finalQty * unitPrice);
    const targetViewToSave = drawerTargetView;

    setIsSavingDrawer(true);
    try {
      const res = await fetch('/api/costeo-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: activeSheet.dateStr,
          titulo: activeSheet.title,
          pos_sales: activeSheet.posSales,
          targetView: targetViewToSave,
          movimiento: {
            id: editingRegId ? editingRegId.replace(/^(reg-|item-)/, '') : undefined,
            tipo: targetViewToSave,
            insumo_id: activeDrawerInsumo.item.id?.replace(/^(item-|reg-)/, '') || null,
            nombre_insumo: activeDrawerInsumo.item.name,
            categoria: activeDrawerInsumo.categoryName,
            cantidad: finalQty,
            unidad: activeDrawerInsumo.item.unit,
            costo_unitario: unitPrice,
            total: regTotal,
            observaciones: drawerObs.trim() || undefined
          }
        })
      });

      if (!res.ok) throw new Error('Error al registrar movimiento');

      setDrawerSuccessMsg(editingRegId ? '✓ Registro actualizado con éxito' : '✓ Cantidad agregada correctamente');
      setEditingRegId(null);
      setDrawerQtyFormula('');
      setDrawerCustomWeight('');
      setDrawerObs('');

      // Recargar hojas
      const r = await fetch(`/api/costeo-diario?t=${Date.now()}`, { cache: 'no-store' });
      const d = await r.json();
      if (d?.sheets && Array.isArray(d.sheets)) {
        setSheets(d.sheets);
        const updatedS = d.sheets.find((s: CosteoSheet) => s.id === activeSheet.id);
        if (updatedS) {
          const cat = updatedS.categories.find((c: CategoryGroup) => c.id === activeDrawerInsumo.categoryId);
          const it = cat?.items.find((i: InsumoItem) => i.id === activeDrawerInsumo.item.id || i.name.toLowerCase() === activeDrawerInsumo.item.name.toLowerCase());
          if (it) {
            setActiveDrawerInsumo(prev => prev ? { ...prev, item: it } : null);
          }
        }
      }

      setTimeout(() => setDrawerSuccessMsg(''), 3000);
      setTimeout(() => {
        qtyInputRef.current?.focus();
      }, 50);
    } catch (err) {
      console.error('Error guardando en drawer:', err);
      alert('Error al guardar el movimiento en base de datos.');
    } finally {
      setIsSavingDrawer(false);
    }
  };

  const handleDeleteInsumoRegistro = async (regId: string) => {
    if (!activeDrawerInsumo || !activeSheet) return;
    if (!confirm('¿Deseas eliminar este registro de conteo?')) return;

    setIsSavingDrawer(true);
    try {
      const res = await fetch('/api/costeo-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_ITEM',
          fecha: activeSheet.dateStr,
          registroIds: [regId]
        })
      });

      if (!res.ok) throw new Error('Error al eliminar registro');

      const r = await fetch(`/api/costeo-diario?t=${Date.now()}`, { cache: 'no-store' });
      const d = await r.json();
      if (d?.sheets && Array.isArray(d.sheets)) {
        setSheets(d.sheets);
        const updatedS = d.sheets.find((s: CosteoSheet) => s.id === activeSheet.id);
        if (updatedS) {
          const cat = updatedS.categories.find((c: CategoryGroup) => c.id === activeDrawerInsumo.categoryId);
          const it = cat?.items.find((i: InsumoItem) => i.id === activeDrawerInsumo.item.id || i.name.toLowerCase() === activeDrawerInsumo.item.name.toLowerCase());
          if (it) {
            setActiveDrawerInsumo(prev => prev ? { ...prev, item: it } : null);
          }
        }
      }
    } catch (err) {
      console.error('Error eliminando registro:', err);
      alert('Error al eliminar registro.');
    } finally {
      setIsSavingDrawer(false);
    }
  };

  const handleExportPdf = (targetSheet?: CosteoSheet | null) => {
    const sheetToExport = targetSheet || activeSheet;
    if (!sheetToExport) return;
    try {
      downloadInventarioConsolidadoPdf({
        sheet: sheetToExport,
        companyName: 'RESTAURANTE CHOCLOS Y ASADOS LA FINCA',
        reportTitle: 'INFORME DE INVENTARIO Y CIERRES (BODEGA Y COCINA)'
      });
      setToastMessage('Informe PDF descargado exitosamente');
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      console.error('Error generando PDF de inventario consolidado:', err);
      alert('Error al generar el informe en PDF.');
    }
  };

  // Solo se permite añadir en COCINA_CIERRE o BODEGA_CIERRE (NUNCA en Ver Consolidado ni en Ver Paralelo)
  const isAddingAllowedInCurrentView = viewMode === 'COCINA_CIERRE' || viewMode === 'BODEGA_CIERRE';

  return (
    <div className="flex flex-col h-[calc(100dvh-53px)] md:h-[calc(100vh-57px)] -m-2.5 sm:-m-4 md:-m-6 -mb-20 md:mb-0 bg-white overflow-hidden font-sans select-none">
      
      {/* ============================================================ */}
      {/* 1. BARRA SUPERIOR DE PESTAÑAS (TABS)                          */}
      {/* ============================================================ */}
      <div className="shrink-0 bg-white border-b border-slate-200 z-20 shadow-2xs">
        <div className="bg-slate-100/90 border-b border-slate-200 px-3 pt-2 flex items-center justify-between overflow-x-auto select-none">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTabId(null)}
              className={`flex items-center gap-2 px-3 py-2 text-xs rounded-t-md transition-colors border-t-2 cursor-pointer ${
                activeTabId === null
                  ? 'bg-white text-slate-900 border-orange-600 font-semibold shadow-2xs border-x border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60 font-medium'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Costeo e Inventario Consolidado</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                {sheets.length}
              </span>
            </button>

            {openTabs.map(tabId => {
              const sh = sheets.find(s => s.id === tabId);
              if (!sh) return null;
              const isActive = activeTabId === tabId;

              return (
                <div
                  key={tabId}
                  onClick={() => setActiveTabId(tabId)}
                  className={`group flex items-center gap-2 px-3 py-2 text-xs rounded-t-md cursor-pointer transition-all border-t-2 max-w-[260px] ${
                    isActive
                      ? 'bg-white text-slate-900 border-orange-600 font-semibold shadow-2xs border-x border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60 font-medium'
                  }`}
                >
                  <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-600' : 'text-slate-400'}`} />
                  <span className="truncate">{formatSheetTitle(sh.dateStr)}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(e, tabId)}
                    className="opacity-60 hover:opacity-100 hover:bg-slate-200 p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Cerrar pestaña"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. SUBHEADER: Acciones (Añadir Conteos solo si está permitido)*/}
        {/* ============================================================ */}
        {activeSheet && (
          <div className="bg-white p-3 px-4 md:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTabId(null)}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a Hojas Consolidadas</span>
                </button>
              </div>
              <h1 className="text-base md:text-lg font-bold text-slate-900 mt-1">
                {formatSheetTitle(activeSheet.dateStr)} - Hoja Costeo Consolidado
              </h1>
              <p className="text-xs text-slate-500">
                Fecha: <span className="font-semibold text-slate-700">{activeSheet.dateStr}</span> · Cierre Cocina ({sheetTotals.cocinaItemsCount} insumos) + Cierre Bodega ({sheetTotals.bodegaItemsCount} insumos)
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
              {toastMessage && (
                <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-md animate-fade-in flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{toastMessage}</span>
                </div>
              )}

              {/* Boton Exportar Informe PDF */}
              <button
                type="button"
                onClick={() => handleExportPdf(activeSheet)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-300 rounded-md transition-all shadow-2xs cursor-pointer"
                title="Exportar informe consolidado en PDF de 3 columnas (Bodega Cierre y Cocina Cierre)"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exportar Informe PDF</span>
              </button>

              {/* Botón Añadir Conteos: SOLO si está en Cocina Cierre o Bodega Cierre (NUNCA en Consolidado/Paralelo) */}
              {isAddingAllowedInCurrentView && (
                <button
                  type="button"
                  onClick={() => setIsConteosDrawerOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-300 rounded-md transition-all shadow-2xs cursor-pointer"
                  title={`Añadir conteos de texto rápido a ${viewMode === 'COCINA_CIERRE' ? 'Cocina Cierre' : 'Bodega Cierre'}`}
                >
                  <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                  <span>Añadir Conteos</span>
                </button>
              )}

              {viewMode === 'PARALELO' ? (
                <button
                  type="button"
                  onClick={() => setViewMode('CONSOLIDADO')}
                  className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs px-3.5 py-1.5 rounded-md font-medium shadow-2xs transition-colors cursor-pointer"
                >
                  <ListFilter className="w-4 h-4 text-orange-400" />
                  <span>Ver Consolidado</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setViewMode('PARALELO')}
                  className="flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs px-3.5 py-1.5 rounded-md font-medium shadow-2xs transition-colors cursor-pointer"
                >
                  <Columns className="w-4 h-4" />
                  <span>Ver Paralelo</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. CONTENIDO PRINCIPAL SCROLLEABLE                            */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
            <span className="text-xs font-medium">Cargando inventarios consolidados...</span>
          </div>
        ) : activeTabId === null || !activeSheet ? (

          /* ------------------------------------------------------------ */
          /* VISTA 1: LISTADO DE HOJAS CONSOLIDADAS                       */
          /* ------------------------------------------------------------ */
          <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-white">
            <MonthSidebar
              months={months}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              title="Meses"
            />

            <div className="flex-1 p-4 md:p-8 max-w-5xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Hojas de Costeo</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Listado de hojas de costeo consolidado ordenadas desde la más reciente.
                  </p>
                </div>
              </div>

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

              <div className="space-y-2">
                {filteredSheets.map(sh => {
                  let cCierreTot = 0;
                  let bCierreTot = 0;
                  let cCount = 0;
                  let bCount = 0;

                  sh.categories.forEach(cat => {
                    cat.items.forEach(it => {
                      const m = getItemConsolidatedMetrics(it);
                      if (m.hasCocina) {
                        cCierreTot += m.cocinaTotal;
                        cCount++;
                      }
                      if (m.hasBodega) {
                        bCierreTot += m.bodegaTotal;
                        bCount++;
                      }
                    });
                  });

                  const totalCOP = Math.round(cCierreTot + bCierreTot);
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
                              {formatSheetTitle(sh.dateStr)} - Hoja Costeo Consolidado
                            </h3>
                            {isOpen && (
                              <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                Abierta en pestaña
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{cCount + bCount} insumos registrados</span>
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
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportPdf(sh);
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
                          title="Descargar informe PDF de esta fecha"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSheet(sh.id);
                          }}
                          className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
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
          /* VISTA 2: HOJA CONSOLIDADA ACTIVA                             */
          /* ------------------------------------------------------------ */
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            
            {/* MODO PARALELO: Dos columnas lado a lado (BODEGA izquierda, COCINA derecha) */}
            {viewMode === 'PARALELO' ? (
              <div className="p-4 md:p-6 space-y-4">
                <div className="flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={expandAllCategories}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                  >
                    Expandir todas
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={collapseAllCategories}
                    className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold hover:underline cursor-pointer"
                  >
                    Colapsar todas
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  
                  {/* COLUMNA IZQUIERDA: BODEGA */}
                  <div className="space-y-4">
                    <div className="bg-slate-900 text-white p-3.5 px-4 rounded-xl flex items-center justify-between shadow-sm">
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider">
                          Bodega Cierre
                        </h2>
                        <span className="text-xs text-slate-300">
                          {sheetTotals.bodegaItemsCount} insumos con conteo físico
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Costo Total Bodega
                        </span>
                        <span className="text-base font-black font-mono text-emerald-400">
                          ${sheetTotals.costoBodegaCierre.toLocaleString('es-CO')} COP
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {activeSheet.categories.map((cat) => {
                        const isCollapsed = Boolean(collapsedCategories[cat.id]);
                        const bodegaItems = cat.items
                          .map(it => ({ item: it, metrics: getItemConsolidatedMetrics(it) }))
                          .filter(({ metrics }) => metrics.bodegaQty > 0);

                        const catBodegaTotal = bodegaItems.reduce((s, { metrics }) => s + metrics.bodegaTotal, 0);

                        return (
                          <div
                            key={`bodega-${cat.id}`}
                            className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden"
                          >
                            <div
                              onClick={() => toggleCategoryCollapse(cat.id)}
                              className="p-2.5 px-3.5 flex items-center justify-between border-b border-slate-200 bg-slate-50/90 hover:bg-slate-100/80 transition-colors cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] text-slate-500 transition-transform duration-200 inline-block ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                                  ▼
                                </span>
                                <h3 className="text-xs font-bold text-slate-900 uppercase">
                                  {cat.name}
                                </h3>
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-medium">
                                  {bodegaItems.length}
                                </span>
                              </div>
                              <span className="text-xs font-mono font-bold text-slate-800">
                                ${Math.round(catBodegaTotal).toLocaleString('es-CO')}
                              </span>
                            </div>

                            {!isCollapsed && (
                              <div className="divide-y divide-slate-100">
                                <div className="grid grid-cols-12 gap-2 p-2 px-3.5 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  <div className="col-span-6">Insumo</div>
                                  <div className="col-span-3 text-right">Cant. Bodega</div>
                                  <div className="col-span-3 text-right">Subtotal</div>
                                </div>
                                {bodegaItems.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-slate-400 italic">
                                    Sin insumos en Bodega Cierre
                                  </div>
                                ) : (
                                  bodegaItems.map(({ item, metrics }) => (
                                    <div
                                      key={`bodega-it-${item.id}`}
                                      onClick={() => handleOpenInsumoManager(cat.id, cat.name, item)}
                                      className="grid grid-cols-12 gap-2 p-2.5 px-3.5 items-center text-xs hover:bg-blue-50/50 cursor-pointer transition-colors group"
                                      title="Clic para ver historial o gestionar insumo en Bodega"
                                    >
                                      <div 
                                        className="col-span-6 font-semibold text-slate-900 hover:text-blue-600 cursor-pointer truncate hover:underline" 
                                        title="Clic para ver historial o gestionar insumo"
                                        onClick={() => handleOpenInsumoManager(cat.id, cat.name, item)}
                                      >
                                        {item.name}
                                      </div>
                                      <div className="col-span-3 text-right font-mono font-medium text-slate-800">
                                        {metrics.bodegaQty} {item.unit}
                                      </div>
                                      <div className="col-span-3 text-right font-mono font-bold text-slate-950">
                                        ${Math.round(metrics.bodegaTotal).toLocaleString('es-CO')}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: COCINA */}
                  <div className="space-y-4">
                    <div className="bg-slate-900 text-white p-3.5 px-4 rounded-xl flex items-center justify-between shadow-sm">
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider">
                          Cocina Cierre
                        </h2>
                        <span className="text-xs text-slate-300">
                          {sheetTotals.cocinaItemsCount} insumos con conteo físico
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Costo Total Cocina
                        </span>
                        <span className="text-base font-black font-mono text-orange-400">
                          ${sheetTotals.costoCocinaCierre.toLocaleString('es-CO')} COP
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {activeSheet.categories.map((cat) => {
                        const isCollapsed = Boolean(collapsedCategories[cat.id]);
                        const cocinaItems = cat.items
                          .map(it => ({ item: it, metrics: getItemConsolidatedMetrics(it) }))
                          .filter(({ metrics }) => metrics.cocinaQty > 0);

                        const catCocinaTotal = cocinaItems.reduce((s, { metrics }) => s + metrics.cocinaTotal, 0);

                        return (
                          <div
                            key={`cocina-${cat.id}`}
                            className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden"
                          >
                            <div
                              onClick={() => toggleCategoryCollapse(cat.id)}
                              className="p-2.5 px-3.5 flex items-center justify-between border-b border-slate-200 bg-slate-50/90 hover:bg-slate-100/80 transition-colors cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] text-slate-500 transition-transform duration-200 inline-block ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                                  ▼
                                </span>
                                <h3 className="text-xs font-bold text-slate-900 uppercase">
                                  {cat.name}
                                </h3>
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-medium">
                                  {cocinaItems.length}
                                </span>
                              </div>
                              <span className="text-xs font-mono font-bold text-slate-800">
                                ${Math.round(catCocinaTotal).toLocaleString('es-CO')}
                              </span>
                            </div>

                            {!isCollapsed && (
                              <div className="divide-y divide-slate-100">
                                <div className="grid grid-cols-12 gap-2 p-2 px-3.5 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  <div className="col-span-6">Insumo</div>
                                  <div className="col-span-3 text-right">Cant. Cocina</div>
                                  <div className="col-span-3 text-right">Subtotal</div>
                                </div>
                                {cocinaItems.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-slate-400 italic">
                                    Sin insumos en Cocina Cierre
                                  </div>
                                ) : (
                                  cocinaItems.map(({ item, metrics }) => (
                                    <div
                                      key={`cocina-it-${item.id}`}
                                      onClick={() => handleOpenInsumoManager(cat.id, cat.name, item)}
                                      className="grid grid-cols-12 gap-2 p-2.5 px-3.5 items-center text-xs hover:bg-amber-50/50 cursor-pointer transition-colors group"
                                      title="Clic para ver historial o gestionar insumo en Cocina"
                                    >
                                      <div 
                                        className="col-span-6 font-semibold text-slate-900 hover:text-amber-600 cursor-pointer truncate hover:underline" 
                                        title="Clic para ver historial o gestionar insumo"
                                        onClick={() => handleOpenInsumoManager(cat.id, cat.name, item)}
                                      >
                                        {item.name}
                                      </div>
                                      <div className="col-span-3 text-right font-mono font-medium text-slate-800">
                                        {metrics.cocinaQty} {item.unit}
                                      </div>
                                      <div className="col-span-3 text-right font-mono font-bold text-slate-950">
                                        ${Math.round(metrics.cocinaTotal).toLocaleString('es-CO')}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            ) : (

              /* MODO REGULAR: Tabla de Insumos a la izquierda y "Consolidado del Día" a la derecha */
              <div className="flex-1 p-3 md:p-6 flex flex-col lg:flex-row gap-6 items-start">
                
                <div className="flex-1 w-full space-y-4">
                  
                  {/* BARRA SUPERIOR: Solo visible si se permite añadir (Cocina Cierre o Bodega Cierre) */}
                  {/* NUNCA visible en Ver Consolidado */}
                  {isAddingAllowedInCurrentView && (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                      {!isAddingGlobalItem ? (
                        /* Botón limpio y minimalista estilo GitHub (según foto media_1793487007762_f1603183.png) */
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingGlobalItem(true);
                            const defUnits = getAllowedUnitsForInsumo();
                            setAvailableUnits(defUnits);
                            setNewInsumoUnit(defUnits[0]?.value || 'Kg');
                          }}
                          className="w-full p-2.5 px-4 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-2 transition-colors text-left cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-slate-400" />
                          <span>
                            {viewMode === 'COCINA_CIERRE'
                              ? '+ Añadir insumo a Cocina Cierre...'
                              : '+ Añadir insumo a Bodega Cierre...'}
                          </span>
                        </button>
                      ) : (
                        /* Formulario inteligente expandido */
                        <div className="p-3 bg-slate-50/60">
                          {renderGlobalIntelligentInputBar()}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-slate-500">
                      {viewMode === 'CONSOLIDADO' && 'Insumos unificados de cierre (Cocina + Bodega)'}
                      {viewMode === 'COCINA_CIERRE' && 'Insumos físicos en Cocina Cierre'}
                      {viewMode === 'BODEGA_CIERRE' && 'Insumos físicos en Bodega Cierre'}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={expandAllCategories}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                      >
                        Expandir todas
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={collapseAllCategories}
                        className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold hover:underline cursor-pointer"
                      >
                        Colapsar todas
                      </button>
                    </div>
                  </div>

                  {activeSheet.categories.map((cat) => {
                    const isCollapsed = Boolean(collapsedCategories[cat.id]);
                    const filteredItems = cat.items
                      .map(it => ({ item: it, metrics: getItemConsolidatedMetrics(it) }))
                      .filter(({ metrics }) => {
                        if (viewMode === 'COCINA_CIERRE') return metrics.cocinaQty > 0;
                        if (viewMode === 'BODEGA_CIERRE') return metrics.bodegaQty > 0;
                        return metrics.totalQty > 0;
                      });

                    const catSubtotal = filteredItems.reduce((acc, { metrics }) => {
                      if (viewMode === 'COCINA_CIERRE') return acc + metrics.cocinaTotal;
                      if (viewMode === 'BODEGA_CIERRE') return acc + metrics.bodegaTotal;
                      return acc + metrics.totalConsolidado;
                    }, 0);

                    return (
                      <div
                        key={cat.id}
                        className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden transition-all"
                      >
                        <div
                          onClick={() => toggleCategoryCollapse(cat.id)}
                          className="p-3 px-4 flex items-center justify-between border-b border-slate-200 bg-slate-50/90 hover:bg-slate-100/80 transition-colors cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`text-[11px] text-slate-500 transition-transform duration-200 inline-block ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                              ▼
                            </span>
                            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                              {cat.name}
                            </h2>
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                              {filteredItems.length} insumos
                            </span>
                          </div>

                          <div className="text-xs font-bold font-mono text-slate-900">
                            Subtotal: ${Math.round(catSubtotal).toLocaleString('es-CO')}
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div>
                            {filteredItems.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-400 italic">
                                Sin registros activos para esta categoría en la vista seleccionada.
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-100">
                                <div className="hidden sm:grid grid-cols-12 gap-2 p-2 px-4 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  <div className="col-span-5">Insumo / Producto</div>
                                  <div className="col-span-3 text-right">
                                    {viewMode === 'CONSOLIDADO' ? 'Cantidad Consolidada' : 'Cantidad Cierre'}
                                  </div>
                                  <div className="col-span-2 text-right">Costo Unitario</div>
                                  <div className="col-span-2 text-right">Subtotal</div>
                                </div>

                                {filteredItems.map(({ item, metrics }) => {
                                  const displayQty = viewMode === 'COCINA_CIERRE'
                                    ? metrics.cocinaQty
                                    : viewMode === 'BODEGA_CIERRE'
                                    ? metrics.bodegaQty
                                    : metrics.totalQty;

                                  const displayTotal = viewMode === 'COCINA_CIERRE'
                                    ? metrics.cocinaTotal
                                    : viewMode === 'BODEGA_CIERRE'
                                    ? metrics.bodegaTotal
                                    : metrics.totalConsolidado;

                                  return (
                                    <div
                                      key={item.id}
                                      onClick={() => handleOpenInsumoManager(cat.id, cat.name, item)}
                                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 px-4 items-center text-xs hover:bg-blue-50/50 cursor-pointer transition-colors group"
                                      title="Clic para ver historial, editar o añadir cantidades a este insumo"
                                    >
                                      <div 
                                        className="col-span-5 font-semibold text-slate-900 hover:text-blue-600 flex items-center gap-2 transition-colors cursor-pointer group select-none"
                                        onClick={() => handleOpenInsumoManager(cat.id, cat.name, item)}
                                        title="Clic para ver historial o añadir cantidades a este insumo"
                                      >
                                        <span className="truncate group-hover:underline">{item.name}</span>
                                        {viewMode === 'CONSOLIDADO' && metrics.hasCocina && metrics.hasBodega && (
                                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded font-normal shrink-0">
                                            Cocina + Bodega
                                          </span>
                                        )}
                                      </div>

                                      <div className="col-span-3 sm:text-right font-mono font-medium text-slate-800">
                                        <span>{displayQty} {item.unit}</span>
                                        {viewMode === 'CONSOLIDADO' && metrics.hasCocina && metrics.hasBodega && (
                                          <span className="block text-[10px] text-slate-400 font-sans">
                                            (Coc: {metrics.cocinaQty} / Bod: {metrics.bodegaQty})
                                          </span>
                                        )}
                                      </div>

                                      <div className="col-span-2 sm:text-right font-mono text-slate-500">
                                        ${Math.round(metrics.unitPrice).toLocaleString('es-CO')}/{item.unit}
                                      </div>

                                      <div className="col-span-2 sm:text-right font-mono font-bold text-slate-950">
                                        ${Math.round(displayTotal).toLocaleString('es-CO')}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* PANEL LATERAL DERECHO: "Consolidado del Día" */}
                <aside className="w-full lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-orange-600" />
                        <span>Consolidado del Día</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Resumen de existencias de cierre combinadas.
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 border border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800 text-xs block">Costo Cocina Cierre</span>
                        <span className="text-[10px] text-slate-400 block">{sheetTotals.cocinaItemsCount} insumos</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        ${sheetTotals.costoCocinaCierre.toLocaleString('es-CO')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 border border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800 text-xs block">Costo Bodega Cierre</span>
                        <span className="text-[10px] text-slate-400 block">{sheetTotals.bodegaItemsCount} insumos</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        ${sheetTotals.costoBodegaCierre.toLocaleString('es-CO')}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-orange-600 text-white shadow-sm">
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-95">
                        Costo Total Consolidado
                      </span>
                      <span className="font-mono font-black text-lg block mt-1">
                        ${sheetTotals.costoTotalConsolidado.toLocaleString('es-CO')} COP
                      </span>
                      <span className="text-[10px] opacity-85 block mt-0.5">
                        Cocina Cierre + Bodega Cierre ({sheetTotals.totalItemsCount} registros)
                      </span>
                    </div>

                    <div className="border-t border-slate-200 pt-2" />

                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('CONSOLIDADO');
                          setIsAddingGlobalItem(false);
                        }}
                        className={`w-full text-left text-xs py-1 transition-colors flex items-center justify-between cursor-pointer ${
                          viewMode === 'CONSOLIDADO'
                            ? 'text-slate-950 font-bold underline'
                            : 'text-slate-600 hover:text-slate-900 hover:underline'
                        }`}
                      >
                        <span>Ver Consolidado</span>
                        {viewMode === 'CONSOLIDADO' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode('COCINA_CIERRE')}
                        className={`w-full text-left text-xs py-1 transition-colors flex items-center justify-between cursor-pointer ${
                          viewMode === 'COCINA_CIERRE'
                            ? 'text-slate-950 font-bold underline'
                            : 'text-slate-600 hover:text-slate-900 hover:underline'
                        }`}
                      >
                        <span>Cocina Cierre</span>
                        {viewMode === 'COCINA_CIERRE' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode('BODEGA_CIERRE')}
                        className={`w-full text-left text-xs py-1 transition-colors flex items-center justify-between cursor-pointer ${
                          viewMode === 'BODEGA_CIERRE'
                            ? 'text-slate-950 font-bold underline'
                            : 'text-slate-600 hover:text-slate-900 hover:underline'
                        }`}
                      >
                        <span>Bodega Cierre</span>
                        {viewMode === 'BODEGA_CIERRE' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                        )}
                      </button>
                    </div>

                  </div>
                </aside>

              </div>
            )}

          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. SLIDE-OVER DRAWER: AÑADIR CONTEOS (DERECHA A IZQUIERDA)    */}
      {/* ============================================================ */}
      {isConteosDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-[9998] transition-opacity animate-in fade-in duration-200 cursor-pointer"
          onClick={() => setIsConteosDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-[70] w-full sm:w-[700px] md:w-[800px] bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-out ${
          isConteosDrawerOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        <div className="p-4 border-b border-slate-200 bg-slate-50/90 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-700" />
              <span>Añadir Conteos a {viewMode === 'COCINA_CIERRE' ? 'Cocina Cierre' : 'Bodega Cierre'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pega el texto del conteo físico para interpretarlo e ingresarlo directamente.
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4 select-none">
          {/* DESTINO AUTOMÁTICO SEGÚN LA HOJA ACTIVA: SIN DROPDOWN INNECESARIO */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-2.5">
            <div>
              <span className="block text-[11px] font-bold text-slate-500 uppercase">
                Destino del Conteo:
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {viewMode === 'COCINA_CIERRE' ? 'Cierre Cocina' : 'Cierre Bodega'}
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                  (Asignado automáticamente según la hoja donde estás ubicado)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">Acción sobre existencias:</span>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="radio"
                    name="conteosActionModeConsolidado"
                    value="REEMPLAZAR"
                    checked={conteosActionMode === 'REEMPLAZAR'}
                    onChange={() => setConteosActionMode('REEMPLAZAR')}
                    className="text-slate-900"
                  />
                  <span>Reemplazar (=)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="radio"
                    name="conteosActionModeConsolidado"
                    value="SUMAR"
                    checked={conteosActionMode === 'SUMAR'}
                    onChange={() => setConteosActionMode('SUMAR')}
                    className="text-slate-900"
                  />
                  <span>Sumar (+)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Pegar Texto del Conteo:
            </label>
            <textarea
              rows={6}
              value={conteosRawText}
              onChange={(e) => {
                setConteosRawText(e.target.value);
                handleParseConteos(e.target.value);
              }}
              placeholder={`Ejemplo:\nPapa capira 48.9 kg\nPlátano verde 30.5 kg\nCarbón 2 bultos\nHuevos 180 unidades`}
              className="w-full p-2.5 text-xs font-mono bg-slate-50/70 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>

          {parsedConteosList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Insumos Detectados ({parsedConteosList.length}):
                </span>
                <span className="text-xs font-mono font-bold text-orange-600">
                  Total Estimado: ${parsedConteosList.reduce((s, p) => s + p.estimatedTotal, 0).toLocaleString('es-CO')}
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                {parsedConteosList.map((item) => (
                  <div key={item.id} className="p-2.5 px-3 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                        <span>{item.itemName}</span>
                        {item.isMatched ? (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.1 rounded font-medium">
                            Catálogo
                          </span>
                        ) : (
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.1 rounded font-medium">
                            Nuevo
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">{item.category}</span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-slate-800 block">
                        {item.rawQty} {item.inputUnit}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        ${item.estimatedTotal.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50/90 shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsConteosDrawerOpen(false)}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={parsedConteosList.length === 0}
            onClick={handleApplyBulkConteos}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-md transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Guardar {parsedConteosList.length} Conteos en {viewMode === 'COCINA_CIERRE' ? 'Cierre Cocina' : 'Cierre Bodega'}</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* DRAWER LATERAL: GESTIONAR INSUMO, HISTORIAL Y CONTEOS        */}
      {/* ============================================================ */}

      {/* Backdrop desenfocado */}
      {activeDrawerInsumo && (
        <div
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-[9998] transition-opacity animate-in fade-in duration-200 cursor-pointer"
          onClick={() => setActiveDrawerInsumo(null)}
        />
      )}

      {/* Contenedor Drawer deslizante de DERECHA A IZQUIERDA */}
      <aside
        className={`fixed inset-y-0 right-0 z-[90] w-full sm:w-[500px] md:w-[560px] bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-out ${
          activeDrawerInsumo ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        aria-label="Administrador de Insumo Consolidado"
      >
        {activeDrawerInsumo && (() => {
          const item = activeDrawerInsumo.item;
          const metrics = getItemConsolidatedMetrics(item);
          const evalRes = evaluateQtyFormula(drawerQtyFormula);
          const parsedQty = evalRes.value || 0;
          const stdWeight = getPortionWeightKg(item.name);
          const customW = parseFloat(drawerCustomWeight);
          const finalEstimatedKg = drawerPresentacion === 'Porcion'
            ? (!isNaN(customW) && customW > 0 ? customW : Number((parsedQty * stdWeight).toFixed(2)))
            : parsedQty;
          const uPrice = parseFloat(drawerUnitPrice) || item.unitPrice || 0;
          const estimatedCost = Math.round(finalEstimatedKg * uPrice);

          const displayQty = viewMode === 'COCINA_CIERRE'
            ? metrics.cocinaQty
            : viewMode === 'BODEGA_CIERRE'
            ? metrics.bodegaQty
            : metrics.totalQty;

          const displayTotal = viewMode === 'COCINA_CIERRE'
            ? metrics.cocinaTotal
            : viewMode === 'BODEGA_CIERRE'
            ? metrics.bodegaTotal
            : metrics.totalConsolidado;

          const rawVisible = (item.registros || []).filter(r => {
            const t = (r.tipo || '').toUpperCase();
            if (viewMode === 'COCINA_CIERRE') return t === 'COCINA_CIERRE' || t === 'CIERRE';
            if (viewMode === 'BODEGA_CIERRE') return t === 'BODEGA_CIERRE';
            return true;
          });

          const visibleRegs: RegistroItem[] = rawVisible.length > 0 ? rawVisible : (displayQty > 0 ? [{
            id: `reg-${item.id}-auto`,
            hora: '--:--',
            usuario: viewMode === 'BODEGA_CIERRE' ? 'Bodeguero' : 'Cocina / Consolidado',
            tipo: viewMode === 'BODEGA_CIERRE' ? 'BODEGA_CIERRE' : 'COCINA_CIERRE',
            origen: viewMode === 'BODEGA_CIERRE' ? 'Bodega General' : 'Cocina Principal',
            destino: viewMode === 'BODEGA_CIERRE' ? 'Bodega Cierre' : 'Cocina Cierre',
            cantidad: displayQty,
            unidad: item.unit,
            costoUnitario: uPrice,
            total: displayTotal,
            observaciones: 'Saldo registrado en hoja'
          }] : []);

          return (
            <div className="flex flex-col h-full bg-white select-none">
              
              {/* Header del Panel Lateral */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="text-xs text-slate-500 font-medium">
                    <span className="text-slate-600 font-semibold uppercase">{activeDrawerInsumo.categoryName}</span>
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
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  {item.name}
                </h3>

                {/* Resumen métrico superior */}
                <div className="mt-3.5 grid grid-cols-3 gap-2">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      {viewMode === 'COCINA_CIERRE' ? 'Cierre Cocina' : viewMode === 'BODEGA_CIERRE' ? 'Cierre Bodega' : 'Total Consolidado'}
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {displayQty} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      Costo Unitario
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      ${item.unitPrice ? item.unitPrice.toLocaleString('es-CO') : '0'}
                      <span className="text-[10px] font-normal text-slate-500"> /{item.unit}</span>
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      Total Valorizado
                    </div>
                    <div className="text-sm font-bold text-amber-700">
                      ${displayTotal.toLocaleString('es-CO')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contenido scrolleable: Formulario e Historial */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Formulario Ingresar Cantidad */}
                <form 
                  onSubmit={handleAddInsumoRegistro}
                  className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-blue-600" />
                      <span>{editingRegId ? 'Editar Conteo' : 'Ingresar / Sumar Cantidad'}</span>
                    </h4>
                    {editingRegId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="text-[11px] text-red-600 hover:text-red-700 font-medium underline cursor-pointer"
                      >
                        Cancelar Edición
                      </button>
                    )}
                  </div>

                  {drawerSuccessMsg && (
                    <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs font-medium flex items-center gap-1.5 animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{drawerSuccessMsg}</span>
                    </div>
                  )}

                  {/* Selector de Destino de Inventario (Cocina Cierre vs Bodega Cierre) */}
                  <div className="mb-3 bg-white p-1 rounded-lg border border-slate-200 grid grid-cols-2 gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setDrawerTargetView('COCINA_CIERRE')}
                      className={`py-1 px-2 rounded-md font-medium text-center transition-colors cursor-pointer ${
                        drawerTargetView === 'COCINA_CIERRE'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Cocina Cierre
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerTargetView('BODEGA_CIERRE')}
                      className={`py-1 px-2 rounded-md font-medium text-center transition-colors cursor-pointer ${
                        drawerTargetView === 'BODEGA_CIERRE'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Bodega Cierre
                    </button>
                  </div>

                  {/* Presentación & Costo Unitario */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Presentación</label>
                      <select
                        value={drawerPresentacion}
                        onChange={(e) => setDrawerPresentacion(e.target.value as any)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Entero">Entero ({item.unit})</option>
                        <option value="Porcion">Porción (Estándar)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Costo Unitario ($/{item.unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={drawerUnitPrice}
                        onChange={(e) => setDrawerUnitPrice(e.target.value)}
                        placeholder={item.unitPrice.toString()}
                        className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Cantidad / Fórmula */}
                  <div className="mb-3">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {drawerPresentacion === 'Porcion' ? 'Cantidad de Porciones (Fórmula o número)' : `Cantidad a Sumar (${item.unit})`}
                    </label>
                    <div className="relative">
                      <input
                        ref={qtyInputRef}
                        type="text"
                        value={drawerQtyFormula}
                        onChange={(e) => setDrawerQtyFormula(e.target.value)}
                        placeholder="Ej: 26 ó 10 + 16 ó 5.5"
                        className="w-full text-sm font-semibold bg-white border border-slate-300 rounded-md pl-3 pr-20 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                      />
                      <span className="absolute right-2.5 top-2.5 text-xs font-medium text-slate-400">
                        {drawerPresentacion === 'Porcion' ? 'Porciones' : item.unit}
                      </span>
                    </div>

                    {/* Preview de Fórmula si tiene operador */}
                    {evalRes.preview && (
                      <div className="text-[11px] text-blue-600 font-mono mt-1 font-semibold flex items-center gap-1">
                        <Calculator className="w-3 h-3" />
                        <span>{evalRes.preview}</span>
                      </div>
                    )}
                  </div>

                  {/* Si es Porción, mostrar conversión a Kg con posibilidad de sobreescritura manual */}
                  {drawerPresentacion === 'Porcion' && (
                    <div className="mb-3 bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-amber-900 font-medium">Peso Total Equivalente (Kg):</span>
                        <span className="text-[10px] text-amber-700 font-mono">
                          Std: {(stdWeight * 1000).toFixed(0)}g / porción
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={finalEstimatedKg.toString()}
                          value={drawerCustomWeight}
                          onChange={(e) => setDrawerCustomWeight(e.target.value)}
                          className="flex-1 text-xs bg-white border border-amber-300 rounded px-2.5 py-1 text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                        />
                        <span className="text-xs font-semibold text-amber-900">Kg</span>
                      </div>
                      <p className="text-[10px] text-amber-600 mt-1">
                        Calculado auto por porciones. Si pesaste directamente la balanza, escribe el peso exacto arriba.
                      </p>
                    </div>
                  )}

                  {/* Nota u Observación */}
                  <div className="mb-3">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Nota / Observación <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={drawerObs}
                      onChange={(e) => setDrawerObs(e.target.value)}
                      placeholder="Ej: Conteo físico tarde, lote nuevo, etc."
                      className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Resumen previo antes de guardar */}
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs mb-3 text-slate-600">
                    <span>Impacto Estimado:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      +{finalEstimatedKg} {item.unit} ≈ ${estimatedCost.toLocaleString('es-CO')} COP
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingDrawer || !evalRes.isValid || evalRes.value <= 0}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSavingDrawer ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{editingRegId ? 'Actualizar Registro' : 'Registrar en ' + (drawerTargetView === 'COCINA_CIERRE' ? 'Cocina' : 'Bodega')}</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Historial de Conteos y Movimientos */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Historial de Conteos ({visibleRegs.length})</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {viewMode === 'CONSOLIDADO' ? 'Mostrando Cocina + Bodega' : `Filtrado por ${viewMode}`}
                    </span>
                  </div>

                  {visibleRegs.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                      No hay registros individuales de conteo para la vista actual.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visibleRegs.map((reg, idx) => {
                        const isCocina = reg.tipo === 'COCINA_CIERRE' || reg.tipo === 'CIERRE';
                        const isSelectedForEdit = editingRegId === reg.id;

                        return (
                          <div
                            key={reg.id || idx}
                            className={`p-3 rounded-lg border transition-all ${
                              isSelectedForEdit
                                ? 'bg-blue-50/80 border-blue-400 shadow-2xs'
                                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                  isCocina ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {isCocina ? 'Cocina Cierre' : 'Bodega Cierre'}
                                </span>
                                {reg.usuario && (
                                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>{reg.usuario}</span>
                                  </span>
                                )}
                              </div>

                              {/* Acciones Editar y Eliminar */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditRegistro(reg)}
                                  className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="Editar este registro"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInsumoRegistro(reg.id)}
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Eliminar este conteo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-baseline justify-between">
                              <div className="text-sm font-bold text-slate-900 font-mono">
                                +{reg.cantidad} <span className="text-xs font-normal text-slate-500">{reg.unidad || item.unit}</span>
                              </div>
                              <div className="text-xs font-semibold text-slate-700 font-mono">
                                ${reg.total ? reg.total.toLocaleString('es-CO') : Math.round(reg.cantidad * (reg.costoUnitario || item.unitPrice)).toLocaleString('es-CO')} COP
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                              <span>Costo: ${(reg.costoUnitario || item.unitPrice).toLocaleString('es-CO')} /{reg.unidad || item.unit}</span>
                              {reg.hora && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                  <Clock className="w-3 h-3" />
                                  <span>{reg.hora}</span>
                                </span>
                              )}
                            </div>

                            {reg.observaciones && (
                              <div className="mt-1.5 text-[11px] bg-slate-50 text-slate-600 px-2 py-1 rounded border border-slate-100 italic">
                                "{reg.observaciones}"
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Footer del Drawer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  Cambios reflejados automáticamente en la hoja activa
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDrawerInsumo(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-md font-medium text-slate-700 transition-colors cursor-pointer shadow-2xs"
                >
                  Cerrar Panel
                </button>
              </div>

            </div>
          );
        })()}
      </aside>


    </div>
  );

  // ============================================================
  // RENDERIZADOR: FORMULARIO DEL INPUT INTELIGENTE GLOBAL
  // ============================================================
  function renderGlobalIntelligentInputBar() {
    const parsedQty = evaluateQtyFormula(newInsumoQtyFormula);
    const unitOpt = availableUnits.find(u => u.value === newInsumoUnit);
    const convertedQty = unitOpt ? Number((parsedQty.value * unitOpt.toBaseFactor(selectedCatalogItem)).toFixed(2)) : parsedQty.value;
    const estimatedSubtotal = Math.round(convertedQty * (Number(newInsumoPrice) || 0));
    const targetCat = newInsumoName.trim() ? determineTargetCategory(newInsumoName.trim(), selectedCatalogItem) : null;
    const activeTargetName = viewMode === 'COCINA_CIERRE' ? 'Cocina Cierre' : 'Bodega Cierre';

    return (
      <div className="relative bg-white border border-slate-300 rounded-xl p-2.5 sm:p-3 shadow-sm space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          
          {/* 1. Buscador Autocompletado */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              autoFocus
              value={newInsumoName}
              onChange={(e) => {
                setNewInsumoName(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Buscar cualquier insumo (ej: Punta de anca, Arroz, Vasos, Huevos, Leche)..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 font-medium shadow-2xs transition-all"
            />
            {newInsumoName && (
              <button
                type="button"
                onClick={() => {
                  setNewInsumoName('');
                  setSelectedCatalogItem(null);
                  setIsSearchOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Dropdown de Autocompletado */}
            {isSearchOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setIsSearchOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 w-full sm:w-[500px] max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl z-50 divide-y divide-slate-100 ring-1 ring-slate-900/5 animate-fade-in">
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
                        className={`px-2 py-0.5 rounded-md whitespace-nowrap text-[10px] font-medium transition-colors cursor-pointer ${
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
                    filteredCatalog.map((cItem) => {
                      const stdW = cItem.peso_estandar_porcion_kg || (cItem.peso_porc_gramos ? cItem.peso_porc_gramos / 1000 : 0);
                      return (
                        <div
                          key={cItem.id || cItem.nombre || cItem.insumo}
                          onMouseDown={() => handleSelectCatalogItem(cItem)}
                          className="p-2.5 px-3 hover:bg-orange-50/70 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <span className="font-semibold text-slate-900 block truncate">{cItem.nombre || cItem.insumo}</span>
                            <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded border font-medium uppercase tracking-wide mt-0.5 ${getCategoryBadgeStyle(cItem.categoria)}`}>
                              {cItem.categoria}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-medium text-slate-800 text-xs block">
                              ${(cItem.costo_unitario_kg || 0).toLocaleString('es-CO')}/{cItem.unidad_medida || 'Kg'}
                            </span>
                            {stdW > 0 && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.2 rounded border border-amber-200">
                                {Math.round(stdW * 1000)}g/porc
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No se encontraron coincidencias para &ldquo;{newInsumoName}&rdquo;.
                    </div>
                  )}

                  <div className="p-1.5 px-3 bg-slate-50 text-[10px] text-slate-500 border-t border-slate-100 flex items-center justify-between">
                    <span>Catálogo: {catalogItems.length} insumos</span>
                    <span>{filteredCatalog.length} coincidencias</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 2. Cantidad con Soporte de Fórmulas */}
          <div className="w-full sm:w-36 shrink-0 relative">
            <input
              type="text"
              value={newInsumoQtyFormula}
              onChange={(e) => setNewInsumoQtyFormula(e.target.value)}
              placeholder="Cantidad (ej: 5)"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 shadow-2xs"
            />
            {parsedQty.preview && (
              <span className="absolute right-2 top-2.5 text-[10px] font-mono text-emerald-700 font-bold pointer-events-none">
                {parsedQty.preview}
              </span>
            )}
          </div>

          {/* 3. Selector de Unidad (NUNCA VACÍO - Incluye unidades por defecto) */}
          <div className="w-full sm:w-44 shrink-0">
            <select
              value={newInsumoUnit}
              onChange={(e) => setNewInsumoUnit(e.target.value)}
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-500 shadow-2xs"
            >
              {availableUnits.length === 0 ? (
                <option value="">Tipo de unidad...</option>
              ) : (
                availableUnits.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))
              )}
            </select>
          </div>

          {/* 4. Costo Factura */}
          <div className="w-full sm:w-28 shrink-0">
            <input
              type="number"
              value={newInsumoPrice}
              onChange={(e) => setNewInsumoPrice(Number(e.target.value))}
              placeholder="Costo"
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-500 shadow-2xs"
            />
          </div>

          {/* 5. Botones Guardar y Cancelar */}
          <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-auto">
            <button
              type="button"
              disabled={savingManualItem || !newInsumoName.trim()}
              onClick={handleAddGlobalManualItem}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{savingManualItem ? '...' : 'Guardar'}</span>
            </button>

            <button
              type="button"
              onClick={handleCancelInput}
              className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>

        </div>

        {/* Previsualización en Vivo de la Ubicación Automática y Total */}
        {newInsumoName.trim() && targetCat && (
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-700 pt-1">
            <span className="text-orange-700 font-sans font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-orange-600" />
              Se ubicará automáticamente en: <strong>{targetCat.name}</strong>
            </span>
            {parsedQty.value > 0 && (
              <>
                <span>•</span>
                <span>Registro: <strong>{convertedQty} {unitOpt?.baseUnit || newInsumoUnit}</strong></span>
                <span>•</span>
                <span className="text-emerald-700 font-bold">Subtotal: ${estimatedSubtotal.toLocaleString('es-CO')} COP</span>
                <span>•</span>
                <span className="text-slate-500 font-sans">
                  en <strong>{activeTargetName}</strong>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    );
  }
}
