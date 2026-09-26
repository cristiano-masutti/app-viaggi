import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { PressableScale } from '@/components/ui/PressableScale';
import { SmartImage } from '@/components/ui/SmartImage';
import { crewLabel, tripBadge, tripMeta } from '@/lib/trip';
import { shadow } from '@/theme/palette';
import type { Trip } from '@/types';

/**
 * Altezze fisse: la card occupa il suo spazio prima ancora che la cover sia
 * scaricata, quindi la lista non si riassesta a metà scroll.
 */
const HERO_COVER_HEIGHT = 236;
const STANDARD_COVER_HEIGHT = 132;

interface CardProps {
  trip: Trip;
  onPress: () => void;
}

/* ── Cover ───────────────────────────────────────────────────────────── */

function Cover({ trip, height, children }: { trip: Trip; height: number; children: React.ReactNode }) {
  return (
    <View style={{ height }} className="overflow-hidden bg-ink-800">
      <SmartImage
        uri={trip.cover}
        blurhash={trip.coverBlurhash}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
      {/* Gradiente dal basso: il testo bianco resta leggibile su qualunque foto. */}
      <LinearGradient
        colors={['rgba(13,13,17,0.15)', 'rgba(13,13,17,0.55)', 'rgba(13,13,17,0.96)']}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {children}
    </View>
  );
}

/* ── Card Hero · solo viaggio in corso ───────────────────────────────── */

/**
 * Card grande del viaggio live.
 *
 * Tutta la card è un solo bersaglio: il blocco `Entra nel Viaggio ➔` è
 * l'affordance visiva di quel tocco, non un secondo bottone. Un viaggio, un
 * modo di entrarci.
 */
export function HeroTripCard({ trip, onPress }: CardProps) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={`Entra nel viaggio ${trip.title}`}
      className="overflow-hidden rounded-hero border border-ink-700 bg-ink-900"
      style={shadow.card}
    >
      <Cover trip={trip} height={HERO_COVER_HEIGHT}>
        <View className="absolute left-4 top-4">
          <Badge label={tripBadge(trip)} tone="live" pulse />
        </View>
        <View className="absolute bottom-4 left-[18px] right-[18px] gap-1">
          <Text
            numberOfLines={2}
            className="text-[27px] font-extrabold leading-[32px] tracking-tight text-white"
          >
            {trip.title}
          </Text>
          <Text numberOfLines={1} className="text-[13px] font-semibold text-white/65">
            {`${trip.coordinator.name} • Coordinatore · ${trip.crew.length} compagni`}
          </Text>
        </View>
      </Cover>

      <View className="p-4">
        <View className="h-[56px] flex-row items-center justify-center gap-2 rounded-control bg-tangerine">
          <Text className="text-[16.5px] font-extrabold tracking-tight text-white">Entra nel Viaggio</Text>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.6} />
        </View>
      </View>
    </PressableScale>
  );
}

/* ── Card standard · futuri e passati, identiche ─────────────────────── */

/**
 * Card compatta, con lo stesso layout per i viaggi futuri e per quelli
 * conclusi: cambiano solo le etichette. Due tipi di card sarebbero due cose da
 * imparare per lo stesso oggetto.
 */
export function StandardTripCard({ trip, onPress }: CardProps) {
  const upcoming = trip.status === 'upcoming';

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={`Apri il viaggio ${trip.title}`}
      className="overflow-hidden rounded-card border border-ink-700 bg-ink-900"
    >
      <Cover trip={trip} height={STANDARD_COVER_HEIGHT}>
        <View className="absolute left-3.5 top-3">
          <Badge label={tripBadge(trip)} tone={upcoming ? 'accent' : 'neutral'} />
        </View>
        <View className="absolute bottom-3 left-4 right-4 gap-[3px]">
          <Text numberOfLines={1} className="text-[20px] font-extrabold tracking-tight text-white">
            {trip.title}
          </Text>
          <Text numberOfLines={1} className="text-[12.5px] font-semibold text-white/65">
            {tripMeta(trip)}
          </Text>
        </View>
      </Cover>

      <View className="gap-3 p-3.5">
        <View className="flex-row items-center gap-2.5">
          <AvatarStack members={trip.crew} />
          <Text numberOfLines={1} className="flex-1 text-[12.5px] font-semibold text-bone/60">
            {crewLabel(trip)}
          </Text>
        </View>

        <View className="flex-row items-center gap-2.5 rounded-[15px] border border-ink-700 bg-ink-850 px-3 py-2.5">
          <Avatar uri={trip.coordinator.avatar} name={trip.coordinator.name} size={26} />
          <Text numberOfLines={1} className="flex-1 text-[12.5px] font-bold text-bone">
            {`${trip.coordinator.name} • Coordinatore`}
          </Text>
          <ArrowRight size={16} color="rgba(244,242,237,0.35)" strokeWidth={2.2} />
        </View>
      </View>
    </PressableScale>
  );
}
