import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

/**
 * Curve di movimento condivise.
 *
 * Tutte le animazioni dell'app girano sull'UI thread (Reanimated), quindi
 * restano a 60/120 FPS anche mentre il JS thread sta filtrando una lista.
 * Avere le curve in un posto solo evita che ogni schermata inventi la sua
 * molla e che l'insieme sembri "scollato".
 */

/** Pressione di un bottone: rientro rapido, zero rimbalzo. */
export const pressSpring: WithSpringConfig = {
  damping: 22,
  stiffness: 420,
  mass: 0.55,
  overshootClamping: true,
};

/** Indicatore dello switcher segmentato: scivola e si assesta con un filo di slancio. */
export const slideSpring: WithSpringConfig = {
  damping: 20,
  stiffness: 260,
  mass: 0.9,
};

/** Apparizione di contenuto (filtri, card, sezioni). */
export const enterTiming: WithTimingConfig = {
  duration: 220,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
};

/** Dissolvenza corta per header blur, overlay e toast. */
export const fadeTiming: WithTimingConfig = {
  duration: 160,
  easing: Easing.out(Easing.quad),
};

/** Durata del crossfade di `expo-image` quando la foto sostituisce il blurhash. */
export const IMAGE_TRANSITION_MS = 260;

/** Snap points condivisi dai bottom sheet di editing. */
export const SHEET_SNAP_POINTS = ['62%', '92%'] as const;
