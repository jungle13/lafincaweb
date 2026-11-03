'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  AlertCircle, 
  Receipt, 
  Package, 
  Building2, 
  Calendar as CalendarIcon,
  Tag,
  FileCheck
} from 'lucide-react';
import { invalidateCache } from '@/lib/dataCache';

export interface InsumoOption {
  id: string;
  nombre: string;
  categoria: string;
  costo_unitario_kg?: number;
  unidad_medida?: string;
}

export interface LineaCompraDraft {
  id: string;
  insumo_id: string | null;
  nombre_insumo: string;
  categoria: string;
  detalle: string;
  cantidad: number | '';
  unidad: string;
  costo_unitario: number | '';
}

interface Props {
  periodoId: string;
  periodoNombre: string;
  proveedoresExistentes: string[];
  categoriasExistentes: string[];
  onCancel: () => void;
  onSuccess: () => void;
}

const CATEGORIAS_STANDARD = [
  'Carnes y Proteínas',
  'Verduras e Insumos',
  'Granos y Abarrotes',
  'Lácteos',
  'Bebidas',
  'Desechables y Empaques',
  'Otros Insumos y Servicios'
];

const UNIDADES_STANDARD = [
  'Kg',
  'Und',
  'Bolsa',
  'Paq',
  'Atado',
  'Bulto',
  'Lt',
  'Porc'
];

export default function NuevaCompraView({
  periodoId,
  periodoNombre,
  proveedoresExistentes,
  categoriasExistentes,
  onCancel,
  onSuccess,
}: Props) {
  // Catálogo maestro para autocompletar insumos
  const [catalog, setCatalog] = useState<InsumoOption[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Datos principales de la factura
  const [numeroFactura, setNumeroFactura] = useState('');
  
  // Fecha predeterminada: si el periodo es per-YYYY-MM, usar último día del mes o fecha de hoy
  const defaultDate = useMemo(() => {
    if (periodoId && periodoId.startsWith('per-')) {
      const parts = periodoId.replace('per-', '').split('-');
      if (parts.length === 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const lastDay = new Date(year, month, 0).getDate();
        const dd = String(lastDay).padStart(2, '0');
        const mm = String(month).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
      }
    }
    return new Date().toISOString().slice(0, 10);
  }, [periodoId]);

  const [fecha, setFecha] = useState(defaultDate);
  const [proveedor, setProveedor] = useState('');
  const [categoriaPrincipal, setCategoriaPrincipal] = useState('Carnes y Proteínas');
  const [origen, setOrigen] = useState('Factura Electrónica');
  const [observaciones, setObservaciones] = useState('');

  // Líneas de insumos
  const [lineas, setLineas] = useState<LineaCompraDraft[]>([
    {
      id: 'linea-1',
      insumo_id: null,
      nombre_insumo: '',
      categoria: 'Carnes y Proteínas',
      detalle: '',
      cantidad: 1,
      unidad: 'Kg',
      costo_unitario: '',
    }
  ]);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cargar catálogo de insumos para sugerencias inteligentes
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      setLoadingCatalog(true);
      try {
        const res = await fetch('/api/catalogo');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && isMounted) {
            setCatalog(json.data);
          }
        }
      } catch (err) {
        console.error('Error cargando catálogo para autocompletar:', err);
      } finally {
        if (isMounted) setLoadingCatalog(false);
      }
    }
    loadCatalog();
    return () => { isMounted = false; };
  }, []);

  // Agregar nueva línea
  const handleAddLinea = () => {
    setLineas(prev => [
      ...prev,
      {
        id: `linea-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        insumo_id: null,
        nombre_insumo: '',
        categoria: categoriaPrincipal,
        detalle: '',
        cantidad: 1,
        unidad: 'Kg',
        costo_unitario: '',
      }
    ]);
  };

  // Eliminar línea
  const handleRemoveLinea = (id: string) => {
    if (lineas.length === 1) {
      alert('La factura debe tener al menos un insumo.');
      return;
    }
    setLineas(prev => prev.filter(l => l.id !== id));
  };

  // Modificar línea
  const handleUpdateLinea = (id: string, field: keyof LineaCompraDraft, value: any) => {
    setLineas(prev => prev.map(l => {
      if (l.id !== id) return l;

      const updated = { ...l, [field]: value };

      // Si cambia el nombre de insumo y coincide exactamente con el catálogo, autocompletar
      if (field === 'nombre_insumo' && typeof value === 'string') {
        const matched = catalog.find(c => c.nombre.toLowerCase() === value.trim().toLowerCase());
        if (matched) {
          updated.insumo_id = matched.id;
          if (matched.categoria) updated.categoria = matched.categoria;
          if (matched.unidad_medida) updated.unidad = matched.unidad_medida;
          if (matched.costo_unitario_kg && (!updated.costo_unitario || updated.costo_unitario === 0)) {
            updated.costo_unitario = matched.costo_unitario_kg;
          }
        }
      }

      return updated;
    }));
  };

  // Total de la factura
  const totalFactura = useMemo(() => {
    return lineas.reduce((acc, l) => {
      const q = typeof l.cantidad === 'number' ? l.cantidad : 0;
      const c = typeof l.costo_unitario === 'number' ? l.costo_unitario : 0;
      return acc + (q * c);
    }, 0);
  }, [lineas]);

  // Total de unidades / ítems
  const totalItemsCount = useMemo(() => {
    return lineas.filter(l => l.nombre_insumo.trim().length > 0).length;
  }, [lineas]);

  // Guardar factura
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validaciones
    if (!numeroFactura.trim()) {
      setErrorMessage('Por favor ingresa el número de factura o comprobante.');
      return;
    }
    if (!fecha) {
      setErrorMessage('Por favor selecciona la fecha de la factura.');
      return;
    }
    if (!proveedor.trim()) {
      setErrorMessage('Por favor ingresa o selecciona el nombre del proveedor.');
      return;
    }

    const lineasValidas = lineas.filter(l => l.nombre_insumo.trim().length > 0);
    if (lineasValidas.length === 0) {
      setErrorMessage('Debes registrar al menos un insumo con su nombre.');
      return;
    }

    for (let i = 0; i < lineasValidas.length; i++) {
      const l = lineasValidas[i];
      const q = Number(l.cantidad || 0);
      const c = Number(l.costo_unitario || 0);
      if (q <= 0) {
        setErrorMessage(`La cantidad para el insumo "${l.nombre_insumo}" debe ser mayor a 0.`);
        return;
      }
      if (c <= 0) {
        setErrorMessage(`El costo unitario para el insumo "${l.nombre_insumo}" debe ser mayor a $0.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        numero_factura: numeroFactura.trim(),
        fecha,
        proveedor: proveedor.trim(),
        categoria: categoriaPrincipal,
        origen: origen.trim(),
        observaciones: observaciones.trim() || null,
        periodo_id: periodoId,
        items: lineasValidas.map(l => ({
          insumo_id: l.insumo_id,
          nombre_insumo: l.nombre_insumo.trim(),
          categoria: l.categoria,
          detalle: l.detalle.trim() || l.nombre_insumo.trim(),
          cantidad: Number(l.cantidad),
          unidad: l.unidad,
          costo_unitario: Number(l.costo_unitario),
          valor_compra: Number(l.cantidad) * Number(l.costo_unitario),
        }))
      };

      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al guardar la factura');
      }

      // Limpiar cache del periodo
      invalidateCache(`compras_data_${periodoId}`);

      onSuccess();
    } catch (err: any) {
      console.error('Error guardando factura:', err);
      setErrorMessage(err?.message || 'Error al guardar la factura en el sistema.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 animate-fade-in font-normal pb-12">
      {/* 🏷️ Encabezado de la Vista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-md border border-slate-200 transition-colors cursor-pointer"
            title="Volver sin guardar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="p-2 bg-slate-900 text-white rounded-md">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Añadir Factura de Compra
            </h1>
            <p className="text-xs text-slate-500">
              Registro de costos directos y materia prima • <span className="font-semibold text-slate-700">{periodoNombre}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Guardar Factura</span>
          </button>
        </div>
      </div>

      {/* Alerta de Error */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center gap-2.5 text-rose-800 text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 📋 Sección 1: Información de Cabecera de la Factura */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <FileCheck className="w-4 h-4 text-slate-700" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Información del Comprobante
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* N° Factura */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              N° Factura / Remisión <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: FAC-00124"
              value={numeroFactura}
              onChange={(e) => setNumeroFactura(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white text-slate-800 font-medium"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Fecha de Compra <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white text-slate-800 font-mono"
            />
          </div>

          {/* Proveedor */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Proveedor <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              list="proveedores-list"
              placeholder="Nombre del proveedor..."
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white text-slate-800"
            />
            <datalist id="proveedores-list">
              {proveedoresExistentes.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          {/* Categoría General */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Categoría Principal
            </label>
            <select
              value={categoriaPrincipal}
              onChange={(e) => setCategoriaPrincipal(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-slate-800 cursor-pointer"
            >
              {CATEGORIAS_STANDARD.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Origen / Soporte */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Tipo de Soporte / Origen
            </label>
            <select
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-slate-800 cursor-pointer"
            >
              <option value="Factura Electrónica">Factura Electrónica</option>
              <option value="Remisión Bodega">Remisión Bodega</option>
              <option value="Cuenta de Cobro">Cuenta de Cobro</option>
              <option value="Recibo de Caja">Recibo de Caja</option>
              <option value="Compra Directa / Contado">Compra Directa / Contado</option>
            </select>
          </div>

          {/* Observaciones */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Observaciones / Notas de Factura
            </label>
            <input
              type="text"
              placeholder="Detalles adicionales, número de pedido o condiciones de pago..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* 📦 Sección 2: Detalle de Insumos / Líneas de la Factura */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Insumos y Materia Prima ({lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'})
            </h2>
          </div>
          <button
            type="button"
            onClick={handleAddLinea}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Insumo</span>
          </button>
        </div>

        {/* Datalist de insumos del catálogo */}
        <datalist id="catalogo-insumos-list">
          {catalog.map((c) => (
            <option key={c.id} value={c.nombre}>
              {c.categoria} {c.costo_unitario_kg ? `• $${c.costo_unitario_kg.toLocaleString('es-CO')}` : ''}
            </option>
          ))}
        </datalist>

        {/* Tabla de Líneas */}
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2 px-2.5 w-8 text-center">#</th>
                <th className="py-2 px-2.5 min-w-[200px]">Insumo / Producto</th>
                <th className="py-2 px-2.5 min-w-[150px]">Categoría</th>
                <th className="py-2 px-2.5 w-24 text-right">Cantidad</th>
                <th className="py-2 px-2.5 w-24">Unidad</th>
                <th className="py-2 px-2.5 w-32 text-right">Costo Unit. ($)</th>
                <th className="py-2 px-2.5 w-32 text-right">Subtotal ($)</th>
                <th className="py-2 px-2.5 min-w-[140px]">Detalle / Gramaje</th>
                <th className="py-2 px-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineas.map((linea, index) => {
                const subtotal = (Number(linea.cantidad) || 0) * (Number(linea.costo_unitario) || 0);

                return (
                  <tr key={linea.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* # */}
                    <td className="py-1.5 px-2.5 text-center text-slate-400 font-mono text-[11px]">
                      {index + 1}
                    </td>

                    {/* Nombre Insumo */}
                    <td className="py-1.5 px-2.5">
                      <input
                        type="text"
                        required
                        list="catalogo-insumos-list"
                        placeholder="Buscar o escribir insumo..."
                        value={linea.nombre_insumo}
                        onChange={(e) => handleUpdateLinea(linea.id, 'nombre_insumo', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-medium text-slate-800"
                      />
                    </td>

                    {/* Categoría */}
                    <td className="py-1.5 px-2.5">
                      <select
                        value={linea.categoria}
                        onChange={(e) => handleUpdateLinea(linea.id, 'categoria', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-slate-700 cursor-pointer"
                      >
                        {CATEGORIAS_STANDARD.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>

                    {/* Cantidad */}
                    <td className="py-1.5 px-2.5">
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        required
                        placeholder="0"
                        value={linea.cantidad}
                        onChange={(e) => handleUpdateLinea(linea.id, 'cantidad', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right font-mono"
                      />
                    </td>

                    {/* Unidad */}
                    <td className="py-1.5 px-2.5">
                      <select
                        value={linea.unidad}
                        onChange={(e) => handleUpdateLinea(linea.id, 'unidad', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-slate-700 cursor-pointer"
                      >
                        {UNIDADES_STANDARD.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>

                    {/* Costo Unitario */}
                    <td className="py-1.5 px-2.5">
                      <input
                        type="number"
                        step="any"
                        min="1"
                        required
                        placeholder="0"
                        value={linea.costo_unitario}
                        onChange={(e) => handleUpdateLinea(linea.id, 'costo_unitario', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right font-mono"
                      />
                    </td>

                    {/* Subtotal Calculado */}
                    <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-slate-900">
                      ${subtotal.toLocaleString('es-CO')}
                    </td>

                    {/* Detalle Opcional */}
                    <td className="py-1.5 px-2.5">
                      <input
                        type="text"
                        placeholder="Ej: 10 unds x 400g"
                        value={linea.detalle}
                        onChange={(e) => handleUpdateLinea(linea.id, 'detalle', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-slate-600"
                      />
                    </td>

                    {/* Eliminar Fila */}
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLinea(linea.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded-sm cursor-pointer"
                        title="Eliminar insumo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Botón rápido inferior para añadir otra fila */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleAddLinea}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium py-1 px-2 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar otra línea de insumo</span>
          </button>
        </div>
      </div>

      {/* 💰 Sección 3: Resumen Totalizado y Botones Finales */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
        <div className="text-xs text-slate-500">
          <span>{totalItemsCount} {totalItemsCount === 1 ? 'insumo válido' : 'insumos válidos'} listados</span>
          <span className="mx-2">•</span>
          <span>Período destino: <strong className="text-slate-700">{periodoNombre}</strong></span>
        </div>

        <div className="flex items-center gap-4 self-end sm:self-auto">
          <div className="text-right">
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Total Factura
            </span>
            <span className="text-lg font-black text-slate-900 font-mono">
              ${totalFactura.toLocaleString('es-CO')} <span className="text-xs font-semibold text-slate-500">COP</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Guardar Factura</span>
          </button>
        </div>
      </div>
    </div>
  );
}
