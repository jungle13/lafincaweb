'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';

interface FacturaProveedor {
  id: string;
  fecha: string;
  numero_factura: string;
  categoria: string;
  valor_total: number;
  estado_pago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  valor_pagado: number;
  saldo_pendiente: number;
  fecha_pago: string | null;
  comprobante_egreso: string | null;
}

interface ProveedorItem {
  id: string;
  codigo: string;
  nombre: string;
  nit_telefono?: string | null;
  categoria_principal?: string | null;
  observaciones?: string | null;
  cantidad_facturas: number;
  total_comprado: number;
  total_pagado: number;
  saldo_pendiente: number;
  fechas_facturas: string[];
  ultima_compra: string | null;
  facturas: FacturaProveedor[];
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<ProveedorItem[]>([]);
  const [siguienteCodigo, setSiguienteCodigo] = useState('PROV-001');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newNitTel, setNewNitTel] = useState('');
  const [newCategoria, setNewCategoria] = useState('Carnes y Proteínas');
  const [newObs, setNewObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadProveedores = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/proveedores', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error cargando proveedores');
      setProveedores(data.proveedores || []);
      setSiguienteCodigo(data.siguienteCodigo || 'PROV-001');
      setNewCodigo(data.siguienteCodigo || 'PROV-001');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error consultando proveedores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProveedores();
  }, [loadProveedores]);

  const handleCreateProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: newCodigo.trim() || siguienteCodigo,
          nombre: newNombre.trim(),
          nit_telefono: newNitTel.trim() || null,
          categoria_principal: newCategoria,
          observaciones: newObs.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo guardar el proveedor');
      setNewNombre('');
      setNewNitTel('');
      setNewObs('');
      setShowNewForm(false);
      setToastMsg(`Proveedor ${data.proveedor?.codigo} guardado correctamente.`);
      setTimeout(() => setToastMsg(null), 3000);
      loadProveedores();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error guardando proveedor');
    } finally {
      setSaving(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter(
      (p) =>
        p.codigo.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        (p.categoria_principal || '').toLowerCase().includes(q)
    );
  }, [proveedores, search]);

  const kpis = useMemo(() => {
    const totalComprado = proveedores.reduce((acc, p) => acc + p.total_comprado, 0);
    const totalPagado = proveedores.reduce((acc, p) => acc + p.total_pagado, 0);
    const saldoPendiente = proveedores.reduce((acc, p) => acc + p.saldo_pendiente, 0);
    return { count: proveedores.length, totalComprado, totalPagado, saldoPendiente };
  }, [proveedores]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Gestión de Proveedores</h1>
            <p className="text-xs text-slate-500">
              Código único por proveedor, histórico de compras, pagos realizados y fechas de facturas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Proveedor
          </button>
          <button
            type="button"
            onClick={loadProveedores}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Proveedores Registrados</div>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{kpis.count}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Comprado</div>
          <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">$ {formatMoney(kpis.totalComprado)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Pagado</div>
          <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">$ {formatMoney(kpis.totalPagado)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Saldo por Pagar</div>
          <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">$ {formatMoney(kpis.saldoPendiente)}</div>
        </div>
      </div>

      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-medium">
          {toastMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-lg text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* Formulario inline Nuevo Proveedor */}
      {showNewForm && (
        <form
          onSubmit={handleCreateProveedor}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Código Único</span>
            <input
              type="text"
              value={newCodigo}
              onChange={(e) => setNewCodigo(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
              required
            />
          </label>
          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Nombre del Proveedor *</span>
            <input
              type="text"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Ej: Carnes La Hacienda S.A.S."
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">NIT / Teléfono</span>
            <input
              type="text"
              value={newNitTel}
              onChange={(e) => setNewNitTel(e.target.value)}
              placeholder="Opcional"
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Categoría</span>
            <select
              value={newCategoria}
              onChange={(e) => setNewCategoria(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 bg-white"
            >
              <option>Carnes y Proteínas</option>
              <option>Verduras y Frutas</option>
              <option>Granos y Harinas</option>
              <option>Desechables y Empaques</option>
              <option>Bebidas y Licores</option>
              <option>Otros Insumos y Servicios</option>
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-lg cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="p-2 rounded-lg border border-slate-300 text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Buscador */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proveedor por código (PROV-001), nombre o categoría..."
          className="flex-1 text-xs text-slate-800 bg-transparent focus:outline-none"
        />
      </div>

      {/* Listado de Proveedores con Despliegue Inline de Facturas */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden divide-y divide-slate-200">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">Cargando proveedores...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">No se encontraron proveedores.</div>
        ) : (
          filtrados.map((prov) => {
            const isExpanded = expandedId === prov.id;
            return (
              <div key={prov.id}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : prov.id)}
                  className="px-4 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/80 cursor-pointer"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="text-slate-400 mt-0.5 sm:mt-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold shrink-0">
                      {prov.codigo}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{prov.nombre}</div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>{prov.categoria_principal || 'General'}</span>
                        <span>·</span>
                        <span>{prov.cantidad_facturas} facturas</span>
                        {prov.fechas_facturas.length > 0 && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3" />
                              Última: {prov.fechas_facturas[0]}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pl-7 lg:pl-0 text-xs">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Comprado</div>
                      <div className="font-mono font-bold text-slate-900">$ {formatMoney(prov.total_comprado)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Pagado</div>
                      <div className="font-mono font-bold text-emerald-700">$ {formatMoney(prov.total_pagado)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Saldo</div>
                      <div className="font-mono font-bold text-amber-700">$ {formatMoney(prov.saldo_pendiente)}</div>
                    </div>
                  </div>
                </div>

                {/* Detalle inline de facturas y fechas del proveedor */}
                {isExpanded && (
                  <div className="bg-slate-50/80 border-t border-slate-200 px-5 py-3">
                    {prov.facturas.length === 0 ? (
                      <div className="text-xs text-slate-400 py-2">Este proveedor aún no tiene facturas registradas.</div>
                    ) : (
                      <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs text-slate-700">
                          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3">Fecha Factura</th>
                              <th className="py-2 px-3">N° Factura</th>
                              <th className="py-2 px-3">Estado Pago</th>
                              <th className="py-2 px-3">Fecha Pago</th>
                              <th className="py-2 px-3">Comprobante</th>
                              <th className="py-2 px-3 text-right">Valor Comprado</th>
                              <th className="py-2 px-3 text-right">Valor Pagado</th>
                              <th className="py-2 px-3 text-center">Ver</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {prov.facturas.map((f) => (
                              <tr key={f.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono">{f.fecha}</td>
                                <td className="py-2 px-3 font-semibold text-slate-900 flex items-center gap-1">
                                  <Receipt className="w-3 h-3 text-slate-400" />
                                  {f.numero_factura}
                                </td>
                                <td className="py-2 px-3">
                                  {f.estado_pago === 'PAGADO' ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                      <CheckCircle2 className="w-3 h-3" /> Pagado
                                    </span>
                                  ) : f.estado_pago === 'PARCIAL' ? (
                                    <span className="text-amber-700 font-semibold">Parcial</span>
                                  ) : (
                                    <span className="text-slate-500">Pendiente</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px]">{f.fecha_pago || '—'}</td>
                                <td className="py-2 px-3 font-mono text-[11px] text-indigo-700 font-semibold">
                                  {f.comprobante_egreso || '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold">$ {formatMoney(f.valor_total)}</td>
                                <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                                  $ {formatMoney(f.valor_pagado)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <Link
                                    href={`/compras?factura=${encodeURIComponent(f.numero_factura)}&fecha=${encodeURIComponent(f.fecha)}`}
                                    className="inline-flex items-center gap-1 text-blue-700 hover:underline font-semibold"
                                  >
                                    Abrir <ExternalLink className="w-3 h-3" />
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
