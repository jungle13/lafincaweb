'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Loader2, 
  X,
  AlertCircle
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { usePeriodo, Periodo } from '@/context/PeriodoContext';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface PeriodoWithStats extends Periodo {
  stats?: {
    compras_total: number;
    compras_facturas: number;
    ventas_total: number;
    ventas_dias: number;
    consolidado_total: number;
  };
}

export default function PeriodosPage() {
  const { refreshPeriodos } = usePeriodo();
  const [periodosList, setPeriodosList] = useState<PeriodoWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Fields para Nuevo Período
  const currentYear = new Date().getFullYear();
  const [formYear, setFormYear] = useState<number>(currentYear);
  const [formMonth, setFormMonth] = useState<number>(() => {
    const nextM = new Date().getMonth() + 2;
    return nextM > 12 ? 1 : nextM;
  });
  const [formObservaciones, setFormObservaciones] = useState('');

  // Portaling SSR safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cargar Períodos desde la API
  const loadPeriodos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/periodos?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.periodos)) {
        setPeriodosList(data.periodos);
      }
    } catch (err) {
      console.error('Error cargando períodos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriodos();
  }, [loadPeriodos]);

  // Manejar Escape para cerrar modal
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsModalOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isModalOpen]);

  // Previsualización dinámica del nuevo período a crear
  const previewData = useMemo(() => {
    const monthStr = String(formMonth).padStart(2, '0');
    const codigo = `${formYear}-${monthStr}`;
    const nombre = `${MONTH_NAMES[formMonth - 1]} ${formYear}`;
    return { codigo, nombre };
  }, [formYear, formMonth]);

  // Crear Período
  const handleCreatePeriodo = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setCreating(true);

    try {
      const res = await fetch('/api/periodos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: previewData.codigo,
          nombre: previewData.nombre,
          estado: 'ABIERTO',
          observaciones: formObservaciones.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo crear el período contable.');
      }

      setIsModalOpen(false);
      setFormObservaciones('');
      await loadPeriodos();
      await refreshPeriodos();
    } catch (err: any) {
      setModalError(err.message || 'Error en la solicitud.');
    } finally {
      setCreating(false);
    }
  };

  // Alternar Estado de un Período (Cerrar Mes / Reabrir Mes)
  const handleToggleEstado = async (p: PeriodoWithStats, nuevoEstado: 'ABIERTO' | 'CERRADO') => {
    const confirmMsg = nuevoEstado === 'CERRADO'
      ? `¿Estás seguro de cerrar el período "${p.nombre}"? Se inhabilitarán las funciones de crear, editar y borrar en todos los módulos para este mes (solo lectura y exportación).`
      : `¿Deseas reabrir el período "${p.nombre}"? Se volverán a habilitar las funciones de crear, editar y borrar en todos los módulos para este mes.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/periodos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: p.id,
          estado: nuevoEstado,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo actualizar el estado del período.');
      }

      await loadPeriodos();
      await refreshPeriodos();
    } catch (err: any) {
      alert(err.message || 'Error actualizando período');
    }
  };

  // Filtrado por barra de búsqueda
  const filteredPeriodos = useMemo(() => {
    if (!searchQuery.trim()) return periodosList;
    const q = searchQuery.toLowerCase().trim();
    return periodosList.filter(p => {
      return p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
    });
  }, [periodosList, searchQuery]);

  return (
    <div className="w-full max-w-5xl mx-auto py-2 sm:py-4 px-2 sm:px-4 font-normal">
      {/* 🏷️ Encabezado idéntico a la vista de referencia */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Hojas de Períodos Contables
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Listado de meses operativos ordenados desde el más reciente.
          </p>
        </div>

        {/* Botón Naranja Superior "+ Nuevo Período" */}
        <button
          type="button"
          onClick={() => {
            setModalError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Período</span>
        </button>
      </div>

      {/* 🔍 Buscador idéntico al de referencia */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por mes o año..."
          className="w-full pl-9 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400 transition-colors shadow-2xs"
        />
      </div>

      {/* Subtítulo de Conteo */}
      <p className="text-xs text-slate-400 mb-3 font-normal">
        {filteredPeriodos.length} {filteredPeriodos.length === 1 ? 'mes registrado' : 'meses registrados'}
      </p>

      {/* 📋 Listado de Tarjetas */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Cargando períodos...</p>
        </div>
      ) : filteredPeriodos.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
          No se encontraron períodos registrados.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredPeriodos.map((p) => {
            const comprasTot = p.stats?.compras_total || 0;
            const ventasTot = p.stats?.ventas_total || 0;
            const consolidadoTot = p.stats?.consolidado_total || 0;
            const isAbierto = p.estado === 'ABIERTO';

            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex items-center justify-between gap-4 transition-all shadow-2xs"
              >
                {/* Lado Izquierdo: Ícono + Título + Estadísticas en una sola línea */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-500 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 truncate">
                      {p.nombre} - Período Contable
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 font-normal truncate">
                      Compras: ${comprasTot.toLocaleString('es-CO')} COP • Ventas: ${ventasTot.toLocaleString('es-CO')} COP • Consolidado: ${consolidadoTot.toLocaleString('es-CO')} COP
                    </p>
                  </div>
                </div>

                {/* Lado Derecho: Únicamente el botón Cerrar Mes / Reabrir Mes */}
                <div className="shrink-0">
                  {isAbierto ? (
                    <button
                      type="button"
                      onClick={() => handleToggleEstado(p, 'CERRADO')}
                      className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      Cerrar Mes
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleEstado(p, 'ABIERTO')}
                      className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      Reabrir Mes
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🚀 MODAL: CREAR NUEVO PERÍODO */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
          <div 
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-0 transition-opacity animate-in fade-in duration-200"
            onClick={() => !creating && setIsModalOpen(false)}
          />

          <div 
            className="relative z-10 isolate bg-white rounded-xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Nuevo Período Contable
                </h2>
                <p className="text-xs text-slate-500">
                  Apertura de un nuevo mes operativo en el sistema
                </p>
              </div>
              <button
                type="button"
                onClick={() => !creating && setIsModalOpen(false)}
                disabled={creating}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreatePeriodo} className="p-5 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Error</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">{modalError}</p>
                  </div>
                </div>
              )}

              {/* Selectores de Año y Mes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Año:
                  </label>
                  <select
                    value={formYear}
                    onChange={(e) => setFormYear(parseInt(e.target.value, 10))}
                    disabled={creating}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 outline-none focus:border-slate-500"
                  >
                    {[2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Mes:
                  </label>
                  <select
                    value={formMonth}
                    onChange={(e) => setFormMonth(parseInt(e.target.value, 10))}
                    disabled={creating}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 outline-none focus:border-slate-500"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vista Previa */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p className="text-slate-500">Período a crear:</p>
                <p className="font-bold text-slate-900 text-sm">{previewData.nombre}</p>
                <p className="text-[11px] font-mono text-slate-500">{previewData.codigo}</p>
              </div>

              {/* Notas opcionales */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Notas (Opcional):
                </label>
                <input
                  type="text"
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  placeholder="Observaciones del período..."
                  disabled={creating}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 outline-none focus:border-slate-500"
                />
              </div>

              {/* Botones */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={creating}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-md shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creando...</span>
                    </>
                  ) : (
                    <span>Crear Período</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
