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
  const costoCalculado = cantNum > 0 && costoNum > 0 ? costoNum / cantNum : selectedInsumo?.costo_unitario_kg || 0;

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
          proveedor,
          factura,
          observaciones,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar ingreso');

      // Reset form
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
    <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 bg-white rounded-b-2xl shadow-sm">
      <SmartSearchInsumo
        insumos={insumos}
        selectedInsumo={selectedInsumo}
        onSelect={setSelectedInsumo}
        placeholder="Buscar carne a ingresar (ej. Lomo, Punta de anca, Costilla)..."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Proveedor</label>
          <input
            type="text"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Ej. Frigorífico Central / Local"
            className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Nº Factura / Remisión</label>
          <input
            type="text"
            value={factura}
            onChange={(e) => setFactura(e.target.value)}
            placeholder="Ej. FAC-9821 / Pendiente"
            className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Cantidad Recibida (Kg) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={cantidadKg}
            onChange={(e) => setCantidadKg(e.target.value)}
            placeholder="0.00"
            className="w-full h-11 px-3 text-base font-bold rounded-xl border border-slate-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Costo Total Factura ($ COP)</label>
          <input
            type="number"
            step="100"
            min="0"
            value={costoTotal}
            onChange={(e) => setCostoTotal(e.target.value)}
            placeholder="Ej. 650000 (Opcional)"
            className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Observaciones</label>
        <input
          type="text"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Notas de recepción"
          className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
        />
      </div>

      {/* Live Preview Box */}
      {selectedInsumo && (
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs md:text-sm text-blue-900 space-y-1.5 animate-fade-in">
          <div className="font-bold flex items-center justify-between">
            <span>Impacto en Inventario: {selectedInsumo.insumo}</span>
            <span className="text-xs bg-blue-200 px-2 py-0.5 rounded font-bold">Entrada Compra</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Bodega Entero Actual:</span>{' '}
              <strong>{selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg</strong>
            </div>
            <div>
              <span className="text-slate-500">Nuevo Saldo:</span>{' '}
              <strong className="text-blue-700">{(selectedInsumo.bodega_sin_porc_kg + cantNum).toFixed(2)} Kg</strong>
            </div>
            {costoNum > 0 && (
              <div className="col-span-2 text-slate-600">
                Costo Unitario Resultante: <strong>${formatMoney(costoCalculado)} / Kg</strong>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !selectedInsumo}
        className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <PlusCircle className="w-5 h-5" />
            <span>Registrar Ingreso a Bodega</span>
          </>
        )}
      </button>
    </form>
  );
}
