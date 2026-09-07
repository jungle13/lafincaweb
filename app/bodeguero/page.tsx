'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import OperationTabs, { OperationType } from '@/components/bodeguero/OperationTabs';
import FormEntradaCompra from '@/components/bodeguero/FormEntradaCompra';
import FormPorcionado from '@/components/bodeguero/FormPorcionado';
import FormTrasladoCocina from '@/components/bodeguero/FormTrasladoCocina';
import FormDevolucionCocina from '@/components/bodeguero/FormDevolucionCocina';
import FormMermaBaja from '@/components/bodeguero/FormMermaBaja';
import TimelineFeed from '@/components/bodeguero/TimelineFeed';
import { InsumoItem, MovimientoItem } from '@/types';
import { Loader2, Lock } from 'lucide-react';
import { usePeriodo } from '@/context/PeriodoContext';

export default function BodegueroPage() {
  const { currentPeriodo, selectedPeriodoId } = usePeriodo();

  const [activeTab, setActiveTab] = useState<OperationType>('ENTRADA_COMPRA');
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoItem[]>([]);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const isClosed = currentPeriodo?.estado === 'CERRADO';

  const loadData = useCallback(async () => {
    try {
      const ts = Date.now();
      const periodParam = selectedPeriodoId ? `&periodo_id=${selectedPeriodoId}` : '';
      const [stockRes, movsRes, periodRes] = await Promise.all([
        fetch(`/api/bodega/stock?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/bodega/movimientos?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/periodos?t=${ts}${periodParam}`, { cache: 'no-store' }),
      ]);

      const stockData = await stockRes.json();
      const movsData = await movsRes.json();
      const periodData = await periodRes.json();

      let baseInsumos: InsumoItem[] = stockData.data || [];

      // Si tenemos stock calculado para este periodo específico, enriquecemos las existencias
      if (periodData.success && Array.isArray(periodData.stock) && periodData.stock.length > 0) {
        const periodStockMap = new Map<string, any>();
        periodData.stock.forEach((s: any) => periodStockMap.set(String(s.insumo_id), s));

        baseInsumos = baseInsumos.map((item) => {
          const pStock = periodStockMap.get(String(item.insumo_id));
          if (!pStock) return item;

          const bSinPorc = parseFloat(pStock.bodega_sin_porcionar_kg ?? item.bodega_sin_porc_kg) || 0;
          const bPorcUnd = parseInt(pStock.bodega_porcionado_und ?? item.bodega_porc_und) || 0;
          const bPorcKg = parseFloat(pStock.bodega_porcionado_kg ?? item.bodega_porc_kg) || 0;
          const cSinPorc = parseFloat(pStock.cocina_sin_porcionar_kg ?? item.cocina_sin_porc_kg) || 0;
          const cPorcUnd = parseInt(pStock.cocina_porcionado_und ?? item.cocina_porc_und) || 0;
          const cPorcKg = parseFloat(pStock.cocina_porcionado_kg ?? item.cocina_porc_kg) || 0;
          const totalBodegaKg = bSinPorc + bPorcKg;
          const totalCocinaKg = cSinPorc + cPorcKg;
          const totalGeneralKg = totalBodegaKg + totalCocinaKg;
          const valorTotal = Math.round(totalGeneralKg * (item.costo_unitario_kg || 0));

          return {
            ...item,
            bodega_sin_porc_kg: bSinPorc,
            bodega_porc_und: bPorcUnd,
            bodega_porc_kg: bPorcKg,
            peso_total_bodega_kg: totalBodegaKg,
            cocina_sin_porc_kg: cSinPorc,
            cocina_porc_und: cPorcUnd,
            cocina_porc_kg: cPorcKg,
            peso_total_cocina_kg: totalCocinaKg,
            peso_total_general_kg: totalGeneralKg,
            valor_total_general_pesos: valorTotal,
          };
        });
      }

      setInsumos(baseInsumos);
      if (movsData.data) setMovimientos(movsData.data);
    } catch (e) {
      console.error('Error loading bodeguero data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar movimientos estrictamente por el rango del periodo seleccionado
  const periodoMovimientos = useMemo(() => {
    if (!currentPeriodo) return movimientos;
    const fInicio = currentPeriodo.fecha_inicio;
    const fFin = currentPeriodo.fecha_fin;

    return movimientos.filter((m) => {
      const d = (m.fecha || m.fecha_hora || m.fecha_movimiento || '').split('T')[0];
      if (!d) return true;
      if (fInicio && d < fInicio) return false;
      if (fFin && d > fFin) return false;
      return true;
    });
  }, [movimientos, currentPeriodo]);

  // Ajustar filterDate cuando cambia el periodo para que coincida con las fechas válidas
  useEffect(() => {
    if (!currentPeriodo) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const { fecha_inicio, fecha_fin } = currentPeriodo;

    if (todayStr >= fecha_inicio && todayStr <= fecha_fin) {
      setFilterDate(todayStr);
    } else {
      const validDates = periodoMovimientos
        .map((m) => (m.fecha || m.fecha_hora || m.fecha_movimiento || '').split('T')[0])
        .filter((d) => d >= fecha_inicio && d <= fecha_fin)
        .sort()
        .reverse();

      if (validDates.length > 0) {
        setFilterDate(validDates[0]);
      } else {
        setFilterDate(fecha_inicio);
      }
    }
  }, [currentPeriodo?.id, currentPeriodo?.fecha_inicio, currentPeriodo?.fecha_fin, periodoMovimientos]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-xs font-normal">Cargando Terminal del Bodeguero...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in font-normal">
      {/* Panel de Operaciones */}
      <div className="border-b border-slate-200 pb-6">
        {isClosed ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 text-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-200/80 flex items-center justify-center text-slate-600 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <span>Periodo Cerrado: {currentPeriodo?.nombre}</span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-medium">SOLO LECTURA</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Este periodo contable se encuentra cerrado y auditado. Para registrar nuevos ingresos, porcionados o traslados, selecciona un periodo en curso desde la barra superior.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <OperationTabs activeTab={activeTab} onChangeTab={setActiveTab} />

            <div className="pt-4">
              {activeTab === 'ENTRADA_COMPRA' && (
                <FormEntradaCompra insumos={insumos} onSuccess={loadData} />
              )}
              {activeTab === 'PORCIONADO' && (
                <FormPorcionado insumos={insumos} onSuccess={loadData} />
              )}
              {activeTab === 'TRASLADO_COCINA' && (
                <FormTrasladoCocina insumos={insumos} onSuccess={loadData} />
              )}
              {activeTab === 'DEVOLUCION_COCINA' && (
                <FormDevolucionCocina insumos={insumos} onSuccess={loadData} />
              )}
              {activeTab === 'BAJA_MERMA' && (
                <FormMermaBaja insumos={insumos} onSuccess={loadData} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Línea Temporal Plana */}
      <div className="pt-2" id="timeline">
        <TimelineFeed
          movimientos={periodoMovimientos}
          filterDate={filterDate}
          onDateChange={setFilterDate}
          onSuccess={loadData}
          insumos={insumos}
        />
      </div>
    </div>
  );
}
