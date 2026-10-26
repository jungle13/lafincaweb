'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  RotateCcw,
  ChefHat,
  Warehouse,
  ArrowRightLeft,
  Calendar
} from 'lucide-react';

export interface OperationalAlert {
  id: string;
  periodo: 'HOY' | 'AYER';
  fechaLabel: string;
  modulo: 'COCINA' | 'BODEGA';
  seccion: 'COCINA_CIERRE' | 'COCINA_APERTURA' | 'TRASLADOS' | 'BODEGA_APERTURA' | 'BODEGA_CIERRE';
  titulo: string;
  descripcion: string;
  ruta: string;
  severidad: 'urgente' | 'advertencia';
}

// Alertas prototipo simulando los 5 casos requeridos por el usuario
const INITIAL_ALERTS: OperationalAlert[] = [
  {
    id: 'alert-cierre-cocina-ayer',
    periodo: 'AYER',
    fechaLabel: 'Ayer (Día anterior)',
    modulo: 'COCINA',
    seccion: 'COCINA_CIERRE',
    titulo: 'Sin Cierre de Cocina (Día anterior)',
    descripcion: 'No se registró el conteo físico final de carnes en mesón. Es indispensable para cuadrar mermas y consumo real del turno anterior.',
    ruta: '/costeo-diario?section=COCINA_CIERRE&periodo=ayer',
    severidad: 'urgente',
  },
  {
    id: 'alert-apertura-cocina-hoy',
    periodo: 'HOY',
    fechaLabel: 'Hoy (Fecha presente)',
    modulo: 'COCINA',
    seccion: 'COCINA_APERTURA',
    titulo: 'Sin Conteo de Apertura Cocina',
    descripcion: 'La cocina no ha registrado el inventario inicial con el que arranca hoy. Requerido para iniciar el balance de porciones del día.',
    ruta: '/costeo-diario?section=COCINA_APERTURA',
    severidad: 'urgente',
  },
  {
    id: 'alert-traslados-hoy',
    periodo: 'HOY',
    fechaLabel: 'Hoy (Fecha presente)',
    modulo: 'COCINA',
    seccion: 'TRASLADOS',
    titulo: 'Sin Traslados de Bodega a Cocina',
    descripcion: 'No se registran entregas de carnes ni insumos desde bodega hacia cocina hoy. Diligenciar si hubo entrega de porciones o materia prima.',
    ruta: '/costeo-diario?section=TRASLADOS',
    severidad: 'advertencia',
  },
  {
    id: 'alert-apertura-bodega-hoy',
    periodo: 'HOY',
    fechaLabel: 'Hoy (Fecha presente)',
    modulo: 'BODEGA',
    seccion: 'BODEGA_APERTURA',
    titulo: 'Sin Conteo de Apertura Bodega',
    descripcion: 'La bodega central de carnes no ha confirmado el stock físico inicial con el que abre la jornada de hoy.',
    ruta: '/costeo-diario?section=BODEGA_APERTURA',
    severidad: 'advertencia',
  },
  {
    id: 'alert-cierre-bodega-ayer',
    periodo: 'AYER',
    fechaLabel: 'Ayer (Día anterior)',
    modulo: 'BODEGA',
    seccion: 'BODEGA_CIERRE',
    titulo: 'Sin Conteo de Cierre Bodega (Día anterior)',
    descripcion: 'Falta registrar el arqueo físico nocturno en congeladores de bodega para cuadrar stock teórico vs inventario real.',
    ruta: '/costeo-diario?section=BODEGA_CIERRE&periodo=ayer',
    severidad: 'urgente',
  },
];

export default function OperationalNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'TODAS' | 'HOY' | 'AYER'>('TODAS');
  const [alerts, setAlerts] = useState<OperationalAlert[]>(INITIAL_ALERTS);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera del dropdown
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

  // Alertas activas (no descartadas)
  const activeAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));
  const hoyCount = activeAlerts.filter((a) => a.periodo === 'HOY').length;
  const ayerCount = activeAlerts.filter((a) => a.periodo === 'AYER').length;
  const totalCount = activeAlerts.length;

  const filteredAlerts = activeAlerts.filter((a) => {
    if (filter === 'HOY') return a.periodo === 'HOY';
    if (filter === 'AYER') return a.periodo === 'AYER';
    return true;
  });

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => [...prev, id]);
  };

  const handleResetPrototype = () => {
    setDismissedIds([]);
  };

  const getModuloIcon = (seccion: OperationalAlert['seccion']) => {
    switch (seccion) {
      case 'COCINA_CIERRE':
      case 'COCINA_APERTURA':
        return <ChefHat className="w-3.5 h-3.5 text-orange-600" />;
      case 'TRASLADOS':
        return <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />;
      case 'BODEGA_APERTURA':
      case 'BODEGA_CIERRE':
        return <Warehouse className="w-3.5 h-3.5 text-purple-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Campanita */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Notificaciones Operativas del Día"
        className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        aria-label="Notificaciones operativas de costeo"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />

        {/* Badge contador de alertas pendientes */}
        {totalCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full border-2 border-white shadow-xs animate-in zoom-in-50">
            {totalCount}
          </span>
        )}
      </button>

      {/* Dropdown Container Flotante */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[92vw] sm:w-[420px] max-w-[440px] bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header del Container */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-100/80 rounded-lg text-rose-700">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                    Hojas Sin Diligenciar
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Control de Costeo Diario y Bodega
                  </p>
                </div>
              </div>

              {totalCount > 0 ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  {totalCount} pendiente{totalCount !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Al día
                </span>
              )}
            </div>

            {/* Selector de Filtro (Todas / Hoy / Ayer) */}
            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setFilter('TODAS')}
                className={`flex-1 py-1 px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                  filter === 'TODAS'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Todas ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('HOY')}
                className={`flex-1 py-1 px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                  filter === 'HOY'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Hoy ({hoyCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('AYER')}
                className={`flex-1 py-1 px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                  filter === 'AYER'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Ayer ({ayerCount})
              </button>
            </div>
          </div>

          {/* Listado de Alertas / Notificaciones */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-semibold text-slate-800">
                  ¡No hay hojas pendientes en esta vista!
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[260px] mx-auto">
                  Todos los registros de cocina y bodega se encuentran debidamente diligenciados.
                </p>
                {dismissedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetPrototype}
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restablecer alertas prototipo
                  </button>
                )}
              </div>
            ) : (
              filteredAlerts.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 hover:bg-slate-50/80 transition-colors group relative"
                >
                  {/* Encabezado del item: Tag Periodo + Tag Módulo */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {getModuloIcon(item.seccion)}
                        <span>{item.modulo}</span>
                      </span>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          item.periodo === 'AYER'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        <Calendar className="w-2.5 h-2.5" />
                        <span>{item.fechaLabel}</span>
                      </span>
                    </div>

                    {item.severidad === 'urgente' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Urgente</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>Requerido</span>
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <h4 className="text-xs font-bold text-slate-900 mb-1">
                    {item.titulo}
                  </h4>

                  {/* Descripción de lo que significa */}
                  <p className="text-[11px] text-slate-600 leading-relaxed mb-2.5">
                    {item.descripcion}
                  </p>

                  {/* Enlace a la Ruta / Botón de Acción */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/60">
                    <Link
                      href={item.ruta}
                      onClick={() => setIsOpen(false)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-900 hover:text-orange-600 transition-colors"
                    >
                      <span>Completar en Costeo Diario</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => handleDismiss(item.id, e)}
                      title="Marcar como revisado en el prototipo"
                      className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Ocultar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Informativo de Modo Prototipo */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
            <span className="truncate pr-1">
              ⚡ <strong>Prototipo:</strong> Notificaciones de día nuevo (Ayer y Hoy).
            </span>
            {dismissedIds.length > 0 && (
              <button
                type="button"
                onClick={handleResetPrototype}
                className="text-slate-600 hover:text-slate-900 font-semibold underline shrink-0 cursor-pointer"
              >
                Resetear ({dismissedIds.length})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
