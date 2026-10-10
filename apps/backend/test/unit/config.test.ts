import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/env.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

describe('loadConfig', () => {
  it('applies defaults to the optional variables', () => {
    const config = loadConfig(validEnv);

    expect(config).toMatchObject({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 4000,
      CORS_ORIGIN: ['http://localhost:8081'],
      SUPABASE_STORAGE_BUCKET: 'trip-assets',
      UPLOAD_MAX_BYTES: 15 * 1024 * 1024,
      SIGNED_URL_TTL_SECONDS: 900,
    });
  });

  it('coerces numeric variables from strings', () => {
    const config = loadConfig({ ...validEnv, PORT: '8080', UPLOAD_MAX_BYTES: '1024' });

    expect(config.PORT).toBe(8080);
    expect(config.UPLOAD_MAX_BYTES).toBe(1024);
  });

  it('splits a comma-separated CORS_ORIGIN into a trimmed list', () => {
    const config = loadConfig({
      ...validEnv,
      CORS_ORIGIN: 'https://app.example.com, http://localhost:8081 ,',
    });

    expect(config.CORS_ORIGIN).toEqual(['https://app.example.com', 'http://localhost:8081']);
  });

  it('names every missing required variable in a single error', () => {
    expect(() => loadConfig({})).toThrowError(/DATABASE_URL.*SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY/);
  });

  it.each([
    ['PORT', 'not-a-number'],
    ['PORT', '-1'],
    ['NODE_ENV', 'staging'],
    ['DATABASE_URL', 'not a url'],
  ])('rejects an invalid %s (%s)', (key, value) => {
    expect(() => loadConfig({ ...validEnv, [key]: value })).toThrowError(new RegExp(key));
  });
});
