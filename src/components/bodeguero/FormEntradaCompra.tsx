'use client';

import { useState, useMemo } from 'react';
import { PlusCircle, Loader2, Sparkles, DollarSign, Package } from 'lucide-react';
import { InsumoItem } from '@/types';
import SmartSearchInsumo from './SmartSearchInsumo';
import { formatMoney } from '@/lib/formatters';

interface Props {
  insumos: InsumoItem[];
  onSuccess: () => void;
}

export default function FormEntradaCompra({ insumos, onSuccess }: Props) {
  const [selectedInsumoId, setSelectedInsumoId] = useState<string | number | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [proveedor, setProveedor] = useState('');
  const [factura, setFactura] = useState('');
  const [cantidadKg, setCantidadKg] = useState('');
  const [costoTotal, setCostoTotal] = useState('');
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
  const costoCatalogoKg = selectedInsumo?.costo_unitario_kg || 0;

  const cantNum = parseFloat(cantidadKg) || 0;
  const costoNum = parseFloat(costoTotal) || 0;
  const costoUnitarioEfectivo = cantNum > 0 && costoNum > 0 ? Math.round(costoNum / cantNum) : costoCatalogoKg;
  const stockActualVal = isUnd ? ((selectedInsumo?.bodega_sin_porc_kg || 0) + (selectedInsumo?.bodega_porc_und || 0)) : (selectedInsumo?.bodega_sin_porc_kg || 0);
  const nuevoStockKg = stockActualVal + cantNum;
  const porcionesPotenciales = isUnd ? cantNum : (cantNum > 0 ? Math.round(cantNum / pesoEstKg) : 0);

  // Manejo automático al cambiar Kilos Recibidos
  const handleKgChange = (val: string) => {
    setCantidadKg(val);
    const kg = parseFloat(val) || 0;
    if (selectedInsumo && kg > 0) {
      const autoTotal = Math.round(kg * costoCatalogoKg);
      if (!costoTotal || parseFloat(costoTotal) === 0) {
        setCostoTotal(autoTotal.toString());
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsumo) return alert('Por favor selecciona una carne o insumo.');
    if (cantNum <= 0) return alert('Ingresa una cantidad válida en Kg.');

    setLoading(true);
    try {
      const res = await fetch('/api/bodega/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'ENTRADA_COMPRA',
          insumoId: selectedInsumo.insumo_id,
          fecha,
          cantidadKg: cantNum,
          costoTotal: costoNum || (cantNum * costoCatalogoKg),
          proveedor: proveedor.trim() || 'Proveedor Local',
          factura: factura.trim() || 'Pendiente',
          observaciones: observaciones.trim() || `Entrada compra ${selectedInsumo.insumo} (${cantNum} Kg)`,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al registrar ingreso');

      setProveedor('');
      setFactura('');
      setCantidadKg('');
      setCostoTotal('');
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
          if (item && cantidadKg) handleKgChange(cantidadKg);
        }}
        placeholder="Escribe para buscar carne que ingresa (ej. Lomo de cerdo, Baby beef)..."
        label="Buscar Carne / Insumo a Ingresar *"
      />

      {/* 💡 TARJETA DE REGLA Y VALORES DEL CATÁLOGO */}
      {selectedInsumo && (
        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-blue-950">Precio Base Catálogo:</span>{' '}
              <span className="text-blue-900">
                <strong>${formatMoney(costoCatalogoKg)} / {isUnd ? 'Und' : 'Kg'}</strong>
                {!isUnd && (
                  <> • Rinde ~<strong>{(1 / pesoEstKg).toFixed(1)} porc/Kg</strong> ({gramosStd}g/porc)</>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
            <span className="bg-white px-2.5 py-1 rounded-lg border border-blue-200 text-blue-950">
              Bodega Actual: <strong>{stockActualVal.toFixed(isUnd ? 0 : 2)} {isUnd ? 'Und' : 'Kg enteros'}</strong>
            </span>
            {cantNum > 0 && (
              <span className="bg-blue-100 text-blue-950 px-2.5 py-1 rounded-lg border border-blue-300">
                {isUnd ? (
                  <>Ingreso: <strong>+{cantNum} unidades</strong></>
                ) : (
                  <>Rendimiento: <strong>~{porcionesPotenciales} porciones</strong></>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Compra</label>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Proveedor</label>
          <input
            type="text"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Ej. Frigorífico Central / Local"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nº Factura / Remisión</label>
          <input
            type="text"
            value={factura}
            onChange={(e) => setFactura(e.target.value)}
            placeholder="Ej. FAC-9821 / Pendiente"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {isUnd ? 'Cantidad Recibida (Unidades) *' : 'Cantidad Recibida (Kg) *'}
          </label>
          <input
            type="number"
            step={isUnd ? '1' : '0.01'}
            min={isUnd ? '1' : '0.01'}
            required
            value={cantidadKg}
            onChange={(e) => handleKgChange(e.target.value)}
            placeholder={isUnd ? '0' : '0.00'}
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">Costo Total ($ COP)</label>
            {selectedInsumo && cantNum > 0 && (
              <span className="text-[10px] text-blue-700 font-normal">Sugerido: ${formatMoney(Math.round(cantNum * costoCatalogoKg))}</span>
            )}
          </div>
          <input
            type="number"
            step="100"
            min="0"
            value={costoTotal}
            onChange={(e) => setCostoTotal(e.target.value)}
            placeholder="0"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Observaciones</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas de recepción"
            className="w-full h-9 px-2.5 text-xs font-normal rounded-lg border border-slate-300 outline-none focus:border-blue-500 text-slate-800 bg-white"
          />
        </div>
      </div>

      {/* 📊 RESUMEN DINÁMICO EN VIVO */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2 text-xs font-normal">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
          <span>IMPACTO EN INVENTARIO Y COSTO EFECTIVO</span>
          {costoNum > 0 && (
            <span className="text-slate-900 font-bold">
              Total Ingreso: ${formatMoney(costoNum)} COP
            </span>
          )}
        </div>

        {selectedInsumo ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">
                {isUnd ? 'Stock Unidades en Bodega:' : 'Stock Entero en Bodega:'}
              </div>
              <div className="text-slate-800 font-semibold mt-0.5">
                {stockActualVal.toFixed(isUnd ? 0 : 2)} {isUnd ? 'Und' : 'Kg'} ➔{' '}
                <span className="text-emerald-700 font-bold">{nuevoStockKg.toFixed(isUnd ? 0 : 2)} {isUnd ? 'Und' : 'Kg'}</span>
              </div>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">Costo Unitario Facturado:</div>
              <div className="text-slate-800 font-semibold mt-0.5 flex items-center justify-between">
                <span className="text-blue-900 font-bold">${formatMoney(costoUnitarioEfectivo)} / {isUnd ? 'Und' : 'Kg'}</span>
                {costoUnitarioEfectivo !== costoCatalogoKg && (
                  <span className="text-[10px] text-slate-500">(Catálogo: ${formatMoney(costoCatalogoKg)})</span>
                )}
              </div>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] text-slate-500 font-normal">
                {isUnd ? 'Unidades Recibidas:' : 'Potencial de Porciones:'}
              </div>
              <div className="text-purple-950 font-bold mt-0.5">
                {isUnd ? (
                  `+${cantNum} unidades (${selectedInsumo.insumo})`
                ) : (
                  `~${porcionesPotenciales} porciones estándar (${gramosStd}g c/u)`
                )}
              </div>
            </div>
          </div>
        ) : (
          <span className="italic text-slate-400 text-xs">Selecciona un insumo para previsualizar el impacto antes de guardar.</span>
        )}
      </div>

      {/* Botón Guardar */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading || !selectedInsumo || cantNum <= 0}
          className="w-full sm:w-auto px-6 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-medium text-xs md:text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Ingreso a Bodega</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
