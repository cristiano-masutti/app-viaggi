import { createRequire } from 'node:module';

import { test as base, expect, type Page } from '@playwright/test';

import { ACCOUNTS, NOW, URLS } from './stack.mjs';

/*
 * Le fixture di ogni test: il calendario del browser su NOW, lo stesso
 * carattere ovunque (screenshot uguali su ogni macchina) e nessun errore in
 * console lasciato passare in silenzio.
 */

const require = createRequire(import.meta.url);
const FONTS = {
  latin: {
    file: require.resolve('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),
    range:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
  'latin-ext': {
    file: require.resolve('@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2'),
    range:
      'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  },
} as const;

/**
 * Pannello e app usano i caratteri di sistema: su macchine diverse sono
 * diversi, e gli screenshot pure. Qui ogni nome della pila di sistema punta
 * allo stesso Inter, servito dai test. Le emoji restano a Noto Color Emoji.
 */
const SYSTEM_FAMILIES = [
  'Inter',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Helvetica',
  'Arial',
];
const FONT_CSS = SYSTEM_FAMILIES.flatMap((family) =>
  Object.entries(FONTS).map(
    ([subset, { range }]) =>
      `@font-face{font-family:'${family}';src:url(/__e2e__/fonts/${subset}.woff2) format('woff2');` +
      `font-weight:100 900;font-style:normal;font-display:block;unicode-range:${range}}`,
  ),
).join('\n');

/** Errori di rete già gestiti dall'interfaccia (un 403, un login sbagliato): non sono bug. */
const EXPECTED_CONSOLE = [/Failed to load resource/];

export const test = base.extend<{ consoleErrors: string[] }>({
  context: async ({ context }, use) => {
    await context.route('**/__e2e__/fonts/*.woff2', (route) => {
      const subset = new URL(route.request().url()).pathname.split('/').pop()!.replace('.woff2', '');
      const font = FONTS[subset as keyof typeof FONTS];
      return font ? route.fulfill({ path: font.file, contentType: 'font/woff2' }) : route.abort();
    });
    await context.addInitScript((css) => {
      const inject = () => {
        const style = document.createElement('style');
        style.dataset.e2e = 'fonts';
        style.textContent = css;
        document.documentElement.appendChild(style);
      };
      if (document.documentElement) inject();
      else document.addEventListener('readystatechange', inject, { once: true });
    }, FONT_CSS);
    await use(context);
  },

  // Solo `Date` parte da NOW: timer, requestAnimationFrame e performance.now restano veri,
  // altrimenti le misure di fluidità e di tempo degli smoke test non varrebbero niente.
  page: async ({ page }, use) => {
    await page.addInitScript((now) => {
      const RealDate = Date;
      const offset = RealDate.parse(now) - RealDate.now();
      class E2EDate extends RealDate {
        constructor(...args: ConstructorParameters<DateConstructor> | []) {
          if (args.length === 0) super(RealDate.now() + offset);
          else super(...(args as ConstructorParameters<DateConstructor>));
        }
        static override now() {
          return RealDate.now() + offset;
        }
      }
      globalThis.Date = E2EDate as DateConstructor;
    }, NOW);
    await use(page);
  },

  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !EXPECTED_CONSOLE.some((pattern) => pattern.test(message.text())))
          errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors, 'errori nella console del browser').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Le metriche inviate dai frontend durante i test visivi non arrivano al
 * backend: altrimenti cambierebbero i numeri che altri screenshot mostrano.
 */
export async function holdTelemetry(page: Page) {
  await page.route('**/api/telemetry', (route) =>
    route.fulfill({ status: 202, json: { events: 0, samples: 0 } }),
  );
}

export async function signInToPanel(
  page: Page,
  account: { email: string; password: string } = ACCOUNTS.staff,
) {
  await page.goto(`${URLS.panel}/`);
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Accedi' }).click();
}

export async function signInToApp(
  page: Page,
  account: { email: string; password: string } = ACCOUNTS.coordinator,
) {
  await page.goto(`${URLS.app}/`);
  await page.getByPlaceholder('Email').fill(account.email);
  await page.getByPlaceholder('Password').fill(account.password);
  await page.getByLabel('Accedi').click();
}
