'use client';

import { useState } from 'react';
import { Scissors, Loader2 } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormPorcionado({ insumos, onSuccess }: Props) {
  const [selectedInsumo, setSelectedInsumo] = useState<InsumoItem | null>(null);
  const [kgAProcesar, setKgAProcesar] = useState('');
  const [porciones, setPorciones] = useState('');
  const [pesoPorcionesKg, setPesoPorcionesKg] = useState('');
  const [mermaManualKg, setMermaManualKg] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const kgProcNum = parseFloat(kgAProcesar) || 0;
  const porcNum = parseInt(porciones) || 0;
  const pesoPorcNum = parseFloat(pesoPorcionesKg) || 0;
  const mermaCalculada = Math.max(0, kgProcNum - pesoPorcNum);
  const mermaFinal = mermaManualKg !== '' ? (parseFloat(mermaManualKg) || 0) : mermaCalculada;
  const mermaPesos = mermaFinal * (selectedInsumo?.costo_unitario_kg || 0);

  const handleKgChange = (val: string) => {
    setKgAProcesar(val);
    const kg = parseFloat(val) || 0;
    if (selectedInsumo && kg > 0) {
      const gramos = selectedInsumo.peso_porc_gramos || 350;
      const pesoEstKg = gramos / 1000;
      const porcSug = Math.floor(kg / pesoEstKg);
      if (!porciones) setPorciones(porcSug.toString());
      if (!pesoPorcionesKg) setPesoPorcionesKg((porcSug * pesoEstKg).toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Selecciona una carne para porcionar.');
    if (kgProcNum <= 0) return alert('Ingresa los Kilos a procesar.');
    if (selectedInsumo.bodega_sin_porc_kg < kgProcNum) {
      return alert(`Stock insuficiente. Solo hay ${selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg enteros disponibles.`);
    }

    setLoading(true);
    try {
      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'PORCIONADO',
          insumoId: selectedInsumo.insumo_id,
          kgAProcesar: kgProcNum,
          porciones: porcNum,
          pesoPorcionesKg: pesoPorcNum,
          mermaKg: mermaFinal,
          observaciones,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar porcionado');

      setSelectedInsumo(null);
      setKgAProcesar('');
      setPorciones('');
      setPesoPorcionesKg('');
      setMermaManualKg('');
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
        onSelect={(item) => {
          setSelectedInsumo(item);
          if (item && kgAProcesar) handleKgChange(kgAProcesar);
        }}
        placeholder="Escribe para buscar carne a porcionar (ej. Lomo viche, Punta de anca, Churrasco)..."
        label="Buscar Carne a Procesar y Porcionar *"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Kg de Pieza Entera a Procesar *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={kgAProcesar}
            onChange={(e) => handleKgChange(e.target.value)}
            placeholder="Ej. 10.50"
            className="w-full h-9 px-2.5 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Porciones Obtenidas (Unidades) *</label>
          <input
            type="number"
            min="1"
            required
            value={porciones}
            onChange={(e) => setPorciones(e.target.value)}
            placeholder="Ej. 28"
            className="w-full h-9 px-2.5 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-purple-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Peso Total Porciones (Kg) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={pesoPorcionesKg}
            onChange={(e) => setPesoPorcionesKg(e.target.value)}
            placeholder="Ej. 9.80"
            className="w-full h-9 px-2.5 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones / Motivo Merma</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Grasa y recorte no utilizable"
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800"
          />
        </div>
      </div>

      {/* Projection Preview Box */}
      <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-center text-xs text-slate-500">
        {selectedInsumo ? (
          <div className="flex items-center justify-between text-xs text-slate-700 px-2 font-medium">
            <span>Carne: <strong>{selectedInsumo.insumo}</strong></span>
            <span>Resta Enteros: <strong className="text-red-600">-{kgProcNum.toFixed(2)} Kg</strong></span>
            <span>Suma Porc: <strong className="text-purple-600">+{porcNum} und ({pesoPorcNum.toFixed(2)} Kg)</strong></span>
            <span className="text-rose-600 font-semibold">Merma: {mermaFinal.toFixed(2)} Kg (${formatMoney(mermaPesos)})</span>
          </div>
        ) : (
          <span className="italic text-slate-400">Escribe y selecciona la carne arriba para calcular rendimiento y merma.</span>
        )}
      </div>

      {/* Submit Button (Right aligned) */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-[#a855f7] hover:bg-[#9333ea] active:scale-[0.98] text-white font-semibold text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Scissors className="w-4 h-4" />
              <span>Guardar Porcionado y Merma</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
