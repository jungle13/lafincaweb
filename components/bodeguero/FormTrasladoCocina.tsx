'use client';

import { useState, useMemo } from 'react';
import { ArrowRightCircle, Loader2 } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormTrasladoCocina({ insumos, onSuccess }: Props) {
  const [selectedInsumoId, setSelectedInsumoId] = useState<string | number | null>(null);
  const [tipoEntrega, setTipoEntrega] = useState<'PORCIONADO' | 'ENTERO'>('PORCIONADO');
  const [cantidad, setCantidad] = useState('');
  const [pesoDespachado, setPesoDespachado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedInsumo = useMemo(() => {
    if (!selectedInsumoId) return null;
    return insumos.find((i) => String(i.insumo_id) === String(selectedInsumoId)) || null;
  }, [insumos, selectedInsumoId]);

  const cantNum = parseFloat(cantidad) || 0;
  const pesoNum = parseFloat(pesoDespachado) || 0;
  const isEntero = tipoEntrega === 'ENTERO';

  const handleCantChange = (val: string) => {
    setCantidad(val);
    const c = parseFloat(val) || 0;
    if (selectedInsumo && c > 0) {
      if (isEntero) {
        setPesoDespachado(c.toFixed(2));
      } else {
        const pesoEst = (selectedInsumo.peso_porc_gramos || 350) / 1000;
        setPesoDespachado((c * pesoEst).toFixed(2));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Por favor selecciona una carne o insumo.');
    if (cantNum <= 0) return alert('Ingresa la cantidad a entregar.');

    if (isEntero) {
      if (selectedInsumo.bodega_sin_porc_kg < cantNum) {
        return alert(`Stock insuficiente en bodega. Solo hay ${selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg.`);
      }
    } else {
      if (selectedInsumo.bodega_porc_und < cantNum) {
        return alert(`Stock insuficiente en bodega. Solo hay ${selectedInsumo.bodega_porc_und} porciones.`);
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'TRASLADO_COCINA',
          insumoId: selectedInsumo.insumo_id,
          tipoEntrega,
          cantidad: cantNum,
          pesoKg: pesoNum,
          observaciones,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar salida a cocina');

      setCantidad('');
      setPesoDespachado('');
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
        placeholder="Escribe para buscar carne que va a cocina..."
        label="Buscar Carne / Insumo a Entregar a Cocina *"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Tipo de Entrega</label>
          <select
            value={tipoEntrega}
            onChange={(e) => {
              const t = e.target.value as any;
              setTipoEntrega(t);
              setCantidad('');
              setPesoDespachado('');
            }}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-orange-500 bg-white text-slate-800"
          >
            <option value="PORCIONADO">Porciones Listas (Unidades)</option>
            <option value="ENTERO">Pieza Entera / Abarrote (Kg)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">
            {isEntero ? 'Kilos a Entregar (Kg) *' : 'Cantidad a Entregar (Porciones) *'}
          </label>
          <input
            type="number"
            step={isEntero ? '0.01' : '1'}
            min={isEntero ? '0.01' : '1'}
            required
            value={cantidad}
            onChange={(e) => handleCantChange(e.target.value)}
            placeholder={isEntero ? 'Ej. 5.00' : 'Ej. 10'}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Peso Despachado (Kg) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={pesoDespachado}
            onChange={(e) => setPesoDespachado(e.target.value)}
            placeholder="0.00"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-normal text-slate-700 mb-1">Observaciones / Turno</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Almuerzo / Cena / Evento"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800"
          />
        </div>
      </div>

      {/* Projection Preview Box */}
      <div className="p-3.5 bg-[#f8fafc] border border-slate-200 rounded-xl space-y-2 text-xs font-normal">
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          TRASLADO A COCINA: {selectedInsumo ? selectedInsumo.insumo.toUpperCase() : 'SELECCIONA UN INSUMO'}
        </div>

        {selectedInsumo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-[11px] text-slate-500 font-normal">Disponible en Bodega ➔ Queda:</div>
              <div className="text-slate-800 font-normal mt-0.5">
                {isEntero
                  ? `${selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg ➔ `
                  : `${selectedInsumo.bodega_porc_und} und (${selectedInsumo.bodega_porc_kg.toFixed(2)} Kg) ➔ `}
                <span className="text-rose-600 font-medium">
                  {isEntero
                    ? `${Math.max(0, selectedInsumo.bodega_sin_porc_kg - cantNum).toFixed(2)} Kg`
                    : `${Math.max(0, selectedInsumo.bodega_porc_und - cantNum)} und (${Math.max(0, selectedInsumo.bodega_porc_kg - pesoNum).toFixed(2)} Kg)`}
                </span>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 font-normal">Actual en Cocina ➔ Pasa a:</div>
              <div className="text-slate-800 font-normal mt-0.5">
                {isEntero
                  ? `${selectedInsumo.cocina_sin_porc_kg.toFixed(2)} Kg ➔ `
                  : `${selectedInsumo.cocina_porc_und} und (${selectedInsumo.cocina_porc_kg.toFixed(2)} Kg) ➔ `}
                <span className="text-emerald-600 font-medium">
                  {isEntero
                    ? `${(selectedInsumo.cocina_sin_porc_kg + cantNum).toFixed(2)} Kg`
                    : `${(selectedInsumo.cocina_porc_und + cantNum)} und (${(selectedInsumo.cocina_porc_kg + pesoNum).toFixed(2)} Kg)`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span className="italic text-slate-400 text-xs">Selecciona un insumo para previsualizar el traslado antes de guardar.</span>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-normal text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
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
