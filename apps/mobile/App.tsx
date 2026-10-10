import './global.css';
// Deve stare qui, prima di ogni componente: insegna a NativeWind a gestire
// `className` sulle viste animate, sul blur e sui bottom sheet.
import '@/theme/interop';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { RootNavigator } from '@/navigation/RootNavigator';
import { AppProvider, useAppNotices } from '@/store/AppStore';
import { OfflineLibraryProvider } from '@/store/OfflineLibrary';
import { palette } from '@/theme/palette';

/**
 * Radice dell'app.
 *
 * L'ordine dei provider non è casuale:
 * 1. `GestureHandlerRootView` deve stare fuori da tutto, altrimenti nessun
 *    gesto nativo (press, pinch, trascinamento dei fogli) riceve eventi;
 * 2. `SafeAreaProvider` prima di chi misura gli inset (toast, header, tab bar);
 * 3. `BottomSheetModalProvider` ospita il portale dei fogli di editing;
 * 4. `AuthProvider` sa chi è l'utente (Supabase, o il login finto del
 *    prototipo) e dà il token allo store;
 * 5. `AppProvider` tiene lo stato; `OfflineLibraryProvider` sta subito sotto
 *    perché legge i documenti da lì e li scrive sul disco appena compaiono;
 * 6. `ToastProvider` le conferme (e gli avvisi dello store), e sotto c'è il router.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <AppProvider>
              <OfflineLibraryProvider>
                <ToastProvider>
                  <StoreNotices />
                  <StatusBar style="light" />
                  <RootNavigator />
                </ToastProvider>
              </OfflineLibraryProvider>
            </AppProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Gli avvisi dello store (es. "modifica non salvata") diventano toast. */
function StoreNotices() {
  const toast = useToast();
  useAppNotices(toast.show);
  return null;
}
