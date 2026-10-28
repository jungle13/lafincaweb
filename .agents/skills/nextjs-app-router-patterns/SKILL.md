---
name: nextjs-app-router-patterns
description: Guía y directrices de arquitectura para Next.js 14/15 App Router en La Finca. Manejo de Server vs Client Components, Server Actions, optimización de caché, fetches en paralelo y sincronización dual (app/ y src/app/).
risk: none
source_repo: rmyndharis/antigravity-skills
source_type: community
license: MIT
---

# Next.js App Router Patterns - La Finca

Directrices de arquitectura y patrones de diseño para el stack de Next.js App Router en el proyecto **La Finca - Costeo e Inventario**.

---

## 1. Regla de Oro: Sincronización Dual
En este proyecto coexisten `app/` (raíz) y `src/app/`.
- Cualquier modificación, nuevo componente, Server Action o ruta de API (`route.ts`) debe reflejarse en **ambas ubicaciones** (`app/` y `src/app/`), manteniendo paridad total de código y tipado.
- Validar siempre `npm run build` tras modificar archivos en el enrutador.

---

## 2. Server Components vs. Client Components

### Por Defecto: Server Component (RSC)
Mantén los componentes como Server Components siempre que sea posible. Son ideales para:
- Conexión directa a Supabase o base de datos sin exponer credenciales cliente.
- Reducción del tamaño del bundle JavaScript del navegador.
- Carga de datos iniciales (`SSR`) de catálogos, recetas e inventarios.

### Cuándo usar `'use client'`
Añadir la directiva `'use client'` al principio del archivo **únicamente** cuando se requiera:
- Manejo de estado interactivo (`useState`, `useReducer`, `useContext`).
- Efectos de ciclo de vida o listeners del DOM (`useEffect`, `useCallback`, `window`, `document`).
- Formularios interactivos, modales y tablas dinámicas de conteo físico.

> **Patrón Recomendado:** Mover la lógica interactiva a componentes "hoja" pequeños y envolverlos en Server Components para la carga de datos.

```tsx
// BUENO: Server Component que delega UI interactiva
import { fetchMovimientosDia } from '@/lib/supabase/server';
import { TablaMovimientosClient } from '@/components/TablaMovimientosClient';

export default async function MovimientosPage({ params }: { params: { fecha: string } }) {
  const data = await fetchMovimientosDia(params.fecha);
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Movimientos del Día</h1>
      <TablaMovimientosClient initialData={data} />
    </main>
  );
}
```

---

## 3. Eliminación de Waterfalls en Fetching
Nunca anides llamadas `await` independientes una tras otra. Paraleliza siempre con `Promise.all`:

```typescript
// MAL (Secuencial / Waterfall)
const categorias = await getCategorias();
const insumos = await getInsumos();
const conteoPrevio = await getConteoPrevio();

// BIEN (Paralelo)
const [categorias, insumos, conteoPrevio] = await Promise.all([
  getCategorias(),
  getInsumos(),
  getConteoPrevio(),
]);
```

---

## 4. Server Actions y Manejo de Formularios
- Para mutaciones de inventario (aprobación de jornada, inserción de compras, registro de mermas):
  - Validar los payloads con esquemas de **Zod** antes de tocar Supabase.
  - Retornar siempre objetos estructurados `{ success: boolean, data?: T, error?: string }`.
  - Usar `revalidatePath('/ruta')` tras mutaciones exitosas para invalidar la caché de la página afectada.

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const AprobacionSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  usuario: z.string().min(1),
});

export async function aprobarJornadaAction(formData: FormData) {
  const parsed = AprobacionSchema.safeParse({
    fecha: formData.get('fecha'),
    usuario: formData.get('usuario'),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Ejecutar lógica del servicio
  const res = await aprobarJornadaService(parsed.data.fecha, parsed.data.usuario);
  revalidatePath('/inventario/aprobaciones');
  return { success: true, data: res };
}
```

---

## 5. Manejo de Errores y Estados de Carga
- Usar archivos de convención de Next.js:
  - `loading.tsx`: Esqueletos de carga mientras se obtienen datos pesados de inventario.
  - `error.tsx`: Límites de error (`ErrorBoundary`) con botón de reintento.
  - `not-found.tsx`: Para recursos inexistentes (ej. ID de periodo o compra no encontrada).
