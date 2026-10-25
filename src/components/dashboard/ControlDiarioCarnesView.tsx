'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Beef, 
  UtensilsCrossed, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Clock, 
  Printer, 
  RefreshCw,
  Loader2,
  Sparkles,
  BarChart3,
  Layers,
  ArrowRight,
  Filter,
  Flame,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { formatMoney } from '@/lib/formatters';
import { generateDailyControlPdfClient, DiaControlData } from '@/lib/dailyReportPdf';
import * as XLSX from 'xlsx';

interface MovimientoCarne {
  id: string;
  hora: string;
  tipoMovimiento?: string;
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

interface DiaControl {
  fecha: string;
  diaSemana: string;
  movimientosCarnes: MovimientoCarne[];
  platosCarnes: PlatoCarne[];
  costoCarnes: number;
  totalKgCarnes: number;
  totalUndCarnes: number;
  movimientosCount: number;
  ventaCarnes: number;
  platosVendidosUnd: number;
  platosCount: number;
  ganancia: number;
  margenPct: number;
  foodCostPct: number;
  estadoRentabilidad: 'EXCELENTE' | 'SALUDABLE' | 'ALERTA';
}

interface ControlDiarioResponse {
  success: boolean;
  kpis: {
    totalVentasCarnes: number;
    totalCostoCarnes: number;
    gananciaBruta: number;
    margenBrutoPct: number;
    foodCostPct: number;
    totalDias: number;
    diasConVenta: number;
    totalDespachos: number;
    totalKgDespachados: number;
    totalPorcionesDespachadas: number;
    totalPlatosVendidos: number;
    promedioDiarioVenta: number;
    promedioDiarioCosto: number;
    promedioDiarioGanancia: number;
    mejorDia: { fecha: string; diaSemana: string; ganancia: number; margenPct: number; ventaCarnes: number } | null;
    diaMayorVenta: { fecha: string; diaSemana: string; venta: number; costo: number } | null;
  };
  dias: DiaControl[];
}

export default function ControlDiarioCarnesView() {
  const [data, setData] = useState<ControlDiarioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rango de fechas
  const [fechaInicio, setFechaInicio] = useState('2026-09-01');
  const [fechaFin, setFechaFin] = useState('2026-09-30');

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRentabilidad, setFilterRentabilidad] = useState<'ALL' | 'EXCELENTE' | 'SALUDABLE' | 'ALERTA'>('ALL');
  const [showChart, setShowChart] = useState(true);

  // Día seleccionado para detalle interactivo sin cambiar de vista
  const [selectedFecha, setSelectedFecha] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'CARNES' | 'VENTAS'>('CARNES');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const detailRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/control-diario?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}&t=${Date.now()}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        if (json.dias && json.dias.length > 0) {
          if (selectedFecha && json.dias.some((d: DiaControl) => d.fecha === selectedFecha)) {
            // Mantener selección
          } else {
            const defaultDay = json.dias.find((d: DiaControl) => d.movimientosCarnes.length > 0 && d.ventaCarnes > 0) || json.dias[0];
            setSelectedFecha(defaultDay.fecha);
          }
        }
      } else {
        setError(json.error || 'No se pudo cargar la información');
      }
    } catch (e: any) {
      setError(e.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fechaInicio, fechaFin]);

  // Filtrado de días
  const filteredDias = useMemo(() => {
    if (!data?.dias) return [];
    const q = searchQuery.toLowerCase().trim();

    return data.dias.filter((d) => {
      if (filterRentabilidad !== 'ALL' && d.estadoRentabilidad !== filterRentabilidad) {
        return false;
      }
      if (!q) return true;
      return (
        d.fecha.includes(q) ||
        d.diaSemana.toLowerCase().includes(q) ||
        d.movimientosCarnes.some(m => m.insumoNombre.toLowerCase().includes(q) || m.insumoCodigo.toLowerCase().includes(q)) ||
        d.platosCarnes.some(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
      );
    });
  }, [data?.dias, searchQuery, filterRentabilidad]);

  // Día seleccionado actual
  const selectedDia = useMemo(() => {
    if (!data?.dias || !selectedFecha) return null;
    return data.dias.find(d => d.fecha === selectedFecha) || null;
  }, [data?.dias, selectedFecha]);

  const handleSelectDay = (fecha: string) => {
    setSelectedFecha(fecha);
    setTimeout(() => {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // Descarga inteligente de PDF oficial (servidor con fallback directo a jsPDF en el navegador)
  const handleDownloadPdf = async (diaToDownload: DiaControl) => {
    try {
      setDownloadingPdf(true);
      const url = `/api/dashboard/control-diario/pdf?fecha=${diaToDownload.fecha}`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `INFORME_CONTROL_CARNES_COCINA_${diaToDownload.fecha}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } else {
        generateDailyControlPdfClient(diaToDownload as DiaControlData);
      }
    } catch (err) {
      console.warn('Generando PDF en navegador:', err);
      generateDailyControlPdfClient(diaToDownload as DiaControlData);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleExportExcel = () => {
    if (!data?.dias) return;

    const rows = data.dias.map(d => ({
      'Fecha': d.fecha,
      'Día Semana': d.diaSemana,
      'Movs. Cocina': d.movimientosCarnes.length,
      'Cortes/Kilos Pasados a Cocina (Kg)': d.totalKgCarnes,
      'Porciones Pasadas a Cocina (Und)': d.totalUndCarnes,
      'Costo Carnes a Cocina ($ COP)': d.costoCarnes,
      'Platos Carnes Vendidos (Und)': d.platosVendidosUnd,
      'Ventas Platos Carnes ($ COP)': d.ventaCarnes,
      'Ganancia Bruta Carnes ($ COP)': d.ganancia,
      'Margen Bruto (%)': `${d.margenPct.toFixed(1)}%`,
      'Food Cost (%)': `${d.foodCostPct.toFixed(1)}%`,
      'Estado Rentabilidad': d.estadoRentabilidad
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 28 },
      { wch: 26 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 16 },
      { wch: 14 }, { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CONTROL_DIARIO_CARNES');
    XLSX.writeFile(wb, `CONTROL_DIARIO_CARNES_A_COCINA_VS_VENTAS_${fechaInicio}_${fechaFin}.xlsx`);
  };

  const chartData = useMemo(() => {
    if (!data?.dias) return [];
    return data.dias.map(d => ({
      fecha: d.fecha.substring(8),
      fechaCompleta: d.fecha,
      diaSemana: d.diaSemana,
      ventas: d.ventaCarnes,
      costo: d.costoCarnes,
      ganancia: d.ganancia,
      margen: d.margenPct
    }));
  }, [data?.dias]);

  if (loading && !data) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        <p className="text-sm font-medium">Consolidando control día a día: carnes pasadas a cocina vs. ventas...</p>
        <p className="text-xs text-slate-400">Sumando exclusivamente despachos a cocina frente a ventas de comida</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-red-700 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span>Error al cargar el módulo de control diario</span>
        </div>
        <p className="text-xs">{error || 'No se pudo obtener la información de carnes y ventas.'}</p>
        <button 
          onClick={fetchData} 
          className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium cursor-pointer"
        >
          Reintentar Carga
        </button>
      </div>
    );
  }

  const { kpis } = data;

  return (
    <div className="w-full space-y-6 animate-fade-in font-normal text-slate-800">
      {/* ========================================================================= */}
      {/* 1. HEADER EJECUTIVO & CONTROLES */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-xs">
              <Beef className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-950 tracking-tight">
                Control Diario: Carnes Pasadas a Cocina vs. Ventas
              </h1>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Relación día a día del costo total de carnes enviadas a cocina frente a las ventas efectivas de platos cárnicos
              </p>
            </div>
          </div>
        </div>

        {/* Acciones superiores & selector de periodo */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
            />
            <span className="text-slate-400">a</span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setShowChart(!showChart)}
            className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              showChart ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
            }`}
            title="Mostrar u ocultar gráfica de tendencia"
          >
            <BarChart3 className="w-4 h-4 text-orange-600" />
            <span>{showChart ? 'Ocultar Gráfica' : 'Ver Gráfica'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            title="Exportar consolidado mensual en Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel Mes</span>
          </button>

          {selectedDia && (
            <button
              onClick={() => handleDownloadPdf(selectedDia)}
              disabled={downloadingPdf}
              className="h-9 px-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title={`Descargar informe oficial en PDF del día ${selectedDia.fecha}`}
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>PDF Día {selectedDia.fecha.substring(8)}</span>
            </button>
          )}

          <button
            onClick={fetchData}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            title="Recargar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TARJETAS KPI GLOBALES DEL PERIODO */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Venta Carnes */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Ventas Platos Carne</span>
            <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg md:text-xl font-bold text-slate-900">
            ${formatMoney(kpis.totalVentasCarnes)}
          </div>
          <p className="text-[10px] text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {kpis.totalPlatosVendidos} platos vendidos en {kpis.diasConVenta} días
          </p>
        </div>

        {/* Costo Carnes Pasadas a Cocina */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Costo Carnes a Cocina</span>
            <Beef className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-lg md:text-xl font-bold text-slate-900">
            ${formatMoney(kpis.totalCostoCarnes)}
          </div>
          <p className="text-[10px] text-slate-500">
            {kpis.totalKgDespachados} Kg pasados a cocina ({kpis.totalPorcionesDespachadas} porc)
          </p>
        </div>

        {/* Ganancia Bruta */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Ganancia Bruta Carnes</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className={`text-lg md:text-xl font-bold ${kpis.gananciaBruta >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
            ${formatMoney(kpis.gananciaBruta)}
          </div>
          <p className="text-[10px] text-slate-500">
            Promedio: ${formatMoney(kpis.promedioDiarioGanancia)}/día
          </p>
        </div>

        {/* Margen Promedio */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Margen Bruto (%)</span>
            <Percent className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg md:text-xl font-bold text-amber-600">
            {kpis.margenBrutoPct}%
          </div>
          <p className="text-[10px] text-slate-500">
            Food Cost Cárnico: <strong>{kpis.foodCostPct}%</strong>
          </p>
        </div>

        {/* Jornada Récord */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/70 p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Día Récord Utilidad
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900 mt-0.5">
            {kpis.mejorDia ? `${kpis.mejorDia.fecha} (${kpis.mejorDia.diaSemana})` : '-'}
          </div>
          <p className="text-[10px] text-emerald-700 font-semibold">
            +${kpis.mejorDia ? formatMoney(kpis.mejorDia.ganancia) : '0'} COP ({kpis.mejorDia?.margenPct}%)
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. GRÁFICA INTERACTIVA: TENDENCIA DÍA A DÍA */}
      {/* ========================================================================= */}
      {showChart && chartData.length > 0 && (
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-orange-600" />
                <span>Tendencia Día a Día: Ventas ($) vs. Costo Carnes Pasadas a Cocina ($) y Margen (%)</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Haz clic en cualquier barra o fecha para cargar su auditoría completa en el panel inferior
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" /> Ventas Platos Carne
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-red-500 inline-block" /> Costo Carnes Pasadas a Cocina
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-amber-500 inline-block" /> Margen %
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const payload = e.activePayload[0].payload;
                    if (payload && payload.fechaCompleta) {
                      handleSelectDay(payload.fechaCompleta);
                    }
                  }
                }}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="fecha" 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="left" 
                  orientation="left"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#d97706' }}
                  tickFormatter={(val) => `${val}%`}
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === 'margen') return [`${value}%`, 'Margen %'];
                    return [`$${formatMoney(value)} COP`, name === 'ventas' ? 'Venta Carnes' : 'Costo Carnes a Cocina'];
                  }}
                  labelFormatter={(label) => {
                    const found = chartData.find(c => c.fecha === label);
                    return `${found?.fechaCompleta || label} (${found?.diaSemana || ''})`;
                  }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Bar yAxisId="left" dataKey="ventas" name="ventas" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar yAxisId="left" dataKey="costo" name="costo" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line yAxisId="right" type="monotone" dataKey="margen" name="margen" stroke="#d97706" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FILTROS & BUSCADOR */}
      {/* ========================================================================= */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por fecha, corte de carne o plato..."
            className="w-full h-8.5 pl-8.5 pr-3 text-xs rounded-xl border border-slate-200 outline-none focus:border-orange-500 bg-slate-50 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Rentabilidad:</span>
          <button
            onClick={() => setFilterRentabilidad('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              filterRentabilidad === 'ALL'
                ? 'bg-orange-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Todos ({data.dias.length})
          </button>
          <button
            onClick={() => setFilterRentabilidad('EXCELENTE')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              filterRentabilidad === 'EXCELENTE'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            🟢 Excelente (&gt;60%)
          </button>
          <button
            onClick={() => setFilterRentabilidad('SALUDABLE')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              filterRentabilidad === 'SALUDABLE'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            🔵 Saludable (35-60%)
          </button>
          <button
            onClick={() => setFilterRentabilidad('ALERTA')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              filterRentabilidad === 'ALERTA'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            🔴 Alerta (&lt;35%)
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. TABLA PRINCIPAL: RESUMEN DÍA A DÍA */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Jornadas Operativas — Carnes Pasadas a Cocina vs. Ventas ({filteredDias.length} días)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Haz clic en cualquier fila para inspeccionar el detalle sin cambiar de vista
          </span>
        </div>

        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="text-[10.5px] font-semibold text-slate-500 uppercase bg-slate-50/95 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="px-3.5 py-2.5">Fecha / Jornada</th>
                <th className="px-3 py-2.5 text-center">Despachos Cocina</th>
                <th className="px-3.5 py-2.5 text-right">Costo Carnes a Cocina</th>
                <th className="px-3 py-2.5 text-center">Platos Vendidos</th>
                <th className="px-3.5 py-2.5 text-right">Ventas Platos Carne</th>
                <th className="px-3.5 py-2.5 text-right">Ganancia Bruta</th>
                <th className="px-3 py-2.5 text-center">Margen %</th>
                <th className="px-3 py-2.5 text-center">Food Cost %</th>
                <th className="px-3.5 py-2.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDias.map((dia) => {
                const isSelected = selectedFecha === dia.fecha;
                const isWeekend = dia.diaSemana === 'Sábado' || dia.diaSemana === 'Domingo';

                return (
                  <tr
                    key={dia.fecha}
                    onClick={() => handleSelectDay(dia.fecha)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/80 border-l-4 border-l-orange-600 font-medium'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Fecha */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          dia.estadoRentabilidad === 'EXCELENTE' ? 'bg-emerald-500' :
                          dia.estadoRentabilidad === 'SALUDABLE' ? 'bg-blue-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <div className="font-semibold text-slate-900">
                            {dia.fecha}
                          </div>
                          <div className={`text-[10px] ${isWeekend ? 'text-orange-600 font-bold flex items-center gap-0.5' : 'text-slate-400'}`}>
                            {dia.diaSemana} {isWeekend && <Flame className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Despachos a Cocina */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {dia.movimientosCarnes.length} movs
                      </span>
                      <div className="text-[9.5px] text-slate-400 mt-0.5">
                        {dia.totalKgCarnes > 0 && `${dia.totalKgCarnes.toFixed(1)} Kg `}
                        {dia.totalUndCarnes > 0 && `(${dia.totalUndCarnes} porc)`}
                      </div>
                    </td>

                    {/* Costo Carnes a Cocina */}
                    <td className="px-3.5 py-2.5 text-right font-medium text-slate-900 whitespace-nowrap">
                      ${formatMoney(dia.costoCarnes)}
                    </td>

                    {/* Platos Vendidos */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold text-[11px]">
                        {dia.platosVendidosUnd} und
                      </span>
                      <div className="text-[9.5px] text-slate-400 mt-0.5">
                        {dia.platosCarnes.length} variedades
                      </div>
                    </td>

                    {/* Ventas Carnes */}
                    <td className="px-3.5 py-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap">
                      ${formatMoney(dia.ventaCarnes)}
                    </td>

                    {/* Ganancia Bruta */}
                    <td className={`px-3.5 py-2.5 text-right font-bold whitespace-nowrap ${
                      dia.ganancia >= 0 ? 'text-blue-700' : 'text-red-600'
                    }`}>
                      ${formatMoney(dia.ganancia)}
                    </td>

                    {/* Margen % */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                        dia.estadoRentabilidad === 'EXCELENTE' ? 'bg-emerald-100 text-emerald-800' :
                        dia.estadoRentabilidad === 'SALUDABLE' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {dia.margenPct.toFixed(1)}%
                      </span>
                    </td>

                    {/* Food Cost % */}
                    <td className="px-3 py-2.5 text-center text-slate-500 whitespace-nowrap">
                      {dia.foodCostPct.toFixed(1)}%
                    </td>

                    {/* Acciones */}
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleSelectDay(dia.fecha)}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                          title="Inspeccionar detalle del día"
                        >
                          <span>Detalle</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() => handleDownloadPdf(dia)}
                          disabled={downloadingPdf}
                          className="p-1.5 rounded-md bg-slate-50 hover:bg-orange-50 text-slate-500 hover:text-orange-600 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                          title={`Descargar PDF oficial del día ${dia.fecha}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. PANEL DE DETALLE INTEGRADO (MASTER-DETAIL SIN CAMBIAR DE VISTA) */}
      {/* ========================================================================= */}
      {selectedDia && (
        <div ref={detailRef} className="bg-white rounded-2xl border-2 border-orange-300/90 p-4 md:p-5 space-y-4 shadow-sm animate-fade-in">
          {/* Header del Día Seleccionado */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-orange-600 text-white font-bold text-xs uppercase tracking-wide">
                  Jornada Seleccionada
                </span>
                <span className="text-base md:text-lg font-bold text-slate-950">
                  {selectedDia.fecha} — {selectedDia.diaSemana}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Auditoría detallada de todos los cortes de carne pasados a cocina y platos cárnicos vendidos en esta jornada
              </p>
            </div>

            {/* Balanza Financiera Rápida & Botón Descarga PDF */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-right">
                <span className="text-[10px] text-slate-400 uppercase font-medium block">Ventas Carnes</span>
                <span className="text-xs font-bold text-emerald-700">${formatMoney(selectedDia.ventaCarnes)}</span>
              </div>
              <div className="text-slate-300 font-bold">-</div>
              <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-right">
                <span className="text-[10px] text-slate-400 uppercase font-medium block">Costo Carnes a Cocina</span>
                <span className="text-xs font-bold text-red-600">${formatMoney(selectedDia.costoCarnes)}</span>
              </div>
              <div className="text-slate-300 font-bold">=</div>
              <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-right">
                <span className="text-[10px] text-amber-800 uppercase font-bold block">Ganancia ({selectedDia.margenPct}%)</span>
                <span className="text-xs font-extrabold text-blue-700">${formatMoney(selectedDia.ganancia)}</span>
              </div>

              <button
                onClick={() => handleDownloadPdf(selectedDia)}
                disabled={downloadingPdf}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Descargar informe oficial en PDF de esta jornada"
              >
                {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Descargar PDF del Día</span>
              </button>
            </div>
          </div>

          {/* Selector de Pestañas del Detalle */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveDetailTab('CARNES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeDetailTab === 'CARNES'
                  ? 'bg-orange-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100'
              }`}
            >
              <Beef className="w-3.5 h-3.5" />
              <span>1. Carnes Pasadas a Cocina ({selectedDia.movimientosCarnes.length})</span>
            </button>

            <button
              onClick={() => setActiveDetailTab('VENTAS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeDetailTab === 'VENTAS'
                  ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>2. Platos Vendidos ({selectedDia.platosCarnes.length})</span>
            </button>
          </div>

          {/* CONTENIDO PESTAÑA 1: CARNES PASADAS A COCINA */}
          {activeDetailTab === 'CARNES' && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Desglose de entregas de cortes desde bodega a cocina durante la jornada:</span>
                <span className="font-semibold text-slate-700">
                  Costo Total Despachos: ${formatMoney(selectedDia.costoCarnes)} COP
                </span>
              </div>

              {selectedDia.movimientosCarnes.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No se registraron movimientos de carnes hacia cocina en esta fecha.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="text-[10px] font-semibold text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Hora</th>
                        <th className="px-3 py-2">Cód.</th>
                        <th className="px-3 py-2">Insumo / Corte</th>
                        <th className="px-3 py-2">Categoría</th>
                        <th className="px-3 py-2 text-right">Cant. Entero (Kg)</th>
                        <th className="px-3 py-2 text-right">Porciones (Und)</th>
                        <th className="px-3 py-2 text-right">Peso Porc. (Kg)</th>
                        <th className="px-3 py-2 text-right">Total Kg</th>
                        <th className="px-3 py-2 text-right">Costo Unit. ($)</th>
                        <th className="px-3 py-2 text-right">Subtotal Costo ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedDia.movimientosCarnes.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">{m.hora}</td>
                          <td className="px-3 py-2 font-mono text-[11px] font-semibold text-slate-700">{m.insumoCodigo}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{m.insumoNombre}</td>
                          <td className="px-3 py-2 text-slate-500 text-[11px]">{m.categoria}</td>
                          <td className="px-3 py-2 text-right">{m.cantSinPorcKg > 0 ? `${m.cantSinPorcKg.toFixed(2)} Kg` : '-'}</td>
                          <td className="px-3 py-2 text-right font-semibold">{m.porcionesUnd > 0 ? `${m.porcionesUnd} und` : '-'}</td>
                          <td className="px-3 py-2 text-right">{m.pesoPorcKg > 0 ? `${m.pesoPorcKg.toFixed(2)} Kg` : '-'}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900">{m.totalKg > 0 ? `${m.totalKg.toFixed(2)} Kg` : '-'}</td>
                          <td className="px-3 py-2 text-right text-slate-600">${formatMoney(m.costoUnit)}</td>
                          <td className="px-3 py-2 text-right font-bold text-red-600">
                            ${formatMoney(m.valorTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-amber-50/80 border-t-2 border-slate-300 font-bold text-xs text-amber-950">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-left uppercase">Total Despachos del Día</td>
                        <td className="px-3 py-2 text-right">
                          {selectedDia.movimientosCarnes.reduce((acc, m) => acc + m.cantSinPorcKg, 0).toFixed(2)} Kg
                        </td>
                        <td className="px-3 py-2 text-right">{selectedDia.totalUndCarnes} und</td>
                        <td className="px-3 py-2 text-right">
                          {selectedDia.movimientosCarnes.reduce((acc, m) => acc + m.pesoPorcKg, 0).toFixed(2)} Kg
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-slate-900">{selectedDia.totalKgCarnes.toFixed(2)} Kg</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right text-red-700 font-extrabold text-sm">${formatMoney(selectedDia.costoCarnes)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CONTENIDO PESTAÑA 2: VENTAS DE PLATOS */}
          {activeDetailTab === 'VENTAS' && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Platos de comida cárnica facturados en este día (excluidas bebidas y extras no cárnicos):</span>
                <span className="font-semibold text-emerald-800">
                  Gran Total Ventas Carnes: ${formatMoney(selectedDia.ventaCarnes)} COP
                </span>
              </div>

              {selectedDia.platosCarnes.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No se registraron ventas de platos cárnicos en esta fecha.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[360px]">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="text-[10px] font-semibold text-slate-500 uppercase bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2">Cód.</th>
                        <th className="px-3 py-2">Plato / Menú Vendido</th>
                        <th className="px-3 py-2 text-right">Cant. Vendida (Und)</th>
                        <th className="px-3 py-2 text-right">Precio Unitario ($)</th>
                        <th className="px-3 py-2 text-right">Gran Total Venta ($)</th>
                        <th className="px-3 py-2 text-center">% del Día</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedDia.platosCarnes.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">{p.codigo}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{p.nombre}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">{p.cantidad} und</td>
                          <td className="px-3 py-2 text-right text-slate-600">${formatMoney(p.valorUnitario)}</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">${formatMoney(p.granTotal)}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{p.porcentajeDia.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-50/90 border-t-2 border-slate-300 font-bold text-xs text-emerald-950 sticky bottom-0">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-left uppercase">Total Platos Cárnicos Vendidos</td>
                        <td className="px-3 py-2 text-right">{selectedDia.platosVendidosUnd} und</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right text-emerald-800 font-extrabold text-sm">${formatMoney(selectedDia.ventaCarnes)}</td>
                        <td className="px-3 py-2 text-center">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
