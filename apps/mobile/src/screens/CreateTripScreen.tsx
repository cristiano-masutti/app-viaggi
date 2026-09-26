import * as ImagePicker from 'expo-image-picker';
import { CalendarDays, Camera, ImagePlus, Phone, UserPlus, UserRound, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/Buttons';
import { SectionLabel } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { PressableScale } from '@/components/ui/PressableScale';
import { SmartImage } from '@/components/ui/SmartImage';
import { maskItalianDate, parseItalianDate, toISO } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import type { RootStackScreenProps } from '@/navigation/types';
import { useAppActions, useProfile } from '@/store/AppStore';
import { palette } from '@/theme/palette';

const COVER_HEIGHT = 176;

/**
 * Creazione di un nuovo viaggio.
 *
 * Form minimale: copertina, destinazione, date, coordinatore e prima crew.
 * Nessun orario e nessun programma: i documenti del singolo giorno si aggiungono
 * dentro al viaggio, dove servono. La copertina si sceglie solo dal rullino —
 * niente galleria di preset finti che poi nessuno userebbe.
 */
export function CreateTripScreen({ navigation }: RootStackScreenProps<'CreateTrip'>) {
  const profile = useProfile();
  const { createTrip } = useAppActions();

  const [cover, setCover] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coordinator, setCoordinator] = useState(`${profile.firstName} ${profile.lastName}`);
  const [coordinatorPhone, setCoordinatorPhone] = useState('');
  const [crewInput, setCrewInput] = useState('');
  const [crew, setCrew] = useState<string[]>([]);

  /** Durata calcolata in tempo reale: `null` finché le date non sono complete e coerenti. */
  const duration = useMemo(() => {
    const from = parseItalianDate(startDate);
    const to = parseItalianDate(endDate);
    if (!from || !to) return null;
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    return days > 0 ? { days, from, to } : null;
  }, [endDate, startDate]);

  const datesInverted = !!parseItalianDate(startDate) && !!parseItalianDate(endDate) && !duration;
  const canCreate = title.trim().length > 1 && !!duration && coordinator.trim().length > 1;

  const pickCover = useCallback(async () => {
    haptics.tap();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permesso negato', 'Consenti l’accesso alle foto per scegliere una copertina.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setCover(asset.uri);
  }, []);

  const addCrewMember = useCallback(() => {
    const name = crewInput.trim();
    if (!name) return;
    haptics.select();
    setCrew((previous) => (previous.includes(name) ? previous : [...previous, name]));
    setCrewInput('');
  }, [crewInput]);

  const submit = useCallback(() => {
    if (!duration) return;
    const trip = createTrip({
      title: title.trim(),
      cover: cover ?? undefined,
      startDate: toISO(duration.from),
      endDate: toISO(duration.to),
      coordinatorName: coordinator.trim(),
      coordinatorPhone: coordinatorPhone.trim(),
      crewNames: crew,
    });
    // `replace`: chi torna indietro dalla schermata di successo non ricade nel form.
    navigation.replace('TripCreatedSuccess', { tripId: trip.id });
  }, [cover, coordinator, coordinatorPhone, createTrip, crew, duration, navigation, title]);

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 border-b border-ink-700 px-[18px] pb-3.5 pt-1">
        <PressableScale
          onPress={() => navigation.goBack()}
          scaleTo={0.94}
          accessibilityLabel="Annulla creazione viaggio"
          className="h-[42px] flex-row items-center gap-1.5 rounded-[14px] border border-ink-700 bg-ink-900 px-3"
        >
          <X size={17} color={palette.text} strokeWidth={2.1} />
          <Text className="text-[13.5px] font-bold tracking-tight text-bone">Annulla</Text>
        </PressableScale>
        <Text className="flex-1 text-center text-[16.5px] font-extrabold tracking-tight text-white">
          Nuovo Viaggio
        </Text>
        {/* Spaziatore speculare al tasto Annulla: tiene il titolo davvero al centro. */}
        <View className="h-[42px] w-[92px]" />
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="gap-6 px-[18px] pb-8 pt-5"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1 · Copertina — un solo box, dal rullino */}
          <View className="gap-2.5">
            <SectionLabel>Copertina</SectionLabel>
            <PressableScale
              onPress={() => {
                void pickCover();
              }}
              scaleTo={0.985}
              accessibilityLabel={cover ? 'Cambia foto di copertina' : 'Carica una foto dal rullino'}
              style={{ height: COVER_HEIGHT }}
              className="w-full items-center justify-center overflow-hidden rounded-card border border-ink-700 bg-ink-900"
            >
              {cover ? (
                <>
                  <SmartImage uri={cover} style={{ position: 'absolute', width: '100%', height: '100%' }} />
                  <View className="absolute bottom-3 right-3 flex-row items-center gap-2 rounded-xl border border-white/15 bg-ink-950/75 px-3.5 py-2">
                    <Camera size={15} color="#FFFFFF" strokeWidth={2} />
                    <Text className="text-[12.5px] font-bold tracking-tight text-white">Cambia foto</Text>
                  </View>
                </>
              ) : (
                <View className="items-center gap-2.5">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-ink-700">
                    <ImagePlus size={20} color={palette.text} strokeWidth={2} />
                  </View>
                  <Text className="text-[13.5px] font-extrabold tracking-tight text-bone">
                    Carica dal rullino
                  </Text>
                  <Text className="text-[12px] font-semibold text-mist">Formato consigliato 16:9</Text>
                </View>
              )}
            </PressableScale>
          </View>

          {/* 2 · Destinazione */}
          <View className="gap-2.5">
            <SectionLabel>Destinazione</SectionLabel>
            <FormField
              value={title}
              onChangeText={setTitle}
              placeholder="es. Islanda On The Road 🇮🇸"
              maxLength={60}
            />
          </View>

          {/* 3 · Date, con durata calcolata mentre si digita */}
          <View className="gap-2.5">
            <SectionLabel>Date del viaggio</SectionLabel>
            <View className="flex-row gap-2.5">
              <FormField
                className="flex-1"
                label="Partenza"
                value={startDate}
                onChangeText={(text) => setStartDate(maskItalianDate(text))}
                placeholder="GG/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
                icon={<CalendarDays size={16} color={palette.textMuted} strokeWidth={2} />}
              />
              <FormField
                className="flex-1"
                label="Rientro"
                value={endDate}
                onChangeText={(text) => setEndDate(maskItalianDate(text))}
                placeholder="GG/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
                icon={<CalendarDays size={16} color={palette.textMuted} strokeWidth={2} />}
              />
            </View>

            {duration ? (
              <Animated.View
                entering={FadeIn.duration(180)}
                className="self-start rounded-chip border border-tangerine/45 bg-tangerine/15 px-3 py-1.5"
              >
                <Text className="text-[11.5px] font-extrabold text-tangerine-tint">
                  {`${duration.days} giorni previsti (da G1 a G${duration.days})`}
                </Text>
              </Animated.View>
            ) : datesInverted ? (
              <Text className="text-[11.5px] font-bold text-danger">
                Il rientro deve essere successivo alla partenza.
              </Text>
            ) : (
              <Text className="text-[11.5px] font-semibold text-mist">
                Inserisci le due date per calcolare la durata.
              </Text>
            )}
          </View>

          {/* 4 · Coordinatore */}
          <View className="gap-2.5">
            <SectionLabel>Coordinatore del viaggio</SectionLabel>
            <FormField
              value={coordinator}
              onChangeText={setCoordinator}
              placeholder="Nome del coordinatore"
              autoCapitalize="words"
              icon={<UserRound size={16} color={palette.textMuted} strokeWidth={2} />}
            />
            <FormField
              value={coordinatorPhone}
              onChangeText={setCoordinatorPhone}
              placeholder="+39 333 000 0000"
              keyboardType="phone-pad"
              icon={<Phone size={16} color={palette.textMuted} strokeWidth={2} />}
            />
            <Text className="text-[11.5px] font-semibold leading-[17px] text-mist">
              È il primo contatto del gruppo: finisce in cima alla sezione SOS del viaggio.
            </Text>
          </View>

          {/* 5 · Crew iniziale */}
          <View className="gap-2.5">
            <SectionLabel>Compagni di viaggio (opzionale)</SectionLabel>
            <View className="flex-row items-end gap-2.5">
              <FormField
                className="flex-1"
                value={crewInput}
                onChangeText={setCrewInput}
                placeholder="Nome compagno"
                autoCapitalize="words"
                icon={<UserPlus size={16} color={palette.textMuted} strokeWidth={2} />}
              />
              <PressableScale
                onPress={addCrewMember}
                disabled={crewInput.trim().length === 0}
                scaleTo={0.94}
                accessibilityLabel="Aggiungi compagno"
                className="h-[54px] items-center justify-center rounded-control border border-ink-700 bg-ink-850 px-4"
              >
                <Text className="text-[13.5px] font-extrabold tracking-tight text-bone">Aggiungi</Text>
              </PressableScale>
            </View>

            {crew.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {crew.map((name) => (
                  <Animated.View key={name} layout={LinearTransition.duration(180)} entering={FadeIn}>
                    <PressableScale
                      haptic="select"
                      scaleTo={0.92}
                      accessibilityLabel={`Rimuovi ${name}`}
                      onPress={() => setCrew((previous) => previous.filter((item) => item !== name))}
                      className="h-9 flex-row items-center gap-2 rounded-chip border border-ink-700 bg-ink-900 px-3.5"
                    >
                      <Text className="text-[13px] font-bold text-bone">{name}</Text>
                      <X size={13} color={palette.textMuted} strokeWidth={2.4} />
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View className="border-t border-ink-700 bg-ink-950 px-[18px] pb-2 pt-3.5">
          <PrimaryButton label="Crea Viaggio 🚀" haptic="confirm" disabled={!canCreate} onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
