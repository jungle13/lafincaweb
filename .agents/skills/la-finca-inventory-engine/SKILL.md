---
name: la-finca-inventory-engine
description: Reglas de negocio y motor de inventarios para La Finca (carnes, porcionados, mermas, traslados, sincronizacion dual y auditoria).
---

# Motor de Inventario y Reglas de Negocio - La Finca

Esta skill contiene las directrices de arquitectura y reglas del dominio para el sistema de control de inventarios de carnes de La Finca.

## 1. Reglas Criticas de Desarrollo
- **Sincronizacion Dual Obligatoria:** Mantener sincronizadas en todo momento tanto la raiz (`app/`, `components/`, `lib/`, `types/`) como la carpeta `src/` (`src/app/`, `src/components/`, `src/lib/`, `src/types/`).
- **Validacion de Compilacion:** Todo cambio debe validar `npm run build` sin errores de tipos TypeScript.

## 2. Flujo de Estados y Secuencia Operativa de Carnes
1. **`ENTRADA_COMPRA` (Compras / Proveedor):**
   - Incrementa `bodega_sin_porcionar_kg`.
   - Actualiza costo unitario ponderado en `catalogo_insumos` y genera registro en `compras` / `compras_detalle`.
2. **`PORCIONADO` (Procesamiento y Corte):**
   - Reduce `bodega_sin_porcionar_kg`.
   - Incrementa `bodega_porcionado_und` y `bodega_porcionado_kg`.
   - Calcula merma tecnica: `merma_kg = cant_sin_porcionar_kg - peso_porciones_kg`.
3. **`DEVOLUCION_COCINA` (Reintegros):**
   - Reduce existencias en cocina (`cocina_porcionado_und` o `cocina_sin_porcionar_kg`).
   - Reintegra a bodega (`bodega_porcionado_und` o `bodega_sin_porcionar_kg`).
4. **`TRASLADO_COCINA` (Despachos para Servicio):**
   - Reduce bodega y transfiere a cocina para consumo operativo.

## 3. Validacion y Aprobacion Cronologica
- Los movimientos extraidos por IA o ingresados en borrador se marcan con `[PENDIENTE_APROBAR]`.
- **Regla Cronologica Estricta:** No se permite aprobar una jornada (ej. Dia 2) si existen dias anteriores con pendientes sin aprobar o descartar.
- **Validacion de Deficit:** Antes de aprobar un lote (`APROBAR_FECHA`), el sistema verifica si algun corte tiene stock insuficiente. Si existe deficit, exige realizar el ajuste mediante `Ajustar` (`ERROR_CONTEO_PREVIO`) antes de aprobar.

## 4. Auditoria y Reversion
- Las aprobaciones pueden revertirse individualmente o por jornada completa (`REVERTIR_FECHA`), recalculando automaticamente la tabla `stock_actual` mediante un replay determinista de los movimientos formalizados.
