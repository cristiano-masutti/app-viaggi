import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';

import { MyTripsScreen } from '@/screens/MyTripsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';

import { FloatingTabBar } from './FloatingTabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Bottom Navigation Bar — due sole voci.
 *
 * 🎒 I Miei Viaggi e 👤 Profilo. Il tab Profilo è l'unico ingresso all'area
 * personale: negli header non esiste nessun avatar cliccabile.
 *
 * L'header di navigazione è spento ovunque perché ogni schermata disegna il
 * proprio header sfocato, che deve poter stare *sopra* il contenuto.
 */
export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // La barra è flottante: le schermate scorrono per intero sotto di essa.
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tab.Screen name="MyTrips" component={MyTripsScreen} options={{ title: 'I Miei Viaggi' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profilo' }} />

      {/*
        TODO — Tab "Esplora" (catalogo dei viaggi aperti):
        <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: 'Esplora' }} />
        Aggiungere la voce in `MainTabParamList`, l'icona in `FloatingTabBar.ICONS`
        e l'etichetta in `FloatingTabBar.LABELS`: il resto della barra si adatta da sé.
      */}
    </Tab.Navigator>
  );
}
