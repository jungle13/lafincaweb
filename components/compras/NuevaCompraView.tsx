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
  FileCheck,
  UploadCloud,
  CheckCircle2,
  X,
  Layers,
  ChevronRight,
  Check,
  Building2,
  Calendar,
  AlertTriangle,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { invalidateCache } from '@/lib/dataCache';
import ImportarComprasModal, { ParsedFacturaData, ParsedFacturaItem } from './ImportarComprasModal';

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
  nombre_factura_original: string; // Nombre literal tal cual como se extrae de la factura original
  nombre_insumo: string;           // Insumo equivalente en BD (o vacío si no existe match)
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

// Helper inteligente para buscar el insumo exacto o equivalente en el catálogo
function findMatchingCatalogInsumo(raw: string, catalog: InsumoOption[]): InsumoOption | null {
  if (!raw || !raw.trim()) return null;
  const clean = raw.trim().toLowerCase();

  // 1. Coincidencia exacta
  const exact = catalog.find(c => c.nombre.trim().toLowerCase() === clean);
  if (exact) return exact;

  // 2. Normalización de acentos y caracteres especiales
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const cleanNorm = normalize(raw);
  const exactNorm = catalog.find(c => normalize(c.nombre) === cleanNorm);
  if (exactNorm) return exactNorm;

  // Si no coincide exactamente con un insumo registrado en la base de datos, retornar null
  // (Cumple estrictamente la regla de negocio: si no existe en BD, dejar en blanco para que el usuario vincule o cree)
  return null;
}

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

  // Modal de importación de TXT
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Estado para gestión de múltiples facturas escaneadas
  const [scannedFacturas, setScannedFacturas] = useState<ParsedFacturaData[]>([]);
  const [activeFacturaIndex, setActiveFacturaIndex] = useState<number>(0);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

  // Datos de la factura activa en formulario
  const [numeroFactura, setNumeroFactura] = useState('');
  
  // Fecha predeterminada
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

  // Líneas de insumos de la factura activa
  const [lineas, setLineas] = useState<LineaCompraDraft[]>([
    {
      id: 'linea-1',
      insumo_id: null,
      nombre_factura_original: '',
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

  // Agregar nueva línea manual
  const handleAddLinea = () => {
    setLineas(prev => [
      ...prev,
      {
        id: `linea-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        insumo_id: null,
        nombre_factura_original: '',
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

  // Modificar línea del formulario
  const handleUpdateLinea = (id: string, field: keyof LineaCompraDraft, value: any) => {
    setLineas(prev => prev.map(l => {
      if (l.id !== id) return l;

      const updated = { ...l, [field]: value };

      // Si cambia el nombre del insumo de BD y coincide con el catálogo, autocompletar ID, unidad, categoría y costo
      if (field === 'nombre_insumo' && typeof value === 'string') {
        const matched = catalog.find(c => c.nombre.toLowerCase().trim() === value.trim().toLowerCase());
        if (matched) {
          updated.insumo_id = matched.id;
          updated.nombre_insumo = matched.nombre;
          if (matched.categoria) updated.categoria = matched.categoria;
          if (matched.unidad_medida) updated.unidad = matched.unidad_medida;
          if (matched.costo_unitario_kg && (!updated.costo_unitario || updated.costo_unitario === 0)) {
            updated.costo_unitario = matched.costo_unitario_kg;
          }
        } else {
          updated.insumo_id = null;
        }
      }

      return updated;
    }));
  };

  // Cargar una factura en los campos del formulario
  const loadFacturaIntoForm = (targetFac: ParsedFacturaData, currentCatalog: InsumoOption[] = catalog) => {
    setNumeroFactura(targetFac.numeroFactura || '');
    setFecha(targetFac.fecha || defaultDate);
    setProveedor(targetFac.proveedor || '');
    setCategoriaPrincipal(targetFac.categoriaPrincipal || 'Carnes y Proteínas');
    setOrigen(targetFac.origen || 'Factura Electrónica');
    setObservaciones(targetFac.observaciones || '');

    if (targetFac.lineas && targetFac.lineas.length > 0) {
      const mapped: LineaCompraDraft[] = targetFac.lineas.map((l, idx): LineaCompraDraft => {
        const rawName = l.nombre_original || l.nombre_insumo || '';
        // Buscar coincidencia exacta en el catálogo maestro
        const matched = l.insumo_id 
          ? currentCatalog.find(c => c.id === l.insumo_id)
          : findMatchingCatalogInsumo(rawName, currentCatalog);

        const unitCost: number | '' = (typeof l.costo_unitario === 'number' && l.costo_unitario > 0)
          ? l.costo_unitario
          : (matched?.costo_unitario_kg ? Number(matched.costo_unitario_kg) : '');

        return {
          id: `linea-imp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          insumo_id: matched ? matched.id : null,
          nombre_factura_original: rawName,
          // REGLA CLAVE: si no existe en BD, queda en blanco para que el usuario vincule o cree
          nombre_insumo: matched ? matched.nombre : (l.nombre_insumo || ''),
          categoria: matched?.categoria || l.categoria || targetFac.categoriaPrincipal || categoriaPrincipal,
          detalle: l.detalle || rawName,
          cantidad: l.cantidad || 1,
          unidad: matched?.unidad_medida || l.unidad || 'Kg',
          costo_unitario: unitCost,
        };
      });
      setLineas(mapped);
    } else {
      setLineas([
        {
          id: 'linea-1',
          insumo_id: null,
          nombre_factura_original: '',
          nombre_insumo: '',
          categoria: targetFac.categoriaPrincipal || 'Carnes y Proteínas',
          detalle: '',
          cantidad: 1,
          unidad: 'Kg',
          costo_unitario: '',
        }
      ]);
    }
  };

  // Manejar datos importados desde el archivo TXT (una o múltiples facturas)
  const handleImportData = (incomingFacturas: ParsedFacturaData[]) => {
    setErrorMessage(null);
    if (!incomingFacturas || incomingFacturas.length === 0) return;

    setScannedFacturas(incomingFacturas);
    setActiveFacturaIndex(0);
    setIsSidePanelOpen(true);

    // Cargar la primera factura en el formulario
    loadFacturaIntoForm(incomingFacturas[0]);

    const count = incomingFacturas.length;
    setImportSuccessMsg(
      count === 1
        ? `Se importó 1 factura con ${incomingFacturas[0].lineas.length} insumos. Revisa los datos y presiona "Guardar Factura".`
        : `Se importaron ${count} facturas desde el archivo TXT. Puedes navegar entre ellas en el panel lateral derecho.`
    );
  };

  // Cambiar a otra factura del listado escaneado
  const handleSelectFactura = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= scannedFacturas.length) return;
    if (targetIndex === activeFacturaIndex) return;

    // 1. Guardar cambios en la factura actualmente activa para no perder avances
    setScannedFacturas(prev => {
      const next = [...prev];
      if (next[activeFacturaIndex]) {
        next[activeFacturaIndex] = {
          ...next[activeFacturaIndex],
          numeroFactura,
          fecha,
          proveedor,
          categoriaPrincipal,
          origen,
          observaciones,
          lineas: lineas.map(l => ({
            nombre_original: l.nombre_factura_original,
            nombre_insumo: l.nombre_insumo,
            insumo_id: l.insumo_id,
            categoria: l.categoria,
            detalle: l.detalle,
            cantidad: typeof l.cantidad === 'number' ? l.cantidad : 1,
            unidad: l.unidad,
            costo_unitario: typeof l.costo_unitario === 'number' ? l.costo_unitario : 0,
          }))
        };
      }
      return next;
    });

    // 2. Cargar la factura objetivo
    const targetFac = scannedFacturas[targetIndex];
    setActiveFacturaIndex(targetIndex);
    loadFacturaIntoForm(targetFac);
  };

  // Total de la factura activa
  const totalFactura = useMemo(() => {
    return lineas.reduce((acc, l) => {
      const q = typeof l.cantidad === 'number' ? l.cantidad : 0;
      const c = typeof l.costo_unitario === 'number' ? l.costo_unitario : 0;
      return acc + (q * c);
    }, 0);
  }, [lineas]);

  // Total de ítems válidos
  const totalItemsCount = useMemo(() => {
    return lineas.filter(l => l.nombre_insumo.trim().length > 0).length;
  }, [lineas]);

  // Ítems sin vincular
  const unlinkedItemsCount = useMemo(() => {
    return lineas.filter(l => !l.nombre_insumo.trim()).length;
  }, [lineas]);

  // Guardar factura activa
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

    // Verificar si hay insumos sin vincular a la base de datos
    const unlinked = lineas.filter(l => !l.nombre_insumo.trim());
    if (unlinked.length > 0) {
      setErrorMessage(
        `Hay ${unlinked.length} ${unlinked.length === 1 ? 'insumo sin vincular' : 'insumos sin vincular'} a la base de datos (campo "Insumo / Producto (BD)" vacío). Debes seleccionar o escribir el insumo equivalente para cada línea antes de guardar.`
      );
      return;
    }

    const lineasValidas = lineas.filter(l => l.nombre_insumo.trim().length > 0);
    if (lineasValidas.length === 0) {
      setErrorMessage('Debes registrar al menos un insumo con su nombre de base de datos.');
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
          // Preservar en el detalle el nombre original de la factura para auditoría exacta
          detalle: l.nombre_factura_original 
            ? `${l.nombre_factura_original}${l.detalle && l.detalle !== l.nombre_factura_original ? ' • ' + l.detalle : ''}`
            : (l.detalle.trim() || l.nombre_insumo.trim()),
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

      // Si hay un listado de múltiples facturas escaneadas
      if (scannedFacturas.length > 1) {
        // Marcar la factura actual como guardada
        const updatedScanned = [...scannedFacturas];
        updatedScanned[activeFacturaIndex] = {
          ...updatedScanned[activeFacturaIndex],
          guardada: true
        };
        setScannedFacturas(updatedScanned);

        // Buscar siguiente factura pendiente (no guardada)
        const nextPendingIndex = updatedScanned.findIndex((f, idx) => idx !== activeFacturaIndex && !f.guardada);

        if (nextPendingIndex !== -1) {
          setImportSuccessMsg(`✓ Factura ${numeroFactura} guardada con éxito. Cargando siguiente factura (${nextPendingIndex + 1} de ${updatedScanned.length})...`);
          setActiveFacturaIndex(nextPendingIndex);
          loadFacturaIntoForm(updatedScanned[nextPendingIndex]);
          setSaving(false);
          return;
        }
      }

      // Si todas las facturas escaneadas fueron guardadas o era una sola
      onSuccess();
    } catch (err: any) {
      console.error('Error guardando factura:', err);
      setErrorMessage(err?.message || 'Error al guardar la factura en el sistema.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 animate-fade-in font-normal pb-12">
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

        {/* Acciones Superiores: Cancelar, Panel Lateral Toggle, Importar Compras y Guardar Factura */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          {scannedFacturas.length > 0 && (
            <button
              type="button"
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors cursor-pointer"
              title={isSidePanelOpen ? 'Ocultar panel de facturas' : 'Mostrar panel de facturas'}
            >
              {isSidePanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
              <span>
                Facturas ({scannedFacturas.filter(f => f.guardada).length}/{scannedFacturas.length})
              </span>
            </button>
          )}

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
            onClick={() => setImportModalOpen(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            title="Importar compras desde archivo TXT estructurado"
          >
            <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
            <span>Importar compras</span>
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

      {/* Alerta de Éxito al Importar */}
      {importSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between gap-2.5 text-emerald-800 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Alerta de Advertencia de Insumos sin Vincular */}
      {unlinkedItemsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center justify-between gap-2.5 text-amber-800 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Atención: Tienes <strong>{unlinkedItemsCount} {unlinkedItemsCount === 1 ? 'insumo sin vincular' : 'insumos sin vincular'}</strong> en la base de datos. Completa el campo <em>"Insumo / Producto (BD)"</em> para poder guardar.
            </span>
          </div>
        </div>
      )}

      {/* Alerta de Error */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center gap-2.5 text-rose-800 text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 🚀 LAYOUT PRINCIPAL: FORMULARIO + PANEL LATERAL DERECHO */}
      <div className="flex flex-col lg:flex-row items-start gap-4">
        {/* LADO IZQUIERDO: FORMULARIO DE FACTURA */}
        <div className="flex-1 w-full space-y-4 min-w-0">
          
          {/* 📋 Sección 1: Información de Cabecera de la Factura */}
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-slate-700" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Información del Comprobante
                </h2>
              </div>
              {scannedFacturas.length > 1 && (
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  Factura {activeFacturaIndex + 1} de {scannedFacturas.length}
                </span>
              )}
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

            {/* Tabla de Líneas con campo adicional para Insumo en Factura Original */}
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-2.5 min-w-[190px]">
                      Insumo en Factura (Original)
                    </th>
                    <th className="py-2 px-2.5 min-w-[210px]">
                      Insumo / Producto (BD) <span className="text-rose-500">*</span>
                    </th>
                    <th className="py-2 px-2.5 min-w-[130px]">Categoría</th>
                    <th className="py-2 px-2 w-20 text-right">Cantidad</th>
                    <th className="py-2 px-2 w-20">Unidad</th>
                    <th className="py-2 px-2 w-28 text-right">Costo Unit. ($)</th>
                    <th className="py-2 px-2 w-28 text-right">Subtotal ($)</th>
                    <th className="py-2 px-2.5 min-w-[120px]">Detalle / Gramaje</th>
                    <th className="py-2 px-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineas.map((linea, index) => {
                    const subtotal = (Number(linea.cantidad) || 0) * (Number(linea.costo_unitario) || 0);
                    const isLinked = Boolean(linea.insumo_id);
                    const isEmptyBD = !linea.nombre_insumo.trim();

                    return (
                      <tr key={linea.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* # */}
                        <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                          {index + 1}
                        </td>

                        {/* Campo Adicional: Nombre literal de la Factura Original */}
                        <td className="py-1.5 px-2.5">
                          <input
                            type="text"
                            placeholder="Nombre literal en factura..."
                            value={linea.nombre_factura_original}
                            onChange={(e) => handleUpdateLinea(linea.id, 'nombre_factura_original', e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md font-mono text-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:bg-white"
                            title="Nombre original extraído de la factura física"
                          />
                        </td>

                        {/* Insumo Equivalente en la Base de Datos */}
                        <td className="py-1.5 px-2.5">
                          <input
                            type="text"
                            required
                            list="catalogo-insumos-list"
                            placeholder="Buscar insumo en BD..."
                            value={linea.nombre_insumo}
                            onChange={(e) => handleUpdateLinea(linea.id, 'nombre_insumo', e.target.value)}
                            className={`w-full px-2 py-1 text-xs rounded-md focus:outline-hidden focus:ring-1 font-semibold transition-colors ${
                              isEmptyBD
                                ? 'bg-amber-50/80 border border-amber-300 text-amber-900 focus:ring-amber-500'
                                : isLinked
                                  ? 'bg-white border border-emerald-300 text-slate-900 focus:ring-emerald-500'
                                  : 'bg-white border border-slate-200 text-slate-800 focus:ring-slate-900'
                            }`}
                          />
                          {isEmptyBD && (
                            <span className="block text-[10px] text-amber-600 font-medium mt-0.5">
                              ⚠️ Sin vincular en BD
                            </span>
                          )}
                          {!isEmptyBD && isLinked && (
                            <span className="block text-[10px] text-emerald-600 font-medium mt-0.5">
                              ✓ Vinculado a catálogo
                            </span>
                          )}
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
                        <td className="py-1.5 px-2">
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
                        <td className="py-1.5 px-2">
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
                        <td className="py-1.5 px-2">
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
                        <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-900">
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

            {/* Resumen al pie de la tabla de insumos */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <span>{totalItemsCount} insumos vinculados</span>
                {unlinkedItemsCount > 0 && (
                  <span className="text-amber-600 font-semibold">
                    • {unlinkedItemsCount} pendiente(s) de vincular
                  </span>
                )}
                <span>• Período contable: {periodoNombre}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[11px] block">TOTAL FACTURA ACTUAL</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  ${totalFactura.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 📑 LADO DERECHO: PANEL LATERAL DESPLEGABLE DE FACTURAS ESCANEADAS */}
        {scannedFacturas.length > 0 && isSidePanelOpen && (
          <aside className="w-full lg:w-80 shrink-0 bg-white rounded-lg border border-slate-200 shadow-2xs p-3.5 space-y-3 sticky top-4 animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Cabecera del Panel Lateral */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Facturas Escaneadas
                </h3>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
                  {scannedFacturas.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidePanelOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                title="Contraer panel lateral"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Indicador de Ayuda */}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Selecciona una factura para autocompletar el formulario y guardar una a una:
            </p>

            {/* Lista de Tarjetas de Facturas */}
            <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1">
              {scannedFacturas.map((fac, idx) => {
                const isActive = idx === activeFacturaIndex;
                const isSaved = Boolean(fac.guardada);
                const itemsCount = fac.lineas ? fac.lineas.length : 0;
                const estTotal = (fac.lineas || []).reduce((acc, l) => acc + (Number(l.cantidad || 0) * Number(l.costo_unitario || 0)), 0);

                return (
                  <div
                    key={fac.id || idx}
                    onClick={() => handleSelectFactura(idx)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer text-left select-none ${
                      isActive
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900 shadow-xs'
                        : isSaved
                          ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 bg-white'
                    }`}
                  >
                    {/* Fila 1: N° Factura + Badge Estado */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-900 font-mono truncate">
                        {fac.numeroFactura || `Factura #${idx + 1}`}
                      </span>

                      {isSaved ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3" />
                          <span>Guardada</span>
                        </span>
                      ) : isActive ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full shrink-0">
                          En edición
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full shrink-0">
                          Pendiente
                        </span>
                      )}
                    </div>

                    {/* Fila 2: Proveedor */}
                    <p className="text-[11px] text-slate-600 font-medium truncate flex items-center gap-1 mb-1">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{fac.proveedor || 'Sin proveedor'}</span>
                    </p>

                    {/* Fila 3: Fecha + Conteo + Total */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {fac.fecha || 'Sin fecha'}
                      </span>
                      <span className="font-semibold text-slate-700 font-mono">
                        {itemsCount} {itemsCount === 1 ? 'ítem' : 'ítems'} • ${estTotal.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen del Progreso */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Progreso:</span>
              <span className="font-bold text-slate-900">
                {scannedFacturas.filter(f => f.guardada).length} de {scannedFacturas.length} guardadas
              </span>
            </div>
          </aside>
        )}
      </div>

      {/* Modal de Importación de Compras por TXT */}
      <ImportarComprasModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportData={handleImportData}
      />
    </div>
  );
}
