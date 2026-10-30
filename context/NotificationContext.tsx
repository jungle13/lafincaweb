'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  X, 
  HelpCircle,
  Loader2
} from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'danger' | 'warning' | 'info';
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
}

interface NotificationContextType {
  notify: (item: Omit<NotificationItem, 'id'> | string, type?: NotificationType) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  confirm: (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => Promise<void> | void;
  }) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (item: Omit<NotificationItem, 'id'> | string, type: NotificationType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const duration = typeof item === 'object' && item.duration ? item.duration : 4000;
      
      const newNotif: NotificationItem = typeof item === 'string' 
        ? { id, type, message: item, duration }
        : { ...item, id, duration };

      setNotifications((prev) => [...prev, newNotif]);

      if (duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    [removeNotification]
  );

  const success = useCallback((message: string, title: string = 'Operación Exitosa') => {
    notify({ type: 'success', title, message });
  }, [notify]);

  const error = useCallback((message: string, title: string = 'Atención / Error') => {
    notify({ type: 'error', title, message, duration: 6000 });
  }, [notify]);

  const warning = useCallback((message: string, title: string = 'Advertencia') => {
    notify({ type: 'warning', title, message, duration: 5000 });
  }, [notify]);

  const info = useCallback((message: string, title: string = 'Notificación') => {
    notify({ type: 'info', title, message });
  }, [notify]);

  const confirm = useCallback((options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => Promise<void> | void;
  }) => {
    setConfirmDialog({
      isOpen: true,
      title: options.title || '¿Confirmar Acción?',
      message: options.message,
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      type: options.type || 'warning',
      onConfirm: options.onConfirm,
      isLoading: false,
    });
  }, []);

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    try {
      setConfirmDialog((prev) => prev ? { ...prev, isLoading: true } : null);
      await confirmDialog.onConfirm();
    } catch (e: any) {
      error(e.message || 'Error al ejecutar la acción');
    } finally {
      setConfirmDialog(null);
    }
  };

  return (
    <NotificationContext.Provider value={{ notify, success, error, warning, info, confirm }}>
      {children}

      {/* 🚀 BANNER / TOASTS PUSH IN-APP (Esquina superior derecha en desktop / superior con márgenes en móvil) */}
      <div 
        aria-live="polite" 
        className="fixed top-3 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 z-[9999] flex flex-col gap-2.5 sm:max-w-md pointer-events-none"
      >
        {notifications.map((notif) => {
          let bgClass = 'bg-white border-slate-200 text-slate-800';
          let iconClass = 'text-blue-600 bg-blue-50';
          let borderAccent = 'border-l-4 border-l-blue-500';
          let IconComp = Info;

          if (notif.type === 'success') {
            bgClass = 'bg-white border-emerald-200 text-slate-800';
            iconClass = 'text-emerald-600 bg-emerald-50';
            borderAccent = 'border-l-4 border-l-emerald-500';
            IconComp = CheckCircle2;
          } else if (notif.type === 'error') {
            bgClass = 'bg-white border-rose-200 text-slate-800';
            iconClass = 'text-rose-600 bg-rose-50';
            borderAccent = 'border-l-4 border-l-rose-500';
            IconComp = AlertCircle;
          } else if (notif.type === 'warning') {
            bgClass = 'bg-white border-amber-200 text-slate-800';
            iconClass = 'text-amber-600 bg-amber-50';
            borderAccent = 'border-l-4 border-l-amber-500';
            IconComp = AlertTriangle;
          }

          return (
            <div
              key={notif.id}
              role="alert"
              className={`pointer-events-auto rounded-2xl sm:rounded-xl border shadow-xl p-3 sm:p-3.5 flex items-start gap-3 backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 animate-in slide-in-from-top-3 ${bgClass} ${borderAccent}`}
            >
              <div className={`p-2 sm:p-1.5 rounded-xl sm:rounded-lg shrink-0 ${iconClass}`}>
                <IconComp className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 pr-1">
                {notif.title && (
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                    {notif.title}
                  </h4>
                )}
                <p className="text-xs text-slate-600 mt-0.5 leading-snug whitespace-pre-line font-medium">
                  {notif.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeNotification(notif.id)}
                className="min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 active:scale-95 transition-all shrink-0 touch-manipulation cursor-pointer -mr-1 -mt-1"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 🛡️ MODAL DE CONFIRMACIÓN ELEGANTE (Reemplaza confirm() nativo del navegador) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/45 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 w-full sm:max-w-sm p-5 text-slate-800 space-y-4 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto sm:hidden -mt-1 mb-2 shrink-0" />
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${
                confirmDialog.type === 'danger' ? 'bg-rose-100 text-rose-600' :
                confirmDialog.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {confirmDialog.type === 'danger' ? <AlertCircle className="w-5 h-5" /> :
                 confirmDialog.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={confirmDialog.isLoading}
                onClick={() => setConfirmDialog(null)}
                className="w-full sm:w-auto h-11 sm:h-9 px-4 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-98 rounded-xl sm:rounded-lg font-semibold transition-all touch-manipulation cursor-pointer flex items-center justify-center"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                disabled={confirmDialog.isLoading}
                onClick={handleConfirmAction}
                className={`w-full sm:w-auto h-11 sm:h-9 px-4 text-xs text-white rounded-xl sm:rounded-lg font-bold shadow-sm active:scale-98 transition-all touch-manipulation cursor-pointer flex items-center justify-center gap-1.5 ${
                  confirmDialog.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmDialog.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmDialog.isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{confirmDialog.confirmText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
