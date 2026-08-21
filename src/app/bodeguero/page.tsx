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
      const [stockRes, movsRes] = await Promise.all([
        fetch('/api/bodega/stock'),
        fetch('/api/bodega/movimientos'),
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
        <p className="text-sm font-semibold">Cargando Terminal del Bodeguero...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Panel de Operaciones */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <OperationTabs activeTab={activeTab} onChangeTab={setActiveTab} />

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

      {/* Línea de Tiempo de Movimientos */}
      <TimelineFeed
        movimientos={movimientos}
        filterDate={filterDate}
        onDateChange={setFilterDate}
      />
    </div>
  );
}
