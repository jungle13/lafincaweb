import { jsPDF } from 'jspdf';

export interface InsumoRegistro {
  id?: string;
  tipo?: string;
  cantidad?: number;
  total?: number;
  costoUnitario?: number;
  unidad?: string;
  [key: string]: any;
}

export interface InsumoItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  registros?: InsumoRegistro[];
  [key: string]: any;
}

export interface CategoryGroup {
  id: string;
  name: string;
  items: InsumoItem[];
  subtotal?: number;
  itemsCount?: number;
}

export interface CosteoSheet {
  id: string;
  title: string;
  dateStr: string;
  categories: CategoryGroup[];
  posSales?: number;
  [key: string]: any;
}

export interface ExportPdfOptions {
  sheet: CosteoSheet;
  companyName?: string;
  reportTitle?: string;
}

/**
 * Formatea una fecha YYYY-MM-DD a formato extendido legible en español.
 */
export function formatLongSpanishDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  const monthsNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const dayOfWeekNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  // Date in UTC to avoid timezone shift
  const dt = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 12, 0, 0));
  const dayName = dayOfWeekNames[dt.getUTCDay()] || '';
  const monthName = monthsNames[parseInt(m, 10) - 1] || m;
  
  return `${dayName}, ${parseInt(d, 10)} de ${monthName} de ${y}`;
}

/**
 * Genera el documento PDF de Inventario y Cierres en formato Carta (Letter),
 * con flujo vertical de alta densidad en 3 columnas por página y diseño monocromático profesional.
 */
export function generateInventarioConsolidadoPdf({
  sheet,
  companyName = 'RESTAURANTE CHOCLOS Y ASADOS LA FINCA',
  reportTitle = 'INFORME DE INVENTARIO Y CIERRES (BODEGA Y COCINA)'
}: ExportPdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter' // 215.9 x 279.4 mm
  });

  const pageWidth = 215.9;
  const marginX = 9.0;
  const marginTopP1 = 22.0;
  const marginTopOthers = 13.0;
  const marginBottom = 270.0;
  const colGap = 3.5;
  const numCols = 3;
  const usableWidth = pageWidth - (marginX * 2);
  const colWidth = (usableWidth - (colGap * (numCols - 1))) / numCols; // ~63.63 mm

  // Distribución sub-columnas dentro de cada columna de 63.63 mm
  const colOffsets = {
    name: 0.8,
    nameMaxW: 28.2,
    qtyRight: 39.5,
    unitPriceRight: 50.5,
    totalRight: 63.0
  };

  let currentPage = 1;
  let currentCol = 0;
  let currentY = marginTopP1;

  const dateFormatted = formatLongSpanishDate(sheet.dateStr);

  function drawMainHeader() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // slate-900 (negro sólido)
    doc.text(companyName.toUpperCase(), marginX, 9);

    doc.setFontSize(8.5);
    doc.text(reportTitle.toUpperCase(), marginX, 13.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105); // slate-600

    const now = new Date();
    const emisionStr = now.toLocaleDateString('es-CO') + ' ' + now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    doc.text(`Fecha del Cierre: ${dateFormatted}   |   Emisión: ${emisionStr}`, marginX, 17.5);

    doc.text(`Página ${currentPage}`, pageWidth - marginX, 17.5, { align: 'right' });

    // Línea divisoria principal
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.35);
    doc.line(marginX, 19.5, pageWidth - marginX, 19.5);
  }

  function drawSecondaryPageHeader() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${companyName.toUpperCase()} — INVENTARIOS DE CIERRE (${sheet.dateStr})`, marginX, 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Página ${currentPage}`, pageWidth - marginX, 8.5, { align: 'right' });

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.line(marginX, 10.5, pageWidth - marginX, 10.5);
  }

  // Encabezado Página 1
  drawMainHeader();

  function getColX(colIdx: number) {
    return marginX + colIdx * (colWidth + colGap);
  }

  function checkSpace(neededHeight: number, isHeader: boolean = false) {
    const threshold = isHeader ? (neededHeight + 7) : neededHeight;
    if (currentY + threshold > marginBottom) {
      if (currentCol < numCols - 1) {
        currentCol++;
        currentY = (currentPage === 1) ? marginTopP1 : marginTopOthers;
      } else {
        doc.addPage();
        currentPage++;
        currentCol = 0;
        drawSecondaryPageHeader();
        currentY = marginTopOthers;
      }
    }
  }

  function drawMajorSectionHeader(title: string, totalVal?: number) {
    const h = 5.2;
    checkSpace(h + 6, true);
    const x = getColX(currentCol);

    // Barra oscura sobria (estilo corporativo minimalista)
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(x, currentY, colWidth, h, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), x + 1.5, currentY + 3.6);

    if (totalVal !== undefined) {
      const totStr = '$' + Math.round(totalVal).toLocaleString('es-CO');
      doc.text(totStr, x + colWidth - 1.5, currentY + 3.6, { align: 'right' });
    }

    currentY += h + 0.8;
  }

  function drawCategoryHeader(catName: string, count: number, subtotal?: number) {
    const h = 4.2;
    checkSpace(h + 6, true);
    const x = getColX(currentCol);

    // Fondo gris claro sin color saturado
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(x, currentY, colWidth, h, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    const label = `${catName.toUpperCase()} (${count})`;
    doc.text(label, x + 1.2, currentY + 3.0);

    if (subtotal !== undefined && subtotal > 0) {
      const subStr = '$' + Math.round(subtotal).toLocaleString('es-CO');
      doc.text(subStr, x + colWidth - 1.2, currentY + 3.0, { align: 'right' });
    }

    currentY += h + 0.3;

    // Encabezados de columnas de la categoría
    drawTableSubheader();
  }

  function drawTableSubheader() {
    const h = 3.2;
    checkSpace(h);
    const x = getColX(currentCol);

    doc.setFillColor(248, 250, 252);
    doc.rect(x, currentY, colWidth, h, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(71, 85, 105);

    doc.text('INSUMO', x + colOffsets.name, currentY + 2.3);
    doc.text('CANT.', x + colOffsets.qtyRight, currentY + 2.3, { align: 'right' });
    doc.text('UNITARIO', x + colOffsets.unitPriceRight, currentY + 2.3, { align: 'right' });
    doc.text('TOTAL', x + colOffsets.totalRight, currentY + 2.3, { align: 'right' });

    // Línea bajo encabezados
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.15);
    doc.line(x, currentY + h, x + colWidth, currentY + h);

    currentY += h + 0.3;
  }

  function drawItemRow(name: string, qtyStr: string, unitPrice: number, total: number, isAlt: boolean) {
    const h = 3.4;
    checkSpace(h);
    const x = getColX(currentCol);

    if (isAlt) {
      doc.setFillColor(249, 250, 251);
      doc.rect(x, currentY, colWidth, h, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(15, 23, 42);

    // Truncar nombre si sobrepasa el ancho límite de texto
    let displayName = name;
    if (doc.getTextWidth(displayName) > colOffsets.nameMaxW) {
      while (displayName.length > 3 && doc.getTextWidth(displayName + '…') > colOffsets.nameMaxW) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '…';
    }

    doc.text(displayName, x + colOffsets.name, currentY + 2.5);

    doc.setFontSize(5.5);
    doc.setTextColor(51, 65, 85);
    doc.text(qtyStr, x + colOffsets.qtyRight, currentY + 2.5, { align: 'right' });

    doc.setTextColor(71, 85, 105);
    const pStr = '$' + Math.round(unitPrice).toLocaleString('es-CO');
    doc.text(pStr, x + colOffsets.unitPriceRight, currentY + 2.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(15, 23, 42);
    const tStr = '$' + Math.round(total).toLocaleString('es-CO');
    doc.text(tStr, x + colOffsets.totalRight, currentY + 2.5, { align: 'right' });

    // Línea sutil de división
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.08);
    doc.line(x, currentY + h, x + colWidth, currentY + h);

    currentY += h;
  }

  function drawCategorySubtotal(catName: string, subtotal: number) {
    const h = 3.6;
    checkSpace(h);
    const x = getColX(currentCol);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.2);
    doc.line(x, currentY, x + colWidth, currentY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(30, 41, 59);

    const label = `Total ${catName}:`;
    doc.text(label, x + 1.0, currentY + 2.6);

    const valStr = '$' + Math.round(subtotal).toLocaleString('es-CO');
    doc.text(valStr, x + colOffsets.totalRight, currentY + 2.6, { align: 'right' });

    currentY += h + 0.8;
  }

  // --- EXTRACCIÓN Y AGRUPACIÓN DE DATOS ---
  interface ParsedCategory {
    name: string;
    items: {
      name: string;
      qtyStr: string;
      unitPrice: number;
      total: number;
    }[];
    subtotal: number;
  }

  const bodegaCategories: ParsedCategory[] = [];
  let bodegaGrandTotal = 0;

  const cocinaCategories: ParsedCategory[] = [];
  let cocinaGrandTotal = 0;

  (sheet.categories || []).forEach(cat => {
    const bItems: { name: string; qtyStr: string; unitPrice: number; total: number }[] = [];
    let bSub = 0;
    const cItems: { name: string; qtyStr: string; unitPrice: number; total: number }[] = [];
    let cSub = 0;

    (cat.items || []).forEach(it => {
      const regs = it.registros || [];
      const bRegs = regs.filter(r => r.tipo === 'BODEGA_CIERRE');
      const cRegs = regs.filter(r => r.tipo === 'COCINA_CIERRE' || r.tipo === 'CIERRE');

      if (bRegs.length > 0) {
        const bQty = bRegs.reduce((s, r) => s + Number(r.cantidad || 0), 0);
        const bTot = bRegs.reduce((s, r) => s + Number(r.total || 0), 0);
        const bPrice = bQty > 0 ? (bTot / bQty) : (it.unitPrice || 0);
        bItems.push({
          name: it.name,
          qtyStr: `${bQty} ${it.unit || 'Kg'}`,
          unitPrice: bPrice,
          total: bTot
        });
        bSub += bTot;
      }

      if (cRegs.length > 0) {
        const cQty = cRegs.reduce((s, r) => s + Number(r.cantidad || 0), 0);
        const cTot = cRegs.reduce((s, r) => s + Number(r.total || 0), 0);
        const cPrice = cQty > 0 ? (cTot / cQty) : (it.unitPrice || 0);
        cItems.push({
          name: it.name,
          qtyStr: `${cQty} ${it.unit || 'Kg'}`,
          unitPrice: cPrice,
          total: cTot
        });
        cSub += cTot;
      }
    });

    if (bItems.length > 0) {
      bodegaCategories.push({ name: cat.name, items: bItems, subtotal: bSub });
      bodegaGrandTotal += bSub;
    }

    if (cItems.length > 0) {
      cocinaCategories.push({ name: cat.name, items: cItems, subtotal: cSub });
      cocinaGrandTotal += cSub;
    }
  });

  // --- RENDERIZADO 1: BODEGA CIERRE ---
  drawMajorSectionHeader('BODEGA CIERRE', bodegaGrandTotal);

  if (bodegaCategories.length === 0) {
    checkSpace(4);
    const x = getColX(currentCol);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('Sin registros de bodega cierre para esta fecha.', x + 1, currentY + 2.5);
    currentY += 4.5;
  } else {
    bodegaCategories.forEach(cat => {
      drawCategoryHeader(cat.name, cat.items.length, cat.subtotal);
      cat.items.forEach((it, idx) => {
        drawItemRow(it.name, it.qtyStr, it.unitPrice, it.total, idx % 2 === 1);
      });
      drawCategorySubtotal(cat.name, cat.subtotal);
    });
  }

  // --- RENDERIZADO 2: COCINA CIERRE ---
  currentY += 2.0; // Espaciado entre bloques
  drawMajorSectionHeader('COCINA CIERRE', cocinaGrandTotal);

  if (cocinaCategories.length === 0) {
    checkSpace(4);
    const x = getColX(currentCol);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('Sin registros de cocina cierre para esta fecha.', x + 1, currentY + 2.5);
    currentY += 4.5;
  } else {
    cocinaCategories.forEach(cat => {
      drawCategoryHeader(cat.name, cat.items.length, cat.subtotal);
      cat.items.forEach((it, idx) => {
        drawItemRow(it.name, it.qtyStr, it.unitPrice, it.total, idx % 2 === 1);
      });
      drawCategorySubtotal(cat.name, cat.subtotal);
    });
  }

  // --- BANNER FINAL: TOTAL CIERRE CONSOLIDADO ---
  checkSpace(6);
  const xEnd = getColX(currentCol);
  doc.setFillColor(15, 23, 42); // slate-900 sólido
  doc.rect(xEnd, currentY, colWidth, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL CIERRE CONSOLIDADO:', xEnd + 1.5, currentY + 3.8);
  const grandTotStr = '$' + Math.round(bodegaGrandTotal + cocinaGrandTotal).toLocaleString('es-CO');
  doc.text(grandTotStr, xEnd + colWidth - 1.5, currentY + 3.8, { align: 'right' });

  // Numeración de páginas en pie de página
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Página ${i} de ${totalPages}   •   ${companyName}   •   Documento de Control Interno`,
      pageWidth / 2,
      275.5,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Genera y descarga directamente el archivo PDF de Inventario y Cierres en el navegador del usuario.
 */
export function downloadInventarioConsolidadoPdf(options: ExportPdfOptions): void {
  const doc = generateInventarioConsolidadoPdf(options);
  const dateStr = options.sheet.dateStr || 'hoja';
  const fileName = `Informe_Inventario_Cierres_${dateStr}.pdf`;
  doc.save(fileName);
}
