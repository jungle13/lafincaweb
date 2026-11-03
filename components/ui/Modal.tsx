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
  maxWidth = 'max-w-xl',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Full-Screen Backdrop con desenfoque profesional */}
      <div 
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Card: Amplio, fondo blanco sólido, bordes sobrios, espacioso y estético */}
      <div 
        className={`relative z-10 bg-white rounded-t-2xl sm:rounded-xl border border-slate-200/90 shadow-2xl w-full ${maxWidth} max-h-[92vh] sm:max-h-[90vh] flex flex-col p-5 md:p-6 animate-in fade-in zoom-in-95 duration-200 font-normal overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe/Pull Handle indicator */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

        {/* Header con buen aire y separación */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 shrink-0">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm md:text-base truncate pr-2">
            {icon}
            <span className="truncate">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content con scroll interno y espaciado generoso */}
        <div className="overflow-y-auto flex-1 mt-4 pr-1 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
