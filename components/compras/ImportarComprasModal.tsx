'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  UploadCloud, 
  X, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle
} from 'lucide-react';

export interface ParsedFacturaItem {
  nombre_original: string; // Nombre literal tal cual como se extrae de la factura sin modificaciones
  nombre_insumo?: string;  // Nombre de insumo equivalente en catálogo (o vacío)
  insumo_id?: string | null;
  categoria?: string;
  detalle?: string;
  cantidad: number;
  unidad?: string;
  costo_unitario: number;
}

export interface ParsedFacturaData {
  id: string;
  numeroFactura?: string;
  fecha?: string;
  proveedor?: string;
  categoriaPrincipal?: string;
  origen?: string;
  observaciones?: string;
  lineas: ParsedFacturaItem[];
  guardada?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (data: ParsedFacturaData[]) => void;
}

const AI_PROMPT_TEMPLATE = `Actúa como un experto contable y de costeo para restaurantes. Analiza la(s) foto(s), imagen(es) o archivo(s) PDF de la(s) factura(s) / remisión(es) de compra adjunta(s) y genera un archivo de texto plano (.txt) estructurado para el sistema "La Finca Costeo e Inventario".

REGLAS DE EXTRACCIÓN:
1. Puedes procesar UNA o MÚLTIPLES facturas a la vez en un solo archivo. Separa cada factura claramente con el delimitador:
=== FACTURA ===

2. Para cada factura extrae los datos de comprobante:
   - FACTURA: [Número de Factura o Remisión]
   - FECHA: [YYYY-MM-DD]
   - PROVEEDOR: [Nombre Comercial del Proveedor]
   - CATEGORIA: [Categoría Principal aproximada: Carnes y Proteínas, Verduras e Insumos, Granos y Abarrotes, Lácteos, Bebidas, Desechables y Empaques, Otros Insumos y Servicios]
   - ORIGEN: [Factura Electrónica / Remisión Bodega / Cuenta de Cobro / Compra Directa / Contado]
   - OBSERVACIONES: [Notas opcionales o dejar vacío]

3. Para cada insumo o ítem de la factura extrae en la tabla de INSUMOS:
   - Insumo Factura: Nombre exacto y literal como aparece impreso en la factura original sin modificar ni resumir.
   - Categoría: Categoría aproximada del insumo.
   - Cantidad: Cantidad numérica exacta (usar punto decimal ej. 10.5).
   - Unidad: Unidad de medida (Kg, Und, Bolsa, Paq, Atado, Bulto, Lt, Porc).
   - Costo Unitario: Costo Unitario en COP (solo dígitos enteros, sin puntos de miles ni símbolos de pesos ej. 34500).
   - Detalle: Detalle, gramaje o presentación original.

4. No agregues saludos, explicaciones ni formato markdown extra; entrega estrictamente el siguiente texto plano:

=== FACTURA ===
FACTURA: [Número de Factura 1]
FECHA: [YYYY-MM-DD]
PROVEEDOR: [Nombre del Proveedor 1]
CATEGORIA: [Categoría Principal]
ORIGEN: [Factura Electrónica / Remisión Bodega / Cuenta de Cobro]
OBSERVACIONES: [Notas opcionales o vacío]

INSUMOS:
Insumo Factura | Categoría | Cantidad | Unidad | Costo Unitario | Detalle
[Nombre literal en factura 1] | [Categoría] | [Cantidad] | [Unidad] | [Costo Unitario] | [Detalle]
[Nombre literal en factura 2] | [Categoría] | [Cantidad] | [Unidad] | [Costo Unitario] | [Detalle]

=== FACTURA ===
FACTURA: [Número de Factura 2]
FECHA: [YYYY-MM-DD]
PROVEEDOR: [Nombre del Proveedor 2]
CATEGORIA: [Categoría Principal]
ORIGEN: [Factura Electrónica]
OBSERVACIONES: [Notas opcionales o vacío]

INSUMOS:
Insumo Factura | Categoría | Cantidad | Unidad | Costo Unitario | Detalle
[Nombre literal en factura 1] | [Categoría] | [Cantidad] | [Unidad] | [Costo Unitario] | [Detalle]`;

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
    let clean = val.replace(/[$]/g, '').trim();
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes('.') && clean.split('.')[1]?.length === 3) {
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
      const trimmed = text.trim();

      // 1. Verificar si es JSON directamente (Array o un objeto con lista de facturas)
      if (trimmed.startsWith('[') || (trimmed.startsWith('{') && (trimmed.includes('"facturas"') || trimmed.includes('"items"') || trimmed.includes('"lineas"')))) {
        try {
          const parsedJson = JSON.parse(trimmed);
          let rawFacturasList: any[] = [];
          if (Array.isArray(parsedJson)) {
            rawFacturasList = parsedJson;
          } else if (parsedJson.facturas && Array.isArray(parsedJson.facturas)) {
            rawFacturasList = parsedJson.facturas;
          } else if (parsedJson.items || parsedJson.lineas) {
            rawFacturasList = [parsedJson];
          }

          if (rawFacturasList.length > 0) {
            const mappedList: ParsedFacturaData[] = rawFacturasList.map((json: any, idx: number) => ({
              id: `fac-json-${Date.now()}-${idx + 1}`,
              numeroFactura: json.numero_factura || json.numeroFactura || '',
              fecha: json.fecha || '',
              proveedor: json.proveedor || '',
              categoriaPrincipal: json.categoria || json.categoriaPrincipal || 'Carnes y Proteínas',
              origen: json.origen || 'Factura Electrónica',
              observaciones: json.observaciones || '',
              lineas: (json.items || json.lineas || []).map((it: any) => ({
                nombre_original: it.nombre_original || it.nombre_factura || it.nombre_insumo || it.insumo || it.nombre || '',
                nombre_insumo: '',
                insumo_id: null,
                categoria: it.categoria || json.categoria || 'Carnes y Proteínas',
                detalle: it.detalle || it.nombre_original || '',
                cantidad: parseNumber(String(it.cantidad || 1)),
                unidad: it.unidad || 'Kg',
                costo_unitario: parseNumber(String(it.costo_unitario || it.costo || 0)),
              }))
            }));

            onImportData(mappedList);
            onClose();
            return;
          }
        } catch {
          // Si no era JSON válido, continuar con parseo de texto plano estándar
        }
      }

      // 2. Parseo de formato estándar clave-valor con soporte de múltiples facturas
      const lines = text.split(/\r?\n/);
      const facturas: ParsedFacturaData[] = [];
      let currentFac: ParsedFacturaData = {
        id: `fac-1-${Date.now()}`,
        numeroFactura: '',
        fecha: '',
        proveedor: '',
        categoriaPrincipal: 'Carnes y Proteínas',
        origen: 'Factura Electrónica',
        observaciones: '',
        lineas: []
      };
      let isInsideItems = false;

      const resetCurrentFac = () => {
        if (currentFac.numeroFactura || currentFac.lineas.length > 0) {
          facturas.push({ ...currentFac });
        }
        currentFac = {
          id: `fac-${facturas.length + 1}-${Date.now()}`,
          numeroFactura: '',
          fecha: '',
          proveedor: '',
          categoriaPrincipal: 'Carnes y Proteínas',
          origen: 'Factura Electrónica',
          observaciones: '',
          lineas: []
        };
        isInsideItems = false;
      };

      for (let line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        if (trimmedLine.startsWith('```')) continue;

        const upper = trimmedLine.toUpperCase();

        // Delimitador explícito de nueva factura
        if (upper.includes('=== FACTURA') || upper.includes('--- FACTURA') || upper.includes('===FACTURA')) {
          resetCurrentFac();
          continue;
        }

        // Si encontramos FACTURA: y ya teníamos una factura con datos, iniciar nueva
        if (upper.startsWith('FACTURA:') || upper.startsWith('N° FACTURA:') || upper.startsWith('NUMERO FACTURA:') || upper.startsWith('NRO FACTURA:')) {
          if (currentFac.numeroFactura || currentFac.lineas.length > 0) {
            resetCurrentFac();
          }
          currentFac.numeroFactura = trimmedLine.split(/:(.+)/)[1]?.trim() || '';
          continue;
        }

        if (upper.startsWith('FECHA:')) {
          const rawDate = trimmedLine.split(/:(.+)/)[1]?.trim() || '';
          if (rawDate.includes('/')) {
            const parts = rawDate.split('/');
            if (parts.length === 3 && parts[2].length === 4) {
              currentFac.fecha = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
              currentFac.fecha = rawDate;
            }
          } else {
            currentFac.fecha = rawDate;
          }
          continue;
        }

        if (upper.startsWith('PROVEEDOR:')) {
          currentFac.proveedor = trimmedLine.split(/:(.+)/)[1]?.trim() || '';
          continue;
        }

        if (upper.startsWith('CATEGORIA:') || upper.startsWith('CATEGORÍA:')) {
          currentFac.categoriaPrincipal = trimmedLine.split(/:(.+)/)[1]?.trim() || 'Carnes y Proteínas';
          continue;
        }

        if (upper.startsWith('ORIGEN:') || upper.startsWith('SOPORTE:')) {
          currentFac.origen = trimmedLine.split(/:(.+)/)[1]?.trim() || 'Factura Electrónica';
          continue;
        }

        if (upper.startsWith('OBSERVACIONES:') || upper.startsWith('NOTAS:')) {
          currentFac.observaciones = trimmedLine.split(/:(.+)/)[1]?.trim() || '';
          continue;
        }

        if (upper.startsWith('INSUMOS:') || upper.startsWith('ITEMS:') || upper.startsWith('DETALLE:')) {
          isInsideItems = true;
          continue;
        }

        // Si es una línea de tabla o contiene pipes
        if (trimmedLine.includes('|') || trimmedLine.includes('\t') || isInsideItems) {
          if (upper.includes('INSUMO') && (upper.includes('CANTIDAD') || upper.includes('COSTO') || upper.includes('PRECIO'))) {
            continue;
          }
          if (trimmedLine.startsWith('|---') || trimmedLine.startsWith('---')) {
            continue;
          }

          let cols: string[] = [];
          if (trimmedLine.includes('|')) {
            cols = trimmedLine.split('|').map(c => c.trim()).filter(c => c.length > 0);
          } else if (trimmedLine.includes('\t')) {
            cols = trimmedLine.split('\t').map(c => c.trim());
          }

          if (cols.length >= 2) {
            let nombre_original = cols[0] || '';
            let cat = cols[1] || currentFac.categoriaPrincipal || 'Carnes y Proteínas';
            let cantStr = cols[2] || '1';
            let unidad = cols[3] || 'Kg';
            let costoStr = cols[4] || '0';
            let detalle = cols[5] || '';

            // Si la columna 1 era número: Insumo | Cantidad | Unidad | Costo
            if (cols.length === 4 || cols.length === 5) {
              if (!isNaN(parseNumber(cols[1])) && parseNumber(cols[1]) > 0) {
                cantStr = cols[1];
                unidad = cols[2] || 'Kg';
                costoStr = cols[3] || '0';
                detalle = cols[4] || '';
                cat = currentFac.categoriaPrincipal || 'Carnes y Proteínas';
              }
            }

            const cantidad = parseNumber(cantStr) || 1;
            const costo_unitario = parseNumber(costoStr) || 0;

            if (nombre_original.trim().length > 0) {
              currentFac.lineas.push({
                nombre_original,
                nombre_insumo: '',
                insumo_id: null,
                categoria: cat,
                detalle: detalle || nombre_original,
                cantidad,
                unidad,
                costo_unitario,
              });
            }
          }
        }
      }

      // Añadir la última factura procesada si tiene datos
      if (currentFac.numeroFactura || currentFac.lineas.length > 0) {
        facturas.push(currentFac);
      }

      if (facturas.length === 0) {
        throw new Error('No se detectaron facturas ni insumos válidos en el archivo TXT. Asegúrate de usar el formato del prompt.');
      }

      onImportData(facturas);
      onClose();
    } catch (err: any) {
      console.error('Error parseando archivo TXT:', err);
      setError(err.message || 'Error procesando el formato del archivo TXT.');
    }
  };

  const handleFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        parseTxtContent(content);
      }
    };
    reader.onerror = () => {
      setError('Error al leer el archivo desde el dispositivo.');
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
                Importar Factura(s) de Compra (.txt)
              </h2>
              <p className="text-xs text-slate-500">
                Extracción individual o múltiple generada por IA o archivo estructurado
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
              o haz clic para buscarlo en tu computador (soporta 1 o múltiples facturas)
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
              Pega este prompt en <strong>ChatGPT, Claude o Gemini</strong> junto con las fotos o PDFs de una o varias facturas de compra. La IA extraerá los datos y generará un único archivo <strong>.txt</strong> que puedes arrastrar en la zona superior.
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
