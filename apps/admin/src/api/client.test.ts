import { describe, expect, it } from 'vitest';

import { ApiError, errorMessage, unwrap } from './client';

const response = (status: number) => new Response(null, { status });

describe('unwrap', () => {
  it('returns the data of a successful call', async () => {
    await expect(unwrap(Promise.resolve({ data: { ok: 1 }, response: response(200) }))).resolves.toEqual({
      ok: 1,
    });
  });

  it('turns the error envelope into an ApiError', async () => {
    const call = unwrap(
      Promise.resolve({
        error: { error: { code: 'TRIP_FULL', message: 'All the places are taken' } },
        response: response(409),
      }),
    );
    await expect(call).rejects.toMatchObject({ status: 409, code: 'TRIP_FULL' });
  });
});

describe('errorMessage', () => {
  it('explains the API codes in Italian, and only real network failures as such', () => {
    expect(errorMessage(new ApiError(409, 'LAST_COORDINATOR', 'x'))).toMatch(/almeno un coordinatore/);
    expect(errorMessage(new ApiError(409, 'EMAIL_TAKEN', 'x'))).toBe(
      'Esiste già un account con questa email.',
    );
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe('Nessuna connessione con il server.');
    expect(errorMessage(new TypeError("Cannot read properties of undefined (reading 'id')"), 'Errore.')).toBe(
      'Errore.',
    );
    expect(errorMessage(new ApiError(500, 'INTERNAL_ERROR', 'x'), 'Errore.')).toBe('Errore.');
  });
});
