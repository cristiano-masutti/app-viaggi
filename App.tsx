import './global.css';
// Deve stare qui, prima di ogni componente: insegna a NativeWind a gestire
// `className` sulle viste animate, sul blur e sui bottom sheet.
import '@/theme/interop';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui/Toast';
import { RootNavigator } from '@/navigation/RootNavigator';
import { AppProvider } from '@/store/AppStore';
import { palette } from '@/theme/palette';

/**
 * Radice dell'app.
 *
 * L'ordine dei provider non è casuale:
 * 1. `GestureHandlerRootView` deve stare fuori da tutto, altrimenti nessun
 *    gesto nativo (press, pinch, trascinamento dei fogli) riceve eventi;
 * 2. `SafeAreaProvider` prima di chi misura gli inset (toast, header, tab bar);
 * 3. `BottomSheetModalProvider` ospita il portale dei fogli di editing;
 * 4. `AppProvider` tiene lo stato, `ToastProvider` le conferme, e sotto c'è il router.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AppProvider>
            <ToastProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </ToastProvider>
          </AppProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
