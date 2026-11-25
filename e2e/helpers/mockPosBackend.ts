import type { Page } from '@playwright/test';

export interface MockPosState {
  role: 'ADMIN' | 'OPERATIVO_POS';
  sesionAbierta: boolean;
  ordenes: any[];
  mesas: any[];
  salidas: any[];
  reciboSeq: number;
  lastActions: Array<{ action: string; payload: any }>;
  requireSupervisorPinOnCancel: boolean;
}

export function createInitialMockState(
  overrides: Partial<MockPosState> = {}
): MockPosState {
  return {
    role: 'ADMIN',
    sesionAbierta: true,
    ordenes: [],
    mesas: [
      { id: 'm1', numero: 1, nombre: 'Mesa 1', zona: 'Salón Principal', capacidad: 4, estado: 'LIBRE' },
      { id: 'm2', numero: 2, nombre: 'Mesa 2', zona: 'Salón Principal', capacidad: 4, estado: 'LIBRE' },
    ],
    salidas: [],
    reciboSeq: 1,
    lastActions: [],
    requireSupervisorPinOnCancel: true,
    ...overrides,
  };
}

export async function setupPosMocks(page: Page, state: MockPosState) {
  const productos = [
    {
      id: 'prod-1',
      codigo: '001',
      nombre: 'Punta de Anca 350g',
      categoria: 'CARNES',
      precio_total: 48000,
      precio_neto: 48000,
      activo: true,
      existencia: 25,
      controla_inventario: true,
    },
    {
      id: 'prod-2',
      codigo: '002',
      nombre: 'Limonada Natural',
      categoria: 'BEBIDAS',
      precio_total: 8000,
      precio_neto: 8000,
      activo: true,
      existencia: 50,
      controla_inventario: true,
    },
  ];

  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 'healthy', dbLatencyMs: 12 }),
    });
  });

  await page.route('**/api/empresa', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, empresa: { nombre_comercial: 'La Finca QA' } }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        success: true,
        user: {
          username: state.role === 'ADMIN' ? 'admin' : 'cajero1',
          name: state.role === 'ADMIN' ? 'Admin QA' : 'Cajero QA',
          role: state.role,
        },
      }),
    });
  });

  await page.addInitScript((role: string) => {
    localStorage.setItem(
      'eliana_auth_session',
      JSON.stringify({
        username: role === 'ADMIN' ? 'admin' : 'cajero1',
        name: role === 'ADMIN' ? 'Admin QA' : 'Cajero QA',
        role,
      })
    );
  }, state.role);

  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON() || {};
    const passOk = body.password === '123';
    if (!passOk) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Usuario o contraseña incorrectos.' }),
      });
      return;
    }
    const crypto = await import('crypto');
    const uname = String(body.username || 'admin').toLowerCase();
    const passHash = crypto.createHash('sha256').update(`${uname}:123`).digest('hex');
    const pinHash = crypto.createHash('sha256').update(`pin:${uname}:9999`).digest('hex');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        token: 'qa-token.sig',
        user: { username: uname, name: 'Usuario QA', role: state.role },
        offlineUsers: [
          { username: uname, name: 'Usuario QA', role: state.role, passHash, pinHash },
        ],
      }),
    });
  });

  await page.route('**/api/pos**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());

    if (req.method() === 'GET') {
      if (url.searchParams.get('scope') === 'salidas_catalog') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            insumos: [
              { id: 'ins-1', codigo: 'INS-01', nombre: 'Hielo en Cubos', categoria: 'BEBIDAS', unidad_medida: 'Paq' },
              { id: 'ins-2', codigo: 'INS-02', nombre: 'Carbón Vegetal', categoria: 'INSUMOS VARIOS', unidad_medida: 'Bulto' },
            ],
            empleados: [
              { id: 'emp-1', nombre_cajero: 'Carlos Parrillero', username: 'carlos', cargo_area: 'Parrilla' },
              { id: 'emp-2', nombre_cajero: 'María Mesera', username: 'maria', cargo_area: 'Salón' },
            ],
            conceptosGastoRecientes: ['Recibo energía', 'Domicilio urgente'],
            categoriasGastoRecientes: [],
          }),
        });
        return;
      }

      const sesion = state.sesionAbierta
        ? {
            id: 'ses-qa-1',
            fecha: '2026-11-25',
            caja_nombre: 'CAJA PRINCIPAL',
            cajero_nombre: 'Admin QA',
            efectivo_inicial: 500000,
            estado: 'ABIERTA',
            numero_turno: 1,
            hora_apertura: new Date().toISOString(),
          }
        : null;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          mesas: state.mesas,
          ordenes: state.ordenes,
          productos,
          sesiones: sesion ? [sesion] : [],
          sesionActiva: sesion,
          salidasDiaCaja: state.salidas.reduce((a, s) => a + Number(s.valor_pagado || 0), 0),
          abonosEfectivoHoy: 0,
          entradasEfectivoHoy: 0,
          devolucionesEfectivoHoy: 0,
          eventosTurno: [],
          creditosClientes: [],
          devolucionesDia: [],
          corteDepartamentos: [],
          flujoEfectivoDetallado: [],
          consumosInternosHoy: [],
          gananciaEstimadaHoy: 0,
          categorias: [
            { id: 'cat-1', nombre: 'CARNES', es_inventariable: true, orden: 1 },
            { id: 'cat-2', nombre: 'BEBIDAS', es_inventariable: true, orden: 2 },
          ],
          zonas: [{ id: 'z1', nombre: 'Salón Principal', orden: 1 }],
          clientes: [],
          cajasAbiertasHoy: ['CAJA PRINCIPAL'],
        }),
      });
      return;
    }

    // POST /api/pos
    const body = req.postDataJSON() || {};
    const action = String(body.action || '');
    state.lastActions.push({ action, payload: body });

    if (action === 'ABRIR_TURNO_CAJA') {
      state.sesionAbierta = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (action === 'CREAR_INSUMO_RAPIDO_POS') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          insumo: {
            id: `ins-${Date.now()}`,
            codigo: 'INS-999',
            nombre: body.nombre,
            categoria: body.categoria || 'INSUMOS VARIOS',
            unidad_medida: body.unidad_medida || 'Und',
          },
        }),
      });
      return;
    }

    if (action === 'ABRIR_O_AGREGAR_ORDEN') {
      const prod = productos.find((p) => p.id === body.producto_id) || productos[0];
      let orden = state.ordenes.find((o) => o.id === body.orden_id);
      const qty = Number(body.cantidad || 1);
      const sub = qty * Number(body.precio_unitario || prod.precio_total);
      const item = {
        id: `it-${Date.now()}-${Math.random()}`,
        producto_id: prod.id,
        nombre_producto: prod.nombre,
        cantidad: qty,
        precio_unitario: prod.precio_total,
        subtotal: sub,
        estado_comanda: 'PENDIENTE',
        notas: body.notas || '',
      };

      if (!orden) {
        orden = {
          id: `ord-${Date.now()}`,
          consecutivo: `POS-${String(state.ordenes.length + 1).padStart(4, '0')}`,
          fecha: '2026-11-25',
          canal_venta: body.canal_venta || 'MOSTRADOR_LLEVAR',
          mesa_numero: body.mesa_numero || null,
          estado: 'ABIERTA',
          subtotal_bruto: sub,
          descuento: 0,
          propina: 0,
          costo_domicilio: 0,
          gran_total: sub,
          items: [item],
          pagos: [],
        };
        state.ordenes.unshift(orden);
      } else {
        orden.items.push(item);
        orden.subtotal_bruto += sub;
        orden.gran_total = orden.subtotal_bruto - (orden.descuento || 0) + (orden.propina || 0);
      }

      if (body.mesa_numero) {
        const m = state.mesas.find((x) => x.numero === body.mesa_numero);
        if (m) m.estado = 'OCUPADA';
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, orden }),
      });
      return;
    }

    if (action === 'FACTURAR_ORDEN') {
      const orden = state.ordenes.find((o) => o.id === body.orden_id);
      if (orden) {
        orden.estado = 'FACTURADA';
        orden.metodo_pago = body.metodo_pago || 'EFECTIVO';
        orden.pago_efectivo = Number(body.pago_efectivo || 0);
        orden.pago_datafono = Number(body.pago_datafono || 0);
        orden.pago_transferencia = Number(body.pago_transferencia || 0);
        orden.cambio_entregado = Number(body.cambio_entregado || 0);
        if (orden.mesa_numero) {
          const m = state.mesas.find((x) => x.numero === orden.mesa_numero);
          if (m) m.estado = 'LIBRE';
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, orden }),
      });
      return;
    }

    if (action === 'ANULAR_ORDEN_COMPLETA') {
      if (state.requireSupervisorPinOnCancel && state.role === 'OPERATIVO_POS' && body.supervisor_pin !== '9999') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            code: 'SUPERVISOR_PIN_REQUIRED',
            error: 'Requiere PIN de Supervisor válido.',
          }),
        });
        return;
      }
      const orden = state.ordenes.find((o) => o.id === body.orden_id);
      if (orden) {
        orden.estado = 'ANULADA';
        if (orden.mesa_numero) {
          const m = state.mesas.find((x) => x.numero === orden.mesa_numero);
          if (m) m.estado = 'LIBRE';
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (action === 'MOVIMIENTO_EFECTIVO_CAJA') {
      const rc = `RC-${String(state.reciboSeq++).padStart(5, '0')}`;
      const recibo = {
        consecutivo: rc,
        fecha: '2026-11-25',
        hora: '13:30',
        cajaNombre: 'CAJA PRINCIPAL',
        cajeroNombre: 'Admin QA',
        clasificacion: body.clasificacion || 'Gasto Operativo',
        categoria: body.categoria || 'Servicios Públicos',
        concepto: body.concepto,
        beneficiario: body.descripcion_beneficiario || '',
        cantidad: body.cantidad ?? null,
        unidadMedida: body.unidad_medida ?? null,
        costoUnitario: body.cantidad ? Math.round(Number(body.monto) / Number(body.cantidad)) : null,
        valor: Number(body.monto),
      };
      if (body.tipo === 'SALIDA') {
        state.salidas.push({
          id: `sal-${Date.now()}`,
          soporte_factura: rc,
          clasificacion: recibo.clasificacion,
          categoria: recibo.categoria,
          concepto: recibo.concepto,
          valor_pagado: recibo.valor,
        });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, tipo: body.tipo, monto: recibo.valor, recibo }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // Registrar rutas más específicas al final para que tengan prioridad en Playwright
  await page.route('**/api/pos/cajas**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        bound: true,
        caja: { id: 'caja-qa-1', nombre: 'CAJA PRINCIPAL', es_principal: true, activa: true },
        boundCaja: { id: 'caja-qa-1', nombre: 'CAJA PRINCIPAL', es_principal: true, activa: true },
        cajasLibres: [],
      }),
    });
  });
}
