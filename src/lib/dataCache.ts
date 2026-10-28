/**
 * Memoria caché del cliente ultra rápida (Stale-While-Revalidate en RAM).
 * Permite que al alternar de módulo en el Sidebar la interfaz renderice en 0 ms
 * mientras valida en segundo plano si los datos siguen frescos.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Obtiene un dato de la memoria caché si existe y no ha expirado.
 * @param key Clave única del recurso (ej: 'productos-venta', 'recetas', 'catalogo', 'compras-per-2026-10')
 * @param maxAgeMs Tiempo máximo de validez en ms (por defecto 10 minutos)
 */
export function getCachedData<T>(key: string, maxAgeMs: number = 10 * 60 * 1000): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    return null;
  }
  return entry.data as T;
}

/**
 * Almacena datos en memoria caché con timestamp actual.
 */
export function setCachedData<T>(key: string, data: T): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Invalida una o varias entradas de la caché cuando se crea, edita o elimina un registro.
 * @param keyPrefix Prefijo a invalidar (o vacío para limpiar todo).
 */
export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    return;
  }
  for (const k of Array.from(memoryCache.keys())) {
    if (k.startsWith(keyPrefix)) {
      memoryCache.delete(k);
    }
  }
}
