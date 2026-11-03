'use client';

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  DollarSign,
  Receipt,
  User,
  Loader2,
  ArrowRight
} from 'lucide-react';
import ImportadorTxtModal from '@/components/ui/ImportadorTxtModal';
import { formatMoney } from '@/lib/formatters';

export interface ParsedSalidaItem {
  clasificacion: string;
  categoria: string;
  concepto: string;
  descripcion_beneficiario: string;
  valor_pagado: number;
  responsable_caja: string;
  soporte_factura: string;
}

export interface ParsedFlujoCaja {
  id: string;
  fecha: string;
  caja_nombre: string;
  cajera_responsable: string;
  base_inicial: number;
  total_datafonos: number;
  total_otros_medios: number;
  efectivo_fisico_cierre?: number;
  venta_pos_total?: number;
  observaciones?: string;
  salidas: ParsedSalidaItem[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const AI_PROMPT_FLUJO_CAJA = `Actúa como un experto contable y auditor de caja menor para restaurantes. Analiza la(s) foto(s), imagen(es) o apuntes del cuaderno de caja menor, notas de gastos, recibos y cuadres diarios adjuntos, y genera un archivo de texto plano (.txt) estructurado para el sistema "La Finca Costeo e Inventario".

REGLAS DE EXTRACCIÓN:
1. Puedes procesar UN solo flujo de caja (un día) o MÚLTIPLES flujos de caja (varios días) en el mismo archivo.
2. Cada flujo de caja debe comenzar obligatoriamente con el delimitador:
=== FLUJO DE CAJA ===

3. Para cada flujo de caja extrae los datos de CABECERA del día (campos requeridos y opcionales):
   - FECHA: [YYYY-MM-DD] (Obligatorio. Ej: 2026-11-03)
   - CAJA: [Nombre de la caja: Caja 1 / Caja 2 / Caja Principal. Opcional, por defecto Caja 1]
   - CAJERA_RESPONSABLE: [Nombre de la persona encargada: JOHANNA, MARIA, CAROLINA, DANIELA, LUCERO, ANTONIO, NEYMAR, etc. Obligatorio]
   - BASE_INICIAL: [Efectivo físico inicial en COP con el que abrió la caja. Solo dígitos enteros sin puntos ni signos ej. 500000. Opcional, defecto 500000]
   - DATAFONOS: [Total transacciones / vouchers de datáfono del día en COP. Solo dígitos ej. 350000. Opcional, defecto 0]
   - OTROS_MEDIOS: [Total transferencias digitales, Nequi, Daviplata en COP. Solo dígitos ej. 120000. Opcional, defecto 0]
   - EFECTIVO_FISICO_CIERRE: [Efectivo físico contado al cierre de caja en COP. Solo dígitos ej. 1450000. Opcional]
   - VENTA_POS: [Total venta del sistema POS en COP si aparece anotada. Solo dígitos ej. 1850000. Opcional]
   - OBSERVACIONES: [Novedades o aclaraciones del turno. Opcional o dejar vacío]

4. Para cada egreso, gasto o salida de dinero de la caja del día, agrégalo en la tabla de SALIDAS:
   - Clasificación: Debe ser una de las 3 oficiales:
     * "Costo / Insumo" (Compras de carnes, verduras, hielo, abarrotes, desechables, productos para cocina/bar)
     * "Gasto Operativo" (Transporte, taxis, aseo, mantenimiento, servicios públicos, ferretería, fotocopias)
     * "Turno / Nómina" (Pagos de turnos a meseros, cocineros, extras, vales de nómina)
   - Categoría:
     * Si es Costo / Insumo: Verduras, Bebidas, Grano, Carnes, Servicios, Desechables
     * Si es Gasto Operativo: Gastos Generales, Gastos Transporte, Gastos Mantenimiento, Gastos Limpieza
     * Si es Turno / Nómina: Gastos Nómina
   - Concepto: Nombre claro y conciso del ítem o motivo del gasto (Ej: Hielo 4 bolsas, Aguacates, Turno extra Andrés, Taxi compras, Jabón y esponjas, Recarga gas).
   - Descripción / Beneficiario: A quién se pagó o detalle específico (Ej: Don Pedro Plaza, Distribuidora Polar, Andrés Mesero, Éxito, etc.).
   - Valor: Monto pagado en COP (solo dígitos enteros, sin puntos de miles ni símbolos de pesos ej. 32000).
   - Cajera: Nombre de la persona que pagó de la caja (Ej: JOHANNA).
   - Soporte: Número de recibo, factura o documento soporte (Ej: Factura #1024, Recibo 45, Vale turno, Cuaderno caja).

5. No agregues introducciones, explicaciones, markdown adicional ni saludos. Entrega estrictamente el siguiente texto plano:

=== FLUJO DE CAJA ===
FECHA: 2026-11-01
CAJA: Caja 1
CAJERA_RESPONSABLE: JOHANNA
BASE_INICIAL: 500000
DATAFONOS: 320000
OTROS_MEDIOS: 150000
EFECTIVO_FISICO_CIERRE: 1420000
VENTA_POS: 1950000
OBSERVACIONES: Día sin novedades

SALIDAS:
Clasificación | Categoría | Concepto | Descripción / Beneficiario | Valor | Cajera | Soporte
Costo / Insumo | Verduras | Aguacates | Plaza Don Pedro | 45000 | JOHANNA | Recibo 12
Costo / Insumo | Bebidas | Hielo 5 bolsas | Distribuidora Polar | 25000 | JOHANNA | Factura 892
Gasto Operativo | Gastos Transporte | Taxi compras plaza | Don Juan Taxista | 15000 | JOHANNA | Vale 01
Turno / Nómina | Gastos Nómina | Turno extra cocina | Andrés Cocinero | 65000 | JOHANNA | Vale turno

=== FLUJO DE CAJA ===
FECHA: 2026-11-02
CAJA: Caja 1
CAJERA_RESPONSABLE: MARIA
BASE_INICIAL: 500000
DATAFONOS: 280000
OTROS_MEDIOS: 90000
EFECTIVO_FISICO_CIERRE: 1310000
VENTA_POS: 1720000
OBSERVACIONES: 

SALIDAS:
Clasificación | Categoría | Concepto | Descripción / Beneficiario | Valor | Cajera | Soporte
Costo / Insumo | Desechables | Vasos y servilletas | Distribuidora Central | 38000 | MARIA | Factura 301
Gasto Operativo | Gastos Limpieza | Cloro y desinfectante | Tienda El Aseo | 22000 | MARIA | Recibo 55`;

export default function ImportarFlujoCajaModal({ isOpen, onClose, onSuccess }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [parsedFlujos, setParsedFlujos] = useState<ParsedFlujoCaja[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const cleanNumber = (val: unknown): number => {
    if (!val) return 0;
    const str = String(val).replace(/[$]/g, '').trim();
    const digitsOnly = str.replace(/\D/g, '');
    return digitsOnly ? Number(digitsOnly) : 0;
  };

  const parseFlujosContent = (text: string) => {
    setError(null);
    setParsedFlujos([]);
    try {
      const trimmed = text.trim();

      // 1. Soporte para JSON estructurado si la IA devuelve JSON
      if (
        trimmed.startsWith('[') ||
        (trimmed.startsWith('{') && (trimmed.includes('"flujos"') || trimmed.includes('"salidas"')))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          const rawList = Array.isArray(parsed)
            ? parsed
            : parsed.flujos && Array.isArray(parsed.flujos)
            ? parsed.flujos
            : [parsed];

          if (rawList.length > 0) {
            const mapped: ParsedFlujoCaja[] = rawList.map((item: any, idx: number) => ({
              id: `flujo-json-${Date.now()}-${idx + 1}`,
              fecha: item.fecha || '',
              caja_nombre: item.caja_nombre || item.caja || 'Caja 1',
              cajera_responsable: item.cajera_responsable || item.cajera || 'JOHANNA',
              base_inicial: cleanNumber(item.base_inicial || 500000),
              total_datafonos: cleanNumber(item.total_datafonos || item.datafonos || 0),
              total_otros_medios: cleanNumber(item.total_otros_medios || item.otros_medios || 0),
              efectivo_fisico_cierre: cleanNumber(item.efectivo_fisico_cierre || item.efectivo_cierre || 0),
              venta_pos_total: cleanNumber(item.venta_pos_total || item.venta_pos || 0),
              observaciones: item.observaciones || '',
              salidas: (item.salidas || []).map((s: any) => ({
                clasificacion: s.clasificacion || 'Gasto Operativo',
                categoria: s.categoria || 'Gastos Generales',
                concepto: s.concepto || '',
                descripcion_beneficiario: s.descripcion_beneficiario || s.descripcion || s.concepto || '',
                valor_pagado: cleanNumber(s.valor_pagado || s.valor || 0),
                responsable_caja: s.responsable_caja || s.cajera || item.cajera_responsable || 'JOHANNA',
                soporte_factura: s.soporte_factura || s.soporte || `CUADERNO CAJA`,
              })),
            }));

            setParsedFlujos(mapped);
            return;
          }
        } catch (jsonErr) {
          console.warn('No es JSON válido, procesando como texto plano estructurado...', jsonErr);
        }
      }

      // 2. Procesar como texto plano con bloques === FLUJO DE CAJA ===
      const blocks = trimmed.split(/===+\s*(?:FLUJO(?:\s+DE\s+CAJA)?|CAJA(?:\s+MENOR)?)\s*===+/i);
      const flujosList: ParsedFlujoCaja[] = [];

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i].trim();
        if (!block) continue;

        const lines = block.split(/\r?\n/);
        let fecha = '';
        let caja = 'Caja 1';
        let cajera = 'JOHANNA';
        let baseInicial = 500000;
        let datafonos = 0;
        let otrosMedios = 0;
        let efectivoCierre = 0;
        let ventaPos = 0;
        let observaciones = '';
        const salidas: ParsedSalidaItem[] = [];

        let inSalidas = false;

        for (const line of lines) {
          const l = line.trim();
          if (!l) continue;

          if (l.toUpperCase().startsWith('SALIDAS:') || l.toUpperCase() === 'SALIDAS') {
            inSalidas = true;
            continue;
          }

          if (!inSalidas) {
            const upper = l.toUpperCase();
            if (upper.startsWith('FECHA:')) {
              fecha = l.replace(/^FECHA:\s*/i, '').trim();
            } else if (upper.startsWith('CAJA:')) {
              caja = l.replace(/^CAJA:\s*/i, '').trim();
            } else if (upper.startsWith('CAJERA_RESPONSABLE:') || upper.startsWith('CAJERA:') || upper.startsWith('RESPONSABLE:')) {
              cajera = l.replace(/^(?:CAJERA_RESPONSABLE|CAJERA|RESPONSABLE):\s*/i, '').trim();
            } else if (upper.startsWith('BASE_INICIAL:') || upper.startsWith('BASE:')) {
              baseInicial = cleanNumber(l.replace(/^(?:BASE_INICIAL|BASE):\s*/i, ''));
            } else if (upper.startsWith('DATAFONOS:') || upper.startsWith('DATAFONO:')) {
              datafonos = cleanNumber(l.replace(/^(?:DATAFONOS|DATAFONO):\s*/i, ''));
            } else if (upper.startsWith('OTROS_MEDIOS:') || upper.startsWith('NEQUI:')) {
              otrosMedios = cleanNumber(l.replace(/^(?:OTROS_MEDIOS|NEQUI):\s*/i, ''));
            } else if (upper.startsWith('EFECTIVO_FISICO_CIERRE:') || upper.startsWith('EFECTIVO_CIERRE:')) {
              efectivoCierre = cleanNumber(l.replace(/^(?:EFECTIVO_FISICO_CIERRE|EFECTIVO_CIERRE):\s*/i, ''));
            } else if (upper.startsWith('VENTA_POS:') || upper.startsWith('POS:')) {
              ventaPos = cleanNumber(l.replace(/^(?:VENTA_POS|POS):\s*/i, ''));
            } else if (upper.startsWith('OBSERVACIONES:')) {
              observaciones = l.replace(/^OBSERVACIONES:\s*/i, '').trim();
            }
          } else {
            // Líneas de la tabla de salidas
            if (l.includes('|')) {
              const parts = l.split('|').map((p) => p.trim());
              const p0Upper = (parts[0] || '').toUpperCase();
              // Ignorar línea de encabezados
              if (
                p0Upper.includes('CLASIFICACI') ||
                p0Upper.includes('CATEGOR') ||
                p0Upper.includes('CONCEPTO') ||
                p0Upper.startsWith('---')
              ) {
                continue;
              }

              if (parts.length >= 3) {
                const clasificacion = parts[0] || 'Gasto Operativo';
                const categoria = parts[1] || 'Gastos Generales';
                const concepto = parts[2] || '';
                const descripcion = parts[3] || concepto;
                const valor = cleanNumber(parts[4] || '0');
                const responsableSalida = parts[5] || cajera;
                const soporte = parts[6] || `CUADERNO CAJA / ${responsableSalida}`;

                if (concepto && valor > 0) {
                  salidas.push({
                    clasificacion,
                    categoria,
                    concepto,
                    descripcion_beneficiario: descripcion,
                    valor_pagado: valor,
                    responsable_caja: responsableSalida,
                    soporte_factura: soporte,
                  });
                }
              }
            }
          }
        }

        // Si se extrajo una fecha o salidas, agregar al listado
        if (fecha || salidas.length > 0) {
          flujosList.push({
            id: `flujo-txt-${Date.now()}-${i + 1}`,
            fecha: fecha || new Date().toISOString().split('T')[0],
            caja_nombre: caja || 'Caja 1',
            cajera_responsable: cajera || 'JOHANNA',
            base_inicial: baseInicial || 500000,
            total_datafonos: datafonos,
            total_otros_medios: otrosMedios,
            efectivo_fisico_cierre: efectivoCierre,
            venta_pos_total: ventaPos,
            observaciones,
            salidas,
          });
        }
      }

      if (flujosList.length === 0) {
        throw new Error(
          'No se encontraron flujos de caja válidos en el archivo. Verifica que contenga el delimitador "=== FLUJO DE CAJA ===" y la tabla de "SALIDAS:".'
        );
      }

      setParsedFlujos(flujosList);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido al analizar el archivo .txt';
      setError(message);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedFlujos.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/libros-apoyo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'IMPORT_FLUJOS_CAJA',
          flujos: parsedFlujos,
          replaceDates: true,
          tipo_libro: 'CAJA_MENOR',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo guardar la importación en la base de datos');
      }

      onSuccess(parsedFlujos.length);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar los flujos de caja';
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const totalSalidasExtraidas = parsedFlujos.reduce((acc, f) => acc + f.salidas.length, 0);
  const totalDineroExtraido = parsedFlujos.reduce(
    (acc, f) => acc + f.salidas.reduce((sAcc, s) => sAcc + s.valor_pagado, 0),
    0
  );

  return (
    <ImportadorTxtModal
      isOpen={isOpen}
      onClose={onClose}
      title="Importar Flujo de Caja (.txt)"
      subtitle="Digitalización inteligente de cuaderno de caja y cuadre diario mediante IA o archivo estructurado"
      dropzoneTitle="Arrastra tu archivo .txt aquí"
      dropzoneSubtitle="o haz clic para buscarlo en tu computador (soporta 1 o múltiples flujos de caja)"
      promptTitle="¿Tienes fotos o apuntes del cuaderno de caja menor? Usa este Prompt de IA"
      promptDescription="Pega este prompt en ChatGPT, Claude o Gemini junto con las fotos de tu cuaderno de caja menor o notas de cuadre diario. La IA extraerá los datos y generará un único archivo .txt que puedes arrastrar en la zona superior."
      promptTemplate={AI_PROMPT_FLUJO_CAJA}
      onFileContent={(content) => parseFlujosContent(content)}
      error={error}
    >
      {/* Previsualización de los flujos de caja extraídos antes de guardar */}
      {parsedFlujos.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  {parsedFlujos.length} {parsedFlujos.length === 1 ? 'Flujo de Caja extraído' : 'Flujos de Caja extraídos'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {totalSalidasExtraidas} salidas detectadas • Inversión total: ${formatMoney(totalDineroExtraido)} COP
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isImporting}
              onClick={handleConfirmImport}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando en BD...</span>
                </>
              ) : (
                <>
                  <span>Guardar e Importar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Listado de Flujos detectados */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {parsedFlujos.map((flujo, idx) => {
              const salidasDinero = flujo.salidas.reduce((a, s) => a + s.valor_pagado, 0);
              return (
                <div
                  key={flujo.id || idx}
                  className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-white border border-slate-200 rounded text-slate-700 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 font-mono">{flujo.fecha}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                          {flujo.caja_nombre}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Resp: <strong>{flujo.cajera_responsable}</strong>
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>Base: ${formatMoney(flujo.base_inicial)}</span>
                        {flujo.total_datafonos > 0 && <span>• Datáfonos: ${formatMoney(flujo.total_datafonos)}</span>}
                        {flujo.total_otros_medios > 0 && <span>• Nequi: ${formatMoney(flujo.total_otros_medios)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:shrink-0">
                    <span className="font-mono font-bold text-slate-900 block text-xs">
                      ${formatMoney(salidasDinero)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {flujo.salidas.length} {flujo.salidas.length === 1 ? 'salida' : 'salidas'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ImportadorTxtModal>
  );
}
