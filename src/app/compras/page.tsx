'use client';

import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, DollarSign, Scale, FileText, Loader2, Calendar } from 'lucide-react';
import { formatMoney, normalizeStr } from '@/lib/formatters';

interface CompraItem {
  id: string;
  compraId: number;
  fecha: string;
  factura: string;
  proveedor: string;
  insumo: string;
  categoria: string;
  cantidadKg: number;
  costoUnitarioKg: number;
  totalPesos: number;
  estadoFactura: 'LIQUIDADA' | 'PENDIENTE';
  observaciones?: string;
}

export default function ComprasPage() {
  const [compras, setCompras] = useState<CompraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFecha, setSelectedFecha] = useState('');

  const loadCompras = async () => {
    try {
      const res = await fetch('/api/compras');
      const data = await res.json();
      if (data.data) setCompras(data.data);
    } catch (e) {
      console.error('Error fetching compras:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompras();
  }, []);

  // Totales
  const stats = useMemo(() => {
    let totalInvertido = 0;
    let totalKg = 0;
    compras.forEach((c) => {
      totalInvertido += c.totalPesos || 0;
      totalKg += c.cantidadKg || 0;
    });
    return {
      totalInvertido,
      totalKg,
      count: compras.length,
    };
  }, [compras]);

  // Filtrado
  const filteredCompras = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);
    return compras.filter((c) => {
      if (selectedFecha && c.fecha !== selectedFecha) return false;
      if (!cleanSearch) return true;
      const prov = normalizeStr(c.proveedor);
      const fac = normalizeStr(c.factura);
      const ins = normalizeStr(c.insumo);
      return prov.includes(cleanSearch) || fac.includes(cleanSearch) || ins.includes(cleanSearch);
    });
  }, [compras, searchQuery, selectedFecha]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-sm font-semibold">Cargando Historial de Compras...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 md:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-l-[3.5px] border-l-blue-500 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Invertido
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            $ {formatMoney(stats.totalInvertido)}
          </div>
          <div className="text-xs text-slate-500 font-normal">
            Gasto acumulado en insumos
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-l-[3.5px] border-l-purple-500 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Kilos Comprados
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {stats.totalKg.toFixed(1)} Kg
          </div>
          <div className="text-xs text-slate-500 font-normal">
            Materia prima abastecida
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 border-l-[3.5px] border-l-emerald-500 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Registros / Facturas
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {stats.count} ingresos
          </div>
          <div className="text-xs text-slate-500 font-normal">
            Histórico de recepción
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-base md:text-lg text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              <span>Historial Detallado de Compras</span>
            </h2>
            <p className="text-xs text-slate-500">Facturas, proveedores, precios por kilo y liquidación</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Date Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
              <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
              <input
                type="date"
                value={selectedFecha}
                onChange={(e) => setSelectedFecha(e.target.value)}
                className="outline-none text-xs font-semibold text-slate-900 bg-transparent cursor-pointer"
              />
              {selectedFecha && (
                <button
                  type="button"
                  onClick={() => setSelectedFecha('')}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar factura, proveedor o carne..."
                className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-slate-300 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
              />
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        {filteredCompras.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <p className="text-sm font-medium">No se encontraron compras con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/95 text-slate-700 font-semibold sticky top-0 z-20 backdrop-blur-md border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 font-bold text-slate-800">Fecha</th>
                    <th className="py-3.5 px-3 font-bold text-slate-800">Factura</th>
                    <th className="py-3.5 px-3 font-bold text-slate-800">Proveedor</th>
                    <th className="py-3.5 px-3 font-bold text-slate-800">Carne / Insumo</th>
                    <th className="py-3.5 px-3 text-right">Cantidad</th>
                    <th className="py-3.5 px-3 text-right">Costo / Kg</th>
                    <th className="py-3.5 px-3 text-right font-bold text-slate-900">Total Factura</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-normal bg-white">
                  {filteredCompras.map((c) => {
                    const isLiquidada = c.estadoFactura === 'LIQUIDADA';

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {c.fecha || 'Sin fecha'}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-800">
                          {c.factura}
                        </td>
                        <td className="py-3.5 px-3 font-medium text-slate-700">
                          {c.proveedor}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-slate-900">{c.insumo}</span>
                          <span className="block text-[10px] text-slate-400 uppercase tracking-wider">
                            {c.categoria}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-semibold text-blue-600">
                          {c.cantidadKg > 0 ? `${c.cantidadKg.toFixed(2)} Kg` : '-'}
                        </td>
                        <td className="py-3.5 px-3 text-right text-slate-600 font-medium">
                          {c.costoUnitarioKg > 0 ? `$ ${formatMoney(c.costoUnitarioKg)}` : '-'}
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-slate-900 bg-slate-50/30">
                          $ {formatMoney(c.totalPesos)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isLiquidada
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {c.estadoFactura}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
