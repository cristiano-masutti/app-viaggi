import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useAppState } from '@/store/AppStore';
import { CreateTripScreen } from '@/screens/CreateTripScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { TripCreatedSuccessScreen } from '@/screens/TripCreatedSuccessScreen';
import { TripDetailScreen } from '@/screens/TripDetailScreen';
import { palette } from '@/theme/palette';

import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Tema di React Navigation allineato alla palette: niente flash bianchi tra una schermata e l'altra. */
const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.accent,
    background: palette.background,
    card: palette.surface,
    text: palette.text,
    border: palette.border,
  },
};

/**
 * Router principale.
 *
 * L'autenticazione decide quale gruppo di schermate esiste: finché non si è
 * dentro, la sola rotta montata è il Login — non c'è nessun "torna indietro"
 * che riporti a una schermata protetta.
 */
export function RootNavigator() {
  const { authenticated } = useAppState();

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
          // Transizione nativa: la spinta laterale è gestita dal sistema, non dal JS.
          animation: 'slide_from_right',
        }}
      >
        {authenticated ? (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="TripDetail" component={TripDetailScreen} />
            {/*
              Sale dal basso come una modale, ma resta una rotta normale dello
              stack: così può essere sostituita con la schermata di successo
              senza che l'utente veda due transizioni incatenate.
            */}
            <Stack.Screen
              name="CreateTrip"
              component={CreateTripScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="TripCreatedSuccess"
              component={TripCreatedSuccessScreen}
              options={{ animation: 'fade', gestureEnabled: false }}
            />
          </Stack.Group>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
