import { useCallback } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

/**
 * Offset verticale della lista, condiviso con l'header sfocato.
 *
 * Restituisce due gestori perché le due famiglie di liste li vogliono diversi:
 *
 * - `onScroll` è un worklet e va su `Animated.ScrollView`: la posizione non
 *   attraversa mai il ponte, resta tutto sull'UI thread.
 * - `onScrollJS` è un normale callback e serve a FlashList, che invoca
 *   `onScroll` direttamente dal JS: passargli un worklet lo farebbe esplodere
 *   ("onScroll is not a function"). Attraversa il ponte un solo numero per
 *   evento; l'interpolazione della sfocatura resta comunque un worklet, quindi
 *   l'header non perde un frame.
 *
 * In entrambi i casi il valore finisce nello stesso `scrollY`, e l'header non
 * sa da quale dei due è arrivato.
 */
export function useHeaderScroll() {
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const onScrollJS = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  return { scrollY, onScroll, onScrollJS };
}

export type HeaderScroll = ReturnType<typeof useHeaderScroll>;
