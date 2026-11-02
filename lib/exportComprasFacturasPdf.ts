import { jsPDF } from 'jspdf';
import { CompraFacturaGroup, CompraDetalleItem } from '@/services/comprasService';
import {
  createLetterPdf,
  drawStandardHeader,
  drawStandardSecondaryHeader,
  applyStandardFooters,
  formatMoneyCOP,
  fitText,
  LETTER_WIDTH,
  DEFAULT_MARGIN_X,
  DEFAULT_MARGIN_TOP_P1,
  DEFAULT_MARGIN_TOP_OTHERS,
  DEFAULT_MARGIN_BOTTOM,
  PDF_COLORS,
  DEFAULT_COMPANY_NAME
} from './pdfStandardReport';

export interface ExportComprasPdfOptions {
  facturas: CompraFacturaGroup[];
  periodoNombre?: string;
  companyName?: string;
  reportTitle?: string;
}

/**
 * Genera el documento PDF de Entradas por Compras por Factura organizado por Categoría,
 * siguiendo el estándar minimalista monocromático institucional de La Finca.
 */
export function generateComprasFacturasPdf({
  facturas,
  periodoNombre = 'Octubre 2026',
  companyName = DEFAULT_COMPANY_NAME,
  reportTitle = 'ENTRADAS POR COMPRAS — DETALLE POR FACTURA Y CATEGORÍA'
}: ExportComprasPdfOptions): jsPDF {
  const doc = createLetterPdf();
  const marginX = DEFAULT_MARGIN_X;
  const contentWidth = LETTER_WIDTH - (marginX * 2); // 197.9 mm
  const marginBottom = DEFAULT_MARGIN_BOTTOM; // 270 mm

  let currentPage = 1;
  let currentY = drawStandardHeader(doc, {
    companyName,
    reportTitle,
    periodLabel: periodoNombre.toUpperCase(),
    currentPage: 1,
    marginX,
    pageWidth: LETTER_WIDTH
  });

  currentY += 1.5;

  // Anchos de columnas para las tablas de ítems dentro de cada categoría
  // Ancho total: 197.9 mm
  // Insumo / Detalle: 105 mm
  // Cantidad + Unidad: 28 mm
  // Costo Unitario: 32 mm
  // Subtotal: 32.9 mm
  const colW = {
    insumo: 105.0,
    cant: 28.0,
    unitPrice: 32.0,
    total: 32.9
  };

  const colX = {
    insumo: marginX,
    cant: marginX + colW.insumo,
    unitPrice: marginX + colW.insumo + colW.cant,
    total: marginX + colW.insumo + colW.cant + colW.unitPrice
  };

  function checkSpace(neededHeight: number, isMajorHeader: boolean = false): void {
    const threshold = isMajorHeader ? (neededHeight + 8) : neededHeight;
    if (currentY + threshold > marginBottom) {
      doc.addPage();
      currentPage++;
      currentY = drawStandardSecondaryHeader(doc, {
        companyName,
        reportTitle,
        currentPage,
        marginX,
        pageWidth: LETTER_WIDTH
      });
      currentY += 2.0;
    }
  }

  // 1. Resumen superior de Totales de Compras
  const totalFacturas = facturas.length;
  const totalInversion = facturas.reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
  const totalItems = facturas.reduce((sum, f) => sum + (f.items?.length || 0), 0);

  const kpiH = 10.5;
  const kpiCols = 3;
  const kpiGap = 3.0;
  const kpiW = (contentWidth - (kpiGap * (kpiCols - 1))) / kpiCols;

  const topKpis = [
    { title: 'TOTAL FACTURAS PROCESADAS', val: `${totalFacturas} Facturas`, sub: 'Comprobantes emitidos' },
    { title: 'ÍTEMS TOTALES COMPRADOS', val: `${totalItems} Ítems`, sub: 'Líneas recibidas' },
    { title: 'INVERSIÓN TOTAL EN COMPRAS', val: formatMoneyCOP(totalInversion), sub: 'Suma de facturas' }
  ];

  topKpis.forEach((kpi, idx) => {
    const kx = marginX + idx * (kpiW + kpiGap);
    doc.setFillColor(...PDF_COLORS.subHeaderBg);
    doc.rect(kx, currentY, kpiW, kpiH, 'F');

    doc.setDrawColor(...PDF_COLORS.borderLight);
    doc.setLineWidth(0.18);
    doc.rect(kx, currentY, kpiW, kpiH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(kpi.title, kx + 2, currentY + 3.0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...PDF_COLORS.textMain);
    doc.text(kpi.val, kx + 2, currentY + 6.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.0);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(kpi.sub, kx + 2, currentY + 9.3);
  });

  currentY += kpiH + 3.5;

  // 2. Iteración por cada Factura
  if (facturas.length === 0) {
    checkSpace(10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.0);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text('No hay facturas de compras registradas para este período.', marginX, currentY + 5);
    currentY += 10;
  } else {
    facturas.forEach((fac, facIdx) => {
      // Agrupamos los ítems de esta factura por Categoría
      const itemsByCategory: Record<string, CompraDetalleItem[]> = {};
      (fac.items || []).forEach((it) => {
        const cat = (it.categoria || fac.categoria || 'Sin Categoría').trim();
        if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
        itemsByCategory[cat].push(it);
      });

      const categoriesInFactura = Object.keys(itemsByCategory).sort();

      // Cabecera de la Factura (Banda oscura minimalista)
      checkSpace(14, true);

      const facHeaderH = 5.5;
      doc.setFillColor(...PDF_COLORS.sectionDark);
      doc.rect(marginX, currentY, contentWidth, facHeaderH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);

      const facTitle = `FACTURA N° ${fac.numero_factura}   |   FECHA: ${fac.fecha}   |   PROVEEDOR: ${fac.proveedor.toUpperCase()}`;
      doc.text(fitText(doc, facTitle, contentWidth - 45), marginX + 2, currentY + 3.7);

      const facTotalStr = `TOTAL: ${formatMoneyCOP(fac.valor_total)}`;
      doc.text(facTotalStr, marginX + contentWidth - 2, currentY + 3.7, { align: 'right' });

      currentY += facHeaderH + 0.5;

      // Si no tiene ítems detallados
      if (categoriesInFactura.length === 0) {
        checkSpace(4.5);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.0);
        doc.setTextColor(...PDF_COLORS.textMuted);
        doc.text('Factura registrada sin líneas individuales.', marginX + 2, currentY + 3.2);
        currentY += 5.0;
      } else {
        // Iterar por cada Categoría dentro de la Factura
        categoriesInFactura.forEach((catName) => {
          const items = itemsByCategory[catName];
          const catSubtotal = items.reduce((sum, it) => sum + Number(it.valor_compra || 0), 0);

          // Subencabezado de Categoría
          checkSpace(8.0, true);

          const catH = 4.3;
          doc.setFillColor(...PDF_COLORS.categoryGray);
          doc.rect(marginX, currentY, contentWidth, catH, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.2);
          doc.setTextColor(...PDF_COLORS.textMain);
          doc.text(`CATEGORÍA: ${catName.toUpperCase()} (${items.length} ${items.length === 1 ? 'ítem' : 'ítems'})`, marginX + 2, currentY + 3.0);

          doc.text(`Subtotal Categoría: ${formatMoneyCOP(catSubtotal)}`, marginX + contentWidth - 2, currentY + 3.0, { align: 'right' });

          currentY += catH + 0.3;

          // Encabezados de Columnas de la Tabla
          const thH = 3.6;
          doc.setFillColor(...PDF_COLORS.subHeaderBg);
          doc.rect(marginX, currentY, contentWidth, thH, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.4);
          doc.setTextColor(...PDF_COLORS.textBody);

          doc.text('INSUMO (BD) / DETALLE FACTURA ORIGINAL', colX.insumo + 2, currentY + 2.5);
          doc.text('CANTIDAD', colX.cant + colW.cant - 2, currentY + 2.5, { align: 'right' });
          doc.text('COSTO UNIT.', colX.unitPrice + colW.unitPrice - 2, currentY + 2.5, { align: 'right' });
          doc.text('TOTAL COMPRA', colX.total + colW.total - 2, currentY + 2.5, { align: 'right' });

          // Línea divisoria bajo th
          doc.setDrawColor(...PDF_COLORS.borderMedium);
          doc.setLineWidth(0.12);
          doc.line(marginX, currentY + thH, marginX + contentWidth, currentY + thH);

          currentY += thH + 0.3;

          // Filas de los ítems de esta categoría
          items.forEach((it, idx) => {
            const rowH = 4.2;
            checkSpace(rowH);

            if (idx % 2 === 1) {
              doc.setFillColor(...PDF_COLORS.rowAlt);
              doc.rect(marginX, currentY, contentWidth, rowH, 'F');
            }

            // Insumo + Detalle
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.8);
            doc.setTextColor(...PDF_COLORS.textMain);

            const nombrePrincipal = it.nombre_insumo || it.detalle || 'Insumo';
            const detalleSecundario = it.detalle && it.detalle !== it.nombre_insumo ? ` — ${it.detalle}` : '';
            const insumoLabel = fitText(doc, `${nombrePrincipal}${detalleSecundario}`, colW.insumo - 4);
            doc.text(insumoLabel, colX.insumo + 2, currentY + 2.9);

            // Cantidad + Unidad
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.6);
            doc.setTextColor(...PDF_COLORS.textBody);
            const cantStr = `${it.cantidad.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${it.unidad || ''}`.trim();
            doc.text(cantStr, colX.cant + colW.cant - 2, currentY + 2.9, { align: 'right' });

            // Costo Unitario
            doc.text(formatMoneyCOP(it.costo_unitario), colX.unitPrice + colW.unitPrice - 2, currentY + 2.9, { align: 'right' });

            // Total Compra
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...PDF_COLORS.textMain);
            doc.text(formatMoneyCOP(it.valor_compra), colX.total + colW.total - 2, currentY + 2.9, { align: 'right' });

            // Línea sutil
            doc.setDrawColor(...PDF_COLORS.borderSubtle);
            doc.setLineWidth(0.08);
            doc.line(marginX, currentY + rowH, marginX + contentWidth, currentY + rowH);

            currentY += rowH;
          });

          currentY += 1.0;
        });
      }

      currentY += 2.5; // Espacio entre facturas
    });
  }

  // 3. Banner final de Cierre de Compras
  checkSpace(7.0);
  doc.setFillColor(...PDF_COLORS.black);
  doc.rect(marginX, currentY, contentWidth, 5.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL GENERAL ENTRADAS POR COMPRAS (${totalFacturas} FACTURAS):`, marginX + 2, currentY + 4.0);
  doc.text(formatMoneyCOP(totalInversion), marginX + contentWidth - 2, currentY + 4.0, { align: 'right' });

  currentY += 8.0;

  // 4. Aplicar pie de página estándar institucional
  applyStandardFooters(doc, companyName, 'Entradas por Compras • Reporte Oficial por Factura y Categoría');

  return doc;
}

/**
 * Genera y descarga directamente el archivo PDF de Entradas por Compras en el cliente.
 */
export function downloadComprasFacturasPdf(options: ExportComprasPdfOptions): void {
  const doc = generateComprasFacturasPdf(options);
  const safePeriodo = (options.periodoNombre || 'Periodo').replace(/\s+/g, '_');
  const fileName = `Entradas_Compras_Facturas_${safePeriodo}.pdf`;
  doc.save(fileName);
}
