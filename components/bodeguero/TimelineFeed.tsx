'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  History, 
  Calendar, 
  Search, 
  X, 
  PlusCircle, 
  Scissors, 
  ArrowRightCircle, 
  CornerDownLeft, 
  Clock, 
  User 
} from 'lucide-react';
import { MovimientoItem } from '@/types';
import { formatMoney, normalizeStr } from '@/lib/formatters';

interface Props {
  movimientos: MovimientoItem[];
  filterDate: string;
  onDateChange: (date: string) => void;
}

export default function TimelineFeed({ movimientos, filterDate, onDateChange }: Props) {
  const [meatFilter, setMeatFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  // 1. Filtrar movimientos por fecha seleccionada
  const dateFilteredMovs = useMemo(() => {
    if (!filterDate) return movimientos;
    return movimientos.filter((m) => {
      const mDate = (m.fecha || m.fecha_hora || m.fecha_movimiento || '').split('T')[0];
      return mDate === filterDate;
    });
  }, [movimientos, filterDate]);

  // 2. Extraer carnes únicas con movimientos en esta fecha
  const availableMeats = useMemo(() => {
    const map = new Map<string, { id: number; name: string; count: number }>();
    dateFilteredMovs.forEach((m) => {
      const name = m.catalogo_insumos?.nombre || m.insumo_nombre || `Insumo #${m.insumo_id}`;
      const id = m.insumo_id;
      const key = String(id);
      if (!map.has(key)) {
        map.set(key, { id, name, count: 1 });
      } else {
        map.get(key)!.count += 1;
      }
    });
    return Array.from(map.values());
  }, [dateFilteredMovs]);

  // 3. Filtrar según carne seleccionada
  const finalFilteredMovs = useMemo(() => {
    if (meatFilter === 'ALL') return dateFilteredMovs;
    return dateFilteredMovs.filter((m) => String(m.insumo_id) === String(meatFilter));
  }, [dateFilteredMovs, meatFilter]);

  // Carnes filtradas por el texto escrito en el buscador
  const searchResults = useMemo(() => {
    const clean = normalizeStr(searchQuery);
    if (!clean) return availableMeats;
    return availableMeats.filter((m) => normalizeStr(m.name).includes(clean));
  }, [availableMeats, searchQuery]);

  const handleSelectMeat = (meatId: string, meatName: string) => {
    setMeatFilter(meatId);
    setSearchQuery(meatId === 'ALL' ? '' : meatName);
    setIsDropdownOpen(false);
  };

  const handleClearMeatFilter = () => {
    setMeatFilter('ALL');
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4">
      {/* Title Row (Exact match to screenshot 2) */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-base md:text-lg text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-orange-500" />
            <span>Línea de Tiempo de Movimientos</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Historial en vivo de compras, porcionados, traslados y devoluciones
          </p>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          {finalFilteredMovs.length} movimientos
        </span>
      </div>

      {/* Filter Bar (Date + Quick Buttons + Smart Search) */}
      <div className="p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Date Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span>Fecha:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                onDateChange(e.target.value);
                handleClearMeatFilter();
              }}
              className="outline-none text-xs font-semibold text-slate-900 bg-transparent cursor-pointer"
            />
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                onDateChange(todayStr);
                handleClearMeatFilter();
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                filterDate === todayStr
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                onDateChange('');
                handleClearMeatFilter();
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                !filterDate
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todas
            </button>
          </div>
        </div>

        {/* Smart Meat Search in Timeline */}
        <div className="relative w-full md:max-w-xs" ref={searchRef}>
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Escribe para filtrar carnes con movimientos..."
              className={`w-full h-8 pl-8 pr-7 text-xs font-normal rounded-lg border outline-none bg-white transition-all ${
                meatFilter !== 'ALL'
                  ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-semibold'
                  : 'border-slate-300 focus:border-orange-500 text-slate-800'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearMeatFilter}
                className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Meat Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-40 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in text-xs">
              <div
                onClick={() => handleSelectMeat('ALL', '')}
                className="p-2.5 font-bold text-slate-800 hover:bg-slate-100 cursor-pointer flex items-center justify-between"
              >
                <span>🥩 Ver Todas las Carnes ({availableMeats.length})</span>
              </div>

              {searchResults.length === 0 ? (
                <div className="p-3 text-center text-slate-400">
                  No hay carnes con movimientos en esta fecha.
                </div>
              ) : (
                searchResults.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleSelectMeat(String(m.id), m.name)}
                    className="p-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <span className="font-medium text-slate-900">{m.name}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                      {m.count} mov{m.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Movement List Stream (Vertical Connected Track) */}
      {finalFilteredMovs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <Clock className="w-7 h-7 mx-auto text-slate-300" />
          <p className="text-xs font-medium">No hay movimientos registrados para esta fecha o carne.</p>
        </div>
      ) : (
        <div className="relative pl-6 md:pl-8 border-l-2 border-slate-200 space-y-4 my-2 ml-3">
          {finalFilteredMovs.map((m, idx) => {
            const tipo = m.tipo_movimiento;
            const carneName = m.catalogo_insumos?.nombre || m.insumo_nombre || `Insumo #${m.insumo_id}`;
            const rawDate = m.fecha_hora || m.fecha || m.fecha_movimiento;
            const timeStr = rawDate ? new Date(rawDate).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
            const dateStr = rawDate ? new Date(rawDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '';

            let dotColor = 'border-blue-500 text-blue-500 bg-blue-50';
            let tagBg = 'bg-[#dbeafe] text-[#1d4ed8]';
            let qtyBg = 'bg-blue-50 text-blue-700 border-blue-200';
            let Icon = PlusCircle;
            let label = '1. ENTRADA POR COMPRA';
            let impactText = `+${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;

            if (tipo === 'PORCIONADO') {
              dotColor = 'border-purple-500 text-purple-500 bg-purple-50';
              tagBg = 'bg-[#f3e8ff] text-[#7e22ce]';
              qtyBg = 'bg-purple-50 text-purple-700 border-purple-200';
              Icon = Scissors;
              label = '2. PORCIONADO Y PESADO';
              impactText = `${m.porciones_und || 0} und (${parseFloat(String(m.peso_porciones_kg || 0)).toFixed(2)} Kg)`;
            } else if (tipo === 'TRASLADO_COCINA') {
              dotColor = 'border-orange-500 text-orange-500 bg-orange-50';
              tagBg = 'bg-[#ffedd5] text-[#c2410c]';
              qtyBg = 'bg-orange-50 text-orange-700 border-orange-200';
              Icon = ArrowRightCircle;
              label = '3. TRASLADO A COCINA';
              impactText = m.porciones_und ? `${m.porciones_und} und (${parseFloat(String(m.peso_porciones_kg || 0)).toFixed(2)} Kg)` : `${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
            } else if (tipo === 'DEVOLUCION_COCINA') {
              dotColor = 'border-emerald-500 text-emerald-500 bg-emerald-50';
              tagBg = 'bg-[#d1fae5] text-[#047857]';
              qtyBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              Icon = CornerDownLeft;
              label = '4. DEVOLUCION DE COCINA';
              impactText = m.porciones_und ? `+${m.porciones_und} und` : `+${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
            }

            return (
              <div key={m.id || idx} className="relative group">
                {/* Node Bullet Circle on Timeline Track */}
                <div
                  className={`absolute -left-[35px] md:-left-[43px] top-3.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-sm z-10 ${dotColor}`}
                >
                  <Icon className="w-2.5 h-2.5" />
                </div>

                {/* Card Container (Exact match to screenshot 2) */}
                <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md transition-all space-y-2">
                  {/* Header Row */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${tagBg}`}>
                      {label}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-normal">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" /> {m.usuario || 'Bodeguero'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> {dateStr}, {timeStr}
                      </span>
                    </div>
                  </div>

                  {/* Main Title & Quantity Badge */}
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <h3 className="font-bold text-sm md:text-base text-slate-900">
                      {carneName}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${qtyBg}`}>
                      {impactText}
                    </span>
                  </div>

                  {/* Memo Notes */}
                  {m.observaciones && (
                    <div className="text-xs text-slate-600 flex items-start gap-1">
                      <span>📝</span>
                      <span>{m.observaciones}</span>
                    </div>
                  )}

                  {/* Snapshot Bar */}
                  <div className="bg-[#f8fafc] border border-dashed border-slate-200 rounded-lg p-2 text-[11px] text-slate-600 flex items-center gap-3.5 flex-wrap">
                    {tipo === 'ENTRADA_COMPRA' && (
                      <>
                        <span><strong>Origen:</strong> {m.origen || 'PROVEEDOR'}</span>
                        <span>•</span>
                        <span><strong>Bodega Entero:</strong> {(m.bodega_sin_porc_anterior_kg || 0).toFixed(2)} Kg ➔ <strong>{(m.bodega_sin_porc_nuevo_kg || 0).toFixed(2)} Kg</strong></span>
                        {m.valor_total_movimiento ? (
                          <>
                            <span>•</span>
                            <span><strong>Valor:</strong> ${formatMoney(m.valor_total_movimiento)}</span>
                          </>
                        ) : null}
                      </>
                    )}

                    {tipo === 'PORCIONADO' && (
                      <>
                        <span><strong>Procesado:</strong> {(m.cant_sin_porcionar_kg || 0).toFixed(2)} Kg</span>
                        <span>•</span>
                        <span className="text-rose-600 font-semibold"><strong>Merma:</strong> {(m.merma_kg || 0).toFixed(2)} Kg</span>
                        <span>•</span>
                        <span><strong>Bodega Entero:</strong> {(m.bodega_sin_porc_anterior_kg || 0).toFixed(2)} Kg ➔ <strong>{(m.bodega_sin_porc_nuevo_kg || 0).toFixed(2)} Kg</strong></span>
                        <span>•</span>
                        <span><strong>Bodega Porc:</strong> {m.bodega_porc_anterior_und || 0} und ➔ <strong>{m.bodega_porc_nuevo_und || 0} und</strong></span>
                      </>
                    )}

                    {tipo === 'TRASLADO_COCINA' && (
                      <>
                        <span><strong>Destino:</strong> {m.destino || 'COCINA'}</span>
                        <span>•</span>
                        <span><strong>Bodega Porc:</strong> {m.bodega_porc_anterior_und || 0} und ➔ <strong>{m.bodega_porc_nuevo_und || 0} und</strong></span>
                        <span>•</span>
                        <span><strong>Cocina Porc:</strong> {m.cocina_porc_anterior_und || 0} und ➔ <strong>{m.cocina_porc_nuevo_und || 0} und</strong></span>
                      </>
                    )}

                    {tipo === 'DEVOLUCION_COCINA' && (
                      <>
                        <span><strong>Reintegro:</strong> COCINA ➔ BODEGA</span>
                        <span>•</span>
                        <span><strong>Bodega Porc:</strong> {m.bodega_porc_anterior_und || 0} und ➔ <strong>{m.bodega_porc_nuevo_und || 0} und</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
