'use client';

import { useState, useMemo } from 'react';
import { ArrowRightCircle, Loader2, Sparkles } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';
import { useNotification } from '@/context/NotificationContext';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormTrasladoCocina({ insumos, onSuccess }: Props) {
  const { success, error, warning } = useNotification();
  const [selectedInsumoId, setSelectedInsumoId] = useState<string | number | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [tipoEntrega, setTipoEntrega] = useState<'PORCIONADO' | 'ENTERO'>('PORCIONADO');
  const [cantidad, setCantidad] = useState('');
  const [pesoDespachado, setPesoDespachado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedInsumo = useMemo(() => {
    if (!selectedInsumoId) return null;
    return insumos.find((i) => String(i.insumo_id) === String(selectedInsumoId)) || null;
  }, [insumos, selectedInsumoId]);

  const tipoMedida = useMemo(() => {
    if (!selectedInsumo) return 'KGS_Y_UNIDADES';
    if (selectedInsumo.tipo_medida) return selectedInsumo.tipo_medida;
    const unidad = selectedInsumo.unidad_medida?.toLowerCase();
    const cat = selectedInsumo.categoria?.toLowerCase() || '';
    const name = selectedInsumo.insumo?.toLowerCase() || '';
    if (unidad === 'und' || cat.includes('embutido') || name.includes('chorizo') || name.includes('tamal') || name.includes('huevo')) return 'UNIDADES';
    if (unidad?.includes('paquete') || name.includes('papa')) return 'PAQUETES';
    if (unidad === 'kg' && !selectedInsumo.es_carne) return 'KGS';
    return 'KGS_Y_UNIDADES';
  }, [selectedInsumo]);

  const isUnd = tipoMedida === 'UNIDADES';
  const isPaquete = tipoMedida === 'PAQUETES';
  const isCountable = isUnd || isPaquete;
  const isSoloKg = tipoMedida === 'KGS';
  const unitLabel = isUnd ? 'Und' : isPaquete ? 'Paquetes' : 'Kg';

  const gramosStd = selectedInsumo?.peso_porc_gramos || 350;
  const pesoEstKg = isCountable ? 0 : gramosStd / 1000;
  const costoKg = selectedInsumo?.costo_unitario_kg || 0;

  const cantNum = parseFloat(cantidad) || 0;
  const isEntero = isSoloKg ? true : (isCountable ? false : tipoEntrega === 'ENTERO');
  const pesoNum = isCountable ? 0 : (isEntero ? cantNum : (parseFloat(pesoDespachado) || parseFloat((cantNum * pesoEstKg).toFixed(2))));
  const valorDespacho = Math.round(isCountable ? (cantNum * costoKg) : ((isEntero ? cantNum : pesoNum) * costoKg));

  // Existencias en bodega
  const porcListas = selectedInsumo?.bodega_porc_und || 0;
  const enteroKg = selectedInsumo?.bodega_sin_porc_kg || 0;
  const porcFromEnteroPosibles = pesoEstKg > 0 ? Math.floor(enteroKg / pesoEstKg) : 0;
  const totalPorcPosibles = isCountable
    ? (selectedInsumo?.bodega_porc_und || 0)
    : (porcListas + porcFromEnteroPosibles);

  // Desglose de dónde se tomarán las porciones
  const porcFromListas = Math.min(porcListas, cantNum);
  const missingPorc = Math.max(0, cantNum - porcFromListas);
  const kgToTakeFromEntero = missingPorc > 0 && pesoEstKg > 0 ? parseFloat((missingPorc * (pesoNum > 0 ? pesoNum / (cantNum || 1) : pesoEstKg)).toFixed(2)) : 0;

  // Manejo reactivo de Cantidad
  const handleCantChange = (val: string) => {
    setCantidad(val);
    const c = parseFloat(val) || 0;
    if (selectedInsumo && c > 0) {
      if (isCountable) {
        setPesoDespachado('0');
      } else if (isEntero || isSoloKg) {
        setPesoDespachado(c.toFixed(2));
      } else {
        const autoKg = parseFloat((c * pesoEstKg).toFixed(2));
        setPesoDespachado(autoKg.toFixed(2));
      }
    }
  };

  // Manejo reactivo de Peso Despachado (Báscula)
  const handlePesoChange = (val: string) => {
    setPesoDespachado(val);
    const p = parseFloat(val) || 0;
    if (selectedInsumo && p > 0 && !isCountable && isEntero) {
      if (!cantidad || parseFloat(cantidad) === 0) setCantidad(p.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return warning('Por favor selecciona una carne o insumo.', 'Campo Requerido');
    if (cantNum <= 0) return warning('Ingresa la cantidad a entregar.', 'Campo Requerido');

    if (isCountable) {
      if (totalPorcPosibles < cantNum) {
        return warning(
          `Stock insuficiente en bodega. Solo hay ${totalPorcPosibles} ${unitLabel.toLowerCase()} disponibles.`,
          'Stock Insuficiente'
        );
      }
    } else if (isEntero || isSoloKg) {
      if (enteroKg < cantNum) {
        return warning(
          `Stock insuficiente en bodega entero. Solo hay ${enteroKg.toFixed(2)} Kg disponibles.`,
          'Stock Insuficiente'
        );
      }
    } else {
      // Caso Porcionado: verificar si alcanza entre porciones listas y carne entera
      if (porcListas < cantNum && enteroKg < kgToTakeFromEntero) {
        return warning(
          `Stock insuficiente en bodega. Tienes ${porcListas} porciones listas y ${enteroKg.toFixed(2)} Kg en entero (capacidad máx: ${totalPorcPosibles} porciones). No alcanza para entregar ${cantNum} porciones.`,
          'Stock Insuficiente'
        );
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        tipo: 'TRASLADO_COCINA',
        insumoId: selectedInsumo.insumo_id,
        fecha,
        tipoEntrega: isCountable ? 'PORCIONADO' : (isSoloKg ? 'ENTERO' : tipoEntrega),
        cantidad: cantNum,
        pesoKg: isCountable ? 0 : (isEntero ? cantNum : pesoNum),
        observaciones: observaciones.trim() || undefined,
      };

      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar salida a cocina');

      setCantidad('');
      setPesoDespachado('');
      setObservaciones('');

      success(
        `Salida a cocina de ${cantNum} ${unitLabel} de ${selectedInsumo.insumo} registrada en estado pendiente de aprobación.`,
        '📦 Salida Registrada'
      );
      onSuccess();
    } catch (err: any) {
      error(err.message || 'Error al registrar salida a cocina');
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
                {isCountable ? (
                  <>1 {isPaquete ? 'paquete' : 'unidad'} = <strong>${formatMoney(costoKg)}</strong> / {unitLabel} • Despacho en {unitLabel.toLowerCase()}</>
                ) : isSoloKg ? (
                  <>Costo: <strong>${formatMoney(costoKg)} / Kg</strong> • Despacho a granel / piezas enteras</>
                ) : (
                  <>1 porción estándar = <strong>{gramosStd} g</strong> ({pesoEstKg} Kg) • Costo: <strong>${formatMoney(costoKg)} / Kg</strong></>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
            {isCountable ? (
              <>
                <span className="bg-white px-2.5 py-1 rounded-lg border border-orange-200 text-orange-950">
                  Bodega: <strong>{totalPorcPosibles} {unitLabel.toLowerCase()}</strong>
                </span>
                <span className="bg-orange-100 text-orange-950 px-2.5 py-1 rounded-lg border border-orange-300">
                  Cocina Actual: <strong>{selectedInsumo.cocina_porc_und || 0} {unitLabel.toLowerCase()}</strong>
                </span>
              </>
            ) : isSoloKg ? (
              <>
                <span className="bg-white px-2.5 py-1 rounded-lg border border-orange-200 text-orange-950">
                  Bodega: <strong>{selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg</strong>
                </span>
                <span className="bg-orange-100 text-orange-950 px-2.5 py-1 rounded-lg border border-orange-300">
                  Cocina Actual: <strong>{(selectedInsumo.cocina_sin_porc_kg || 0).toFixed(2)} Kg</strong>
                </span>
              </>
            ) : (
              <>
                <span className="bg-white px-2.5 py-1 rounded-lg border border-orange-200 text-orange-950">
                  Bodega Entero: <strong>{selectedInsumo.bodega_sin_porc_kg.toFixed(2)} Kg</strong>
                </span>
                <span className="bg-white px-2.5 py-1 rounded-lg border border-orange-200 text-orange-950">
                  Bodega Porc: <strong>{selectedInsumo.bodega_porc_und} u</strong> ({selectedInsumo.bodega_porc_kg.toFixed(2)}k)
                </span>
                <span className="bg-orange-100 text-orange-950 px-2.5 py-1 rounded-lg border border-orange-300">
                  Cocina Actual: <strong>{selectedInsumo.cocina_sin_porc_kg > 0 ? `${selectedInsumo.cocina_sin_porc_kg.toFixed(1)}k ent` : ''} {selectedInsumo.cocina_porc_und} u</strong>
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* CAMPOS DE FORMULARIO */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isCountable || isSoloKg ? 'lg:grid-cols-3' : 'lg:grid-cols-5'} gap-3`}>
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

        {!isCountable && !isSoloKg && (
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
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">
              {isUnd ? 'Cantidad a Entregar (Und) *' : isPaquete ? 'Cantidad a Entregar (Paquetes) *' : isSoloKg || isEntero ? 'Kilos a Entregar (Kg) *' : 'Porciones a Entregar (Und) *'}
            </label>
            {selectedInsumo && (
              <span className="text-[10px] text-orange-800 font-medium">
                {isCountable
                  ? `Disp: ${totalPorcPosibles} ${unitLabel.toLowerCase()}`
                  : isSoloKg || isEntero
                  ? `Disp: ${enteroKg.toFixed(2)}k`
                  : porcListas > 0
                  ? `Disp: ${porcListas}u (${enteroKg.toFixed(1)}k entero)`
                  : `Entero disp: ${enteroKg.toFixed(1)}k`}
              </span>
            )}
          </div>
          <input
            type="number"
            step={isCountable || (!isEntero && !isSoloKg) ? '1' : '0.01'}
            min="1"
            required
            value={cantidad}
            onChange={(e) => handleCantChange(e.target.value)}
            placeholder={isUnd ? 'Ej. 5' : isPaquete ? 'Ej. 2' : isEntero || isSoloKg ? 'Ej. 5.00' : 'Ej. 10'}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 bg-white font-medium"
          />
        </div>

        {!isCountable && !isSoloKg && (
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
        )}

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
              Valor Despacho: ${formatMoney(valorDespacho)} COP {isUnd ? `($${formatMoney(costoKg)}/Und)` : `($${formatMoney(costoKg)}/Kg)`}
            </span>
          )}
        </div>

        {selectedInsumo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Origen Bodega */}
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
              <div className="text-[11px] text-slate-500 font-normal">Bodega (Origen) ➔ Saldo Final:</div>
              {isUnd ? (
                <div className="text-slate-800 font-semibold mt-0.5">
                  {totalPorcPosibles} und ➔{' '}
                  <span className={totalPorcPosibles - cantNum < 0 ? 'text-red-600 font-bold' : 'text-slate-900 font-bold'}>
                    {Math.max(0, totalPorcPosibles - cantNum)} und
                  </span>
                </div>
              ) : isEntero ? (
                <div className="text-slate-800 font-semibold mt-0.5">
                  {enteroKg.toFixed(2)} Kg ➔{' '}
                  <span className={enteroKg - cantNum < 0 ? 'text-red-600 font-bold' : 'text-slate-900 font-bold'}>
                    {Math.max(0, enteroKg - cantNum).toFixed(2)} Kg
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  {porcListas >= cantNum ? (
                    // Todas salen de porciones existentes
                    <div className="text-slate-800 font-semibold">
                      Porcionado Bodega: {porcListas} und ➔{' '}
                      <span className="text-slate-900 font-bold">{porcListas - cantNum} und</span>{' '}
                      <span className="text-[10px] text-slate-500 font-normal">(-{cantNum} und / -{pesoNum.toFixed(2)} Kg)</span>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-normal">
                        Entero Bodega: {enteroKg.toFixed(2)} Kg (intacto)
                      </div>
                    </div>
                  ) : porcListas === 0 ? (
                    // Todas se autoporcionan de entero
                    <div>
                      <div className="text-slate-800 font-semibold">
                        Entero Bodega: {enteroKg.toFixed(2)} Kg ➔{' '}
                        <span className={enteroKg - kgToTakeFromEntero < 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                          {Math.max(0, enteroKg - kgToTakeFromEntero).toFixed(2)} Kg
                        </span>{' '}
                        <span className="text-[10px] text-emerald-800 font-normal">(-{kgToTakeFromEntero.toFixed(2)} Kg autoporcionado)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-normal">
                        Porcionado Bodega: 0 und (se generan y trasladan {cantNum} und directo a cocina)
                      </div>
                    </div>
                  ) : (
                    // Mixto: toma las que hay en porcionado y el resto de entero
                    <div>
                      <div className="text-slate-800 font-semibold">
                        Porcionado Bodega: {porcListas} und ➔ <span className="text-slate-900 font-bold">0 und</span>{' '}
                        <span className="text-[10px] text-slate-500 font-normal">(-{porcFromListas} und existentes)</span>
                      </div>
                      <div className="text-slate-800 font-semibold mt-0.5">
                        Entero Bodega: {enteroKg.toFixed(2)} Kg ➔{' '}
                        <span className={enteroKg - kgToTakeFromEntero < 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                          {Math.max(0, enteroKg - kgToTakeFromEntero).toFixed(2)} Kg
                        </span>{' '}
                        <span className="text-[10px] text-emerald-800 font-normal">(-{kgToTakeFromEntero.toFixed(2)} Kg por {missingPorc} und faltantes)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Destino Cocina */}
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">Cocina (Destino) ➔ Saldo Final:</div>
              <div className="text-slate-800 font-semibold mt-0.5">
                {isUnd
                  ? `${((selectedInsumo.cocina_porc_und || 0) + (selectedInsumo.cocina_sin_porc_kg || 0))} und ➔ `
                  : isEntero
                  ? `${selectedInsumo.cocina_sin_porc_kg.toFixed(2)} Kg ➔ `
                  : `${selectedInsumo.cocina_porc_und} und (${selectedInsumo.cocina_porc_kg.toFixed(2)} Kg) ➔ `}
                <span className="text-emerald-700 font-bold">
                  {isUnd
                    ? `${((selectedInsumo.cocina_porc_und || 0) + (selectedInsumo.cocina_sin_porc_kg || 0)) + cantNum} und`
                    : isEntero
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
          className="w-full sm:w-auto px-6 h-10 rounded-xl font-medium text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <ArrowRightCircle className="w-4 h-4" />
              <span>Registrar Salida a Cocina {cantNum > 0 ? `(${cantNum} ${isUnd || !isEntero ? 'und' : 'Kg'} • ${pesoNum.toFixed(2)} Kg)` : ''}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
