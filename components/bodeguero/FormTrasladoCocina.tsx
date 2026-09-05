'use client';

import { useState, useMemo, useEffect } from 'react';
import { ArrowRightCircle, Loader2, Sparkles, Zap, Sliders, CheckCircle2, AlertCircle } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormTrasladoCocina({ insumos, onSuccess }: Props) {
  const [selectedInsumoId, setSelectedInsumoId] = useState<string | number | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [tipoEntrega, setTipoEntrega] = useState<'PORCIONADO' | 'ENTERO'>('PORCIONADO');
  const [cantidad, setCantidad] = useState('');
  const [pesoDespachado, setPesoDespachado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados para Auto-Porcionado Directo
  const [autoPorcionar, setAutoPorcionar] = useState(false);
  const [showAdvancedPorc, setShowAdvancedPorc] = useState(false);
  const [customKgEntero, setCustomKgEntero] = useState('');

  const selectedInsumo = useMemo(() => {
    if (!selectedInsumoId) return null;
    return insumos.find((i) => String(i.insumo_id) === String(selectedInsumoId)) || null;
  }, [insumos, selectedInsumoId]);

  const gramosStd = selectedInsumo?.peso_porc_gramos || 350;
  const pesoEstKg = gramosStd / 1000;
  const costoKg = selectedInsumo?.costo_unitario_kg || 0;

  const cantNum = parseFloat(cantidad) || 0;
  const pesoNum = parseFloat(pesoDespachado) || (cantNum * pesoEstKg);
  const isEntero = tipoEntrega === 'ENTERO';
  const valorDespacho = Math.round((isEntero ? cantNum : pesoNum) * costoKg);

  // Kilos de carne entera que se usarían para el auto-porcionado
  const kgEnteroToUse = customKgEntero !== '' ? (parseFloat(customKgEntero) || 0) : pesoNum;
  const mermaAutoKg = Math.max(0, kgEnteroToUse - pesoNum);

  // Evaluar automáticamente si se requiere Auto-Porcionado al cambiar insumo o cantidad
  useEffect(() => {
    if (!selectedInsumo || isEntero || cantNum <= 0) {
      if (isEntero) setAutoPorcionar(false);
      return;
    }

    const porcDispBodega = selectedInsumo.bodega_porc_und || 0;
    const enteroDispKg = selectedInsumo.bodega_sin_porc_kg || 0;

    // Si no hay suficientes porciones listas en bodega, pero sí hay carne entera
    if (porcDispBodega < cantNum && enteroDispKg > 0) {
      setAutoPorcionar(true);
      if (!customKgEntero) {
        setCustomKgEntero(pesoNum.toFixed(2));
      }
    } else if (porcDispBodega >= cantNum) {
      // Si hay stock porcionado de sobra, por defecto toma de porcionado existente
      setAutoPorcionar(false);
    }
  }, [selectedInsumo, cantNum, isEntero, pesoNum]);

  // 1. Manejo reactivo de Cantidad
  const handleCantChange = (val: string) => {
    setCantidad(val);
    const c = parseFloat(val) || 0;
    if (selectedInsumo && c > 0) {
      if (isEntero) {
        setPesoDespachado(c.toFixed(2));
      } else {
        const autoKg = parseFloat((c * pesoEstKg).toFixed(2));
        setPesoDespachado(autoKg.toFixed(2));
        if (!showAdvancedPorc || !customKgEntero) {
          setCustomKgEntero(autoKg.toFixed(2));
        }
      }
    }
  };

  // 2. Manejo reactivo de Peso Despachado (Báscula)
  const handlePesoChange = (val: string) => {
    setPesoDespachado(val);
    const p = parseFloat(val) || 0;
    if (selectedInsumo && p > 0) {
      if (isEntero) {
        if (!cantidad || parseFloat(cantidad) === 0) setCantidad(p.toFixed(2));
      } else if (!showAdvancedPorc) {
        setCustomKgEntero(p.toFixed(2));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Por favor selecciona una carne o insumo.');
    if (cantNum <= 0) return alert('Ingresa la cantidad a entregar.');

    if (isEntero) {
      if (selectedInsumo.bodega_sin_porc_kg < cantNum) {
        return alert(`Stock insuficiente en bodega entero. Solo hay ${selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg.`);
      }
    } else if (autoPorcionar) {
      if (selectedInsumo.bodega_sin_porc_kg < kgEnteroToUse) {
        return alert(`Stock insuficiente en bodega entero para auto-porcionar. Se requieren ${kgEnteroToUse.toFixed(2)} Kg y solo hay ${selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg.`);
      }
    } else {
      if (selectedInsumo.bodega_porc_und < cantNum) {
        return alert(`Stock insuficiente en bodega porcionado. Solo hay ${selectedInsumo.bodega_porc_und} porciones listas.`);
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        tipo: 'TRASLADO_COCINA',
        insumoId: selectedInsumo.insumo_id,
        fecha,
        tipoEntrega,
        cantidad: cantNum,
        pesoKg: isEntero ? cantNum : (parseFloat(pesoDespachado) || (cantNum * pesoEstKg)),
        observaciones: observaciones.trim() || undefined,
      };

      if (!isEntero && autoPorcionar) {
        payload.autoPorcionar = true;
        payload.kgTomadosEntero = kgEnteroToUse;
        payload.porcionesAuto = cantNum;
        payload.pesoPorcionesAutoKg = parseFloat(pesoDespachado) || (cantNum * pesoEstKg);
        payload.mermaAutoKg = mermaAutoKg;
      }

      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar salida a cocina');

      setCantidad('');
      setPesoDespachado('');
      setCustomKgEntero('');
      setObservaciones('');
      setAutoPorcionar(false);
      setShowAdvancedPorc(false);
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

      {/* 💡 TARJETA DE REGLA Y VALORES DEL CATÁLOGO */}
      {selectedInsumo && (
        <div className="p-3 bg-orange-50/70 border border-orange-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-orange-100 text-orange-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-orange-950">Catálogo:</span>{' '}
              <span className="text-orange-900">
                1 porción estándar = <strong>{gramosStd} g</strong> ({pesoEstKg} Kg) • Costo: <strong>${formatMoney(costoKg)} / Kg</strong>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
            <span className="bg-white px-2.5 py-1 rounded-lg border border-orange-200 text-orange-950">
              Bodega Entero: <strong>{selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg</strong>
            </span>
            <span className="bg-white px-2.5 py-1 rounded-lg border border-orange-200 text-orange-950">
              Bodega Porc: <strong>{selectedInsumo.bodega_porc_und} u</strong> ({selectedInsumo.bodega_porc_kg.toFixed(2)}k)
            </span>
            <span className="bg-orange-100 text-orange-950 px-2.5 py-1 rounded-lg border border-orange-300">
              Cocina Actual: <strong>{selectedInsumo.cocina_sin_porc_kg > 0 ? `${selectedInsumo.cocina_sin_porc_kg.toFixed(1)}k ent` : ''} {selectedInsumo.cocina_porc_und} u</strong>
            </span>
          </div>
        </div>
      )}

      {/* ⚡ NOTIFICACIÓN INTELIGENTE DE AUTO-PORCIONADO DIRECTO */}
      {selectedInsumo && !isEntero && cantNum > 0 && autoPorcionar && (
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300/80 rounded-xl space-y-2.5 text-xs animate-fade-in shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm flex-shrink-0">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-emerald-950 text-xs md:text-sm flex items-center gap-1.5">
                  ⚡ Auto-Porcionado Directo Activado
                  <span className="text-[10px] font-semibold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-300">
                    Sin paso intermedio
                  </span>
                </span>
                <p className="text-[11px] text-emerald-900 mt-0.5">
                  Se tomarán automáticamente <strong>{kgEnteroToUse.toFixed(2)} Kg</strong> de carne entera en Bodega para generar y trasladar las <strong>{cantNum} porciones ({pesoNum.toFixed(2)} Kg)</strong> directo a Cocina.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedPorc(!showAdvancedPorc)}
                className="px-2.5 py-1 text-[11px] font-medium text-emerald-800 bg-white hover:bg-emerald-100/70 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdvancedPorc ? 'Ocultar Ajuste' : 'Ajustar Kgs / Merma'}</span>
              </button>

              {selectedInsumo.bodega_porc_und >= cantNum && (
                <button
                  type="button"
                  onClick={() => setAutoPorcionar(false)}
                  className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 underline"
                >
                  Usar porciones existentes
                </button>
              )}
            </div>
          </div>

          {/* Ajuste avanzado de Kg tomados y merma (opcional) */}
          {showAdvancedPorc && (
            <div className="pt-2.5 border-t border-emerald-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/60 p-2.5 rounded-lg">
              <div>
                <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                  Kgs tomados de Entero (Kg) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={customKgEntero}
                  onChange={(e) => setCustomKgEntero(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-md border border-emerald-300 outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                  Peso Porciones (Kg)
                </label>
                <div className="h-8 px-2 flex items-center text-xs font-bold text-slate-800 bg-emerald-50 rounded-md border border-emerald-200">
                  {pesoNum.toFixed(2)} Kg ({cantNum} und)
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                  Merma Resultante (Kg)
                </label>
                <div className="h-8 px-2 flex items-center text-xs font-bold text-amber-900 bg-amber-50 rounded-md border border-amber-200">
                  {mermaAutoKg > 0 ? `${mermaAutoKg.toFixed(2)} Kg (${((mermaAutoKg / (kgEnteroToUse || 1)) * 100).toFixed(1)}%)` : '0.00 Kg (0%)'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Si hay porciones en stock y el usuario quiere activar auto-porcionado manual */}
      {selectedInsumo && !isEntero && cantNum > 0 && !autoPorcionar && selectedInsumo.bodega_sin_porc_kg > 0 && (
        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <span className="text-slate-600">
            Usando stock porcionado existente ({selectedInsumo.bodega_porc_und} und disp).
          </span>
          <button
            type="button"
            onClick={() => {
              setAutoPorcionar(true);
              setCustomKgEntero(pesoNum.toFixed(2));
            }}
            className="text-emerald-700 hover:text-emerald-900 font-semibold text-xs flex items-center gap-1 hover:underline"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Porcionar directo desde Entero ({selectedInsumo.bodega_sin_porc_kg.toFixed(1)} Kg disp)</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Traslado</label>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de Entrega</label>
          <select
            value={tipoEntrega}
            onChange={(e) => {
              const t = e.target.value as any;
              setTipoEntrega(t);
              setCantidad('');
              setPesoDespachado('');
            }}
            className="w-full h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-300 outline-none focus:border-orange-500 bg-white text-slate-800 cursor-pointer"
          >
            <option value="PORCIONADO">🥩 Porciones Listas (Unidades)</option>
            <option value="ENTERO">📦 Pieza Entera / Abarrote (Kg)</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">
              {isEntero ? 'Kilos a Entregar (Kg) *' : 'Porciones a Entregar (Und) *'}
            </label>
            {selectedInsumo && (
              <span className="text-[10px] text-orange-800 font-medium">
                {isEntero
                  ? `Disp: ${selectedInsumo.bodega_sin_porc_kg.toFixed(2)}k`
                  : autoPorcionar
                  ? `Entero disp: ${selectedInsumo.bodega_sin_porc_kg.toFixed(1)}k`
                  : `Disp: ${selectedInsumo.bodega_porc_und}u`}
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
            placeholder={isEntero ? 'Ej. 5.00' : 'Ej. 10'}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 bg-white font-medium"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">Peso Despachado (Kg) *</label>
            {!isEntero && cantNum > 0 && (
              <span className="text-[10px] text-orange-800 font-medium">Auto: {(cantNum * pesoEstKg).toFixed(2)}k</span>
            )}
          </div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={pesoDespachado}
            onChange={(e) => handlePesoChange(e.target.value)}
            placeholder="0.00"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Observaciones / Turno</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej. Almuerzo / Cena / Evento"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 bg-white"
          />
        </div>
      </div>

      {/* 📊 RESUMEN DINÁMICO EN VIVO */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2 text-xs font-normal">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
          <span>BALANCE DEL TRASLADO Y SALDO RESULTANTE</span>
          {valorDespacho > 0 && (
            <span className="text-slate-900 font-bold">
              Valor Despacho: ${formatMoney(valorDespacho)} COP (${formatMoney(costoKg)}/Kg)
            </span>
          )}
        </div>

        {selectedInsumo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Origen Bodega */}
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <div className="text-[11px] text-slate-500 font-normal">Bodega (Origen) ➔ Saldo Final:</div>
              {isEntero ? (
                <div className="text-slate-800 font-semibold mt-0.5">
                  {selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg ➔{' '}
                  <span className={selectedInsumo.bodega_sin_porc_kg - cantNum < 0 ? 'text-red-600 font-bold' : 'text-slate-900 font-bold'}>
                    {Math.max(0, selectedInsumo.bodega_sin_porc_kg - cantNum).toFixed(2)} Kg
                  </span>
                </div>
              ) : autoPorcionar ? (
                <div>
                  <div className="text-slate-800 font-semibold">
                    Entero: {selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg ➔{' '}
                    <span className={selectedInsumo.bodega_sin_porc_kg - kgEnteroToUse < 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                      {Math.max(0, selectedInsumo.bodega_sin_porc_kg - kgEnteroToUse).toFixed(2)} Kg
                    </span>{' '}
                    <span className="text-[10px] text-emerald-800 font-normal">(-{kgEnteroToUse.toFixed(2)} Kg procesados)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Porcionado Bodega: {selectedInsumo.bodega_porc_und} und (Se generan {cantNum} und y pasan directo a cocina)
                  </div>
                </div>
              ) : (
                <div className="text-slate-800 font-semibold mt-0.5">
                  {selectedInsumo.bodega_porc_und} und ({selectedInsumo.bodega_porc_kg.toFixed(2)} Kg) ➔{' '}
                  <span className={selectedInsumo.bodega_porc_und - cantNum < 0 ? 'text-red-600 font-bold' : 'text-slate-900 font-bold'}>
                    {Math.max(0, selectedInsumo.bodega_porc_und - cantNum)} und ({Math.max(0, selectedInsumo.bodega_porc_kg - pesoNum).toFixed(2)} Kg)
                  </span>
                </div>
              )}
            </div>

            {/* Destino Cocina */}
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">Cocina (Destino) ➔ Saldo Final:</div>
              <div className="text-slate-800 font-semibold mt-0.5">
                {isEntero
                  ? `${selectedInsumo.cocina_sin_porc_kg.toFixed(2)} Kg ➔ `
                  : `${selectedInsumo.cocina_porc_und} und (${selectedInsumo.cocina_porc_kg.toFixed(2)} Kg) ➔ `}
                <span className="text-emerald-700 font-bold">
                  {isEntero
                    ? `${(selectedInsumo.cocina_sin_porc_kg + cantNum).toFixed(2)} Kg`
                    : `${selectedInsumo.cocina_porc_und + cantNum} und (${(selectedInsumo.cocina_porc_kg + pesoNum).toFixed(2)} Kg)`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span className="italic text-slate-400 text-xs">Selecciona un insumo para previsualizar el traslado antes de guardar.</span>
        )}
      </div>

      {/* Botón Guardar */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo || cantNum <= 0}
          className={`w-full sm:w-auto px-6 h-10 rounded-xl font-medium text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 ${
            autoPorcionar
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20'
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : autoPorcionar ? (
            <>
              <Zap className="w-4 h-4" />
              <span>Porcionar y Trasladar a Cocina ({cantNum} porc • {pesoNum.toFixed(2)} Kg)</span>
            </>
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

