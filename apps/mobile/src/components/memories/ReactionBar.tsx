import React from 'react';
import { Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import type { PhotoMemory, ReactionKey } from '@/types';

/** Le quattro reazioni disponibili. Poche e fisse: non è una tastiera emoji. */
export const REACTIONS: ReactionKey[] = ['🔥', '😂', '❤️', '🤯'];

interface Props {
  memory: PhotoMemory;
  onToggle: (reaction: ReactionKey) => void;
  /** `compact` è la versione sovrapposta alla griglia, `full` quella del viewer. */
  variant?: 'compact' | 'full';
}

/**
 * Barra delle reazioni.
 *
 * Una reazione per persona: toccarne un'altra sposta il voto, ritoccare la
 * stessa lo toglie. La logica sta nel reducer, qui c'è solo il tocco.
 */
export function ReactionBar({ memory, onToggle, variant = 'full' }: Props) {
  const compact = variant === 'compact';

  return (
    <View className={`flex-row items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {REACTIONS.map((reaction) => {
        const count = memory.reactions[reaction] ?? 0;
        const mine = memory.myReaction === reaction;

        return (
          <PressableScale
            key={reaction}
            haptic="select"
            scaleTo={0.88}
            accessibilityLabel={`Reagisci con ${reaction}`}
            accessibilityState={{ selected: mine }}
            onPress={() => onToggle(reaction)}
            className={`flex-row items-center gap-1 rounded-chip border ${
              compact ? 'px-2 py-1' : 'px-3 py-2'
            } ${mine ? 'border-tangerine bg-tangerine/20' : 'border-ink-700 bg-ink-900/85'}`}
          >
            <Text className={compact ? 'text-[12px]' : 'text-[15px]'}>{reaction}</Text>
            {count > 0 ? (
              <Animated.Text
                layout={LinearTransition.duration(160)}
                className={`font-extrabold ${compact ? 'text-[10.5px]' : 'text-[12.5px]'} ${
                  mine ? 'text-tangerine-tint' : 'text-bone/60'
                }`}
              >
                {count}
              </Animated.Text>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}
