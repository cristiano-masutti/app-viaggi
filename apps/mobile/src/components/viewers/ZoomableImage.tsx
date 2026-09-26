import React, { useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { SmartImage } from '@/components/ui/SmartImage';
import { slideSpring } from '@/theme/motion';

interface Props {
  uri?: string;
  blurhash?: string;
  /** Tocco singolo a zoom 1: chiude il visore. A zoom maggiore non fa nulla. */
  onSingleTap?: () => void;
  maxScale?: number;
}

/**
 * Immagine ingrandibile.
 *
 * Pinch, trascinamento e doppio tap sono gesti nativi composti da
 * `react-native-gesture-handler` e animati da Reanimated: la foto segue le dita
 * nello stesso frame, senza passare dal JS. Al rilascio, se è stata
 * rimpicciolita sotto la soglia, rientra da sola con una molla.
 *
 * Vive qui in un pezzo solo perché la usano sia il visore dei ricordi sia
 * quello del passaporto: un solo comportamento di zoom in tutta l'app.
 */
export function ZoomableImage({ uri, blurhash, onSingleTap, maxScale = 4 }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const gesture = useMemo(() => {
    const reset = () => {
      'worklet';
      scale.value = withSpring(1, slideSpring);
      savedScale.value = 1;
      offsetX.value = withSpring(0, slideSpring);
      offsetY.value = withSpring(0, slideSpring);
    };

    const pinch = Gesture.Pinch()
      .onUpdate((event) => {
        scale.value = Math.min(maxScale, Math.max(0.6, savedScale.value * event.scale));
      })
      .onEnd(() => {
        if (scale.value <= 1) reset();
        else savedScale.value = scale.value;
      });

    const pan = Gesture.Pan()
      .averageTouches(true)
      .onStart(() => {
        startX.value = offsetX.value;
        startY.value = offsetY.value;
      })
      .onUpdate((event) => {
        // Si trascina solo da ingranditi: a zoom 1 il gesto resta libero per la lista.
        if (scale.value <= 1) return;
        offsetX.value = startX.value + event.translationX;
        offsetY.value = startY.value + event.translationY;
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        if (scale.value > 1) {
          reset();
        } else {
          scale.value = withSpring(2.2, slideSpring);
          savedScale.value = 2.2;
        }
      });

    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .onEnd(() => {
        if (scale.value <= 1 && onSingleTap) runOnJS(onSingleTap)();
      });

    return Gesture.Race(Gesture.Simultaneous(pinch, pan), Gesture.Exclusive(doubleTap, singleTap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxScale, onSingleTap]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View className="flex-1 items-center justify-center">
        <Animated.View className="h-full w-full" style={style}>
          <SmartImage
            uri={uri}
            blurhash={blurhash}
            contentFit="contain"
            style={{ width: '100%', height: '100%' }}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
