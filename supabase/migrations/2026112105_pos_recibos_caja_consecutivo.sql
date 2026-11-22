-- 1. Secuencia lock-free para consecutivos únicos de Recibos de Caja (RC-00001...)
CREATE SEQUENCE IF NOT EXISTS public.seq_pos_recibo_caja START 1 INCREMENT 1;

-- 2. Columnas opcionales de detalle en libro_caja_registros para insumos/unidades/cantidad
ALTER TABLE public.libro_caja_registros
  ADD COLUMN IF NOT EXISTS insumo_id uuid NULL,
  ADD COLUMN IF NOT EXISTS cantidad numeric NULL,
  ADD COLUMN IF NOT EXISTS unidad_medida text NULL,
  ADD COLUMN IF NOT EXISTS costo_unitario numeric NULL;

-- 3. Índice único parcial para garantizar que ningún Recibo de Caja RC-* se duplique
CREATE UNIQUE INDEX IF NOT EXISTS uq_libro_caja_recibo_consecutivo
  ON public.libro_caja_registros (soporte_factura)
  WHERE soporte_factura IS NOT NULL AND soporte_factura LIKE 'RC-%';

-- 4. RPC atómica para obtener el siguiente consecutivo único formateado
CREATE OR REPLACE FUNCTION public.rpc_siguiente_recibo_caja()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next bigint;
BEGIN
  v_next := nextval('public.seq_pos_recibo_caja');
  RETURN 'RC-' || lpad(v_next::text, 5, '0');
END;
$$;
