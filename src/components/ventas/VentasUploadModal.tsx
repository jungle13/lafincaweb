'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Calendar,
  DollarSign,
  PackageCheck,
  UtensilsCrossed,
} from 'lucide-react';

interface VentasUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VentasUploadModal({ isOpen, onClose, onSuccess }: VentasUploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setError(null);
    setSaveSuccess(false);
  };

  const procesarArchivo = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setError('Formato inválido: el archivo debe tener extensión .txt (reporte de ventas POS).');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setLoadingPreview(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preview', 'true');

      const res = await fetch('/api/ventas/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Error analizando archivo de ventas.');
      }

      setPreviewData(json.preview);
    } catch (err: any) {
      setError(err.message || 'Error procesando el archivo de ventas.');
      setSelectedFile(null);
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      procesarArchivo(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      procesarArchivo(e.target.files[0]);
    }
  };

  const handleConfirmarGuardado = async () => {
    if (!selectedFile) return;
    setLoadingSave(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('preview', 'false');

      const res = await fetch('/api/ventas/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Error al guardar las ventas.');
      }

      setSaveSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        handleReset();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar la venta en la base de datos.');
    } finally {
      setLoadingSave(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Importar Ventas POS (.txt)
              </h2>
              <p className="text-xs text-slate-500">
                Arrastra el reporte diario de caja generado por el sistema POS
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Error al procesar archivo:</span>
                <p className="mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-700 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">¡Ventas ingresadas exitosamente!</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  El resumen y detalle de ventas ya están actualizados en el sistema.
                </p>
              </div>
            </div>
          )}

          {!previewData && !loadingPreview && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-50/40 scale-[0.99]'
                  : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                <FileText className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Haz clic para seleccionar o arrastra el archivo .txt aquí
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Formato admitido: Archivos de reporte diario POS (ej: <code>28.txt</code>)
              </p>
            </div>
          )}

          {loadingPreview && (
            <div className="p-10 flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              <p className="font-medium text-slate-700">Analizando estructura de ventas POS...</p>
              <p className="text-[11px] text-slate-400">Verificando cabecera de fecha, artículos y totales</p>
            </div>
          )}

          {previewData && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-700">
                    {previewData.archivo_origen}
                  </span>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Cambiar archivo
                </button>
              </div>

              {previewData.yaExiste && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Advertencia de sobreescritura:</span> Ya existen ventas registradas para el{' '}
                    <strong>{previewData.fecha}</strong> por un valor de{' '}
                    <strong>${Number(previewData.datosExistentes?.gran_total || 0).toLocaleString('es-CO')} COP</strong>.
                    Al confirmar, se actualizará este día con los datos del nuevo archivo.
                  </div>
                </div>
              )}

              {/* Grid de KPIs Previsualizados */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Fecha POS</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800">{previewData.fecha}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{previewData.dia_semana}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Artículos</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {previewData.total_articulos} und
                  </p>
                  <p className="text-[10px] text-slate-400">Total unidades</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    <span>Variedad</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {previewData.total_platos_distintos} platos
                  </p>
                  <p className="text-[10px] text-slate-400">Referencias</p>
                </div>

                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Gran Total</span>
                  </div>
                  <p className="text-xs font-bold text-emerald-800">
                    ${Number(previewData.gran_total || 0).toLocaleString('es-CO')}
                  </p>
                  <p className="text-[10px] text-emerald-600">Con impoconsumo</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              handleReset();
              onClose();
            }}
            disabled={loadingSave}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          {previewData && !saveSuccess && (
            <button
              type="button"
              onClick={handleConfirmarGuardado}
              disabled={loadingSave}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {loadingSave ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando en base de datos...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar e Ingresar Ventas</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
