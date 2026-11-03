'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
  CalendarRange, 
  Plus, 
  Search, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  ArrowRight, 
  ShoppingCart, 
  TrendingUp, 
  FileSpreadsheet, 
  Layers, 
  Calendar, 
  AlertCircle,
  Loader2,
  X,
  Star,
  RefreshCw,
  Clock,
  Trash2
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { usePeriodo, Periodo } from '@/context/PeriodoContext';
import { formatMoney } from '@/lib/formatters';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface PeriodoWithStats extends Periodo {
  stats?: {
    compras_facturas: number;
    compras_total: number;
    ventas_dias: number;
    ventas_total: number;
    costeo_hojas: number;
  };
}

export default function PeriodosPage() {
  const { selectedPeriodoId, setSelectedPeriodoId, refreshPeriodos } = usePeriodo();
  const [periodosList, setPeriodosList] = useState<PeriodoWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<'TODOS' | 'ABIERTO' | 'CERRADO'>('TODOS');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form Fields para Nuevo Período
  const currentYear = new Date().getFullYear();
  const [formYear, setFormYear] = useState<number>(currentYear);
  const [formMonth, setFormMonth] = useState<number>(() => {
    const nextM = new Date().getMonth() + 2; // Siguiente mes sugerido
    return nextM > 12 ? 1 : nextM;
  });
  const [formEstado, setFormEstado] = useState<'ABIERTO' | 'CERRADO'>('ABIERTO');
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

  // Manejar Escape para modal
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
    const lastDay = new Date(formYear, formMonth, 0).getDate();
    const fechaInicio = `${codigo}-01`;
    const fechaFin = `${codigo}-${String(lastDay).padStart(2, '0')}`;
    return { codigo, nombre, fechaInicio, fechaFin, lastDay };
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
          estado: formEstado,
          observaciones: formObservaciones.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo crear el período contable.');
      }

      setIsModalOpen(false);
      setSuccessToast(`¡Período "${previewData.nombre}" creado exitosamente! Ya está habilitado en todos los módulos.`);
      setTimeout(() => setSuccessToast(null), 5000);

      // Si se creó como ABIERTO, marcarlo como activo en la sesión
      if (formEstado === 'ABIERTO') {
        setSelectedPeriodoId(json.periodo.id);
      }

      await loadPeriodos();
      await refreshPeriodos();
    } catch (err: any) {
      setModalError(err.message || 'Error en la solicitud.');
    } finally {
      setCreating(false);
    }
  };

  // Alternar Estado de un Período (Abrir / Cerrar)
  const handleToggleEstado = async (p: PeriodoWithStats) => {
    const nuevoEstado = p.estado === 'ABIERTO' ? 'CERRADO' : 'ABIERTO';
    const confirmMsg = nuevoEstado === 'CERRADO'
      ? `¿Estás seguro de cerrar el período "${p.nombre}"? No se podrán registrar nuevas operaciones en este mes.`
      : `¿Deseas reabrir el período "${p.nombre}" para registrar movimientos contables?`;

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

      setSuccessToast(`Período "${p.nombre}" marcado como ${nuevoEstado}.`);
      setTimeout(() => setSuccessToast(null), 4000);

      await loadPeriodos();
      await refreshPeriodos();
    } catch (err: any) {
      alert(err.message || 'Error actualizando período');
    }
  };

  // Eliminar Período Vacío
  const handleDeletePeriodo = async (p: PeriodoWithStats) => {
    if (!window.confirm(`¿Estás seguro de eliminar el período vacío "${p.nombre}"?`)) return;
    try {
      const res = await fetch(`/api/periodos?id=${p.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al eliminar');
      setSuccessToast(`Período "${p.nombre}" eliminado correctamente.`);
      setTimeout(() => setSuccessToast(null), 3500);
      await loadPeriodos();
      await refreshPeriodos();
    } catch (err: any) {
      alert(err.message || 'Error eliminando período');
    }
  };

  // Filtrado de períodos
  const filteredPeriodos = useMemo(() => {
    return periodosList.filter(p => {
      // Filtro por Estado
      if (filterEstado !== 'TODOS' && p.estado !== filterEstado) {
        return false;
      }
      // Filtro por Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNombre = p.nombre.toLowerCase().includes(q);
        const matchCodigo = p.codigo.toLowerCase().includes(q);
        if (!matchNombre && !matchCodigo) return false;
      }
      return true;
    });
  }, [periodosList, filterEstado, searchQuery]);

  // Período activo global
  const activePeriodoGlobal = useMemo(() => {
    return periodosList.find(p => p.id === selectedPeriodoId || p.codigo === selectedPeriodoId)
      || periodosList.find(p => p.estado === 'ABIERTO')
      || periodosList[0]
      || null;
  }, [periodosList, selectedPeriodoId]);

  // Contadores generales
  const statsSummary = useMemo(() => {
    const total = periodosList.length;
    const abiertos = periodosList.filter(p => p.estado === 'ABIERTO').length;
    const cerrados = periodosList.filter(p => p.estado === 'CERRADO').length;
    const totalFacturas = periodosList.reduce((acc, p) => acc + (p.stats?.compras_facturas || 0), 0);
    const totalVentasDinero = periodosList.reduce((acc, p) => acc + (p.stats?.ventas_total || 0), 0);
    return { total, abiertos, cerrados, totalFacturas, totalVentasDinero };
  }, [periodosList]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-150 pb-16 font-normal">
      {/* 🏷️ Toast de Notificación de Éxito */}
      {successToast && (
        <div className="bg-emerald-600 text-white p-3.5 px-4 rounded-xl shadow-lg flex items-center justify-between text-xs font-medium animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setSuccessToast(null)} 
            className="text-emerald-200 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 🏷️ Encabezado Principal del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-lg shadow-2xs">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Gestión de Períodos Contables
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Oficial
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Administración de meses operativos y apertura de ciclos para compras, ventas, costeo y auditoría
            </p>
          </div>
        </div>

        {/* Acciones del Encabezado */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={loadPeriodos}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-slate-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Período</span>
          </button>
        </div>
      </div>

      {/* 📊 Tarjetas de Resumen KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Período Activo */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Período Activo
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900 truncate">
              {activePeriodoGlobal?.nombre || 'Ninguno'}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {activePeriodoGlobal ? `${activePeriodoGlobal.fecha_inicio} al ${activePeriodoGlobal.fecha_fin}` : 'Sin período seleccionado'}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Estado:</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activePeriodoGlobal?.estado === 'ABIERTO'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              {activePeriodoGlobal?.estado === 'ABIERTO' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              {activePeriodoGlobal?.estado || 'N/A'}
            </span>
          </div>
        </div>

        {/* Card 2: Períodos Totales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Meses Registrados
          </span>
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono">
              {statsSummary.total}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Ciclos operativos en el sistema
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-600">
            <span><strong className="text-emerald-700">{statsSummary.abiertos}</strong> abiertos</span>
            <span>•</span>
            <span><strong className="text-slate-700">{statsSummary.cerrados}</strong> cerrados</span>
          </div>
        </div>

        {/* Card 3: Compras Acumuladas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Actividad de Compras
          </span>
          <div>
            <span className="text-2xl font-black text-slate-900 font-mono">
              {statsSummary.totalFacturas}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Facturas registradas en total
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
            <span>Disponibles en el módulo de compras</span>
          </div>
        </div>

        {/* Card 4: Ventas Acumuladas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Facturado Ventas
          </span>
          <div>
            <span className="text-lg font-black text-slate-900 font-mono truncate block">
              ${statsSummary.totalVentasDinero.toLocaleString('es-CO')} <span className="text-xs text-slate-500">COP</span>
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Ingresos consolidados por POS
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
            <span>Disponibles en el módulo de ventas</span>
          </div>
        </div>
      </div>

      {/* 🔍 Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar período por nombre o código (ej: Noviembre, 2026, 2026-11)..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-lg outline-none transition-colors"
          />
        </div>

        {/* Filtro por Estado */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setFilterEstado('TODOS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              filterEstado === 'TODOS'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({periodosList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterEstado('ABIERTO')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              filterEstado === 'ABIERTO'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Abiertos ({statsSummary.abiertos})
          </button>
          <button
            type="button"
            onClick={() => setFilterEstado('CERRADO')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              filterEstado === 'CERRADO'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cerrados ({statsSummary.cerrados})
          </button>
        </div>
      </div>

      {/* 📋 Listado de Tarjetas de Períodos */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Cargando períodos contables...</p>
        </div>
      ) : filteredPeriodos.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <CalendarRange className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No se encontraron períodos</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery 
              ? `No hay ningún período que coincida con "${searchQuery}".` 
              : 'Aún no se han configurado períodos contables.'}
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear primer período</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPeriodos.map((p) => {
            const isSelected = selectedPeriodoId === p.id || selectedPeriodoId === p.codigo;
            const cCount = p.stats?.compras_facturas || 0;
            const cTotal = p.stats?.compras_total || 0;
            const vDays = p.stats?.ventas_dias || 0;
            const vTotal = p.stats?.ventas_total || 0;
            const hCount = p.stats?.costeo_hojas || 0;

            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border transition-all p-5 flex flex-col justify-between ${
                  isSelected
                    ? 'border-slate-900 shadow-md ring-1 ring-slate-900/10'
                    : 'border-slate-200 shadow-2xs hover:border-slate-300'
                }`}
              >
                {/* Cabecera de la Tarjeta del Período */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${
                        p.estado === 'ABIERTO' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-slate-900">
                            {p.nombre}
                          </h2>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                            {p.codigo}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {p.fecha_inicio} al {p.fecha_fin}
                        </p>
                      </div>
                    </div>

                    {/* Insignia de Estado */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        p.estado === 'ABIERTO'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {p.estado === 'ABIERTO' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Abierto</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Cerrado</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Resumen Operacional en 3 Mini-Columnas */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 my-3 text-xs">
                    {/* Compras */}
                    <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                        <ShoppingCart className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Compras</span>
                      </div>
                      <p className="font-bold text-slate-900 font-mono">
                        {cCount} <span className="text-[10px] text-slate-500 font-sans font-normal">facs</span>
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600 font-mono truncate">
                        ${cTotal.toLocaleString('es-CO')}
                      </p>
                    </div>

                    {/* Ventas */}
                    <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                        <TrendingUp className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Ventas</span>
                      </div>
                      <p className="font-bold text-slate-900 font-mono">
                        {vDays} <span className="text-[10px] text-slate-500 font-sans font-normal">días</span>
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600 font-mono truncate">
                        ${vTotal.toLocaleString('es-CO')}
                      </p>
                    </div>

                    {/* Costeo Cocina */}
                    <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                        <FileSpreadsheet className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Costeo</span>
                      </div>
                      <p className="font-bold text-slate-900 font-mono">
                        {hCount} <span className="text-[10px] text-slate-500 font-sans font-normal">hojas</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Jornadas
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botones de Navegación y Acciones Rápidas */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href="/compras"
                      onClick={() => setSelectedPeriodoId(p.id)}
                      className="px-2.5 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors inline-flex items-center gap-1 font-medium"
                    >
                      <span>Compras</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/ventas"
                      onClick={() => setSelectedPeriodoId(p.id)}
                      className="px-2.5 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors inline-flex items-center gap-1 font-medium"
                    >
                      <span>Ventas</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/costeo-diario"
                      className="px-2.5 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors inline-flex items-center gap-1 font-medium"
                    >
                      <span>Costeo</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {cCount === 0 && vDays === 0 && hCount === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeletePeriodo(p)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-md transition-colors cursor-pointer"
                        title="Eliminar período sin datos"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleEstado(p)}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors font-medium cursor-pointer"
                      title={p.estado === 'ABIERTO' ? 'Cerrar período' : 'Reabrir período'}
                    >
                      {p.estado === 'ABIERTO' ? 'Cerrar Mes' : 'Reabrir Mes'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPeriodoId(p.id);
                        setSuccessToast(`"${p.nombre}" es ahora el período activo de la sesión.`);
                        setTimeout(() => setSuccessToast(null), 3500);
                      }}
                      className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {isSelected ? '★ Activo' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🚀 MODAL: CREAR NUEVO PERÍODO (Proyectado a document.body vía Portal) */}
      {mounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop con desenfoque profesional */}
          <div 
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => !creating && setIsModalOpen(false)}
          />

          {/* Tarjeta del Diálogo */}
          <div 
            className="relative z-10 bg-white rounded-xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-900 text-white rounded-lg">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Apertura de Nuevo Período Contable
                  </h2>
                  <p className="text-xs text-slate-500">
                    Habilita el mes de operaciones para todos los módulos
                  </p>
                </div>
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
            <form onSubmit={handleCreatePeriodo} className="p-5 space-y-4 text-xs overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">No se pudo crear el período</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">{modalError}</p>
                  </div>
                </div>
              )}

              {/* Selectores de Año y Mes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Año Calendario *
                  </label>
                  <select
                    value={formYear}
                    onChange={(e) => setFormYear(parseInt(e.target.value, 10))}
                    disabled={creating}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-slate-400"
                  >
                    {[2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Mes Operativo *
                  </label>
                  <select
                    value={formMonth}
                    onChange={(e) => setFormMonth(parseInt(e.target.value, 10))}
                    disabled={creating}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-slate-400"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {String(idx + 1).padStart(2, '0')} - {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vista Previa de los Datos Calculados */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Nombre del Período:</span>
                  <span className="font-bold text-slate-900">{previewData.nombre}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Código Sistema:</span>
                  <span className="font-mono font-bold text-slate-800">{previewData.codigo}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Rango de Cobertura:</span>
                  <span className="font-mono text-slate-700">{previewData.fechaInicio} al {previewData.fechaFin}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500">Días del Mes:</span>
                  <span className="font-semibold text-slate-800">{previewData.lastDay} días calendario</span>
                </div>
              </div>

              {/* Estado Inicial */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Estado Inicial *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    formEstado === 'ABIERTO'
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="estado"
                      checked={formEstado === 'ABIERTO'}
                      onChange={() => setFormEstado('ABIERTO')}
                      className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs">Abierto (Activo)</span>
                      <span className="block text-[10px] text-slate-500 font-normal">Permite registrar compras, ventas y costeo</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    formEstado === 'CERRADO'
                      ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="estado"
                      checked={formEstado === 'CERRADO'}
                      onChange={() => setFormEstado('CERRADO')}
                      className="text-slate-600 focus:ring-slate-500 cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs">Cerrado</span>
                      <span className="block text-[10px] text-slate-500 font-normal">Solo para consulta histórica</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Notas u Observaciones (Opcional)
                </label>
                <textarea
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  placeholder="Ej: Período de temporada navideña, ajuste especial de proveedores..."
                  rows={2}
                  disabled={creating}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:border-slate-400 resize-none"
                />
              </div>

              {/* Mensaje Informativo de Sincronización Transversal */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-[11px] text-blue-800 leading-relaxed">
                <span className="font-bold block text-blue-900 mb-0.5">Sincronización Automática:</span>
                Al confirmar, este período se reflejará inmediatamente en <strong>Entradas por Compra</strong>, <strong>Salidas por Venta</strong>, <strong>Costeo Diario Cocina</strong> e <strong>Inventario Consolidado</strong>, listo para recibir información diaria.
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={creating}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creando Período...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Habilitar Período</span>
                    </>
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
