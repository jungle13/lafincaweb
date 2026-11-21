-- OLA 1B (FASE 2): Cierre Total RLS para Producción
-- IMPORTANTE: Aplicar SOLO después de configurar SUPABASE_SERVICE_ROLE_KEY en .env.local y Vercel.

DO $$
DECLARE
  t TEXT;
  pol RECORD;
  tables_to_lock TEXT[] := ARRAY[
    'pos_ordenes',
    'pos_orden_items',
    'pos_orden_pagos',
    'pos_mesas',
    'pos_cajas',
    'pos_auditoria_eventos',
    'pos_clientes',
    'pos_zonas',
    'pos_categorias',
    'empresa_config',
    'proveedores',
    'notificaciones_sistema',
    'libro_caja_diario',
    'libro_caja_registros',
    'libro_caja_sesiones',
    'libro_caja_usuarios',
    'pos_creditos_movimientos',
    'pos_devoluciones',
    'pos_inventario_movimientos',
    'productos_venta'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_lock LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
      'service_role_only_' || t,
      t
    );
  END LOOP;
END $$;
