'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  Loader2, 
  SlidersHorizontal, 
  ChevronDown, 
  Plus 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { CompraFacturaGroup, CompraInsumoGroup, CompraDetalleItem } from '@/services/comprasService';
import { downloadComprasFacturasPdf } from '@/lib/exportComprasFacturasPdf';

interface Props {
  facturas: CompraFacturaGroup[];
  insumos: CompraInsumoGroup[];
  lineas: CompraDetalleItem[];
  periodoNombre?: string;
  onAddCompra?: () => void;
}

export default function ComprasExportButtons({
  facturas,
  insumos,
  lineas,
  periodoNombre = 'Octubre 2026',
  onAddCompra,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExportExcel = async () => {
    setDropdownOpen(false);
    setExportingExcel(true);
    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen de Facturas
      const facturasRows = facturas.map((f, idx) => ({
        '#': idx + 1,
        Fecha: f.fecha,
        'N° Factura / Comprobante': f.numero_factura,
        Proveedor: f.proveedor,
        Categoría: f.categoria,
        'Ítems Comprados': f.total_items,
        'Total Factura ($)': f.valor_total,
        'Archivo Origen PDF': f.origen,
        Observaciones: f.observaciones,
      }));
      const wsFacturas = XLSX.utils.json_to_sheet(facturasRows);
      XLSX.utils.book_append_sheet(wb, wsFacturas, 'Facturas');

      // Hoja 2: Insumos Consolidados
      const insumosRows = insumos.map((i, idx) => ({
        '#': idx + 1,
        Insumo: i.nombre_insumo,
        Categoría: i.categoria,
        'Cantidad Total': i.cantidad_total,
        Unidad: i.unidad,
        'Último Costo ($)': i.ultimo_costo,
        'Costo Promedio ($)': i.costo_promedio,
        'Total Invertido ($)': i.total_dinero,
        'N° Compras': i.num_compras,
        Proveedores: i.proveedores.join(', '),
      }));
      const wsInsumos = XLSX.utils.json_to_sheet(insumosRows);
      XLSX.utils.book_append_sheet(wb, wsInsumos, 'Insumos Consolidados');

      // Hoja 3: Detalle Completo de Líneas
      const lineasRows = lineas.map((l, idx) => ({
        '#': idx + 1,
        Fecha: l.fecha,
        'N° Factura': l.numero_factura,
        Proveedor: l.proveedor,
        Categoría: l.categoria,
        'Insumo (BD)': l.nombre_insumo,
        'Detalle Original (PDF)': l.detalle,
        Cantidad: l.cantidad,
        Unidad: l.unidad,
        'Costo Unitario ($)': l.costo_unitario,
        'Total Compra ($)': l.valor_compra,
        'Archivo PDF': l.origen,
        Observaciones: l.observaciones,
      }));
      const wsLineas = XLSX.utils.json_to_sheet(lineasRows);
      XLSX.utils.book_append_sheet(wb, wsLineas, 'Detalle Líneas');

      const fileName = `COMPRAS_LA_FINCA_${periodoNombre.replace(/\s+/g, '_').toUpperCase()}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Error exportando Excel:', err);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = () => {
    setDropdownOpen(false);
    setExportingPdf(true);
    try {
      downloadComprasFacturasPdf({
        facturas,
        lineas,
        periodoNombre,
        reportTitle: 'ENTRADAS POR COMPRAS — COSTOS DIRECTOS (MATERIA PRIMA)'
      });
    } catch (err) {
      console.error('Error exportando PDF de Compras:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* 🛠️ Dropdown Utilidades */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={exportingPdf || exportingExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          title="Menú de utilidades y exportación"
        >
          {exportingPdf || exportingExcel ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
          ) : (
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
          )}
          <span>Utilidades</span>
          <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
        </button>

        {/* Menú Desplegable */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 animate-in fade-in duration-100">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-0.5">
              Exportación de Datos
            </div>

            {/* Opción PDF */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={facturas.length === 0}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer disabled:opacity-40"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <div>
                <div className="font-semibold text-slate-800">Exportar PDF</div>
                <div className="text-[10px] text-slate-500">Por factura y categoría</div>
              </div>
            </button>

            {/* Opción Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={facturas.length === 0}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-semibold text-slate-800">Exportar Excel</div>
                <div className="text-[10px] text-slate-500">Libro consolidado (3 hojas)</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ➕ Botón Añadir Compra */}
      {onAddCompra && (
        <button
          type="button"
          onClick={onAddCompra}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Añadir compra</span>
        </button>
      )}
    </div>
  );
}
