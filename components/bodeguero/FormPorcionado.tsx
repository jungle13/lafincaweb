'use client';

import { useState, useMemo } from 'react';
import { Scissors, Loader2 } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormPorcionado({ insumos, onSuccess }: Props) {
  const [selectedInsumoId, setSelectedInsumoId] = useState<number | null>(null);
  const [kgAProcesar, setKgAProcesar] = useState('');
  const [porciones, setPorciones] = useState('');
  const [pesoPorcionesKg, setPesoPorcionesKg] = useState('');
  const [mermaManualKg, setMermaManualKg] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  // Mantener siempre el insumo sincronizado con la última actualización de inventario
  const selectedInsumo = useMemo(() => {
    if (!selectedInsumoId) return null;
    return insumos.find((i) => i.insumo_id === selectedInsumoId) || null;
  }, [insumos, selectedInsumoId]);

  const kgProcNum = parseFloat(kgAProcesar) || 0;
  const porcNum = parseInt(porciones) || 0;
  const pesoPorcNum = parseFloat(pesoPorcionesKg) || 0;
  const mermaCalculada = Math.max(0, kgProcNum - pesoPorcNum);
  const mermaFinal = mermaManualKg !== '' ? (parseFloat(mermaManualKg) || 0) : mermaCalculada;

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

  const rendimientoPorcentaje = kgProcNum > 0 ? Math.min(100, Math.max(0, (pesoPorcNum / kgProcNum) * 100)) : 100;
  const mermaPorcentaje = kgProcNum > 0 ? Math.max(0, (mermaFinal / kgProcNum) * 100) : 0;
  const gramajePromedio = porcNum > 0 ? Math.round((pesoPorcNum * 1000) / porcNum) : (selectedInsumo?.peso_porc_gramos || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-normal">
      <SmartSearchInsumo
        insumos={insumos}
        selectedInsumo={selectedInsumo}
        onSelect={(item) => {
          setSelectedInsumoId(item ? item.insumo_id : null);
          if (item && kgAProcesar) handleKgChange(kgAProcesar);
        }}
        placeholder="Escribe para buscar carne a porcionar..."
        label="Buscar Carne a Procesar y Porcionar *"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Kg de Pieza Entera a Procesar *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={kgAProcesar}
            onChange={(e) => handleKgChange(e.target.value)}
            placeholder="Ej. 10.50"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Porciones Obtenidas (Unidades) *</label>
          <input
            type="number"
            min="1"
            required
            value={porciones}
            onChange={(e) => setPorciones(e.target.value)}
            placeholder="Ej. 28"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Peso Total Porciones (Kg) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={pesoPorcionesKg}
            onChange={(e) => setPesoPorcionesKg(e.target.value)}
            placeholder="Ej. 9.80"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Observaciones / Motivo de merma</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Grasa y recorte no utilizable"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800"
          />
        </div>
      </div>

      {/* Projection Preview Box */}
      <div className="p-3.5 bg-[#f8fafc] border border-slate-200 rounded-xl space-y-2 text-xs font-normal">
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          RESULTADO DE RENDIMIENTO Y PORCIONADO
        </div>

        {selectedInsumo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Bodega - Piezas Enteras */}
            <div>
              <div className="text-[11px] text-slate-500 font-normal">Bodega - Piezas Enteras:</div>
              <div className="text-slate-800 font-normal mt-0.5">
                {selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg ➔ <span className="text-rose-600 font-medium">{Math.max(0, selectedInsumo.bodega_sin_porc_kg - kgProcNum).toFixed(2)} Kg</span>
              </div>
            </div>

            {/* Bodega - Porciones Listas */}
            <div>
              <div className="text-[11px] text-slate-500 font-normal">Bodega - Porciones Listas:</div>
              <div className="text-slate-800 font-normal mt-0.5">
                {selectedInsumo.bodega_porc_und} und ({selectedInsumo.bodega_porc_kg.toFixed(2)} Kg) ➔ <span className="text-emerald-600 font-medium">{(selectedInsumo.bodega_porc_und + porcNum)} und ({(selectedInsumo.bodega_porc_kg + pesoPorcNum).toFixed(2)} Kg)</span>
              </div>
            </div>

            {/* Rendimiento del Corte */}
            <div>
              <div className="text-[11px] text-slate-500 font-normal">Rendimiento del Corte:</div>
              <div className="text-sky-600 font-normal mt-0.5">
                {rendimientoPorcentaje.toFixed(1)}% <span className="text-slate-500 text-[11px] font-normal">(Merma: {mermaFinal.toFixed(2)} Kg / {mermaPorcentaje.toFixed(1)}%)</span>
              </div>
            </div>

            {/* Gramaje Promedio */}
            <div>
              <div className="text-[11px] text-slate-500 font-normal">Gramaje promedio real por porción:</div>
              <div className="text-slate-800 font-normal mt-0.5">
                {gramajePromedio} gramos / porción
              </div>
            </div>
          </div>
        ) : (
          <span className="italic text-slate-400 text-xs">Selecciona una carne para previsualizar el impacto antes de guardar.</span>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-[#a855f7] hover:bg-[#9333ea] active:scale-[0.98] text-white font-normal text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
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
