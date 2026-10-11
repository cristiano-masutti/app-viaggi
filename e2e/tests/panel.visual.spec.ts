import type { Page } from '@playwright/test';

import { expect, holdTelemetry, signInToPanel, test } from '../support/fixtures';
import { expectVisuallySound } from '../support/layout';
import { ACCOUNTS, ICELAND_TRIP_ID, URLS } from '../support/stack.mjs';

/**
 * Ogni pagina del pannello, su telefono e su desktop: le regole di layout e
 * accessibilità, poi il confronto con l'immagine di riferimento. Se un
 * componente cambia aspetto il test fallisce e il report mostra la differenza.
 */

const VIEWPORTS = [
  { name: 'telefono', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'desktop', viewport: { width: 1366, height: 900 }, touch: false },
] as const;

interface Screen {
  name: string;
  path: string;
  /** Cosa deve esserci prima di guardare: i dati, non lo scheletro. */
  ready: (page: Page) => Promise<void>;
}

const SCREENS: Screen[] = [
  {
    name: 'panoramica',
    path: '/',
    ready: (page) => expect(page.getByRole('heading', { name: 'Prossime partenze' })).toBeVisible(),
  },
  {
    name: 'viaggi',
    path: '/viaggi',
    ready: (page) => expect(page.getByText('Giappone Discovery 🇯🇵')).toBeVisible(),
  },
  {
    name: 'viaggio-organizza',
    path: `/viaggi/${ICELAND_TRIP_ID}`,
    ready: (page) => expect(page.getByText('Pronto a partire?')).toBeVisible(),
  },
  {
    name: 'viaggio-crew',
    path: `/viaggi/${ICELAND_TRIP_ID}`,
    ready: async (page) => {
      await page.getByRole('tab', { name: /Crew/ }).click();
      await expect(page.getByText("Mai entrato nell'app")).toBeVisible();
    },
  },
  {
    name: 'persone',
    path: '/persone',
    ready: (page) => expect(page.getByText('Sofia Marchi')).toBeVisible(),
  },
  {
    name: 'persona',
    path: `/persone/${ACCOUNTS.coordinator.id}`,
    ready: (page) => expect(page.getByRole('heading', { name: "Nell'app" })).toBeVisible(),
  },
  {
    name: 'uso',
    path: '/uso',
    ready: (page) => expect(page.getByRole('img', { name: /Persone attive/ })).toBeVisible(),
  },
  {
    name: 'prestazioni',
    path: '/prestazioni',
    ready: (page) => expect(page.getByRole('table', { name: /Schermate pronte/ })).toBeVisible(),
  },
];

/**
 * Nella cattura a pagina intera la barra fissa del telefono finirebbe a metà
 * pagina: lì si nasconde, e la si guarda a parte nella cattura dello schermo.
 */
const FULL_PAGE = { fullPage: true, style: 'nav.fixed { visibility: hidden !important; }' };

/** Dati arrivati, scheletri spariti, mouse fuori dai piedi: la pagina è ferma. */
async function settle(page: Page) {
  await expect(page.locator('.animate-shimmer')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
}

for (const { name: size, viewport, touch } of VIEWPORTS) {
  test.describe(`pannello · ${size}`, () => {
    // Il pannello rispetta "riduci movimento": entrate e dissolvenze durano un istante.
    test.use({ viewport, hasTouch: touch, reducedMotion: 'reduce' });

    test(`accesso · ${size}`, async ({ page }) => {
      await page.goto(`${URLS.panel}/`);
      await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();
      await settle(page);
      await expectVisuallySound(page, { touch });
      await expect(page).toHaveScreenshot(`accesso-${size}.png`, FULL_PAGE);
    });

    test(`non staff · ${size}`, async ({ page }) => {
      await signInToPanel(page, ACCOUNTS.traveller);
      await expect(page.getByText("Quest'area è per lo staff")).toBeVisible();
      await settle(page);
      await expectVisuallySound(page, { touch });
      await expect(page).toHaveScreenshot(`non-staff-${size}.png`, FULL_PAGE);
    });

    test.describe('con lo staff', () => {
      test.beforeEach(async ({ page }) => {
        await holdTelemetry(page);
        await signInToPanel(page);
        await expect(page.getByRole('heading', { name: /Ciao Giulia/ })).toBeVisible();
      });

      if (touch)
        test(`barra di navigazione · ${size}`, async ({ page }) => {
          await expect(page.getByRole('heading', { name: 'Prossime partenze' })).toBeVisible();
          await settle(page);
          await expect(page).toHaveScreenshot(`panoramica-schermo-${size}.png`);
        });

      for (const screen of SCREENS) {
        test(`${screen.name} · ${size}`, async ({ page }) => {
          await page.goto(`${URLS.panel}${screen.path}`);
          await screen.ready(page);
          await settle(page);
          await expectVisuallySound(page, { touch });
          await expect(page).toHaveScreenshot(`${screen.name}-${size}.png`, FULL_PAGE);
        });
      }
    });
  });
}
