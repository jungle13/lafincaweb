import { jsPDF } from 'jspdf';
import { CompraFacturaGroup } from '@/services/comprasService';
import {
  createLetterPdf,
  drawStandardHeader,
  drawStandardSecondaryHeader,
  applyStandardFooters,
  formatMoneyCOP,
  fitText,
  LETTER_WIDTH,
  DEFAULT_MARGIN_X,
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
 * Genera el documento PDF de Entradas por Compras listando factura por factura
 * con su total, organizadas por Categoría, con diseño minimalista monocromático institucional.
 */
export function generateComprasFacturasPdf({
  facturas,
  periodoNombre = 'Octubre 2026',
  companyName = DEFAULT_COMPANY_NAME,
  reportTitle = 'ENTRADAS POR COMPRAS — FACTURAS POR CATEGORÍA'
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

  // 1. Agrupar las Facturas por Categoría
  const facturasByCategory: Record<string, CompraFacturaGroup[]> = {};
  facturas.forEach((fac) => {
    const cat = (fac.categoria || 'Sin Categoría').trim();
    if (!facturasByCategory[cat]) facturasByCategory[cat] = [];
    facturasByCategory[cat].push(fac);
  });

  // Ordenar categorías por monto total descendente
  const sortedCategories = Object.keys(facturasByCategory).sort((a, b) => {
    const totalA = facturasByCategory[a].reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
    const totalB = facturasByCategory[b].reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
    return totalB - totalA;
  });

  // Totales globales
  const totalFacturas = facturas.length;
  const totalInversion = facturas.reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
  const totalItems = facturas.reduce((sum, f) => sum + Number(f.total_items || f.items?.length || 0), 0);

  // 2. Bloque Superior de KPIs (minimalista)
  const kpiH = 10.5;
  const kpiCols = 3;
  const kpiGap = 3.0;
  const kpiW = (contentWidth - (kpiGap * (kpiCols - 1))) / kpiCols;

  const topKpis = [
    { title: 'TOTAL FACTURAS PROCESADAS', val: `${totalFacturas} Facturas`, sub: `${sortedCategories.length} categorías de compra` },
    { title: 'ÍTEMS TOTALES COMPRADOS', val: `${totalItems} Ítems`, sub: 'Líneas recibidas en facturas' },
    { title: 'INVERSIÓN TOTAL EN COMPRAS', val: formatMoneyCOP(totalInversion), sub: 'Suma consolidada de facturas' }
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

  // Anchos de columnas de la tabla de Facturas (suma = 197.9 mm)
  // Fecha: 24 mm
  // N° Factura: 32 mm
  // Proveedor: 60 mm
  // Ítems: 18 mm
  // Origen / Soporte: 31.9 mm
  // Total Factura: 32 mm
  const colW = {
    fecha: 24.0,
    factura: 32.0,
    proveedor: 60.0,
    items: 18.0,
    origen: 31.9,
    total: 32.0
  };

  const colX = {
    fecha: marginX,
    factura: marginX + colW.fecha,
    proveedor: marginX + colW.fecha + colW.factura,
    items: marginX + colW.fecha + colW.factura + colW.proveedor,
    origen: marginX + colW.fecha + colW.factura + colW.proveedor + colW.items,
    total: marginX + colW.fecha + colW.factura + colW.proveedor + colW.items + colW.origen
  };

  // 3. Renderizado por cada Categoría
  if (sortedCategories.length === 0) {
    checkSpace(10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text('No hay facturas de compras registradas para este período.', marginX, currentY + 5);
    currentY += 10;
  } else {
    sortedCategories.forEach((catName) => {
      const catFacturas = facturasByCategory[catName].sort((a, b) => a.fecha.localeCompare(b.fecha));
      const catTotal = catFacturas.reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
      const catItemsCount = catFacturas.reduce((sum, f) => sum + Number(f.total_items || f.items?.length || 0), 0);

      // Subencabezado de Categoría (Banda oscura sobria)
      checkSpace(12, true);

      const catHeaderH = 5.2;
      doc.setFillColor(...PDF_COLORS.sectionDark);
      doc.rect(marginX, currentY, contentWidth, catHeaderH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);

      const catTitle = `CATEGORÍA: ${catName.toUpperCase()} (${catFacturas.length} ${catFacturas.length === 1 ? 'FACTURA' : 'FACTURAS'} • ${catItemsCount} ÍTEMS)`;
      doc.text(fitText(doc, catTitle, contentWidth - 45), marginX + 2, currentY + 3.6);

      const catSubtotalStr = `SUBTOTAL: ${formatMoneyCOP(catTotal)}`;
      doc.text(catSubtotalStr, marginX + contentWidth - 2, currentY + 3.6, { align: 'right' });

      currentY += catHeaderH + 0.3;

      // Encabezado de columnas de la tabla de facturas
      const thH = 4.0;
      doc.setFillColor(...PDF_COLORS.categoryGray);
      doc.rect(marginX, currentY, contentWidth, thH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.6);
      doc.setTextColor(...PDF_COLORS.textMain);

      doc.text('FECHA', colX.fecha + 2, currentY + 2.7);
      doc.text('N° FACTURA', colX.factura + 2, currentY + 2.7);
      doc.text('PROVEEDOR', colX.proveedor + 2, currentY + 2.7);
      doc.text('ÍTEMS', colX.items + colW.items - 2, currentY + 2.7, { align: 'right' });
      doc.text('ORIGEN / SOPORTE', colX.origen + 2, currentY + 2.7);
      doc.text('TOTAL FACTURA', colX.total + colW.total - 2, currentY + 2.7, { align: 'right' });

      // Línea bajo encabezado
      doc.setDrawColor(...PDF_COLORS.borderMedium);
      doc.setLineWidth(0.18);
      doc.line(marginX, currentY + thH, marginX + contentWidth, currentY + thH);

      currentY += thH + 0.3;

      // Filas de Factura por Factura
      catFacturas.forEach((fac, fIdx) => {
        const rowH = 4.2;
        checkSpace(rowH);

        if (fIdx % 2 === 1) {
          doc.setFillColor(...PDF_COLORS.rowAlt);
          doc.rect(marginX, currentY, contentWidth, rowH, 'F');
        }

        // Fecha
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.6);
        doc.setTextColor(...PDF_COLORS.textMain);
        doc.text(fac.fecha || '', colX.fecha + 2, currentY + 2.9);

        // N° Factura
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.6);
        doc.setTextColor(...PDF_COLORS.textMain);
        const facNum = fitText(doc, fac.numero_factura || 'S/N', colW.factura - 3);
        doc.text(facNum, colX.factura + 2, currentY + 2.9);

        // Proveedor
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(...PDF_COLORS.textBody);
        const provStr = fitText(doc, fac.proveedor || 'Proveedor General', colW.proveedor - 3);
        doc.text(provStr, colX.proveedor + 2, currentY + 2.9);

        // Ítems comprados
        const itemsNum = fac.total_items || fac.items?.length || 1;
        doc.text(`${itemsNum}`, colX.items + colW.items - 2, currentY + 2.9, { align: 'right' });

        // Archivo Origen o soporte
        doc.setFontSize(5.2);
        doc.setTextColor(...PDF_COLORS.textMuted);
        const origenStr = fitText(doc, fac.origen || 'Extracción Directa', colW.origen - 3);
        doc.text(origenStr, colX.origen + 2, currentY + 2.9);

        // Total Factura
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.8);
        doc.setTextColor(...PDF_COLORS.textMain);
        doc.text(formatMoneyCOP(fac.valor_total), colX.total + colW.total - 2, currentY + 2.9, { align: 'right' });

        // Línea divisoria muy fina
        doc.setDrawColor(...PDF_COLORS.borderSubtle);
        doc.setLineWidth(0.08);
        doc.line(marginX, currentY + rowH, marginX + contentWidth, currentY + rowH);

        currentY += rowH;
      });

      // Fila de Subtotal de Categoría
      const subH = 4.2;
      checkSpace(subH);
      doc.setFillColor(...PDF_COLORS.subHeaderBg);
      doc.rect(marginX, currentY, contentWidth, subH, 'F');

      doc.setDrawColor(...PDF_COLORS.borderMedium);
      doc.setLineWidth(0.15);
      doc.line(marginX, currentY, marginX + contentWidth, currentY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(...PDF_COLORS.textMain);
      doc.text(`TOTAL ${catName.toUpperCase()} (${catFacturas.length} FACTURAS):`, colX.fecha + 2, currentY + 2.9);
      doc.text(formatMoneyCOP(catTotal), colX.total + colW.total - 2, currentY + 2.9, { align: 'right' });

      currentY += subH + 3.0; // Espacio entre categorías
    });
  }

  // 4. Banner final de Total General Consolidado
  checkSpace(7.0);
  doc.setFillColor(...PDF_COLORS.black);
  doc.rect(marginX, currentY, contentWidth, 5.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL GENERAL ENTRADAS POR COMPRAS (${totalFacturas} FACTURAS EN ${sortedCategories.length} CATEGORÍAS):`, marginX + 2, currentY + 4.0);
  doc.text(formatMoneyCOP(totalInversion), marginX + contentWidth - 2, currentY + 4.0, { align: 'right' });

  // 5. Aplicar pie de página estándar institucional
  applyStandardFooters(doc, companyName, 'Entradas por Compras • Reporte Oficial de Facturas por Categoría');

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
