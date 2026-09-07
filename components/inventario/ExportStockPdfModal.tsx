'use client';

import { useState, useMemo } from 'react';
import { Printer, Search, FileText, CheckCircle2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';
import { InsumoItem } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  insumos: InsumoItem[];
  periodoNombre?: string;
  cutoffInfo?: string;
}

export default function ExportStockPdfModal({
  isOpen,
  onClose,
  insumos,
  periodoNombre = 'Periodo Actual',
  cutoffInfo = 'Inventario Actual en Vivo'
}: Props) {
  const [filterType, setFilterType] = useState<'WITH_STOCK' | 'ALL' | 'CARNES'>('WITH_STOCK');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(999);
  const [page, setPage] = useState(1);

  const filteredInsumos = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);

    return insumos.filter((item) => {
      // 1. Filtro de tipo
      if (filterType === 'WITH_STOCK') {
        const totalBodega = (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0);
        if (totalBodega <= 0 && (item.bodega_porc_und || 0) <= 0) return false;
      } else if (filterType === 'CARNES') {
        if (item.es_carne === false) return false;
      }

      // 2. Buscador
      if (!cleanSearch) return true;
      const name = normalizeStr(item.insumo || '');
      const cat = normalizeStr(item.categoria || '');
      return name.includes(cleanSearch) || cat.includes(cleanSearch);
    });
  }, [insumos, filterType, searchQuery]);

  // Totales del resumen filtrado
  const summary = useMemo(() => {
    let tBodegaKg = 0;
    let tBodegaUnd = 0;
    let tAcumCocinaKg = 0;
    let tAcumCocinaUnd = 0;
    let tMermaKg = 0;
    let tValorBodega = 0;

    filteredInsumos.forEach((item) => {
      const isUnd = item.unidad_medida?.toLowerCase() === 'und' || 
                    item.categoria?.toLowerCase().includes('embutido') || 
                    item.categoria?.toLowerCase().includes('elaborado') || 
                    item.insumo?.toLowerCase().includes('chorizo') || 
                    item.insumo?.toLowerCase().includes('tamal');
      const totalUnitsBodega = (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_und || 0);
      const vBodega = isUnd 
        ? (totalUnitsBodega * (item.costo_unitario_kg || 0))
        : (item.valor_total_bodega_pesos ?? Math.round((item.peso_total_bodega_kg || 0) * (item.costo_unitario_kg || 0)));
      
      if (isUnd) {
        tBodegaUnd += totalUnitsBodega;
      } else {
        tBodegaKg += (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0);
        tBodegaUnd += item.bodega_porc_und || 0;
      }
      tAcumCocinaKg += item.traslado_cocina_acumulado_kg || 0;
      tAcumCocinaUnd += item.traslado_cocina_acumulado_und || 0;
      tMermaKg += item.merma_acumulada_kg || 0;
      tValorBodega += vBodega || 0;
    });

    return {
      tBodegaKg,
      tBodegaUnd,
      tAcumCocinaKg,
      tAcumCocinaUnd,
      tMermaKg,
      tValorBodega
    };
  }, [filteredInsumos]);

  // Paginación
  const totalPages = Math.ceil(filteredInsumos.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    if (pageSize >= 999) return filteredInsumos;
    const start = (page - 1) * pageSize;
    return filteredInsumos.slice(start, start + pageSize);
  }, [filteredInsumos, page, pageSize]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reporte Oficial de Inventario y Existencias"
      icon={<Printer className="w-5 h-5 text-blue-600" />}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-3 text-xs font-normal">
        {/* Estilo CSS especial para impresión en hoja horizontal limpia */}
        <style jsx global>{`
          @media print {
            @page {
              size: landscape;
              margin: 8mm;
            }
            body {
              background: white !important;
              color: black !important;
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
                onClick={() => { setFilterType('WITH_STOCK'); setPage(1); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filterType === 'WITH_STOCK'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🥩 Con Existencias Bodega (&gt;0)
              </button>
              <button
                type="button"
                onClick={() => { setFilterType('CARNES'); setPage(1); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filterType === 'CARNES'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Solo Carnes
              </button>
              <button
                type="button"
                onClick={() => { setFilterType('ALL'); setPage(1); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filterType === 'ALL'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({insumos.length})
              </button>
            </div>

            {/* Buscador Rápido */}
            <div className="relative w-40 sm:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Buscar carne en acta..."
                className="w-full h-7 pl-7 pr-2.5 text-[11px] rounded-lg border border-slate-300 outline-none focus:border-orange-500 bg-white"
              />
            </div>
          </div>

          {/* Controles de Vista e Imprimir */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span>Ver:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="h-7 px-1.5 rounded border border-slate-300 bg-white text-slate-800 text-[11px] outline-none cursor-pointer"
              >
                <option value={15}>15 por pág.</option>
                <option value={30}>30 por pág.</option>
                <option value={999}>Todos ({filteredInsumos.length})</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Guardar PDF</span>
            </button>
          </div>
        </div>

        {/* Hoja Imprimible Oficial */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-3 text-slate-900 shadow-sm print:border-none print:p-0">
          {/* Header del Acta */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2.5">
            <div>
              <h1 className="text-base font-bold uppercase tracking-wide text-slate-950">
                RESTAURANTE LA FINCA CHOCLOS Y ASADOS
              </h1>
              <h2 className="text-xs font-semibold text-slate-700 uppercase mt-0.5">
                Reporte de Control de Existencias e Inventario Físico
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Periodo: <strong>{periodoNombre}</strong> • Modo: <strong>{cutoffInfo}</strong> • Items listados: <strong>{filteredInsumos.length}</strong>
              </p>
            </div>

            <div className="text-right text-[10px] space-y-0.5">
              <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 border border-slate-300 text-slate-800 inline-block">
                ESTADO: VIGENTE
              </span>
              <div className="text-slate-500">
                Fecha emisión: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Resumen Ejecutivo */}
          <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
            <div>
              <span className="text-[9px] text-slate-500 font-medium uppercase block">Total en Bodega</span>
              <span className="text-xs font-bold text-slate-900">{summary.tBodegaKg.toFixed(2)} Kg</span>
              <span className="text-[9px] text-purple-700 block">({summary.tBodegaUnd} porciones)</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 font-medium uppercase block">Acumulado Despachado a Cocina</span>
              <span className="text-xs font-bold text-amber-800">{summary.tAcumCocinaKg.toFixed(2)} Kg</span>
              <span className="text-[9px] text-amber-700 block">({summary.tAcumCocinaUnd} porciones)</span>
            </div>
            <div className="bg-slate-900 text-white p-1 rounded-md">
              <span className="text-[9px] text-amber-300 font-medium uppercase block">Valor Total Stock Bodega</span>
              <span className="text-xs font-bold text-amber-400">$ {formatMoney(summary.tValorBodega)}</span>
              <span className="text-[9px] text-slate-300 block">(Kilogramos Custodiados en Bodega)</span>
            </div>
          </div>

          {/* Tabla de Insumos */}
          <div className="border border-slate-300 rounded-lg overflow-x-auto max-h-[50vh] overflow-y-auto print:max-h-none print:overflow-visible">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm text-slate-800 font-bold uppercase text-[9px] border-b border-slate-300 shadow-2xs">
                <tr>
                  <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Carne / Insumo</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Bodega Entero (Kg)</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Bodega Porc. (Und / Kg)</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap font-bold bg-blue-50/70">Total Bodega (Kg)</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap bg-amber-50/80">Acumulado Cocina</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap text-rose-700">Merma Acum.</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Costo / Kg</th>
                  <th className="p-1.5 text-right bg-slate-200 whitespace-nowrap font-bold">Valor Stock Bodega</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-normal">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-normal">
                      No se encontraron insumos para exportar.
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((item) => {
                    const isUnd = item.unidad_medida?.toLowerCase() === 'und' || 
                                  item.categoria?.toLowerCase().includes('embutido') || 
                                  item.categoria?.toLowerCase().includes('elaborado') || 
                                  item.insumo?.toLowerCase().includes('chorizo') || 
                                  item.insumo?.toLowerCase().includes('tamal');
                    const totalUnitsBodega = (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_und || 0);
                    const valorBodega = isUnd 
                      ? (totalUnitsBodega * (item.costo_unitario_kg || 0))
                      : (item.valor_total_bodega_pesos ?? Math.round((item.peso_total_bodega_kg || 0) * (item.costo_unitario_kg || 0)));
                    const acumUnd = item.traslado_cocina_acumulado_und || 0;
                    const acumKg = item.traslado_cocina_acumulado_kg || 0;

                    return (
                      <tr key={item.insumo_id} className="hover:bg-slate-50/50">
                        {/* Carne */}
                        <td className="p-1.5 border-r border-slate-200 font-medium text-slate-900 whitespace-nowrap">
                          {item.insumo}
                          {isUnd ? (
                            <span className="text-[8px] text-purple-600 block">UNIDADES</span>
                          ) : (
                            item.peso_porc_gramos > 0 && (
                              <span className="text-[8.5px] text-slate-400 block">{item.peso_porc_gramos}g / porción</span>
                            )
                          )}
                        </td>

                        {/* Bodega Entero */}
                        <td className="p-1.5 text-center border-r border-slate-200 font-medium text-blue-700 whitespace-nowrap">
                          {isUnd ? (
                            <span className="text-slate-300">-</span>
                          ) : item.bodega_sin_porc_kg > 0 ? (
                            `${item.bodega_sin_porc_kg.toFixed(2)} Kg`
                          ) : (
                            <span className="text-slate-300">0.00</span>
                          )}
                        </td>

                        {/* Bodega Porcionado */}
                        <td className="p-1.5 text-center border-r border-slate-200 font-medium text-purple-700 whitespace-nowrap">
                          {isUnd ? (
                            <span>{totalUnitsBodega} und</span>
                          ) : item.bodega_porc_und > 0 ? (
                            <span>{item.bodega_porc_und} und <small className="text-slate-400">({item.bodega_porc_kg.toFixed(2)}k)</small></span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Total Bodega */}
                        <td className="p-1.5 text-center border-r border-slate-200 font-bold text-slate-900 bg-blue-50/30 whitespace-nowrap">
                          {isUnd ? `${totalUnitsBodega} und` : `${item.peso_total_bodega_kg.toFixed(2)} Kg`}
                        </td>

                        {/* Acumulado Cocina */}
                        <td className="p-1.5 text-center border-r border-slate-200 font-medium text-amber-900 bg-amber-50/40 whitespace-nowrap">
                          {acumUnd > 0 || acumKg > 0 ? (
                            isUnd ? (
                              <span>{acumUnd} und</span>
                            ) : (
                              <span>{acumUnd} und <small className="text-amber-700">({acumKg.toFixed(2)}k)</small></span>
                            )
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Merma */}
                        <td className="p-1.5 text-center border-r border-slate-200 text-rose-600 font-medium whitespace-nowrap">
                          {isUnd ? (
                            <span className="text-slate-300">-</span>
                          ) : item.merma_acumulada_kg > 0 ? (
                            `${item.merma_acumulada_kg.toFixed(2)} Kg`
                          ) : (
                            <span className="text-slate-300">0.00</span>
                          )}
                        </td>

                        {/* Costo Unitario */}
                        <td className="p-1.5 text-center border-r border-slate-200 whitespace-nowrap">
                          ${formatMoney(item.costo_unitario_kg)}
                          <small className="text-slate-400 block text-[8px]">{isUnd ? '/ und' : '/ Kg'}</small>
                        </td>

                        {/* Valor Bodega */}
                        <td className="p-1.5 text-right font-bold bg-slate-50 text-slate-900 whitespace-nowrap">
                          ${formatMoney(valorBodega)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer de Firmas para Auditoría */}
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
