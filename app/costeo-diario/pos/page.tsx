'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Delete,
  Layers,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  PosCatalogItem,
  PosEquivalenceOption,
  PosMacroCategory,
  evaluatePosExpression,
  getInsumoVisualMeta,
  getPosEquivalenceOptions,
  resolveOfficialBaseUnit,
} from '@/lib/posInsumosHelper';
import { usePersistedState, hasPersistedValue } from '@/lib/usePersistedState';

type OperationalViewKey =
  | 'TRASLADOS'
  | 'COCINA_APERTURA'
  | 'COCINA_CIERRE'
  | 'DEVOLUCIONES'
  | 'BODEGA_APERTURA'
  | 'BODEGA_CIERRE';

interface VistaOption {
  key: OperationalViewKey;
  label: string;
  shortLabel: string;
  dbTipo: string;
  uiTipo: string;
}

const VISTAS_OPERATIVAS: VistaOption[] = [
  { key: 'TRASLADOS', label: 'Traslados a Cocina', shortLabel: 'Traslados', dbTipo: 'TRASLADO', uiTipo: 'BODEGA_A_COCINA' },
  { key: 'COCINA_APERTURA', label: 'Cocina Apertura', shortLabel: 'Cocina Ap.', dbTipo: 'APERTURA', uiTipo: 'INVENTARIO_INICIAL_COCINA' },
  { key: 'COCINA_CIERRE', label: 'Cocina Cierre', shortLabel: 'Cocina Cie.', dbTipo: 'CIERRE', uiTipo: 'COCINA_CIERRE' },
  { key: 'BODEGA_APERTURA', label: 'Bodega Apertura', shortLabel: 'Bodega Ap.', dbTipo: 'BODEGA_APERTURA', uiTipo: 'BODEGA_APERTURA' },
  { key: 'BODEGA_CIERRE', label: 'Bodega Cierre', shortLabel: 'Bodega Cie.', dbTipo: 'BODEGA_CIERRE', uiTipo: 'BODEGA_CIERRE' },
  { key: 'DEVOLUCIONES', label: 'Devoluciones', shortLabel: 'Devoluc.', dbTipo: 'DEVOLUCION', uiTipo: 'DEVOLUCION_COCINA' },
];

const CATEGORIAS_POS: Array<{ key: PosMacroCategory; label: string; emoji: string }> = [
  { key: 'TODAS', label: 'Todos', emoji: '⭐' },
  { key: 'CARNES', label: 'Carnes', emoji: '🥩' },
  { key: 'VERDURAS', label: 'Verduras', emoji: '🥬' },
  { key: 'GRANOS', label: 'Granos', emoji: '🌾' },
  { key: 'BEBIDAS', label: 'Bebidas', emoji: '🍺' },
  { key: 'DESECHABLES', label: 'Desechables', emoji: '🥡' },
];

interface SheetSummary {
  id: string;
  dateStr: string;
  title: string;
  posSales: number;
  preciosVigentes?: Record<string, {
    unitPrice: number;
    sourceInvoice?: {
      numeroFactura: string;
      fecha: string;
      proveedor: string;
      costoUnitario: number;
      unidad: string;
    } | null;
  }>;
  categories: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      qty: number;
      unit: string;
      unitPrice: number;
      total: number;
      registros?: Array<{
        id: string;
        tipo: string;
        cantidad: number;
        total: number;
      }>;
    }>;
  }>;
}

interface SessionEntryLog {
  localId: string;
  dbRegistroId?: string;
  itemName: string;
  qtyBase: number;
  unit: string;
  unitPrice: number;
  total: number;
  vistaLabel: string;
}

export default function CosteoDiarioPosPage() {
  const [catalog, setCatalog] = useState<PosCatalogItem[]>([]);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = usePersistedState<string>('pos_selected_date', new Date().toISOString().slice(0, 10));
  const [activeView, setActiveView] = usePersistedState<OperationalViewKey>('pos_active_view', 'TRASLADOS');
  const [activeCategory, setActiveCategory] = usePersistedState<PosMacroCategory>('pos_active_category', 'TODAS');
  const [searchText, setSearchText] = usePersistedState<string>('pos_search_text', '');
  const [onlyCounted, setOnlyCounted] = usePersistedState<boolean>('pos_only_counted', false);

  const [selectedItem, setSelectedItem] = useState<PosCatalogItem | null>(null);
  const [selectedEq, setSelectedEq] = useState<PosEquivalenceOption | null>(null);
  const [expr, setExpr] = useState<string>('');
  const [customUnitPrice, setCustomUnitPrice] = useState<string>('');
  const [editingPrice, setEditingPrice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionEntryLog[]>([]);

  // Leer ?fecha= y ?vista= de la URL al montar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const f = sp.get('fecha');
    const v = sp.get('vista')?.toUpperCase() as OperationalViewKey | undefined;
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
      setSelectedDate(f);
    }
    if (v && VISTAS_OPERATIVAS.some((opt) => opt.key === v)) {
      setActiveView(v);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, sheetsRes] = await Promise.all([
        fetch('/api/catalogo', { cache: 'no-store' }),
        fetch('/api/costeo-diario', { cache: 'no-store' }),
      ]);
      const catJson = await catRes.json();
      const sheetsJson = await sheetsRes.json();

      if (Array.isArray(catJson?.data)) {
        setCatalog(catJson.data);
      }
      if (Array.isArray(sheetsJson?.sheets)) {
        setSheets(sheetsJson.sheets);
        // Si la fecha actual no está en URL y hay hojas, usar la más reciente si hoy no tiene hoja
        const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        if (!sp?.get('fecha') && !hasPersistedValue('pos_selected_date') && sheetsJson.sheets.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const hasToday = sheetsJson.sheets.some((s: SheetSummary) => s.dateStr === today);
          if (!hasToday) {
            setSelectedDate(sheetsJson.sheets[0].dateStr);
          }
        }
      }
    } catch (err) {
      console.error('Error cargando datos POS:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeSheet = useMemo(
    () => sheets.find((s) => s.dateStr === selectedDate) || null,
    [sheets, selectedDate]
  );

  const activeVistaMeta = useMemo(
    () => VISTAS_OPERATIVAS.find((v) => v.key === activeView) || VISTAS_OPERATIVAS[0],
    [activeView]
  );

  // Mapa de cantidades actuales por nombre normalizado en la hoja y vista activas
  const currentQtyByInsumoName = useMemo(() => {
    const map: Record<string, { qty: number; unit: string }> = {};
    if (!activeSheet) return map;
    for (const cat of activeSheet.categories || []) {
      for (const it of cat.items || []) {
        const regs = (it.registros || []).filter((r) => r.tipo === activeVistaMeta.uiTipo);
        if (regs.length > 0) {
          const sum = regs.reduce((acc, r) => acc + Number(r.cantidad || 0), 0);
          map[it.name.toLowerCase().trim()] = { qty: Number(sum.toFixed(2)), unit: it.unit };
        }
      }
    }
    return map;
  }, [activeSheet, activeVistaMeta.uiTipo]);

  const getEffectivePriceInfo = useCallback(
    (item: PosCatalogItem) => {
      const hist = activeSheet?.preciosVigentes?.[item.id];
      if (hist && hist.unitPrice > 0) {
        return {
          price: hist.unitPrice,
          invoice: hist.sourceInvoice || null,
        };
      }
      return {
        price: Number(item.costo_unitario_kg || 0),
        invoice: null,
      };
    },
    [activeSheet]
  );

  const handleSelectInsumo = useCallback(
    (item: PosCatalogItem) => {
      setSelectedItem(item);
      const eqOptions = getPosEquivalenceOptions(item);
      setSelectedEq(eqOptions[0] || null);
      setExpr('');
      setEditingPrice(false);
      const { price } = getEffectivePriceInfo(item);
      setCustomUnitPrice(String(price));
    },
    [getEffectivePriceInfo]
  );

  // Actualizar precio sugerido si cambia la fecha de hoja con un insumo seleccionado
  useEffect(() => {
    if (!selectedItem || editingPrice) return;
    const { price } = getEffectivePriceInfo(selectedItem);
    setCustomUnitPrice(String(price));
  }, [selectedDate, selectedItem, editingPrice, getEffectivePriceInfo]);

  const filteredCatalog = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return catalog.filter((item) => {
      const meta = getInsumoVisualMeta(item);
      if (activeCategory !== 'TODAS' && meta.macroCategory !== activeCategory) {
        return false;
      }
      if (onlyCounted) {
        const counted = currentQtyByInsumoName[item.nombre.toLowerCase().trim()];
        if (!counted || counted.qty <= 0) return false;
      }
      if (q) {
        const n = (item.nombre || '').toLowerCase();
        const c = (item.categoria || '').toLowerCase();
        if (!n.includes(q) && !c.includes(q)) return false;
      }
      return true;
    });
  }, [catalog, activeCategory, onlyCounted, searchText, currentQtyByInsumoName]);

  const evalResult = useMemo(() => evaluatePosExpression(expr), [expr]);

  const calculatedPreview = useMemo(() => {
    if (!selectedItem || !selectedEq) {
      return { baseQty: 0, baseUnit: 'Kg', unitPrice: 0, total: 0 };
    }
    const baseUnit = selectedEq.baseUnit || resolveOfficialBaseUnit(selectedItem);
    const baseQty = evalResult.valid
      ? Number((evalResult.sum * selectedEq.factorToBase).toFixed(2))
      : 0;
    const unitPrice = Number(customUnitPrice) || 0;
    const total = Math.round(baseQty * unitPrice);
    return { baseQty, baseUnit, unitPrice, total };
  }, [selectedItem, selectedEq, evalResult, customUnitPrice]);

  const showToastMsg = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2800);
  };

  // Teclado POS interno
  const appendKey = useCallback((key: string) => {
    setExpr((prev) => {
      if (key === 'C') return '';
      if (key === 'BACK') return prev.slice(0, -1);
      if (key === '+0.5') {
        if (!prev) return '0.5';
        return prev.endsWith('+') ? `${prev}0.5` : `${prev}+0.5`;
      }
      if (key === '+') {
        if (!prev || prev.endsWith('+')) return prev;
        return `${prev}+`;
      }
      if (key === '.') {
        const lastTerm = prev.split('+').pop() || '';
        if (lastTerm.includes('.')) return prev;
        return lastTerm === '' ? `${prev}0.` : `${prev}.`;
      }
      if (key === '00') {
        const lastTerm = prev.split('+').pop() || '';
        if (lastTerm === '' || lastTerm === '0') return prev || '0';
        return `${prev}00`;
      }
      return `${prev}${key}`;
    });
  }, []);

  const handleCommitPosEntry = useCallback(async () => {
    if (!selectedItem || !selectedEq || saving) return;
    if (!evalResult.valid || calculatedPreview.baseQty <= 0) {
      showToastMsg('err', 'Ingresa una cantidad mayor a 0 en el teclado.');
      return;
    }

    setSaving(true);
    const itemToSave = selectedItem;
    const eqUsed = selectedEq;
    const qtyInput = evalResult.sum;
    const baseQty = calculatedPreview.baseQty;
    const baseUnit = calculatedPreview.baseUnit;
    const unitPrice = calculatedPreview.unitPrice;
    const total = calculatedPreview.total;

    const obsNote = eqUsed.isPortion
      ? `${itemToSave.nombre} (${qtyInput} Und · ${Math.round(eqUsed.factorToBase * 1000)}g/und)`
      : eqUsed.factorToBase !== 1
        ? `${qtyInput} ${eqUsed.shortLabel} = ${baseQty} ${baseUnit}`
        : '';

    try {
      const res = await fetch('/api/costeo-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: selectedDate,
          titulo: activeSheet?.title || `${selectedDate} - Hoja Costeo Cocina`,
          pos_sales: activeSheet?.posSales || 0,
          targetView: activeView,
          movimiento: {
            tipo: activeVistaMeta.uiTipo,
            insumo_id: itemToSave.id,
            nombre_insumo: itemToSave.nombre,
            categoria: itemToSave.categoria || 'Verduras e Insumos',
            cantidad: baseQty,
            unidad: baseUnit,
            costo_unitario: unitPrice,
            total,
            observaciones: obsNote || undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error guardando el conteo.');
      }

      const logEntry: SessionEntryLog = {
        localId: `log-${Date.now()}`,
        dbRegistroId: data.movimiento?.id,
        itemName: itemToSave.nombre,
        qtyBase: baseQty,
        unit: baseUnit,
        unitPrice,
        total,
        vistaLabel: activeVistaMeta.shortLabel,
      };
      setSessionLogs((prev) => [logEntry, ...prev].slice(0, 6));
      setExpr('');
      showToastMsg('ok', `✓ ${itemToSave.nombre}: +${baseQty} ${baseUnit} ($${total.toLocaleString('es-CO')})`);

      // Refrescar hojas en segundo plano para actualizar badges de conteo
      fetch('/api/costeo-diario', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.sheets)) setSheets(d.sheets);
        })
        .catch(() => {});
    } catch (err: any) {
      showToastMsg('err', err?.message || 'Error al registrar.');
    } finally {
      setSaving(false);
    }
  }, [
    selectedItem,
    selectedEq,
    saving,
    evalResult,
    calculatedPreview,
    selectedDate,
    activeSheet,
    activeView,
    activeVistaMeta,
  ]);

  const handleUndoLog = async (log: SessionEntryLog) => {
    if (!log.dbRegistroId) return;
    try {
      const res = await fetch('/api/costeo-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_ITEM',
          fecha: selectedDate,
          registroIds: [log.dbRegistroId],
        }),
      });
      if (res.ok) {
        setSessionLogs((prev) => prev.filter((l) => l.localId !== log.localId));
        showToastMsg('ok', `Registro eliminado: ${log.itemName}`);
        const r = await fetch('/api/costeo-diario', { cache: 'no-store' });
        const d = await r.json();
        if (Array.isArray(d?.sheets)) setSheets(d.sheets);
      }
    } catch (err) {
      console.error('Error deshaciendo registro POS:', err);
    }
  };

  // Atajos con teclado físico en PC cuando no hay input enfocado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (!selectedItem) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendKey(e.key);
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        appendKey('.');
      } else if (e.key === '+') {
        e.preventDefault();
        appendKey('+');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        appendKey('BACK');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedItem(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleCommitPosEntry();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedItem, appendKey, handleCommitPosEntry]);

  const selectedVisual = selectedItem ? getInsumoVisualMeta(selectedItem) : null;
  const selectedPriceInfo = selectedItem ? getEffectivePriceInfo(selectedItem) : null;
  const eqOptionsForSelected = selectedItem ? getPosEquivalenceOptions(selectedItem) : [];

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] bg-slate-100 overflow-hidden select-none">
      {/* Barra Superior Operativa */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/costeo-diario"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Hoja Normal</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 hidden md:inline">FECHA:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* Selector Táctil de Sección Operativa */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
          {VISTAS_OPERATIVAS.map((v) => {
            const active = activeView === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setActiveView(v.key)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {v.shortLabel}
              </button>
            );
          })}
        </div>
      </header>

      {/* Toast flotante */}
      {toast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs sm:text-sm font-bold flex items-center gap-2 ${
            toast.type === 'ok'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'ok' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Cuerpo Principal: Split 2 columnas en Tablet Horizontal/Desktop, apilado en Vertical/Móvil */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* COLUMNA IZQUIERDA: Buscador + Categorías + Cuadrícula Grande de Insumos */}
        <section className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 sm:p-4 gap-3">
          {/* Buscador + Filtro Rápido */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar insumo por nombre (ej. punta, papa, chorizo, vaso)..."
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOnlyCounted((v) => !v)}
              className={`px-3 py-2.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                onlyCounted
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              ✓ Contados hoy
            </button>
          </div>

          {/* Pestañas Gigantes de Categoría */}
          <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-1">
            {CATEGORIAS_POS.map((cat) => {
              const active = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border transition-all cursor-pointer active:scale-95 ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <span className="text-base">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Cuadrícula Visual de Insumos */}
          <div className="flex-1 overflow-y-auto pr-1 pb-4">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Cargando catálogo POS...
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm gap-2">
                <Layers className="w-6 h-6" />
                <span>No se encontraron insumos en esta categoría.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredCatalog.map((item) => {
                  const visual = getInsumoVisualMeta(item);
                  const baseUnit = resolveOfficialBaseUnit(item);
                  const { price } = getEffectivePriceInfo(item);
                  const isSelected = selectedItem?.id === item.id;
                  const counted = currentQtyByInsumoName[item.nombre.toLowerCase().trim()];

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectInsumo(item)}
                      className={`relative text-left p-3 sm:p-3.5 rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.98] flex flex-col justify-between min-h-[122px] ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-lg ring-2 ring-slate-900/20'
                          : 'bg-white text-slate-900 border-slate-200 hover:border-slate-400 shadow-2xs'
                      }`}
                    >
                      {/* Badge cantidad ya registrada hoy */}
                      {counted && counted.qty > 0 && (
                        <span
                          className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isSelected
                              ? 'bg-emerald-400 text-slate-950'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          ✓ {counted.qty} {counted.unit}
                        </span>
                      )}

                      <div className="flex items-start gap-2.5 pr-12">
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                            isSelected
                              ? 'bg-white/10 border-white/20'
                              : `${visual.accentBg} ${visual.accentBorder}`
                          }`}
                        >
                          {visual.emoji}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1">
                        <div className="text-xs sm:text-sm font-bold leading-snug line-clamp-2">
                          {item.nombre}
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <span
                            className={`text-[11px] font-semibold truncate ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {item.peso_estandar_porcion_kg && visual.macroCategory === 'CARNES'
                              ? `Porc: ${Math.round(Number(item.peso_estandar_porcion_kg) * 1000)}g`
                              : item.categoria || baseUnit}
                          </span>
                          <span
                            className={`text-xs font-extrabold whitespace-nowrap ${
                              isSelected ? 'text-emerald-300' : 'text-slate-900'
                            }`}
                          >
                            ${Math.round(price).toLocaleString('es-CO')}
                            <span className="text-[10px] font-normal opacity-75">/{baseUnit}</span>
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* COLUMNA DERECHA (Horizontal) / PANEL INFERIOR (Vertical/Móvil): TECLADO POS */}
        <aside
          className={`bg-white border-t lg:border-t-0 lg:border-l border-slate-200 shrink-0 flex flex-col justify-between shadow-2xl transition-all ${
            selectedItem
              ? 'w-full lg:w-[400px] xl:w-[430px] max-h-[68dvh] lg:max-h-none'
              : 'hidden lg:flex lg:w-[380px] xl:w-[410px]'
          }`}
        >
          {!selectedItem ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">
                👆
              </div>
              <div className="text-sm font-bold text-slate-700">
                Toca un insumo de la izquierda
              </div>
              <p className="text-xs text-slate-500 max-w-xs">
                Selecciona cualquier tarjeta para abrir el teclado táctil POS, elegir porciones o Kg y registrar el conteo en un toque.
              </p>

              {sessionLogs.length > 0 && (
                <div className="w-full pt-4 border-t border-slate-100 text-left space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    Últimos registros de esta sesión
                  </div>
                  {sessionLogs.map((log) => (
                    <div
                      key={log.localId}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-800 truncate">{log.itemName}</div>
                        <div className="text-[11px] text-slate-500">
                          +{log.qtyBase} {log.unit} · ${log.total.toLocaleString('es-CO')} ({log.vistaLabel})
                        </div>
                      </div>
                      {log.dbRegistroId && (
                        <button
                          type="button"
                          onClick={() => handleUndoLog(log)}
                          title="Eliminar registro"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-y-auto p-3 sm:p-4 gap-2.5">
              {/* Cabecera del Insumo Seleccionado */}
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
                    {selectedVisual?.emoji}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                      {selectedItem.nombre}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{activeVistaMeta.label}</span>
                      <span>·</span>
                      {!editingPrice ? (
                        <button
                          type="button"
                          onClick={() => setEditingPrice(true)}
                          className="font-bold text-blue-700 hover:underline cursor-pointer"
                        >
                          ${Math.round(Number(customUnitPrice || 0)).toLocaleString('es-CO')}/{calculatedPreview.baseUnit} (Editar $)
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            value={customUnitPrice}
                            onChange={(e) => setCustomUnitPrice(e.target.value)}
                            className="w-24 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setEditingPrice(false)}
                            className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold cursor-pointer"
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                    {selectedPriceInfo?.invoice && (
                      <div className="text-[10px] text-emerald-700 font-medium truncate">
                        Factura #{selectedPriceInfo.invoice.numeroFactura} ({selectedPriceInfo.invoice.fecha})
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer lg:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Pills de Equivalencia en 1 Toque */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0">
                {eqOptionsForSelected.map((opt) => {
                  const active = selectedEq?.id === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedEq(opt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Display Digital POS */}
              <div className="bg-slate-950 text-white rounded-2xl p-3 sm:p-3.5 space-y-1 shrink-0">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Ingreso en {selectedEq?.label}</span>
                  <span>{evalResult.partsCount > 1 ? `${evalResult.partsCount} sumandos` : 'Listo'}</span>
                </div>
                <div className="text-xl sm:text-2xl font-mono font-extrabold tracking-tight text-right min-h-[32px] truncate">
                  {expr || '0'}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
                  <span className="text-emerald-400 font-bold">
                    = {calculatedPreview.baseQty} {calculatedPreview.baseUnit}
                  </span>
                  <span className="text-amber-300 font-extrabold">
                    ${calculatedPreview.total.toLocaleString('es-CO')} COP
                  </span>
                </div>
              </div>

              {/* Teclado POS Numérico 4x4 (Botones Grandes, SIN teclado nativo) */}
              <div className="grid grid-cols-4 gap-2 shrink-0">
                {[
                  { label: '7', val: '7', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '8', val: '8', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '9', val: '9', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '⌫', val: 'BACK', cls: 'bg-amber-100 hover:bg-amber-200 text-amber-900' },

                  { label: '4', val: '4', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '5', val: '5', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '6', val: '6', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '+', val: '+', cls: 'bg-blue-100 hover:bg-blue-200 text-blue-900 text-xl' },

                  { label: '1', val: '1', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '2', val: '2', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '3', val: '3', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: 'C', val: 'C', cls: 'bg-rose-100 hover:bg-rose-200 text-rose-900' },

                  { label: '0', val: '0', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '00', val: '00', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900' },
                  { label: '.', val: '.', cls: 'bg-slate-100 hover:bg-slate-200 text-slate-900 text-xl' },
                  { label: '+0.5', val: '+0.5', cls: 'bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs' },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => appendKey(btn.val)}
                    className={`h-12 sm:h-13 rounded-xl font-extrabold text-base sm:text-lg transition-all cursor-pointer active:scale-95 flex items-center justify-center ${btn.cls}`}
                  >
                    {btn.val === 'BACK' ? <Delete className="w-5 h-5" /> : btn.label}
                  </button>
                ))}
              </div>

              {/* Botón Principal Gigante: Guardar y Seguir */}
              <button
                type="button"
                disabled={saving || !evalResult.valid}
                onClick={handleCommitPosEntry}
                className="w-full h-13 sm:h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold text-sm sm:text-base shadow-md transition-all cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2 shrink-0"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    AGREGAR Y SEGUIR
                  </>
                )}
              </button>

              {/* Últimos registros de sesión (compacto) */}
              {sessionLogs.length > 0 && (
                <div className="pt-1 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Últimos ingresos</span>
                    <span>{sessionLogs.length}</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {sessionLogs.slice(0, 3).map((log) => (
                      <div
                        key={log.localId}
                        className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1 text-[11px]"
                      >
                        <span className="truncate font-semibold text-slate-700">
                          {log.itemName}: +{log.qtyBase} {log.unit}
                        </span>
                        {log.dbRegistroId && (
                          <button
                            type="button"
                            onClick={() => handleUndoLog(log)}
                            className="text-red-500 hover:text-red-700 ml-2 shrink-0 cursor-pointer"
                            title="Deshacer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
