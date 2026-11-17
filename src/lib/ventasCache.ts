export const cachedVentasByPeriodo = new Map<string, { data: unknown; expiry: number }>();

export function invalidateVentasCache() {
  cachedVentasByPeriodo.clear();
}
