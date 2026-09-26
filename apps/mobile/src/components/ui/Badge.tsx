import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Tone = 'live' | 'accent' | 'neutral' | 'cream';

const TONE_STYLES: Record<Tone, { container: string; text: string }> = {
  live: { container: 'border-live/45 bg-live/15', text: 'text-live' },
  accent: { container: 'border-tangerine/45 bg-tangerine/18', text: 'text-tangerine-tint' },
  neutral: { container: 'border-ink-700 bg-ink-900/80', text: 'text-bone/75' },
  cream: { container: 'border-cream-line bg-cream', text: 'text-cream-ink' },
};

interface BadgeProps {
  label: string;
  tone?: Tone;
  /** Pallino pulsante a sinistra: si usa solo per il viaggio in corso. */
  pulse?: boolean;
  className?: string;
}

/** Pillola di stato: `🟢 LIVE • Giorno 3 di 10`, `⏳ Mancano 18 giorni`, `🎒 Concluso`. */
export function Badge({ label, tone = 'neutral', pulse = false, className }: BadgeProps) {
  const styles = TONE_STYLES[tone];

  return (
    <View
      className={`flex-row items-center gap-2 self-start rounded-chip border px-3 py-[7px] ${styles.container} ${
        className ?? ''
      }`}
    >
      {pulse ? <PulseDot /> : null}
      <Text numberOfLines={1} className={`text-[11px] font-extrabold tracking-wide ${styles.text}`}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Il respiro del pallino LIVE.
 * Un solo elemento animato in tutta la schermata: se pulsasse ogni cosa non
 * pulserebbe niente.
 */
function PulseDot() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.45, { duration: 720, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 720, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 2.1 - scale.value,
  }));

  return (
    <View className="h-[7px] w-[7px] items-center justify-center">
      <Animated.View className="absolute h-[7px] w-[7px] rounded-full bg-live" style={style} />
      <View className="h-[7px] w-[7px] rounded-full bg-live" />
    </View>
  );
}
