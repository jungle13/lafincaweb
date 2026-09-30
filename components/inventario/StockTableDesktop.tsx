'use client';

import { useState, useMemo } from 'react';
import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Props {
  insumos: InsumoItem[];
  showCocinaCosts?: boolean;
}

type SortField = 
  | 'insumo'
  | 'categoria'
  | 'bodega_sin_porc_kg'
  | 'bodega_porc_und'
  | 'peso_total_bodega_kg'
  | 'cocina_porc_und'
  | 'peso_total_cocina_kg'
  | 'costo_cocina_dia'
  | 'costo_unitario_kg'
  | 'valor_total_bodega_pesos';

export default function StockTableDesktop({ insumos }: Props) {
  const [sortField, setSortField] = useState<SortField>('insumo');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedInsumos = useMemo(() => {
    return [...insumos].sort((a, b) => {
      let valA: any = a[sortField as keyof InsumoItem];
      let valB: any = b[sortField as keyof InsumoItem];

      if (sortField === 'valor_total_bodega_pesos') {
        valA = a.valor_total_bodega_pesos ?? Math.round((a.peso_total_bodega_kg || 0) * (a.costo_unitario_kg || 0));
        valB = b.valor_total_bodega_pesos ?? Math.round((b.peso_total_bodega_kg || 0) * (b.costo_unitario_kg || 0));
      }

      if (sortField === 'costo_cocina_dia') {
        valA = a.costo_cocina_dia ?? a.valor_total_cocina_pesos ?? 0;
        valB = b.costo_cocina_dia ?? b.valor_total_cocina_pesos ?? 0;
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [insumos, sortField, sortAsc]);

  if (insumos.length === 0) {
    return (
      <div className="hidden md:block text-center py-16 text-slate-400 font-normal">
        <p className="text-xs">No se encontraron carnes o insumos con los filtros seleccionados.</p>
      </div>
    );
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-orange-600 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-orange-600 font-bold" />
    );
  };

  return (
    <div className="hidden md:block w-full border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden font-normal">
      <div className="relative max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse font-normal">
          <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm text-slate-600 font-medium border-b border-slate-200 text-[11px] uppercase tracking-wider shadow-sm">
            <tr>
              {/* Insumo */}
              <th 
                onClick={() => handleSort('insumo')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>Insumo / Carne</span>
                  {renderSortIcon('insumo')}
                </div>
              </th>

              {/* Bodega Entero */}
              <th 
                onClick={() => handleSort('bodega_sin_porc_kg')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Bodega Entero</span>
                  {renderSortIcon('bodega_sin_porc_kg')}
                </div>
              </th>

              {/* Bodega Porciones */}
              <th 
                onClick={() => handleSort('bodega_porc_und')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Bodega Porciones</span>
                  {renderSortIcon('bodega_porc_und')}
                </div>
              </th>

              {/* Total Bodega */}
              <th 
                onClick={() => handleSort('peso_total_bodega_kg')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap text-slate-800"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Total Bodega</span>
                  {renderSortIcon('peso_total_bodega_kg')}
                </div>
              </th>

              {/* Cocina (Entregas netas del día/fecha seleccionada) */}
              <th 
                onClick={() => handleSort('peso_total_cocina_kg')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap text-slate-800"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Cocina</span>
                  {renderSortIcon('peso_total_cocina_kg')}
                </div>
              </th>

              {/* Costo en Cocina (Costo del insumo en cocina en esa fecha) */}
              <th 
                onClick={() => handleSort('costo_cocina_dia')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-amber-50/80 transition-colors select-none group whitespace-nowrap text-amber-900 bg-amber-50/40"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Costo en Cocina</span>
                  {renderSortIcon('costo_cocina_dia')}
                </div>
              </th>

              {/* Costo / Kg o Und */}
              <th 
                onClick={() => handleSort('costo_unitario_kg')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Costo / Kg</span>
                  {renderSortIcon('costo_unitario_kg')}
                </div>
              </th>

              {/* Valor Inventario en Bodega */}
              <th 
                onClick={() => handleSort('valor_total_bodega_pesos')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap text-slate-800"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Valor Inventario (Bodega)</span>
                  {renderSortIcon('valor_total_bodega_pesos')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 bg-white font-normal">
            {sortedInsumos.map((item) => {
              const tipoMedida = item.tipo_medida || 'KGS_Y_UNIDADES';
              const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';
              const isPaquetes = tipoMedida === 'PAQUETES';
              const isKgsOnly = tipoMedida === 'KGS';
              const isHybrid = tipoMedida === 'KGS_Y_UNIDADES';
              const unitLabel = isPaquetes ? 'paq' : 'und';

              const totalUnitsBodega = isContable ? (item.bodega_porc_und || item.bodega_sin_porc_kg || 0) : (item.bodega_porc_und || 0);
              const totalKgBodega = item.peso_total_bodega_kg ?? ((item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0));
              const tieneStockBodega = isContable ? (totalUnitsBodega > 0) : (totalKgBodega > 0 || totalUnitsBodega > 0);

              const valorBodega = !tieneStockBodega ? 0 : (
                (item.valor_total_bodega_pesos != null && item.valor_total_bodega_pesos > 0)
                  ? item.valor_total_bodega_pesos
                  : (isContable 
                      ? (totalUnitsBodega * (item.costo_unitario_kg || 0))
                      : Math.round(totalKgBodega * (item.costo_unitario_kg || 0)))
              );

              // Datos de Cocina del día seleccionado
              const cocinaUnd = item.cocina_dia_und ?? item.cocina_porc_und ?? 0;
              const cocinaKg = item.cocina_dia_kg ?? (item.peso_total_cocina_kg || (item.cocina_porc_kg + item.cocina_sin_porc_kg) || 0);
              const costoCocina = item.costo_cocina_dia ?? item.valor_total_cocina_pesos ?? 0;

              return (
                <tr
                  key={item.insumo_id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  {/* Name and Category */}
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-slate-900 text-xs md:text-sm">{item.insumo}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                      {item.categoria} • <span className="font-semibold text-slate-500">{isPaquetes ? 'PAQUETES' : isContable ? 'UNIDADES' : isKgsOnly ? 'KILOS' : 'KGS Y UND'}</span>
                    </div>
                  </td>

                  {/* Bodega Entero */}
                  <td className="py-2.5 px-3 text-right text-blue-600 font-normal">
                    {isContable ? (
                      <span className="text-slate-300">-</span>
                    ) : (
                      <>{item.bodega_sin_porc_kg.toFixed(2)} <span className="text-[10px] text-slate-400">Kg</span></>
                    )}
                  </td>

                  {/* Bodega Porciones */}
                  <td className="py-2.5 px-3 text-right font-normal">
                    {isKgsOnly ? (
                      <span className="text-slate-300">-</span>
                    ) : (
                      <>
                        <span className="text-purple-600 font-semibold">{totalUnitsBodega}</span>{' '}
                        <span className="text-[10px] text-slate-400">{unitLabel}</span>
                        {isHybrid && (
                          <div className="text-[10px] text-slate-400">
                            {item.bodega_porc_kg.toFixed(2)} Kg
                          </div>
                        )}
                      </>
                    )}
                  </td>

                  {/* Total Bodega */}
                  <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">
                    {isContable ? (
                      <span className="text-purple-700 font-bold">{totalUnitsBodega} <span className="text-[10px] text-slate-400 font-normal">{unitLabel}</span></span>
                    ) : (
                      <>{item.peso_total_bodega_kg.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">Kg</span></>
                    )}
                  </td>

                  {/* Cocina (Entregas netas del día) */}
                  <td className="py-2.5 px-3 text-right font-normal">
                    {isKgsOnly ? (
                      cocinaKg > 0 ? (
                        <div className="text-slate-800 font-medium">
                          {cocinaKg.toFixed(2)} <span className="text-[10px] text-slate-400">Kg</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">0.00 Kg</span>
                      )
                    ) : (
                      cocinaUnd > 0 || cocinaKg > 0 ? (
                        <>
                          <span className="text-slate-800 font-semibold">{cocinaUnd}</span>{' '}
                          <span className="text-[10px] text-slate-400">{unitLabel}</span>
                          {isHybrid && cocinaKg > 0 && (
                            <div className="text-[10px] text-slate-500 font-medium">
                              {cocinaKg.toFixed(2)} Kg
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-300">0 {unitLabel}</span>
                      )
                    )}
                  </td>

                  {/* Costo en Cocina (Valor del insumo en cocina en esa fecha) */}
                  <td className="py-2.5 px-3 text-right font-medium text-amber-950 bg-amber-50/30">
                    {costoCocina > 0 ? (
                      <span>$ {formatMoney(costoCocina)}</span>
                    ) : (
                      <span className="text-slate-300">$ 0</span>
                    )}
                  </td>

                  {/* Costo / Kg o Und */}
                  <td className="py-2.5 px-3 text-right text-slate-600 font-normal">
                    $ {formatMoney(item.costo_unitario_kg)}
                    <span className="text-[10px] text-slate-400 block">{isPaquetes ? '/ paq' : isContable ? '/ und' : '/ Kg'}</span>
                  </td>

                  {/* Valor Inventario (Solo Bodega) */}
                  <td className="py-2.5 px-3 text-right text-slate-900 font-medium">
                    $ {formatMoney(valorBodega)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
