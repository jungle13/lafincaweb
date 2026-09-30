'use client';

import { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  FileSpreadsheet, 
  Search, 
  Beef, 
  Layers, 
  CheckCircle2, 
  Filter
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';
import { CatalogoInsumo } from '@/app/catalogo/page';
import { generateCatalogoPdf } from '@/lib/exportCatalogoPdf';
import * as XLSX from 'xlsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  insumos: CatalogoInsumo[];
  initialCategory?: string;
  initialSearch?: string;
}

export default function ExportCatalogoPdfModal({
  isOpen,
  onClose,
  insumos,
  initialCategory = 'ALL',
  initialSearch = '',
}: Props) {
  const [filterType, setFilterType] = useState<'ALL' | 'CARNES' | 'CURRENT'>('CURRENT');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCat, setSelectedCat] = useState<string>(initialCategory);

  // Categorías presentes en la lista
  const categoriasPresentes = useMemo(() => {
    const setCats = new Set<string>();
    insumos.forEach((i) => {
      if (i.categoria) setCats.add(i.categoria);
    });
    return Array.from(setCats).sort();
  }, [insumos]);

  // Filtrado de insumos según selección del modal
  const filteredInsumos = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);

    return insumos.filter((item) => {
      // 1. Filtro rápido de tipo
      if (filterType === 'CARNES' && !item.es_carne) return false;
      if (filterType === 'CURRENT') {
        if (selectedCat === 'CARNES' && !item.es_carne) return false;
        if (selectedCat !== 'ALL' && selectedCat !== 'CARNES') {
          if (normalizeStr(item.categoria) !== normalizeStr(selectedCat)) return false;
        }
      }

      // 2. Buscador
      if (!cleanSearch) return true;
      const name = normalizeStr(item.nombre);
      const code = normalizeStr(item.codigo || '');
      const cat = normalizeStr(item.categoria || '');
      return name.includes(cleanSearch) || code.includes(cleanSearch) || cat.includes(cleanSearch);
    });
  }, [insumos, filterType, selectedCat, searchQuery]);

  // Estadísticas del subconjunto
  const totalInsumos = filteredInsumos.length;
  const totalCarnes = filteredInsumos.filter((i) => i.es_carne).length;
  const totalOtros = totalInsumos - totalCarnes;
  const totalCategorias = new Set(filteredInsumos.map((i) => i.categoria).filter(Boolean)).size;

  // Manejador: Descargar PDF
  const handleDownloadPdf = () => {
    const catLabel = filterType === 'CARNES' 
      ? 'Solo Carnes' 
      : (filterType === 'CURRENT' && selectedCat !== 'ALL' ? selectedCat : 'Todos');

    const doc = generateCatalogoPdf({
      insumos: filteredInsumos,
      categoryFilter: catLabel,
      searchQuery: searchQuery,
      reportTitle: 'CATÁLOGO MAESTRO DE CARNES, PESCADOS E INSUMOS'
    });

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const safeCat = catLabel.replace(/[\s\/]/g, '_');
    doc.save(`Catalogo_Insumos_La_Finca_${safeCat}_${dateStr}.pdf`);
  };

  // Manejador: Vista Previa PDF en nueva pestaña
  const handlePreviewPdf = () => {
    const catLabel = filterType === 'CARNES' 
      ? 'Solo Carnes' 
      : (filterType === 'CURRENT' && selectedCat !== 'ALL' ? selectedCat : 'Todos');

    const doc = generateCatalogoPdf({
      insumos: filteredInsumos,
      categoryFilter: catLabel,
      searchQuery: searchQuery,
      reportTitle: 'CATÁLOGO MAESTRO DE CARNES, PESCADOS E INSUMOS'
    });

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  };

  // Manejador: Exportar a Excel
  const handleExportExcel = () => {
    try {
      const rows = filteredInsumos.map((item, idx) => {
        const pesoStd = item.peso_estandar_porcion_kg || 0;
        const isPorc = item.tipo_medida === 'KGS_Y_UNIDADES';
        const pesoGramos = (isPorc && pesoStd > 0) ? Math.round(pesoStd * 1000) : '';
        const rend = (isPorc && pesoStd > 0) ? Number((1 / pesoStd).toFixed(2)) : '';

        return {
          '#': idx + 1,
          'Código': item.codigo || `INS-${String(idx + 1).padStart(3, '0')}`,
          'Materia Prima / Corte': item.nombre,
          'Categoría': item.categoria || 'GENERAL',
          'Unidad': item.unidad_medida || 'Kg',
          'Medida Sistema': item.tipo_medida,
          'Peso Porción (gr)': pesoGramos,
          'Rendimiento (Porc/Kg)': rend,
          'Costo Base / Kg ($)': item.costo_unitario_kg || 0,
          'Observaciones': item.observaciones || '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Anchos de columna
      worksheet['!cols'] = [
        { wch: 5 },  // #
        { wch: 12 }, // Código
        { wch: 34 }, // Materia Prima
        { wch: 24 }, // Categoría
        { wch: 10 }, // Unidad
        { wch: 20 }, // Medida Sistema
        { wch: 18 }, // Peso Porción (gr)
        { wch: 22 }, // Rendimiento
        { wch: 20 }, // Costo Base
        { wch: 35 }, // Observaciones
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogo Insumos');

      const now = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Catalogo_Insumos_La_Finca_${now}.xlsx`);
    } catch (err: any) {
      console.error('Error exportando Excel:', err);
      alert('Error al exportar Excel: ' + err.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Exportar Catálogo de Insumos y Carnes"
      icon={<FileText className="w-5 h-5 text-orange-600" />}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4 text-xs font-normal">
        {/* 🎛️ Filtros y Opciones de Exportación */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Chips de selección de alcance */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-600 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                Alcance:
              </span>
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  filterType === 'ALL'
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Todos los Insumos ({insumos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('CARNES')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  filterType === 'CARNES'
                    ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                🥩 Solo Carnes Maestras ({insumos.filter(i => i.es_carne).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('CURRENT')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  filterType === 'CURRENT'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Personalizado / Categoría
              </button>
            </div>

            {/* Buscador en el modal */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nombre o código..."
                className="w-full h-8 pl-8 pr-3 text-xs bg-white rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 font-normal"
              />
            </div>
          </div>

          {/* Selector de categoría secundaria si está en modo CURRENT */}
          {filterType === 'CURRENT' && (
            <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[11px] font-medium text-slate-500">Categoría específica:</span>
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="h-7 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 font-medium outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Todas las Categorías</option>
                <option value="CARNES">🥩 Todas las Carnes</option>
                {categoriasPresentes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 📊 Tarjetas de Resumen del Documento a Generar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">Ítems a Exportar</span>
            <span className="text-base font-semibold text-slate-900">{totalInsumos} insumos</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">Carnes Maestras</span>
            <span className="text-base font-semibold text-orange-600">{totalCarnes} cortes</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">Abarrotes / Otros</span>
            <span className="text-base font-semibold text-blue-600">{totalOtros} ítems</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">Familias / Grupos</span>
            <span className="text-base font-semibold text-emerald-600">{totalCategorias} categorías</span>
          </div>
        </div>

        {/* 👁️ Tabla de Vista Previa de Filas a Exportar */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Vista Previa de Columnas y Filas del Reporte ({filteredInsumos.length})
            </span>
            <span className="text-[11px] text-slate-500">
              Formato Horizontal A4 (Landscape) • 8 Columnas Oficiales
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto overflow-x-auto text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-2.5 text-center">Código</th>
                  <th className="py-2 px-2.5">Materia Prima / Corte</th>
                  <th className="py-2 px-2.5">Categoría</th>
                  <th className="py-2 px-2 text-center">Unidad</th>
                  <th className="py-2 px-2 text-center">Medida Sistema</th>
                  <th className="py-2 px-2 text-right">Peso Porción (gr)</th>
                  <th className="py-2 px-2 text-right">Rendimiento</th>
                  <th className="py-2 px-2.5 text-right">Costo Base / Kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredInsumos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-normal">
                      No hay insumos que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredInsumos.map((item, idx) => {
                    const pesoStd = item.peso_estandar_porcion_kg || 0;
                    const isPorc = item.tipo_medida === 'KGS_Y_UNIDADES';
                    const pesoGramos = pesoStd > 0 ? Math.round(pesoStd * 1000) : 0;

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-1.5 px-2.5 text-center font-mono font-medium text-slate-600">
                          {item.codigo || '-'}
                        </td>
                        <td className="py-1.5 px-2.5 font-medium text-slate-900">
                          {item.nombre}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600">
                          {item.categoria || '-'}
                        </td>
                        <td className="py-1.5 px-2 text-center text-slate-600">
                          {item.unidad_medida || 'Kg'}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-slate-100 text-slate-700">
                            {item.tipo_medida === 'KGS_Y_UNIDADES' ? 'Kgs y Und' : item.tipo_medida}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-600 font-mono">
                          {isPorc && pesoGramos > 0 ? `${pesoGramos} gr` : '-'}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-600 font-mono">
                          {isPorc && pesoStd > 0 ? `${(1 / pesoStd).toFixed(1)} p/Kg` : '-'}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-semibold text-slate-900 font-mono">
                          ${formatMoney(item.costo_unitario_kg || 0)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🚀 Barra de Acciones del Pie */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Exportar Excel como complemento */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredInsumos.length === 0}
              className="px-3.5 py-2 text-xs font-medium rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>

            {/* Vista Previa PDF */}
            <button
              type="button"
              onClick={handlePreviewPdf}
              disabled={filteredInsumos.length === 0}
              className="px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              <span>Vista Previa PDF</span>
            </button>

            {/* Descargar PDF Principal */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={filteredInsumos.length === 0}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Catálogo PDF</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
