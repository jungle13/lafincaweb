'use client';

import { Package, TrendingUp } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { CompraInsumoGroup } from '@/services/comprasService';

interface Props {
  insumos: CompraInsumoGroup[];
}

export default function ComprasInsumosView({ insumos }: Props) {
  if (insumos.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 border border-slate-200 text-center text-slate-500">
        <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-medium">No se encontraron insumos con los filtros seleccionados.</p>
      </div>
    );
  }

  const granTotalInsumos = insumos.reduce((acc, i) => acc + i.total_dinero, 0);
  const totalCantidadInsumos = insumos.reduce((acc, i) => acc + i.cantidad_total, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>Mostrando {insumos.length} insumos consolidados</span>
        <span className="font-mono font-bold text-slate-900">
          Total Invertido: $ {formatMoney(granTotalInsumos)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Insumo</th>
              <th className="py-2.5 px-3">Categoría</th>
              <th className="py-2.5 px-3 text-right">Cantidad Total</th>
              <th className="py-2.5 px-3 text-center">Unidad</th>
              <th className="py-2.5 px-3 text-right">Último Costo</th>
              <th className="py-2.5 px-3 text-right">Costo Promedio</th>
              <th className="py-2.5 px-3 text-right">Total Invertido</th>
              <th className="py-2.5 px-3 text-center">Compras</th>
              <th className="py-2.5 px-3">Proveedores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {insumos.map((i, idx) => (
              <tr key={i.nombre_insumo || idx} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-2 px-3 font-semibold text-slate-900">
                  {i.nombre_insumo}
                </td>
                <td className="py-2 px-3">
                  <span className="text-[10px] uppercase font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                    {i.categoria}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono font-medium">
                  {i.cantidad_total.toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                    {i.unidad}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                  $ {formatMoney(i.ultimo_costo)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-slate-600">
                  $ {formatMoney(i.costo_promedio)}
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                  $ {formatMoney(i.total_dinero)}
                </td>
                <td className="py-2 px-3 text-center font-mono text-slate-500">
                  {i.num_compras}
                </td>
                <td className="py-2 px-3 text-slate-500 text-[11px] max-w-[200px] truncate" title={i.proveedores.join(', ')}>
                  {i.proveedores.join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold text-slate-900 text-xs">
            <tr>
              <td colSpan={2} className="py-2.5 px-3 text-slate-600 font-medium">
                Consolidado ({insumos.length} Insumos)
              </td>
              <td className="py-2.5 px-3 text-right font-mono">
                {totalCantidadInsumos.toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-sm font-bold">
                $ {formatMoney(granTotalInsumos)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
