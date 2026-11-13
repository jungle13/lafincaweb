export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('es-CO');
}

export function normalizeStr(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export type TipoMedida = 'KGS' | 'UNIDADES' | 'KGS_Y_UNIDADES' | 'PAQUETES';


