import type { Prisma } from '../src/generated/prisma/client.js';
import type { AppPlatform, PerfMetric } from '../src/generated/prisma/enums.js';
import type { PrismaClient } from '../src/lib/prisma.js';

/**
 * Dati dimostrativi: viaggi in corso, futuri e passati, una crew vera, e
 * cinque settimane di uso e di prestazioni per le metriche del pannello.
 *
 * Tutto è deterministico: id fissi, date contate da `now`, numeri "casuali"
 * da un generatore con seme. Due esecuzioni con lo stesso `now` producono gli
 * stessi dati, ed è questo che rende confrontabili gli screenshot degli
 * smoke test. I documenti puntano a file che lo storage finto degli e2e
 * genera al volo: con Supabase vero non si aprono.
 */

const DAY = 86_400_000;

/** Gli account che entrano davvero (il Supabase finto degli e2e ha le stesse password). */
export const DEMO_ACCOUNTS = {
  staff: { id: '7f1c2a90-3d4e-4b5a-9c8d-1e2f3a4b5c6d', email: 'giulia@vibemakers.test' },
  coordinator: { id: '0b8f7c1e-5b7a-4c3e-9a51-3f6d2c1e8a01', email: 'sofia@example.test' },
  traveller: { id: '1a2b3c4d-0000-4000-8000-000000000001', email: 'luca@example.test' },
} as const;

const person = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const demoTripId = (n: number) => `7e000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const docId = (n: number) => `0d000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

interface DemoPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passport?: [number: string, expiry: string];
  isAdmin?: boolean;
  /** Probabilità di usare l'app in un giorno; `null` = non è mai entrato. */
  activity: number | null;
  platform: AppPlatform;
  /** Ha smesso di usare l'app da questo numero di giorni. */
  awayDays?: number;
}

const PEOPLE: DemoPerson[] = [
  {
    ...DEMO_ACCOUNTS.staff,
    firstName: 'Giulia',
    lastName: 'Rossi',
    isAdmin: true,
    activity: null,
    platform: 'web',
  },
  {
    ...DEMO_ACCOUNTS.coordinator,
    firstName: 'Sofia',
    lastName: 'Marchi',
    passport: ['YA9182773', '04/2031'],
    activity: 0.9,
    platform: 'ios',
  },
  {
    ...DEMO_ACCOUNTS.traveller,
    firstName: 'Luca',
    lastName: 'Tosi',
    passport: ['YB4410021', '02/2033'],
    activity: 0.7,
    platform: 'android',
  },
  {
    id: person(4),
    firstName: 'Aisha',
    lastName: 'Bello',
    email: 'aisha.bello@example.test',
    passport: ['YC1182930', '09/2030'],
    activity: 0.8,
    platform: 'ios',
  },
  {
    id: person(5),
    firstName: 'Marco',
    lastName: 'Ferri',
    email: 'marco.ferri@example.test',
    activity: null,
    platform: 'ios',
  },
  {
    id: person(6),
    firstName: 'Elena',
    lastName: 'Galli',
    email: 'elena.galli@example.test',
    passport: ['YD2290144', '11/2029'],
    activity: 0.6,
    platform: 'ios',
  },
  {
    id: person(7),
    firstName: 'Nico',
    lastName: 'Pace',
    email: 'nico.pace@example.test',
    passport: ['YE5512870', '06/2032'],
    activity: 0.5,
    platform: 'android',
  },
  {
    id: person(8),
    firstName: 'Tea',
    lastName: 'Fabbri',
    email: 'tea.fabbri@example.test',
    passport: ['YF9932001', '03/2028'],
    activity: 0.4,
    platform: 'ios',
  },
  {
    id: person(9),
    firstName: 'Davide',
    lastName: 'Conti',
    email: 'davide.conti@example.test',
    activity: 0.5,
    platform: 'android',
    awayDays: 20,
  },
  {
    id: person(10),
    firstName: 'Chiara',
    lastName: 'Riva',
    email: 'chiara.riva@example.test',
    passport: ['YG7741230', '12/2031'],
    activity: 0.85,
    platform: 'ios',
  },
  {
    id: person(11),
    firstName: 'Pietro',
    lastName: 'Sala',
    email: 'pietro.sala@example.test',
    passport: ['YH1203394', '05/2030'],
    activity: 0.6,
    platform: 'android',
  },
  {
    id: person(12),
    firstName: 'Martina',
    lastName: 'Greco',
    email: 'martina.greco@example.test',
    passport: ['YI3348812', '08/2031'],
    activity: 0.5,
    platform: 'ios',
  },
  {
    id: person(13),
    firstName: 'Omar',
    lastName: 'Haddad',
    email: 'omar.haddad@example.test',
    activity: null,
    platform: 'android',
  },
];

const byName = (firstName: string) => PEOPLE.find((p) => p.firstName === firstName)!.id;

/** mulberry32: abbastanza casuale per dei dati finti, e sempre uguale a parità di seme. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoSummary {
  people: number;
  trips: number;
  events: number;
  samples: number;
}

/**
 * Scrive i dati demo in un database vuoto (le tabelle vanno svuotate prima).
 * `now` è l'istante di riferimento: "oggi" è il suo giorno UTC.
 */
export async function seedDemo(prisma: PrismaClient, now: Date): Promise<DemoSummary> {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = (offset: number) => new Date(today + offset * DAY);
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  await prisma.user.createMany({
    data: PEOPLE.map((p, index) => ({
      id: p.id,
      email: p.email,
      firstName: p.firstName,
      lastName: p.lastName,
      username: p.isAdmin ? null : `${p.firstName}${p.lastName[0]}`.toLowerCase(),
      isAdmin: p.isAdmin ?? false,
      passportNumber: p.passport?.[0] ?? null,
      passportExpiry: p.passport?.[1] ?? null,
      createdAt: ago(60 - index * 4),
    })),
  });

  let documents = 0;
  async function document(tripId: string, title: string, name: string) {
    documents += 1;
    const id = docId(documents);
    await prisma.document.create({
      data: {
        id,
        tripId,
        kind: 'pdf',
        title,
        subtitle: name,
        originalName: name,
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        storagePath: `trips/${tripId}/documents/${id}.pdf`,
        attached: true,
      },
    });
    return id;
  }

  let trips = 0;
  async function trip(input: {
    title: string;
    destination: string;
    start: number;
    days: number;
    capacity?: number;
    inviteCode: string;
    crew: Array<[string, 'coordinator' | 'traveller']>;
    invitations?: Array<[string, string?]>;
  }) {
    trips += 1;
    const id = demoTripId(trips);
    await prisma.trip.create({
      data: {
        id,
        title: input.title,
        destination: input.destination,
        startDate: day(input.start),
        endDate: day(input.start + input.days - 1),
        crewCapacity: input.capacity,
        inviteCode: input.inviteCode,
        createdAt: ago(40),
        members: {
          create: input.crew.map(([name, role], index) => ({
            userId: byName(name),
            role,
            joinedAt: ago(30 - index),
          })),
        },
        invitations: {
          create: (input.invitations ?? []).map(([name, email], index) => ({
            name,
            email,
            createdAt: ago(10 - index),
          })),
        },
      },
    });
    return id;
  }

  // In corso: Islanda, giorno 3 di 10. Mancano alcuni alloggi, Marco non ha il passaporto.
  const iceland = await trip({
    title: 'Islanda On The Road 🇮🇸',
    destination: 'Islanda',
    start: -2,
    days: 10,
    capacity: 8,
    inviteCode: 'islanda-on-the-road-k7m2x9p4q3ra',
    crew: [
      ['Sofia', 'coordinator'],
      ['Luca', 'traveller'],
      ['Aisha', 'traveller'],
      ['Marco', 'traveller'],
      ['Elena', 'traveller'],
      ['Nico', 'traveller'],
    ],
  });
  const stays = [
    'Hotel Kría, Vík',
    'Guesthouse Hof, Höfn',
    'Fosshotel Glacier Lagoon',
    'Skaftafell Lodge',
    'Hotel Rangá',
    'Kex Hostel, Reykjavík',
  ];
  for (const [index, name] of stays.entries()) {
    await prisma.stay.create({
      data: {
        tripId: iceland,
        dayIndex: index + 1,
        name,
        address: name.split(', ')[1] ?? 'Islanda',
        documentId:
          index < 4 ? await document(iceland, 'Voucher di prenotazione', `voucher-${index + 1}.pdf`) : null,
      },
    });
  }
  await prisma.activity.createMany({
    data: [
      {
        tripId: iceland,
        dayIndex: 2,
        name: 'Trekking sul ghiacciaio Sólheimajökull',
        place: 'Parcheggio del ghiacciaio',
        position: 0,
      },
      {
        tripId: iceland,
        dayIndex: 3,
        name: 'Spiaggia nera di Reynisfjara',
        place: 'Vík í Mýrdal',
        position: 0,
      },
      { tripId: iceland, dayIndex: 3, name: 'Cena di pesce a Vík', place: 'Suður-Vík', position: 1 },
      {
        tripId: iceland,
        dayIndex: 5,
        name: 'Giro in barca a Jökulsárlón',
        place: 'Laguna glaciale',
        position: 0,
      },
    ],
  });
  await prisma.insurance.create({
    data: {
      tripId: iceland,
      company: 'Europ Assistance',
      policy: 'VM-88213-IS',
      coverage: 'fino al rientro',
      emergencyPhone: '+390258241',
      documentId: await document(iceland, 'Polizza', 'polizza-islanda.pdf'),
    },
  });
  await prisma.transport.create({
    data: {
      tripId: iceland,
      name: 'Van 4x4 Dacia Duster',
      reference: 'Targa AB-123 · ritiro KEF 9:00',
      mode: 'van',
      position: 0,
      docs: {
        create: {
          label: 'Contratto di noleggio',
          position: 0,
          documentId: await document(iceland, 'Contratto di noleggio', 'contratto-van.pdf'),
        },
      },
    },
  });
  await prisma.emergencyContact.createMany({
    data: [
      {
        tripId: iceland,
        title: 'Sofia · coordinatrice',
        subtitle: 'Sempre raggiungibile',
        actionLabel: 'Chiama',
        phone: '+393331234567',
        whatsapp: true,
        position: 0,
      },
      {
        tripId: iceland,
        title: 'Emergenze Islanda',
        subtitle: 'Polizia, ambulanza, soccorso',
        actionLabel: 'Chiama il 112',
        phone: '112',
        position: 1,
      },
    ],
  });
  const authors = ['Luca', 'Aisha', 'Elena'];
  await prisma.memory.createMany({
    data: Array.from({ length: 18 }, (_, index): Prisma.MemoryCreateManyInput => {
      const note = index % 6 === 5;
      return {
        id: `3e000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        tripId: iceland,
        authorId: byName(authors[index % 3]!),
        dayIndex: 1 + (index % 3),
        kind: note ? 'note' : 'photo',
        visibility: 'crew',
        createdAt: ago(index % 3),
        ...(note
          ? { text: 'Che giornata!', mood: 'thought' }
          : {
              storagePath: `trips/${iceland}/memories/${index + 1}.jpg`,
              mimeType: 'image/jpeg',
              sizeBytes: 1024,
              aspectRatio: 1.5,
            }),
      };
    }),
  });

  // In corso e in ordine: Lisbona.
  const lisbon = await trip({
    title: 'Lisbona & Sintra 🇵🇹',
    destination: 'Portogallo',
    start: -1,
    days: 4,
    capacity: 6,
    inviteCode: 'lisbona-sintra-h3n8w2c5v9tb',
    crew: [
      ['Chiara', 'coordinator'],
      ['Pietro', 'traveller'],
      ['Martina', 'traveller'],
      ['Tea', 'traveller'],
    ],
  });
  for (const dayIndex of [1, 2, 3]) {
    await prisma.stay.create({
      data: {
        tripId: lisbon,
        dayIndex,
        name: 'Casa do Príncipe',
        address: 'Praça do Príncipe Real 23, Lisbona',
        documentId: dayIndex === 1 ? await document(lisbon, 'Voucher', 'casa-principe.pdf') : null,
      },
    });
  }
  await prisma.insurance.create({ data: { tripId: lisbon, company: 'Allianz Travel', policy: 'AT-55102' } });
  await prisma.transport.create({
    data: {
      tripId: lisbon,
      name: 'Volo TP 833',
      reference: 'MXP → LIS · 07:10',
      mode: 'flight',
      position: 0,
    },
  });
  await prisma.emergencyContact.create({
    data: {
      tripId: lisbon,
      title: 'Chiara · coordinatrice',
      actionLabel: 'Chiama',
      phone: '+393209988776',
      position: 0,
    },
  });

  // Futuri.
  const japan = await trip({
    title: 'Giappone Discovery 🇯🇵',
    destination: 'Giappone',
    start: 18,
    days: 12,
    capacity: 10,
    inviteCode: 'giappone-discovery-p4t7k2m9x3wd',
    crew: [
      ['Nico', 'coordinator'],
      ['Sofia', 'traveller'],
      ['Davide', 'traveller'],
      ['Omar', 'traveller'],
      ['Tea', 'traveller'],
      ['Elena', 'traveller'],
      ['Pietro', 'traveller'],
    ],
    invitations: [['Hana K.', 'hana@example.test'], ['Riccardo M.']],
  });
  await prisma.transport.create({
    data: {
      tripId: japan,
      name: 'Volo Emirates EK 92',
      reference: 'MXP → DXB → NRT',
      mode: 'flight',
      position: 0,
    },
  });
  await prisma.stay.createMany({
    data: [1, 2, 3, 4].map((dayIndex) => ({
      tripId: japan,
      dayIndex,
      name: 'Shinjuku Granbell',
      address: 'Kabukicho, Tokyo',
    })),
  });

  const lapland = await trip({
    title: 'Lapponia Aurora 🇫🇮',
    destination: 'Finlandia',
    start: 41,
    days: 5,
    capacity: 4,
    inviteCode: 'lapponia-aurora-r8c3m6t2y5qn',
    crew: [
      ['Elena', 'coordinator'],
      ['Chiara', 'traveller'],
      ['Martina', 'traveller'],
      ['Aisha', 'traveller'],
    ],
  });
  await prisma.stay.createMany({
    data: [1, 2, 3, 4].map((dayIndex) => ({
      tripId: lapland,
      dayIndex,
      name: 'Aurora Igloo Village',
      address: 'Saariselkä',
    })),
  });
  await prisma.insurance.create({
    data: { tripId: lapland, company: 'Europ Assistance', policy: 'VM-99120-FI' },
  });
  await prisma.transport.create({
    data: {
      tripId: lapland,
      name: 'Volo Finnair AY 1752',
      reference: 'MXP → HEL → IVL',
      mode: 'flight',
      position: 0,
    },
  });
  await prisma.emergencyContact.create({
    data: {
      tripId: lapland,
      title: 'Elena · coordinatrice',
      actionLabel: 'Chiama',
      phone: '+393471112233',
      position: 0,
    },
  });

  await trip({
    title: 'Perù & Machu Picchu 🇵🇪',
    destination: 'Perù',
    start: 55,
    days: 11,
    capacity: 12,
    inviteCode: 'peru-machu-picchu-w2k9d4n7s3jf',
    crew: [
      ['Sofia', 'coordinator'],
      ['Marco', 'traveller'],
      ['Omar', 'traveller'],
    ],
    invitations: [['Giorgia L.', 'giorgia@example.test']],
  });

  // Passati.
  await trip({
    title: 'Marocco Express 🇲🇦',
    destination: 'Marocco',
    start: -70,
    days: 7,
    capacity: 8,
    inviteCode: 'marocco-express-c6v2b8n4m7xz',
    crew: [
      ['Luca', 'coordinator'],
      ['Aisha', 'traveller'],
      ['Davide', 'traveller'],
      ['Pietro', 'traveller'],
    ],
  });
  await trip({
    title: 'Grecia Cicladi 🇬🇷',
    destination: 'Grecia',
    start: -101,
    days: 9,
    inviteCode: 'grecia-cicladi-t5y8u2i6o3pa',
    crew: [
      ['Chiara', 'coordinator'],
      ['Nico', 'traveller'],
      ['Tea', 'traveller'],
    ],
  });

  const { events, samples } = await seedTelemetry(prisma, now, today, {
    live: new Map([
      [iceland, { from: day(-2), to: day(7) }],
      [lisbon, { from: day(-1), to: day(2) }],
    ]),
    tripsOf: (userId) =>
      [
        [iceland, ['Sofia', 'Luca', 'Aisha', 'Marco', 'Elena', 'Nico']],
        [lisbon, ['Chiara', 'Pietro', 'Martina', 'Tea']],
        [japan, ['Nico', 'Sofia', 'Davide', 'Omar', 'Tea', 'Elena', 'Pietro']],
        [lapland, ['Elena', 'Chiara', 'Martina', 'Aisha']],
      ]
        .filter(([, crew]) => (crew as string[]).some((name) => byName(name) === userId))
        .map(([tripId]) => tripId as string),
  });

  return { people: PEOPLE.length, trips, events, samples };
}

/* ── Cinque settimane di uso e prestazioni ─────────────────────────────── */

const APP_CALLS: Array<[target: string, median: number]> = [
  ['GET /api/trips', 170],
  ['GET /api/trips/{tripId}', 290],
  ['GET /api/me', 110],
  ['GET /api/trips/{tripId}/memories', 420],
  ['POST /api/trips/{tripId}/memories', 950],
  ['GET /api/trips/{tripId}/documents/{documentId}/url', 210],
];

const PANEL_PAGES: Array<[page: string, call: string, median: number]> = [
  ['/', 'GET /api/admin/overview', 140],
  ['/viaggi', 'GET /api/admin/trips', 160],
  ['/viaggi/:id', 'GET /api/admin/trips/{tripId}', 230],
  ['/persone', 'GET /api/admin/users', 150],
  ['/uso', 'GET /api/admin/usage', 380],
  ['/prestazioni', 'GET /api/admin/performance', 420],
];

async function seedTelemetry(
  prisma: PrismaClient,
  now: Date,
  today: number,
  trips: {
    live: Map<string, { from: Date; to: Date }>;
    tripsOf: (userId: string) => string[];
  },
) {
  const next = random(20270914);
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  /** Durate "lunghe a destra", come quelle vere: la mediana più una coda. */
  const duration = (median: number, spread = 0.45) => Math.round(median * Math.exp(spread * normal()));
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!;

  const events: Prisma.AppEventCreateManyInput[] = [];
  const samples: Prisma.PerfSampleCreateManyInput[] = [];

  for (let daysAgo = 34; daysAgo >= 0; daysAgo -= 1) {
    const dayStart = today - daysAgo * DAY;
    // Una versione più lenta fino a 12 giorni fa: nei grafici si vede il miglioramento.
    const slower = daysAgo > 12 ? 1.35 : 1;

    for (const p of PEOPLE) {
      if (p.activity === null || p.isAdmin) continue;
      if (p.awayDays !== undefined && daysAgo < p.awayDays) continue;
      if (next() > p.activity) continue;

      const userTrips = trips.tripsOf(p.id);
      const opens = 1 + Math.floor(next() * 3);
      for (let open = 0; open < opens; open += 1) {
        const at = new Date(dayStart + (7 + next() * 15) * 3_600_000);
        if (at > now) continue;
        const instant = (minutes: number) => new Date(at.getTime() + minutes * 60_000);
        const base = { userId: p.id, platform: p.platform, appVersion: daysAgo > 12 ? '1.3.0' : '1.4.0' };
        const sample = { source: 'app' as const, platform: p.platform, appVersion: base.appVersion };
        const deviceFactor = p.platform === 'android' ? 1.5 : 1;

        events.push({ ...base, name: 'app_open', occurredAt: at });
        samples.push({
          ...sample,
          metric: 'app_start',
          target: 'MyTrips',
          value: duration(1300 * deviceFactor * slower),
          occurredAt: at,
        });
        events.push({ ...base, name: 'screen_view', screen: 'MyTrips', occurredAt: instant(0.1) });
        samples.push({
          ...sample,
          metric: 'screen_ready',
          target: 'MyTrips',
          value: duration(600 * slower),
          occurredAt: instant(0.1),
        });

        const tripId = userTrips.length ? pick(userTrips) : undefined;
        if (tripId) {
          events.push({ ...base, name: 'screen_view', screen: 'TripDetail', tripId, occurredAt: instant(1) });
          samples.push({
            ...sample,
            metric: 'screen_ready',
            target: 'TripDetail',
            value: duration(1100 * slower, 0.55),
            occurredAt: instant(1),
          });
          const live = trips.live.get(tripId);
          const travelling = live && dayStart >= live.from.getTime() && dayStart <= live.to.getTime();
          const docs = travelling ? 1 + Math.floor(next() * 3) : next() < 0.3 ? 1 : 0;
          for (let doc = 0; doc < docs; doc += 1)
            events.push({ ...base, name: 'document_open', tripId, occurredAt: instant(2 + doc) });
        }
        if (next() < 0.25)
          events.push({ ...base, name: 'screen_view', screen: 'Profile', occurredAt: instant(4) });

        for (let call = 0; call < 3; call += 1) {
          const [target, median] = pick(APP_CALLS);
          samples.push({
            ...sample,
            metric: 'api_latency',
            target,
            value: duration(median * slower),
            occurredAt: instant(0.2 + call),
          });
        }
        samples.push({
          ...sample,
          metric: 'slow_frames',
          target: tripId ? 'TripDetail' : 'MyTrips',
          value: Math.min(
            100,
            Math.round((p.platform === 'android' ? 9 : 3) * slower * Math.exp(0.5 * normal()) * 10) / 10,
          ),
          occurredAt: instant(3),
        });
        samples.push({
          ...sample,
          metric: 'frozen_frames',
          target: tripId ? 'TripDetail' : 'MyTrips',
          value: next() < 0.06 * slower ? 1 : 0,
          occurredAt: instant(3),
        });
      }
    }

    // Lo staff nel pannello: qualche pagina al giorno.
    const visits = 3 + Math.floor(next() * 6);
    for (let visit = 0; visit < visits; visit += 1) {
      const at = new Date(dayStart + (8 + next() * 10) * 3_600_000);
      if (at > now) continue;
      const [page, call, median] = pick(PANEL_PAGES);
      const sample = { source: 'panel' as const, platform: 'web' as const };
      const metric = (name: PerfMetric, value: number) =>
        samples.push({ ...sample, metric: name, target: page, value, occurredAt: at });
      metric('ttfb', duration(180, 0.3));
      metric('lcp', duration(1500, 0.35));
      metric('inp', duration(110, 0.6));
      metric('cls', Math.round(Math.abs(0.03 * Math.exp(0.7 * normal())) * 1000) / 1000);
      samples.push({
        ...sample,
        metric: 'api_latency',
        target: call,
        value: duration(median),
        occurredAt: at,
      });
    }
  }

  await prisma.appEvent.createMany({ data: events });
  await prisma.perfSample.createMany({ data: samples });
  return { events: events.length, samples: samples.length };
}

/**
 * Il seed svuota il database: parte solo su uno di prova, con `demo` o `e2e`
 * nel nome. Restituisce il nome, o lancia un errore che spiega perché no.
 */
export function demoDatabaseName(databaseUrl: string): string {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (!/demo|e2e/i.test(name))
    throw new Error(
      `Il seed demo svuota il database: "${name || '(nessun nome)'}" non sembra uno di prova. ` +
        'Usa un database con "demo" o "e2e" nel nome.',
    );
  return name;
}

/** Le tabelle dei dati (non quella delle migrazioni), da svuotare prima del seed. */
export async function clearDemoData(prisma: PrismaClient) {
  const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map(({ tablename }) => `"${tablename}"`).join(', ')} CASCADE`,
  );
}
