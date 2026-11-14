import { expect, test } from '@playwright/test';
import { login, loginAsAdmin, testData } from './helpers';

test.describe('Login und Sitzung', () => {
  test('falsches Passwort zeigt eine Meldung', async ({ page }) => {
    await login(page, 'falsches-passwort');
    await expect(page.locator('mat-snack-bar-container')).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });

  test('Login zeigt den Namen in der Kopfzeile', async ({ page }) => {
    await page.goto('de/login');
    // public page: nobody logged in
    await expect(page.locator('.user-pill')).toHaveCount(0);
    await loginAsAdmin(page);
    await expect(page.locator('.user-pill')).toContainText(
      `${testData.admin.firstName} ${testData.admin.lastName}`
    );
    await expect(page.locator('pgt-header')).toContainText('Kampagnen');
  });

  test('Tokens: nichts im localStorage, Refresh-Token als HttpOnly-Cookie', async ({ page, context }) => {
    await loginAsAdmin(page);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).not.toContain('accessToken');
    expect(keys).not.toContain('refreshToken');
    const cookie = (await context.cookies()).find((c) => c.name === 'pgt_refresh');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
    expect(cookie?.path).toBe('/tc/PeerGrading/api/auth');
  });

  test('nach dem Neuladen bleibt man angemeldet', async ({ page }) => {
    await loginAsAdmin(page);
    await page.reload();
    await expect(page).toHaveURL(/admin-dashboard/);
    await expect(page.locator('.user-pill')).toBeVisible();
  });

  test('Logout', async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('.user-pill')).toHaveCount(0);
    // protected page: back to the login
    await page.goto('de/admin-dashboard');
    await expect(page).toHaveURL(/login/);
  });
});
