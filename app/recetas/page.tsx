'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Plus, 
  ArrowLeft, 
  ExternalLink 
} from 'lucide-react';
import { CatalogItem } from '@/components/inputs/InsumoSmartSearchInput';
import RecetaPlatoRow, { RecetaPlatoItem } from '@/components/recetas/RecetaPlatoRow';
import NewPlatoModal from '@/components/recetas/NewPlatoModal';

// Catálogo Global de Insumos Disponibles para Escandallos
const CATALOGO_INSUMOS_BASE: CatalogItem[] = [
  // Carnes y Proteínas
  { id: 'cat-1', nombre: 'CHICHARRÓN PORCIONADO (400g)', categoria: 'Carnes', precioUnitario: 18000, unidadMedida: 'Kg', gramaje: 400 },
  { id: 'cat-2', nombre: 'LENGUA DE RES (200g)', categoria: 'Carnes', precioUnitario: 42000, unidadMedida: 'Kg', gramaje: 200 },
  { id: 'cat-3', nombre: 'SOBREBARRIGA DELGADA (400g)', categoria: 'Carnes', precioUnitario: 34500, unidadMedida: 'Kg', gramaje: 400 },
  { id: 'cat-4', nombre: 'CHURRASCO DE RES (400g)', categoria: 'Carnes', precioUnitario: 45000, unidadMedida: 'Kg', gramaje: 400 },
  { id: 'cat-5', nombre: 'PUNTA DE ANCA (400g)', categoria: 'Carnes', precioUnitario: 48000, unidadMedida: 'Kg', gramaje: 400 },
  { id: 'cat-6', nombre: 'BABY BEEF (350g)', categoria: 'Carnes', precioUnitario: 46000, unidadMedida: 'Kg', gramaje: 350 },
  { id: 'cat-7', nombre: 'COSTILLA SAN LUIS (500g)', categoria: 'Carnes', precioUnitario: 22900, unidadMedida: 'Kg', gramaje: 500 },
  { id: 'cat-8', nombre: 'COSTILLA AHUMADA (400g)', categoria: 'Carnes', precioUnitario: 24500, unidadMedida: 'Kg', gramaje: 400 },
  { id: 'cat-9', nombre: 'PECHUGA DE POLLO (350g)', categoria: 'Carnes', precioUnitario: 21000, unidadMedida: 'Kg', gramaje: 350 },
  { id: 'cat-10', nombre: 'GALLINA CRIOLLA (400g)', categoria: 'Carnes', precioUnitario: 19500, unidadMedida: 'Kg', gramaje: 400 },
  { id: 'cat-11', nombre: 'TILAPIA ROJA (440g)', categoria: 'Carnes', precioUnitario: 21590, unidadMedida: 'Kg', gramaje: 440 },
  { id: 'cat-12', nombre: 'TRUCHA ARCOÍRIS (400g)', categoria: 'Carnes', precioUnitario: 26000, unidadMedida: 'Kg', gramaje: 400 },
  { id: 'cat-13', nombre: 'SALMÓN CHILENO (300g)', categoria: 'Carnes', precioUnitario: 65000, unidadMedida: 'Kg', gramaje: 300 },
  { id: 'cat-14', nombre: 'MIX DE MARISCOS (250g)', categoria: 'Carnes', precioUnitario: 38000, unidadMedida: 'Kg', gramaje: 250 },
  { id: 'cat-15', nombre: 'CAMARÓN TIGRE (200g)', categoria: 'Carnes', precioUnitario: 48000, unidadMedida: 'Kg', gramaje: 200 },
  { id: 'cat-16', nombre: 'CARNE MOLIDA DE RES', categoria: 'Carnes', precioUnitario: 22000, unidadMedida: 'Kg', gramaje: 200 },
  { id: 'cat-17', nombre: 'CHORIZO SANTARROSANO', categoria: 'Carnes', precioUnitario: 2500, unidadMedida: 'Und' },
  { id: 'cat-18', nombre: 'RELLENA / MORCILLA', categoria: 'Carnes', precioUnitario: 2200, unidadMedida: 'Und' },

  // Verduras y Acompañamientos
  { id: 'cat-19', nombre: 'PAPAS A LA FRANCESA (150g)', categoria: 'Verduras', precioUnitario: 7000, unidadMedida: 'Kg', gramaje: 150 },
  { id: 'cat-20', nombre: 'PAPA CRIOLLA (200g)', categoria: 'Verduras', precioUnitario: 5500, unidadMedida: 'Kg', gramaje: 200 },
  { id: 'cat-21', nombre: 'YUCA COCIDA / FRITA (150g)', categoria: 'Verduras', precioUnitario: 4500, unidadMedida: 'Kg', gramaje: 150 },
  { id: 'cat-22', nombre: 'PLÁTANO MADURO', categoria: 'Verduras', precioUnitario: 1200, unidadMedida: 'Und' },
  { id: 'cat-23', nombre: 'AGUACATE HASS', categoria: 'Verduras', precioUnitario: 2000, unidadMedida: 'Und' },
  { id: 'cat-24', nombre: 'MIX DE ENSALADA FRESCA (120g)', categoria: 'Verduras', precioUnitario: 6000, unidadMedida: 'Kg', gramaje: 120 },
  { id: 'cat-25', nombre: 'HOGAO CRIOLLO (60g)', categoria: 'Verduras', precioUnitario: 8000, unidadMedida: 'Kg', gramaje: 60 },

  // Granos y Abarrotes
  { id: 'cat-26', nombre: 'ARROZ BLANCO COCIDO (180g)', categoria: 'Granos', precioUnitario: 3500, unidadMedida: 'Kg', gramaje: 180 },
  { id: 'cat-27', nombre: 'FRÍJOL CARGAMANTO COCIDO (250g)', categoria: 'Granos', precioUnitario: 5000, unidadMedida: 'Kg', gramaje: 250 },
  { id: 'cat-28', nombre: 'HUEVOS AA', categoria: 'Granos', precioUnitario: 600, unidadMedida: 'Und' },
  { id: 'cat-29', nombre: 'AREPA DE MAÍZ TELA', categoria: 'Granos', precioUnitario: 300, unidadMedida: 'Und' },
  { id: 'cat-30', nombre: 'QUESO CAMPESINO (80g)', categoria: 'Lácteos', precioUnitario: 18000, unidadMedida: 'Kg', gramaje: 80 },

  // Desechables
  { id: 'cat-31', nombre: 'CONTENEDOR TÉRMICO 3 COMP', categoria: 'Desechables', precioUnitario: 650, unidadMedida: 'Und' },
  { id: 'cat-32', nombre: 'VASO 9 OZ', categoria: 'Desechables', precioUnitario: 150, unidadMedida: 'Und' }
];

// Semilla Oficial de Recetas con Escandallos Completos
const INITIAL_RECETAS: RecetaPlatoItem[] = [
  {
    id: 'rec-1',
    codigoPos: '119',
    nombre: 'Paisa especial',
    categoria: 'Especialidades',
    precioVentaPos: 38000,
    ingredientes: [
      { id: 'ing-1-1', nombre: 'CHICHARRÓN PORCIONADO (400g)', categoria: 'Carnes', cantidad: 1, unidad: 'porc', costoUnitario: 7200, costoCalculado: 7200 },
      { id: 'ing-1-2', nombre: 'CARNE MOLIDA DE RES', categoria: 'Carnes', cantidad: 200, unidad: 'g', costoUnitario: 22000, costoCalculado: 4400 },
      { id: 'ing-1-3', nombre: 'HUEVOS AA', categoria: 'Abarrotes', cantidad: 1, unidad: 'und', costoUnitario: 600, costoCalculado: 600 },
      { id: 'ing-1-4', nombre: 'CHORIZO SANTARROSANO', categoria: 'Carnes', cantidad: 1, unidad: 'und', costoUnitario: 2500, costoCalculado: 2500 },
      { id: 'ing-1-5', nombre: 'FRÍJOL CARGAMANTO COCIDO (250g)', categoria: 'Granos', cantidad: 250, unidad: 'g', costoUnitario: 5000, costoCalculado: 1250 },
      { id: 'ing-1-6', nombre: 'ARROZ BLANCO COCIDO (180g)', categoria: 'Granos', cantidad: 180, unidad: 'g', costoUnitario: 3500, costoCalculado: 630 },
      { id: 'ing-1-7', nombre: 'PLÁTANO MADURO', categoria: 'Verduras', cantidad: 1, unidad: 'und', costoUnitario: 1200, costoCalculado: 1200 },
      { id: 'ing-1-8', nombre: 'AREPA DE MAÍZ TELA', categoria: 'Abarrotes', cantidad: 1, unidad: 'und', costoUnitario: 300, costoCalculado: 300 }
    ]
  },
  {
    id: 'rec-2',
    codigoPos: '118',
    nombre: 'Lengua domingo',
    categoria: 'Platos Fuertes',
    precioVentaPos: 34000,
    ingredientes: [
      { id: 'ing-2-1', nombre: 'LENGUA DE RES (200g)', categoria: 'Carnes', cantidad: 1, unidad: 'porc', costoUnitario: 8400, costoCalculado: 8400 },
      { id: 'ing-2-2', nombre: 'HOGAO CRIOLLO (60g)', categoria: 'Verduras', cantidad: 60, unidad: 'g', costoUnitario: 8000, costoCalculado: 480 },
      { id: 'ing-2-3', nombre: 'ARROZ BLANCO COCIDO (180g)', categoria: 'Granos', cantidad: 180, unidad: 'g', costoUnitario: 3500, costoCalculado: 630 },
      { id: 'ing-2-4', nombre: 'YUCA COCIDA / FRITA (150g)', categoria: 'Verduras', cantidad: 150, unidad: 'g', costoUnitario: 4500, costoCalculado: 675 },
      { id: 'ing-2-5', nombre: 'MIX DE ENSALADA FRESCA (120g)', categoria: 'Verduras', cantidad: 120, unidad: 'g', costoUnitario: 6000, costoCalculado: 720 }
    ]
  },
  {
    id: 'rec-3',
    codigoPos: '41',
    nombre: 'Churrasco con francesa',
    categoria: 'Platos Fuertes',
    precioVentaPos: 42000,
    ingredientes: [
      { id: 'ing-3-1', nombre: 'CHURRASCO DE RES (400g)', categoria: 'Carnes', cantidad: 1, unidad: 'porc', costoUnitario: 18000, costoCalculado: 18000 },
      { id: 'ing-3-2', nombre: 'PAPAS A LA FRANCESA (150g)', categoria: 'Verduras', cantidad: 150, unidad: 'g', costoUnitario: 7000, costoCalculado: 1050 },
      { id: 'ing-3-3', nombre: 'MIX DE ENSALADA FRESCA (120g)', categoria: 'Verduras', cantidad: 120, unidad: 'g', costoUnitario: 6000, costoCalculado: 720 }
    ]
  },
  {
    id: 'rec-4',
    codigoPos: '96',
    nombre: 'Tilapia frita grande',
    categoria: 'Pescados',
    precioVentaPos: 32000,
    ingredientes: [
      { id: 'ing-4-1', nombre: 'TILAPIA ROJA (440g)', categoria: 'Carnes', cantidad: 1, unidad: 'und', costoUnitario: 9500, costoCalculado: 9500 },
      { id: 'ing-4-2', nombre: 'ARROZ BLANCO COCIDO (180g)', categoria: 'Granos', cantidad: 180, unidad: 'g', costoUnitario: 3500, costoCalculado: 630 },
      { id: 'ing-4-3', nombre: 'PAPAS A LA FRANCESA (150g)', categoria: 'Verduras', cantidad: 150, unidad: 'g', costoUnitario: 7000, costoCalculado: 1050 },
      { id: 'ing-4-4', nombre: 'MIX DE ENSALADA FRESCA (120g)', categoria: 'Verduras', cantidad: 120, unidad: 'g', costoUnitario: 6000, costoCalculado: 720 }
    ]
  },
  {
    id: 'rec-5',
    codigoPos: '42',
    nombre: 'Costilla ahumada',
    categoria: 'Platos Fuertes',
    precioVentaPos: 35000,
    ingredientes: [
      { id: 'ing-5-1', nombre: 'COSTILLA AHUMADA (400g)', categoria: 'Carnes', cantidad: 1, unidad: 'porc', costoUnitario: 9800, costoCalculado: 9800 },
      { id: 'ing-5-2', nombre: 'PAPAS A LA FRANCESA (150g)', categoria: 'Verduras', cantidad: 150, unidad: 'g', costoUnitario: 7000, costoCalculado: 1050 },
      { id: 'ing-5-3', nombre: 'ARROZ BLANCO COCIDO (180g)', categoria: 'Granos', cantidad: 180, unidad: 'g', costoUnitario: 3500, costoCalculado: 630 }
    ]
  },
  {
    id: 'rec-6',
    codigoPos: '19',
    nombre: 'Pericos con arroz',
    categoria: 'Desayunos',
    precioVentaPos: 14000,
    ingredientes: [
      { id: 'ing-6-1', nombre: 'HUEVOS AA', categoria: 'Granos', cantidad: 2, unidad: 'und', costoUnitario: 600, costoCalculado: 1200 },
      { id: 'ing-6-2', nombre: 'ARROZ BLANCO COCIDO (180g)', categoria: 'Granos', cantidad: 180, unidad: 'g', costoUnitario: 3500, costoCalculado: 630 },
      { id: 'ing-6-3', nombre: 'AREPA DE MAÍZ TELA', categoria: 'Granos', cantidad: 1, unidad: 'und', costoUnitario: 300, costoCalculado: 300 },
      { id: 'ing-6-4', nombre: 'QUESO CAMPESINO (80g)', categoria: 'Lácteos', cantidad: 80, unidad: 'g', costoUnitario: 18000, costoCalculado: 1440 }
    ]
  }
];

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<RecetaPlatoItem[]>(INITIAL_RECETAS);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [isNewPlatoModalOpen, setIsNewPlatoModalOpen] = useState(false);

  // Categorías presentes en las recetas
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    recetas.forEach(r => {
      if (r.categoria) set.add(r.categoria);
    });
    return Array.from(set).sort();
  }, [recetas]);

  // Filtrado de recetas por texto y categoría
  const filteredRecetas = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    return recetas.filter(r => {
      const matchCat = selectedCategory === 'TODAS' || r.categoria.toLowerCase() === selectedCategory.toLowerCase();
      if (!matchCat) return false;
      if (!q) return true;

      const matchName = r.nombre.toLowerCase().includes(q);
      const matchCode = r.codigoPos.toLowerCase().includes(q);
      const matchIng = r.ingredientes.some(ing => ing.nombre.toLowerCase().includes(q));
      return matchName || matchCode || matchIng;
    });
  }, [recetas, searchFilter, selectedCategory]);

  // Añadir un insumo a la receta de un plato
  const handleAddInsumoToPlato = (platoId: string, item: CatalogItem, cantidad: number, unidad: string) => {
    const safeQty = Math.max(0.1, cantidad || 1);
    
    // Cálculo del costo según la unidad
    let calculatedCost = 0;
    if (unidad.toLowerCase() === 'kg' && item.unidadMedida.toLowerCase() === 'kg') {
      calculatedCost = safeQty * item.precioUnitario;
    } else if (unidad.toLowerCase() === 'g' && item.unidadMedida.toLowerCase() === 'kg') {
      calculatedCost = (safeQty / 1000) * item.precioUnitario;
    } else if (item.gramaje && unidad.toLowerCase() === 'porc') {
      calculatedCost = (item.gramaje / 1000) * item.precioUnitario * safeQty;
    } else {
      calculatedCost = safeQty * item.precioUnitario;
    }

    setRecetas(prev => prev.map(p => {
      if (p.id !== platoId) return p;

      // Si ya existe el ingrediente, actualizamos la cantidad
      const existingIdx = p.ingredientes.findIndex(i => i.nombre.toLowerCase() === item.nombre.toLowerCase());
      if (existingIdx >= 0) {
        const existing = p.ingredientes[existingIdx];
        const newTotalQty = Number((existing.cantidad + safeQty).toFixed(2));
        const updatedCost = Number((existing.costoCalculado + calculatedCost).toFixed(0));

        const nextIngredientes = [...p.ingredientes];
        nextIngredientes[existingIdx] = {
          ...existing,
          cantidad: newTotalQty,
          costoCalculado: updatedCost
        };
        return { ...p, ingredientes: nextIngredientes };
      }

      // Si no existe, lo agregamos como nuevo card de insumo
      return {
        ...p,
        ingredientes: [
          ...p.ingredientes,
          {
            id: `ing-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            nombre: item.nombre,
            categoria: item.categoria,
            cantidad: safeQty,
            unidad,
            costoUnitario: item.precioUnitario,
            costoCalculado: Math.round(calculatedCost)
          }
        ]
      };
    }));
  };

  // Modificar cantidad de un insumo en la receta
  const handleUpdateInsumoQty = (platoId: string, insumoId: string, newQty: number) => {
    setRecetas(prev => prev.map(p => {
      if (p.id !== platoId) return p;
      return {
        ...p,
        ingredientes: p.ingredientes.map(ing => {
          if (ing.id !== insumoId) return ing;
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
  };

  // Remover insumo de la receta
  const handleRemoveInsumo = (platoId: string, insumoId: string) => {
    setRecetas(prev => prev.map(p => {
      if (p.id !== platoId) return p;
      return {
        ...p,
        ingredientes: p.ingredientes.filter(ing => ing.id !== insumoId)
      };
    }));
  };

  // Eliminar un plato completo del catálogo
  const handleDeletePlato = (platoId: string) => {
    if (confirm('¿Eliminar este plato y su ficha técnica de recetas?')) {
      setRecetas(prev => prev.filter(p => p.id !== platoId));
    }
  };

  // Crear un nuevo plato
  const handleCreatePlato = (data: {
    codigoPos: string;
    nombre: string;
    categoria: string;
    precioVentaPos: number;
  }) => {
    const newDish: RecetaPlatoItem = {
      id: `rec-${Date.now()}`,
      codigoPos: data.codigoPos,
      nombre: data.nombre,
      categoria: data.categoria,
      precioVentaPos: data.precioVentaPos,
      ingredientes: []
    };

    setRecetas([newDish, ...recetas]);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-53px)] md:h-[calc(100vh-57px)] -m-4 -mb-20 md:-m-6 md:mb-0 bg-white overflow-hidden font-sans">
      
      {/* 1. SECCIÓN SUPERIOR STICKY: Subheader Estandarizado */}
      <div className="shrink-0 bg-white border-b border-slate-200 z-20 shadow-2xs">
        <div className="p-3 px-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Link
                href="/auditoria-cocina"
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a Auditoría Cocina</span>
              </Link>
            </div>
            <h1 className="text-base md:text-lg font-bold text-slate-900 mt-1">
              Fichas Técnicas & Escandallos de Platos POS
            </h1>
            <p className="text-xs text-slate-500">
              {recetas.length} recetas oficiales configuradas · Asignación de insumos y deducción automática
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            {/* Buscador de platos / insumos */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar plato, cód. POS o insumo..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-400 w-52 sm:w-64"
              />
            </div>

            {/* Botón para crear nuevo plato */}
            <button
              type="button"
              onClick={() => setIsNewPlatoModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Plato POS</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros por Categoría */}
        <div className="px-4 md:px-6 py-2 bg-slate-50/70 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('TODAS')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === 'TODAS'
                ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todas ({recetas.length})
          </button>

          {availableCategories.map(cat => {
            const count = recetas.filter(r => r.categoria === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. ÁREA PRINCIPAL CON SCROLL EXCLUSIVO: Filas de Platos estilo Auditoría Cocina */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">
        <div className="p-4 md:p-6 pb-24 md:pb-12 w-full max-w-[1700px] mx-auto space-y-4">
          {filteredRecetas.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
              No se encontraron platos que coincidan con los filtros aplicados.
            </div>
          ) : null}

          {filteredRecetas.map(plato => (
            <RecetaPlatoRow
              key={plato.id}
              plato={plato}
              catalogInsumos={CATALOGO_INSUMOS_BASE}
              onAddInsumo={handleAddInsumoToPlato}
              onUpdateInsumoQty={handleUpdateInsumoQty}
              onRemoveInsumo={handleRemoveInsumo}
              onDeletePlato={handleDeletePlato}
            />
          ))}
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
