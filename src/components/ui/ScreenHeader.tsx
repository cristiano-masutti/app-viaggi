import { BlurView } from 'expo-blur';
import React from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  title: string;
  /** Riga sotto il titolo: cambia con il contesto, non con la navigazione. */
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Offset verticale della lista sottostante: accende la sfocatura mentre si scorre. */
  scrollY?: SharedValue<number>;
  /** La schermata usa l'altezza misurata come padding-top del contenuto. */
  onHeight?: (height: number) => void;
  compact?: boolean;
  /** Sfocatura sempre accesa: per gli header che stanno stabilmente sopra il contenuto. */
  pinned?: boolean;
  /** Controlli che restano fissi sotto il titolo (es. lo switcher segmentato). */
  children?: React.ReactNode;
}

/** Oltre questa distanza l'header è completamente opaco. */
const FADE_DISTANCE = 56;

/**
 * Header flottante.
 *
 * A riposo è trasparente e il contenuto gli scorre sotto; appena la lista si
 * muove entra una sfocatura hardware (`expo-blur`) con una linea sottile, così
 * il titolo resta leggibile sopra qualsiasi foto senza mai coprire l'app con una
 * barra piena. Opacità e non `intensity`: è una proprietà che il compositor
 * anima da solo, senza passare dal JS.
 */
export function ScreenHeader({
  title,
  subtitle,
  left,
  right,
  scrollY,
  onHeight,
  compact = false,
  pinned = false,
  children,
}: Props) {
  const insets = useSafeAreaInsets();

  const veil = useAnimatedStyle(() => {
    if (pinned) return { opacity: 1 };
    return {
      opacity: scrollY ? interpolate(scrollY.value, [0, FADE_DISTANCE], [0, 1], Extrapolation.CLAMP) : 0,
    };
  });

  return (
    <View
      pointerEvents="box-none"
      onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}
      style={{ paddingTop: insets.top + (compact ? 4 : 10) }}
      className="absolute left-0 right-0 top-0 z-20"
    >
      <Animated.View pointerEvents="none" style={veil} className="absolute inset-0">
        <BlurView intensity={48} tint="dark" className="flex-1" />
        <View className="absolute inset-0 bg-ink-950/55" />
        <View className="absolute bottom-0 left-0 right-0 h-px bg-ink-700" />
      </Animated.View>

      <View className={`flex-row items-center gap-3 px-5 ${compact ? 'pb-3' : 'pb-4'}`}>
        {left}
        <View className="flex-1">
          <Text
            numberOfLines={1}
            className={`font-extrabold tracking-tight text-bone ${compact ? 'text-[19px]' : 'text-[25px]'}`}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} className="mt-[3px] text-[13px] font-semibold text-mist">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>

      {children ? <View className="px-5 pb-3">{children}</View> : null}
    </View>
  );
}

/** Tondo scuro per le icone dell'header (indietro, notifiche). */
export function HeaderIconButton({ children }: { children: React.ReactNode }) {
  return (
    <View className="h-[42px] w-[42px] items-center justify-center rounded-[15px] border border-ink-700 bg-ink-900">
      {children}
    </View>
  );
}
