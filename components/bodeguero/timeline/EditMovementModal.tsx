'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Edit2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney } from '@/lib/formatters';
import { InsumoItem, MovimientoItem } from '@/types';

interface Props {
  editingMov: MovimientoItem | null;
  insumos: InsumoItem[];
  currentPeriodo: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditMovementModal({
  editingMov,
  insumos,
  currentPeriodo,
  onClose,
  onSuccess,
}: Props) {
  const [editInsumoId, setEditInsumoId] = useState<string | number>('');
  const [editFecha, setEditFecha] = useState<string>('');
  const [editCantKg, setEditCantKg] = useState<string>('');
  const [editPorciones, setEditPorciones] = useState<string>('');
  const [editPesoPorciones, setEditPesoPorciones] = useState<string>('');
  const [editCostoTotal, setEditCostoTotal] = useState<string>('');
  const [editObs, setEditObs] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!editingMov) return;

    setEditInsumoId(editingMov.insumo_id);
    const movDate = (editingMov.fecha || editingMov.fecha_hora || todayStr).split('T')[0];
    setEditFecha(movDate);
    const cantKgStr = String(editingMov.cant_sin_porcionar_kg || 0);
    const porcStr = String(editingMov.porciones_und || 0);
    const pesoPorcStr = String(editingMov.peso_porciones_kg || 0);

    setEditCantKg(cantKgStr);
    setEditPorciones(porcStr);
    setEditPesoPorciones(pesoPorcStr);

    const targetInsumo = insumos.find((i) => String(i.insumo_id) === String(editingMov.insumo_id));
    const unitPrice = targetInsumo?.costo_unitario_kg || editingMov.costo_unitario_kg || 0;
    const totalKg = (parseFloat(cantKgStr) || 0) + (parseFloat(pesoPorcStr) || 0);
    const initialTotal = editingMov.valor_total_movimiento
      ? editingMov.valor_total_movimiento
      : Math.round(totalKg * unitPrice);

    setEditCostoTotal(String(initialTotal));
    setEditObs(editingMov.observaciones?.replace(/\[PENDIENTE_APROBAR\]/g, '').trim() || '');
  }, [editingMov, insumos, todayStr]);

  const selectedEditInsumo = useMemo(() => {
    if (!editInsumoId) return null;
    return insumos.find((i) => String(i.insumo_id) === String(editInsumoId)) || null;
  }, [insumos, editInsumoId]);

  const handleEditInsumoChange = (newInsumoId: string) => {
    setEditInsumoId(newInsumoId);
    const found = insumos.find((i) => String(i.insumo_id) === String(newInsumoId));
    const unitPrice = found?.costo_unitario_kg || 0;
    const pesoStdKg = found?.peso_porc_gramos ? found.peso_porc_gramos / 1000 : 0.35;

    let currentPesoPorc = parseFloat(editPesoPorciones) || 0;
    const und = parseInt(editPorciones) || 0;
    if (und > 0) {
      currentPesoPorc = Number((und * pesoStdKg).toFixed(2));
      setEditPesoPorciones(String(currentPesoPorc));
    }

    const cantKg = parseFloat(editCantKg) || 0;
    const totalKg = cantKg + currentPesoPorc;
    setEditCostoTotal(String(Math.round(totalKg * unitPrice)));
  };

  const handleEditCantKgChange = (newCantKg: string) => {
    setEditCantKg(newCantKg);
    const cantKg = parseFloat(newCantKg) || 0;
    const pesoPorc = parseFloat(editPesoPorciones) || 0;
    const unitPrice = selectedEditInsumo?.costo_unitario_kg || editingMov?.costo_unitario_kg || 0;
    const totalKg = cantKg + pesoPorc;
    setEditCostoTotal(String(Math.round(totalKg * unitPrice)));
  };

  const handleEditPorcionesChange = (newPorcUnd: string) => {
    setEditPorciones(newPorcUnd);
    const und = parseInt(newPorcUnd) || 0;
    const pesoStdKg = selectedEditInsumo?.peso_porc_gramos
      ? selectedEditInsumo.peso_porc_gramos / 1000
      : 0.35;

    let pesoPorc = 0;
    if (und > 0) {
      pesoPorc = Number((und * pesoStdKg).toFixed(2));
      setEditPesoPorciones(String(pesoPorc));
    } else {
      setEditPesoPorciones('0');
    }

    const cantKg = parseFloat(editCantKg) || 0;
    const unitPrice = selectedEditInsumo?.costo_unitario_kg || editingMov?.costo_unitario_kg || 0;
    const totalKg = cantKg + pesoPorc;
    setEditCostoTotal(String(Math.round(totalKg * unitPrice)));
  };

  const handleEditPesoPorcionesChange = (newPesoPorc: string) => {
    setEditPesoPorciones(newPesoPorc);
    const pesoPorc = parseFloat(newPesoPorc) || 0;
    const cantKg = parseFloat(editCantKg) || 0;
    const unitPrice = selectedEditInsumo?.costo_unitario_kg || editingMov?.costo_unitario_kg || 0;
    const totalKg = cantKg + pesoPorc;
    setEditCostoTotal(String(Math.round(totalKg * unitPrice)));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMov) return;

    setSavingEdit(true);
    try {
      const res = await fetch('/api/bodega/movimientos/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EDITAR',
          movimientoId: editingMov.id,
          overrides: {
            insumo_id: editInsumoId,
            fecha: editFecha,
            cant_sin_porcionar_kg: parseFloat(editCantKg) || 0,
            porciones_und: parseInt(editPorciones) || 0,
            peso_porciones_kg: parseFloat(editPesoPorciones) || 0,
            valor_total_movimiento: parseFloat(editCostoTotal) || 0,
            observaciones: editObs,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al actualizar movimiento');

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <Modal
      isOpen={!!editingMov}
      onClose={onClose}
      title="Editar Movimiento Pendiente"
      icon={<Edit2 className="w-5 h-5 text-orange-500" />}
      maxWidth="max-w-md"
    >
      {editingMov && (
        <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs font-normal">
          {/* 1. Selector de Fecha del Movimiento y Materia Prima */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                <span>Fecha de la Jornada</span>
              </label>
              <input
                type="date"
                required
                min={currentPeriodo?.fecha_inicio}
                max={currentPeriodo?.fecha_fin}
                value={editFecha}
                onChange={(e) => setEditFecha(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Materia Prima / Insumo</label>
              <select
                value={editInsumoId}
                onChange={(e) => handleEditInsumoChange(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white font-medium cursor-pointer"
              >
                {insumos.map((i) => (
                  <option key={i.insumo_id} value={i.insumo_id}>
                    {(i as any).nombre_insumo || i.insumo || `Insumo #${i.insumo_id}`} ({i.categoria})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 🏷️ Indicador de Precio Unitario y Rendimiento del Catálogo */}
          {selectedEditInsumo && (
            <div className="grid grid-cols-2 gap-2 bg-orange-50/70 border border-orange-200/80 rounded-lg p-2.5 text-slate-700 shadow-sm">
              <div>
                <span className="text-[10px] text-slate-500 font-normal block">Precio Unitario Catálogo:</span>
                <span className="font-semibold text-slate-900 text-xs">
                  $ {formatMoney(selectedEditInsumo.costo_unitario_kg || 0)}{' '}
                  <span className="text-[10px] font-normal text-slate-500">/ Kg</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-normal block">Rendimiento por Porción:</span>
                <span className="font-semibold text-slate-900 text-xs">
                  {selectedEditInsumo.peso_porc_gramos || 350}{' '}
                  <span className="text-[10px] font-normal text-slate-500">
                    g ({(selectedEditInsumo.peso_porc_gramos ? selectedEditInsumo.peso_porc_gramos / 1000 : 0.35).toFixed(3)} Kg)
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* 2. Inputs de Kilos (Entero) y Porciones (Und) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Kilos (Entero)</label>
              <input
                type="number"
                step="0.01"
                value={editCantKg}
                onChange={(e) => handleEditCantKgChange(e.target.value)}
                placeholder="0.00"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Porciones (Und)</label>
              <input
                type="number"
                step="1"
                value={editPorciones}
                onChange={(e) => handleEditPorcionesChange(e.target.value)}
                placeholder="0"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
              />
            </div>
          </div>

          {/* 3. Inputs de Peso Porciones (Kg) y Valor Total ($) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                <span>Peso Porciones (Kg)</span>
                {parseInt(editPorciones) > 0 && (
                  <span className="text-[10px] text-orange-600 font-normal ml-1">(Sugerido)</span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                value={editPesoPorciones}
                onChange={(e) => handleEditPesoPorcionesChange(e.target.value)}
                placeholder="0.00"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                <span>Valor Total ($)</span>
                <span className="text-[10px] text-emerald-600 font-normal ml-1">(Calculado)</span>
              </label>
              <input
                type="number"
                step="1"
                value={editCostoTotal}
                onChange={(e) => setEditCostoTotal(e.target.value)}
                placeholder="0"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-900 font-semibold bg-slate-50/50"
              />
            </div>
          </div>

          {/* 4. Observaciones */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Observaciones</label>
            <input
              type="text"
              value={editObs}
              onChange={(e) => setEditObs(e.target.value)}
              placeholder="Detalle u observación..."
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-normal cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-4 py-1.5 text-xs text-white bg-orange-500 hover:bg-orange-600 rounded-lg font-medium shadow-sm transition-all cursor-pointer"
            >
              {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
