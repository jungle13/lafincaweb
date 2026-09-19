'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Loader2, CheckCircle2, Trash2, PlusCircle, AlertTriangle,
  ClipboardList, Scale, Search, Check, Edit2, RotateCcw
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import SmartSearchInsumo from '@/components/bodeguero/SmartSearchInsumo';
import { formatMoney, normalizeStr } from '@/lib/formatters';
import { InsumoItem } from '@/types';

// Detecta si un insumo se maneja estrictamente por unidades
const isUnidadOnly = (nombre?: string, unidad_medida?: string, categoria?: string) => {
  const n = (nombre || '').toLowerCase();
  const c = (categoria || '').toLowerCase();
  const u = (unidad_medida || '').toLowerCase();
  return (
    u === 'und' ||
    n.includes('chorizo') ||
    n.includes('tamal') ||
    n.includes('huevo') ||
    n.includes('empanada') ||
    c.includes('embutido') ||
    c.includes('elaborado')
  );
};

export default function DetalleConteoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [conteo, setConteo] = useState<any>(null);
  const [detalles, setDetalles] = useState<any[]>([]);
  const [insumosList, setInsumosList] = useState<InsumoItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs de Auditoría: 'REGISTRADOS' (solo lo contado) | 'AUDITORIA_COMPLETA' (todo el catálogo con stock sistema)
  const [activeTab, setActiveTab] = useState<'REGISTRADOS' | 'AUDITORIA_COMPLETA'>('REGISTRADOS');

  // Filtros en Tab de Auditoría Completa
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterUbicacion, setAuditFilterUbicacion] = useState<'ALL' | 'BODEGA' | 'COCINA'>('ALL');
  const [auditFilterStatus, setAuditFilterStatus] = useState<'ALL' | 'CONTADOS' | 'SIN_CONTAR'>('ALL');

  // Form State
  const [selectedInsumo, setSelectedInsumo] = useState<InsumoItem | null>(null);
  const [ubicacion, setUbicacion] = useState<'BODEGA' | 'COCINA'>('BODEGA');
  
  const [cantSinPorc, setCantSinPorc] = useState('');
  const [porcUnd, setPorcUnd] = useState('');
  const [porcKg, setPorcKg] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');

  const [savingItem, setSavingItem] = useState(false);
  const [quickActionId, setQuickActionId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resConteo, resStock] = await Promise.all([
        fetch(`/api/inventario/conteos/${params.id}?t=${Date.now()}`),
        fetch(`/api/bodega/stock?t=${Date.now()}`)
      ]);
      const dataConteo = await resConteo.json();
      const dataStock = await resStock.json();

      if (dataConteo.success) {
        setConteo(dataConteo.conteo);
        setDetalles(dataConteo.detalles || []);
      }
      if (dataStock.data) {
        setInsumosList(dataStock.data);
      }
    } catch (e) {
      console.error('Error al cargar datos del conteo:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInsumo = (insumo: InsumoItem | null) => {
    setSelectedInsumo(insumo);
    if (insumo) {
      setCostoUnitario(insumo.costo_unitario_kg ? String(insumo.costo_unitario_kg) : '0');
    } else {
      setCostoUnitario('');
    }
    setCantSinPorc('');
    setPorcUnd('');
    setPorcKg('');
  };

  const isItemUnd = useMemo(() => {
    if (!selectedInsumo) return false;
    return isUnidadOnly(selectedInsumo.insumo, selectedInsumo.unidad_medida, selectedInsumo.categoria);
  }, [selectedInsumo]);

  const totalCostoCalculado = useMemo(() => {
    if (!selectedInsumo) return 0;
    const costo = parseFloat(costoUnitario) || 0;
    
    if (isItemUnd) {
      const pGramos = selectedInsumo.peso_porc_gramos || 350;
      const pEstKg = pGramos / 1000;
      const unds = parseInt(porcUnd) || 0;
      return Math.round(unds * (pEstKg > 0 ? pEstKg * costo : costo));
    } else {
      const sin = parseFloat(cantSinPorc) || 0;
      const con = parseFloat(porcKg) || 0;
      return Math.round((sin + con) * costo);
    }
  }, [selectedInsumo, isItemUnd, cantSinPorc, porcUnd, porcKg, costoUnitario]);

  // Mapa rápido de ítems contados por insumo_id y ubicacion
  const detallesMap = useMemo(() => {
    const map = new Map<string, any>();
    detalles.forEach((d) => {
      const key = `${d.insumo_id}_${d.ubicacion}`;
      map.set(key, d);
    });
    return map;
  }, [detalles]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Por favor selecciona una carne o insumo.');

    const undsNum = parseInt(porcUnd) || 0;
    const kgNum = parseFloat(cantSinPorc) || 0;
    const pesoPorcNum = parseFloat(porcKg) || 0;

    if (isItemUnd && undsNum < 0) {
      return alert('Ingresa una cantidad válida en unidades.');
    }
    if (!isItemUnd && kgNum <= 0 && undsNum <= 0 && pesoPorcNum <= 0) {
      return alert('Ingresa al menos una cantidad contada (Kg enteros o Porciones).');
    }

    setSavingItem(true);
    try {
      const body = {
        insumo_id: selectedInsumo.insumo_id,
        ubicacion,
        cant_sin_porcionar_kg: kgNum,
        porciones_und: undsNum,
        peso_porciones_kg: pesoPorcNum,
        costo_unitario_kg: parseFloat(costoUnitario) || 0,
        valor_total: totalCostoCalculado
      };
      
      const res = await fetch(`/api/inventario/conteos/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setSelectedInsumo(null);
        setCantSinPorc('');
        setPorcUnd('');
        setPorcKg('');
        setCostoUnitario('');
        loadData();
      } else {
        alert(data.error || 'Error al guardar el ítem');
      }
    } catch (e: any) {
      alert(e.message || 'Error de conexión');
    } finally {
      setSavingItem(false);
    }
  };

  // Acción rápida desde el Tab de Auditoría: Poner en Cero (producto agotado físicamente)
  const handleQuickZero = async (insumo: InsumoItem, targetUbicacion: 'BODEGA' | 'COCINA') => {
    if (!confirm(`¿Confirmas registrar ${insumo.insumo} en ${targetUbicacion} con existencia física en 0?`)) return;

    setQuickActionId(`${insumo.insumo_id}_${targetUbicacion}`);
    try {
      const body = {
        insumo_id: insumo.insumo_id,
        ubicacion: targetUbicacion,
        cant_sin_porcionar_kg: 0,
        porciones_und: 0,
        peso_porciones_kg: 0,
        costo_unitario_kg: insumo.costo_unitario_kg || 0,
        valor_total: 0
      };

      const res = await fetch(`/api/inventario/conteos/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      } else {
        alert(data.error || 'Error al registrar conteo en 0');
      }
    } catch (e: any) {
      alert(e.message || 'Error al conectar');
    } finally {
      setQuickActionId(null);
    }
  };

  // Cargar insumo en el formulario superior para contar
  const handleLoadInsumoToForm = (insumo: InsumoItem, targetUbicacion: 'BODEGA' | 'COCINA') => {
    setSelectedInsumo(insumo);
    setUbicacion(targetUbicacion);
    setCostoUnitario(insumo.costo_unitario_kg ? String(insumo.costo_unitario_kg) : '0');
    setCantSinPorc('');
    setPorcUnd('');
    setPorcKg('');

    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleRemoveItem = async (detalleId: string) => {
    if (!confirm('¿Deseas eliminar este registro del conteo?')) return;
    try {
      await fetch(`/api/inventario/conteos/${params.id}?detalleId=${detalleId}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await fetch(`/api/inventario/conteos/${params.id}/aplicar`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setShowApplyModal(false);
        loadData();
      } else {
        alert(data.error || 'Error al aplicar el conteo.');
      }
    } catch (e: any) {
      alert(e.message || 'Error de conexión');
    } finally {
      setApplying(false);
    }
  };

  // Preparar lista de auditoría completa (cruzar todo el catálogo con lo contado)
  const auditFullList = useMemo(() => {
    const rows: any[] = [];
    const cleanQ = normalizeStr(auditSearch);

    insumosList.forEach((insumo) => {
      const name = normalizeStr(insumo.insumo);
      const cat = normalizeStr(insumo.categoria);

      if (cleanQ && !name.includes(cleanQ) && !cat.includes(cleanQ)) {
        return;
      }

      const isUnit = isUnidadOnly(insumo.insumo, insumo.unidad_medida, insumo.categoria);
      const unitCost = insumo.costo_unitario_kg || 0;

      // Evaluamos para Bodega
      if (auditFilterUbicacion === 'ALL' || auditFilterUbicacion === 'BODEGA') {
        const keyB = `${insumo.insumo_id}_BODEGA`;
        const detB = detallesMap.get(keyB);
        const isCountedB = !!detB;

        if (auditFilterStatus === 'ALL' || (auditFilterStatus === 'CONTADOS' && isCountedB) || (auditFilterStatus === 'SIN_CONTAR' && !isCountedB)) {
          const sisKg = (insumo.bodega_sin_porc_kg || 0) + (insumo.bodega_porc_kg || 0);
          const sisUnd = insumo.bodega_porc_und || 0;

          const conKg = isCountedB ? (parseFloat(detB.cant_sin_porcionar_kg || 0) + parseFloat(detB.peso_porciones_kg || 0)) : null;
          const conUnd = isCountedB ? parseInt(detB.porciones_und || 0) : null;

          const diffKg = isCountedB ? (conKg! - sisKg) : null;
          const diffUnd = isCountedB ? (conUnd! - sisUnd) : null;
          const diffCost = isCountedB ? Math.round((diffKg || 0) * unitCost) : null;

          rows.push({
            insumo,
            ubicacion: 'BODEGA',
            isUnit,
            isCounted: isCountedB,
            detalleId: detB?.id,
            sisKg,
            sisUnd,
            conKg,
            conUnd,
            diffKg,
            diffUnd,
            diffCost,
            unitCost
          });
        }
      }

      // Evaluamos para Cocina
      if (auditFilterUbicacion === 'ALL' || auditFilterUbicacion === 'COCINA') {
        const keyC = `${insumo.insumo_id}_COCINA`;
        const detC = detallesMap.get(keyC);
        const isCountedC = !!detC;

        if (auditFilterStatus === 'ALL' || (auditFilterStatus === 'CONTADOS' && isCountedC) || (auditFilterStatus === 'SIN_CONTAR' && !isCountedC)) {
          const sisKg = (insumo.cocina_sin_porc_kg || 0) + (insumo.cocina_porc_kg || 0);
          const sisUnd = insumo.cocina_porc_und || 0;

          const conKg = isCountedC ? (parseFloat(detC.cant_sin_porcionar_kg || 0) + parseFloat(detC.peso_porciones_kg || 0)) : null;
          const conUnd = isCountedC ? parseInt(detC.porciones_und || 0) : null;

          const diffKg = isCountedC ? (conKg! - sisKg) : null;
          const diffUnd = isCountedC ? (conUnd! - sisUnd) : null;
          const diffCost = isCountedC ? Math.round((diffKg || 0) * unitCost) : null;

          rows.push({
            insumo,
            ubicacion: 'COCINA',
            isUnit,
            isCounted: isCountedC,
            detalleId: detC?.id,
            sisKg,
            sisUnd,
            conKg,
            conUnd,
            diffKg,
            diffUnd,
            diffCost,
            unitCost
          });
        }
      }
    });

    return rows;
  }, [insumosList, detallesMap, auditSearch, auditFilterUbicacion, auditFilterStatus]);

  const auditStats = useMemo(() => {
    let contados = 0;
    let sinContar = 0;
    let totalDiferenciaPesos = 0;

    auditFullList.forEach((r) => {
      if (r.isCounted) {
        contados++;
        totalDiferenciaPesos += (r.diffCost || 0);
      } else {
        sinContar++;
      }
    });

    return { contados, sinContar, totalDiferenciaPesos };
  }, [auditFullList]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-slate-400 font-normal">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        <p className="text-xs">Cargando Auditoría de Conteo Físico...</p>
      </div>
    );
  }

  if (!conteo) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 font-normal">
        Sesión de conteo no encontrada.
      </div>
    );
  }

  const isAplicado = conteo.estado === 'APLICADO';

  return (
    <div className="w-full space-y-6 animate-fade-in font-normal text-slate-800">
      {/* Barra de navegación superior */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <button 
          type="button"
          onClick={() => router.push('/inventario/conteos')} 
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al historial de conteos
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Fecha: <strong className="text-slate-700">{conteo.fecha}</strong> • Creado por: <strong className="text-slate-700">{conteo.usuario}</strong>
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
            isAplicado 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            {conteo.estado}
          </span>
        </div>
      </div>

      {/* FORMULARIO ESTILO BODEGUERO (Captura rápida de insumo) */}
      {!isAplicado && (
        <form ref={formRef} onSubmit={handleAddItem} className="space-y-4 font-normal">
          <SmartSearchInsumo
            insumos={insumosList}
            selectedInsumo={selectedInsumo}
            onSelect={handleSelectInsumo}
            placeholder="Escribe para buscar carne o insumo a contar..."
            label="Buscar Carne / Insumo a Contar *"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Conteo</label>
              <input
                type="date"
                readOnly
                value={conteo.fecha}
                className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none text-slate-700 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ubicación *</label>
              <select
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value as any)}
                className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
              >
                <option value="BODEGA">BODEGA</option>
                <option value="COCINA">COCINA</option>
              </select>
            </div>

            {isItemUnd ? (
              <div className="lg:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cantidad Contada (Unidades) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={porcUnd}
                  onChange={(e) => setPorcUnd(e.target.value)}
                  placeholder="Ej. 12"
                  className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kg Sin Procesar</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={cantSinPorc}
                    onChange={(e) => setCantSinPorc(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unds Porcionadas</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={porcUnd}
                    onChange={(e) => setPorcUnd(e.target.value)}
                    placeholder="0"
                    className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Peso Porciones (Kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={porcKg}
                    onChange={(e) => setPorcKg(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
                  />
                </div>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">Costo / {isItemUnd ? 'Und' : 'Kg'}</label>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costoUnitario}
                onChange={(e) => setCostoUnitario(e.target.value)}
                placeholder="0"
                className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">Costo Total ($ COP)</label>
              </div>
              <input
                type="text"
                readOnly
                value={totalCostoCalculado ? `$ ${formatMoney(totalCostoCalculado)}` : '$ 0'}
                className="w-full h-9 px-2.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-800 bg-slate-50"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-400">
              <span className="font-semibold text-slate-500 uppercase">Impacto en Inventario:</span>{' '}
              {selectedInsumo ? (
                <span className="text-slate-600">
                  {selectedInsumo.insumo} en {ubicacion} • Costo base: ${formatMoney(selectedInsumo.costo_unitario_kg || 0)}
                </span>
              ) : (
                <span className="italic">Selecciona un insumo para previsualizar el conteo antes de guardar.</span>
              )}
            </div>

            <button
              type="submit"
              disabled={savingItem || !selectedInsumo}
              className="w-full sm:w-auto px-6 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-medium text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {savingItem ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Guardar Conteo</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Línea divisoria */}
      <div className="border-b border-slate-200" />

      {/* SECCIÓN INTERCONECTADA DE LOS 2 TABS */}
      <div className="space-y-4 font-normal">
        {/* Barra de Tabs Principal con botón de Aprobar Conteo */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('REGISTRADOS')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'REGISTRADOS'
                  ? 'border-blue-600 text-blue-900 bg-blue-50/60 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
              <span>Insumos Registrados en la Sesión</span>
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
                {detalles.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('AUDITORIA_COMPLETA')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'AUDITORIA_COMPLETA'
                  ? 'border-amber-600 text-amber-900 bg-amber-50/60 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-amber-600" />
              <span>Auditoría / Inventario Completo del Sistema</span>
              {auditStats.sinContar > 0 && (
                <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-medium" title="Insumos pendientes de contar">
                  {auditStats.sinContar} sin contar
                </span>
              )}
            </button>
          </div>

          {!isAplicado && detalles.length > 0 && (
            <button
              type="button"
              onClick={() => setShowApplyModal(true)}
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Aprobar y Aplicar Conteo a Inventario ({detalles.length})</span>
            </button>
          )}
        </div>

        {/* ----------------- CONTENIDO TAB 1: SOLO LO REGISTRADO ----------------- */}
        {activeTab === 'REGISTRADOS' && (
          <div className="space-y-3">
            {detalles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Aún no has registrado conteos en esta sesión. Usa el buscador de arriba o ve a la pestaña de <strong>Auditoría / Inventario Completo</strong> para registrar existencias.
              </div>
            ) : (
              <div className="space-y-2.5">
                {detalles.map((d) => {
                  const isUnit = isUnidadOnly(d.catalogo_insumos?.nombre, d.catalogo_insumos?.unidad_medida, d.catalogo_insumos?.categoria);
                  return (
                    <div 
                      key={d.id} 
                      className="bg-white border border-slate-200 rounded-xl p-3 hover:border-slate-300 transition-colors shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2 font-medium text-slate-800">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-semibold text-slate-900">{d.catalogo_insumos?.nombre || 'Insumo'}</span>
                          <span className="text-slate-400 font-normal">({d.ubicacion})</span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-medium">
                          {isUnit 
                            ? `${d.porciones_und || 0} und` 
                            : `${d.porciones_und || 0} und (${Number(d.peso_porciones_kg || 0).toFixed(2)} Kg) / Entero: ${Number(d.cant_sin_porcionar_kg || 0).toFixed(2)} Kg`}
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            d.ubicacion === 'BODEGA'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {d.ubicacion === 'BODEGA' ? 'CONTEO BODEGA' : 'CONTEO COCINA'}
                          </span>
                          <span className="text-slate-600 text-[11px]">
                            {isUnit
                              ? `${d.porciones_und} unidades contadas`
                              : `${Number(d.cant_sin_porcionar_kg).toFixed(3)} Kg sin procesar + ${d.porciones_und} unds (${Number(d.peso_porciones_kg).toFixed(3)} Kg)`}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-800 text-xs">
                            ${formatMoney(d.valor_total || 0)}
                          </span>
                          {!isAplicado && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(d.id)}
                              className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                              title="Eliminar del conteo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ----------------- CONTENIDO TAB 2: AUDITORÍA COMPLETA DEL CATÁLOGO ----------------- */}
        {activeTab === 'AUDITORIA_COMPLETA' && (
          <div className="space-y-3">
            {/* Filtros rápidos dentro de la auditoría */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Filtrar por corte o categoría..."
                  className="w-full h-8 pl-8 pr-2.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-blue-500 bg-slate-50 text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={auditFilterUbicacion}
                  onChange={(e) => setAuditFilterUbicacion(e.target.value as any)}
                  className="h-8 px-2 text-xs rounded-lg border border-slate-200 outline-none bg-white text-slate-700"
                >
                  <option value="ALL">Todas las Ubicaciones</option>
                  <option value="BODEGA">Solo Bodega</option>
                  <option value="COCINA">Solo Cocina</option>
                </select>

                <select
                  value={auditFilterStatus}
                  onChange={(e) => setAuditFilterStatus(e.target.value as any)}
                  className="h-8 px-2 text-xs rounded-lg border border-slate-200 outline-none bg-white text-slate-700"
                >
                  <option value="ALL">Todos los Estados ({auditFullList.length})</option>
                  <option value="CONTADOS">Solo Contados ({auditStats.contados})</option>
                  <option value="SIN_CONTAR">Solo Sin Contar ({auditStats.sinContar})</option>
                </select>
              </div>
            </div>

            {/* Tabla Maestra de Auditoría */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Insumo</th>
                      <th className="px-2.5 py-2.5">Ubicación</th>
                      <th className="px-2.5 py-2.5 text-right">Stock Sistema</th>
                      <th className="px-2.5 py-2.5 text-right">Conteo Físico</th>
                      <th className="px-2.5 py-2.5 text-right">Diferencia</th>
                      <th className="px-2.5 py-2.5 text-right">Impacto ($ COP)</th>
                      <th className="px-2.5 py-2.5 text-center">Estado</th>
                      {!isAplicado && <th className="px-3 py-2.5 text-right">Acción Rápida</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditFullList.map((row, idx) => {
                      const isPending = !row.isCounted;
                      const hasDiff = row.isCounted && (row.diffKg !== 0 || row.diffUnd !== 0);
                      const isZeroLoading = quickActionId === `${row.insumo.insumo_id}_${row.ubicacion}`;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-slate-800">
                            <span>{row.insumo.insumo}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">{row.insumo.categoria}</span>
                          </td>

                          <td className="px-2.5 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              row.ubicacion === 'BODEGA' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {row.ubicacion}
                            </span>
                          </td>

                          <td className="px-2.5 py-2.5 text-right font-medium text-slate-700 tabular-nums">
                            {row.isUnit ? `${row.sisUnd} und` : `${Number(row.sisKg).toFixed(2)} Kg (${row.sisUnd} u)`}
                          </td>

                          <td className="px-2.5 py-2.5 text-right font-medium tabular-nums">
                            {row.isCounted ? (
                              <span className="text-slate-900 font-semibold">
                                {row.isUnit ? `${row.conUnd} und` : `${Number(row.conKg).toFixed(2)} Kg (${row.conUnd} u)`}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </td>

                          <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums">
                            {row.isCounted ? (
                              <span className={!hasDiff ? 'text-slate-400' : row.diffKg > 0 || row.diffUnd > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                {row.isUnit
                                  ? (row.diffUnd > 0 ? `+${row.diffUnd}` : `${row.diffUnd}`) + ' und'
                                  : (row.diffKg > 0 ? `+${Number(row.diffKg).toFixed(2)}` : `${Number(row.diffKg).toFixed(2)}`) + ' Kg'}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="px-2.5 py-2.5 text-right font-medium tabular-nums">
                            {row.isCounted ? (
                              <span className={!hasDiff ? 'text-slate-400' : row.diffCost > 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                                {row.diffCost > 0 ? `+$ ${formatMoney(row.diffCost)}` : row.diffCost < 0 ? `-$ ${formatMoney(Math.abs(row.diffCost))}` : '$ 0'}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="px-2.5 py-2.5 text-center">
                            {row.isCounted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Contado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Sin Contar
                              </span>
                            )}
                          </td>

                          {!isAplicado && (
                            <td className="px-3 py-2.5 text-right">
                              {isPending ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleLoadInsumoToForm(row.insumo, row.ubicacion)}
                                    className="px-2 py-1 text-[11px] font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                  >
                                    Contar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isZeroLoading}
                                    onClick={() => handleQuickZero(row.insumo, row.ubicacion)}
                                    className="px-2 py-1 text-[11px] font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                    title="Poner en 0 si está físicamente agotado"
                                  >
                                    {isZeroLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Poner en 0'}
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleLoadInsumoToForm(row.insumo, row.ubicacion)}
                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                    title="Editar conteo"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(row.detalleId)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                    title="Descartar este conteo"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Aplicación */}
      <Modal 
        isOpen={showApplyModal} 
        onClose={() => setShowApplyModal(false)} 
        title="Confirmar Aplicación de Auditoría a Inventario" 
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 font-normal text-slate-800">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Punto de Corte de Inventario:</strong> Al aplicar esta sesión, las existencias teóricas del sistema para los <strong>{detalles.length}</strong> insumos registrados se actualizarán para ser exactamente iguales a lo contado físicamente. Se crearán movimientos de auditoría <em>AJUSTE_INVENTARIO</em> por las diferencias.
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total Insumos Contados en la Sesión:</span>
              <strong className="text-slate-900">{detalles.length} insumos</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Insumos que quedarán Sin Modificar:</span>
              <span className="text-slate-700 font-medium">{auditStats.sinContar} insumos</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="font-medium text-slate-700">Impacto Neto en Costo:</span>
              <strong className={`tabular-nums ${auditStats.totalDiferenciaPesos >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {auditStats.totalDiferenciaPesos >= 0 ? `+$ ${formatMoney(auditStats.totalDiferenciaPesos)}` : `-$ ${formatMoney(Math.abs(auditStats.totalDiferenciaPesos))}`}
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowApplyModal(false)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancelar y Seguir Auditando
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Confirmar y Aplicar Inventario
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
