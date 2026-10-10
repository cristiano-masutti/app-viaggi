import { describe, expect, it } from 'vitest';

import { UpdateProfileBody, Username } from '../../src/modules/me/me.schemas.js';

describe('Username', () => {
  it.each([
    ['@MarcoRossi', 'marcorossi'],
    ['marco.rossi_88', 'marco.rossi_88'],
    ['  @Ana ', 'ana'],
  ])('normalises %j to %j', (input, output) => {
    expect(Username.parse(input)).toBe(output);
  });

  it.each(['ab', '@', 'marco rossi', 'marco-rossi', 'm'.repeat(31), 'màrco'])('rejects %j', (input) => {
    expect(Username.safeParse(input).success).toBe(false);
  });
});

describe('UpdateProfileBody', () => {
  it('normalises the fiscal code and the passport number to upper case', () => {
    const body = UpdateProfileBody.parse({
      fiscalCode: 'rssmrc88t10h501k',
      passport: { number: 'ya9182773', expiry: '04/2029' },
    });
    expect(body.fiscalCode).toBe('RSSMRC88T10H501K');
    expect(body.passport?.number).toBe('YA9182773');
  });

  it.each([
    ['a fiscal code of the wrong shape', { fiscalCode: 'RSSMRC88T10H501' }],
    ['a passport expiry that is not MM/YYYY', { passport: { number: 'YA9182773', expiry: '2029-04' } }],
    ['a month 13', { passport: { number: 'YA9182773', expiry: '13/2029' } }],
    ['a bio over 300 characters', { bio: 'x'.repeat(301) }],
    ['medical notes over 300 characters', { medicalNotes: 'x'.repeat(301) }],
  ])('rejects %s', (_case, body) => {
    expect(UpdateProfileBody.safeParse(body).success).toBe(false);
  });

  it('accepts null to clear the optional identity fields', () => {
    expect(UpdateProfileBody.parse({ fiscalCode: null, passport: null, username: null })).toEqual({
      fiscalCode: null,
      passport: null,
      username: null,
    });
  });
});
