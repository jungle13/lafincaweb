'use client';

import { useState, useEffect } from 'react';
import { Calendar, Loader2, Save, Wrench } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useNotification } from '@/context/NotificationContext';

export interface QuickAjusteModalData {
  isOpen: boolean;
  fecha: string;
  insumoId: string | number;
  insumoName: string;
  ubicacion: string;
  ubicacionLabel: string;
  cantidad: number | string;
  motivo: string;
  justificacion: string;
}

interface Props {
  modalData: QuickAjusteModalData | null;
  currentPeriodo: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function QuickAjusteModal({
  modalData,
  currentPeriodo,
  onClose,
  onSuccess,
}: Props) {
  const [formData, setFormData] = useState<QuickAjusteModalData | null>(modalData);
  const [savingQuickAjuste, setSavingQuickAjuste] = useState(false);
  const { success, error } = useNotification();

  // Sincronizar estado siempre que cambien las props
  useEffect(() => {
    setFormData(modalData);
  }, [modalData]);

  const isModalOpen = Boolean(modalData && modalData.isOpen);

  const handleSaveQuickAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setSavingQuickAjuste(true);
    try {
      const res = await fetch('/api/bodega/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: formData.fecha,
          insumo_id: formData.insumoId,
          tipo_ajuste: formData.motivo,
          ubicacion: formData.ubicacion,
          cantidad: parseFloat(String(formData.cantidad)) || 0,
          justificacion: formData.justificacion.trim(),
          usuario: 'Administrador',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar ajuste');

      const cantDisplay = formData.cantidad;
      const unitLabel = formData.ubicacion === 'BODEGA_ENTERO' ? 'Kg' : 'Und';

      // 1. Cerrar inmediatamente el modal
      onClose();

      // 2. Disparar notificación push interna instantánea
      success(
        `Se aplicó ajuste de +${cantDisplay} ${unitLabel} en ${formData.ubicacionLabel} para "${formData.insumoName}". El inventario quedó cuadrado.`,
        '🛠️ Ajuste Aplicado Exitosamente'
      );

      // 3. Notificar al feed padre para refrescar
      if (onSuccess) onSuccess();
    } catch (err: any) {
      error(err.message || 'Error al guardar el ajuste de inventario');
    } finally {
      setSavingQuickAjuste(false);
    }
  };

  if (!isModalOpen || !formData) return null;

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={onClose}
      title="Ajuste Rápido de Stock por Error de Conteo"
      icon={<Wrench className="w-5 h-5 text-amber-600" />}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSaveQuickAjuste} className="space-y-3 text-xs font-normal">
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-slate-700 text-[11px] space-y-1">
          <span className="font-medium text-amber-950 block">💡 Ajuste automático sugerido</span>
          <p>
            Se aplicará un ingreso de stock necesario en <strong>{formData.ubicacionLabel}</strong> para que puedas
            aprobar este movimiento sin descuadres.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Fecha a Ajustar</span>
            </label>
            <input
              type="date"
              required
              min={currentPeriodo?.fecha_inicio}
              max={currentPeriodo?.fecha_fin}
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-800 bg-white font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Materia Prima / Carne</label>
            <input
              type="text"
              disabled
              value={formData.insumoName}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Ubicación</label>
            <select
              value={formData.ubicacion}
              onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
              className="w-full h-8 px-2 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-800 bg-white"
            >
              <option value="BODEGA_PORCIONADO">Bodega (Und)</option>
              <option value="BODEGA_ENTERO">Bodega (Kg)</option>
              <option value="COCINA_PORCIONADO">Cocina (Und)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Cantidad a Ajustar (+)</label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.cantidad}
              onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-900 font-bold"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-medium mb-1">Motivo Tipificado</label>
          <select
            value={formData.motivo}
            onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
            className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-800 bg-white"
          >
            <option value="ERROR_CONTEO_PREVIO">Corrección por Error de Conteo</option>
            <option value="MERMA_POR_DESCONGELACION">Merma por Descongelación</option>
            <option value="DETERIORO_CALIDAD">Deterioro de Calidad / Descarte</option>
            <option value="DONACION_O_DEGUSTACION">Donación o Muestra Comercial</option>
            <option value="CONSUMO_INTERNO">Consumo Interno / Pruebas</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-medium mb-1">Justificación / Observaciones</label>
          <input
            type="text"
            required
            value={formData.justificacion}
            onChange={(e) => setFormData({ ...formData, justificacion: e.target.value })}
            className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-amber-500 text-slate-800"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-normal transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={savingQuickAjuste}
            className="px-4 py-1.5 text-xs text-white bg-amber-600 hover:bg-amber-700 rounded-lg font-medium shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {savingQuickAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Guardar Ajuste y Actualizar</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
