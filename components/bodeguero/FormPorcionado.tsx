'use client';

import { useState, useMemo } from 'react';
import { Scissors, Loader2, Sparkles, AlertTriangle, ArrowRight, Scale, DollarSign, CheckCircle2 } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormPorcionado({ insumos, onSuccess }: Props) {
  const [selectedInsumoId, setSelectedInsumoId] = useState<string | number | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [kgAProcesar, setKgAProcesar] = useState('');
  const [porciones, setPorciones] = useState('');
  const [pesoPorcionesKg, setPesoPorcionesKg] = useState('');
  const [mermaManualKg, setMermaManualKg] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  // Mantener siempre el insumo sincronizado con la última actualización de inventario
  const selectedInsumo = useMemo(() => {
    if (!selectedInsumoId) return null;
    return insumos.find((i) => String(i.insumo_id) === String(selectedInsumoId)) || null;
  }, [insumos, selectedInsumoId]);

  const gramosStd = selectedInsumo?.peso_porc_gramos || 350;
  const pesoEstKg = gramosStd / 1000;
  const costoKg = selectedInsumo?.costo_unitario_kg || 0;
  const costoPorcionEst = Math.round(costoKg * pesoEstKg);
  const rindePorKg = (1 / pesoEstKg).toFixed(1);

  const kgProcNum = parseFloat(kgAProcesar) || 0;
  const porcNum = parseInt(porciones) || 0;
  const pesoPorcNum = parseFloat(pesoPorcionesKg) || 0;
  const mermaCalculada = Math.max(0, parseFloat((kgProcNum - pesoPorcNum).toFixed(2)));
  const mermaFinal = mermaManualKg !== '' ? (parseFloat(mermaManualKg) || 0) : mermaCalculada;
  const valorTotalProcesado = Math.round(kgProcNum * costoKg);
  const valorMerma = Math.round(mermaFinal * costoKg);

  // 1. Manejo automático al cambiar Kilos a Procesar
  const handleKgChange = (val: string) => {
    setKgAProcesar(val);
    const kg = parseFloat(val) || 0;
    if (selectedInsumo && kg > 0) {
      const porcSug = Math.round(kg / pesoEstKg);
      const pesoSug = parseFloat((porcSug * pesoEstKg).toFixed(2));
      setPorciones(porcSug > 0 ? porcSug.toString() : '');
      setPesoPorcionesKg(pesoSug > 0 ? pesoSug.toFixed(2) : '');
    }
  };

  // 2. Manejo automático al cambiar Porciones
  const handlePorcionesChange = (val: string) => {
    setPorciones(val);
    const p = parseInt(val) || 0;
    if (selectedInsumo && p > 0) {
      const pesoSug = parseFloat((p * pesoEstKg).toFixed(2));
      setPesoPorcionesKg(pesoSug.toFixed(2));
      if (!kgAProcesar || parseFloat(kgAProcesar) === 0) {
        setKgAProcesar(pesoSug.toFixed(2));
      }
    }
  };

  // 3. Manejo automático al cambiar Peso Real en Báscula
  const handlePesoRealChange = (val: string) => {
    setPesoPorcionesKg(val);
    const peso = parseFloat(val) || 0;
    if (selectedInsumo && peso > 0 && (!porciones || parseInt(porciones) === 0)) {
      const p = Math.round(peso / pesoEstKg);
      if (p > 0) setPorciones(p.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Selecciona una carne para porcionar.');
    if (kgProcNum <= 0) return alert('Ingresa los Kilos a procesar.');
    if (selectedInsumo.bodega_sin_porc_kg < kgProcNum) {
      return alert(`Stock insuficiente en bodega entero. Solo hay ${selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg enteros disponibles.`);
    }

    setLoading(true);
    try {
      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'PORCIONADO',
          insumoId: selectedInsumo.insumo_id,
          fecha,
          kgAProcesar: kgProcNum,
          porciones: porcNum,
          pesoPorcionesKg: pesoPorcNum,
          mermaKg: mermaFinal,
          observaciones: observaciones.trim() || `Porcionado estándar de ${kgProcNum} Kg ➔ ${porcNum} porc (${pesoPorcNum} Kg)`,
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
  const gramajePromedio = porcNum > 0 ? Math.round((pesoPorcNum * 1000) / porcNum) : gramosStd;

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

      {/* 💡 TARJETA DE REGLA Y VALORES DEL CATÁLOGO */}
      {selectedInsumo && (
        <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-purple-950">Estándar Catálogo:</span>{' '}
              <span className="text-purple-800">1 porción = <strong>{gramosStd} g</strong> ({pesoEstKg} Kg) • Rinde <strong>~{rindePorKg} porc/Kg</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-700">
            <span className="bg-white px-2.5 py-1 rounded-lg border border-purple-200 text-purple-900">
              Costo: <strong>${formatMoney(costoKg)} / Kg</strong>
            </span>
            <span className="bg-white px-2.5 py-1 rounded-lg border border-purple-200 text-purple-900">
              Costo/Porción: <strong>${formatMoney(costoPorcionEst)}</strong>
            </span>
            <span className="bg-amber-100/80 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300/80">
              Bodega Entero: <strong>{selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg</strong>
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Porcionado</label>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">Kg Entero a Procesar *</label>
            {selectedInsumo && selectedInsumo.bodega_sin_porc_kg < kgProcNum && (
              <span className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> Excede stock
              </span>
            )}
          </div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={kgAProcesar}
            onChange={(e) => handleKgChange(e.target.value)}
            placeholder="Ej. 10.50"
            className={`w-full h-9 px-2.5 text-xs font-normal rounded-lg border outline-none text-slate-800 bg-white ${
              selectedInsumo && selectedInsumo.bodega_sin_porc_kg < kgProcNum
                ? 'border-red-400 bg-red-50/30 focus:border-red-500'
                : 'border-slate-300 focus:border-purple-500'
            }`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">Porciones Obtenidas (Und) *</label>
            {selectedInsumo && kgProcNum > 0 && (
              <span className="text-[10px] text-purple-700 font-normal">Sugerido: ~{Math.round(kgProcNum / pesoEstKg)} u</span>
            )}
          </div>
          <input
            type="number"
            min="1"
            required
            value={porciones}
            onChange={(e) => handlePorcionesChange(e.target.value)}
            placeholder="Ej. 28"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">Peso Total Porciones (Kg) *</label>
            {selectedInsumo && porcNum > 0 && (
              <span className="text-[10px] text-purple-700 font-normal">Estándar: {(porcNum * pesoEstKg).toFixed(2)}k</span>
            )}
          </div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={pesoPorcionesKg}
            onChange={(e) => handlePesoRealChange(e.target.value)}
            placeholder="Ej. 9.80"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Observaciones / Motivo Merma</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Grasa, pellejo, recorte no utilizable"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-purple-500 text-slate-800 bg-white"
          />
        </div>
      </div>

      {/* 📊 RESUMEN DINÁMICO EN VIVO */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2.5 text-xs font-normal">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
          <span>RESULTADO DE RENDIMIENTO Y BALANCE ECONÓMICO</span>
          {valorTotalProcesado > 0 && (
            <span className="text-slate-900 font-bold">
              Inversión Lote: ${formatMoney(valorTotalProcesado)} COP
            </span>
          )}
        </div>

        {selectedInsumo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Bodega Entero */}
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">Bodega Entero:</div>
              <div className="text-slate-800 font-semibold mt-0.5">
                {selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg ➔{' '}
                <span className={selectedInsumo.bodega_sin_porc_kg - kgProcNum < 0 ? 'text-red-600 font-bold' : 'text-slate-900'}>
                  {Math.max(0, selectedInsumo.bodega_sin_porc_kg - kgProcNum).toFixed(2)} Kg
                </span>
              </div>
            </div>

            {/* Bodega Porciones */}
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">Bodega Porcionado:</div>
              <div className="text-slate-800 font-semibold mt-0.5">
                {selectedInsumo.bodega_porc_und} u ({selectedInsumo.bodega_porc_kg.toFixed(2)}k) ➔{' '}
                <span className="text-emerald-700 font-bold">
                  {(selectedInsumo.bodega_porc_und + porcNum)} u ({(selectedInsumo.bodega_porc_kg + pesoPorcNum).toFixed(2)} Kg)
                </span>
              </div>
            </div>

            {/* Rendimiento */}
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">Rendimiento y Merma:</div>
              <div className="text-sky-700 font-bold mt-0.5">
                {rendimientoPorcentaje.toFixed(1)}% aprovechable{' '}
                <span className="text-rose-600 text-[11px] font-normal">
                  (Merma: {mermaFinal.toFixed(2)} Kg • ${formatMoney(valorMerma)})
                </span>
              </div>
            </div>

            {/* Gramaje Promedio */}
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">Gramaje Real por Porción:</div>
              <div className="text-purple-950 font-bold mt-0.5 flex items-center justify-between">
                <span>{gramajePromedio} g / porción</span>
                <span className="text-[10px] font-normal text-slate-500">(Estándar: {gramosStd}g)</span>
              </div>
            </div>
          </div>
        ) : (
          <span className="italic text-slate-400 text-xs">Selecciona una carne para previsualizar el impacto antes de guardar.</span>
        )}
      </div>

      {/* Botón Guardar */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo || kgProcNum <= 0}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-medium text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
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
