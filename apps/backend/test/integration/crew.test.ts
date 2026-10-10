import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import { createTripWithCrew, createUser } from '../helpers/factories.js';

const membersOf = async (tripId: string) =>
  (await prisma.tripMember.findMany({ where: { tripId }, orderBy: { joinedAt: 'asc' } })).map(
    ({ userId, role }) => ({ userId, role }),
  );

describe('invitations', () => {
  it('reserves places for people who have not joined yet, and removes them', async () => {
    const { trip, coordinator } = await createTripWithCrew();
    const { app } = await createTestApp();
    const api = await asUser(app, coordinator);

    const created = await api.post(`/api/trips/${trip.id}/invitations`, {
      invitees: [{ name: 'Aisha B.', email: 'AISHA@example.test' }, { name: 'Tea F.' }],
    });
    expect(created.statusCode).toBe(201);
    const [aisha] = created.json().invitations;
    expect(aisha).toMatchObject({ name: 'Aisha B.', email: 'aisha@example.test' });

    expect((await api.delete(`/api/trips/${trip.id}/invitations/${aisha.id}`)).statusCode).toBe(204);
    expect((await api.delete(`/api/trips/${trip.id}/invitations/${aisha.id}`)).statusCode).toBe(404);

    const detail = (await api.get(`/api/trips/${trip.id}`)).json().trip;
    expect(detail.invitations.map((invitation: { name: string }) => invitation.name)).toEqual(['Tea F.']);
  });

  it("cannot remove another trip's invitation", async () => {
    const mine = await createTripWithCrew();
    const theirs = await createTripWithCrew();
    const invitation = await prisma.tripInvitation.create({
      data: { tripId: theirs.trip.id, name: 'Aisha' },
    });
    const { app } = await createTestApp();

    const response = await (
      await asUser(app, mine.coordinator)
    ).delete(`/api/trips/${mine.trip.id}/invitations/${invitation.id}`);

    expect(response.statusCode).toBe(404);
    expect(await prisma.tripInvitation.count()).toBe(1);
  });
});

describe('members', () => {
  it('promotes a traveller to coordinator', async () => {
    const { trip, coordinator, traveller } = await createTripWithCrew();
    const { app } = await createTestApp();

    const response = await (
      await asUser(app, coordinator)
    ).patch(`/api/trips/${trip.id}/members/${traveller.id}`, {
      role: 'coordinator',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().member).toMatchObject({
      userId: traveller.id,
      role: 'coordinator',
      firstName: 'Luca',
    });
  });

  it('never leaves a trip without a coordinator', async () => {
    const { trip, coordinator } = await createTripWithCrew();
    const { app } = await createTestApp();
    const api = await asUser(app, coordinator);

    for (const response of [
      await api.patch(`/api/trips/${trip.id}/members/${coordinator.id}`, { role: 'traveller' }),
      await api.delete(`/api/trips/${trip.id}/members/${coordinator.id}`),
      await api.post(`/api/trips/${trip.id}/leave`),
    ]) {
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('LAST_COORDINATOR');
    }
    expect(await membersOf(trip.id)).toContainEqual({ userId: coordinator.id, role: 'coordinator' });
  });

  it('lets a coordinator step down once someone else coordinates', async () => {
    const { trip, coordinator, traveller } = await createTripWithCrew();
    const { app } = await createTestApp();
    const api = await asUser(app, coordinator);

    await api.patch(`/api/trips/${trip.id}/members/${traveller.id}`, { role: 'coordinator' });
    const response = await api.post(`/api/trips/${trip.id}/leave`);

    expect(response.statusCode).toBe(204);
    expect(await membersOf(trip.id)).toEqual([{ userId: traveller.id, role: 'coordinator' }]);
  });

  it('lets a traveller leave, and then the trip is gone for them', async () => {
    const { trip, traveller } = await createTripWithCrew();
    const { app } = await createTestApp();
    const api = await asUser(app, traveller);

    expect((await api.post(`/api/trips/${trip.id}/leave`)).statusCode).toBe(204);
    expect((await api.get(`/api/trips/${trip.id}`)).statusCode).toBe(404);
  });

  it('removes a traveller from the trip', async () => {
    const { trip, coordinator, traveller } = await createTripWithCrew();
    const { app } = await createTestApp();

    const response = await (
      await asUser(app, coordinator)
    ).delete(`/api/trips/${trip.id}/members/${traveller.id}`);

    expect(response.statusCode).toBe(204);
    expect(await membersOf(trip.id)).toEqual([{ userId: coordinator.id, role: 'coordinator' }]);
  });

  it('answers 404 for someone who is not in the trip', async () => {
    const { trip, coordinator, outsider } = await createTripWithCrew();
    const { app } = await createTestApp();
    const api = await asUser(app, coordinator);

    expect((await api.delete(`/api/trips/${trip.id}/members/${outsider.id}`)).statusCode).toBe(404);
    expect(
      (await api.patch(`/api/trips/${trip.id}/members/${outsider.id}`, { role: 'traveller' })).statusCode,
    ).toBe(404);
  });
});

describe('invite links', () => {
  it('previews the trip without exposing anything private', async () => {
    const { trip } = await createTripWithCrew({ crewCapacity: 8 });
    const visitor = await createUser();
    const { app } = await createTestApp();

    const response = await (await asUser(app, visitor)).get(`/api/invites/${trip.inviteCode}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      trip: {
        id: trip.id,
        title: trip.title,
        startDate: '2026-09-14',
        endDate: '2026-09-23',
        totalDays: 10,
        crewCount: 2,
        crewCapacity: 8,
        coordinators: [{ firstName: 'Sofia', lastName: 'Marchi' }],
      },
      alreadyMember: false,
    });
  });

  it('answers 404 for an unknown code and 400 for a malformed one', async () => {
    const { app } = await createTestApp();
    const api = await asUser(app, await createUser());

    expect((await api.get('/api/invites/islanda-on-the-road-aaaaaaaaaaaa')).statusCode).toBe(404);
    expect((await api.post('/api/invites/islanda-on-the-road-aaaaaaaaaaaa/accept')).statusCode).toBe(404);
    expect((await api.get('/api/invites/NOT%20A%20CODE')).statusCode).toBe(400);
  });

  it('joins as a traveller, and joining again changes nothing', async () => {
    const { trip } = await createTripWithCrew();
    const newcomer = await createUser();
    const { app } = await createTestApp();
    const api = await asUser(app, newcomer);

    const first = await api.post(`/api/invites/${trip.inviteCode}/accept`);
    const second = await api.post(`/api/invites/${trip.inviteCode}/accept`);

    expect(first.json()).toEqual({ tripId: trip.id, joined: true });
    expect(second.json()).toEqual({ tripId: trip.id, joined: false });
    expect(await membersOf(trip.id)).toContainEqual({ userId: newcomer.id, role: 'traveller' });
    expect((await api.get(`/api/invites/${trip.inviteCode}`)).json().alreadyMember).toBe(true);
    expect((await api.get(`/api/trips/${trip.id}`)).statusCode).toBe(200);
  });

  it('closes the reserved place of the person who joins with the invited email', async () => {
    const { trip } = await createTripWithCrew();
    await prisma.tripInvitation.createMany({
      data: [
        { tripId: trip.id, name: 'Aisha', email: 'aisha@example.test' },
        { tripId: trip.id, name: 'Tea', email: 'tea@example.test' },
      ],
    });
    const aisha = await createUser({ email: 'Aisha@Example.test' });
    const { app } = await createTestApp();
    const api = await asUser(app, { id: aisha.id, email: 'Aisha@Example.test' });

    await api.post(`/api/invites/${trip.inviteCode}/accept`);

    const detail = (await api.get(`/api/trips/${trip.id}`)).json().trip;
    expect(detail.invitations.map((invitation: { name: string }) => invitation.name)).toEqual(['Tea']);
  });

  it('refuses to join a full trip', async () => {
    const { trip } = await createTripWithCrew({ crewCapacity: 2 });
    const latecomer = await createUser();
    const { app } = await createTestApp();

    const response = await (await asUser(app, latecomer)).post(`/api/invites/${trip.inviteCode}/accept`);

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('TRIP_FULL');
    expect(await prisma.tripMember.count({ where: { tripId: trip.id } })).toBe(2);
  });

  it('gives the last place to only one of two people joining at the same time', async () => {
    const { trip } = await createTripWithCrew({ crewCapacity: 3 });
    const [first, second] = [await createUser(), await createUser()];
    const { app } = await createTestApp();
    const [a, b] = [await asUser(app, first), await asUser(app, second)];

    const responses = await Promise.all([
      a.post(`/api/invites/${trip.inviteCode}/accept`),
      b.post(`/api/invites/${trip.inviteCode}/accept`),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    expect(await prisma.tripMember.count({ where: { tripId: trip.id } })).toBe(3);
  });

  it('stops working once the coordinator generates a new link', async () => {
    const { trip, coordinator } = await createTripWithCrew();
    const newcomer = await createUser();
    const { app } = await createTestApp();

    const rotated = await (await asUser(app, coordinator)).post(`/api/trips/${trip.id}/invite-code`);
    const { inviteCode } = rotated.json();

    expect(inviteCode).not.toBe(trip.inviteCode);
    const api = await asUser(app, newcomer);
    expect((await api.post(`/api/invites/${trip.inviteCode}/accept`)).statusCode).toBe(404);
    expect((await api.post(`/api/invites/${inviteCode}/accept`)).statusCode).toBe(200);
  });
});
