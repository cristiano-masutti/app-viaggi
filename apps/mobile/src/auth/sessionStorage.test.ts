import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (value.length > 2048) throw new Error('SecureStore value too large');
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

import { chunkedSecureStorage } from '@/auth/sessionStorage';

const KEY = 'sb-project-auth-token';
const session = (length: number) => JSON.stringify({ access_token: 'x'.repeat(length) });

describe('chunkedSecureStorage', () => {
  beforeEach(() => mockStore.clear());

  it('round-trips a session larger than what SecureStore accepts in one value', async () => {
    const value = session(5000);

    await chunkedSecureStorage.setItem(KEY, value);

    expect(await chunkedSecureStorage.getItem(KEY)).toBe(value);
    expect(Number(mockStore.get(`${KEY}.count`))).toBeGreaterThan(1);
  });

  it('leaves no stale chunks when a shorter session replaces a longer one', async () => {
    await chunkedSecureStorage.setItem(KEY, session(6000));
    await chunkedSecureStorage.setItem(KEY, session(10));

    expect(await chunkedSecureStorage.getItem(KEY)).toBe(session(10));
    expect([...mockStore.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.count`]);
  });

  it('treats a missing chunk as no session rather than a truncated token', async () => {
    await chunkedSecureStorage.setItem(KEY, session(5000));
    mockStore.delete(`${KEY}.1`);

    expect(await chunkedSecureStorage.getItem(KEY)).toBeNull();
  });

  it('removes every chunk on sign out', async () => {
    await chunkedSecureStorage.setItem(KEY, session(5000));

    await chunkedSecureStorage.removeItem(KEY);

    expect(mockStore.size).toBe(0);
    expect(await chunkedSecureStorage.getItem(KEY)).toBeNull();
  });
});
