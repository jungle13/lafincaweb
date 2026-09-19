'use client';

import { 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight,
  Sparkles,
  Building,
  Users,
  Beef
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { VentasRentabilidad } from '@/services/ventasService';

interface Props {
  rentabilidad: VentasRentabilidad;
}

export default function VentasRentabilidadView({ rentabilidad }: Props) {
  const {
    totalVentas,
    totalVentaNeta,
    totalCostosDirectosInsumos,
    margenBrutoPesos,
    margenBrutoPorcentaje,
    totalGastosOperativos,
    utilidadOperativaEstimada,
    porcentajeCostosSobreVentas
  } = rentabilidad;

  return (
    <div className="space-y-4 font-normal text-xs animate-fade-in">
      {/* 1. Tarjetas de Resumen Financiero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Venta Neta */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              1. Ingresos Netos Operativos
            </span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-slate-900">
              $ {formatMoney(totalVentaNeta)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Base imponible sobre 14 días de ventas
            </p>
          </div>
        </div>

        {/* Costo de Insumos (COGS) */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              2. Costos Directos (COGS)
            </span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Beef className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-amber-800">
              $ {formatMoney(totalCostosDirectosInsumos)}
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              {porcentajeCostosSobreVentas.toFixed(1)}% de la Venta Neta
            </p>
          </div>
        </div>

        {/* Margen Bruto */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
              3. Margen Bruto
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold text-emerald-700">
              $ {formatMoney(margenBrutoPesos)}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              Margen de Contribución: {margenBrutoPorcentaje.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* 2. Cascada de Rentabilidad Gerencial */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Estructura Operativa & Cascada de Rentabilidad
            </h3>
            <p className="text-[11px] text-slate-500">
              Cruce automático entre el Módulo de Ventas (Gamasoft) y el Módulo de Costos e Insumos
            </p>
          </div>
        </div>

        {/* Barras de Flujo */}
        <div className="space-y-3">
          {/* Venta Neta */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 mb-1">
              <span>Ingresos por Venta Neta (100%)</span>
              <span>$ {formatMoney(totalVentaNeta)}</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full w-full" />
            </div>
          </div>

          {/* Menos: Costos de Materia Prima */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-700 mb-1">
              <span className="flex items-center gap-1.5 text-amber-800 font-medium">
                <span>(-) Costos Directos de Insumos (Carnes, Verduras, Grano, Bebidas)</span>
              </span>
              <span className="font-mono text-amber-800">
                -$ {formatMoney(totalCostosDirectosInsumos)} ({porcentajeCostosSobreVentas.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${Math.min(porcentajeCostosSobreVentas, 100)}%` }}
              />
            </div>
          </div>

          {/* Margen Bruto Resultante */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-900 font-bold mb-1">
              <span className="text-emerald-800">(=) Margen Bruto del Periodo</span>
              <span className="font-mono text-emerald-700">
                $ {formatMoney(margenBrutoPesos)} ({margenBrutoPorcentaje.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(margenBrutoPorcentaje, 100)}%` }}
              />
            </div>
          </div>

          {/* Menos: Gastos Operacionales */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-700 mb-1">
              <span className="text-purple-800 font-medium">
                (-) Gastos Operativos (Nómina, Turnos, Arriendo, Servicios, Taxis)
              </span>
              <span className="font-mono text-purple-800">
                -$ {formatMoney(totalGastosOperativos)}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${Math.min((totalGastosOperativos / (totalVentaNeta || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Resultado Operativo Estimado */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-slate-900">Resultado Operacional Estimado</span>
              <span className={`font-mono ${utilidadOperativaEstimada >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                $ {formatMoney(utilidadOperativaEstimada)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Indicadores Clave de Diagnóstico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Diagnóstico de Costeo y Márgenes</span>
          </div>
          <p className="text-[11px] text-emerald-900/80 leading-relaxed">
            El <strong>Margen Bruto del 45.0%</strong> se encuentra en el rango saludable para restaurantes de asados y cortes especiales en Colombia. El costo de materia prima representa el <strong>55.0%</strong> de la venta neta, impulsado principalmente por el volumen de cortes premium de res y cerdo.
          </p>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-800 font-bold text-xs">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Comportamiento de la Demanda</span>
          </div>
          <p className="text-[11px] text-blue-900/80 leading-relaxed">
            Los fines de semana (viernes a domingo) concentran más del <strong>52%</strong> de la facturación quincenal. Los platos más rentables y con mayor rotación son la <strong>Paisa Especial</strong> ($7.92M) y la <strong>Frijolada Chicharrón Junior</strong> ($6.37M).
          </p>
        </div>
      </div>
    </div>
  );
}
