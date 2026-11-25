import { test, expect } from '@playwright/test';
import { createInitialMockState, setupPosMocks } from './helpers/mockPosBackend';

test.describe('Módulo 3, 4 y 5: Ventas F1, Mesas F2 y Cobro F12', () => {
  test('M3-01 / M5-01: Agrega producto al carrito y cobra en efectivo con F12', async ({ page }) => {
    const state = createInitialMockState({ sesionAbierta: true });
    await setupPosMocks(page, state);

    await page.goto('/pos');
    const prodCard = page.getByText('Punta de Anca 350g').first();
    await expect(prodCard).toBeVisible({ timeout: 10000 });
    await prodCard.click();

    // Verifica que aparece en el ticket activo
    await expect(page.getByText(/48\.000/).first()).toBeVisible();

    // Abre modal de cobro haciendo clic en F12 - Cobrar
    await page.getByRole('button', { name: 'F12 - Cobrar' }).click();
    await expect(page.getByText(/F12 — Cobrar \/ Cerrar/i)).toBeVisible({ timeout: 5000 });

    const btnCobrar = page.getByRole('button', { name: 'Cobrar', exact: true });
    await btnCobrar.click();

    // Segundo paso del cajón en 2 pasos: Confirmar Pago e Imprimir Ticket
    const btnConfirmar = page.getByRole('button', { name: /Confirmar Pago e Imprimir Ticket/i });
    await expect(btnConfirmar).toBeVisible({ timeout: 5000 });
    await btnConfirmar.click();

    await expect.poll(() => state.lastActions.some((a) => a.action === 'FACTURAR_ORDEN')).toBe(true);
  });
});
