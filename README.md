# app-viaggi monorepo

Repo organizzata in due app separate:

- Mobile Expo: [apps/mobile/](./apps/mobile)
- Backend API (Fastify + Prisma + Supabase Storage): [apps/backend/](./apps/backend)

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

```bash
cp apps/backend/.env.example apps/backend/.env
npm run backend:prisma:generate
npm run backend:prisma:migrate:init
npm run backend:dev
```

## Note

- Il progetto Expo è già linkato via `projectId` in [apps/mobile/app.json](./apps/mobile/app.json).
- Frontend e backend non sono ancora collegati tra loro a livello applicativo.
