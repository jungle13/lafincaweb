export type PosTab = 'VENTAS' | 'MESAS' | 'DOMICILIOS' | 'CORTE';

export interface PosOrdenItem {
  id: string;
  orden_id: string;
  producto_id: string | null;
  codigo_producto: string;
  nombre_producto: string;
  categoria: string;
  estacion_comanda: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  subtotal: number;
  notas_comanda: string | null;
  estado_comanda: 'PENDIENTE' | 'COMANDADO' | 'ENTREGADO' | 'ANULADO';
}

export interface PosOrden {
  id: string;
  consecutivo: string;
  fecha: string;
  caja_nombre: string;
  cajero_nombre: string;
  mesero_nombre: string | null;
  canal_venta: 'SALON_MESA' | 'DOMICILIO' | 'MOSTRADOR_LLEVAR';
  mesa_numero: number | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  domiciliario_nombre: string | null;
  costo_domicilio: number;
  estado_domicilio: string | null;
  subtotal_bruto: number;
  descuento: number;
  propina: number;
  gran_total: number;
  metodo_pago: string;
  pago_efectivo: number;
  pago_datafono: number;
  pago_transferencia: number;
  pago_credito?: number;
  comision_tarjeta?: number;
  estado: 'ABIERTA' | 'PRECUENTA' | 'FACTURADA' | 'ANULADA';
  precuenta_impresa_veces: number;
  items: PosOrdenItem[];
}

export interface PosMesa {
  id: string;
  numero: number;
  nombre: string;
  zona: string;
  capacidad: number;
  estado: 'LIBRE' | 'OCUPADA' | 'PRECUENTA_IMPRESA';
  orden_activa_id: string | null;
  mesero_actual: string | null;
  abierta_at: string | null;
  orden_activa?: PosOrden | null;
}

export interface ProductoVenta {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  subcategoria?: string;
  precio_total: number;
  precio_neto: number;
}

export interface SesionCaja {
  id: string;
  caja_nombre: string;
  cajero_nombre: string;
  numero_turno: number;
  base_inicial?: number;
  efectivo_inicial?: number;
  estado: string;
}

export interface EventoTurno {
  id: string;
  tipo_alerta: string;
  nivel_riesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  caja_nombre: string;
  usuario_cajero: string;
  orden_consecutivo: string | null;
  mesa_numero: number | null;
  valor_afectado: number;
  descripcion: string;
  created_at: string;
}

export interface CreditoMovimiento {
  id: string;
  fecha: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  tipo: 'CARGO_CREDITO' | 'ABONO' | 'REVERSO_ABONO';
  orden_consecutivo: string | null;
  monto: number;
  metodo_pago: string;
  observaciones: string | null;
  created_at: string;
}

export interface ClienteCreditoResumen {
  cliente_nombre: string;
  cliente_telefono: string;
  total_cargos: number;
  total_abonos: number;
  saldo: number;
  movimientos: CreditoMovimiento[];
}

export interface DevolucionDia {
  id: string;
  fecha: string;
  orden_id: string;
  orden_consecutivo: string;
  nombre_producto: string;
  cantidad_devuelta: number;
  valor_devuelto: number;
  metodo_reembolso: string;
  motivo: string | null;
  created_at: string;
}

export interface CorteDepartamento {
  categoria: string;
  cantidad: number;
  total: number;
  porcentaje: number;
}

export interface FlujoEfectivoRow {
  hora: string;
  movimiento: string;
  monto: number;
  efectivo_en_caja: number;
}

export interface CierreResumen {
  tipoCierre: string;
  baseInicial: number;
  ventasEfectivo: number;
  ventasDatafono: number;
  ventasTransf: number;
  totalAbonosEfectivo?: number;
  totalEntradasEfectivo?: number;
  totalDevolucionesEfectivo?: number;
  totalVendidoPos: number;
  totalSalidasCaja: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferenciaEfectivo: number;
}
