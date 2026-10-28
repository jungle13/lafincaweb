---
name: typescript-pro
description: Estandariza tipado estricto, modelos de dominio, validaciones de esquema con Zod, manejo de nulos y erradicación de 'any' para el sistema La Finca.
risk: none
source_repo: rmyndharis/antigravity-skills
source_type: community
license: MIT
---

# TypeScript Pro - Estándares de Tipado La Finca

Directrices para mantener un código 100% tipado de forma estricta, predecible y seguro contra errores en tiempo de ejecución.

---

## 1. Reglas Fundamentales

- **Prohibido el uso de `any`:** Reemplazar por tipos específicos, genéricos con restricciones o `unknown` con type guards de Zod.
- **Sincronización de Tipos:** Los tipos base deben mantenerse reflejados tanto en `types/` como en `src/types/`.
- **Inmutabilidad y Precisión:** Las cantidades numéricas de inventario (kg, porciones, costos unitarios) deben validar que no sean `NaN`, `null` o valores negativos no intencionados.

---

## 2. Modelado de Dominio con Uniones Discriminadas

Para los movimientos de inventario (`ENTRADA_COMPRA`, `PORCIONADO`, `TRASLADO_COCINA`, `DEVOLUCION_COCINA`, `MERMA`, `AJUSTE`), utilizar **Discriminated Unions** para que TypeScript valide las propiedades obligatorias de cada operación:

```typescript
export type TipoMovimiento = 
  | 'ENTRADA_COMPRA' 
  | 'PORCIONADO' 
  | 'TRASLADO_COCINA' 
  | 'DEVOLUCION_COCINA' 
  | 'MERMA_TECNICA' 
  | 'AJUSTE_CONTEO';

export interface BaseMovimiento {
  id: string;
  fecha: string;
  insumo_id: string;
  usuario_id: string;
  created_at: string;
}

export interface MovimientoCompra extends BaseMovimiento {
  tipo: 'ENTRADA_COMPRA';
  cantidad_kg: number;
  costo_total: number;
  proveedor_id: string;
}

export interface MovimientoPorcionado extends BaseMovimiento {
  tipo: 'PORCIONADO';
  peso_bruto_kg: number;
  porciones_und: number;
  peso_porciones_kg: number;
  merma_kg: number;
}

export type MovimientoInventario = MovimientoCompra | MovimientoPorcionado;
```

---

## 3. Validación en Tiempo de Ejecución con Zod

Siempre que datos externos ingresen a la aplicación (API request, carga de Excel, parseo de OCR/imágenes, formularios), usar Zod como barrera de seguridad:

```typescript
import { z } from 'zod';

export const MovimientoPayloadSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  insumo_id: z.string().uuid('ID de insumo debe ser un UUID válido'),
  tipo: z.enum(['ENTRADA_COMPRA', 'PORCIONADO', 'TRASLADO_COCINA', 'DEVOLUCION_COCINA', 'AJUSTE_CONTEO']),
  cantidad: z.number().positive('La cantidad debe ser mayor a cero'),
  costo_unitario: z.number().nonnegative().optional(),
  notas: z.string().max(500).optional(),
});

export type MovimientoPayload = z.infer<typeof MovimientoPayloadSchema>;
```

---

## 4. Tipado de Respuestas de API

Estandarizar todas las respuestas del backend o Server Actions bajo un tipo unificado:

```typescript
export type ApiResponse<T> = 
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never; code?: string };
```

---

## 5. Manejo Seguro de Nulos en Supabase

Las consultas de Supabase devuelven filas que pueden ser `null` o colecciones vacías. Utilizar siempre comprobaciones de guarda o destructuración segura:

```typescript
const { data, error } = await supabase
  .from('catalogo_insumos')
  .select('id, nombre, costo_promedio, unidad_medida')
  .eq('id', insumoId)
  .single();

if (error || !data) {
  throw new Error(`Insumo no encontrado: ${error?.message ?? 'Sin datos'}`);
}

// Aquí data está completamente tipada y garantizada como no-nula
const costo = data.costo_promedio;
```
