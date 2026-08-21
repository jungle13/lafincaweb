'use client';

import { useState } from 'react';
import { CornerDownLeft, Loader2 } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormDevolucionCocina({ insumos, onSuccess }: Props) {
  const [selectedInsumo, setSelectedInsumo] = useState<InsumoItem | null>(null);
  const [tipoCorte, setTipoCorte] = useState<'PORCIONADO' | 'ENTERO'>('PORCIONADO');
  const [cantidad, setCantidad] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const cantNum = parseInt(cantidad) || 0;
  const pesoNum = parseFloat(pesoKg) || 0;

  const handleCantidadChange = (val: string) => {
    setCantidad(val);
    const und = parseInt(val) || 0;
    if (selectedInsumo && tipoCorte === 'PORCIONADO' && und > 0) {
      const gramos = selectedInsumo.peso_porc_gramos || 350;
      setPesoKg(((und * gramos) / 1000).toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Selecciona una carne para devolver.');
    if (tipoCorte === 'PORCIONADO' && cantNum <= 0) return alert('Ingresa la cantidad de porciones devueltas.');
    if (tipoCorte === 'ENTERO' && pesoNum <= 0) return alert('Ingresa los Kilos a reintegrar.');

    setLoading(true);
    try {
      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'DEVOLUCION_COCINA',
          insumoId: selectedInsumo.insumo_id,
          esPorcionado: tipoCorte === 'PORCIONADO',
          cantidad: cantNum,
          pesoKg: pesoNum,
          observaciones,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar devolución');

      setSelectedInsumo(null);
      setCantidad('');
      setPesoKg('');
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
        placeholder="Buscar carne devuelta por cocina..."
        label="Buscar Carne Devuelta a Bodega *"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Tipo de Presentación *</label>
          <select
            value={tipoCorte}
            onChange={(e) => setTipoCorte(e.target.value as any)}
            className="w-full h-11 px-3 text-sm font-semibold rounded-xl border border-slate-300 outline-none focus:border-emerald-500 bg-white"
          >
            <option value="PORCIONADO">✂️ Porciones No Utilizadas (Unidades)</option>
            <option value="ENTERO">📦 Carne Entera / Trozo (Kg)</option>
          </select>
        </div>

        {tipoCorte === 'PORCIONADO' ? (
          <div>
            <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Cantidad de Porciones Devueltas *</label>
            <input
              type="number"
              min="1"
              required
              value={cantidad}
              onChange={(e) => handleCantidadChange(e.target.value)}
              placeholder="Ej. 4"
              className="w-full h-11 px-3 text-base font-bold rounded-xl border border-slate-300 outline-none focus:border-emerald-500"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Peso Reintegrado (Kg) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              placeholder="0.00"
              className="w-full h-11 px-3 text-base font-bold rounded-xl border border-slate-300 outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {tipoCorte === 'PORCIONADO' && (
          <div>
            <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Peso Estimado (Kg)</label>
            <input
              type="number"
              step="0.01"
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              placeholder="0.00"
              className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 outline-none focus:border-emerald-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Motivo de Devolución / Obs</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Sobrante de turno / Cierre"
            className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {selectedInsumo && (
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs md:text-sm text-emerald-900 space-y-1.5 animate-fade-in">
          <div className="font-bold flex items-center justify-between">
            <span>Reintegro a Bodega: {selectedInsumo.insumo}</span>
            <span className="text-xs bg-emerald-200 px-2 py-0.5 rounded font-bold">Devolución</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Resta en Cocina:</span>{' '}
              <strong className="text-red-700">-{cantNum || pesoNum} {tipoCorte === 'PORCIONADO' ? 'porc' : 'Kg'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Reintegra a Bodega:</span>{' '}
              <strong className="text-emerald-700">+{cantNum || pesoNum} {tipoCorte === 'PORCIONADO' ? 'porc' : 'Kg'}</strong>
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !selectedInsumo}
        className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <CornerDownLeft className="w-5 h-5" />
            <span>Registrar Devolución a Bodega</span>
          </>
        )}
      </button>
    </form>
  );
}
