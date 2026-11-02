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
 * con su total, organizadas por Categoría, y mostrando en la parte superior el
 * TOTAL COMPRADO / FACTURADO POR CADA CATEGORÍA con diseño minimalista institucional.
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

  // 1. Agrupar las Facturas por Categoría y calcular totales
  const facturasByCategory: Record<string, CompraFacturaGroup[]> = {};
  facturas.forEach((fac) => {
    const cat = (fac.categoria || 'Sin Categoría').trim();
    if (!facturasByCategory[cat]) facturasByCategory[cat] = [];
    facturasByCategory[cat].push(fac);
  });

  // Totales globales
  const totalFacturas = facturas.length;
  const totalInversion = facturas.reduce((sum, f) => sum + Number(f.valor_total || 0), 0);

  // Ordenar categorías por monto total descendente
  const categorySummary = Object.keys(facturasByCategory).map((catName) => {
    const items = facturasByCategory[catName];
    const total = items.reduce((sum, f) => sum + Number(f.valor_total || 0), 0);
    const count = items.length;
    const pct = totalInversion > 0 ? (total / totalInversion) * 100 : 0;
    return { name: catName, total, count, pct, items };
  }).sort((a, b) => b.total - a.total);

  // 2. Bloque Superior Ejecutivo: 2 Cards Principales
  const topKpiH = 9.5;
  const topKpiGap = 3.5;
  const topKpiW = (contentWidth - topKpiGap) / 2;

  // Card 1: Total Facturas
  doc.setFillColor(...PDF_COLORS.subHeaderBg);
  doc.rect(marginX, currentY, topKpiW, topKpiH, 'F');
  doc.setDrawColor(...PDF_COLORS.borderLight);
  doc.setLineWidth(0.18);
  doc.rect(marginX, currentY, topKpiW, topKpiH, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text('TOTAL FACTURAS PROCESADAS', marginX + 2.5, currentY + 3.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...PDF_COLORS.textMain);
  doc.text(`${totalFacturas} Facturas`, marginX + 2.5, currentY + 7.2);

  // Card 2: Inversión Total en Compras
  const k2X = marginX + topKpiW + topKpiGap;
  doc.setFillColor(...PDF_COLORS.subHeaderBg);
  doc.rect(k2X, currentY, topKpiW, topKpiH, 'F');
  doc.setDrawColor(...PDF_COLORS.borderLight);
  doc.setLineWidth(0.18);
  doc.rect(k2X, currentY, topKpiW, topKpiH, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text('INVERSIÓN TOTAL EN COMPRAS (CONSOLIDADO)', k2X + 2.5, currentY + 3.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...PDF_COLORS.textMain);
  doc.text(formatMoneyCOP(totalInversion), k2X + 2.5, currentY + 7.2);

  currentY += topKpiH + 3.0;

  // 3. Panel de TOTAL COMPRADO / FACTURADO POR CADA CATEGORÍA
  // Cuadrícula de tarjetas limpias mostrando el monto exacto de cada categoría
  const catTitleH = 4.6;
  doc.setFillColor(...PDF_COLORS.sectionDark);
  doc.rect(marginX, currentY, contentWidth, catTitleH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL COMPRADO / FACTURADO POR CADA CATEGORÍA', marginX + 2, currentY + 3.2);

  currentY += catTitleH + 1.2;

  // Grid de categorías: 3 columnas x N filas
  const catGridCols = 3;
  const catGridGap = 2.5;
  const catCardW = (contentWidth - (catGridGap * (catGridCols - 1))) / catGridCols;
  const catCardH = 10.2;

  categorySummary.forEach((cat, idx) => {
    const colIdx = idx % catGridCols;
    const rowIdx = Math.floor(idx / catGridCols);
    const cx = marginX + colIdx * (catCardW + catGridGap);
    const cy = currentY + rowIdx * (catCardH + 2.0);

    // Fondo gris muy claro sobrio
    doc.setFillColor(...PDF_COLORS.subHeaderBg);
    doc.rect(cx, cy, catCardW, catCardH, 'F');

    // Borde fino
    doc.setDrawColor(...PDF_COLORS.borderLight);
    doc.setLineWidth(0.15);
    doc.rect(cx, cy, catCardW, catCardH, 'S');

    // Nombre de la categoría
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.6);
    doc.setTextColor(...PDF_COLORS.textMuted);
    const catNameShort = fitText(doc, cat.name.toUpperCase(), catCardW - 4);
    doc.text(catNameShort, cx + 2, cy + 3.0);

    // Total Comprado en esa categoría
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...PDF_COLORS.textMain);
    doc.text(formatMoneyCOP(cat.total), cx + 2, cy + 6.8);

    // Subtítulo con cantidad de facturas y porcentaje de participación
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.0);
    doc.setTextColor(...PDF_COLORS.textBody);
    doc.text(`${cat.count} facturas  •  ${cat.pct.toFixed(1)}% del total`, cx + 2, cy + 9.3);
  });

  const totalCatRows = Math.ceil(categorySummary.length / catGridCols);
  currentY += (totalCatRows * (catCardH + 2.0)) + 2.5;

  // 4. TABLA DETALLADA: FACTURA POR FACTURA ORGANIZADA POR CATEGORÍA
  // Anchos de columnas de la tabla de Facturas (suma = 197.9 mm)
  // Fecha: 24 mm
  // N° Factura: 32 mm
  // Proveedor: 62 mm
  // Ítems: 16 mm
  // Origen / Soporte: 31.9 mm
  // Total Factura: 32 mm
  const colW = {
    fecha: 24.0,
    factura: 32.0,
    proveedor: 62.0,
    items: 16.0,
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

  categorySummary.forEach((cat) => {
    const catFacturas = cat.items.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

    // Subencabezado de Categoría (Banda oscura sobria)
    checkSpace(12, true);

    const catHeaderH = 5.2;
    doc.setFillColor(...PDF_COLORS.sectionDark);
    doc.rect(marginX, currentY, contentWidth, catHeaderH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(255, 255, 255);

    const catTitle = `CATEGORÍA: ${cat.name.toUpperCase()} (${catFacturas.length} ${catFacturas.length === 1 ? 'FACTURA' : 'FACTURAS'})`;
    doc.text(fitText(doc, catTitle, contentWidth - 45), marginX + 2, currentY + 3.6);

    const catSubtotalStr = `TOTAL CATEGORÍA: ${formatMoneyCOP(cat.total)}`;
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
    doc.text(`TOTAL ${cat.name.toUpperCase()} (${catFacturas.length} FACTURAS):`, colX.fecha + 2, currentY + 2.9);
    doc.text(formatMoneyCOP(cat.total), colX.total + colW.total - 2, currentY + 2.9, { align: 'right' });

    currentY += subH + 3.0; // Espacio entre categorías
  });

  // 5. Banner final de Total General Consolidado
  checkSpace(7.0);
  doc.setFillColor(...PDF_COLORS.black);
  doc.rect(marginX, currentY, contentWidth, 5.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL GENERAL ENTRADAS POR COMPRAS (${totalFacturas} FACTURAS):`, marginX + 2, currentY + 4.0);
  doc.text(formatMoneyCOP(totalInversion), marginX + contentWidth - 2, currentY + 4.0, { align: 'right' });

  // 6. Aplicar pie de página estándar institucional
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
