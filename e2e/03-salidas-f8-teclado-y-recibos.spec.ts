import { test, expect } from '@playwright/test';
import { createInitialMockState, setupPosMocks } from './helpers/mockPosBackend';

test.describe('Módulo 7: Salidas F8, Recibos de Caja RC-XXXXX y Navegación con Flechas', () => {
  test('M7-06 / M7-07: Navega con flechas hacia Préstamo / Anticipo, registra salida y genera RC-00001', async ({ page }) => {
    const state = createInitialMockState({ sesionAbierta: true });
    await setupPosMocks(page, state);

    await page.goto('/pos');
    await expect(page.getByText('Punta de Anca 350g').first()).toBeVisible({ timeout: 10000 });

    // Abrir modal F8 con atajo de teclado
    await page.keyboard.press('F8');
    await expect(page.getByText('F8 — Salida con Recibo de Caja')).toBeVisible();

    // Seleccionar Préstamo / Anticipo usando flechas de teclado desde Gasto Operativo
    const gastoBtn = page.getByRole('button', { name: /Gasto Operativo/i });
    await gastoBtn.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/sin contaminar gastos ni el P&G/i)).toBeVisible();

    // Llenar empleado, descripción y monto con Enter
    await page.getByPlaceholder(/Nombre del empleado/i).fill('Carlos Parrillero');
    await page.getByPlaceholder(/motivo del préstamo/i).fill('Anticipo calamidad');
    const montoInput = page.getByPlaceholder('Monto ($ COP)');
    await montoInput.fill('80000');
    await montoInput.press('Enter');

    await expect(page.getByText(/Recibo de Caja Generado — RC-00001/i)).toBeVisible({ timeout: 5000 });
    const salidaAction = state.lastActions.find((a) => a.action === 'MOVIMIENTO_EFECTIVO_CAJA');
    expect(salidaAction?.payload?.clasificacion).toBe('Préstamo / Anticipo');
    expect(salidaAction?.payload?.descripcion_beneficiario).toBe('Carlos Parrillero');
  });

  test('M7-04: Permite crear insumo rápido en Costo / Insumo y generar RC-00001', async ({ page }) => {
    const state = createInitialMockState({ sesionAbierta: true });
    await setupPosMocks(page, state);

    await page.goto('/pos');
    await expect(page.getByText('Punta de Anca 350g').first()).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('F8');
    await page.getByRole('button', { name: /Costo \/ Insumo/i }).click();

    const searchInsumo = page.getByPlaceholder(/Buscar insumo existente/i);
    await searchInsumo.fill('Cilantro Fresco');
    await page.getByRole('button', { name: /Crear insumo rápido/i }).click();
    await page.getByRole('button', { name: /Guardar y Usar/i }).click();

    expect(state.lastActions.some((a) => a.action === 'CREAR_INSUMO_RAPIDO_POS')).toBe(true);

    await page.getByPlaceholder('Ej: 5').fill('4');
    await page.getByPlaceholder('$ Total').fill('20000');
    await expect(page.getByText(/\$5\.000/)).toBeVisible();
    await page.getByRole('button', { name: /Registrar Salida y Generar Recibo/i }).click();

    await expect(page.getByText(/Recibo de Caja Generado — RC-00001/i)).toBeVisible();
  });
});
