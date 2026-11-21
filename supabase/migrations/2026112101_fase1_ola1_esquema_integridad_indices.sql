-- OLA 1: Esquema PostgreSQL, Secuencias, Integridad e Índices
-- Idempotente y seguro para producción

-- 1. Secuencia lock-free para consecutivos de pos_ordenes
CREATE SEQUENCE IF NOT EXISTS public.pos_ordenes_consecutivo_seq START WITH 1000 INCREMENT BY 1;

-- 2. Aislamiento por caja y turno (caja_id, sesion_caja_id) y congelamiento de impuestos en pos_orden_items
ALTER TABLE public.pos_ordenes
  ADD COLUMN IF NOT EXISTS caja_id UUID REFERENCES public.pos_cajas(id) ON DELETE SET NULL;

ALTER TABLE public.pos_orden_pagos
  ADD COLUMN IF NOT EXISTS sesion_caja_id UUID REFERENCES public.libro_caja_sesiones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS caja_id UUID REFERENCES public.pos_cajas(id) ON DELETE SET NULL;

ALTER TABLE public.libro_caja_registros
  ADD COLUMN IF NOT EXISTS caja_id UUID REFERENCES public.pos_cajas(id) ON DELETE SET NULL;

ALTER TABLE public.libro_caja_sesiones
  ADD COLUMN IF NOT EXISTS caja_id UUID REFERENCES public.pos_cajas(id) ON DELETE SET NULL;

ALTER TABLE public.pos_creditos_movimientos
  ADD COLUMN IF NOT EXISTS sesion_caja_id UUID REFERENCES public.libro_caja_sesiones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS caja_id UUID REFERENCES public.pos_cajas(id) ON DELETE SET NULL;

ALTER TABLE public.pos_devoluciones
  ADD COLUMN IF NOT EXISTS sesion_caja_id UUID REFERENCES public.libro_caja_sesiones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS caja_id UUID REFERENCES public.pos_cajas(id) ON DELETE SET NULL;

ALTER TABLE public.pos_auditoria_eventos
  ADD COLUMN IF NOT EXISTS sesion_caja_id UUID REFERENCES public.libro_caja_sesiones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS caja_id UUID REFERENCES public.pos_cajas(id) ON DELETE SET NULL;

ALTER TABLE public.pos_orden_items
  ADD COLUMN IF NOT EXISTS tarifa_impuesto NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impuesto_valor NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- 3. Backfill seguro de caja_id desde pos_cajas
UPDATE public.pos_ordenes o
SET caja_id = c.id
FROM public.pos_cajas c
WHERE o.caja_id IS NULL AND LOWER(TRIM(o.caja_nombre)) = LOWER(TRIM(c.nombre));

UPDATE public.libro_caja_sesiones s
SET caja_id = c.id
FROM public.pos_cajas c
WHERE s.caja_id IS NULL AND LOWER(TRIM(s.caja_nombre)) = LOWER(TRIM(c.nombre));

-- 4. Limpieza preventiva y FK pos_mesas.orden_activa_id -> pos_ordenes(id)
UPDATE public.pos_mesas m
SET orden_activa_id = NULL
WHERE m.orden_activa_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.pos_ordenes o WHERE o.id = m.orden_activa_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pos_mesas_orden_activa_id_fkey'
  ) THEN
    ALTER TABLE public.pos_mesas
      ADD CONSTRAINT pos_mesas_orden_activa_id_fkey
      FOREIGN KEY (orden_activa_id) REFERENCES public.pos_ordenes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. CHECK monto_aplicado > 0 en pos_orden_pagos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pos_orden_pagos_monto_positivo_check'
  ) THEN
    ALTER TABLE public.pos_orden_pagos
      ADD CONSTRAINT pos_orden_pagos_monto_positivo_check
      CHECK (monto_aplicado > 0);
  END IF;
END $$;

-- 6. Ampliar pos_ordenes_estado_check para soportar 'DEVUELTA'
ALTER TABLE public.pos_ordenes DROP CONSTRAINT IF EXISTS pos_ordenes_estado_check;
ALTER TABLE public.pos_ordenes
  ADD CONSTRAINT pos_ordenes_estado_check
  CHECK ((estado::text = ANY (ARRAY['ABIERTA'::text, 'PRECUENTA'::text, 'FACTURADA'::text, 'ANULADA'::text, 'DEVUELTA'::text])));

-- 7. Índices compuestos para concurrencia y consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_pos_ordenes_fecha_caja_estado
  ON public.pos_ordenes (fecha, caja_nombre, estado);

CREATE INDEX IF NOT EXISTS idx_pos_ordenes_sesion_caja_id
  ON public.pos_ordenes (sesion_caja_id);

CREATE INDEX IF NOT EXISTS idx_pos_orden_items_producto_id
  ON public.pos_orden_items (producto_id);

CREATE INDEX IF NOT EXISTS idx_pos_orden_items_orden_estado
  ON public.pos_orden_items (orden_id, estado_comanda);

CREATE INDEX IF NOT EXISTS idx_pos_inv_mov_prod_created
  ON public.pos_inventario_movimientos (producto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_creditos_created
  ON public.pos_creditos_movimientos (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_creditos_sesion
  ON public.pos_creditos_movimientos (sesion_caja_id);

CREATE INDEX IF NOT EXISTS idx_pos_devoluciones_fecha_caja
  ON public.pos_devoluciones (fecha, caja_nombre);

CREATE INDEX IF NOT EXISTS idx_pos_devoluciones_item_id
  ON public.pos_devoluciones (item_id);

CREATE INDEX IF NOT EXISTS idx_pos_devoluciones_sesion
  ON public.pos_devoluciones (sesion_caja_id);

CREATE INDEX IF NOT EXISTS idx_pos_orden_pagos_fecha_caja
  ON public.pos_orden_pagos (fecha, caja_nombre);

CREATE INDEX IF NOT EXISTS idx_pos_orden_pagos_sesion
  ON public.pos_orden_pagos (sesion_caja_id);

CREATE INDEX IF NOT EXISTS idx_pos_auditoria_sesion
  ON public.pos_auditoria_eventos (sesion_caja_id);
