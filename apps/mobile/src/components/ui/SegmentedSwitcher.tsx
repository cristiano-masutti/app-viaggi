import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { slideSpring } from '@/theme/motion';
import { palette } from '@/theme/palette';


export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  /** Pallino verde: c'è qualcosa di vivo in quel segmento. */
  dot?: boolean;
  /** Contatore a destra dell'etichetta. */
  badge?: number;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
  /** `accent` riempie l'indicatore di arancione, `light` di bianco caldo. */
  tone?: 'accent' | 'light';
  className?: string;
}

const INSET = 5;

/**
 * Switcher segmentato.
 *
 * L'indicatore è un solo elemento che scivola: non ci sono N sfondi che
 * appaiono e scompaiono. La molla gira su UI thread, quindi il movimento resta
 * fluido anche mentre il cambio di tab ricostruisce la lista sotto.
 */
export function SegmentedSwitcher<T extends string>({
  options,
  value,
  onChange,
  tone = 'accent',
  className,
}: Props<T>) {
  const [width, setWidth] = useState(0);
  const segmentCount = Math.max(1, options.length);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  );
  const progress = useSharedValue(activeIndex);

  useEffect(() => {
    progress.value = withSpring(activeIndex, slideSpring);
  }, [activeIndex, progress]);

  const segmentWidth = width > 0 ? (width - INSET * 2) / segmentCount : 0;

  const indicator = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: progress.value * segmentWidth }],
  }));

  const activeColor = tone === 'accent' ? '#FFFFFF' : palette.background;
  const indicatorColor = tone === 'accent' ? palette.accent : palette.text;

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className={`flex-row rounded-control border border-ink-700 bg-ink-900 p-[5px] ${className ?? ''}`}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          className="absolute rounded-[14px]"
          style={[{ left: INSET, top: INSET, bottom: INSET, backgroundColor: indicatorColor }, indicator]}
        />
      ) : null}

      {options.map((option, index) => (
        <Pressable
          key={option.key}
          accessibilityRole="tab"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: option.key === value }}
          onPress={() => {
            haptics.select();
            if (option.key !== value) onChange(option.key);
          }}
          className="h-11 flex-row items-center justify-center gap-[6px] overflow-hidden px-1"
          style={segmentWidth > 0 ? { width: segmentWidth } : { flex: 1 }}
        >
          <SegmentLabel label={option.label} index={index} progress={progress} activeColor={activeColor} />
          {option.dot ? <View className="h-[7px] w-[7px] rounded-full bg-live" /> : null}
          {option.badge ? (
            <View className="h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white/10 px-1">
              <Animated.Text className="text-[10.5px] font-extrabold text-bone/70">
                {option.badge}
              </Animated.Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/**
 * L'etichetta cambia colore seguendo la stessa molla dell'indicatore: quando il
 * pill è a metà strada, anche i due testi sono a metà. Senza questo la scritta
 * "salta" al nuovo colore prima che lo sfondo l'abbia raggiunta.
 */
function SegmentLabel({
  label,
  index,
  progress,
  activeColor,
}: {
  label: string;
  index: number;
  progress: SharedValue<number>;
  activeColor: string;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(progress.value - index));
    return {
      color: interpolateColor(distance, [0, 1], [activeColor, 'rgba(244,242,237,0.55)']),
    };
  });

  return (
    <Animated.Text
      numberOfLines={1}
      allowFontScaling={false}
      adjustsFontSizeToFit
      minimumFontScale={0.82}
      className="max-w-full shrink text-center text-[13px] font-extrabold leading-[16px]"
      style={style}
    >
      {label}
    </Animated.Text>
  );
}
