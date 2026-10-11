# Smoke test, prestazioni e controlli visivi

Pannello e app (la build web dello stesso codice React Native) in Chromium,
contro il backend vero, Postgres e un Supabase finto. Rispondono a tre domande:
**funziona?**, **è veloce e fluido?**, **è visivamente a posto?**

```bash
npm install
npx playwright install chromium   # oppure E2E_CHROMIUM=/percorso/di/chrome
npm run build                      # backend, pannello e app web per gli e2e (in .build/)
npm test                           # avvia i server da solo, scrive i dati demo, prova
npm run report                     # report HTML: errori, tracce, differenze degli screenshot
```

Serve un Postgres raggiungibile con un database **`app_viaggi_e2e`** (oppure
`E2E_DATABASE_URL`): a ogni giro le migrazioni si applicano e i dati demo si
riscrivono da capo. Il seed rifiuta qualunque database senza `e2e` o `demo` nel
nome. In CI lo fa [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml).

## Cosa controllano

| Gruppo | File                         | Cosa                                                                                                                               |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Visivo | `tests/panel.visual.spec.ts` | ogni pagina del pannello, su telefono (390 px) e desktop (1366 px)                                                                 |
| Visivo | `tests/app.visual.spec.ts`   | accesso, i miei viaggi, viaggio (memorie, organizza), profilo, sul telefono                                                        |
| Smoke  | `tests/panel.smoke.spec.ts`  | chi non è staff resta fuori; lo staff carica un voucher e lo apre dall'URL firmato; metriche e filtri; Web Vitals e misure inviate |
| Smoke  | `tests/app.smoke.spec.ts`    | password sbagliata; giro nel viaggio in corso con documento aperto; tempi, fluidità e telemetria                                   |

**Visivamente a posto** vuol dire, per ogni schermata ([`support/layout.ts`](./support/layout.ts)):

- niente scroll orizzontale, niente che esca dallo schermo;
- niente testo tagliato senza i puntini, niente immagini rotte;
- nessun bersaglio (link, pulsante, tab) sopra un altro; sul telefono, bersagli
  abbastanza grandi o abbastanza distanti (WCAG 2.5.8);
- contrasto, nomi, ruoli e struttura secondo WCAG 2.2 AA (axe-core);
- uguale all'immagine di riferimento (`tests/__screenshots__/`): se un
  componente cambia aspetto, il report mostra atteso, ottenuto e differenza.

Ogni problema dice quale elemento è: `Testo tagliato: <span> «Islanda On The…»`.

**Veloce e fluido** ([`support/perf.ts`](./support/perf.ts)): l'app gira con la
CPU rallentata 4 volte, come un telefono di fascia media. Il test scorre i
ricordi misurando ogni fotogramma e legge le misure che l'app stessa manda al
backend. I limiti sono quelli oltre cui la pagina Prestazioni del pannello dice
"Scarso":

| Misura                                              | Limite              |
| --------------------------------------------------- | ------------------- |
| prima schermata, avvio dell'app                     | 4 s                 |
| schermata pronta (I miei viaggi, Dettaglio viaggio) | 2,5 s               |
| chiamate all'API, p95                               | 1 s                 |
| fotogrammi lenti scorrendo                          | 15%                 |
| fotogramma più lungo (blocco)                       | 700 ms              |
| pannello: LCP · CLS · interazione più lenta         | 4 s · 0,25 · 500 ms |

I valori misurati finiscono nel log e nelle annotazioni del report, anche
quando passano.

## Sempre gli stessi pixel

- **Stesso istante.** Browser, backend e Supabase finto vivono il 14 settembre
  2027 alle 10:00 UTC ([`support/stack.mjs`](./support/stack.mjs)): nel browser
  si sposta solo `Date` (timer e `requestAnimationFrame` restano veri, o le
  misure di fluidità non varrebbero niente), nei server lo fa
  [`support/clock.mjs`](./support/clock.mjs).
- **Stessi dati.** Il seed demo è deterministico (`apps/backend/scripts/demo.ts`).
- **Stesso carattere.** I font di sistema cambiano da macchina a macchina: nei
  test ogni nome della pila di sistema punta a Inter, servito dai test.
- **Niente movimento.** Animazioni CSS ferme, "riduci movimento" per l'app,
  metriche inviate dai test visivi trattenute (cambierebbero i numeri delle
  altre pagine).

## Le immagini di riferimento

Sono quelle della CI (Linux, il Chromium di Playwright). Quando ne manca una, la
CI la genera e la committa sul branch della PR, ma solo se tutti i test
passano. Dopo un cambiamento voluto all'aspetto:

- cancella le immagini interessate in `tests/__screenshots__/` e fai push: la
  CI le rigenera; oppure
- lancia il workflow **E2E** a mano con "Rigenera tutte le immagini di
  riferimento".

In locale (`npm run test:update`) si possono rigenerare per guardarle, ma su
un'altra macchina i pixel possono differire di poco: quelle da committare sono
quelle della CI.
