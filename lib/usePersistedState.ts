'use client';

import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';

const STORAGE_PREFIX = 'lafinca_ui_';

export function readPersistedValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function hasPersistedValue(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`) !== null;
  } catch {
    return false;
  }
}

/**
 * Reemplazo seguro para useState que persiste el estado en sessionStorage
 * sin provocar errores de hidratación SSR en Next.js.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initialValue);
  const hydratedRef = useRef(false);

  // Restaurar desde sessionStorage al montar en cliente
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw !== null) {
        setState(JSON.parse(raw) as T);
      }
    } catch {
      // Ignorar errores de parseo
    } finally {
      hydratedRef.current = true;
    }
  }, [key]);

  // Persistir cambios subsecuentes
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(state));
    } catch {
      // Ignorar errores de cuota
    }
  }, [key, state]);

  const setPersistedState: Dispatch<SetStateAction<T>> = useCallback((value) => {
    setState((prev) => {
      const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  }, [key]);

  return [state, setPersistedState];
}
