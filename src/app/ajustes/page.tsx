'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, 
  Search, 
  Filter, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Loader2, 
  Plus, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Layers,
  Scale,
  DollarSign
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';
import { usePeriodo } from '@/context/PeriodoContext';

interface AjusteItem {
  id: string;
  fecha: string;
  fechaHora: string;
  insumoId: number | string;
  insumoNombre: string;
  categoria: string;
  origen: string;
  destino: string;
  ubicacion: string;
  tipoAjuste: string;
  isEntrada: boolean;
  cantidadKg: number;
  porcionesUnd: number;
  pesoPorcionesKg: number;
  mermaKg: number;
  costoUnitarioKg: number;
  valorTotal: number;
  justificacion: string;
  observaciones: string;
  usuario: string;
  saldoAnteriorBodegaKg?: number;
  saldoNuevoBodegaKg?: number;
  saldoAnteriorPorcUnd?: number;
  saldoNuevoPorcUnd?: number;
  saldoAnteriorCocinaUnd?: number;
  saldoNuevoCocinaUnd?: number;
}

type SortField = 'fecha' | 'insumoNombre' | 'ubicacion' | 'tipoAjuste' | 'valorTotal';

export default function AjustesPage() {
  const { currentPeriodo } = usePeriodo();
  const [ajustes, setAjustes] = useState<AjusteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('ALL');
  const [filterUbicacion, setFilterUbicacion] = useState<string>('ALL');
  const [filterFecha, setFilterFecha] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('fecha');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modal para Ajuste Manual
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [catalogoInsumos, setCatalogoInsumos] = useState<any[]>([]);
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formInsumoId, setFormInsumoId] = useState('');
  const [formTipoAjuste, setFormTipoAjuste] = useState('ERROR_CONTEO_PREVIO');
  const [formUbicacion, setFormUbicacion] = useState('BODEGA_PORCIONADO');
  const [formCantidad, setFormCantidad] = useState('');
  const [formJustificacion, setFormJustificacion] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAjustes = async () => {
    try {
      setLoading(true);
      let url = `/api/bodega/ajustes?t=${Date.now()}`;
      if (currentPeriodo?.fecha_inicio && currentPeriodo?.fecha_fin) {
        url += `&fechaInicio=${currentPeriodo.fecha_inicio}&fechaFin=${currentPeriodo.fecha_fin}`;
      }
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data.data) {
        setAjustes(data.data);
      }
    } catch (e) {
      console.error('Error cargando ajustes:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogo = async () => {
    try {
      const res = await fetch('/api/catalogo?t=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      if (data.data) setCatalogoInsumos(data.data);
    } catch (e) {
      console.warn('Error cargando catálogo:', e);
    }
  };

  useEffect(() => {
    loadAjustes();
  }, [currentPeriodo?.id, currentPeriodo?.fecha_inicio, currentPeriodo?.fecha_fin]);

  useEffect(() => {
    loadCatalogo();
  }, []);

  // Fechas únicas para selector
  const uniqueDates = useMemo(() => {
    const set = new Set<string>();
    ajustes.forEach((a) => {
      if (a.fecha) set.add(a.fecha);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [ajustes]);

  // Métricas / KPIs
  const kpis = useMemo(() => {
    const totalCount = ajustes.length;
    let totalPesos = 0;
    let totalEntradasPesos = 0;
    let totalMermasPesos = 0;

    ajustes.forEach((a) => {
      const val = a.valorTotal || 0;
      totalPesos += val;
      if (a.isEntrada) {
        totalEntradasPesos += val;
      } else {
        totalMermasPesos += val;
      }
    });

    return {
      totalCount,
      totalPesos,
      totalEntradasPesos,
      totalMermasPesos,
    };
  }, [ajustes]);

  // Filtrado
  const filteredAjustes = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);
    return ajustes.filter((a) => {
      if (cleanSearch) {
        const ins = normalizeStr(a.insumoNombre);
        const mot = normalizeStr(a.justificacion || '');
        const usr = normalizeStr(a.usuario || '');
        const matchesSearch = ins.includes(cleanSearch) || mot.includes(cleanSearch) || usr.includes(cleanSearch);
        if (!matchesSearch) return false;
      }

      if (filterTipo !== 'ALL' && !a.tipoAjuste.toUpperCase().includes(filterTipo.toUpperCase())) {
        return false;
      }

      if (filterUbicacion !== 'ALL' && a.ubicacion !== filterUbicacion) {
        return false;
      }

      if (filterFecha !== 'ALL' && a.fecha !== filterFecha) {
        return false;
      }

      return true;
    });
  }, [ajustes, searchQuery, filterTipo, filterUbicacion, filterFecha]);

  // Ordenamiento
  const sortedAjustes = useMemo(() => {
    const list = [...filteredAjustes];
    list.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      }
      return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
    return list;
  }, [filteredAjustes, sortField, sortAsc]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sortedAjustes.length / itemsPerPage));
  const paginatedAjustes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAjustes.slice(start, start + itemsPerPage);
  }, [sortedAjustes, currentPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleSaveManualAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formInsumoId || !formCantidad || !formJustificacion.trim()) {
      alert('Por favor completa todos los campos requeridos.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/bodega/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AJUSTAR_MANUAL',
          fecha: formFecha,
          insumo_id: formInsumoId,
          tipo_ajuste: formTipoAjuste,
          ubicacion: formUbicacion,
          cantidad: parseFloat(formCantidad),
          justificacion: formJustificacion.trim(),
          usuario: 'Administrador',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar ajuste');

      alert('✅ Ajuste de inventario guardado exitosamente.');
      setIsModalOpen(false);
      setFormInsumoId('');
      setFormCantidad('');
      setFormJustificacion('');
      await loadAjustes();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-12 animate-fade-in text-slate-800">
      {/* 🏷️ HEADER DE LA VISTA */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-slate-900 tracking-tight">
              Inconsistencias y Ajustes de Inventario
            </h2>
            {currentPeriodo && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/70 rounded-lg text-xs font-semibold">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                Periodo: {currentPeriodo.nombre || `${currentPeriodo.fecha_inicio} a ${currentPeriodo.fecha_fin}`}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-normal">
            Auditoría, trazabilidad y control de ajustes aplicados por errores de conteo, mermas y conciliación de stock.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            if (currentPeriodo?.fecha_inicio && currentPeriodo?.fecha_fin) {
              if (today >= currentPeriodo.fecha_inicio && today <= currentPeriodo.fecha_fin) {
                setFormFecha(today);
              } else {
                setFormFecha(currentPeriodo.fecha_fin || currentPeriodo.fecha_inicio);
              }
            } else {
              setFormFecha(today);
            }
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-medium flex items-center gap-2 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4 text-slate-300" />
          <span>Registrar Ajuste Manual</span>
        </button>
      </div>

      {/* 📊 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Ajustes Aplicados</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight">{kpis.totalCount}</p>
          <p className="text-[11px] text-slate-400 font-normal">Eventos registrados en auditoría</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Impacto Económico Total</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight">$ {formatMoney(kpis.totalPesos)}</p>
          <p className="text-[11px] text-slate-400 font-normal">Valor monetario absoluto auditado</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Conciliaciones de Conteo</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-700 tracking-tight">$ {formatMoney(kpis.totalEntradasPesos)}</p>
          <p className="text-[11px] text-slate-400 font-normal">Faltantes corregidos para aprobación</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Mermas y Deterioros</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-bold text-rose-700 tracking-tight">$ {formatMoney(kpis.totalMermasPesos)}</p>
          <p className="text-[11px] text-slate-400 font-normal">Bajas por descongelación o merma</p>
        </div>
      </div>

      {/* 🔍 FILTROS Y BÚSQUEDA */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Buscador */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por insumo, motivo, justificación o usuario..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Filtros Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de Jornada */}
          <select
            value={filterFecha}
            onChange={(e) => {
              setFilterFecha(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">📅 Todas las Fechas</option>
            {uniqueDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Selector de Motivo */}
          <select
            value={filterTipo}
            onChange={(e) => {
              setFilterTipo(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">🏷️ Todos los Motivos</option>
            <option value="ERROR_CONTEO_PREVIO">Error de Conteo Previo</option>
            <option value="MERMA_POR_DESCONGELACION">Merma por Descongelación</option>
            <option value="DETERIORO_CALIDAD">Deterioro de Calidad</option>
            <option value="AJUSTE_MANUAL">Ajuste Manual</option>
          </select>

          {/* Selector de Ubicación */}
          <select
            value={filterUbicacion}
            onChange={(e) => {
              setFilterUbicacion(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">📍 Todas las Ubicaciones</option>
            <option value="BODEGA_ENTERO">Bodega Entero (Kg)</option>
            <option value="BODEGA_PORCIONADO">Bodega Porcionado (Und)</option>
            <option value="COCINA_PORCIONADO">Cocina (Und)</option>
          </select>
        </div>
      </div>

      {/* 📋 TABLA DETALLADA DE AJUSTES */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-normal">Cargando registros de auditoría...</p>
          </div>
        ) : paginatedAjustes.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-600">No se encontraron ajustes con los filtros seleccionados.</p>
            <p className="text-xs text-slate-400">El inventario se encuentra cuadrado o no coincide con la búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-medium">
                  <th onClick={() => handleSort('fecha')} className="p-3.5 pl-5 cursor-pointer hover:text-slate-800 transition-colors whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>FECHA / HORA</span>
                      {sortField === 'fecha' ? (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('insumoNombre')} className="p-3.5 cursor-pointer hover:text-slate-800 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span>MATERIA PRIMA</span>
                      {sortField === 'insumoNombre' ? (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('ubicacion')} className="p-3.5 cursor-pointer hover:text-slate-800 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span>UBICACIÓN</span>
                      {sortField === 'ubicacion' ? (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th onClick={() => handleSort('tipoAjuste')} className="p-3.5 cursor-pointer hover:text-slate-800 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span>MOTIVO / TIPO</span>
                      {sortField === 'tipoAjuste' ? (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th className="p-3.5 text-right">CANT. AJUSTADA</th>
                  <th className="p-3.5 text-right">COSTO UNIT.</th>
                  <th onClick={() => handleSort('valorTotal')} className="p-3.5 text-right cursor-pointer hover:text-slate-800 transition-colors">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>IMPACTO TOTAL</span>
                      {sortField === 'valorTotal' ? (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th className="p-3.5 pr-5">JUSTIFICACIÓN Y USUARIO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAjustes.map((item) => {
                  const isPositive = item.isEntrada;
                  const ubiLabel = item.ubicacion === 'BODEGA_ENTERO' ? 'Bodega Entero' : item.ubicacion === 'BODEGA_PORCIONADO' ? 'Bodega Porciones' : 'Cocina';

                  const cantStr = item.porcionesUnd > 0 ? `${item.porcionesUnd} und (${item.pesoPorcionesKg.toFixed(2)} Kg)` : `${item.cantidadKg.toFixed(2)} Kg`;

                  const isErrorConteo = item.tipoAjuste.includes('ERROR_CONTEO') || item.tipoAjuste.includes('CONTEO');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors font-normal text-slate-700">
                      {/* Fecha / Hora */}
                      <td className="p-3.5 pl-5 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{item.fecha}</div>
                        <div className="text-[10px] text-slate-400">
                          {item.fechaHora ? new Date(item.fechaHora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </div>
                      </td>

                      {/* Materia Prima */}
                      <td className="p-3.5">
                        <div className="font-medium text-slate-900">{item.insumoNombre}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{item.categoria}</div>
                      </td>

                      {/* Ubicación */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {ubiLabel}
                        </span>
                      </td>

                      {/* Motivo / Tipo */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            isErrorConteo
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {isErrorConteo ? 'Error de Conteo Previo' : item.tipoAjuste.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Cant. Ajustada */}
                      <td className="p-3.5 text-right whitespace-nowrap font-medium">
                        <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                          {isPositive ? `+${cantStr}` : `-${cantStr}`}
                        </span>
                      </td>

                      {/* Costo Unit. */}
                      <td className="p-3.5 text-right whitespace-nowrap text-slate-500">
                        $ {formatMoney(item.costoUnitarioKg)} / Kg
                      </td>

                      {/* Impacto Total */}
                      <td className="p-3.5 text-right whitespace-nowrap font-semibold text-slate-900">
                        $ {formatMoney(item.valorTotal)}
                      </td>

                      {/* Justificación y Usuario */}
                      <td className="p-3.5 pr-5 max-w-xs">
                        <p className="text-[11px] text-slate-600 line-clamp-2" title={item.justificacion}>
                          {item.justificacion}
                        </p>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Por: <span className="font-medium text-slate-600">{item.usuario}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Mostrando página <strong className="text-slate-800">{currentPage}</strong> de <strong className="text-slate-800">{totalPages}</strong> ({sortedAjustes.length} ajustes totales)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🛠️ MODAL DE REGISTRO DE AJUSTE MANUAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="🛠️ Registrar Ajuste Manual de Inventario"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveManualAjuste} className="space-y-4 text-xs font-normal">
          <p className="text-slate-500 text-[11px]">
            Este formulario formaliza un ajuste de auditoría en la base de datos y recalibra el stock disponible de inmediato.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Fecha del Ajuste</span>
              </label>
              <input
                type="date"
                required
                value={formFecha}
                onChange={(e) => setFormFecha(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Materia Prima / Insumo</label>
              <select
                required
                value={formInsumoId}
                onChange={(e) => setFormInsumoId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="">Selecciona un insumo...</option>
                {catalogoInsumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.categoria})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Ubicación a Ajustar</label>
              <select
                value={formUbicacion}
                onChange={(e) => setFormUbicacion(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
              >
                <option value="BODEGA_PORCIONADO">Bodega Porcionado (Und)</option>
                <option value="BODEGA_ENTERO">Bodega Entero (Kg)</option>
                <option value="COCINA_PORCIONADO">Cocina Porcionado (Und)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Motivo Tipificado</label>
              <select
                value={formTipoAjuste}
                onChange={(e) => setFormTipoAjuste(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
              >
                <option value="ERROR_CONTEO_PREVIO">Error de Conteo Previo (+)</option>
                <option value="MERMA_POR_DESCONGELACION">Merma por Descongelación (-)</option>
                <option value="DETERIORO_CALIDAD">Deterioro de Calidad (-)</option>
                <option value="AJUSTE_AUDITORIA">Ajuste de Auditoría General</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Cantidad a Ajustar ({formUbicacion === 'BODEGA_ENTERO' ? 'Kg' : 'Unidades'})
            </label>
            <input
              type="number"
              step="any"
              required
              placeholder={formUbicacion === 'BODEGA_ENTERO' ? 'Ej. 5.5' : 'Ej. 10'}
              value={formCantidad}
              onChange={(e) => setFormCantidad(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Justificación y Observación</label>
            <textarea
              required
              rows={3}
              placeholder="Explica detalladamente la causa de la inconsistencia o el conteo físico..."
              value={formJustificacion}
              onChange={(e) => setFormJustificacion(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={saving}
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
              <span>Guardar y Aplicar Ajuste</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
