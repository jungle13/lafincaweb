'use client';

import React, { useState } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Trash2,
  Plus,
  Search,
  Sparkles,
  ArrowRight,
  Package,
  Layers,
  HelpCircle,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import {
  ConteoArchivoParsed,
  ConteoItemParsed,
  SeccionConteoKey,
  SECCIONES_CONTEO_CONFIG,
  matchCatalogItem,
  normalizeStr
} from '@/lib/conteosParser';

interface VistaPreviaConteosViewProps {
  previewData: ConteoArchivoParsed;
  catalog: any[];
  targetDate: string;
  isSaving: boolean;
  onConfirm: (confirmedData: ConteoArchivoParsed) => void;
  onCancel: () => void;
}

export default function VistaPreviaConteosView({
  previewData,
  catalog,
  targetDate,
  isSaving,
  onConfirm,
  onCancel
}: VistaPreviaConteosViewProps) {
  const [data, setData] = useState<ConteoArchivoParsed>(previewData);

  // Lista de secciones que tienen insumos
  const availableSections = data.seccionesConDatos.length > 0
    ? data.seccionesConDatos
    : (Object.keys(data.secciones) as SeccionConteoKey[]).filter(
        k => data.secciones[k].items.length > 0
      );

  const [activeSection, setActiveSection] = useState<SeccionConteoKey>(
    availableSections[0] || 'COCINA_CIERRE'
  );

  // Estado para el modal/dropdown de búsqueda de insumo en BD
  const [searchModalItemId, setSearchModalItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Totales globales recalculados
  const allItems = Object.values(data.secciones).flatMap(s => s.items);
  const totalItemsCount = allItems.length;
  const matchedCount = allItems.filter(it => it.isMatched && it.catalogItemId).length;
  const unmatchedCount = allItems.filter(it => !it.isMatched || !it.catalogItemId).length;
  const grandTotalCost = allItems.reduce((acc, it) => acc + (it.isMatched ? it.subtotal : 0), 0);

  // Handlers para modificar items
  const handleUpdateItem = (
    sectionKey: SeccionConteoKey,
    itemId: string,
    updates: Partial<ConteoItemParsed>
  ) => {
    setData(prev => {
      const currentItems = prev.secciones[sectionKey].items;
      const updatedItems = currentItems.map(it => {
        if (it.id !== itemId) return it;
        const updated = { ...it, ...updates };
        if ('cantidad' in updates || 'costoUnitario' in updates) {
          const qty = Number(updated.cantidad) || 0;
          const cost = Number(updated.costoUnitario) || 0;
          updated.subtotal = Math.round(qty * cost);
        }
        return updated;
      });

      return {
        ...prev,
        secciones: {
          ...prev.secciones,
          [sectionKey]: {
            ...prev.secciones[sectionKey],
            items: updatedItems
          }
        }
      };
    });
  };

  const handleRemoveItem = (sectionKey: SeccionConteoKey, itemId: string) => {
    setData(prev => {
      const updatedItems = prev.secciones[sectionKey].items.filter(it => it.id !== itemId);
      const newSeccionesConDatos = (Object.keys(prev.secciones) as SeccionConteoKey[]).filter(k => {
        if (k === sectionKey) return updatedItems.length > 0;
        return prev.secciones[k].items.length > 0;
      });

      return {
        ...prev,
        secciones: {
          ...prev.secciones,
          [sectionKey]: {
            ...prev.secciones[sectionKey],
            items: updatedItems
          }
        },
        seccionesConDatos: newSeccionesConDatos
      };
    });
  };

  const handleSelectCatalogItem = (sectionKey: SeccionConteoKey, itemId: string, catItem: any) => {
    const unitPrice = Number(catItem.costo_unitario_kg || catItem.costo_unitario || 0);
    handleUpdateItem(sectionKey, itemId, {
      catalogItemId: catItem.id,
      nombreCanonical: catItem.nombre,
      categoria: catItem.categoria || 'Insumos Varios',
      costoUnitario: unitPrice,
      isMatched: true
    });
    setSearchModalItemId(null);
    setSearchQuery('');
  };

  const handleAddItem = (sectionKey: SeccionConteoKey) => {
    const newItem: ConteoItemParsed = {
      id: `manual-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      rawTextOriginal: '',
      catalogItemId: null,
      nombreCanonical: '',
      categoria: 'Sin vincular',
      cantidad: 1,
      unidad: 'Kg',
      costoUnitario: 0,
      subtotal: 0,
      detalle: 'Añadido manualmente en vista previa',
      isMatched: false
    };

    setData(prev => {
      const updatedItems = [...prev.secciones[sectionKey].items, newItem];
      const newSeccionesConDatos = Array.from(new Set([...prev.seccionesConDatos, sectionKey]));
      return {
        ...prev,
        secciones: {
          ...prev.secciones,
          [sectionKey]: {
            ...prev.secciones[sectionKey],
            items: updatedItems
          }
        },
        seccionesConDatos: newSeccionesConDatos
      };
    });
  };

  // Filtrado de items del catálogo para el buscador
  const filteredCatalog = catalog.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = normalizeStr(searchQuery);
    return normalizeStr(c.nombre).includes(q) || normalizeStr(c.categoria || '').includes(q) || (c.codigo && normalizeStr(c.codigo).includes(q));
  }).slice(0, 30);

  const currentSectionData = data.secciones[activeSection];
  const sectionConfig = SECCIONES_CONTEO_CONFIG[activeSection];

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* ============================================================ */}
      {/* 1. BANNER SUPERIOR DE VISTA PREVIA (STAGING AREA)             */}
      {/* ============================================================ */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 shrink-0 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Título y Contexto */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900">
                  Vista Previa de Conteos Importados
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
                  Hoja: {targetDate}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Modo Suma (+)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Revisa y ajusta los insumos escaneados. Solo los insumos vinculados al catálogo de BD se guardarán en la hoja.
              </p>
            </div>
          </div>

          {/* Estadísticas y Botones de Acción */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {/* Badges de Validación */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                {matchedCount} listos
              </span>
              {unmatchedCount > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  {unmatchedCount} sin vincular (se omitirán)
                </span>
              )}
            </div>

            {/* Botón Cancelar */}
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar y Salir
            </button>

            {/* Botón Confirmar y Sumar */}
            <button
              type="button"
              disabled={matchedCount === 0 || isSaving}
              onClick={() => onConfirm(data)}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>
                {isSaving ? 'Guardando en BD...' : `Confirmar y Sumar (${matchedCount} insumos)`}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. PESTAÑAS DE NAVEGACIÓN: SOLO HOJAS CON INSUMOS            */}
      {/* ============================================================ */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 shrink-0 flex items-center gap-2 overflow-x-auto select-none">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5" />
          Hojas Escaneadas:
        </span>
        {availableSections.length === 0 ? (
          <span className="text-xs text-slate-400 italic">No se detectaron insumos en el archivo</span>
        ) : (
          availableSections.map(key => {
            const cfg = SECCIONES_CONTEO_CONFIG[key];
            const count = data.secciones[key].items.length;
            const isActive = activeSection === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-300'
                }`}
              >
                <span>{cfg.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. HOJA DE COSTEO EN BLANCO: TABLA EDITABLE                  */}
      {/* ============================================================ */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Encabezado descriptivo de la sección actual */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {sectionConfig?.label || activeSection}
                </h2>
                <span className="text-xs text-slate-500">
                  ({currentSectionData?.items?.length || 0} ítems escaneados)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {sectionConfig?.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleAddItem(activeSection)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              <span>Añadir insumo manual</span>
            </button>
          </div>

          {/* Tabla de Insumos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {currentSectionData?.items?.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                Esta hoja no contiene insumos en el archivo escaneado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Insumo en Planilla (Original)</th>
                      <th className="py-2.5 px-3 min-w-[260px]">Insumo / Producto (BD)</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Categoría</th>
                      <th className="py-2.5 px-3 w-28 text-right">Cantidad</th>
                      <th className="py-2.5 px-3 w-28">Unidad</th>
                      <th className="py-2.5 px-3 w-28 text-right">Costo Unit.</th>
                      <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 min-w-[150px]">Detalle / Obs.</th>
                      <th className="py-2.5 px-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSectionData.items.map((item, idx) => {
                      const isMatched = item.isMatched && !!item.catalogItemId;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !isMatched ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          {/* Número */}
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Nombre Original en Planilla */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={item.rawTextOriginal}
                              onChange={e =>
                                handleUpdateItem(activeSection, item.id, {
                                  rawTextOriginal: e.target.value
                                })
                              }
                              placeholder="Nombre en foto o planilla..."
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-medium text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-slate-400"
                            />
                          </td>

                          {/* Insumo en BD (Con Vinculación y Selector) */}
                          <td className="py-2.5 px-3">
                            {isMatched ? (
                              <div className="flex items-center justify-between gap-1.5 p-1 bg-emerald-50/50 border border-emerald-200 rounded">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-semibold text-slate-900 truncate" title={item.nombreCanonical}>
                                    {item.nombreCanonical}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSearchModalItemId(item.id);
                                    setSearchQuery(item.nombreCanonical || item.rawTextOriginal);
                                  }}
                                  className="text-[10px] text-emerald-700 hover:underline shrink-0 px-1 py-0.5 font-bold cursor-pointer"
                                >
                                  Cambiar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1.5 p-1 bg-amber-50 border border-amber-300 rounded">
                                <div className="flex items-center gap-1.5 text-amber-800 text-[11px] font-semibold min-w-0">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span className="truncate">Sin vincular en BD</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSearchModalItemId(item.id);
                                    setSearchQuery(item.rawTextOriginal);
                                  }}
                                  className="px-2 py-0.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded shrink-0 shadow-2xs transition-colors cursor-pointer"
                                >
                                  Buscar en BD
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Categoría */}
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {item.categoria}
                            </span>
                          </td>

                          {/* Cantidad editable */}
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              step="any"
                              value={item.cantidad || ''}
                              onChange={e =>
                                handleUpdateItem(activeSection, item.id, {
                                  cantidad: parseFloat(e.target.value) || 0
                                })
                              }
                              className="w-20 px-2 py-1 text-right font-mono font-bold text-xs border border-slate-300 rounded focus:outline-none focus:border-slate-500 shadow-2xs"
                            />
                          </td>

                          {/* Unidad */}
                          <td className="py-2.5 px-3">
                            <select
                              value={item.unidad}
                              onChange={e =>
                                handleUpdateItem(activeSection, item.id, {
                                  unidad: e.target.value
                                })
                              }
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-medium text-slate-800 focus:outline-none focus:border-slate-500"
                            >
                              <option value="Kg">Kg</option>
                              <option value="Gramos">Gramos</option>
                              <option value="Und">Und</option>
                              <option value="Botella">Botella</option>
                              <option value="Porción">Porción</option>
                            </select>
                          </td>

                          {/* Costo Unitario */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            ${item.costoUnitario.toLocaleString('es-CO')}
                          </td>

                          {/* Subtotal */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ${item.subtotal.toLocaleString('es-CO')}
                          </td>

                          {/* Detalle / Observación */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={item.detalle}
                              onChange={e =>
                                handleUpdateItem(activeSection, item.id, {
                                  detalle: e.target.value
                                })
                              }
                              placeholder="Notas de pesaje / turno..."
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded text-slate-600 focus:outline-none focus:border-slate-400"
                            />
                          </td>

                          {/* Eliminar Fila */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(activeSection, item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Quitar este insumo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/* 4. MODAL DE BÚSQUEDA Y VINCULACIÓN CON CATÁLOGO DE BD        */}
      {/* ============================================================ */}
      {searchModalItemId && (
        <div className="fixed inset-0 z-[9999999] isolate flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSearchModalItemId(null)}
          />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Vincular con Catálogo Oficial de BD
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSearchModalItemId(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Escribe el nombre del insumo en la base de datos..."
                autoFocus
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-slate-500 shadow-2xs font-medium"
              />
            </div>

            <div className="p-2 overflow-y-auto divide-y divide-slate-100 max-h-80">
              {filteredCatalog.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No se encontraron insumos en el catálogo con &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredCatalog.map(catItem => (
                  <button
                    key={catItem.id}
                    type="button"
                    onClick={() =>
                      handleSelectCatalogItem(activeSection, searchModalItemId, catItem)
                    }
                    className="w-full text-left p-2.5 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-slate-950 block">
                        {catItem.nombre}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {catItem.categoria} · {catItem.unidad_medida || 'Kg'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-700 block">
                        ${Number(catItem.costo_unitario_kg || catItem.costo_unitario || 0).toLocaleString('es-CO')}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold group-hover:underline">
                        Seleccionar ✓
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
