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
    <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 bg-white">
      <SmartSearchInsumo
        insumos={insumos}
        selectedInsumo={selectedInsumo}
        onSelect={setSelectedInsumo}
        placeholder="Escribe para buscar carne que devuelve cocina (ej. Baby beef, Costilla, Cerdo)..."
        label="Buscar Carne / Insumo que Regresa de Cocina *"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Devolución</label>
          <select
            value={tipoCorte}
            onChange={(e) => setTipoCorte(e.target.value as any)}
            className="w-full h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-300 outline-none focus:border-emerald-500 bg-white text-slate-800"
          >
            <option value="PORCIONADO">Porciones Listas (Unidades)</option>
            <option value="ENTERO">Pieza Entera / A Granel (Kg)</option>
          </select>
        </div>

        {tipoCorte === 'PORCIONADO' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cantidad Devuelta (Porciones) *</label>
            <input
              type="number"
              min="1"
              required
              value={cantidad}
              onChange={(e) => handleCantidadChange(e.target.value)}
              placeholder="Ej. 4"
              className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-emerald-500 text-slate-800"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Peso Reintegrado (Kg) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              placeholder="0.00"
              className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-emerald-500 text-slate-800"
            />
          </div>
        )}

        {tipoCorte === 'PORCIONADO' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Peso Reintegrado (Kg) *</label>
            <input
              type="number"
              step="0.01"
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              placeholder="0.00"
              className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-emerald-500 text-slate-800"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo de Devolución</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Sobrante fin de turno / No utilizado"
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-emerald-500 text-slate-800"
          />
        </div>
      </div>

      {/* Projection Preview Box */}
      <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-center text-xs text-slate-500">
        {selectedInsumo ? (
          <div className="flex items-center justify-between text-xs text-slate-700 px-2 font-medium">
            <span>Carne: <strong>{selectedInsumo.insumo}</strong></span>
            <span>Resta Cocina: <strong className="text-red-600">-{cantNum || pesoNum} {tipoCorte === 'PORCIONADO' ? 'porc' : 'Kg'}</strong></span>
            <span>Reintegra a Bodega: <strong className="text-emerald-600">+{cantNum || pesoNum} {tipoCorte === 'PORCIONADO' ? 'porc' : 'Kg'}</strong></span>
          </div>
        ) : (
          <span className="italic text-slate-400">Escribe y selecciona un insumo arriba para verificar el stock actual en cocina.</span>
        )}
      </div>

      {/* Submit Button (Right aligned) */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-[#10b981] hover:bg-[#059669] active:scale-[0.98] text-white font-semibold text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CornerDownLeft className="w-4 h-4" />
              <span>Registrar Devolución</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
