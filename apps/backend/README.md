# app-viaggi — backend

API di Vibemakers Travel: **Fastify 5 + TypeScript**, **Prisma 7** su
**PostgreSQL**, login con **Supabase Auth**, file su **Supabase Storage**
(bucket privato).

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
├── auth/
│   ├── token-verifier.ts     verifica degli access token Supabase (JWKS, ES256/RS256)
│   └── authenticate.ts       hook su tutto /api: token → request.user, crea l'utente al primo accesso
├── lib/
│   ├── errors.ts             AppError + error handler, formato unico degli errori
│   ├── prisma.ts             PrismaClient con driver adapter pg
│   └── schemas.ts            codec zod condivisi (date)
├── storage/                  interfaccia ObjectStorage + implementazione Supabase
├── modules/<dominio>/        <dominio>.routes.ts + <dominio>.schemas.ts
│   └── trips/trip-access.ts  tripScope(): membership e ruolo per le route /trips/:tripId/...
└── generated/prisma/         client generato da `prisma generate` (non versionato)
prisma/
├── schema.prisma
└── migrations/               migrazioni versionate: sono loro che vanno in produzione
test/
├── unit/                     funzioni pure, senza database
├── integration/              API vera via app.inject() su Postgres vero
└── helpers/                  createTestApp, factory, storage in memoria, token firmati
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

### Autenticazione

Il login lo fa il client direttamente con **Supabase Auth**; il backend riceve
l'access token in `Authorization: Bearer <token>` e lo verifica **in locale**
con le chiavi pubbliche del progetto (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`,
in cache per 10 minuti): nessuna chiamata a Supabase per ogni richiesta.

- Si accettano solo token **firmati con chiavi asimmetriche** (ES256/RS256),
  emessi dal nostro progetto (`iss`), per utenti veri (`aud` e `role` =
  `authenticated`, non anonimi). Le API key `anon`/`service_role` non valgono
  come login.
- **Requisito sul progetto Supabase:** deve usare le *JWT Signing Keys*
  asimmetriche. Con il vecchio segreto condiviso HS256 il JWKS è vuoto e
  ogni token viene rifiutato con 401.
- Alla prima richiesta di un utente nasce la sua riga `User`, con lo stesso id
  di Supabase (`sub`): niente endpoint di registrazione separato.
- Errori: `401 UNAUTHENTICATED` (token assente), `401 INVALID_TOKEN` (scaduto,
  contraffatto, di un altro progetto), `503 AUTH_UNAVAILABLE` (chiavi pubbliche
  irraggiungibili: è un guasto nostro, non dell'utente).
- Un token resta valido fino alla scadenza (1 ora di default su Supabase) anche
  dopo il logout: la verifica locale non vede le sessioni revocate.

### Permessi

**Deny by default, su due livelli.** Ogni route sotto `/api` passa
dall'hook di autenticazione; ogni route sotto `/api/trips/:tripId/...` si
registra dentro `tripScope()`, che prima di leggere il body controlla che
l'utente sia membro del viaggio e che il suo ruolo sia ammesso:

```ts
app.post('/trips/:tripId/assets', { config: { tripRoles: [TripRole.COORDINATOR] }, … })
```

Senza `tripRoles` la route è aperta a ogni membro. Chi non è membro riceve
**404**, come per un viaggio inesistente: non scopre nemmeno che esiste. Un
membro senza il ruolo giusto riceve **403 FORBIDDEN**.

| Azione | Coordinatore | Viaggiatore | Non membro |
| --- | --- | --- | --- |
| Vedere il viaggio | ✅ | ✅ | 404 |
| Caricare un documento | ✅ | 403 | 404 |
| Aprire un documento (URL firmato) | ✅ | ✅ | 404 |

Chi crea un viaggio ne diventa coordinatore. La tabella vive anche in
`test/integration/access-matrix.test.ts`: una route nuova sotto
`/api/trips/:tripId` senza la sua riga lì fa fallire i test.

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
- **Token veri, firmati al volo.** `test/helpers/auth.ts` genera una coppia di
  chiavi ES256 a ogni esecuzione e firma token identici a quelli di Supabase:
  i test passano dalla stessa verifica crittografica della produzione.
  `authHeaders(user)` dà gli header pronti, `createTripWithCrew()` un viaggio
  con coordinatore, viaggiatore e un estraneo.

### Convenzioni

1. **Ogni bug corretto arriva con il test che lo riproduce**: prima il test
   rosso, poi la correzione.
2. Un endpoint nuovo ha almeno: caso felice (risposta **e** stato del
   database), validazione, risorsa inesistente, guasto a valle se ne ha uno,
   e la sua riga nella matrice dei permessi.
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

Tutto quello che sta sotto `/api` richiede `Authorization: Bearer <access token>`.

| Metodo | Percorso | Chi | Note |
| --- | --- | --- | --- |
| `GET` | `/health` | pubblico | liveness |
| `GET` | `/health/ready` | pubblico | readiness (database) |
| `GET` | `/api/me` | utente | l'utente del token |
| `GET` | `/api/trips` | utente | i **miei** viaggi, dal più recente, con `myRole` e `assetCount` |
| `POST` | `/api/trips` | utente | `{ title, destination, startDate, endDate }`, date `YYYY-MM-DD`; chi crea è coordinatore |
| `GET` | `/api/trips/:tripId` | membro | dettaglio con `myRole` |
| `POST` | `/api/trips/:tripId/assets` | coordinatore | multipart, un file nel campo `file`; max `UPLOAD_MAX_BYTES` |
| `GET` | `/api/trips/:tripId/assets/:assetId/signed-url` | membro | URL firmato, valido `SIGNED_URL_TTL_SECONDS` |

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

- **Modello dati del dominio.** Il contratto da raggiungere è
  [`apps/mobile/src/types/index.ts`](../mobile/src/types/index.ts): profilo,
  crew con **inviti** (oggi l'unico membro di un viaggio è chi lo crea),
  giorni, documenti, ricordi.
- **Account:** cancellazione dell'utente (GDPR) propagata da Supabase.
- **Hardening:** rate limiting, allowlist dei MIME type in upload, paginazione
  delle liste, OpenAPI generata dagli schemi zod.
- **Deploy:** Dockerfile, ambiente di staging, `prisma migrate deploy` nella
  pipeline di rilascio, error tracking.
