'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Plus, Pencil, Phone, Mail, Briefcase, Check, X, ShieldCheck, UserCheck, UserX } from 'lucide-react';

interface OperarioRow {
  id: string;
  username: string;
  nombre_cajero: string;
  rol: string;
  rol_sistema: 'GESTOR' | 'OPERATIVO_POS';
  cargo_area: 'Personal Cocina' | 'Personal Caja / Servicio' | 'Dueño / Gerencia';
  telefono: string;
  correo: string;
  activo: boolean;
}

const CARGOS: Array<OperarioRow['cargo_area']> = [
  'Personal Caja / Servicio',
  'Personal Cocina',
  'Dueño / Gerencia',
];

export default function OperariosPage() {
  const [operarios, setOperarios] = useState<OperarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCargo, setFiltroCargo] = useState<'TODOS' | OperarioRow['cargo_area']>('TODOS');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [username, setUsername] = useState('');
  const [nombreCajero, setNombreCajero] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [cargoArea, setCargoArea] = useState<OperarioRow['cargo_area']>('Personal Caja / Servicio');
  const [rolSistema, setRolSistema] = useState<'GESTOR' | 'OPERATIVO_POS'>('OPERATIVO_POS');
  const [passwordPin, setPasswordPin] = useState('1234');
  const [activo, setActivo] = useState(true);

  const loadOperarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/operarios', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data?.success) {
        setOperarios(data.operarios || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOperarios();
  }, [loadOperarios]);

  const filtrados = useMemo(() => {
    if (filtroCargo === 'TODOS') return operarios;
    return operarios.filter((o) => o.cargo_area === filtroCargo);
  }, [operarios, filtroCargo]);

  const openCreate = () => {
    setEditingId(null);
    setUsername('');
    setNombreCajero('');
    setTelefono('');
    setCorreo('');
    setCargoArea('Personal Caja / Servicio');
    setRolSistema('OPERATIVO_POS');
    setPasswordPin('1234');
    setActivo(true);
    setErrorMsg('');
    setShowFormModal(true);
  };

  const openEdit = (op: OperarioRow) => {
    setEditingId(op.id);
    setUsername(op.username);
    setNombreCajero(op.nombre_cajero);
    setTelefono(op.telefono || '');
    setCorreo(op.correo || '');
    setCargoArea(op.cargo_area || 'Personal Caja / Servicio');
    setRolSistema(op.rol_sistema === 'GESTOR' ? 'GESTOR' : 'OPERATIVO_POS');
    setPasswordPin('');
    setActivo(op.activo);
    setErrorMsg('');
    setShowFormModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/operarios', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId
            ? {
                id: editingId,
                nombre_cajero: nombreCajero,
                telefono,
                correo,
                cargo_area: cargoArea,
                rol_sistema: rolSistema,
                password_pin: passwordPin || undefined,
                activo,
              }
            : {
                username,
                nombre_cajero: nombreCajero,
                telefono,
                correo,
                cargo_area: cargoArea,
                rol_sistema: rolSistema,
                password_pin: passwordPin || '1234',
              }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setErrorMsg(data?.error || 'No se pudo guardar el operario.');
        return;
      }
      setShowFormModal(false);
      await loadOperarios();
    } catch {
      setErrorMsg('Error de conexión al guardar operario.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Gestión de Operarios y Personal</h1>
              <p className="text-xs text-slate-500">
                Administra meseros, cajeros, cocina y gerencia (contacto, cargo y acceso al POS).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Operario
          </button>
        </div>

        {/* Filtros táctiles por Cargo */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['TODOS', ...CARGOS] as const).map((cargo) => {
            const active = filtroCargo === cargo;
            return (
              <button
                key={cargo}
                type="button"
                onClick={() => setFiltroCargo(cargo)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cargo === 'TODOS' ? `Todos (${operarios.length})` : cargo}
              </button>
            );
          })}
        </div>

        {/* Grid de Cards Táctiles de Operarios */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            Cargando personal operativo...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            No hay operarios registrados en esta categoría.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map((op) => (
              <div
                key={op.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between gap-4 shadow-2xs transition ${
                  op.activo ? 'border-slate-200' : 'border-red-200 bg-red-50/30 opacity-75'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{op.nombre_cajero}</h3>
                      <p className="text-xs font-mono text-slate-500">@{op.username}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        op.activo
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {op.activo ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                      {op.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
                      <Briefcase className="w-3.5 h-3.5" />
                      {op.cargo_area}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {op.rol_sistema === 'GESTOR' ? 'Gestor' : 'Operativo POS'}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{op.telefono || 'Sin teléfono'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{op.correo || 'Sin correo'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEdit(op)}
                  className="w-full py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar Datos y Contacto
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Operario */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingId ? 'Editar Operario' : 'Nuevo Operario / Mesero'}
              </h2>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={nombreCajero}
                  onChange={(e) => setNombreCajero(e.target.value)}
                  placeholder="Ej: MARÍA FERNANDA GÓMEZ"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Usuario de Acceso</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingId)}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: maria"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono outline-none focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {editingId ? 'Nueva Contraseña / PIN (opcional)' : 'Contraseña / PIN'}
                </label>
                <input
                  type="text"
                  required={!editingId}
                  value={passwordPin}
                  onChange={(e) => setPasswordPin(e.target.value)}
                  placeholder={editingId ? 'Dejar vacío para mantener' : 'Ej: 1234'}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Teléfono</label>
                <input
                  type="tel"
                  required
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 310 555 1234"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="operario@restaurante.com"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1.5">Cargo / Área</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {CARGOS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCargoArea(c)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition ${
                        cargoArea === c
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1.5">Nivel de Acceso en Plataforma</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRolSistema('OPERATIVO_POS')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      rolSistema === 'OPERATIVO_POS'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    Operativo POS (POS + Libro de Caja)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRolSistema('GESTOR')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      rolSistema === 'GESTOR'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    Gestor (11 módulos operativos)
                  </button>
                </div>
              </div>

              {editingId && (
                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    id="op_activo"
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="op_activo" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Operario activo (puede iniciar sesión y ser asignado en POS)
                  </label>
                </div>
              )}
            </div>

            {errorMsg && <p className="text-xs text-red-600 font-semibold">{errorMsg}</p>}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {busy ? 'Guardando...' : 'Guardar Operario'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
