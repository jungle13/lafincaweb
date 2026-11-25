import { test, expect } from '@playwright/test';
import { createInitialMockState, setupPosMocks } from './helpers/mockPosBackend';

test.describe('Módulo 1 y 2: Autenticación, Apertura de Turno y Bloqueo Hermético', () => {
  test('M2-01 / M2-02: Bloquea POS sin turno abierto y permite abrir turno con base inicial', async ({ page }) => {
    const state = createInitialMockState({ sesionAbierta: false });
    await setupPosMocks(page, state);

    await page.goto('/pos');
    await expect(page.getByText(/Abrir Turno|Base Inicial/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('••••••••').fill('1234');
    const btnAbrir = page.getByRole('button', { name: /Abrir Turno en Caja/i });
    await expect(btnAbrir).toBeVisible();
    await btnAbrir.click();

    await expect(page.getByText('Punta de Anca 350g').first()).toBeVisible({ timeout: 10000 });
    expect(state.lastActions.some((a) => a.action === 'ABRIR_TURNO_CAJA')).toBe(true);
  });
});
