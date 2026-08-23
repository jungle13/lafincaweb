# Protocolo de Ingesta Automática de Movimientos por IA (Antigravity)

Este protocolo define cómo Antigravity debe actuar cuando el usuario solicite:
- *"Analiza las fotos de movimientos de hoy"*
- *"Procesa las facturas de la carpeta"*
- *"Ingresa las compras de las fotos"*

## 1. Detección de Archivos
- **Carpeta de Entrada Predeterminada:** `fotos_movimientos/` o la carpeta que el usuario indique (ej. `C:\Users\Home\Desktop\Fotos_Movimientos`).
- El agente listará todos los archivos (`.jpg`, `.jpeg`, `.png`, `.pdf`, `.webp`).

## 2. Extracción Estructurada por Visión IA
Para cada imagen o documento, el agente identifica:
- **Tipo de Movimiento:**
  - `ENTRADA_COMPRA` (Facturas, remisiones de proveedores, recibos de báscula).
  - `PORCIONADO` (Hojas de rendimiento, minutas de corte con Kilos brutos, porciones y merma).
  - `TRASLADO_COCINA` (Despachos de bodega a cocina con porciones o Kilos).
  - `DEVOLUCION_COCINA` (Retornos de cocina a bodega).
- **Materia Prima:** Nombre exacto del corte de carne o insumo (ej. *Punta de anca*, *Lomo viche*, *Chatas*).
- **Métricas:** Kilos (`cant_sin_porcionar_kg`), Porciones (`porciones_und`), Peso de porciones (`peso_porciones_kg`), Costo total o unitario.
- **Detalles Administrativos:** Número de Factura, Proveedor, Fecha, Observaciones.

## 3. Envío al API del Dashboard
El agente enviará un POST JSON al endpoint de ingesta:
- **URL:** `/api/bodega/ingesta-ia`
- **Headers:** `{ "Content-Type": "application/json", "Authorization": "Bearer la-finca-ia-secret-2026" }`
- **Efecto en Sistema:** Los movimientos ingresan con estado `[PENDIENTE_APROBAR]` y se muestran en la Línea de Tiempo de Bodega listos para que el usuario los revise, edite o apruebe con 1 clic (con prioridad para las compras de carnes).

## 4. Reubicación y Organización
Una vez procesado con éxito, el archivo se renombra con estándar (`YYYY-MM-DD_TIPO_INSUMO_ORIGINAL.ext`) y se traslada a la carpeta `fotos_procesadas/YYYY/MM/DD/`.
