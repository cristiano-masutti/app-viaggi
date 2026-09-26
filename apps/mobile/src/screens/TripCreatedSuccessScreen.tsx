import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, CalendarDays, Check, Users } from 'lucide-react-native';
import React, { useCallback, useEffect } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SoftActionButton } from '@/components/ui/Buttons';
import { CopyChip } from '@/components/ui/CopyChip';
import { AvatarStack } from '@/components/ui/Avatar';
import { SmartImage } from '@/components/ui/SmartImage';
import { dateRange } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { crewLabel, inviteLink } from '@/lib/trip';
import type { RootStackScreenProps } from '@/navigation/types';
import { useTrip } from '@/store/AppStore';
import { palette } from '@/theme/palette';

/**
 * Schermata celebrativa del viaggio appena creato.
 *
 * Esiste per una cosa sola: far uscire l'invito dalle mani di chi ha creato il
 * viaggio. Riepilogo essenziale, link copiabile, condivisione su WhatsApp e poi
 * fuori — nessuna configurazione ulteriore da fare qui.
 */
export function TripCreatedSuccessScreen({ navigation, route }: RootStackScreenProps<'TripCreatedSuccess'>) {
  const trip = useTrip(route.params.tripId);

  useEffect(() => {
    haptics.confirm();
  }, []);

  const link = trip ? inviteLink(trip) : '';

  const shareOnWhatsApp = useCallback(async () => {
    if (!trip) return;
    const message = `Si parte! 🎒 ${trip.title}\n${dateRange(trip.startDate, trip.endDate)}\n\nUnisciti alla crew: https://${link}`;
    const appUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const webUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    // Se WhatsApp non è installato si apre comunque il fallback web.
    const canOpen = await Linking.canOpenURL(appUrl).catch(() => false);
    void Linking.openURL(canOpen ? appUrl : webUrl);
  }, [link, trip]);

  if (!trip) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-ink-950">
        <Text className="text-[15px] font-bold text-bone">Viaggio non trovato.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['rgba(255,91,34,0.26)', 'rgba(255,91,34,0.05)', 'transparent']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 420 }}
      />

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScrollView
          contentContainerClassName="flex-grow gap-6 px-[18px] pb-4 pt-8"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(420)} className="items-center gap-3">
            <View className="h-16 w-16 items-center justify-center rounded-full border border-tangerine/40 bg-tangerine/15">
              <Check size={30} color={palette.accent} strokeWidth={2.8} />
            </View>
            <Text className="text-center text-[28px] font-extrabold tracking-tight text-white">
              Viaggio creato! 🚀
            </Text>
            <Text className="max-w-[32ch] text-center text-[14px] font-semibold leading-5 text-mist">
              Ora manca solo la crew. Manda il link e i posti iniziano a riempirsi.
            </Text>
          </Animated.View>

          {/* Riepilogo */}
          <Animated.View
            entering={FadeInUp.delay(120).duration(420)}
            className="overflow-hidden rounded-hero border border-ink-700 bg-ink-900"
          >
            <View className="h-[132px] bg-ink-800">
              <SmartImage
                uri={trip.cover}
                blurhash={trip.coverBlurhash}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
              />
              <LinearGradient
                colors={['transparent', 'rgba(13,13,17,0.92)']}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
              />
              <Text
                numberOfLines={2}
                className="absolute bottom-3.5 left-4 right-4 text-[21px] font-extrabold tracking-tight text-white"
              >
                {trip.title}
              </Text>
            </View>

            <View className="gap-3 p-4">
              <View className="flex-row items-center gap-2.5">
                <CalendarDays size={16} color={palette.accentSoft} strokeWidth={2} />
                <Text className="flex-1 text-[13.5px] font-bold text-bone">
                  {`${dateRange(trip.startDate, trip.endDate)} · ${trip.totalDays} giorni`}
                </Text>
              </View>
              <View className="flex-row items-center gap-2.5">
                <Users size={16} color={palette.accentSoft} strokeWidth={2} />
                <Text className="flex-1 text-[13.5px] font-bold text-bone">{crewLabel(trip)}</Text>
                <AvatarStack members={trip.crew} max={3} size={28} />
              </View>
            </View>
          </Animated.View>

          {/* Invito */}
          <Animated.View entering={FadeInUp.delay(200).duration(420)} className="gap-3">
            <Text className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-bone/45">
              Link di invito della crew
            </Text>
            <View className="gap-3 rounded-card border border-ink-700 bg-ink-900 p-4">
              <View className="flex-row items-center gap-3">
                <Text
                  numberOfLines={1}
                  className="flex-1 text-[14px] font-extrabold tracking-tight text-bone"
                >
                  {link}
                </Text>
                <CopyChip value={`https://${link}`} />
              </View>
              <Text className="text-[11.5px] font-semibold leading-[17px] text-mist">
                Chi apre il link entra direttamente nel viaggio, senza creare un account nuovo.
              </Text>
            </View>

            <SoftActionButton
              label="💬 Condividi su WhatsApp"
              onPress={() => {
                haptics.tap();
                void shareOnWhatsApp();
              }}
            />
          </Animated.View>

          <View className="mt-auto pt-6">
            <PrimaryButton
              label="Vai ai Miei Viaggi"
              icon={<ArrowRight size={18} color="#FFFFFF" strokeWidth={2.6} />}
              onPress={() => navigation.navigate('Main', { screen: 'MyTrips' })}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
