export type GiroNegocio = 'RESTAURANTE' | 'COMERCIO_RETAIL' | 'HIBRIDO';
export type ModeloBascula = 'TORREY_MFQ' | 'RHINO_BAR' | 'CAS_PDII' | 'KRETZ' | 'GENERICA';
export type ModeloCajon = 'EPSON_STD' | 'STAR_TSP' | 'CITIZEN' | 'POSLINE';
export type RolTerminal = 'PRINCIPAL' | 'SECUNDARIA';

export interface ElianaPosConfig {
  // 1. Identidad del Comercio (configurable para cualquier negocio, cero texto quemado)
  nombreComercial: string;
  subtituloComercial: string;
  nit: string;
  direccion: string;
  telefono: string;
  mensajePieTicket: string;

  // 2. Giro de Negocio y Módulos Activos
  giro: GiroNegocio;
  habilitaMesas: boolean;
  habilitaDomicilios: boolean;
  habilitaComandasCocina: boolean;
  habilitaPropinas: boolean;
  porcentajePropinaSugerida: number;
  habilitaPesajeAutomatico: boolean;
  nombreImpuesto: string;
  porcentajeImpuesto: number;
  zonasMesas: string[];

  // 3. Red Local Multi-Caja (LAN) y Servidor Cloud
  rolTerminal: RolTerminal;
  nombreCaja: string;
  ipCajaPrincipal: string;
  urlServidorNube: string;

  // 4. Periféricos del Equipo
  modeloBascula: ModeloBascula;
  puertoBascula: string;
  modeloCajon: ModeloCajon;
  ipImpresora: string;
  anchoTicketMm: 80 | 58;
}

export const POS_CONFIG_STORAGE_KEY = 'eliana_pos_terminal_config_v1';

export const DEFAULT_ELIANA_POS_CONFIG: ElianaPosConfig = {
  nombreComercial: 'Eliana POS',
  subtituloComercial: 'Punto de Venta',
  nit: '',
  direccion: '',
  telefono: '',
  mensajePieTicket: '¡Gracias por su compra!',

  giro: 'RESTAURANTE',
  habilitaMesas: true,
  habilitaDomicilios: true,
  habilitaComandasCocina: true,
  habilitaPropinas: true,
  porcentajePropinaSugerida: 10,
  habilitaPesajeAutomatico: false,
  nombreImpuesto: 'Impoconsumo',
  porcentajeImpuesto: 8,
  zonasMesas: ['Salón Principal', 'Terraza', 'Kiosco / Parrilla'],

  rolTerminal: 'PRINCIPAL',
  nombreCaja: 'Caja 1',
  ipCajaPrincipal: '127.0.0.1:4545',
  urlServidorNube: '',

  modeloBascula: 'TORREY_MFQ',
  puertoBascula: 'COM3',
  modeloCajon: 'EPSON_STD',
  ipImpresora: '127.0.0.1:9100',
  anchoTicketMm: 80,
};

export function getPresetForGiro(giro: GiroNegocio): Partial<ElianaPosConfig> {
  if (giro === 'COMERCIO_RETAIL') {
    return {
      giro: 'COMERCIO_RETAIL',
      habilitaMesas: false,
      habilitaDomicilios: false,
      habilitaComandasCocina: false,
      habilitaPropinas: false,
      porcentajePropinaSugerida: 0,
      habilitaPesajeAutomatico: true,
      nombreImpuesto: 'IVA',
      porcentajeImpuesto: 19,
    };
  }
  if (giro === 'HIBRIDO') {
    return {
      giro: 'HIBRIDO',
      habilitaMesas: true,
      habilitaDomicilios: true,
      habilitaComandasCocina: false,
      habilitaPropinas: false,
      porcentajePropinaSugerida: 0,
      habilitaPesajeAutomatico: true,
      nombreImpuesto: 'IVA',
      porcentajeImpuesto: 19,
    };
  }
  return {
    giro: 'RESTAURANTE',
    habilitaMesas: true,
    habilitaDomicilios: true,
    habilitaComandasCocina: true,
    habilitaPropinas: true,
    porcentajePropinaSugerida: 10,
    habilitaPesajeAutomatico: false,
    nombreImpuesto: 'Impoconsumo',
    porcentajeImpuesto: 8,
  };
}

export function loadElianaPosConfig(): ElianaPosConfig {
  if (typeof window === 'undefined') return DEFAULT_ELIANA_POS_CONFIG;
  try {
    const raw = localStorage.getItem(POS_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_ELIANA_POS_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ElianaPosConfig>;
    return {
      ...DEFAULT_ELIANA_POS_CONFIG,
      ...parsed,
      zonasMesas:
        Array.isArray(parsed.zonasMesas) && parsed.zonasMesas.length > 0
          ? parsed.zonasMesas
          : DEFAULT_ELIANA_POS_CONFIG.zonasMesas,
    };
  } catch {
    return DEFAULT_ELIANA_POS_CONFIG;
  }
}

export function saveElianaPosConfig(config: ElianaPosConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POS_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage quota errors
  }
}
