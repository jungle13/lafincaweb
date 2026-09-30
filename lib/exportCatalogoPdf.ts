import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney } from '@/lib/formatters';

export type TipoMedida = 'KGS' | 'UNIDADES' | 'KGS_Y_UNIDADES' | 'PAQUETES';

export interface CatalogoInsumoPdfItem {
  id?: string;
  codigo?: string;
  nombre: string;
  categoria?: string;
  unidad_medida?: string;
  tipo_medida?: TipoMedida | string;
  peso_estandar_porcion_kg?: number;
  costo_unitario_kg?: number;
  stock_minimo_kg?: number;
  es_carne?: boolean;
  activo?: boolean;
  observaciones?: string;
}

export interface GenerateCatalogoPdfOptions {
  insumos: CatalogoInsumoPdfItem[];
  categoryFilter?: string;
  searchQuery?: string;
  reportTitle?: string;
}

export function generateCatalogoPdf({
  insumos,
  categoryFilter = 'ALL',
  searchQuery = '',
  reportTitle = 'CATÁLOGO MAESTRO DE CARNES, PESCADOS E INSUMOS'
}: GenerateCatalogoPdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const marginX = 14;

  // 1. Encabezado Oficial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('RESTAURANTE LA FINCA CHOCLOS Y ASADOS', marginX, 13);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(reportTitle, marginX, 18.5);

  // Filtro legible
  const catLabel = categoryFilter === 'ALL'
    ? 'Todas las Categorías'
    : categoryFilter === 'CARNES'
    ? '🥩 Solo Carnes Maestras'
    : categoryFilter;

  const searchLabel = searchQuery.trim() ? `  |  Búsqueda: "${searchQuery.trim()}"` : '';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Filtro: ${catLabel}${searchLabel}   |   Total Ítems: ${insumos.length}`,
    marginX,
    23.5
  );

  // Estado y Fecha Emisión a la derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52); // green-800
  doc.text('ESTADO: VIGENTE / OPERATIVO', pageWidth - marginX, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const now = new Date();
  const fechaEmision = `${now.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(`Emisión: ${fechaEmision}`, pageWidth - marginX, 18.5, { align: 'right' });

  // Línea divisoria
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.line(marginX, 25.5, pageWidth - marginX, 25.5);

  // 2. Tarjetas de Resumen Ejecutivo (KPIs)
  const totalCarnes = insumos.filter(i => i.es_carne).length;
  const totalOtros = insumos.length - totalCarnes;
  const categoriasUnicas = new Set(insumos.map(i => i.categoria).filter(Boolean)).size;

  const cardGap = 5;
  const numCards = 4;
  const cardWidth = (pageWidth - (marginX * 2) - (cardGap * (numCards - 1))) / numCards;
  const cardY = 28.5;
  const cardHeight = 15;

  // Tarjeta 1: Total Catálogo
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(marginX, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text('TOTAL INSUMOS CATÁLOGO', marginX + 4, cardY + 4.5);
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`${insumos.length}`, marginX + 4, cardY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Materias primas registradas', marginX + 4, cardY + 13.5);

  // Tarjeta 2: Carnes Maestras
  const card2X = marginX + cardWidth + cardGap;
  doc.setFillColor(254, 242, 242); // red-50
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(239, 68, 68); // red-500
  doc.setLineWidth(0.3);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(185, 28, 28); // red-700
  doc.text('CARNES MAESTRAS', card2X + 4, cardY + 4.5);
  doc.setFontSize(11);
  doc.setTextColor(153, 27, 27); // red-800
  doc.text(`${totalCarnes} cortes`, card2X + 4, cardY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(185, 28, 28);
  doc.text('Control porcionado y mermas', card2X + 4, cardY + 13.5);

  // Tarjeta 3: Insumos y Abarrotes
  const card3X = marginX + (cardWidth + cardGap) * 2;
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(59, 130, 246); // blue-500
  doc.setLineWidth(0.3);
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text('INSUMOS Y ABARROTES', card3X + 4, cardY + 4.5);
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text(`${totalOtros} ítems`, card3X + 4, cardY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(29, 78, 216);
  doc.text('Verduras, embutidos y generales', card3X + 4, cardY + 13.5);

  // Tarjeta 4: Categorías Activas
  const card4X = marginX + (cardWidth + cardGap) * 3;
  doc.setFillColor(240, 253, 244); // green-50
  doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(34, 197, 94); // green-500
  doc.setLineWidth(0.3);
  doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 2, 2, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(21, 128, 61); // green-700
  doc.text('CATEGORÍAS EN REPORTE', card4X + 4, cardY + 4.5);
  doc.setFontSize(11);
  doc.setTextColor(20, 83, 45); // green-900
  doc.text(`${categoriasUnicas} familias`, card4X + 4, cardY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(21, 128, 61);
  doc.text('Estructura de costos asignada', card4X + 4, cardY + 13.5);

  // 3. Preparación de Filas de la Tabla
  const tableRows = insumos.map((item, idx) => {
    const codigo = item.codigo || `INS-${String(idx + 1).padStart(3, '0')}`;
    const nombre = item.nombre;
    const categoria = item.categoria || 'GENERAL';
    const unidad = item.unidad_medida || 'Kg';
    const tipoMedida = item.tipo_medida || 'KGS_Y_UNIDADES';

    let tipoMedidaLabel = 'KGS Y UND';
    if (tipoMedida === 'UNIDADES') tipoMedidaLabel = 'SOLO UNIDADES';
    else if (tipoMedida === 'PAQUETES') tipoMedidaLabel = 'PAQUETES';
    else if (tipoMedida === 'KGS') tipoMedidaLabel = 'SOLO KILOS';

    const pesoStd = item.peso_estandar_porcion_kg || 0;
    const pesoGramos = pesoStd > 0 ? Math.round(pesoStd * 1000) : 0;
    const pesoStdStr = (tipoMedida === 'KGS_Y_UNIDADES' && pesoGramos > 0)
      ? `${pesoGramos} gr`
      : '-';

    const rendTeorico = (tipoMedida === 'KGS_Y_UNIDADES' && pesoStd > 0)
      ? `${(1 / pesoStd).toFixed(1)} porc/Kg`
      : '-';

    const costoBaseStr = (item.costo_unitario_kg || 0) > 0
      ? `$ ${formatMoney(item.costo_unitario_kg || 0)} / ${unidad}`
      : '$ 0';

    return [
      codigo,
      nombre,
      categoria,
      unidad,
      tipoMedidaLabel,
      pesoStdStr,
      rendTeorico,
      costoBaseStr,
    ];
  });

  // 4. Renderizar AutoTable
  autoTable(doc, {
    startY: cardY + cardHeight + 4,
    head: [[
      'CÓDIGO',
      'MATERIA PRIMA / CORTE',
      'CATEGORÍA',
      'UNIDAD',
      'MEDIDA SISTEMA',
      'PESO PORCIÓN',
      'RENDIMIENTO TEÓRICO',
      'COSTO BASE'
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.6,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.6,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24, fontStyle: 'bold' }, // CÓDIGO
      1: { halign: 'left', cellWidth: 65, fontStyle: 'bold' },   // MATERIA PRIMA
      2: { halign: 'left', cellWidth: 36 },                     // CATEGORÍA
      3: { halign: 'center', cellWidth: 18 },                   // UNIDAD
      4: { halign: 'center', cellWidth: 36 },                   // MEDIDA SISTEMA
      5: { halign: 'right', cellWidth: 28 },                    // PESO PORCIÓN (gr)
      6: { halign: 'right', cellWidth: 32 },                    // RENDIMIENTO TEÓRICO
      7: { halign: 'right', cellWidth: 30, fontStyle: 'bold', fillColor: [241, 245, 249] }, // COSTO BASE
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Pie de página
      const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth - marginX, pageHeight - 6, { align: 'right' });
      doc.text('Restaurante La Finca - Software de Control Operativo y Costeo de Carnes e Insumos', marginX, pageHeight - 6);
    },
    margin: { top: 10, right: marginX, bottom: 20, left: marginX },
  });

  // 5. Firmas de Control al Final
  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  const signatureY = finalY + 12 > pageHeight - 20 ? pageHeight - 20 : finalY + 10;

  if (signatureY < pageHeight - 12) {
    const col1X = 40;
    const col2X = pageWidth - 100;
    const lineWidth = 60;

    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(col1X, signatureY, col1X + lineWidth, signatureY);
    doc.line(col2X, signatureY, col2X + lineWidth, signatureY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Responsable de Bodega / Almacén', col1X + lineWidth / 2, signatureY + 3.5, { align: 'center' });
    doc.text('Administración / Gerencia', col2X + lineWidth / 2, signatureY + 3.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Firma y Cédula', col1X + lineWidth / 2, signatureY + 6.5, { align: 'center' });
    doc.text('Firma y Cédula', col2X + lineWidth / 2, signatureY + 6.5, { align: 'center' });
  }

  return doc;
}
