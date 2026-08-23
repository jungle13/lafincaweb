'use client';

import { useState, useMemo } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormEntradaCompra({ insumos, onSuccess }: Props) {
  const [selectedInsumoId, setSelectedInsumoId] = useState<number | null>(null);
  const [proveedor, setProveedor] = useState('');
  const [factura, setFactura] = useState('');
  const [cantidadKg, setCantidadKg] = useState('');
  const [costoTotal, setCostoTotal] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedInsumo = useMemo(() => {
    if (!selectedInsumoId) return null;
    return insumos.find((i) => i.insumo_id === selectedInsumoId) || null;
  }, [insumos, selectedInsumoId]);

  const cantNum = parseFloat(cantidadKg) || 0;
  const costoNum = parseFloat(costoTotal) || 0;
  const costoUnitarioEstimado = cantNum > 0 && costoNum > 0 ? Math.round(costoNum / cantNum) : selectedInsumo?.costo_unitario_kg || 0;
  const nuevoStockKg = (selectedInsumo?.bodega_sin_porc_kg || 0) + cantNum;
  const nuevoValorBodega = nuevoStockKg * costoUnitarioEstimado;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Por favor selecciona una carne o insumo.');
    if (cantNum <= 0) return alert('Ingresa una cantidad válida en Kg.');

    setLoading(true);
    try {
      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'ENTRADA_COMPRA',
          insumoId: selectedInsumo.insumo_id,
          cantidadKg: cantNum,
          costoTotal: costoNum,
          proveedor: proveedor.trim() || 'Proveedor Local',
          factura: factura.trim() || 'Pendiente',
          observaciones,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar ingreso');

      setProveedor('');
      setFactura('');
      setCantidadKg('');
      setCostoTotal('');
      setObservaciones('');
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-normal">
      <SmartSearchInsumo
        insumos={insumos}
        selectedInsumo={selectedInsumo}
        onSelect={(item) => setSelectedInsumoId(item ? item.insumo_id : null)}
        placeholder="Escribe para buscar carne que ingresa (ej. Lomo de cerdo, Baby beef)..."
        label="Buscar Carne / Insumo a Ingresar *"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Proveedor</label>
          <input
            type="text"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Ej. Frigorífico Central / Local"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Nº Factura / Remisión</label>
          <input
            type="text"
            value={factura}
            onChange={(e) => setFactura(e.target.value)}
            placeholder="Ej. FAC-9821 / Pendiente"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Cantidad Recibida (Kg) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={cantidadKg}
            onChange={(e) => setCantidadKg(e.target.value)}
            placeholder="0.00"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Costo Total Factura ($ COP)</label>
          <input
            type="number"
            step="100"
            min="0"
            value={costoTotal}
            onChange={(e) => setCostoTotal(e.target.value)}
            placeholder="Ej. 650000 (Opcional)"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Observaciones</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas de recepción"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800"
          />
        </div>
      </div>

      {/* Projection Preview Box */}
      <div className="p-3.5 bg-[#f8fafc] border border-slate-200 rounded-xl space-y-2 text-xs font-normal">
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          IMPACTO EN INVENTARIO: {selectedInsumo ? selectedInsumo.insumo.toUpperCase() : 'SELECCIONA UN INSUMO'}
        </div>

        {selectedInsumo ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-[11px] text-slate-500 font-normal">Stock Entero en Bodega:</div>
              <div className="text-slate-800 font-normal mt-0.5">
                {selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg ➔ <span className="text-emerald-600 font-medium">{nuevoStockKg.toFixed(2)} Kg</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 font-normal">Costo por Kg estimado:</div>
              <div className="text-slate-800 font-normal mt-0.5">
                $ {formatMoney(costoUnitarioEstimado)} / Kg
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 font-normal">Nuevo Valor en Bodega:</div>
              <div className="text-slate-800 font-normal mt-0.5">
                $ {formatMoney(nuevoValorBodega)}
              </div>
            </div>
          </div>
        ) : (
          <span className="italic text-slate-400 text-xs">Selecciona un insumo para previsualizar el impacto antes de guardar.</span>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-normal text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Ingreso a Bodega</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
