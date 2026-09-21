import React, { forwardRef, useMemo } from 'react';
import type { ScrollView, ScrollViewProps } from 'react-native';
import Animated, { useAnimatedRef, useScrollOffset } from 'react-native-reanimated';

/**
 * Offset verticale di una lista, condiviso con l'header sfocato.
 *
 * Non passa da `onScroll`. Reanimated si aggancia al componente scrollabile
 * tramite un *animated ref* e legge la posizione direttamente sull'UI thread:
 * nessun callback JS per frame, nessun numero che attraversa il ponte.
 *
 * Serviva proprio per FlashList, che invoca `onScroll` come una normale
 * funzione JavaScript e quindi va in crash se gli si passa un worklet. Con il
 * ref il problema sparisce alla radice: FlashList continua a usare il *suo*
 * `onScroll` per la virtualizzazione, noi leggiamo l'offset da un'altra strada e
 * i due non si toccano.
 *
 * ```tsx
 * const { scrollY, scrollComponent } = useHeaderScroll();
 * <FlashList renderScrollComponent={scrollComponent} … />   // liste
 * <Animated.ScrollView ref={scrollRef} … />                 // pagine semplici
 * ```
 */
export function useHeaderScroll() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);

  /**
   * Componente di scroll per FlashList.
   *
   * FlashList tiene il proprio ref sulla ScrollView (gli serve per `scrollTo`),
   * quindi i due ref vanno fusi: se ne sovrascrivessimo uno, si romperebbe o la
   * lista o l'header.
   */
  const scrollComponent = useMemo(
    () =>
      forwardRef<ScrollView, ScrollViewProps>(function HeaderAwareScrollView(props, forwardedRef) {
        return (
          <Animated.ScrollView
            {...props}
            ref={(node: ScrollView | null) => {
              scrollRef(node as never);
              if (typeof forwardedRef === 'function') forwardedRef(node);
              else if (forwardedRef) forwardedRef.current = node;
            }}
          />
        );
      }) as unknown as React.ComponentType<ScrollViewProps>,
    [scrollRef],
  );

  return { scrollY, scrollRef, scrollComponent };
}

export type HeaderScroll = ReturnType<typeof useHeaderScroll>;
