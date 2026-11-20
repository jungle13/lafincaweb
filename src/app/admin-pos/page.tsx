'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  MapPin,
  UserCheck,
  Tags,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Monitor,
  ShieldAlert,
  Unlink,
} from 'lucide-react';

type AdminTab = 'CAJAS' | 'PERSONAL' | 'MESAS' | 'CLIENTES' | 'CATEGORIAS';

interface CajaAdmin {
  id: string;
  nombre: string;
  es_principal: boolean;
  device_id?: string | null;
  ip_local?: string;
  ultima_conexion_at?: string | null;
  activa: boolean;
  vinculada?: boolean;
  turno_abierto?: boolean;
}

interface Operario {
  id: string;
  username: string;
  nombre_cajero: string;
  cargo_area: string;
  telefono: string;
  correo: string;
  rol_sistema: 'GESTOR' | 'OPERATIVO_POS';
  activo: boolean;
}

interface Zona {
  id: string;
  nombre: string;
  orden: number;
}

interface Mesa {
  id: string;
  numero: number;
  nombre: string;
  zona: string;
  capacidad: number;
  estado: string;
}

interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  direccion: string;
  barrio: string;
  correo: string;
  notas: string;
}

interface Categoria {
  id: string;
  nombre: string;
  es_inventariable: boolean;
  orden: number;
}

const PERFILES_OPERATIVOS = ['Mesero', 'Domiciliario', 'Cocinero', 'Personal Caja / Servicio', 'Personal Cocina', 'Dueño / Gerencia'];

export default function AdminPosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.username?.toLowerCase() === 'admin';

  const [tab, setTab] = useState<AdminTab>('CAJAS');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [cajas, setCajas] = useState<CajaAdmin[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  // Modales simples CRUD
  const [modalCaja, setModalCaja] = useState<(Partial<CajaAdmin> & { password_caja?: string }) | null>(null);
  const [modalOp, setModalOp] = useState<Partial<Operario> & { password_pin?: string } | null>(null);
  const [modalZona, setModalZona] = useState<(Partial<Zona> & { old_nombre?: string }) | null>(null);
  const [modalMesa, setModalMesa] = useState<Partial<Mesa> | null>(null);
  const [modalCliente, setModalCliente] = useState<Partial<Cliente> | null>(null);
  const [modalCat, setModalCat] = useState<(Partial<Categoria> & { old_nombre?: string }) | null>(null);

  const notify = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rCaj, rOp, rZm, rCl, rCat] = await Promise.all([
        fetch('/api/admin-pos/cajas', { cache: 'no-store' }),
        fetch('/api/operarios', { cache: 'no-store' }),
        fetch('/api/admin-pos/zonas-mesas', { cache: 'no-store' }),
        fetch('/api/admin-pos/clientes', { cache: 'no-store' }),
        fetch('/api/admin-pos/categorias', { cache: 'no-store' }),
      ]);
      const [dCaj, dOp, dZm, dCl, dCat] = await Promise.all([
        rCaj.json(),
        rOp.json(),
        rZm.json(),
        rCl.json(),
        rCat.json(),
      ]);
      if (dCaj?.success) setCajas(dCaj.cajas || []);
      if (dOp?.success) setOperarios(dOp.operarios || []);
      if (dZm?.success) {
        setZonas(dZm.zonas || []);
        setMesas(dZm.mesas || []);
      }
      if (dCl?.success) setClientes(dCl.clientes || []);
      if (dCat?.success) setCategorias(dCat.categorias || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadAll();
  }, [isAdmin, loadAll]);

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
          <h2 className="font-bold text-slate-900 text-base">Acceso Restringido</h2>
          <p className="text-xs text-slate-500">Solo el Administrador puede gestionar la configuración del Punto POS.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header Minimalista */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Administración del Punto POS</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestión centralizada de personal operativo, zonas y mesas, clientes y categorías de alimentos.
            </p>
          </div>

          {msg && (
            <div
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border ${
                msg.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {msg.text}
            </div>
          )}
        </div>

        {/* Pestañas Minimalistas */}
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { id: 'CAJAS', label: `Cajas (${cajas.length})`, icon: Monitor },
              { id: 'PERSONAL', label: `Personal (${operarios.length})`, icon: Users },
              { id: 'MESAS', label: `Zonas (${zonas.length}) y Mesas (${mesas.length})`, icon: MapPin },
              { id: 'CLIENTES', label: `Clientes (${clientes.length})`, icon: UserCheck },
              { id: 'CATEGORIAS', label: `Categorías (${categorias.length})`, icon: Tags },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
            Cargando configuración POS...
          </div>
        ) : (
          <>
            {/* TAB 0: CAJAS / TERMINALES POS */}
            {tab === 'CAJAS' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Cajas / Terminales del Negocio</h2>
                    <p className="text-[11px] text-slate-500">
                      Cada computador POS selecciona una caja libre la primera vez y queda vinculado por su IP e identificador único.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setModalCaja({
                        nombre: '',
                        password_caja: '1234',
                        es_principal: cajas.length === 0,
                        activa: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Nueva Caja
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                      <tr>
                        <th className="py-3 px-4">Nombre de Caja</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4">Vinculación PC</th>
                        <th className="py-3 px-4">IP Local</th>
                        <th className="py-3 px-4">Turno Hoy</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cajas.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-900">{c.nombre}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-lg font-semibold ${
                                c.es_principal
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {c.es_principal ? 'Principal' : 'Auxiliar'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-lg font-semibold ${
                                c.vinculada
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {c.vinculada ? 'Vinculada a PC' : 'Libre'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{c.ip_local || '—'}</td>
                          <td className="py-3 px-4">
                            {c.turno_abierto ? (
                              <span className="text-emerald-700 font-bold">Abierto</span>
                            ) : (
                              <span className="text-slate-400">Cerrado</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            {c.vinculada && (
                              <button
                                type="button"
                                title="Liberar PC vinculado para usar esta caja en otro computador"
                                onClick={async () => {
                                  const res = await fetch('/api/admin-pos/cajas', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: c.id, action: 'LIBERAR_PC' }),
                                  });
                                  const d = await res.json();
                                  if (d?.success) { notify('ok', `${c.nombre} liberada.`); void loadAll(); }
                                  else notify('err', d?.error || 'Error');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold cursor-pointer"
                              >
                                <Unlink className="w-3 h-3" /> Liberar PC
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setModalCaja({ ...c, password_caja: '' })}
                              className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await fetch(`/api/admin-pos/cajas?id=${c.id}`, { method: 'DELETE' });
                                const d = await res.json();
                                if (d?.success) { notify('ok', 'Caja eliminada.'); void loadAll(); }
                                else notify('err', d?.error || 'Error');
                              }}
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 1: PERSONAL OPERATIVO */}
            {tab === 'PERSONAL' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Meseros, Domiciliarios y Cocineros</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setModalOp({
                        username: '',
                        nombre_cajero: '',
                        cargo_area: 'Mesero',
                        telefono: '',
                        correo: '',
                        rol_sistema: 'OPERATIVO_POS',
                        password_pin: '1234',
                        activo: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Nuevo Operario
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                      <tr>
                        <th className="py-3 px-4">Nombre</th>
                        <th className="py-3 px-4">Usuario</th>
                        <th className="py-3 px-4">Perfil / Cargo</th>
                        <th className="py-3 px-4">Teléfono</th>
                        <th className="py-3 px-4">Correo</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {operarios.map((op) => (
                        <tr key={op.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-semibold text-slate-900">{op.nombre_cajero}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">@{op.username}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold">
                              {op.cargo_area}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{op.telefono || '—'}</td>
                          <td className="py-3 px-4 text-slate-600">{op.correo || '—'}</td>
                          <td className="py-3 px-4">
                            <span className={`font-semibold ${op.activo ? 'text-emerald-700' : 'text-red-600'}`}>
                              {op.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setModalOp({ ...op, password_pin: '' })}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: ZONAS Y MESAS */}
            {tab === 'MESAS' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit">
                  <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">Zonas / Ubicaciones</h2>
                    <button
                      type="button"
                      onClick={() => setModalZona({ nombre: '', orden: zonas.length + 1 })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Zona
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {zonas.map((z) => (
                      <div key={z.id} className="px-4 py-3 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{z.nombre}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setModalZona({ ...z, old_nombre: z.nombre })}
                            className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await fetch(`/api/admin-pos/zonas-mesas?kind=ZONA&id=${z.id}`, { method: 'DELETE' });
                              const d = await res.json();
                              if (d?.success) { notify('ok', 'Zona eliminada.'); void loadAll(); }
                              else notify('err', d?.error || 'Error');
                            }}
                            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">Mesas Configuradas</h2>
                    <button
                      type="button"
                      onClick={() =>
                        setModalMesa({
                          numero: (mesas[mesas.length - 1]?.numero || 0) + 1,
                          nombre: `Mesa ${(mesas[mesas.length - 1]?.numero || 0) + 1}`,
                          zona: zonas[0]?.nombre || 'Salón Principal',
                          capacidad: 4,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Nueva Mesa
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                        <tr>
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">Nombre</th>
                          <th className="py-3 px-4">Zona</th>
                          <th className="py-3 px-4">Capacidad</th>
                          <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mesas.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 font-mono text-slate-500">{m.numero}</td>
                            <td className="py-3 px-4 font-semibold text-slate-900">{m.nombre}</td>
                            <td className="py-3 px-4 text-slate-700">{m.zona}</td>
                            <td className="py-3 px-4 text-slate-600">{m.capacidad} pers.</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setModalMesa({ ...m })}
                                className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await fetch(`/api/admin-pos/zonas-mesas?kind=MESA&id=${m.id}`, { method: 'DELETE' });
                                  const d = await res.json();
                                  if (d?.success) { notify('ok', 'Mesa eliminada.'); void loadAll(); }
                                  else notify('err', d?.error || 'Error');
                                }}
                                className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CLIENTES */}
            {tab === 'CLIENTES' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Directorio de Clientes POS</h2>
                  <button
                    type="button"
                    onClick={() => setModalCliente({ nombre: '', telefono: '', direccion: '', barrio: '', correo: '', notas: '' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Nuevo Cliente
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                      <tr>
                        <th className="py-3 px-4">Nombre</th>
                        <th className="py-3 px-4">Teléfono</th>
                        <th className="py-3 px-4">Dirección</th>
                        <th className="py-3 px-4">Barrio</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clientes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">No hay clientes registrados.</td>
                        </tr>
                      ) : (
                        clientes.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 font-semibold text-slate-900">{c.nombre}</td>
                            <td className="py-3 px-4 text-slate-600">{c.telefono || '—'}</td>
                            <td className="py-3 px-4 text-slate-600">{c.direccion || '—'}</td>
                            <td className="py-3 px-4 text-slate-600">{c.barrio || '—'}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setModalCliente({ ...c })}
                                className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await fetch(`/api/admin-pos/clientes?id=${c.id}`, { method: 'DELETE' });
                                  const d = await res.json();
                                  if (d?.success) { notify('ok', 'Cliente eliminado.'); void loadAll(); }
                                  else notify('err', d?.error || 'Error');
                                }}
                                className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: CATEGORÍAS DE ALIMENTOS */}
            {tab === 'CATEGORIAS' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Categorías Normalizadas de Alimentos</h2>
                    <p className="text-[11px] text-slate-500">Define qué categorías controlan stock unitario en F4 Inventario (bebidas, desechables, insumos).</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalCat({ nombre: '', es_inventariable: false, orden: categorias.length + 1 })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Nueva Categoría
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                      <tr>
                        <th className="py-3 px-4">Categoría</th>
                        <th className="py-3 px-4">¿Controla Inventario en POS?</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categorias.map((cat) => (
                        <tr key={cat.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-900">{cat.nombre}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-lg font-semibold ${
                                cat.es_inventariable
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {cat.es_inventariable ? 'Sí (Insumo / Bebida / Desechable)' : 'No (Plato preparado en cocina)'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setModalCat({ ...cat, old_nombre: cat.nombre })}
                              className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await fetch(`/api/admin-pos/categorias?id=${cat.id}`, { method: 'DELETE' });
                                const d = await res.json();
                                if (d?.success) { notify('ok', 'Categoría eliminada.'); void loadAll(); }
                                else notify('err', d?.error || 'Error');
                              }}
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Caja */}
      {modalCaja && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await fetch('/api/admin-pos/cajas', {
                  method: modalCaja.id ? 'PUT' : 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(modalCaja),
                });
                const d = await res.json();
                if (!res.ok || !d?.success) notify('err', d?.error || 'Error guardando caja');
                else {
                  setModalCaja(null);
                  notify('ok', 'Caja guardada.');
                  void loadAll();
                }
              } finally {
                setBusy(false);
              }
            }}
            className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 space-y-3 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-bold text-sm text-slate-900">{modalCaja.id ? 'Editar Caja' : 'Nueva Caja'}</h3>
              <button type="button" onClick={() => setModalCaja(null)} className="p-1 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input
              required
              placeholder="Nombre (Ej: CAJA PRINCIPAL, CAJA DOMICILIOS)"
              value={modalCaja.nombre || ''}
              onChange={(e) => setModalCaja({ ...modalCaja, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl uppercase font-semibold"
            />
            <input
              required={!modalCaja.id}
              type="password"
              placeholder={modalCaja.id ? 'Nueva contraseña (opcional)' : 'Contraseña de apertura'}
              value={modalCaja.password_caja || ''}
              onChange={(e) => setModalCaja({ ...modalCaja, password_caja: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(modalCaja.es_principal)}
                onChange={(e) => setModalCaja({ ...modalCaja, es_principal: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="font-semibold text-slate-700">Marcar como Caja Principal</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalCaja(null)} className="px-4 py-2 rounded-xl text-slate-600 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={busy} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer"><Check className="w-3.5 h-3.5" /> Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Personal */}
      {modalOp && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await fetch('/api/operarios', {
                  method: modalOp.id ? 'PUT' : 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(modalOp),
                });
                const d = await res.json();
                if (!res.ok || !d?.success) notify('err', d?.error || 'Error guardando operario');
                else {
                  setModalOp(null);
                  notify('ok', 'Operario guardado.');
                  void loadAll();
                }
              } finally {
                setBusy(false);
              }
            }}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-3 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="font-bold text-sm text-slate-900">{modalOp.id ? 'Editar Operario' : 'Nuevo Operario'}</h3>
              <button type="button" onClick={() => setModalOp(null)} className="p-1 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input required placeholder="Nombre completo" value={modalOp.nombre_cajero || ''} onChange={(e) => setModalOp({ ...modalOp, nombre_cajero: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              <input required disabled={Boolean(modalOp.id)} placeholder="Usuario" value={modalOp.username || ''} onChange={(e) => setModalOp({ ...modalOp, username: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono disabled:bg-slate-100" />
              <input required={!modalOp.id} placeholder={modalOp.id ? 'Nuevo PIN (opcional)' : 'PIN / Clave'} value={modalOp.password_pin || ''} onChange={(e) => setModalOp({ ...modalOp, password_pin: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Teléfono" value={modalOp.telefono || ''} onChange={(e) => setModalOp({ ...modalOp, telefono: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
              <input type="email" placeholder="Correo" value={modalOp.correo || ''} onChange={(e) => setModalOp({ ...modalOp, correo: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
            </div>
            <div>
              <label className="font-semibold text-slate-600 block mb-1">Perfil / Cargo</label>
              <select value={modalOp.cargo_area || 'Mesero'} onChange={(e) => setModalOp({ ...modalOp, cargo_area: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white">
                {PERFILES_OPERATIVOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOp(null)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={busy} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer"><Check className="w-3.5 h-3.5" /> Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Zona */}
      {modalZona && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await fetch('/api/admin-pos/zonas-mesas', {
                  method: modalZona.id ? 'PUT' : 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ kind: 'ZONA', ...modalZona }),
                });
                const d = await res.json();
                if (!res.ok || !d?.success) notify('err', d?.error || 'Error');
                else { setModalZona(null); notify('ok', 'Zona guardada.'); void loadAll(); }
              } finally { setBusy(false); }
            }}
            className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 space-y-3 shadow-xl text-xs"
          >
            <h3 className="font-bold text-sm text-slate-900">{modalZona.id ? 'Editar Zona' : 'Nueva Zona'}</h3>
            <input required placeholder="Nombre de la zona (Ej: Terraza, Segundo Piso)" value={modalZona.nombre || ''} onChange={(e) => setModalZona({ ...modalZona, nombre: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalZona(null)} className="px-4 py-2 rounded-xl text-slate-600 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Mesa */}
      {modalMesa && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await fetch('/api/admin-pos/zonas-mesas', {
                  method: modalMesa.id ? 'PUT' : 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ kind: 'MESA', ...modalMesa }),
                });
                const d = await res.json();
                if (!res.ok || !d?.success) notify('err', d?.error || 'Error');
                else { setModalMesa(null); notify('ok', 'Mesa guardada.'); void loadAll(); }
              } finally { setBusy(false); }
            }}
            className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 space-y-3 shadow-xl text-xs"
          >
            <h3 className="font-bold text-sm text-slate-900">{modalMesa.id ? 'Editar Mesa' : 'Nueva Mesa'}</h3>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" required placeholder="Número" value={modalMesa.numero || ''} onChange={(e) => setModalMesa({ ...modalMesa, numero: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
              <input type="number" required placeholder="Capacidad" value={modalMesa.capacidad || 4} onChange={(e) => setModalMesa({ ...modalMesa, capacidad: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
            </div>
            <input required placeholder="Nombre (Ej: Mesa 1)" value={modalMesa.nombre || ''} onChange={(e) => setModalMesa({ ...modalMesa, nombre: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
            <select value={modalMesa.zona || zonas[0]?.nombre || 'Salón Principal'} onChange={(e) => setModalMesa({ ...modalMesa, zona: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white">
              {zonas.map((z) => <option key={z.id} value={z.nombre}>{z.nombre}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalMesa(null)} className="px-4 py-2 rounded-xl text-slate-600 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Cliente */}
      {modalCliente && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await fetch('/api/admin-pos/clientes', {
                  method: modalCliente.id ? 'PUT' : 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(modalCliente),
                });
                const d = await res.json();
                if (!res.ok || !d?.success) notify('err', d?.error || 'Error');
                else { setModalCliente(null); notify('ok', 'Cliente guardado.'); void loadAll(); }
              } finally { setBusy(false); }
            }}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 space-y-3 shadow-xl text-xs"
          >
            <h3 className="font-bold text-sm text-slate-900">{modalCliente.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <input required placeholder="Nombre completo" value={modalCliente.nombre || ''} onChange={(e) => setModalCliente({ ...modalCliente, nombre: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Teléfono" value={modalCliente.telefono || ''} onChange={(e) => setModalCliente({ ...modalCliente, telefono: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
              <input placeholder="Barrio" value={modalCliente.barrio || ''} onChange={(e) => setModalCliente({ ...modalCliente, barrio: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
            </div>
            <input placeholder="Dirección" value={modalCliente.direccion || ''} onChange={(e) => setModalCliente({ ...modalCliente, direccion: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
            <input placeholder="Notas (opcional)" value={modalCliente.notas || ''} onChange={(e) => setModalCliente({ ...modalCliente, notas: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalCliente(null)} className="px-4 py-2 rounded-xl text-slate-600 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Categoría */}
      {modalCat && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const res = await fetch('/api/admin-pos/categorias', {
                  method: modalCat.id ? 'PUT' : 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(modalCat),
                });
                const d = await res.json();
                if (!res.ok || !d?.success) notify('err', d?.error || 'Error');
                else { setModalCat(null); notify('ok', 'Categoría guardada.'); void loadAll(); }
              } finally { setBusy(false); }
            }}
            className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 space-y-3 shadow-xl text-xs"
          >
            <h3 className="font-bold text-sm text-slate-900">{modalCat.id ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
            <input required placeholder="Nombre (Ej: BEBIDAS, PLATOS, DESECHABLES)" value={modalCat.nombre || ''} onChange={(e) => setModalCat({ ...modalCat, nombre: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl uppercase" />
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input type="checkbox" checked={Boolean(modalCat.es_inventariable)} onChange={(e) => setModalCat({ ...modalCat, es_inventariable: e.target.checked })} className="w-4 h-4 rounded" />
              <span className="font-semibold text-slate-700">Controla inventario unitario en F4 Inventario POS</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalCat(null)} className="px-4 py-2 rounded-xl text-slate-600 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold cursor-pointer">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
