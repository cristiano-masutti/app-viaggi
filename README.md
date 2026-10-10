# app-viaggi monorepo

Repo organizzata in due app separate:

- Mobile Expo: [apps/mobile/](./apps/mobile)
- Backend API (Fastify + Prisma + Supabase Storage): [apps/backend/](./apps/backend)

Ogni app ha la sua CI in [.github/workflows/](./.github/workflows): il backend
gira lint, typecheck, test su Postgres e build; il mobile il typecheck.

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
- Frontend e backend non sono ancora collegati tra loro a livello applicativo.
