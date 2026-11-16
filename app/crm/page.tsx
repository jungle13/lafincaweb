'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  ClipboardList,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Send,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';

interface ClienteB2B {
  id: string;
  codigo: string;
  empresa: string;
  contacto_nombre: string;
  telefono: string;
  correo?: string | null;
  ciudad_direccion?: string | null;
  etapa: 'PROSPECTO' | 'MENU_ENVIADO' | 'NEGOCIACION' | 'CLIENTE_ACTIVO';
  ultimo_envio_menu?: string | null;
  notas?: string | null;
}

interface PedidoB2B {
  id: string;
  codigo_pedido: string;
  cliente_id: string;
  fecha_entrega: string;
  descripcion_pedido: string;
  cantidad_platos: number;
  valor_total: number;
  estado: 'COTIZADO' | 'CONFIRMADO' | 'ENTREGADO' | 'CANCELADO';
  cliente?: {
    id: string;
    codigo: string;
    empresa: string;
    contacto_nombre: string;
    telefono: string;
  };
}

export default function CrmB2BPage() {
  const [tab, setTab] = useState<'CLIENTES' | 'PEDIDOS'>('CLIENTES');
  const [clientes, setClientes] = useState<ClienteB2B[]>([]);
  const [pedidos, setPedidos] = useState<PedidoB2B[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [showNewClient, setShowNewClient] = useState(false);
  const [empresa, setEmpresa] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [notas, setNotas] = useState('');

  const [pedidoClienteId, setPedidoClienteId] = useState<string | null>(null);
  const [pedFecha, setPedFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pedDesc, setPedDesc] = useState('');
  const [pedCant, setPedCant] = useState('10');
  const [pedValor, setPedValor] = useState('');

  const loadCrm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setClientes(data.clientes || []);
        setPedidos(data.pedidos || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCrm();
  }, [loadCrm]);

  const notifyToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CREAR_CLIENTE',
        empresa,
        contacto_nombre: contacto,
        telefono,
        correo,
        ciudad_direccion: ciudad,
        notas,
      }),
    });
    if (res.ok) {
      setEmpresa('');
      setContacto('');
      setTelefono('');
      setCorreo('');
      setCiudad('');
      setNotas('');
      setShowNewClient(false);
      notifyToast('Cliente B2B registrado.');
      loadCrm();
    }
  };

  const handleEnviarMenu = async (cli: ClienteB2B) => {
    const res = await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REGISTRAR_ENVIO_MENU', cliente_id: cli.id }),
    });
    if (res.ok) {
      notifyToast(`Envío de menú registrado para ${cli.empresa}.`);
      loadCrm();
      const digits = cli.telefono.replace(/\D/g, '');
      if (digits.length >= 10 && typeof window !== 'undefined') {
        const msg = encodeURIComponent(
          `Hola ${cli.contacto_nombre}, te saludamos de Restaurante La Finca Choclos y Asados. Compartimos nuestro menú corporativo para eventos y almuerzos empresariales.`
        );
        window.open(`https://wa.me/57${digits.slice(-10)}?text=${msg}`, '_blank');
      }
    }
  };

  const handleCrearPedido = async (e: React.FormEvent, cliId: string) => {
    e.preventDefault();
    const res = await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CREAR_PEDIDO',
        cliente_id: cliId,
        fecha_entrega: pedFecha,
        descripcion_pedido: pedDesc,
        cantidad_platos: Number(pedCant || 1),
        valor_total: Number(pedValor || 0),
      }),
    });
    if (res.ok) {
      setPedidoClienteId(null);
      setPedDesc('');
      setPedValor('');
      notifyToast('Pedido corporativo B2B creado.');
      loadCrm();
    }
  };

  const handleChangeEstadoPedido = async (pedidoId: string, estado: string) => {
    const res = await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ACTUALIZAR_ESTADO_PEDIDO', pedido_id: pedidoId, estado }),
    });
    if (res.ok) {
      loadCrm();
    }
  };

  const kpis = useMemo(() => {
    const menusEnviados = clientes.filter((c) => c.ultimo_envio_menu).length;
    const activos = clientes.filter((c) => c.etapa === 'CLIENTE_ACTIVO').length;
    const totalPedidos = pedidos
      .filter((p) => p.estado !== 'CANCELADO')
      .reduce((acc, p) => acc + Number(p.valor_total || 0), 0);
    return { totalClientes: clientes.length, menusEnviados, activos, totalPedidos };
  }, [clientes, pedidos]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">CRM Clientes Potenciales B2B</h1>
            <p className="text-xs text-slate-500">
              Seguimiento de empresas, envío de menú corporativo por WhatsApp y generación de pedidos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewClient((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Cliente B2B
          </button>
          <button
            type="button"
            onClick={loadCrm}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Clientes / Prospectos</div>
          <div className="text-lg font-bold text-slate-900 mt-0.5">{kpis.totalClientes}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Menús Enviados</div>
          <div className="text-lg font-bold text-blue-700 mt-0.5">{kpis.menusEnviados}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Clientes Activos</div>
          <div className="text-lg font-bold text-emerald-700 mt-0.5">{kpis.activos}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Pedidos Corporativos</div>
          <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">$ {formatMoney(kpis.totalPedidos)}</div>
        </div>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-medium">
          {toast}
        </div>
      )}

      {/* Formulario Nuevo Cliente B2B */}
      {showNewClient && (
        <form
          onSubmit={handleCreateCliente}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <input
            type="text"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="Empresa / Entidad *"
            required
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
          />
          <input
            type="text"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Nombre de Contacto *"
            required
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
          />
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Teléfono / WhatsApp *"
            required
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
          />
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="Correo electrónico (opcional)"
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
          />
          <input
            type="text"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            placeholder="Dirección / Sector"
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
          />
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Notas de seguimiento"
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
          />
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewClient(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              Guardar Cliente B2B
            </button>
          </div>
        </form>
      )}

      {/* Pestañas */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('CLIENTES')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
            tab === 'CLIENTES' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Directorio B2B ({clientes.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('PEDIDOS')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
            tab === 'PEDIDOS' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Pedidos Generados ({pedidos.length})
        </button>
      </div>

      {/* Contenido */}
      {tab === 'CLIENTES' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs divide-y divide-slate-200 overflow-hidden">
          {clientes.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              Aún no hay clientes B2B registrados. Pulsa &quot;Nuevo Cliente B2B&quot; para iniciar el seguimiento.
            </div>
          ) : (
            clientes.map((cli) => (
              <div key={cli.id}>
                <div className="px-4 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold">
                        {cli.codigo}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{cli.empresa}</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-semibold">
                        {cli.etapa.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span>Contacto: <strong>{cli.contacto_nombre}</strong></span>
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {cli.telefono}
                      </span>
                      {cli.ultimo_envio_menu && (
                        <span className="text-[11px] text-emerald-700 font-medium">
                          Menú enviado: {cli.ultimo_envio_menu}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEnviarMenu(cli)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Enviar Menú
                    </button>
                    <button
                      type="button"
                      onClick={() => setPedidoClienteId(pedidoClienteId === cli.id ? null : cli.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      + Generar Pedido
                    </button>
                  </div>
                </div>

                {pedidoClienteId === cli.id && (
                  <form
                    onSubmit={(e) => handleCrearPedido(e, cli.id)}
                    className="bg-slate-50 border-t border-slate-200 px-4 py-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end"
                  >
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Fecha Entrega</span>
                      <input
                        type="date"
                        value={pedFecha}
                        onChange={(e) => setPedFecha(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Detalle del Pedido</span>
                      <input
                        type="text"
                        value={pedDesc}
                        onChange={(e) => setPedDesc(e.target.value)}
                        placeholder="Ej: 25 Almuerzos ejecutivos punta de anca"
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Platos / Valor ($)</span>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={pedCant}
                          onChange={(e) => setPedCant(e.target.value)}
                          placeholder="Cant"
                          className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                        />
                        <input
                          type="number"
                          value={pedValor}
                          onChange={(e) => setPedValor(e.target.value)}
                          placeholder="Total $"
                          className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                          required
                        />
                      </div>
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="submit"
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-slate-900 text-white text-xs font-bold cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        Crear
                      </button>
                      <button
                        type="button"
                        onClick={() => setPedidoClienteId(null)}
                        className="p-1.5 rounded border border-slate-300 bg-white text-slate-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-x-auto">
          {pedidos.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">No hay pedidos B2B registrados.</div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Pedido</th>
                  <th className="py-2.5 px-3">Empresa / Contacto</th>
                  <th className="py-2.5 px-3">Fecha Entrega</th>
                  <th className="py-2.5 px-3">Descripción</th>
                  <th className="py-2.5 px-3 text-right">Platos</th>
                  <th className="py-2.5 px-3 text-right">Valor Total</th>
                  <th className="py-2.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{p.codigo_pedido}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{p.cliente?.empresa}</div>
                      <div className="text-[11px] text-slate-500">{p.cliente?.contacto_nombre} · {p.cliente?.telefono}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">{p.fecha_entrega}</td>
                    <td className="py-2.5 px-3">{p.descripcion_pedido}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{p.cantidad_platos}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">$ {formatMoney(p.valor_total)}</td>
                    <td className="py-2.5 px-3">
                      <select
                        value={p.estado}
                        onChange={(e) => handleChangeEstadoPedido(p.id, e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-xs font-semibold bg-white"
                      >
                        <option value="COTIZADO">Cotizado</option>
                        <option value="CONFIRMADO">Confirmado</option>
                        <option value="ENTREGADO">Entregado</option>
                        <option value="CANCELADO">Cancelado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
