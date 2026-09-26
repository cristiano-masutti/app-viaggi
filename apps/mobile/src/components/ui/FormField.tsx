import React, { useState } from 'react';
import { Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { palette } from '@/theme/palette';

interface Props {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  multiline?: boolean;
  /** Altezza minima per i campi multiriga (bio, note mediche). */
  minHeight?: number;
  /** Mostra il contatore caratteri in basso a destra. */
  counter?: boolean;
  className?: string;
}

/**
 * Campo di testo della modulistica.
 *
 * Il bordo passa ad arancione sul focus e resta grigio a riposo: è l'unico
 * segnale di stato del campo, senza label flottanti né animazioni che spostano
 * il testo mentre si scrive.
 */
export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  trailing,
  keyboardType,
  autoCapitalize = 'sentences',
  maxLength,
  multiline = false,
  minHeight,
  counter = false,
  className,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View className={`gap-1.5 ${className ?? ''}`}>
      {label ? (
        <Text className="text-[11px] font-extrabold uppercase tracking-[0.9px] text-bone/45">{label}</Text>
      ) : null}

      <View
        className={`flex-row gap-2.5 rounded-control border bg-ink-900 px-3.5 ${
          multiline ? 'py-3' : 'min-h-[54px] items-center py-2'
        } ${focused ? 'border-tangerine' : 'border-ink-700'}`}
      >
        {icon ? <View className={multiline ? 'pt-1' : undefined}>{icon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={minHeight ? { minHeight } : undefined}
          className="flex-1 p-0 text-[15px] font-bold leading-[21px] tracking-tight text-bone"
        />
        {trailing}
      </View>

      {counter && maxLength ? (
        <Text className="self-end text-[11px] font-bold text-bone/40">{`${value.length}/${maxLength}`}</Text>
      ) : null}
    </View>
  );
}
