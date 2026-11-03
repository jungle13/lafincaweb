'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  UploadCloud,
  X,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface ImportadorTxtModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  dropzoneTitle?: string;
  dropzoneSubtitle?: string;
  promptTitle?: string;
  promptDescription?: string;
  promptTemplate: string;
  acceptExtensions?: string;
  onFileContent: (content: string, filename: string) => void | Promise<void>;
  isProcessing?: boolean;
  error?: string | null;
  children?: React.ReactNode;
}

export default function ImportadorTxtModal({
  isOpen,
  onClose,
  title,
  subtitle = 'Digitalización inteligente mediante IA o archivo estructurado',
  dropzoneTitle = 'Arrastra tu archivo .txt aquí',
  dropzoneSubtitle = 'o haz clic para buscarlo en tu computador',
  promptTitle = '¿Tienes fotos o apuntes? Usa este Prompt de IA',
  promptDescription = 'Pega este prompt en ChatGPT, Claude o Gemini junto con las fotos. La IA extraerá los datos y generará el archivo .txt que puedes arrastrar aquí.',
  promptTemplate,
  acceptExtensions = '.txt,.json,.csv',
  onFileContent,
  isProcessing = false,
  error = null,
  children,
}: ImportadorTxtModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      await onFileContent(text, file.name);
    } catch (err: unknown) {
      console.error('Error leyendo archivo en ImportadorTxtModal:', err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] isolate flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop con Blur y oscurecimiento adecuado */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal con scroll si es necesario */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Alerta de Error si ocurre */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Error al procesar el archivo:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* 📂 Dropzone: Arrastrar y Soltar Archivo */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              isProcessing
                ? 'opacity-60 pointer-events-none border-slate-300 bg-slate-50'
                : dragOver
                ? 'border-slate-900 bg-slate-50 scale-[0.99] cursor-pointer'
                : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/60 bg-white cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptExtensions}
              disabled={isProcessing}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto bg-slate-100 rounded-full flex items-center justify-center text-slate-600 mb-3 group-hover:scale-105 transition-transform">
              {isProcessing ? (
                <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>
            <p className="font-bold text-slate-800 text-sm mb-1">
              {isProcessing ? 'Procesando archivo...' : dropzoneTitle}
            </p>
            <p className="text-slate-500 text-xs">
              {dropzoneSubtitle}
            </p>
          </div>

          {/* Contenido adicional opcional (Previsualización de registros, etc.) */}
          {children}

          {/* 🤖 Sección del Prompt de IA con Copiar al Portapapeles */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-slate-800 text-xs sm:text-sm">
                  {promptTitle}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPromptPreview((v) => !v)}
                  className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Ver u ocultar texto del prompt"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{showPromptPreview ? 'Ocultar' : 'Ver'}</span>
                  {showPromptPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copied ? '¡Prompt Copiado!' : 'Copiar Prompt para IA'}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              {promptDescription}
            </p>

            {/* Previsualización del Prompt */}
            {showPromptPreview && (
              <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-56 overflow-y-auto border border-slate-800">
                {promptTemplate}
              </div>
            )}
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
