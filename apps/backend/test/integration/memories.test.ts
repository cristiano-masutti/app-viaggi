import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import { createMemory, createTripWithCrew } from '../helpers/factories.js';
import { fileForm, HTML, JPEG, MP4 } from '../helpers/files.js';

async function setup() {
  const crew = await createTripWithCrew();
  const testApp = await createTestApp();
  const [coordinator, traveller] = [
    await asUser(testApp.app, crew.coordinator),
    await asUser(testApp.app, crew.traveller),
  ];
  return { ...crew, ...testApp, as: { coordinator, traveller }, base: `/api/trips/${crew.trip.id}/memories` };
}

const ids = (response: { json: () => { memories: Array<{ id: string }> } }) =>
  response.json().memories.map((memory) => memory.id);

describe('POST memories', () => {
  it('publishes a diary note', async () => {
    const { as, base, traveller } = await setup();

    const response = await as.traveller.post(base, {
      kind: 'note',
      dayIndex: 3,
      visibility: 'crew',
      text: '  Il pulmino si è insabbiato  ',
      mood: 'anecdote',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().memory).toEqual({
      id: expect.any(String),
      kind: 'note',
      dayIndex: 3,
      authorId: traveller.id,
      visibility: 'crew',
      text: 'Il pulmino si è insabbiato',
      mood: 'anecdote',
      createdAt: expect.any(String),
    });
  });

  it('always files a private note as personal', async () => {
    const { as, base } = await setup();

    const response = await as.traveller.post(base, {
      kind: 'note',
      dayIndex: 1,
      visibility: 'private',
      text: 'Solo per me',
      mood: 'place',
    });

    expect(response.json().memory).toMatchObject({ visibility: 'private', mood: 'personal' });
  });

  it('publishes a photo with its shape known in advance', async () => {
    const { as, base, storage, trip } = await setup();

    const response = await as.traveller.post(
      base,
      fileForm(JPEG, {
        filename: 'IMG_0042.jpg',
        fields: {
          dayIndex: 2,
          visibility: 'crew',
          caption: 'Skógafoss',
          aspectRatio: 0.75,
          blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
        },
      }),
    );

    expect(response.statusCode).toBe(201);
    const { memory } = response.json();
    expect(memory).toMatchObject({
      kind: 'photo',
      dayIndex: 2,
      caption: 'Skógafoss',
      aspectRatio: 0.75,
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      mimeType: 'image/jpeg',
      reactions: {},
      myReaction: null,
    });
    const stored = await prisma.memory.findUniqueOrThrow({ where: { id: memory.id } });
    expect(stored.storagePath).toMatch(new RegExp(`^trips/${trip.id}/memories/[0-9a-f-]{36}\\.jpg$`));
    expect(storage.objects.get(stored.storagePath!)?.contentType).toBe('image/jpeg');
  });

  it('recognises a video from its content', async () => {
    const { as, base } = await setup();

    const response = await as.coordinator.post(
      base,
      fileForm(MP4, {
        filename: 'clip.mp4',
        fields: { dayIndex: 1, visibility: 'crew', durationSeconds: 14 },
      }),
    );

    expect(response.json().memory).toMatchObject({
      kind: 'video',
      durationSeconds: 14,
      mimeType: 'video/mp4',
    });
  });

  it.each([
    [
      'a day outside the trip',
      { kind: 'note', dayIndex: 11, visibility: 'crew', text: 'x', mood: 'thought' },
      404,
    ],
    ['an empty note', { kind: 'note', dayIndex: 1, visibility: 'crew', text: '   ', mood: 'thought' }, 400],
    ['an unknown mood', { kind: 'note', dayIndex: 1, visibility: 'crew', text: 'x', mood: 'angry' }, 400],
  ])('refuses %s', async (_case, body, status) => {
    const { as, base } = await setup();

    expect((await as.traveller.post(base, body)).statusCode).toBe(status);
    expect(await prisma.memory.count()).toBe(0);
  });

  it('refuses a file that is not a photo or a video, storing nothing', async () => {
    const { as, base, storage } = await setup();

    const response = await as.traveller.post(
      base,
      fileForm(HTML, {
        filename: 'foto.jpg',
        type: 'image/jpeg',
        fields: { dayIndex: 1, visibility: 'crew' },
      }),
    );

    expect(response.statusCode).toBe(415);
    expect(storage.objects.size).toBe(0);
  });
});

describe('GET memories', () => {
  it("shows the crew's memories and my private ones, never someone else's private ones", async () => {
    const { as, base, trip, coordinator, traveller } = await setup();
    const shared = await createMemory(trip.id, coordinator.id);
    const theirSecret = await createMemory(trip.id, coordinator.id, { visibility: 'private' });
    const mySecret = await createMemory(trip.id, traveller.id, { visibility: 'private' });

    const mine = ids(await as.traveller.get(base));
    const theirs = ids(await as.coordinator.get(base));

    expect(mine.sort()).toEqual([shared.id, mySecret.id].sort());
    expect(theirs.sort()).toEqual([shared.id, theirSecret.id].sort());
  });

  it('filters by day, by author and by kind', async () => {
    const { as, base, trip, coordinator, traveller } = await setup();
    const day2Note = await createMemory(trip.id, coordinator.id, { dayIndex: 2 });
    const myPhoto = await createMemory(trip.id, traveller.id, { kind: 'photo', dayIndex: 1 });
    await createMemory(trip.id, coordinator.id, { kind: 'photo', dayIndex: 1 });

    expect(ids(await as.traveller.get(`${base}?day=2`))).toEqual([day2Note.id]);
    expect(ids(await as.traveller.get(`${base}?author=me`))).toEqual([myPhoto.id]);
    expect(ids(await as.traveller.get(`${base}?author=${coordinator.id}&kind=note`))).toEqual([day2Note.id]);
    expect(ids(await as.traveller.get(`${base}?kind=media`))).toHaveLength(2);
  });

  it('pages from the newest, without skipping or repeating memories created at the same instant', async () => {
    const { as, base, trip, traveller } = await setup();
    const sameInstant = new Date('2026-09-16T18:42:00Z');
    for (let n = 0; n < 5; n += 1) {
      await createMemory(trip.id, traveller.id, {
        createdAt: n < 3 ? sameInstant : new Date(Date.UTC(2026, 8, 17, n)),
      });
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const response = await as.traveller.get(`${base}?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...ids(response));
      cursor = response.json().nextCursor;
      pages += 1;
    } while (cursor);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(5);
    const all = await prisma.memory.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    expect(seen).toEqual(all.map((memory) => memory.id));
  });

  it('signs the media of a page with one storage call, and still lists it if the storage is down', async () => {
    const { as, base, trip, coordinator, storage } = await setup();
    const photo = await createMemory(trip.id, coordinator.id, { kind: 'photo' });
    storage.objects.set(photo.storagePath!, { body: JPEG, contentType: 'image/jpeg' });
    const note = await createMemory(trip.id, coordinator.id);

    const memories = (await as.traveller.get(base)).json().memories;
    const byId = (id: string) => memories.find((memory: { id: string }) => memory.id === id);
    expect(byId(photo.id).mediaUrl).toMatch(/^https:\/\/storage\.test\/signed\/.+\?expiresIn=900$/);
    expect(byId(note.id)).not.toHaveProperty('mediaUrl');

    storage.failNext('createSignedUrls');
    const degraded = await as.traveller.get(base);
    expect(degraded.statusCode).toBe(200);
    expect(
      degraded.json().memories.find((memory: { id: string }) => memory.id === photo.id).mediaUrl,
    ).toBeNull();
  });

  it.each([
    ['garbage', 'garbage'],
    // Data valida ma id non UUID: senza controllo arriverebbe a Postgres come 500.
    ['a forged id', Buffer.from('2026-09-16T18:42:00.000Z|not-a-uuid').toString('base64url')],
  ])('refuses a malformed cursor (%s)', async (_case, cursor) => {
    const { as, base } = await setup();

    const response = await as.traveller.get(`${base}?cursor=${cursor}`);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_CURSOR');
  });
});

describe('changing memories', () => {
  it('lets the author fix a note, and nobody else', async () => {
    const { as, base, trip, traveller } = await setup();
    const note = await createMemory(trip.id, traveller.id, { text: 'Typo' });

    const byOther = await as.coordinator.patch(`${base}/${note.id}`, { text: 'Hack' });
    const byAuthor = await as.traveller.patch(`${base}/${note.id}`, { text: 'Corretto' });

    expect(byOther.statusCode).toBe(403);
    expect(byAuthor.json().memory.text).toBe('Corretto');
  });

  it('edits the caption of a photo but not its text, and the other way round for notes', async () => {
    const { as, base, trip, traveller } = await setup();
    const photo = await createMemory(trip.id, traveller.id, { kind: 'photo', caption: 'Vecchia' });
    const note = await createMemory(trip.id, traveller.id);

    expect(
      (await as.traveller.patch(`${base}/${photo.id}`, { caption: '' })).json().memory.caption,
    ).toBeNull();
    expect((await as.traveller.patch(`${base}/${photo.id}`, { text: 'x' })).json().error.code).toBe(
      'WRONG_MEMORY_FIELD',
    );
    expect((await as.traveller.patch(`${base}/${note.id}`, { caption: 'x' })).json().error.code).toBe(
      'WRONG_MEMORY_FIELD',
    );
  });

  it("answers 404 to anyone touching someone else's private memory", async () => {
    const { as, base, trip, traveller } = await setup();
    const secret = await createMemory(trip.id, traveller.id, { kind: 'photo', visibility: 'private' });

    expect((await as.coordinator.patch(`${base}/${secret.id}`, { caption: 'x' })).statusCode).toBe(404);
    expect((await as.coordinator.delete(`${base}/${secret.id}`)).statusCode).toBe(404);
    expect((await as.coordinator.put(`${base}/${secret.id}/reaction`, { reaction: 'fire' })).statusCode).toBe(
      404,
    );
    expect((await as.coordinator.get(`${base}/${secret.id}/media-url`)).statusCode).toBe(404);
  });

  it('lets the author delete a photo, with its file', async () => {
    const { as, base, trip, traveller, storage } = await setup();
    const photo = await createMemory(trip.id, traveller.id, { kind: 'photo' });
    storage.objects.set(photo.storagePath!, { body: JPEG, contentType: 'image/jpeg' });

    expect((await as.coordinator.delete(`${base}/${photo.id}`)).statusCode).toBe(403);
    expect((await as.traveller.delete(`${base}/${photo.id}`)).statusCode).toBe(204);
    expect(storage.objects.size).toBe(0);
    expect((await as.traveller.delete(`${base}/${photo.id}`)).statusCode).toBe(404);
  });

  it('signs the media URL for whoever can see the memory', async () => {
    const { as, base, trip, coordinator, storage } = await setup();
    const photo = await createMemory(trip.id, coordinator.id, { kind: 'photo' });
    storage.objects.set(photo.storagePath!, { body: JPEG, contentType: 'image/jpeg' });
    const note = await createMemory(trip.id, coordinator.id);

    expect((await as.traveller.get(`${base}/${photo.id}/media-url`)).json()).toMatchObject({
      expiresInSeconds: 900,
    });
    expect((await as.traveller.get(`${base}/${note.id}/media-url`)).statusCode).toBe(404);
    expect((await as.traveller.get(`${base}/${randomUUID()}/media-url`)).statusCode).toBe(404);
  });
});

describe('reactions', () => {
  it('keeps one reaction per person and counts them', async () => {
    const { as, base, trip, traveller } = await setup();
    const photo = await createMemory(trip.id, traveller.id, { kind: 'photo' });
    const url = `${base}/${photo.id}/reaction`;

    await as.coordinator.put(url, { reaction: 'fire' });
    await as.traveller.put(url, { reaction: 'fire' });
    const changed = await as.traveller.put(url, { reaction: 'love' });

    expect(changed.json()).toEqual({ reactions: { fire: 1, love: 1 }, myReaction: 'love' });
    const listed = (await as.coordinator.get(base)).json().memories[0];
    expect(listed).toMatchObject({ reactions: { fire: 1, love: 1 }, myReaction: 'fire' });

    expect((await as.traveller.delete(url)).json()).toEqual({ reactions: { fire: 1 }, myReaction: null });
    // Togliere una reazione che non c'è non è un errore.
    expect((await as.traveller.delete(url)).statusCode).toBe(200);
  });

  it('does not take reactions on notes or unknown emoji', async () => {
    const { as, base, trip, traveller } = await setup();
    const note = await createMemory(trip.id, traveller.id);
    const photo = await createMemory(trip.id, traveller.id, { kind: 'photo' });

    expect((await as.coordinator.put(`${base}/${note.id}/reaction`, { reaction: 'fire' })).statusCode).toBe(
      409,
    );
    expect((await as.coordinator.put(`${base}/${photo.id}/reaction`, { reaction: '🔥' })).statusCode).toBe(
      400,
    );
  });
});
