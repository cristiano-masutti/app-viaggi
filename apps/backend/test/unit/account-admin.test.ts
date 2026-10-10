import { describe, expect, it } from 'vitest';

import { generateTemporaryPassword } from '../../src/auth/account-admin.js';

describe('generateTemporaryPassword', () => {
  it('is four groups of four characters that cannot be confused when read aloud', () => {
    const password = generateTemporaryPassword();
    expect(password).toMatch(/^[a-hjkmnp-z2-9]{4}(-[a-hjkmnp-z2-9]{4}){3}$/);
  });

  it('is different every time', () => {
    const passwords = new Set(Array.from({ length: 200 }, generateTemporaryPassword));
    expect(passwords.size).toBe(200);
  });
});
