# app-viaggi — backend

API di Vibemakers Travel: **Fastify 5 + TypeScript**, **Prisma 7** su
**PostgreSQL**, file su **Supabase Storage** (bucket privato).

```bash
cp .env.example .env
docker compose up -d --wait   # Postgres 17 con i database app_viaggi e app_viaggi_test
npm install                   # genera anche il client Prisma
npm run prisma:migrate        # applica le migrazioni al database di sviluppo
npm run dev                   # http://localhost:4000
```

Prima di ogni push:

```bash
npm run verify   # lint + format + typecheck + test + build, come la CI
```

---

## Struttura

```
src/
├── server.ts                 entrypoint: legge l'env, crea le dipendenze vere, avvio e spegnimento
├── app.ts                    buildApp(deps): l'app senza effetti collaterali, la stessa usata dai test
├── config/env.ts             loadConfig(): variabili d'ambiente validate al boot
├── lib/
│   ├── errors.ts             AppError + error handler, formato unico degli errori
│   ├── prisma.ts             PrismaClient con driver adapter pg
│   └── schemas.ts            codec zod condivisi (date)
├── storage/                  interfaccia ObjectStorage + implementazione Supabase
├── modules/<dominio>/        <dominio>.routes.ts + <dominio>.schemas.ts
└── generated/prisma/         client generato da `prisma generate` (non versionato)
prisma/
├── schema.prisma
└── migrations/               migrazioni versionate: sono loro che vanno in produzione
test/
├── unit/                     funzioni pure, senza database
├── integration/              API vera via app.inject() su Postgres vero
└── helpers/                  createTestApp, factory, storage in memoria
```

### Le regole

| Regola | Perché |
| --- | --- |
| **Le dipendenze entrano da `buildApp`** | Database, storage e config arrivano come argomenti e sono esposti come `app.prisma`, `app.storage`, `app.config`. Nessun modulo importa un singleton: i test sostituiscono quello che serve senza mock di moduli. |
| **Ogni route dichiara `schema`** | Body, query e params sono validati con zod prima dell'handler, che riceve già i tipi giusti. La risposta passa dallo schema di risposta: un campo interno (es. `storagePath`) non può uscire per sbaglio. |
| **Errori in un solo formato** | `{ "error": { "code", "message", "details"? } }`. Nelle route si lancia `AppError` (o `notFound`, `badRequest`), mai `reply.status(4xx)` a mano. Un errore imprevisto diventa un 500 generico: il dettaglio va nei log, non al client. |
| **Date senza orario = `YYYY-MM-DD`** | Inizio e fine viaggio sono `@db.Date` e viaggiano come `2026-09-14`: niente slittamenti di un giorno per colpa del fuso. |
| **Lo schema cambia solo con una migrazione** | `npm run prisma:migrate -- --name <cosa>` e si versiona la cartella generata. La CI fallisce se `schema.prisma` e migrazioni divergono. |
| **Config solo da `loadConfig`** | Una variabile mancante o sbagliata ferma il boot con un messaggio che le elenca tutte, invece di esplodere alla prima richiesta. |

### Health check

- `GET /health` — *liveness*: il processo risponde. Non tocca il database.
- `GET /health/ready` — *readiness*: 503 se Postgres non risponde, così il
  load balancer toglie l'istanza dal giro senza riavviarla.

Ogni risposta porta un header `x-request-id` (ripreso dal proxy se presente):
è la chiave per ritrovare la richiesta nei log.

---

## Test

```bash
npm test                 # unit + integrazione
npm run test:watch
npm run test:coverage    # report in coverage/
npx vitest --project unit   # solo i test che non usano il database
```

- **Integrazione su Postgres vero, non su mock.** I test chiamano l'API con
  `app.inject()` (nessuna porta aperta) e verificano sia la risposta sia cosa
  è finito nel database. Prima della suite le migrazioni vengono applicate con
  `prisma migrate deploy`, lo stesso comando della produzione: una migrazione
  rotta ferma i test.
- **Ogni test parte da tabelle vuote.** `test/integration/setup.ts` le svuota
  prima di ogni caso; i file di integrazione girano uno alla volta. I dati che
  servono si creano nel test stesso con le factory di `test/helpers/factories.ts`.
- **Solo database `*_test`.** I helper rifiutano qualunque `DATABASE_URL` il cui
  nome non finisca in `_test`: un `.env` sbagliato ferma la suite invece di
  svuotare il database di sviluppo. La config dei test è in `.env.test`
  (versionata, solo valori finti); una variabile già presente nell'ambiente vince.
- **Storage finto, guasti veri.** `InMemoryStorage` sostituisce Supabase e sa
  simulare un errore (`failNext('upload')`) o eseguire codice a metà upload
  (`onUpload`), per provare i percorsi d'errore senza rete.

### Convenzioni

1. **Ogni bug corretto arriva con il test che lo riproduce**: prima il test
   rosso, poi la correzione.
2. Un endpoint nuovo ha almeno: caso felice (risposta **e** stato del
   database), validazione, risorsa inesistente, guasto a valle se ne ha uno.
3. I test parlano all'API come farebbe il client: niente chiamate dirette agli
   handler, niente asserzioni su dettagli interni che il client non vede.

Se modifichi una migrazione **non ancora rilasciata**, ricrea il database di
test (`docker compose down -v && docker compose up -d --wait`): `migrate
deploy` non riapplica una migrazione già registrata.

---

## CI

[`.github/workflows/backend.yml`](../../.github/workflows/backend.yml) gira su
ogni PR che tocca `apps/backend/`, con un Postgres 17 come service container:

`npm ci` → lint → format → typecheck → `migrate deploy` → migrazioni allineate
allo schema → test con coverage → build.

---

## API

| Metodo | Percorso | Note |
| --- | --- | --- |
| `GET` | `/health` | liveness |
| `GET` | `/health/ready` | readiness (database) |
| `GET` | `/api/trips` | viaggi, dal più recente, con `assetCount` |
| `POST` | `/api/trips` | `{ title, destination, startDate, endDate }`, date `YYYY-MM-DD` |
| `POST` | `/api/uploads?tripId=<uuid>` | multipart, un file nel campo `file`; max `UPLOAD_MAX_BYTES` |
| `GET` | `/api/uploads/:assetId/signed-url` | URL firmato, valido `SIGNED_URL_TTL_SECONDS` |

## Variabili d'ambiente

Vedi [`.env.example`](./.env.example); lo schema completo, con i default, è in
[`src/config/env.ts`](./src/config/env.ts).

## Dipendenze: note

- Per **aggiungere o aggiornare** dipendenze usa Node 24 (`.nvmrc`, npm 11):
  `npm install` da zero con npm 10.9 (Node 22) va in crash risolvendo le peer
  dependencies. `npm ci` dal lockfile funziona su entrambe.
- `overrides` in `package.json` forza `deepmerge-ts@^8` e `mysql2@^3.24.5`
  sotto la CLI di Prisma, che ne trascina versioni con advisory high
  (GHSA-ggr8-5vv4-36mx, GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3). Sono solo
  strumenti della CLI, non del client usato a runtime. Si tolgono quando Prisma
  aggiorna le sue dipendenze. **Mai `npm audit fix --force`**: riporterebbe
  Prisma alla 6.

---

## Cosa manca prima della produzione

- **Autenticazione e autorizzazione.** Oggi ogni endpoint è pubblico: chiunque
  conosca un `assetId` ottiene un URL firmato. È il primo passo.
- **Modello dati del dominio.** `Trip` e `TripAsset` sono ancora quelli dello
  scheletro iniziale; il contratto da raggiungere è
  [`apps/mobile/src/types/index.ts`](../mobile/src/types/index.ts) (crew, giorni,
  documenti, ricordi, profilo).
- **Hardening:** rate limiting, allowlist dei MIME type in upload, paginazione
  delle liste, OpenAPI generata dagli schemi zod.
- **Deploy:** Dockerfile, ambiente di staging, `prisma migrate deploy` nella
  pipeline di rilascio, error tracking.
