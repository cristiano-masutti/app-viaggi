import { describe, expect, it } from 'vitest';

import { demoDatabaseName } from '../../scripts/demo.js';

describe('demoDatabaseName', () => {
  it('accepts only databases meant for demos or e2e', () => {
    expect(demoDatabaseName('postgresql://u:p@localhost:5432/app_viaggi_e2e')).toBe('app_viaggi_e2e');
    expect(demoDatabaseName('postgresql://u:p@localhost:5432/viaggi-DEMO?schema=public')).toBe('viaggi-DEMO');
  });

  it('refuses the development or production database, which the seed would empty', () => {
    expect(() => demoDatabaseName('postgresql://u:p@localhost:5432/app_viaggi')).toThrow(
      /svuota il database/,
    );
    expect(() => demoDatabaseName('postgresql://u:p@db.example.com:5432/postgres')).toThrow(/"postgres"/);
    expect(() => demoDatabaseName('postgresql://u:p@localhost:5432/')).toThrow(/nessun nome/);
  });
});
