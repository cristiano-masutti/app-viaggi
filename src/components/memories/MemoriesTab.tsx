import { FlashList } from '@shopify/flash-list';
import { Plus } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { FilterChipRow, type FilterChip } from '@/components/ui/FilterChipRow';
import { PrimaryButton } from '@/components/ui/Buttons';
import { SegmentedSwitcher } from '@/components/ui/SegmentedSwitcher';
import { noteMemories, photoMemories } from '@/lib/trip';
import type { HeaderScroll } from '@/lib/useHeaderScroll';
import type { CrewMember, Memory, NoteMemory, PhotoMemory, ReactionKey, Trip } from '@/types';

import { NoteCard } from './NoteCard';
import { PhotoTile } from './PhotoTile';

type FormatKey = 'photos' | 'diary';

const ALL = 'all';
const MINE = 'mine';

interface Props {
  trip: Trip;
  /** Id dell'utente loggato: decide cosa è "I Miei" e cosa si può cancellare. */
  currentUserId: string;
  topPadding: number;
  /** Spazio libero in fondo: la tab bar non c'è, ma la safe area sì. */
  bottomPadding: number;
  /** Gestore JS: FlashList chiama `onScroll` direttamente, non accetta worklet. */
  onScroll: HeaderScroll['onScrollJS'];
  onNewMemory: () => void;
  onOpenPhoto: (memory: PhotoMemory) => void;
  onReact: (memoryId: string, reaction: ReactionKey) => void;
  onEditNote: (note: NoteMemory) => void;
  onDeleteNote: (memoryId: string) => void;
}

/**
 * Tab "🌟 Memorie".
 *
 * Un solo punto d'ingresso per aggiungere (il tasto in alto) e due filtri
 * combinati per consultare: **tappa** × **crew**. I due sotto-formati (foto e
 * diario) condividono gli stessi filtri, così passare da uno all'altro non
 * azzera quello che si stava guardando.
 */
export function MemoriesTab({
  trip,
  currentUserId,
  topPadding,
  bottomPadding,
  onScroll,
  onNewMemory,
  onOpenPhoto,
  onReact,
  onEditNote,
  onDeleteNote,
}: Props) {
  const [format, setFormat] = useState<FormatKey>('photos');
  const [dayFilter, setDayFilter] = useState<string>(ALL);
  const [authorFilter, setAuthorFilter] = useState<string>(ALL);

  const crewById = useMemo(() => {
    const map = new Map<string, CrewMember>();
    trip.crew.forEach((member) => map.set(member.id, member));
    return map;
  }, [trip.crew]);

  const dayLabelById = useMemo(() => {
    const map = new Map<string, string>();
    trip.days.forEach((day) => map.set(day.id, `Giorno ${day.index}`));
    return map;
  }, [trip.days]);

  /**
   * Filtro unico applicato a entrambi i formati.
   * La riservatezza viene prima di tutto: un ricordo privato di un altro non
   * esiste, qualunque filtro sia attivo.
   */
  const visible = useMemo(() => {
    const matches = (memory: Memory) => {
      if (memory.visibility === 'private' && memory.authorId !== currentUserId) return false;
      if (dayFilter !== ALL && memory.dayId !== dayFilter) return false;
      if (authorFilter === MINE) return memory.authorId === currentUserId;
      if (authorFilter !== ALL) return memory.authorId === authorFilter;
      return true;
    };
    return trip.memories.filter(matches);
  }, [authorFilter, currentUserId, dayFilter, trip.memories]);

  const photos = useMemo(() => photoMemories(visible), [visible]);
  const notes = useMemo(() => noteMemories(visible), [visible]);

  const dayChips = useMemo<FilterChip[]>(
    () => [
      { key: ALL, label: 'Tutti i Giorni' },
      ...trip.days.map((day) => ({ key: day.id, label: day.label })),
    ],
    [trip.days],
  );

  const crewChips = useMemo<FilterChip[]>(
    () => [
      { key: ALL, label: `👥 Tutti (${trip.crew.length})` },
      { key: MINE, label: '👤 I Miei' },
      ...trip.crew
        .filter((member) => member.id !== currentUserId)
        .map((member) => ({
          key: member.id,
          label: member.name,
          avatar: member.avatar,
          avatarName: member.name,
        })),
    ],
    [currentUserId, trip.crew],
  );

  const renderPhoto = useCallback(
    ({ item }: { item: PhotoMemory }) => (
      <View className="p-[5px]">
        <PhotoTile
          memory={item}
          author={crewById.get(item.authorId)}
          onPress={() => onOpenPhoto(item)}
          onQuickReact={(reaction) => onReact(item.id, reaction)}
        />
      </View>
    ),
    [crewById, onOpenPhoto, onReact],
  );

  const renderNote = useCallback(
    ({ item }: { item: NoteMemory }) => (
      <NoteCard
        note={item}
        author={crewById.get(item.authorId)}
        dayLabel={dayLabelById.get(item.dayId) ?? item.dayId}
        mine={item.authorId === currentUserId}
        onEdit={() => onEditNote(item)}
        onDelete={() => onDeleteNote(item.id)}
      />
    ),
    [crewById, currentUserId, dayLabelById, onDeleteNote, onEditNote],
  );

  const header = (
    <View className="gap-3.5 pb-4">
      <PrimaryButton
        label="Nuovo Ricordo"
        icon={<Plus size={19} color="#FFFFFF" strokeWidth={2.7} />}
        onPress={onNewMemory}
      />

      <SegmentedSwitcher
        options={[
          { key: 'photos', label: '📸 Foto' },
          { key: 'diary', label: '📖 Diario' },
        ]}
        value={format}
        onChange={setFormat}
      />

      <View className="gap-2.5">
        <FilterChipRow
          chips={dayChips}
          value={dayFilter}
          onChange={setDayFilter}
          accessibilityLabel="Filtra per tappa"
        />
        <FilterChipRow
          chips={crewChips}
          value={authorFilter}
          onChange={setAuthorFilter}
          accessibilityLabel="Filtra per compagno di viaggio"
        />
      </View>
    </View>
  );

  const empty = (
    <View className="items-center gap-2 rounded-card border border-dashed border-ink-700 px-5 py-9">
      <Text className="text-[14.5px] font-extrabold text-bone">Nessun ricordo con questi filtri</Text>
      <Text className="text-center text-[12.5px] font-semibold text-mist">
        Cambia giorno o compagno, oppure aggiungine uno tu.
      </Text>
    </View>
  );

  const contentPadding = {
    paddingTop: topPadding + 14,
    paddingBottom: bottomPadding,
    paddingHorizontal: 18,
  };

  // `key` diverso per formato: griglia masonry e timeline hanno layout
  // incompatibili, quindi si rimonta invece di riciclare celle sbagliate.
  return format === 'photos' ? (
    <FlashList
      key="memories-photos"
      data={photos}
      masonry
      numColumns={2}
      keyExtractor={(item) => item.id}
      renderItem={renderPhoto}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      // I 5px di padding per cella compongono la gronda da 10px tra le colonne.
      contentContainerStyle={{ ...contentPadding, paddingHorizontal: 13 }}
      ListHeaderComponent={<View className="px-[5px]">{header}</View>}
      ListEmptyComponent={<View className="px-[5px]">{empty}</View>}
    />
  ) : (
    <FlashList
      key="memories-diary"
      data={notes}
      keyExtractor={(item) => item.id}
      renderItem={renderNote}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentPadding}
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
    />
  );
}
