import { expect, signInToApp, test } from '../support/fixtures';
import {
  BUDGETS,
  blockingTime,
  measureScroll,
  percentile,
  recordTelemetry,
  sendToBackground,
  throttleCpu,
  watchLongTasks,
} from '../support/perf';
import { ACCOUNTS, ICELAND_TRIP_ID, URLS } from '../support/stack.mjs';

/**
 * L'app (la build web dello stesso codice React Native) contro backend,
 * Postgres e Supabase finto: i flussi di chi viaggia, poi quanto è veloce e
 * fluida con la CPU di un telefono di fascia media, e che le sue misure
 * arrivino davvero al backend.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('chi sbaglia password resta fuori, con un messaggio chiaro', async ({ page }) => {
  await signInToApp(page, { email: ACCOUNTS.coordinator.email, password: 'sbagliata' });
  await expect(page.getByText('Credenziali non valide. Contatta il coordinatore.')).toBeVisible();
});

test('un giro nel viaggio in corso: veloce, fluido e misurato', async ({ page }) => {
  test.setTimeout(120_000);
  const telemetry = recordTelemetry(page);
  await watchLongTasks(page);
  await throttleCpu(page, 4);

  // Avvio: dall'apertura della pagina al login pronto, scaricamento del codice compreso.
  await page.goto(`${URLS.app}/`);
  await expect(page.getByPlaceholder('Email')).toBeVisible({ timeout: 20_000 });
  const firstScreen = await page.evaluate(() => performance.now());

  await signInToApp(page);
  const card = page.getByLabel('Entra nel viaggio Islanda On The Road 🇮🇸');
  await expect(card).toBeVisible();
  await expect(page.getByText('LIVE • GIORNO 3 DI 10')).toBeVisible();

  await card.click();
  await expect(page.getByLabel('Ricordo di Luca T., 12:00').first()).toBeVisible();
  const scroll = await measureScroll(page);

  await page.getByRole('tab', { name: '📋 Organizza' }).click();
  await expect(page.getByText('Fosshotel Glacier Lagoon')).toBeVisible();
  await page.getByRole('button', { name: '📄 Prenotazione' }).click();
  await expect(page.getByRole('button', { name: 'Chiudi documento' })).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi documento' }).click();

  await page.getByRole('button', { name: 'Torna ai miei viaggi' }).first().click();
  await page.getByRole('tab', { name: 'Profilo' }).click();
  await expect(page.getByText('Sofia', { exact: false }).first()).toBeVisible();

  await sendToBackground(page);
  await expect
    .poll(() => telemetry.uploads.length, { message: 'nessuna misura inviata al backend' })
    .toBeGreaterThan(0);
  const blocking = await blockingTime(page);

  // ── Le misure arrivano al backend, che le accetta.
  expect(telemetry.uploads.every((upload) => upload.status === 202)).toBe(true);
  const events = telemetry.events();
  expect(events.map((event) => event.name)).toEqual(
    expect.arrayContaining(['app_open', 'screen_view', 'document_open']),
  );
  expect(events).toContainEqual(
    expect.objectContaining({ name: 'screen_view', screen: 'TripDetail', tripId: ICELAND_TRIP_ID }),
  );
  expect(events).toContainEqual(expect.objectContaining({ name: 'document_open', tripId: ICELAND_TRIP_ID }));

  // ── Tempi e fluidità, contro i limiti della pagina Prestazioni.
  const appStart = telemetry.samples('app_start')[0]?.value;
  const screens = Object.fromEntries(
    telemetry.samples('screen_ready').map((sample) => [sample.target, sample.value] as const),
  );
  const api = telemetry.samples('api_latency').map((sample) => sample.value);
  const measured = {
    primaSchermataMs: Math.round(firstScreen),
    avvioAppMs: appStart,
    schermateProntaMs: screens,
    apiP95Ms: percentile(api, 95),
    chiamate: api.length,
    scorrimento: {
      fotogrammi: scroll.frames,
      lentiPercento: Number(scroll.slowPercent.toFixed(1)),
      piuLungoMs: Math.round(scroll.longestFrame),
    },
    bloccoTotaleMs: Math.round(blocking.totalBlockingMs),
  };
  test
    .info()
    .annotations.push({ type: 'Prestazioni app (CPU 4× più lenta)', description: JSON.stringify(measured) });
  console.log('Prestazioni app (CPU 4× più lenta):', measured);

  expect.soft(firstScreen, 'prima schermata (ms)').toBeLessThan(BUDGETS.appStart);
  expect.soft(appStart, 'avvio misurato dall’app (ms)').toBeLessThan(BUDGETS.appStart);
  expect.soft(screens.MyTrips, 'I miei viaggi pronta (ms)').toBeLessThan(BUDGETS.screenReady);
  expect.soft(screens.TripDetail, 'Dettaglio viaggio pronto (ms)').toBeLessThan(BUDGETS.screenReady);
  expect.soft(api.length, 'chiamate misurate').toBeGreaterThan(0);
  expect.soft(percentile(api, 95), 'p95 delle chiamate (ms)').toBeLessThan(BUDGETS.apiLatencyP95);
  expect.soft(scroll.frames, 'fotogrammi misurati scorrendo').toBeGreaterThan(20);
  expect.soft(scroll.slowPercent, 'fotogrammi lenti scorrendo (%)').toBeLessThan(BUDGETS.slowFramesPercent);
  expect.soft(scroll.longestFrame, 'fotogramma più lungo scorrendo (ms)').toBeLessThan(BUDGETS.frozenFrameMs);
});
