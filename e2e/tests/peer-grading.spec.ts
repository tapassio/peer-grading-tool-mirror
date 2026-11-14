import { expect, test } from '@playwright/test';
import { loginAsAdmin, testData } from './helpers';

// one after the other: the lecturer checks what the student submitted
test.describe.serial('Bewerten durch Studierende', () => {
  const anna = testData.peers[0];

  test('Formular über den persönlichen Link, ohne Login', async ({ page }) => {
    await page.goto(`de/peer-grading/${anna.link}`);
    await expect(page.locator('main h1')).toContainText(`${anna.lastName} ${anna.firstName}`);
    await expect(page.locator('pgt-single-row')).toHaveCount(testData.peers.length);
  });

  test('Durchschnitt beim Tippen, Absenden mit Bestätigung', async ({ page }) => {
    await page.goto(`de/peer-grading/${anna.link}`);
    const inputs = page.locator('pgt-single-row input');
    await expect(inputs).toHaveCount(testData.peers.length);
    for (let i = 0; i < testData.peers.length; i++) {
      await inputs.nth(i).fill('4.5');
    }
    await expect(page.locator('pgt-single-row').first()).toContainText(/4[.,]5/);

    await page.getByRole('button', { name: 'Senden' }).click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toContainText('nicht mehr bearbeitet');
    await dialog.getByRole('button', { name: 'Senden' }).click();
    // saved, even though no mail can be sent in the test (fake SendGrid key)
    await expect(page.locator('mat-snack-bar-container')).toContainText(
      'Gradings erfolgreich gesendet'
    );
    await expect(inputs.first()).toBeDisabled();
  });

  test('unbekannter Link führt zur Fehlerseite', async ({ page }) => {
    await page.goto('de/peer-grading/gibt-es-nicht');
    await expect(page).toHaveURL(/error\/404/);
  });

  test('die Lehrperson sieht die Bewertung und die Note', async ({ page }) => {
    await loginAsAdmin(page);
    await page
      .locator('pgt-campaign', { hasText: testData.campaign.name })
      .getByRole('button', { name: 'Anschauen' })
      .click();
    await expect(page).toHaveURL(/campaign-summary\/\d+/);
    const summary = page.locator('pgt-campaign-group-summary');
    await expect(summary).toContainText('Note');
    // Anna gave 4.5 to the other two: their grade is 4.5
    await expect(summary).toContainText('4.5');
    await expect(summary).toContainText('Peers mit ausstehenden Gradings');
  });
});
