'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Beef, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Loader2, 
  HelpCircle,
  Scale,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatMoney, normalizeStr } from '@/lib/formatters';

export interface CatalogoInsumo {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad_medida: string;
  peso_estandar_porcion_kg: number;
  costo_unitario_kg: number;
  stock_minimo_kg: number;
  es_carne: boolean;
  activo: boolean;
  observaciones?: string;
}

const CATEGORIAS_PREDEFINIDAS = [
  'CARNE DE CERDO',
  'CARNE DE RES',
  'CARNE POLLO',
  'EMBUTIDO',
  'PESCADOS Y MARISCOS',
  'MIXTO',
  'VERDURAS',
  'LACTEOS',
  'ABARROTES',
];

type SortField = 
  | 'codigo'
  | 'nombre'
  | 'categoria'
  | 'unidad_medida'
  | 'peso_estandar_porcion_kg'
  | 'rendimiento'
  | 'costo_unitario_kg'
  | 'stock_minimo_kg';

export default function CatalogoPage() {
  const [insumos, setInsumos] = useState<CatalogoInsumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortAsc, setSortAsc] = useState(true);

  // Modals & Form
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogoInsumo | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formCodigo, setFormCodigo] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formCategoria, setFormCategoria] = useState('CARNE DE RES');
  const [formUnidad, setFormUnidad] = useState('Kg');
  const [formRendimientoTeorico, setFormRendimientoTeorico] = useState('');
  const [formPesoEstandar, setFormPesoEstandar] = useState('');
  const [formCostoUnitario, setFormCostoUnitario] = useState('');
  const [formStockMinimo, setFormStockMinimo] = useState('');
  const [formEsCarne, setFormEsCarne] = useState(true);
  const [formObservaciones, setFormObservaciones] = useState('');

  const loadCatalogo = async () => {
    try {
      const res = await fetch(`/api/catalogo?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.data) {
        setInsumos(data.data);
      }
    } catch (e) {
      console.error('Error cargando catalogo:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogo();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredInsumos = useMemo(() => {
    const cleanSearch = normalizeStr(searchQuery);
    return insumos.filter((item) => {
      if (selectedCat === 'CARNES' && !item.es_carne) return false;
      if (selectedCat !== 'ALL' && selectedCat !== 'CARNES') {
        if (normalizeStr(item.categoria) !== normalizeStr(selectedCat)) return false;
      }

      if (!cleanSearch) return true;
      const name = normalizeStr(item.nombre);
      const code = normalizeStr(item.codigo || '');
      return name.includes(cleanSearch) || code.includes(cleanSearch);
    });
  }, [insumos, selectedCat, searchQuery]);

  const sortedInsumos = useMemo(() => {
    return [...filteredInsumos].sort((a, b) => {
      let valA: any = a[sortField as keyof CatalogoInsumo];
      let valB: any = b[sortField as keyof CatalogoInsumo];

      if (sortField === 'rendimiento') {
        valA = a.peso_estandar_porcion_kg > 0 ? 1 / a.peso_estandar_porcion_kg : 0;
        valB = b.peso_estandar_porcion_kg > 0 ? 1 / b.peso_estandar_porcion_kg : 0;
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [filteredInsumos, sortField, sortAsc]);

  const totalInsumos = insumos.length;
  const totalCarnes = insumos.filter((i) => i.es_carne).length;
  const totalAbarrotes = totalInsumos - totalCarnes;

  const handleRendimientoChange = (valStr: string) => {
    setFormRendimientoTeorico(valStr);
    const rend = parseFloat(valStr);
    if (!isNaN(rend) && rend > 0) {
      const pesoKg = 1 / rend;
      setFormPesoEstandar(pesoKg.toFixed(3));
    }
  };

  const handlePesoEstandarChange = (valStr: string) => {
    setFormPesoEstandar(valStr);
    const peso = parseFloat(valStr);
    if (!isNaN(peso) && peso > 0) {
      const rend = 1 / peso;
      setFormRendimientoTeorico(rend.toFixed(2));
    }
  };

  const openCreateModal = () => {
    setSelectedItem(null);
    const nextNum = totalInsumos + 1;
    setFormCodigo(`CAR-${String(nextNum).padStart(3, '0')}`);
    setFormNombre('');
    setFormCategoria('CARNE DE RES');
    setFormUnidad('Kg');
    setFormRendimientoTeorico('3');
    setFormPesoEstandar('0.333');
    setFormCostoUnitario('20000');
    setFormStockMinimo('10');
    setFormEsCarne(true);
    setFormObservaciones('');
    setModalMode('CREATE');
  };

  const openEditModal = (item: CatalogoInsumo) => {
    setSelectedItem(item);
    setFormCodigo(item.codigo || '');
    setFormNombre(item.nombre);
    setFormCategoria(item.categoria || 'CARNE DE RES');
    setFormUnidad(item.unidad_medida || 'Kg');
    const peso = item.peso_estandar_porcion_kg || 0.35;
    setFormPesoEstandar(String(peso));
    setFormRendimientoTeorico(peso > 0 ? (1 / peso).toFixed(2) : '3');
    setFormCostoUnitario(String(item.costo_unitario_kg || 0));
    setFormStockMinimo(String(item.stock_minimo_kg || 0));
    setFormEsCarne(item.es_carne);
    setFormObservaciones(item.observaciones || '');
    setModalMode('EDIT');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return alert('El nombre es obligatorio.');

    setSaving(true);
    try {
      const payload = {
        id: selectedItem?.id,
        codigo: formCodigo.trim(),
        nombre: formNombre.trim(),
        categoria: formCategoria,
        unidad_medida: formUnidad,
        peso_estandar_porcion_kg: parseFloat(formPesoEstandar) || 0.35,
        costo_unitario_kg: parseFloat(formCostoUnitario) || 0,
        stock_minimo_kg: parseFloat(formStockMinimo) || 0,
        es_carne: formEsCarne,
        activo: true,
        observaciones: formObservaciones.trim(),
      };

      const method = modalMode === 'CREATE' ? 'POST' : 'PUT';
      const res = await fetch('/api/catalogo', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al guardar insumo');

      setModalMode(null);
      await loadCatalogo();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: CatalogoInsumo) => {
    if (!confirm(`¿Estás seguro de eliminar "${item.nombre}" del catálogo?`)) return;

    try {
      const res = await fetch(`/api/catalogo?id=${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error al eliminar');

      await loadCatalogo();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-orange-600 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-orange-600 font-bold" />
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-xs font-normal">Cargando Catálogo de Carnes e Insumos...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 animate-fade-in font-normal">
      {/* 📊 Métricas Superiores Planas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] text-slate-500 font-normal uppercase tracking-wider block">Total Catálogo</span>
          <span className="text-lg font-medium text-slate-900">{totalInsumos} insumos</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[11px] text-slate-500 font-normal uppercase tracking-wider block">Carnes Maestras</span>
          <span className="text-lg font-medium text-orange-600">{totalCarnes} cortes</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-slate-500 font-normal uppercase tracking-wider block">Insumos y Abarrotes</span>
          <span className="text-lg font-medium text-blue-600">{totalAbarrotes} ítems</span>
        </div>
      </div>

      {/* 🔍 Barra Superior: Título, Botón Crear y Buscador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-base font-medium text-slate-900 tracking-tight flex items-center gap-2">
            <Beef className="w-4 h-4 text-orange-500" />
            <span>Catálogo de Carnes e Insumos</span>
          </h2>
          <p className="text-xs text-slate-400 font-normal">
            Administración de materias primas, gramajes por porción, rendimientos teóricos y costos
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Buscador */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar carne por nombre o código..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-slate-800 placeholder-slate-400 font-normal"
            />
          </div>

          {/* Botón Crear */}
          <button
            type="button"
            onClick={openCreateModal}
            className="px-3.5 h-8 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Insumo</span>
          </button>
        </div>
      </div>

      {/* 🏷️ Filtros de Categoría */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {['ALL', 'CARNES', ...CATEGORIAS_PREDEFINIDAS].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCat(cat)}
            className={`px-3 py-1 rounded-lg text-xs font-normal transition-all border ${
              selectedCat === cat
                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat === 'ALL' ? 'Todas' : cat === 'CARNES' ? '🥩 Todas las Carnes' : cat}
          </button>
        ))}
      </div>

      {/* 💻 TABLA DE ESCRITORIO CON HEADER PEGAJOSO Y ORDENAMIENTO */}
      <div className="hidden md:block w-full border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden font-normal">
        <div className="relative max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-normal">
            <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm text-slate-600 font-medium border-b border-slate-200 text-[11px] uppercase tracking-wider shadow-sm">
              <tr>
                {/* Código */}
                <th 
                  onClick={() => handleSort('codigo')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>CÓDIGO</span>
                    {renderSortIcon('codigo')}
                  </div>
                </th>

                {/* Materia Prima */}
                <th 
                  onClick={() => handleSort('nombre')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>MATERIA PRIMA / CORTE</span>
                    {renderSortIcon('nombre')}
                  </div>
                </th>

                {/* Categoría */}
                <th 
                  onClick={() => handleSort('categoria')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>CATEGORÍA</span>
                    {renderSortIcon('categoria')}
                  </div>
                </th>

                {/* Unidad */}
                <th 
                  onClick={() => handleSort('unidad_medida')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>UNIDAD</span>
                    {renderSortIcon('unidad_medida')}
                  </div>
                </th>

                {/* Peso Estándar */}
                <th 
                  onClick={() => handleSort('peso_estandar_porcion_kg')}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>PESO ESTÁNDAR PORCIÓN</span>
                    {renderSortIcon('peso_estandar_porcion_kg')}
                  </div>
                </th>

                {/* Rendimiento */}
                <th 
                  onClick={() => handleSort('rendimiento')}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="inline-flex items-center gap-1" title="Porciones teóricas que rinde 1 Kg de carne (1 / Peso Porción)">
                      <span>RENDIMIENTO TEÓRICO</span>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </span>
                    {renderSortIcon('rendimiento')}
                  </div>
                </th>

                {/* Costo */}
                <th 
                  onClick={() => handleSort('costo_unitario_kg')}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>COSTO BASE / KG</span>
                    {renderSortIcon('costo_unitario_kg')}
                  </div>
                </th>

                {/* Stock Mínimo */}
                <th 
                  onClick={() => handleSort('stock_minimo_kg')}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100/80 transition-colors select-none group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>STOCK MÍNIMO</span>
                    {renderSortIcon('stock_minimo_kg')}
                  </div>
                </th>

                {/* Acciones */}
                <th className="py-3 px-3 text-center whitespace-nowrap">ACCIONES</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white font-normal">
              {sortedInsumos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-normal">
                    No se encontraron materias primas en el catálogo con el filtro actual.
                  </td>
                </tr>
              ) : (
                sortedInsumos.map((item) => {
                  const pesoGramos = Math.round((item.peso_estandar_porcion_kg || 0.35) * 1000);
                  const rendimiento = item.peso_estandar_porcion_kg > 0 ? (1 / item.peso_estandar_porcion_kg).toFixed(2) : '-';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Código */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {item.codigo || item.id.slice(0, 8)}
                      </td>

                      {/* Nombre */}
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-slate-900 text-xs md:text-sm block">
                          {item.nombre}
                        </span>
                      </td>

                      {/* Categoría */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {item.categoria}
                        </span>
                      </td>

                      {/* Unidad */}
                      <td className="py-2.5 px-3 text-slate-500 font-normal">
                        {item.unidad_medida || 'Kg'}
                      </td>

                      {/* Peso estándar */}
                      <td className="py-2.5 px-3 text-right font-normal">
                        {item.es_carne ? (
                          <span className="text-slate-800">
                            {pesoGramos} g <small className="text-slate-400 font-normal">({item.peso_estandar_porcion_kg.toFixed(3)} Kg)</small>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Rendimiento Teórico */}
                      <td className="py-2.5 px-3 text-right">
                        {item.es_carne ? (
                          <span className="font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-xs">
                            ~ {rendimiento} porc / Kg
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Costo Base */}
                      <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                        $ {formatMoney(item.costo_unitario_kg)}
                      </td>

                      {/* Stock Mínimo */}
                      <td className="py-2.5 px-3 text-right text-slate-600 font-normal">
                        {item.stock_minimo_kg} {item.unidad_medida || 'Kg'}
                      </td>

                      {/* Acciones */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Editar Insumo"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            title="Eliminar Insumo"
                            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📱 VISTA MÓVIL EN TARJETAS */}
      <div className="grid grid-cols-1 gap-2.5 md:hidden">
        {sortedInsumos.map((item) => {
          const pesoGramos = Math.round((item.peso_estandar_porcion_kg || 0.35) * 1000);
          const rendimiento = item.peso_estandar_porcion_kg > 0 ? (1 / item.peso_estandar_porcion_kg).toFixed(2) : '-';

          return (
            <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs shadow-sm font-normal">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-900 text-sm block">{item.nombre}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] text-slate-400">{item.codigo}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">{item.categoria}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditModal(item)} className="p-1 text-slate-500 hover:text-slate-800">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(item)} className="p-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Gramaje porción:</span>
                  <span className="font-medium text-slate-800">{pesoGramos} g</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Rendimiento:</span>
                  <span className="font-medium text-purple-700">~ {rendimiento} porc/Kg</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Costo Base / Kg:</span>
                  <span className="font-medium text-slate-900">$ {formatMoney(item.costo_unitario_kg)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Stock Mínimo:</span>
                  <span className="text-slate-700">{item.stock_minimo_kg} {item.unidad_medida}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 📝 MODAL CREAR / EDITAR */}
      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === 'CREATE' ? 'Crear Nuevo Insumo / Carne' : `Editar: ${selectedItem?.nombre}`}
        icon={<Beef className="w-5 h-5 text-orange-500" />}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs font-normal">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Código</label>
              <input
                type="text"
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value)}
                placeholder="Ej. CAR-001"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-medium mb-1">Nombre del Insumo / Corte *</label>
              <input
                type="text"
                required
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej. Punta de anca importada"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Categoría</label>
              <select
                value={formCategoria}
                onChange={(e) => setFormCategoria(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white"
              >
                {CATEGORIAS_PREDEFINIDAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Unidad de Compra</label>
              <select
                value={formUnidad}
                onChange={(e) => setFormUnidad(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 bg-white"
              >
                <option value="Kg">Kilogramos (Kg)</option>
                <option value="Und">Unidades (Und)</option>
                <option value="Gramo">Gramos (g)</option>
                <option value="Litro">Litros (L)</option>
                <option value="Paquete">Paquete</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-purple-50/60 border border-purple-200/70 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-purple-900 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Rendimiento Teórico y Gramaje por Porción
              </span>
              <span className="text-[11px] text-purple-700 font-medium">1 Kg = Rendimiento × Peso</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-purple-950 font-medium mb-1">
                  Rendimiento (Porciones x 1 Kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formRendimientoTeorico}
                  onChange={(e) => handleRendimientoChange(e.target.value)}
                  placeholder="Ej: 3 (rinde 3 porciones x Kg)"
                  className="w-full h-8 px-2.5 rounded-lg border border-purple-300 focus:border-purple-600 text-purple-950 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-purple-950 font-medium mb-1">
                  Peso Estándar por Porción (Kg)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formPesoEstandar}
                  onChange={(e) => handlePesoEstandarChange(e.target.value)}
                  placeholder="Ej: 0.333 Kg (333 gramos)"
                  className="w-full h-8 px-2.5 rounded-lg border border-purple-300 focus:border-purple-600 text-purple-950 bg-white font-medium"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Costo Unitario Promedio por Kg ($ COP)</label>
              <input
                type="number"
                step="100"
                value={formCostoUnitario}
                onChange={(e) => setFormCostoUnitario(e.target.value)}
                placeholder="Ej. 24000"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Stock Mínimo de Seguridad (Kg)</label>
              <input
                type="number"
                step="0.5"
                value={formStockMinimo}
                onChange={(e) => setFormStockMinimo(e.target.value)}
                placeholder="Ej. 10"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-300 focus:border-orange-500 text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="esCarneCheck"
              checked={formEsCarne}
              onChange={(e) => setFormEsCarne(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
            />
            <label htmlFor="esCarneCheck" className="text-slate-700 font-medium select-none cursor-pointer">
              Es una carne / proteína cárnica sujeta a control de porcionado y mermas
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalMode(null)}
              className="px-4 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{modalMode === 'CREATE' ? 'Crear Insumo' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
