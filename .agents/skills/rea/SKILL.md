---
name: rea-reverse-engineering
description: Reverse Engineer Anything (REA - morluto/rea) methodology and toolkit for inspecting desktop POS binaries (Delphi VCL/FMX, Electron, .NET, PE executables, SQLite/Firebird schemas) and extracting UI workflows, keyboard accelerators, and business logic.
---

# REA — Reverse Engineer Anything (`morluto/rea`)

## Propósito
Guiar la inspección empírica y sistemática de aplicaciones de escritorio compiladas (como **eleventa / Bambú Code `Abarrotes.exe`**, binarios Delphi VCL, Electron `.asar` o bases de datos locales) para extraer:
1. **Mapa de Formularios y Acciones (`TForm`, `TAction`, `ShortCut`):** Atajos `F1`–`F12`, `INS`, `DEL`, `CTRL+*`, flujos de caja y modales.
2. **Esquemas de Datos Locales:** Tablas de tickets en espera, turnos, entradas/salidas de efectivo, cortes parciales/totales y bitácora de eventos.
3. **Protocolos de Periféricos:** Comandos ESC/POS para impresoras térmicas, apertura de cajón monedero (`pulse pin 2/5`) y tramas seriales RS-232 para básculas/grameras.

## Flujo de Trabajo Basado en Evidencia
1. **Identificación del Binario / Proceso:**
   - Detectar ejecutable, arquitectura PE (`x86`/`x64`), compilador (Delphi/C++Builder, Electron, Rust/Tauri, .NET) y recursos embebidos (`RCData`, `DFM` de formularios VCL).
2. **Extracción de Recursos de Interfaz y Atajos:**
   - Extraer recursos `TForm` / `DFM` o cadenas UTF-8/UTF-16LE para listar botones, teclas rápidas (`F1`–`F12`), columnas de grilla y estados de barra inferior.
3. **Traducción a Arquitectura Destino (Next.js + Tauri v2 + Supabase):**
   - Mapear cada patrón de alta velocidad de caja (foco permanente en input de código/búsqueda, navegación por flechas, multi-ticket con `F5`/`F6`, cobro instantáneo con `F12` y memoria del último cambio) a componentes React + puente nativo Rust.
