import { FlashList } from '@shopify/flash-list';
import { Bell } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ScrollViewProps,
} from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { HeroTripCard, StandardTripCard } from '@/components/trips/TripCards';
import { DashedPlaceholder } from '@/components/ui/DashedPlaceholder';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { TripCardSkeleton } from '@/components/ui/Skeleton';
import { haptics } from '@/lib/haptics';
import { useHeaderScroll } from '@/lib/useHeaderScroll';
import { HUB_SUBTITLES } from '@/lib/trip';
import { TAB_BAR_SPACE } from '@/navigation/FloatingTabBar';
import type { MainTabScreenProps } from '@/navigation/types';
import { useProfile, useTripsByStatus } from '@/store/AppStore';
import { palette } from '@/theme/palette';
import type { Trip, TripStatus } from '@/types';

/** Finto primo caricamento: mostra gli skeleton al posto degli spinner. */
const BOOT_DELAY_MS = 550;

/** Ordine delle pagine, da sinistra a destra: è anche l'ordine dei tab. */
const STATUSES: TripStatus[] = ['ongoing', 'upcoming', 'past'];
const LAST_PAGE = STATUSES.length - 1;
/** Quanto la pagina che esce resta indietro rispetto al dito (0 = nessuna parallasse). */
const PARALLAX = 0.7;

/**
 * Hub "I Miei Viaggi".
 *
 * L'header è solo informativo: saluto fisso, sottotitolo che segue il tab
 * attivo e la sola icona delle notifiche. Nessun avatar, nessuna scorciatoia al
 * profilo — quello vive solo nella bottom bar.
 *
 * Sotto, i tre segmenti sono pagine affiancate di un pager orizzontale: si
 * passa dall'una all'altra col dito o toccando il tab. Tutto segue un solo
 * valore continuo, `progress` (0 = in corso, 1 = futuri, 2 = passati), letto
 * sull'UI thread: l'indicatore del tab, la profondità delle pagine e la
 * sfocatura dell'header si muovono insieme al dito, senza aspettare React.
 */
export function MyTripsScreen({ navigation }: MainTabScreenProps<'MyTrips'>) {
  const profile = useProfile();
  const screen = useWindowDimensions();
  const [tab, setTab] = useState<TripStatus>('ongoing');
  const [headerHeight, setHeaderHeight] = useState(180);
  const [booting, setBooting] = useState(true);
  const [pagerSize, setPagerSize] = useState({ width: screen.width, height: screen.height });

  // Una lista per pagina, ognuna col proprio offset: tornando su un tab lo
  // scroll è dove lo si era lasciato.
  const ongoingScroll = useHeaderScroll();
  const upcomingScroll = useHeaderScroll();
  const pastScroll = useHeaderScroll();
  const pageScrolls = [ongoingScroll, upcomingScroll, pastScroll];

  const pagerRef = useRef<Animated.ScrollView>(null);
  const pageWidth = useSharedValue(pagerSize.width);
  const progress = useSharedValue(0);
  /** Pagina verso cui sta andando uno scroll avviato da un tap; -1 se nessuno. */
  const jumpTarget = useSharedValue(-1);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), BOOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const settleOn = useCallback((index: number) => setTab(STATUSES[index]), []);

  const pagerScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (pageWidth.value > 0) progress.value = event.contentOffset.x / pageWidth.value;
    },
    onBeginDrag: () => {
      // Il dito ha la precedenza su un salto ancora in volo.
      jumpTarget.value = -1;
    },
    onMomentumEnd: () => {
      jumpTarget.value = -1;
      runOnJS(settleOn)(Math.min(Math.max(Math.round(progress.value), 0), LAST_PAGE));
    },
  });

  // Il tab attivo cambia appena la pagina supera la metà, non a scroll finito:
  // il sottotitolo segue il dito. Durante un salto da tap (es. da "In corso" a
  // "Passati") le pagine attraversate non contano, altrimenti il sottotitolo
  // lampeggerebbe su "Futuri" per un istante.
  useAnimatedReaction(
    () => Math.min(Math.max(Math.round(progress.value), 0), LAST_PAGE),
    (index, previous) => {
      if (previous === null || index === previous) return;
      if (jumpTarget.value !== -1) {
        if (index === jumpTarget.value) jumpTarget.value = -1;
        return;
      }
      runOnJS(settleOn)(index);
    },
  );

  // L'header sfuma tra gli offset delle due pagine a cavallo: passando da una
  // lista scrollata a una in cima, il velo si spegne mentre si scorre.
  const ongoingY = ongoingScroll.scrollY;
  const upcomingY = upcomingScroll.scrollY;
  const pastY = pastScroll.scrollY;
  const headerScrollY = useDerivedValue(() => {
    const offsets = [ongoingY.value, upcomingY.value, pastY.value];
    const position = Math.min(Math.max(progress.value, 0), LAST_PAGE);
    const from = Math.floor(position);
    const to = Math.min(from + 1, LAST_PAGE);
    return offsets[from] + (offsets[to] - offsets[from]) * (position - from);
  });

  const goTo = useCallback(
    (next: TripStatus) => {
      if (next === tab) return;
      const index = STATUSES.indexOf(next);
      haptics.select();
      if (Math.round(progress.value) !== index) jumpTarget.value = index;
      setTab(next);
      pagerRef.current?.scrollTo({ x: index * pagerSize.width, animated: true });
    },
    [jumpTarget, pagerSize.width, progress, tab],
  );

  const onPagerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      pageWidth.value = width;
      setPagerSize((size) => (size.width === width && size.height === height ? size : { width, height }));
    },
    [pageWidth],
  );

  const openTrip = useCallback(
    (tripId: string) => navigation.navigate('TripDetail', { tripId }),
    [navigation],
  );

  const createTrip = useCallback(() => navigation.navigate('CreateTrip'), [navigation]);

  return (
    <View className="flex-1 bg-ink-950">
      <ScreenHeader
        title={`Ciao ${profile.firstName} 👋`}
        subtitle={HUB_SUBTITLES[tab]}
        scrollY={headerScrollY}
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
        <TripsStatusTabs value={tab} progress={progress} onChange={goTo} />
      </ScreenHeader>

      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={pagerScroll}
        scrollEventThrottle={16}
        onLayout={onPagerLayout}
        style={{ flex: 1 }}
      >
        {STATUSES.map((status, index) => (
          <TripsPage
            key={status}
            status={status}
            index={index}
            progress={progress}
            width={pagerSize.width}
            height={pagerSize.height}
            topInset={headerHeight + 16}
            booting={booting}
            scrollComponent={pageScrolls[index].scrollComponent}
            onOpenTrip={openTrip}
            onCreateTrip={createTrip}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

/**
 * Una pagina del pager: la lista dei viaggi di un solo stato.
 *
 * Lo scorrimento ha profondità invece di sembrare una striscia piatta: la
 * pagina che esce verso sinistra resta indietro (parallasse) e si spegne,
 * quella che entra da destra le scivola sopra con il suo fondo pieno.
 * Solo traslazione e opacità, mai `scale`: FlashList misura il proprio
 * contenitore e una scala lo farebbe impaginare più stretto.
 */
function TripsPage({
  status,
  index,
  progress,
  width,
  height,
  topInset,
  booting,
  scrollComponent,
  onOpenTrip,
  onCreateTrip,
}: {
  status: TripStatus;
  index: number;
  progress: SharedValue<number>;
  width: number;
  height: number;
  topInset: number;
  booting: boolean;
  scrollComponent: React.ComponentType<ScrollViewProps>;
  onOpenTrip: (tripId: string) => void;
  onCreateTrip: () => void;
}) {
  const trips = useTripsByStatus(status);

  const depth = useAnimatedStyle(() => {
    // 0 quando la pagina è a fuoco, 1 quando è del tutto coperta dalla successiva.
    const behind = Math.min(Math.max(progress.value - index, 0), 1);
    return {
      opacity: interpolate(behind, [0, 1], [1, 0]),
      transform: [{ translateX: behind * width * PARALLAX }],
    };
  });

  const renderItem = useCallback(
    ({ item }: { item: Trip }) =>
      item.status === 'ongoing' ? (
        <HeroTripCard trip={item} onPress={() => onOpenTrip(item.id)} />
      ) : (
        <StandardTripCard trip={item} onPress={() => onOpenTrip(item.id)} />
      ),
    [onOpenTrip],
  );

  return (
    <Animated.View style={[{ width, height }, depth]} className="bg-ink-950">
      <FlashList
        // La lista è montata da subito, anche sotto gli skeleton: la sfocatura
        // dell'header trova già la sua ScrollView a cui agganciarsi.
        data={booting ? [] : trips}
        // La chiave di tipo tiene separati i pool di riciclo: una cella Hero non
        // viene mai riusata come card compatta (e viceversa).
        getItemType={(item) => item.status}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderScrollComponent={scrollComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topInset,
          paddingBottom: TAB_BAR_SPACE + 16,
          paddingHorizontal: 20,
        }}
        ItemSeparatorComponent={() => <View className="h-3.5" />}
        ListEmptyComponent={
          booting ? (
            <View className="gap-3.5">
              <TripCardSkeleton hero={status === 'ongoing'} />
              <TripCardSkeleton />
            </View>
          ) : (
            <EmptyTrips tab={status} />
          )
        }
        ListFooterComponent={
          // Unico punto d'ingresso alla creazione, e solo tra i viaggi futuri.
          status === 'upcoming' && !booting ? (
            <DashedPlaceholder
              emoji="🗺️"
              title="Pianifica Nuovo Viaggio"
              hint="Date, coordinatore e prima crew"
              className="mt-3.5"
              onPress={onCreateTrip}
            />
          ) : null
        }
      />
    </Animated.View>
  );
}

const TAB_ITEMS: Array<{ key: TripStatus; accessibilityLabel: string; label: string }> = [
  { key: 'ongoing', accessibilityLabel: 'Viaggio in Corso', label: 'Viaggio\nin Corso' },
  { key: 'upcoming', accessibilityLabel: 'Viaggi Futuri', label: 'Viaggi\nFuturi' },
  { key: 'past', accessibilityLabel: 'Viaggi Passati', label: 'Viaggi\nPassati' },
];

/** Distanza tra il bordo dello switcher e il rettangolo rosso. */
const TABS_INSET = 5;
/** Spessore del bordo `border` dello switcher, da togliere alla larghezza utile. */
const TABS_BORDER = 1;

/**
 * Switcher dei tre stati.
 *
 * Il rettangolo rosso occupa l'intero segmento ed è un solo elemento che
 * scivola agganciato a `progress`: trascinando il pager lo si vede seguire il
 * dito, toccando un tab lo si vede viaggiare insieme alla pagina.
 */
function TripsStatusTabs({
  value,
  progress,
  onChange,
}: {
  value: TripStatus;
  progress: SharedValue<number>;
  onChange: (tab: TripStatus) => void;
}) {
  const [width, setWidth] = useState(0);
  const segmentWidth =
    width > 0 ? (width - TABS_BORDER * 2 - TABS_INSET * 2) / TAB_ITEMS.length : 0;

  const indicator = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: Math.min(Math.max(progress.value, 0), LAST_PAGE) * segmentWidth }],
  }));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="h-[62px] flex-row rounded-control border border-ink-700 bg-ink-900"
      style={{ padding: TABS_INSET }}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          className="absolute rounded-[14px]"
          style={[
            { left: TABS_INSET, top: TABS_INSET, bottom: TABS_INSET, backgroundColor: palette.accent },
            indicator,
          ]}
        />
      ) : null}

      {TAB_ITEMS.map((item, index) => (
        <Pressable
          key={item.key}
          accessibilityRole="tab"
          accessibilityLabel={item.accessibilityLabel}
          accessibilityState={{ selected: value === item.key }}
          onPress={() => onChange(item.key)}
          className="flex-1 items-center justify-center px-2"
        >
          <StatusTabLabel label={item.label} index={index} progress={progress} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Colore e scala dell'etichetta seguono la stessa posizione del rettangolo:
 * a metà corsa i due testi sono a metà, senza scatti di colore.
 */
function StatusTabLabel({
  label,
  index,
  progress,
}: {
  label: string;
  index: number;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(progress.value - index));
    return {
      color: interpolateColor(distance, [0, 1], ['#FFFFFF', 'rgba(244,242,237,0.72)']),
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.94]) }],
    };
  });

  return (
    <Animated.Text
      numberOfLines={2}
      allowFontScaling={false}
      className="text-center text-[13px] font-extrabold leading-[15px]"
      style={style}
    >
      {label}
    </Animated.Text>
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
