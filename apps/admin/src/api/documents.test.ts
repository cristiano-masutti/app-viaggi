import { describe, expect, it, vi } from 'vitest';

import { resolveDocumentId, uploadDocument } from './documents';

describe('resolveDocumentId', () => {
  it('leaves, detaches or uploads the document of a slot', async () => {
    const upload = vi.fn(async () => 'new-id');
    const file = new File(['%PDF'], 'voucher.pdf', { type: 'application/pdf' });

    await expect(resolveDocumentId({ kind: 'keep' }, upload)).resolves.toBeUndefined();
    await expect(resolveDocumentId({ kind: 'remove' }, upload)).resolves.toBeNull();
    await expect(resolveDocumentId({ kind: 'upload', file }, upload)).resolves.toBe('new-id');
    expect(upload).toHaveBeenCalledTimes(1);
  });
});

describe('uploadDocument', () => {
  it('sends the file as multipart with the token, and returns the new id', async () => {
    const fetch = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ document: { id: 'doc-1' } }), { status: 201 }),
    );
    const file = new File(['%PDF'], 'voucher.pdf', { type: 'application/pdf' });

    const id = await uploadDocument(
      {
        baseUrl: 'https://api.test',
        getAccessToken: async () => 'token-1',
        fetch: fetch as unknown as typeof globalThis.fetch,
      },
      'trip-1',
      file,
      'Voucher di prenotazione',
    );

    expect(id).toBe('doc-1');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.test/api/trips/trip-1/documents');
    expect(init.headers).toEqual({ Authorization: 'Bearer token-1' });
    const form = init.body as FormData;
    expect(form.get('title')).toBe('Voucher di prenotazione');
    expect(form.get('subtitle')).toBe('voucher.pdf');
    expect((form.get('file') as File).name).toBe('voucher.pdf');
  });

  it('closes the session when the token has expired, like the typed client', async () => {
    const onUnauthorized = vi.fn();
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: 'INVALID_TOKEN', message: 'expired' } }), {
          status: 401,
        }),
    );
    const upload = uploadDocument(
      {
        baseUrl: 'https://api.test',
        getAccessToken: async () => 'old',
        onUnauthorized,
        fetch: fetch,
      },
      'trip-1',
      new File(['%PDF'], 'voucher.pdf', { type: 'application/pdf' }),
      'Voucher',
    );

    await expect(upload).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports the reason when the server refuses the file', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: 'UNSUPPORTED_FILE_TYPE', message: 'nope' } }), {
          status: 415,
        }),
    );
    const upload = uploadDocument(
      {
        baseUrl: 'https://api.test',
        getAccessToken: async () => null,
        fetch: fetch,
      },
      'trip-1',
      new File(['<html>'], 'finto.pdf'),
      'Voucher',
    );
    await expect(upload).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_FILE_TYPE' });
  });
});
