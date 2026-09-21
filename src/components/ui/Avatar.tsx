import React from 'react';
import { Text, View } from 'react-native';

import type { CrewMember } from '@/types';

import { SmartImage } from './SmartImage';

interface AvatarProps {
  uri?: string;
  /** Iniziale mostrata quando non c'è foto. */
  name: string;
  size?: number;
  /** Anello del colore del fondo: serve a staccare gli avatar sovrapposti. */
  ring?: boolean;
  className?: string;
}

export function Avatar({ uri, name, size = 34, ring = false, className }: AvatarProps) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className={`items-center justify-center overflow-hidden bg-ink-800 ${
        ring ? 'border-2 border-ink-950' : ''
      } ${className ?? ''}`}
    >
      {uri ? (
        <SmartImage uri={uri} tone="portrait" style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text style={{ fontSize: size * 0.36 }} className="font-extrabold text-bone/75">
          {name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

interface AvatarStackProps {
  members: CrewMember[];
  /** Oltre questo numero compare la pillola "+N". */
  max?: number;
  size?: number;
}

/** Fila di avatar sovrapposti: quanta gente viene, in un colpo d'occhio. */
export function AvatarStack({ members, max = 4, size = 34 }: AvatarStackProps) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;

  return (
    <View className="flex-row items-center">
      {shown.map((member, index) => (
        <View key={member.id} style={{ marginLeft: index === 0 ? 0 : -10, zIndex: max - index }}>
          <Avatar uri={member.avatar} name={member.name} size={size} ring />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={{ width: size, height: size, borderRadius: size / 2, marginLeft: -10 }}
          className="items-center justify-center border-2 border-ink-950 bg-tangerine/20"
        >
          <Text className="text-[11px] font-extrabold text-tangerine-tint">+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}
