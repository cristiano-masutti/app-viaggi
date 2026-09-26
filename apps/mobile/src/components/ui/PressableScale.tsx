import React, { useMemo } from 'react';
import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { pressSpring } from '@/theme/motion';

type HapticKind = 'tap' | 'select' | 'confirm' | 'warn' | 'none';

export interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Quanto si schiaccia l'elemento. Card grandi → 0.985, chip piccoli → 0.94. */
  scaleTo?: number;
  /** Feedback tattile al rilascio. `tap` è il default, `none` per gli elementi secondari. */
  haptic?: HapticKind;
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: { selected?: boolean; disabled?: boolean; expanded?: boolean };
  hitSlop?: number;
  testID?: string;
}

const fire = (kind: HapticKind) => {
  if (kind === 'tap') haptics.tap();
  else if (kind === 'select') haptics.select();
  else if (kind === 'confirm') haptics.confirm();
  else if (kind === 'warn') haptics.warn();
};

/**
 * Il mattone di ogni cosa toccabile.
 *
 * Il feedback di pressione è un gesto nativo (`react-native-gesture-handler`)
 * animato da Reanimated: l'elemento si schiaccia sull'UI thread nel frame
 * successivo al tocco, anche se il JS thread è occupato a ri-filtrare una
 * lista. Sul JS thread torna solo `onPress`.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  scaleTo = 0.96,
  haptic = 'tap',
  className,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop = 6,
  testID,
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const handlePress = () => {
    if (disabled) return;
    fire(haptic);
    onPress?.();
  };

  const handleLongPress = () => {
    if (disabled || !onLongPress) return;
    haptics.select();
    onLongPress();
  };

  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .enabled(!disabled)
      .maxDuration(10_000)
      .shouldCancelWhenOutside(true)
      .onBegin(() => {
        pressed.value = withSpring(1, pressSpring);
      })
      .onFinalize(() => {
        pressed.value = withSpring(0, pressSpring);
      })
      .onEnd((_event, success) => {
        if (success) runOnJS(handlePress)();
      });

    if (!onLongPress) return tap;

    const long = Gesture.LongPress()
      .enabled(!disabled)
      .minDuration(320)
      .onStart(() => {
        runOnJS(handleLongPress)();
      });

    // Exclusive: un long press non fa scattare anche il tap al rilascio.
    return Gesture.Exclusive(long, tap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, onPress, onLongPress, haptic]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * 0.1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, ...accessibilityState }}
        hitSlop={hitSlop}
        testID={testID}
        className={className}
        style={[style, animatedStyle, disabled && { opacity: 0.45 }]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
