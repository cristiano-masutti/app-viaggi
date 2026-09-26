import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Eye, EyeOff, Lock, User } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInput as TextInputRef,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SmartImage } from '@/components/ui/SmartImage';
import { useAppActions } from '@/store/AppStore';
import { palette } from '@/theme/palette';

/** Chiave della sessione salvata: la sua presenza abilita lo Sblocco Rapido. */
const SESSION_KEY = 'vibemakers.session';
const LOGIN_HERO_IMAGE = require('../../assets/login-hero.png');

/**
 * Login essenziale.
 *
 * Solo credenziali fornite dall'organizzazione: niente login social, niente
 * registrazione autonoma, nessun quiz introduttivo. Chi non ha le credenziali
 * ha un solo percorso — scrivere al coordinatore.
 *
 * Lo sblocco biometrico è volutamente agnostico: icona neutra e dicitura
 * "Sblocco Rapido", identiche su iOS e Android. Sotto c'è comunque il prompt
 * nativo del sistema, che userà ciò che il device ha configurato.
 */
export function LoginScreen() {
  const { signIn } = useAppActions();
  const passwordRef = useRef<TextInputRef>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickUnlockAvailable, setQuickUnlockAvailable] = useState(false);

  const quickUnlock = useCallback(async () => {
    setError(null);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Conferma la tua identità',
      cancelLabel: 'Annulla',
      disableDeviceFallback: false,
    });

    if (result.success) {
      signIn();
      return;
    }
    if ('error' in result && result.error && result.error !== 'user_cancel') {
      setError('Sblocco rapido non riuscito. Usa le credenziali.');
    }
  }, [signIn]);

  // Lo Sblocco Rapido compare solo se c'è hardware, un'impronta/volto registrato
  // e una sessione salvata: altrimenti è un bottone che non può funzionare.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [hasHardware, isEnrolled, session] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync(SESSION_KEY).catch(() => null),
      ]);
      if (!cancelled) setQuickUnlockAvailable(hasHardware && isEnrolled && !!session);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignIn = useCallback(async () => {
    const missingUsername = username.trim().length === 0;
    const missingPassword = password.length === 0;

    if (missingUsername || missingPassword) {
      if (missingUsername && missingPassword) {
        setError('Mancano nome utente e password.');
      } else if (missingUsername) {
        setError('Manca il nome utente.');
      } else {
        setError('Manca la password.');
      }
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // TODO — AUTH: sostituire con la chiamata reale dell'organizzazione.
      await new Promise((resolve) => setTimeout(resolve, 700));
      await SecureStore.setItemAsync(SESSION_KEY, 'token-placeholder').catch(() => null);
      signIn();
    } catch {
      setError('Credenziali non valide. Contatta il coordinatore.');
    } finally {
      setLoading(false);
    }
  }, [password, signIn, username]);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['rgba(255,91,34,0.20)', 'rgba(255,91,34,0.04)', 'transparent']}
        style={{ position: 'absolute', left: 0, right: 0, top: -30, height: 390 }}
      />
      <View className="pointer-events-none absolute left-0 right-0 top-0 h-[440px] overflow-hidden">
        <SmartImage
          source={LOGIN_HERO_IMAGE}
          tone="ink"
          contentFit="cover"
          contentPosition="top center"
          className="h-full w-full opacity-80"
          accessibilityLabel="Foto di viaggio"
        />
        <LinearGradient
          colors={[
            'rgba(11,15,25,0)',
            'rgba(11,15,25,0)',
            'rgba(11,15,25,0.08)',
            'rgba(11,15,25,0.82)',
            'rgba(11,15,25,1)',
          ]}
          locations={[0, 0.78, 0.84, 0.93, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerClassName="flex-grow px-6 pb-9 pt-0"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(380)}>
              <View className="h-[260px]" />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).duration(380)} className="mt-6 gap-4">
              <Field
                icon={<User size={19} color={palette.textMuted} strokeWidth={1.9} />}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setError(null);
                }}
                placeholder="Nome utente"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              <Field
                ref={passwordRef}
                icon={<Lock size={19} color={palette.textMuted} strokeWidth={1.9} />}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(null);
                }}
                placeholder="Password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={() => {
                  void handleSignIn();
                }}
                trailing={
                  <Pressable
                    hitSlop={10}
                    accessibilityLabel={showPassword ? 'Nascondi password' : 'Mostra password'}
                    onPress={() => setShowPassword((visible) => !visible)}
                    className="h-11 w-11 items-center justify-center rounded-xl"
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="rgba(244,242,237,0.6)" strokeWidth={1.9} />
                    ) : (
                      <Eye size={20} color="rgba(244,242,237,0.6)" strokeWidth={1.9} />
                    )}
                  </Pressable>
                }
              />

              {error ? (
                <Text className="px-1 text-[13px] font-bold" style={{ color: palette.accentSoft }}>
                  {error}
                </Text>
              ) : null}

              <Pressable
                onPress={() => {
                  void handleSignIn();
                }}
                disabled={loading}
                accessibilityLabel="Accedi"
                className="mt-6 h-[62px] min-w-[260px] flex-row items-center justify-center self-center rounded-control px-10"
                style={
                  {
                    backgroundColor: canSubmit ? '#C5161D' : 'transparent',
                    borderWidth: 2,
                    borderColor: '#C5161D',
                    shadowOpacity: 0,
                    shadowRadius: 0,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 0,
                  }
                }
              >
                {loading ? (
                  <View className="mr-2">
                    <ActivityIndicator color={canSubmit ? '#FFFFFF' : '#C5161D'} />
                  </View>
                ) : null}
                <Text className="text-[18px] font-extrabold tracking-tight" style={{ color: canSubmit ? '#F4F2ED' : '#C5161D' }}>
                  {loading ? 'Verifica…' : 'Accedi'}
                </Text>
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(140).duration(380)} className="mt-7 gap-3">
              <View className="w-full flex-row items-center gap-3">
                <View className="h-px flex-1 bg-ink-700" />
                <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-bone/40">oppure</Text>
                <View className="h-px flex-1 bg-ink-700" />
              </View>

              <Pressable
                onPress={() => {
                  void quickUnlock();
                }}
                disabled={!quickUnlockAvailable}
                accessibilityLabel="Sblocco rapido"
                className={`h-[62px] min-w-[260px] flex-row items-center justify-center self-center rounded-control px-10 ${
                  quickUnlockAvailable ? 'bg-[#1E5BB8]' : 'bg-[#1A2336]'
                }`}
              >
                <Text className={`text-[16px] font-extrabold tracking-tight ${quickUnlockAvailable ? 'text-bone' : 'text-bone/55'}`}>
                  Sblocco Biometrico
                </Text>
              </Pressable>
            </Animated.View>

            <View className="mt-auto items-center pt-10">
              <Text className="text-[13px] font-semibold text-bone/40">
                Problemi con le credenziali? Contatta il coordinatore
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ── Campo di testo ──────────────────────────────────────────────────── */

interface FieldProps extends React.ComponentProps<typeof TextInput> {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
}

/** Il bordo si accende in arancione sul focus: dice dove sta scrivendo l'utente. */
const Field = React.forwardRef<TextInputRef, FieldProps>(function Field(
  { icon, trailing, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      className={`h-[60px] flex-row items-center gap-3 rounded-control border border-ink-700 bg-ink-900 pl-4 ${
        trailing ? 'pr-2' : 'pr-4'
      } ${focused ? 'border-tangerine' : ''}`}
    >
      {icon}
      <TextInput
        ref={ref}
        autoCorrect={false}
        placeholderTextColor={palette.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex-1 p-0 text-[16px] font-bold text-bone"
        {...inputProps}
      />
      {trailing}
    </View>
  );
});
