import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { authHeaders } from '../helpers/auth.js';
import { prisma } from '../helpers/db.js';
import { createTripWithCrew } from '../helpers/factories.js';
import { InMemoryStorage } from '../helpers/memory-storage.js';

const pdfForm = (content = '%PDF-1.7 voucher', filename = 'voucher.pdf') => {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/pdf' }), filename);
  return form;
};

/** Il coordinatore di un viaggio nuovo, pronto a caricare file. */
async function asCoordinator(options: Parameters<typeof createTestApp>[0] = {}) {
  const crew = await createTripWithCrew();
  const testApp = await createTestApp(options);
  const headers = await authHeaders(crew.coordinator);
  const upload = (payload: unknown, tripId = crew.trip.id) =>
    testApp.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/assets`,
      headers,
      payload: payload as never,
    });

  return { ...crew, ...testApp, headers, upload };
}

describe('POST /api/trips/:tripId/assets', () => {
  it('stores the file privately and records who uploaded it', async () => {
    const { trip, coordinator, storage, upload } = await asCoordinator();

    const response = await upload(pdfForm());

    expect(response.statusCode).toBe(201);
    const { asset } = response.json();
    expect(asset).toEqual({
      id: expect.any(String),
      tripId: trip.id,
      uploadedById: coordinator.id,
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
    const { trip, upload } = await asCoordinator();

    const response = await upload(pdfForm('x', '../../etc/passwd.<script>'));

    expect(response.statusCode).toBe(201);
    const stored = await prisma.tripAsset.findUniqueOrThrow({ where: { id: response.json().asset.id } });
    expect(stored.storagePath).toMatch(new RegExp(`^trips/${trip.id}/[0-9a-f-]{36}$`));
  });

  it('stores nothing when a traveller tries to upload', async () => {
    const { trip, traveller } = await createTripWithCrew();
    const { app, storage } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: `/api/trips/${trip.id}/assets`,
      headers: await authHeaders(traveller),
      payload: pdfForm(),
    });

    expect(response.statusCode).toBe(403);
    expect(storage.objects.size).toBe(0);
    expect(await prisma.tripAsset.count()).toBe(0);
  });

  it('answers 415 when the request is not multipart', async () => {
    const { upload } = await asCoordinator();

    const response = await upload({ file: 'not-a-file' });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('answers 400 when the multipart body has no file', async () => {
    const { upload } = await asCoordinator();
    const form = new FormData();
    form.append('note', 'just text');

    const response = await upload(form);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('FILE_REQUIRED');
  });

  it('answers 400 for an empty file', async () => {
    const { storage, upload } = await asCoordinator();

    const response = await upload(pdfForm(''));

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('EMPTY_FILE');
    expect(storage.objects.size).toBe(0);
  });

  it('answers 413 above UPLOAD_MAX_BYTES and stores nothing', async () => {
    const { storage, upload } = await asCoordinator({ config: { UPLOAD_MAX_BYTES: 8 } });

    const response = await upload(pdfForm('more than eight bytes'));

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(storage.objects.size).toBe(0);
    expect(await prisma.tripAsset.count()).toBe(0);
  });

  it('answers 502 when the storage rejects the upload, and records nothing', async () => {
    const storage = new InMemoryStorage();
    storage.failNext('upload');
    const { upload } = await asCoordinator({ storage });

    const response = await upload(pdfForm());

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: { code: 'STORAGE_UNAVAILABLE', message: 'File storage is unavailable' },
    });
    expect(await prisma.tripAsset.count()).toBe(0);
  });

  it('removes the uploaded file when the trip disappears before the asset is saved', async () => {
    const storage = new InMemoryStorage();
    const { trip, upload } = await asCoordinator({ storage });
    // Il viaggio viene cancellato mentre il file sta salendo sul bucket.
    storage.onUpload = async () => {
      await prisma.trip.delete({ where: { id: trip.id } });
    };

    const response = await upload(pdfForm());

    expect(response.statusCode).toBe(500);
    expect(storage.objects.size).toBe(0);
    expect(await prisma.tripAsset.count()).toBe(0);
  });
});

describe('GET /api/trips/:tripId/assets/:assetId/signed-url', () => {
  it('returns a short-lived signed URL to any member of the trip', async () => {
    const { app, trip, traveller, upload } = await asCoordinator();
    const assetId = (await upload(pdfForm())).json().asset.id as string;

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${trip.id}/assets/${assetId}/signed-url`,
      headers: await authHeaders(traveller),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      assetId,
      signedUrl: expect.stringMatching(/^https:\/\/storage\.test\/signed\/.+\?expiresIn=900$/),
      expiresInSeconds: 900,
    });
  });

  it("does not hand out another trip's asset through a trip you belong to", async () => {
    const mine = await asCoordinator();
    const theirs = await asCoordinator();
    const theirAssetId = (await theirs.upload(pdfForm())).json().asset.id as string;

    const response = await mine.app.inject({
      method: 'GET',
      url: `/api/trips/${mine.trip.id}/assets/${theirAssetId}/signed-url`,
      headers: mine.headers,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('answers 404 for an unknown asset', async () => {
    const { app, trip, headers } = await asCoordinator();

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${trip.id}/assets/${randomUUID()}/signed-url`,
      headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('answers 400 for an asset id that is not a UUID', async () => {
    const { app, trip, headers } = await asCoordinator();

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${trip.id}/assets/abc/signed-url`,
      headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('answers 502 when the storage cannot sign the URL', async () => {
    const { app, trip, headers, storage, upload } = await asCoordinator();
    const assetId = (await upload(pdfForm())).json().asset.id as string;
    storage.failNext('createSignedUrl');

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${trip.id}/assets/${assetId}/signed-url`,
      headers,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('STORAGE_UNAVAILABLE');
  });
});
