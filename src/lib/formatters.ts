export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('es-CO');
}

export function formatKg(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
  return amount.toFixed(2);
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

export function getTipoMedidaBadge(tipo?: string): { label: string; badgeColor: string; unitLabel: string } {
  switch (tipo) {
    case 'UNIDADES':
      return { label: 'Solo Unidades', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200', unitLabel: 'Und' };
    case 'PAQUETES':
      return { label: 'Paquetes', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200', unitLabel: 'Paq' };
    case 'KGS':
      return { label: 'Solo Kilos', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200', unitLabel: 'Kg' };
    case 'KGS_Y_UNIDADES':
    default:
      return { label: 'Kgs y Und (Porcionado)', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200', unitLabel: 'Kg / Und' };
  }
}

export function formatStockMedida(
  tipoMedida: string | undefined, 
  data: {
    bodegaSinPorcKg?: number;
    bodegaPorcUnd?: number;
    bodegaPorcKg?: number;
    cocinaSinPorcKg?: number;
    cocinaPorcUnd?: number;
    cocinaPorcKg?: number;
  }
): string {
  const bUnd = data.bodegaPorcUnd || 0;
  const bSinKg = data.bodegaSinPorcKg || 0;
  const bPorcKg = data.bodegaPorcKg || 0;

  if (tipoMedida === 'UNIDADES') {
    return `${bUnd} und`;
  }
  if (tipoMedida === 'PAQUETES') {
    return `${bUnd} paquetes`;
  }
  if (tipoMedida === 'KGS') {
    return `${bSinKg.toFixed(2)} Kg`;
  }
  // KGS_Y_UNIDADES
  return `${bUnd} und (${bPorcKg.toFixed(2)} Kg) / Entero: ${bSinKg.toFixed(2)} Kg`;
}

