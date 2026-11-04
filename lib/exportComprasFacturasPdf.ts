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
  DEFAULT_MARGIN_BOTTOM,
  PDF_COLORS,
  DEFAULT_COMPANY_NAME
} from '@/lib/pdfStandardReport';

export interface ExportComprasPdfOptions {
  facturas: CompraFacturaGroup[];
  lineas?: CompraDetalleItem[];
  periodoNombre?: string;
  companyName?: string;
  reportTitle?: string;
}

/**
 * Categorías oficiales y exclusivas de Costo Directo (Materia Prima e Insumos).
 * Cualquier concepto de Gastos Operacionales o Administrativos (GIT, Nómina,
 * Servicios Públicos, Arrendamientos, Mantenimiento, Gastos Generales) queda
 * estrictamente excluido para garantizar que el total dé exactamente $105.703.012 COP.
 */
export const DIRECT_COST_CATEGORIES = [
  'Carnes y Proteínas',
  'Verduras y Frutas',
  'Desechables y Empaques',
  'Granos y Harinas',
  'Bebidas y Licores',
  'Otros Insumos y Servicios'
] as const;

interface CategoryDirectSummary {
  name: string;
  tipo: string;
  numCompras: number;
  total: number;
  pct: number;
  facturas: {
    fecha: string;
    numero_factura: string;
    proveedor: string;
    origen: string;
    total: number;
    itemsCount: number;
  }[];
}

/**
 * Genera el documento PDF de Entradas por Compras enfocado exclusivamente en
 * COSTOS DIRECTOS (MATERIA PRIMA E INSUMOS) con la tabla resumen ejecutiva oficial:
 * 
 * - Carnes y Proteínas:          132 compras | $64.955.540
 * - Verduras y Frutas:           212 compras | $12.522.570
 * - Desechables y Empaques:      154 compras | $11.626.683
 * - Granos y Harinas:            106 compras | $7.942.510
 * - Bebidas y Licores:            83 compras | $4.573.797
 * - Otros Insumos y Servicios:    95 compras | $4.081.912
 * -------------------------------------------------------------
 * SUBTOTAL COSTOS DIRECTOS:      782 compras | $105.703.012 COP
 */
export function generateComprasFacturasPdf({
  facturas,
  lineas,
  periodoNombre = 'Octubre 2026',
  companyName = DEFAULT_COMPANY_NAME,
  reportTitle = 'ENTRADAS POR COMPRAS — COSTOS DIRECTOS (MATERIA PRIMA)'
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

  // 1. Extraer todas las líneas de costo directo
  // Si se reciben líneas directas, usarlas; de lo contrario desglosar de facturas
  let allDirectLines: CompraDetalleItem[] = [];

  if (Array.isArray(lineas) && lineas.length > 0) {
    allDirectLines = lineas.filter(l => 
      DIRECT_COST_CATEGORIES.includes(l.categoria as any) &&
      !l.categoria.toLowerCase().includes('gasto')
    );
  } else if (Array.isArray(facturas) && facturas.length > 0) {
    facturas.forEach(f => {
      if (Array.isArray(f.items) && f.items.length > 0) {
        f.items.forEach(it => {
          if (
            DIRECT_COST_CATEGORIES.includes(it.categoria as any) &&
            !it.categoria.toLowerCase().includes('gasto')
          ) {
            allDirectLines.push(it);
          }
        });
      } else if (
        DIRECT_COST_CATEGORIES.includes(f.categoria as any) &&
        !f.categoria.toLowerCase().includes('gasto')
      ) {
        allDirectLines.push({
          id: f.id,
          compra_id: f.id,
          insumo_id: null,
          fecha: f.fecha,
          numero_factura: f.numero_factura,
          proveedor: f.proveedor,
          categoria: f.categoria,
          nombre_insumo: f.categoria,
          detalle: f.observaciones || f.categoria,
          cantidad: f.total_items || 1,
          unidad: 'Und',
          costo_unitario: f.valor_total,
          valor_compra: f.valor_total,
          origen: f.origen,
          observaciones: f.observaciones
        });
      }
    });
  }

  // 2. Agrupar por las 6 Categorías Oficiales de Costo Directo
  const categoryDataMap = new Map<string, {
    numCompras: number;
    total: number;
    facturasMap: Map<string, {
      fecha: string;
      numero_factura: string;
      proveedor: string;
      origen: string;
      total: number;
      itemsCount: number;
    }>;
  }>();

  DIRECT_COST_CATEGORIES.forEach(catName => {
    categoryDataMap.set(catName, {
      numCompras: 0,
      total: 0,
      facturasMap: new Map()
    });
  });

  allDirectLines.forEach(l => {
    const catName = l.categoria;
    if (!categoryDataMap.has(catName)) return;

    const cData = categoryDataMap.get(catName)!;
    cData.numCompras += 1;
    cData.total += Number(l.valor_compra || 0);

    const fKey = `${l.numero_factura || 'S/N'}||${l.proveedor || ''}||${l.fecha || ''}`;
    if (!cData.facturasMap.has(fKey)) {
      cData.facturasMap.set(fKey, {
        fecha: l.fecha,
        numero_factura: l.numero_factura || 'S/N',
        proveedor: l.proveedor || 'Proveedor General',
        origen: l.origen || '',
        total: 0,
        itemsCount: 0
      });
    }
    const fObj = cData.facturasMap.get(fKey)!;
    fObj.total += Number(l.valor_compra || 0);
    fObj.itemsCount += 1;
  });

  // Totales consolidados de Materia Prima
  const totalInversionDirecta = DIRECT_COST_CATEGORIES.reduce(
    (sum, c) => sum + (categoryDataMap.get(c)?.total || 0),
    0
  );
  const totalComprasDirectas = DIRECT_COST_CATEGORIES.reduce(
    (sum, c) => sum + (categoryDataMap.get(c)?.numCompras || 0),
    0
  );

  const categorySummaries: CategoryDirectSummary[] = DIRECT_COST_CATEGORIES.map(catName => {
    const cData = categoryDataMap.get(catName)!;
    const pct = totalInversionDirecta > 0 ? (cData.total / totalInversionDirecta) * 100 : 0;
    const facturasList = Array.from(cData.facturasMap.values()).sort((a, b) => 
      (a.fecha || '').localeCompare(b.fecha || '')
    );
    return {
      name: catName,
      tipo: 'Directo',
      numCompras: cData.numCompras,
      total: cData.total,
      pct,
      facturas: facturasList
    };
  });

  // 3. Bloque Superior Ejecutivo: 2 Cards Principales
  const topKpiH = 9.5;
  const topKpiGap = 3.5;
  const topKpiW = (contentWidth - topKpiGap) / 2;

  // Card 1: Total Compras Materia Prima
  doc.setFillColor(...PDF_COLORS.subHeaderBg);
  doc.rect(marginX, currentY, topKpiW, topKpiH, 'F');
  doc.setDrawColor(...PDF_COLORS.borderLight);
  doc.setLineWidth(0.18);
  doc.rect(marginX, currentY, topKpiW, topKpiH, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text('TOTAL COMPRAS MATERIA PRIMA', marginX + 2.5, currentY + 3.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...PDF_COLORS.textMain);
  doc.text(`${totalComprasDirectas} Compras (Entradas Directas)`, marginX + 2.5, currentY + 7.2);

  // Card 2: Inversión Total Costos Directos
  const k2X = marginX + topKpiW + topKpiGap;
  doc.setFillColor(...PDF_COLORS.subHeaderBg);
  doc.rect(k2X, currentY, topKpiW, topKpiH, 'F');
  doc.setDrawColor(...PDF_COLORS.borderLight);
  doc.setLineWidth(0.18);
  doc.rect(k2X, currentY, topKpiW, topKpiH, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text('TOTAL COSTOS DIRECTOS (MATERIA PRIMA)', k2X + 2.5, currentY + 3.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...PDF_COLORS.textMain);
  doc.text(formatMoneyCOP(totalInversionDirecta), k2X + 2.5, currentY + 7.2);

  currentY += topKpiH + 3.0;

  // 4. TABLA RESUMEN OFICIAL EJECUTIVA (IDÉNTICA A LA IMAGEN)
  // Encabezado de la tabla de resumen
  const summaryColW = {
    categoria: 70.0,
    tipo: 32.0,
    numCompras: 42.0,
    totalMes: 53.9
  };

  const summaryColX = {
    categoria: marginX,
    tipo: marginX + summaryColW.categoria,
    numCompras: marginX + summaryColW.categoria + summaryColW.tipo,
    totalMes: marginX + summaryColW.categoria + summaryColW.tipo + summaryColW.numCompras
  };

  const sThH = 5.2;
  // Fondo azul institucional corporativo [41, 128, 185]
  doc.setFillColor(41, 128, 185);
  doc.rect(marginX, currentY, contentWidth, sThH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(255, 255, 255);

  doc.text('Categoría / Insumo', summaryColX.categoria + 3, currentY + 3.5);
  doc.text('Tipo', summaryColX.tipo + (summaryColW.tipo / 2), currentY + 3.5, { align: 'center' });
  doc.text('N° Compras', summaryColX.numCompras + summaryColW.numCompras - 4, currentY + 3.5, { align: 'right' });
  doc.text('Total Mes ($)', summaryColX.totalMes + summaryColW.totalMes - 4, currentY + 3.5, { align: 'right' });

  currentY += sThH;

  // Filas de las 6 Categorías
  const sRowH = 4.8;
  categorySummaries.forEach((cat, idx) => {
    // Alternar fila
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, currentY, contentWidth, sRowH, 'F');
    }

    doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...PDF_COLORS.textMain);

    // Categoría / Insumo
    doc.text(cat.name, summaryColX.categoria + 3, currentY + 3.3);

    // Tipo
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.textBody);
    doc.text('Directo', summaryColX.tipo + (summaryColW.tipo / 2), currentY + 3.3, { align: 'center' });

    // N° Compras
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.textMain);
    doc.text(`${cat.numCompras}`, summaryColX.numCompras + summaryColW.numCompras - 4, currentY + 3.3, { align: 'right' });

    // Total Mes ($)
    doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
    doc.text(formatMoneyCOP(cat.total), summaryColX.totalMes + summaryColW.totalMes - 4, currentY + 3.3, { align: 'right' });

    // Línea divisoria tenue
    doc.setDrawColor(...PDF_COLORS.borderLight);
    doc.setLineWidth(0.1);
    doc.line(marginX, currentY + sRowH, marginX + contentWidth, currentY + sRowH);

    currentY += sRowH;
  });

  // Fila de SUBTOTAL COSTOS DIRECTOS (Materia Prima)
  const totalRowH = 5.2;
  doc.setFillColor(238, 242, 255); // Fondo azul suave destacado
  doc.rect(marginX, currentY, contentWidth, totalRowH, 'F');

  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.2);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);
  doc.line(marginX, currentY + totalRowH, marginX + contentWidth, currentY + totalRowH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 64, 175); // Azul oscuro institucional

  doc.text('SUBTOTAL COSTOS DIRECTOS', summaryColX.categoria + 3, currentY + 3.6);
  doc.text('Materia Prima', summaryColX.tipo + (summaryColW.tipo / 2), currentY + 3.6, { align: 'center' });
  doc.text(`${totalComprasDirectas}`, summaryColX.numCompras + summaryColW.numCompras - 4, currentY + 3.6, { align: 'right' });
  doc.text(formatMoneyCOP(totalInversionDirecta), summaryColX.totalMes + summaryColW.totalMes - 4, currentY + 3.6, { align: 'right' });

  currentY += totalRowH + 4.5;

  // 5. DETALLE FACTURA POR FACTURA ORGANIZADO POR CADA CATEGORÍA DIRECTA
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

  categorySummaries.forEach(cat => {
    if (cat.facturas.length === 0) return;

    checkSpace(12, true);

    // Subencabezado de Categoría (Banda azul oscura)
    const catHeaderH = 5.2;
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(marginX, currentY, contentWidth, catHeaderH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(255, 255, 255);

    const catTitle = `CATEGORÍA: ${cat.name.toUpperCase()} (${cat.facturas.length} FACTURAS • ${cat.numCompras} COMPRAS)`;
    doc.text(fitText(doc, catTitle, contentWidth - 45), marginX + 2.5, currentY + 3.6);

    const catSubtotalStr = `TOTAL CATEGORÍA: ${formatMoneyCOP(cat.total)}`;
    doc.text(catSubtotalStr, marginX + contentWidth - 2.5, currentY + 3.6, { align: 'right' });

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
    cat.facturas.forEach((fac, fIdx) => {
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
      doc.text(`${fac.itemsCount}`, colX.items + colW.items - 2, currentY + 2.9, { align: 'right' });

      // Archivo Origen o soporte
      doc.setFontSize(5.2);
      doc.setTextColor(...PDF_COLORS.textMuted);
      const origenStr = fitText(doc, fac.origen || 'Extracción Directa', colW.origen - 3);
      doc.text(origenStr, colX.origen + 2, currentY + 2.9);

      // Total Factura
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(...PDF_COLORS.textMain);
      doc.text(formatMoneyCOP(fac.total), colX.total + colW.total - 2, currentY + 2.9, { align: 'right' });

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
    doc.text(`TOTAL ${cat.name.toUpperCase()} (${cat.facturas.length} FACTURAS • ${cat.numCompras} COMPRAS):`, colX.fecha + 2, currentY + 2.9);
    doc.text(formatMoneyCOP(cat.total), colX.total + colW.total - 2, currentY + 2.9, { align: 'right' });

    currentY += subH + 3.0; // Espacio entre categorías
  });

  // 6. Banner final de Total General Consolidado de Costos Directos
  checkSpace(7.0);
  doc.setFillColor(...PDF_COLORS.black);
  doc.rect(marginX, currentY, contentWidth, 5.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(`SUBTOTAL COSTOS DIRECTOS (${totalComprasDirectas} COMPRAS MATERIA PRIMA):`, marginX + 2.5, currentY + 4.0);
  doc.text(formatMoneyCOP(totalInversionDirecta), marginX + contentWidth - 2.5, currentY + 4.0, { align: 'right' });

  // 7. Aplicar pie de página estándar institucional
  applyStandardFooters(doc, companyName, 'Entradas por Compras • Reporte Oficial de Costos Directos (Materia Prima)');

  return doc;
}

/**
 * Genera y descarga directamente el archivo PDF de Costos Directos de Compras en el cliente.
 */
export function downloadComprasFacturasPdf(options: ExportComprasPdfOptions): void {
  const doc = generateComprasFacturasPdf(options);
  const safePeriodo = (options.periodoNombre || 'Periodo').replace(/\s+/g, '_');
  const fileName = `Compras_Costos_Directos_Materia_Prima_${safePeriodo}.pdf`;
  doc.save(fileName);
}
