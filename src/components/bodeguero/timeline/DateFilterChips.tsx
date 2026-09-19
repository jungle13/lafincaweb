'use client';

import { Calendar, Lock, Loader2, X, RotateCcw } from 'lucide-react';

interface PendingDateItem {
  date: string;
  count: number;
}

interface ApprovedDateItem {
  date: string;
  count: number;
}

interface Props {
  mode: 'PENDIENTES' | 'HISTORIAL';
  selectedDate: string;
  onSelectDate: (date: string) => void;
  // Pendientes
  pendingDates?: PendingDateItem[];
  earliestPendingDate?: string | null;
  deletingDate?: string | null;
  onDescartarDia?: (date: string, count: number) => void;
  totalPendingCount?: number;
  // Historial
  approvedDates?: ApprovedDateItem[];
  revertingDate?: string | null;
  onRevertirDia?: (date: string, count: number) => void;
  totalApprovedCount?: number;
}

export default function DateFilterChips({
  mode,
  selectedDate,
  onSelectDate,
  pendingDates = [],
  earliestPendingDate,
  deletingDate,
  onDescartarDia,
  totalPendingCount = 0,
  approvedDates = [],
  revertingDate,
  onRevertirDia,
  totalApprovedCount = 0,
}: Props) {
  if (mode === 'PENDIENTES') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-slate-500 font-normal mr-1 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-amber-600" />
          <span>Jornadas pendientes:</span>
        </span>
        <button
          type="button"
          onClick={() => onSelectDate('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-normal transition-all border ${
            selectedDate === 'ALL'
              ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-medium'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Todas las Fechas ({totalPendingCount})
        </button>

        {pendingDates.map((item) => {
          const isLocked = earliestPendingDate ? item.date > earliestPendingDate : false;
          const isCurrentActive = item.date === earliestPendingDate;
          const isDeleting = deletingDate === item.date;

          return (
            <div
              key={item.date}
              className={`px-2.5 py-1 rounded-full text-xs font-normal transition-all border flex items-center gap-1.5 ${
                selectedDate === item.date
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
                onClick={() => onSelectDate(item.date)}
                className="flex items-center gap-1.5 outline-none cursor-pointer"
                title={
                  isLocked
                    ? `🔒 Bloqueado: Primero debes aprobar los movimientos del ${earliestPendingDate}`
                    : `Jornada del ${item.date}`
                }
              >
                {isLocked ? <Lock className="w-3 h-3 text-slate-400" /> : <Calendar className="w-3 h-3 text-amber-600" />}
                <span>{item.date}</span>
                {isCurrentActive && (
                  <span className="bg-emerald-500 text-white px-1.5 py-0.2 rounded-full text-[9px] font-medium">
                    ACTIVO
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isLocked ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {item.count}
                </span>
              </button>

              {onDescartarDia && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDescartarDia(item.date, item.count);
                  }}
                  className={`p-0.5 rounded-full transition-colors ml-0.5 cursor-pointer ${
                    selectedDate === item.date
                      ? 'text-amber-200 hover:bg-red-600 hover:text-white'
                      : 'text-slate-400 hover:bg-red-500 hover:text-white'
                  }`}
                  title={`Eliminar y descartar todos los pendientes del ${item.date}`}
                >
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // HISTORIAL MODE
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-slate-500 font-normal mr-1 flex items-center gap-1">
        <Calendar className="w-3.5 h-3.5 text-orange-500" />
        <span>Jornadas aprobadas:</span>
      </span>
      <button
        type="button"
        onClick={() => onSelectDate('ALL')}
        className={`px-3 py-1 rounded-full text-xs font-normal transition-all border ${
          selectedDate === 'ALL' || !selectedDate
            ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-medium'
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
        }`}
      >
        Historial Completo ({totalApprovedCount})
      </button>

      {approvedDates.map((item) => {
        const isReverting = revertingDate === item.date;

        return (
          <div
            key={item.date}
            className={`px-2.5 py-1 rounded-full text-xs font-normal transition-all border flex items-center gap-1.5 ${
              selectedDate === item.date
                ? 'bg-orange-600 border-orange-600 text-white shadow-sm font-medium'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-orange-50 hover:border-orange-300'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectDate(item.date)}
              className="flex items-center gap-1.5 outline-none cursor-pointer"
            >
              <Calendar className="w-3 h-3 text-orange-500" />
              <span>{item.date}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedDate === item.date ? 'bg-orange-800 text-white' : 'bg-orange-100 text-orange-900'
                }`}
              >
                {item.count}
              </span>
            </button>

            {onRevertirDia && (
              <button
                type="button"
                disabled={isReverting}
                onClick={(e) => {
                  e.stopPropagation();
                  onRevertirDia(item.date, item.count);
                }}
                className={`p-0.5 rounded-full transition-colors ml-0.5 cursor-pointer ${
                  selectedDate === item.date
                    ? 'text-orange-200 hover:bg-orange-800 hover:text-white'
                    : 'text-slate-400 hover:bg-slate-200 hover:text-slate-800'
                }`}
                title={`↺ Deshacer aprobación del día ${item.date} y volver a estado pendiente`}
              >
                {isReverting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
