import { expect, test } from '@playwright/test';
import { loginAsAdmin, testData } from './helpers';

test.describe('Weitere Seiten', () => {
  test('Statistik', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Statistik' }).click();
    await expect(page).toHaveURL(/statistics/);
    await expect(page.locator('main')).toContainText('Übersicht');
  });

  test('Profil lädt die Benutzerdaten', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('link', { name: 'Profil' }).click();
    await expect(page.locator('main')).toContainText(testData.admin.email);
  });

  test('englische Version', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('en/admin-dashboard');
    await expect(page.locator('main h1')).toHaveText(/campaigns/i);
  });

  test('unbekannte Seite zeigt die Fehlerseite', async ({ page }) => {
    await page.goto('de/gibt-es-nicht');
    await expect(page).toHaveURL(/error\/404/);
    await expect(page.locator('main')).toContainText('Fehler bei Ihrer Anfrage');
  });

  test('Toolchain-Manifest', async ({ request }) => {
    const res = await request.get('manifest.json');
    expect(res.ok()).toBe(true);
    expect(res.headers()['access-control-allow-origin']).toBe('*');
  });
});
