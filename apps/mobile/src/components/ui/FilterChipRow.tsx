import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Avatar } from './Avatar';
import { PressableScale } from './PressableScale';

export interface FilterChip {
  key: string;
  label: string;
  /** Avatar del compagno: la riga "Crew" mostra le facce, non solo i nomi. */
  avatar?: string;
  /** Usato come iniziale quando l'avatar non c'è. */
  avatarName?: string;
}

interface Props {
  chips: FilterChip[];
  value: string;
  onChange: (key: string) => void;
  /** Etichetta letta dagli screen reader per la riga intera. */
  accessibilityLabel: string;
  contentClassName?: string;
}

/**
 * Riga di filtri orizzontale.
 *
 * Due righe di queste si combinano nella tab Memorie (tappa × crew): sono
 * filtri, non navigazione, quindi restano sempre visibili e il feedback è una
 * `selectionAsync` leggera — non l'impatto dei bottoni primari.
 */
export function FilterChipRow({ chips, value, onChange, accessibilityLabel, contentClassName }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      // Il tocco su un chip non deve aspettare la fine dell'inerzia dello scroll.
      keyboardShouldPersistTaps="handled"
      contentContainerClassName={`gap-2 pr-4 ${contentClassName ?? ''}`}
    >
      {chips.map((chip) => {
        const active = chip.key === value;
        return (
          <PressableScale
            key={chip.key}
            haptic="select"
            scaleTo={0.94}
            accessibilityLabel={chip.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(chip.key)}
            className={`h-[38px] flex-row items-center gap-2 rounded-chip border px-3.5 ${
              active ? 'border-tangerine bg-tangerine' : 'border-ink-700 bg-ink-900'
            }`}
          >
            {chip.avatar || chip.avatarName ? (
              <View className={active ? 'opacity-100' : 'opacity-80'}>
                <Avatar uri={chip.avatar} name={chip.avatarName ?? chip.label} size={22} />
              </View>
            ) : null}
            <Text
              numberOfLines={1}
              className={`text-[13px] ${active ? 'font-extrabold text-white' : 'font-bold text-bone/60'}`}
            >
              {chip.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}
