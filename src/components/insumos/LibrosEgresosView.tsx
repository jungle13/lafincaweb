'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  X, 
  Filter, 
  Loader2, 
  PlusCircle, 
  MinusCircle,
  HelpCircle,
  FileText,
  Calendar,
  Building
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { 
  RegistroCajaMenor, 
  RegistroCuadernoArturo, 
  CajaMenorKPIs, 
  CuadernoArturoKPIs 
} from '@/services/librosEgresosService';

interface Props {
  periodoId: string;
}

export default function LibrosEgresosView({ periodoId }: Props) {
  const [activeLibro, setActiveLibro] = useState<'CAJA' | 'ARTURO'>('CAJA');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Datos Caja Menor
  const [cajaRegistros, setCajaRegistros] = useState<RegistroCajaMenor[]>([]);
  const [cajaKpis, setCajaKpis] = useState<CajaMenorKPIs>({
    totalCaja: 0,
    totalCruzadoFactura: 0,
    totalSinFactura: 0,
    totalIncluidosCosteo: 0,
    totalRegistros: 0,
  });
  const [responsables, setResponsables] = useState<string[]>([]);
  const [filtroResponsable, setFiltroResponsable] = useState('ALL');
  const [filtroEstadoCaja, setFiltroEstadoCaja] = useState('ALL');

  // Datos Cuaderno Arturo
  const [arturoRegistros, setArturoRegistros] = useState<RegistroCuadernoArturo[]>([]);
  const [arturoKpis, setArturoKpis] = useState<CuadernoArturoKPIs>({
    totalArturo: 0,
    totalConciliadoExacto: 0,
    totalDirectoManual: 0,
    totalDiferencias: 0,
    totalRegistros: 0,
  });
  const [filtroEstadoArturo, setFiltroEstadoArturo] = useState('ALL');

  // Buscador común
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('periodo_id', periodoId);
      params.set('libro', activeLibro);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      if (activeLibro === 'CAJA') {
        if (filtroResponsable !== 'ALL') params.set('responsable', filtroResponsable);
        if (filtroEstadoCaja !== 'ALL') params.set('estado', filtroEstadoCaja);
      } else {
        if (filtroEstadoArturo !== 'ALL') params.set('estado', filtroEstadoArturo);
      }

      const res = await fetch(`/api/libros-egresos?${params.toString()}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();

      if (json.success) {
        if (activeLibro === 'CAJA') {
          setCajaRegistros(json.registros || []);
          if (json.kpis) setCajaKpis(json.kpis);
          if (json.responsables) setResponsables(json.responsables);
        } else {
          setArturoRegistros(json.registros || []);
          if (json.kpis) setArturoKpis(json.kpis);
        }
      }
    } catch (err) {
      console.error('Error cargando libros de egresos:', err);
    } finally {
      setLoading(false);
    }
  }, [periodoId, activeLibro, searchQuery, filtroResponsable, filtroEstadoCaja, filtroEstadoArturo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Manejador para Alternar Inclusión en Costeo (Caja Menor)
  const handleToggleCaja = async (r: RegistroCajaMenor) => {
    const nuevoEstado = !r.incluido_en_costeo;
    setActionLoadingId(r.id);
    try {
      const res = await fetch('/api/libros-egresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_CAJA',
          id: r.id,
          incluir: nuevoEstado,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Error al actualizar registro');

      // Actualizar en memoria
      setCajaRegistros((prev) =>
        prev.map((item) => (item.id === r.id ? { ...item, incluido_en_costeo: nuevoEstado } : item))
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Manejador para Alternar Inclusión en Costeo (Cuaderno Arturo)
  const handleToggleArturo = async (r: RegistroCuadernoArturo) => {
    const nuevoEstado = !r.incluido_en_costeo;
    setActionLoadingId(r.id);
    try {
      const res = await fetch('/api/libros-egresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_ARTURO',
          id: r.id,
          incluir: nuevoEstado,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Error al actualizar registro');

      setArturoRegistros((prev) =>
        prev.map((item) => (item.id === r.id ? { ...item, incluido_en_costeo: nuevoEstado } : item))
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-normal">
      {/* 1. Selector Superior de Libro (Caja Menor vs Cuaderno Arturo) */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveLibro('CAJA')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeLibro === 'CAJA'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>Libro de Caja Menor (Turnos & Auxiliares)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveLibro('ARTURO')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeLibro === 'ARTURO'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Libro Principal (Cuaderno Don Arturo)</span>
          </button>
        </div>

        <div className="text-right text-[11px] text-slate-400">
          Conciliación automática contra facturas oficiales para evitar doble conteo
        </div>
      </div>

      {/* 2. Tarjetas de KPIs según el Libro Activo */}
      {activeLibro === 'CAJA' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Egresos Caja Menor</span>
            <div className="text-lg md:text-xl font-bold text-slate-900 mt-1">
              $ {formatMoney(cajaKpis.totalCaja)}
            </div>
            <span className="text-[11px] text-slate-400">{cajaKpis.totalRegistros} salidas registradas</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
            <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Cruzado con Facturas</span>
            <div className="text-lg md:text-xl font-bold text-emerald-700 mt-1">
              $ {formatMoney(cajaKpis.totalCruzadoFactura)}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">Ya tiene soporte &bull; No duplica</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
            <span className="text-[10px] text-amber-800 uppercase font-semibold block">Gastos sin Factura (Plaza/Taxis)</span>
            <div className="text-lg md:text-xl font-bold text-amber-900 mt-1">
              $ {formatMoney(cajaKpis.totalSinFactura)}
            </div>
            <span className="text-[11px] text-amber-700">Efectivo operativo real</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-indigo-200 shadow-2xs">
            <span className="text-[10px] text-indigo-800 uppercase font-semibold block">Sumado al Costeo General</span>
            <div className="text-lg md:text-xl font-bold text-indigo-900 mt-1">
              $ {formatMoney(cajaKpis.totalIncluidosCosteo)}
            </div>
            <span className="text-[11px] text-indigo-600 font-medium">Aprobado para informe total</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Cuaderno Don Arturo</span>
            <div className="text-lg md:text-xl font-bold text-slate-900 mt-1">
              $ {formatMoney(arturoKpis.totalArturo)}
            </div>
            <span className="text-[11px] text-slate-400">{arturoKpis.totalRegistros} renglones manuscritos</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
            <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Coincide con Facturas</span>
            <div className="text-lg md:text-xl font-bold text-emerald-700 mt-1">
              $ {formatMoney(arturoKpis.totalConciliadoExacto)}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">Conciliación plena 100%</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-2xs">
            <span className="text-[10px] text-blue-800 uppercase font-semibold block">Desembolso Directo (Sin Factura)</span>
            <div className="text-lg md:text-xl font-bold text-blue-900 mt-1">
              $ {formatMoney(arturoKpis.totalDirectoManual)}
            </div>
            <span className="text-[11px] text-blue-600 font-medium">Ingresado a costeo general</span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
            <span className="text-[10px] text-amber-800 uppercase font-semibold block">Diferencias de Auditoría</span>
            <div className="text-lg md:text-xl font-bold text-amber-900 mt-1">
              $ {formatMoney(arturoKpis.totalDiferencias)}
            </div>
            <span className="text-[11px] text-amber-700 font-medium">Revisión requerida</span>
          </div>
        </div>
      )}

      {/* 3. Filtros y Búsqueda */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeLibro === 'CAJA'
                ? 'Buscar por ítem, responsable, comprobante...'
                : 'Buscar por ítem del cuaderno, soporte...'
            }
            className="w-full h-8 pl-8 pr-8 text-xs rounded-xl border border-slate-300 outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros específicos de Caja Menor */}
        {activeLibro === 'CAJA' && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filtroResponsable}
              onChange={(e) => setFiltroResponsable(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-slate-300 text-slate-700 bg-white text-xs outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="ALL">Todos los Responsables ({responsables.length})</option>
              {responsables.map((resp) => (
                <option key={resp} value={resp}>
                  {resp}
                </option>
              ))}
            </select>

            <select
              value={filtroEstadoCaja}
              onChange={(e) => setFiltroEstadoCaja(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-slate-300 text-slate-700 bg-white text-xs outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="CRUZADO_CON_FACTURA">✓ Cruzado con Factura</option>
              <option value="PENDIENTE_CONCILIAR">✕ Sin Factura (Efectivo)</option>
            </select>
          </div>
        )}

        {/* Filtros específicos de Cuaderno Don Arturo */}
        {activeLibro === 'ARTURO' && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filtroEstadoArturo}
              onChange={(e) => setFiltroEstadoArturo(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-slate-300 text-slate-700 bg-white text-xs outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="ALL">Todos los Estados de Conciliación</option>
              <option value="COINCIDE EXACTO">✓ Coincide Exacto con Factura</option>
              <option value="INGRESADO MANUAL (CUADERNO)">✎ Ingresado Manual (Don Arturo)</option>
              <option value="DIFERENCIA FACTURA REAL">⚠️ Con Diferencia</option>
            </select>
          </div>
        )}
      </div>

      {/* 4. Tabla de Registros */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Cargando registros del libro...</p>
          </div>
        ) : activeLibro === 'CAJA' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Fecha / Pág</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3">Concepto Manuscrito</th>
                  <th className="py-2.5 px-3">Categoría Caja</th>
                  <th className="py-2.5 px-3 text-right">Valor Efectivo</th>
                  <th className="py-2.5 px-3">Soporte Factura</th>
                  <th className="py-2.5 px-3 text-center">Estado Cruce</th>
                  <th className="py-2.5 px-3 text-center">Acción Costeo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cajaRegistros.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No se encontraron salidas de caja menor con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  cajaRegistros.map((r) => {
                    const isCruzado = r.estado_conciliacion === 'CRUZADO_CON_FACTURA';
                    const isUpdating = actionLoadingId === r.id;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                          <div>{r.fecha}</div>
                          <div className="text-[10px] text-slate-400">{r.pagina_recibo}</div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                          {r.caja_responsable}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{r.item_manuscrito}</div>
                          {r.diagnostico_auditoria && (
                            <div className="text-[10px] text-slate-400 line-clamp-1">
                              {r.diagnostico_auditoria}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px]">
                            {r.categoria_caja || 'Gastos Menores'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          $ {formatMoney(r.valor_caja)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {r.factura_soporte || 'Sin soporte formal'}
                          </code>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {isCruzado ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Cruzado</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <span>Efectivo sin Factura</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleCaja(r)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 mx-auto transition-all cursor-pointer ${
                              r.incluido_en_costeo
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                            }`}
                            title={
                              r.incluido_en_costeo
                                ? 'Este egreso está sumando al Costeo General. Clic para quitarlo.'
                                : 'Este egreso NO está sumando. Clic para añadirlo al Costeo General.'
                            }
                          >
                            {isUpdating ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : r.incluido_en_costeo ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Sumando</span>
                              </>
                            ) : (
                              <>
                                <PlusCircle className="w-3 h-3 text-slate-400" />
                                <span>Añadir</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3"># Renglón</th>
                  <th className="py-2.5 px-3">Ítem Manuscrito (Cuaderno)</th>
                  <th className="py-2.5 px-3 text-right">Valor Cuaderno</th>
                  <th className="py-2.5 px-3">Soporte / Factura Oficial</th>
                  <th className="py-2.5 px-3 text-center">Estado Conciliación</th>
                  <th className="py-2.5 px-3">Observaciones de Auditoría</th>
                  <th className="py-2.5 px-3 text-center">Acción Costeo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {arturoRegistros.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No se encontraron registros del cuaderno con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  arturoRegistros.map((r) => {
                    const est = (r.estado_conciliacion || '').toUpperCase();
                    const isExacto = est.includes('EXACTO') || est.includes('LEGALIZADO');
                    const isManual = est.includes('MANUAL') || est.includes('CUADERNO');
                    const isUpdating = actionLoadingId === r.id;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-600 whitespace-nowrap">
                          Pág. 159 &bull; #{r.renglon_numero}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {r.item_cuaderno}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                          $ {formatMoney(r.valor_cuaderno)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <code className="text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                            {r.factura_soporte || 'FALTANTE EN EXCEL'}
                          </code>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isExacto
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isManual
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isExacto
                              ? '✓ Coincide Exacto'
                              : isManual
                              ? '✎ Ingreso Manual (Arturo)'
                              : r.estado_conciliacion}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-[280px]">
                          <p className="line-clamp-2 text-[11px]">
                            {r.observaciones_auditoria || 'Sin observaciones'}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleArturo(r)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 mx-auto transition-all cursor-pointer ${
                              r.incluido_en_costeo
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                            }`}
                            title={
                              r.incluido_en_costeo
                                ? 'Este valor está computado en el Costeo General. Clic para desvincular.'
                                : 'Este valor NO está computado. Clic para sumar al Costeo General.'
                            }
                          >
                            {isUpdating ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : r.incluido_en_costeo ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>En Costeo</span>
                              </>
                            ) : (
                              <>
                                <PlusCircle className="w-3 h-3 text-slate-400" />
                                <span>Añadir</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
