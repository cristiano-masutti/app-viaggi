import { FlashList } from '@shopify/flash-list';
import { Bell } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { HeroTripCard, StandardTripCard } from '@/components/trips/TripCards';
import { DashedPlaceholder } from '@/components/ui/DashedPlaceholder';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedSwitcher, type SegmentOption } from '@/components/ui/SegmentedSwitcher';
import { TripCardSkeleton } from '@/components/ui/Skeleton';
import { useHeaderScroll } from '@/lib/useHeaderScroll';
import { HUB_SUBTITLES, TRIP_TAB_LABELS } from '@/lib/trip';
import { TAB_BAR_SPACE } from '@/navigation/FloatingTabBar';
import type { MainTabScreenProps } from '@/navigation/types';
import { useAppState, useProfile, useTripsByStatus } from '@/store/AppStore';
import { palette } from '@/theme/palette';
import type { Trip, TripStatus } from '@/types';

/** Finto primo caricamento: mostra gli skeleton al posto degli spinner. */
const BOOT_DELAY_MS = 550;

/**
 * Hub "I Miei Viaggi".
 *
 * L'header è solo informativo: saluto fisso, sottotitolo che segue il tab
 * attivo e la sola icona delle notifiche. Nessun avatar, nessuna scorciatoia al
 * profilo — quello vive solo nella bottom bar.
 */
export function MyTripsScreen({ navigation }: MainTabScreenProps<'MyTrips'>) {
  const profile = useProfile();
  const { trips: allTrips } = useAppState();
  const [tab, setTab] = useState<TripStatus>('ongoing');
  const [headerHeight, setHeaderHeight] = useState(180);
  const [booting, setBooting] = useState(true);
  const { scrollY, scrollComponent } = useHeaderScroll();

  const trips = useTripsByStatus(tab);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), BOOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const tabs = useMemo<SegmentOption<TripStatus>[]>(() => {
    const counts = {
      ongoing: allTrips.filter((trip) => trip.status === 'ongoing').length,
      upcoming: allTrips.filter((trip) => trip.status === 'upcoming').length,
      past: allTrips.filter((trip) => trip.status === 'past').length,
    };
    return [
      { key: 'ongoing', label: TRIP_TAB_LABELS.ongoing, dot: counts.ongoing > 0 },
      { key: 'upcoming', label: TRIP_TAB_LABELS.upcoming, badge: counts.upcoming },
      { key: 'past', label: TRIP_TAB_LABELS.past },
    ];
  }, [allTrips]);

  const openTrip = useCallback(
    (tripId: string) => navigation.navigate('TripDetail', { tripId }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Trip }) =>
      item.status === 'ongoing' ? (
        <HeroTripCard trip={item} onPress={() => openTrip(item.id)} />
      ) : (
        <StandardTripCard trip={item} onPress={() => openTrip(item.id)} />
      ),
    [openTrip],
  );

  return (
    <View className="flex-1 bg-ink-950">
      <ScreenHeader
        title={`Ciao ${profile.firstName} 👋`}
        subtitle={HUB_SUBTITLES[tab]}
        scrollY={scrollY}
        onHeight={setHeaderHeight}
        right={
          <Pressable
            accessibilityLabel="Notifiche"
            onPress={() => {
              /* TODO: centro notifiche */
            }}
          >
            <HeaderIconButton>
              <Bell size={19} color={palette.text} strokeWidth={1.9} />
              <View className="absolute right-[11px] top-[10px] h-2 w-2 rounded-full border-[1.5px] border-ink-900 bg-tangerine" />
            </HeaderIconButton>
          </Pressable>
        }
      >
        <SegmentedSwitcher options={tabs} value={tab} onChange={setTab} tone="light" />
      </ScreenHeader>

      {booting ? (
        <View style={{ paddingTop: headerHeight + 16 }} className="gap-3.5 px-5">
          <TripCardSkeleton hero />
          <TripCardSkeleton />
        </View>
      ) : (
        <FlashList
          data={trips}
          // La chiave di tipo tiene separati i pool di riciclo: una cella Hero non
          // viene mai riusata come card compatta (e viceversa).
          getItemType={(item) => item.status}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderScrollComponent={scrollComponent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: headerHeight + 16,
            paddingBottom: TAB_BAR_SPACE + 16,
            paddingHorizontal: 20,
          }}
          ItemSeparatorComponent={() => <View className="h-3.5" />}
          ListEmptyComponent={<EmptyTrips tab={tab} />}
          ListFooterComponent={
            // Unico punto d'ingresso alla creazione, e solo tra i viaggi futuri.
            tab === 'upcoming' ? (
              <DashedPlaceholder
                emoji="🗺️"
                title="Pianifica Nuovo Viaggio"
                hint="Date, coordinatore e prima crew"
                className="mt-3.5"
                onPress={() => navigation.navigate('CreateTrip')}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

/** Stato vuoto per segmento: dice cosa manca, non solo che non c'è niente. */
function EmptyTrips({ tab }: { tab: TripStatus }) {
  const copy: Record<TripStatus, { title: string; hint: string }> = {
    ongoing: {
      title: 'Nessun viaggio in corso',
      hint: 'Quando si parte, il viaggio compare qui con il countdown dei giorni.',
    },
    upcoming: {
      title: 'Nessun viaggio in programma',
      hint: 'Pianificane uno qui sotto: bastano destinazione e date.',
    },
    past: {
      title: 'Nessun viaggio concluso',
      hint: 'Le foto e le note dei viaggi finiti restano qui per sempre.',
    },
  };

  return (
    <View className="items-center gap-2 rounded-card border border-dashed border-ink-700 px-5 py-10">
      <Text className="text-[15px] font-extrabold tracking-tight text-bone">{copy[tab].title}</Text>
      <Text className="text-center text-[12.5px] font-semibold leading-[18px] text-mist">
        {copy[tab].hint}
      </Text>
    </View>
  );
}
