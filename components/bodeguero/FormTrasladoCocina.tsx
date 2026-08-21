'use client';

import { useState } from 'react';
import { ArrowRightCircle, Loader2 } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormTrasladoCocina({ insumos, onSuccess }: Props) {
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
    if (!selectedInsumo) return alert('Selecciona una carne para despachar.');
    if (tipoCorte === 'PORCIONADO' && cantNum <= 0) return alert('Ingresa la cantidad de porciones.');
    if (tipoCorte === 'ENTERO' && pesoNum <= 0) return alert('Ingresa los Kilos enteros a trasladar.');

    if (tipoCorte === 'PORCIONADO' && selectedInsumo.bodega_porc_und < cantNum) {
      return alert(`Solo hay ${selectedInsumo.bodega_porc_und} porciones listas en bodega.`);
    }

    setLoading(true);
    try {
      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'TRASLADO_COCINA',
          insumoId: selectedInsumo.insumo_id,
          esPorcionado: tipoCorte === 'PORCIONADO',
          cantidad: cantNum,
          pesoKg: pesoNum,
          observaciones,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar despacho');

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
      {/* Search Input Row */}
      <SmartSearchInsumo
        insumos={insumos}
        selectedInsumo={selectedInsumo}
        onSelect={setSelectedInsumo}
        placeholder="Escribe para buscar carne a despachar a cocina (ej. Filete de pollo, Churrasco, Tocino)..."
        label="Buscar Carne / Insumo a Entregar a Cocina *"
      />

      {/* 4-Column Grid Inputs (Exact match to screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Entrega</label>
          <select
            value={tipoCorte}
            onChange={(e) => setTipoCorte(e.target.value as any)}
            className="w-full h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-300 outline-none focus:border-orange-500 bg-white text-slate-800"
          >
            <option value="PORCIONADO">Porciones Listas (Unidades)</option>
            <option value="ENTERO">Pieza Entera / A Granel (Kg)</option>
          </select>
        </div>

        {tipoCorte === 'PORCIONADO' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cantidad a Entregar (Porciones) *</label>
            <input
              type="number"
              min="1"
              required
              value={cantidad}
              onChange={(e) => handleCantidadChange(e.target.value)}
              placeholder="Ej. 10"
              className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Peso Despachado (Kg) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              placeholder="0.00"
              className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
            />
          </div>
        )}

        {tipoCorte === 'PORCIONADO' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Peso Despachado (Kg) *</label>
            <input
              type="number"
              step="0.01"
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              placeholder="0.00"
              className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones / Turno</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Almuerzo / Cena / Evento"
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
          />
        </div>
      </div>

      {/* Projection Preview Box */}
      <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-center text-xs text-slate-500">
        {selectedInsumo ? (
          <div className="flex items-center justify-between text-xs text-slate-700 px-2 font-medium">
            <span>Carne: <strong>{selectedInsumo.insumo}</strong></span>
            <span>Queda en Bodega: <strong className="text-blue-600">{tipoCorte === 'PORCIONADO' ? `${selectedInsumo.bodega_porc_und - cantNum} porc` : `${(selectedInsumo.bodega_sin_porc_kg - pesoNum).toFixed(2)} Kg`}</strong></span>
            <span>Pasa a Cocina: <strong className="text-orange-600">+{cantNum || pesoNum} {tipoCorte === 'PORCIONADO' ? 'porc' : 'Kg'}</strong></span>
          </div>
        ) : (
          <span className="italic text-slate-400">Escribe y selecciona el insumo arriba para ver la proyección del traslado.</span>
        )}
      </div>

      {/* Submit Button (Right aligned) */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-[#f97316] hover:bg-[#ea580c] active:scale-[0.98] text-white font-semibold text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <ArrowRightCircle className="w-4 h-4" />
              <span>Registrar Salida a Cocina</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
