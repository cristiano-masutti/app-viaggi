-- Staff dell'organizzazione (pannello di controllo). Nessuno lo è finché non
-- viene concesso con `npm run staff -- grant <email>`.
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
