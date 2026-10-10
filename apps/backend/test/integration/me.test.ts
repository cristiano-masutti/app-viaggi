import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { fileForm, HTML, JPEG, PDF } from '../helpers/files.js';

async function setup() {
  const user = await createUser({ email: 'marco@example.test' });
  const testApp = await createTestApp();
  return { user, ...testApp, api: await asUser(testApp.app, { id: user.id, email: 'marco@example.test' }) };
}

describe('GET /api/me', () => {
  it('returns an empty profile for a new user', async () => {
    const { api, user } = await setup();

    const response = await api.get('/api/me');

    expect(response.json().user).toEqual({
      id: user.id,
      email: 'marco@example.test',
      firstName: '',
      lastName: '',
      username: null,
      bio: '',
      fiscalCode: null,
      diet: '',
      medicalNotes: '',
      passport: null,
      createdAt: expect.any(String),
    });
  });
});

describe('PATCH /api/me', () => {
  it('updates the profile, normalising what it can', async () => {
    const { api } = await setup();

    const response = await api.patch('/api/me', {
      firstName: ' Marco ',
      lastName: 'Rossi',
      username: '@MarcoRossi',
      bio: 'Sveglia presto, ultimo a dormire.',
      fiscalCode: 'rssmrc88t10h501k',
      diet: 'Onnivoro',
      medicalNotes: 'Allergia alle arachidi',
      passport: { number: 'ya9182773', expiry: '04/2029' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({
      firstName: 'Marco',
      username: 'marcorossi',
      fiscalCode: 'RSSMRC88T10H501K',
      medicalNotes: 'Allergia alle arachidi',
      passport: { number: 'YA9182773', expiry: '04/2029', hasPhoto: false },
    });
  });

  it('leaves untouched what the body does not mention', async () => {
    const { api } = await setup();
    await api.patch('/api/me', { firstName: 'Marco', diet: 'Vegetariano' });

    const response = await api.patch('/api/me', { bio: 'Nuova bio' });

    expect(response.json().user).toMatchObject({ firstName: 'Marco', diet: 'Vegetariano', bio: 'Nuova bio' });
  });

  it('refuses a username already taken, whatever the case', async () => {
    await createUser({ username: 'marcorossi' });
    const { api } = await setup();

    const response = await api.patch('/api/me', { username: '@MARCOROSSI' });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('USERNAME_TAKEN');
  });

  it('clears the passport together with its photo', async () => {
    const { api, storage } = await setup();
    await api.patch('/api/me', { passport: { number: 'YA9182773', expiry: '04/2029' } });
    await api.put('/api/me/passport/photo', fileForm(JPEG, { filename: 'passaporto.jpg' }));
    expect(storage.objects.size).toBe(1);

    const response = await api.patch('/api/me', { passport: null });

    expect(response.json().user.passport).toBeNull();
    expect(storage.objects.size).toBe(0);
  });
});

describe('passport photo', () => {
  it('stores the scan, replaces it, signs it and deletes it', async () => {
    const { api, user, storage } = await setup();

    const first = await api.put('/api/me/passport/photo', fileForm(JPEG, { filename: 'pagina-dati.jpg' }));
    expect(first.json().passport).toEqual({ number: null, expiry: null, hasPhoto: true });
    const firstPath = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passportPhotoPath!;
    expect(firstPath).toMatch(new RegExp(`^users/${user.id}/passport/[0-9a-f-]{36}\\.jpg$`));

    await api.put('/api/me/passport/photo', fileForm(PDF, { filename: 'scansione.pdf' }));
    expect(storage.objects.has(firstPath)).toBe(false);
    expect(storage.objects.size).toBe(1);

    expect((await api.get('/api/me/passport/photo/url')).json()).toMatchObject({ expiresInSeconds: 900 });
    expect((await api.delete('/api/me/passport/photo')).statusCode).toBe(204);
    expect(storage.objects.size).toBe(0);
    expect((await api.get('/api/me/passport/photo/url')).statusCode).toBe(404);
  });

  it('refuses a file that is not an image or a PDF', async () => {
    const { api, storage } = await setup();

    const response = await api.put(
      '/api/me/passport/photo',
      fileForm(HTML, { filename: 'passaporto.jpg', type: 'image/jpeg' }),
    );

    expect(response.statusCode).toBe(415);
    expect(storage.objects.size).toBe(0);
  });

  it("is never reachable for another user's passport", async () => {
    const { api: mine, storage, app } = await setup();
    await mine.put('/api/me/passport/photo', fileForm(JPEG));
    const someoneElse = await asUser(app, await createUser());

    expect((await someoneElse.get('/api/me/passport/photo/url')).statusCode).toBe(404);
    expect(storage.objects.size).toBe(1);
  });
});
