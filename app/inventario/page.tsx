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
      const res = await fetch(`/api/bodega/stock?t=${Date.now()}`, { cache: 'no-store' });
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
      if (selectedCat === 'CARNES' && item.es_carne === false) return false;
      if (selectedCat !== 'ALL' && selectedCat !== 'CARNES') {
        if (normalizeStr(item.categoria) !== normalizeStr(selectedCat)) return false;
      }

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
        <p className="text-xs font-normal">Cargando Inventario de Carnes...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 animate-fade-in font-normal">
      {/* KPIs Superiores Planos */}
      <StockKpis insumos={insumos} />

      {/* Header y Filtros Planos */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-base font-medium text-slate-900 tracking-tight">Control de Existencias de Carnes</h2>
          <p className="text-xs text-slate-500 font-normal">Monitoreo en vivo de bodega, cocina, mermas acumuladas y costos</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar carne por nombre o código..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 font-normal"
          />
        </div>
      </div>

      {/* Category Chips */}
      <CategoryFilterChips selectedCat={selectedCat} onSelectCat={setSelectedCat} />

      {/* Desktop Table Plana */}
      <StockTableDesktop insumos={filteredInsumos} />

      {/* Mobile Cards */}
      <StockCardsMobile insumos={filteredInsumos} />
    </div>
  );
}
