/**
 * I test svuotano le tabelle prima di ogni caso: devono poterlo fare solo su
 * un database dichiaratamente di test. Un `.env` sbagliato che punta allo
 * sviluppo (o peggio) ferma la suite invece di cancellare i dati.
 */
export function testDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set: see .env.test');

  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to use "${databaseName}" for tests: the database name must end with "_test"`);
  }

  return databaseUrl;
}
