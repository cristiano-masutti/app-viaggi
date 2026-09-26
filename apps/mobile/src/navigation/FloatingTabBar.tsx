import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Backpack, User } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainTabParamList } from '@/navigation/types';
import { palette } from '@/theme/palette';

/** Spazio che le schermate devono lasciare in fondo perché la barra non copra il contenuto. */
export const TAB_BAR_SPACE = 104;

const FALLBACK_BOTTOM_PADDING = 14;
const EMPTY_BAR_BORDER = '#262633';
const EMPTY_BAR_COLOR = 'rgba(22,22,29,0.45)';

const LABELS: Record<keyof MainTabParamList, string> = {
  MyTrips: 'I Miei Viaggi',
  Profile: 'Profilo',
};

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outer,
        { paddingBottom: insets.bottom > 0 ? insets.bottom : FALLBACK_BOTTOM_PADDING },
      ]}
    >
      <View style={styles.bar}>
        <BlurView intensity={34} tint="dark" style={styles.absoluteFill} />
        <View pointerEvents="none" style={styles.glassTint} />
        <View pointerEvents="none" style={styles.glassEdge} />

        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const name = route.name as keyof MainTabParamList;
          const Icon = name === 'Profile' ? User : Backpack;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={LABELS[name] ?? route.name}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.half}
            >
              <Icon size={24} color={focused ? palette.accent : '#F4F2ED'} strokeWidth={2.2} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 60,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: EMPTY_BAR_BORDER,
    backgroundColor: EMPTY_BAR_COLOR,
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  glassTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(13,13,17,0.34)',
  },
  glassEdge: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
