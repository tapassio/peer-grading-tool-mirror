import { expect, Page } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const data = require('../scripts/data.cjs');

export const testData: {
  admin: { email: string; password: string; firstName: string; lastName: string };
  campaign: { name: string; maxPoints: number; criteria: string[] };
  peers: { firstName: string; lastName: string; email: string; link: string }[];
} = data;

/** logs in through the login form (German version) */
export async function login(page: Page, password = testData.admin.password) {
  await page.goto('de/login');
  await page.locator('input[formcontrolname=email]').fill(testData.admin.email);
  await page.locator('input[type=password]').fill(password);
  await page.keyboard.press('Enter');
}

export async function loginAsAdmin(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/admin-dashboard/);
}
