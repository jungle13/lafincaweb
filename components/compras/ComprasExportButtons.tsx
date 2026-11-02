'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CompraFacturaGroup, CompraInsumoGroup, CompraDetalleItem } from '@/services/comprasService';
import { downloadComprasFacturasPdf } from '@/lib/exportComprasFacturasPdf';

interface Props {
  facturas: CompraFacturaGroup[];
  insumos: CompraInsumoGroup[];
  lineas: CompraDetalleItem[];
  periodoNombre?: string;
}

export default function ComprasExportButtons({
  facturas,
  insumos,
  lineas,
  periodoNombre = 'Octubre 2026',
}: Props) {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportExcel = async () => {
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
    setExportingPdf(true);
    try {
      downloadComprasFacturasPdf({
        facturas,
        periodoNombre,
        reportTitle: 'ENTRADAS POR COMPRAS — DETALLE POR FACTURA Y CATEGORÍA'
      });
    } catch (err) {
      console.error('Error exportando PDF de Compras:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Botón Exportar PDF por Factura y Categoría */}
      <button
        type="button"
        onClick={handleExportPdf}
        disabled={exportingPdf || facturas.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
        title="Exportar informe PDF organizado por Factura y Categoría"
      >
        {exportingPdf ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-slate-300" />
        )}
        <span>Exportar PDF</span>
      </button>

      {/* Botón Exportar Excel */}
      <button
        type="button"
        onClick={handleExportExcel}
        disabled={exportingExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
      >
        {exportingExcel ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5 text-slate-500" />
        )}
        <span>Exportar Excel</span>
      </button>
    </div>
  );
}
