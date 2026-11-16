'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  Receipt,
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { CompraFacturaGroup } from '@/services/comprasService';

interface Props {
  facturas: CompraFacturaGroup[];
  onPagoUpdated?: () => void;
}

type FiltroPago = 'PAGOS_REALIZADOS' | 'PAGADO' | 'PARCIAL' | 'PENDIENTE' | 'TODAS';

export default function ComprasPagosView({ facturas, onPagoUpdated }: Props) {
  const [filtro, setFiltro] = useState<FiltroPago>('PAGOS_REALIZADOS');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftEstado, setDraftEstado] = useState<'PAGADO' | 'PARCIAL' | 'PENDIENTE'>('PAGADO');
  const [draftValor, setDraftValor] = useState<string>('');
  const [draftFecha, setDraftFecha] = useState<string>('');
  const [draftCE, setDraftCE] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const resumen = useMemo(() => {
    const totalComprado = facturas.reduce((acc, f) => acc + Number(f.valor_total || 0), 0);
    const totalPagado = facturas.reduce((acc, f) => acc + Number(f.valor_pagado || 0), 0);
    const totalPendiente = facturas.reduce((acc, f) => acc + Number(f.saldo_pendiente || 0), 0);
    const pagadas = facturas.filter((f) => f.estado_pago === 'PAGADO').length;
    const parciales = facturas.filter((f) => f.estado_pago === 'PARCIAL').length;
    return { totalComprado, totalPagado, totalPendiente, pagadas, parciales };
  }, [facturas]);

  const filtradas = useMemo(() => {
    return facturas.filter((f) => {
      if (filtro === 'PAGOS_REALIZADOS') return f.estado_pago === 'PAGADO' || f.estado_pago === 'PARCIAL';
      if (filtro === 'PAGADO') return f.estado_pago === 'PAGADO';
      if (filtro === 'PARCIAL') return f.estado_pago === 'PARCIAL';
      if (filtro === 'PENDIENTE') return f.estado_pago === 'PENDIENTE';
      return true;
    });
  }, [facturas, filtro]);

  const startEdit = (fac: CompraFacturaGroup) => {
    setEditingId(fac.id);
    setDraftEstado(fac.estado_pago === 'PARCIAL' ? 'PARCIAL' : fac.estado_pago === 'PAGADO' ? 'PAGADO' : 'PAGADO');
    setDraftValor(String(fac.valor_pagado || fac.valor_total || 0));
    setDraftFecha(fac.fecha_pago || new Date().toISOString().slice(0, 10));
    setDraftCE(fac.comprobante_egreso || '');
  };

  const saveEdit = async (fac: CompraFacturaGroup) => {
    setSaving(true);
    try {
      const res = await fetch('/api/compras', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compra_id: fac.id,
          estado_pago: draftEstado,
          valor_pagado: draftEstado === 'PARCIAL' ? Number(draftValor || 0) : draftEstado === 'PAGADO' ? fac.valor_total : 0,
          fecha_pago: draftEstado === 'PENDIENTE' ? null : draftFecha,
          comprobante_egreso: draftEstado === 'PENDIENTE' ? null : draftCE.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        onPagoUpdated?.();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* KPIs de Pagos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Pagado (Egresos)</div>
          <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">
            $ {formatMoney(resumen.totalPagado)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {resumen.pagadas} completas · {resumen.parciales} parciales
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Saldo Pendiente por Pagar</div>
          <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">
            $ {formatMoney(resumen.totalPendiente)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Sobre {facturas.length} facturas del período
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Comprado</div>
          <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
            $ {formatMoney(resumen.totalComprado)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {resumen.totalComprado > 0
              ? `${Math.round((resumen.totalPagado / resumen.totalComprado) * 100)}% cubierto`
              : '0% cubierto'}
          </div>
        </div>
      </div>

      {/* Filtros de estado de pago */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
        {[
          { key: 'PAGOS_REALIZADOS', label: 'Pagadas y Parciales' },
          { key: 'PAGADO', label: 'Solo Pagadas' },
          { key: 'PARCIAL', label: 'Solo Parciales' },
          { key: 'PENDIENTE', label: 'Pendientes de Pago' },
          { key: 'TODAS', label: 'Todas' },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setFiltro(opt.key as FiltroPago)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              filtro === opt.key
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tabla de Pagos y Comprobantes de Egreso */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        {filtradas.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No hay facturas en esta categoría de pago.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Fecha Pago</th>
                  <th className="py-2.5 px-3">Comprobante Egreso</th>
                  <th className="py-2.5 px-3">Factura / Fecha</th>
                  <th className="py-2.5 px-3">Proveedor</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3 text-right">Valor Factura</th>
                  <th className="py-2.5 px-3 text-right">Valor Pagado</th>
                  <th className="py-2.5 px-3 text-right">Saldo</th>
                  <th className="py-2.5 px-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((fac) => {
                  const isEditing = editingId === fac.id;
                  return (
                    <tr key={fac.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        {isEditing && draftEstado !== 'PENDIENTE' ? (
                          <input
                            type="date"
                            value={draftFecha}
                            onChange={(e) => setDraftFecha(e.target.value)}
                            className="border border-slate-300 rounded px-1.5 py-0.5 text-xs"
                          />
                        ) : (
                          fac.fecha_pago || '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {isEditing && draftEstado !== 'PENDIENTE' ? (
                          <input
                            type="text"
                            value={draftCE}
                            onChange={(e) => setDraftCE(e.target.value)}
                            placeholder="Auto CE-XXXX"
                            className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono"
                          />
                        ) : fac.comprobante_egreso ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[11px] font-semibold">
                            <FileCheck2 className="w-3 h-3" />
                            {fac.comprobante_egreso}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          <Receipt className="w-3 h-3 text-slate-400" />
                          {fac.numero_factura}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{fac.fecha}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{fac.proveedor}</td>
                      <td className="py-2.5 px-3">
                        {isEditing ? (
                          <select
                            value={draftEstado}
                            onChange={(e) => setDraftEstado(e.target.value as any)}
                            className="border border-slate-300 rounded px-1.5 py-0.5 text-xs font-semibold"
                          >
                            <option value="PAGADO">Pagado Total</option>
                            <option value="PARCIAL">Pago Parcial</option>
                            <option value="PENDIENTE">Pendiente</option>
                          </select>
                        ) : fac.estado_pago === 'PAGADO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Pagado
                          </span>
                        ) : fac.estado_pago === 'PARCIAL' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                            <CreditCard className="w-3 h-3" />
                            Parcial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-medium">
                            <Clock className="w-3 h-3" />
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700">
                        $ {formatMoney(fac.valor_total)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {isEditing && draftEstado === 'PARCIAL' ? (
                          <input
                            type="number"
                            value={draftValor}
                            onChange={(e) => setDraftValor(e.target.value)}
                            className="w-24 border border-slate-300 rounded px-1.5 py-0.5 text-xs text-right font-mono"
                          />
                        ) : (
                          `$ ${formatMoney(fac.valor_pagado)}`
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-semibold">
                        $ {formatMoney(fac.saldo_pendiente)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => saveEdit(fac)}
                              className="px-2 py-1 rounded bg-slate-900 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              {saving ? '...' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 rounded border border-slate-300 text-slate-600 text-[11px] cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(fac)}
                            className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
                          >
                            {fac.estado_pago === 'PENDIENTE' ? 'Marcar Pago' : 'Editar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
