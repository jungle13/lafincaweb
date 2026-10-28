---
name: agy-task-orchestrator
description: Motor de orquestación de tareas complejas en Markdown para Antigravity. Descompone features en subtareas atómicas aisladas, preserva la ventana de contexto y valida compilaciones paso a paso.
risk: none
source_repo: dhamo003/agy-task-orchestrator
source_type: community
license: MIT
---

# AGY Task Orchestrator - La Finca

Sistema de orquestación para planificar y ejecutar refactorizaciones y nuevas funcionalidades sin degradar la ventana de contexto de los agentes de IA.

---

## 1. Ciclo de Ejecución de Tareas Atómicas

Cuando una solicitud del usuario abarque múltiples componentes, bases de datos o servicios, se debe seguir el protocolo de 4 fases:

```
[PLANIFICAR] -> [EJECUTAR PASO A PASO] -> [VALIDAR COMPILACIÓN] -> [DOCUMENTAR AVANCE]
```

### Reglas de Prevención de Saturación de Contexto
1. **Un solo objetivo por iteración:** No editar base de datos, backend y componentes UI en una sola respuesta.
2. **Validar antes de avanzar:** Tras cada cambio, ejecutar una comprobación rápida (`npm run build` o script de prueba en `scripts/`).
3. **Limpieza de trazas:** No volcar archivos completos de miles de líneas en el chat; leer solo los rangos de líneas pertinentes.

---

## 2. Plantilla de Matriz de Tareas (`TASK_PLAN.md`)

Para proyectos o features de más de 3 pasos, crear o mantener un archivo de seguimiento temporal con el siguiente formato:

```markdown
# Plan de Implementación: [Nombre de la Característica]

## Objetivo
Descripción concisa de la meta y criterios de aceptación.

## Tareas
- [x] Tarea 1: Definir modelos y esquemas Zod en `types/index.ts` y `src/types/index.ts`.
- [/] Tarea 2: Implementar lógica de negocio en `services/movimientosService.ts`.
- [ ] Tarea 3: Crear componente de interfaz de usuario en `components/` y `src/components/`.
- [ ] Tarea 4: Probar flujo de datos con script de prueba o verificación E2E.
- [ ] Tarea 5: Ejecutar `npm run build` y asegurar sincronización dual.

## Estado Actual
- Tarea en curso: Tarea 2
- Bloqueos / Dudas: Ninguno
```

---

## 3. Estados de Tarea Soportados
- `[ ]`: Pendiente de inicio.
- `[/]`: En progreso activo (solo debe haber una a la vez).
- `[x]`: Completada y verificada contra compilador/pruebas.
- `[-]`: Descartada o reemplazada por un nuevo diseño.

---

## 4. Subagentes y Delegación
Si la tarea requiere investigación profunda de archivos de histórico o análisis masivo de logs:
- Delegar a un subagente de tipo `research` para que explore y resuma los hallazgos sin saturar el contexto de la conversación principal.
