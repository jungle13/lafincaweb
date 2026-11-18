'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Printer } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import type { ElianaPosConfig } from '@/lib/posConfig';
import { printThermalTicket } from '@/lib/posHardwareBridge';
import type {
  CierreResumen,
  CorteDepartamento,
  EventoTurno,
  FlujoEfectivoRow,
  PosOrden,
  SesionCaja,
} from './types';

interface PosCashCutViewProps {
  config: ElianaPosConfig;
  cajaNombre: string;
  cajeroNombre: string;
  sesionActiva: SesionCaja | null;
  resumenDia: {
    totalEfectivo: number;
    totalDatafono: number;
    totalTransferencia: number;
    totalCredito?: number;
    totalPropinas: number;
    totalPunto: number;
    totalDomicilios: number;
  };
  salidasDiaCaja: number;
  abonosEfectivoHoy: number;
  entradasEfectivoHoy: number;
  devolucionesEfectivoHoy: number;
  corteDepartamentos: CorteDepartamento[];
  flujoEfectivoDetallado: FlujoEfectivoRow[];
  consumosInternosHoy: PosOrden[];
  gananciaEstimadaHoy: number;
  eventosTurno: EventoTurno[];
  busyAction: boolean;
  onExecuteCierre: (
    tipo: 'CIERRE_PARCIAL_TURNO' | 'CIERRE_TOTAL_CAJA',
    efectivoContado: number,
    observaciones: string
  ) => Promise<CierreResumen | null>;
}

export default function PosCashCutView({
  config,
  cajaNombre,
  cajeroNombre,
  sesionActiva,
  resumenDia,
  salidasDiaCaja,
  abonosEfectivoHoy,
  entradasEfectivoHoy,
  devolucionesEfectivoHoy,
  corteDepartamentos,
  flujoEfectivoDetallado,
  consumosInternosHoy,
  gananciaEstimadaHoy,
  eventosTurno,
  busyAction,
  onExecuteCierre,
}: PosCashCutViewProps) {
  const [modoCorte, setModoCorte] = useState<'CAJERO_X' | 'DIA_Z'>('CAJERO_X');
  const [efectivoContado, setEfectivoContado] = useState('');
  const [obsCierre, setObsCierre] = useState('');
  const [ultimoCierreResumen, setUltimoCierreResumen] = useState<CierreResumen | null>(null);

  const baseInicial = Number(sesionActiva?.base_inicial ?? sesionActiva?.efectivo_inicial ?? 0);
  const efectivoEsperado = Math.max(
    0,
    Math.round(
      baseInicial +
        resumenDia.totalEfectivo +
        abonosEfectivoHoy +
        entradasEfectivoHoy -
        salidasDiaCaja -
        devolucionesEfectivoHoy
    )
  );

  const ventaBrutaTotal = corteDepartamentos.reduce((a, b) => a + Number(b.total || 0), 0);
  const tasaImp = Number(config.porcentajeImpuesto || 0) / 100;
  const baseNetaSinImpuesto = tasaImp > 0 ? Math.round(ventaBrutaTotal / (1 + tasaImp)) : ventaBrutaTotal;
  const impuestoCalculado = Math.max(0, ventaBrutaTotal - baseNetaSinImpuesto);
  const totalConsumosValorizados = consumosInternosHoy.reduce((a, b) => a + Number(b.gran_total || 0), 0);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsEfectivo = XLSX.utils.json_to_sheet(
      flujoEfectivoDetallado.map((r) => ({
        Hora: r.hora,
        Movimiento: r.movimiento,
        Monto: r.monto,
        'Efectivo en Caja': r.efectivo_en_caja,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsEfectivo, 'Efectivo en Caja');

    const wsDeptos = XLSX.utils.json_to_sheet(
      corteDepartamentos.map((d) => ({
        Departamento: d.categoria,
        Cantidad: d.cantidad,
        'Total Vendido': d.total,
        '% Participación': `${d.porcentaje}%`,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsDeptos, 'Ventas por Departamento');

    if (consumosInternosHoy.length > 0) {
      const wsConsumos = XLSX.utils.json_to_sheet(
        consumosInternosHoy.map((c) => ({
          Consecutivo: c.consecutivo,
          Beneficiario: c.cliente_nombre,
          Observaciones: c.observaciones || '',
          'Valor Comercial': c.gran_total,
          'Cobro en Caja': 0,
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsConsumos, 'Consumos Internos');
    }

    const fechaHoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Corte_Caja_${cajaNombre.replace(/\s+/g, '_')}_${fechaHoy}.xlsx`);
  };

  const handleImprimirCorte = async () => {
    await printThermalTicket({
      titulo: modoCorte === 'CAJERO_X' ? 'CORTE DE CAJERO (X)' : 'CORTE DEL DÍA (Z)',
      subtitulo: `${cajaNombre} • Turno #${sesionActiva?.numero_turno || 1}`,
      consecutivo: `CORTE-${new Date().toISOString().slice(0, 10)}`,
      fecha: new Date().toLocaleString('es-CO'),
      caja: cajaNombre,
      cajero: cajeroNombre,
      canal: 'MOSTRADOR_LLEVAR',
      items: [
        { nombre: 'Base Inicial', cantidad: 1, precioUnitario: baseInicial, subtotal: baseInicial },
        { nombre: 'Ventas Efectivo', cantidad: 1, precioUnitario: resumenDia.totalEfectivo, subtotal: resumenDia.totalEfectivo },
        { nombre: 'Abonos Efectivo', cantidad: 1, precioUnitario: abonosEfectivoHoy, subtotal: abonosEfectivoHoy },
        { nombre: 'Entradas Caja (F7)', cantidad: 1, precioUnitario: entradasEfectivoHoy, subtotal: entradasEfectivoHoy },
        { nombre: 'Salidas Caja (F8)', cantidad: 1, precioUnitario: -salidasDiaCaja, subtotal: -salidasDiaCaja },
        { nombre: 'Devoluciones Efec.', cantidad: 1, precioUnitario: -devolucionesEfectivoHoy, subtotal: -devolucionesEfectivoHoy },
        { nombre: 'Datáfono', cantidad: 1, precioUnitario: resumenDia.totalDatafono, subtotal: resumenDia.totalDatafono },
        { nombre: 'Transferencias', cantidad: 1, precioUnitario: resumenDia.totalTransferencia, subtotal: resumenDia.totalTransferencia },
      ],
      subtotal: ventaBrutaTotal,
      propina: resumenDia.totalPropinas,
      total: efectivoEsperado,
      footer: `Consumos Internos (No caja): $${Math.round(totalConsumosValorizados).toLocaleString('es-CO')}`,
    });
  };

  const handleRunCierre = async (tipo: 'CIERRE_PARCIAL_TURNO' | 'CIERRE_TOTAL_CAJA') => {
    if (!efectivoContado) return;
    const res = await onExecuteCierre(tipo, Number(efectivoContado), obsCierre);
    if (res) setUltimoCierreResumen(res);
  };

  const noSpinnerClass =
    '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  return (
    <div className="flex-1 p-4 overflow-y-auto bg-zinc-100 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-zinc-950">
              Corte y Cuadre de Caja — {cajaNombre}
            </h2>
            <p className="text-xs text-zinc-500">
              Turno #{sesionActiva?.numero_turno || 1} • Cajero: {sesionActiva?.cajero_nombre || cajeroNombre}
              {sesionActiva?.hora_apertura
                ? ` • Apertura: ${new Date(sesionActiva.hora_apertura).toLocaleTimeString('es-CO')}`
                : ''}
            </p>
          </div>
          <div className="flex bg-white border border-zinc-300 rounded-md p-0.5 text-xs">
            <button
              onClick={() => setModoCorte('CAJERO_X')}
              className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                modoCorte === 'CAJERO_X' ? 'bg-zinc-900 text-white' : 'text-zinc-600'
              }`}
            >
              Hacer corte de cajero (X)
            </button>
            <button
              onClick={() => setModoCorte('DIA_Z')}
              className={`px-3 py-1 rounded font-semibold cursor-pointer ${
                modoCorte === 'DIA_Z' ? 'bg-zinc-900 text-white' : 'text-zinc-600'
              }`}
            >
              Hacer corte del día (Z)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImprimirCorte}
            className="px-3.5 py-2 rounded-md bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-600" />
            Imprimir Corte
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-md bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-600" />
            Exportar Corte (.xlsx)
          </button>
        </div>
      </div>

      {/* Estructura conservada de 3 columnas enriquecida */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* COLUMNA 1: Flujo de Efectivo, Ventas por Medio y Arqueo */}
        <div className="bg-white rounded-lg border border-zinc-200 p-4 space-y-3">
          <h3 className="text-sm font-bold text-zinc-900">1. Flujo de Efectivo y Arqueo</h3>
          <div className="space-y-1.5 text-xs tabular-nums">
            {[
              { label: 'Fondo / Base Inicial', val: baseInicial },
              { label: '+ Ventas en Efectivo', val: resumenDia.totalEfectivo },
              { label: '+ Abonos de Crédito (Efectivo)', val: abonosEfectivoHoy },
              { label: '+ Entradas de Caja (F7)', val: entradasEfectivoHoy },
              { label: '− Salidas de Caja (F8)', val: -salidasDiaCaja },
              { label: '− Devoluciones en Efectivo', val: -devolucionesEfectivoHoy },
            ].map((row) => (
              <div key={row.label} className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-600">{row.label}</span>
                <span className="font-semibold text-zinc-900">{formatMoney(row.val)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-sm font-bold text-zinc-950">
              <span>Efectivo Esperado en Cajón</span>
              <span>{formatMoney(efectivoEsperado)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-xs tabular-nums">
            <div className="p-2 rounded bg-zinc-50 border border-zinc-200">
              <div className="text-zinc-500 text-[11px]">Datáfono</div>
              <div className="font-bold text-zinc-900">{formatMoney(resumenDia.totalDatafono)}</div>
            </div>
            <div className="p-2 rounded bg-zinc-50 border border-zinc-200">
              <div className="text-zinc-500 text-[11px]">Transferencias</div>
              <div className="font-bold text-zinc-900">{formatMoney(resumenDia.totalTransferencia)}</div>
            </div>
            <div className="p-2 rounded bg-zinc-50 border border-zinc-200">
              <div className="text-zinc-500 text-[11px]">Propinas</div>
              <div className="font-bold text-zinc-900">{formatMoney(resumenDia.totalPropinas)}</div>
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs tabular-nums">
            <div>
              <div className="font-semibold text-zinc-700">Consumos Internos (Valorizados)</div>
              <div className="text-[11px] text-zinc-500">{consumosInternosHoy.length} registros • No afectan caja ($0)</div>
            </div>
            <span className="font-bold text-zinc-900">{formatMoney(totalConsumosValorizados)}</span>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-200">
            <label className="text-xs font-semibold text-zinc-700 block">
              Efectivo físico contado en cajón
            </label>
            <input
              type="number"
              value={efectivoContado}
              onChange={(e) => setEfectivoContado(e.target.value)}
              placeholder="Ej. 850000"
              className={`w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-bold text-zinc-900 ${noSpinnerClass}`}
            />
            <textarea
              value={obsCierre}
              onChange={(e) => setObsCierre(e.target.value)}
              placeholder="Observaciones del turno..."
              rows={2}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-xs text-zinc-800"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleRunCierre('CIERRE_PARCIAL_TURNO')}
                disabled={busyAction || !efectivoContado}
                className="py-2 rounded-md bg-white hover:bg-zinc-100 disabled:opacity-40 border border-zinc-300 text-zinc-900 font-semibold text-xs cursor-pointer"
              >
                Cierre Parcial (X)
              </button>
              <button
                onClick={() => handleRunCierre('CIERRE_TOTAL_CAJA')}
                disabled={busyAction || !efectivoContado}
                className="py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-semibold text-xs cursor-pointer"
              >
                Cierre Total (Z)
              </button>
            </div>
          </div>

          {ultimoCierreResumen && (
            <div className="p-3 rounded-md border border-zinc-300 bg-zinc-50 text-xs space-y-1 tabular-nums">
              <div className="font-bold text-zinc-950">Corte {ultimoCierreResumen.tipoCierre} Registrado</div>
              <div>Esperado: {formatMoney(ultimoCierreResumen.efectivoEsperado)}</div>
              <div>Contado: {formatMoney(ultimoCierreResumen.efectivoContado)}</div>
              <div className={`font-bold ${ultimoCierreResumen.diferenciaEfectivo === 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                Diferencia: {formatMoney(ultimoCierreResumen.diferenciaEfectivo)}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA 2: Ventas por Departamento, Ganancia, Impuestos y Consumos Internos */}
        <div className="bg-white rounded-lg border border-zinc-200 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
            <div className="p-3 rounded-md bg-zinc-50 border border-zinc-200">
              <div className="text-zinc-500">Ventas Comerciales</div>
              <div className="text-lg font-extrabold text-zinc-950">{formatMoney(ventaBrutaTotal)}</div>
            </div>
            <div className="p-3 rounded-md bg-zinc-50 border border-zinc-200">
              <div className="text-zinc-500">Ganancia Estimada</div>
              <div className="text-lg font-extrabold text-emerald-700">{formatMoney(gananciaEstimadaHoy)}</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-zinc-900 mb-2">
              2. Ventas por Departamento / Categoría
            </h3>
            <div className="border border-zinc-200 rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold">
                  <tr>
                    <th className="py-2 px-2.5">Categoría</th>
                    <th className="py-2 px-2 text-right">Cant.</th>
                    <th className="py-2 px-2.5 text-right">Total</th>
                    <th className="py-2 px-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 tabular-nums">
                  {corteDepartamentos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-400">Sin ventas facturadas hoy.</td>
                    </tr>
                  ) : (
                    corteDepartamentos.map((d) => (
                      <tr key={d.categoria}>
                        <td className="py-2 px-2.5 font-semibold text-zinc-900">{d.categoria}</td>
                        <td className="py-2 px-2 text-right text-zinc-600">{d.cantidad}</td>
                        <td className="py-2 px-2.5 text-right font-bold text-zinc-900">{formatMoney(d.total)}</td>
                        <td className="py-2 px-2 text-right text-zinc-500">{d.porcentaje}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 rounded-md bg-zinc-50 border border-zinc-200 space-y-1.5 text-xs tabular-nums">
            <div className="font-bold text-zinc-900">
              Desglose Fiscal ({config.nombreImpuesto} {config.porcentajeImpuesto}%)
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Base Neta Gravable:</span>
              <span className="font-semibold text-zinc-900">{formatMoney(baseNetaSinImpuesto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">{config.nombreImpuesto} ({config.porcentajeImpuesto}%):</span>
              <span className="font-semibold text-zinc-900">{formatMoney(impuestoCalculado)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-zinc-200 font-bold text-zinc-950">
              <span>Total Facturado:</span>
              <span>{formatMoney(ventaBrutaTotal)}</span>
            </div>
          </div>

          {consumosInternosHoy.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-zinc-800">
                Detalle Consumos Internos (Sin cobro en caja)
              </div>
              <div className="max-h-36 overflow-y-auto border border-zinc-200 rounded-md divide-y divide-zinc-100 text-xs tabular-nums">
                {consumosInternosHoy.map((c) => (
                  <div key={c.id} className="px-2.5 py-1.5 flex justify-between">
                    <div>
                      <span className="font-semibold text-zinc-900">{c.cliente_nombre}</span>
                      <span className="text-zinc-500 ml-1.5">({c.consecutivo})</span>
                    </div>
                    <span className="font-bold text-zinc-700">{formatMoney(c.gran_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA 3: Bitácora Cronológica + Eventos Operativos (Conservada intacta) */}
        <div className="bg-white rounded-lg border border-zinc-200 p-4 flex flex-col max-h-[580px] space-y-3">
          <h3 className="text-sm font-bold text-zinc-900">
            3. Bitácora Cronológica ({flujoEfectivoDetallado.length})
          </h3>
          <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-md divide-y divide-zinc-100 text-xs tabular-nums">
            {flujoEfectivoDetallado.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">Sin movimientos registrados hoy.</div>
            ) : (
              flujoEfectivoDetallado.map((row, idx) => (
                <div key={idx} className="px-2.5 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 truncate">{row.movimiento}</div>
                    <div className="text-[10px] text-zinc-500">{row.hora}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-bold ${row.monto >= 0 ? 'text-zinc-900' : 'text-red-700'}`}>
                      {row.monto >= 0 ? '+' : ''}{formatMoney(row.monto)}
                    </div>
                    <div className="text-[10px] text-zinc-500">Saldo: {formatMoney(row.efectivo_en_caja)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {eventosTurno.length > 0 && (
            <div className="pt-2 border-t border-zinc-200">
              <div className="text-xs font-bold text-zinc-800 mb-1.5">
                Eventos Operativos ({eventosTurno.length})
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {eventosTurno.slice(0, 12).map((ev) => (
                  <div key={ev.id} className="p-2 rounded bg-zinc-50 border border-zinc-200 text-[11px]">
                    <div className="font-semibold text-zinc-800">{ev.tipo_alerta.replace(/_/g, ' ')}</div>
                    <div className="text-zinc-600">{ev.descripcion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
