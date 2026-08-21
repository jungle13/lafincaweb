export interface InsumoItem {
  insumo_id: number;
  codigo?: string;
  insumo: string;
  categoria: string;
  unidad_medida?: string;
  es_carne?: boolean;
  peso_porc_gramos?: number;
  bodega_sin_porc_kg: number;
  bodega_porc_und: number;
  bodega_porc_kg: number;
  peso_total_bodega_kg: number;
  cocina_porc_und: number;
  cocina_porc_kg: number;
  costo_unitario_kg: number;
  valor_total_general_pesos: number;
  merma_acumulada_kg: number;
  merma_acumulada_pesos: number;
  estado_stock: 'OPTIMO' | 'BAJO' | 'AGOTADO';
}

export interface MovimientoItem {
  id?: number;
  tipo_movimiento: 'ENTRADA_COMPRA' | 'PORCIONADO' | 'TRASLADO_COCINA' | 'DEVOLUCION_COCINA';
  insumo_id: number;
  insumo_nombre?: string;
  catalogo_insumos?: {
    nombre: string;
    categoria: string;
  };
  fecha_hora?: string;
  fecha_movimiento?: string;
  usuario?: string;
  origen?: string;
  proveedor?: string;
  numero_factura?: string;
  cant_sin_porcionar_kg?: number;
  porciones_und?: number;
  peso_porciones_kg?: number;
  merma_kg?: number;
  merma_pesos?: number;
  valor_total_movimiento?: number;
  bodega_sin_porc_anterior_kg?: number;
  bodega_sin_porc_nuevo_kg?: number;
  bodega_porc_anterior_und?: number;
  bodega_porc_nuevo_und?: number;
  cocina_porc_anterior_und?: number;
  cocina_porc_nuevo_und?: number;
  observaciones?: string;
}
