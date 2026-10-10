import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import { createDocument, createTripWithCrew } from '../helpers/factories.js';
import { fileForm, HTML, JPEG, MP4, PDF } from '../helpers/files.js';
import { InMemoryStorage } from '../helpers/memory-storage.js';

async function asCoordinator(options: Parameters<typeof createTestApp>[0] = {}) {
  const crew = await createTripWithCrew();
  const testApp = await createTestApp(options);
  const api = await asUser(testApp.app, crew.coordinator);
  const upload = (form: FormData | object) => api.post(`/api/trips/${crew.trip.id}/documents`, form);
  return { ...crew, ...testApp, api, upload };
}

describe('POST /api/trips/:tripId/documents', () => {
  it('stores a PDF privately, with the type read from its content', async () => {
    const { trip, coordinator, storage, upload } = await asCoordinator();

    const response = await upload(
      fileForm(PDF, { filename: 'Voucher Hotel Kría.pdf', fields: { title: 'Voucher', code: 'HK-2231' } }),
    );

    expect(response.statusCode).toBe(201);
    const { document } = response.json();
    expect(document).toEqual({
      id: expect.any(String),
      kind: 'pdf',
      title: 'Voucher',
      subtitle: '',
      code: 'HK-2231',
      hasFile: true,
      originalName: 'Voucher Hotel Kría.pdf',
      mimeType: 'application/pdf',
      sizeBytes: PDF.length,
      createdAt: expect.any(String),
    });
    const stored = await prisma.document.findUniqueOrThrow({ where: { id: document.id } });
    expect(stored).toMatchObject({ uploadedById: coordinator.id, attached: false });
    expect(stored.storagePath).toMatch(new RegExp(`^trips/${trip.id}/documents/[0-9a-f-]{36}\\.pdf$`));
    expect(storage.objects.get(stored.storagePath!)).toEqual({ body: PDF, contentType: 'application/pdf' });
  });

  it('files a photo as an image and names it after the file by default', async () => {
    const { upload } = await asCoordinator();

    const response = await upload(fileForm(JPEG, { filename: 'biglietto.jpg', type: 'image/jpeg' }));

    expect(response.json().document).toMatchObject({
      kind: 'image',
      title: 'biglietto.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('accepts a QR without a file: the code is the content', async () => {
    const { upload, storage } = await asCoordinator();

    const response = await upload({ kind: 'qr', title: "Carta d'imbarco", code: 'FI-342-KEF-14C' });

    expect(response.statusCode).toBe(201);
    expect(response.json().document).toMatchObject({
      kind: 'qr',
      code: 'FI-342-KEF-14C',
      hasFile: false,
      mimeType: null,
    });
    expect(storage.objects.size).toBe(0);
  });

  it('refuses a JSON document that is not a QR', async () => {
    const { upload } = await asCoordinator();

    const response = await upload({ kind: 'pdf', title: 'Voucher', code: 'X' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['an HTML page disguised as a PDF', HTML, 'application/pdf'],
    ['a video', MP4, 'video/mp4'],
  ])('refuses %s, storing nothing', async (_case, bytes, type) => {
    const { upload, storage } = await asCoordinator();

    const response = await upload(fileForm(bytes, { filename: 'voucher.pdf', type }));

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(storage.objects.size).toBe(0);
    expect(await prisma.document.count()).toBe(0);
  });

  it('refuses an empty file, a missing file and a file over the limit', async () => {
    const { upload, storage } = await asCoordinator({ config: { UPLOAD_MAX_BYTES: 16 } });

    const empty = await upload(fileForm(Buffer.alloc(0)));
    const missing = new FormData();
    missing.append('title', 'Voucher');
    const noFile = await upload(missing);
    const tooBig = await upload(fileForm(Buffer.concat([PDF, Buffer.alloc(64)])));

    expect([empty, noFile, tooBig].map((response) => response.json().error.code)).toEqual([
      'EMPTY_FILE',
      'FILE_REQUIRED',
      'PAYLOAD_TOO_LARGE',
    ]);
    expect(storage.objects.size).toBe(0);
  });

  it('answers 502 when the storage rejects the upload, and records nothing', async () => {
    const storage = new InMemoryStorage();
    storage.failNext('upload');
    const { upload } = await asCoordinator({ storage });

    const response = await upload(fileForm(PDF));

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('STORAGE_UNAVAILABLE');
    expect(await prisma.document.count()).toBe(0);
  });

  it('removes the stored file when the trip disappears before the document is saved', async () => {
    const storage = new InMemoryStorage();
    const { trip, upload } = await asCoordinator({ storage });
    storage.onUpload = async () => {
      await prisma.trip.delete({ where: { id: trip.id } });
    };

    const response = await upload(fileForm(PDF));

    expect(response.statusCode).toBe(500);
    expect(storage.objects.size).toBe(0);
  });
});

describe('GET /api/trips/:tripId/documents/:documentId/url', () => {
  it('signs a short-lived URL for any member', async () => {
    const { trip, traveller, app, upload } = await asCoordinator();
    const documentId = (await upload(fileForm(PDF))).json().document.id as string;

    const response = await (
      await asUser(app, traveller)
    ).get(`/api/trips/${trip.id}/documents/${documentId}/url`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      url: expect.stringMatching(/^https:\/\/storage\.test\/signed\/.+\?expiresIn=900$/),
      expiresInSeconds: 900,
    });
  });

  it("does not sign another trip's document through a trip you belong to", async () => {
    const mine = await asCoordinator();
    const theirs = await createTripWithCrew();
    const document = await createDocument(theirs.trip.id);

    const response = await mine.api.get(`/api/trips/${mine.trip.id}/documents/${document.id}/url`);

    expect(response.statusCode).toBe(404);
  });

  it('answers 404 for a QR without a file and for an unknown document', async () => {
    const { trip, api, upload } = await asCoordinator();
    const qrId = (await upload({ kind: 'qr', title: 'QR', code: 'X' })).json().document.id as string;

    expect((await api.get(`/api/trips/${trip.id}/documents/${qrId}/url`)).statusCode).toBe(404);
    expect((await api.get(`/api/trips/${trip.id}/documents/${randomUUID()}/url`)).statusCode).toBe(404);
  });
});

describe('DELETE /api/trips/:tripId/documents/:documentId', () => {
  it('removes a document that never reached a slot, with its file', async () => {
    const { trip, api, storage, upload } = await asCoordinator();
    const documentId = (await upload(fileForm(PDF))).json().document.id as string;

    const response = await api.delete(`/api/trips/${trip.id}/documents/${documentId}`);

    expect(response.statusCode).toBe(204);
    expect(await prisma.document.count()).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it('refuses to remove a document attached to a slot', async () => {
    const { trip, api } = await asCoordinator();
    const document = await createDocument(trip.id, { attached: true });

    const response = await api.delete(`/api/trips/${trip.id}/documents/${document.id}`);

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('DOCUMENT_ATTACHED');
    expect(await prisma.document.count()).toBe(1);
  });
});
