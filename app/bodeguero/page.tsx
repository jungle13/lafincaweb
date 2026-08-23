'use client';

import { useState, useEffect, useCallback } from 'react';
import OperationTabs, { OperationType } from '@/components/bodeguero/OperationTabs';
import FormEntradaCompra from '@/components/bodeguero/FormEntradaCompra';
import FormPorcionado from '@/components/bodeguero/FormPorcionado';
import FormTrasladoCocina from '@/components/bodeguero/FormTrasladoCocina';
import FormDevolucionCocina from '@/components/bodeguero/FormDevolucionCocina';
import TimelineFeed from '@/components/bodeguero/TimelineFeed';
import { InsumoItem, MovimientoItem } from '@/types';
import { Loader2 } from 'lucide-react';

export default function BodegueroPage() {
  const [activeTab, setActiveTab] = useState<OperationType>('ENTRADA_COMPRA');
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoItem[]>([]);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const ts = Date.now();
      const [stockRes, movsRes] = await Promise.all([
        fetch(`/api/bodega/stock?t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/bodega/movimientos?t=${ts}`, { cache: 'no-store' }),
      ]);

      const stockData = await stockRes.json();
      const movsData = await movsRes.json();

      if (stockData.data) setInsumos(stockData.data);
      if (movsData.data) setMovimientos(movsData.data);
    } catch (e) {
      console.error('Error loading bodeguero data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      {/* Panel de Operaciones Plano */}
      <div className="border-b border-slate-200 pb-6">
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
        </div>
      </div>

      {/* Línea Temporal Plana */}
      <div className="pt-2" id="timeline">
        <TimelineFeed
          movimientos={movimientos}
          filterDate={filterDate}
          onDateChange={setFilterDate}
          onSuccess={loadData}
          insumos={insumos}
        />
      </div>
    </div>
  );
}
