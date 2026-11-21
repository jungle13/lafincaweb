-- OLA 2: Transacciones ACID en PostgreSQL (RPCs)

-- 1. RPC: Abrir o agregar ítems a una orden (lock-free sequence + bloqueo de mesa)
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
  v_consecutivo TEXT;
  v_mesa_row RECORD;
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

  IF v_orden_id IS NULL THEN
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

  -- Insertar ítems en bloque calculando tarifa real de productos_venta
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
      GREATEST(0, COALESCE(x.precio_unitario, 0)),
      ROUND(GREATEST(0.01, COALESCE(x.cantidad, 1)) * GREATEST(0, COALESCE(x.precio_unitario, 0))),
      COALESCE(pv.tarifa_impoconsumo, 0) + COALESCE(pv.tarifa_iva, 0),
      CASE
        WHEN (COALESCE(pv.tarifa_impoconsumo, 0) + COALESCE(pv.tarifa_iva, 0)) > 0 THEN
          ROUND(GREATEST(0.01, COALESCE(x.cantidad, 1)) * GREATEST(0, COALESCE(x.precio_unitario, 0)))
          - ROUND(ROUND(GREATEST(0.01, COALESCE(x.cantidad, 1)) * GREATEST(0, COALESCE(x.precio_unitario, 0))) / (1 + (COALESCE(pv.tarifa_impoconsumo, 0) + COALESCE(pv.tarifa_iva, 0)) / 100.0))
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

  -- Recalcular totales de la orden
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


-- 2. RPC: Facturar Orden (ACID + Idempotente + Descuento Atómico Stock + Impuestos Reales)
CREATE OR REPLACE FUNCTION public.rpc_facturar_orden(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orden_id UUID := (p_payload->>'orden_id')::UUID;
  v_fecha DATE := COALESCE(NULLIF(p_payload->>'fecha', '')::DATE, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
  v_periodo_id TEXT := COALESCE(NULLIF(p_payload->>'periodo_id', ''), 'per-' || to_char(v_fecha, 'YYYY-MM'));
  v_caja_nombre TEXT := COALESCE(NULLIF(p_payload->>'caja_nombre', ''), 'CAJA PRINCIPAL');
  v_caja_id UUID := NULLIF(p_payload->>'caja_id', '')::UUID;
  v_sesion_id UUID := NULLIF(p_payload->>'sesion_caja_id', '')::UUID;
  v_cajero TEXT := COALESCE(NULLIF(p_payload->>'cajero_nombre', ''), 'Cajero');
  v_metodo TEXT := COALESCE(NULLIF(p_payload->>'metodo_pago', ''), 'EFECTIVO');
  v_propina NUMERIC := GREATEST(0, COALESCE((p_payload->>'propina')::NUMERIC, 0));
  v_descuento NUMERIC := GREATEST(0, COALESCE((p_payload->>'descuento')::NUMERIC, 0));
  v_motivo_desc TEXT := NULLIF(p_payload->>'motivo_descuento', '');
  v_comision NUMERIC := GREATEST(0, COALESCE((p_payload->>'comision_tarjeta')::NUMERIC, 0));
  v_area_consumo TEXT := COALESCE(NULLIF(p_payload->>'area_consumo', ''), 'Personal / Interno');
  v_cliente_nombre TEXT;
  v_cliente_tel TEXT;
  v_ord RECORD;
  v_subtotal NUMERIC := 0;
  v_impuesto_total NUMERIC := 0;
  v_gran_total NUMERIC := 0;
  v_is_consumo BOOLEAN := (v_metodo = 'CONSUMO_INTERNO');
  v_p_ef NUMERIC := 0;
  v_p_dat NUMERIC := 0;
  v_p_trf NUMERIC := 0;
  v_p_cred NUMERIC := 0;
  v_ef_rec NUMERIC := 0;
  v_cambio NUMERIC := 0;
  v_venta_sin_prop NUMERIC := 0;
  v_venta_neta_real NUMERIC := 0;
  v_total_articulos NUMERIC := 0;
  v_total_distintos INT := 0;
  v_dia_semana TEXT;
  v_orden_json JSONB;
  v_items_json JSONB;
BEGIN
  -- Lock de la orden para evitar doble facturación simultánea
  SELECT * INTO v_ord FROM public.pos_ordenes WHERE id = v_orden_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada: %', v_orden_id;
  END IF;

  -- Guardia Idempotente
  IF v_ord.estado = 'FACTURADA' THEN
    SELECT to_jsonb(o.*) INTO v_orden_json FROM public.pos_ordenes o WHERE o.id = v_orden_id;
    SELECT COALESCE(jsonb_agg(i.* ORDER BY i.created_at), '[]'::JSONB) INTO v_items_json FROM public.pos_orden_items i WHERE i.orden_id = v_orden_id;
    RETURN jsonb_build_object('already_invoiced', true, 'orden', v_orden_json, 'items', v_items_json);
  END IF;

  IF v_caja_id IS NULL THEN
    SELECT id INTO v_caja_id FROM public.pos_cajas WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(v_caja_nombre)) LIMIT 1;
  END IF;
  IF v_sesion_id IS NULL THEN
    SELECT id INTO v_sesion_id
    FROM public.libro_caja_sesiones
    WHERE fecha = v_fecha AND LOWER(TRIM(caja_nombre)) = LOWER(TRIM(v_caja_nombre)) AND estado = 'ABIERTA'
    ORDER BY hora_apertura DESC LIMIT 1;
  END IF;

  -- Calcular subtotal e impuesto real desde ítems activos + productos_venta
  WITH item_calc AS (
    SELECT
      i.id,
      i.subtotal,
      COALESCE(NULLIF(i.tarifa_impuesto, 0), COALESCE(pv.tarifa_impoconsumo, 0) + COALESCE(pv.tarifa_iva, 0), 0) AS tarifa
    FROM public.pos_orden_items i
    LEFT JOIN public.productos_venta pv ON pv.id = i.producto_id
    WHERE i.orden_id = v_orden_id AND i.estado_comanda <> 'ANULADO'
  ),
  upd AS (
    UPDATE public.pos_orden_items i
    SET tarifa_impuesto = ic.tarifa,
        impuesto_valor = CASE
          WHEN ic.tarifa > 0 THEN ic.subtotal - ROUND(ic.subtotal / (1 + ic.tarifa / 100.0))
          ELSE 0
        END
    FROM item_calc ic
    WHERE i.id = ic.id
    RETURNING i.subtotal, i.impuesto_valor
  )
  SELECT COALESCE(SUM(subtotal), 0), COALESCE(SUM(impuesto_valor), 0), COUNT(*)
  INTO v_subtotal, v_impuesto_total, v_total_distintos
  FROM upd;

  IF v_total_distintos = 0 THEN
    RAISE EXCEPTION 'La orden no tiene artículos activos para facturar.';
  END IF;

  v_gran_total := GREATEST(0, ROUND(v_subtotal - v_descuento + CASE WHEN v_is_consumo THEN 0 ELSE v_propina END + COALESCE(v_ord.costo_domicilio, 0)));

  -- Desglose de pagos
  IF NOT v_is_consumo THEN
    IF jsonb_typeof(p_payload->'pagos_detalle') = 'array' AND jsonb_array_length(p_payload->'pagos_detalle') > 0 THEN
      SELECT
        COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN monto_aplicado ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN metodo_pago = 'DATAFONO' THEN monto_aplicado ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN metodo_pago = 'TRANSFERENCIA' THEN monto_aplicado ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN metodo_pago = 'CREDITO' THEN monto_aplicado ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN COALESCE(monto_recibido, monto_aplicado) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN COALESCE(cambio_devuelto, 0) ELSE 0 END), 0)
      INTO v_p_ef, v_p_dat, v_p_trf, v_p_cred, v_ef_rec, v_cambio
      FROM jsonb_to_recordset(p_payload->'pagos_detalle') AS p(
        metodo_pago TEXT,
        monto_aplicado NUMERIC,
        monto_recibido NUMERIC,
        cambio_devuelto NUMERIC
      );

      -- Preservar sesion_caja_id de abonos ya persistidos y asignar v_sesion_id a pagos nuevos
      WITH existing_sessions AS (
        SELECT id, sesion_caja_id, caja_id
        FROM public.pos_orden_pagos
        WHERE orden_id = v_orden_id
      )
      DELETE FROM public.pos_orden_pagos WHERE orden_id = v_orden_id;

      INSERT INTO public.pos_orden_pagos (
        orden_id, fecha, caja_nombre, caja_id, sesion_caja_id,
        numero_pago, metodo_pago, monto_aplicado, monto_recibido,
        cambio_devuelto, propina_monto, items_pagados, nota
      )
      SELECT
        v_orden_id,
        v_fecha,
        v_caja_nombre,
        v_caja_id,
        v_sesion_id,
        COALESCE(p.numero_pago, ROW_NUMBER() OVER ()),
        p.metodo_pago,
        GREATEST(1, COALESCE(p.monto_aplicado, 0)),
        COALESCE(p.monto_recibido, p.monto_aplicado, 0),
        COALESCE(p.cambio_devuelto, 0),
        COALESCE(p.propina_monto, 0),
        COALESCE(p.items_pagados, '[]'::JSONB),
        COALESCE(p.nota, '')
      FROM jsonb_to_recordset(p_payload->'pagos_detalle') AS p(
        numero_pago INT,
        metodo_pago TEXT,
        monto_aplicado NUMERIC,
        monto_recibido NUMERIC,
        cambio_devuelto NUMERIC,
        propina_monto NUMERIC,
        items_pagados JSONB,
        nota TEXT
      )
      WHERE COALESCE(p.monto_aplicado, 0) > 0;
    ELSE
      v_p_ef := COALESCE((p_payload->>'pago_efectivo')::NUMERIC, 0);
      v_p_dat := COALESCE((p_payload->>'pago_datafono')::NUMERIC, 0);
      v_p_trf := COALESCE((p_payload->>'pago_transferencia')::NUMERIC, 0);
      v_p_cred := COALESCE((p_payload->>'pago_credito')::NUMERIC, 0);
      IF v_metodo = 'EFECTIVO' AND v_p_ef = 0 THEN v_p_ef := v_gran_total; END IF;
      IF v_metodo = 'DATAFONO' AND v_p_dat = 0 THEN v_p_dat := v_gran_total; END IF;
      IF v_metodo IN ('TRANSFERENCIA', 'TRANSFERENCIA_NEQUI') AND v_p_trf = 0 THEN v_p_trf := v_gran_total; END IF;
      IF v_metodo = 'CREDITO' AND v_p_cred = 0 THEN v_p_cred := v_gran_total; END IF;
      v_ef_rec := COALESCE((p_payload->>'efectivo_recibido')::NUMERIC, v_gran_total);
      v_cambio := CASE WHEN v_metodo = 'EFECTIVO' AND v_ef_rec > v_gran_total THEN ROUND(v_ef_rec - v_gran_total) ELSE 0 END;

      IF v_gran_total > 0 THEN
        DELETE FROM public.pos_orden_pagos WHERE orden_id = v_orden_id;
        INSERT INTO public.pos_orden_pagos (
          orden_id, fecha, caja_nombre, caja_id, sesion_caja_id,
          numero_pago, metodo_pago, monto_aplicado, monto_recibido, cambio_devuelto, propina_monto, items_pagados, nota
        ) VALUES (
          v_orden_id, v_fecha, v_caja_nombre, v_caja_id, v_sesion_id,
          1, CASE WHEN v_metodo = 'TRANSFERENCIA_NEQUI' THEN 'TRANSFERENCIA' ELSE v_metodo END,
          v_gran_total, v_ef_rec, v_cambio, v_propina, '[]'::JSONB, ''
        );
      END IF;
    END IF;
  END IF;

  v_cliente_nombre := TRIM(COALESCE(NULLIF(p_payload->>'cliente_nombre', ''), v_ord.cliente_nombre, ''));
  v_cliente_tel := TRIM(COALESCE(NULLIF(p_payload->>'cliente_telefono', ''), v_ord.cliente_telefono, ''));

  IF (v_p_cred > 0 OR v_is_consumo) AND v_cliente_nombre = '' THEN
    RAISE EXCEPTION 'Debes indicar el nombre del cliente o beneficiario.';
  END IF;

  UPDATE public.pos_ordenes
  SET subtotal_bruto = ROUND(v_subtotal),
      descuento = v_descuento,
      motivo_descuento = v_motivo_desc,
      impoconsumo = ROUND(v_impuesto_total),
      propina = CASE WHEN v_is_consumo THEN 0 ELSE v_propina END,
      gran_total = v_gran_total,
      metodo_pago = v_metodo,
      pago_efectivo = v_p_ef,
      pago_datafono = v_p_dat,
      pago_transferencia = v_p_trf,
      pago_credito = v_p_cred,
      comision_tarjeta = v_comision,
      efectivo_recibido = v_ef_rec,
      cambio_entregado = v_cambio,
      cliente_nombre = COALESCE(NULLIF(v_cliente_nombre, ''), cliente_nombre),
      cliente_telefono = COALESCE(NULLIF(v_cliente_tel, ''), cliente_telefono),
      caja_id = COALESCE(caja_id, v_caja_id),
      sesion_caja_id = COALESCE(sesion_caja_id, v_sesion_id),
      estado = 'FACTURADA',
      estado_domicilio = CASE WHEN canal_venta = 'DOMICILIO' THEN 'ENTREGADO' ELSE estado_domicilio END,
      pagado_at = NOW(),
      closed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_orden_id;

  -- Cargo a crédito si aplica
  IF v_p_cred > 0 THEN
    INSERT INTO public.pos_creditos_movimientos (
      fecha, cliente_nombre, cliente_telefono, tipo, orden_id, orden_consecutivo,
      monto, metodo_pago, caja_nombre, caja_id, sesion_caja_id, cajero_nombre, observaciones
    ) VALUES (
      v_fecha, v_cliente_nombre, NULLIF(v_cliente_tel, ''), 'CARGO_CREDITO', v_orden_id, v_ord.consecutivo,
      v_p_cred, 'CREDITO', v_caja_nombre, v_caja_id, v_sesion_id, v_cajero,
      'Venta a crédito ' || v_ord.consecutivo
    );
  END IF;

  -- Liberar mesa si aplica
  IF v_ord.canal_venta = 'SALON_MESA' AND v_ord.mesa_numero IS NOT NULL THEN
    UPDATE public.pos_mesas
    SET estado = 'LIBRE',
        orden_activa_id = NULL,
        mesero_actual = NULL,
        caja_ocupante = NULL,
        abierta_at = NULL,
        precuenta_impresa_count = 0,
        updated_at = NOW()
    WHERE numero = v_ord.mesa_numero;
  END IF;

  -- Auditoría descuento manual
  IF v_descuento > 0 THEN
    INSERT INTO public.pos_auditoria_eventos (
      fecha, caja_nombre, caja_id, sesion_caja_id, usuario_cajero, tipo_alerta, nivel_riesgo,
      orden_consecutivo, mesa_numero, valor_afectado, descripcion
    ) VALUES (
      v_fecha, v_caja_nombre, v_caja_id, v_sesion_id, v_cajero, 'DESCUENTO_MANUAL',
      CASE WHEN v_descuento >= 30000 THEN 'ALTO' ELSE 'MEDIO' END,
      v_ord.consecutivo, v_ord.mesa_numero, v_descuento,
      'Descuento manual de $' || v_descuento || ' en ' || v_ord.consecutivo
    );
  END IF;

  -- Descuento atómico en bloque sobre productos_venta (SOLO donde controla_inventario = true)
  WITH qty_agg AS (
    SELECT producto_id, SUM(cantidad) AS total_cant
    FROM public.pos_orden_items
    WHERE orden_id = v_orden_id AND estado_comanda <> 'ANULADO' AND producto_id IS NOT NULL
    GROUP BY producto_id
  ),
  upd_stock AS (
    UPDATE public.productos_venta pv
    SET existencia = GREATEST(0, COALESCE(pv.existencia, 0) - qa.total_cant),
        updated_at = NOW()
    FROM qty_agg qa
    WHERE pv.id = qa.producto_id AND pv.controla_inventario = true
    RETURNING pv.id, pv.codigo, pv.nombre, qa.total_cant, (COALESCE(pv.existencia, 0) + qa.total_cant) AS ant, pv.existencia AS nueva
  )
  INSERT INTO public.pos_inventario_movimientos (
    fecha, producto_id, codigo_producto, nombre_producto, tipo,
    cantidad_delta, existencia_anterior, existencia_nueva, motivo, usuario
  )
  SELECT
    v_fecha, id, codigo, nombre, 'VENTA',
    -total_cant, ant, nueva,
    CASE WHEN v_is_consumo THEN 'Consumo Interno (' || v_cliente_nombre || ')' ELSE 'Venta ' || v_ord.consecutivo END,
    v_cajero
  FROM upd_stock;

  IF v_is_consumo THEN
    INSERT INTO public.pos_auditoria_eventos (
      fecha, caja_nombre, caja_id, sesion_caja_id, usuario_cajero, tipo_alerta, nivel_riesgo,
      orden_consecutivo, mesa_numero, valor_afectado, descripcion
    ) VALUES (
      v_fecha, v_caja_nombre, v_caja_id, v_sesion_id, v_cajero, 'CONSUMO_INTERNO_REGISTRADO', 'BAJO',
      v_ord.consecutivo, v_ord.mesa_numero, v_gran_total,
      'Consumo Interno valorizado en $' || v_gran_total || ' asignado a ' || v_cliente_nombre || ' (' || v_area_consumo || ').'
    );

    INSERT INTO public.registros_costeo_cocina (
      fecha, tipo, nombre_insumo, categoria, cantidad, unidad, costo_unitario, valor_total, observaciones
    )
    SELECT
      v_fecha, 'CONSUMO', nombre_producto, COALESCE(categoria, 'Consumo Interno'),
      cantidad, COALESCE(unidad, 'Und'), precio_unitario, subtotal,
      'Consumo POS (' || v_ord.consecutivo || ') • ' || v_cliente_nombre || ' (' || v_area_consumo || ')'
    FROM public.pos_orden_items
    WHERE orden_id = v_orden_id AND estado_comanda <> 'ANULADO';
  ELSE
    -- Bulk insert en ventas_detalle con base neta e impuesto reales
    INSERT INTO public.ventas_detalle (
      periodo_id, fecha, archivo_origen, codigo_producto, nombre_producto, categoria,
      unidad, cantidad, venta_bruta, descuento, venta_neta, impuesto, gran_total, valor_unitario
    )
    SELECT
      v_periodo_id, v_fecha, 'POS-' || v_caja_nombre || '-' || v_ord.consecutivo,
      codigo_producto, nombre_producto, categoria, COALESCE(unidad, 'Und'),
      cantidad, subtotal, 0,
      GREATEST(0, subtotal - impuesto_valor),
      impuesto_valor,
      subtotal,
      precio_unitario
    FROM public.pos_orden_items
    WHERE orden_id = v_orden_id AND estado_comanda <> 'ANULADO';

    SELECT COALESCE(SUM(cantidad), 0) INTO v_total_articulos
    FROM public.pos_orden_items WHERE orden_id = v_orden_id AND estado_comanda <> 'ANULADO';

    v_venta_sin_prop := GREATEST(0, v_gran_total - v_propina);
    v_venta_neta_real := GREATEST(0, v_venta_sin_prop - ROUND(v_impuesto_total));
    v_dia_semana := (ARRAY['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'])[EXTRACT(DOW FROM v_fecha)::INT + 1];

    INSERT INTO public.ventas_diarias (
      periodo_id, fecha, archivo_origen, dia_semana, total_articulos,
      venta_bruta, descuento, venta_neta, impuesto, gran_total,
      total_platos_distintos, ticket_promedio
    ) VALUES (
      v_periodo_id, v_fecha, 'POS La Finca Tiempo Real', v_dia_semana, v_total_articulos,
      ROUND(v_subtotal), v_descuento, v_venta_neta_real, ROUND(v_impuesto_total), v_venta_sin_prop,
      v_total_distintos, v_venta_sin_prop
    )
    ON CONFLICT (periodo_id, fecha) DO UPDATE SET
      total_articulos = COALESCE(public.ventas_diarias.total_articulos, 0) + EXCLUDED.total_articulos,
      venta_bruta = COALESCE(public.ventas_diarias.venta_bruta, 0) + EXCLUDED.venta_bruta,
      descuento = COALESCE(public.ventas_diarias.descuento, 0) + EXCLUDED.descuento,
      venta_neta = COALESCE(public.ventas_diarias.venta_neta, 0) + EXCLUDED.venta_neta,
      impuesto = COALESCE(public.ventas_diarias.impuesto, 0) + EXCLUDED.impuesto,
      gran_total = COALESCE(public.ventas_diarias.gran_total, 0) + EXCLUDED.gran_total;
  END IF;

  SELECT to_jsonb(o.*) INTO v_orden_json FROM public.pos_ordenes o WHERE o.id = v_orden_id;
  SELECT COALESCE(jsonb_agg(i.* ORDER BY i.created_at), '[]'::JSONB) INTO v_items_json FROM public.pos_orden_items i WHERE i.orden_id = v_orden_id;

  RETURN jsonb_build_object('already_invoiced', false, 'orden', v_orden_json, 'items', v_items_json);
END;
$$;


-- 3. RPC: Devolución ACID de ítem o ticket completo (Anti sobre-devolución + reintegro stock)
CREATE OR REPLACE FUNCTION public.rpc_devolver_item_o_ticket(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orden_id UUID := (p_payload->>'orden_id')::UUID;
  v_item_id UUID := NULLIF(p_payload->>'item_id', '')::UUID;
  v_es_completa BOOLEAN := COALESCE((p_payload->>'es_ticket_completo')::BOOLEAN, false);
  v_cant_req NUMERIC := GREATEST(0.01, COALESCE((p_payload->>'cantidad_devuelta')::NUMERIC, 1));
  v_metodo TEXT := COALESCE(NULLIF(p_payload->>'metodo_reembolso', ''), 'EFECTIVO');
  v_motivo TEXT := COALESCE(NULLIF(p_payload->>'motivo', ''), 'Devolución en caja');
  v_fecha DATE := COALESCE(NULLIF(p_payload->>'fecha', '')::DATE, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
  v_periodo_id TEXT := 'per-' || to_char(v_fecha, 'YYYY-MM');
  v_caja_nombre TEXT := COALESCE(NULLIF(p_payload->>'caja_nombre', ''), 'CAJA PRINCIPAL');
  v_caja_id UUID := NULLIF(p_payload->>'caja_id', '')::UUID;
  v_sesion_id UUID := NULLIF(p_payload->>'sesion_caja_id', '')::UUID;
  v_cajero TEXT := COALESCE(NULLIF(p_payload->>'cajero_nombre', ''), 'Cajero');
  v_ord RECORD;
  v_it RECORD;
  v_ya_dev NUMERIC := 0;
  v_cant_dev NUMERIC := 0;
  v_val_dev NUMERIC := 0;
  v_imp_dev NUMERIC := 0;
  v_total_dev NUMERIC := 0;
  v_total_imp_dev NUMERIC := 0;
  v_dev_row JSONB;
BEGIN
  SELECT * INTO v_ord FROM public.pos_ordenes WHERE id = v_orden_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada.';
  END IF;

  IF v_ord.estado <> 'FACTURADA' THEN
    RAISE EXCEPTION 'Solo se pueden devolver órdenes en estado FACTURADA (estado actual: %).', v_ord.estado;
  END IF;

  IF v_caja_id IS NULL THEN
    SELECT id INTO v_caja_id FROM public.pos_cajas WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(v_caja_nombre)) LIMIT 1;
  END IF;
  IF v_sesion_id IS NULL THEN
    SELECT id INTO v_sesion_id
    FROM public.libro_caja_sesiones
    WHERE fecha = v_fecha AND LOWER(TRIM(caja_nombre)) = LOWER(TRIM(v_caja_nombre)) AND estado = 'ABIERTA'
    ORDER BY hora_apertura DESC LIMIT 1;
  END IF;

  FOR v_it IN
    SELECT * FROM public.pos_orden_items
    WHERE orden_id = v_orden_id
      AND estado_comanda <> 'ANULADO'
      AND (v_es_completa OR id = v_item_id)
  LOOP
    SELECT COALESCE(SUM(cantidad_devuelta), 0) INTO v_ya_dev
    FROM public.pos_devoluciones
    WHERE orden_id = v_orden_id AND item_id = v_it.id;

    v_cant_dev := CASE WHEN v_es_completa THEN GREATEST(0, v_it.cantidad - v_ya_dev) ELSE v_cant_req END;
    IF v_cant_dev <= 0 OR (v_ya_dev + v_cant_dev) > v_it.cantidad THEN
      IF NOT v_es_completa THEN
        RAISE EXCEPTION 'El producto % ya fue devuelto o excede la cantidad facturada.', v_it.nombre_producto;
      END IF;
      CONTINUE;
    END IF;

    v_val_dev := ROUND(v_cant_dev * v_it.precio_unitario);
    v_imp_dev := CASE WHEN v_it.cantidad > 0 THEN ROUND(v_it.impuesto_valor * (v_cant_dev / v_it.cantidad)) ELSE 0 END;
    v_total_dev := v_total_dev + v_val_dev;
    v_total_imp_dev := v_total_imp_dev + v_imp_dev;

    INSERT INTO public.pos_devoluciones (
      fecha, orden_id, orden_consecutivo, item_id, nombre_producto,
      cantidad_devuelta, valor_devuelto, metodo_reembolso, motivo,
      caja_nombre, caja_id, sesion_caja_id, cajero_nombre
    ) VALUES (
      v_fecha, v_orden_id, v_ord.consecutivo, v_it.id, v_it.nombre_producto,
      v_cant_dev, v_val_dev, v_metodo, v_motivo,
      v_caja_nombre, v_caja_id, v_sesion_id, v_cajero
    ) RETURNING to_jsonb(pos_devoluciones.*) INTO v_dev_row;

    -- Reintegrar inventario si controla_inventario = true
    IF v_it.producto_id IS NOT NULL THEN
      WITH upd AS (
        UPDATE public.productos_venta pv
        SET existencia = COALESCE(pv.existencia, 0) + v_cant_dev,
            updated_at = NOW()
        WHERE pv.id = v_it.producto_id AND pv.controla_inventario = true
        RETURNING pv.id, pv.codigo, pv.nombre, (COALESCE(pv.existencia, 0) - v_cant_dev) AS ant, pv.existencia AS nueva
      )
      INSERT INTO public.pos_inventario_movimientos (
        fecha, producto_id, codigo_producto, nombre_producto, tipo,
        cantidad_delta, existencia_anterior, existencia_nueva, motivo, usuario
      )
      SELECT v_fecha, id, codigo, nombre, 'DEVOLUCION', v_cant_dev, ant, nueva,
        'Devolución ' || v_ord.consecutivo, v_cajero
      FROM upd;
    END IF;

    -- Línea compensatoria en ventas_detalle
    INSERT INTO public.ventas_detalle (
      periodo_id, fecha, archivo_origen, codigo_producto, nombre_producto, categoria,
      unidad, cantidad, venta_bruta, descuento, venta_neta, impuesto, gran_total, valor_unitario
    ) VALUES (
      v_periodo_id, v_fecha, 'DEV-' || v_caja_nombre || '-' || v_ord.consecutivo,
      v_it.codigo_producto, v_it.nombre_producto, v_it.categoria, COALESCE(v_it.unidad, 'Und'),
      -v_cant_dev, -v_val_dev, 0, -GREATEST(0, v_val_dev - v_imp_dev), -v_imp_dev, -v_val_dev, v_it.precio_unitario
    );
  END LOOP;

  IF v_total_dev <= 0 THEN
    RAISE EXCEPTION 'No hay unidades pendientes por devolver en esta factura.';
  END IF;

  IF v_es_completa THEN
    UPDATE public.pos_ordenes SET estado = 'DEVUELTA', updated_at = NOW() WHERE id = v_orden_id;
  END IF;

  IF v_metodo = 'CREDITO' AND COALESCE(v_ord.cliente_nombre, '') <> '' THEN
    INSERT INTO public.pos_creditos_movimientos (
      fecha, cliente_nombre, cliente_telefono, tipo, orden_id, orden_consecutivo,
      monto, metodo_pago, caja_nombre, caja_id, sesion_caja_id, cajero_nombre, observaciones
    ) VALUES (
      v_fecha, v_ord.cliente_nombre, v_ord.cliente_telefono, 'ABONO', v_orden_id, v_ord.consecutivo,
      v_total_dev, 'CREDITO', v_caja_nombre, v_caja_id, v_sesion_id, v_cajero,
      'Nota crédito por devolución en ' || v_ord.consecutivo
    );
  END IF;

  UPDATE public.ventas_diarias
  SET venta_neta = GREATEST(0, COALESCE(venta_neta, 0) - GREATEST(0, v_total_dev - v_total_imp_dev)),
      impuesto = GREATEST(0, COALESCE(impuesto, 0) - v_total_imp_dev),
      gran_total = GREATEST(0, COALESCE(gran_total, 0) - v_total_dev)
  WHERE periodo_id = v_periodo_id AND fecha = v_fecha;

  RETURN jsonb_build_object('totalDevuelto', v_total_dev, 'devolucion', v_dev_row);
END;
$$;


-- 4. RPC: Cierre de Caja estricto por sesion_caja_id + separación de propinas por mesero
CREATE OR REPLACE FUNCTION public.rpc_calcular_cierre_caja(
  p_sesion_id UUID,
  p_tipo_cierre TEXT,
  p_efectivo_contado NUMERIC,
  p_datafonos_contados NUMERIC,
  p_transferencias_contadas NUMERIC,
  p_observaciones TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sesion RECORD;
  v_is_total BOOLEAN := (UPPER(COALESCE(p_tipo_cierre, 'PARCIAL')) = 'TOTAL');
  v_ventas_ef NUMERIC := 0;
  v_ventas_dat NUMERIC := 0;
  v_ventas_trf NUMERIC := 0;
  v_total_vendido NUMERIC := 0;
  v_salidas NUMERIC := 0;
  v_abonos_ef NUMERIC := 0;
  v_dev_ef NUMERIC := 0;
  v_entradas_ef NUMERIC := 0;
  v_ef_esperado NUMERIC := 0;
  v_diferencia NUMERIC := 0;
  v_duracion_min INT := 0;
  v_propinas_mesero JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO v_sesion FROM public.libro_caja_sesiones WHERE id = p_sesion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesión de caja no encontrada: %', p_sesion_id;
  END IF;

  -- Sumar ingresos estrictamente del turno desde pos_orden_pagos (incluye abonos parciales en efectivo)
  SELECT
    COALESCE(SUM(CASE WHEN p.metodo_pago = 'EFECTIVO' THEN p.monto_aplicado ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.metodo_pago = 'DATAFONO' THEN p.monto_aplicado ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p.metodo_pago = 'TRANSFERENCIA' THEN p.monto_aplicado ELSE 0 END), 0),
    COALESCE(SUM(p.monto_aplicado), 0)
  INTO v_ventas_ef, v_ventas_dat, v_ventas_trf, v_total_vendido
  FROM public.pos_orden_pagos p
  WHERE p.sesion_caja_id = p_sesion_id;

  -- Fallback por si hubiera órdenes legacy facturadas en este turno sin filas en pos_orden_pagos
  IF v_total_vendido = 0 THEN
    SELECT
      COALESCE(SUM(pago_efectivo), 0),
      COALESCE(SUM(pago_datafono), 0),
      COALESCE(SUM(pago_transferencia), 0),
      COALESCE(SUM(gran_total), 0)
    INTO v_ventas_ef, v_ventas_dat, v_ventas_trf, v_total_vendido
    FROM public.pos_ordenes o
    WHERE o.sesion_caja_id = p_sesion_id AND o.estado = 'FACTURADA' AND o.metodo_pago <> 'CONSUMO_INTERNO';
  END IF;

  SELECT COALESCE(SUM(valor_pagado), 0) INTO v_salidas
  FROM public.libro_caja_registros
  WHERE sesion_id = p_sesion_id AND tipo_libro = 'CAJA_MENOR';

  SELECT COALESCE(SUM(monto), 0) INTO v_abonos_ef
  FROM public.pos_creditos_movimientos
  WHERE sesion_caja_id = p_sesion_id AND tipo = 'ABONO' AND metodo_pago = 'EFECTIVO';

  SELECT COALESCE(SUM(valor_devuelto), 0) INTO v_dev_ef
  FROM public.pos_devoluciones
  WHERE sesion_caja_id = p_sesion_id AND metodo_reembolso = 'EFECTIVO';

  SELECT COALESCE(SUM(valor_afectado), 0) INTO v_entradas_ef
  FROM public.pos_auditoria_eventos
  WHERE sesion_caja_id = p_sesion_id AND tipo_alerta = 'ENTRADA_EFECTIVO_CAJA';

  -- Propinas acumuladas por mesero en el turno
  SELECT COALESCE(jsonb_agg(jsonb_build_object('mesero', mesero, 'propina', total_prop)), '[]'::JSONB)
  INTO v_propinas_mesero
  FROM (
    SELECT COALESCE(NULLIF(TRIM(mesero_nombre), ''), cajero_nombre) AS mesero, SUM(propina) AS total_prop
    FROM public.pos_ordenes
    WHERE sesion_caja_id = p_sesion_id AND estado = 'FACTURADA' AND propina > 0
    GROUP BY 1
    ORDER BY 2 DESC
  ) t;

  v_ef_esperado := GREATEST(0, ROUND(
    COALESCE(v_sesion.efectivo_inicial, 0) + v_ventas_ef + v_abonos_ef + v_entradas_ef - v_salidas - v_dev_ef
  ));
  v_diferencia := ROUND(COALESCE(p_efectivo_contado, 0) - v_ef_esperado);
  v_duracion_min := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - v_sesion.hora_apertura)) / 60.0)::INT);

  UPDATE public.libro_caja_sesiones
  SET efectivo_cierre = COALESCE(p_efectivo_contado, 0),
      valor_datafonos = COALESCE(p_datafonos_contados, 0),
      valor_otros_medios = COALESCE(p_transferencias_contadas, 0),
      venta_pos = v_total_vendido,
      total_salidas = v_salidas,
      diferencia_cuadre = v_diferencia,
      estado = CASE WHEN v_is_total THEN 'CERRADA_TOTAL' ELSE 'CERRADA_PARCIAL' END,
      tipo_cierre = CASE WHEN v_is_total THEN 'TOTAL' ELSE 'PARCIAL' END,
      hora_cierre = NOW(),
      duracion_minutos = v_duracion_min,
      observaciones = NULLIF(p_observaciones, ''),
      updated_at = NOW()
  WHERE id = p_sesion_id;

  IF ABS(v_diferencia) > 2000 THEN
    INSERT INTO public.pos_auditoria_eventos (
      fecha, caja_nombre, caja_id, sesion_caja_id, usuario_cajero, tipo_alerta, nivel_riesgo,
      valor_afectado, descripcion
    ) VALUES (
      v_sesion.fecha, v_sesion.caja_nombre, v_sesion.caja_id, p_sesion_id, v_sesion.cajero_nombre,
      'DESCUADRE_ARQUEO_CIEGO',
      CASE WHEN ABS(v_diferencia) >= 20000 THEN 'CRITICO' ELSE 'ALTO' END,
      ABS(v_diferencia),
      (CASE WHEN v_is_total THEN 'Cierre Total' ELSE 'Cierre Parcial' END) || ' con diferencia de $' || v_diferencia || ' (Esperado: $' || v_ef_esperado || ' vs Contado: $' || COALESCE(p_efectivo_contado, 0) || ').'
    );
  END IF;

  RETURN jsonb_build_object(
    'tipoCierre', CASE WHEN v_is_total THEN 'TOTAL' ELSE 'PARCIAL' END,
    'baseInicial', COALESCE(v_sesion.efectivo_inicial, 0),
    'ventasEfectivo', v_ventas_ef,
    'ventasDatafono', v_ventas_dat,
    'ventasTransf', v_ventas_trf,
    'totalAbonosEfectivo', v_abonos_ef,
    'totalEntradasEfectivo', v_entradas_ef,
    'totalDevolucionesEfectivo', v_dev_ef,
    'totalVendidoPos', v_total_vendido,
    'totalSalidasCaja', v_salidas,
    'efectivoEsperado', v_ef_esperado,
    'efectivoContado', COALESCE(p_efectivo_contado, 0),
    'diferenciaEfectivo', v_diferencia,
    'propinasPorMesero', v_propinas_mesero
  );
END;
$$;


-- 5. RPC: Saldos de cartera de clientes agregados en SQL (sin límite de 500 filas)
CREATE OR REPLACE FUNCTION public.rpc_saldos_creditos_clientes()
RETURNS TABLE(
  cliente_nombre TEXT,
  cliente_telefono TEXT,
  saldo NUMERIC,
  ultimo_movimiento TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    MIN(m.cliente_nombre) AS cliente_nombre,
    MAX(m.cliente_telefono) AS cliente_telefono,
    COALESCE(SUM(CASE WHEN m.tipo = 'CARGO_CREDITO' THEN m.monto ELSE -m.monto END), 0) AS saldo,
    MAX(m.created_at) AS ultimo_movimiento
  FROM public.pos_creditos_movimientos m
  WHERE TRIM(COALESCE(m.cliente_nombre, '')) <> ''
  GROUP BY LOWER(TRIM(m.cliente_nombre))
  HAVING COALESCE(SUM(CASE WHEN m.tipo = 'CARGO_CREDITO' THEN m.monto ELSE -m.monto END), 0) > 0
     OR MAX(m.created_at) >= NOW() - INTERVAL '30 days'
  ORDER BY saldo DESC;
$$;
