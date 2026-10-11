import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Bell } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { HeroTripCard, StandardTripCard } from '@/components/trips/TripCards';
import { DashedPlaceholder } from '@/components/ui/DashedPlaceholder';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { TripCardSkeleton } from '@/components/ui/Skeleton';
import { useHeaderScroll } from '@/lib/useHeaderScroll';
import { useScreenReady } from '@/telemetry/useScreenReady';
import { HUB_SUBTITLES } from '@/lib/trip';
import { TAB_BAR_SPACE } from '@/navigation/FloatingTabBar';
import type { MainTabScreenProps } from '@/navigation/types';
import { useAppActions, useAppState, useProfile, useTripsByStatus } from '@/store/AppStore';
import { palette } from '@/theme/palette';
import type { Trip, TripStatus } from '@/types';

/** Prototipo: finto primo caricamento, per vedere gli skeleton al posto degli spinner. */
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
  const [tab, setTab] = useState<TripStatus>('ongoing');
  const [headerHeight, setHeaderHeight] = useState(180);
  const { scrollY, scrollComponent } = useHeaderScroll();
  const remote = useAuth().mode === 'remote';
  const { tripsStatus } = useAppState();
  const { refreshTrips } = useAppActions();

  const trips = useTripsByStatus(tab);

  const [mockBooting, setMockBooting] = useState(!remote);
  useEffect(() => {
    if (remote) return;
    const timer = setTimeout(() => setMockBooting(false), BOOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [remote]);
  const booting = remote ? tripsStatus === 'idle' || tripsStatus === 'loading' : mockBooting;
  useScreenReady('MyTrips', !booting);

  // Al ritorno sull'hub (da un viaggio, dal profilo) le card si riallineano al
  // server: nuovi compagni, ricordi degli altri. Il primo ingresso no, lo fa il login.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (remote) void refreshTrips();
    }, [refreshTrips, remote]),
  );

  const [pulling, setPulling] = useState(false);
  const pullToRefresh = useCallback(async () => {
    setPulling(true);
    await refreshTrips();
    setPulling(false);
  }, [refreshTrips]);

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
            accessibilityRole="button"
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
        <TripsStatusTabs value={tab} onChange={setTab} />
      </ScreenHeader>

      {booting ? (
        <View style={{ paddingTop: headerHeight + 16 }} className="gap-3.5 px-5">
          <TripCardSkeleton hero />
          <TripCardSkeleton />
        </View>
      ) : remote && tripsStatus === 'error' ? (
        <View style={{ paddingTop: headerHeight + 16 }} className="px-5">
          <LoadError onRetry={() => void refreshTrips()} />
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
          // Trascinare in giù riallinea le card al server (solo con il backend reale).
          refreshing={pulling}
          onRefresh={remote ? () => void pullToRefresh() : undefined}
          progressViewOffset={headerHeight}
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

function TripsStatusTabs({
  value,
  onChange,
}: {
  value: TripStatus;
  onChange: (tab: TripStatus) => void;
}) {
  const items: Array<{ key: TripStatus; accessibilityLabel: string; label: string }> = [
    { key: 'ongoing', accessibilityLabel: 'Viaggio in Corso', label: "Viaggio\nin Corso" },
    { key: 'upcoming', accessibilityLabel: 'Viaggi Futuri', label: "Viaggi\nFuturi" },
    { key: 'past', accessibilityLabel: 'Viaggi Passati', label: "Viaggi\nPassati" },
  ];

  return (
    <View
      accessibilityRole="tablist"
      className="h-[54px] flex-row overflow-hidden rounded-control border border-ink-700 bg-ink-900"
    >
      {items.map((item) => {
        const active = value === item.key;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.accessibilityLabel}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            className="flex-1 items-center justify-center px-2"
          >
            <View
              className="rounded-[12px] px-3 py-1.5"
              style={active ? { backgroundColor: palette.accent } : undefined}
            >
              <Text
                numberOfLines={2}
                allowFontScaling={false}
                className="text-center text-[12px] font-extrabold leading-[14px]"
                style={{ color: active ? '#FFFFFF' : 'rgba(244,242,237,0.82)' }}
              >
                {item.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Il primo caricamento non è riuscito (rete, server giù): si può riprovare. */
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="items-center gap-3 rounded-card border border-dashed border-ink-700 px-5 py-10">
      <Text className="text-[15px] font-extrabold tracking-tight text-bone">Viaggi non caricati</Text>
      <Text className="text-center text-[12.5px] font-semibold leading-[18px] text-mist">
        Controlla la connessione e riprova.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Riprova a caricare i viaggi"
        className="mt-1 h-[42px] items-center justify-center rounded-[14px] bg-tangerine px-5"
      >
        <Text className="text-[13.5px] font-extrabold tracking-tight text-white">Riprova</Text>
      </Pressable>
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
