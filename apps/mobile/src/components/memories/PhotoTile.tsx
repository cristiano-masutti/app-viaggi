import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Play } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { SmartImage } from '@/components/ui/SmartImage';
import type { CrewMember, PhotoMemory, ReactionKey } from '@/types';

import { REACTIONS } from './ReactionBar';

interface Props {
  memory: PhotoMemory;
  author?: CrewMember;
  onPress: () => void;
  /** Long press: reazione rapida senza aprire il visore. */
  onQuickReact: (reaction: ReactionKey) => void;
}

/**
 * Cella della griglia dei ricordi.
 *
 * L'altezza esce da `aspectRatio`, che è un dato del ricordo: la cella occupa
 * lo spazio giusto prima che il file arrivi, quindi la masonry non si riassesta
 * mentre le foto si decodificano.
 */
export function PhotoTile({ memory, author, onPress, onQuickReact }: Props) {
  const totalReactions = Object.values(memory.reactions).reduce((sum, count) => sum + (count ?? 0), 0);

  return (
    <PressableScale
      onPress={onPress}
      // Long press = 🔥, la reazione più usata: un gesto, zero navigazione.
      onLongPress={() => onQuickReact(REACTIONS[0])}
      scaleTo={0.965}
      accessibilityLabel={`Ricordo di ${author?.name ?? 'crew'}, ${memory.time}`}
      style={{ aspectRatio: memory.aspectRatio }}
      className="w-full overflow-hidden rounded-[18px] border border-ink-700 bg-ink-800"
    >
      <SmartImage
        uri={memory.uri}
        blurhash={memory.blurhash}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
      <LinearGradient
        colors={['rgba(13,13,17,0.35)', 'transparent', 'rgba(13,13,17,0.75)']}
        locations={[0, 0.4, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      {memory.kind === 'video' ? (
        <View className="absolute right-2.5 top-2.5 flex-row items-center gap-1 rounded-chip border border-white/20 bg-ink-950/65 px-2 py-1">
          <Play size={10} color="#FFFFFF" strokeWidth={2.6} fill="#FFFFFF" />
          <Text className="text-[10.5px] font-bold text-white">{memory.durationLabel}</Text>
        </View>
      ) : null}

      {memory.visibility === 'private' ? (
        <View className="absolute left-2.5 top-2.5 h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-ink-950/65">
          <Lock size={12} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      ) : null}

      <View className="absolute bottom-2.5 left-3 right-3 flex-row items-end gap-2">
        <View className="flex-1">
          <Text numberOfLines={1} className="text-[11.5px] font-bold text-white">
            {author?.name ?? 'Crew'}
          </Text>
          <Text numberOfLines={1} className="text-[10.5px] font-semibold text-white/65">
            {memory.time}
          </Text>
        </View>

        {totalReactions > 0 ? (
          <View
            className={`flex-row items-center gap-1 rounded-chip border px-2 py-1 ${
              memory.myReaction ? 'border-tangerine/60 bg-tangerine/25' : 'border-white/15 bg-ink-950/60'
            }`}
          >
            <Text className="text-[11px]">{memory.myReaction ?? REACTIONS[0]}</Text>
            <Text className="text-[10.5px] font-extrabold text-white">{totalReactions}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}
