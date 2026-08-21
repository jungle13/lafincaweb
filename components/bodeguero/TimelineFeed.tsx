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
      const mDate = (m.fecha_movimiento || m.fecha_hora || '').split('T')[0];
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
      {/* Title Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-orange-500" />
          <h2 className="font-bold text-base md:text-lg text-slate-900">Línea de Tiempo de Movimientos</h2>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          {finalFilteredMovs.length} movimiento{finalFilteredMovs.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Filter Bar (Date + Smart Meat Search) */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Date Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
            <span>Fecha:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                onDateChange(e.target.value);
                handleClearMeatFilter();
              }}
              className="outline-none text-xs font-bold text-slate-900 bg-transparent cursor-pointer"
            />
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                onDateChange(todayStr);
                handleClearMeatFilter();
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
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
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
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
            <Search className="absolute left-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Filtrar por carne con movimientos..."
              className={`w-full h-9 pl-8 pr-8 text-xs font-medium rounded-lg border outline-none bg-white transition-all ${
                meatFilter !== 'ALL'
                  ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-bold'
                  : 'border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearMeatFilter}
                className="absolute right-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Meat Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-40 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-fade-in text-xs">
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
                    className="p-2.5 hover:bg-orange-50 cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <span className="font-semibold text-slate-900">{m.name}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                      {m.count} mov{m.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Movement List Stream */}
      {finalFilteredMovs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <Clock className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-sm font-medium">No hay movimientos registrados para esta fecha o carne.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {finalFilteredMovs.map((m, idx) => {
            const tipo = m.tipo_movimiento;
            const carneName = m.catalogo_insumos?.nombre || m.insumo_nombre || `Insumo #${m.insumo_id}`;
            const timeStr = m.fecha_movimiento ? new Date(m.fecha_movimiento).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
            const dateStr = m.fecha_movimiento ? new Date(m.fecha_movimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '';

            let badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
            let Icon = PlusCircle;
            let label = 'Entrada Compra';
            let impactText = `+${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;

            if (tipo === 'PORCIONADO') {
              badgeColor = 'bg-purple-100 text-purple-700 border-purple-200';
              Icon = Scissors;
              label = 'Porcionado';
              impactText = `${m.porciones_und || 0} porc (${parseFloat(String(m.peso_porciones_kg || 0)).toFixed(2)} Kg)`;
            } else if (tipo === 'TRASLADO_COCINA') {
              badgeColor = 'bg-orange-100 text-orange-700 border-orange-200';
              Icon = ArrowRightCircle;
              label = 'A Cocina';
              impactText = m.porciones_und ? `${m.porciones_und} porc` : `${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
            } else if (tipo === 'DEVOLUCION_COCINA') {
              badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
              Icon = CornerDownLeft;
              label = 'Devolución';
              impactText = m.porciones_und ? `+${m.porciones_und} porc` : `+${parseFloat(String(m.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
            }

            return (
              <div
                key={m.id || idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeColor}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1 text-slate-500">
                      <User className="w-3 h-3" /> {m.usuario || 'Bodeguero'}
                    </span>
                    <span>•</span>
                    <span>{dateStr} {timeStr}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-bold text-sm text-slate-900">{carneName}</span>
                  <span className="font-extrabold text-sm text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                    {impactText}
                  </span>
                </div>

                {m.observaciones && (
                  <p className="text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-100">
                    {m.observaciones}
                  </p>
                )}

                {m.merma_kg && m.merma_kg > 0 ? (
                  <div className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded flex justify-between">
                    <span>📉 Merma: {m.merma_kg.toFixed(2)} Kg</span>
                    {m.merma_pesos ? <span>Pérdida: ${formatMoney(m.merma_pesos)}</span> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
