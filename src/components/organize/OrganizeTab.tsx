import {
  Bus,
  FileText,
  IdCard,
  MapPin,
  MessageCircle,
  Plane,
  QrCode,
  Ship,
  Stethoscope,
  Ticket,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CallButton, DocButton, Divider, SoftActionButton } from '@/components/ui/Buttons';
import { Card, CardRow, SectionHeader } from '@/components/ui/Card';
import { CopyChip } from '@/components/ui/CopyChip';
import { DashedPlaceholder } from '@/components/ui/DashedPlaceholder';
import { FilterChipRow } from '@/components/ui/FilterChipRow';
import { defaultDayId } from '@/lib/trip';
import type { HeaderScroll } from '@/lib/useHeaderScroll';
import { palette } from '@/theme/palette';
import type { DocumentRef, TransportMode, Trip } from '@/types';

import type { EditTarget } from './editConfig';

interface Props {
  trip: Trip;
  topPadding: number;
  /** Spazio libero in fondo: la tab bar non c'è, ma la safe area sì. */
  bottomPadding: number;
  onScroll: HeaderScroll['onScroll'];
  onEdit: (target: EditTarget) => void;
  onOpenDoc: (doc: DocumentRef) => void;
}

const TRANSPORT_ICONS: Record<TransportMode, typeof Bus> = {
  van: Bus,
  flight: Plane,
  ferry: Ship,
};

/**
 * Tab "📋 Organizza".
 *
 * Due blocchi rigidi e mai mescolati: quello che cambia **giorno per giorno**
 * (dove si dorme, cosa si è prenotato) e quello che vale **per tutto il
 * viaggio** (documenti, trasporti, polizza, SOS). Chi cerca il voucher di
 * stasera guarda in alto, chi cerca il passaporto guarda in basso — sempre.
 *
 * La struttura è identica per un viaggio in corso e per uno futuro: cambia solo
 * quanto è pieno. Dove il dato non c'è compare un placeholder tratteggiato che
 * apre la stessa modale della matita.
 */
export function OrganizeTab({ trip, topPadding, bottomPadding, onScroll, onEdit, onOpenDoc }: Props) {
  const [dayId, setDayId] = useState(() => defaultDayId(trip));

  const day = useMemo(() => trip.days.find((item) => item.id === dayId) ?? trip.days[0], [dayId, trip.days]);

  const dayChips = useMemo(
    () =>
      trip.days.map((item) => ({
        key: item.id,
        label: item.index === trip.currentDay ? `${item.label} · Oggi` : item.label,
      })),
    [trip.currentDay, trip.days],
  );

  const { passport, customs, transports, insurance } = trip.documents;

  return (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: topPadding + 14,
        paddingBottom: bottomPadding,
        paddingHorizontal: 18,
        gap: 18,
      }}
    >
      {/* ══ BLOCCO A · Documenti del giorno ══ */}
      <View className="gap-3.5">
        <FilterChipRow
          chips={dayChips}
          value={day?.id ?? ''}
          onChange={setDayId}
          accessibilityLabel="Scegli la tappa"
        />

        <SectionHeader title="Documenti del giorno" hint={day?.date} accent />

        {/* Alloggio */}
        {day?.stay ? (
          <Card onEdit={() => onEdit({ kind: 'stay', dayId: day.id })} editLabel="Modifica alloggio">
            <CardRow
              icon={<Text className="text-[16px]">🏨</Text>}
              title={day.stay.name}
              subtitle="Alloggio del giorno"
              inset
            />
            <View className="flex-row items-center gap-2.5">
              <MapPin size={15} color={palette.accentSoft} strokeWidth={2} />
              <Text className="flex-1 text-[13.5px] font-semibold leading-[19px] text-bone/65">
                {day.stay.address}
              </Text>
              <CopyChip value={day.stay.address} />
            </View>
            {day.stay.doc ? (
              <DocButton label="📄 Prenotazione" onPress={() => onOpenDoc(day.stay!.doc!)} />
            ) : (
              <DocButton
                label="Allega la prenotazione"
                empty
                icon={<FileText size={15} color="rgba(244,242,237,0.55)" strokeWidth={2} />}
                onPress={() => onEdit({ kind: 'stay', dayId: day.id })}
              />
            )}
          </Card>
        ) : (
          <DashedPlaceholder
            emoji="🏨"
            title={`Aggiungi alloggio per il Giorno ${day?.index ?? 1}`}
            hint="Nome struttura, indirizzo e voucher di prenotazione"
            onPress={() => day && onEdit({ kind: 'stay', dayId: day.id })}
          />
        )}

        {/* Attività prenotate */}
        <Text className="pl-0.5 text-[11px] font-extrabold uppercase tracking-[0.9px] text-bone/45">
          Attività prenotate
        </Text>

        {day && day.activities.length === 0 ? (
          <DashedPlaceholder
            emoji="🎟️"
            title="Nessuna attività prenotata"
            hint="Ingressi, tour e cene del giorno, tutti in un blocco solo"
            onPress={() => onEdit({ kind: 'activity', dayId: day.id })}
          />
        ) : (
          day?.activities.map((activity) => (
            <Card
              key={activity.id}
              onEdit={() => onEdit({ kind: 'activity', dayId: day.id, activityId: activity.id })}
              editLabel="Modifica attività"
            >
              <View className="gap-1.5 pr-9">
                <Text className="text-[16px] font-extrabold leading-5 tracking-tight text-bone">
                  {activity.name}
                </Text>
                <View className="flex-row items-center gap-2">
                  <MapPin size={14} color={palette.accentSoft} strokeWidth={2} />
                  <Text className="flex-1 text-[13px] font-semibold leading-[18px] text-bone/65">
                    {activity.place}
                  </Text>
                  <CopyChip value={activity.place} />
                </View>
              </View>
              {activity.doc ? (
                <DocButton label="🎟️ Biglietto" onPress={() => onOpenDoc(activity.doc!)} />
              ) : (
                <DocButton
                  label="Allega biglietto o voucher"
                  empty
                  icon={<Ticket size={15} color="rgba(244,242,237,0.55)" strokeWidth={2} />}
                  onPress={() => onEdit({ kind: 'activity', dayId: day.id, activityId: activity.id })}
                />
              )}
            </Card>
          ))
        )}

        <DashedPlaceholder
          variant="inline"
          title="Aggiungi attività o biglietto"
          onPress={() => day && onEdit({ kind: 'activity', dayId: day.id })}
        />
      </View>

      <Divider />

      {/* ══ BLOCCO B · Documenti del viaggio ══ */}
      <View className="gap-3.5">
        <SectionHeader title="Documenti del viaggio" hint="Validi per tutte le tappe" />

        {/* Passaporto personale — arriva dal Profilo */}
        {passport ? (
          <Card onEdit={() => onEdit({ kind: 'passport' })} editLabel="Aggiorna passaporto">
            <CardRow
              icon={<IdCard size={18} color={palette.text} strokeWidth={1.9} />}
              title="Passaporto personale"
              subtitle={`${passport.number} · scade ${passport.expiry}`}
              inset
            />
            <DocButton
              label="🪪 Visualizza"
              onPress={() => (passport.doc ? onOpenDoc(passport.doc) : onEdit({ kind: 'passport' }))}
            />
            <Text className="text-[11.5px] font-semibold leading-[17px] text-mist">
              Collegato al Passaporto Master del tuo profilo: aggiornalo lì e cambia in tutti i viaggi.
            </Text>
          </Card>
        ) : (
          <DashedPlaceholder
            emoji="🪪"
            title="Collega il passaporto"
            hint="Numero, scadenza e scansione della pagina dati"
            onPress={() => onEdit({ kind: 'passport' })}
          />
        )}

        {/* Modulo doganale / QR — mai aperto a display */}
        {customs ? (
          <Card onEdit={() => onEdit({ kind: 'customs' })} editLabel="Modifica modulo doganale">
            <CardRow
              icon={<QrCode size={18} color={palette.text} strokeWidth={1.9} />}
              title="Modulo doganale"
              subtitle={`${customs.note} · ${customs.code}`}
              inset
            />
            <DocButton
              label="📄 Visualizza Ricevuta/QR"
              onPress={() => (customs.doc ? onOpenDoc(customs.doc) : onEdit({ kind: 'customs' }))}
            />
          </Card>
        ) : (
          <DashedPlaceholder
            emoji="📄"
            title="Aggiungi modulo doganale / QR"
            hint="Codice pratica e ricevuta da esibire all'arrivo"
            onPress={() => onEdit({ kind: 'customs' })}
          />
        )}

        {/* Trasporti di gruppo */}
        <Text className="pl-0.5 text-[11px] font-extrabold uppercase tracking-[0.9px] text-bone/45">
          Trasporti di gruppo
        </Text>

        {transports.length === 0 ? (
          <DashedPlaceholder
            emoji="🚐"
            title="Aggiungi noleggio, volo o traghetto"
            hint="Dettagli del mezzo e contratto scaricabile"
            onPress={() => onEdit({ kind: 'transport' })}
          />
        ) : (
          transports.map((transport) => {
            const Icon = TRANSPORT_ICONS[transport.mode];
            return (
              <Card
                key={transport.id}
                onEdit={() => onEdit({ kind: 'transport', transportId: transport.id })}
                editLabel="Modifica mezzo"
              >
                <CardRow
                  icon={<Icon size={18} color={palette.text} strokeWidth={1.9} />}
                  title={transport.name}
                  subtitle={transport.reference}
                  inset
                />
                <View className="gap-2">
                  {transport.docs.map((entry) =>
                    entry.doc ? (
                      <DocButton
                        key={entry.id}
                        label={entry.label}
                        icon={<FileText size={15} color={palette.text} strokeWidth={2} />}
                        onPress={() => onOpenDoc(entry.doc!)}
                      />
                    ) : (
                      <DocButton
                        key={entry.id}
                        label={`Allega ${entry.label.toLowerCase()}`}
                        empty
                        icon={<FileText size={15} color="rgba(244,242,237,0.55)" strokeWidth={2} />}
                        onPress={() => onEdit({ kind: 'transport', transportId: transport.id })}
                      />
                    ),
                  )}
                </View>
              </Card>
            );
          })
        )}

        {transports.length > 0 ? (
          <DashedPlaceholder
            variant="inline"
            title="Aggiungi un altro mezzo"
            onPress={() => onEdit({ kind: 'transport' })}
          />
        ) : null}

        {/* Assicurazione medica */}
        {insurance ? (
          <Card onEdit={() => onEdit({ kind: 'insurance' })} editLabel="Modifica assicurazione">
            <CardRow
              icon={<Stethoscope size={18} color={palette.text} strokeWidth={1.9} />}
              title="Assicurazione medica"
              subtitle={`${insurance.company} · ${insurance.coverage}`}
              inset
            />
            <View className="bg-tangerine/12 gap-1 rounded-[16px] border border-tangerine/35 px-4 py-3.5">
              <Text className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-tangerine-soft">
                Numero polizza
              </Text>
              <Text className="text-[21px] font-extrabold tracking-tight text-bone">{insurance.policy}</Text>
            </View>
            {insurance.doc ? (
              <DocButton
                label="Visualizza certificato"
                icon={<FileText size={15} color={palette.text} strokeWidth={2} />}
                onPress={() => onOpenDoc(insurance.doc!)}
              />
            ) : (
              <DocButton
                label="Allega il certificato"
                empty
                icon={<FileText size={15} color="rgba(244,242,237,0.55)" strokeWidth={2} />}
                onPress={() => onEdit({ kind: 'insurance' })}
              />
            )}
            {insurance.emergencyPhone ? (
              <CallButton label="Centrale assistenza h24" phone={insurance.emergencyPhone} />
            ) : null}
          </Card>
        ) : (
          <DashedPlaceholder
            emoji="🛡️"
            title="Inserisci la polizza sanitaria"
            hint="Numero polizza, certificato e contatto della centrale"
            onPress={() => onEdit({ kind: 'insurance' })}
          />
        )}
      </View>

      <Divider />

      {/* ══ BLOCCO C · SOS ══ */}
      <View className="gap-3">
        <SectionHeader title="SOS & emergenze" hint="Un tocco, una chiamata" />

        {trip.emergencies.map((contact) => (
          <View key={contact.id} className="gap-3 rounded-card border border-ink-700 bg-ink-900 p-4">
            <View className="gap-1">
              <Text className="text-[15.5px] font-extrabold leading-5 tracking-tight text-white">
                {contact.title}
              </Text>
              <Text className="text-[12.5px] font-semibold leading-[18px] text-mist">{contact.subtitle}</Text>
            </View>

            <View className="flex-row gap-2.5">
              <CallButton label={contact.actionLabel} phone={contact.phone} className="flex-1" />
              {contact.whatsapp ? (
                <SoftActionButton
                  label="WhatsApp"
                  icon={<MessageCircle size={15} color={palette.text} strokeWidth={2} />}
                  onPress={() => {
                    void Linking.openURL(`whatsapp://send?phone=${contact.phone.replace(/\s/g, '')}`);
                  }}
                />
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </Animated.ScrollView>
  );
}
