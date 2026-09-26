import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export interface SkeletonProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Sfasa l'onda: righe diverse non brillano tutte insieme. */
  delay?: number;
}

/**
 * Placeholder di caricamento.
 *
 * Nessuno spinner che gira: un blocco scuro (`#262633`) della stessa forma e
 * dimensione del contenuto che sta arrivando, attraversato da un'onda di luce.
 * Così la pagina non si ridisegna quando i dati arrivano — cambia solo il
 * contenuto dentro a un layout già definitivo.
 */
export function Skeleton({ className, style, delay = 0 }: SkeletonProps) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, false),
    );
  }, [delay, progress]);

  const wave = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + progress.value * (width * 2) }],
  }));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className={`overflow-hidden bg-ink-700 ${className ?? ''}`}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 ? (
        <AnimatedGradient
          colors={['transparent', 'rgba(244,242,237,0.07)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[{ position: 'absolute', top: 0, bottom: 0, width }, wave]}
        />
      ) : null}
    </View>
  );
}

/** Scheletro di una card viaggio: stesse proporzioni della card vera. */
export function TripCardSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <View className="overflow-hidden rounded-card border border-ink-700 bg-ink-900">
      <Skeleton style={{ height: hero ? 240 : 132 }} />
      <View className="gap-3 p-4">
        <Skeleton className="h-4 w-2/3 rounded-full" />
        <Skeleton className="h-3 w-1/2 rounded-full" delay={40} />
        <Skeleton className="h-[52px] w-full rounded-control" delay={80} />
      </View>
    </View>
  );
}
