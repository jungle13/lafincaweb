'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  maxWidth = 'max-w-lg',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Full-Screen Backdrop covering Header, Sidebar & Entire App */}
      <div 
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog Card (Bottom-sheet on mobile, centered modal on desktop) */}
      <div 
        className={`relative z-10 bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200/90 dark:border-slate-800 shadow-2xl w-full ${maxWidth} max-h-[92vh] sm:max-h-[90vh] flex flex-col p-4 md:p-5 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in font-normal overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe/Pull Handle indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

        {/* Header (Sticky at top of modal) */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm md:text-base truncate pr-2">
            {icon}
            <span className="truncate">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-manipulation active:scale-95 -mr-1"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Scrollable internally) */}
        <div className="overflow-y-auto flex-1 mt-3 pr-1 space-y-4 custom-scrollbar touch-pan-y overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
