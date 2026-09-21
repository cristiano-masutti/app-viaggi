import * as ImagePicker from 'expo-image-picker';
import { Camera, Fingerprint, IdCard, LogOut, Pencil, Salad, Stethoscope } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { OfflineBadge } from '@/components/offline/OfflineStatus';
import { GhostButton } from '@/components/ui/Buttons';
import { Card, SectionLabel } from '@/components/ui/Card';
import { CopyChip } from '@/components/ui/CopyChip';
import { PressableScale } from '@/components/ui/PressableScale';
import { SmartImage } from '@/components/ui/SmartImage';
import { useToast } from '@/components/ui/Toast';
import { ImageZoomModal } from '@/components/viewers/ImageZoomModal';
import { haptics } from '@/lib/haptics';
import { BIO_MAX_LENGTH } from '@/mock/profile';
import { TAB_BAR_SPACE } from '@/navigation/FloatingTabBar';
import type { MainTabScreenProps } from '@/navigation/types';
import { useAppActions, useProfile } from '@/store/AppStore';
import { PROFILE_PASSPORT_DOC_ID, useOfflineDocument } from '@/store/OfflineLibrary';
import { palette } from '@/theme/palette';

/**
 * Profilo utente.
 *
 * Raggiungibile solo dal tab "Profilo": è il magazzino dei dati personali che i
 * viaggi riusano — il Passaporto Master si carica una volta sola qui e compare
 * in tutti i viaggi. Niente tag di personalità, niente badge: solo quello che
 * serve davvero al coordinatore e ai controlli.
 */
export function ProfileScreen(_props: MainTabScreenProps<'Profile'>) {
  const profile = useProfile();
  const { patchProfile, signOut } = useAppActions();
  const toast = useToast();

  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(profile.bio);
  const [passportZoom, setPassportZoom] = useState(false);
  const passportOffline = useOfflineDocument(PROFILE_PASSPORT_DOC_ID);

  const pickImage = useCallback(async (onPicked: (uri: string) => void) => {
    haptics.tap();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permesso negato', 'Consenti l’accesso alle foto per aggiornare l’immagine.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    onPicked(asset.uri);
  }, []);

  const confirmLogout = useCallback(() => {
    haptics.warn();
    Alert.alert('Esci dall’account?', 'I documenti salvati offline verranno rimossi da questo dispositivo.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: signOut },
    ]);
  }, [signOut]);

  return (
    <View className="flex-1 bg-ink-950">
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + 16 }}
        contentContainerClassName="gap-[22px] px-[18px] pt-16"
        showsVerticalScrollIndicator={false}
      >
        {/* Identità */}
        <View className="items-center gap-3.5">
          <View>
            <SmartImage
              uri={profile.avatar}
              tone="portrait"
              style={{ width: 104, height: 104, borderRadius: 52 }}
            />
            <PressableScale
              scaleTo={0.9}
              accessibilityLabel="Cambia foto profilo"
              onPress={() => {
                void pickImage((uri) => {
                  patchProfile({ avatar: uri });
                  toast.show('Foto profilo aggiornata');
                });
              }}
              className="absolute -bottom-0.5 -right-0.5 h-9 w-9 items-center justify-center rounded-full border-[3px] border-ink-950 bg-tangerine"
            >
              <Camera size={16} color="#FFFFFF" strokeWidth={2} />
            </PressableScale>
          </View>

          <View className="items-center gap-1">
            <Text className="text-[23px] font-extrabold tracking-tight text-white">
              {`${profile.firstName} ${profile.lastName}`}
            </Text>
            <Text className="text-[13px] font-semibold text-mist">{profile.username}</Text>
          </View>
        </View>

        {/* Bio libera */}
        <View className="gap-3">
          <SectionLabel>Chi sono &amp; il mio vibe</SectionLabel>
          <Card>
            {editingBio ? (
              <>
                <View className="rounded-[16px] border border-tangerine/45 bg-ink-850 px-4 py-3.5">
                  <TextInput
                    value={bioDraft}
                    onChangeText={setBioDraft}
                    multiline
                    maxLength={BIO_MAX_LENGTH}
                    placeholder="Racconta com'è viaggiare con te: ritmo, passioni, abitudini..."
                    placeholderTextColor={palette.textMuted}
                    textAlignVertical="top"
                    className="min-h-[112px] p-0 text-[14.5px] font-medium leading-[22px] text-bone"
                  />
                  <Text className="self-end text-[11px] font-bold text-bone/40">
                    {`${bioDraft.length}/${BIO_MAX_LENGTH}`}
                  </Text>
                </View>

                <View className="flex-row gap-2">
                  <GhostButton
                    label="Annulla"
                    className="flex-1"
                    onPress={() => {
                      setBioDraft(profile.bio);
                      setEditingBio(false);
                    }}
                  />
                  <PressableScale
                    haptic="confirm"
                    scaleTo={0.97}
                    accessibilityLabel="Salva bio"
                    onPress={() => {
                      patchProfile({ bio: bioDraft.trim() });
                      setEditingBio(false);
                      toast.show('Bio aggiornata');
                    }}
                    className="h-[48px] flex-1 items-center justify-center rounded-[15px] bg-tangerine"
                  >
                    <Text className="text-[14px] font-extrabold tracking-tight text-white">Salva</Text>
                  </PressableScale>
                </View>
              </>
            ) : (
              <>
                <Text className="text-[14.5px] font-medium leading-[22px] text-bone">{profile.bio}</Text>
                <GhostButton
                  label="Modifica bio"
                  icon={<Pencil size={15} color={palette.text} strokeWidth={2} />}
                  onPress={() => {
                    setBioDraft(profile.bio);
                    setEditingBio(true);
                  }}
                />
              </>
            )}
          </Card>
        </View>

        {/* Passaporto Master — una sola foto, riusata da tutti i viaggi */}
        <View className="gap-3">
          <SectionLabel>Passaporto master</SectionLabel>
          <Card>
            <View className="flex-row items-center gap-3">
              <View className="h-[38px] w-[38px] items-center justify-center rounded-xl border border-ink-700 bg-ink-850">
                <IdCard size={18} color={palette.text} strokeWidth={1.9} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-extrabold tracking-tight text-white">
                  Passaporto Italiano
                </Text>
                <Text className="text-[12px] font-semibold text-mist">
                  Collegato automaticamente a ogni viaggio
                </Text>
              </View>
              {/* La scansione segue la stessa regola dei documenti di viaggio:
                  sta sul telefono, non va scaricata al controllo passaporti. */}
              <OfflineBadge docId={PROFILE_PASSPORT_DOC_ID} />
            </View>

            <View className="flex-row gap-2.5">
              <MiniField label="NUMERO" value={profile.passport.number} />
              <MiniField label="SCADENZA" value={profile.passport.expiry} />
            </View>

            {/* Miniatura orizzontale compatta: la scansione non sta mai aperta a display. */}
            <View className="flex-row items-center gap-3">
              <View className="h-16 w-24 overflow-hidden rounded-xl border border-ink-700 bg-ink-800">
                <SmartImage uri={profile.passport.photoUri} style={{ width: '100%', height: '100%' }} />
              </View>

              <View className="flex-1 gap-2">
                <GhostButton label="👁️ Visualizza Foto" onPress={() => setPassportZoom(true)} />
                <GhostButton
                  label="📷 Aggiorna"
                  onPress={() => {
                    void pickImage((uri) => {
                      patchProfile({ passport: { ...profile.passport, photoUri: uri } });
                      toast.show('Scansione del passaporto aggiornata');
                    });
                  }}
                />
              </View>
            </View>
          </Card>
        </View>

        {/* Codice fiscale */}
        <View className="gap-3">
          <SectionLabel>Codice fiscale</SectionLabel>
          <Card>
            <View className="flex-row items-center gap-3">
              <View className="flex-1 gap-0.5">
                <Text className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-bone/45">
                  Codice fiscale
                </Text>
                <Text className="text-[16px] font-extrabold tracking-tight text-white">
                  {profile.fiscalCode}
                </Text>
              </View>
              <CopyChip value={profile.fiscalCode} />
            </View>
            <Text className="text-[11.5px] font-semibold leading-[17px] text-mist">
              Serve al coordinatore per prenotazioni e moduli. Per correggerlo scrivi al supporto.
            </Text>
          </Card>
        </View>

        {/* Dieta e note mediche */}
        <View className="gap-3">
          <SectionLabel>Dieta &amp; note mediche</SectionLabel>
          <Card>
            <InfoBlock
              icon={<Salad size={16} color={palette.accentSoft} strokeWidth={2} />}
              label="PREFERENZE ALIMENTARI"
              value={profile.diet}
            />
            <InfoBlock
              icon={<Stethoscope size={16} color={palette.accentSoft} strokeWidth={2} />}
              label="ALLERGIE E NOTE D'EMERGENZA"
              value={profile.medicalNotes}
            />
            <Text className="text-[11.5px] font-semibold leading-[17px] text-mist">
              Condivise solo con il coordinatore del viaggio, mai con il resto della crew.
            </Text>
            <GhostButton
              label="Modifica note"
              icon={<Pencil size={15} color={palette.text} strokeWidth={2} />}
              onPress={() => toast.show('Editing note: collegare la modale rapida')}
            />
          </Card>
        </View>

        {/* Sicurezza */}
        <View className="gap-3">
          <SectionLabel>Sicurezza</SectionLabel>
          <Card>
            <View className="flex-row items-center gap-3">
              <View className="h-[38px] w-[38px] items-center justify-center rounded-xl border border-ink-700 bg-ink-850">
                <Fingerprint size={18} color={palette.text} strokeWidth={1.9} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-extrabold tracking-tight text-white">Sblocco Rapido</Text>
                <Text className="text-[12px] font-semibold text-mist">
                  Usa il metodo di sblocco del tuo dispositivo
                </Text>
              </View>
              <Switch
                value={profile.biometricUnlock}
                onValueChange={(value) => {
                  haptics.select();
                  patchProfile({ biometricUnlock: value });
                }}
                trackColor={{ false: palette.border, true: palette.accent }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={palette.border}
              />
            </View>
          </Card>
        </View>

        {/* Logout */}
        <Animated.View>
          <GhostButton
            label="Esci dall'Account"
            tone="danger"
            className="h-14"
            icon={<LogOut size={17} color={palette.danger} strokeWidth={2} />}
            onPress={confirmLogout}
          />
        </Animated.View>
      </ScrollView>

      {/* Si apre dalla copia locale quando c'è: al gate non si dipende dalla rete. */}
      <ImageZoomModal
        uri={passportZoom ? (passportOffline.localUri ?? profile.passport.photoUri) : null}
        title="Passaporto Italiano"
        subtitle={`${profile.passport.number} · scade ${profile.passport.expiry}`}
        onClose={() => setPassportZoom(false)}
      />
    </View>
  );
}

/* ── Pezzi interni ───────────────────────────────────────────────────── */

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5 rounded-[15px] border border-ink-700 bg-ink-850 px-3.5 py-3">
      <Text className="text-[10.5px] font-bold tracking-[0.6px] text-bone/45">{label}</Text>
      <Text className="text-[14.5px] font-extrabold tracking-tight text-bone">{value}</Text>
    </View>
  );
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="gap-1.5 rounded-[16px] border border-ink-700 bg-ink-850 px-4 py-3.5">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-[10.5px] font-bold tracking-[0.6px] text-bone/45">{label}</Text>
      </View>
      <Text className="text-[14px] font-semibold leading-5 text-bone">{value}</Text>
    </View>
  );
}
