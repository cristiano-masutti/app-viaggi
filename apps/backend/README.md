# app-viaggi backend

Backend API per app-viaggi:

- Fastify + TypeScript
- Prisma su PostgreSQL
- Supabase Storage per upload file

## Avvio

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

## Variabili ambiente

Vedi [.env.example](./.env.example).

## API

- `GET /health`
- `GET /api/trips`
- `POST /api/trips`
- `POST /api/uploads?tripId=<uuid>` (multipart con campo file)
- `GET /api/uploads/:assetId/signed-url`
