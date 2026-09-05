'use client';

import { useState, useMemo } from 'react';
import { CornerDownLeft, Loader2, Sparkles, AlertTriangle, ArrowRight, DollarSign } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormDevolucionCocina({ insumos, onSuccess }: Props) {
  const [selectedInsumoId, setSelectedInsumoId] = useState<string | number | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [tipoDevolucion, setTipoDevolucion] = useState<'PORCIONADO' | 'ENTERO'>('PORCIONADO');
  const [cantidad, setCantidad] = useState('');
  const [pesoDevuelto, setPesoDevuelto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedInsumo = useMemo(() => {
    if (!selectedInsumoId) return null;
    return insumos.find((i) => String(i.insumo_id) === String(selectedInsumoId)) || null;
  }, [insumos, selectedInsumoId]);

  const gramosStd = selectedInsumo?.peso_porc_gramos || 350;
  const pesoEstKg = gramosStd / 1000;
  const costoKg = selectedInsumo?.costo_unitario_kg || 0;

  const cantNum = parseFloat(cantidad) || 0;
  const pesoNum = parseFloat(pesoDevuelto) || 0;
  const isEntero = tipoDevolucion === 'ENTERO';
  const valorDevolucion = Math.round((isEntero ? cantNum : pesoNum) * costoKg);

  const handleCantChange = (val: string) => {
    setCantidad(val);
    const c = parseFloat(val) || 0;
    if (selectedInsumo && c > 0) {
      if (isEntero) {
        setPesoDevuelto(c.toFixed(2));
      } else {
        const autoKg = parseFloat((c * pesoEstKg).toFixed(2));
        setPesoDevuelto(autoKg.toFixed(2));
      }
    }
  };

  const handlePesoChange = (val: string) => {
    setPesoDevuelto(val);
    const p = parseFloat(val) || 0;
    if (selectedInsumo && p > 0 && isEntero) {
      if (!cantidad || parseFloat(cantidad) === 0) setCantidad(p.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Por favor selecciona una carne o insumo.');
    if (cantNum <= 0) return alert('Ingresa la cantidad a devolver.');

    if (isEntero) {
      if (selectedInsumo.cocina_sin_porc_kg < cantNum) {
        return alert(`Stock insuficiente en cocina para devolver. Solo hay ${selectedInsumo.cocina_sin_porc_kg.toFixed(2)} Kg en cocina.`);
      }
    } else {
      if (selectedInsumo.cocina_porc_und < cantNum) {
        return alert(`Stock insuficiente en cocina para devolver. Solo hay ${selectedInsumo.cocina_porc_und} porciones en cocina.`);
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'DEVOLUCION_COCINA',
          insumoId: selectedInsumo.insumo_id,
          fecha,
          tipoDevolucion,
          cantidad: cantNum,
          pesoKg: isEntero ? cantNum : (pesoNum || (cantNum * pesoEstKg)),
          observaciones: observaciones.trim() || `Devolución cocina ${selectedInsumo.insumo} (${isEntero ? `${cantNum} Kg` : `${cantNum} porc / ${pesoNum} Kg`})`,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar devolución');

      setCantidad('');
      setPesoDevuelto('');
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
        onSelect={(item) => {
          setSelectedInsumoId(item ? item.insumo_id : null);
          if (item && cantidad) handleCantChange(cantidad);
        }}
        placeholder="Escribe para buscar carne a devolver de cocina a bodega..."
        label="Buscar Carne / Insumo que Retorna a Bodega *"
      />

      {/* 💡 TARJETA DE REGLA Y VALORES DEL CATÁLOGO */}
      {selectedInsumo && (
        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-amber-950">Catálogo:</span>{' '}
              <span className="text-amber-900">
                1 porción estándar = <strong>{gramosStd} g</strong> ({pesoEstKg} Kg) • Costo: <strong>${formatMoney(costoKg)} / Kg</strong>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
            <span className="bg-white px-2.5 py-1 rounded-lg border border-amber-200 text-amber-950">
              Cocina Entero: <strong>{selectedInsumo.cocina_sin_porc_kg.toFixed(2)} Kg</strong>
            </span>
            <span className="bg-white px-2.5 py-1 rounded-lg border border-amber-200 text-amber-950">
              Cocina Porc: <strong>{selectedInsumo.cocina_porc_und} u</strong> ({selectedInsumo.cocina_porc_kg.toFixed(2)}k)
            </span>
            <span className="bg-amber-100 text-amber-950 px-2.5 py-1 rounded-lg border border-amber-300">
              Bodega Actual: <strong>{selectedInsumo.bodega_porc_und} u</strong> ({selectedInsumo.bodega_sin_porc_kg.toFixed(1)}k ent)
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Devolución</label>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-amber-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de Devolución</label>
          <select
            value={tipoDevolucion}
            onChange={(e) => {
              const t = e.target.value as any;
              setTipoDevolucion(t);
              setCantidad('');
              setPesoDevuelto('');
            }}
            className="w-full h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-300 outline-none focus:border-amber-500 bg-white text-slate-800 cursor-pointer"
          >
            <option value="PORCIONADO">🥩 Porciones Listas (Unidades)</option>
            <option value="ENTERO">📦 Pieza Entera / Abarrote (Kg)</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">
              {isEntero ? 'Kilos a Devolver (Kg) *' : 'Porciones a Devolver (Und) *'}
            </label>
            {selectedInsumo && (
              <span className="text-[10px] text-amber-800 font-medium">
                En Cocina: {isEntero ? `${selectedInsumo.cocina_sin_porc_kg.toFixed(2)}k` : `${selectedInsumo.cocina_porc_und}u`}
              </span>
            )}
          </div>
          <input
            type="number"
            step={isEntero ? '0.01' : '1'}
            min={isEntero ? '0.01' : '1'}
            required
            value={cantidad}
            onChange={(e) => handleCantChange(e.target.value)}
            placeholder={isEntero ? 'Ej. 2.50' : 'Ej. 5'}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-amber-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">Peso Reintegrado (Kg) *</label>
            {!isEntero && cantNum > 0 && (
              <span className="text-[10px] text-amber-800 font-medium">Auto: {(cantNum * pesoEstKg).toFixed(2)}k</span>
            )}
          </div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={pesoDevuelto}
            onChange={(e) => handlePesoChange(e.target.value)}
            placeholder="0.00"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-amber-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Motivo / Observaciones</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Sobrante de turno / Cierre"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-amber-500 text-slate-800 bg-white"
          />
        </div>
      </div>

      {/* 📊 RESUMEN DINÁMICO EN VIVO */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2 text-xs font-normal">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
          <span>BALANCE DE DEVOLUCIÓN Y REINTEGRO A BODEGA</span>
          {valorDevolucion > 0 && (
            <span className="text-slate-900 font-bold">
              Valor Reintegrado: ${formatMoney(valorDevolucion)} COP (${formatMoney(costoKg)}/Kg)
            </span>
          )}
        </div>

        {selectedInsumo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">Cocina (Sale) ➔ Saldo Final:</div>
              <div className="text-slate-800 font-semibold mt-0.5">
                {isEntero
                  ? `${selectedInsumo.cocina_sin_porc_kg.toFixed(2)} Kg ➔ `
                  : `${selectedInsumo.cocina_porc_und} und (${selectedInsumo.cocina_porc_kg.toFixed(2)} Kg) ➔ `}
                <span className={
                  (isEntero ? selectedInsumo.cocina_sin_porc_kg - cantNum : selectedInsumo.cocina_porc_und - cantNum) < 0
                    ? 'text-red-600 font-bold'
                    : 'text-slate-900 font-bold'
                }>
                  {isEntero
                    ? `${Math.max(0, selectedInsumo.cocina_sin_porc_kg - cantNum).toFixed(2)} Kg`
                    : `${Math.max(0, selectedInsumo.cocina_porc_und - cantNum)} und (${Math.max(0, selectedInsumo.cocina_porc_kg - pesoNum).toFixed(2)} Kg)`}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">Bodega (Reingresa) ➔ Saldo Final:</div>
              <div className="text-slate-800 font-semibold mt-0.5">
                {isEntero
                  ? `${selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg ➔ `
                  : `${selectedInsumo.bodega_porc_und} und (${selectedInsumo.bodega_porc_kg.toFixed(2)} Kg) ➔ `}
                <span className="text-emerald-700 font-bold">
                  {isEntero
                    ? `${(selectedInsumo.bodega_sin_porc_kg + cantNum).toFixed(2)} Kg`
                    : `${(selectedInsumo.bodega_porc_und + cantNum)} und (${(selectedInsumo.bodega_porc_kg + pesoNum).toFixed(2)} Kg)`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span className="italic text-slate-400 text-xs">Selecciona un insumo para previsualizar la devolución antes de guardar.</span>
        )}
      </div>

      {/* Botón Guardar */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo || cantNum <= 0}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-medium text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CornerDownLeft className="w-4 h-4" />
              <span>Registrar Devolución a Bodega</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
