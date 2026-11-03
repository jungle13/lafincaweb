'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  UploadCloud, 
  FileText, 
  X, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle, 
  FileCode,
  ArrowRight
} from 'lucide-react';

export interface ParsedFacturaData {
  numeroFactura?: string;
  fecha?: string;
  proveedor?: string;
  categoriaPrincipal?: string;
  origen?: string;
  observaciones?: string;
  lineas: {
    nombre_insumo: string;
    categoria?: string;
    detalle?: string;
    cantidad: number;
    unidad?: string;
    costo_unitario: number;
  }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (data: ParsedFacturaData) => void;
}

const AI_PROMPT_TEMPLATE = `Actúa como un experto contable y de costeo para restaurantes. Analiza la imagen o archivo PDF de la factura / remisión de compra adjunta y genera un archivo de texto plano (.txt) estructurado con la información para el sistema "La Finca Costeo e Inventario".

REGLAS DE EXTRACCIÓN:
1. Extrae el número de factura o remisión, la fecha en formato YYYY-MM-DD, el nombre comercial del proveedor y la categoría principal.
2. Extrae cada insumo o línea de la factura con su Nombre, Categoría aproximada (Carnes y Proteínas, Verduras e Insumos, Granos y Abarrotes, Lácteos, Bebidas, Desechables y Empaques, Otros Insumos y Servicios), Cantidad numérica exacta (usar punto decimal ej. 10.5), Unidad de medida (Kg, Und, Bolsa, Paq, Atado, Bulto, Lt, Porc), Costo Unitario en COP (solo dígitos enteros, sin puntos de miles ni símbolos de pesos ej. 34500) y Detalle / Gramaje original.
3. No agregues saludos, explicaciones ni formato markdown extra; entrega estrictamente el siguiente texto plano:

FACTURA: [Número de Factura o Remisión]
FECHA: [YYYY-MM-DD]
PROVEEDOR: [Nombre del Proveedor]
CATEGORIA: [Categoría Principal]
ORIGEN: [Factura Electrónica / Remisión Bodega / Cuenta de Cobro]
OBSERVACIONES: [Notas opcionales o dejar vacío]

INSUMOS:
Insumo | Categoría | Cantidad | Unidad | Costo Unitario | Detalle
[Nombre Insumo 1] | [Categoría] | [Cantidad] | [Unidad] | [Costo Unitario] | [Detalle]
[Nombre Insumo 2] | [Categoría] | [Cantidad] | [Unidad] | [Costo Unitario] | [Detalle]`;

export default function ImportarComprasModal({ isOpen, onClose, onImportData }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const parseNumber = (val: string): number => {
    if (!val) return 0;
    // Limpiar signo $, espacios, y formatear comas/puntos
    let clean = val.replace(/[$]/g, '').trim();
    // Si viene en formato 34.500 o 34.500,00 (formato miles con punto)
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes('.') && clean.split('.')[1]?.length === 3) {
      // Punto usado como separador de miles (ej 34.500)
      clean = clean.replace(/\./g, '');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };

  const parseTxtContent = (text: string) => {
    setError(null);
    try {
      // 1. Verificar si es JSON directamente
      if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
        const json = JSON.parse(text);
        if (json.items || json.lineas) {
          const parsed: ParsedFacturaData = {
            numeroFactura: json.numero_factura || json.numeroFactura || '',
            fecha: json.fecha || '',
            proveedor: json.proveedor || '',
            categoriaPrincipal: json.categoria || json.categoriaPrincipal || 'Carnes y Proteínas',
            origen: json.origen || 'Factura Electrónica',
            observaciones: json.observaciones || '',
            lineas: (json.items || json.lineas || []).map((it: any) => ({
              nombre_insumo: it.nombre_insumo || it.insumo || it.nombre || '',
              categoria: it.categoria || 'Carnes y Proteínas',
              detalle: it.detalle || it.nombre_insumo || '',
              cantidad: parseNumber(String(it.cantidad || 1)),
              unidad: it.unidad || 'Kg',
              costo_unitario: parseNumber(String(it.costo_unitario || it.costo || 0)),
            }))
          };
          onImportData(parsed);
          onClose();
          return;
        }
      }

      // 2. Parseo de formato estándar clave-valor + tabla de insumos
      const lines = text.split(/\r?\n/);
      let numeroFactura = '';
      let fecha = '';
      let proveedor = '';
      let categoriaPrincipal = '';
      let origen = '';
      let observaciones = '';
      const itemsList: ParsedFacturaData['lineas'] = [];

      let isInsideItems = false;

      for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Limpiar marcas de bloque de código markdown ```txt o ```
        if (trimmed.startsWith('```')) continue;

        const upper = trimmed.toUpperCase();

        if (upper.startsWith('FACTURA:') || upper.startsWith('N° FACTURA:') || upper.startsWith('NUMERO FACTURA:')) {
          numeroFactura = trimmed.split(/:(.+)/)[1]?.trim() || '';
          continue;
        }
        if (upper.startsWith('FECHA:')) {
          const rawDate = trimmed.split(/:(.+)/)[1]?.trim() || '';
          // Normalizar fecha si viene DD/MM/YYYY
          if (rawDate.includes('/')) {
            const parts = rawDate.split('/');
            if (parts.length === 3 && parts[2].length === 4) {
              fecha = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
              fecha = rawDate;
            }
          } else {
            fecha = rawDate;
          }
          continue;
        }
        if (upper.startsWith('PROVEEDOR:')) {
          proveedor = trimmed.split(/:(.+)/)[1]?.trim() || '';
          continue;
        }
        if (upper.startsWith('CATEGORIA:') || upper.startsWith('CATEGORÍA:')) {
          categoriaPrincipal = trimmed.split(/:(.+)/)[1]?.trim() || '';
          continue;
        }
        if (upper.startsWith('ORIGEN:') || upper.startsWith('SOPORTE:')) {
          origen = trimmed.split(/:(.+)/)[1]?.trim() || '';
          continue;
        }
        if (upper.startsWith('OBSERVACIONES:') || upper.startsWith('NOTAS:')) {
          observaciones = trimmed.split(/:(.+)/)[1]?.trim() || '';
          continue;
        }

        if (upper.startsWith('INSUMOS:') || upper.startsWith('ITEMS:') || upper.startsWith('DETALLE:')) {
          isInsideItems = true;
          continue;
        }

        // Si la línea contiene pipes `|`, tabulaciones `\t`, o comas
        if (trimmed.includes('|') || trimmed.includes('\t') || isInsideItems) {
          // Si es una línea de cabecera de tabla, ignorar
          if (upper.includes('INSUMO') && (upper.includes('CANTIDAD') || upper.includes('COSTO') || upper.includes('PRECIO'))) {
            continue;
          }
          if (trimmed.startsWith('|---') || trimmed.startsWith('---')) {
            continue;
          }

          // Separar por pipe o tab
          let cols: string[] = [];
          if (trimmed.includes('|')) {
            cols = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
          } else if (trimmed.includes('\t')) {
            cols = trimmed.split('\t').map(c => c.trim());
          }

          if (cols.length >= 2) {
            // Estructura esperada: Insumo | Categoría | Cantidad | Unidad | Costo Unitario | Detalle
            // O flexible: Insumo | Cantidad | Unidad | Costo Unitario
            let nombre_insumo = cols[0] || '';
            let cat = cols[1] || categoriaPrincipal || 'Carnes y Proteínas';
            let cantStr = cols[2] || '1';
            let unidad = cols[3] || 'Und';
            let costoStr = cols[4] || '0';
            let detalle = cols[5] || '';

            // Detectar si la columna 1 era cantidad numérica (ej: Insumo | Cantidad | Unidad | Costo)
            if (cols.length === 4 || cols.length === 5) {
              if (!isNaN(parseNumber(cols[1])) && parseNumber(cols[1]) > 0) {
                cantStr = cols[1];
                unidad = cols[2] || 'Und';
                costoStr = cols[3] || '0';
                detalle = cols[4] || '';
                cat = categoriaPrincipal || 'Carnes y Proteínas';
              }
            }

            const cantidad = parseNumber(cantStr) || 1;
            const costo_unitario = parseNumber(costoStr) || 0;

            if (nombre_insumo.trim().length > 0) {
              itemsList.push({
                nombre_insumo,
                categoria: cat,
                detalle: detalle || nombre_insumo,
                cantidad,
                unidad,
                costo_unitario,
              });
            }
          }
        }
      }

      if (itemsList.length === 0) {
        throw new Error('No se encontraron líneas de insumos válidas en el archivo TXT.');
      }

      const result: ParsedFacturaData = {
        numeroFactura: numeroFactura || undefined,
        fecha: fecha || undefined,
        proveedor: proveedor || undefined,
        categoriaPrincipal: categoriaPrincipal || undefined,
        origen: origen || undefined,
        observaciones: observaciones || undefined,
        lineas: itemsList
      };

      onImportData(result);
      onClose();
    } catch (err: any) {
      console.error('Error parseando archivo compras TXT:', err);
      setError(err?.message || 'El formato del archivo no coincide con la estructura esperada.');
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.csv')) {
      setError('Por favor selecciona un archivo de texto con extensión .txt o .csv.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        parseTxtContent(content);
      }
    };
    reader.onerror = () => {
      setError('Error al leer el archivo en el navegador.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
      {/* Full-Screen Backdrop con desenfoque profesional */}
      <div 
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-0 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Card centrado y elevado sobre toda la vista */}
      <div 
        className="relative z-10 isolate bg-white rounded-xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Importar Factura de Compra (.txt)
              </h2>
              <p className="text-xs text-slate-500">
                Digitalización inteligente mediante IA o archivo estructurado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Mensaje de Error */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error en la importación</p>
                <p className="text-[11px] text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {/* 📂 Dropzone: Arrastrar y Soltar Archivo */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-slate-900 bg-slate-50 scale-[0.99]'
                : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/60 bg-white'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto bg-slate-100 rounded-full flex items-center justify-center text-slate-600 mb-3 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-800 text-sm mb-1">
              Arrastra tu archivo .txt aquí
            </p>
            <p className="text-slate-500 text-xs">
              o haz clic para buscarlo en tu computador
            </p>
          </div>

          {/* 🤖 Sección del Prompt de IA con Copiar al Portapapeles */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-slate-800">
                  ¿Tienes fotos o PDFs de tus facturas? Usa este Prompt de IA
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer self-start sm:self-auto ${
                  copied
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? '¡Prompt Copiado!' : 'Copiar Prompt para IA'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Pega este prompt en <strong>ChatGPT, Claude o Gemini</strong> junto con las fotos de tu factura. La IA extraerá los datos y generará el texto que puedes guardar como <strong>.txt</strong> y arrastrar en la zona superior.
            </p>
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
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
