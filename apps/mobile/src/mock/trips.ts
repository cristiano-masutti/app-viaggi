import { blurhash } from '@/theme/palette';
import type { CrewMember, DocumentRef, EmergencyContact, Memory, Trip, TripDay } from '@/types';
import { buildEmptyDays, shortDate, toISO } from '@/lib/date';

/**
 * Stato mock completo.
 *
 * Le date sono relative a oggi, così il prototipo è sempre "vivo": il viaggio in
 * corso è davvero al Giorno 3, i futuri hanno un countdown reale e i passati
 * sono conclusi. I viaggi sono volutamente diversi tra loro per coprire tutti
 * gli stati della UI: pieno, mezzo vuoto e appena creato (solo placeholder).
 */

const DAY = 86_400_000;
const isoFromToday = (offsetDays: number) => toISO(new Date(Date.now() + offsetDays * DAY));

const pdf = (id: string, title: string, subtitle: string, code: string): DocumentRef => ({
  id,
  kind: 'pdf',
  title,
  subtitle,
  code,
  uri: `https://files.vibemakers.travel/${id}.pdf`,
});

const qr = (id: string, title: string, subtitle: string, code: string): DocumentRef => ({
  id,
  kind: 'qr',
  title,
  subtitle,
  code,
  uri: `https://files.vibemakers.travel/${id}.png`,
});

/* ── Crew ────────────────────────────────────────────────────────────── */

const member = (
  id: string,
  name: string,
  handle: string,
  avatarSeed: number,
  extra: Partial<CrewMember> = {},
): CrewMember => ({
  id,
  name,
  handle,
  avatar: `https://i.pravatar.cc/200?img=${avatarSeed}`,
  role: 'traveller',
  confirmed: true,
  ...extra,
});

export const ME = member('u-marco', 'Marco R.', '@marcorossi', 68);

const SOFIA = member('u-sofia', 'Sofia M.', '@sofiam', 45, { role: 'coordinator' });
const LUCA = member('u-luca', 'Luca T.', '@lucatrek', 33);
const NICO = member('u-nico', 'Nico P.', '@nicop', 52);
const AISHA = member('u-aisha', 'Aisha B.', 'aisha.b@gmail.com', 47);
const TEA = member('u-tea', 'Tea F.', '@teaf', 31);
const ELENA = member('u-elena', 'Elena V.', '@elenav', 26);
const ROCCO = member('u-rocco', 'Rocco D.', '@roccod', 12);
const MARTA = member('u-marta', 'Marta L.', '@martal', 41, { role: 'coordinator' });
const DIEGO = member('u-diego', 'Diego S.', '@diegos', 15, { role: 'coordinator' });
const CHIARA = member('u-chiara', 'Chiara N.', '@chiaran', 32);
const DARIO = member('u-dario', 'Dario B.', '@dariob', 56);

/* ── Emergenze ───────────────────────────────────────────────────────── */

/**
 * Card SOS, una per riga e a tutta larghezza: in emergenza non si cerca un
 * bottone piccolo. Il coordinatore è sempre il primo contatto.
 */
const emergencies = (
  coordinator: CrewMember,
  coordinatorPhone: string,
  policy: string,
): EmergencyContact[] => [
  {
    id: 'sos-coordinator',
    title: `📣 ${coordinator.name} • Coordinatore`,
    subtitle: 'Primo contatto del gruppo, sempre raggiungibile',
    actionLabel: 'Chiama il coordinatore',
    phone: coordinatorPhone,
    whatsapp: true,
  },
  {
    id: 'sos-112',
    title: '🚨 112 • Numero Unico Emergenze',
    subtitle: 'Polizia, ambulanza, vigili del fuoco e soccorso stradale',
    actionLabel: 'Chiama 112',
    phone: '112',
  },
  {
    id: 'sos-insurance',
    title: '🏥 Centrale Assicurativa h24',
    subtitle: `Europ Assistance • Polizza ${policy}`,
    actionLabel: 'Chiama la centrale',
    phone: '+390258286666',
  },
  {
    id: 'sos-consulate',
    title: '🇮🇹 Reperibilità Consolare',
    subtitle: "Assistenza d'urgenza ai cittadini italiani all'estero",
    actionLabel: 'Chiama il consolato',
    phone: '+4723086800',
  },
];

/* ── Giorni ──────────────────────────────────────────────────────────── */

/** Scheletro di N giorni a partire da una data: tutti vuoti, da riempire. */
const emptyDays = (startISO: string, total: number): TripDay[] => buildEmptyDays(startISO, total);

/* ── 1 · ISLANDA — viaggio in corso, Giorno 3 di 10 ──────────────────── */

const ISLANDA_START = isoFromToday(-2);
const ISLANDA_END = isoFromToday(7);

const islandaDays: TripDay[] = emptyDays(ISLANDA_START, 10).map((day) => {
  switch (day.id) {
    case 'G1':
      return {
        ...day,
        stay: {
          name: 'Reykjavík Konsúlat',
          address: 'Hafnarstræti 17–19, 101 Reykjavík',
          doc: pdf(
            'isl-stay-1',
            'Prenotazione Reykjavík Konsúlat',
            'Voucher alloggio · 8 pax',
            'VOUCHER VM-4471',
          ),
        },
        activities: [
          {
            id: 'isl-a1',
            name: 'Torre di Hallgrímskirkja',
            place: 'Skólavörðuholt, 101 Reykjavík',
            doc: pdf('isl-tk-1', 'Biglietto torre Hallgrímskirkja', 'Ingresso gruppo', 'TICKET HK-8821'),
          },
          {
            id: 'isl-a2',
            name: 'Cena di benvenuto della crew',
            place: 'Messinn, Lækjargata 6b',
            doc: pdf('isl-tk-2', 'Prenotazione tavolo Messinn', 'Cena · 8 coperti', 'RES-MSS-2031'),
          },
        ],
      };
    case 'G2':
      return {
        ...day,
        stay: {
          name: 'Hotel Kría, Vík',
          address: 'Suðurvíkurvegur 5, 870 Vík í Mýrdal',
          doc: pdf('isl-stay-2', 'Prenotazione Hotel Kría', 'Voucher alloggio · 2 notti', 'VOUCHER VM-4472'),
        },
        activities: [
          {
            id: 'isl-a3',
            name: 'Area geotermica di Geysir',
            place: 'Geysir Center, Haukadalur',
            doc: pdf('isl-tk-3', 'Ingresso gruppo Geysir', 'Biglietto cumulativo 8 pax', 'GC-2291'),
          },
        ],
      };
    case 'G3':
      return {
        ...day,
        stay: {
          name: 'Hotel Kría, Vík',
          address: 'Suðurvíkurvegur 5, 870 Vík í Mýrdal',
          doc: pdf('isl-stay-2', 'Prenotazione Hotel Kría', 'Voucher alloggio · 2 notti', 'VOUCHER VM-4472'),
        },
        activities: [
          {
            id: 'isl-a4',
            name: 'Trekking sul ghiacciaio Skaftafell',
            place: 'Centro Visitatori Skaftafell',
            doc: qr('isl-tk-4', 'Voucher trekking Skaftafell', 'Guida inclusa · 3 ore', 'GLACIER-7741'),
          },
          {
            id: 'isl-a5',
            name: 'Spiaggia nera di Reynisfjara',
            place: 'Reynisfjara, Vík í Mýrdal',
            doc: null,
          },
        ],
      };
    case 'G4':
      return {
        ...day,
        stay: {
          name: 'Fosshotel Glacier Lagoon',
          address: 'Hnappavellir, 785 Öræfi',
          doc: pdf('isl-stay-3', 'Prenotazione Fosshotel', 'Voucher alloggio', 'VOUCHER VM-4473'),
        },
        activities: [
          {
            id: 'isl-a6',
            name: 'Laguna glaciale Jökulsárlón in zodiac',
            place: 'Molo di imbarco Jökulsárlón',
            doc: qr('isl-tk-5', 'Biglietto zodiac Jökulsárlón', 'Tuta termica inclusa', 'JK-118'),
          },
        ],
      };
    case 'G5':
      return {
        ...day,
        stay: {
          name: 'Hotel Vestmannaeyjar',
          address: 'Vestmannabraut 28, 900 Vestmannaeyjar',
          doc: pdf('isl-stay-4', 'Prenotazione Hotel Vestmannaeyjar', 'Voucher alloggio', 'VOUCHER VM-4474'),
        },
        activities: [],
      };
    // G6…G10 restano vuoti di proposito: mostrano i placeholder tratteggiati
    // della tab Organizza anche dentro un viaggio già partito.
    default:
      return day;
  }
});

const islandaMemories: Memory[] = [
  {
    id: 'isl-m1',
    kind: 'photo',
    dayId: 'G3',
    authorId: SOFIA.id,
    time: '10:12',
    visibility: 'crew',
    uri: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=900&q=80',
    blurhash: blurhash.cold,
    caption: 'Il ghiacciaio si sentiva scricchiolare sotto i ramponi.',
    aspectRatio: 0.75,
    reactions: { '🔥': 4, '🤯': 2 },
    myReaction: '🔥',
  },
  {
    id: 'isl-m2',
    kind: 'video',
    dayId: 'G3',
    authorId: ME.id,
    time: '18:42',
    visibility: 'crew',
    uri: 'https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=900&q=80',
    blurhash: blurhash.cold,
    caption: 'Onde nere a Reynisfjara',
    aspectRatio: 1,
    durationLabel: '0:14',
    reactions: { '❤️': 3 },
    myReaction: null,
  },
  {
    id: 'isl-m3',
    kind: 'photo',
    dayId: 'G3',
    authorId: LUCA.id,
    time: '14:05',
    visibility: 'crew',
    uri: 'https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=900&q=80',
    blurhash: blurhash.cold,
    aspectRatio: 1.33,
    reactions: { '😂': 5 },
    myReaction: null,
  },
  {
    id: 'isl-m4',
    kind: 'photo',
    dayId: 'G2',
    authorId: ME.id,
    time: '09:31',
    visibility: 'private',
    uri: 'https://images.unsplash.com/photo-1490650034439-fd184c3c86a5?w=900&q=80',
    blurhash: blurhash.cold,
    caption: 'Solo per me: la prima alba islandese.',
    aspectRatio: 0.75,
    reactions: {},
    myReaction: null,
  },
  {
    id: 'isl-m5',
    kind: 'photo',
    dayId: 'G2',
    authorId: NICO.id,
    time: '17:58',
    visibility: 'crew',
    uri: 'https://images.unsplash.com/photo-1520769945061-0a448c463865?w=900&q=80',
    blurhash: blurhash.cold,
    aspectRatio: 1,
    reactions: { '🔥': 2, '❤️': 1 },
    myReaction: null,
  },
  {
    id: 'isl-m6',
    kind: 'photo',
    dayId: 'G1',
    authorId: SOFIA.id,
    time: '19:04',
    visibility: 'crew',
    uri: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&q=80',
    blurhash: blurhash.cold,
    aspectRatio: 0.75,
    reactions: { '❤️': 6 },
    myReaction: '❤️',
  },
  {
    id: 'isl-m7',
    kind: 'video',
    dayId: 'G1',
    authorId: NICO.id,
    time: '12:20',
    visibility: 'crew',
    uri: 'https://images.unsplash.com/photo-1529963183134-61a90db47eaf?w=900&q=80',
    blurhash: blurhash.cold,
    aspectRatio: 1.33,
    durationLabel: '0:32',
    reactions: { '😂': 2 },
    myReaction: null,
  },
  {
    id: 'isl-m8',
    kind: 'photo',
    dayId: 'G4',
    authorId: LUCA.id,
    time: '08:50',
    visibility: 'crew',
    uri: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=900&q=80',
    blurhash: blurhash.cold,
    aspectRatio: 1,
    reactions: {},
    myReaction: null,
  },
  {
    id: 'isl-n1',
    kind: 'note',
    dayId: 'G3',
    authorId: SOFIA.id,
    time: '16:42',
    visibility: 'crew',
    mood: '😂 Aneddoto',
    text: 'Foca avvistata tra i ghiacci: Sofia ha urlato così forte che il van ha frenato di colpo. Nessuna vittima, solo caffè rovesciato. 🦭',
  },
  {
    id: 'isl-n2',
    kind: 'note',
    dayId: 'G3',
    authorId: LUCA.id,
    time: '13:05',
    visibility: 'crew',
    mood: '📍 Posto',
    text: 'Dietro la cascata parte un sentiero laterale che non prende nessuno. Luce migliore verso le 19, scarpe impermeabili obbligatorie.',
  },
  {
    id: 'isl-n3',
    kind: 'note',
    dayId: 'G3',
    authorId: ME.id,
    time: '15:20',
    visibility: 'private',
    mood: '🔒 Personale',
    text: 'Prima volta che vedo il mare nero. Da rifare, ma con più calzini asciutti.',
  },
  {
    id: 'isl-n4',
    kind: 'note',
    dayId: 'G2',
    authorId: ME.id,
    time: '20:10',
    visibility: 'crew',
    mood: '😂 Aneddoto',
    text: 'Zuppa di pesce per cena: Nico ha chiesto il ketchup. Il cuoco islandese non ha risposto, ha solo guardato l’oceano.',
  },
  {
    id: 'isl-n5',
    kind: 'note',
    dayId: 'G1',
    authorId: NICO.id,
    time: '11:30',
    visibility: 'crew',
    mood: '💭 Pensiero',
    text: 'Qui il silenzio ha un suono diverso. Tornato a casa me lo dimenticherò in tre giorni, quindi lo scrivo adesso.',
  },
];

const ISLANDA: Trip = {
  id: 'trip-islanda',
  status: 'ongoing',
  title: 'Islanda On The Road 🇮🇸',
  cover: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=1400&q=80',
  coverBlurhash: blurhash.cold,
  startDate: ISLANDA_START,
  endDate: ISLANDA_END,
  totalDays: 10,
  currentDay: 3,
  coordinator: SOFIA,
  crew: [ME, SOFIA, LUCA, NICO, AISHA, TEA, ELENA, ROCCO],
  crewCapacity: 10,
  inviteCode: 'islanda-vm4471',
  days: islandaDays,
  documents: {
    passport: {
      number: 'YA9182773',
      expiry: '04/2029',
      doc: pdf('isl-pass', 'Passaporto', 'Pagina dati · scansione', 'DOC YA9182773'),
    },
    customs: {
      code: 'KEF-4472-IS',
      note: 'Islanda · arrivo aeroporto KEF',
      doc: qr('isl-customs', "Modulo d'ingresso doganale", 'Da esibire all’arrivo', 'KEF-4472-IS'),
    },
    transports: [
      {
        id: 'isl-t1',
        name: 'Van 4x4 noleggiato',
        reference: 'Ritiro KEF · targa IS-772 · tutto il viaggio',
        mode: 'van',
        docs: [
          {
            id: 'isl-t1-d1',
            label: 'Contratto di noleggio',
            doc: pdf('isl-rent', 'Contratto noleggio van', 'Blue Car Rental · KEF', 'RENT-IS-772'),
          },
          {
            id: 'isl-t1-d2',
            label: 'Polizza kasko del mezzo',
            doc: pdf('isl-kasko', 'Polizza mezzo', 'Kasko + ghiaia e cenere', 'KASKO-9931'),
          },
        ],
      },
      {
        id: 'isl-t2',
        name: 'Traghetto Vestmannaeyjar',
        reference: 'Landeyjahöfn · G5 ore 09:15',
        mode: 'ferry',
        docs: [
          {
            id: 'isl-t2-d1',
            label: 'Biglietti gruppo (8 pax)',
            doc: qr('isl-ferry', 'Biglietti traghetto', 'Eimskip · 8 passeggeri', 'FERRY-EIM-4410'),
          },
        ],
      },
    ],
    insurance: {
      company: 'Europ Assistance',
      coverage: `Copertura fino al ${shortDate(ISLANDA_END)}`,
      policy: 'VM-88213-IS',
      emergencyPhone: '+390258286666',
      doc: pdf('isl-ins', 'Certificato assicurazione', 'Europ Assistance', 'POLIZZA VM-88213-IS'),
    },
  },
  emergencies: emergencies(SOFIA, '+393351122334', 'VM-88213-IS'),
  memories: islandaMemories,
};

/* ── 2 · GIAPPONE — futuro con documenti parziali ────────────────────── */

const GIAPPONE_START = isoFromToday(18);

const giapponeDays = emptyDays(GIAPPONE_START, 13).map((day) =>
  day.id === 'G1'
    ? {
        ...day,
        stay: {
          name: 'Hotel Gracery Shinjuku',
          address: '1-19-1 Kabukicho, Shinjuku, Tokyo',
          doc: pdf(
            'jpn-stay-1',
            'Prenotazione Hotel Gracery',
            'Voucher alloggio · 3 notti',
            'VOUCHER VM-5510',
          ),
        },
      }
    : day,
);

const GIAPPONE: Trip = {
  id: 'trip-giappone',
  status: 'upcoming',
  title: 'Giappone Discovery 🇯🇵',
  cover: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1400&q=80',
  coverBlurhash: blurhash.warm,
  startDate: GIAPPONE_START,
  endDate: isoFromToday(30),
  totalDays: 13,
  coordinator: SOFIA,
  crew: [ME, SOFIA, LUCA, AISHA, TEA, ELENA, NICO, ROCCO],
  crewCapacity: 10,
  inviteCode: 'giappone-vm5510',
  days: giapponeDays,
  documents: {
    passport: {
      number: 'YA9182773',
      expiry: '04/2029',
      doc: pdf('jpn-pass', 'Passaporto', 'Pagina dati · scansione', 'DOC YA9182773'),
    },
    customs: null,
    transports: [
      {
        id: 'jpn-t1',
        name: 'Volo di gruppo FCO → HND',
        reference: 'ITA Airways AZ792 · bagaglio in stiva incluso',
        mode: 'flight',
        docs: [
          {
            id: 'jpn-t1-d1',
            label: 'Carte d’imbarco del gruppo',
            doc: qr('jpn-boarding', 'Carte d’imbarco', 'AZ792 · 8 passeggeri', 'PNR JX8K2M'),
          },
        ],
      },
    ],
    insurance: null,
  },
  emergencies: emergencies(SOFIA, '+393351122334', 'da attivare'),
  memories: [],
};

/* ── 3 · PERÙ — futuro appena creato, tutto da compilare ─────────────── */

const PERU_START = isoFromToday(64);

const PERU: Trip = {
  id: 'trip-peru',
  status: 'upcoming',
  title: 'Perù & Machu Picchu 🇵🇪',
  cover: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1400&q=80',
  coverBlurhash: blurhash.warm,
  startDate: PERU_START,
  endDate: isoFromToday(75),
  totalDays: 12,
  coordinator: MARTA,
  crew: [ME, MARTA, ELENA, ROCCO, TEA, DARIO],
  crewCapacity: 10,
  inviteCode: 'peru-vm6602',
  days: emptyDays(PERU_START, 12),
  // Viaggio appena pianificato: nessun documento caricato, la tab Organizza
  // è interamente fatta di placeholder tratteggiati.
  documents: { passport: null, customs: null, transports: [], insurance: null },
  emergencies: emergencies(MARTA, '+393356677889', 'da attivare'),
  memories: [],
};

/* ── 4 · MAROCCO — concluso, pieno di ricordi ────────────────────────── */

const MAROCCO_START = isoFromToday(-130);

const maroccoDays = emptyDays(MAROCCO_START, 10).map((day) =>
  day.id === 'G1'
    ? {
        ...day,
        stay: {
          name: 'Riad Dar Anika',
          address: 'Derb Jdid 12, Medina, Marrakech',
          doc: pdf('mar-stay-1', 'Prenotazione Riad Dar Anika', 'Voucher alloggio', 'VOUCHER VM-3301'),
        },
        activities: [
          {
            id: 'mar-a1',
            name: 'Notte nel campo tendato di Merzouga',
            place: 'Erg Chebbi, Sahara',
            doc: pdf('mar-tk-1', 'Voucher campo tendato', 'Cena e colazione incluse', 'DESERT-2210'),
          },
        ],
      }
    : day,
);

const MAROCCO: Trip = {
  id: 'trip-marocco',
  status: 'past',
  title: 'Marocco Express 🇲🇦',
  cover: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=1400&q=80',
  coverBlurhash: blurhash.warm,
  startDate: MAROCCO_START,
  endDate: isoFromToday(-121),
  totalDays: 10,
  coordinator: SOFIA,
  crew: [ME, SOFIA, CHIARA, DARIO, NICO, TEA, AISHA, LUCA],
  inviteCode: 'marocco-vm3301',
  days: maroccoDays,
  documents: {
    passport: {
      number: 'YA9182773',
      expiry: '04/2029',
      doc: pdf('mar-pass', 'Passaporto', 'Pagina dati · scansione', 'DOC YA9182773'),
    },
    customs: null,
    transports: [],
    insurance: {
      company: 'Europ Assistance',
      coverage: 'Copertura conclusa',
      policy: 'VM-77120-MA',
      emergencyPhone: '+390258286666',
      doc: pdf('mar-ins', 'Certificato assicurazione', 'Europ Assistance', 'POLIZZA VM-77120-MA'),
    },
  },
  emergencies: emergencies(SOFIA, '+393351122334', 'VM-77120-MA'),
  memories: [
    {
      id: 'mar-m1',
      kind: 'photo',
      dayId: 'G1',
      authorId: CHIARA.id,
      time: '18:20',
      visibility: 'crew',
      uri: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=900&q=80',
      blurhash: blurhash.warm,
      caption: 'Tramonto sulle dune, ultimo tè alla menta.',
      aspectRatio: 1.33,
      reactions: { '🔥': 7, '❤️': 4 },
      myReaction: '❤️',
    },
    {
      id: 'mar-m2',
      kind: 'photo',
      dayId: 'G1',
      authorId: ME.id,
      time: '11:02',
      visibility: 'crew',
      uri: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=900&q=80',
      blurhash: blurhash.warm,
      aspectRatio: 0.75,
      reactions: { '🤯': 3 },
      myReaction: null,
    },
    {
      id: 'mar-n1',
      kind: 'note',
      dayId: 'G1',
      authorId: DARIO.id,
      time: '22:15',
      visibility: 'crew',
      mood: '💭 Pensiero',
      text: 'Nel deserto non c’è campo e per una sera nessuno ha guardato il telefono. Forse è questo il punto.',
    },
  ],
};

/* ── 5 · PORTOGALLO — concluso, archivio leggero ─────────────────────── */

const PORTOGALLO_START = isoFromToday(-480);

const PORTOGALLO: Trip = {
  id: 'trip-portogallo',
  status: 'past',
  title: 'Portogallo Surf 🇵🇹',
  cover: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1400&q=80',
  coverBlurhash: blurhash.warm,
  startDate: PORTOGALLO_START,
  endDate: isoFromToday(-474),
  totalDays: 7,
  coordinator: DIEGO,
  crew: [ME, DIEGO, TEA, ROCCO, ELENA, CHIARA],
  inviteCode: 'portogallo-vm2204',
  days: emptyDays(PORTOGALLO_START, 7),
  documents: { passport: null, customs: null, transports: [], insurance: null },
  emergencies: emergencies(DIEGO, '+393338899001', 'VM-22041-PT'),
  memories: [
    {
      id: 'prt-m1',
      kind: 'photo',
      dayId: 'G2',
      authorId: ME.id,
      time: '07:45',
      visibility: 'crew',
      uri: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=900&q=80',
      blurhash: blurhash.warm,
      caption: 'Prima onda presa in piedi. Una.',
      aspectRatio: 1,
      reactions: { '😂': 4 },
      myReaction: null,
    },
  ],
};

export const MOCK_TRIPS: Trip[] = [ISLANDA, GIAPPONE, PERU, MAROCCO, PORTOGALLO];

/** Rubrica di tutti i compagni conosciuti: serve ai filtri e agli avatar. */
export const MOCK_DIRECTORY: CrewMember[] = [
  ME,
  SOFIA,
  LUCA,
  NICO,
  AISHA,
  TEA,
  ELENA,
  ROCCO,
  MARTA,
  DIEGO,
  CHIARA,
  DARIO,
];
