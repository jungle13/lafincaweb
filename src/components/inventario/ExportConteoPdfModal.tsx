'use client';

import { useState, useMemo } from 'react';
import { Printer, Search, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';
import { InsumoItem } from '@/types';
import * as XLSX from 'xlsx';

interface ConteoDetalle {
  id: string;
  conteo_id: string;
  insumo_id: string;
  ubicacion: 'BODEGA' | 'COCINA';
  cant_sin_porcionar_kg: number;
  porciones_und: number;
  peso_porciones_kg: number;
  costo_unitario_kg?: number;
  costo_unitario?: number;
  valor_total?: number;
  catalogo_insumos?: {
    nombre: string;
    unidad_medida: string;
    categoria: string;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conteo: {
    id: string;
    fecha: string;
    usuario?: string;
    estado?: string;
  };
  detalles: ConteoDetalle[];
  insumosList?: InsumoItem[];
}

export default function ExportConteoPdfModal({
  isOpen,
  onClose,
  conteo,
  detalles,
  insumosList = []
}: Props) {
  const [filterType, setFilterType] = useState<'ALL' | 'CARNES' | 'BODEGA' | 'COCINA'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Mapa rápido de catálogo para completar costos y datos si faltan
  const catMap = useMemo(() => {
    const map = new Map<string, InsumoItem>();
    insumosList.forEach((item) => {
      if (item.insumo_id) map.set(String(item.insumo_id), item);
      if (item.insumo) map.set(item.insumo.toLowerCase().trim(), item);
    });
    return map;
  }, [insumosList]);

  // Lista enriquecida de items contados
  const enrichedDetalles = useMemo(() => {
    return detalles.map((d) => {
      const catItem = catMap.get(String(d.insumo_id)) || catMap.get(d.catalogo_insumos?.nombre?.toLowerCase().trim() || '');
      const nombre = d.catalogo_insumos?.nombre || catItem?.insumo || 'Insumo';
      const categoria = d.catalogo_insumos?.categoria || catItem?.categoria || '';
      const unidad_medida = d.catalogo_insumos?.unidad_medida || catItem?.unidad_medida || 'Kg';
      
      const isUnd = unidad_medida.toLowerCase() === 'und' ||
                    categoria.toLowerCase().includes('embutido') ||
                    categoria.toLowerCase().includes('elaborado') ||
                    nombre.toLowerCase().includes('chorizo') ||
                    nombre.toLowerCase().includes('tamal') ||
                    nombre.toLowerCase().includes('huevo');

      const esCarne = catItem ? (catItem.es_carne !== false) : true;
      const pesoPorcGramos = catItem?.peso_porc_gramos || (d.porciones_und > 0 && d.peso_porciones_kg > 0 ? Math.round((d.peso_porciones_kg / d.porciones_und) * 1000) : 0);

      const cantEnteroKg = Number(d.cant_sin_porcionar_kg || 0);
      const porcUnd = Number(d.porciones_und || 0);
      const pesoPorcKg = Number(d.peso_porciones_kg || 0);
      const totalKg = isUnd ? 0 : (cantEnteroKg + pesoPorcKg);

      const costoUnit = Number(d.costo_unitario_kg || d.costo_unitario || catItem?.costo_unitario_kg || 0);
      
      let valorTotal = Number(d.valor_total || 0);
      if (!valorTotal || valorTotal <= 0) {
        valorTotal = isUnd ? Math.round(porcUnd * costoUnit) : Math.round(totalKg * costoUnit);
      }

      return {
        id: d.id,
        insumo_id: d.insumo_id,
        nombre,
        categoria,
        unidad_medida,
        ubicacion: d.ubicacion || 'BODEGA',
        isUnd,
        esCarne,
        pesoPorcGramos,
        cantEnteroKg,
        porcUnd,
        pesoPorcKg,
        totalKg,
        costoUnit,
        valorTotal
      };
    });
  }, [detalles, catMap]);

  // Filtrado
  const filteredList = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);

    return enrichedDetalles.filter((item) => {
      // Filtros rápidos
      if (filterType === 'CARNES' && !item.esCarne) return false;
      if (filterType === 'BODEGA' && item.ubicacion !== 'BODEGA') return false;
      if (filterType === 'COCINA' && item.ubicacion !== 'COCINA') return false;

      // Buscador
      if (!cleanSearch) return true;
      const name = normalizeStr(item.nombre);
      const cat = normalizeStr(item.categoria);
      return name.includes(cleanSearch) || cat.includes(cleanSearch);
    });
  }, [enrichedDetalles, filterType, searchQuery]);

  // Resumen Ejecutivo
  const summary = useMemo(() => {
    let tBodegaKg = 0;
    let tBodegaUnd = 0;
    let tCocinaKg = 0;
    let tCocinaUnd = 0;
    let tValorTotal = 0;

    filteredList.forEach((item) => {
      if (item.ubicacion === 'BODEGA') {
        if (item.isUnd) {
          tBodegaUnd += item.porcUnd;
        } else {
          tBodegaKg += item.totalKg;
          tBodegaUnd += item.porcUnd;
        }
      } else {
        if (item.isUnd) {
          tCocinaUnd += item.porcUnd;
        } else {
          tCocinaKg += item.totalKg;
          tCocinaUnd += item.porcUnd;
        }
      }
      tValorTotal += item.valorTotal;
    });

    return {
      tBodegaKg,
      tBodegaUnd,
      tCocinaKg,
      tCocinaUnd,
      tValorTotal
    };
  }, [filteredList]);

  const getObservacion = (nombre: string) => {
    const n = nombre.toLowerCase();
    if (n.includes('tocineta barril') || n.includes('tocino barril')) {
      return { isEliana: true, text: 'Inventario Eliana (89.00 Kg)' };
    }
    if (n.includes('sobaco')) {
      return { isEliana: true, text: 'Inventario Eliana (24.00 Kg)' };
    }
    if (n.includes('sobrebarriga')) {
      return { isEliana: true, text: 'Inventario Eliana (19.50 Kg)' };
    }
    if (n.includes('lengua')) {
      return { isEliana: true, text: 'Inventario Eliana: Dejamos las mismas (Lote agotado)' };
    }
    return { isEliana: false, text: '' };
  };

  // Exportar a Excel (.xlsx) local
  const handleExportExcel = () => {
    const rows = filteredList.map((item, idx) => ({
      'N°': idx + 1,
      'Insumo / Carne': item.nombre,
      'Categoría': item.categoria,
      'Ubicación': item.ubicacion,
      'Cant. Entero (Kg)': item.isUnd ? 0 : item.cantEnteroKg,
      'Porciones (Und)': item.porcUnd,
      'Peso Porciones (Kg)': item.isUnd ? 0 : item.pesoPorcKg,
      'Total Físico (Kg)': item.isUnd ? 0 : item.totalKg,
      'Unidad Base': item.isUnd ? 'Und' : 'Kg',
      'Costo Unitario ($ COP)': item.costoUnit,
      'Valor Total Conteo ($ COP)': item.valorTotal,
      'Observaciones / Inventario Eliana': getObservacion(item.nombre).text || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Formatear anchos de columna
    ws['!cols'] = [
      { wch: 5 },
      { wch: 28 },
      { wch: 18 },
      { wch: 12 },
      { wch: 18 },
      { wch: 15 },
      { wch: 18 },
      { wch: 16 },
      { wch: 12 },
      { wch: 20 },
      { wch: 22 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CONTEO_FISICO');

    const fileName = `CONTEO_FISICO_LA_FINCA_${conteo.fecha || 'SESION'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reporte Oficial de Conteo Físico e Inventario"
      icon={<Printer className="w-5 h-5 text-blue-600" />}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-3 text-xs font-normal">
        {/* Estilo CSS especial para impresión directa en PDF horizontal */}
        <style jsx global>{`
          @media print {
            @page {
              size: landscape;
              margin: 6mm;
            }
            html, body {
              overflow: visible !important;
              height: auto !important;
              background: white !important;
              color: black !important;
            }
            .fixed {
              position: static !important;
              display: block !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
              inset: auto !important;
              padding: 0 !important;
            }
            .overflow-y-auto, .overflow-hidden {
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
            }
            .bg-slate-950\\/65, .bg-slate-950\\/70, .backdrop-blur-sm {
              display: none !important;
            }
            nav, header, aside, .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>

        {/* Barra Superior de Filtros y Controles del Documento (Oculta al imprimir) */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-2.5 print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtros rápidos */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filterType === 'ALL'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({enrichedDetalles.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('CARNES')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filterType === 'CARNES'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🥩 Solo Carnes
              </button>
              <button
                type="button"
                onClick={() => setFilterType('BODEGA')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filterType === 'BODEGA'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Solo Bodega
              </button>
              <button
                type="button"
                onClick={() => setFilterType('COCINA')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filterType === 'COCINA'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Solo Cocina
              </button>
            </div>

            {/* Buscador Rápido */}
            <div className="relative w-40 sm:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar carne o insumo en acta..."
                className="w-full h-7 pl-7 pr-2.5 text-[11px] rounded-lg border border-slate-300 outline-none focus:border-orange-500 bg-white"
              />
            </div>
          </div>

          {/* Botones de Exportación: Excel y PDF */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Descargar archivo Excel con fórmulas y costos"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>

            <a
              href={`/api/inventario/conteos/${conteo.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              download={`ACTA_CONTEO_FISICO_${conteo.fecha || '2026-09-24'}.pdf`}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Descargar archivo PDF oficial generado directamente"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PDF</span>
            </a>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Imprimir o guardar como documento PDF horizontal"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Vista Previa</span>
            </button>
          </div>
        </div>

        {/* Hoja Imprimible Oficial (Estructura idéntica al Reporte Oficial) */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-3 text-slate-900 shadow-sm print:border-none print:p-0">
          {/* Header del Acta */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2.5">
            <div>
              <h1 className="text-base font-bold uppercase tracking-wide text-slate-950">
                RESTAURANTE LA FINCA CHOCLOS Y ASADOS
              </h1>
              <h2 className="text-xs font-semibold text-slate-700 uppercase mt-0.5">
                Acta Oficial de Conteo Físico de Inventario
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Sesión: <strong>{conteo.fecha}</strong> • Responsable: <strong>{conteo.usuario || 'Bodeguero'}</strong> • Ítems en acta: <strong>{filteredList.length}</strong>
              </p>
            </div>

            <div className="text-right text-[10px] space-y-0.5">
              <span className={`px-2 py-0.5 rounded-full font-bold border inline-block ${
                conteo.estado === 'APLICADO'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                ESTADO: {conteo.estado === 'APLICADO' ? 'APLICADO A INVENTARIO' : 'EN AUDITORÍA / CONTEO FÍSICO'}
              </span>
              <div className="text-slate-500">
                Fecha emisión: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Resumen Ejecutivo (KPIs) */}
          <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
            <div>
              <span className="text-[9px] text-slate-500 font-medium uppercase block">Total Contado en Bodega</span>
              <span className="text-xs font-bold text-slate-900">{summary.tBodegaKg.toFixed(2)} Kg</span>
              <span className="text-[9px] text-purple-700 block">({summary.tBodegaUnd} porciones / unidades)</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 font-medium uppercase block">Total Contado en Cocina</span>
              <span className="text-xs font-bold text-amber-800">{summary.tCocinaKg.toFixed(2)} Kg</span>
              <span className="text-[9px] text-amber-700 block">({summary.tCocinaUnd} porciones / unidades)</span>
            </div>
            <div className="bg-slate-900 text-white p-1 rounded-md">
              <span className="text-[9px] text-amber-300 font-medium uppercase block">Valor Total Conteo Físico</span>
              <span className="text-xs font-bold text-amber-400">$ {formatMoney(summary.tValorTotal)}</span>
              <span className="text-[9px] text-slate-300 block">(Existencias Físicas Reales Valorizadas)</span>
            </div>
          </div>

          {/* Tabla Maestra de Conteo Físico */}
          <div className="border border-slate-300 rounded-lg overflow-x-auto max-h-[50vh] overflow-y-auto print:max-h-none print:overflow-visible">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm text-slate-800 font-bold uppercase text-[9px] border-b border-slate-300 shadow-2xs">
                <tr>
                  <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Carne / Insumo</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Ubicación</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Conteo Entero (Kg)</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Conteo Porc. (Und / Kg)</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap font-bold bg-blue-50/70">Total Físico (Kg)</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Costo Unit. / Kg</th>
                  <th className="p-1.5 text-right bg-slate-200 whitespace-nowrap font-bold">Valor Conteo ($ COP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-normal">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 font-normal">
                      No hay insumos registrados en esta sesión de conteo.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      {/* Insumo */}
                      <td className="p-1.5 border-r border-slate-200 font-medium text-slate-900 whitespace-nowrap">
                        {item.nombre}
                        {item.isUnd ? (
                          <span className="text-[8px] text-purple-600 block">UNIDADES</span>
                        ) : (
                          item.pesoPorcGramos > 0 && (
                            <span className="text-[8.5px] text-slate-400 block">{item.pesoPorcGramos}g / porción</span>
                          )
                        )}
                      </td>

                      {/* Ubicación */}
                      <td className="p-1.5 text-center border-r border-slate-200 font-medium whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-semibold border ${
                          item.ubicacion === 'BODEGA'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {item.ubicacion}
                        </span>
                      </td>

                      {/* Conteo Entero */}
                      <td className="p-1.5 text-center border-r border-slate-200 font-medium text-blue-700 whitespace-nowrap">
                        {item.isUnd ? (
                          <span className="text-slate-300">-</span>
                        ) : item.cantEnteroKg > 0 ? (
                          `${item.cantEnteroKg.toFixed(2)} Kg`
                        ) : (
                          <span className="text-slate-300">0.00</span>
                        )}
                      </td>

                      {/* Conteo Porcionado */}
                      <td className="p-1.5 text-center border-r border-slate-200 font-medium text-purple-700 whitespace-nowrap">
                        {item.isUnd ? (
                          <span>{item.porcUnd} und</span>
                        ) : item.porcUnd > 0 ? (
                          <span>{item.porcUnd} und <small className="text-slate-400">({item.pesoPorcKg.toFixed(2)}k)</small></span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Total Físico */}
                      <td className="p-1.5 text-center border-r border-slate-200 font-bold text-slate-900 bg-blue-50/30 whitespace-nowrap">
                        {item.isUnd ? `${item.porcUnd} und` : `${item.totalKg.toFixed(2)} Kg`}
                      </td>

                      {/* Costo Unitario */}
                      <td className="p-1.5 text-center border-r border-slate-200 whitespace-nowrap font-medium text-slate-700">
                        ${formatMoney(item.costoUnit)}
                        <small className="text-slate-400 block text-[8px]">{item.isUnd ? '/ und' : '/ Kg'}</small>
                      </td>

                      {/* Valor Total Conteo */}
                      <td className="p-1.5 text-right font-bold bg-slate-50 text-slate-900 whitespace-nowrap">
                        ${formatMoney(item.valorTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer de Firmas para Auditoría Física */}
          <div className="pt-6 grid grid-cols-2 gap-12 text-center text-[11px] text-slate-600 print:grid hidden">
            <div className="border-t border-slate-400 pt-2">
              <p className="font-semibold text-slate-900">Responsable de Bodega</p>
              <p className="text-[9px] text-slate-400">Firma y Cédula</p>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <p className="font-semibold text-slate-900">Auditor / Administración</p>
              <p className="text-[9px] text-slate-400">Firma y Cédula</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
