'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Periodo {
  id: string;
  codigo: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'ABIERTO' | 'EN_CONCILIACION' | 'CERRADO';
  inicial_registrado: boolean;
  inventario_inicial: Record<string, any>;
  conteo_cierre_fisico?: Record<string, any>;
  fecha_cierre?: string;
  usuario_cierre?: string;
  observaciones_cierre?: string;
}

interface PeriodoContextType {
  periodos: Periodo[];
  selectedPeriodoId: string;
  currentPeriodo: Periodo | null;
  loading: boolean;
  setSelectedPeriodoId: (id: string) => void;
  refreshPeriodos: () => Promise<void>;
}

const PeriodoContext = createContext<PeriodoContextType | undefined>(undefined);

export function PeriodoProvider({ children }: { children: ReactNode }) {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [selectedPeriodoId, setSelectedPeriodoIdState] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const refreshPeriodos = async () => {
    try {
      const res = await fetch(`/api/periodos?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.periodos)) {
        setPeriodos(data.periodos);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('la_finca_periodo_id') : null;
        const exists = data.periodos.find((p: Periodo) => p.id === stored || p.codigo === stored);
        
        if (exists) {
          setSelectedPeriodoIdState(exists.id);
        } else if (data.activo) {
          setSelectedPeriodoIdState(data.activo.id);
        } else if (data.periodos.length > 0) {
          setSelectedPeriodoIdState(data.periodos[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching periodos in context:', e);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedPeriodoId = (id: string) => {
    setSelectedPeriodoIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('la_finca_periodo_id', id);
    }
  };

  useEffect(() => {
    refreshPeriodos();
  }, []);

  const currentPeriodo = periodos.find((p) => p.id === selectedPeriodoId || p.codigo === selectedPeriodoId) || periodos[0] || null;

  return (
    <PeriodoContext.Provider
      value={{
        periodos,
        selectedPeriodoId,
        currentPeriodo,
        loading,
        setSelectedPeriodoId,
        refreshPeriodos,
      }}
    >
      {children}
    </PeriodoContext.Provider>
  );
}

export function usePeriodo() {
  const context = useContext(PeriodoContext);
  if (!context) {
    throw new Error('usePeriodo debe ser utilizado dentro de un PeriodoProvider');
  }
  return context;
}
