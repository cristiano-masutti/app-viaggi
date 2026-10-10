import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MemoriesTab } from '@/components/memories/MemoriesTab';
import { NewMemoryModal } from '@/components/memories/NewMemoryModal';
import { buildEditConfig, newEntityId, type EditTarget } from '@/components/organize/editConfig';
import { OrganizeTab } from '@/components/organize/OrganizeTab';
import { EditSheet, type EditValues } from '@/components/sheets/EditSheet';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedSwitcher } from '@/components/ui/SegmentedSwitcher';
import { useToast } from '@/components/ui/Toast';
import { DocumentViewerModal } from '@/components/viewers/DocumentViewerModal';
import { PhotoViewerModal } from '@/components/viewers/PhotoViewerModal';
import { defaultDayId, photoMemories, tripBadge } from '@/lib/trip';
import { useHeaderScroll } from '@/lib/useHeaderScroll';
import { telemetry } from '@/telemetry';
import { useScreenReady } from '@/telemetry/useScreenReady';
import type { RootStackScreenProps } from '@/navigation/types';
import { useAppActions, useProfile, useTrip, useTripLoaded } from '@/store/AppStore';
import { palette } from '@/theme/palette';
import type { DocumentRef, NewMemoryDraft, NoteMemory, ReactionKey } from '@/types';

type TabKey = 'memories' | 'organize';

const TABS = [
  { key: 'memories' as const, label: '🌟 Memorie' },
  { key: 'organize' as const, label: '📋 Organizza' },
];

/**
 * Schermata interna del viaggio.
 *
 * Struttura identica per un viaggio in corso e per uno futuro: due sole
 * macro-tab, Memorie e Organizza. Il viaggio non cambia forma a seconda di dove
 * si trova nel tempo — cambia solo quanto è pieno.
 */
export function TripDetailScreen({ navigation, route }: RootStackScreenProps<'TripDetail'>) {
  const { tripId } = route.params;
  const trip = useTrip(tripId);
  const loaded = useTripLoaded(tripId);
  useScreenReady('TripDetail', !!trip && loaded);
  const profile = useProfile();
  const actions = useAppActions();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  // Ogni apertura rilegge il viaggio: programma e ricordi cambiano anche dai
  // telefoni dei compagni. Nel prototipo è un no-op, i dati sono già tutti qui.
  const { loadTrip } = actions;
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadSettled, setLoadSettled] = useState(false);
  useEffect(() => {
    let active = true;
    setLoadSettled(false);
    void loadTrip(tripId).finally(() => {
      if (active) setLoadSettled(true);
    });
    return () => {
      active = false;
    };
  }, [loadAttempt, loadTrip, tripId]);

  const [tab, setTab] = useState<TabKey>('memories');
  const [headerHeight, setHeaderHeight] = useState(150);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [viewerDoc, setViewerDoc] = useState<DocumentRef | null>(null);
  const [viewerPhotoId, setViewerPhotoId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<NoteMemory | null>(null);
  const [newMemoryOpen, setNewMemoryOpen] = useState(false);

  // Un solo handler condiviso: in ogni momento è montata una sola tab scrollabile.
  const activeScroll = useHeaderScroll();

  /** La foto nel visore si rilegge dallo store a ogni render: le reazioni restano vive. */
  const viewerPhoto = useMemo(
    () => photoMemories(trip?.memories ?? []).find((memory) => memory.id === viewerPhotoId) ?? null,
    [trip?.memories, viewerPhotoId],
  );

  const editConfig = useMemo(
    () => (trip && editing ? buildEditConfig(trip, editing) : null),
    [editing, trip],
  );

  const saveEdit = useCallback(
    (values: EditValues, doc: DocumentRef | null) => {
      if (!trip || !editing) return;
      const text = (key: string) => (values[key] ?? '').trim();

      switch (editing.kind) {
        case 'stay':
          actions.setStay(trip.id, editing.dayId, {
            name: text('name'),
            address: text('address'),
            doc,
          });
          toast.show('Alloggio aggiornato');
          break;

        case 'activity':
          actions.upsertActivity(trip.id, editing.dayId, {
            id: editing.activityId ?? newEntityId('act'),
            name: text('name'),
            place: text('place'),
            doc,
          });
          toast.show(editing.activityId ? 'Attività aggiornata' : 'Attività aggiunta');
          break;

        case 'passport':
          actions.patchDocuments(trip.id, {
            passport: { number: text('number'), expiry: text('expiry'), doc },
          });
          toast.show('Documento aggiornato');
          break;

        case 'customs':
          actions.patchDocuments(trip.id, {
            customs: { code: text('code'), note: text('note'), doc },
          });
          toast.show('Modulo aggiornato');
          break;

        case 'transport': {
          const existing = trip.documents.transports.find((item) => item.id === editing.transportId);
          // L'allegato modificato sostituisce il primo documento del mezzo;
          // gli eventuali altri (es. la polizza kasko) restano dove sono.
          const docs = existing?.docs.length
            ? [{ ...existing.docs[0], doc }, ...existing.docs.slice(1)]
            : [{ id: newEntityId('trn'), label: 'Contratto o biglietto', doc }];

          actions.upsertTransport(trip.id, {
            id: existing?.id ?? newEntityId('trn'),
            name: text('name'),
            reference: text('reference'),
            mode: existing?.mode ?? 'van',
            docs,
          });
          toast.show(existing ? 'Mezzo aggiornato' : 'Mezzo aggiunto');
          break;
        }

        case 'insurance':
          actions.setInsurance(trip.id, {
            company: text('company'),
            policy: text('policy'),
            coverage: text('coverage'),
            emergencyPhone: text('emergencyPhone'),
            doc,
          });
          toast.show('Polizza aggiornata');
          break;
      }

      setEditing(null);
    },
    [actions, editing, toast, trip],
  );

  const deleteEdit = useCallback(() => {
    if (!trip || !editing) return;

    const remove = () => {
      switch (editing.kind) {
        case 'stay':
          actions.setStay(trip.id, editing.dayId, null);
          break;
        case 'activity':
          if (editing.activityId) actions.deleteActivity(trip.id, editing.dayId, editing.activityId);
          break;
        case 'customs':
          actions.patchDocuments(trip.id, { customs: null });
          break;
        case 'transport':
          if (editing.transportId) actions.deleteTransport(trip.id, editing.transportId);
          break;
        case 'insurance':
          actions.setInsurance(trip.id, null);
          break;
        default:
          break;
      }
      setEditing(null);
      toast.show('Elemento rimosso');
    };

    // Niente cancellazioni silenziose: la conferma è nativa, come il resto del sistema.
    Alert.alert('Confermi la rimozione?', 'Il blocco tornerà vuoto e potrai ricompilarlo quando vuoi.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: remove },
    ]);
  }, [actions, editing, toast, trip]);

  const addMemory = useCallback(
    (draft: NewMemoryDraft) => {
      if (!trip) return;
      actions.addMemory(trip.id, draft);
      setNewMemoryOpen(false);
      toast.show(draft.format === 'note' ? 'Nota salvata nel diario' : 'Ricordo pubblicato');
    },
    [actions, toast, trip],
  );

  const react = useCallback(
    (memoryId: string, reaction: ReactionKey) => {
      if (trip) actions.toggleReaction(trip.id, memoryId, reaction);
    },
    [actions, trip],
  );

  const deleteMemory = useCallback(
    (memoryId: string) => {
      if (!trip) return;
      Alert.alert('Eliminare questo ricordo?', 'Sparirà dal viaggio per tutta la crew.', [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            actions.deleteMemory(trip.id, memoryId);
            setViewerPhotoId(null);
            toast.show('Ricordo eliminato');
          },
        },
      ]);
    },
    [actions, toast, trip],
  );

  // Dall'hub arriva solo la card: finché giorni, documenti e ricordi non ci
  // sono si vede lo scheletro della pagina, non una pagina vuota.
  if (!trip || !loaded) {
    if (!loadSettled) return <TripDetailSkeleton title={trip?.title} onBack={() => navigation.goBack()} />;
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-ink-950 px-8">
        <Text className="text-center text-[15px] font-bold text-bone">
          {trip ? 'Il viaggio non si è caricato.' : 'Viaggio non trovato.'}
        </Text>
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityLabel="Torna ai miei viaggi"
            className="h-[42px] items-center justify-center rounded-[14px] border border-ink-700 bg-ink-900 px-4"
          >
            <Text className="text-[13.5px] font-bold tracking-tight text-bone">Indietro</Text>
          </Pressable>
          <Pressable
            onPress={() => setLoadAttempt((attempt) => attempt + 1)}
            accessibilityLabel="Riprova a caricare il viaggio"
            className="h-[42px] items-center justify-center rounded-[14px] bg-tangerine px-5"
          >
            <Text className="text-[13.5px] font-extrabold tracking-tight text-white">Riprova</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const bottomPadding = insets.bottom + 28;
  const dayLabelOfViewer = viewerPhoto
    ? `Giorno ${trip.days.find((day) => day.id === viewerPhoto.dayId)?.index ?? 1}`
    : undefined;

  return (
    <View className="flex-1 bg-ink-950">
      <ScreenHeader
        title={trip.title}
        subtitle={tripBadge(trip)}
        compact
        pinned
        onHeight={setHeaderHeight}
        left={
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityLabel="Torna ai miei viaggi"
          >
            <HeaderIconButton>
              <ArrowLeft size={19} color={palette.text} strokeWidth={2.2} />
            </HeaderIconButton>
          </Pressable>
        }
      >
        <SegmentedSwitcher options={TABS} value={tab} onChange={setTab} />
      </ScreenHeader>

      {tab === 'memories' ? (
        <MemoriesTab
          trip={trip}
          currentUserId={profile.id}
          topPadding={headerHeight}
          bottomPadding={bottomPadding}
          scrollComponent={activeScroll.scrollComponent}
          onNewMemory={() => setNewMemoryOpen(true)}
          onOpenPhoto={(memory) => setViewerPhotoId(memory.id)}
          onReact={react}
          onEditNote={setEditingNote}
          onDeleteNote={deleteMemory}
        />
      ) : (
        <OrganizeTab
          trip={trip}
          topPadding={headerHeight}
          bottomPadding={bottomPadding}
          scrollRef={activeScroll.scrollRef}
          onEdit={setEditing}
          onOpenDoc={(doc) => {
            telemetry.event('document_open', { tripId });
            setViewerDoc(doc);
          }}
        />
      )}

      <NewMemoryModal
        visible={newMemoryOpen}
        trip={trip}
        defaultDayId={defaultDayId(trip)}
        onClose={() => setNewMemoryOpen(false)}
        onSave={addMemory}
      />

      {editConfig ? (
        <EditSheet
          visible={!!editing}
          title={editConfig.title}
          subtitle={editConfig.subtitle}
          fields={editConfig.fields}
          initialValues={editConfig.initialValues}
          attachment={editConfig.attachment}
          saveLabel={editConfig.saveLabel}
          deleteLabel={editConfig.deleteLabel}
          onSave={saveEdit}
          onDelete={editConfig.deleteLabel ? deleteEdit : undefined}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {/* Correzione di una nota già pubblicata: stesso foglio dell'editing rapido. */}
      {editingNote ? (
        <EditSheet
          visible
          title="Modifica la nota"
          subtitle={`Giorno ${trip.days.find((day) => day.id === editingNote.dayId)?.index ?? 1} · ${editingNote.mood}`}
          fields={[
            {
              key: 'text',
              label: 'Testo della nota',
              placeholder: 'Racconta com’è andata…',
              multiline: true,
              required: true,
              maxLength: 280,
            },
          ]}
          initialValues={{ text: editingNote.text }}
          saveLabel="Salva la nota"
          deleteLabel="Elimina la nota"
          onSave={(values) => {
            actions.updateNote(trip.id, editingNote.id, (values.text ?? '').trim());
            setEditingNote(null);
            toast.show('Nota aggiornata');
          }}
          onDelete={() => {
            const id = editingNote.id;
            setEditingNote(null);
            deleteMemory(id);
          }}
          onClose={() => setEditingNote(null)}
        />
      ) : null}

      <DocumentViewerModal doc={viewerDoc} onClose={() => setViewerDoc(null)} />

      <PhotoViewerModal
        memory={viewerPhoto}
        author={trip.crew.find((member) => member.id === viewerPhoto?.authorId)}
        dayLabel={dayLabelOfViewer}
        canDelete={viewerPhoto?.authorId === profile.id}
        onToggleReaction={(reaction) => viewerPhoto && react(viewerPhoto.id, reaction)}
        onDelete={() => viewerPhoto && deleteMemory(viewerPhoto.id)}
        onClose={() => setViewerPhotoId(null)}
      />
    </View>
  );
}

/** La forma della pagina mentre arriva il dettaglio: header vero, contenuto in attesa. */
function TripDetailSkeleton({ title, onBack }: { title?: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-ink-950" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-3 px-5 pb-4">
        <Pressable onPress={onBack} accessibilityLabel="Torna ai miei viaggi">
          <HeaderIconButton>
            <ArrowLeft size={19} color={palette.text} strokeWidth={2.2} />
          </HeaderIconButton>
        </Pressable>
        {title ? (
          <Text numberOfLines={1} className="flex-1 text-[17px] font-extrabold tracking-tight text-white">
            {title}
          </Text>
        ) : (
          <Skeleton className="h-5 flex-1 rounded-lg" />
        )}
      </View>
      <View className="gap-3.5 px-5" accessibilityLabel="Caricamento del viaggio">
        <Skeleton className="h-[46px] rounded-control" />
        <Skeleton className="h-[180px] rounded-card" delay={120} />
        <Skeleton className="h-[96px] rounded-card" delay={240} />
        <Skeleton className="h-[96px] rounded-card" delay={360} />
      </View>
    </View>
  );
}
