import { Plus } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { palette } from '@/theme/palette';

interface Props {
  /** Emoji che dice di cosa si tratta: 🏨 alloggio, 🎟️ biglietto, 🚐 trasporto… */
  emoji?: string;
  title: string;
  /** Riga di aiuto: cosa verrà chiesto una volta toccato. */
  hint?: string;
  onPress: () => void;
  /** `inline` per il tasto sottile in fondo a una lista, `block` per lo stato vuoto pieno. */
  variant?: 'block' | 'inline';
  className?: string;
}

/**
 * Stato vuoto interattivo.
 *
 * Un dato mancante non è mai un buco muto: è un invito tratteggiato che apre la
 * stessa modale di editing della matita. Così "aggiungi" e "modifica" portano
 * allo stesso posto e la funzione resta una sola.
 */
export function DashedPlaceholder({ emoji, title, hint, onPress, variant = 'block', className }: Props) {
  if (variant === 'inline') {
    return (
      <Pressable
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={title}
        className={`h-[50px] w-full flex-row items-center justify-center gap-2 rounded-[17px] border border-dashed border-tangerine/45 bg-tangerine/10 ${
          className ?? ''
        }`}
      >
        <Plus size={16} color={palette.accent} strokeWidth={2.5} />
        <Text numberOfLines={1} className="text-[13.5px] font-extrabold tracking-tight text-tangerine">
          {title}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={`items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink-700 bg-ink-900/50 px-5 py-6 ${
        className ?? ''
      }`}
    >
      <View className="flex-row items-center gap-2">
        {emoji ? <Text className="text-[15px]">{emoji}</Text> : null}
        <Plus size={15} color={palette.accent} strokeWidth={2.6} />
        <Text className="flex-shrink text-center text-[14.5px] font-extrabold tracking-tight text-bone">
          {title}
        </Text>
      </View>
      {hint ? <Text className="text-center text-[12px] font-semibold text-mist">{hint}</Text> : null}
    </Pressable>
  );
}
