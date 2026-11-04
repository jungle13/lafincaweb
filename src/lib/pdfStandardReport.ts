import { jsPDF } from 'jspdf';

/**
 * Constantes geométricas estándar para hojas de reporte en formato Carta (Letter).
 * 215.9 mm ancho x 279.4 mm alto.
 */
export const LETTER_WIDTH = 215.9;
export const LETTER_HEIGHT = 279.4;
export const DEFAULT_MARGIN_X = 9.0;
export const DEFAULT_MARGIN_TOP_P1 = 20.0;
export const DEFAULT_MARGIN_TOP_OTHERS = 13.0;
export const DEFAULT_MARGIN_BOTTOM = 270.0;

export const DEFAULT_COMPANY_NAME = 'RESTAURANTE CHOCLOS Y ASADOS LA FINCA';

/**
 * Paleta de colores minimalista y sobria (escala de grises pizarra profesional).
 * Cero colores chillones ni cards opulentos.
 */
export const PDF_COLORS = {
  black: [15, 23, 42] as [number, number, number],         // slate-900
  sectionDark: [30, 41, 59] as [number, number, number],    // slate-800
  categoryGray: [226, 232, 240] as [number, number, number],// slate-200
  subHeaderBg: [248, 250, 252] as [number, number, number], // slate-50
  rowAlt: [249, 250, 251] as [number, number, number],      // gris tenue alternado
  textMain: [15, 23, 42] as [number, number, number],       // slate-900
  textBody: [51, 65, 85] as [number, number, number],       // slate-700
  textMuted: [100, 116, 139] as [number, number, number],   // slate-500
  borderDark: [51, 65, 85] as [number, number, number],     // slate-700
  borderMedium: [148, 163, 184] as [number, number, number],// slate-400
  borderLight: [226, 232, 240] as [number, number, number], // slate-200
  borderSubtle: [241, 245, 249] as [number, number, number] // slate-100
};

/**
 * Formatea un valor numérico a pesos colombianos sin decimales innecesarios.
 */
export function formatMoneyCOP(val: number | null | undefined): string {
  const num = typeof val === 'number' && !isNaN(val) ? Math.round(val) : 0;
  return '$' + num.toLocaleString('es-CO');
}

/**
 * Formatea una fecha YYYY-MM-DD a formato extendido legible en español.
 */
export function formatLongSpanishDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '';
  const [y, m, d] = dateStr.split('-');
  const monthsNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const dayOfWeekNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  const dt = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 12, 0, 0));
  const dayName = dayOfWeekNames[dt.getUTCDay()] || '';
  const monthName = monthsNames[parseInt(m, 10) - 1] || m;
  
  return `${dayName}, ${parseInt(d, 10)} de ${monthName} de ${y}`;
}

/**
 * Obtiene la fecha y hora de emisión formateada para Colombia.
 */
export function getEmisionString(): string {
  const now = new Date();
  return now.toLocaleDateString('es-CO') + ' ' + now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Trunca un texto con elipsis '…' para garantizar que no desborde un ancho en mm.
 */
export function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text) return '';
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 2 && doc.getTextWidth(truncated + '…') > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

/**
 * Crea una nueva instancia de jsPDF configurada en tamaño Carta Portrait.
 */
export function createLetterPdf(): jsPDF {
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });
}

export interface HeaderOptions {
  companyName?: string;
  reportTitle: string;
  subtitle?: string;
  periodLabel?: string;
  currentPage?: number;
  totalPages?: number;
  marginX?: number;
  pageWidth?: number;
}

/**
 * Dibuja el encabezado minimalista estandarizado para la Página 1.
 * Retorna la coordenada Y donde debe continuar el contenido.
 */
export function drawStandardHeader(doc: jsPDF, opts: HeaderOptions): number {
  const company = opts.companyName || DEFAULT_COMPANY_NAME;
  const marginX = opts.marginX || DEFAULT_MARGIN_X;
  const pageWidth = opts.pageWidth || LETTER_WIDTH;
  const emisionStr = getEmisionString();

  // Nombre de Empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_COLORS.black);
  doc.text(company.toUpperCase(), marginX, 9.0);

  // Título del Informe
  doc.setFontSize(8.5);
  doc.text(opts.reportTitle.toUpperCase(), marginX, 13.5);

  // Metadatos (Período / Emisión / Paginación)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(...PDF_COLORS.textMuted);

  const metaText = opts.subtitle 
    ? opts.subtitle 
    : opts.periodLabel 
      ? `Período / Fecha: ${opts.periodLabel}   |   Emisión: ${emisionStr}`
      : `Emisión: ${emisionStr}`;

  doc.text(metaText, marginX, 17.5);

  if (opts.currentPage !== undefined) {
    const pageText = opts.totalPages ? `Página ${opts.currentPage} de ${opts.totalPages}` : `Página ${opts.currentPage}`;
    doc.text(pageText, pageWidth - marginX, 17.5, { align: 'right' });
  }

  // Línea divisoria principal
  doc.setDrawColor(...PDF_COLORS.borderDark);
  doc.setLineWidth(0.35);
  doc.line(marginX, 19.5, pageWidth - marginX, 19.5);

  return 22.0; // Y inicial recomendado para contenido
}

/**
 * Dibuja el encabezado simplificado para páginas 2 en adelante.
 */
export function drawStandardSecondaryHeader(doc: jsPDF, opts: HeaderOptions): number {
  const company = opts.companyName || DEFAULT_COMPANY_NAME;
  const marginX = opts.marginX || DEFAULT_MARGIN_X;
  const pageWidth = opts.pageWidth || LETTER_WIDTH;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.black);
  doc.text(`${company.toUpperCase()} — ${opts.reportTitle.toUpperCase()}`, marginX, 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(...PDF_COLORS.textMuted);
  if (opts.currentPage !== undefined) {
    const pageText = opts.totalPages ? `Página ${opts.currentPage} de ${opts.totalPages}` : `Página ${opts.currentPage}`;
    doc.text(pageText, pageWidth - marginX, 8.5, { align: 'right' });
  }

  doc.setDrawColor(...PDF_COLORS.borderMedium);
  doc.setLineWidth(0.2);
  doc.line(marginX, 10.5, pageWidth - marginX, 10.5);

  return 13.0; // Y inicial para páginas subsecuentes
}

/**
 * Aplica los pies de página estandarizados en todas las páginas del documento.
 */
export function applyStandardFooters(
  doc: jsPDF, 
  companyName: string = DEFAULT_COMPANY_NAME,
  customNote: string = 'Documento de Control Interno'
): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(
      `Página ${i} de ${totalPages}   •   ${companyName.toUpperCase()}   •   ${customNote}`,
      LETTER_WIDTH / 2,
      275.5,
      { align: 'center' }
    );
  }
}
