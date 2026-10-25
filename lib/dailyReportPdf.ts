import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney } from './formatters';

interface MovimientoCarne {
  id: string;
  hora: string;
  insumoCodigo: string;
  insumoNombre: string;
  categoria: string;
  cantSinPorcKg: number;
  porcionesUnd: number;
  pesoPorcKg: number;
  totalKg: number;
  costoUnit: number;
  valorTotal: number;
  observaciones: string;
}

interface PlatoCarne {
  id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  valorUnitario: number;
  granTotal: number;
  porcentajeDia: number;
}

export interface DiaControlData {
  fecha: string;
  diaSemana: string;
  movimientosCarnes: MovimientoCarne[];
  platosCarnes: PlatoCarne[];
  costoCarnes: number;
  totalKgCarnes: number;
  totalUndCarnes: number;
  ventaCarnes: number;
  platosVendidosUnd: number;
  ganancia: number;
  margenPct: number;
  foodCostPct: number;
  estadoRentabilidad: 'EXCELENTE' | 'SALUDABLE' | 'ALERTA';
}

export function generateDailyControlPdfClient(dia: DiaControlData) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // 1. Encabezado Oficial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('RESTAURANTE CAMPESTRE LA FINCA CHOCLOS Y ASADOS', 30, 36);

  doc.setFontSize(10.5);
  doc.setTextColor(30, 64, 175); // blue-800
  doc.text('INFORME DIARIO DE CONTROL: COSTO DE CARNES A COCINA VS. VENTAS Y RENTABILIDAD', 30, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Fecha de Auditoría: ${dia.fecha} (${dia.diaSemana}) | Reporte Oficial de Carnes Pasadas a Cocina vs. Ventas`, 30, 66);

  // 2. Tarjetas de Resumen KPI
  const kpiTop = 78;
  const kpiHeight = 44;
  const colW = (pageWidth - 60 - 30) / 4;

  const kpis = [
    { title: 'VENTAS PLATOS CARNE', val: `$${formatMoney(dia.ventaCarnes)}`, sub: `${dia.platosCarnes.length} platos vendidos`, color: [22, 163, 74] },
    { title: 'COSTO CARNES A COCINA', val: `$${formatMoney(dia.costoCarnes)}`, sub: `${dia.movimientosCarnes.length} despachos a cocina`, color: [220, 38, 38] },
    { title: 'GANANCIA BRUTA CARNES', val: `$${formatMoney(dia.ganancia)}`, sub: 'Utilidad neta del día', color: [37, 99, 235] },
    { title: 'MARGEN BRUTO (%)', val: `${dia.margenPct.toFixed(1)}%`, sub: `Food Cost: ${dia.foodCostPct.toFixed(1)}%`, color: [217, 119, 6] },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 30 + idx * (colW + 10);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(x, kpiTop, colW, kpiHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.title, x + 8, kpiTop + 13);

    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, x + 8, kpiTop + 27);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, x + 8, kpiTop + 37);
  });

  let currentY = kpiTop + kpiHeight + 16;

  // 3. TABLA 1: Carnes Pasadas a Cocina
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(`1. CARNES PASADAS A COCINA DESDE BODEGA (${dia.movimientosCarnes.length} MOVIMIENTOS)`, 30, currentY);

  const movsRows = dia.movimientosCarnes.map((m) => [
    m.hora || '12:00',
    m.insumoCodigo,
    m.insumoNombre,
    m.cantSinPorcKg > 0 ? `${m.cantSinPorcKg.toFixed(2)} Kg` : '-',
    m.porcionesUnd > 0 ? `${m.porcionesUnd} und` : '-',
    m.pesoPorcKg > 0 ? `${m.pesoPorcKg.toFixed(2)} Kg` : '-',
    m.totalKg > 0 ? `${m.totalKg.toFixed(2)} Kg` : '-',
    `$${formatMoney(m.costoUnit)}`,
    `$${formatMoney(m.valorTotal)}`
  ]);

  if (movsRows.length === 0) {
    movsRows.push(['-', '-', 'No se registraron traslados a cocina en esta jornada', '-', '-', '-', '-', '-', '$0']);
  }

  // Fila de totales
  const movsFooter = [
    'TOTAL',
    '-',
    `${dia.movimientosCarnes.length} Cortes Pasados a Cocina`,
    '-',
    `${dia.totalUndCarnes} und`,
    '-',
    `${dia.totalKgCarnes.toFixed(2)} Kg`,
    '-',
    `$${formatMoney(dia.costoCarnes)}`
  ];

  autoTable(doc, {
    startY: currentY + 6,
    head: [['Hora', 'Cód.', 'Insumo / Corte Despachado', 'Cant. Kg', 'Porc. (Und)', 'Peso Porc.', 'Total Kg', 'Costo Unit.', 'Subtotal Costo ($)']],
    body: [...movsRows, movsFooter],
    styles: { fontSize: 7, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 40, halign: 'center' },
      1: { cellWidth: 55, halign: 'center' },
      2: { cellWidth: 190 },
      3: { cellWidth: 55, halign: 'right' },
      4: { cellWidth: 55, halign: 'right' },
      5: { cellWidth: 55, halign: 'right' },
      6: { cellWidth: 55, halign: 'right' },
      7: { cellWidth: 65, halign: 'right' },
      8: { cellWidth: 80, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.row.index === movsRows.length) {
        data.cell.styles.fillColor = [254, 243, 199]; // amber-100
        data.cell.styles.textColor = [146, 64, 14]; // amber-800
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 16;

  // Verificar si cabe en la página o agregar nueva
  if (currentY > 440) {
    doc.addPage();
    currentY = 36;
  }

  // 4. TABLA 2: Platos Vendidos de Carne
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 163, 74); // emerald-600
  doc.text(`2. VENTAS DE PLATOS RELACIONADOS CON CARNES (${dia.platosCarnes.length} PLATOS / MENÚ VENDIDOS)`, 30, currentY);

  const platosRows = dia.platosCarnes.map((p) => [
    p.codigo || '-',
    p.nombre,
    `${p.cantidad} und`,
    `$${formatMoney(p.valorUnitario)}`,
    `$${formatMoney(p.granTotal)}`,
    `${p.porcentajeDia.toFixed(1)}%`
  ]);

  if (platosRows.length === 0) {
    platosRows.push(['-', 'No se registraron ventas cárnicas en esta jornada', '0', '$0', '$0', '0%']);
  }

  const platosFooter = [
    'TOTAL',
    `${dia.platosCarnes.length} Platos Vendidos`,
    `${dia.platosVendidosUnd} und`,
    '-',
    `$${formatMoney(dia.ventaCarnes)}`,
    '100.0%'
  ];

  autoTable(doc, {
    startY: currentY + 6,
    head: [['Cód.', 'Plato / Menú Vendido', 'Cant. Vendida (Und)', 'Precio Unitario ($)', 'Gran Total Venta ($)', '% del Día']],
    body: [...platosRows, platosFooter],
    styles: { fontSize: 7, cellPadding: 2.5 },
    headStyles: { fillColor: [6, 95, 70], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 55, halign: 'center' },
      1: { cellWidth: 260 },
      2: { cellWidth: 80, halign: 'right' },
      3: { cellWidth: 85, halign: 'right' },
      4: { cellWidth: 95, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 75, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.row.index === platosRows.length) {
        data.cell.styles.fillColor = [220, 252, 231]; // emerald-100
        data.cell.styles.textColor = [22, 101, 52]; // emerald-800
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 30;
  if (currentY > 520) {
    doc.addPage();
    currentY = 40;
  }

  // 5. Bloque de Firmas
  const sigColW = (pageWidth - 60) / 3;
  const sigs = [
    { title: 'RESPONSABLE BODEGA / DESPACHO', role: 'Entrega de Cortes y Kilos' },
    { title: 'CHEF / JEFE DE COCINA', role: 'Recepción y Transformación' },
    { title: 'ADMINISTRACIÓN / COSTOS', role: 'Auditoría de Ventas y Márgenes' }
  ];

  sigs.forEach((sig, idx) => {
    const x = 30 + idx * sigColW;
    doc.setDrawColor(148, 163, 184);
    doc.line(x + 20, currentY + 25, x + sigColW - 20, currentY + 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(sig.title, x + sigColW / 2, currentY + 36, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sig.role, x + sigColW / 2, currentY + 46, { align: 'center' });
  });

  // Guardar archivo
  doc.save(`INFORME_CONTROL_CARNES_COCINA_${dia.fecha}.pdf`);
}
