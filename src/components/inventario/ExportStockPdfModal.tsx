import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, FileText, Download, FileSpreadsheet, ExternalLink, Calendar, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';
import { InsumoItem } from '@/types';
import * as XLSX from 'xlsx';
import { generateInventoryPdf } from '@/lib/exportInventoryPdf';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  insumos: InsumoItem[];
  periodoNombre?: string;
  cutoffInfo?: string;
  cutoffMode?: 'ACTUAL' | 'INICIAL' | 'FECHA' | 'CONTEO';
  selectedDate?: string;
  selectedConteoId?: string;
  periodoId?: string;
  fechaInicio?: string;
  fechaFin?: string;
  fechasConMovimientos?: string[];
  conteosAplicados?: any[];
  onSelectCutoff?: (mode: 'ACTUAL' | 'INICIAL' | 'FECHA' | 'CONTEO', date?: string, conteoId?: string) => void;
}

export default function ExportStockPdfModal({
  isOpen,
  onClose,
  insumos,
  periodoNombre = 'Periodo Actual',
  cutoffMode = 'ACTUAL',
  selectedDate,
  selectedConteoId,
  periodoId,
  fechaInicio,
  fechaFin,
  fechasConMovimientos = [],
  conteosAplicados = [],
  onSelectCutoff
}: Props) {
  const [filterType, setFilterType] = useState<'WITH_STOCK' | 'ALL' | 'CARNES'>('WITH_STOCK');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(999);
  const [page, setPage] = useState(1);

  // Determinar valor inicial del corte seleccionado
  const computeInitialKey = () => {
    if (cutoffMode === 'INICIAL') return 'INICIAL';
    if (cutoffMode === 'CONTEO' && selectedConteoId) return `CONTEO_${selectedConteoId}`;
    if (cutoffMode === 'FECHA' && selectedDate) return `FECHA_${selectedDate}`;
    return 'ACTUAL';
  };

  const [selectedCutoffKey, setSelectedCutoffKey] = useState<string>(computeInitialKey());
  const [activeInsumos, setActiveInsumos] = useState<InsumoItem[]>(insumos);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const prevOpenRef = useRef<boolean>(false);

  // Inicializar SOLO cuando se abre el modal, evitando reescrituras involuntarias
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setSelectedCutoffKey(computeInitialKey());
      setActiveInsumos(insumos);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // Si insumos cambian externamente y el corte actual coincide, actualizar lista base
  useEffect(() => {
    if (!isRecalculating && isOpen) {
      setActiveInsumos(insumos);
    }
  }, [insumos]);

  // Obtener etiqueta legible del corte actual
  const currentCutoffLabel = useMemo(() => {
    if (selectedCutoffKey === 'ACTUAL') return 'En Vivo (Actual)';
    if (selectedCutoffKey === 'INICIAL') return `Inventario Inicial (${fechaInicio || 'Arranque'})`;
    if (selectedCutoffKey.startsWith('FECHA_')) {
      const d = selectedCutoffKey.replace('FECHA_', '');
      return `Jornada ${d}`;
    }
    if (selectedCutoffKey.startsWith('CONTEO_')) {
      const cId = selectedCutoffKey.replace('CONTEO_', '');
      const c = conteosAplicados.find((item: any) => item.id === cId);
      return c ? `Conteo Físico ${c.fecha} (${c.usuario || 'Bodega'})` : 'Conteo Físico';
    }
    return 'En Vivo (Actual)';
  }, [selectedCutoffKey, fechaInicio, conteosAplicados]);

  // Manejar cambio de corte (Jornadas, Conteos, Inicial, Actual)
  const handleCutoffChange = async (key: string) => {
    setSelectedCutoffKey(key);

    let mode: 'ACTUAL' | 'INICIAL' | 'FECHA' | 'CONTEO' = 'ACTUAL';
    let dateParam: string | undefined = undefined;
    let conteoIdParam: string | undefined = undefined;
    let cutoffQueryParam = '&fecha_corte=ACTUAL';

    if (key === 'INICIAL') {
      mode = 'INICIAL';
      dateParam = fechaInicio;
      cutoffQueryParam = '&fecha_corte=INICIAL';
    } else if (key === 'ACTUAL') {
      mode = 'ACTUAL';
      cutoffQueryParam = '&fecha_corte=ACTUAL';
    } else if (key.startsWith('FECHA_')) {
      mode = 'FECHA';
      dateParam = key.replace('FECHA_', '');
      cutoffQueryParam = `&fecha_corte=${dateParam}`;
    } else if (key.startsWith('CONTEO_')) {
      mode = 'CONTEO';
      conteoIdParam = key.replace('CONTEO_', '');
      const foundConteo = conteosAplicados.find((c: any) => c.id === conteoIdParam);
      if (foundConteo) dateParam = foundConteo.fecha;
      cutoffQueryParam = `&fecha_corte=CONTEO_${conteoIdParam}`;
    }

    try {
      setIsRecalculating(true);
      const ts = Date.now();
      const pParam = periodoId ? `&periodo_id=${periodoId}` : '';

      const [stockRes, periodRes] = await Promise.all([
        fetch(`/api/bodega/stock?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/periodos?t=${ts}${pParam}${cutoffQueryParam}`, { cache: 'no-store' }),
      ]);

      const sData = await stockRes.json();
      const pData = await periodRes.json();

      let base: InsumoItem[] = sData.data || [];

      if (pData.success && Array.isArray(pData.stock)) {
        const pMap = new Map<string, any>();
        pData.stock.forEach((s: any) => pMap.set(String(s.insumo_id), s));

        base = base.map((item: any) => {
          const s = pMap.get(String(item.insumo_id));
          const tipoMedida = item.tipo_medida || s?.tipo_medida || 'KGS_Y_UNIDADES';
          const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';

          if (!s) {
            const bTotal = (parseFloat(item.bodega_sin_porc_kg) || 0) + (parseFloat(item.bodega_porc_kg) || 0);
            const vBodega = item.valor_total_bodega_pesos != null 
              ? Math.round(item.valor_total_bodega_pesos)
              : (isContable 
                  ? Math.round((parseInt(item.bodega_porc_und) || 0) * (item.costo_unitario_kg || 0))
                  : Math.round(bTotal * (item.costo_unitario_kg || 0)));
            return {
              ...item,
              tipo_medida: tipoMedida,
              valor_total_bodega_pesos: vBodega,
              cocina_dia_und: 0,
              cocina_dia_kg: 0,
              costo_cocina_dia: 0,
            };
          }

          const bSinPorc = parseFloat(s.bodega_sin_porcionar_kg ?? item.bodega_sin_porc_kg) || 0;
          const bPorcUnd = parseInt(s.bodega_porcionado_und ?? item.bodega_porc_und) || 0;
          const bPorcKg = parseFloat(s.bodega_porcionado_kg ?? item.bodega_porc_kg) || 0;
          const totalBodegaKg = isContable ? 0 : (bSinPorc + bPorcKg);
          const valorTotalBodega = s.valor_total_bodega_pesos != null 
            ? Math.round(s.valor_total_bodega_pesos) 
            : (isContable 
                ? Math.round(bPorcUnd * (item.costo_unitario_kg || 0))
                : Math.round(totalBodegaKg * (item.costo_unitario_kg || 0)));

          const cSinPorc = parseFloat(s.cocina_sin_porcionar_kg ?? item.cocina_sin_porc_kg) || 0;
          const cPorcUnd = parseInt(s.cocina_porcionado_und ?? item.cocina_porc_und) || 0;
          const cPorcKg = parseFloat(s.cocina_porcionado_kg ?? item.cocina_porc_kg) || 0;
          const totalCocinaKg = isContable ? 0 : (cSinPorc + cPorcKg);

          const cocinaDiaUnd = s.cocina_dia_und !== undefined ? s.cocina_dia_und : cPorcUnd;
          const cocinaDiaKg = s.cocina_dia_kg !== undefined ? s.cocina_dia_kg : totalCocinaKg;
          const costoCocinaDia = s.costo_cocina_dia !== undefined 
            ? Math.round(s.costo_cocina_dia) 
            : (s.valor_total_cocina_pesos != null ? Math.round(s.valor_total_cocina_pesos) : 0);

          return {
            ...item,
            tipo_medida: tipoMedida,
            costo_unitario_kg: s.costo_unitario_kg ?? item.costo_unitario_kg,
            bodega_sin_porc_kg: bSinPorc,
            bodega_porc_und: bPorcUnd,
            bodega_porc_kg: bPorcKg,
            peso_total_bodega_kg: totalBodegaKg,
            cocina_sin_porc_kg: cSinPorc,
            cocina_porc_und: cocinaDiaUnd,
            cocina_porc_kg: cPorcKg,
            peso_total_cocina_kg: cocinaDiaKg,
            valor_total_bodega_pesos: valorTotalBodega,
            cocina_dia_und: cocinaDiaUnd,
            cocina_dia_kg: cocinaDiaKg,
            costo_cocina_dia: costoCocinaDia,
          };
        });
      }

      setActiveInsumos(base);

      // Notificar a la vista principal
      if (onSelectCutoff) {
        onSelectCutoff(mode, dateParam, conteoIdParam);
      }
    } catch (e) {
      console.error('Error calculando inventario para el corte:', e);
    } finally {
      setIsRecalculating(false);
    }
  };

  const filteredInsumos = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);

    return activeInsumos.filter((item) => {
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
  }, [activeInsumos, filterType, searchQuery]);

  // Totales del resumen filtrado
  const summary = useMemo(() => {
    let tBodegaKg = 0;
    let tBodegaUnd = 0;
    let tCocinaDiaKg = 0;
    let tCocinaDiaUnd = 0;
    let tCostoCocinaDia = 0;
    let tValorBodega = 0;

    filteredInsumos.forEach((item) => {
      const tipoMedida = item.tipo_medida || 'KGS_Y_UNIDADES';
      const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';
      const totalUnitsBodega = isContable ? (item.bodega_porc_und || item.bodega_sin_porc_kg || 0) : (item.bodega_porc_und || 0);
      const vBodega = isContable 
        ? (totalUnitsBodega * (item.costo_unitario_kg || 0))
        : (item.valor_total_bodega_pesos ?? Math.round((item.peso_total_bodega_kg || 0) * (item.costo_unitario_kg || 0)));
      
      if (isContable) {
        tBodegaUnd += totalUnitsBodega;
      } else {
        tBodegaKg += (item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0);
        tBodegaUnd += item.bodega_porc_und || 0;
      }
      tCocinaDiaKg += item.cocina_dia_kg || 0;
      tCocinaDiaUnd += item.cocina_dia_und || 0;
      tCostoCocinaDia += item.costo_cocina_dia || 0;
      tValorBodega += vBodega || 0;
    });

    return {
      tBodegaKg,
      tBodegaUnd,
      tCocinaDiaKg,
      tCocinaDiaUnd,
      tCostoCocinaDia,
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

  // Exportar Excel oficial dinámico con el corte seleccionado
  const exportToExcel = () => {
    const rows = filteredInsumos.map((item, idx) => {
      const tipoMedida = item.tipo_medida || 'KGS_Y_UNIDADES';
      const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';
      const isPaquetes = tipoMedida === 'PAQUETES';
      const isKgsOnly = tipoMedida === 'KGS';
      const bSin = isContable ? '-' : (item.bodega_sin_porc_kg || 0);
      const bUnd = isContable ? (item.bodega_porc_und || item.bodega_sin_porc_kg || 0) : (item.bodega_porc_und || 0);
      const bPkg = isContable || isKgsOnly ? '-' : (item.bodega_porc_kg || 0);
      const totB = isContable ? 0 : ((item.bodega_sin_porc_kg || 0) + (item.bodega_porc_kg || 0));
      const uCost = item.costo_unitario_kg || 0;
      const vTotal = isContable ? (bUnd * uCost) : Math.round(totB * uCost);

      return {
        '#': idx + 1,
        'Carne / Insumo': item.insumo,
        'Categoría': item.categoria,
        'Tipo Medida': isPaquetes ? 'PAQUETES' : isContable ? 'UNIDADES' : isKgsOnly ? 'KGS' : 'KGS Y UND',
        'Bodega Entero (Kg)': bSin,
        'Bodega Porcionado / Unidades': isKgsOnly ? '-' : bUnd,
        'Bodega Porcionado (Kg)': bPkg,
        'Total Bodega': isContable ? `${bUnd} ${isPaquetes ? 'paq' : 'und'}` : `${totB.toFixed(2)} Kg`,
        [`Cocina (${currentCutoffLabel})`]: isKgsOnly 
          ? (item.cocina_dia_kg ? `${item.cocina_dia_kg.toFixed(2)} Kg` : '-')
          : isContable 
            ? (item.cocina_dia_und ? `${item.cocina_dia_und} ${isPaquetes ? 'paq' : 'und'}` : '-')
            : ((item.cocina_dia_und || 0) > 0 || (item.cocina_dia_kg || 0) > 0)
              ? `${item.cocina_dia_und || 0} und (${(item.cocina_dia_kg || 0).toFixed(2)}k)`
              : '-',
        'Costo en Cocina ($)': item.costo_cocina_dia || 0,
        'Costo Unitario ($)': uCost,
        'Valor Inventario Bodega ($)': vTotal
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 12 },
      { wch: 18 }, { wch: 24 }, { wch: 20 }, { wch: 18 },
      { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 22 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'INVENTARIO_OFICIAL');
    const cleanFilename = currentCutoffLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `REPORTE_OFICIAL_INVENTARIO_LA_FINCA_${cleanFilename}.xlsx`);
  };

  // Descargar PDF generado dinámicamente para el corte exacto
  const handleDownloadPdf = () => {
    const doc = generateInventoryPdf({
      insumos: filteredInsumos,
      periodoNombre,
      reportDate: currentCutoffLabel,
      summary,
      filterLabel: filterType === 'WITH_STOCK' ? 'Con Existencias Bodega (>0)' : filterType === 'CARNES' ? 'Solo Carnes' : 'Todos'
    });
    const cleanFilename = currentCutoffLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`REPORTE_OFICIAL_INVENTARIO_LA_FINCA_${cleanFilename}.pdf`);
  };

  // Ver PDF en nueva pestaña generado dinámicamente
  const handleViewPdf = () => {
    const doc = generateInventoryPdf({
      insumos: filteredInsumos,
      periodoNombre,
      reportDate: currentCutoffLabel,
      summary,
      filterLabel: filterType === 'WITH_STOCK' ? 'Con Existencias Bodega (>0)' : filterType === 'CARNES' ? 'Solo Carnes' : 'Todos'
    });
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reporte Oficial de Inventario y Existencias"
      icon={<FileText className="w-5 h-5 text-blue-600" />}
      maxWidth="max-w-6xl"
    >
      <div className="space-y-3 text-xs font-normal">
        {/* Barra Superior de Filtros y Selector de Jornada / Corte */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtros rápidos de insumos */}
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
                Todos ({activeInsumos.length})
              </button>
            </div>

            {/* Selector de Corte / Jornada / Conteo / Inicial (Sin datepicker libre) */}
            <div className="flex items-center gap-1.5 bg-white border border-blue-300 rounded-lg px-2.5 py-1 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">Corte / Jornada:</span>
              <select
                value={selectedCutoffKey}
                onChange={(e) => handleCutoffChange(e.target.value)}
                className="text-xs font-bold text-blue-900 bg-transparent outline-none cursor-pointer pr-1"
                title="Selecciona la jornada, conteo físico o corte inicial del reporte"
              >
                <option value="ACTUAL">🟢 En Vivo (Inventario Actual)</option>
                <option value="INICIAL">📦 Inventario Inicial ({fechaInicio || 'Arranque'})</option>

                {fechasConMovimientos.length > 0 && (
                  <optgroup label="📅 Jornadas con Movimientos">
                    {fechasConMovimientos.map((f) => (
                      <option key={f} value={`FECHA_${f}`}>
                        Jornada {f}
                      </option>
                    ))}
                  </optgroup>
                )}

                {conteosAplicados.length > 0 && (
                  <optgroup label="📋 Conteos Físicos Aplicados">
                    {conteosAplicados.map((c: any) => (
                      <option key={c.id} value={`CONTEO_${c.id}`}>
                        Conteo {c.fecha} ({c.usuario || 'Bodega'})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {isRecalculating && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500 shrink-0" />
              )}
            </div>

            {/* Buscador Rápido */}
            <div className="relative w-36 sm:w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Buscar carne..."
                className="w-full h-7 pl-7 pr-2.5 text-[11px] rounded-lg border border-slate-300 outline-none focus:border-orange-500 bg-white"
              />
            </div>
          </div>

          {/* Controles de Descarga Dinámicos */}
          <div className="flex items-center gap-2 flex-wrap">
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

            {/* Botón 1: Descarga Instantánea PDF Oficial */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title={`Descargar PDF oficial de ${currentCutoffLabel}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PDF (Instantáneo)</span>
            </button>

            {/* Botón 2: Ver PDF en Nueva Pestaña */}
            <button
              type="button"
              onClick={handleViewPdf}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title={`Ver PDF de ${currentCutoffLabel} en nueva pestaña`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver PDF</span>
            </button>

            {/* Botón 3: Exportar Excel */}
            <button
              type="button"
              onClick={exportToExcel}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title={`Exportar listado de ${currentCutoffLabel} a Excel`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Hoja Imprimible / Vista Previa Oficial */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-3 text-slate-900 shadow-sm">
          {/* Header del Reporte con Fechas Destacadas */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2.5">
            <div>
              <h1 className="text-base font-bold uppercase tracking-wide text-slate-950">
                RESTAURANTE LA FINCA CHOCLOS Y ASADOS
              </h1>
              <h2 className="text-xs font-semibold text-slate-700 uppercase mt-0.5">
                Reporte de Control de Existencias e Inventario Físico
              </h2>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600 flex-wrap">
                <span>Periodo: <strong className="text-slate-900">{periodoNombre}</strong></span>
                <span>•</span>
                <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-blue-900 font-bold">
                  📅 Corte / Jornada: {currentCutoffLabel}
                </span>
                <span>•</span>
                <span>Items listados: <strong className="text-slate-900">{filteredInsumos.length}</strong></span>
              </div>
            </div>

            <div className="text-right text-[10px] space-y-0.5">
              <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 inline-block">
                ESTADO: VIGENTE
              </span>
              <div className="text-slate-500">
                Fecha emisión: {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Resumen Ejecutivo */}
          <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
            <div className="bg-slate-900 text-white p-2 rounded-md">
              <span className="text-[9px] text-amber-300 font-medium uppercase block">Valor Inventario en Bodega</span>
              <span className="text-sm font-bold text-amber-400">$ {formatMoney(summary.tValorBodega)}</span>
              <span className="text-[9px] text-slate-300 block">
                {summary.tBodegaKg > 0 ? `${summary.tBodegaKg.toFixed(2)} Kg` : ''} {summary.tBodegaUnd > 0 ? `(${summary.tBodegaUnd} und)` : ''}
              </span>
            </div>
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded-md">
              <span className="text-[9px] text-amber-700 font-medium uppercase block">
                Valor Insumos en Cocina ({currentCutoffLabel})
              </span>
              <span className="text-sm font-bold text-amber-700">$ {formatMoney(summary.tCostoCocinaDia)}</span>
              <span className="text-[9px] text-amber-600 block">Entregas netas despachadas a cocina en este corte</span>
            </div>
          </div>

          {/* Tabla de Insumos */}
          <div className="border border-slate-300 rounded-lg overflow-x-auto max-h-[50vh] overflow-y-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm text-slate-800 font-bold uppercase text-[9px] border-b border-slate-300 shadow-2xs">
                <tr>
                  <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Carne / Insumo</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Bodega Entero (Kg)</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Bodega Porc. (Und / Kg)</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap font-bold bg-blue-50/70">Total Bodega</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap bg-amber-50/80">
                    Cocina ({currentCutoffLabel})
                  </th>
                  <th className="p-1.5 text-right border-r border-slate-300 whitespace-nowrap text-amber-800 bg-amber-50/50">Costo en Cocina</th>
                  <th className="p-1.5 text-center border-r border-slate-300 whitespace-nowrap">Costo Unitario</th>
                  <th className="p-1.5 text-right bg-slate-200 whitespace-nowrap font-bold">Valor Inventario (Bodega)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-normal">
                {isRecalculating ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-normal">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        <span>Calculando existencias y costos para {currentCutoffLabel}...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-normal">
                      No se encontraron insumos para exportar.
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((item) => {
                    const tipoMedida = item.tipo_medida || 'KGS_Y_UNIDADES';
                    const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';
                    const isPaquetes = tipoMedida === 'PAQUETES';
                    const isKgsOnly = tipoMedida === 'KGS';
                    const unitLabel = isPaquetes ? 'paq' : 'und';

                    const totalUnitsBodega = isContable ? (item.bodega_porc_und || item.bodega_sin_porc_kg || 0) : (item.bodega_porc_und || 0);
                    const valorBodega = isContable 
                      ? (totalUnitsBodega * (item.costo_unitario_kg || 0))
                      : (item.valor_total_bodega_pesos ?? Math.round((item.peso_total_bodega_kg || 0) * (item.costo_unitario_kg || 0)));
                    const cocinaUnd = item.cocina_dia_und || 0;
                    const cocinaKg = item.cocina_dia_kg || 0;

                    return (
                      <tr key={item.insumo_id} className="hover:bg-slate-50/50">
                        {/* Carne */}
                        <td className="p-1.5 border-r border-slate-200 font-medium text-slate-900 whitespace-nowrap">
                          {item.insumo}
                          <span className="text-[8px] text-slate-500 block uppercase font-semibold">
                            {isPaquetes ? 'PAQUETES' : isContable ? 'UNIDADES' : isKgsOnly ? 'KILOS' : (item.peso_porc_gramos > 0 ? `${item.peso_porc_gramos}g / porc` : 'KGS Y UND')}
                          </span>
                        </td>

                        {/* Bodega Entero */}
                        <td className="p-1.5 text-center border-r border-slate-200 font-medium text-blue-700 whitespace-nowrap">
                          {isContable ? (
                            <span className="text-slate-300">-</span>
                          ) : item.bodega_sin_porc_kg > 0 ? (
                            `${item.bodega_sin_porc_kg.toFixed(2)} Kg`
                          ) : (
                            <span className="text-slate-300">0.00</span>
                          )}
                        </td>

                        {/* Bodega Porcionado */}
                        <td className="p-1.5 text-center border-r border-slate-200 font-medium text-purple-700 whitespace-nowrap">
                          {isKgsOnly ? (
                            <span className="text-slate-300">-</span>
                          ) : isContable ? (
                            <span>{totalUnitsBodega} {unitLabel}</span>
                          ) : item.bodega_porc_und > 0 ? (
                            <span>{item.bodega_porc_und} und <small className="text-slate-400">({item.bodega_porc_kg.toFixed(2)}k)</small></span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Total Bodega */}
                        <td className="p-1.5 text-center border-r border-slate-200 font-bold text-slate-900 bg-blue-50/30 whitespace-nowrap">
                          {isContable ? `${totalUnitsBodega} ${unitLabel}` : `${item.peso_total_bodega_kg.toFixed(2)} Kg`}
                        </td>

                        {/* Cocina (Día) */}
                        <td className="p-1.5 text-center border-r border-slate-200 font-medium text-amber-900 bg-amber-50/40 whitespace-nowrap">
                          {isKgsOnly ? (
                            cocinaKg > 0 ? <span>{cocinaKg.toFixed(2)} Kg</span> : <span className="text-slate-300">0</span>
                          ) : isContable ? (
                            cocinaUnd > 0 ? <span>{cocinaUnd} {unitLabel}</span> : <span className="text-slate-300">0</span>
                          ) : (cocinaUnd > 0 || cocinaKg > 0) ? (
                            <span>{cocinaUnd} und <small className="text-amber-700">({cocinaKg.toFixed(2)}k)</small></span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Costo en Cocina */}
                        <td className="p-1.5 text-right border-r border-slate-200 font-semibold text-amber-900 bg-amber-50/20 whitespace-nowrap">
                          {(item.costo_cocina_dia || 0) > 0 ? `$${formatMoney(item.costo_cocina_dia || 0)}` : <span className="text-slate-300">$0</span>}
                        </td>

                        {/* Costo Unitario */}
                        <td className="p-1.5 text-center border-r border-slate-200 whitespace-nowrap">
                          ${formatMoney(item.costo_unitario_kg)}
                          <small className="text-slate-400 block text-[8px]">{isPaquetes ? '/ paq' : isContable ? '/ und' : '/ Kg'}</small>
                        </td>

                        {/* Valor Inventario Bodega */}
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
          <div className="pt-6 grid grid-cols-2 gap-12 text-center text-[11px] text-slate-600">
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
