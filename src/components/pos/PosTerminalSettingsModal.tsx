'use client';

import React, { useEffect, useState } from 'react';
import { Cpu, Network, Settings, Store, X } from 'lucide-react';
import {
  getPresetForGiro,
  type ElianaPosConfig,
  type GiroNegocio,
  type ModeloBascula,
  type ModeloCajon,
} from '@/lib/posConfig';
import { checkLanHealth, getLocalLanIp } from '@/lib/posHardwareBridge';

interface PosTerminalSettingsModalProps {
  config: ElianaPosConfig;
  onSave: (next: ElianaPosConfig) => void;
  onClose: () => void;
}

export default function PosTerminalSettingsModal({
  config,
  onSave,
  onClose,
}: PosTerminalSettingsModalProps) {
  const [tab, setTab] = useState<'NEGOCIO' | 'RED_LAN' | 'HARDWARE'>('NEGOCIO');
  const [draft, setDraft] = useState<ElianaPosConfig>(config);
  const [localIpDetected, setLocalIpDetected] = useState<string>('127.0.0.1');
  const [lanTestStatus, setLanTestStatus] = useState<string>('');

  useEffect(() => {
    getLocalLanIp().then((ip) => setLocalIpDetected(ip));
  }, []);

  const handleChangeGiro = (giro: GiroNegocio) => {
    const preset = getPresetForGiro(giro);
    setDraft((prev) => ({ ...prev, ...preset }));
  };

  const handleTestLan = async () => {
    setLanTestStatus('Probando conexión...');
    const ok = await checkLanHealth(draft.ipCajaPrincipal);
    setLanTestStatus(
      ok
        ? 'Conexión LAN exitosa con Caja Principal.'
        : 'No responde el servidor LAN en esa IP (verifica que Caja Principal esté abierta).'
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-zinc-300 max-w-2xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-zinc-700" />
            <h3 className="font-bold text-base text-zinc-950">
              Configuración de Eliana POS (Negocio, Red Local y Periféricos)
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pestañas internas */}
        <div className="flex gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200 shrink-0">
          {[
            { id: 'NEGOCIO' as const, label: '1. Giro e Identidad', icon: Store },
            { id: 'RED_LAN' as const, label: '2. Red Local Multi-Caja', icon: Network },
            { id: 'HARDWARE' as const, label: '3. Gramera, Cajón e Impresora', icon: Cpu },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
          {tab === 'NEGOCIO' && (
            <>
              <div>
                <label className="font-bold text-zinc-800 block mb-1.5">
                  Perfil / Giro del Negocio (adapta los módulos automáticamente)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'RESTAURANTE' as GiroNegocio, title: 'Restaurante / Bar', desc: 'Mesas, Comandas, Domicilios y Propinas' },
                    { id: 'COMERCIO_RETAIL' as GiroNegocio, title: 'Comercio / Tienda', desc: 'Minimercado, Ferretería, Código de barras y Peso' },
                    { id: 'HIBRIDO' as GiroNegocio, title: 'Híbrido / Café', desc: 'Mostrador rápido + Mesas y Gramera' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleChangeGiro(g.id)}
                      className={`p-3 rounded-lg border text-left cursor-pointer ${
                        draft.giro === g.id
                          ? 'bg-blue-50 border-blue-600 text-zinc-950'
                          : 'bg-white border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      <div className="font-bold">{g.title}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">{g.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'habilitaMesas' as const, label: 'Mapa de Mesas (F2)' },
                  { key: 'habilitaDomicilios' as const, label: 'Domicilios (F3)' },
                  { key: 'habilitaComandasCocina' as const, label: 'Comandas Cocina' },
                  { key: 'habilitaPropinas' as const, label: 'Propinas' },
                ].map((sw) => (
                  <label
                    key={sw.key}
                    className="flex items-center gap-2 p-2.5 rounded-md border border-zinc-200 bg-zinc-50 cursor-pointer font-semibold text-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(draft[sw.key])}
                      onChange={(e) => setDraft({ ...draft, [sw.key]: e.target.checked })}
                    />
                    {sw.label}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Nombre Comercial (Ticket)</label>
                  <input
                    type="text"
                    value={draft.nombreComercial}
                    onChange={(e) => setDraft({ ...draft, nombreComercial: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">NIT / RUT</label>
                  <input
                    type="text"
                    value={draft.nit}
                    onChange={(e) => setDraft({ ...draft, nit: e.target.value })}
                    placeholder="Opcional"
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Dirección</label>
                  <input
                    type="text"
                    value={draft.direccion}
                    onChange={(e) => setDraft({ ...draft, direccion: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={draft.telefono}
                    onChange={(e) => setDraft({ ...draft, telefono: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Nombre Impuesto</label>
                  <input
                    type="text"
                    value={draft.nombreImpuesto}
                    onChange={(e) => setDraft({ ...draft, nombreImpuesto: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">% Impuesto (0, 8, 19)</label>
                  <input
                    type="number"
                    value={draft.porcentajeImpuesto}
                    onChange={(e) => setDraft({ ...draft, porcentajeImpuesto: Number(e.target.value || 0) })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-bold"
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'RED_LAN' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                <div className="font-bold text-zinc-900">IP Local detectada de este equipo: {localIpDetected}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Si este PC es la <b>Caja Principal</b>, el servidor LAN escucha automáticamente en{' '}
                  <code>{localIpDetected}:4545</code> para operar sin internet entre cajas.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, rolTerminal: 'PRINCIPAL', ipCajaPrincipal: '127.0.0.1:4545' })}
                  className={`p-3 rounded-lg border text-left cursor-pointer ${
                    draft.rolTerminal === 'PRINCIPAL'
                      ? 'bg-blue-50 border-blue-600'
                      : 'bg-white border-zinc-200'
                  }`}
                >
                  <div className="font-bold text-zinc-900">Caja Principal (Servidor Local)</div>
                  <div className="text-[11px] text-zinc-500">Centraliza mesas, cuentas y sincroniza con la nube.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, rolTerminal: 'SECUNDARIA' })}
                  className={`p-3 rounded-lg border text-left cursor-pointer ${
                    draft.rolTerminal === 'SECUNDARIA'
                      ? 'bg-blue-50 border-blue-600'
                      : 'bg-white border-zinc-200'
                  }`}
                >
                  <div className="font-bold text-zinc-900">Caja Secundaria / Auxiliar</div>
                  <div className="text-[11px] text-zinc-500">Se conecta por Wi-Fi/cable a la IP de Caja Principal.</div>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Nombre de esta Terminal</label>
                  <input
                    type="text"
                    value={draft.nombreCaja}
                    onChange={(e) => setDraft({ ...draft, nombreCaja: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">IP:Puerto de Caja Principal</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={draft.ipCajaPrincipal}
                      onChange={(e) => setDraft({ ...draft, ipCajaPrincipal: e.target.value })}
                      placeholder="192.168.1.50:4545"
                      className="flex-1 px-2.5 py-1.5 border border-zinc-300 rounded-md font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleTestLan}
                      className="px-3 py-1.5 rounded bg-zinc-900 text-white font-semibold cursor-pointer"
                    >
                      Probar
                    </button>
                  </div>
                </div>
              </div>
              {lanTestStatus && <div className="text-xs font-semibold text-blue-700">{lanTestStatus}</div>}
            </div>
          )}

          {tab === 'HARDWARE' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Modelo de Gramera / Báscula</label>
                <select
                  value={draft.modeloBascula}
                  onChange={(e) => setDraft({ ...draft, modeloBascula: e.target.value as ModeloBascula })}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-semibold"
                >
                  <option value="TORREY_MFQ">Torrey MFQ / L-EQ</option>
                  <option value="RHINO_BAR">Rhino (BAR / BACO / BAPO)</option>
                  <option value="CAS_PDII">CAS (PD-I / PD-II / ERPLUS)</option>
                  <option value="KRETZ">Kretz Single</option>
                  <option value="GENERICA">Genérica Serial</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Puerto Serial Báscula</label>
                <input
                  type="text"
                  value={draft.puertoBascula}
                  onChange={(e) => setDraft({ ...draft, puertoBascula: e.target.value })}
                  placeholder="COM3"
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Perfil de Cajón Monedero</label>
                <select
                  value={draft.modeloCajon}
                  onChange={(e) => setDraft({ ...draft, modeloCajon: e.target.value as ModeloCajon })}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-semibold"
                >
                  <option value="EPSON_STD">Epson (TM-T88 / TM-T20 / Estándar)</option>
                  <option value="STAR_TSP">Star Micronics (TSP600 / SP500)</option>
                  <option value="CITIZEN">Citizen</option>
                  <option value="POSLINE">PosLine</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">IP / Puerto Impresora Térmica</label>
                <input
                  type="text"
                  value={draft.ipImpresora}
                  onChange={(e) => setDraft({ ...draft, ipImpresora: e.target.value })}
                  placeholder="127.0.0.1:9100"
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Ancho de Papel</label>
                <select
                  value={draft.anchoTicketMm}
                  onChange={(e) => setDraft({ ...draft, anchoTicketMm: Number(e.target.value) as 80 | 58 })}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-md font-semibold"
                >
                  <option value={80}>80 mm (42 columnas)</option>
                  <option value={58}>58 mm (32 columnas)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-zinc-300 text-xs font-semibold text-zinc-700 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
}
