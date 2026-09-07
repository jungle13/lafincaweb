'use client';

import { useState, useMemo } from 'react';
import { Trash2, Loader2, Sparkles, AlertTriangle, ShieldAlert, DollarSign } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

type MotivoMerma = 
  | 'DESPERDICIO_OPERATIVO'
  | 'DETERIORO_ALMACENAMIENTO'
  | 'MERMA_DESCONGELACION'
  | 'CORTE_NO_CONFORME'
  | 'OTRO';

export default function FormMermaBaja({ insumos, onSuccess }: Props) {
  const [selectedInsumoId, setSelectedInsumoId] = useState<string | number | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [ubicacion, setUbicacion] = useState<'BODEGA' | 'COCINA'>('BODEGA');
  const [tipoProducto, setTipoProducto] = useState<'ENTERO' | 'PORCIONADO'>('ENTERO');
  const [motivo, setMotivo] = useState<MotivoMerma>('DESPERDICIO_OPERATIVO');
  const [cantidad, setCantidad] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedInsumo = useMemo(() => {
    if (!selectedInsumoId) return null;
    return insumos.find((i) => String(i.insumo_id) === String(selectedInsumoId)) || null;
  }, [insumos, selectedInsumoId]);

  const isUnd = useMemo(() => {
    if (!selectedInsumo) return false;
    const unidad = selectedInsumo.unidad_medida?.toLowerCase();
    const cat = selectedInsumo.categoria?.toLowerCase() || '';
    const name = selectedInsumo.insumo?.toLowerCase() || '';
    return unidad === 'und' || cat.includes('embutido') || cat.includes('elaborado') || name.includes('chorizo') || name.includes('tamal');
  }, [selectedInsumo]);

  const gramosStd = selectedInsumo?.peso_porc_gramos || 350;
  const pesoEstKg = isUnd ? 1 : gramosStd / 1000;
  const costoKg = selectedInsumo?.costo_unitario_kg || 0;

  const cantNum = parseFloat(cantidad) || 0;
  
  // Stock disponible según ubicación y tipo
  const stockDisponible = useMemo(() => {
    if (!selectedInsumo) return 0;
    if (isUnd) {
      return ubicacion === 'BODEGA' 
        ? ((selectedInsumo.bodega_sin_porc_kg || 0) + (selectedInsumo.bodega_porc_und || 0))
        : ((selectedInsumo.cocina_sin_porc_kg || 0) + (selectedInsumo.cocina_porc_und || 0));
    }
    if (ubicacion === 'BODEGA') {
      return tipoProducto === 'ENTERO' 
        ? (selectedInsumo.bodega_sin_porc_kg || 0) 
        : (selectedInsumo.bodega_porc_und || 0);
    } else {
      return tipoProducto === 'ENTERO'
        ? (selectedInsumo.cocina_sin_porc_kg || 0)
        : (selectedInsumo.cocina_porc_und || 0);
    }
  }, [selectedInsumo, ubicacion, tipoProducto, isUnd]);

  // Pérdida en Kg y en Pesos
  const mermaKg = isUnd ? 0 : (tipoProducto === 'ENTERO' ? cantNum : (cantNum * pesoEstKg));
  const mermaPesos = Math.round(isUnd ? (cantNum * costoKg) : (mermaKg * costoKg));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Por favor selecciona una carne o insumo.');
    if (cantNum <= 0) return alert('Ingresa una cantidad válida.');
    if (cantNum > stockDisponible) {
      if (!confirm(`La cantidad ingresada (${cantNum}) supera el stock disponible registrado (${stockDisponible}). ¿Deseas continuar?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'BAJA_MERMA',
          insumoId: selectedInsumo.insumo_id,
          fecha,
          ubicacion,
          tipoProducto: isUnd ? 'PORCIONADO' : tipoProducto,
          motivo,
          cantidad: cantNum,
          mermaKg: isUnd ? 0 : mermaKg,
          mermaPesos,
          observaciones: observaciones.trim() || `Baja por ${motivo} en ${ubicacion} (${cantNum} ${isUnd || tipoProducto === 'PORCIONADO' ? 'und' : 'Kg'})`,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar merma/desperdicio');

      setCantidad('');
      setObservaciones('');
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-normal animate-fade-in">
      <SmartSearchInsumo
        insumos={insumos}
        selectedInsumo={selectedInsumo}
        onSelect={(item) => setSelectedInsumoId(item ? item.insumo_id : null)}
        placeholder="Escribe para buscar carne que tuvo merma o desperdicio..."
        label="Buscar Carne / Insumo con Merma o Deterioro *"
      />

      {/* 💡 TARJETA DE REGLA Y STOCK */}
      {selectedInsumo && (
        <div className="p-3 bg-rose-50/80 border border-rose-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-rose-950">Registro Directo de Merma / Baja:</span>{' '}
              <span className="text-rose-900">
                Costo: <strong>${formatMoney(costoKg)} / {isUnd ? 'und' : 'Kg'}</strong>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
            <span className="bg-white px-2.5 py-1 rounded-lg border border-rose-200 text-rose-950 font-bold">
              Disponible en {ubicacion}: {stockDisponible} {isUnd || tipoProducto === 'PORCIONADO' ? 'und' : 'Kg'}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Fecha</label>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-rose-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Ubicación de Origen</label>
          <select
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value as any)}
            className="w-full h-9 px-2.5 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-rose-500 text-slate-800 bg-white cursor-pointer"
          >
            <option value="BODEGA">🥩 BODEGA</option>
            <option value="COCINA">🍳 COCINA</option>
          </select>
        </div>

        {!isUnd && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Estado del Producto</label>
            <select
              value={tipoProducto}
              onChange={(e) => setTipoProducto(e.target.value as any)}
              className="w-full h-9 px-2.5 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-rose-500 text-slate-800 bg-white cursor-pointer"
            >
              <option value="ENTERO">Carne Entera (Kg)</option>
              <option value="PORCIONADO">Porciones Listas (Und)</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Motivo de la Merma</label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as any)}
            className="w-full h-9 px-2.5 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-rose-500 text-slate-800 bg-white cursor-pointer"
          >
            <option value="DESPERDICIO_OPERATIVO">Desperdicio Operativo (Caída/Corte)</option>
            <option value="DETERIORO_ALMACENAMIENTO">Deterioro / Pérdida de Frío</option>
            <option value="MERMA_DESCONGELACION">Merma por Descongelación</option>
            <option value="CORTE_NO_CONFORME">Corte no Conforme</option>
            <option value="OTRO">Otro Motivo</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {isUnd || tipoProducto === 'PORCIONADO' ? 'Cantidad (Unidades) *' : 'Cantidad (Kg) *'}
          </label>
          <input
            type="number"
            step={isUnd || tipoProducto === 'PORCIONADO' ? '1' : '0.01'}
            min="0.01"
            required
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={isUnd || tipoProducto === 'PORCIONADO' ? '0' : '0.00'}
            className="w-full h-9 px-2.5 text-xs font-bold rounded-lg border border-slate-300 outline-none focus:border-rose-500 text-rose-900 bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Observaciones / Justificación Auditada</label>
        <input
          type="text"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Detalle o causa del desperdicio / pérdida..."
          className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-rose-500 text-slate-800 bg-white"
        />
      </div>

      {/* 📊 RESUMEN DINÁMICO DEL COSTO DE LA PÉRDIDA */}
      <div className="p-3.5 bg-rose-50/60 border border-rose-200/90 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span className="text-slate-700 font-medium">
            Impacto Económico de la Merma:
          </span>
        </div>
        <div className="text-right">
          <span className="text-sm font-extrabold text-rose-700">
            -${formatMoney(mermaPesos)} COP
          </span>
          {!isUnd && mermaKg > 0 && (
            <span className="text-[10px] text-slate-500 block">({mermaKg.toFixed(2)} Kg de carne)</span>
          )}
        </div>
      </div>

      {/* Botón Guardar */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo || cantNum <= 0}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-medium text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              <span>Registrar Baja / Merma</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
