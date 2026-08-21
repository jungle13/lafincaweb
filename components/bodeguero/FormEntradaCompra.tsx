'use client';

import { useState } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormEntradaCompra({ insumos, onSuccess }: Props) {
  const [selectedInsumo, setSelectedInsumo] = useState<InsumoItem | null>(null);
  const [proveedor, setProveedor] = useState('');
  const [factura, setFactura] = useState('');
  const [cantidadKg, setCantidadKg] = useState('');
  const [costoTotal, setCostoTotal] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const cantNum = parseFloat(cantidadKg) || 0;
  const costoNum = parseFloat(costoTotal) || 0;
  const costoCalculado = cantNum > 0 && costoNum > 0 ? Math.round(costoNum / cantNum) : selectedInsumo?.costo_unitario_kg || 0;

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

      setSelectedInsumo(null);
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
    <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 bg-white">
      <SmartSearchInsumo
        insumos={insumos}
        selectedInsumo={selectedInsumo}
        onSelect={setSelectedInsumo}
        placeholder="Escribe para buscar carne que ingresa (ej. Lomo viche, Punta de anca, Costilla)..."
        label="Buscar Carne / Insumo a Ingresar *"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Proveedor</label>
          <input
            type="text"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Ej. Frigorífico Central / Local"
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nº Factura / Remisión</label>
          <input
            type="text"
            value={factura}
            onChange={(e) => setFactura(e.target.value)}
            placeholder="Ej. FAC-9821 / Pendiente"
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Cantidad Recibida (Kg) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={cantidadKg}
            onChange={(e) => setCantidadKg(e.target.value)}
            placeholder="0.00"
            className="w-full h-9 px-2.5 text-xs font-semibold text-blue-600 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Costo Total Factura ($ COP)</label>
          <input
            type="number"
            step="100"
            min="0"
            value={costoTotal}
            onChange={(e) => setCostoTotal(e.target.value)}
            placeholder="Ej. 650000 (Opcional)"
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones / Notas de Entrega</label>
        <input
          type="text"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Notas de recepción o calidad"
          className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800"
        />
      </div>

      {/* Projection Preview Box */}
      <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-center text-xs text-slate-500">
        {selectedInsumo ? (
          <div className="flex items-center justify-between text-xs text-slate-700 px-2 font-medium">
            <span>Carne: <strong>{selectedInsumo.insumo}</strong></span>
            <span>Bodega Entero: {selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg ➔ <strong className="text-blue-600">{(selectedInsumo.bodega_sin_porc_kg + cantNum).toFixed(2)} Kg</strong></span>
            {costoNum > 0 && <span>Costo resultante: <strong>${formatMoney(costoCalculado)}/Kg</strong></span>}
          </div>
        ) : (
          <span className="italic text-slate-400">Escribe y selecciona el insumo arriba para ver el impacto en inventario.</span>
        )}
      </div>

      {/* Submit Button (Right aligned) */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Entrada por Compra</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
