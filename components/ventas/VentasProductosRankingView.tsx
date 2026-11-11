'use client';

import { useState, useMemo } from 'react';
import { 
  Award, 
  Search, 
  X, 
  Filter, 
  ArrowUpDown, 
  Beef, 
  UtensilsCrossed, 
  Fish, 
  Beer, 
  Coffee, 
  Layers 
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { PlatoRanking } from '@/services/ventasService';

interface Props {
  ranking: PlatoRanking[];
  categorias: string[];
  totalVentas: number;
}

const CATEGORIA_ICONS: Record<string, any> = {
  'Carnes y Parrilla': Beef,
  'Platos Típicos': UtensilsCrossed,
  'Pescados y Cazuelas': Fish,
  'Bebidas y Licores': Beer,
  'Desayunos y Cafetería': Coffee,
  'Porciones y Entradas': Layers,
};

export default function VentasProductosRankingView({
  ranking,
  categorias,
  totalVentas
}: Props) {
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'INGRESOS' | 'CANTIDAD'>('INGRESOS');

  const filteredAndSorted = useMemo(() => {
    let list = [...(ranking || [])];

    if (selectedCat !== 'ALL') {
      list = list.filter((p) => p.categoria === selectedCat);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          (p.nombre_producto || '').toLowerCase().includes(q) ||
          (p.codigo_producto || '').includes(q)
      );
    }

    if (sortBy === 'INGRESOS') {
      list.sort((a, b) => b.gran_total - a.gran_total);
    } else {
      list.sort((a, b) => b.cantidad_total - a.cantidad_total);
    }

    return list;
  }, [ranking, selectedCat, searchQuery, sortBy]);

  const maxTotal = useMemo(() => {
    return Math.max(...ranking.map((p) => p.gran_total), 1);
  }, [ranking]);

  return (
    <div className="space-y-3 font-normal text-xs">
      {/* Selector de Categorías */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <button
          type="button"
          onClick={() => setSelectedCat('ALL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
            selectedCat === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Todo el Menú ({ranking.length})</span>
        </button>

        {categorias.map((cat) => {
          const Icon = CATEGORIA_ICONS[cat] || Layers;
          const isActive = selectedCat === cat;
          const count = ranking.filter((p) => p.categoria === cat).length;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCat(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
              <span>{cat}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros y Ordenamiento */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar plato o código..."
            className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-slate-300 outline-none focus:border-emerald-500 bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Ordenar por:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSortBy('INGRESOS')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                sortBy === 'INGRESOS'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mayor Ingreso ($)
            </button>
            <button
              type="button"
              onClick={() => setSortBy('CANTIDAD')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                sortBy === 'CANTIDAD'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mayor Cantidad (Uds)
            </button>
          </div>
        </div>
      </div>

      {/* Vista Móvil de Ranking de Menú (Tarjetas md:hidden) */}
      <div className="grid grid-cols-1 gap-2 md:hidden">
        {filteredAndSorted.map((p, index) => {
          const isTop3 = index < 3 && selectedCat === 'ALL' && !searchQuery;
          const pctBar = (p.gran_total / maxTotal) * 100;

          return (
            <div
              key={p.codigo_producto}
              className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  {isTop3 ? (
                    <span
                      className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs shrink-0 ${
                        index === 0
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : index === 1
                          ? 'bg-slate-200 text-slate-800 border border-slate-300'
                          : 'bg-orange-100 text-orange-800 border border-orange-300'
                      }`}
                    >
                      {index + 1}
                    </span>
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-mono text-[11px] inline-flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">
                      {p.nombre_producto}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-400">#{p.codigo_producto}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600 font-medium">
                        {p.categoria}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-sm text-slate-900 block">
                    $ {formatMoney(p.gran_total)}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-emerald-700">
                    {formatMoney(p.cantidad_total)} {p.unidad}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100 text-[10px] font-mono">
                <div>
                  <span className="font-sans text-slate-400">Venta Neta: </span>
                  <span className="font-semibold text-blue-700">$ {formatMoney(p.venta_neta)}</span>
                </div>
                <div className="text-right">
                  <span className="font-sans text-slate-400">Precio Prom: </span>
                  <span className="font-semibold text-slate-700">$ {formatMoney(p.precio_promedio)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.max(pctBar, 3)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-semibold text-slate-600 shrink-0">
                  {p.porcentaje_ventas_total.toFixed(2)}% del menú
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla de Ranking (Escritorio hidden md:block) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Plato / Producto</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3 text-center">Unidades</th>
                <th className="py-2.5 px-3 text-right">Precio Prom.</th>
                <th className="py-2.5 px-3 text-right">Venta Neta</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900">Total Cobrado</th>
                <th className="py-2.5 px-3 w-40 text-center">% Part. Menú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredAndSorted.map((p, index) => {
                const isTop3 = index < 3 && selectedCat === 'ALL' && !searchQuery;
                const pctBar = (p.gran_total / maxTotal) * 100;

                return (
                  <tr key={p.codigo_producto} className="hover:bg-slate-50/80 transition-colors">
                    {/* Posición */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {isTop3 ? (
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                            index === 0
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : index === 1
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : 'bg-orange-100 text-orange-800 border border-orange-300'
                          }`}
                        >
                          {index + 1}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">{index + 1}</span>
                      )}
                    </td>

                    {/* Código */}
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {p.codigo_producto}
                    </td>

                    {/* Nombre */}
                    <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      {p.nombre_producto}
                    </td>

                    {/* Categoría */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600 font-medium">
                        {p.categoria}
                      </span>
                    </td>

                    {/* Unidades Vendidas */}
                    <td className="py-2 px-3 text-center whitespace-nowrap font-bold text-slate-800">
                      {formatMoney(p.cantidad_total)} <span className="text-[10px] text-slate-400 font-normal">{p.unidad}</span>
                    </td>

                    {/* Precio Promedio */}
                    <td className="py-2 px-3 text-right whitespace-nowrap text-slate-600 font-mono">
                      $ {formatMoney(p.precio_promedio)}
                    </td>

                    {/* Venta Neta */}
                    <td className="py-2 px-3 text-right whitespace-nowrap text-blue-700 font-medium font-mono">
                      $ {formatMoney(p.venta_neta)}
                    </td>

                    {/* Total Cobrado */}
                    <td className="py-2 px-3 text-right whitespace-nowrap font-bold text-slate-900 font-mono text-sm">
                      $ {formatMoney(p.gran_total)}
                    </td>

                    {/* Barra de Participación */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.max(pctBar, 3)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600 w-10 text-right">
                          {p.porcentaje_ventas_total.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
