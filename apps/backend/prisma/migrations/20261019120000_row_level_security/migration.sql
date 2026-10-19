-- Su Supabase lo schema public è esposto dalla Data API (PostgREST) a chiunque
-- abbia la chiave publishable, che sta nelle app. Al database parla solo il
-- backend: RLS accesa e nessuna policy chiudono quella porta. Il backend si
-- collega come proprietario delle tabelle, a cui RLS non si applica.
-- Una tabella nuova va chiusa nella sua migrazione:
--   ALTER TABLE "Nuova" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
