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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ExportCatalogoPdfModal from '@/components/catalogo/ExportCatalogoPdfModal';
import { formatMoney, normalizeStr } from '@/lib/formatters';

export type TipoMedida = 'KGS' | 'UNIDADES' | 'KGS_Y_UNIDADES' | 'PAQUETES';

export interface CatalogoInsumo {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad_medida: string;
  tipo_medida: TipoMedida;
  peso_estandar_porcion_kg: number;
  costo_unitario_kg: number;
  stock_minimo_kg: number;
  es_carne: boolean;
  activo: boolean;
  observaciones?: string;
}

const CATEGORIAS_PREDEFINIDAS = [
  'CARNE DE RES',
  'CARNE DE CERDO',
  'CARNE POLLO',
  'PESCADOS Y MARISCOS',
  'EMBUTIDOS',
  'VERDURAS',
  'GRANOS Y ABARROTES',
  'DESECHABLES',
  'BEBIDAS',
  'SERVICIOS'
];

const CATEGORIAS_CARNICAS = [
  'CARNE DE RES',
  'CARNE DE CERDO',
  'CARNE POLLO',
  'PESCADOS Y MARISCOS',
  'EMBUTIDOS'
];

type SortField = 
  | 'codigo'
  | 'nombre'
  | 'categoria'
  | 'unidad_medida'
  | 'tipo_medida'
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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Form State
  const [formCodigo, setFormCodigo] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formCategoria, setFormCategoria] = useState('CARNE DE RES');
  const [formUnidad, setFormUnidad] = useState('Kg');
  const [formTipoMedida, setFormTipoMedida] = useState<TipoMedida>('KGS_Y_UNIDADES');
  const [formPesoGramos, setFormPesoGramos] = useState('333');
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

  // Sincronizar automáticamente unidad según el tipo de medida
  const handleTipoMedidaChange = (t: TipoMedida) => {
    setFormTipoMedida(t);
    if (t === 'UNIDADES') {
      setFormUnidad('Und');
      setFormEsCarne(false);
    } else if (t === 'PAQUETES') {
      setFormUnidad('Paquete');
      setFormEsCarne(false);
    } else if (t === 'KGS') {
      setFormUnidad('Kg');
    } else if (t === 'KGS_Y_UNIDADES') {
      setFormUnidad('Kg');
      setFormEsCarne(true);
      if (!formPesoGramos || parseFloat(formPesoGramos) <= 0) {
        setFormPesoGramos('333');
      }
    }
  };

  // Al cambiar categoría, sugerir el tipo de medida inteligente
  const handleCategoriaChange = (cat: string) => {
    setFormCategoria(cat);
    const isMeatCategory = CATEGORIAS_CARNICAS.includes(cat);
    setFormEsCarne(isMeatCategory);
    if (isMeatCategory && formTipoMedida !== 'KGS_Y_UNIDADES' && formTipoMedida !== 'KGS') {
      setFormTipoMedida('KGS_Y_UNIDADES');
      setFormUnidad('Kg');
    }
  };

  const openCreateModal = () => {
    setSelectedItem(null);
    const nextNum = totalInsumos + 1;
    setFormCodigo(`CAR-${String(nextNum).padStart(3, '0')}`);
    setFormNombre('');
    setFormCategoria('CARNE DE RES');
    setFormTipoMedida('KGS_Y_UNIDADES');
    setFormUnidad('Kg');
    setFormPesoGramos('333');
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
    setFormTipoMedida(item.tipo_medida || 'KGS_Y_UNIDADES');
    setFormUnidad(item.unidad_medida || 'Kg');
    const pesoKg = item.peso_estandar_porcion_kg || 0;
    setFormPesoGramos(pesoKg > 0 ? String(Math.round(pesoKg * 1000)) : '333');
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
      const pesoKg = formTipoMedida === 'KGS_Y_UNIDADES' ? (parseFloat(formPesoGramos) || 333) / 1000 : 0;

      const payload = {
        id: selectedItem?.id,
        codigo: formCodigo.trim(),
        nombre: formNombre.trim(),
        categoria: formCategoria,
        unidad_medida: formUnidad,
        tipo_medida: formTipoMedida,
        peso_estandar_porcion_kg: Number(pesoKg.toFixed(3)),
        costo_unitario_kg: parseFloat(formCostoUnitario) || 0,
        stock_minimo_kg: parseFloat(formStockMinimo) || 0,
        es_carne: formEsCarne || formTipoMedida === 'KGS_Y_UNIDADES' || CATEGORIAS_CARNICAS.includes(formCategoria),
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
      <ArrowUp className="w-3 h-3 text-slate-900 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-slate-900 font-bold" />
    );
  };

  // Cálculo en vivo de rendimiento teórico
  const liveRendimiento = useMemo(() => {
    const grams = parseFloat(formPesoGramos);
    if (!isNaN(grams) && grams > 0) {
      return (1000 / grams).toFixed(2);
    }
    return '0.00';
  }, [formPesoGramos]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
        <p className="text-xs font-normal">Cargando Catálogo de Carnes e Insumos...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-3 font-normal animate-fade-in text-xs">
      
      {/* ------------------------------------------------------------ */}
      {/* BARRA SUPERIOR SOBRIA (Estilo GitHub / Costeo Diario)         */}
      {/* ------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 px-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Beef className="w-4 h-4 text-slate-700" />
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">
            Catálogo de Carnes e Insumos
          </h1>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium border border-slate-200 font-mono">
            {filteredInsumos.length} {filteredInsumos.length === 1 ? 'insumo' : 'insumos'}
          </span>
        </div>

        {/* Acciones: Buscador, Exportar y Nuevo Insumo */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o código..."
              className="w-full h-8 pl-8 pr-2.5 text-xs bg-slate-50/60 hover:bg-white focus:bg-white rounded-md border border-slate-200 focus:border-slate-400 outline-none text-slate-800 placeholder-slate-400 transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="px-2.5 h-8 bg-white hover:bg-slate-50 active:scale-98 text-slate-700 border border-slate-200 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
            title="Exportar Catálogo de Insumos a PDF"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-600" />
            <span>Exportar PDF</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-3 h-8 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Insumo</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* FILTROS DE CATEGORÍA MINIMALISTAS                            */}
      {/* ------------------------------------------------------------ */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-nowrap select-none">
        {[
          { key: 'ALL', label: `Todos (${totalInsumos})` },
          { key: 'CARNES', label: `Carnes (${totalCarnes})` },
          ...CATEGORIAS_PREDEFINIDAS.map(c => ({ key: c, label: c }))
        ].map((cat) => {
          const isSelected = selectedCat === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCat(cat.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
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
      {/* TABLA PRINCIPAL SOBRIA (Estilo GitHub)                       */}
      {/* ------------------------------------------------------------ */}
      <div className="hidden md:block w-full border border-slate-200 rounded-lg bg-white shadow-2xs overflow-hidden">
        <div className="relative max-h-[calc(100vh-210px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider select-none shadow-2xs">
              <tr>
                <th 
                  onClick={() => handleSort('codigo')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/70 transition-colors group whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Código</span>
                    {renderSortIcon('codigo')}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('nombre')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/70 transition-colors group whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Materia Prima / Corte</span>
                    {renderSortIcon('nombre')}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('categoria')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/70 transition-colors group whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Categoría</span>
                    {renderSortIcon('categoria')}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('unidad_medida')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/70 transition-colors group whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Unidad</span>
                    {renderSortIcon('unidad_medida')}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('tipo_medida')}
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100/70 transition-colors group whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Medida Sistema</span>
                    {renderSortIcon('tipo_medida')}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('peso_estandar_porcion_kg')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100/70 transition-colors group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Peso Estándar</span>
                    {renderSortIcon('peso_estandar_porcion_kg')}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('rendimiento')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100/70 transition-colors group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="inline-flex items-center gap-1" title="Porciones teóricas que rinde 1 Kg (1 / Peso)">
                      <span>Rendimiento</span>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </span>
                    {renderSortIcon('rendimiento')}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('costo_unitario_kg')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100/70 transition-colors group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Costo Base / Kg</span>
                    {renderSortIcon('costo_unitario_kg')}
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('stock_minimo_kg')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100/70 transition-colors group whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Stock Mínimo</span>
                    {renderSortIcon('stock_minimo_kg')}
                  </div>
                </th>

                <th className="py-2.5 px-3 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              {sortedInsumos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    No se encontraron insumos con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                sortedInsumos.map((item) => {
                  const pesoGramos = Math.round((item.peso_estandar_porcion_kg || 0.35) * 1000);
                  const rendimiento = item.peso_estandar_porcion_kg > 0 ? (1 / item.peso_estandar_porcion_kg).toFixed(2) : '-';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Código */}
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                        {item.codigo || item.id.slice(0, 8)}
                      </td>

                      {/* Nombre Clicable para editar */}
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
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {item.categoria}
                        </span>
                      </td>

                      {/* Unidad */}
                      <td className="py-2 px-3 text-slate-500 font-mono">
                        {item.unidad_medida || 'Kg'}
                      </td>

                      {/* Medida Sistema */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {item.tipo_medida === 'UNIDADES' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Solo Unidades
                          </span>
                        )}
                        {item.tipo_medida === 'PAQUETES' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Paquetes
                          </span>
                        )}
                        {item.tipo_medida === 'KGS' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Solo Kilos
                          </span>
                        )}
                        {(!item.tipo_medida || item.tipo_medida === 'KGS_Y_UNIDADES') && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            Kgs y Und
                          </span>
                        )}
                      </td>

                      {/* Peso estándar */}
                      <td className="py-2 px-3 text-right font-mono">
                        {item.tipo_medida === 'KGS_Y_UNIDADES' && item.peso_estandar_porcion_kg > 0 ? (
                          <span className="text-slate-800">
                            {pesoGramos} g <span className="text-slate-400 text-[11px]">({item.peso_estandar_porcion_kg.toFixed(3)} Kg)</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Rendimiento Teórico */}
                      <td className="py-2 px-3 text-right font-mono">
                        {item.es_carne ? (
                          <span className="text-slate-800">
                            ~{rendimiento} <span className="text-slate-400 text-[11px]">porc/Kg</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Costo Base */}
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                        ${formatMoney(item.costo_unitario_kg)}
                      </td>

                      {/* Stock Mínimo */}
                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                        {item.stock_minimo_kg} {item.unidad_medida || 'Kg'}
                      </td>

                      {/* Acciones */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Editar Insumo"
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            title="Eliminar Insumo"
                            className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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

      {/* ------------------------------------------------------------ */}
      {/* VISTA MÓVIL EN TARJETAS MINIMALISTAS                         */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-2 md:hidden">
        {sortedInsumos.map((item) => {
          const pesoGramos = Math.round((item.peso_estandar_porcion_kg || 0.35) * 1000);
          const rendimiento = item.peso_estandar_porcion_kg > 0 ? (1 / item.peso_estandar_porcion_kg).toFixed(2) : '-';

          return (
            <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 text-xs shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="font-semibold text-slate-900 text-left hover:underline text-xs"
                  >
                    {item.nombre}
                  </button>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] text-slate-400">{item.codigo}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">{item.categoria}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                    title="Editar Insumo"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Eliminar Insumo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 block font-sans">Gramaje porción:</span>
                  <span className="font-semibold text-slate-800">{pesoGramos} g</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">Rendimiento:</span>
                  <span className="font-semibold text-slate-800">~{rendimiento} porc/Kg</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">Costo Base / Kg:</span>
                  <span className="font-semibold text-slate-900">${formatMoney(item.costo_unitario_kg)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-sans">Stock Mínimo:</span>
                  <span className="text-slate-700">{item.stock_minimo_kg} {item.unidad_medida}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------ */}
      {/* MODAL CREAR / EDITAR (Espacioso, Estético y Minimalista)     */}
      {/* ------------------------------------------------------------ */}
      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === 'CREATE' ? 'Crear Nuevo Insumo' : `Editar: ${selectedItem?.nombre}`}
        icon={<Beef className="w-5 h-5 text-slate-700" />}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-6 bg-white py-2">
          
          {/* Fila 1: Código y Nombre con espacio holgado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Código
              </label>
              <input
                type="text"
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value)}
                placeholder="Ej. CAR-001"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 outline-none text-slate-800 font-mono text-sm bg-white transition-all shadow-2xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Nombre del Insumo / Corte *
              </label>
              <input
                type="text"
                required
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej. Punta de anca importada"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 outline-none text-slate-800 font-medium text-sm bg-white transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Fila 2: Categoría y Medición Principal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Categoría
              </label>
              <select
                value={formCategoria}
                onChange={(e) => handleCategoriaChange(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 text-slate-800 bg-white outline-none cursor-pointer text-sm transition-all shadow-2xs"
              >
                {CATEGORIAS_PREDEFINIDAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Medición en Sistema *
              </label>
              <select
                value={formTipoMedida}
                onChange={(e) => handleTipoMedidaChange(e.target.value as TipoMedida)}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 text-slate-900 bg-white font-medium text-sm cursor-pointer outline-none transition-all shadow-2xs truncate"
              >
                <option value="KGS_Y_UNIDADES">Kgs y Unidades (Carnes porcionadas)</option>
                <option value="UNIDADES">Solo Unidades (Huevos, chorizos, tamales)</option>
                <option value="PAQUETES">Paquetes (Papas francesas, verduras)</option>
                <option value="KGS">Solo Kilos (Sin porcionar / granel)</option>
              </select>
            </div>
          </div>

          {/* Bloque Condicional: Porcionado & Rendimiento (Solo para KGS_Y_UNIDADES) */}
          {formTipoMedida === 'KGS_Y_UNIDADES' && (
            <div className="p-5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Porcionado y Gramaje Estándar
                </span>
                <span className="text-xs text-slate-600 font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200">
                  Rinde ~<strong className="text-slate-900 font-bold">{liveRendimiento}</strong> porciones / Kg
                </span>
              </div>

              <div>
                <label className="block text-slate-600 mb-1.5 text-xs font-medium">
                  Peso promedio por porción individual (en gramos)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={formPesoGramos}
                    onChange={(e) => setFormPesoGramos(e.target.value)}
                    placeholder="Ej: 333"
                    className="w-full h-11 pl-3.5 pr-20 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 text-slate-900 bg-white font-mono text-sm outline-none transition-all shadow-2xs"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono pointer-events-none">
                    gramos
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Fila 3: Costo Base y Stock Mínimo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Costo Base ($ COP / {formUnidad})
              </label>
              <input
                type="number"
                step="100"
                value={formCostoUnitario}
                onChange={(e) => setFormCostoUnitario(e.target.value)}
                placeholder="Ej. 24000"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 text-slate-900 font-mono text-sm outline-none bg-white transition-all shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-2 text-xs uppercase tracking-wider">
                Stock Mínimo ({formUnidad})
              </label>
              <input
                type="number"
                step="1"
                value={formStockMinimo}
                onChange={(e) => setFormStockMinimo(e.target.value)}
                placeholder="Ej. 10"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 text-slate-900 font-mono text-sm outline-none bg-white transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Botones de Acción con mayor presencia y holgura */}
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
              <span>{modalMode === 'CREATE' ? 'Crear Insumo' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Exportación a PDF y Excel */}
      <ExportCatalogoPdfModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        insumos={insumos}
        initialCategory={selectedCat}
        initialSearch={searchQuery}
      />
    </div>
  );
}
