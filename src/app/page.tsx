'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Store,
  Wallet,
  ShoppingCart,
  TrendingUp,
  Building2,
  Beef,
  UtensilsCrossed,
  BookOpen,
  FileSpreadsheet,
  Layers,
  ClipboardCheck,
  CalendarRange,
  Bot,
  Briefcase,
  Bell,
  Clock,
  LockOpen,
  Lock,
  ArrowRight,
  Settings2,
  X,
  Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ElianaBrandLogo from '@/components/brand/ElianaBrandLogo';
import {
  DEFAULT_EMPRESA_CONFIG,
  type EmpresaConfig,
  formatDurationHMS,
  getTerminalCajaNombre,
  isTauriDesktop,
} from '@/lib/empresaConfig';
import { getColombiaDateStr } from '@/lib/dateUtils';

interface QuickModule {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  roles: Array<'ADMIN' | 'GESTOR' | 'OPERATIVO_POS'>;
}

const ALL_MODULES: QuickModule[] = [
  {
    title: 'Eliana POS',
    description: 'Punto de venta táctil y teclado, mesas, domicilios, cobros y corte de caja.',
    href: '/pos',
    icon: Store,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    roles: ['ADMIN', 'GESTOR', 'OPERATIVO_POS'],
  },
  {
    title: 'Libro de Caja',
    description: 'Detalle diario de todos los movimientos, turnos, entradas, salidas y arqueos.',
    href: '/libros-apoyo',
    icon: Wallet,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    roles: ['ADMIN', 'GESTOR', 'OPERATIVO_POS'],
  },
  {
    title: 'Entradas por Compra',
    description: 'Consolidación de compras de insumos, facturas y registro de entradas.',
    href: '/compras',
    icon: ShoppingCart,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    roles: ['ADMIN', 'GESTOR'],
  },
  {
    title: 'Salidas por Venta',
    description: 'Control de ventas POS, desglose de platos y seguimiento comercial.',
    href: '/ventas',
    icon: TrendingUp,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    roles: ['ADMIN', 'GESTOR'],
  },
  {
    title: 'Proveedores y Pagos',
    description: 'Directorio de proveedores, cuentas por pagar y trazabilidad de abonos.',
    href: '/proveedores',
    icon: Building2,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    roles: ['ADMIN', 'GESTOR'],
  },
  {
    title: 'Catálogo de Insumos',
    description: 'Administración de materias primas, unidades de medida y costos base.',
    href: '/catalogo',
    icon: Beef,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    roles: ['ADMIN', 'GESTOR'],
  },
  {
    title: 'Productos de Venta',
    description: 'Carta de productos, precios, categorías, existencias y control de inventario.',
    href: '/productos-venta',
    icon: UtensilsCrossed,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    roles: ['ADMIN', 'GESTOR'],
  },
  {
    title: 'Fichas y Recetas',
    description: 'Escandallos, ingredientes por plato y cálculo automático de rentabilidad.',
    href: '/recetas',
    icon: BookOpen,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    roles: ['ADMIN', 'GESTOR'],
  },
  {
    title: 'Hoja de Costeo Diario',
    description: 'Aperturas, traslados desde bodega, devoluciones y cierres diarios.',
    href: '/costeo-diario',
    icon: FileSpreadsheet,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    roles: ['ADMIN', 'GESTOR'],
  },
  {
    title: 'Inventario Consolidado Diario',
    description: 'Resumen consolidado de existencias, variaciones y valorización diaria.',
    href: '/inventario-consolidado',
    icon: Layers,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
    roles: ['ADMIN', 'GESTOR'],
  },
  {
    title: 'Auditoría Cocina',
    description: 'Balance consolidado de porcionados, costos reales, consumos y mermas.',
    href: '/auditoria-cocina',
    icon: ClipboardCheck,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    roles: ['ADMIN', 'GESTOR'],
  },
  // Módulos exclusivos de ADMIN
  {
    title: 'Períodos Contables',
    description: 'Administración de meses operativos y apertura de ciclos contables.',
    href: '/periodos',
    icon: CalendarRange,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    roles: ['ADMIN'],
  },
  {
    title: 'CRM Clientes B2B',
    description: 'Gestión de clientes corporativos, cotizaciones y cartera.',
    href: '/crm',
    icon: Briefcase,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    roles: ['ADMIN'],
  },
  {
    title: 'Historial Telegram Bot',
    description: 'Auditoría en tiempo real de consultas operativas y asistente IA.',
    href: '/chat-bot',
    icon: Bot,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    roles: ['ADMIN'],
  },
  {
    title: 'Notificaciones',
    description: 'Alertas operativas, auditoría de eventos críticos y trazabilidad.',
    href: '/notificaciones',
    icon: Bell,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    roles: ['ADMIN'],
  },
];

interface ActiveShiftInfo {
  id: string;
  cajero_nombre: string;
  usuario_username?: string;
  caja_nombre: string;
  numero_turno?: number;
  hora_apertura: string;
  estado: string;
}

export default function WelcomePage() {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<EmpresaConfig>(DEFAULT_EMPRESA_CONFIG);
  const [isDesktop, setIsDesktop] = useState(false);
  const [terminalCaja, setTerminalCaja] = useState('Caja Principal');
  const [activeShift, setActiveShift] = useState<ActiveShiftInfo | null>(null);
  const [shiftLoaded, setShiftLoaded] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Modal de configuración Multi-Empresa (solo ADMIN)
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [empresaForm, setEmpresaForm] = useState<EmpresaConfig>(DEFAULT_EMPRESA_CONFIG);
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [empresaMsg, setEmpresaMsg] = useState('');

  const userRole = user?.role || (user?.username?.toLowerCase() === 'admin' ? 'ADMIN' : 'OPERATIVO_POS');
  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    setIsDesktop(isTauriDesktop());
    const caja = getTerminalCajaNombre();
    setTerminalCaja(caja);

    fetch('/api/empresa', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.empresa) {
          setEmpresa(d.empresa);
          setEmpresaForm(d.empresa);
        }
      })
      .catch(() => {});

    const fetchLocalShift = async () => {
      try {
        const fecha = getColombiaDateStr();
        const res = await fetch(`/api/pos?fecha=${encodeURIComponent(fecha)}&caja=${encodeURIComponent(caja)}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          const sesion = data?.sesionActiva;
          if (sesion && sesion.estado === 'ABIERTA') {
            setActiveShift(sesion);
            window.dispatchEvent(new CustomEvent('eliana-shift-state-changed', { detail: { isOpen: true } }));
          } else {
            setActiveShift(null);
            window.dispatchEvent(new CustomEvent('eliana-shift-state-changed', { detail: { isOpen: false } }));
          }
        }
      } catch {
        setActiveShift(null);
      } finally {
        setShiftLoaded(true);
      }
    };

    void fetchLocalShift();
  }, []);

  // Temporizador en vivo cada segundo mientras haya turno abierto en este equipo
  useEffect(() => {
    if (!activeShift?.hora_apertura) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeShift?.hora_apertura]);

  const visibleModules = useMemo(() => {
    return ALL_MODULES.filter((m) => m.roles.includes(userRole));
  }, [userRole]);

  const elapsedHMS = useMemo(() => {
    return activeShift?.hora_apertura ? formatDurationHMS(activeShift.hora_apertura, nowMs) : '00:00:00';
  }, [activeShift?.hora_apertura, nowMs]);

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmpresa(true);
    setEmpresaMsg('');
    try {
      const res = await fetch('/api/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empresaForm),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setEmpresaMsg(data?.error || 'No se pudo guardar.');
      } else {
        setEmpresa(data.empresa);
        setEmpresaForm(data.empresa);
        setShowEmpresaModal(false);
      }
    } catch {
      setEmpresaMsg('Error de red al guardar la empresa.');
    } finally {
      setSavingEmpresa(false);
    }
  };

  const showCompanySubtitle =
    empresa.nombre_comercial &&
    empresa.nombre_comercial.toUpperCase() !== 'ELIANA' &&
    empresa.nombre_comercial.toUpperCase() !== 'ELIANA POS';

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50/70 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Banner Principal Limpio + Estado de Turno de Caja de Este Equipo */}
        <section className="rounded-2xl bg-[#0B1120] text-white p-6 sm:p-7 shadow-lg border border-slate-800/80">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 flex-wrap">
                <ElianaBrandLogo variant={isDesktop ? 'pos' : 'web'} theme="dark" size="md" />
                {showCompanySubtitle && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                    {empresa.nombre_comercial}
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Bienvenido, <span className="text-blue-400">{user?.name || 'Usuario'}</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Terminal asignada en este equipo: <span className="text-slate-200 font-semibold">{terminalCaja}</span>
                </p>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEmpresaForm(empresa);
                  setEmpresaMsg('');
                  setShowEmpresaModal(true);
                }}
                className="self-start md:self-center inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
              >
                <Settings2 className="w-4 h-4 text-blue-400" />
                Configurar Empresa
              </button>
            )}
          </div>

          {/* Tarjeta de Estado Inmediato de Caja en Este Equipo */}
          <div className="mt-5 pt-5 border-t border-slate-800/90">
            {!shiftLoaded ? (
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <Clock className="w-4 h-4 animate-pulse" />
                <span>Verificando estado de caja en este equipo...</span>
              </div>
            ) : activeShift ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-emerald-950/50 border border-emerald-700/60 rounded-xl p-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <LockOpen className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-emerald-300">
                        Turno de Caja Abierto en este equipo
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-mono font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        {elapsedHMS}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100/80 mt-0.5">
                      Cajero: <strong className="text-white">{activeShift.cajero_nombre}</strong> · {activeShift.caja_nombre}
                      {activeShift.numero_turno ? ` · Turno #${activeShift.numero_turno}` : ''}
                    </p>
                  </div>
                </div>

                <Link
                  href="/pos"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm transition shrink-0"
                >
                  <Store className="w-4 h-4" />
                  Ir a ELIANA POS
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/90 border border-slate-700/80 rounded-xl p-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      No hay Turno de Caja Abierto en este equipo
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ingresa a ELIANA POS con tus credenciales para abrir turno en <strong className="text-slate-200">{terminalCaja}</strong>.
                    </p>
                  </div>
                </div>

                <Link
                  href="/pos"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-sm transition shrink-0"
                >
                  <Store className="w-4 h-4" />
                  ELIANA POS
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Módulos Habilitados según Rol */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Módulos Disponibles</h2>
            <p className="text-xs text-slate-500">
              {userRole === 'OPERATIVO_POS'
                ? 'Accesos operativos habilitados para tu perfil.'
                : userRole === 'GESTOR'
                  ? 'Funciones operativas del restaurante.'
                  : 'Acceso completo de administración y operación.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="group bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className={`w-10 h-10 rounded-xl ${mod.iconBg} ${mod.iconColor} flex items-center justify-center mb-3.5`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                    <span>Acceder al módulo</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* Modal de Configuración Multi-Empresa (Solo ADMIN) */}
      {showEmpresaModal && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Configuración de Empresa</h3>
                <p className="text-xs text-slate-500">Asigna esta instancia a cualquier restaurante o negocio.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmpresaModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmpresa} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Comercial del Restaurante</label>
                  <input
                    type="text"
                    value={empresaForm.nombre_comercial}
                    onChange={(e) => setEmpresaForm((p) => ({ ...p, nombre_comercial: e.target.value }))}
                    placeholder="Ej: Restaurante El Roble"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Propietario / Razón Social</label>
                  <input
                    type="text"
                    value={empresaForm.propietario}
                    onChange={(e) => setEmpresaForm((p) => ({ ...p, propietario: e.target.value }))}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIT / Identificación</label>
                  <input
                    type="text"
                    value={empresaForm.nit}
                    onChange={(e) => setEmpresaForm((p) => ({ ...p, nit: e.target.value }))}
                    placeholder="Ej: 900.123.456-7"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={empresaForm.direccion}
                    onChange={(e) => setEmpresaForm((p) => ({ ...p, direccion: e.target.value }))}
                    placeholder="Dirección del local"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={empresaForm.telefono}
                    onChange={(e) => setEmpresaForm((p) => ({ ...p, telefono: e.target.value }))}
                    placeholder="Teléfono de contacto"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {empresaMsg && (
                <p className="text-xs text-red-600 font-medium">{empresaMsg}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmpresaModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEmpresa}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {savingEmpresa ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
