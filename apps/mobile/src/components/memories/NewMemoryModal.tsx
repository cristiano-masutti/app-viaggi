import * as ImagePicker from 'expo-image-picker';
import { Camera, Lock, NotebookPen, Users, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/Buttons';
import { FilterChipRow } from '@/components/ui/FilterChipRow';
import { SmartImage } from '@/components/ui/SmartImage';
import { haptics } from '@/lib/haptics';
import { palette } from '@/theme/palette';
import type { DayId, MemoryVisibility, NewMemoryDraft, NoteMood, Trip } from '@/types';

interface Props {
  visible: boolean;
  trip: Trip;
  /** Giorno preselezionato: quello corrente per un viaggio live, G1 altrimenti. */
  defaultDayId: DayId;
  onClose: () => void;
  onSave: (draft: NewMemoryDraft) => void;
}

const MOODS: NoteMood[] = ['😂 Aneddoto', '📍 Posto', '💭 Pensiero'];

const NOTE_MAX = 280;
const CAPTION_MAX = 90;

/**
 * Modale "Nuovo Ricordo".
 *
 * Tre decisioni in fila, sempre nello stesso ordine: **a quale giorno**
 * appartiene (obbligatorio: senza tappa il ricordo non è filtrabile da nessuno),
 * **che cosa** è (foto/video o nota) e **chi può vederlo**. È l'unico punto
 * d'ingresso per aggiungere contenuti a un viaggio.
 */
export function NewMemoryModal({ visible, trip, defaultDayId, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [dayId, setDayId] = useState<DayId>(defaultDayId);
  const [format, setFormat] = useState<'media' | 'note'>('media');
  const [visibility, setVisibility] = useState<MemoryVisibility>('crew');
  const [mood, setMood] = useState<NoteMood>(MOODS[0]);
  const [text, setText] = useState('');
  const [uri, setUri] = useState<string | null>(null);

  // Ogni apertura riparte pulita: nessuna bozza fantasma della volta prima.
  useEffect(() => {
    if (!visible) return;
    setDayId(defaultDayId);
    setFormat('media');
    setVisibility('crew');
    setMood(MOODS[0]);
    setText('');
    setUri(null);
  }, [defaultDayId, visible]);

  const dayChips = useMemo(
    () => trip.days.map((day) => ({ key: day.id, label: `${day.label} · ${day.date}` })),
    [trip.days],
  );

  const pickMedia = async () => {
    haptics.tap();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permesso negato', 'Consenti l’accesso alle foto per caricare un ricordo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.9,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setUri(asset.uri);
  };

  const canSave = format === 'media' ? !!uri : text.trim().length > 2;

  return (
    <FullScreenSheet visible={visible} onClose={onClose}>
      <View className="flex-row items-center gap-3 px-[18px] pb-3" style={{ paddingTop: insets.top + 10 }}>
        <Pressable
          onPress={() => {
            haptics.tap();
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Chiudi"
          className="h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-ink-700 bg-ink-900"
        >
          <X size={18} color={palette.text} strokeWidth={2.2} />
        </Pressable>
        <Text className="flex-1 text-[19px] font-extrabold tracking-tight text-bone">Nuovo Ricordo</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="gap-[22px] px-[18px] pb-8 pt-3"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1 · Giorno — obbligatorio */}
          <View className="gap-2.5">
            <StepLabel step={1} text="A quale giorno lo associ?" />
            <FilterChipRow
              chips={dayChips}
              value={dayId}
              onChange={setDayId}
              accessibilityLabel="Scegli il giorno del ricordo"
            />
          </View>

          {/* 2 · Formato */}
          <View className="gap-2.5">
            <StepLabel step={2} text="Che tipo di ricordo?" />
            <View className="flex-row gap-2.5">
              <FormatCard
                active={format === 'media'}
                label="Foto / Video"
                icon={
                  <Camera
                    size={20}
                    color={format === 'media' ? palette.accentSoft : 'rgba(244,242,237,0.7)'}
                    strokeWidth={2}
                  />
                }
                onPress={() => {
                  haptics.select();
                  setFormat('media');
                }}
              />
              <FormatCard
                active={format === 'note'}
                label="Nota nel Diario"
                icon={
                  <NotebookPen
                    size={20}
                    color={format === 'note' ? palette.accentSoft : 'rgba(244,242,237,0.7)'}
                    strokeWidth={2}
                  />
                }
                onPress={() => {
                  haptics.select();
                  setFormat('note');
                }}
              />
            </View>
          </View>

          {format === 'media' ? (
            <Animated.View entering={FadeIn.duration(180)} className="gap-3">
              <Pressable
                onPress={() => {
                  void pickMedia();
                }}
                accessibilityRole="button"
                accessibilityLabel="Carica dalla galleria"
                className="h-[200px] items-center justify-center gap-2.5 overflow-hidden rounded-card border border-dashed border-tangerine/55 bg-tangerine/10"
              >
                {uri ? (
                  <SmartImage uri={uri} style={{ position: 'absolute', width: '100%', height: '100%' }} />
                ) : (
                  <>
                    <Camera size={26} color={palette.accent} strokeWidth={1.9} />
                    <Text className="text-[14.5px] font-extrabold tracking-tight text-tangerine">
                      Carica dalla galleria
                    </Text>
                    <Text className="text-[12px] font-semibold text-bone/60">
                      {`Verrà associato a ${dayId}`}
                    </Text>
                  </>
                )}
              </Pressable>

              <View className="rounded-control border border-ink-700 bg-ink-900 px-4 py-3.5">
                <TextInput
                  value={text}
                  onChangeText={setText}
                  maxLength={CAPTION_MAX}
                  placeholder="Didascalia breve (facoltativa)"
                  placeholderTextColor={palette.textMuted}
                  className="p-0 text-[14.5px] font-bold text-bone"
                />
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(180)} className="gap-3">
              {/* La nota si scrive già sulla carta avorio su cui apparirà. */}
              <View className="rounded-card border border-cream-line bg-cream p-4">
                <Text className="text-[11px] font-bold tracking-[0.9px] text-cream-ink/55">
                  {`${dayId} • ORA • TU`}
                </Text>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={NOTE_MAX}
                  placeholder="Un aneddoto, una battuta o un posto da non perdere..."
                  placeholderTextColor="rgba(28,25,23,0.38)"
                  textAlignVertical="top"
                  className="mt-2.5 min-h-[120px] p-0 text-[15px] font-medium leading-[22px] text-cream-ink"
                />
                <Text className="self-end text-[11px] font-bold text-cream-ink/45">
                  {`${text.length}/${NOTE_MAX}`}
                </Text>
              </View>

              <FilterChipRow
                chips={MOODS.map((item) => ({ key: item, label: item }))}
                value={mood}
                onChange={(key) => setMood(key as NoteMood)}
                accessibilityLabel="Tag della nota"
              />
            </Animated.View>
          )}

          <PrimaryButton
            label={format === 'note' ? 'Salva nel Diario 📝' : 'Salva il ricordo 🚀'}
            haptic="confirm"
            disabled={!canSave}
            onPress={() =>
              onSave({
                dayId,
                format,
                visibility,
                mood,
                text: text.trim(),
                uri: uri ?? undefined,
              })
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </FullScreenSheet>
  );
}

/* ── Pezzi interni ───────────────────────────────────────────────────── */

function StepLabel({ step, text }: { step: number; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-tangerine/20">
        <Text className="text-[10.5px] font-extrabold text-tangerine-soft">{step}</Text>
      </View>
      <Text className="text-[12.5px] font-extrabold tracking-tight text-bone/60">{text}</Text>
    </View>
  );
}

function FormatCard({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-1 gap-2.5 rounded-card border p-4 ${
        active ? 'bg-tangerine/12 border-tangerine/55' : 'border-ink-700 bg-ink-900'
      }`}
    >
      {icon}
      <Text className={`text-[13.5px] font-extrabold ${active ? 'text-tangerine-soft' : 'text-bone/70'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function VisibilityOption({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-[14px] ${
        active ? 'bg-tangerine/20' : ''
      }`}
    >
      {icon}
      <Text
        numberOfLines={1}
        className={`text-[12.5px] ${active ? 'font-extrabold text-tangerine-soft' : 'font-bold text-bone/55'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Guscio a schermo intero: separato per tenere leggibile il corpo della modale. */
function FullScreenSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView className="flex-1 bg-ink-950" edges={['bottom']}>
        {children}
      </SafeAreaView>
    </Modal>
  );
}
