'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Props {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function ComprasPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  itemLabel = 'elementos',
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [15, 25, 50, 100],
}: Props) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 shadow-2xs w-full">
      {/* Información y Selector de tamaño */}
      <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto">
        <span className="text-[11px] sm:text-xs">
          <strong className="text-slate-900 font-semibold">{startItem}-{endItem}</strong> de{' '}
          <strong className="text-slate-900 font-semibold">{totalItems}</strong> {itemLabel}
        </span>

        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 shrink-0">
          <span className="text-slate-500 text-[11px] hidden xs:inline">Por pág:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-orange-500 focus:outline-hidden cursor-pointer touch-manipulation min-h-[34px] sm:min-h-0"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Controles de Navegación táctiles */}
      <div className="flex items-center justify-center gap-1 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="Primera página"
          className="p-1.5 sm:p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
        >
          <ChevronsLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-600" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Página anterior"
          className="p-1.5 sm:p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-600" />
        </button>

        <span className="px-2.5 py-1 text-xs font-medium text-slate-700 select-none">
          Pág. <strong className="text-slate-900">{currentPage}</strong> / <strong className="text-slate-900">{totalPages}</strong>
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Página siguiente"
          className="p-1.5 sm:p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
        >
          <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-600" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Última página"
          className="p-1.5 sm:p-1 rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
        >
          <ChevronsRight className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-600" />
        </button>
      </div>
    </div>
  );
}
