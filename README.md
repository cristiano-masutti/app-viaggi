# app-viaggi monorepo

Repo organizzata in due app separate:

- Mobile Expo: [apps/mobile/](./apps/mobile)
- Pannello di controllo dello staff (React + Vite): [apps/admin/](./apps/admin)
- Backend API (Fastify + Prisma + Supabase Storage): [apps/backend/](./apps/backend)

Ogni app ha la sua CI in [.github/workflows/](./.github/workflows): il backend
gira lint, typecheck, test su Postgres e build; il mobile typecheck, test e il
controllo che i tipi dell'API siano allineati alla specifica del backend; il
pannello lint, formato, tipi, test, build e lo stesso controllo dei tipi.

Sopra a tutto, gli **smoke test** di [e2e/](./e2e) aprono pannello e app (build
web) in Chromium contro backend, Postgres e un Supabase finto: flussi
principali, budget di velocità e fluidità, regole di layout e accessibilità e
confronto con le immagini di riferimento.

## Demo in locale (app sul telefono + pannello)

Tutto su questo computer, con i dati demo: niente account Supabase, niente
deploy. Serve:

- Node `^22.13.0 || >=24.3.0` e **Docker Desktop** acceso (per Postgres);
- **Expo Go** sul telefono (App Store / Play Store), aggiornato;
- telefono e computer sulla **stessa rete Wi-Fi**.

```bash
npm run demo                      # dati demo da capo, con le date di oggi
npm run demo -- --keep            # tiene i dati (e le modifiche) della demo precedente
npm run demo -- --sensitive-data  # mostra anche passaporto, codice fiscale e note mediche
```

I dati sensibili restano spenti di default: la demo mostra l'app senza
passaporto, codice fiscale e note mediche, nel profilo, in *Organizza* e nel
pannello. Voucher, biglietti e gli altri documenti di viaggio ci sono. Il codice
c'è tutto: si accende con `--sensitive-data` (in produzione con
`SENSITIVE_DATA` sul backend ed `EXPO_PUBLIC_SENSITIVE_DATA` nell'app).

La prima volta installa le dipendenze (qualche minuto). Poi stampa l'indirizzo
del pannello, gli account e il QR da inquadrare con Expo Go. Ctrl+C chiude
tutto; Postgres resta acceso (`docker compose -f apps/backend/docker-compose.yml stop`).

| Dove | Chi | Email | Password |
| --- | --- | --- | --- |
| Pannello | staff | `giulia@vibemakers.test` | `staff-sicuro-1` |
| App | coordinatrice | `sofia@example.test` | `viaggio-sicuro-1` |
| App | viaggiatore | `luca@example.test` | `viaggio-sicuro-1` |

**Cosa mostrare.**
1. Pannello: *Panoramica* (Islanda e Lisbona in corso), poi *Uso dell'app* (Marco e
   Omar non sono mai entrati) e *Prestazioni*.
2. App, come Sofia: il viaggio in Islanda, giorno 3 di 10; Memorie e Organizza.
3. Insieme: nel pannello aggiungi un alloggio con un PDF a un giorno
   dell'Islanda; nell'app torna ai viaggi e rientra nell'Islanda: il voucher è
   lì e si apre. Entro mezzo minuto dall'accesso di Sofia, in *Uso dell'app* →
   *Aperture* (ricaricando la pagina) il valore di oggi sale.

**Se il telefono non si collega.**
- macOS chiede di consentire le connessioni in entrata a `node`: consenti.
- iPhone: Expo Go deve avere il permesso *Rete locale* (Impostazioni → Expo Go).
- Le reti Wi-Fi ospiti o aziendali spesso isolano i dispositivi: usa l'hotspot
  del telefono e collega lì il computer.
- Se l'indirizzo trovato non è quello giusto: `DEMO_HOST=192.168.1.20 npm run demo`.
- Senza Docker, con un Postgres già pronto:
  `DEMO_DATABASE_URL=postgresql://…/app_viaggi_demo npm run demo`.

Login e file passano dal Supabase finto degli e2e, con le password qui sopra:
va bene per una demo su una rete fidata, non per mettere l'app online. Gli
account creati durante la demo dal pannello spariscono quando la chiudi.

## Prerequisiti

- Node `^22.13.0 || >=24.3.0` (vedi [.nvmrc](./.nvmrc))

## Setup rapido

```bash
npm run mobile:install
npm run backend:install
```

## Comandi principali

### Mobile

```bash
npm run mobile:start
npm run mobile:ios
npm run mobile:android
npm run mobile:web
npm run mobile:test        # Jest
npm run mobile:api-types   # rigenera i tipi dell'API da apps/backend/openapi.json
```

### Pannello di controllo

```bash
cp apps/admin/.env.example apps/admin/.env.local   # URL del backend e di Supabase
npm run admin:install
npm run admin:dev          # http://localhost:5173
npm run admin:verify       # lint, formato, tipi, test e build
npm run backend:staff -- grant <email>   # chi può entrare
```

### Backend

Serve Docker per il Postgres locale (vedi [apps/backend/README.md](./apps/backend/README.md)).

```bash
cp apps/backend/.env.example apps/backend/.env
npm run backend:db:up
npm run backend:prisma:migrate
npm run backend:dev
npm run backend:test      # test di unità e integrazione
npm run backend:verify    # lint, format, typecheck, test e build (come la CI, tranne il controllo delle migrazioni)
```

### Smoke test e controlli visivi

Serve un Postgres con un database `app_viaggi_e2e` (vedi [e2e/README.md](./e2e/README.md)).

```bash
npm run e2e:install
npx --prefix e2e playwright install chromium
npm run e2e:build          # backend, pannello e app web per gli e2e
npm run e2e:test
npm run e2e:report         # il report, con le differenze degli screenshot
npm run backend:seed:demo  # gli stessi dati demo, in un database "…_demo"
```

## Note

- Il progetto Expo è già linkato via `projectId` in [apps/mobile/app.json](./apps/mobile/app.json).
- Il mobile parte in modalità prototipo (dati mock); con le variabili di
  [apps/mobile/.env.example](./apps/mobile/.env.example) usa il backend vero e il
  login di Supabase. Dettagli nella [README del mobile](./apps/mobile/README.md).
