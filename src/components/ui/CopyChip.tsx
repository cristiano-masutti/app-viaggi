import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

import { palette } from '@/theme/palette';

import { PressableScale } from './PressableScale';

interface Props {
  /** Testo che finisce negli appunti (indirizzo, codice fiscale, link di invito…). */
  value: string;
  /** Etichetta a riposo. Diventa "Copiato" per un attimo dopo il tocco. */
  label?: string;
  className?: string;
}

/**
 * Copia con conferma a vista.
 *
 * Il chip resta verde ~1,6 s: è l'unico riscontro che serve, meglio di un toast
 * che copre il contenuto che l'utente sta guardando.
 */
export function CopyChip({ value, label = 'Copia', className }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }, [value]);

  return (
    <PressableScale
      haptic="confirm"
      scaleTo={0.93}
      accessibilityLabel={`Copia ${value}`}
      onPress={() => {
        void copy();
      }}
      className={`h-10 flex-row items-center gap-1.5 rounded-[13px] border px-3.5 ${
        copied ? 'border-success/40 bg-success/15' : 'border-ink-700 bg-ink-850'
      } ${className ?? ''}`}
    >
      {copied ? (
        <Check size={14} color={palette.success} strokeWidth={2.4} />
      ) : (
        <Copy size={14} color={palette.text} strokeWidth={2} />
      )}
      <Text className={`text-[12.5px] font-extrabold ${copied ? 'text-success' : 'text-bone'}`}>
        {copied ? 'Copiato' : label}
      </Text>
    </PressableScale>
  );
}
