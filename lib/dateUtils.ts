const COLOMBIA_TZ = 'America/Bogota';

/**
 * Devuelve la fecha actual (o de un Date dado) en formato YYYY-MM-DD
 * usando siempre la zona horaria oficial de Colombia (America/Bogota, UTC-5),
 * evitando el desfase a partir de las 7:00 p. m. que produce toISOString() en UTC.
 */
export function getColombiaDateStr(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

/**
 * Formatea una fecha/hora ISO a hora local de Colombia (ej: "7:00:34 p. m.").
 */
export function formatColombiaTime(input?: string | Date | null): string {
  if (!input) return '';
  const dt = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TZ,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(dt);
}
