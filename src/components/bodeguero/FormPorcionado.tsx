'use client';

import { useState } from 'react';
import { Scissors, Loader2, AlertCircle } from 'lucide-react';
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

  // Auto-calcular sugerencia de porciones si hay peso estándar
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
    <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 bg-white rounded-b-2xl shadow-sm">
      <SmartSearchInsumo
        insumos={insumos}
        selectedInsumo={selectedInsumo}
        onSelect={(item) => {
          setSelectedInsumo(item);
          if (item && kgAProcesar) handleKgChange(kgAProcesar);
        }}
        placeholder="Buscar carne a procesar y porcionar..."
        label="Buscar Carne a Porcionar *"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Kilos Enteros a Procesar (Kg) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={kgAProcesar}
            onChange={(e) => handleKgChange(e.target.value)}
            placeholder="0.00"
            className="w-full h-11 px-3 text-base font-bold rounded-xl border border-slate-300 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Porciones Obtenidas (Unidades) *</label>
          <input
            type="number"
            min="1"
            required
            value={porciones}
            onChange={(e) => setPorciones(e.target.value)}
            placeholder="0"
            className="w-full h-11 px-3 text-base font-bold rounded-xl border border-slate-300 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Peso Total Porciones (Kg) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={pesoPorcionesKg}
            onChange={(e) => setPesoPorcionesKg(e.target.value)}
            placeholder="0.00"
            className="w-full h-11 px-3 text-base font-bold rounded-xl border border-slate-300 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Merma Resultante (Kg)</label>
          <input
            type="number"
            step="0.01"
            value={mermaManualKg !== '' ? mermaManualKg : (mermaCalculada > 0 ? mermaCalculada.toFixed(2) : '')}
            onChange={(e) => setMermaManualKg(e.target.value)}
            placeholder="Auto calculada"
            className="w-full h-11 px-3 text-base font-bold text-red-600 rounded-xl border border-slate-300 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">Observaciones</label>
        <input
          type="text"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Notas del porcionado (ej. Deshuese, grasa, corte)"
          className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
        />
      </div>

      {/* Live Preview Box */}
      {selectedInsumo && (
        <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl text-xs md:text-sm text-purple-900 space-y-1.5 animate-fade-in">
          <div className="font-bold flex items-center justify-between">
            <span>Resumen del Porcionado: {selectedInsumo.insumo}</span>
            <span className="text-xs bg-purple-200 px-2 py-0.5 rounded font-bold">Transformación</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Resta de Enteros:</span>{' '}
              <strong className="text-red-700">-{kgProcNum.toFixed(2)} Kg</strong>
            </div>
            <div>
              <span className="text-slate-500">Suma a Porciones:</span>{' '}
              <strong className="text-purple-700">+{porcNum} und ({pesoPorcNum.toFixed(2)} Kg)</strong>
            </div>
            <div className="col-span-2 flex items-center justify-between text-red-700 bg-red-50 p-2 rounded border border-red-200 font-bold">
              <span>📉 Merma Calculada: {mermaFinal.toFixed(2)} Kg</span>
              <span>Pérdida: ${formatMoney(mermaPesos)}</span>
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !selectedInsumo}
        className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Scissors className="w-5 h-5" />
            <span>Registrar Porcionado y Merma</span>
          </>
        )}
      </button>
    </form>
  );
}
