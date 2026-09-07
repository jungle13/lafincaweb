'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  CheckCircle2, 
  Trash2, 
  Edit2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  ChevronDown, 
  Search, 
  X, 
  Plus, 
  Loader2,
  Lock,
  Zap,
  ArrowRight,
  ShieldAlert,
  Wrench,
  Layers,
  History,
  CheckCheck,
  Save,
  RotateCcw
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';
import { InsumoItem, MovimientoItem } from '@/types';
import { usePeriodo } from '@/context/PeriodoContext';

interface Props {
  movimientos: MovimientoItem[];
  filterDate: string;
  onDateChange: (date: string) => void;
  onSuccess?: () => void;
  insumos?: InsumoItem[];
}

export default function TimelineFeed({ movimientos, filterDate, onDateChange, onSuccess, insumos = [] }: Props) {
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

  // Modal de Edición de Movimiento
  const [editingMov, setEditingMov] = useState<MovimientoItem | null>(null);
  const [editInsumoId, setEditInsumoId] = useState<string | number>('');
  const [editFecha, setEditFecha] = useState<string>('');
  const [editCantKg, setEditCantKg] = useState<string>('');
  const [editPorciones, setEditPorciones] = useState<string>('');
  const [editPesoPorciones, setEditPesoPorciones] = useState<string>('');
  const [editCostoTotal, setEditCostoTotal] = useState<string>('');
  const [editObs, setEditObs] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Insumo seleccionado para la edición actual
  const selectedEditInsumo = useMemo(() => {
    if (!editInsumoId) return null;
    return insumos.find((i) => String(i.insumo_id) === String(editInsumoId)) || null;
  }, [insumos, editInsumoId]);

  const handleEditInsumoChange = (newInsumoId: string) => {
    setEditInsumoId(newInsumoId);
    const found = insumos.find((i) => String(i.insumo_id) === String(newInsumoId));
    const unitPrice = found?.costo_unitario_kg || 0;
    const pesoStdKg = found?.peso_porc_gramos ? found.peso_porc_gramos / 1000 : 0.35;

    let currentPesoPorc = parseFloat(editPesoPorciones) || 0;
    const und = parseInt(editPorciones) || 0;
    if (und > 0) {
      currentPesoPorc = Number((und * pesoStdKg).toFixed(2));
      setEditPesoPorciones(String(currentPesoPorc));
    }

    const cantKg = parseFloat(editCantKg) || 0;
    const totalKg = cantKg + currentPesoPorc;
    setEditCostoTotal(String(Math.round(totalKg * unitPrice)));
  };

  const handleEditCantKgChange = (newCantKg: string) => {
    setEditCantKg(newCantKg);
    const cantKg = parseFloat(newCantKg) || 0;
    const pesoPorc = parseFloat(editPesoPorciones) || 0;
    const unitPrice = selectedEditInsumo?.costo_unitario_kg || (editingMov?.costo_unitario_kg || 0);
    const totalKg = cantKg + pesoPorc;
    setEditCostoTotal(String(Math.round(totalKg * unitPrice)));
  };

  const handleEditPorcionesChange = (newPorcUnd: string) => {
    setEditPorciones(newPorcUnd);
    const und = parseInt(newPorcUnd) || 0;
    const pesoStdKg = selectedEditInsumo?.peso_porc_gramos ? selectedEditInsumo.peso_porc_gramos / 1000 : 0.35;
    
    let pesoPorc = 0;
    if (und > 0) {
      pesoPorc = Number((und * pesoStdKg).toFixed(2));
      setEditPesoPorciones(String(pesoPorc));
    } else {
      setEditPesoPorciones('0');
    }

    const cantKg = parseFloat(editCantKg) || 0;
    const unitPrice = selectedEditInsumo?.costo_unitario_kg || (editingMov?.costo_unitario_kg || 0);
    const totalKg = cantKg + pesoPorc;
    setEditCostoTotal(String(Math.round(totalKg * unitPrice)));
  };

  const handleEditPesoPorcionesChange = (newPesoPorc: string) => {
    setEditPesoPorciones(newPesoPorc);
    const pesoPorc = parseFloat(newPesoPorc) || 0;
    const cantKg = parseFloat(editCantKg) || 0;
    const unitPrice = selectedEditInsumo?.costo_unitario_kg || (editingMov?.costo_unitario_kg || 0);
    const totalKg = cantKg + pesoPorc;
    setEditCostoTotal(String(Math.round(totalKg * unitPrice)));
  };

  // 🛠️ Modal de Ajuste Rápido por Stock Insuficiente
  const [quickAjusteModal, setQuickAjusteModal] = useState<{
    isOpen: boolean;
    fecha: string;
    insumoId: string | number;
    insumoName: string;
    ubicacion: string;
    ubicacionLabel: string;
    cantidad: number | string;
    motivo: string;
    justificacion: string;
  } | null>(null);
  const [savingQuickAjuste, setSavingQuickAjuste] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

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
      const isPending = m.observaciones?.includes('[PENDIENTE_APROBAR]') || m.usuario?.includes('(Pendiente)');
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
  }, [allPendingMovs.length]);

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
    if (earliestPendingDate && (pendingDateFilter === 'ALL' || !sortedPendingDates.some(d => d.date === pendingDateFilter))) {
      setPendingDateFilter(earliestPendingDate);
    }
  }, [earliestPendingDate]);

  // 4. Filtrar pendientes por la fecha seleccionada en los Badges
  const filteredPendingMovs = useMemo(() => {
    if (pendingDateFilter === 'ALL') return allPendingMovs;
    return allPendingMovs.filter((m) => {
      const d = (m.fecha || m.fecha_hora || '').split('T')[0] || todayStr;
      return d === pendingDateFilter;
    });
  }, [allPendingMovs, pendingDateFilter, todayStr]);

  // 5. Agrupar pendientes por carne y ordenar según secuencia de registro (orden del formato físico)
  const groupedPendingMeats = useMemo(() => {
    const groups = new Map<string, { insumoId: string; carneName: string; insumoObj?: InsumoItem; movs: MovimientoItem[]; minTimestamp: string; firstIndex: number }>();

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

    // Ordenar movimientos DENTRO de cada grupo de carne:
    // 1: ENTRADA_COMPRA
    // 2: PORCIONADO
    // 3: DEVOLUCION_COCINA
    // 4: TRASLADO_COCINA
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

  // 6. Filtrar aprobados por fecha seleccionada en los Badges o selector
  const dateFilteredApproved = useMemo(() => {
    if (!filterDate || filterDate === 'ALL') return approvedMovs;
    return approvedMovs.filter((m) => {
      const mDate = (m.fecha || m.fecha_hora || m.fecha_movimiento || '').split('T')[0];
      return mDate === filterDate;
    });
  }, [approvedMovs, filterDate]);

  // 7. Extraer carnes únicas con movimientos aprobados en esta fecha en orden de registro
  const availableMeats = useMemo(() => {
    const map = new Map<string, { id: string | number; name: string; count: number; minTimestamp: string; firstIndex: number }>();
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

  // 8. Carnes filtradas para el buscador predictivo
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

  // 10. Agrupar movimientos APROBADOS por insumo en la secuencia cronológica de registro (orden del formato físico)
  const groupedApprovedMeats = useMemo(() => {
    const groups = new Map<string, { insumoId: string; carneName: string; categoria?: string; insumoObj?: InsumoItem; movs: MovimientoItem[]; minTimestamp: string; firstIndex: number }>();

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

    // Ordenar movimientos dentro de cada grupo por orden lógico:
    // 1: ENTRADA_COMPRA
    // 2: PORCIONADO
    // 3: DEVOLUCION_COCINA
    // 4: TRASLADO_COCINA
    // 5: AJUSTE_INVENTARIO / OTROS
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

  // 🛠️ Manejador: Auto-Ajustar Inconsistencias y Faltantes de una Fecha
  const handleAutoAjustarDia = async (targetDate: string) => {
    if (!confirm(`🛠️ ¿Deseas aplicar automáticamente los ajustes de inventario necesarios (por error de conteo previo) para subsanar todos los faltantes de stock del día ${targetDate}?\n\nEsta acción registrará las auditorías correspondientes y habilitará la aprobación inmediata del día.`)) return;

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
        alert(data.message || `✅ Todos los movimientos del día ${targetDate} tienen stock suficiente. No se requirieron ajustes.`);
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

  // Manejador: Aprobar Todos los Movimientos de un Día Completo en Orden
  const handleAprobarDia = async (targetDate: string) => {
    if (!confirm(`¿Estás seguro de aprobar TODOS los movimientos pendientes del día ${targetDate} en orden cronológico?`)) return;

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

  // ↺ Manejador: Revertir Todos los Movimientos Aprobados de una Fecha a PENDIENTE
  const handleRevertirDia = async (targetDate: string, count: number) => {
    if (!confirm(`↺ ¿Deseas revertir todos los ${count} movimientos aprobados del día ${targetDate} a estado PENDIENTE?\n\nEl stock de bodega se recalibrará automáticamente para que puedas realizar ajustes o revisiones.`)) return;

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

  // 🗑️ Manejador: Descartar y Eliminar TODOS los Movimientos Pendientes de una Fecha Específica
  const handleDescartarDia = async (targetDate: string, count: number) => {
    if (!confirm(`⚠️ ¿Estás seguro de descartar y eliminar TODOS los ${count} movimientos pendientes del día ${targetDate}?\n\nEsta acción borrará estos registros pendientes para evitar duplicados.`)) return;

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

  // Manejador: Abrir Modal de Edición
  const handleOpenEdit = (m: MovimientoItem) => {
    setEditingMov(m);
    setEditInsumoId(m.insumo_id);
    const movDate = (m.fecha || m.fecha_hora || todayStr).split('T')[0];
    setEditFecha(movDate);
    const cantKgStr = String(m.cant_sin_porcionar_kg || 0);
    const porcStr = String(m.porciones_und || 0);
    const pesoPorcStr = String(m.peso_porciones_kg || 0);
    
    setEditCantKg(cantKgStr);
    setEditPorciones(porcStr);
    setEditPesoPorciones(pesoPorcStr);

    const targetInsumo = insumos.find((i) => String(i.insumo_id) === String(m.insumo_id));
    const unitPrice = targetInsumo?.costo_unitario_kg || m.costo_unitario_kg || 0;
    const totalKg = (parseFloat(cantKgStr) || 0) + (parseFloat(pesoPorcStr) || 0);
    const initialTotal = m.valor_total_movimiento ? m.valor_total_movimiento : Math.round(totalKg * unitPrice);

    setEditCostoTotal(String(initialTotal));
    setEditObs(m.observaciones?.replace(/\[PENDIENTE_APROBAR\]/g, '').trim() || '');
  };

  // Manejador: Guardar Edición
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMov) return;

    setSavingEdit(true);
    try {
      const res = await fetch('/api/bodega/movimientos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EDITAR',
          movimientoId: editingMov.id,
          overrides: {
            insumo_id: editInsumoId,
            fecha: editFecha,
            cant_sin_porcionar_kg: parseFloat(editCantKg) || 0,
            porciones_und: parseInt(editPorciones) || 0,
            peso_porciones_kg: parseFloat(editPesoPorciones) || 0,
            valor_total_movimiento: parseFloat(editCostoTotal) || 0,
            observaciones: editObs,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al actualizar movimiento');

      setEditingMov(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // 🛠️ Manejador: Abrir Modal de Ajuste Rápido por Stock Insuficiente
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
        deficit = parseFloat((Math.max(0, needed - cur)).toFixed(2));
        ubicacion = 'BODEGA_ENTERO';
        ubicacionLabel = 'Bodega Entero (Kg)';
      }
    } else if (tipo === 'PORCIONADO') {
      const cur = stock?.bodega_sin_porc_kg || 0;
      const needed = parseFloat(m.cant_sin_porcionar_kg) || 0;
      deficit = parseFloat((Math.max(0, needed - cur)).toFixed(2));
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
        deficit = parseFloat((Math.max(0, needed - cur)).toFixed(2));
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

  // 🛠️ Manejador: Guardar Ajuste Rápido
  const handleSaveQuickAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAjusteModal) return;

    setSavingQuickAjuste(true);
    try {
      const res = await fetch('/api/bodega/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: quickAjusteModal.fecha,
          insumo_id: quickAjusteModal.insumoId,
          tipo_ajuste: quickAjusteModal.motivo,
          ubicacion: quickAjusteModal.ubicacion,
          cantidad: parseFloat(String(quickAjusteModal.cantidad)) || 0,
          justificacion: quickAjusteModal.justificacion.trim(),
          usuario: 'Administrador',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar ajuste');

      alert('✅ Ajuste de inventario aplicado con éxito. El stock ha sido corregido.');
      setQuickAjusteModal(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingQuickAjuste(false);
    }
  };

  return (
    <div className="space-y-4 font-normal">
      {/* 🗂️ PESTAÑAS PRINCIPALES DEL FEED */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveFeedTab('PENDIENTES')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
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
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
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
              <p className="text-slate-400">Todos los movimientos extraídos por IA o ingresados manualmente han sido formalizados en el stock.</p>
            </div>
          ) : (
            <>
              {/* 🏷️ BADGES DE FILTRO POR FECHA CON BOTÓN ✖ PARA ELIMINAR FECHAS NO DESEADAS */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-500 font-normal mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>Jornadas pendientes:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPendingDateFilter('ALL')}
                  className={`px-3 py-1 rounded-full text-xs font-normal transition-all border ${
                    pendingDateFilter === 'ALL'
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-medium'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Todas las Fechas ({allPendingMovs.length})
                </button>

                {sortedPendingDates.map((item) => {
                  const isLocked = earliestPendingDate ? item.date > earliestPendingDate : false;
                  const isCurrentActive = item.date === earliestPendingDate;
                  const isDeleting = deletingDate === item.date;

                  return (
                    <div
                      key={item.date}
                      className={`px-2.5 py-1 rounded-full text-xs font-normal transition-all border flex items-center gap-1.5 ${
                        pendingDateFilter === item.date
                          ? isLocked
                            ? 'bg-slate-800 border-slate-800 text-white shadow-sm'
                            : 'bg-amber-700 border-amber-700 text-white shadow-sm font-medium'
                          : isLocked
                          ? 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200/70'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-amber-50 hover:border-amber-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setPendingDateFilter(item.date)}
                        className="flex items-center gap-1.5 outline-none cursor-pointer"
                        title={isLocked ? `🔒 Bloqueado: Primero debes aprobar los movimientos del ${earliestPendingDate}` : `Jornada del ${item.date}`}
                      >
                        {isLocked ? <Lock className="w-3 h-3 text-slate-400" /> : <Calendar className="w-3 h-3 text-amber-600" />}
                        <span>{item.date}</span>
                        {isCurrentActive && (
                          <span className="bg-emerald-500 text-white px-1.5 py-0.2 rounded-full text-[9px] font-medium">
                            ACTIVO
                          </span>
                        )}
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isLocked ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-900'}`}>
                          {item.count}
                        </span>
                      </button>

                      {/* ✖ Botón para eliminar los registros pendientes de esta fecha */}
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDescartarDia(item.date, item.count);
                        }}
                        className={`p-0.5 rounded-full transition-colors ml-0.5 cursor-pointer ${
                          pendingDateFilter === item.date
                            ? 'text-amber-200 hover:bg-red-600 hover:text-white'
                            : 'text-slate-400 hover:bg-red-500 hover:text-white'
                        }`}
                        title={`Eliminar y descartar todos los pendientes del ${item.date}`}
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* CUADRO CONTENEDOR DE PENDIENTES AGRUPADOS */}
              <div className="p-4 bg-amber-50/50 border border-amber-200/90 rounded-2xl space-y-3.5 shadow-sm">
                {/* Header del Bloque con Botón de Aprobación Masiva del Día */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-amber-200/60">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-medium text-amber-950">
                        Movimientos Pendientes de Aprobación ({filteredPendingMovs.length})
                      </h3>
                    </div>
                    <p className="text-[11px] text-amber-800 font-normal">
                      {pendingDateFilter !== 'ALL' && earliestPendingDate && pendingDateFilter > earliestPendingDate ? (
                        <span className="text-slate-600 flex items-center gap-1 font-medium">
                          <Lock className="w-3.5 h-3.5 text-slate-500" /> 
                          Esta jornada ({pendingDateFilter}) está bloqueada. Primero debes aprobar el día {earliestPendingDate}.
                        </span>
                      ) : (
                        <span>Secuencia estricta: Compras ➔ Porcionados ➔ Devoluciones ➔ Traslados</span>
                      )}
                    </p>
                  </div>

                  {/* Botones de Acción en Lote de la Fecha Activa */}
                  {earliestPendingDate && (pendingDateFilter === 'ALL' || pendingDateFilter === earliestPendingDate) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={autoAdjustingDate === earliestPendingDate || approvingBatchDate === earliestPendingDate}
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
                        disabled={approvingBatchDate === earliestPendingDate || autoAdjustingDate === earliestPendingDate}
                        onClick={() => handleAprobarDia(earliestPendingDate)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                      >
                        {approvingBatchDate === earliestPendingDate ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-emerald-200" />
                        )}
                        <span>Aprobar Todo el Día {earliestPendingDate} ({sortedPendingDates[0]?.count})</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* GRUPOS POR CARNE */}
                <div className="space-y-4">
                  {groupedPendingMeats.map((group) => {
                    const stock = group.insumoObj;

                    return (
                      <div key={group.insumoId} className="space-y-2">
                        {/* Encabezado del Grupo de Carne con Stock Actual */}
                        <div className="flex items-center justify-between flex-wrap gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-200/70 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="font-medium text-slate-900 text-sm">{group.carneName}</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              ({group.movs.length} movimiento{group.movs.length !== 1 ? 's' : ''})
                            </span>
                          </div>
                          {/* Stock Actual en Bodega */}
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="text-slate-400">Stock Actual en Bodega:</span>
                            <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                              📦 {stock ? `${stock.bodega_porc_und} und (${stock.bodega_porc_kg.toFixed(2)} Kg) / Entero: ${stock.bodega_sin_porc_kg.toFixed(2)} Kg` : 'Sin datos'}
                            </span>
                          </div>
                        </div>

                        {/* Tarjetas de Movimientos de esta Carne */}
                        {(() => {
                          let runningBSinPorc = stock ? parseFloat(String(stock.bodega_sin_porc_kg || 0)) : 0;
                          let runningBPorcUnd = stock ? parseInt(String(stock.bodega_porc_und || 0)) : 0;
                          let runningBPorcKg = stock ? parseFloat(String(stock.bodega_porc_kg || 0)) : 0;
                          let runningCSinPorc = stock ? parseFloat(String(stock.cocina_sin_porc_kg || 0)) : 0;
                          let runningCPorcUnd = stock ? parseInt(String(stock.cocina_porc_und || 0)) : 0;

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-2">
                              {group.movs.map((m: any) => {
                                const tipo = m.tipo_movimiento;
                                const dateStr = (m.fecha || m.fecha_hora || '').split('T')[0];
                                const isLoading = actionLoadingId === m.id;
                                const isDateLocked = earliestPendingDate ? dateStr > earliestPendingDate : false;

                                let typeTag = 'bg-blue-100 text-blue-800 border-blue-200';
                                let typeLabel = '1. ENTRADA COMPRA';
                                let qtyText = `${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;

                                if (tipo === 'PORCIONADO') {
                                  typeTag = 'bg-purple-100 text-purple-800 border-purple-200';
                                  typeLabel = '2. PORCIONADO';
                                  qtyText = `${m.porciones_und || 0} und (${parseFloat(String(m.peso_porciones_kg || 0)).toFixed(2)} Kg)`;
                                } else if (tipo === 'DEVOLUCION_COCINA') {
                                  typeTag = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                                  typeLabel = '3. DEVOLUCIÓN COCINA';
                                  qtyText = m.porciones_und ? `+${m.porciones_und} und` : `+${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
                                } else if (tipo === 'TRASLADO_COCINA') {
                                  typeTag = 'bg-orange-100 text-orange-800 border-orange-200';
                                  typeLabel = '4. TRASLADO COCINA';
                                  qtyText = m.porciones_und ? `${m.porciones_und} und (${parseFloat(String(m.peso_porciones_kg || 0)).toFixed(2)} Kg)` : `${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
                                } else if (tipo === 'BAJA_MERMA' || tipo === 'DESPERDICIO') {
                                  typeTag = 'bg-rose-100 text-rose-800 border-rose-200';
                                  typeLabel = '5. MERMA / BAJA';
                                  qtyText = m.porciones_und ? `-${m.porciones_und} und` : `-${parseFloat(String(m.cant_sin_porcionar_kg || m.merma_kg || 0)).toFixed(2)} Kg`;
                                }

                                // VALIDACIÓN Y COHERENCIA DE STOCK SECUENCIAL
                                let stockImpactHtml = null;
                                let isStockInsufficient = false;

                                const cantKg = parseFloat(String(m.cant_sin_porcionar_kg || 0));
                                const porcUnd = parseInt(String(m.porciones_und || 0));
                                const porcKg = parseFloat(String(m.peso_porciones_kg || 0));

                                if (stock) {
                                  if (tipo === 'ENTRADA_COMPRA') {
                                    const startKg = runningBSinPorc;
                                    runningBSinPorc += cantKg;
                                    stockImpactHtml = (
                                      <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                                        <span className="text-slate-500">Bodega Entero:</span>
                                        <span>{startKg.toFixed(2)} Kg</span>
                                        <span className="text-slate-400">➔</span>
                                        <span className="text-emerald-700 font-medium">
                                          +{cantKg.toFixed(2)} Kg ({runningBSinPorc.toFixed(2)} Kg)
                                        </span>
                                      </div>
                                    );
                                  } else if (tipo === 'PORCIONADO') {
                                    const startKg = runningBSinPorc;
                                    const resultKg = startKg - cantKg;
                                    isStockInsufficient = resultKg < 0;
                                    runningBSinPorc = Math.max(0, resultKg);
                                    runningBPorcUnd += porcUnd;
                                    runningBPorcKg += porcKg;

                                    stockImpactHtml = (
                                      <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                                        <span className="text-slate-500">Bodega Entero:</span>
                                        <span>{startKg.toFixed(2)} Kg</span>
                                        <span className="text-slate-400">➔</span>
                                        <span className={isStockInsufficient ? 'text-red-600 font-medium' : 'text-slate-900 font-medium'}>
                                          {resultKg.toFixed(2)} Kg
                                        </span>
                                        {isStockInsufficient && (
                                          <span className="text-red-600 font-medium bg-red-100 px-1.5 py-0.2 rounded text-[10px]">
                                            ⚠️ Stock insuficiente
                                          </span>
                                        )}
                                      </div>
                                    );
                                  } else if (tipo === 'DEVOLUCION_COCINA') {
                                    if (porcUnd > 0) {
                                      const startUnd = runningBPorcUnd;
                                      runningBPorcUnd += porcUnd;
                                      runningCPorcUnd = Math.max(0, runningCPorcUnd - porcUnd);
                                      stockImpactHtml = (
                                        <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                                          <span className="text-slate-500">Reintegro Bodega:</span>
                                          <span>{startUnd} und</span>
                                          <span className="text-slate-400">➔</span>
                                          <span className="text-emerald-700 font-medium">{runningBPorcUnd} und</span>
                                        </div>
                                      );
                                    } else {
                                      const startKg = runningBSinPorc;
                                      runningBSinPorc += cantKg;
                                      runningCSinPorc = Math.max(0, runningCSinPorc - cantKg);
                                      stockImpactHtml = (
                                        <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                                          <span className="text-slate-500">Reintegro Bodega Entero:</span>
                                          <span>{startKg.toFixed(2)} Kg</span>
                                          <span className="text-slate-400">➔</span>
                                          <span className="text-emerald-700 font-medium">{runningBSinPorc.toFixed(2)} Kg</span>
                                        </div>
                                      );
                                    }
                                  } else if (tipo === 'TRASLADO_COCINA') {
                                    if (porcUnd > 0) {
                                      const startUnd = runningBPorcUnd;
                                      const resultUnd = startUnd - porcUnd;
                                      isStockInsufficient = resultUnd < 0;
                                      runningBPorcUnd = Math.max(0, resultUnd);
                                      runningCPorcUnd += porcUnd;

                                      stockImpactHtml = (
                                        <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                                          <span className="text-slate-500">Bodega:</span>
                                          <span>{startUnd} und</span>
                                          <span className="text-slate-400">➔</span>
                                          <span className={isStockInsufficient ? 'text-red-600 font-medium' : 'text-slate-900 font-medium'}>
                                            {resultUnd} und
                                          </span>
                                          {isStockInsufficient && (
                                            <span className="text-red-600 font-medium bg-red-100 px-1.5 py-0.2 rounded text-[10px]">
                                              ⚠️ Stock insuficiente
                                            </span>
                                          )}
                                        </div>
                                      );
                                    } else {
                                      const startKg = runningBSinPorc;
                                      const resultKg = startKg - cantKg;
                                      isStockInsufficient = resultKg < 0;
                                      runningBSinPorc = Math.max(0, resultKg);
                                      runningCSinPorc += cantKg;

                                      stockImpactHtml = (
                                        <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                                          <span className="text-slate-500">Bodega Entero:</span>
                                          <span>{startKg.toFixed(2)} Kg</span>
                                          <span className="text-slate-400">➔</span>
                                          <span className={isStockInsufficient ? 'text-red-600 font-medium' : 'text-slate-900 font-medium'}>
                                            {resultKg.toFixed(2)} Kg
                                          </span>
                                          {isStockInsufficient && (
                                            <span className="text-red-600 font-medium bg-red-100 px-1.5 py-0.2 rounded text-[10px]">
                                              ⚠️ Stock insuficiente
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }
                                  } else if (tipo === 'BAJA_MERMA' || tipo === 'DESPERDICIO') {
                                    const origen = m.origen || 'BODEGA';
                                    if (origen.includes('PORCIONADO') || porcUnd > 0) {
                                      const startUnd = origen.includes('COCINA') ? runningCPorcUnd : runningBPorcUnd;
                                      const resultUnd = startUnd - porcUnd;
                                      isStockInsufficient = resultUnd < 0;
                                      if (origen.includes('COCINA')) {
                                        runningCPorcUnd = Math.max(0, resultUnd);
                                      } else {
                                        runningBPorcUnd = Math.max(0, resultUnd);
                                      }
                                      stockImpactHtml = (
                                        <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                                          <span className="text-slate-500">Baja en {origen.includes('COCINA') ? 'Cocina' : 'Bodega'}:</span>
                                          <span>{startUnd} und</span>
                                          <span className="text-slate-400">➔</span>
                                          <span className="text-rose-700 font-medium">{Math.max(0, resultUnd)} und</span>
                                        </div>
                                      );
                                    } else {
                                      const startKg = origen.includes('COCINA') ? runningCSinPorc : runningBSinPorc;
                                      const resultKg = startKg - cantKg;
                                      isStockInsufficient = resultKg < 0;
                                      if (origen.includes('COCINA')) {
                                        runningCSinPorc = Math.max(0, resultKg);
                                      } else {
                                        runningBSinPorc = Math.max(0, resultKg);
                                      }
                                      stockImpactHtml = (
                                        <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                                          <span className="text-slate-500">Baja en {origen.includes('COCINA') ? 'Cocina' : 'Bodega'}:</span>
                                          <span>{startKg.toFixed(2)} Kg</span>
                                          <span className="text-slate-400">➔</span>
                                          <span className="text-rose-700 font-medium">{Math.max(0, resultKg).toFixed(2)} Kg</span>
                                        </div>
                                      );
                                    }
                                  }
                                }

                                return (
                                  <div
                                    key={m.id}
                                    className={`p-3 rounded-xl border shadow-sm space-y-2 text-xs font-normal transition-all ${
                                  isDateLocked
                                    ? 'bg-slate-50/70 border-slate-200 opacity-80'
                                    : isStockInsufficient
                                    ? 'bg-red-50/40 border-red-300'
                                    : 'bg-white border-amber-200'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${typeTag}`}>
                                    {typeLabel}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-normal flex items-center gap-1">
                                    {isDateLocked && <Lock className="w-3 h-3 text-slate-400" />}
                                    <span>{dateStr}</span>
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-slate-900 text-xs md:text-sm">
                                    {qtyText}
                                  </span>
                                  {m.valor_total_movimiento ? (
                                    <span className="text-slate-700 font-medium">
                                      $ {formatMoney(m.valor_total_movimiento)}
                                    </span>
                                  ) : null}
                                </div>

                                {/* Impacto en Stock */}
                                {stockImpactHtml}

                                {m.observaciones && (
                                  <p className="text-[11px] text-slate-500 line-clamp-2 pt-0.5">
                                    {m.observaciones.replace(/\[PENDIENTE_APROBAR\]/g, '').trim()}
                                  </p>
                                )}

                                {/* Botones de Acción */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleDescartar(m.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                    title="Descartar movimiento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleOpenEdit(m)}
                                    className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-normal flex items-center gap-1 transition-colors"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Editar</span>
                                  </button>

                                  {/* 🛠️ Botón Ajustar Directo cuando hay stock insuficiente */}
                                  {isStockInsufficient && !isDateLocked && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenQuickAjuste(m, stock, group.carneName)}
                                      className="px-2.5 py-1 text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm transition-all active:scale-95"
                                      title="Ajustar stock faltante por error de conteo para poder aprobar"
                                    >
                                      <Wrench className="w-3 h-3 text-amber-700" />
                                      <span>Ajustar</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    disabled={isLoading || isStockInsufficient || isDateLocked}
                                    onClick={() => handleAprobar(m.id)}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm active:scale-95 transition-all ${
                                      isDateLocked
                                        ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                                        : isStockInsufficient
                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                    title={
                                      isDateLocked
                                        ? `⚠️ Bloqueado: Primero debes aprobar los movimientos del día ${earliestPendingDate}`
                                        : isStockInsufficient
                                        ? 'No se puede aprobar: stock insuficiente en bodega. Usa el botón Ajustar.'
                                        : 'Aprobar movimiento'
                                    }
                                  >
                                    {isDateLocked ? (
                                      <>
                                        <Lock className="w-3 h-3 text-slate-400" />
                                        <span>Bloqueado</span>
                                      </>
                                    ) : isLoading ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Aprobar</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 📜 PESTAÑA 2: KARDEX Y OPERACIONES APROBADAS (AGRUPADO POR INSUMO) */}
      {activeFeedTab === 'HISTORIAL' && (
        <div className="space-y-4 animate-fade-in">
          {/* 📅 Encabezado Superior con Selector de Fecha y Buscador */}
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

            {/* Selector de Fecha para la Línea de Tiempo */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                min={currentPeriodo?.fecha_inicio}
                max={currentPeriodo?.fecha_fin}
                value={filterDate === 'ALL' ? '' : filterDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-normal text-slate-800 bg-white outline-none focus:border-orange-500 shadow-sm"
              />
              {currentPeriodo?.fecha_inicio && todayStr >= currentPeriodo.fecha_inicio && todayStr <= currentPeriodo.fecha_fin && filterDate !== todayStr && (
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

          {/* 🏷️ BADGES DE FILTRO POR FECHA PARA HISTORIAL (CON BOTÓN PARA REVERTIR) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 font-normal mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              <span>Jornadas aprobadas:</span>
            </span>
            <button
              type="button"
              onClick={() => onDateChange('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-normal transition-all border ${
                filterDate === 'ALL' || !filterDate
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-medium'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Historial Completo ({approvedMovs.length})
            </button>

            {sortedApprovedDates.map((item) => {
              const isReverting = revertingDate === item.date;

              return (
                <div
                  key={item.date}
                  className={`px-2.5 py-1 rounded-full text-xs font-normal transition-all border flex items-center gap-1.5 ${
                    filterDate === item.date
                      ? 'bg-orange-600 border-orange-600 text-white shadow-sm font-medium'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-orange-50 hover:border-orange-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onDateChange(item.date)}
                    className="flex items-center gap-1.5 outline-none cursor-pointer"
                  >
                    <Calendar className="w-3 h-3 text-orange-500" />
                    <span>{item.date}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterDate === item.date ? 'bg-orange-800 text-white' : 'bg-orange-100 text-orange-900'}`}>
                      {item.count}
                    </span>
                  </button>

                  {/* ↺ Botón para Revertir Jornada Aprobada a Pendiente */}
                  <button
                    type="button"
                    disabled={isReverting}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRevertirDia(item.date, item.count);
                    }}
                    className={`p-0.5 rounded-full transition-colors ml-0.5 cursor-pointer ${
                      filterDate === item.date
                        ? 'text-orange-200 hover:bg-orange-800 hover:text-white'
                        : 'text-slate-400 hover:bg-slate-200 hover:text-slate-800'
                    }`}
                    title={`↺ Deshacer aprobación del día ${item.date} y volver a estado pendiente`}
                  >
                    {isReverting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

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

          {/* 📦 LISTA DE MOVIMIENTOS APROBADOS AGRUPADOS POR INSUMO */}
          <div className="space-y-4">
            {groupedApprovedMeats.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-normal text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No hay movimientos aprobados registrados para esta fecha y criterio de búsqueda.
              </div>
            ) : (
              groupedApprovedMeats.map((group) => {
                const stock = group.insumoObj;

                return (
                  <div key={group.insumoId} className="space-y-2 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                    {/* Encabezado del Insumo */}
                    <div className="flex items-center justify-between flex-wrap gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                        <span className="font-medium text-slate-900 text-sm">{group.carneName}</span>
                        {group.categoria && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                            {group.categoria}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-normal">
                          • {group.movs.length} movimiento{group.movs.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Stock Actual */}
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="text-slate-400">Stock Actual:</span>
                        <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          📦 {stock ? `${stock.bodega_porc_und} und (${stock.bodega_porc_kg.toFixed(2)} Kg) / Entero: ${stock.bodega_sin_porc_kg.toFixed(2)} Kg` : 'Sin datos'}
                        </span>
                      </div>
                    </div>

                    {/* Tarjetas de Movimientos Aprobados de este Insumo en Orden Lógico */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-1">
                      {group.movs.map((m: any) => {
                        const tipo = m.tipo_movimiento;
                        const timeStr = m.fecha_hora ? new Date(m.fecha_hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

                        let typeTag = 'bg-blue-100 text-blue-800 border-blue-200';
                        let typeLabel = '1. ENTRADA COMPRA';
                        let qtyText = `${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;

                        if (tipo === 'PORCIONADO') {
                          typeTag = 'bg-purple-100 text-purple-800 border-purple-200';
                          typeLabel = '2. PORCIONADO';
                          qtyText = `${m.porciones_und || 0} und (${parseFloat(String(m.peso_porciones_kg || 0)).toFixed(2)} Kg)`;
                        } else if (tipo === 'DEVOLUCION_COCINA') {
                          typeTag = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                          typeLabel = '3. DEVOLUCIÓN COCINA';
                          qtyText = m.porciones_und ? `+${m.porciones_und} und` : `+${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
                        } else if (tipo === 'TRASLADO_COCINA') {
                          typeTag = 'bg-orange-100 text-orange-800 border-orange-200';
                          typeLabel = '4. TRASLADO COCINA';
                          qtyText = m.porciones_und ? `${m.porciones_und} und (${parseFloat(String(m.peso_porciones_kg || 0)).toFixed(2)} Kg)` : `${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
                        } else if (tipo === 'AJUSTE_INVENTARIO') {
                          typeTag = 'bg-amber-100 text-amber-900 border-amber-200';
                          typeLabel = '5. AJUSTE DE INVENTARIO';
                          qtyText = m.porciones_und ? `${m.porciones_und} und` : `${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
                        } else if (tipo === 'INVENTARIO_INICIAL') {
                          typeTag = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                          typeLabel = '📦 APERTURA INICIAL';
                          qtyText = m.porciones_und ? `${m.porciones_und} und (${parseFloat(String(m.peso_porciones_kg || 0)).toFixed(2)} Kg)` : `${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
                        }

                        return (
                          <div
                            key={m.id}
                            className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs font-normal"
                          >
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${typeTag}`}>
                                {typeLabel}
                              </span>
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <span>{m.usuario || 'Bodeguero'}</span>
                                <span>•</span>
                                <span>{timeStr || m.fecha}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-900 text-xs md:text-sm">
                                {qtyText}
                              </span>
                              {m.valor_total_movimiento ? (
                                <span className="text-slate-800 font-medium">
                                  $ {formatMoney(m.valor_total_movimiento)}
                                </span>
                              ) : null}
                            </div>

                            {m.observaciones && (
                              <p className="text-[11px] text-slate-600 line-clamp-2 pt-0.5 border-t border-slate-100 mt-1">
                                {m.observaciones.replace(/\[PENDIENTE_APROBAR\]/g, '').trim()}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 📝 MODAL DE EDICIÓN DE MOVIMIENTO PENDIENTE */}
      <Modal
        isOpen={!!editingMov}
        onClose={() => setEditingMov(null)}
        title="Editar Movimiento Pendiente"
        icon={<Edit2 className="w-5 h-5 text-orange-500" />}
        maxWidth="max-w-md"
      >
        {editingMov && (
          <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs font-normal">
            {/* 1. Selector de Fecha del Movimiento y Materia Prima */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" />
                  <span>Fecha de la Jornada</span>
                </label>
                <input
                  type="date"
                  required
                  min={currentPeriodo?.fecha_inicio}
                  max={currentPeriodo?.fecha_fin}
                  value={editFecha}
                  onChange={(e) => setEditFecha(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Materia Prima / Insumo</label>
                <select
                  value={editInsumoId}
                  onChange={(e) => handleEditInsumoChange(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white font-medium cursor-pointer"
                >
                  {insumos.map((i) => (
                    <option key={i.insumo_id} value={i.insumo_id}>
                      {(i as any).nombre_insumo || i.insumo || `Insumo #${i.insumo_id}`} ({i.categoria})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 🏷️ Indicador de Precio Unitario y Rendimiento del Catálogo */}
            {selectedEditInsumo && (
              <div className="grid grid-cols-2 gap-2 bg-orange-50/70 border border-orange-200/80 rounded-lg p-2.5 text-slate-700 shadow-sm">
                <div>
                  <span className="text-[10px] text-slate-500 font-normal block">Precio Unitario Catálogo:</span>
                  <span className="font-semibold text-slate-900 text-xs">
                    $ {formatMoney(selectedEditInsumo.costo_unitario_kg || 0)} <span className="text-[10px] font-normal text-slate-500">/ Kg</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-normal block">Rendimiento por Porción:</span>
                  <span className="font-semibold text-slate-900 text-xs">
                    {selectedEditInsumo.peso_porc_gramos || 350} <span className="text-[10px] font-normal text-slate-500">g ({(selectedEditInsumo.peso_porc_gramos ? selectedEditInsumo.peso_porc_gramos / 1000 : 0.35).toFixed(3)} Kg)</span>
                  </span>
                </div>
              </div>
            )}

            {/* 2. Inputs de Kilos (Entero) y Porciones (Und) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Kilos (Entero)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editCantKg}
                  onChange={(e) => handleEditCantKgChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Porciones (Und)</label>
                <input
                  type="number"
                  step="1"
                  value={editPorciones}
                  onChange={(e) => handleEditPorcionesChange(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
                />
              </div>
            </div>

            {/* 3. Inputs de Peso Porciones (Kg) y Valor Total ($) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  <span>Peso Porciones (Kg)</span>
                  {parseInt(editPorciones) > 0 && (
                    <span className="text-[10px] text-orange-600 font-normal ml-1">(Sugerido)</span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editPesoPorciones}
                  onChange={(e) => handleEditPesoPorcionesChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  <span>Valor Total ($)</span>
                  <span className="text-[10px] text-emerald-600 font-normal ml-1">(Calculado)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={editCostoTotal}
                  onChange={(e) => setEditCostoTotal(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-900 font-semibold bg-slate-50/50"
                />
              </div>
            </div>

            {/* 4. Observaciones */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Observaciones</label>
              <input
                type="text"
                value={editObs}
                onChange={(e) => setEditObs(e.target.value)}
                placeholder="Detalle u observación..."
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
              />
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingMov(null)}
                className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-normal cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-1.5 text-xs text-white bg-orange-500 hover:bg-orange-600 rounded-lg font-medium shadow-sm transition-all cursor-pointer"
              >
                {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* 🛠️ MODAL DE AJUSTE RÁPIDO POR STOCK INSUFICIENTE */}
      <Modal
        isOpen={!!quickAjusteModal}
        onClose={() => setQuickAjusteModal(null)}
        title="Ajuste Rápido de Stock por Error de Conteo"
        icon={<Wrench className="w-5 h-5 text-amber-600" />}
        maxWidth="max-w-md"
      >
        {quickAjusteModal && (
          <form onSubmit={handleSaveQuickAjuste} className="space-y-3 text-xs font-normal">
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-slate-700 text-[11px] space-y-1">
              <span className="font-medium text-amber-950 block">💡 Ajuste automático sugerido</span>
              <p>
                Se aplicará un ingreso de stock necesario en <strong>{quickAjusteModal.ubicacionLabel}</strong> para que puedas aprobar este movimiento sin descuadres.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>Fecha a Ajustar</span>
                </label>
                <input
                  type="date"
                  required
                  min={currentPeriodo?.fecha_inicio}
                  max={currentPeriodo?.fecha_fin}
                  value={quickAjusteModal.fecha}
                  onChange={(e) => setQuickAjusteModal({ ...quickAjusteModal, fecha: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-800 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Materia Prima / Carne</label>
                <input
                  type="text"
                  disabled
                  value={quickAjusteModal.insumoName}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Ubicación</label>
                <select
                  value={quickAjusteModal.ubicacion}
                  onChange={(e) => setQuickAjusteModal({ ...quickAjusteModal, ubicacion: e.target.value })}
                  className="w-full h-8 px-2 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-800 bg-white"
                >
                  <option value="BODEGA_PORCIONADO">Bodega (Und)</option>
                  <option value="BODEGA_ENTERO">Bodega (Kg)</option>
                  <option value="COCINA_PORCIONADO">Cocina (Und)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Cantidad a Ajustar (+)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={quickAjusteModal.cantidad}
                  onChange={(e) => setQuickAjusteModal({ ...quickAjusteModal, cantidad: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-900 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Motivo Tipificado</label>
              <select
                value={quickAjusteModal.motivo}
                onChange={(e) => setQuickAjusteModal({ ...quickAjusteModal, motivo: e.target.value })}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-800 bg-white"
              >
                <option value="ERROR_CONTEO_PREVIO">Corrección por Error de Conteo</option>
                <option value="MERMA_POR_DESCONGELACION">Merma por Descongelación</option>
                <option value="DETERIORO_CALIDAD">Deterioro de Calidad / Descarte</option>
                <option value="DONACION_O_DEGUSTACION">Donación o Muestra Comercial</option>
                <option value="CONSUMO_INTERNO">Consumo Interno / Pruebas</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Justificación / Observaciones</label>
              <input
                type="text"
                required
                value={quickAjusteModal.justificacion}
                onChange={(e) => setQuickAjusteModal({ ...quickAjusteModal, justificacion: e.target.value })}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickAjusteModal(null)}
                className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-normal"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingQuickAjuste}
                className="px-4 py-1.5 text-xs text-white bg-amber-600 hover:bg-amber-700 rounded-lg font-medium shadow-sm transition-all flex items-center gap-1"
              >
                {savingQuickAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Guardar Ajuste y Actualizar</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
