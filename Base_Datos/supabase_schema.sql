-- ====================================================================
-- ESQUEMA DE BASE DE DATOS: DASHBOARD LA FINCA - CONTROL DE INVENTARIO
-- Supabase PostgreSQL Schema
-- ====================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: USUARIOS / PERFILES
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'bodeguero', -- 'admin', 'bodeguero', 'cocina'
    email VARCHAR(100) UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: CATÁLOGO DE INSUMOS / MATERIA PRIMA
CREATE TABLE IF NOT EXISTS public.catalogo_insumos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(100) NOT NULL DEFAULT 'CARNES', -- 'CARNE DE RES', 'CARNE DE CERDO', 'CARNE POLLO', 'PESCADOS', 'VERDURAS', 'ABARROTES'
    es_carne BOOLEAN DEFAULT TRUE,
    unidad_medida VARCHAR(20) DEFAULT 'Kg', -- 'Kg', 'Und', 'Gramos'
    peso_estandar_porcion_kg NUMERIC(10, 3) DEFAULT 0.350, -- Peso estándar por porción (ej. 350g = 0.350 Kg)
    costo_unitario_kg NUMERIC(12, 2) DEFAULT 0.00, -- Costo promedio por Kg en COP
    stock_minimo_kg NUMERIC(10, 2) DEFAULT 10.00,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: STOCK ACTUAL EN VIVO (BODEGA Y COCINA)
CREATE TABLE IF NOT EXISTS public.stock_actual (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insumo_id UUID NOT NULL REFERENCES public.catalogo_insumos(id) ON DELETE CASCADE UNIQUE,
    
    -- Stock en Bodega
    bodega_sin_porcionar_kg NUMERIC(12, 3) DEFAULT 0.000, -- Carne entera / pieza sin porcionar
    bodega_porcionado_und INT DEFAULT 0,                 -- Porciones listas en bodega
    bodega_porcionado_kg NUMERIC(12, 3) DEFAULT 0.000,   -- Peso total porciones en bodega
    
    -- Stock en Cocina
    cocina_sin_porcionar_kg NUMERIC(12, 3) DEFAULT 0.000, -- Insumo entregado entero a cocina
    cocina_porcionado_und INT DEFAULT 0,                 -- Porciones entregadas a cocina
    cocina_porcionado_kg NUMERIC(12, 3) DEFAULT 0.000,   -- Peso de porciones en cocina
    
    -- Totales y Valorización
    peso_total_bodega_kg NUMERIC(12, 3) GENERATED ALWAYS AS (bodega_sin_porcionar_kg + bodega_porcionado_kg) STORED,
    peso_total_cocina_kg NUMERIC(12, 3) GENERATED ALWAYS AS (cocina_sin_porcionar_kg + cocina_porcionado_kg) STORED,
    peso_total_general_kg NUMERIC(12, 3) GENERATED ALWAYS AS (bodega_sin_porcionar_kg + bodega_porcionado_kg + cocina_sin_porcionar_kg + cocina_porcionado_kg) STORED,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: REGISTRO DE COMPRAS (FACTURAS DE PROVEEDORES)
CREATE TABLE IF NOT EXISTS public.compras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    numero_factura VARCHAR(100),
    proveedor VARCHAR(150) NOT NULL,
    valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    observaciones TEXT,
    usuario VARCHAR(100) DEFAULT 'Bodeguero',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.1 TABLA: DETALLE DE COMPRAS
CREATE TABLE IF NOT EXISTS public.compras_detalle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    compra_id UUID REFERENCES public.compras(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.catalogo_insumos(id),
    cantidad_kg NUMERIC(10, 3) NOT NULL,
    costo_unitario_kg NUMERIC(12, 2) NOT NULL,
    costo_total NUMERIC(14, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: MOVIMIENTOS DE INVENTARIO (AUDITORÍA COMPLETA Y TRAZABILIDAD)
-- Tipos de movimiento:
-- 1. 'ENTRADA_COMPRA'      -> Ingreso directo de proveedor a bodega (sin porcionar)
-- 2. 'PORCIONADO'          -> De bodega_sin_porcionar a bodega_porcionado (+ cálculo de merma)
-- 3. 'TRASLADO_COCINA'     -> De bodega (porcionado o entero) a cocina
-- 4. 'DEVOLUCION_COCINA'   -> De cocina a bodega (reintegro de sobrantes)
-- 5. 'CONSUMO_VENTA'       -> Descarga por venta en cocina
-- 6. 'AJUSTE_INVENTARIO'   -> Ajuste manual por auditoría física
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha_hora TIMESTAMPTZ DEFAULT NOW(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_movimiento VARCHAR(50) NOT NULL,
    insumo_id UUID NOT NULL REFERENCES public.catalogo_insumos(id),
    
    -- Ubicación y flujo
    origen VARCHAR(50) NOT NULL, -- 'PROVEEDOR', 'BODEGA_ENTERO', 'BODEGA_PORCIONADO', 'COCINA'
    destino VARCHAR(50) NOT NULL, -- 'BODEGA_ENTERO', 'BODEGA_PORCIONADO', 'COCINA', 'CLIENTE_VENTA', 'MERMA'
    
    -- Cantidades en la transacción
    cant_sin_porcionar_kg NUMERIC(10, 3) DEFAULT 0.000,
    porciones_und INT DEFAULT 0,
    peso_porciones_kg NUMERIC(10, 3) DEFAULT 0.000,
    merma_kg NUMERIC(10, 3) DEFAULT 0.000, -- Merma resultante del corte/porcionado
    
    -- Snapshots para auditoría (Antes y Después)
    bodega_sin_porc_anterior_kg NUMERIC(10, 3) DEFAULT 0.000,
    bodega_sin_porc_nuevo_kg NUMERIC(10, 3) DEFAULT 0.000,
    bodega_porc_und_anterior INT DEFAULT 0,
    bodega_porc_und_nuevo INT DEFAULT 0,
    bodega_porc_kg_anterior NUMERIC(10, 3) DEFAULT 0.000,
    bodega_porc_kg_nuevo NUMERIC(10, 3) DEFAULT 0.000,
    
    cocina_sin_porc_anterior_kg NUMERIC(10, 3) DEFAULT 0.000,
    cocina_sin_porc_nuevo_kg NUMERIC(10, 3) DEFAULT 0.000,
    cocina_porc_und_anterior INT DEFAULT 0,
    cocina_porc_und_nuevo INT DEFAULT 0,
    cocina_porc_kg_anterior NUMERIC(10, 3) DEFAULT 0.000,
    cocina_porc_kg_nuevo NUMERIC(10, 3) DEFAULT 0.000,
    
    costo_unitario_kg NUMERIC(12, 2) DEFAULT 0.00,
    valor_total_movimiento NUMERIC(14, 2) DEFAULT 0.00,
    
    observaciones TEXT,
    usuario VARCHAR(100) DEFAULT 'Bodeguero'
);

-- 6. TABLA: PLATOS DEL MENÚ
CREATE TABLE IF NOT EXISTS public.platos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    precio_venta NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.1 TABLA: RECETAS / FICHAS TÉCNICAS (INSUMOS POR PLATO)
CREATE TABLE IF NOT EXISTS public.recetas_detalle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plato_id UUID NOT NULL REFERENCES public.platos(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.catalogo_insumos(id),
    porciones_por_plato NUMERIC(6, 2) DEFAULT 1.0,
    cantidad_por_porcion_kg NUMERIC(10, 3) DEFAULT 0.350,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA: VENTAS DIARIAS
CREATE TABLE IF NOT EXISTS public.ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    plato_id UUID NOT NULL REFERENCES public.platos(id),
    cantidad_vendida INT NOT NULL DEFAULT 1,
    ingreso_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    costo_insumos_total NUMERIC(14, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- TRIGGERS Y FUNCIONES AUTOMÁTICAS
-- ====================================================================

-- Función para inicializar el registro de stock_actual cuando se crea un insumo
CREATE OR REPLACE FUNCTION public.fn_init_stock_actual()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.stock_actual (insumo_id)
    VALUES (NEW.id)
    ON CONFLICT (insumo_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_init_stock_actual ON public.catalogo_insumos;
CREATE TRIGGER trg_init_stock_actual
AFTER INSERT ON public.catalogo_insumos
FOR EACH ROW
EXECUTE FUNCTION public.fn_init_stock_actual();

-- ====================================================================
-- VISTA RESUMEN: INVENTARIO EN VIVO CON VALORIZACIÓN EN PESOS
-- ====================================================================
CREATE OR REPLACE VIEW public.v_inventario_en_vivo AS
SELECT 
    c.id AS insumo_id,
    c.codigo,
    c.nombre AS insumo,
    c.categoria,
    c.es_carne,
    c.unidad_medida,
    c.costo_unitario_kg,
    c.stock_minimo_kg,
    c.peso_estandar_porcion_kg,
    
    -- Bodega
    COALESCE(s.bodega_sin_porcionar_kg, 0) AS bodega_sin_porc_kg,
    COALESCE(s.bodega_porcionado_und, 0) AS bodega_porc_und,
    COALESCE(s.bodega_porcionado_kg, 0) AS bodega_porc_kg,
    COALESCE(s.peso_total_bodega_kg, 0) AS peso_total_bodega_kg,
    (COALESCE(s.peso_total_bodega_kg, 0) * c.costo_unitario_kg) AS valor_bodega_pesos,
    
    -- Cocina
    COALESCE(s.cocina_sin_porcionar_kg, 0) AS cocina_sin_porc_kg,
    COALESCE(s.cocina_porcionado_und, 0) AS cocina_porc_und,
    COALESCE(s.cocina_porcionado_kg, 0) AS cocina_porc_kg,
    COALESCE(s.peso_total_cocina_kg, 0) AS peso_total_cocina_kg,
    (COALESCE(s.peso_total_cocina_kg, 0) * c.costo_unitario_kg) AS valor_cocina_pesos,
    
    -- General
    COALESCE(s.peso_total_general_kg, 0) AS peso_total_general_kg,
    (COALESCE(s.peso_total_general_kg, 0) * c.costo_unitario_kg) AS valor_total_general_pesos,
    
    -- Estado de Alerta
    CASE 
        WHEN COALESCE(s.peso_total_bodega_kg, 0) = 0 THEN 'AGOTADO'
        WHEN COALESCE(s.peso_total_bodega_kg, 0) <= c.stock_minimo_kg THEN 'BAJO'
        ELSE 'OPTIMO'
    END AS estado_stock,
    
    s.updated_at
FROM public.catalogo_insumos c
LEFT JOIN public.stock_actual s ON c.id = s.insumo_id
WHERE c.activo = TRUE;

-- ====================================================================
-- POLÍTICAS RLS (Row Level Security) ABIERTAS PARA ANON
-- Permite lectura y escritura desde la aplicación web
-- ====================================================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on catalogo_insumos" ON public.catalogo_insumos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stock_actual" ON public.stock_actual FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on compras" ON public.compras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on compras_detalle" ON public.compras_detalle FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on movimientos_inventario" ON public.movimientos_inventario FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on platos" ON public.platos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on recetas_detalle" ON public.recetas_detalle FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ventas" ON public.ventas FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- DATOS SEMILLA INICIALES (CATÁLOGO DE CARNES LA FINCA)
-- ====================================================================
INSERT INTO public.catalogo_insumos (codigo, nombre, categoria, es_carne, unidad_medida, peso_estandar_porcion_kg, costo_unitario_kg, stock_minimo_kg)
VALUES 
    ('CAR-001', 'Lomo viche', 'CARNE DE RES', TRUE, 'Kg', 0.350, 32000.00, 15.00),
    ('CAR-002', 'Punta de anca', 'CARNE DE RES', TRUE, 'Kg', 0.350, 28000.00, 15.00),
    ('CAR-003', 'Churrasco', 'CARNE DE RES', TRUE, 'Kg', 0.400, 26000.00, 12.00),
    ('CAR-004', 'Costilla de res', 'CARNE DE RES', TRUE, 'Kg', 0.500, 18000.00, 20.00),
    ('CAR-005', 'Baby beef', 'CARNE DE RES', TRUE, 'Kg', 0.350, 34000.00, 10.00),
    ('CAR-006', 'Panceta de cerdo', 'CARNE DE CERDO', TRUE, 'Kg', 0.300, 19000.00, 15.00),
    ('CAR-007', 'Costilla de cerdo BBQ', 'CARNE DE CERDO', TRUE, 'Kg', 0.450, 21000.00, 15.00),
    ('CAR-008', 'Lomo de cerdo', 'CARNE DE CERDO', TRUE, 'Kg', 0.350, 17000.00, 10.00),
    ('CAR-009', 'Pechuga de pollo', 'CARNE POLLO', TRUE, 'Kg', 0.300, 14000.00, 20.00),
    ('CAR-010', 'Gallina criolla', 'CARNE POLLO', TRUE, 'Kg', 0.500, 11000.00, 15.00),
    ('CAR-011', 'Alitas de pollo', 'CARNE POLLO', TRUE, 'Kg', 0.400, 12500.00, 15.00),
    ('CAR-012', 'Filete de trucha', 'PESCADOS', TRUE, 'Kg', 0.350, 24000.00, 10.00),
    ('CAR-013', 'Salmón fresco', 'PESCADOS', TRUE, 'Kg', 0.300, 48000.00, 8.00),
    ('INS-001', 'Aceite vegetal', 'ABARROTES', FALSE, 'Litro', 1.000, 9500.00, 10.00),
    ('INS-002', 'Papas a la francesa', 'VERDURAS', FALSE, 'Kg', 1.000, 6500.00, 25.00)
ON CONFLICT (codigo) DO NOTHING;

-- Inicializar stock_actual con saldos base de ejemplo
UPDATE public.stock_actual
SET 
    bodega_sin_porcionar_kg = 25.500,
    bodega_porcionado_und = 18,
    bodega_porcionado_kg = 6.300,
    cocina_sin_porcionar_kg = 0.000,
    cocina_porcionado_und = 12,
    cocina_porcionado_kg = 4.200
WHERE insumo_id IN (SELECT id FROM public.catalogo_insumos WHERE codigo = 'CAR-001');

UPDATE public.stock_actual
SET 
    bodega_sin_porcionar_kg = 30.000,
    bodega_porcionado_und = 14,
    bodega_porcionado_kg = 4.900,
    cocina_sin_porcionar_kg = 0.000,
    cocina_porcionado_und = 8,
    cocina_porcionado_kg = 2.800
WHERE insumo_id IN (SELECT id FROM public.catalogo_insumos WHERE codigo = 'CAR-002');
