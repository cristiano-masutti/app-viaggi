# app-viaggi monorepo

Repo organizzata in due app separate:

- Mobile Expo: [apps/mobile/](./apps/mobile)
- Pannello di controllo dello staff (React + Vite): [apps/admin/](./apps/admin)
- Backend API (Fastify + Prisma + Supabase Storage): [apps/backend/](./apps/backend)

Ogni app ha la sua CI in [.github/workflows/](./.github/workflows): il backend
gira lint, typecheck, test su Postgres e build; il mobile typecheck, test e il
controllo che i tipi dell'API siano allineati alla specifica del backend; il
pannello lint, formato, tipi, test, build e lo stesso controllo dei tipi.

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

## Note

- Il progetto Expo è già linkato via `projectId` in [apps/mobile/app.json](./apps/mobile/app.json).
- Il mobile parte in modalità prototipo (dati mock); con le variabili di
  [apps/mobile/.env.example](./apps/mobile/.env.example) usa il backend vero e il
  login di Supabase. Dettagli nella [README del mobile](./apps/mobile/README.md).
