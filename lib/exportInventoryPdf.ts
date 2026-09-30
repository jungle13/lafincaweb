import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InsumoItem } from '@/types';
import { formatMoney } from '@/lib/formatters';

interface GeneratePdfOptions {
  insumos: InsumoItem[];
  periodoNombre: string;
  reportDate: string;
  summary: {
    tBodegaKg: number;
    tBodegaUnd: number;
    tCocinaDiaKg: number;
    tCocinaDiaUnd: number;
    tCostoCocinaDia: number;
    tValorBodega: number;
  };
  filterLabel?: string;
}

export function generateInventoryPdf({
  insumos,
  periodoNombre,
  reportDate,
  summary,
  filterLabel = 'Existencias Bodega (>0)'
}: GeneratePdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Encabezado Oficial
  doc.setFillColor(30, 41, 59); // slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('RESTAURANTE LA FINCA CHOCLOS Y ASADOS', 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('REPORTE OFICIAL DE CONTROL DE EXISTENCIAS E INVENTARIO FÍSICO', 14, 18);

  // Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Periodo: ${periodoNombre}   |   Fecha de Corte y Costos: ${reportDate}   |   Filtro: ${filterLabel}   |   Items: ${insumos.length}`,
    14,
    23
  );

  // Estado y Fecha Emisión
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52); // green-800
  doc.text('ESTADO: VIGENTE', pageWidth - 14, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const now = new Date();
  const fechaEmision = `${now.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(`Emisión: ${fechaEmision}`, pageWidth - 14, 18, { align: 'right' });

  // Línea divisoria
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.line(14, 25, pageWidth - 14, 25);

  // 2. Tarjetas de Resumen Ejecutivo (KPIs)
  const cardWidth = (pageWidth - 28 - 6) / 2;
  const cardY = 28;
  const cardHeight = 16;

  // Tarjeta 1: Bodega
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(14, cardY, cardWidth, cardHeight, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text('VALOR INVENTARIO EN BODEGA', 18, cardY + 5);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`$ ${formatMoney(summary.tValorBodega)}`, 18, cardY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  const bodegaDetail = `${summary.tBodegaKg.toFixed(2)} Kg en bodega  •  ${summary.tBodegaUnd} porciones/unidades`;
  doc.text(bodegaDetail, 18, cardY + 14.5);

  // Tarjeta 2: Cocina (Día/Corte)
  const card2X = 14 + cardWidth + 6;
  doc.setFillColor(254, 243, 199); // amber-100
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(`VALOR INSUMOS EN COCINA (DÍA: ${reportDate})`, card2X + 4, cardY + 5);

  doc.setFontSize(11);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text(`$ ${formatMoney(summary.tCostoCocinaDia)}`, card2X + 4, cardY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text('Entregas netas despachadas a cocina en la fecha seleccionada', card2X + 4, cardY + 14.5);

  // 3. Preparación de Filas de la Tabla
  const tableRows = insumos.map((item, idx) => {
    const tipoMedida = item.tipo_medida || 'KGS_Y_UNIDADES';
    const isContable = tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES';
    const isPaquetes = tipoMedida === 'PAQUETES';
    const isKgsOnly = tipoMedida === 'KGS';
    const unitLabel = isPaquetes ? 'paq' : 'und';

    const bSin = isContable ? '-' : (item.bodega_sin_porc_kg > 0 ? `${item.bodega_sin_porc_kg.toFixed(2)} Kg` : '0.00');
    const totalUnitsBodega = isContable ? (item.bodega_porc_und || item.bodega_sin_porc_kg || 0) : (item.bodega_porc_und || 0);
    const bPorc = isKgsOnly ? '-' : (isContable ? `${totalUnitsBodega} ${unitLabel}` : (item.bodega_porc_und > 0 ? `${item.bodega_porc_und} und (${item.bodega_porc_kg.toFixed(2)}k)` : '0'));
    const totB = isContable ? `${totalUnitsBodega} ${unitLabel}` : `${item.peso_total_bodega_kg.toFixed(2)} Kg`;

    const cocinaUnd = item.cocina_dia_und || 0;
    const cocinaKg = item.cocina_dia_kg || 0;
    let cocinaStr = '0';
    if (isKgsOnly) {
      cocinaStr = cocinaKg > 0 ? `${cocinaKg.toFixed(2)} Kg` : '0';
    } else if (isContable) {
      cocinaStr = cocinaUnd > 0 ? `${cocinaUnd} ${unitLabel}` : '0';
    } else if (cocinaUnd > 0 || cocinaKg > 0) {
      cocinaStr = `${cocinaUnd} und (${cocinaKg.toFixed(2)}k)`;
    }

    const costoCocinaStr = (item.costo_cocina_dia || 0) > 0 ? `$ ${formatMoney(item.costo_cocina_dia || 0)}` : '$ 0';
    const costoUnitStr = `$ ${formatMoney(item.costo_unitario_kg || 0)} / ${isPaquetes ? 'paq' : isContable ? 'und' : 'Kg'}`;

    const valorBodega = isContable 
      ? (totalUnitsBodega * (item.costo_unitario_kg || 0))
      : (item.valor_total_bodega_pesos ?? Math.round((item.peso_total_bodega_kg || 0) * (item.costo_unitario_kg || 0)));
    const valorBodegaStr = `$ ${formatMoney(valorBodega || 0)}`;

    const tipoDesc = isPaquetes ? 'PAQUETES' : isContable ? 'UNIDADES' : isKgsOnly ? 'KILOS' : 'KGS Y UND';

    return [
      `${idx + 1}. ${item.insumo}\n[${item.categoria || ''}] (${tipoDesc})`,
      bSin,
      bPorc,
      totB,
      cocinaStr,
      costoCocinaStr,
      costoUnitStr,
      valorBodegaStr,
    ];
  });

  // 4. Renderizar AutoTable
  autoTable(doc, {
    startY: cardY + cardHeight + 4,
    head: [[
      'Carne / Insumo',
      'Bodega Entero',
      'Bodega Porc.',
      'Total Bodega',
      `Cocina (${reportDate})`,
      'Costo Cocina',
      'Costo Unitario',
      'Valor Inventario Bodega'
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 55 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'center', cellWidth: 32 },
      3: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 32, fillColor: [254, 243, 199] },
      5: { halign: 'right', cellWidth: 28, fontStyle: 'bold', textColor: [180, 83, 9] },
      6: { halign: 'center', cellWidth: 32 },
      7: { halign: 'right', cellWidth: 38, fontStyle: 'bold', fillColor: [241, 245, 249] },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Pie de página con numeración
      const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth - 14, pageHeight - 6, { align: 'right' });
      doc.text('Restaurante La Finca - Software de Control Operativo e Inventario', 14, pageHeight - 6);
    },
    margin: { top: 10, right: 14, bottom: 20, left: 14 },
  });

  // 5. Firmas de Auditoría al Final
  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  const signatureY = finalY + 12 > pageHeight - 20 ? pageHeight - 20 : finalY + 10;

  if (signatureY < pageHeight - 12) {
    const col1X = 35;
    const col2X = pageWidth - 95;
    const lineWidth = 60;

    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(col1X, signatureY, col1X + lineWidth, signatureY);
    doc.line(col2X, signatureY, col2X + lineWidth, signatureY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Responsable de Bodega', col1X + lineWidth / 2, signatureY + 3.5, { align: 'center' });
    doc.text('Auditor / Administración', col2X + lineWidth / 2, signatureY + 3.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Firma y Cédula', col1X + lineWidth / 2, signatureY + 6.5, { align: 'center' });
    doc.text('Firma y Cédula', col2X + lineWidth / 2, signatureY + 6.5, { align: 'center' });
  }

  return doc;
}
