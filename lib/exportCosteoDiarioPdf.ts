import { jsPDF } from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import {
  LETTER_WIDTH,
  LETTER_HEIGHT,
  DEFAULT_MARGIN_X,
  DEFAULT_COMPANY_NAME,
  PDF_COLORS,
  formatMoneyCOP,
  formatLongSpanishDate
} from './pdfStandardReport';

export interface CosteoPdfRegistro {
  id?: string;
  tipo?: string;
  cantidad?: number;
  total?: number;
  costoUnitario?: number;
  unidad?: string;
  observaciones?: string;
  [key: string]: any;
}

export interface CosteoPdfItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  registros?: CosteoPdfRegistro[];
  [key: string]: any;
}

export interface CosteoPdfCategory {
  id: string;
  name: string;
  items: CosteoPdfItem[];
  subtotal?: number;
  itemsCount?: number;
}

export interface CosteoPdfSheet {
  id: string;
  title: string;
  dateStr: string;
  categories: CosteoPdfCategory[];
  posSales?: number;
  [key: string]: any;
}

export interface CosteoPdfSelection {
  apertura: boolean;
  movimientos: boolean;
  incluirAperturaEnMovimientos: boolean;
  devoluciones: boolean;
  cierre: boolean;
  consumos: boolean;
  bodegaCierre: boolean;
}

export interface ExportCosteoDiarioPdfOptions {
  sheet: CosteoPdfSheet;
  selection: CosteoPdfSelection;
  companyName?: string;
}

interface ParsedSectionItem {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface ParsedSectionCategory {
  name: string;
  items: ParsedSectionItem[];
  subtotal: number;
}

interface ParsedSectionResult {
  categories: ParsedSectionCategory[];
  grandTotal: number;
  itemsCount: number;
}

/**
 * Limpia nombres de insumos eliminando trazas internas de Excel, rutas CamScanner
 * o paréntesis repetitivos que no aportan valor en el informe gerencial.
 */
function cleanInsumoNameForPdf(rawName: string): string {
  if (!rawName) return 'Insumo';
  return rawName
    .replace(/\s*\((?:Mov|Amanece|Cocina|Cierre|Soporte|Factura|CamScanner|FVE|REM|Reporte|f[íi]sicos?)[\s\S]*?\)/gi, '')
    .replace(/\s*-\s*[^-]*\b(?:\d+(?:[.,]\d+)?\s*(?:kg|kls|kilos|unds|und|paq|bolsas|bolsa|porc|tarros|tarro|atado))\b[\s\S]*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || rawName.trim();
}

/**
 * Extrae y agrupa por categoría los registros de uno o más tipos operativos.
 */
function extractSectionData(sheet: CosteoPdfSheet, allowedTypes: string[]): ParsedSectionResult {
  const categories: ParsedSectionCategory[] = [];
  let grandTotal = 0;
  let itemsCount = 0;

  (sheet.categories || []).forEach((cat) => {
    const parsedItems: ParsedSectionItem[] = [];
    let catSubtotal = 0;

    (cat.items || []).forEach((item) => {
      const regs = (item.registros || []).filter((r) => allowedTypes.includes(r.tipo || ''));
      if (regs.length === 0) return;

      const qty = regs.reduce((sum, r) => sum + Number(r.cantidad || 0), 0);
      const total = regs.reduce((sum, r) => sum + Number(r.total || 0), 0);

      if (qty <= 0 && total <= 0) return;

      const unit = regs[0]?.unidad || item.unit || 'Und';
      const unitPrice = qty > 0
        ? Math.round(total / qty)
        : Math.round(Number(regs[0]?.costoUnitario || item.unitPrice || 0));

      parsedItems.push({
        name: cleanInsumoNameForPdf(item.name),
        qty: Number(qty.toFixed(2)),
        unit,
        unitPrice,
        total: Math.round(total),
      });

      catSubtotal += total;
      itemsCount++;
    });

    if (parsedItems.length > 0) {
      categories.push({
        name: cat.name,
        items: parsedItems,
        subtotal: Math.round(catSubtotal),
      });
      grandTotal += catSubtotal;
    }
  });

  return {
    categories,
    grandTotal: Math.round(grandTotal),
    itemsCount,
  };
}

function formatQty(qty: number): string {
  if (Number.isInteger(qty)) return String(qty);
  return qty.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/**
 * Genera el documento PDF de la Hoja de Costeo Diario con liquidación ejecutiva,
 * comparativo contra ventas, rendimiento y las secciones seleccionadas por el usuario.
 */
export function generateCosteoDiarioPdf({
  sheet,
  selection,
  companyName = DEFAULT_COMPANY_NAME,
}: ExportCosteoDiarioPdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const marginX = DEFAULT_MARGIN_X;
  const usableWidth = LETTER_WIDTH - marginX * 2; // 197.9 mm
  const dateFormatted = formatLongSpanishDate(sheet.dateStr);
  const now = new Date();
  const emisionStr = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  // 1. Calcular totales oficiales del día (sin doble conteo)
  const aperturaData = extractSectionData(sheet, ['INVENTARIO_INICIAL_COCINA']);
  const trasladosData = extractSectionData(sheet, ['BODEGA_A_COCINA']);
  const devolucionesData = extractSectionData(sheet, ['DEVOLUCION_COCINA']);
  const cierreData = extractSectionData(sheet, ['COCINA_CIERRE']);
  const consumosData = extractSectionData(sheet, ['CONSUMO']);
  const bodegaCierreData = extractSectionData(sheet, ['BODEGA_CIERRE']);

  const costoApertura = aperturaData.grandTotal;
  const costoTraslados = trasladosData.grandTotal;
  const totalDevoluciones = devolucionesData.grandTotal;
  const costoCierre = cierreData.grandTotal;
  const costoConsumos = consumosData.grandTotal;

  const costoCocinaSinConsumos = Math.max(
    0,
    costoApertura + costoTraslados - totalDevoluciones - costoCierre
  );
  const consumosAplicados = selection.consumos ? costoConsumos : 0;
  const costeoRealTotal = costoCocinaSinConsumos + consumosAplicados;

  const ventasDia = Math.round(Number(sheet.posSales || 0));
  const rendimientoDia = ventasDia - costeoRealTotal;
  const foodCostPct = ventasDia > 0 ? (costeoRealTotal / ventasDia) * 100 : 0;

  // 2. Encabezado Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.black);
  doc.text(companyName.toUpperCase(), marginX, 11);

  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_COLORS.sectionDark);
  doc.text('INFORME DIARIO DE COSTEO Y LIQUIDACIÓN', marginX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text(`Fecha del Informe: ${dateFormatted}   |   Generado: ${emisionStr}`, marginX, 20.5);

  doc.setDrawColor(...PDF_COLORS.borderDark);
  doc.setLineWidth(0.4);
  doc.line(marginX, 22.5, LETTER_WIDTH - marginX, 22.5);

  let currentY = 26;

  // 3. Cuadro Resumen Ejecutivo (Liquidación vs Ventas y Rendimiento)
  const boxGap = 5.9;
  const boxWidth = (usableWidth - boxGap) / 2; // 96 mm cada cuadro

  const leftRows: RowInput[] = [
    ['(+) Cocina Apertura', formatMoneyCOP(costoApertura)],
    ['(+) Cocina Movimientos', formatMoneyCOP(costoTraslados)],
  ];
  if (totalDevoluciones > 0) {
    leftRows.push(['(-) Devoluciones a Bodega', `-${formatMoneyCOP(totalDevoluciones)}`]);
  }
  leftRows.push(
    ['(-) Cocina Cierre', `-${formatMoneyCOP(costoCierre)}`],
    [
      { content: '(=) Costeo Real de Cocina', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
      { content: formatMoneyCOP(costoCocinaSinConsumos), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } }
    ]
  );
  if (selection.consumos) {
    leftRows.push(['(+) Consumos Internos', formatMoneyCOP(costoConsumos)]);
  }
  leftRows.push([
    {
      content: '(=) COSTEO REAL TOTAL',
      styles: { fontStyle: 'bold', fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    },
    {
      content: formatMoneyCOP(costeoRealTotal),
      styles: { fontStyle: 'bold', fillColor: [30, 41, 59], textColor: [255, 255, 255], halign: 'right' },
    },
  ]);

  const rightRows: RowInput[] = [
    [
      { content: 'Ventas Totales del Día (POS)', styles: { fontStyle: 'bold' } },
      { content: formatMoneyCOP(ventasDia), styles: { fontStyle: 'bold', halign: 'right' } },
    ],
    ['(-) Costeo Real de Cocina', `-${formatMoneyCOP(costoCocinaSinConsumos)}`],
  ];
  if (selection.consumos) {
    rightRows.push(['(-) Consumos Internos', `-${formatMoneyCOP(costoConsumos)}`]);
  }
  const rendColor: [number, number, number] = rendimientoDia >= 0 ? [22, 101, 52] : [185, 28, 28];
  const rendBg: [number, number, number] = rendimientoDia >= 0 ? [240, 253, 244] : [254, 242, 242];
  const rendStr = `${rendimientoDia >= 0 ? '' : '-'}${formatMoneyCOP(Math.abs(rendimientoDia))}`;

  rightRows.push(
    [
      {
        content: '(=) RENDIMIENTO DEL DÍA',
        styles: { fontStyle: 'bold', fillColor: rendBg, textColor: rendColor },
      },
      {
        content: rendStr,
        styles: { fontStyle: 'bold', fillColor: rendBg, textColor: rendColor, halign: 'right' },
      },
    ],
    [
      { content: '% Costo sobre Ventas (Food Cost)', styles: { fillColor: [248, 250, 252] } },
      {
        content: ventasDia > 0 ? `${foodCostPct.toFixed(1).replace('.', ',')}%` : 'Sin ventas (0,0%)',
        styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'right' },
      },
    ]
  );

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: LETTER_WIDTH - marginX - boxWidth },
    tableWidth: boxWidth,
    head: [[{ content: 'LIQUIDACIÓN DE COSTEO REAL', colSpan: 2 }]],
    body: leftRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      cellPadding: { top: 1.6, right: 2.2, bottom: 1.6, left: 2.2 },
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 64 },
      1: { cellWidth: 32, halign: 'right' },
    },
  });
  const leftEndY = (doc as any).lastAutoTable?.finalY || currentY + 35;

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX + boxWidth + boxGap, right: marginX },
    tableWidth: boxWidth,
    head: [[{ content: 'VENTAS Y RENDIMIENTO', colSpan: 2 }]],
    body: rightRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      cellPadding: { top: 1.6, right: 2.2, bottom: 1.6, left: 2.2 },
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 64 },
      1: { cellWidth: 32, halign: 'right' },
    },
  });
  const rightEndY = (doc as any).lastAutoTable?.finalY || currentY + 35;

  currentY = Math.max(leftEndY, rightEndY) + 7;

  // 4. Helper para renderizar cada sección tabular seleccionada
  function renderSectionBlock(
    title: string,
    subtitle: string,
    data: ParsedSectionResult,
    totalLabel: string,
    isDiscount: boolean = false
  ) {
    if (currentY > LETTER_HEIGHT - 38) {
      doc.addPage();
      currentY = 14;
    }

    // Banner de título + subtítulo corto
    const bannerH = 9.5;
    doc.setFillColor(30, 41, 59);
    doc.rect(marginX, currentY, usableWidth, bannerH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), marginX + 2.5, currentY + 4.2);

    const totalText = `${isDiscount && data.grandTotal > 0 ? '-' : ''}${formatMoneyCOP(data.grandTotal)}`;
    doc.text(totalText, LETTER_WIDTH - marginX - 2.5, currentY + 4.2, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225);
    doc.text(subtitle, marginX + 2.5, currentY + 7.8);

    currentY += bannerH;

    if (data.categories.length === 0) {
      autoTable(doc, {
        startY: currentY,
        margin: { left: marginX, right: marginX },
        tableWidth: usableWidth,
        body: [[{
          content: 'Sin registros cargados en esta sección para la fecha seleccionada ($0).',
          styles: { halign: 'center', textColor: [100, 116, 139], fontStyle: 'italic', fillColor: [248, 250, 252] }
        }]],
        theme: 'grid',
        bodyStyles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.15 },
      });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY + 8) + 6;
      return;
    }

    const bodyRows: RowInput[] = [];
    data.categories.forEach((cat) => {
      // Fila sub-encabezado de categoría
      bodyRows.push([
        {
          content: `${cat.name.toUpperCase()} (${cat.items.length})`,
          colSpan: 4,
          styles: {
            fillColor: [226, 232, 240],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 7.2,
          },
        },
        {
          content: formatMoneyCOP(cat.subtotal),
          styles: {
            fillColor: [226, 232, 240],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 7.2,
            halign: 'right',
          },
        },
      ]);

      cat.items.forEach((it) => {
        bodyRows.push([
          formatQty(it.qty),
          it.unit,
          it.name,
          formatMoneyCOP(it.unitPrice),
          formatMoneyCOP(it.total),
        ]);
      });
    });

    // Fila de Total de Sección
    bodyRows.push([
      {
        content: totalLabel.toUpperCase(),
        colSpan: 4,
        styles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'right',
        },
      },
      {
        content: totalText,
        styles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 7.8,
          halign: 'right',
        },
      },
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginX, right: marginX, top: 12, bottom: 14 },
      tableWidth: usableWidth,
      head: [['Cant.', 'Unidad', 'Insumo / Producto', 'Costo Unit.', 'Valor Total']],
      body: bodyRows,
      theme: 'grid',
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [51, 65, 85],
        fontSize: 7,
        fontStyle: 'bold',
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
      },
      bodyStyles: {
        fontSize: 7.2,
        textColor: [15, 23, 42],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        cellPadding: { top: 1.3, right: 2, bottom: 1.3, left: 2 },
      },
      alternateRowStyles: {
        fillColor: [252, 253, 254],
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'right' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 99.9, halign: 'left' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY + 15) + 6;
  }

  // 5. Renderizado condicional en orden lógico
  if (selection.apertura) {
    renderSectionBlock(
      'Cocina Apertura',
      'Inventario físico disponible en cocina al iniciar la jornada.',
      aperturaData,
      'Total Cocina Apertura'
    );
  }

  if (selection.movimientos) {
    if (selection.incluirAperturaEnMovimientos) {
      const movConsolidado = extractSectionData(sheet, ['BODEGA_A_COCINA', 'INVENTARIO_INICIAL_COCINA']);
      renderSectionBlock(
        'Cocina Movimientos (Incluye Apertura)',
        'Insumos trasladados de bodega a cocina sumados al inventario inicial de apertura.',
        movConsolidado,
        'Total Movimientos + Apertura'
      );
    } else {
      renderSectionBlock(
        'Cocina Movimientos',
        'Insumos trasladados desde bodega hacia cocina durante la jornada.',
        trasladosData,
        'Total Cocina Movimientos'
      );
    }
  }

  if (selection.devoluciones) {
    renderSectionBlock(
      'Devoluciones a Bodega',
      'Insumos devueltos desde cocina hacia bodega.',
      devolucionesData,
      'Total Devoluciones',
      true
    );
  }

  if (selection.cierre) {
    renderSectionBlock(
      'Cocina Cierre',
      'Inventario físico que queda en cocina al finalizar la jornada (se descuenta del costo).',
      cierreData,
      'Total Cocina Cierre',
      true
    );
  }

  if (selection.consumos) {
    renderSectionBlock(
      'Consumos Internos',
      'Consumos del personal o cortesías registradas sin venta facturada (se restan de las ventas).',
      consumosData,
      'Total Consumos Internos'
    );
  }

  if (selection.bodegaCierre) {
    renderSectionBlock(
      'Bodega (Cierre)',
      'Inventario físico disponible en bodega general al finalizar la jornada.',
      bodegaCierreData,
      'Total Bodega Cierre'
    );
  }

  // 6. Pie de página en todas las páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_COLORS.borderMedium);
    doc.setLineWidth(0.2);
    doc.line(marginX, LETTER_HEIGHT - 11, LETTER_WIDTH - marginX, LETTER_HEIGHT - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text('La Finca — Sistema de Costeo e Inventario', marginX, LETTER_HEIGHT - 7.5);
    doc.text(`Página ${i} de ${totalPages}`, LETTER_WIDTH - marginX, LETTER_HEIGHT - 7.5, { align: 'right' });
  }

  return doc;
}

export function downloadCosteoDiarioPdf(options: ExportCosteoDiarioPdfOptions): void {
  const doc = generateCosteoDiarioPdf(options);
  doc.save(`Informe_Costeo_${options.sheet.dateStr}.pdf`);
}
