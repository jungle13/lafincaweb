import { test, expect } from '@playwright/test';
import { createInitialMockState, setupPosMocks } from './helpers/mockPosBackend';

test.describe('Módulo 9: App de Escritorio Autónoma (Sin depender de Vercel) y Modo Offline', () => {
  test('M9-01: Abre pos-desktop con internet, cachea sesión y luego arranca 100% sin internet', async ({ page }) => {
    const state = createInitialMockState({ sesionAbierta: true });
    await setupPosMocks(page, state);

    // 1. Primera apertura con internet en el bundle compilado del escritorio (:4173)
    await page.goto('http://localhost:4173');
    await page.getByPlaceholder(/Ej: admin/i).fill('admin');
    await page.getByPlaceholder('••••').fill('123');
    await page.getByRole('button', { name: /Ingresar al POS/i }).click();

    await expect(page.getByText('Punta de Anca 350g').first()).toBeVisible({ timeout: 10000 });

    // 2. Simular corte total de internet hacia la nube (/api/*) manteniendo vivo el disco local del .exe (:4173)
    await page.unroute('**/api/**');
    await page.route('**/api/**', async (route) => {
      await route.abort('internetdisconnected');
    });

    // 3. Recargar la app de escritorio SIN internet -> debe abrir directo desde disco y caché local
    await page.reload();
    await expect(page.getByText('Punta de Anca 350g').first()).toBeVisible({ timeout: 10000 });
  });
});
