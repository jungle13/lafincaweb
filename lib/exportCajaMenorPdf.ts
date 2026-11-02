import { jsPDF } from 'jspdf';
import {
  createLetterPdf,
  drawStandardHeader,
  applyStandardFooters,
  formatMoneyCOP,
  fitText,
  LETTER_WIDTH,
  DEFAULT_MARGIN_X,
  PDF_COLORS,
  DEFAULT_COMPANY_NAME
} from './pdfStandardReport';

export interface LibroCajaDiarioItem {
  id: string;
  dia_mes: number;
  fecha: string;
  responsables_dia?: string;
  total_costos_insumos: number;
  total_gastos_operativos: number;
  total_turnos_nomina: number;
  total_salidas: number;
  total_otros_medios?: number;
  [key: string]: any;
}

export interface LibroCajaKPIsData {
  totalSalidasMes: number;
  totalCostosInsumos: number;
  totalGastosOperativos: number;
  totalTurnosNomina: number;
  totalRegistros?: number;
}

export interface LibroCajaRegistroSimple {
  id?: string;
  categoria?: string;
  valor_pagado?: number;
  clasificacion?: string;
  concepto?: string;
  [key: string]: any;
}

export interface ExportCajaMenorOptions {
  mesLabel: string; // ej: "Octubre 2026"
  diarios: LibroCajaDiarioItem[];
  kpis: LibroCajaKPIsData;
  registros?: LibroCajaRegistroSimple[];
  companyName?: string;
}

/**
 * Genera el documento PDF de Libro de Caja Menor (Resumen Totalizado) garantizando
 * su acomodación precisa en UNA SOLA HOJA DE TAMAÑO CARTA con diseño minimalista monocromático.
 */
export function generateCajaMenorResumenPdf({
  mesLabel,
  diarios,
  kpis,
  registros = [],
  companyName = DEFAULT_COMPANY_NAME
}: ExportCajaMenorOptions): jsPDF {
  const doc = createLetterPdf();
  const marginX = DEFAULT_MARGIN_X;
  const contentWidth = LETTER_WIDTH - (marginX * 2); // 197.9 mm

  // 1. Encabezado institucional estándar
  let currentY = drawStandardHeader(doc, {
    companyName,
    reportTitle: 'LIBRO DE CAJA MENOR — RESUMEN TOTALIZADO',
    periodLabel: mesLabel.toUpperCase(),
    currentPage: 1,
    totalPages: 1,
    marginX,
    pageWidth: LETTER_WIDTH
  });

  currentY += 1.0;

  // 2. Bloque de 4 KPIs / Totales de Categorías (Diseño limpio, marco con líneas delgadas)
  const kpiBoxHeight = 11.5;
  const kpiGap = 2.5;
  const kpiCols = 4;
  const kpiWidth = (contentWidth - (kpiGap * (kpiCols - 1))) / kpiCols;

  const kpiData = [
    {
      title: 'TOTAL SALIDAS CAJA',
      amount: kpis.totalSalidasMes,
      sub: `${kpis.totalRegistros || registros.length} salidas registradas`
    },
    {
      title: '1. INSUMOS POR CAJA',
      amount: kpis.totalCostosInsumos,
      sub: 'Carnes, verduras y servicios'
    },
    {
      title: '2. GASTOS OPERATIVOS',
      amount: kpis.totalGastosOperativos,
      sub: 'Transporte, aseo y varios'
    },
    {
      title: '3. TURNOS Y NÓMINA',
      amount: kpis.totalTurnosNomina,
      sub: 'Pagos y vales de turno'
    }
  ];

  kpiData.forEach((kpi, idx) => {
    const kx = marginX + idx * (kpiWidth + kpiGap);
    
    // Fondo muy claro sobrio
    doc.setFillColor(...PDF_COLORS.subHeaderBg);
    doc.rect(kx, currentY, kpiWidth, kpiBoxHeight, 'F');

    // Borde fino
    doc.setDrawColor(...PDF_COLORS.borderLight);
    doc.setLineWidth(0.18);
    doc.rect(kx, currentY, kpiWidth, kpiBoxHeight, 'S');

    // Título KPI
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(kpi.title, kx + 2, currentY + 3.2);

    // Monto
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.textMain);
    doc.text(formatMoneyCOP(kpi.amount), kx + 2, currentY + 7.4);

    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.0);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(kpi.sub, kx + 2, currentY + 10.2);
  });

  currentY += kpiBoxHeight + 3.0;

  // 3. Mini-Resumen Opcional de Categorías Específicas (si hay registros con categorías)
  const categoryTotals: Record<string, { count: number; total: number }> = {};
  registros.forEach((r) => {
    const cat = (r.categoria || 'Varios').trim();
    if (!categoryTotals[cat]) categoryTotals[cat] = { count: 0, total: 0 };
    categoryTotals[cat].count += 1;
    categoryTotals[cat].total += Number(r.valor_pagado || 0);
  });

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6); // Top 6 categorías principales

  if (sortedCategories.length > 0) {
    const catH = 4.2;
    doc.setFillColor(...PDF_COLORS.sectionDark);
    doc.rect(marginX, currentY, contentWidth, catH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(255, 255, 255);
    doc.text('RESUMEN DE PRINCIPALES CATEGORÍAS DE EGRESOS', marginX + 2, currentY + 2.9);

    currentY += catH + 0.8;

    // Fila con las categorías en línea
    const itemW = contentWidth / sortedCategories.length;
    sortedCategories.forEach(([catName, info], i) => {
      const ix = marginX + i * itemW;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.4);
      doc.setTextColor(...PDF_COLORS.textMain);
      doc.text(fitText(doc, catName.toUpperCase(), itemW - 3), ix + 1.5, currentY + 2.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(...PDF_COLORS.textBody);
      doc.text(`${info.count} vales: ${formatMoneyCOP(info.total)}`, ix + 1.5, currentY + 5.5);
    });

    currentY += 7.0;
  }

  // 4. Tabla de Detalle Diario Totalizado
  // Calculamos el alto de fila según la cantidad de días para que SIEMPRE quepa en 1 sola hoja Carta
  const sortedDiarios = [...diarios].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const numRows = Math.max(sortedDiarios.length, 1);

  // Espacio disponible para la tabla antes del pie de página y firmas:
  // Carta: 279.4, pie: 275.5, firmas: 20 mm => Límite inferior ~250 mm
  const availableTableHeight = 250 - currentY;
  const headerHeight = 5.0;
  const subtotalHeight = 5.5;
  const remainingForRows = availableTableHeight - headerHeight - subtotalHeight;
  // Alto de fila calculado dinámicamente entre 3.6 mm y 4.8 mm
  const rowHeight = Math.min(4.8, Math.max(3.6, remainingForRows / (numRows + 1)));

  // Anchos de columnas de la tabla diaria (suma = 197.9 mm)
  // 1. Fecha / Día: 32 mm
  // 2. Encargadas: 45.9 mm
  // 3. Insumos: 30 mm
  // 4. Gastos Op.: 30 mm
  // 5. Turnos: 30 mm
  // 6. Total Salidas: 30 mm
  const colW = {
    fecha: 32,
    encargadas: 45.9,
    insumos: 30,
    gastos: 30,
    turnos: 30,
    total: 30
  };

  const colX = {
    fecha: marginX,
    encargadas: marginX + colW.fecha,
    insumos: marginX + colW.fecha + colW.encargadas,
    gastos: marginX + colW.fecha + colW.encargadas + colW.insumos,
    turnos: marginX + colW.fecha + colW.encargadas + colW.insumos + colW.gastos,
    total: marginX + colW.fecha + colW.encargadas + colW.insumos + colW.gastos + colW.turnos
  };

  // Encabezado de la Tabla
  doc.setFillColor(...PDF_COLORS.sectionDark);
  doc.rect(marginX, currentY, contentWidth, headerHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(255, 255, 255);

  doc.text('FECHA / DÍA', colX.fecha + 2, currentY + 3.4);
  doc.text('ENCARGADAS / RESPONSABLES', colX.encargadas + 2, currentY + 3.4);
  doc.text('INSUMOS', colX.insumos + colW.insumos - 2, currentY + 3.4, { align: 'right' });
  doc.text('GASTOS OP.', colX.gastos + colW.gastos - 2, currentY + 3.4, { align: 'right' });
  doc.text('TURNOS Y NÓMINA', colX.turnos + colW.turnos - 2, currentY + 3.4, { align: 'right' });
  doc.text('TOTAL SALIDAS', colX.total + colW.total - 2, currentY + 3.4, { align: 'right' });

  currentY += headerHeight;

  // Filas Diarias
  let sumInsumos = 0;
  let sumGastos = 0;
  let sumTurnos = 0;
  let sumTotalSalidas = 0;

  sortedDiarios.forEach((d, idx) => {
    const isAlt = idx % 2 === 1;
    if (isAlt) {
      doc.setFillColor(...PDF_COLORS.rowAlt);
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_COLORS.textMain);
    const diaLabel = `Día ${String(d.dia_mes).padStart(2, '0')} (${d.fecha})`;
    doc.text(diaLabel, colX.fecha + 2, currentY + (rowHeight * 0.7));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    doc.setTextColor(...PDF_COLORS.textBody);
    const respStr = fitText(doc, d.responsables_dia || 'Caja General', colW.encargadas - 3);
    doc.text(respStr, colX.encargadas + 2, currentY + (rowHeight * 0.7));

    // Insumos
    const valInsumos = Number(d.total_costos_insumos || 0);
    sumInsumos += valInsumos;
    doc.text(formatMoneyCOP(valInsumos), colX.insumos + colW.insumos - 2, currentY + (rowHeight * 0.7), { align: 'right' });

    // Gastos Operativos
    const valGastos = Number(d.total_gastos_operativos || 0);
    sumGastos += valGastos;
    doc.text(formatMoneyCOP(valGastos), colX.gastos + colW.gastos - 2, currentY + (rowHeight * 0.7), { align: 'right' });

    // Turnos
    const valTurnos = Number(d.total_turnos_nomina || 0);
    sumTurnos += valTurnos;
    doc.text(formatMoneyCOP(valTurnos), colX.turnos + colW.turnos - 2, currentY + (rowHeight * 0.7), { align: 'right' });

    // Total Salidas
    const valTotal = Number(d.total_salidas || 0);
    sumTotalSalidas += valTotal;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.textMain);
    doc.text(formatMoneyCOP(valTotal), colX.total + colW.total - 2, currentY + (rowHeight * 0.7), { align: 'right' });

    // Línea divisoria muy sutil
    doc.setDrawColor(...PDF_COLORS.borderSubtle);
    doc.setLineWidth(0.08);
    doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

    currentY += rowHeight;
  });

  // Fila de TOTALES DEL MES
  doc.setFillColor(...PDF_COLORS.categoryGray);
  doc.rect(marginX, currentY, contentWidth, subtotalHeight, 'F');

  // Línea divisoria superior de totales
  doc.setDrawColor(...PDF_COLORS.borderMedium);
  doc.setLineWidth(0.25);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(...PDF_COLORS.textMain);

  doc.text(`TOTAL CONSOLIDADO (${sortedDiarios.length} DÍAS):`, colX.fecha + 2, currentY + 3.8);
  doc.text(formatMoneyCOP(sumInsumos), colX.insumos + colW.insumos - 2, currentY + 3.8, { align: 'right' });
  doc.text(formatMoneyCOP(sumGastos), colX.gastos + colW.gastos - 2, currentY + 3.8, { align: 'right' });
  doc.text(formatMoneyCOP(sumTurnos), colX.turnos + colW.turnos - 2, currentY + 3.8, { align: 'right' });
  doc.text(formatMoneyCOP(sumTotalSalidas), colX.total + colW.total - 2, currentY + 3.8, { align: 'right' });

  currentY += subtotalHeight + 4.0;

  // 5. Bloque de Firmas y Control Interno (al pie de la hoja)
  if (currentY < 252) {
    const firmaY = Math.max(currentY, 250);
    const firmaWidth = 60;
    
    // Firma 1: Responsable de Caja
    doc.setDrawColor(...PDF_COLORS.borderMedium);
    doc.setLineWidth(0.2);
    doc.line(marginX + 15, firmaY, marginX + 15 + firmaWidth, firmaY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text('RESPONSABLE DE CAJA MENOR', marginX + 15 + (firmaWidth / 2), firmaY + 3.2, { align: 'center' });
    doc.text('Revisión y Conteo de Vales', marginX + 15 + (firmaWidth / 2), firmaY + 5.8, { align: 'center' });

    // Firma 2: Administración / Gerencia
    const firma2X = marginX + contentWidth - firmaWidth - 15;
    doc.line(firma2X, firmaY, firma2X + firmaWidth, firmaY);
    doc.text('ADMINISTRACIÓN / AUDITORÍA', firma2X + (firmaWidth / 2), firmaY + 3.2, { align: 'center' });
    doc.text('Vo.Bo. Contabilidad y Costos', firma2X + (firmaWidth / 2), firmaY + 5.8, { align: 'center' });
  }

  // 6. Aplicar pie de página institucional
  applyStandardFooters(doc, companyName, 'Libro de Caja Menor • Reporte Oficial de Cierre');

  return doc;
}

/**
 * Descarga directamente el PDF de Resumen Totalizado de Caja Menor en el cliente.
 */
export function downloadCajaMenorResumenPdf(options: ExportCajaMenorOptions): void {
  const doc = generateCajaMenorResumenPdf(options);
  const safeLabel = (options.mesLabel || 'Mes').replace(/\s+/g, '_');
  const fileName = `Libro_Caja_Menor_Resumen_Totalizado_${safeLabel}.pdf`;
  doc.save(fileName);
}
