'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bell, ArrowRight, X } from 'lucide-react';

export interface OperationalAlert {
  id: string;
  modulo: string;
  submodulo: string;
  mensaje: string;
  ruta: string;
}

// Alertas del día anterior para el módulo de Costeo Diario Cocina
const INITIAL_ALERTS: OperationalAlert[] = [
  {
    id: 'cocina-cierre-ayer',
    modulo: 'Costeo Diario Cocina',
    submodulo: 'Cocina Cierre',
    mensaje: 'Falta diligenciar el submódulo de Cocina Cierre',
    ruta: '/costeo-diario?section=COCINA_CIERRE',
  },
  {
    id: 'cocina-apertura-ayer',
    modulo: 'Costeo Diario Cocina',
    submodulo: 'Cocina Apertura',
    mensaje: 'Falta diligenciar el submódulo de Cocina Apertura',
    ruta: '/costeo-diario?section=COCINA_APERTURA',
  },
  {
    id: 'traslados-ayer',
    modulo: 'Costeo Diario Cocina',
    submodulo: 'Traslados',
    mensaje: 'Falta diligenciar el submódulo de Traslados',
    ruta: '/costeo-diario?section=TRASLADOS',
  },
  {
    id: 'bodega-apertura-ayer',
    modulo: 'Costeo Diario Cocina',
    submodulo: 'Bodega Apertura',
    mensaje: 'Falta diligenciar el submódulo de Bodega Apertura',
    ruta: '/costeo-diario?section=BODEGA_APERTURA',
  },
  {
    id: 'bodega-cierre-ayer',
    modulo: 'Costeo Diario Cocina',
    submodulo: 'Bodega Cierre',
    mensaje: 'Falta diligenciar el submódulo de Bodega Cierre',
    ruta: '/costeo-diario?section=BODEGA_CIERRE',
  },
];

export default function OperationalNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<OperationalAlert[]>(INITIAL_ALERTS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Campanita Minimalista */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Notificaciones"
        className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {alerts.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-slate-900" />
        )}
      </button>

      {/* Contenedor Limpio y Minimalista */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[380px] bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden">
          
          {/* Cabecera sobria sin adornos */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900">
              Notificaciones
            </h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lista de Notificaciones Esenciales */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No hay notificaciones pendientes.
              </div>
            ) : (
              alerts.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    {/* Título de Módulo y Submódulo */}
                    <div className="text-[11px] font-medium text-slate-500">
                      <span>{item.modulo}</span>
                      <span className="mx-1.5 text-slate-300">/</span>
                      <span className="text-slate-700 font-semibold">{item.submodulo}</span>
                    </div>

                    {/* Mensaje directo */}
                    <p className="text-xs text-slate-800">
                      {item.mensaje}
                    </p>

                    {/* Enlace directo a la ruta */}
                    <div className="pt-1">
                      <Link
                        href={item.ruta}
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-900 hover:underline font-medium"
                      >
                        <span>Ir al módulo</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </Link>
                    </div>
                  </div>

                  {/* Botón discreto para descartar */}
                  <button
                    type="button"
                    onClick={(e) => handleDismiss(item.id, e)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                    title="Descartar notificación"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
