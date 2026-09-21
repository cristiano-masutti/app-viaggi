import { Lock, Pencil, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import type { CrewMember, NoteMemory } from '@/types';

interface Props {
  note: NoteMemory;
  author?: CrewMember;
  dayLabel: string;
  /** Solo l'autore può correggere o cancellare la propria nota. */
  mine: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** Colori del tag, sempre sul fondo avorio: mai due toni caldi in conflitto. */
const MOOD_STYLES: Record<string, { chip: string; text: string }> = {
  '😂': { chip: 'bg-tangerine/15', text: 'text-[#B23A0F]' },
  '📍': { chip: 'bg-[#10967824]', text: 'text-[#0E6B54]' },
  '💭': { chip: 'bg-[#1C191712]', text: 'text-cream-ink/65' },
  '🔒': { chip: 'bg-[#1C19170F]', text: 'text-cream-ink/60' },
};

/**
 * Nota del diario, in stile etichetta avorio.
 *
 * È l'unico elemento chiaro dell'app: il contrasto con il fondo nero la fa
 * leggere come carta appoggiata sul tavolo, non come l'ennesima card scura.
 */
export function NoteCard({ note, author, dayLabel, mine, onEdit, onDelete }: Props) {
  const mood = MOOD_STYLES[note.mood.slice(0, 2)] ?? MOOD_STYLES['💭'];

  return (
    <View className="gap-3 rounded-card border border-cream-line bg-cream p-[17px]">
      <View className="flex-row items-center gap-2">
        <Text numberOfLines={1} className="flex-1 text-[11px] font-bold tracking-[0.9px] text-cream-ink/55">
          {`${dayLabel.toUpperCase()} • ${note.time} • ${(author?.name ?? 'Crew').toUpperCase()}`}
        </Text>

        <View className={`rounded-chip px-[11px] py-1.5 ${mood.chip}`}>
          <Text className={`text-[11px] font-bold ${mood.text}`}>{note.mood}</Text>
        </View>

        {mine && onEdit ? (
          <PressableScale
            onPress={onEdit}
            scaleTo={0.88}
            hitSlop={8}
            accessibilityLabel="Modifica nota"
            className="h-7 w-7 items-center justify-center rounded-full border border-cream-ink/15"
          >
            <Pencil size={13} color="#A8A29E" strokeWidth={2.2} />
          </PressableScale>
        ) : null}

        {mine && onDelete ? (
          <PressableScale
            onPress={onDelete}
            haptic="warn"
            scaleTo={0.88}
            hitSlop={8}
            accessibilityLabel="Elimina nota"
            className="h-7 w-7 items-center justify-center rounded-full border border-cream-ink/15"
          >
            <Trash2 size={13} color="#A8A29E" strokeWidth={2.2} />
          </PressableScale>
        ) : null}
      </View>

      <Text className="text-[15px] font-medium leading-[22px] text-cream-ink">{note.text}</Text>

      {note.visibility === 'private' ? (
        <View className="flex-row items-center gap-1.5">
          <Lock size={12} color="#1C1917" strokeWidth={2.2} />
          <Text className="text-[11px] font-bold text-cream-ink/55">Visibile solo a te</Text>
        </View>
      ) : null}
    </View>
  );
}
