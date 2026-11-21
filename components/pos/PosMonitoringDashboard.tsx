'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  DollarSign,
  Monitor,
  PackageX,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { loadElianaPosConfig } from '@/lib/posConfig';
import {
  getDesktopDiagnostics,
  isTauriDesktop,
  testPrinterConnection,
  type DesktopDiagnostics,
} from '@/lib/posHardwareBridge';

interface AlertaMonitoreo {
  id: string;
  severidad: 'ALTA' | 'MEDIA';
  categoria: 'ANTIFRAUDE' | 'CAJA' | 'OPERACION' | 'INVENTARIO';
  titulo: string;
  detalle: string;
  usuario?: string;
  monto?: number;
  hora?: string;
}

interface MonitoreoData {
  fechaOperativa: string;
  generatedAt: string;
  telegramActivo: boolean;
  salud: {
    bdOk: boolean;
    dbLatencyMs: number;
    authEnforcement: string;
    cajasTotales: number;
    cajasActivas: number;
  };
  ventasHoy: {
    totalFacturado: number;
    ordenesPagadas: number;
    ordenesAbiertas: number;
    ordenesAnuladas: number;
    ticketPromedio: number;
    metodosPago: {
      efectivo: number;
      datafono: number;
      transferencia: number;
      credito: number;
    };
  };
  alertas: AlertaMonitoreo[];
  auditoriaReciente: Array<{
    id: string;
    caja_nombre?: string;
    usuario_cajero?: string;
    autorizado_por?: string;
    tipo_alerta?: string;
    nivel_riesgo?: string;
    orden_consecutivo?: string;
    valor_afectado?: number;
    descripcion?: string;
    created_at?: string;
  }>;
  stockCritico: Array<{
    id: string;
    codigo?: string;
    nombre: string;
    existencia: number;
    inv_minimo?: number;
  }>;
}

interface SmokeCheckItem {
  label: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
}

const cop = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

export default function PosMonitoringDashboard() {
  const [data, setData] = useState<MonitoreoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [diagRunning, setDiagRunning] = useState(false);
  const [smokeChecks, setSmokeChecks] = useState<SmokeCheckItem[] | null>(null);
  const [desktopDiag, setDesktopDiag] = useState<DesktopDiagnostics | null>(null);

  const fetchMonitoreo = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/admin-pos/monitoreo', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setData(json as MonitoreoData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error consultando monitoreo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMonitoreo();
  }, [fetchMonitoreo]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void fetchMonitoreo();
    }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchMonitoreo]);

  const runSmokeDiagnostics = async () => {
    setDiagRunning(true);
    const checks: SmokeCheckItem[] = [];

    // 1. Salud Nube / BD
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const h = await res.json();
      if (res.ok && h?.ok) {
        checks.push({
          label: 'API Nube y Supabase',
          status: h.dbLatencyMs > 800 ? 'WARN' : 'PASS',
          detail: `Latencia BD: ${h.dbLatencyMs} ms | Auth: ${h.checks?.authEnforcement || 'unknown'}`,
        });
      } else {
        checks.push({
          label: 'API Nube y Supabase',
          status: 'FAIL',
          detail: h?.error || `HTTP ${res.status}`,
        });
      }
    } catch (e: unknown) {
      checks.push({
        label: 'API Nube y Supabase',
        status: 'FAIL',
        detail: e instanceof Error ? e.message : 'Sin conexión',
      });
    }

    // 2. Servicio LAN local (:4545)
    try {
      const lanRes = await fetch('http://127.0.0.1:4545/lan/health', {
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      });
      if (lanRes.ok) {
        checks.push({
          label: 'Servidor LAN local (:4545)',
          status: 'PASS',
          detail: 'Respondiendo correctamente en 127.0.0.1:4545',
        });
      } else {
        checks.push({
          label: 'Servidor LAN local (:4545)',
          status: 'WARN',
          detail: `Estado HTTP ${lanRes.status}`,
        });
      }
    } catch {
      checks.push({
        label: 'Servidor LAN local (:4545)',
        status: isTauriDesktop() ? 'FAIL' : 'WARN',
        detail: isTauriDesktop()
          ? 'Puerto 4545 no responde en la app de escritorio'
          : 'No detectado (normal si estás en navegador web fuera del PC de caja)',
      });
    }

    // 3. Diagnóstico nativo Tauri + Impresora
    if (isTauriDesktop()) {
      const d = await getDesktopDiagnostics();
      if (d.ok) {
        setDesktopDiag(d.data);
        checks.push({
          label: 'Cola Offline y Puertos COM',
          status: d.data.pendingOpsCount > 0 ? 'WARN' : 'PASS',
          detail: `IP: ${d.data.localIp} | Cola pendiente: ${d.data.pendingOpsCount} ops | COM: ${
            d.data.serialPorts.length > 0 ? d.data.serialPorts.join(', ') : 'ninguno'
          }`,
        });
      }

      const cfg = loadElianaPosConfig();
      const printerRes = await testPrinterConnection(cfg.ipImpresora);
      checks.push({
        label: `Impresora térmica (${cfg.ipImpresora})`,
        status: printerRes.ok ? 'PASS' : 'FAIL',
        detail: printerRes.ok ? printerRes.message : printerRes.error,
      });
    } else {
      checks.push({
        label: 'Hardware nativo Tauri',
        status: 'WARN',
        detail: 'Ejecutando en navegador web; pruebas TCP :9100 y COM requieren app de escritorio.',
      });
    }

    setSmokeChecks(checks);
    setDiagRunning(false);
  };

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
        Cargando Torre de Control...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra superior de control */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Activity className="w-4 h-4 text-emerald-600" />
            Torre de Control en Vivo ({data?.fechaOperativa || 'Hoy'})
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <WifiOff className="w-3 h-3" /> Telegram desactivado (solo panel)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none mr-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300"
            />
            Auto 30s
          </label>
          <button
            type="button"
            onClick={runSmokeDiagnostics}
            disabled={diagRunning}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5" />
            {diagRunning ? 'Probando...' : 'Diagnóstico de Equipo'}
          </button>
          <button
            type="button"
            onClick={() => void fetchMonitoreo()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold">
          Error cargando monitoreo: {error}
        </div>
      )}

      {/* Resultado del diagnóstico smoke test */}
      {smokeChecks && (
        <div className="bg-white border border-blue-200 rounded-2xl p-4 space-y-2.5">
          <div className="text-xs font-bold text-slate-900">
            Resultado de Diagnóstico del Equipo
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {smokeChecks.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50"
              >
                {item.status === 'PASS' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                {item.status === 'WARN' && (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                {item.status === 'FAIL' && (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900">{item.label}</div>
                  <div className="text-[11px] text-slate-600 break-words">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
          {desktopDiag && (
            <div className="text-[11px] text-slate-500 pt-1">
              Archivo LAN local: <span className="font-mono">{desktopDiag.lanStorePath}</span> (
              {desktopDiag.stateFileBytes} bytes)
            </div>
          )}
        </div>
      )}

      {data && (
        <>
          {/* Semáforo técnico y KPIs en vivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Salud Base de Datos</span>
                <Database className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {data.salud.dbLatencyMs} ms
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Seguridad: <span className="font-semibold">{data.salud.authEnforcement}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Facturación Hoy</span>
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {cop(data.ventasHoy.totalFacturado)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {data.ventasHoy.ordenesPagadas} pagadas · Ticket prom.{' '}
                {cop(data.ventasHoy.ticketPromedio)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Operación en Salón</span>
                <Monitor className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {data.ventasHoy.ordenesAbiertas} abiertas
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Cajas activas: {data.salud.cajasActivas}/{data.salud.cajasTotales} · Anuladas:{' '}
                {data.ventasHoy.ordenesAnuladas}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Alertas Activas</span>
                <ShieldCheck
                  className={`w-4 h-4 ${
                    data.alertas.some((a) => a.severidad === 'ALTA')
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}
                />
              </div>
              <div className="text-xl font-extrabold text-slate-900">{data.alertas.length}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Efectivo {cop(data.ventasHoy.metodosPago.efectivo)} · Transf.{' '}
                {cop(data.ventasHoy.metodosPago.transferencia)}
              </div>
            </div>
          </div>

          {/* Alertas y Stock crítico */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Alertas Antifraude, Caja y Operación
                </h3>
                <span className="text-[11px] text-slate-500">
                  Actualizado {new Date(data.generatedAt).toLocaleTimeString('es-CO')}
                </span>
              </div>
              {data.alertas.length === 0 ? (
                <div className="p-8 text-center text-xs text-emerald-700 font-medium">
                  Sin anomalías detectadas en el turno actual.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.alertas.map((a) => (
                    <div key={a.id} className="px-5 py-3 flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              a.severidad === 'ALTA'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {a.severidad} · {a.categoria}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{a.titulo}</span>
                        </div>
                        <p className="text-xs text-slate-600">{a.detalle}</p>
                      </div>
                      {a.usuario && (
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                          {a.usuario}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
                <PackageX className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Stock Crítico (≤ 5)</h3>
              </div>
              {data.stockCritico.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Sin productos en stock crítico.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {data.stockCritico.map((p) => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate pr-2">{p.nombre}</span>
                      <span
                        className={`font-bold shrink-0 ${
                          Number(p.existencia) <= 0 ? 'text-red-600' : 'text-amber-700'
                        }`}
                      >
                        {p.existencia}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Auditoría reciente */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Últimos Eventos de Auditoría Inmutable (Hoy)
              </h3>
            </div>
            {data.auditoriaReciente.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Sin eventos sensibles registrados hoy.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2.5 px-4 text-left font-semibold">Evento</th>
                      <th className="py-2.5 px-4 text-left font-semibold">Cajero</th>
                      <th className="py-2.5 px-4 text-left font-semibold">Autorizó</th>
                      <th className="py-2.5 px-4 text-left font-semibold">Detalle</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.auditoriaReciente.map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {ev.tipo_alerta || 'EVENTO'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{ev.usuario_cajero || '—'}</td>
                        <td className="py-2.5 px-4 text-slate-700">{ev.autorizado_por || '—'}</td>
                        <td className="py-2.5 px-4 text-slate-600 max-w-md truncate">
                          {ev.descripcion || ev.orden_consecutivo || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-900">
                          {ev.valor_afectado ? cop(Number(ev.valor_afectado)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
