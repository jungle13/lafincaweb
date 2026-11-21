-- OLA 1A (FASE 2): Inmutabilidad de Auditoría, Idempotencia y Validación de Precios/Estados

-- 1. Bitácora pos_auditoria_eventos 100% inmutable (bloquea UPDATE y DELETE)
CREATE OR REPLACE FUNCTION public.fn_bloquear_modificacion_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría POS es inmutable y no puede modificarse ni eliminarse.';
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_auditoria_inmutable ON public.pos_auditoria_eventos;
CREATE TRIGGER trg_pos_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON public.pos_auditoria_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bloquear_modificacion_auditoria();

-- Ampliar tipos de alerta permitidos
ALTER TABLE public.pos_auditoria_eventos DROP CONSTRAINT IF EXISTS pos_auditoria_eventos_tipo_alerta_check;
ALTER TABLE public.pos_auditoria_eventos
  ADD CONSTRAINT pos_auditoria_eventos_tipo_alerta_check
  CHECK (
    tipo_alerta::text = ANY (ARRAY[
      'ITEM_BORRADO_POST_COMANDA'::text,
      'ITEM_BORRADO_POST_PRECUENTA'::text,
      'ORDEN_ANULADA'::text,
      'ANULACION_ORDEN_COMPLETA'::text,
      'DESCUENTO_MANUAL'::text,
      'REIMPRESION_EXCESIVA_PRECUENTA'::text,
      'APERTURA_CAJON_SIN_VENTA'::text,
      'DESCUADRE_ARQUEO_CIEGO'::text,
      'ENTRADA_EFECTIVO_CAJA'::text,
      'CONSUMO_INTERNO_REGISTRADO'::text,
      'CAMBIO_PRECIO_MANUAL'::text,
      'AUTORIZACION_SUPERVISOR'::text
    ])
  );

-- 2. Idempotency keys únicas en pagos parciales y movimientos de caja
ALTER TABLE public.pos_orden_pagos
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_orden_pagos_idem
  ON public.pos_orden_pagos (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.libro_caja_registros
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_libro_caja_reg_idem
  ON public.libro_caja_registros (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3. Endurecer rpc_abrir_o_agregar_orden:
--    a) Bloqueo FOR UPDATE sobre orden existente para impedir agregar ítems a una orden ya facturada/cerrada
--    b) Validación de precio_unitario contra productos_venta cuando no viene autorizado_por
CREATE OR REPLACE FUNCTION public.rpc_abrir_o_agregar_orden(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orden_id UUID := NULLIF(p_payload->>'orden_id', '')::UUID;
  v_fecha DATE := COALESCE(NULLIF(p_payload->>'fecha', '')::DATE, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
  v_periodo_id TEXT := COALESCE(NULLIF(p_payload->>'periodo_id', ''), 'per-' || to_char(v_fecha, 'YYYY-MM'));
  v_caja_nombre TEXT := COALESCE(NULLIF(p_payload->>'caja_nombre', ''), 'CAJA PRINCIPAL');
  v_caja_id UUID := NULLIF(p_payload->>'caja_id', '')::UUID;
  v_sesion_id UUID := NULLIF(p_payload->>'sesion_caja_id', '')::UUID;
  v_cajero TEXT := COALESCE(NULLIF(p_payload->>'cajero_nombre', ''), 'Cajero');
  v_mesero TEXT := NULLIF(p_payload->>'mesero_nombre', '');
  v_canal TEXT := COALESCE(NULLIF(p_payload->>'canal_venta', ''), 'SALON_MESA');
  v_mesa_num INT := NULLIF(p_payload->>'mesa_numero', '')::INT;
  v_cliente_nombre TEXT := NULLIF(p_payload->>'cliente_nombre', '');
  v_cliente_tel TEXT := NULLIF(p_payload->>'cliente_telefono', '');
  v_cliente_dir TEXT := NULLIF(p_payload->>'cliente_direccion', '');
  v_dom_nombre TEXT := NULLIF(p_payload->>'domiciliario_nombre', '');
  v_costo_dom NUMERIC := COALESCE((p_payload->>'costo_domicilio')::NUMERIC, 0);
  v_obs TEXT := NULLIF(p_payload->>'observaciones', '');
  v_autorizado_por TEXT := NULLIF(p_payload->>'autorizado_por', '');
  v_consecutivo TEXT;
  v_mesa_row RECORD;
  v_ord_row RECORD;
  v_subtotal NUMERIC := 0;
  v_impuesto NUMERIC := 0;
  v_orden_json JSONB;
  v_items_json JSONB;
BEGIN
  IF v_caja_id IS NULL THEN
    SELECT id INTO v_caja_id FROM public.pos_cajas WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(v_caja_nombre)) LIMIT 1;
  END IF;

  IF v_sesion_id IS NULL THEN
    SELECT id INTO v_sesion_id
    FROM public.libro_caja_sesiones
    WHERE fecha = v_fecha AND LOWER(TRIM(caja_nombre)) = LOWER(TRIM(v_caja_nombre)) AND estado = 'ABIERTA'
    ORDER BY hora_apertura DESC LIMIT 1;
  END IF;

  IF v_orden_id IS NULL THEN
    IF v_canal = 'SALON_MESA' AND v_mesa_num IS NOT NULL THEN
      SELECT * INTO v_mesa_row FROM public.pos_mesas WHERE numero = v_mesa_num FOR UPDATE;
      IF FOUND AND v_mesa_row.estado <> 'LIBRE' AND v_mesa_row.orden_activa_id IS NOT NULL THEN
        v_orden_id := v_mesa_row.orden_activa_id;
      END IF;
    END IF;
  END IF;

  IF v_orden_id IS NOT NULL THEN
    SELECT * INTO v_ord_row FROM public.pos_ordenes WHERE id = v_orden_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Orden no encontrada: %', v_orden_id;
    END IF;
    IF v_ord_row.estado NOT IN ('ABIERTA', 'PRECUENTA') THEN
      RAISE EXCEPTION 'La orden % ya fue cerrada (estado: %). Recarga el estado de mesas.', v_ord_row.consecutivo, v_ord_row.estado;
    END IF;
  ELSE
    v_consecutivo := 'POS-' || to_char(v_fecha, 'YYMMDD') || '-' || lpad(nextval('public.pos_ordenes_consecutivo_seq')::TEXT, 5, '0');

    INSERT INTO public.pos_ordenes (
      consecutivo, fecha, periodo_id, caja_nombre, caja_id, sesion_caja_id,
      cajero_nombre, mesero_nombre, canal_venta, mesa_numero,
      cliente_nombre, cliente_telefono, cliente_direccion, domiciliario_nombre,
      costo_domicilio, estado_domicilio, observaciones, estado
    )
    VALUES (
      v_consecutivo, v_fecha, v_periodo_id, v_caja_nombre, v_caja_id, v_sesion_id,
      v_cajero, v_mesero, v_canal, CASE WHEN v_canal = 'SALON_MESA' THEN v_mesa_num ELSE NULL END,
      v_cliente_nombre, v_cliente_tel, v_cliente_dir, v_dom_nombre,
      v_costo_dom, CASE WHEN v_canal = 'DOMICILIO' THEN 'RECIBIDO' ELSE NULL END, v_obs, 'ABIERTA'
    )
    RETURNING id INTO v_orden_id;

    IF v_canal = 'SALON_MESA' AND v_mesa_num IS NOT NULL THEN
      UPDATE public.pos_mesas
      SET estado = 'OCUPADA',
          orden_activa_id = v_orden_id,
          mesero_actual = COALESCE(v_mesero, v_cajero),
          caja_ocupante = v_caja_nombre,
          abierta_at = NOW(),
          precuenta_impresa_count = 0,
          updated_at = NOW()
      WHERE numero = v_mesa_num;
    END IF;
  END IF;

  -- Insertar ítems en bloque validando precio oficial contra productos_venta si no hay supervisor
  IF jsonb_typeof(p_payload->'items') = 'array' AND jsonb_array_length(p_payload->'items') > 0 THEN
    INSERT INTO public.pos_orden_items (
      orden_id, producto_id, codigo_producto, nombre_producto, categoria,
      estacion_comanda, cantidad, unidad, precio_unitario, subtotal,
      tarifa_impuesto, impuesto_valor, notas_comanda, estado_comanda
    )
    SELECT
      v_orden_id,
      NULLIF(x.producto_id, '')::UUID,
      COALESCE(NULLIF(x.codigo_producto, ''), '000'),
      COALESCE(NULLIF(x.nombre_producto, ''), 'Producto'),
      COALESCE(NULLIF(x.categoria, ''), 'PLATOS'),
      CASE
        WHEN UPPER(COALESCE(x.categoria, '') || ' ' || COALESCE(x.nombre_producto, '')) ~ '(GASEOSA|JUGO|CERVEZA|LIMONADA|AGUA|CAFE|BEBIDA|LICOR|TE|VINO)' THEN 'BEBIDAS_BAR'
        WHEN UPPER(COALESCE(x.categoria, '') || ' ' || COALESCE(x.nombre_producto, '')) ~ '(POSTRE|HELADO|TORTA|FLAN|ENTRADA|EMPANADA|PATACON)' THEN 'POSTRES_ENTRADAS'
        ELSE 'COCINA_PARRILLA'
      END,
      GREATEST(0.01, COALESCE(x.cantidad, 1)),
      COALESCE(NULLIF(x.unidad, ''), 'Und'),
      CASE
        WHEN pv.id IS NOT NULL AND v_autorizado_por IS NULL THEN
          CASE
            WHEN COALESCE(x.precio_unitario, 0) IN (pv.precio_total, COALESCE(pv.precio_mayoreo, pv.precio_total)) THEN COALESCE(x.precio_unitario, 0)
            ELSE pv.precio_total
          END
        ELSE GREATEST(0, COALESCE(x.precio_unitario, 0))
      END,
      ROUND(
        GREATEST(0.01, COALESCE(x.cantidad, 1)) *
        CASE
          WHEN pv.id IS NOT NULL AND v_autorizado_por IS NULL THEN
            CASE
              WHEN COALESCE(x.precio_unitario, 0) IN (pv.precio_total, COALESCE(pv.precio_mayoreo, pv.precio_total)) THEN COALESCE(x.precio_unitario, 0)
              ELSE pv.precio_total
            END
          ELSE GREATEST(0, COALESCE(x.precio_unitario, 0))
        END
      ),
      COALESCE(pv.tarifa_impoconsumo, 0) + COALESCE(pv.tarifa_iva, 0),
      CASE
        WHEN (COALESCE(pv.tarifa_impoconsumo, 0) + COALESCE(pv.tarifa_iva, 0)) > 0 THEN
          ROUND(
            GREATEST(0.01, COALESCE(x.cantidad, 1)) *
            CASE
              WHEN pv.id IS NOT NULL AND v_autorizado_por IS NULL THEN
                CASE
                  WHEN COALESCE(x.precio_unitario, 0) IN (pv.precio_total, COALESCE(pv.precio_mayoreo, pv.precio_total)) THEN COALESCE(x.precio_unitario, 0)
                  ELSE pv.precio_total
                END
              ELSE GREATEST(0, COALESCE(x.precio_unitario, 0))
            END
          ) - ROUND(
            ROUND(
              GREATEST(0.01, COALESCE(x.cantidad, 1)) *
              CASE
                WHEN pv.id IS NOT NULL AND v_autorizado_por IS NULL THEN
                  CASE
                    WHEN COALESCE(x.precio_unitario, 0) IN (pv.precio_total, COALESCE(pv.precio_mayoreo, pv.precio_total)) THEN COALESCE(x.precio_unitario, 0)
                    ELSE pv.precio_total
                  END
                ELSE GREATEST(0, COALESCE(x.precio_unitario, 0))
              END
            ) / (1 + (COALESCE(pv.tarifa_impoconsumo, 0) + COALESCE(pv.tarifa_iva, 0)) / 100.0)
          )
        ELSE 0
      END,
      NULLIF(x.notas_comanda, ''),
      'PENDIENTE'
    FROM jsonb_to_recordset(p_payload->'items') AS x(
      producto_id TEXT,
      codigo_producto TEXT,
      nombre_producto TEXT,
      categoria TEXT,
      cantidad NUMERIC,
      unidad TEXT,
      precio_unitario NUMERIC,
      notas_comanda TEXT
    )
    LEFT JOIN public.productos_venta pv ON pv.id = NULLIF(x.producto_id, '')::UUID;
  END IF;

  SELECT
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(impuesto_valor), 0)
  INTO v_subtotal, v_impuesto
  FROM public.pos_orden_items
  WHERE orden_id = v_orden_id AND estado_comanda <> 'ANULADO';

  UPDATE public.pos_ordenes
  SET subtotal_bruto = ROUND(v_subtotal),
      impoconsumo = ROUND(v_impuesto),
      gran_total = GREATEST(0, ROUND(v_subtotal - COALESCE(descuento, 0) + COALESCE(propina, 0) + COALESCE(costo_domicilio, 0))),
      updated_at = NOW()
  WHERE id = v_orden_id;

  SELECT to_jsonb(o.*) INTO v_orden_json FROM public.pos_ordenes o WHERE o.id = v_orden_id;
  SELECT COALESCE(jsonb_agg(i.* ORDER BY i.created_at), '[]'::JSONB) INTO v_items_json FROM public.pos_orden_items i WHERE i.orden_id = v_orden_id;

  RETURN jsonb_build_object('orden', v_orden_json, 'items', v_items_json);
END;
$$;
