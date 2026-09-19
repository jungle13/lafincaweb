'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Search, 
  X, 
  Loader2,
  Lock,
  Zap,
  Wrench,
  History,
  CheckCheck
} from 'lucide-react';
import { normalizeStr } from '@/lib/formatters';
import { InsumoItem, MovimientoItem } from '@/types';
import { usePeriodo } from '@/context/PeriodoContext';

// Subcomponentes modulares de Timeline
import EditMovementModal from './timeline/EditMovementModal';
import QuickAjusteModal, { QuickAjusteModalData } from './timeline/QuickAjusteModal';
import DateFilterChips from './timeline/DateFilterChips';
import MovementGroupCard from './timeline/MovementGroupCard';

interface Props {
  movimientos: MovimientoItem[];
  filterDate: string;
  onDateChange: (date: string) => void;
  onSuccess?: () => void;
  insumos?: InsumoItem[];
}

export default function TimelineFeed({
  movimientos,
  filterDate,
  onDateChange,
  onSuccess,
  insumos = [],
}: Props) {
  const { currentPeriodo } = usePeriodo();
  // Pestaña principal: 'PENDIENTES' | 'HISTORIAL'
  const [activeFeedTab, setActiveFeedTab] = useState<'PENDIENTES' | 'HISTORIAL'>('PENDIENTES');

  const [meatFilter, setMeatFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filtro de fecha específico para la sección de Pendientes
  const [pendingDateFilter, setPendingDateFilter] = useState<string>('ALL');

  // Estados de acciones
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [approvingBatchDate, setApprovingBatchDate] = useState<string | null>(null);
  const [autoAdjustingDate, setAutoAdjustingDate] = useState<string | null>(null);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [revertingDate, setRevertingDate] = useState<string | null>(null);

  // Modales
  const [editingMov, setEditingMov] = useState<MovimientoItem | null>(null);
  const [quickAjusteModal, setQuickAjusteModal] = useState<QuickAjusteModalData | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Separar movimientos pendientes vs aprobados
  const { allPendingMovs, approvedMovs } = useMemo(() => {
    const pending: MovimientoItem[] = [];
    const approved: MovimientoItem[] = [];

    movimientos.forEach((m) => {
      const isPending =
        m.observaciones?.includes('[PENDIENTE_APROBAR]') || m.usuario?.includes('(Pendiente)');
      if (isPending) {
        pending.push(m);
      } else {
        approved.push(m);
      }
    });

    return { allPendingMovs: pending, approvedMovs: approved };
  }, [movimientos]);

  // Si no hay pendientes, cambiar automáticamente a la pestaña de Historial
  useEffect(() => {
    if (allPendingMovs.length === 0 && activeFeedTab === 'PENDIENTES') {
      setActiveFeedTab('HISTORIAL');
    }
  }, [allPendingMovs.length, activeFeedTab]);

  // 2. Extraer fechas únicas presentes en pendientes ordenadas ascendentemente (del más antiguo al más reciente)
  const sortedPendingDates = useMemo(() => {
    const map = new Map<string, number>();
    allPendingMovs.forEach((m) => {
      const d = (m.fecha || m.fecha_hora || '').split('T')[0] || todayStr;
      map.set(d, (map.get(d) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allPendingMovs, todayStr]);

  // 3. Extraer fechas únicas presentes en aprobados ordenadas de más reciente a más antiguo
  const sortedApprovedDates = useMemo(() => {
    const map = new Map<string, number>();
    approvedMovs.forEach((m) => {
      const d = (m.fecha || m.fecha_hora || m.fecha_movimiento || '').split('T')[0] || todayStr;
      map.set(d, (map.get(d) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [approvedMovs, todayStr]);

  // 📅 La fecha activa obligatoria en pendientes es la fecha más antigua que aún tenga pendientes
  const earliestPendingDate = sortedPendingDates.length > 0 ? sortedPendingDates[0].date : null;

  // Enfocar por defecto en la fecha más antigua de pendientes
  useEffect(() => {
    if (
      earliestPendingDate &&
      (pendingDateFilter === 'ALL' || !sortedPendingDates.some((d) => d.date === pendingDateFilter))
    ) {
      setPendingDateFilter(earliestPendingDate);
    }
  }, [earliestPendingDate, pendingDateFilter, sortedPendingDates]);

  // 4. Filtrar pendientes por la fecha seleccionada en los Badges
  const filteredPendingMovs = useMemo(() => {
    if (pendingDateFilter === 'ALL') return allPendingMovs;
    return allPendingMovs.filter((m) => {
      const d = (m.fecha || m.fecha_hora || '').split('T')[0] || todayStr;
      return d === pendingDateFilter;
    });
  }, [allPendingMovs, pendingDateFilter, todayStr]);

  // 5. Agrupar pendientes por carne y ordenar según secuencia de registro
  const groupedPendingMeats = useMemo(() => {
    const groups = new Map<
      string,
      {
        insumoId: string;
        carneName: string;
        insumoObj?: InsumoItem;
        movs: MovimientoItem[];
        minTimestamp: string;
        firstIndex: number;
      }
    >();

    filteredPendingMovs.forEach((m, idx) => {
      const idKey = String(m.insumo_id);
      const name = m.catalogo_insumos?.nombre || m.insumo_nombre || `Insumo #${m.insumo_id}`;
      const foundInsumo = insumos.find((i) => String(i.insumo_id) === idKey);
      const timeVal = m.fecha_hora || m.fecha || '';

      if (!groups.has(idKey)) {
        groups.set(idKey, {
          insumoId: idKey,
          carneName: name,
          insumoObj: foundInsumo,
          movs: [m],
          minTimestamp: timeVal,
          firstIndex: idx,
        });
      } else {
        const g = groups.get(idKey)!;
        g.movs.push(m);
        if (timeVal && (!g.minTimestamp || timeVal < g.minTimestamp)) {
          g.minTimestamp = timeVal;
        }
      }
    });

    // Ordenar movimientos dentro de cada grupo
    groups.forEach((group) => {
      group.movs.sort((a, b) => {
        const orderMap: Record<string, number> = {
          ENTRADA_COMPRA: 10,
          PORCIONADO: 20,
          DEVOLUCION_COCINA: 30,
          TRASLADO_COCINA: 40,
        };
        const orderA = orderMap[a.tipo_movimiento] || 50;
        const orderB = orderMap[b.tipo_movimiento] || 50;
        return orderA - orderB;
      });
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.minTimestamp && b.minTimestamp && a.minTimestamp !== b.minTimestamp) {
        return a.minTimestamp.localeCompare(b.minTimestamp);
      }
      return a.firstIndex - b.firstIndex;
    });
  }, [filteredPendingMovs, insumos]);

  // 6. Filtrar aprobados por fecha seleccionada
  const dateFilteredApproved = useMemo(() => {
    if (!filterDate || filterDate === 'ALL') return approvedMovs;
    return approvedMovs.filter((m) => {
      const mDate = (m.fecha || m.fecha_hora || m.fecha_movimiento || '').split('T')[0];
      return mDate === filterDate;
    });
  }, [approvedMovs, filterDate]);

  // 7. Extraer carnes únicas con movimientos aprobados
  const availableMeats = useMemo(() => {
    const map = new Map<
      string,
      { id: string | number; name: string; count: number; minTimestamp: string; firstIndex: number }
    >();
    dateFilteredApproved.forEach((m, idx) => {
      const name = m.catalogo_insumos?.nombre || m.insumo_nombre || `Insumo #${m.insumo_id}`;
      const id = m.insumo_id;
      const key = String(id);
      const timeVal = m.fecha_hora || m.fecha || '';
      if (!map.has(key)) {
        map.set(key, { id, name, count: 1, minTimestamp: timeVal, firstIndex: idx });
      } else {
        const item = map.get(key)!;
        item.count += 1;
        if (timeVal && (!item.minTimestamp || timeVal < item.minTimestamp)) {
          item.minTimestamp = timeVal;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.minTimestamp && b.minTimestamp && a.minTimestamp !== b.minTimestamp) {
        return a.minTimestamp.localeCompare(b.minTimestamp);
      }
      return a.firstIndex - b.firstIndex;
    });
  }, [dateFilteredApproved]);

  // 8. Carnes filtradas para el buscador
  const filteredSearchMeats = useMemo(() => {
    if (!searchQuery.trim()) return availableMeats;
    const q = normalizeStr(searchQuery);
    return availableMeats.filter((item) => normalizeStr(item.name).includes(q));
  }, [availableMeats, searchQuery]);

  // 9. Filtrar lista final de aprobados por carne seleccionada
  const finalApprovedMovs = useMemo(() => {
    if (meatFilter === 'ALL') return dateFilteredApproved;
    return dateFilteredApproved.filter((m) => String(m.insumo_id) === String(meatFilter));
  }, [dateFilteredApproved, meatFilter]);

  // 10. Agrupar movimientos aprobados por insumo
  const groupedApprovedMeats = useMemo(() => {
    const groups = new Map<
      string,
      {
        insumoId: string;
        carneName: string;
        categoria?: string;
        insumoObj?: InsumoItem;
        movs: MovimientoItem[];
        minTimestamp: string;
        firstIndex: number;
      }
    >();

    finalApprovedMovs.forEach((m, idx) => {
      const idKey = String(m.insumo_id);
      const name = m.catalogo_insumos?.nombre || m.insumo_nombre || `Insumo #${m.insumo_id}`;
      const cat = m.catalogo_insumos?.categoria || '';
      const foundInsumo = insumos.find((i) => String(i.insumo_id) === idKey);
      const timeVal = m.fecha_hora || m.fecha || '';

      if (!groups.has(idKey)) {
        groups.set(idKey, {
          insumoId: idKey,
          carneName: name,
          categoria: cat,
          insumoObj: foundInsumo,
          movs: [m],
          minTimestamp: timeVal,
          firstIndex: idx,
        });
      } else {
        const g = groups.get(idKey)!;
        g.movs.push(m);
        if (timeVal && (!g.minTimestamp || timeVal < g.minTimestamp)) {
          g.minTimestamp = timeVal;
        }
      }
    });

    groups.forEach((group) => {
      group.movs.sort((a, b) => {
        const orderMap: Record<string, number> = {
          ENTRADA_COMPRA: 10,
          PORCIONADO: 20,
          DEVOLUCION_COCINA: 30,
          TRASLADO_COCINA: 40,
          AJUSTE_INVENTARIO: 50,
          INVENTARIO_INICIAL: 60,
        };
        const orderA = orderMap[a.tipo_movimiento] || 99;
        const orderB = orderMap[b.tipo_movimiento] || 99;
        return orderA - orderB;
      });
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.minTimestamp && b.minTimestamp && a.minTimestamp !== b.minTimestamp) {
        return a.minTimestamp.localeCompare(b.minTimestamp);
      }
      return a.firstIndex - b.firstIndex;
    });
  }, [finalApprovedMovs, insumos]);

  const handleSelectMeat = (id: string, name: string) => {
    setMeatFilter(id);
    setSearchQuery(id === 'ALL' ? '' : name);
    setIsDropdownOpen(false);
  };

  const handleClearMeatFilter = () => {
    setMeatFilter('ALL');
    setSearchQuery('');
  };

  // Manejador: Aprobar Movimiento Individual
  const handleAprobar = async (movId: string) => {
    setActionLoadingId(movId);
    try {
      const res = await fetch('/api/bodega/movimientos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APROBAR',
          movimientoId: movId,
          usuario: 'Administrador',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al aprobar movimiento');

      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 🛠️ Manejador: Auto-Ajustar Inconsistencias
  const handleAutoAjustarDia = async (targetDate: string) => {
    if (
      !confirm(
        `🛠️ ¿Deseas aplicar automáticamente los ajustes de inventario necesarios (por error de conteo previo) para subsanar todos los faltantes de stock del día ${targetDate}?\n\nEsta acción registrará las auditorías correspondientes y habilitará la aprobación inmediata del día.`
      )
    )
      return;

    setAutoAdjustingDate(targetDate);
    try {
      const res = await fetch('/api/bodega/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AUTO_AJUSTAR_FECHA',
          fecha: targetDate,
          usuario: 'Administrador',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al auto-ajustar día');

      if (data.count === 0) {
        alert(
          data.message ||
            `✅ Todos los movimientos del día ${targetDate} tienen stock suficiente. No se requirieron ajustes.`
        );
      } else {
        alert(`${data.message}\n\nLos cortes ahora cuentan con existencias suficientes para ser aprobados.`);
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAutoAdjustingDate(null);
    }
  };

  // Manejador: Aprobar Todo el Día
  const handleAprobarDia = async (targetDate: string) => {
    if (
      !confirm(
        `¿Estás seguro de aprobar TODOS los movimientos pendientes del día ${targetDate} en orden cronológico?`
      )
    )
      return;

    setApprovingBatchDate(targetDate);
    try {
      const res = await fetch('/api/bodega/movimientos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APROBAR_FECHA',
          fecha: targetDate,
          usuario: 'Administrador',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al aprobar día');

      alert(data.message || `✅ Día ${targetDate} aprobado con éxito.`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApprovingBatchDate(null);
    }
  };

  // ↺ Manejador: Revertir Día Aprobado
  const handleRevertirDia = async (targetDate: string, count: number) => {
    if (
      !confirm(
        `↺ ¿Deseas revertir todos los ${count} movimientos aprobados del día ${targetDate} a estado PENDIENTE?\n\nEl stock de bodega se recalibrará automáticamente para que puedas realizar ajustes o revisiones.`
      )
    )
      return;

    setRevertingDate(targetDate);
    try {
      const res = await fetch('/api/bodega/movimientos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REVERTIR_FECHA',
          fecha: targetDate,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al revertir los movimientos de la fecha');

      alert(data.message || `✅ Movimientos del ${targetDate} vueltos a estado pendiente.`);
      setActiveFeedTab('PENDIENTES');
      setPendingDateFilter(targetDate);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRevertingDate(null);
    }
  };

  // 🗑️ Manejador: Descartar Día Completo
  const handleDescartarDia = async (targetDate: string, count: number) => {
    if (
      !confirm(
        `⚠️ ¿Estás seguro de descartar y eliminar TODOS los ${count} movimientos pendientes del día ${targetDate}?\n\nEsta acción borrará estos registros pendientes para evitar duplicados.`
      )
    )
      return;

    setDeletingDate(targetDate);
    try {
      const res = await fetch('/api/bodega/movimientos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DESCARTAR_FECHA',
          fecha: targetDate,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al descartar los movimientos de la fecha');

      alert(data.message || `✅ Movimientos pendientes del ${targetDate} eliminados con éxito.`);
      if (pendingDateFilter === targetDate) {
        setPendingDateFilter('ALL');
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingDate(null);
    }
  };

  // Manejador: Descartar Movimiento Individual
  const handleDescartar = async (movId: string) => {
    if (!confirm('¿Estás seguro de descartar y eliminar este movimiento pendiente?')) return;

    setActionLoadingId(movId);
    try {
      const res = await fetch('/api/bodega/movimientos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DESCARTAR',
          movimientoId: movId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al descartar movimiento');

      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Manejador: Abrir Modal de Ajuste Rápido
  const handleOpenQuickAjuste = (m: any, stock: any, carneName: string) => {
    const tipo = m.tipo_movimiento;
    let ubicacion = 'BODEGA_ENTERO';
    let ubicacionLabel = 'Bodega Entero (Kg)';
    let deficit = 0;

    if (tipo === 'TRASLADO_COCINA') {
      if (m.porciones_und > 0) {
        const cur = stock?.bodega_porc_und || 0;
        const needed = m.porciones_und || 0;
        deficit = Math.max(0, needed - cur);
        ubicacion = 'BODEGA_PORCIONADO';
        ubicacionLabel = 'Bodega Porciones (Und)';
      } else {
        const cur = stock?.bodega_sin_porc_kg || 0;
        const needed = parseFloat(m.cant_sin_porcionar_kg) || 0;
        deficit = parseFloat(Math.max(0, needed - cur).toFixed(2));
        ubicacion = 'BODEGA_ENTERO';
        ubicacionLabel = 'Bodega Entero (Kg)';
      }
    } else if (tipo === 'PORCIONADO') {
      const cur = stock?.bodega_sin_porc_kg || 0;
      const needed = parseFloat(m.cant_sin_porcionar_kg) || 0;
      deficit = parseFloat(Math.max(0, needed - cur).toFixed(2));
      ubicacion = 'BODEGA_ENTERO';
      ubicacionLabel = 'Bodega Entero (Kg)';
    } else if (tipo === 'DEVOLUCION_COCINA') {
      if (m.porciones_und > 0) {
        const cur = stock?.cocina_porc_und || 0;
        const needed = m.porciones_und || 0;
        deficit = Math.max(0, needed - cur);
        ubicacion = 'COCINA_PORCIONADO';
        ubicacionLabel = 'Cocina Porciones (Und)';
      } else {
        const cur = stock?.cocina_sin_porc_kg || 0;
        const needed = parseFloat(m.cant_sin_porcionar_kg) || 0;
        deficit = parseFloat(Math.max(0, needed - cur).toFixed(2));
        ubicacion = 'COCINA_PORCIONADO';
        ubicacionLabel = 'Cocina (Kg)';
      }
    }

    const targetFecha = (m.fecha || m.fecha_hora || todayStr).split('T')[0];

    setQuickAjusteModal({
      isOpen: true,
      fecha: targetFecha,
      insumoId: m.insumo_id,
      insumoName: carneName || m.catalogo_insumos?.nombre || `Insumo #${m.insumo_id}`,
      ubicacion: ubicacion,
      ubicacionLabel: ubicacionLabel,
      cantidad: deficit,
      motivo: 'ERROR_CONTEO_PREVIO',
      justificacion: 'error de conteo previo',
    });
  };

  return (
    <div className="space-y-4 font-normal">
      {/* 🗂️ PESTAÑAS PRINCIPALES DEL FEED */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto no-scrollbar touch-pan-x">
        <button
          type="button"
          onClick={() => setActiveFeedTab('PENDIENTES')}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeFeedTab === 'PENDIENTES'
              ? 'border-amber-600 text-amber-900 bg-amber-50/60 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Movimientos Pendientes de Aprobación</span>
          {allPendingMovs.length > 0 && (
            <span className="bg-amber-600 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
              {allPendingMovs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveFeedTab('HISTORIAL')}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeFeedTab === 'HISTORIAL'
              ? 'border-orange-500 text-orange-600 bg-orange-50/60 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5 text-orange-500" />
          <span>Kardex y Operaciones Aprobadas</span>
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-medium border border-slate-200">
            {approvedMovs.length}
          </span>
        </button>
      </div>

      {/* ⚠️ PESTAÑA 1: MOVIMIENTOS PENDIENTES DE APROBACIÓN */}
      {activeFeedTab === 'PENDIENTES' && (
        <div className="space-y-3 animate-fade-in">
          {allPendingMovs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-normal text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <CheckCheck className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-medium text-slate-800 text-sm">¡Al día! No hay movimientos pendientes de aprobación.</p>
              <p className="text-slate-400">
                Todos los movimientos extraídos por IA o ingresados manualmente han sido formalizados en el stock.
              </p>
            </div>
          ) : (
            <>
              {/* 🏷️ BADGES DE FILTRO POR FECHA */}
              <DateFilterChips
                mode="PENDIENTES"
                selectedDate={pendingDateFilter}
                onSelectDate={setPendingDateFilter}
                pendingDates={sortedPendingDates}
                earliestPendingDate={earliestPendingDate}
                deletingDate={deletingDate}
                onDescartarDia={handleDescartarDia}
                totalPendingCount={allPendingMovs.length}
              />

              {/* CUADRO CONTENEDOR DE PENDIENTES AGRUPADOS */}
              <div className="p-4 bg-amber-50/50 border border-amber-200/90 rounded-2xl space-y-3.5 shadow-sm">
                {/* Header del Bloque */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-amber-200/60">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-medium text-amber-950">
                        Movimientos Pendientes de Aprobación ({filteredPendingMovs.length})
                      </h3>
                    </div>
                    <p className="text-[11px] text-amber-800 font-normal">
                      {pendingDateFilter !== 'ALL' &&
                      earliestPendingDate &&
                      pendingDateFilter > earliestPendingDate ? (
                        <span className="text-slate-600 flex items-center gap-1 font-medium">
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                          Esta jornada ({pendingDateFilter}) está bloqueada. Primero debes aprobar el día{' '}
                          {earliestPendingDate}.
                        </span>
                      ) : (
                        <span>Secuencia estricta: Compras ➔ Porcionados ➔ Devoluciones ➔ Traslados</span>
                      )}
                    </p>
                  </div>

                  {/* Botones de Acción en Lote */}
                  {earliestPendingDate &&
                    (pendingDateFilter === 'ALL' || pendingDateFilter === earliestPendingDate) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={
                            autoAdjustingDate === earliestPendingDate || approvingBatchDate === earliestPendingDate
                          }
                          onClick={() => handleAutoAjustarDia(earliestPendingDate)}
                          className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-900 border border-amber-400/50 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                          title={`Calcular y subsanar automáticamente faltantes de stock por conteo previo para el día ${earliestPendingDate}`}
                        >
                          {autoAdjustingDate === earliestPendingDate ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                          ) : (
                            <Wrench className="w-3.5 h-3.5 text-amber-700" />
                          )}
                          <span>Auto-Ajustar Inconsistencias ({earliestPendingDate})</span>
                        </button>

                        <button
                          type="button"
                          disabled={
                            approvingBatchDate === earliestPendingDate || autoAdjustingDate === earliestPendingDate
                          }
                          onClick={() => handleAprobarDia(earliestPendingDate)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                        >
                          {approvingBatchDate === earliestPendingDate ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-emerald-200" />
                          )}
                          <span>
                            Aprobar Todo el Día {earliestPendingDate} ({sortedPendingDates[0]?.count})
                          </span>
                        </button>
                      </div>
                    )}
                </div>

                {/* GRUPOS POR CARNE */}
                <div className="space-y-4">
                  {groupedPendingMeats.map((group) => (
                    <MovementGroupCard
                      key={group.insumoId}
                      group={group}
                      mode="PENDIENTES"
                      actionLoadingId={actionLoadingId}
                      earliestPendingDate={earliestPendingDate}
                      onAprobar={handleAprobar}
                      onDescartar={handleDescartar}
                      onOpenEdit={setEditingMov}
                      onOpenQuickAjuste={handleOpenQuickAjuste}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 📜 PESTAÑA 2: KARDEX Y OPERACIONES APROBADAS */}
      {activeFeedTab === 'HISTORIAL' && (
        <div className="space-y-4 animate-fade-in">
          {/* Encabezado Superior */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-medium text-slate-900 tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span>Kardex de Operaciones Aprobadas ({finalApprovedMovs.length})</span>
              </h2>
              <p className="text-xs text-slate-400 font-normal">
                Movimientos formalizados en el inventario agrupados por corte de carne
              </p>
            </div>

            {/* Selector de Fecha */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                min={currentPeriodo?.fecha_inicio}
                max={currentPeriodo?.fecha_fin}
                value={filterDate === 'ALL' ? '' : filterDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-normal text-slate-800 bg-white outline-none focus:border-orange-500 shadow-sm"
              />
              {currentPeriodo?.fecha_inicio &&
                todayStr >= currentPeriodo.fecha_inicio &&
                todayStr <= currentPeriodo.fecha_fin &&
                filterDate !== todayStr && (
                  <button
                    type="button"
                    onClick={() => onDateChange(todayStr)}
                    className="px-2.5 h-8 text-xs font-normal bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    Hoy
                  </button>
                )}
            </div>
          </div>

          {/* 🏷️ BADGES DE FILTRO POR FECHA */}
          <DateFilterChips
            mode="HISTORIAL"
            selectedDate={filterDate}
            onSelectDate={onDateChange}
            approvedDates={sortedApprovedDates}
            revertingDate={revertingDate}
            onRevertirDia={handleRevertirDia}
            totalApprovedCount={approvedMovs.length}
          />

          {/* 🔍 Barra de Filtro Predictivo por Insumo */}
          <div className="flex items-center gap-2 flex-wrap" ref={searchRef}>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Filtrar por corte o materia prima..."
                className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 font-normal"
              />
              {meatFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={handleClearMeatFilter}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Desplegable de Autocompletado */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => handleSelectMeat('ALL', '')}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between text-slate-700 border-b border-slate-100 font-normal"
                  >
                    <span>Todas las Carnes</span>
                    <span className="text-[11px] text-slate-400">{dateFilteredApproved.length}</span>
                  </button>
                  {filteredSearchMeats.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-slate-400 text-center font-normal">
                      No hay movimientos para este criterio
                    </div>
                  ) : (
                    filteredSearchMeats.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectMeat(String(m.id), m.name)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 flex items-center justify-between text-slate-800 transition-colors font-normal"
                      >
                        <span>{m.name}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {m.count}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {meatFilter !== 'ALL' && (
              <span className="px-2.5 py-1 bg-orange-100 text-orange-800 text-xs rounded-lg font-medium flex items-center gap-1">
                Filtro activo
              </span>
            )}
          </div>

          {/* 📦 LISTA DE MOVIMIENTOS APROBADOS AGRUPADOS */}
          <div className="space-y-4">
            {groupedApprovedMeats.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-normal text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No hay movimientos aprobados registrados para esta fecha y criterio de búsqueda.
              </div>
            ) : (
              groupedApprovedMeats.map((group) => (
                <MovementGroupCard
                  key={group.insumoId}
                  group={group}
                  mode="HISTORIAL"
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* 📝 MODAL DE EDICIÓN */}
      <EditMovementModal
        editingMov={editingMov}
        insumos={insumos}
        currentPeriodo={currentPeriodo}
        onClose={() => setEditingMov(null)}
        onSuccess={onSuccess}
      />

      {/* 🛠️ MODAL DE AJUSTE RÁPIDO */}
      <QuickAjusteModal
        modalData={quickAjusteModal}
        currentPeriodo={currentPeriodo}
        onClose={() => setQuickAjusteModal(null)}
        onSuccess={onSuccess}
      />
    </div>
  );
}
