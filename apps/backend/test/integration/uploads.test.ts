import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { prisma } from '../helpers/db.js';
import { createTrip } from '../helpers/factories.js';
import { InMemoryStorage } from '../helpers/memory-storage.js';

const pdfForm = (content = '%PDF-1.7 voucher', filename = 'voucher.pdf') => {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/pdf' }), filename);
  return form;
};

describe('POST /api/uploads', () => {
  it('stores the file privately and records it on the trip', async () => {
    const trip = await createTrip();
    const { app, storage } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${trip.id}`,
      payload: pdfForm(),
    });

    expect(response.statusCode).toBe(201);
    const { asset } = response.json();
    expect(asset).toEqual({
      id: expect.any(String),
      tripId: trip.id,
      originalName: 'voucher.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 16,
      createdAt: expect.any(String),
    });
    // Il percorso sul bucket non esce mai dall'API.
    expect(asset).not.toHaveProperty('storagePath');

    const stored = await prisma.tripAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(stored.storagePath).toMatch(new RegExp(`^trips/${trip.id}/[0-9a-f-]{36}\\.pdf$`));
    expect(storage.objects.get(stored.storagePath)).toEqual({
      body: Buffer.from('%PDF-1.7 voucher'),
      contentType: 'application/pdf',
    });
  });

  it('never reuses the client file name on the bucket', async () => {
    const trip = await createTrip();
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${trip.id}`,
      payload: pdfForm('x', '../../etc/passwd.<script>'),
    });

    expect(response.statusCode).toBe(201);
    const stored = await prisma.tripAsset.findUniqueOrThrow({ where: { id: response.json().asset.id } });
    expect(stored.storagePath).toMatch(new RegExp(`^trips/${trip.id}/[0-9a-f-]{36}$`));
  });

  it('answers 400 when tripId is not a UUID', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'POST', url: '/api/uploads?tripId=abc', payload: pdfForm() });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request querystring',
    });
  });

  it('answers 404 when the trip does not exist, without touching the storage', async () => {
    const { app, storage } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${randomUUID()}`,
      payload: pdfForm(),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    expect(storage.objects.size).toBe(0);
  });

  it('answers 415 when the request is not multipart', async () => {
    const trip = await createTrip();
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${trip.id}`,
      payload: { file: 'not-a-file' },
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('answers 400 when the multipart body has no file', async () => {
    const trip = await createTrip();
    const { app } = await createTestApp();
    const form = new FormData();
    form.append('note', 'just text');

    const response = await app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${trip.id}`,
      payload: form,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('FILE_REQUIRED');
  });

  it('answers 400 for an empty file', async () => {
    const trip = await createTrip();
    const { app, storage } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${trip.id}`,
      payload: pdfForm(''),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('EMPTY_FILE');
    expect(storage.objects.size).toBe(0);
  });

  it('answers 413 above UPLOAD_MAX_BYTES and stores nothing', async () => {
    const trip = await createTrip();
    const { app, storage } = await createTestApp({ config: { UPLOAD_MAX_BYTES: 8 } });

    const response = await app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${trip.id}`,
      payload: pdfForm('more than eight bytes'),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(storage.objects.size).toBe(0);
    expect(await prisma.tripAsset.count()).toBe(0);
  });

  it('answers 502 when the storage rejects the upload, and records nothing', async () => {
    const trip = await createTrip();
    const storage = new InMemoryStorage();
    storage.failNext('upload');
    const { app } = await createTestApp({ storage });

    const response = await app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${trip.id}`,
      payload: pdfForm(),
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: { code: 'STORAGE_UNAVAILABLE', message: 'File storage is unavailable' },
    });
    expect(await prisma.tripAsset.count()).toBe(0);
  });

  it('removes the uploaded file when the trip disappears before the asset is saved', async () => {
    const trip = await createTrip();
    const storage = new InMemoryStorage();
    // Il viaggio viene cancellato mentre il file sta salendo sul bucket.
    storage.onUpload = async () => {
      await prisma.trip.delete({ where: { id: trip.id } });
    };
    const { app } = await createTestApp({ storage });

    const response = await app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${trip.id}`,
      payload: pdfForm(),
    });

    expect(response.statusCode).toBe(500);
    expect(storage.objects.size).toBe(0);
    expect(await prisma.tripAsset.count()).toBe(0);
  });
});

describe('GET /api/uploads/:assetId/signed-url', () => {
  const uploadVoucher = async () => {
    const trip = await createTrip();
    const created = await createTestApp();
    const response = await created.app.inject({
      method: 'POST',
      url: `/api/uploads?tripId=${trip.id}`,
      payload: pdfForm(),
    });
    return { ...created, assetId: response.json().asset.id as string };
  };

  it('returns a short-lived signed URL for an existing asset', async () => {
    const { app, assetId } = await uploadVoucher();

    const response = await app.inject({ method: 'GET', url: `/api/uploads/${assetId}/signed-url` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      assetId,
      signedUrl: expect.stringMatching(/^https:\/\/storage\.test\/signed\/.+\?expiresIn=900$/),
      expiresInSeconds: 900,
    });
  });

  it('answers 404 for an unknown asset', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: `/api/uploads/${randomUUID()}/signed-url` });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('answers 400 for an asset id that is not a UUID', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/uploads/abc/signed-url' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('answers 502 when the storage cannot sign the URL', async () => {
    const { app, storage, assetId } = await uploadVoucher();
    storage.failNext('createSignedUrl');

    const response = await app.inject({ method: 'GET', url: `/api/uploads/${assetId}/signed-url` });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('STORAGE_UNAVAILABLE');
  });
});
