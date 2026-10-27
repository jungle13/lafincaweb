'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Plus, 
  ArrowLeft, 
  Loader2,
  RefreshCw,
  UtensilsCrossed,
  AlertCircle
} from 'lucide-react';
import { CatalogItem } from '@/components/inputs/InsumoSmartSearchInput';
import RecetaPlatoRow, { RecetaPlatoItem } from '@/components/recetas/RecetaPlatoRow';
import NewPlatoModal from '@/components/recetas/NewPlatoModal';

const SUBCATEGORIAS_ORDEN = [
  'MENU DEL DIA',
  'DESAYUNOS',
  'FRIJOLADAS',
  'BANDEJAS PAISAS',
  'TAMALES',
  'PLATOS A LA CARTA'
];

const SUBCAT_LABELS: Record<string, string> = {
  'MENU DEL DIA': 'Menú del Día (Ejecutivo)',
  'DESAYUNOS': 'Desayunos',
  'FRIJOLADAS': 'Frijoladas',
  'BANDEJAS PAISAS': 'Bandejas Paisas',
  'TAMALES': 'Tamales',
  'PLATOS A LA CARTA': 'Platos a la Carta'
};

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<RecetaPlatoItem[]>([]);
  const [catalogoInsumos, setCatalogoInsumos] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedSubcat, setSelectedSubcat] = useState('ALL');
  const [isNewPlatoModalOpen, setIsNewPlatoModalOpen] = useState(false);

  // Cargar recetas y catálogo desde la base de datos
  const loadRecetasData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recetas?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Error al cargar recetas`);
      const json = await res.json();
      if (json.success) {
        setRecetas(json.recetas || []);
        
        // Mapear catálogo de insumos para el buscador
        const mappedCatalog: CatalogItem[] = (json.catalogoInsumos || []).map((i: any) => ({
          id: i.id,
          nombre: i.nombre,
          categoria: i.categoria || 'Insumo',
          precioUnitario: Number(i.costo_unitario_kg || 0),
          unidadMedida: i.unidad_medida || 'Kg',
          gramaje: Number(i.peso_estandar_porcion_kg || 0) * 1000
        }));
        setCatalogoInsumos(mappedCatalog);
      } else {
        throw new Error(json.error || 'No se pudieron obtener las recetas');
      }
    } catch (err: any) {
      console.error('Error cargando recetas:', err);
      setError(err?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecetasData();
  }, [loadRecetasData]);

  // Conteo de platos por subcategoría
  const subcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recetas.forEach(r => {
      const sub = r.subcategoria || 'PLATOS A LA CARTA';
      counts[sub] = (counts[sub] || 0) + 1;
    });
    return counts;
  }, [recetas]);

  // Filtrado de recetas por texto y subcategoría
  const filteredRecetas = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    return recetas.filter(r => {
      const sub = r.subcategoria || 'PLATOS A LA CARTA';
      const matchSub = selectedSubcat === 'ALL' || sub === selectedSubcat;
      if (!matchSub) return false;
      if (!q) return true;

      const matchName = r.nombre.toLowerCase().includes(q);
      const matchCode = (r.codigoPos || '').toLowerCase().includes(q);
      const matchIng = r.ingredientes.some(ing => ing.nombre.toLowerCase().includes(q));
      return matchName || matchCode || matchIng;
    });
  }, [recetas, searchFilter, selectedSubcat]);

  // Añadir un insumo a la receta en la base de datos
  const handleAddInsumoToPlato = async (platoId: string, item: CatalogItem, cantidad: number, unidad: string) => {
    const safeQty = Math.max(0.01, cantidad || 1);
    const cantKg = unidad.toLowerCase() === 'kg' 
      ? safeQty 
      : unidad.toLowerCase() === 'g' 
      ? safeQty / 1000 
      : item.gramaje ? (item.gramaje / 1000) * safeQty : safeQty;

    try {
      const res = await fetch('/api/recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plato_id: platoId,
          insumo_id: item.id,
          porciones_por_plato: 1,
          cantidad_por_porcion_kg: Number(cantKg.toFixed(3))
        })
      });

      if (!res.ok) throw new Error('Error al vincular insumo en la base de datos');
      await loadRecetasData();
    } catch (e) {
      console.error(e);
      alert('No se pudo vincular el insumo al plato');
    }
  };

  // Modificar cantidad de un insumo en la receta
  const handleUpdateInsumoQty = async (platoId: string, insumoRecetaId: string, newQty: number) => {
    // Actualización optimista en interfaz
    setRecetas(prev => prev.map(p => {
      if (p.id !== platoId) return p;
      return {
        ...p,
        ingredientes: p.ingredientes.map(ing => {
          if (ing.id !== insumoRecetaId) return ing;
          const factor = ing.unidad.toLowerCase() === 'g' ? 1 / 1000 : 1;
          const newCost = Math.round(newQty * factor * ing.costoUnitario);
          return {
            ...ing,
            cantidad: newQty,
            costoCalculado: newCost
          };
        })
      };
    }));

    try {
      await fetch('/api/recetas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: insumoRecetaId,
          cantidad_por_porcion_kg: newQty
        })
      });
    } catch (e) {
      console.error('Error sincronizando cantidad:', e);
    }
  };

  // Remover insumo de la receta
  const handleRemoveInsumo = async (platoId: string, insumoRecetaId: string) => {
    // Optimista
    setRecetas(prev => prev.map(p => {
      if (p.id !== platoId) return p;
      return {
        ...p,
        ingredientes: p.ingredientes.filter(ing => ing.id !== insumoRecetaId)
      };
    }));

    try {
      await fetch(`/api/recetas?id=${insumoRecetaId}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Error eliminando insumo:', e);
      loadRecetasData();
    }
  };

  // Desvincular plato de recetas
  const handleDeletePlato = async (platoId: string) => {
    if (confirm('¿Desvincular este plato del módulo de recetas? (Se conservará en productos para la venta pero no requerirá ficha técnica)')) {
      setRecetas(prev => prev.filter(p => p.id !== platoId));
      try {
        await fetch(`/api/recetas?plato_id=${platoId}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Error desvinculando receta:', e);
        loadRecetasData();
      }
    }
  };

  // Crear un nuevo plato desde modal
  const handleCreatePlato = async (data: {
    codigoPos: string;
    nombre: string;
    categoria: string;
    precioVentaPos: number;
  }) => {
    try {
      await fetch('/api/productos-venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: data.codigoPos,
          nombre: data.nombre,
          categoria: 'PLATOS',
          subcategoria: 'PLATOS A LA CARTA',
          precio_total: data.precioVentaPos,
          tarifa_impoconsumo: 8.0,
          tarifa_iva: 0.0,
          es_receta: true
        })
      });
      await loadRecetasData();
    } catch (e) {
      console.error(e);
      alert('Error creando plato');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-53px)] md:h-[calc(100vh-57px)] -m-4 -mb-20 md:-m-6 md:mb-0 bg-white overflow-hidden font-normal text-xs">
      
      {/* 🏷️ SECCIÓN SUPERIOR: Encabezado Minimalista Tipo Git */}
      <div className="shrink-0 bg-white border-b border-slate-200 z-20">
        <div className="p-3 px-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/productos-venta"
                className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors cursor-pointer border border-slate-200"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Productos Para la Venta</span>
              </Link>
              <Link
                href="/auditoria-cocina"
                className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors cursor-pointer border border-slate-200"
              >
                <span>Auditoría Cocina</span>
              </Link>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Módulo de Recetas & Escandallos
              </h1>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {recetas.length} platos con receta
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Asociación técnica de insumos cárnicos y gramajes por plato para deducción automática en auditoría
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            {/* Buscador de platos / insumos */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar plato, cód. POS o proteína..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-400 w-56 sm:w-64"
              />
            </div>

            {/* Recargar */}
            <button
              type="button"
              onClick={loadRecetasData}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer border border-slate-200"
              title="Recargar recetas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Nuevo plato */}
            <button
              type="button"
              onClick={() => setIsNewPlatoModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Plato</span>
            </button>
          </div>
        </div>

        {/* 🗂️ Barra de Pestañas por Subcategoría */}
        <div className="px-4 md:px-6 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none">
          <button
            type="button"
            onClick={() => setSelectedSubcat('ALL')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer border ${
              selectedSubcat === 'ALL'
                ? 'bg-slate-900 border-slate-900 text-white font-semibold shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todos los Platos ({recetas.length})
          </button>

          {SUBCATEGORIAS_ORDEN.map(sub => {
            const count = subcategoryCounts[sub] || 0;
            const isSelected = selectedSubcat === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubcat(sub)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white font-semibold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {SUBCAT_LABELS[sub] || sub} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ⚠️ Alerta de Error */}
      {error && !loading && (
        <div className="mx-4 md:mx-6 mt-3 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center justify-between text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span className="text-xs">{error}</span>
          </div>
          <button
            type="button"
            onClick={loadRecetasData}
            className="px-2.5 py-1 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 📦 ÁREA PRINCIPAL: Tarjetas de Recetas vinculadas a la Base de Datos */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">
        <div className="p-4 md:p-6 pb-24 md:pb-12 w-full max-w-[1700px] mx-auto space-y-3.5">
          {loading ? (
            <div className="py-20 text-center bg-white rounded-lg border border-slate-200 space-y-2">
              <Loader2 className="w-6 h-6 text-slate-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Cargando fichas técnicas y recetas...</p>
            </div>
          ) : filteredRecetas.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-10 text-center text-xs text-slate-500">
              No se encontraron platos que coincidan con los filtros aplicados.
            </div>
          ) : (
            filteredRecetas.map(plato => (
              <RecetaPlatoRow
                key={plato.id}
                plato={plato}
                catalogInsumos={catalogoInsumos}
                onAddInsumo={handleAddInsumoToPlato}
                onUpdateInsumoQty={handleUpdateInsumoQty}
                onRemoveInsumo={handleRemoveInsumo}
                onDeletePlato={handleDeletePlato}
              />
            ))
          )}
        </div>
      </div>

      {/* Modal para Crear Nuevo Plato */}
      <NewPlatoModal
        isOpen={isNewPlatoModalOpen}
        onClose={() => setIsNewPlatoModalOpen(false)}
        onCreate={handleCreatePlato}
      />
    </div>
  );
}
