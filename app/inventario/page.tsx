'use client';

import { useState, useEffect, useMemo } from 'react';
import StockKpis from '@/components/inventario/StockKpis';
import CategoryFilterChips from '@/components/inventario/CategoryFilterChips';
import StockTableDesktop from '@/components/inventario/StockTableDesktop';
import StockCardsMobile from '@/components/inventario/StockCardsMobile';
import { InsumoItem } from '@/types';
import { Search, Loader2 } from 'lucide-react';
import { normalizeStr } from '@/lib/formatters';

export default function InventarioPage() {
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadStock = async () => {
    try {
      const res = await fetch('/api/bodega/stock');
      const data = await res.json();
      if (data.data) setInsumos(data.data);
    } catch (e) {
      console.error('Error fetching stock:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  const filteredInsumos = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);
    return insumos.filter((item) => {
      // Filtro de categoría
      if (selectedCat === 'CARNES' && item.es_carne === false) return false;
      if (selectedCat !== 'ALL' && selectedCat !== 'CARNES') {
        if (normalizeStr(item.categoria) !== normalizeStr(selectedCat)) return false;
      }

      // Filtro de búsqueda
      if (!cleanSearch) return true;
      const name = normalizeStr(item.insumo);
      const code = normalizeStr(item.codigo);
      return name.includes(cleanSearch) || code.includes(cleanSearch);
    });
  }, [insumos, selectedCat, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-sm font-semibold">Cargando Inventario de Carnes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* KPIs Superiores */}
      <StockKpis insumos={insumos} />

      {/* Main Stock Card */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-base md:text-lg text-slate-900">Control de Existencias de Carnes</h2>
            <p className="text-xs text-slate-500">Monitoreo en vivo de bodega, cocina, mermas acumuladas y costos</p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar carne por nombre o código..."
              className="w-full h-10 pl-9 pr-3 text-xs md:text-sm rounded-xl border border-slate-300 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
            />
          </div>
        </div>

        {/* Category Chips */}
        <CategoryFilterChips selectedCat={selectedCat} onSelectCat={setSelectedCat} />

        {/* Desktop Table */}
        <StockTableDesktop insumos={filteredInsumos} />

        {/* Mobile Cards */}
        <StockCardsMobile insumos={filteredInsumos} />
      </div>
    </div>
  );
}
