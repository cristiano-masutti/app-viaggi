import { Pencil } from 'lucide-react-native';
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from './PressableScale';

interface CardProps {
  children: React.ReactNode;
  /** Se passato compare la matita in alto a destra: è il punto d'ingresso al live editing. */
  onEdit?: () => void;
  editLabel?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Superficie standard: Deep Slate, bordo sottile, angoli morbidi.
 *
 * La matita è l'unico modo di modificare il contenuto di una card già piena —
 * niente menù contestuali, niente swipe nascosti, niente doppioni.
 */
export function Card({ children, onEdit, editLabel = 'Modifica', className, style }: CardProps) {
  return (
    <View
      className={`gap-3 rounded-card border border-ink-700 bg-ink-900 p-[17px] ${className ?? ''}`}
      style={style}
    >
      {onEdit ? (
        <PressableScale
          onPress={onEdit}
          scaleTo={0.9}
          accessibilityLabel={editLabel}
          hitSlop={10}
          className="absolute right-3 top-3 z-10 h-8 w-8 items-center justify-center rounded-[11px] border border-ink-700 bg-ink-850"
        >
          <Pencil size={14} color="#94A3B8" strokeWidth={2} />
        </PressableScale>
      ) : null}
      {children}
    </View>
  );
}

interface CardRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** Lascia spazio alla matita in alto a destra. */
  inset?: boolean;
}

export function CardRow({ icon, title, subtitle, inset = false }: CardRowProps) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-[38px] w-[38px] items-center justify-center rounded-xl border border-ink-700 bg-ink-850">
        {icon}
      </View>
      <View className={`flex-1 gap-0.5 ${inset ? 'pr-9' : ''}`}>
        <Text numberOfLines={1} className="text-[15px] font-extrabold tracking-tight text-bone">
          {title}
        </Text>
        <Text numberOfLines={2} className="text-[12px] font-semibold text-bone/45">
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

/** Etichetta di sezione: maiuscoletto spaziato, mai un titolo grande. */
export function SectionLabel({ children, accent = false }: { children: string; accent?: boolean }) {
  return (
    <Text
      className={`text-[11px] font-extrabold uppercase tracking-[1.2px] ${
        accent ? 'text-tangerine-soft' : 'text-bone/45'
      }`}
    >
      {children}
    </Text>
  );
}

/** Intestazione di sezione con un dettaglio allineato a destra. */
export function SectionHeader({ title, hint, accent }: { title: string; hint?: string; accent?: boolean }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <SectionLabel accent={accent}>{title}</SectionLabel>
      {hint ? <Text className="text-[11.5px] font-bold text-bone/40">{hint}</Text> : null}
    </View>
  );
}
