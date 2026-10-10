import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import { createDocument, createTripWithCrew } from '../helpers/factories.js';
import { PDF } from '../helpers/files.js';

async function setup() {
  const crew = await createTripWithCrew();
  const testApp = await createTestApp();
  const api = await asUser(testApp.app, crew.coordinator);
  /** Un documento caricato e il suo file nel bucket, pronto da collegare. */
  const uploaded = async () => {
    const document = await createDocument(crew.trip.id);
    testApp.storage.objects.set(document.storagePath!, { body: PDF, contentType: 'application/pdf' });
    return document;
  };
  return { ...crew, ...testApp, api, uploaded, base: `/api/trips/${crew.trip.id}` };
}

describe('stay of the day', () => {
  it('sets the stay of a day with its voucher', async () => {
    const { api, base, uploaded } = await setup();
    const voucher = await uploaded();

    const response = await api.put(`${base}/days/3/stay`, {
      name: 'Hotel Kría, Vík',
      address: 'Sléttuvegur 12',
      documentId: voucher.id,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().stay).toMatchObject({
      name: 'Hotel Kría, Vík',
      address: 'Sléttuvegur 12',
      doc: { id: voucher.id, kind: 'pdf', hasFile: true },
    });
    const day3 = (await api.get(base)).json().trip.days[2];
    expect(day3.stay).toMatchObject({ name: 'Hotel Kría, Vík', doc: { id: voucher.id } });
    expect((await prisma.document.findUniqueOrThrow({ where: { id: voucher.id } })).attached).toBe(true);
  });

  it('replaces the voucher and deletes the old one with its file', async () => {
    const { api, base, uploaded, storage } = await setup();
    const [oldVoucher, newVoucher] = [await uploaded(), await uploaded()];
    await api.put(`${base}/days/1/stay`, { name: 'Hotel', address: 'Via', documentId: oldVoucher.id });

    const response = await api.put(`${base}/days/1/stay`, {
      name: 'Hotel',
      address: 'Via',
      documentId: newVoucher.id,
    });

    expect(response.json().stay.doc.id).toBe(newVoucher.id);
    expect(await prisma.document.findUnique({ where: { id: oldVoucher.id } })).toBeNull();
    expect(storage.objects.has(oldVoucher.storagePath!)).toBe(false);
    expect(storage.objects.has(newVoucher.storagePath!)).toBe(true);
  });

  it('keeps the voucher when the body does not mention it, and detaches it on null', async () => {
    const { api, base, uploaded, storage } = await setup();
    const voucher = await uploaded();
    await api.put(`${base}/days/1/stay`, { name: 'Hotel', address: 'Via', documentId: voucher.id });

    const renamed = await api.put(`${base}/days/1/stay`, { name: 'Hotel Nuovo', address: 'Via' });
    expect(renamed.json().stay).toMatchObject({ name: 'Hotel Nuovo', doc: { id: voucher.id } });

    const detached = await api.put(`${base}/days/1/stay`, {
      name: 'Hotel Nuovo',
      address: 'Via',
      documentId: null,
    });
    expect(detached.json().stay.doc).toBeNull();
    expect(storage.objects.has(voucher.storagePath!)).toBe(false);
  });

  it('removes the stay of a day with its voucher', async () => {
    const { api, base, uploaded, storage } = await setup();
    const voucher = await uploaded();
    await api.put(`${base}/days/2/stay`, { name: 'Hotel', address: 'Via', documentId: voucher.id });

    expect((await api.delete(`${base}/days/2/stay`)).statusCode).toBe(204);
    expect((await api.delete(`${base}/days/2/stay`)).statusCode).toBe(404);
    expect(await prisma.document.count()).toBe(0);
    expect(storage.objects.size).toBe(0);
  });

  it('answers 404 for a day outside the trip', async () => {
    const { api, base } = await setup();

    for (const day of [0, 11]) {
      const response = await api.put(`${base}/days/${day}/stay`, { name: 'Hotel', address: 'Via' });
      expect(response.statusCode).toBe(day === 0 ? 400 : 404);
    }
  });
});

describe('activities', () => {
  it('appends activities to the day in order', async () => {
    const { api, base } = await setup();

    await api.post(`${base}/days/4/activities`, { name: 'Trekking sul ghiacciaio', place: 'Sólheimajökull' });
    await api.post(`${base}/days/4/activities`, { name: 'Cena', place: 'Vík' });

    const day4 = (await api.get(base)).json().trip.days[3];
    expect(
      day4.activities.map((activity: { name: string; position: number }) => [
        activity.name,
        activity.position,
      ]),
    ).toEqual([
      ['Trekking sul ghiacciaio', 0],
      ['Cena', 1],
    ]);
  });

  it('edits, moves to the end of another day, and deletes an activity', async () => {
    const { api, base, uploaded, storage } = await setup();
    const ticket = await uploaded();
    const first = (await api.post(`${base}/days/1/activities`, { name: 'Museo', place: 'Reykjavík' })).json()
      .activity;
    await api.post(`${base}/days/2/activities`, { name: 'Laguna Blu', place: 'Grindavík' });

    const moved = await api.patch(`${base}/activities/${first.id}`, {
      name: 'Museo Nazionale',
      dayIndex: 2,
      documentId: ticket.id,
    });
    expect(moved.json().activity).toMatchObject({
      name: 'Museo Nazionale',
      dayIndex: 2,
      position: 1,
      doc: { id: ticket.id },
    });

    expect((await api.delete(`${base}/activities/${first.id}`)).statusCode).toBe(204);
    expect(storage.objects.has(ticket.storagePath!)).toBe(false);
    expect((await api.patch(`${base}/activities/${first.id}`, { name: 'X' })).statusCode).toBe(404);
  });

  it('refuses to attach the same document to two slots', async () => {
    const { api, base, uploaded } = await setup();
    const ticket = await uploaded();
    await api.post(`${base}/days/1/activities`, { name: 'Museo', place: 'Reykjavík', documentId: ticket.id });

    const second = await api.post(`${base}/days/1/activities`, {
      name: 'Cena',
      place: 'Vík',
      documentId: ticket.id,
    });
    const stay = await api.put(`${base}/days/1/stay`, {
      name: 'Hotel',
      address: 'Via',
      documentId: ticket.id,
    });

    for (const response of [second, stay]) {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('DOCUMENT_UNAVAILABLE');
    }
    // La richiesta rifiutata non lascia nulla a metà.
    expect(await prisma.activity.count()).toBe(1);
    expect(await prisma.stay.count()).toBe(0);
  });

  it('refuses a document from another trip', async () => {
    const { api, base } = await setup();
    const elsewhere = await createTripWithCrew();
    const theirs = await createDocument(elsewhere.trip.id);

    const response = await api.post(`${base}/days/1/activities`, {
      name: 'Museo',
      place: 'X',
      documentId: theirs.id,
    });

    expect(response.statusCode).toBe(409);
    expect((await prisma.document.findUniqueOrThrow({ where: { id: theirs.id } })).attached).toBe(false);
  });

  it("cannot touch another trip's activity", async () => {
    const { api, base } = await setup();
    const elsewhere = await createTripWithCrew();
    const theirs = await prisma.activity.create({
      data: { tripId: elsewhere.trip.id, dayIndex: 1, name: 'Loro', place: 'X', position: 0 },
    });

    expect((await api.patch(`${base}/activities/${theirs.id}`, { name: 'Mio' })).statusCode).toBe(404);
    expect((await api.delete(`${base}/activities/${theirs.id}`)).statusCode).toBe(404);
    expect(await prisma.activity.count()).toBe(1);
  });
});
