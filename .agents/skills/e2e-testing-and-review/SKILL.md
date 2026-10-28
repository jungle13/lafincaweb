---
name: e2e-testing-and-review
description: Protocolo de verificación de regresiones, pruebas de invariantes matemáticas de inventario y revisión de código pre-compilación para La Finca.
risk: none
source_repo: rmyndharis/antigravity-skills
source_type: community
license: MIT
---

# E2E Testing and Code Review - La Finca

Guía operativa para auditar cambios de código, validar invariantes matemáticas de negocio y prevenir regresiones antes de desplegar o formalizar movimientos.

---

## 1. Verificación de Invariantes Matemáticas de Inventario

Cualquier cambio en la lógica de cálculo (`services/movimientosService.ts`, `services/periodosService.ts`) debe garantizar las siguientes invariantes:

### Invariante 1: Balance General de Stock
$$\text{Stock Final} = \text{Stock Inicial} + \text{Compras} - \text{Traslados} + \text{Devoluciones} - \text{Mermas} \pm \text{Ajustes}$$

### Invariante 2: Conservación de Masa en Porcionado
$$\text{Peso Bruto (Sin Porcionar)} = \text{Peso Porciones Obtenidas} + \text{Merma Técnica}$$

### Invariante 3: No Negatividad en Existencias Físicas
Ningún movimiento formalizado o aprobado puede dejar existencias físicas en saldo negativo (`< 0`). Si una operación generaría saldo negativo:
1. Se debe exigir el registro previo de un ajuste (`ERROR_CONTEO_PREVIO`).
2. Se debe bloquear la aprobación automática hasta subsanar el déficit.

---

## 2. Checklist Obligatorio de Code Review

Antes de dar por completada cualquier tarea o refactorización:

- [ ] **Sincronización Dual:** ¿Se replicó el cambio tanto en la raíz (`app/`, `components/`, `lib/`, `types/`) como en `src/`?
- [ ] **Validación de Tipos:** Ejecutar `npm run build` o `npx tsc --noEmit` y confirmar cero errores.
- [ ] **Sin `console.log` residuales:** Asegurarse de no dejar logs de depuración en rutas de producción.
- [ ] **Manejo de Errores en APIs:** Todas las rutas de API retornan códigos de estado HTTP correctos (200, 400, 404, 500) con mensajes comprensibles.
- [ ] **Preservación de Auditoría:** Toda mutación debe registrar `usuario_id` y timestamp `created_at`.

---

## 3. Ejecución de Scripts de Verificación Existentes

El proyecto cuenta con scripts de prueba en la carpeta `scripts/`. Usarlos para verificar integridad según el área modificada:

```bash
# Validar matching de ventas y recetas
node scripts/test_sales_match.js

# Validar lógica de conciliación y cierre
node scripts/test_cierre_debug.js

# Validar consistencia de conteos
node scripts/test_conteos_fetch.js
```
