import type { EditField, EditValues } from '@/components/sheets/EditSheet';
import { createId } from '@/lib/id';
import type { DayId, DocumentRef, Trip } from '@/types';

/**
 * Che cosa si sta modificando.
 *
 * Ogni blocco della tab Organizza apre la *stessa* modale: quello che cambia è
 * solo il bersaglio. Tenerlo in un tipo unico impedisce che nasca una modale
 * dedicata per ogni sezione.
 */
export type EditTarget =
  | { kind: 'stay'; dayId: DayId }
  | { kind: 'activity'; dayId: DayId; activityId?: string }
  | { kind: 'passport' }
  | { kind: 'customs' }
  | { kind: 'transport'; transportId?: string }
  | { kind: 'insurance' };

export interface EditConfig {
  title: string;
  subtitle?: string;
  fields: EditField[];
  initialValues: EditValues;
  attachment?: { label: string; doc: DocumentRef | null };
  saveLabel?: string;
  /** Presente solo quando l'elemento esiste già e può essere rimosso. */
  deleteLabel?: string;
}

const dayNumber = (trip: Trip, dayId: DayId) =>
  trip.days.find((day) => day.id === dayId)?.index ?? (Number(dayId.replace('G', '')) || 1);

/** Dal bersaglio alla modale: titolo, campi e valori correnti da precompilare. */
export function buildEditConfig(trip: Trip, target: EditTarget): EditConfig {
  switch (target.kind) {
    case 'stay': {
      const stay = trip.days.find((day) => day.id === target.dayId)?.stay ?? null;
      return {
        title: stay ? 'Modifica alloggio' : 'Aggiungi alloggio',
        subtitle: `Giorno ${dayNumber(trip, target.dayId)} · nome, indirizzo e voucher`,
        fields: [
          {
            key: 'name',
            label: 'Nome struttura',
            placeholder: 'es. Hotel Kría, Vík',
            required: true,
            maxLength: 60,
          },
          {
            key: 'address',
            label: 'Indirizzo',
            placeholder: 'Via, numero, città',
            required: true,
            multiline: true,
            maxLength: 120,
          },
        ],
        initialValues: { name: stay?.name ?? '', address: stay?.address ?? '' },
        attachment: { label: 'Voucher di prenotazione', doc: stay?.doc ?? null },
        deleteLabel: stay ? "Rimuovi l'alloggio del giorno" : undefined,
      };
    }

    case 'activity': {
      const day = trip.days.find((item) => item.id === target.dayId);
      const activity = day?.activities.find((item) => item.id === target.activityId) ?? null;
      return {
        title: activity ? 'Modifica attività' : 'Nuova attività',
        subtitle: `Giorno ${dayNumber(trip, target.dayId)} · ingresso, tour o cena`,
        fields: [
          {
            key: 'name',
            label: 'Nome attività',
            placeholder: 'es. Trekking sul ghiacciaio',
            required: true,
            maxLength: 70,
          },
          {
            key: 'place',
            label: 'Luogo',
            placeholder: 'Punto di ritrovo o indirizzo',
            required: true,
            multiline: true,
            maxLength: 120,
          },
        ],
        initialValues: { name: activity?.name ?? '', place: activity?.place ?? '' },
        attachment: { label: 'Biglietto o voucher', doc: activity?.doc ?? null },
        deleteLabel: activity ? "Elimina l'attività" : undefined,
      };
    }

    case 'passport': {
      const passport = trip.documents.passport;
      return {
        title: passport ? 'Aggiorna documento' : 'Collega il passaporto',
        subtitle: 'Numero, scadenza e scansione della pagina dati',
        fields: [
          {
            key: 'number',
            label: 'Numero documento',
            placeholder: 'YA0000000',
            required: true,
            autoCapitalize: 'characters',
            maxLength: 12,
          },
          { key: 'expiry', label: 'Scadenza', placeholder: 'MM/AAAA', required: true, maxLength: 7 },
        ],
        initialValues: { number: passport?.number ?? '', expiry: passport?.expiry ?? '' },
        attachment: { label: 'Scansione pagina dati', doc: passport?.doc ?? null },
      };
    }

    case 'customs': {
      const customs = trip.documents.customs;
      return {
        title: customs ? 'Modifica modulo doganale' : 'Aggiungi modulo doganale',
        subtitle: "Codice pratica e ricevuta da esibire all'arrivo",
        fields: [
          {
            key: 'code',
            label: 'Codice pratica',
            placeholder: 'es. KEF-4472-IS',
            required: true,
            autoCapitalize: 'characters',
            maxLength: 24,
          },
          { key: 'note', label: 'Note', placeholder: 'Paese e punto di ingresso', maxLength: 80 },
        ],
        initialValues: { code: customs?.code ?? '', note: customs?.note ?? '' },
        attachment: { label: 'Ricevuta o QR', doc: customs?.doc ?? null },
        deleteLabel: customs ? 'Rimuovi il modulo' : undefined,
      };
    }

    case 'transport': {
      const transport = trip.documents.transports.find((item) => item.id === target.transportId) ?? null;
      return {
        title: transport ? 'Modifica mezzo' : 'Aggiungi trasporto',
        subtitle: 'Noleggio, volo o traghetto del gruppo',
        fields: [
          {
            key: 'name',
            label: 'Mezzo',
            placeholder: 'es. Van 4x4 noleggiato',
            required: true,
            maxLength: 60,
          },
          {
            key: 'reference',
            label: 'Riferimento',
            placeholder: 'Targa, numero volo, molo e orario',
            multiline: true,
            maxLength: 120,
          },
        ],
        initialValues: { name: transport?.name ?? '', reference: transport?.reference ?? '' },
        attachment: { label: 'Contratto o biglietto', doc: transport?.docs[0]?.doc ?? null },
        deleteLabel: transport ? 'Elimina il mezzo' : undefined,
      };
    }

    case 'insurance': {
      const insurance = trip.documents.insurance;
      return {
        title: insurance ? 'Modifica assicurazione' : 'Aggiungi assicurazione',
        subtitle: 'Polizza sanitaria e centrale di assistenza',
        fields: [
          {
            key: 'company',
            label: 'Compagnia',
            placeholder: 'es. Europ Assistance',
            required: true,
            maxLength: 50,
          },
          {
            key: 'policy',
            label: 'Numero polizza',
            placeholder: 'VM-00000-XX',
            required: true,
            autoCapitalize: 'characters',
            maxLength: 24,
          },
          { key: 'coverage', label: 'Copertura', placeholder: 'es. fino al 24/09', maxLength: 50 },
          {
            key: 'emergencyPhone',
            label: 'Centrale h24',
            placeholder: '+39 02 0000 0000',
            keyboardType: 'phone-pad',
            maxLength: 20,
          },
        ],
        initialValues: {
          company: insurance?.company ?? '',
          policy: insurance?.policy ?? '',
          coverage: insurance?.coverage ?? '',
          emergencyPhone: insurance?.emergencyPhone ?? '',
        },
        attachment: { label: 'Certificato di polizza', doc: insurance?.doc ?? null },
        deleteLabel: insurance ? 'Rimuovi la polizza' : undefined,
      };
    }
  }
}

/** Id stabile per una nuova attività o un nuovo mezzo. */
export const newEntityId = (prefix: 'act' | 'trn') => createId(prefix);
