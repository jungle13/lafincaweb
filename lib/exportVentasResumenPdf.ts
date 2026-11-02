import { jsPDF } from 'jspdf';
import { VentaDiaria, VentasKPIs } from '@/services/ventasService';
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

export interface ExportVentasPdfOptions {
  diarias: VentaDiaria[];
  kpis: VentasKPIs;
  periodoNombre?: string;
  companyName?: string;
  reportTitle?: string;
}

/**
 * Genera el documento PDF de Salidas por Venta con diseño minimalista institucional,
 * mostrando únicamente los 4 Cards de KPIs y la tabla de Resumen Diario con el total del día
 * (sin detalle plato por plato).
 */
export function generateVentasResumenPdf({
  diarias,
  kpis,
  periodoNombre = 'Octubre 2026',
  companyName = DEFAULT_COMPANY_NAME,
  reportTitle = 'SALIDAS POR VENTA — RESUMEN DIARIO CONSOLIDADO'
}: ExportVentasPdfOptions): jsPDF {
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
    const threshold = isMajorHeader ? (neededHeight + 7) : neededHeight;
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

  // 1. LOS 4 CARDS DE KPIS (Diseño idéntico al estándar de Compras y Caja Menor)
  const kpiH = 11.5;
  const kpiCols = 4;
  const kpiGap = 2.5;
  const kpiW = (contentWidth - (kpiGap * (kpiCols - 1))) / kpiCols;

  const diaRecordLabel = kpis.diaRecord && kpis.diaRecord.fecha
    ? `${kpis.diaRecord.diaSemana || ''} ${kpis.diaRecord.fecha.split('-')[2]}/${kpis.diaRecord.fecha.split('-')[1]}`.trim()
    : 'N/A';

  const cardsData = [
    {
      title: 'TOTAL FACTURADO',
      val: formatMoneyCOP(kpis.granTotalVentas),
      sub: 'Cobrado a clientes'
    },
    {
      title: 'VENTA NETA',
      val: formatMoneyCOP(kpis.ventaNeta),
      sub: 'Base antes de impuestos'
    },
    {
      title: 'IMPOCONSUMO (8%)',
      val: formatMoneyCOP(kpis.impuesto),
      sub: 'Impuesto al consumo recaudado'
    },
    {
      title: 'DÍA RÉCORD',
      val: formatMoneyCOP(kpis.diaRecord?.total || 0),
      sub: diaRecordLabel !== 'N/A' ? `Pico: ${diaRecordLabel}` : 'Mayor venta del mes'
    }
  ];

  cardsData.forEach((kpi, idx) => {
    const kx = marginX + idx * (kpiW + kpiGap);
    doc.setFillColor(...PDF_COLORS.subHeaderBg);
    doc.rect(kx, currentY, kpiW, kpiH, 'F');

    doc.setDrawColor(...PDF_COLORS.borderLight);
    doc.setLineWidth(0.18);
    doc.rect(kx, currentY, kpiW, kpiH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(kpi.title, kx + 2, currentY + 3.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...PDF_COLORS.textMain);
    doc.text(kpi.val, kx + 2, currentY + 7.4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.0);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(kpi.sub, kx + 2, currentY + 10.2);
  });

  currentY += kpiH + 3.5;

  // 2. TABLA DE RESUMEN DIARIO DE VENTAS (Solo el total del día, sin platos)
  // Ancho total disponible: 197.9 mm
  // Distribución de columnas optimizada para tamaño Carta:
  // 1. FECHA & DÍA: 35.0 mm
  // 2. ARTÍCULOS: 20.0 mm
  // 3. VARIEDAD: 18.0 mm
  // 4. VENTA BRUTA: 28.0 mm
  // 5. DESCUENTOS: 22.0 mm
  // 6. VENTA NETA: 26.0 mm
  // 7. IMPOCONSUMO: 24.0 mm
  // 8. TOTAL DÍA: 24.9 mm
  // Suma = 35 + 20 + 18 + 28 + 22 + 26 + 24 + 24.9 = 197.9 mm
  const colW = {
    fecha: 35.0,
    articulos: 20.0,
    variedad: 18.0,
    bruta: 28.0,
    descuentos: 22.0,
    neta: 26.0,
    impuesto: 24.0,
    total: 24.9
  };

  const colX = {
    fecha: marginX,
    articulos: marginX + colW.fecha,
    variedad: marginX + colW.fecha + colW.articulos,
    bruta: marginX + colW.fecha + colW.articulos + colW.variedad,
    descuentos: marginX + colW.fecha + colW.articulos + colW.variedad + colW.bruta,
    neta: marginX + colW.fecha + colW.articulos + colW.variedad + colW.bruta + colW.descuentos,
    impuesto: marginX + colW.fecha + colW.articulos + colW.variedad + colW.bruta + colW.descuentos + colW.neta,
    total: marginX + colW.fecha + colW.articulos + colW.variedad + colW.bruta + colW.descuentos + colW.neta + colW.impuesto
  };

  // Encabezado de la Sección de Tabla
  const sortedDiarias = [...(diarias || [])].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  const sectionH = 5.2;
  checkSpace(sectionH + 6, true);
  doc.setFillColor(...PDF_COLORS.sectionDark);
  doc.rect(marginX, currentY, contentWidth, sectionH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(`RESUMEN DIARIO DE VENTAS (${sortedDiarias.length} DÍAS AUDITADOS)`, marginX + 2, currentY + 3.6);

  const totalStr = `TOTAL RECAUDADO: ${formatMoneyCOP(kpis.granTotalVentas)}`;
  doc.text(totalStr, marginX + contentWidth - 2, currentY + 3.6, { align: 'right' });

  currentY += sectionH + 0.3;

  // Encabezados de Columnas de la Tabla
  const thH = 4.0;
  doc.setFillColor(...PDF_COLORS.categoryGray);
  doc.rect(marginX, currentY, contentWidth, thH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...PDF_COLORS.textMain);

  doc.text('FECHA & DÍA', colX.fecha + 2, currentY + 2.7);
  doc.text('ARTÍCULOS', colX.articulos + colW.articulos - 2, currentY + 2.7, { align: 'right' });
  doc.text('VARIEDAD', colX.variedad + colW.variedad - 2, currentY + 2.7, { align: 'right' });
  doc.text('VENTA BRUTA', colX.bruta + colW.bruta - 2, currentY + 2.7, { align: 'right' });
  doc.text('DESCUENTOS', colX.descuentos + colW.descuentos - 2, currentY + 2.7, { align: 'right' });
  doc.text('VENTA NETA', colX.neta + colW.neta - 2, currentY + 2.7, { align: 'right' });
  doc.text('IMPOCONSUMO', colX.impuesto + colW.impuesto - 2, currentY + 2.7, { align: 'right' });
  doc.text('TOTAL DÍA', colX.total + colW.total - 2, currentY + 2.7, { align: 'right' });

  doc.setDrawColor(...PDF_COLORS.borderMedium);
  doc.setLineWidth(0.18);
  doc.line(marginX, currentY + thH, marginX + contentWidth, currentY + thH);

  currentY += thH + 0.3;

  // Filas Diarias
  let sumArticulos = 0;
  let sumBruta = 0;
  let sumDescuentos = 0;
  let sumNeta = 0;
  let sumImpuesto = 0;
  let sumGranTotal = 0;

  if (sortedDiarias.length === 0) {
    checkSpace(8);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text('No hay registros de ventas diarias en este período.', marginX + 2, currentY + 4);
    currentY += 8;
  } else {
    // Calculamos el alto de fila dinámico para que si son hasta 31 días quepa holgadamente
    const availableForRows = 250 - currentY;
    const calcRowH = Math.min(4.8, Math.max(3.8, availableForRows / (sortedDiarias.length + 1)));
    const rowH = sortedDiarias.length <= 31 ? calcRowH : 4.4;

    sortedDiarias.forEach((d, idx) => {
      checkSpace(rowH);

      if (idx % 2 === 1) {
        doc.setFillColor(...PDF_COLORS.rowAlt);
        doc.rect(marginX, currentY, contentWidth, rowH, 'F');
      }

      // Fecha & Día de la Semana
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.6);
      doc.setTextColor(...PDF_COLORS.textMain);
      const diaLabel = `${d.fecha} • ${d.dia_semana || ''}`;
      doc.text(fitText(doc, diaLabel, colW.fecha - 3), colX.fecha + 2, currentY + (rowH * 0.7));

      // Artículos
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.4);
      doc.setTextColor(...PDF_COLORS.textBody);
      const arts = Number(d.total_articulos || 0);
      sumArticulos += arts;
      doc.text(`${arts.toLocaleString('es-CO')} uds`, colX.articulos + colW.articulos - 2, currentY + (rowH * 0.7), { align: 'right' });

      // Variedad de platos
      const variedad = Number(d.total_platos_distintos || 0);
      doc.text(`${variedad} ítems`, colX.variedad + colW.variedad - 2, currentY + (rowH * 0.7), { align: 'right' });

      // Venta Bruta
      const vBruta = Number(d.venta_bruta || 0);
      sumBruta += vBruta;
      doc.text(formatMoneyCOP(vBruta), colX.bruta + colW.bruta - 2, currentY + (rowH * 0.7), { align: 'right' });

      // Descuentos
      const desc = Number(d.descuento || 0);
      sumDescuentos += desc;
      doc.setTextColor(desc > 0 ? 185 : 71, desc > 0 ? 28 : 85, desc > 0 ? 28 : 105);
      doc.text(desc > 0 ? `-${formatMoneyCOP(desc)}` : '$0', colX.descuentos + colW.descuentos - 2, currentY + (rowH * 0.7), { align: 'right' });

      // Venta Neta
      doc.setTextColor(...PDF_COLORS.textBody);
      const vNeta = Number(d.venta_neta || 0);
      sumNeta += vNeta;
      doc.text(formatMoneyCOP(vNeta), colX.neta + colW.neta - 2, currentY + (rowH * 0.7), { align: 'right' });

      // Impoconsumo 8%
      const imp = Number(d.impuesto || 0);
      sumImpuesto += imp;
      doc.text(formatMoneyCOP(imp), colX.impuesto + colW.impuesto - 2, currentY + (rowH * 0.7), { align: 'right' });

      // Gran Total del Día
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(...PDF_COLORS.textMain);
      const totDia = Number(d.gran_total || 0);
      sumGranTotal += totDia;
      doc.text(formatMoneyCOP(totDia), colX.total + colW.total - 2, currentY + (rowH * 0.7), { align: 'right' });

      // Línea divisoria muy fina
      doc.setDrawColor(...PDF_COLORS.borderSubtle);
      doc.setLineWidth(0.08);
      doc.line(marginX, currentY + rowH, marginX + contentWidth, currentY + rowH);

      currentY += rowH;
    });

    // Fila de TOTALES CONSOLIDADOS DEL MES
    const subH = 5.2;
    checkSpace(subH);
    doc.setFillColor(...PDF_COLORS.categoryGray);
    doc.rect(marginX, currentY, contentWidth, subH, 'F');

    doc.setDrawColor(...PDF_COLORS.borderMedium);
    doc.setLineWidth(0.25);
    doc.line(marginX, currentY, marginX + contentWidth, currentY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(...PDF_COLORS.textMain);

    doc.text(`TOTAL CONSOLIDADO (${sortedDiarias.length} DÍAS):`, colX.fecha + 2, currentY + 3.6);
    doc.text(`${sumArticulos.toLocaleString('es-CO')} uds`, colX.articulos + colW.articulos - 2, currentY + 3.6, { align: 'right' });
    doc.text('—', colX.variedad + colW.variedad - 2, currentY + 3.6, { align: 'right' });
    doc.text(formatMoneyCOP(sumBruta), colX.bruta + colW.bruta - 2, currentY + 3.6, { align: 'right' });
    doc.text(sumDescuentos > 0 ? `-${formatMoneyCOP(sumDescuentos)}` : '$0', colX.descuentos + colW.descuentos - 2, currentY + 3.6, { align: 'right' });
    doc.text(formatMoneyCOP(sumNeta), colX.neta + colW.neta - 2, currentY + 3.6, { align: 'right' });
    doc.text(formatMoneyCOP(sumImpuesto), colX.impuesto + colW.impuesto - 2, currentY + 3.6, { align: 'right' });
    doc.text(formatMoneyCOP(sumGranTotal), colX.total + colW.total - 2, currentY + 3.6, { align: 'right' });

    currentY += subH + 4.0;
  }

  // 3. Bloque de Firmas y Control Interno (al pie)
  if (currentY < 252) {
    const firmaY = Math.max(currentY, 250);
    const firmaWidth = 60;

    doc.setDrawColor(...PDF_COLORS.borderMedium);
    doc.setLineWidth(0.2);

    // Firma 1: Auditoría de Ventas / POS
    doc.line(marginX + 15, firmaY, marginX + 15 + firmaWidth, firmaY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text('AUDITORÍA DE VENTAS / POS', marginX + 15 + (firmaWidth / 2), firmaY + 3.2, { align: 'center' });
    doc.text('Conciliación Diaria de Comandas', marginX + 15 + (firmaWidth / 2), firmaY + 5.8, { align: 'center' });

    // Firma 2: Administración / Gerencia
    const firma2X = marginX + contentWidth - firmaWidth - 15;
    doc.line(firma2X, firmaY, firma2X + firmaWidth, firmaY);
    doc.text('ADMINISTRACIÓN / GERENCIA', firma2X + (firmaWidth / 2), firmaY + 3.2, { align: 'center' });
    doc.text('Vo.Bo. Reporte Oficial de Ventas', firma2X + (firmaWidth / 2), firmaY + 5.8, { align: 'center' });
  }

  // 4. Aplicar pie de página estándar institucional
  applyStandardFooters(doc, companyName, 'Salidas por Venta • Resumen Diario Oficial de Cierre');

  return doc;
}

/**
 * Genera y descarga directamente el archivo PDF de Salidas por Venta en el cliente.
 */
export function downloadVentasResumenPdf(options: ExportVentasPdfOptions): void {
  const doc = generateVentasResumenPdf(options);
  const safePeriodo = (options.periodoNombre || 'Periodo').replace(/\s+/g, '_');
  const fileName = `Salidas_Venta_Resumen_Diario_${safePeriodo}.pdf`;
  doc.save(fileName);
}
