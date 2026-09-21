import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Feedback tattile.
 *
 * Regola: leggero e raro. Si sente sui bottoni primari, sulla selezione dei
 * filtri orizzontali e sulle conferme — mai sullo scroll, mai due volte per lo
 * stesso gesto. Su web i moduli nativi non esistono, quindi diventa un no-op.
 *
 * Le chiamate sono fire-and-forget: un device senza motore aptico rigetta la
 * promise e non deve far esplodere la UI.
 */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const run = (fire: () => Promise<void>) => {
  if (!supported) return;
  void fire().catch(() => {
    /* device senza feedback aptico: si procede in silenzio */
  });
};

export const haptics = {
  /** Tocco su bottone primario o card. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Cambio di chip/tab in una riga di filtri. */
  select: () => run(() => Haptics.selectionAsync()),
  /** Salvataggio riuscito, viaggio creato, ricordo pubblicato. */
  confirm: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Azione bloccata o distruttiva. */
  warn: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
