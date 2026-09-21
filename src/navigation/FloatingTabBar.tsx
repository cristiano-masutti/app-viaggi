import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Backpack, User, type LucideIcon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { slideSpring } from '@/theme/motion';
import { palette, shadow, textAlpha } from '@/theme/palette';
import type { MainTabParamList } from '@/navigation/types';

/** Spazio che le schermate devono lasciare in fondo perché la barra non copra il contenuto. */
export const TAB_BAR_SPACE = 104;

/** Padding interno della barra: l'indicatore si muove dentro questo margine. */
const INSET = 7;

const ICONS: Record<keyof MainTabParamList, LucideIcon> = {
  MyTrips: Backpack,
  Profile: User,
};

const LABELS: Record<keyof MainTabParamList, string> = {
  MyTrips: 'I Miei Viaggi',
  Profile: 'Profilo',
};

/**
 * Bottom bar flottante.
 *
 * Due sole voci: "I Miei Viaggi" e "Profilo". Il tab Profilo è l'unico accesso
 * all'area personale — non esiste nessun avatar cliccabile negli header, così
 * non ci sono due strade per la stessa destinazione.
 *
 * Il fondo è sfocato via hardware (`expo-blur`): il contenuto scorre sotto e si
 * intravede, invece di sparire dietro una barra piena.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const highlight = useSharedValue(state.index);

  useEffect(() => {
    highlight.value = withSpring(state.index, slideSpring);
  }, [highlight, state.index]);

  // Larghezza misurata invece di percentuali: l'interpolazione resta in pixel
  // e il pill non "respira" di mezzo punto a ogni cambio tab.
  const slotWidth = width > 0 ? (width - INSET * 2) / state.routes.length : 0;

  const indicator = useAnimatedStyle(() => ({
    width: slotWidth,
    transform: [{ translateX: highlight.value * slotWidth }],
  }));

  return (
    <View
      style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 14 }}
      className="absolute bottom-0 left-0 right-0 px-5 pt-2"
      pointerEvents="box-none"
    >
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        className="overflow-hidden rounded-[26px] border border-ink-700"
        style={shadow.floating}
      >
        <BlurView
          intensity={42}
          tint="dark"
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />
        <View className="bg-ink-900/88 absolute h-full w-full" />

        <View className="flex-row p-[7px]">
          {slotWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={indicator}
              className="absolute bottom-[7px] left-[7px] top-[7px] rounded-[19px] bg-tangerine/15"
            />
          ) : null}

          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const name = route.name as keyof MainTabParamList;
            const Icon = ICONS[name] ?? User;

            return (
              <PressableScale
                key={route.key}
                haptic="select"
                scaleTo={0.94}
                accessibilityRole="tab"
                accessibilityLabel={LABELS[name]}
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                className="min-h-[58px] flex-1 items-center justify-center gap-1.5 py-2.5"
              >
                <Icon
                  size={22}
                  color={focused ? palette.accent : textAlpha.off}
                  strokeWidth={focused ? 2.2 : 1.8}
                />
                <Text
                  className="text-[10.5px] font-extrabold"
                  style={{ color: focused ? palette.accent : textAlpha.off }}
                >
                  {LABELS[name]}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </View>
  );
}
