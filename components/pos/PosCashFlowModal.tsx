'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Plus, Printer, Receipt, Search, X } from 'lucide-react';
import {
  printReciboCaja,
  type ReciboCajaTicketData,
} from '@/lib/posHardwareBridge';
import { posFetch } from '@/lib/posApiClient';

export type SalidaClasificacion =
  | 'Gasto Operativo'
  | 'Costo / Insumo'
  | 'Turno / Nómina'
  | 'Préstamo / Anticipo';

export interface InsumoCatalogItem {
  id: string;
  codigo?: string | null;
  nombre: string;
  categoria: string;
  unidad_medida?: string | null;
  costo_unitario_kg?: number | null;
}

export interface EmpleadoPosItem {
  id: string;
  nombre_cajero: string;
  username: string;
  cargo_area?: string | null;
}

interface PosCashFlowModalProps {
  mode: 'ENTRADA' | 'SALIDA';
  sesionId: string | null;
  busyAction: boolean;
  executePosAction: (action: string, payload: Record<string, unknown>) => Promise<any>;
  onCompleted: () => Promise<void>;
  onClose: () => void;
  notify: (type: 'ok' | 'err', text: string) => void;
}

const CLASIFICACIONES: Array<{ id: SalidaClasificacion; label: string; sub: string }> = [
  { id: 'Gasto Operativo', label: 'Gasto Operativo', sub: 'Servicios, Arriendo, Varios' },
  { id: 'Costo / Insumo', label: 'Costo / Insumo', sub: 'Compra de insumos' },
  { id: 'Turno / Nómina', label: 'Turno / Nómina', sub: 'Pago a personal' },
  { id: 'Préstamo / Anticipo', label: 'Préstamo / Anticipo', sub: 'Soporte empleado (no P&G)' },
];

const CATEGORIAS_GASTO_DEFAULT = [
  'Servicios Públicos',
  'Arrendamiento',
  'Adecuaciones y Mantenimiento',
  'Transportes y Domicilios',
  'Hielo y Gas',
  'Aseo y Cafetería',
  'Papelería y Empaques',
  'Varios / Otro',
];

const UNIDADES_INSUMO = ['Kg', 'Und', 'Lt', 'Lb', 'Paq', 'Bulto', 'Gr'];
const CATEGORIAS_INSUMO_RAPIDO = [
  'INSUMOS VARIOS',
  'CARNE DE RES',
  'VERDURAS Y FRUTAS',
  'ABARROTES',
  'BEBIDAS',
];

const cop = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

export default function PosCashFlowModal({
  mode,
  sesionId,
  busyAction,
  executePosAction,
  onCompleted,
  onClose,
  notify,
}: PosCashFlowModalProps) {
  const [clasif, setClasif] = useState<SalidaClasificacion>('Gasto Operativo');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [beneficiario, setBeneficiario] = useState('');

  // Catálogos para F8
  const [insumos, setInsumos] = useState<InsumoCatalogItem[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoPosItem[]>([]);
  const [conceptosRecientes, setConceptosRecientes] = useState<string[]>([]);
  const [categoriasExtra, setCategoriasExtra] = useState<string[]>([]);

  // Gasto Operativo
  const [categoriaGasto, setCategoriaGasto] = useState('Servicios Públicos');
  const [nuevaCatGasto, setNuevaCatGasto] = useState('');
  const [showNuevaCatGasto, setShowNuevaCatGasto] = useState(false);

  // Costo / Insumo
  const [insumoQuery, setInsumoQuery] = useState('');
  const [selectedInsumo, setSelectedInsumo] = useState<InsumoCatalogItem | null>(null);
  const [showInsumoDrop, setShowInsumoDrop] = useState(false);
  const [insumoHighlight, setInsumoHighlight] = useState(0);
  const [unidadMedida, setUnidadMedida] = useState('Kg');
  const [cantidadInsumo, setCantidadInsumo] = useState('1');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickUnidad, setQuickUnidad] = useState('Und');
  const [quickCategoria, setQuickCategoria] = useState('INSUMOS VARIOS');
  const [creatingInsumo, setCreatingInsumo] = useState(false);

  // Turno / Préstamo empleado autocomplete
  const [showEmpDrop, setShowEmpDrop] = useState(false);
  const [empHighlight, setEmpHighlight] = useState(0);

  // Recibo generado post-registro
  const [reciboGenerado, setReciboGenerado] = useState<ReciboCajaTicketData | null>(null);
  const [postActionFocus, setPostActionFocus] = useState<'PRINT' | 'CLOSE'>('PRINT');
  const [printStatusMsg, setPrintStatusMsg] = useState<string | null>(null);

  // Refs para avance rápido con Enter
  const montoRef = useRef<HTMLInputElement | null>(null);
  const conceptoRef = useRef<HTMLInputElement | null>(null);
  const beneficiarioRef = useRef<HTMLInputElement | null>(null);
  const insumoInputRef = useRef<HTMLInputElement | null>(null);
  const cantidadRef = useRef<HTMLInputElement | null>(null);
  const printBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const clasifRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const catBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (mode !== 'SALIDA') return;
    let active = true;
    posFetch('/api/pos?scope=salidas_catalog', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!active || !d?.success) return;
        setInsumos(d.insumos || []);
        setEmpleados(d.empleados || []);
        setConceptosRecientes(d.conceptosGastoRecientes || []);
        setCategoriasExtra(d.categoriasGastoRecientes || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mode]);

  const categoriasGasto = useMemo(() => {
    const set = new Set<string>([...CATEGORIAS_GASTO_DEFAULT, ...categoriasExtra]);
    return Array.from(set);
  }, [categoriasExtra]);

  const insumosFiltrados = useMemo(() => {
    const q = insumoQuery.trim().toLowerCase();
    if (!q) return insumos.slice(0, 12);
    return insumos
      .filter(
        (i) =>
          i.nombre.toLowerCase().includes(q) ||
          (i.codigo || '').toLowerCase().includes(q) ||
          (i.categoria || '').toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [insumos, insumoQuery]);

  const exactInsumoExists = useMemo(() => {
    const q = insumoQuery.trim().toLowerCase();
    if (!q) return true;
    return insumos.some((i) => i.nombre.toLowerCase() === q);
  }, [insumos, insumoQuery]);

  const empleadosFiltrados = useMemo(() => {
    const q = beneficiario.trim().toLowerCase();
    if (!q) return empleados.slice(0, 10);
    return empleados
      .filter(
        (e) =>
          e.nombre_cajero.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [empleados, beneficiario]);

  useEffect(() => {
    if (reciboGenerado) {
      setPostActionFocus('PRINT');
      setTimeout(() => printBtnRef.current?.focus(), 40);
    }
  }, [reciboGenerado]);

  const selectClasificacion = (next: SalidaClasificacion) => {
    setClasif(next);
    setShowInsumoDrop(false);
    setShowEmpDrop(false);
    setQuickCreateOpen(false);
  };

  const handleSelectInsumo = (item: InsumoCatalogItem) => {
    setSelectedInsumo(item);
    setInsumoQuery(item.nombre);
    setConcepto(item.nombre);
    setUnidadMedida(item.unidad_medida || 'Und');
    setShowInsumoDrop(false);
    setQuickCreateOpen(false);
    setTimeout(() => cantidadRef.current?.focus(), 20);
  };

  const handleCrearInsumoRapido = async () => {
    const nombre = insumoQuery.trim();
    if (!nombre) return notify('err', 'Escribe el nombre del nuevo insumo.');
    setCreatingInsumo(true);
    try {
      const res = await executePosAction('CREAR_INSUMO_RAPIDO_POS', {
        nombre,
        unidad_medida: quickUnidad,
        categoria: quickCategoria,
      });
      if (res?.insumo) {
        const nuevo = res.insumo as InsumoCatalogItem;
        setInsumos((prev) =>
          prev.some((p) => p.id === nuevo.id) ? prev : [nuevo, ...prev]
        );
        handleSelectInsumo(nuevo);
        notify('ok', `Insumo "${nuevo.nombre}" creado y seleccionado.`);
      }
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error creando insumo rápido');
    } finally {
      setCreatingInsumo(false);
    }
  };

  const handleSubmit = async () => {
    const valor = Math.round(Number(monto || 0));
    if (!valor || valor <= 0) {
      montoRef.current?.focus();
      return notify('err', 'Ingresa un monto válido mayor a 0.');
    }

    if (mode === 'ENTRADA') {
      if (!concepto.trim()) {
        conceptoRef.current?.focus();
        return notify('err', 'Ingresa el concepto de la entrada.');
      }
      try {
        await executePosAction('MOVIMIENTO_EFECTIVO_CAJA', {
          tipo: 'ENTRADA',
          monto: valor,
          concepto: concepto.trim(),
          sesion_id: sesionId,
        });
        await onCompleted();
        notify('ok', `Entrada de ${cop(valor)} registrada.`);
        onClose();
      } catch (e: unknown) {
        notify('err', e instanceof Error ? e.message : 'Error registrando entrada');
      }
      return;
    }

    // Validaciones SALIDA (F8)
    let conceptoFinal = concepto.trim();
    const beneficiarioFinal = beneficiario.trim();
    let categoriaFinal = categoriaGasto;

    if (clasif === 'Turno / Nómina' || clasif === 'Préstamo / Anticipo') {
      if (!beneficiarioFinal) {
        beneficiarioRef.current?.focus();
        return notify('err', `Ingresa el nombre del empleado para ${clasif}.`);
      }
      if (!conceptoFinal) {
        conceptoRef.current?.focus();
        return notify('err', 'Ingresa la descripción del pago o anticipo.');
      }
      categoriaFinal =
        clasif === 'Préstamo / Anticipo' ? 'Anticipo / Préstamo Empleado' : 'Pago de Turno';
    } else if (clasif === 'Costo / Insumo') {
      const insNombre = (selectedInsumo?.nombre || insumoQuery).trim();
      if (!insNombre) {
        insumoInputRef.current?.focus();
        return notify('err', 'Busca o escribe el insumo comprado.');
      }
      const cant = Number(cantidadInsumo || 0);
      if (!cant || cant <= 0) {
        cantidadRef.current?.focus();
        return notify('err', 'Ingresa una cantidad mayor a 0.');
      }
      conceptoFinal = insNombre;
      categoriaFinal = selectedInsumo?.categoria || 'Compra Insumo POS';
    } else {
      if (!conceptoFinal) {
        conceptoRef.current?.focus();
        return notify('err', 'Ingresa la descripción o concepto del gasto.');
      }
    }

    try {
      const res = await executePosAction('MOVIMIENTO_EFECTIVO_CAJA', {
        tipo: 'SALIDA',
        monto: valor,
        concepto: conceptoFinal,
        clasificacion: clasif,
        categoria: categoriaFinal,
        descripcion_beneficiario: beneficiarioFinal,
        insumo_id: clasif === 'Costo / Insumo' ? selectedInsumo?.id || null : null,
        cantidad: clasif === 'Costo / Insumo' ? Number(cantidadInsumo || 1) : null,
        unidad_medida: clasif === 'Costo / Insumo' ? unidadMedida : null,
        sesion_id: sesionId,
      });

      await onCompleted();

      if (res?.recibo) {
        setReciboGenerado(res.recibo as ReciboCajaTicketData);
        notify('ok', `Salida registrada con Recibo ${res.recibo.consecutivo}`);
      } else {
        notify('ok', `Salida de ${cop(valor)} registrada.`);
        onClose();
      }
    } catch (e: unknown) {
      notify('err', e instanceof Error ? e.message : 'Error registrando salida');
    }
  };

  const handlePrintRecibo = async () => {
    if (!reciboGenerado) return;
    const res = await printReciboCaja(reciboGenerado);
    if (res.ok) {
      setPrintStatusMsg(`Recibo ${reciboGenerado.consecutivo} enviado a impresora.`);
    } else {
      setPrintStatusMsg(`Error imprimiendo: ${res.error || 'Verifica la impresora'}`);
    }
  };

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (showInsumoDrop) {
        setShowInsumoDrop(false);
        return;
      }
      if (showEmpDrop) {
        setShowEmpDrop(false);
        return;
      }
      onClose();
      return;
    }

    if (reciboGenerado) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = postActionFocus === 'PRINT' ? 'CLOSE' : 'PRINT';
        setPostActionFocus(next);
        if (next === 'PRINT') printBtnRef.current?.focus();
        else closeBtnRef.current?.focus();
      }
    }
  };

  const costoUnitarioAprox = useMemo(() => {
    const c = Number(cantidadInsumo || 0);
    const m = Number(monto || 0);
    if (c > 0 && m > 0) return Math.round(m / c);
    return 0;
  }, [cantidadInsumo, monto]);

  return (
    <div
      onKeyDown={handleModalKeyDown}
      className="fixed inset-0 z-[10000] bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl border border-zinc-300 max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-zinc-800" />
            <h3 className="font-bold text-base text-zinc-900">
              {reciboGenerado
                ? `Recibo de Caja Generado — ${reciboGenerado.consecutivo}`
                : mode === 'ENTRADA'
                  ? 'F7 — Entrada de Efectivo'
                  : 'F8 — Salida con Recibo de Caja'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VISTA POST-REGISTRO: RECIBO DE CAJA GENERADO */}
        {reciboGenerado ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-emerald-900">
                <div className="font-bold text-sm">
                  Soporte único asignado: {reciboGenerado.consecutivo}
                </div>
                <div>
                  Clasificación: <strong>{reciboGenerado.clasificacion}</strong> · Valor:{' '}
                  <strong>{cop(reciboGenerado.valor)}</strong>
                </div>
                {reciboGenerado.beneficiario && (
                  <div>
                    Beneficiario / Empleado: <strong>{reciboGenerado.beneficiario}</strong>
                  </div>
                )}
                <div>Concepto: {reciboGenerado.concepto}</div>
              </div>
            </div>

            {printStatusMsg && (
              <div className="text-xs font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2">
                {printStatusMsg}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                ref={printBtnRef}
                type="button"
                onClick={handlePrintRecibo}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs cursor-pointer transition ${
                  postActionFocus === 'PRINT'
                    ? 'bg-zinc-900 text-white ring-2 ring-blue-500'
                    : 'bg-zinc-800 text-white hover:bg-zinc-900'
                }`}
              >
                <Printer className="w-4 h-4" />
                Imprimir Recibo de Caja (Enter)
              </button>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                className={`px-5 py-3 rounded-xl border font-bold text-xs cursor-pointer transition ${
                  postActionFocus === 'CLOSE'
                    ? 'border-zinc-900 bg-zinc-100 text-zinc-900 ring-2 ring-blue-500'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                Cerrar (Esc)
              </button>
            </div>
          </div>
        ) : (
          /* VISTA FORMULARIO */
          <div className="space-y-3.5">
            {mode === 'SALIDA' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600">
                  <span>Clasificación de la Salida (usa ← / → para cambiar):</span>
                  <span className="text-zinc-400 font-normal">Genera RC automático</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CLASIFICACIONES.map((opt, idx) => {
                    const active = clasif === opt.id;
                    return (
                      <button
                        key={opt.id}
                        ref={(el) => {
                          clasifRefs.current[idx] = el;
                        }}
                        type="button"
                        onClick={() => selectClasificacion(opt.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowRight') {
                            e.preventDefault();
                            const nextIdx = (idx + 1) % CLASIFICACIONES.length;
                            selectClasificacion(CLASIFICACIONES[nextIdx].id);
                            clasifRefs.current[nextIdx]?.focus();
                          } else if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            const prevIdx =
                              (idx - 1 + CLASIFICACIONES.length) % CLASIFICACIONES.length;
                            selectClasificacion(CLASIFICACIONES[prevIdx].id);
                            clasifRefs.current[prevIdx]?.focus();
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (opt.id === 'Costo / Insumo') insumoInputRef.current?.focus();
                            else if (
                              opt.id === 'Turno / Nómina' ||
                              opt.id === 'Préstamo / Anticipo'
                            )
                              beneficiarioRef.current?.focus();
                            else conceptoRef.current?.focus();
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          active
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-zinc-50 text-zinc-800 border-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="font-bold text-xs">{opt.label}</div>
                        <div
                          className={`text-[10px] mt-0.5 leading-tight ${
                            active ? 'text-zinc-300' : 'text-zinc-500'
                          }`}
                        >
                          {opt.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BLOQUE ESPECÍFICO 1: GASTO OPERATIVO */}
            {mode === 'SALIDA' && clasif === 'Gasto Operativo' && (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-600">
                      Categoría del Gasto (← / →):
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNuevaCatGasto((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Nueva categoría
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {categoriasGasto.map((cat, idx) => {
                      const active = categoriaGasto === cat;
                      return (
                        <button
                          key={cat}
                          ref={(el) => {
                            catBtnRefs.current[idx] = el;
                          }}
                          type="button"
                          onClick={() => setCategoriaGasto(cat)}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowRight') {
                              e.preventDefault();
                              const next = (idx + 1) % categoriasGasto.length;
                              setCategoriaGasto(categoriasGasto[next]);
                              catBtnRefs.current[next]?.focus();
                            } else if (e.key === 'ArrowLeft') {
                              e.preventDefault();
                              const prev =
                                (idx - 1 + categoriasGasto.length) % categoriasGasto.length;
                              setCategoriaGasto(categoriasGasto[prev]);
                              catBtnRefs.current[prev]?.focus();
                            } else if (e.key === 'Enter' || e.key === 'ArrowDown') {
                              e.preventDefault();
                              conceptoRef.current?.focus();
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition ${
                            active
                              ? 'bg-zinc-900 text-white border-zinc-900'
                              : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  {showNuevaCatGasto && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={nuevaCatGasto}
                        onChange={(e) => setNuevaCatGasto(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && nuevaCatGasto.trim()) {
                            e.preventDefault();
                            const clean = nuevaCatGasto.trim();
                            setCategoriasExtra((prev) =>
                              prev.includes(clean) ? prev : [...prev, clean]
                            );
                            setCategoriaGasto(clean);
                            setNuevaCatGasto('');
                            setShowNuevaCatGasto(false);
                            conceptoRef.current?.focus();
                          }
                        }}
                        placeholder="Escribe nueva categoría y presiona Enter..."
                        className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg text-xs"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <input
                    ref={conceptoRef}
                    autoFocus
                    type="text"
                    list="pos-conceptos-gasto"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        montoRef.current?.focus();
                      }
                    }}
                    placeholder="Descripción / Concepto del gasto (ej. Recibo agua, bolsa hielo)"
                    className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm"
                  />
                  <datalist id="pos-conceptos-gasto">
                    {conceptosRecientes.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <input
                  ref={beneficiarioRef}
                  type="text"
                  value={beneficiario}
                  onChange={(e) => setBeneficiario(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      montoRef.current?.focus();
                    }
                  }}
                  placeholder="Beneficiario / Proveedor (opcional)"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs"
                />
              </div>
            )}

            {/* BLOQUE ESPECÍFICO 2: COSTO / INSUMO */}
            {mode === 'SALIDA' && clasif === 'Costo / Insumo' && (
              <div className="space-y-2.5">
                <div className="relative">
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                    <input
                      ref={insumoInputRef}
                      autoFocus
                      type="text"
                      value={insumoQuery}
                      onFocus={() => setShowInsumoDrop(true)}
                      onChange={(e) => {
                        setInsumoQuery(e.target.value);
                        setSelectedInsumo(null);
                        setShowInsumoDrop(true);
                        setInsumoHighlight(0);
                      }}
                      onKeyDown={(e) => {
                        const totalOpts =
                          insumosFiltrados.length +
                          (!exactInsumoExists && insumoQuery.trim() ? 1 : 0);
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setShowInsumoDrop(true);
                          if (totalOpts > 0) {
                            setInsumoHighlight((h) => (h + 1) % totalOpts);
                          }
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (totalOpts > 0) {
                            setInsumoHighlight((h) => (h - 1 + totalOpts) % totalOpts);
                          }
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (showInsumoDrop && totalOpts > 0) {
                            if (insumoHighlight < insumosFiltrados.length) {
                              handleSelectInsumo(insumosFiltrados[insumoHighlight]);
                            } else {
                              setShowInsumoDrop(false);
                              setQuickCreateOpen(true);
                            }
                          } else {
                            cantidadRef.current?.focus();
                          }
                        }
                      }}
                      placeholder="Buscar insumo existente o escribir uno nuevo..."
                      className="w-full pl-9 pr-3 py-2.5 border border-zinc-300 rounded-xl text-sm font-medium"
                    />
                  </div>

                  {showInsumoDrop && (insumosFiltrados.length > 0 || (!exactInsumoExists && insumoQuery.trim())) && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-300 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-zinc-100">
                      {insumosFiltrados.map((ins, idx) => (
                        <button
                          key={ins.id}
                          type="button"
                          onClick={() => handleSelectInsumo(ins)}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between cursor-pointer ${
                            insumoHighlight === idx ? 'bg-blue-50 text-blue-900' : 'hover:bg-zinc-50'
                          }`}
                        >
                          <div>
                            <span className="font-bold">{ins.nombre}</span>
                            <span className="ml-2 text-[10px] text-zinc-500">{ins.categoria}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-zinc-100 text-[10px] font-semibold text-zinc-700">
                            {ins.unidad_medida || 'Und'}
                          </span>
                        </button>
                      ))}
                      {!exactInsumoExists && insumoQuery.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowInsumoDrop(false);
                            setQuickCreateOpen(true);
                          }}
                          className={`w-full px-3 py-2.5 text-left text-xs font-bold flex items-center gap-2 cursor-pointer ${
                            insumoHighlight === insumosFiltrados.length
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          Crear insumo rápido: &ldquo;{insumoQuery.trim()}&rdquo;
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Mini creación rápida de insumo inline */}
                {quickCreateOpen && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <div className="text-[11px] font-bold text-emerald-900">
                      Crear insumo rápido en catálogo: &ldquo;{insumoQuery.trim()}&rdquo;
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={quickUnidad}
                        onChange={(e) => setQuickUnidad(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-semibold"
                      >
                        {UNIDADES_INSUMO.map((u) => (
                          <option key={u} value={u}>
                            Unidad: {u}
                          </option>
                        ))}
                      </select>
                      <select
                        value={quickCategoria}
                        onChange={(e) => setQuickCategoria(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-semibold"
                      >
                        {CATEGORIAS_INSUMO_RAPIDO.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={creatingInsumo}
                        onClick={handleCrearInsumoRapido}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                      >
                        {creatingInsumo ? 'Creando...' : 'Guardar y Usar'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1">
                      Unidad Medida
                    </label>
                    <select
                      value={unidadMedida}
                      onChange={(e) => setUnidadMedida(e.target.value)}
                      className="w-full px-2.5 py-2 border border-zinc-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      {UNIDADES_INSUMO.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1">
                      Cantidad
                    </label>
                    <input
                      ref={cantidadRef}
                      type="number"
                      step="0.01"
                      value={cantidadInsumo}
                      onChange={(e) => setCantidadInsumo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          montoRef.current?.focus();
                        }
                      }}
                      placeholder="Ej: 5"
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1">
                      Costo Total ($)
                    </label>
                    <input
                      ref={montoRef}
                      type="number"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSubmit();
                        }
                      }}
                      placeholder="$ Total"
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-bold"
                    />
                  </div>
                </div>

                {costoUnitarioAprox > 0 && (
                  <div className="text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5">
                    Costo unitario calculado:{' '}
                    <strong>
                      {cop(costoUnitarioAprox)} / {unidadMedida}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* BLOQUE ESPECÍFICO 3 y 4: TURNO / NÓMINA y PRÉSTAMO / ANTICIPO */}
            {mode === 'SALIDA' &&
              (clasif === 'Turno / Nómina' || clasif === 'Préstamo / Anticipo') && (
                <div className="space-y-2.5">
                  {clasif === 'Préstamo / Anticipo' && (
                    <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
                      Genera Recibo de Caja soporte (RC) sin contaminar gastos ni el P&G del restaurante.
                    </div>
                  )}

                  <div className="relative">
                    <input
                      ref={beneficiarioRef}
                      autoFocus
                      type="text"
                      value={beneficiario}
                      onFocus={() => setShowEmpDrop(true)}
                      onChange={(e) => {
                        setBeneficiario(e.target.value);
                        setShowEmpDrop(true);
                        setEmpHighlight(0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown' && empleadosFiltrados.length > 0) {
                          e.preventDefault();
                          setShowEmpDrop(true);
                          setEmpHighlight((h) => (h + 1) % empleadosFiltrados.length);
                        } else if (e.key === 'ArrowUp' && empleadosFiltrados.length > 0) {
                          e.preventDefault();
                          setEmpHighlight(
                            (h) => (h - 1 + empleadosFiltrados.length) % empleadosFiltrados.length
                          );
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (showEmpDrop && empleadosFiltrados[empHighlight]) {
                            setBeneficiario(empleadosFiltrados[empHighlight].nombre_cajero);
                            setShowEmpDrop(false);
                          }
                          conceptoRef.current?.focus();
                        }
                      }}
                      placeholder="Nombre del empleado (↑/↓ para elegir o escribe uno nuevo)"
                      className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm font-medium"
                    />
                    {showEmpDrop && empleadosFiltrados.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-300 rounded-xl shadow-xl max-h-40 overflow-y-auto divide-y divide-zinc-100">
                        {empleadosFiltrados.map((emp, idx) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setBeneficiario(emp.nombre_cajero);
                              setShowEmpDrop(false);
                              conceptoRef.current?.focus();
                            }}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between cursor-pointer ${
                              empHighlight === idx ? 'bg-blue-50 text-blue-900' : 'hover:bg-zinc-50'
                            }`}
                          >
                            <span className="font-bold">{emp.nombre_cajero}</span>
                            <span className="text-[10px] text-zinc-500">{emp.cargo_area || emp.username}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    ref={conceptoRef}
                    type="text"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        montoRef.current?.focus();
                      }
                    }}
                    placeholder={
                      clasif === 'Turno / Nómina'
                        ? 'Descripción del pago de turno (ej. Turno sábado parrilla)'
                        : 'Descripción / motivo del préstamo o anticipo'
                    }
                    className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm"
                  />
                </div>
              )}

            {/* MONTO PARA MODOS DISTINTOS A COSTO/INSUMO (ya lo tiene en su fila) */}
            {(mode === 'ENTRADA' || clasif !== 'Costo / Insumo') && (
              <>
                {mode === 'ENTRADA' && (
                  <input
                    ref={conceptoRef}
                    autoFocus
                    type="text"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        montoRef.current?.focus();
                      }
                    }}
                    placeholder="Concepto de la entrada de efectivo"
                    className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm"
                  />
                )}
                <input
                  ref={montoRef}
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="Monto ($ COP)"
                  className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-base font-bold"
                />
              </>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busyAction}
              className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white font-bold text-xs cursor-pointer"
            >
              {busyAction
                ? 'Registrando...'
                : mode === 'ENTRADA'
                  ? 'Registrar Entrada (Enter)'
                  : 'Registrar Salida y Generar Recibo RC (Enter)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
