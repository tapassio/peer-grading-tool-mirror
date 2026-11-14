import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { loginAsAdmin } from './helpers';

const csv = resolve(__dirname, '../../testdata/klasse-b-34-studierende.csv');

test.describe('Kampagne erstellen', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByText('Neue Kampagne').click();
    await expect(page).toHaveURL(/create-campaign$/);
  });

  test('Standardwerte: Schweizer Skala, halbe Noten', async ({ page }) => {
    await expect(page.locator('input[formcontrolname=maxPoints]')).toHaveValue('6');
    await expect(page.locator('select[formcontrolname=gradeRounding]')).toContainText(
      'Halbe Noten'
    );
  });

  test('Kriterium hinzufügen und löschen', async ({ page }) => {
    const rows = page.locator('pgt-criteria table tr');
    const before = await rows.count();
    const inputs = page.locator('pgt-criteria input');
    await inputs.nth(0).fill('Pünktlichkeit');
    await inputs.nth(1).fill('2');
    await page.locator('pgt-criteria button', { hasText: 'Hinzufügen' }).click();
    await expect(rows).toHaveCount(before + 1);
    await page.locator('pgt-criteria tr', { hasText: 'Pünktlichkeit' }).getByRole('button').click();
    await expect(rows).toHaveCount(before);
  });

  test('Sprachwechsel setzt die Kriterien auf Englisch zurück', async ({ page }) => {
    await page.locator('select[formcontrolname=language]').selectOption('en');
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toContainText('Sprache geändert');
    await dialog.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.locator('pgt-criteria')).toContainText('Teamworking skills');
  });

  test('CSV-Import, Person hinzufügen, Gruppe löschen', async ({ page }) => {
    await page.locator('input[type=file]').setInputFiles(csv);
    const groups = page.locator('pgt-group');
    await expect(groups).toHaveCount(8);

    const first = groups.first();
    await first.locator('mat-expansion-panel-header').click();
    const peerRows = first.locator('tr');
    const before = await peerRows.count();
    await first.getByRole('button', { name: 'Person hinzufügen' }).click();
    await expect(peerRows).toHaveCount(before + 1);

    await first.getByRole('button', { name: 'Gruppe löschen', exact: true }).click();
    await expect(groups).toHaveCount(7);
  });

  test('Kampagne speichern', async ({ page }) => {
    await page.locator('input[formcontrolname=name]').fill('E2E neue Kampagne');
    await page.locator('input[type=file]').setInputFiles(csv);
    await expect(page.locator('pgt-group')).toHaveCount(8);
    await page.getByRole('button', { name: 'Speichern' }).click();
    // a dialog may ask for confirmation
    const dialog = page.locator('mat-dialog-container');
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('button').first().click();
    }
    await expect(page).toHaveURL(/campaign-summary\/\d+/);
    await expect(page.locator('main')).toContainText('E2E neue Kampagne');
    await expect(page.locator('pgt-campaign-group-summary')).toHaveCount(8);
  });
});
