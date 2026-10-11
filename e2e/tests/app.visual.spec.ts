import type { Page } from '@playwright/test';

import { expect, holdTelemetry, signInToApp, test } from '../support/fixtures';
import { expectVisuallySound } from '../support/layout';
import { URLS } from '../support/stack.mjs';

/**
 * Le schermate principali dell'app sul telefono (build web dello stesso
 * codice): regole di layout e accessibilità, poi il confronto con
 * l'immagine di riferimento. "Riduci movimento" ferma le animazioni in loop
 * (il puntino LIVE), come farebbe il telefono di chi l'ha attivato.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

/** Dati e immagini arrivati, niente scheletri: la schermata è ferma. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel(/^Caricamento/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

async function look(page: Page, name: string) {
  await settle(page);
  await expectVisuallySound(page, { touch: true });
  await expect(page).toHaveScreenshot(`${name}.png`);
}

test('accesso', async ({ page }) => {
  await page.goto(`${URLS.app}/`);
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await look(page, 'accesso');
});

test.describe('con Sofia, coordinatrice', () => {
  test.beforeEach(async ({ page }) => {
    await holdTelemetry(page);
    await signInToApp(page);
    await expect(page.getByLabel('Entra nel viaggio Islanda On The Road 🇮🇸')).toBeVisible();
  });

  test('i miei viaggi · in corso', async ({ page }) => {
    await look(page, 'viaggi-in-corso');
  });

  test('i miei viaggi · futuri', async ({ page }) => {
    await page.getByRole('tab', { name: 'Viaggi Futuri' }).click();
    await expect(page.getByText('Giappone Discovery 🇯🇵')).toBeVisible();
    await look(page, 'viaggi-futuri');
  });

  test('viaggio · memorie', async ({ page }) => {
    await page.getByLabel('Entra nel viaggio Islanda On The Road 🇮🇸').click();
    await expect(page.getByLabel('Ricordo di Luca T., 12:00').first()).toBeVisible();
    await look(page, 'viaggio-memorie');
  });

  test('viaggio · organizza', async ({ page }) => {
    await page.getByLabel('Entra nel viaggio Islanda On The Road 🇮🇸').click();
    await page.getByRole('tab', { name: '📋 Organizza' }).click();
    await expect(page.getByText('Fosshotel Glacier Lagoon')).toBeVisible();
    await look(page, 'viaggio-organizza');
  });

  test('profilo', async ({ page }) => {
    await page.getByRole('tab', { name: 'Profilo' }).click();
    await expect(page.getByText('Passaporto', { exact: false }).first()).toBeVisible();
    await look(page, 'profilo');
  });
});
