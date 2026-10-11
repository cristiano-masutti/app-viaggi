import { expect, signInToPanel, test } from '../support/fixtures';
import {
  BUDGETS,
  percentile,
  recordTelemetry,
  sendToBackground,
  slowestInteraction,
  watchInteractions,
  webVitals,
} from '../support/perf';
import { ACCOUNTS, ICELAND_TRIP_ID, URLS } from '../support/stack.mjs';

/**
 * Il pannello contro backend, Postgres e Supabase finto: chi non è staff
 * resta fuori, lo staff carica e apre un voucher, legge le metriche. Poi
 * velocità (Web Vitals, chiamate) e le misure inviate al backend.
 */

test.use({ viewport: { width: 1366, height: 900 } });

const VOUCHER = {
  name: 'voucher-budir.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 120]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  ),
};

test('chi non è staff vede solo come chiedere l’accesso', async ({ page }) => {
  await signInToPanel(page, ACCOUNTS.traveller);
  await expect(page.getByText("Quest'area è per lo staff")).toBeVisible();
  await expect(page.getByText(`npm run staff -- grant ${ACCOUNTS.traveller.email}`)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sezioni' })).toHaveCount(0);
});

test('lo staff carica un voucher nel viaggio e lo apre', async ({ page, context }) => {
  await signInToPanel(page);
  await page
    .getByRole('navigation', { name: 'Sezioni' })
    .first()
    .getByRole('link', { name: 'Viaggi' })
    .click();
  await page.getByRole('tab', { name: 'In corso' }).click();
  await page.getByText('Islanda On The Road 🇮🇸').first().click();
  await expect(page).toHaveURL(`${URLS.panel}/viaggi/${ICELAND_TRIP_ID}`);

  await page.getByRole('button', { name: 'Aggiungi alloggio per il Giorno 7' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('es. Hotel Kría, Vík').fill('Hótel Búðir');
  await dialog.getByPlaceholder('Via, numero, città').fill('Búðir, Snæfellsnes');
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: /Allega PDF o immagine/ }).click();
  await (await chooser).setFiles(VOUCHER);
  await dialog.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByText('Alloggio aggiornato')).toBeVisible();
  await expect(page.getByText('Hótel Búðir')).toBeVisible();

  // Il file si apre da un URL firmato, in una nuova scheda.
  const day7 = page
    .getByText('Hótel Búðir')
    .locator('xpath=ancestor::*[.//button[contains(., "Prenotazione")]][1]');
  // La scheda si apre subito (vuota, per non essere bloccata) e va all'URL quando il backend lo firma.
  // Cosa fa poi il browser con un PDF (mostrarlo o scaricarlo) dipende dalla versione: conta la richiesta.
  const signed = context.waitForEvent('request', (request) =>
    /\/storage\/v1\/object\/sign\/trip-assets\/trips\/.+\.pdf/.test(request.url()),
  );
  const opened = context.waitForEvent('page');
  await day7.getByRole('button', { name: 'Prenotazione' }).click();
  const [tab, request] = await Promise.all([opened, signed]);
  expect(request.frame().page()).toBe(tab);

  // E all'URL firmato c'è proprio il file caricato.
  const file = await page.request.get(request.url());
  expect(file.status()).toBe(200);
  expect(file.headers()['content-type']).toBe('application/pdf');
  expect(await file.body()).toEqual(VOUCHER.buffer);
  await tab.close();
});

test('le metriche si leggono e rispondono ai filtri', async ({ page }) => {
  await signInToPanel(page);
  await page.getByRole('link', { name: "Uso dell'app" }).first().click();
  await expect(page.getByText('Attivi oggi')).toBeVisible();
  await expect(page.getByText('Marco Ferri')).toBeVisible();

  await page.getByRole('tab', { name: '7 giorni' }).click();
  await expect(page).toHaveURL(/giorni=7/);
  await page.getByRole('button', { name: 'Tabella' }).click();
  await expect(
    page.getByRole('table', { name: "Uso dell'app giorno per giorno" }).getByRole('row'),
  ).toHaveCount(8);

  await page.getByRole('link', { name: 'Prestazioni' }).first().click();
  await expect(page.getByRole('button', { name: /Avvio dell'app/ })).toBeVisible();
  await page.getByRole('button', { name: /Risposta del server/ }).click();
  await expect(page.getByRole('heading', { name: 'Risposta del server, giorno per giorno' })).toBeVisible();
  await page.getByRole('tab', { name: 'Pannello' }).click();
  await expect(page).toHaveURL(/fonte=pannello/);
  await expect(page.getByRole('button', { name: /Caricamento/ })).toBeVisible();
});

test('il pannello è veloce, stabile, e manda le sue misure', async ({ page }) => {
  const telemetry = recordTelemetry(page);
  await watchInteractions(page);
  await signInToPanel(page);
  await expect(page.getByRole('heading', { name: /Ciao Giulia/ })).toBeVisible();

  // Una pagina caricata da zero, con la sessione già aperta: la più pesante, Uso dell'app.
  await page.goto(`${URLS.panel}/uso`);
  await expect(page.getByRole('img', { name: /Persone attive/ })).toBeVisible();
  const vitals = await webVitals(page);

  await page.getByRole('tab', { name: '90 giorni' }).click();
  await expect(page).toHaveURL(/giorni=90/);
  await expect(page.getByText('17 Giu')).toBeVisible();
  await page.getByRole('tab', { name: 'Aperture' }).click();
  const slowest = await slowestInteraction(page);

  await sendToBackground(page);
  await expect
    .poll(() => telemetry.uploads.length, { message: 'nessuna misura inviata al backend' })
    .toBeGreaterThan(0);
  const api = telemetry.samples('api_latency').map((sample) => sample.value);
  const measured = {
    lcpMs: Math.round(vitals.lcp),
    cls: Number(vitals.cls.toFixed(3)),
    interazionePiuLentaMs: Math.round(slowest),
    apiP95Ms: Math.round(percentile(api, 95)),
    chiamate: api.length,
  };
  test.info().annotations.push({ type: 'Prestazioni pannello', description: JSON.stringify(measured) });
  console.log('Prestazioni pannello:', measured);

  expect(telemetry.uploads.every((upload) => upload.status === 202 && upload.source === 'panel')).toBe(true);
  expect(telemetry.uploads.flatMap((upload) => upload.events)).toEqual([]);
  expect(telemetry.samples('api_latency').map((sample) => sample.target)).toContain('GET /api/admin/usage');
  expect(telemetry.samples('ttfb').length).toBeGreaterThan(0);

  expect.soft(vitals.lcp, 'LCP (ms)').toBeLessThan(BUDGETS.lcp);
  expect.soft(vitals.cls, 'CLS').toBeLessThan(BUDGETS.cls);
  expect.soft(slowest, 'interazione più lenta (ms)').toBeLessThan(BUDGETS.inp);
  expect.soft(percentile(api, 95), 'p95 delle chiamate (ms)').toBeLessThan(BUDGETS.apiLatencyP95);
});
