import { test, expect } from '@playwright/test';

test.describe('Módulo 8: Libro de Caja Coherente con POS y sin Botones de Cierre Duplicados', () => {
  test('M8-03 / M8-04: Muestra cuadre paso a paso, bitácora y NO muestra Hojas por Fecha ni Cierres', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, success: true, user: { username: 'admin', name: 'Admin QA', role: 'ADMIN' } }),
      });
    });

    await page.route('**/api/libros-apoyo**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          kpis: {
            totalSalidasMes: 0,
            totalCostosInsumos: 0,
            totalGastosOperativos: 0,
            totalTurnosNomina: 0,
            totalPrestamosAnticipos: 0,
            totalAjustesMes: 0,
            totalRegistros: 0,
            totalDiasActivos: 1,
            porCategoria: [],
            porResponsable: [],
          },
          diarios: [
            {
              id: 'd1',
              fecha: '2026-11-25',
              dia_mes: 25,
              tipo_libro: 'CAJA_MENOR',
              periodo_id: 'per-2026-10',
              base_inicial: 500000,
              venta_efectivo_pos: 153816,
              venta_pos_total: 153816,
              total_datafonos: 0,
              total_otros_medios: 0,
              total_costos_insumos: 0,
              total_gastos_operativos: 0,
              total_turnos_nomina: 0,
              total_salidas: 0,
              total_ajustes: 0,
              efectivo_fisico_cierre: 655000,
              diferencia_cuadre: 1184,
              responsables_dia: 'ADMIN',
              estado: 'ABIERTA',
              observaciones: '',
            },
          ],
          registros: [
            {
              id: 'r1',
              fecha: '2026-11-25',
              dia_mes: 25,
              orden_item: 1,
              tipo_libro: 'CAJA_MENOR',
              periodo_id: 'per-2026-10',
              clasificacion: 'Gasto Operativo',
              categoria: 'Hielo y Gas',
              concepto: 'Bolsas de hielo',
              descripcion_beneficiario: '',
              valor_pagado: 15000,
              soporte_factura: 'RC-00001',
              responsable_caja: 'ADMIN',
              proveedor_fuente: '',
              usuario_registro: 'ADMIN',
              caja_nombre: 'CAJA PRINCIPAL',
            },
          ],
          sesiones: [
            {
              id: 's1',
              fecha: '2026-11-25',
              caja_nombre: 'CAJA PRINCIPAL',
              cajero_nombre: 'ADMIN',
              usuario_username: 'admin',
              efectivo_inicial: 500000,
              efectivo_cierre: 655000,
              valor_datafonos: 0,
              valor_otros_medios: 0,
              total_salidas: 15000,
              total_ajustes: 0,
              venta_pos: 153816,
              diferencia_cuadre: 16184,
              estado: 'CERRADA_PARCIAL',
              numero_turno: 1,
              hora_apertura: '2026-11-25T13:00:00Z',
              hora_cierre: '2026-11-25T15:00:00Z',
              duracion_minutos: 120,
            },
          ],
          usuarios: [],
          categorias: ['Hielo y Gas'],
          responsables: ['ADMIN'],
          conceptosSugeridos: [],
          posDiaResumen: {
            fecha: '2026-11-25',
            cantidadOrdenes: 4,
            totalVendidoPos: 153816,
            ventasEfectivo: { monto: 153816, cantidad: 4 },
            ventasDatafono: { monto: 0, cantidad: 0 },
            ventasTransferencia: { monto: 0, cantidad: 0 },
            ventasCredito: { monto: 0, cantidad: 0 },
            baseInicial: 500000,
            entradasEfectivo: 0,
            salidasEfectivo: 15000,
            efectivoEsperado: 638816,
            efectivoContado: 655000,
            diferenciaEfectivo: 16184,
            porSesion: {},
          },
          bitacoraDia: [
            {
              id: 'b1',
              ts: '2026-11-25T14:00:00Z',
              hora: '09:00',
              tipo: 'SALIDA',
              titulo: 'Gasto Operativo: Bolsas de hielo',
              detalle: 'Hielo y Gas',
              usuario: 'ADMIN',
              monto: 15000,
              soporte: 'RC-00001',
            },
          ],
        }),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem(
        'eliana_auth_session',
        JSON.stringify({ username: 'admin', name: 'Admin QA', role: 'ADMIN' })
      );
      localStorage.setItem('caja_active_tab_id', JSON.stringify('2026-11-25'));
      localStorage.setItem('caja_open_tabs', JSON.stringify(['2026-11-25']));
    });

    await page.goto('/libros-apoyo');

    // Abrir Noviembre 2026 y luego la hoja del día 2026-11-25
    const abrirNov = page.getByRole('button', { name: 'Abrir' }).first();
    await expect(abrirNov).toBeVisible({ timeout: 10000 });
    await abrirNov.click();

    const filaDia = page.getByRole('row', { name: /2026-11-25/i });
    await expect(filaDia).toBeVisible({ timeout: 10000 });
    await filaDia.click();

    await expect(page.getByText('Cuadre de Efectivo en Caja (2026-11-25)')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Bitácora Cronológica del Día (1 eventos)')).toBeVisible();
    await expect(page.getByText('RC-00001').first()).toBeVisible();

    // Verificar que NO existen botones de cierre duplicados ni Hojas por Fecha
    await expect(page.getByText('Hojas por Fecha')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Cierre Parcial \(Entregar Turno\)/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Guardar Arqueo Admin/i })).toHaveCount(0);
  });
});
