'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  UtensilsCrossed, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  Loader2, 
  Check, 
  FileText,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney } from '@/lib/formatters';
import { getCachedData, setCachedData, invalidateCache } from '@/lib/dataCache';

const CACHE_KEY = 'productos_venta_list';

export interface ProductoVenta {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  subcategoria: string;
  unidad: string;
  precio_neto: number;
  tarifa_impoconsumo: number;
  impoconsumo: number;
  tarifa_iva: number;
  iva: number;
  precio_total: number;
  es_receta: boolean;
  activo: boolean;
  created_at?: string;
}

const CATEGORIAS_PRODUCTOS = [
  'PLATOS',
  'BEBIDAS',
  'ACOMPAÑAMIENTOS',
  'OTROS'
];

const SUBCATEGORIAS_PLATOS = [
  'MENU DEL DIA',
  'DESAYUNOS',
  'FRIJOLADAS',
  'BANDEJAS PAISAS',
  'TAMALES',
  'PLATOS A LA CARTA'
];

const CATEGORY_LABELS: Record<string, string> = {
  'PLATOS': 'Platos',
  'BEBIDAS': 'Bebidas',
  'ACOMPAÑAMIENTOS': 'Acompañamientos',
  'OTROS': 'Otros'
};

const SUBCATEGORY_LABELS: Record<string, string> = {
  'MENU DEL DIA': 'Menú del Día',
  'DESAYUNOS': 'Desayunos',
  'FRIJOLADAS': 'Frijoladas',
  'BANDEJAS PAISAS': 'Bandejas Paisas',
  'TAMALES': 'Tamales',
  'PLATOS A LA CARTA': 'Platos a la Carta',
  'BEBIDAS': 'Bebidas',
  'ACOMPAÑAMIENTOS': 'Acompañamientos',
  'OTROS': 'Otros'
};

export default function ProductosVentaPage() {
  const cached = getCachedData<ProductoVenta[]>(CACHE_KEY);
  const [productos, setProductos] = useState<ProductoVenta[]>(() => cached || []);
  const [loading, setLoading] = useState(!cached);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [selectedSubcat, setSelectedSubcat] = useState<string>('ALL');

  // Modal State
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [selectedItem, setSelectedItem] = useState<ProductoVenta | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formCodigo, setFormCodigo] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formCategoria, setFormCategoria] = useState('PLATOS');
  const [formSubcategoria, setFormSubcategoria] = useState('PLATOS A LA CARTA');
  const [formUnidad, setFormUnidad] = useState('ud');
  const [formPrecioTotal, setFormPrecioTotal] = useState<string>('20000');
  const [formEsReceta, setFormEsReceta] = useState(true);

  // Cargar catálogo de productos
  const loadProductos = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/productos-venta?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.data) {
        setProductos(json.data);
        setCachedData(CACHE_KEY, json.data);
      }
    } catch (err) {
      console.error('Error cargando productos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductos(Boolean(cached));
  }, []);

  // Conteos por categoría
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    productos.forEach(p => {
      counts[p.categoria] = (counts[p.categoria] || 0) + 1;
    });
    return counts;
  }, [productos]);

  // Conteos por subcategoría de platos
  const subcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    productos.filter(p => p.categoria === 'PLATOS').forEach(p => {
      counts[p.subcategoria] = (counts[p.subcategoria] || 0) + 1;
    });
    return counts;
  }, [productos]);

  // Filtrado de productos
  const filteredProductos = useMemo(() => {
    return productos.filter(p => {
      if (selectedCat !== 'ALL' && p.categoria !== selectedCat) return false;
      if (selectedCat === 'PLATOS' && selectedSubcat !== 'ALL' && p.subcategoria !== selectedSubcat) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNombre = p.nombre.toLowerCase().includes(q);
        const matchCodigo = p.codigo.toLowerCase().includes(q);
        const matchSubcat = (p.subcategoria || '').toLowerCase().includes(q);
        if (!matchNombre && !matchCodigo && !matchSubcat) return false;
      }
      return true;
    });
  }, [productos, selectedCat, selectedSubcat, searchQuery]);

  // Cálculos en vivo para el modal
  const liveTotal = parseFloat(formPrecioTotal) || 0;
  const liveNeto = Math.round(liveTotal / 1.08);
  const liveImpoconsumo = liveTotal - liveNeto;

  const openCreateModal = () => {
    setSelectedItem(null);
    setFormCodigo(`PRD-${String(productos.length + 1).padStart(3, '0')}`);
    setFormNombre('');
    setFormCategoria('PLATOS');
    setFormSubcategoria('PLATOS A LA CARTA');
    setFormUnidad('ud');
    setFormPrecioTotal('20000');
    setFormEsReceta(true);
    setModalMode('CREATE');
  };

  const openEditModal = (p: ProductoVenta) => {
    setSelectedItem(p);
    setFormCodigo(p.codigo);
    setFormNombre(p.nombre);
    setFormCategoria(p.categoria);
    setFormSubcategoria(p.subcategoria);
    setFormUnidad(p.unidad || 'ud');
    setFormPrecioTotal(String(p.precio_total));
    setFormEsReceta(p.es_receta);
    setModalMode('EDIT');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;

    try {
      setSaving(true);
      const payload = {
        id: selectedItem?.id,
        codigo: formCodigo.trim(),
        nombre: formNombre.trim(),
        categoria: formCategoria,
        subcategoria: formSubcategoria,
        unidad: formUnidad,
        precio_total: parseFloat(formPrecioTotal) || 0,
        es_receta: formEsReceta,
        activo: true
      };

      const method = modalMode === 'CREATE' ? 'POST' : 'PUT';
      const res = await fetch('/api/productos-venta', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar');

      setModalMode(null);
      invalidateCache(CACHE_KEY);
      await loadProductos();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: ProductoVenta) => {
    if (!confirm(`¿Eliminar el producto "${p.nombre}"?`)) return;
    try {
      const res = await fetch(`/api/productos-venta?id=${p.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      invalidateCache(CACHE_KEY);
      await loadProductos();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-3 font-normal animate-fade-in text-xs">
      
      {/* ------------------------------------------------------------ */}
      {/* BARRA SUPERIOR SOBRIA (Estilo GitHub)                         */}
      {/* ------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 px-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <UtensilsCrossed className="w-4 h-4 text-slate-700" />
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">
            Productos Para la Venta
          </h1>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium border border-slate-200 font-mono">
            {filteredProductos.length} {filteredProductos.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        {/* Buscador y Botón Nuevo */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código o nombre..."
              className="w-full h-8 pl-8 pr-2.5 text-xs bg-slate-50/60 hover:bg-white focus:bg-white rounded-md border border-slate-200 focus:border-slate-400 outline-none text-slate-800 placeholder-slate-400 transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-3 h-8 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* FILTROS PRINCIPALES DE CATEGORÍA (Estandarizados con conteo)  */}
      {/* ------------------------------------------------------------ */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap select-none">
        {[
          { key: 'ALL', label: `Todos (${productos.length})` },
          ...CATEGORIAS_PRODUCTOS.map((c) => ({
            key: c,
            label: `${CATEGORY_LABELS[c] || c} (${categoryCounts[c] || 0})`
          }))
        ].map((cat) => {
          const isSelected = selectedCat === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                setSelectedCat(cat.key);
                setSelectedSubcat('ALL');
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
                isSelected
                  ? 'bg-slate-900 border-slate-900 text-white shadow-2xs font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------ */}
      {/* SUB-PESTAÑAS CUANDO SE SELECCIONA "PLATOS"                    */}
      {/* ------------------------------------------------------------ */}
      {selectedCat === 'PLATOS' && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1 bg-slate-50 border border-slate-200 rounded-lg select-none">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 shrink-0">
            Subcategoría:
          </span>
          <button
            type="button"
            onClick={() => setSelectedSubcat('ALL')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              selectedSubcat === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos los Platos ({categoryCounts['PLATOS'] || 0})
          </button>
          {SUBCATEGORIAS_PLATOS.map((sub) => {
            const isSubSelected = selectedSubcat === sub;
            const count = subcategoryCounts[sub] || 0;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubcat(sub)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isSubSelected
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {SUBCATEGORY_LABELS[sub] || sub} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* TABLA PRINCIPAL DE PRODUCTOS VENDIBLES                       */}
      {/* ------------------------------------------------------------ */}
      <div className="w-full border border-slate-200 rounded-lg bg-white shadow-2xs overflow-hidden">
        <div className="relative max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider select-none shadow-2xs">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Código</th>
                <th className="py-2.5 px-3">Producto / Descripción</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Categoría</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Subcategoría</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Precio Neto</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Impoconsumo (8%)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Precio Venta Total</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">¿Lleva Receta?</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    <span>Cargando catálogo de productos...</span>
                  </td>
                </tr>
              ) : filteredProductos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No se encontraron productos con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredProductos.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Código */}
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {item.codigo}
                    </td>

                    {/* Nombre */}
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="font-semibold text-slate-900 hover:text-orange-600 transition-colors cursor-pointer text-left"
                      >
                        {item.nombre}
                      </button>
                    </td>

                    {/* Categoría */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {CATEGORY_LABELS[item.categoria] || item.categoria}
                      </span>
                    </td>

                    {/* Subcategoría */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200/80">
                        {SUBCATEGORY_LABELS[item.subcategoria] || item.subcategoria}
                      </span>
                    </td>

                    {/* Precio Neto */}
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      ${formatMoney(item.precio_neto)}
                    </td>

                    {/* Impoconsumo */}
                    <td className="py-2 px-3 text-right font-mono text-slate-500">
                      ${formatMoney(item.impoconsumo)}
                    </td>

                    {/* Precio Total */}
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      ${formatMoney(item.precio_total)}
                    </td>

                    {/* ¿Lleva Receta? */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {item.es_receta ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Sí (Cocina)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          No
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Editar Producto"
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          title="Eliminar Producto"
                          className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* MODAL CREAR / EDITAR PRODUCTO (Espacioso y Minimalista)      */}
      {/* ------------------------------------------------------------ */}
      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === 'CREATE' ? 'Crear Nuevo Producto Para la Venta' : `Editar: ${selectedItem?.nombre}`}
        icon={<UtensilsCrossed className="w-5 h-5 text-slate-700" />}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-6 bg-white py-2">
          
          {/* Fila 1: Código y Nombre */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Código POS / Sistema
              </label>
              <input
                type="text"
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value)}
                placeholder="Ej. 41"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 outline-none text-slate-800 font-mono text-sm bg-white transition-all shadow-2xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Nombre del Producto Para la Venta *
              </label>
              <input
                type="text"
                required
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej. Churrasco 400 gr parrilla"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 outline-none text-slate-800 font-medium text-sm bg-white transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Fila 2: Categoría y Subcategoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Categoría Principal
              </label>
              <select
                value={formCategoria}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setFormCategoria(newCat);
                  if (newCat === 'PLATOS') {
                    setFormSubcategoria('PLATOS A LA CARTA');
                    setFormEsReceta(true);
                  } else {
                    setFormSubcategoria(newCat);
                    setFormEsReceta(false);
                  }
                }}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 text-slate-800 bg-white outline-none cursor-pointer text-sm transition-all shadow-2xs"
              >
                {CATEGORIAS_PRODUCTOS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c] || c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Subcategoría
              </label>
              {formCategoria === 'PLATOS' ? (
                <select
                  value={formSubcategoria}
                  onChange={(e) => setFormSubcategoria(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 text-slate-800 bg-white outline-none cursor-pointer text-sm transition-all shadow-2xs"
                >
                  {SUBCATEGORIAS_PLATOS.map((s) => (
                    <option key={s} value={s}>
                      {SUBCATEGORY_LABELS[s] || s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={CATEGORY_LABELS[formCategoria] || formCategoria}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 font-medium text-sm outline-none cursor-not-allowed"
                />
              )}
            </div>
          </div>

          {/* Fila 3: Precios e Impoconsumo */}
          <div className="p-5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                Estructura de Precios e Impoconsumo (8%)
              </span>
              <span className="text-xs text-slate-600 font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200">
                Tarifa Oficial: <strong>8.0% Impoconsumo</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5 text-xs">
                  Precio Venta Total ($ COP) *
                </label>
                <input
                  type="number"
                  step="500"
                  required
                  value={formPrecioTotal}
                  onChange={(e) => setFormPrecioTotal(e.target.value)}
                  placeholder="Ej. 53000"
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 text-slate-900 font-mono text-sm font-bold bg-white outline-none transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1.5 text-xs">
                  Precio Neto Base (COP)
                </label>
                <div className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-white flex items-center font-mono text-sm text-slate-700">
                  ${formatMoney(liveNeto)}
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1.5 text-xs">
                  Impoconsumo 8% (COP)
                </label>
                <div className="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-white flex items-center font-mono text-sm text-slate-700">
                  ${formatMoney(liveImpoconsumo)}
                </div>
              </div>
            </div>
          </div>

          {/* Fila 4: Switch de Receta */}
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
            <div>
              <p className="font-semibold text-slate-800 text-xs">
                ¿Vincular al Módulo de Recetas y Costeo de Cocina?
              </p>
              <p className="text-[11px] text-slate-500">
                Al activar esta casilla, el plato estará disponible en el módulo de Recetas para asociarle los gramos de carnes e insumos requeridos.
              </p>
            </div>
            <input
              type="checkbox"
              checked={formEsReceta}
              onChange={(e) => setFormEsReceta(e.target.checked)}
              className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer"
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalMode(null)}
              className="h-11 px-5 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium text-xs md:text-sm cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 px-6 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-semibold text-xs md:text-sm flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{modalMode === 'CREATE' ? 'Crear Producto' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
