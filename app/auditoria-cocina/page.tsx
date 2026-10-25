'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Search, 
  FileSpreadsheet,
  Plus, 
  BookOpen, 
  ArrowLeft
} from 'lucide-react';
import { PlatoReceta, getPlatoDeductions } from '@/lib/recetasData';
import SheetTabsBar from '@/components/sheets/SheetTabsBar';
import MonthSidebar, { MonthItem } from '@/components/sheets/MonthSidebar';
import NewSheetDateModal from '@/components/sheets/NewSheetDateModal';
import AuditoriaInsumoRow, { InsumoAuditItem } from '@/components/auditoria/AuditoriaInsumoRow';
import AddInsumoModal from '@/components/auditoria/AddInsumoModal';

// Modelos de Datos para la Vista de Auditoría
export interface AuditoriaDiaSheet {
  id: string;
  month: string;
  dateStr: string;
  title: string;
  posSalesTotal: number;
  items: InsumoAuditItem[];
}

// Datos semilla oficiales basados en el informe del 22 de Octubre de 2026
const INITIAL_AUDITORIA_SHEETS: AuditoriaDiaSheet[] = [
  {
    id: 'audit-2026-10-23',
    month: '2026-10',
    dateStr: '2026-10-23',
    title: 'Viernes, 23 de Octubre de 2026',
    posSalesTotal: 4250000,
    items: [
      {
        id: 'p-23-1',
        insumo: 'CHICHARRÓN PORCIONADO (400g)',
        categoria: 'Cerdo',
        pesoPorcionGramos: 400,
        unidadMedida: 'porc',
        costoUnitarioKg: 18000,
        totalDisponiblePorciones: 17,
        amanecePorciones: 2,
        bajadasPorciones: 15,
        platos: [
          { id: 'd-23-1', codigoPos: '119', nombrePlato: 'Paisa especial', cantidad: 6, porcionesDeducidas: 6, kgDeducidos: 1.2 },
          { id: 'd-23-2', codigoPos: '94', nombrePlato: 'Frijolada tradicional', cantidad: 4, porcionesDeducidas: 4, kgDeducidos: 0.8 }
        ]
      },
      {
        id: 'p-23-2',
        insumo: 'COSTILLA AHUMADA (400g)',
        categoria: 'Cerdo',
        pesoPorcionGramos: 400,
        unidadMedida: 'porc',
        costoUnitarioKg: 24500,
        totalDisponiblePorciones: 13,
        amanecePorciones: 1,
        bajadasPorciones: 12,
        platos: [
          { id: 'd-23-3', codigoPos: '42', nombrePlato: 'Costilla ahumada', cantidad: 10, porcionesDeducidas: 10, kgDeducidos: 4.0 }
        ]
      },
      {
        id: 'p-23-3',
        insumo: 'HUEVOS AA (55g)',
        categoria: 'Abarrotes',
        pesoPorcionGramos: 55,
        unidadMedida: 'und',
        costoUnitarioKg: 10000,
        totalDisponiblePorciones: 110,
        amanecePorciones: 20,
        bajadasPorciones: 90,
        platos: [
          { id: 'd-23-4', codigoPos: '19', nombrePlato: 'Pericos con arroz', cantidad: 8, porcionesDeducidas: 16, kgDeducidos: 0.88 },
          { id: 'd-23-5', codigoPos: '119', nombrePlato: 'Paisa especial', cantidad: 6, porcionesDeducidas: 6, kgDeducidos: 0.33 }
        ]
      }
    ]
  },
  {
    id: 'audit-2026-10-22',
    month: '2026-10',
    dateStr: '2026-10-22',
    title: 'Jueves, 22 de Octubre de 2026',
    posSalesTotal: 4821500,
    items: [
      {
        id: 'p-22-1',
        insumo: 'LENGUA DE RES (200g)',
        categoria: 'Carnes Rojas',
        pesoPorcionGramos: 200,
        unidadMedida: 'porc',
        costoUnitarioKg: 42000,
        totalDisponiblePorciones: 50,
        amanecePorciones: 0,
        bajadasPorciones: 50,
        platos: [
          { id: 'd-22-1', codigoPos: '118', nombrePlato: 'Lengua domingo', cantidad: 3, porcionesDeducidas: 3, kgDeducidos: 0.6 }
        ]
      },
      {
        id: 'p-22-2',
        insumo: 'CHICHARRÓN PORCIONADO (400g)',
        categoria: 'Cerdo',
        pesoPorcionGramos: 400,
        unidadMedida: 'porc',
        costoUnitarioKg: 18000,
        totalDisponiblePorciones: 4,
        amanecePorciones: 0,
        bajadasPorciones: 4,
        platos: [
          { id: 'd-22-2', codigoPos: '104', nombrePlato: 'Bandeja sola', cantidad: 10, porcionesDeducidas: 10, kgDeducidos: 2.0 },
          { id: 'd-22-3', codigoPos: '233', nombrePlato: 'Frijolada ejecutiva', cantidad: 8, porcionesDeducidas: 8, kgDeducidos: 1.6 },
          { id: 'd-22-4', codigoPos: '119', nombrePlato: 'Paisa especial', cantidad: 8, porcionesDeducidas: 8, kgDeducidos: 1.6 },
          { id: 'd-22-5', codigoPos: '112', nombrePlato: 'Mega chicharrón', cantidad: 4, porcionesDeducidas: 4, kgDeducidos: 1.6 },
          { id: 'd-22-6', codigoPos: '111', nombrePlato: 'Entrada chicharrón', cantidad: 2, porcionesDeducidas: 2, kgDeducidos: 0.8 }
        ]
      },
      {
        id: 'p-22-3',
        insumo: 'TILAPIA ROJA (440g)',
        categoria: 'Pescados',
        pesoPorcionGramos: 440,
        unidadMedida: 'und',
        costoUnitarioKg: 21590,
        totalDisponiblePorciones: 3,
        amanecePorciones: 0,
        bajadasPorciones: 3,
        platos: [
          { id: 'd-22-7', codigoPos: '29', nombrePlato: 'Chuleta pescado', cantidad: 21, porcionesDeducidas: 21, kgDeducidos: 9.24 },
          { id: 'd-22-8', codigoPos: '96', nombrePlato: 'Tilapia frita grande', cantidad: 8, porcionesDeducidas: 8, kgDeducidos: 3.52 },
          { id: 'd-22-9', codigoPos: '239', nombrePlato: 'Mojarra frita ejecutiva', cantidad: 3, porcionesDeducidas: 3, kgDeducidos: 1.32 }
        ]
      },
      {
        id: 'p-22-4',
        insumo: 'HUEVOS AA (55g)',
        categoria: 'Abarrotes',
        pesoPorcionGramos: 55,
        unidadMedida: 'und',
        costoUnitarioKg: 10000,
        totalDisponiblePorciones: 150,
        amanecePorciones: 0,
        bajadasPorciones: 150,
        platos: [
          { id: 'd-22-10', codigoPos: '19', nombrePlato: 'Pericos con arroz', cantidad: 4, porcionesDeducidas: 8, kgDeducidos: 0.44 },
          { id: 'd-22-11', codigoPos: '20', nombrePlato: 'Huevos al gusto', cantidad: 5, porcionesDeducidas: 10, kgDeducidos: 0.55 },
          { id: 'd-22-12', codigoPos: '119', nombrePlato: 'Paisa especial', cantidad: 8, porcionesDeducidas: 8, kgDeducidos: 0.44 },
          { id: 'd-22-13', codigoPos: '31', nombrePlato: 'Huevo adicional', cantidad: 8, porcionesDeducidas: 8, kgDeducidos: 0.44 }
        ]
      },
      {
        id: 'p-22-5',
        insumo: 'PAPAS A LA FRANCESA (150g)',
        categoria: 'Acompañamiento',
        pesoPorcionGramos: 150,
        unidadMedida: 'porc',
        costoUnitarioKg: 12000,
        totalDisponiblePorciones: 33,
        amanecePorciones: 0,
        bajadasPorciones: 33,
        platos: [
          { id: 'd-22-14', codigoPos: '41', nombrePlato: 'Churrasco con francesa', cantidad: 18, porcionesDeducidas: 18, kgDeducidos: 2.7 },
          { id: 'd-22-15', codigoPos: '30', nombrePlato: 'Porción francesa adicional', cantidad: 14, porcionesDeducidas: 14, kgDeducidos: 2.1 },
          { id: 'd-22-16', codigoPos: '50', nombrePlato: 'Punta de anca con francesa', cantidad: 15, porcionesDeducidas: 15, kgDeducidos: 2.25 }
        ]
      },
      {
        id: 'p-22-6',
        insumo: 'COSTILLA AHUMADA (400g)',
        categoria: 'Cerdo',
        pesoPorcionGramos: 400,
        unidadMedida: 'porc',
        costoUnitarioKg: 24500,
        totalDisponiblePorciones: 12,
        amanecePorciones: 2,
        bajadasPorciones: 10,
        platos: [
          { id: 'd-22-17', codigoPos: '42', nombrePlato: 'Costilla ahumada', cantidad: 9, porcionesDeducidas: 9, kgDeducidos: 3.6 }
        ]
      }
    ]
  },
  {
    id: 'audit-2026-10-21',
    month: '2026-10',
    dateStr: '2026-10-21',
    title: 'Miércoles, 21 de Octubre de 2026',
    posSalesTotal: 3980000,
    items: [
      {
        id: 'p-21-1',
        insumo: 'COSTILLA SAN LUIS (500g)',
        categoria: 'Cerdo',
        pesoPorcionGramos: 500,
        unidadMedida: 'porc',
        costoUnitarioKg: 22900,
        totalDisponiblePorciones: 17,
        amanecePorciones: 3,
        bajadasPorciones: 14,
        platos: [
          { id: 'd-21-1', codigoPos: '44', nombrePlato: 'Costilla c san luis', cantidad: 15, porcionesDeducidas: 15, kgDeducidos: 7.5 }
        ]
      }
    ]
  },
  {
    id: 'audit-2026-10-20',
    month: '2026-10',
    dateStr: '2026-10-20',
    title: 'Martes, 20 de Octubre de 2026',
    posSalesTotal: 3750000,
    items: []
  }
];

export default function AuditoriaCocinaPage() {
  const [sheets, setSheets] = useState<AuditoriaDiaSheet[]>(INITIAL_AUDITORIA_SHEETS);
  const [activeTabId, setActiveTabId] = useState<string | null>('audit-2026-10-22');
  const [openTabs, setOpenTabs] = useState<string[]>(['audit-2026-10-22']);
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [searchFilter, setSearchFilter] = useState('');
  const [rowSearchFilter, setRowSearchFilter] = useState('');

  // Modales
  const [isNewSheetModalOpen, setIsNewSheetModalOpen] = useState(false);
  const [isAddInsumoModalOpen, setIsAddInsumoModalOpen] = useState(false);

  // Hoja activa actualmente
  const activeSheet = useMemo(() => {
    return sheets.find(s => s.id === activeTabId);
  }, [sheets, activeTabId]);

  // Lista de meses
  const availableMonths: MonthItem[] = useMemo(() => {
    const map = new Map<string, number>();
    sheets.forEach(s => {
      map.set(s.month, (map.get(s.month) || 0) + 1);
    });
    return Array.from(map.entries()).map(([month, count]) => ({
      key: month,
      label: month === '2026-10' ? 'Octubre 2026' : (month === '2026-09' ? 'Septiembre 2026' : month),
      count
    }));
  }, [sheets]);

  // Hojas filtradas para la lista principal
  const filteredSheets = useMemo(() => {
    return sheets.filter(s => {
      const matchMonth = s.month === selectedMonth;
      if (!matchMonth) return false;
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      const matchTitle = s.title.toLowerCase().includes(q) || s.dateStr.includes(q);
      const matchItems = s.items.some(it => it.insumo.toLowerCase().includes(q));
      return matchTitle || matchItems;
    });
  }, [sheets, selectedMonth, searchFilter]);

  // Items filtrados por búsqueda dentro de la hoja activa
  const filteredActiveItems = useMemo(() => {
    if (!activeSheet) return [];
    if (!rowSearchFilter.trim()) return activeSheet.items;
    const q = rowSearchFilter.toLowerCase();
    return activeSheet.items.filter(it => {
      const matchInsumo = it.insumo.toLowerCase().includes(q);
      const matchPlato = it.platos.some(p => p.nombrePlato.toLowerCase().includes(q) || p.codigoPos.includes(q));
      return matchInsumo || matchPlato;
    });
  }, [activeSheet, rowSearchFilter]);

  // Manejo de pestañas
  const handleOpenSheet = (id: string) => {
    if (!openTabs.includes(id)) {
      setOpenTabs([...openTabs, id]);
    }
    setActiveTabId(id);
    setRowSearchFilter('');
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const remaining = openTabs.filter(t => t !== id);
    setOpenTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
  };

  // Crear nueva hoja
  const handleCreateSheet = (dateStr: string) => {
    const newId = `audit-${dateStr}`;
    const exists = sheets.find(s => s.dateStr === dateStr);
    if (exists) {
      handleOpenSheet(exists.id);
      return;
    }

    const monthKey = dateStr.startsWith('2026-09') ? '2026-09' : '2026-10';
    const parts = dateStr.split('-');
    const titleDate = `${parts[2]} de ${parts[1] === '10' ? 'Octubre' : 'Septiembre'} de ${parts[0]}`;

    const newSheet: AuditoriaDiaSheet = {
      id: newId,
      month: monthKey,
      dateStr,
      title: titleDate,
      posSalesTotal: 0,
      items: []
    };

    setSheets([newSheet, ...sheets]);
    setOpenTabs([...openTabs, newId]);
    setActiveTabId(newId);
  };

  // Agregar plato a un insumo mediante el buscador inteligente
  const handleAddDish = (proteinaId: string, platoReceta: PlatoReceta, qty: number) => {
    if (!activeSheet) return;
    const safeQty = Math.max(1, qty || 1);

    const deductions = getPlatoDeductions(platoReceta.codigoPos, safeQty);
    const mainDeduction = deductions[0] || {
      porciones: platoReceta.porcionesCount * safeQty,
      gramos: platoReceta.gramajeCrudoG * safeQty,
      kilos: (platoReceta.gramajeCrudoG * safeQty) / 1000,
      costo: platoReceta.costoInsumo * safeQty
    };

    const updatedItems = activeSheet.items.map(p => {
      if (p.id !== proteinaId) return p;
      const existingIdx = p.platos.findIndex(d => d.codigoPos === platoReceta.codigoPos);
      if (existingIdx >= 0) {
        const existing = p.platos[existingIdx];
        const newTotalQty = existing.cantidad + safeQty;
        const reDeductions = getPlatoDeductions(platoReceta.codigoPos, newTotalQty);
        const reMain = reDeductions[0];

        const updatedDish = {
          ...existing,
          cantidad: newTotalQty,
          porcionesDeducidas: reMain.porciones,
          kgDeducidos: reMain.kilos
        };
        const nextPlatos = [...p.platos];
        nextPlatos[existingIdx] = updatedDish;
        return { ...p, platos: nextPlatos };
      }

      return {
        ...p,
        platos: [
          ...p.platos,
          {
            id: `dish-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            codigoPos: platoReceta.codigoPos,
            nombrePlato: platoReceta.nombre,
            cantidad: safeQty,
            porcionesDeducidas: mainDeduction.porciones,
            kgDeducidos: mainDeduction.kilos
          }
        ]
      };
    });

    setSheets(sheets.map(s => s.id === activeSheet.id ? { ...s, items: updatedItems } : s));
  };

  // Quitar plato
  const handleRemoveDish = (proteinaId: string, dishId: string) => {
    if (!activeSheet) return;
    const updatedItems = activeSheet.items.map(p => {
      if (p.id !== proteinaId) return p;
      return {
        ...p,
        platos: p.platos.filter(d => d.id !== dishId)
      };
    });
    setSheets(sheets.map(s => s.id === activeSheet.id ? { ...s, items: updatedItems } : s));
  };

  // Agregar nuevo insumo a la auditoría del día
  const handleAddInsumo = (data: {
    nombre: string;
    pesoPorcionGramos: number;
    unidadMedida: string;
    costoUnitarioKg: number;
    totalDisponible: number;
  }) => {
    if (!activeSheet) return;

    const newProt: InsumoAuditItem = {
      id: `p-${Date.now()}`,
      insumo: data.nombre,
      categoria: 'Carnes',
      pesoPorcionGramos: data.pesoPorcionGramos,
      unidadMedida: data.unidadMedida,
      costoUnitarioKg: data.costoUnitarioKg,
      totalDisponiblePorciones: data.totalDisponible,
      platos: []
    };

    const updatedItems = [...activeSheet.items, newProt];
    setSheets(sheets.map(s => s.id === activeSheet.id ? { ...s, items: updatedItems } : s));
  };

  // Eliminar fila de insumo
  const handleDeleteRow = (proteinaId: string) => {
    if (!activeSheet) return;
    if (confirm('¿Eliminar este insumo de la auditoría de hoy?')) {
      const updatedItems = activeSheet.items.filter(p => p.id !== proteinaId);
      setSheets(sheets.map(s => s.id === activeSheet.id ? { ...s, items: updatedItems } : s));
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-53px)] md:h-[calc(100vh-57px)] -m-4 -mb-20 md:-m-6 md:mb-0 bg-white overflow-hidden font-sans">
      
      {/* 1. SECCIÓN SUPERIOR STICKY: Barra de Pestañas + Subheader modular */}
      <div className="shrink-0 bg-white border-b border-slate-200 z-20 shadow-2xs">
        <SheetTabsBar
          mainTabLabel="Vistas de Auditoría"
          activeTabId={activeTabId}
          openTabs={openTabs}
          sheets={sheets}
          onSelectMainTab={() => setActiveTabId(null)}
          onSelectTab={setActiveTabId}
          onCloseTab={handleCloseTab}
          onNewSheetClick={() => setIsNewSheetModalOpen(true)}
          rightAction={
            <Link
              href="/recetas"
              className="text-xs text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:border-slate-300 transition-colors flex items-center gap-1.5 font-medium shadow-2xs shrink-0"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Fichas Técnicas / Recetas</span>
            </Link>
          }
        />

        {/* Subheader cuando una hoja está abierta */}
        {activeSheet && (
          <div className="bg-white p-3 px-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTabId(null)}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a Hojas de Auditoría</span>
                </button>
              </div>
              <h1 className="text-base md:text-lg font-bold text-slate-900 mt-1">
                {activeSheet.title}
              </h1>
              <p className="text-xs text-slate-500">
                Fecha: <span className="font-medium text-slate-700">{activeSheet.dateStr}</span> · {activeSheet.items.length} insumos monitoreados
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={rowSearchFilter}
                  onChange={(e) => setRowSearchFilter(e.target.value)}
                  placeholder="Filtrar insumo o plato..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:border-slate-400 w-48 sm:w-56"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddInsumoModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-all shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Insumo</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. ÁREA PRINCIPAL CON SCROLL INDEPENDIENTE */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">
        {activeTabId === null || !activeSheet ? (
          
          /* VISTA 1: LISTADO MASTER DE HOJAS CON SIDEBAR */
          <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-white">
            <MonthSidebar
              months={availableMonths}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
            />

            <div className="flex-1 p-4 md:p-8 max-w-5xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Hojas de Auditoría</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Listado de hojas de auditoría de insumos frente a platos vendidos en POS ordenadas desde la más reciente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewSheetModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs px-3.5 py-2 rounded-md font-medium shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Hoja de Auditoría</span>
                </button>
              </div>

              {/* Buscador de hojas */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar por fecha o insumo..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:border-slate-500 transition-all placeholder:text-slate-400"
                />
              </div>

              <p className="text-[11px] text-slate-400 mb-3 font-medium">
                {filteredSheets.length} {filteredSheets.length === 1 ? 'hoja registrada' : 'hojas registradas'}
              </p>

              {/* Listado de Tarjetas */}
              <div className="space-y-2">
                {filteredSheets.map(sh => {
                  let descuadresCount = 0;
                  sh.items.forEach(it => {
                    const disp = it.totalDisponiblePorciones !== undefined ? it.totalDisponiblePorciones : ((it.amanecePorciones || 0) + (it.bajadasPorciones || 0));
                    const used = it.platos.reduce((acc, d) => acc + d.porcionesDeducidas, 0);
                    if (disp - used < 0) descuadresCount++;
                  });

                  const isOpen = openTabs.includes(sh.id);

                  return (
                    <div
                      key={sh.id}
                      onClick={() => handleOpenSheet(sh.id)}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 rounded-lg cursor-pointer transition-all gap-2"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-md bg-slate-100 text-slate-600 group-hover:text-slate-900 transition-colors mt-0.5 sm:mt-0">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                              {sh.title} - Hoja Auditoría Cocina
                            </h3>
                            {isOpen && (
                              <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                Abierta en pestaña
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{sh.items.length} proteínas auditadas</span>
                            <span>•</span>
                            <span className="font-medium text-slate-700">
                              Venta POS: ${sh.posSalesTotal.toLocaleString('es-CO')}
                            </span>
                            {descuadresCount > 0 ? (
                              <>
                                <span>•</span>
                                <span className="text-rose-600 font-semibold">
                                  ⚠️ {descuadresCount} descuadre(s) por legalizar
                                </span>
                              </>
                            ) : (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">✓ Cuadrado</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSheet(sh.id);
                          }}
                          className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          
          /* VISTA 2: FILAS MODULARES DE AUDITORÍA */
          <div className="p-4 md:p-6 pb-24 md:pb-12 w-full max-w-[1700px] mx-auto space-y-4">
            {filteredActiveItems.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
                No se encontraron insumos con el filtro aplicado.
              </div>
            ) : null}

            {filteredActiveItems.map(item => (
              <AuditoriaInsumoRow
                key={item.id}
                item={item}
                onAddDish={handleAddDish}
                onRemoveDish={handleRemoveDish}
                onDeleteRow={handleDeleteRow}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modales Modulares */}
      <NewSheetDateModal
        isOpen={isNewSheetModalOpen}
        onClose={() => setIsNewSheetModalOpen(false)}
        onCreate={handleCreateSheet}
        title="Nueva Hoja de Auditoría Diaria"
      />

      <AddInsumoModal
        isOpen={isAddInsumoModalOpen}
        onClose={() => setIsAddInsumoModalOpen(false)}
        onAdd={handleAddInsumo}
      />
    </div>
  );
}
