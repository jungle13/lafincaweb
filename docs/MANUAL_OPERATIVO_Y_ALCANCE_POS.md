# Manual Funcional, Reglas de Negocio y Guía de Puesta en Marcha — ELIANA POS (La Finca)

> **Versión del documento:** 1.0 (Post-Auditoría Fases 1, 2 y 3)  
> **Aplicación:** ELIANA POS (Web Next.js en Vercel + App de Escritorio Windows Tauri v2 + Base de Datos PostgreSQL en Supabase)  
> **Público objetivo:** Gerencia / Administración, Supervisores de Turno y Personal de Caja / Servicio.

---

## 1. Cómo funciona realmente el sistema (Arquitectura en 30 segundos)

El POS combina **dos piezas que trabajan juntas**:

1. **La Nube (Vercel + Supabase PostgreSQL):** Es la **única fuente de verdad** para ventas, mesas, productos, clientes, sesiones de caja, pagos, inventario y auditoría. Toda operación financiera se ejecuta mediante transacciones atómicas (ACID) en la base de datos.
2. **La App de Escritorio Windows (`ELIANA POS.exe` / `.msi`):** Es un contenedor nativo (Tauri v2 / Rust) que abre el POS en pantalla completa y aporta capacidades que un navegador normal no tiene:
   - **Impresión directa ESC/POS** por red (`IP:9100`) con soporte de tildes y ñ (`CP850`).
   - **Apertura automática del cajón monedero** (pulso RJ11 vía impresora térmica).
   - **Lectura de gramera/báscula** por puerto serial (`COMx`).
   - **Bloqueo de cierre accidental** si hay un turno de caja abierto.
   - **Servidor LAN local en el puerto `4545`** para caché y respaldo de operaciones en la red local del restaurante.

---

## 2. Funcionalidades del POS: Reglas de Negocio, Condiciones y Alcance

### 2.1 Seguridad, Roles y Control de Acceso (RBAC)
El acceso está protegido por sesiones firmadas (`HttpOnly`) y bloqueo total de base de datos (RLS restringido exclusivamente al servidor).

| Rol | Qué puede hacer | Qué tiene bloqueado |
| :--- | :--- | :--- |
| **`ADMIN`** (Dueño / Gerencia) | Acceso total: POS, `/admin-pos`, Torre de Control, creación/liberación de cajas, personal, compras, costeo, inventario, recetas y auditoría. | Nada dentro del sistema. |
| **`GESTOR`** (Supervisor / Encargado) | Opera el POS y autoriza acciones sensibles con su PIN de supervisor. Acceso a módulos de gestión autorizados. | Configuración exclusiva de Administrador (`admin`). |
| **`OPERATIVO_POS`** (Cajero / Mesero / Domiciliario) | Opera el punto de venta (`/pos`): tomar pedidos, imprimir comandas/precuentas, cobrar, registrar ventas. | Bloqueado por servidor (`403`) en `/admin-pos`, compras, costeo, catálogo maestro, operarios y monitoreo. **No puede anular ni devolver sin PIN de supervisor.** |

**Reglas antifraude obligatorias:**
- Toda **anulación de ítem ya comandado**, **anulación de orden completa**, **devolución de ticket/ítem**, **descuento especial** o **apertura de cajón sin venta** exige validación de **PIN de Supervisor en el servidor** (no solo en pantalla).
- Todos los eventos sensibles se graban en la tabla `pos_auditoria_eventos`, la cual es **inmutable a nivel de base de datos** (un trigger en PostgreSQL impide `UPDATE` y `DELETE`, incluso para administradores desde la app).

---

### 2.2 Cajas, Vinculación por Equipo y Turnos
- **Vinculación única (`device_id`):** Cada computador donde se abre el POS genera un identificador único. Al entrar por primera vez, el equipo debe seleccionar una **caja libre** (creada previamente en `/admin-pos`) e ingresar la **contraseña de esa caja**.
- **Regla de exclusividad:** Una caja vinculada a un PC **no puede ser tomada simultáneamente por otro PC** (el sistema devuelve error `409`). Si un PC se daña o se reemplaza, el Administrador debe entrar a `/admin-pos → Cajas` y presionar **"Liberar PC"**.
- **Apertura de turno (`ABRIR_TURNO_CAJA`):** Para facturar o mover efectivo es obligatorio tener un turno abierto con su **base inicial de efectivo**.
- **Protección contra cierre accidental:** Mientras exista un turno abierto, si el cajero intenta cerrar la ventana `X` de la app de escritorio, el sistema intercepta el cierre y exige confirmación para evitar dejar sesiones colgadas.
- **Tipos de cierre:**
  - **Cierre parcial de turno (`CIERRE_PARCIAL_TURNO`):** Relevo de cajero durante el día. Registra arqueo de efectivo, datáfono y transferencias, y calcula automáticamente la `diferencia_cuadre`.
  - **Cierre total de caja (`CIERRE_TOTAL_CAJA`):** Cierre definitivo del día. Consolida el libro de caja diario.
  - **Condición:** Se recomienda no dejar mesas abiertas sin cobrar antes del cierre total del día.

---

### 2.3 Canales de Venta y Gestión de Órdenes
El POS opera 3 canales configurables según el giro del negocio (`RESTAURANTE`, `COMERCIO_RETAIL` o `HIBRIDO`):

1. **Salón / Mesa (`SALON_MESA`):**
   - Organizado por **Zonas** (ej. Salón Principal, Terraza, Kiosco) y **Mesas numeradas**.
   - Una mesa libre pasa automáticamente a `OCUPADA` al agregar el primer producto y vuelve a `LIBRE` al facturar o anular la orden.
   - Permite **cambiar de mesa o canal** (`CAMBIAR_CANAL_ORDEN`) de forma atómica sin perder ítems ni pagos previos.
   - Permite asignar **mesero** y **cliente** a la orden.
2. **Mostrador / Para Llevar (`MOSTRADOR_LLEVAR`):**
   - Tickets rápidos sin ocupar mesa en el mapa del salón.
3. **Domicilios (`DOMICILIO`):**
   - Registra datos de cliente (nombre, teléfono, dirección, barrio), costo de domicilio, domiciliario asignado y seguimiento de estado (`PENDIENTE`, `EN_CAMINO`, `ENTREGADO`, etc.).

**Reglas de ítems y cocina:**
- Cada ítem admite **notas/modificadores de preparación** (ej. *"Término medio, sin cebolla"*).
- **Idempotencia:** Agregar ítems o cobrar usa claves de idempotencia (`idempotency_key`), evitando cobros o pedidos duplicados si el cajero hace doble clic rápido o si falla brevemente el internet.
- **Consecutivo sin bloqueos:** Los consecutivos de factura (`POS-XXXX`) se generan con secuencia PostgreSQL sin bloqueos, permitiendo múltiples cajas cobrando al mismo segundo sin colisiones.

---

### 2.4 Comandas a Cocina y Precuentas
- **Enrutamiento automático por estación:** Al enviar comanda (`ENVIAR_COMANDA`), el sistema clasifica los ítems por categoría/nombre en:
  - `COCINA_PARRILLA`
  - `BEBIDAS_BAR`
  - `POSTRES_ENTRADAS`
- Solo se envían a cocina los **ítems nuevos no comandados** (evitando duplicar platos ya en preparación).
- **Control de precuentas (`IMPRIMIR_PRECUENTA`):** El sistema lleva conteo de cuántas veces se ha impreso la precuenta de una orden (`precuenta_impresa_veces`) para control antifraude.
- **Fallo de impresora:** Si una impresora está apagada, sin papel o desconectada de red, **la venta o comanda NO se pierde**; el POS muestra un aviso visible de error de impresión con botón de **Reintentar impresión**.

---

### 2.5 Cobro (`F12`), Pagos Mixtos, Pagos Parciales, Propinas y Créditos
- **Métodos soportados:** Efectivo, Datáfono (tarjeta), Transferencia (Nequi/Daviplata/Bancolombia) y Crédito/Fiado a cliente registrado.
- **Pagos parciales y división de cuenta (`REGISTRAR_PAGO_PARCIAL`):** Una mesa puede recibir múltiples abonos o pagos divididos por personas/ítems con distintos métodos de pago antes de cerrar el saldo total.
- **Cálculo de cambio/vueltas:** En efectivo, el sistema valida el efectivo recibido y calcula automáticamente el cambio a entregar.
- **Propinas y descuentos:** Soporta propina sugerida configurable (ej. 10%) o monto manual, y descuentos con motivo obligatorio.
- **Créditos / Fiados (`REGISTRAR_ABONO_CREDITO`):** Permite dejar cuentas a crédito asociadas a un cliente y registrar abonos posteriores en caja.

---

### 2.6 Movimientos de Efectivo, Anulaciones y Devoluciones
- **Entradas y salidas de efectivo (`F7` / `F8`):** Permite registrar ingresos adicionales a caja o salidas de efectivo (ej. pago a proveedor menor, domicilios, insumos de urgencia) con motivo obligatorio. Afectan el efectivo esperado del arqueo.
- **Apertura de cajón sin venta:** Dispara el pulso RJ11 al cajón, pero **exige PIN de supervisor y motivo**, quedando grabado en auditoría.
- **Anulación de ítem / orden completa:** Libera la mesa (si aplica), revierte el estado en BD y registra auditoría inmutable.
- **Devoluciones (`DEVOLVER_ITEM_FACTURADO` / `DEVOLVER_TICKET_COMPLETO`):** Permite reversar total o parcialmente un ticket ya cobrado dejando trazabilidad contable.

---

### 2.7 Catálogo Rápido e Inventario en el POS
- Desde `F3` (Productos) y `F4` (Inventario) el personal autorizado puede consultar precios, existencias y hacer ajustes rápidos de stock.
- Al facturar productos con control de inventario activo (`controla_inventario = true`), el sistema descuenta existencias y registra el movimiento en `pos_inventario_movimientos`.

---

### 2.8 Torre de Control y Monitoreo (Solo Administrador)
Ubicada en **`/admin-pos → Torre de Control`**:
- Muestra en vivo (auto-refresco cada 30s): latencia de base de datos, facturación del día, ticket promedio, distribución por método de pago, mesas abiertas > 2 horas, stock crítico (≤ 5 unidades) y últimos 20 eventos de auditoría inmutable.
- **Alertas automáticas en pantalla (Telegram desactivado):**
  - **ALTA:** Descuadre de cierre de caja > \$10.000 COP, anulación/devolución ≥ \$80.000 COP, cajero con ≥ 3 anulaciones en el día, o producto con stock ≤ 0.
  - **MEDIA:** Mesa abierta > 2 horas o producto en stock bajo.
- **Botón "Diagnóstico de Equipo":** Prueba en un clic la nube (`/api/health`), el servidor LAN local (`:4545`), la cola offline, puertos `COM` disponibles y la conectividad TCP con la impresora térmica (`:9100`).

---

### 2.9 Atajos de Teclado del POS (Operación Rápida)
| Tecla | Acción |
| :--- | :--- |
| `F1` | Ir a **Ventas** y enfocar buscador de productos |
| `F2` | Ir a **Mapa de Mesas** (si está habilitado) |
| `Shift + F2` | Ir a **Domicilios** (si está habilitado) |
| `F3` | Ir a **Productos** |
| `F4` | Ir a **Inventario** |
| `F5` | Ir a **Ventas del Día / Historial** |
| `F7` | Registrar **Entrada de Efectivo** a caja |
| `F8` | Registrar **Salida de Efectivo** de caja |
| `F12` | Abrir **Modal de Cobro** de la orden activa |
| `Tab` / `Enter` / `Esc` | Navegar entre zonas (ticket/productos), agregar ítem o cerrar modales |

---

## 3. Cómo Configurar el Punto POS en una Red Local (LAN)

### 3.1 Topología Recomendada
```text
                  [ Router del Restaurante (Internet + LAN) ]
                       ├── IP fija: 192.168.1.50  → PC Caja Principal (ELIANA POS.exe, puerto LAN 4545)
                       ├── IP fija: 192.168.1.51  → PC Caja Auxiliar 2 (opcional)
                       ├── IP fija: 192.168.1.100 → Impresora Térmica Caja (TCP 9100 + Cajón RJ11)
                       ├── IP fija: 192.168.1.101 → Impresora Térmica Cocina (TCP 9100)
                       └── Wi-Fi Privado          → Tablets Meseros (opcional)
```

### 3.2 Pasos Obligatorios en la Red Local
1. **Asignar IPs estáticas (Reserva DHCP en el router):**
   - Fijar la IP local del **PC Caja Principal** (ej. `192.168.1.50`) y de cada **impresora térmica de red** (ej. `192.168.1.100` caja, `192.168.1.101` cocina). Si las IPs cambian al reiniciar el router, dejará de imprimir.
2. **Perfil de red en Windows = "Red Privada":**
   - En el PC de caja: *Configuración → Red e Internet → Propiedades → Perfil de red: **Privada***. (En perfil Público Windows bloquea tráfico LAN).
3. **Abrir el puerto TCP `4545` en Windows Defender Firewall (solo si habrá más de 1 equipo/tablet):**
   - Abrir PowerShell **como Administrador** en el PC Caja Principal y ejecutar:
     ```powershell
     New-NetFirewallRule -DisplayName "Eliana POS LAN" -Direction Inbound -Protocol TCP -LocalPort 4545 -Action Allow -Profile Private
     ```
4. **Configurar la terminal dentro del POS (Botón Configuración / Engranaje en `/pos`):**
   - **Rol del terminal:** `PRINCIPAL` en la caja maestra; `SECUNDARIA` en cajas auxiliares.
   - **IP Caja Principal:** `127.0.0.1:4545` en la caja principal; `192.168.1.50:4545` (la IP real de la principal) en las secundarias.
   - **Impresora térmica:** Ingresar `IP:9100` (ej. `192.168.1.100:9100`) y elegir ancho de papel (`80mm` o `58mm`).
   - **Modelo de cajón monedero (RJ11 conectado a la impresora):** Elegir `EPSON_STD`, `STAR_TSP`, `CITIZEN` o `POSLINE` según la impresora.
   - **Gramera serial (si aplica):** Instalar driver USB-Serial (CH340/FTDI/Prolific), verificar el puerto `COM` en Administrador de Dispositivos de Windows, y configurarlo en el POS (`COM3`, `COM4`, etc.) junto al modelo (`TORREY_MFQ`, `RHINO_BAR`, `CAS_PDII`, `KRETZ`).
   - **Lector de código de barras:** Conectar por USB (funciona en modo teclado HID sin drivers extra; debe estar configurado con sufijo `Enter`).

---

## 4. ¿Qué pasa si instalo el `.exe` / `.msi` en otro computador?

### 4.1 Qué ocurre paso a paso al instalar en un PC nuevo
1. **Windows SmartScreen:** Como el instalador aún no tiene certificado comercial de firma de código, Windows mostrará *"Windows protegió su PC"*. El usuario debe hacer clic en **"Más información" → "Ejecutar de todas formas"**.
2. **Microsoft Edge WebView2:** La app usa el motor WebView2 de Windows (ya viene en Windows 11 y Windows 10 actualizado). En un Windows 10 muy antiguo sin WebView2, el instalador NSIS intentará descargarlo (requiere internet durante la instalación).
3. **Al abrir por primera vez:**
   - El lanzador (`index.html`) valida conexión con `https://lafincaweb.vercel.app/api/health`. Si hay internet, abre el POS.
   - Pide **usuario y contraseña** (los mismos creados en el sistema).
   - Como es un computador nuevo, genera un **`device_id` nuevo** y pide **vincular una caja libre** con su contraseña de caja.

### 4.2 Qué datos SÍ vienen automáticamente y cuáles NO
| Tipo de dato | ¿Viene automáticamente al PC nuevo? | Dónde vive |
| :--- | :---: | :--- |
| Productos, precios, categorías, zonas, mesas, clientes | **SÍ** | Base de datos en la nube (Supabase) |
| Usuarios, roles, PINs, historial de ventas y cierres | **SÍ** | Base de datos en la nube (Supabase) |
| Mesas abiertas en ese instante | **SÍ** | Base de datos en la nube (Supabase) |
| Configuración de periféricos de ese PC (IP de impresora, ancho 80/58mm, modelo de cajón, puerto COM, rol Principal/Secundaria) | **NO** (debe configurarse una vez en ese PC) | Local en ese PC (`localStorage`) |
| Cola de contingencia offline (`eliana_pos_lan_state.json`) | **NO** (pertenece al PC anterior) | Local en `%APPDATA%` de cada PC |

### 4.3 ¿Qué hago si reemplazo un PC dañado que tenía "Caja 1"?
1. Desde cualquier navegador o desde el PC nuevo, entra como **Admin** a `/admin-pos → Cajas`.
2. Haz clic en **"Liberar PC"** en la fila de `Caja 1`.
3. Abre `ELIANA POS` en el PC nuevo, selecciona `Caja 1` (ahora aparecerá libre) e ingresa su contraseña de caja.
4. Configura la IP de la impresora y presiona **"Diagnóstico de Equipo"** en la Torre de Control.

---

## 5. Cómo Poner en Marcha el Sistema desde Cero (Paso a Paso)

### Paso 1: Configuración Administrativa (Web `/admin-pos`)
1. Inicia sesión como **`admin`** en `https://lafincaweb.vercel.app`.
2. **Cajas (`/admin-pos → Cajas`):** Crea al menos `Caja 1` (marcada como Principal) con su contraseña de caja.
3. **Personal (`/admin-pos → Personal`):** Crea usuarios individuales para cada cajero/mesero (`OPERATIVO_POS`) y al menos un supervisor (`GESTOR`) con su PIN. **Nunca compartas el usuario `admin` en caja.**
4. **Zonas y Mesas (`/admin-pos → Zonas y Mesas`):** Crea tus zonas reales y numera tus mesas.
5. **Catálogo (`/productos-venta` y `/admin-pos → Categorías`):** Verifica precios vigentes, categorías e ítems que controlan stock.

### Paso 2: Instalación y Validación en el PC de Caja
1. Instala `ELIANA POS` (`.exe` o `.msi`) en el PC de caja.
2. Asigna IP estática en el router al PC y a las impresoras térmicas.
3. Abre `ELIANA POS`, inicia sesión y vincula `Caja 1`.
4. Configura identidad comercial (Nombre, NIT, Dirección, Teléfono, mensaje pie de ticket) e IP de impresora (`IP:9100`).
5. **Ejecuta el Smoke Test automático** en PowerShell (opcional pero muy recomendado):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/smoke-test-pos.ps1 -PrinterIp "192.168.1.100"
   ```
   O entra a **`/admin-pos → Torre de Control`** y haz clic en **"Diagnóstico de Equipo"**. Todo debe quedar en verde (`PASS`).

### Paso 3: Simulacro de Turno (Antes de atender al primer cliente real)
1. Abre turno con una base de prueba.
2. Crea 1 pedido en Mesa, envía comanda a cocina y verifica que imprima con tildes/ñ limpias.
3. Cobra con `F12` en efectivo y verifica que el cajón monedero abra automáticamente.
4. Prueba una anulación con PIN de supervisor y confirma que aparece en `Torre de Control → Auditoría`.
5. Haz un cierre de caja y verifica que los totales cuadren.

---

## 6. Alcance Real: Qué PUEDE hacer y Qué NO PUEDE hacer hoy el POS

### Lo que SÍ PUEDE hacer el sistema hoy
- Operar múltiples cajas simultáneas en tiempo real sin colisiones de consecutivos ni descuadres de BD (RPCs ACID + idempotencia).
- Gestionar salón por zonas/mesas, mostrador para llevar y domicilios con costos y estados.
- Enviar comandas segmentadas por estación (cocina/bar/postres) y controlar precuentas.
- Cobrar en efectivo, datáfono (registro manual del valor), transferencia, pago mixto, pago parcial/dividido, propinas, descuentos y crédito/fiado.
- Imprimir tirillas térmicas ESC/POS por red TCP (`:9100`) en 80mm o 58mm con tildes y ñ (`CP850`) y disparar apertura de cajón RJ11.
- Leer peso desde grameras seriales (`COMx`) compatibles y leer códigos de barras USB HID.
- Proteger la operación contra fraude: RBAC estricto en servidor, PIN de supervisor validado en backend, auditoría inmutable en PostgreSQL y bloqueo RLS en las 20 tablas críticas.
- Monitorear en vivo desde la **Torre de Control** (ventas, salud de BD, alertas antifraude y diagnóstico de hardware).
- Soportar cortes breves de internet **si el POS ya estaba abierto**, encolando en el servidor LAN local (`:4545`).

### Lo que NO PUEDE hacer el sistema hoy (Limitaciones reales actuales)
1. **No emite Factura Electrónica ante la DIAN:** Genera tickets/facturas internas POS y control contable interno, pero **no** transmite XML/CUFE a la DIAN ni se conecta a un proveedor tecnológico de facturación electrónica.
2. **No imprime ESC/POS directo por cable USB puro:** El motor nativo Rust solo imprime raw ESC/POS a impresoras conectadas por **Ethernet o Wi-Fi (TCP `:9100`)**. Si conectas una impresora solo por USB, caerá al diálogo de impresión normal de Windows (más lento y **sin apertura automática del cajón RJ11**).
3. **No arranca en frío sin internet:** Si enciendes el computador de caja en la mañana y no hay internet en el local, la pantalla de inicio esperará conexión (reintentando cada 10s), pero no cargará la interfaz completa hasta que vuelva la red al menos una vez.
4. **No se conecta directamente al datáfono bancario:** El cajero cobra en el datáfono físico del banco (Bold, Redeban, Credibanco, etc.) y digita/confirma el monto en el POS.
5. **No envía alertas automáticas a Telegram (desactivado por decisión operativa):** Todas las alertas antifraude, descuadres y stock crítico se muestran únicamente en la **Torre de Control** dentro de `/admin-pos`.
6. **No se auto-actualiza sola la app de escritorio (`.exe`):** Los cambios web (pantallas, precios, lógica en Vercel) se actualizan solos al recargar, pero cambios en la app nativa Windows (`.exe`) requieren descargar e instalar el nuevo instalador manualmente.
7. **Solo soporta Windows para la app de escritorio:** El instalador nativo (`.exe` / `.msi`) está empaquetado para Windows 10/11 (en macOS/Android/iPad se puede usar vía navegador web, pero sin puente directo de impresora TCP `:9100`, cajón RJ11 ni gramera serial).
