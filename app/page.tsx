'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import {
  FileSpreadsheet,
  TrendingUp,
  ShoppingCart,
  Bot,
  ClipboardCheck,
  Wallet,
  Menu,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const { openSidebar } = useSidebar();

  const greeting = user?.name === 'Eliana' ? 'Bienvenida' : 'Bienvenido';

  const QUICK_MODULES = [
    {
      title: 'Costeo Diario Cocina',
      href: '/costeo-diario',
      icon: FileSpreadsheet,
      desc: 'Aperturas, traslados desde bodega, devoluciones y cierres diarios de carnes.',
      color: 'text-amber-600 bg-amber-50 border-amber-200 group-hover:border-amber-400',
    },
    {
      title: 'Salidas por Venta',
      href: '/ventas',
      icon: TrendingUp,
      desc: 'Control de ventas POS, desglose de platos e importación de reportes .txt.',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200 group-hover:border-emerald-400',
    },
    {
      title: 'Entradas por Compra',
      href: '/compras',
      icon: ShoppingCart,
      desc: 'Consolidación de compras de carne, proveedores y registro de facturas.',
      color: 'text-blue-600 bg-blue-50 border-blue-200 group-hover:border-blue-400',
    },
    {
      title: 'Historial Telegram Bot',
      href: '/chat-bot',
      icon: Bot,
      desc: 'Auditoría en tiempo real de consultas operativas, inventario y asistente IA.',
      color: 'text-teal-600 bg-teal-50 border-teal-200 group-hover:border-teal-400',
    },
    {
      title: 'Auditoría Cocina',
      href: '/auditoria-cocina',
      icon: ClipboardCheck,
      desc: 'Balance consolidado de porcionados, costos reales, consumos y mermas.',
      color: 'text-purple-600 bg-purple-50 border-purple-200 group-hover:border-purple-400',
    },
    {
      title: 'Libro de Caja Menor',
      href: '/libros-apoyo',
      icon: Wallet,
      desc: 'Registro de egresos operativos menores, pagos a turnos y compras del día.',
      color: 'text-rose-600 bg-rose-50 border-rose-200 group-hover:border-rose-400',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
      {/* Hero Banner de Bienvenida */}
      <div className="bg-gradient-to-br from-slate-950 via-[#111827] to-slate-900 rounded-3xl p-6 sm:p-9 text-white shadow-xl relative overflow-hidden mb-7 border border-slate-800">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            La Finca Choclos y Asados • Control Operativo 2026
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-2 leading-tight">
            {greeting},{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400">
              {user?.name || 'Administrador'}
            </span>
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
            La plataforma está en línea y sincronizada en tiempo real con Supabase y Telegram Bot API. Selecciona el módulo al que deseas acceder o despliega el menú lateral.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={openSidebar}
              type="button"
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-orange-600 hover:bg-orange-500 text-white rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
              <span>Ver Menú Completo</span>
            </button>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sesión activa: {user?.name}</span>
            </div>
          </div>
        </div>

        {/* Decoración de fondo */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Grid de Accesos Directos a Módulos Operativos */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Módulos de Acceso Rápido
          </h2>
          <p className="text-xs text-slate-500">
            Ingresa directamente a las funciones operativas del restaurante
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {QUICK_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="group relative bg-white border border-slate-200/90 hover:border-orange-400/80 rounded-2xl p-5 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3.5 border transition-colors ${mod.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-orange-600 transition-colors mb-1.5">
                  {mod.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  {mod.desc}
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs font-semibold text-orange-600 pt-2 border-t border-slate-100 group-hover:translate-x-0.5 transition-transform">
                <span>Acceder al módulo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
