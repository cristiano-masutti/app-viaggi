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
  const uploaded = async () => {
    const document = await createDocument(crew.trip.id);
    testApp.storage.objects.set(document.storagePath!, { body: PDF, contentType: 'application/pdf' });
    return document;
  };
  return { ...crew, ...testApp, api, uploaded, base: `/api/trips/${crew.trip.id}` };
}

describe('transports', () => {
  it('adds a vehicle with its documents, in order', async () => {
    const { api, base, uploaded } = await setup();
    const contract = await uploaded();

    const response = await api.post(`${base}/transports`, {
      name: 'Van 4x4 noleggiato',
      reference: 'Targa AB-123',
      mode: 'van',
      docs: [{ label: 'Contratto', documentId: contract.id }, { label: 'Polizza kasko' }],
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().transport).toMatchObject({
      name: 'Van 4x4 noleggiato',
      mode: 'van',
      docs: [
        { label: 'Contratto', doc: { id: contract.id } },
        { label: 'Polizza kasko', doc: null },
      ],
    });
  });

  it('rewrites the vehicle: updates, adds and removes documents', async () => {
    const { api, base, uploaded, storage } = await setup();
    const [contract, kasko, boardingPass] = [await uploaded(), await uploaded(), await uploaded()];
    const created = (
      await api.post(`${base}/transports`, {
        name: 'Volo',
        mode: 'flight',
        docs: [
          { label: 'Contratto', documentId: contract.id },
          { label: 'Kasko', documentId: kasko.id },
        ],
      })
    ).json().transport;
    const [contractDoc] = created.docs;

    const response = await api.put(`${base}/transports/${created.id}`, {
      name: 'Volo FI342',
      reference: 'Gate 14',
      mode: 'flight',
      docs: [
        { label: "Carta d'imbarco", documentId: boardingPass.id },
        { id: contractDoc.id, label: 'Contratto firmato' },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().transport).toMatchObject({
      name: 'Volo FI342',
      docs: [
        { label: "Carta d'imbarco", doc: { id: boardingPass.id } },
        { id: contractDoc.id, label: 'Contratto firmato', doc: { id: contract.id } },
      ],
    });
    // La kasko non è più nell'elenco: via documento e file.
    expect(await prisma.document.findUnique({ where: { id: kasko.id } })).toBeNull();
    expect(storage.objects.has(kasko.storagePath!)).toBe(false);
  });

  it('refuses a document entry that belongs to another vehicle, changing nothing', async () => {
    const { api, base } = await setup();
    const van = (
      await api.post(`${base}/transports`, { name: 'Van', mode: 'van', docs: [{ label: 'Contratto' }] })
    ).json().transport;
    const ferry = (await api.post(`${base}/transports`, { name: 'Traghetto', mode: 'ferry' })).json()
      .transport;

    const response = await api.put(`${base}/transports/${ferry.id}`, {
      name: 'Traghetto',
      mode: 'ferry',
      docs: [{ id: van.docs[0].id, label: 'Rubato' }],
    });

    expect(response.statusCode).toBe(404);
    expect((await prisma.transportDoc.findUniqueOrThrow({ where: { id: van.docs[0].id } })).label).toBe(
      'Contratto',
    );
  });

  it('deletes a vehicle with all its documents', async () => {
    const { api, base, uploaded, storage } = await setup();
    const contract = await uploaded();
    const van = (
      await api.post(`${base}/transports`, {
        name: 'Van',
        mode: 'van',
        docs: [{ label: 'Contratto', documentId: contract.id }],
      })
    ).json().transport;

    expect((await api.delete(`${base}/transports/${van.id}`)).statusCode).toBe(204);
    expect(await prisma.document.count()).toBe(0);
    expect(storage.objects.size).toBe(0);
    expect((await api.delete(`${base}/transports/${van.id}`)).statusCode).toBe(404);
  });
});

describe('insurance and customs', () => {
  it('sets, replaces and removes the insurance with its certificate', async () => {
    const { api, base, uploaded, storage } = await setup();
    const [first, second] = [await uploaded(), await uploaded()];

    const created = await api.put(`${base}/insurance`, {
      company: 'Europ Assistance',
      policy: 'VM-88231-IS',
      coverage: 'fino al 24/09',
      emergencyPhone: '+39 02 5828 6666',
      documentId: first.id,
    });
    expect(created.json().insurance).toMatchObject({
      emergencyPhone: '+390258286666',
      doc: { id: first.id },
    });

    await api.put(`${base}/insurance`, {
      company: 'Europ Assistance',
      policy: 'VM-88231-IS',
      documentId: second.id,
    });
    expect(storage.objects.has(first.storagePath!)).toBe(false);

    expect((await api.delete(`${base}/insurance`)).statusCode).toBe(204);
    expect((await api.delete(`${base}/insurance`)).statusCode).toBe(404);
    expect(storage.objects.size).toBe(0);
    expect((await api.get(base)).json().trip.documents.insurance).toBeNull();
  });

  it('sets and removes the customs form', async () => {
    const { api, base } = await setup();

    const response = await api.put(`${base}/customs`, { code: 'KEF-4472-IS', note: 'Islanda, Keflavík' });

    expect(response.json().customs).toEqual({ code: 'KEF-4472-IS', note: 'Islanda, Keflavík', doc: null });
    expect((await api.get(base)).json().trip.documents.customs).toMatchObject({ code: 'KEF-4472-IS' });
    expect((await api.delete(`${base}/customs`)).statusCode).toBe(204);
  });
});

describe('emergency contacts', () => {
  it('replaces the SOS cards, keeping the order given', async () => {
    const { api, base } = await setup();
    await api.put(`${base}/emergencies`, {
      contacts: [{ title: 'Vecchia', actionLabel: 'Chiama', phone: '1' + '23' }],
    });

    const response = await api.put(`${base}/emergencies`, {
      contacts: [
        {
          title: '📣 Sofia • Coordinatore',
          actionLabel: 'Chiama il coordinatore',
          phone: '+39 333 1234567',
          whatsapp: true,
        },
        { title: '🚨 112', subtitle: 'Numero Unico', actionLabel: 'Chiama 112', phone: '112' },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(
      response
        .json()
        .emergencies.map((contact: { title: string; phone: string }) => [contact.title, contact.phone]),
    ).toEqual([
      ['📣 Sofia • Coordinatore', '+393331234567'],
      ['🚨 112', '112'],
    ]);
    expect(await prisma.emergencyContact.count()).toBe(2);
  });
});
