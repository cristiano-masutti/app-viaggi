import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToastApi {
  /** Conferma discreta dopo un salvataggio. Si sovrascrive, non si accoda. */
  show: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VISIBLE_MS = 1900;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message ? (
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          exiting={FadeOutDown.duration(140)}
          pointerEvents="none"
          style={{ bottom: insets.bottom + 96 }}
          className="absolute left-0 right-0 items-center px-5"
        >
          <View className="rounded-chip border border-ink-700 bg-ink-900 px-4 py-2.5">
            <Text className="text-[13px] font-bold tracking-tight text-bone">{message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast va usato dentro <ToastProvider />');
  return api;
}
