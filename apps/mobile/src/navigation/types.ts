import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

/** Le due sole destinazioni della bottom bar. */
export type MainTabParamList = {
  MyTrips: undefined;
  Profile: undefined;
  // TODO: tab 'Esplora' (catalogo dei prossimi viaggi aperti) — terza voce,
  // da aggiungere qui e in `MainTabs` quando il catalogo sarà disponibile.
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  TripDetail: { tripId: string };
  CreateTrip: undefined;
  TripCreatedSuccess: { tripId: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

/**
 * Le schermate dentro i tab devono poter spingere rotte dello stack padre
 * (dettaglio viaggio, creazione): `CompositeScreenProps` unisce le due
 * navigazioni, così `navigation.navigate('TripDetail', …)` è tipizzato.
 */
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
